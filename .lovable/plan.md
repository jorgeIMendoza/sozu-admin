
## Diagnóstico

El log de Supabase muestra "No results found" para `enviar-notificacion`. Esto confirma que **la función nunca se ejecutó** en el flujo del usuario. La razón es que existen **5 puntos de llamada directa** al webhook de N8N que no pasan por `enviar-notificacion`, por lo que **nunca se inyecta `urlEndpointWA`** y N8N recibe el payload incompleto.

## Archivos con `fetch` directo a `${N8N_WEBHOOK_BASE_URL}/aplicaPago` que hay que migrar

| Archivo | Línea | Acción |
|---|---|---|
| `src/pages/admin/DetalleCuentaCobranza.tsx` | 1063 | `genera_acuerdo_para_cuenta_cobranza` |
| `src/pages/admin/Propiedades.tsx` | 3616 | (acción de generación de cuenta) |
| `src/pages/admin/Propiedades.tsx` | 3795 | (segunda acción) |
| `src/components/admin/CancelCuentaDialog.tsx` | 584 | cancelación de cuenta |
| `src/components/admin/EditCuentaCobranzaDialog.tsx` | 1518 | edición de cuenta |

> Nota: `AddManualPaymentDialog.tsx` ya está bien (línea 559 usa `supabase.functions.invoke('enviar-notificacion')` con `n8nPath: 'aplicaPago'`).

## Cambios

### 1. Reemplazar cada `fetch` directo por `supabase.functions.invoke`

Patrón a aplicar en cada uno de los 5 puntos:

```ts
// ANTES (saltaba la edge function -> N8N recibía sin urlEndpointWA)
const webhookResponse = await fetch(`${N8N_WEBHOOK_BASE_URL}/aplicaPago`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

// DESPUÉS (pasa por enviar-notificacion -> inyecta urlEndpointWA, instanciaWA, URL_WA_base)
const { data: notifData, error: notifError } = await supabase.functions.invoke(
  'enviar-notificacion',
  { body: { ...payload, n8nPath: 'aplicaPago' } }
);
if (notifError) {
  console.error('[aplicaPago via enviar-notificacion] error:', notifError);
}
```

Para los puntos donde el código posterior leía `webhookResponse.ok` o `webhookResponse.status`, se adaptará a:
- `if (!notifError && notifData?.n8nStatus && notifData.n8nStatus < 400) { ... }`

### 2. Verificación post-cambio

- Hacer un pago manual real desde el frontend.
- Confirmar en https://supabase.com/dashboard/project/tzmhgfjmddkfyffkkmto/functions/enviar-notificacion/logs que aparece:
  - `[enviar-notificacion] INVOKED`
  - `[enviar-notificacion] PAYLOAD OUT to N8N` con `urlEndpointWA` presente
- Verificar que N8N ya recibe el campo y el WhatsApp se envía.

## Resultado esperado

- 100% de los flujos de "aplicar pago / cancelar / editar / esquema" pasan por `enviar-notificacion`.
- La edge function inyecta `URL_WA_base`, `instanciaWA` y `urlEndpointWA` desde los secrets antes de reenviar a N8N.
- Los logs de la edge function dejan de estar vacíos y N8N recibe el payload completo.
