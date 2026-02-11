

## Migrar llamadas de notificacion a la Edge Function `enviar-notificacion`

### Problema
Actualmente hay 3 lugares donde se llama directamente al webhook N8N `/manda_notificacion` con tokens hardcodeados expuestos:

1. **`src/pages/admin/Inmobiliarias.tsx` (linea ~532)** - Al crear inmobiliaria (FRONTEND - tokens visibles al usuario)
2. **`src/pages/admin/Inmobiliarias.tsx` (linea ~1114)** - Al aprobar inmobiliaria (FRONTEND - tokens visibles al usuario)
3. **`supabase/functions/registro-inmobiliaria-publica/index.ts` (linea ~315)** - Registro publico (EDGE FUNCTION - tokens hardcodeados pero no visibles)

### Solucion
Reemplazar las 3 llamadas directas a `fetch(webhookUrl, ...)` por llamadas a `supabase.functions.invoke('enviar-notificacion', ...)`, que internamente usara los secrets `POSTMARK_SERVER_TOKEN` y `EVOLUTION_WA_TOKEN` de forma segura.

### Cambios por archivo

**1. `src/pages/admin/Inmobiliarias.tsx`** (2 cambios)

- **Llamada 1 (lineas ~532-540)**: Reemplazar `fetch(webhookUrl, { headers con tokens... })` por:
```typescript
await supabase.functions.invoke('enviar-notificacion', {
  body: notificationPayload
});
```
- Eliminar la variable `webhookUrl` y las lineas que construyen los headers con tokens
- Mantener el payload exactamente igual

- **Llamada 2 (lineas ~1114-1122)**: Mismo cambio, reemplazar `fetch` por `supabase.functions.invoke`

**2. `supabase/functions/registro-inmobiliaria-publica/index.ts`** (1 cambio)

- **Lineas ~315-323**: Reemplazar el `fetch` directo por una llamada interna via `fetch` al URL de la edge function con el service role key:
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
await fetch(`${supabaseUrl}/functions/v1/enviar-notificacion`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`
  },
  body: JSON.stringify(notificationPayload)
});
```
- Eliminar los headers hardcodeados de `x-postmark-server-token` y `apikey`
- Eliminar la variable `webhookUrl` y la referencia a `N8N_WEBHOOK_BASE_URL` (solo si no se usa en otro lugar del archivo)

### Resultado
- Los tokens `x-postmark-server-token` y `apikey` quedan eliminados del codigo fuente
- Las notificaciones pasan por la edge function `enviar-notificacion` que ya tiene acceso a `POSTMARK_SERVER_TOKEN` y `EVOLUTION_WA_TOKEN` via secrets
- El comportamiento funcional no cambia: mismo payload, mismos destinatarios
