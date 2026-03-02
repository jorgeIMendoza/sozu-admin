

# Integrar firma digital de Carta de Acuerdos en el Portal de Agentes

## Resumen

Mover el flujo de firma de la "Carta de cumplimiento de comercializacion inmobiliaria" (documento tipo 48) desde la vista administrativa (Legal > Carta de Acuerdos) al portal del agente. En lugar de subir un archivo manualmente, el agente firmara digitalmente via Mifiel desde el modal de Identidad > Documentos.

## Cambios

### 1. Quitar boton "Enviar a firmar" de CartaAcuerdos.tsx

**Archivo:** `src/pages/admin/legal/CartaAcuerdos.tsx`

- Eliminar el boton "Enviar a firmar" del header del editor
- Eliminar el Dialog de envio (`enviarDialogOpen`) y todo su estado asociado (`agenteEmail`, `agenteNombre`, `agentePersonaId`, `enviarMutation`)
- La vista administrativa queda solo como editor de template + historial de firmas (lectura)

### 2. Modificar el renderizado del documento tipo 48 en AgentOnboardingStepDialog.tsx

**Archivo:** `src/components/admin/AgentOnboardingStepDialog.tsx`

Dentro de `AgentDocumentsStep`, cuando se renderiza el documento tipo 48 (Carta de cumplimiento):

- **Si NO hay firma activa**: Mostrar un boton "Firmar Carta de Acuerdos" (en lugar de "Subir")
  - Al hacer clic, invocar `mifiel-crear-documento` con los datos del agente (nombre, email, personaId) que ya estan disponibles via la query de persona
  - Guardar el `widget_id` del firmante agente de la respuesta de Mifiel
  - Abrir un dialog/drawer con el widget de Mifiel embebido usando `<mifiel-widget>` via CDN (`https://app.mifiel.com/widget/index.js`)

- **Si hay firma en progreso** (estado enviado/firmado_parcial): Mostrar boton "Continuar firma" que abre el widget de Mifiel con el `widget_id` guardado, y un badge con el estado actual

- **Si firma completada**: Mostrar badge "Firmado" con boton para ver/descargar el PDF firmado. Ademas, crear automaticamente el registro en la tabla `documentos` (tipo 48) con la URL del PDF firmado y marcarlo como validado (estatus 2)

### 3. Crear componente MifielSigningDialog

**Archivo nuevo:** `src/components/admin/MifielSigningDialog.tsx`

- Dialog/Drawer que carga el script CDN de Mifiel (`https://app.mifiel.com/widget/index.js`)
- Renderiza `<mifiel-widget>` con el `widget_id` del agente
- Escucha eventos `success` y `error` del widget
- Al completar la firma exitosamente: cierra el dialog, muestra toast de exito, invalida queries

### 4. Actualizar edge function mifiel-crear-documento

**Archivo:** `supabase/functions/mifiel-crear-documento/index.ts`

- Incluir en la respuesta el `widget_id` del firmante agente (ya viene en la respuesta de Mifiel API como parte de los signatories)
- Guardar los `widget_id` de cada firmante en la tabla `firmas_digitales` (campo metadata o firmantes)

### 5. Actualizar webhook para vincular documento tipo 48

**Archivo:** `supabase/functions/mifiel-webhook/index.ts`

- Cuando el estado cambia a "completado", ademas de guardar el PDF:
  - Buscar el `referencia_id` (id_persona del agente) en la firma
  - Crear un registro en tabla `documentos` con tipo 48, la URL del PDF firmado, y estatus de verificacion 2 (Validado)
  - Esto hara que el onboarding detecte automaticamente el documento como completado

### 6. Query de firma existente en AgentDocumentsStep

Dentro de `AgentDocumentsStep`, agregar un query para buscar si ya existe una firma digital para este agente:

```text
supabase
  .from('firmas_digitales')
  .select('*')
  .eq('tipo_documento', 'carta_acuerdos')
  .eq('referencia_id', personaId)
  .order('created_at', { ascending: false })
  .limit(1)
```

Esto determina si mostrar "Firmar", "Continuar firma" o "Firmado".

## Flujo completo

```text
Agente abre modal Identidad > Documentos
  |
  v
Ve documento "Carta de cumplimiento..." con boton "Firmar"
  |
  v
Clic en "Firmar" --> Llama a mifiel-crear-documento
  |
  v
Se abre MifielSigningDialog con widget embebido
  |
  v
Agente firma --> Mifiel notifica via webhook
  |
  v
Webhook guarda PDF firmado + crea registro en documentos (tipo 48, validado)
  |
  v
Agente ve documento como "Firmado" y puede descargar el PDF
```

## Archivos a modificar/crear

| Archivo | Accion |
|---------|--------|
| `src/pages/admin/legal/CartaAcuerdos.tsx` | Quitar boton "Enviar a firmar" y dialog asociado |
| `src/components/admin/AgentOnboardingStepDialog.tsx` | Logica especial para doc tipo 48 con firma digital |
| `src/components/admin/MifielSigningDialog.tsx` | **Nuevo** - Widget embebido de Mifiel |
| `supabase/functions/mifiel-crear-documento/index.ts` | Retornar widget_id en respuesta |
| `supabase/functions/mifiel-webhook/index.ts` | Crear registro en documentos tipo 48 al completar |

