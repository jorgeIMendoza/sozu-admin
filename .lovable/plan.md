

## Plan: Envío de oferta por correo siempre manual vía checkbox

### Objetivo
Eliminar el envío automático de oferta(s) por correo en TODOS los flujos de generación. Mostrar SIEMPRE un checkbox "Enviar oferta por correo al prospecto" desmarcado por default. Solo enviar si el usuario lo activa.

### Cambios

**1) `src/components/admin/NewOfferDialog.tsx` (oferta de propiedad + productos juntos)**
- Mover el checkbox `sendEmailOnGenerate` fuera del bloque condicional `confirmBankingReasons.length > 0` para que aparezca SIEMPRE en el formulario (idealmente justo antes del footer del diálogo, no solo en el AlertDialog de confirmación).
- En el flujo `onSubmit`/`createOfferMutation`, reemplazar la llamada actual `sendMultipleOffersEmail(...)` (envío automático condicionado a datos bancarios) por una sola rama:
  - Si `sendEmailOnGenerate === true` → llamar `sendMultipleOffersEmailDirect(...)` (envío forzado manual).
  - Si `false` → NO llamar nada relacionado con email.
- Eliminar el fallback `if (!emailSent && sendEmailOnGenerate)` ya que solo habrá un camino.

**2) `src/components/admin/NewProductOfferDialog.tsx` (oferta de producto suelta)**
- Agregar estado `const [sendEmailOnGenerate, setSendEmailOnGenerate] = useState(false)`.
- Agregar un `<Checkbox>` siempre visible en el formulario (cerca del botón "Generar"), con label "Enviar oferta por correo al prospecto", desmarcado por default.
- Eliminar la llamada automática a `sendOfferEmailAfterDownload(...)` y el toast con botón "Enviar" que aparecía cuando no se enviaba.
- Reemplazar por: si `sendEmailOnGenerate === true` después de generar el PDF → llamar `sendOfferEmailDirect(...)`. Si no, no hacer nada.
- Resetear `sendEmailOnGenerate` al cerrar/limpiar el diálogo.

**3) Servicio `src/services/ofertaEmailService.ts`**
- No requiere cambios funcionales: ya existen `sendOfferEmailDirect` y `sendMultipleOffersEmailDirect` (envío forzado sin condición de datos bancarios). Las funciones `sendOfferEmailAfterDownload` y `sendMultipleOffersEmail` (las que filtraban por datos bancarios) dejarán de usarse desde los diálogos pero se mantienen por si las usa otra vista (ej. botones de "Reenviar" en `Propiedades.tsx` ya usan `sendOfferEmailDirect`, no se afectan).

### Comportamiento resultante
- En cualquier diálogo de generación de oferta (propiedad, productos, o ambos): aparece un checkbox "Enviar oferta por correo al prospecto" desmarcado.
- Si el usuario lo marca antes de "Generar" → se descarga el PDF Y se envía por correo.
- Si no lo marca → solo se descarga el PDF, nunca se envía.
- Los botones independientes de "Reenviar oferta por correo" en listados de propiedades siguen funcionando igual (manuales).

### Archivos a editar
- `src/components/admin/NewOfferDialog.tsx`
- `src/components/admin/NewProductOfferDialog.tsx`

Sin cambios en backend ni en `ofertaEmailService.ts`.

