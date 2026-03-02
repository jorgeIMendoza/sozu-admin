

## Enviar oferta por correo automaticamente al generar/descargar PDF

### Contexto

Ya existe el edge function `enviar-oferta-email` que envia correos con PDFs adjuntos via Postmark. Actualmente solo se usa desde `NewOfferDialog` (al crear una oferta nueva). El objetivo es que **en todos los lugares donde se genera o descarga un PDF de oferta**, tambien se envie automaticamente por correo al prospecto.

### Lugares identificados donde se genera/descarga PDF

1. **`NewOfferDialog.tsx`** - Al crear oferta nueva (ya envia email - verificar que funcione correctamente)
2. **`NewProductOfferDialog.tsx`** - Al crear oferta de producto (NO envia email)
3. **`Propiedades.tsx` - `handleDownloadOffer`** - Descarga de oferta de propiedad (NO envia email)
4. **`Propiedades.tsx` - Boton inline de productos** (~linea 6496) - Descarga de oferta de producto (NO envia email)
5. **`MisPropiedades.tsx` - `handleDownloadOffer`** - Descarga desde vista de inmobiliarias (NO envia email)
6. **`Pagos.tsx` - `handleDownloadOffer`** - Descarga desde vista de pagos (NO envia email)
7. **`DetalleCuentaCobranza.tsx`** - Descarga desde detalle de cuenta (NO envia email)

### Solucion

Crear un **servicio centralizado** `sendOfferEmail` que se llame despues de cada descarga/generacion exitosa de PDF. Este servicio:

1. Obtiene el email del prospecto desde la oferta (`id_persona_lead` -> tabla `personas`)
2. Si el prospecto tiene email, envia el PDF adjunto via el edge function existente
3. Si no tiene email, muestra un toast informativo (no bloquea la descarga)
4. El envio es **fire-and-forget**: no bloquea la descarga del PDF

### Implementacion

#### 1. Crear servicio `src/services/ofertaEmailService.ts`

Servicio con una funcion `sendOfferEmailAfterDownload`:
- Recibe: `offerId`, `propertyNumber` (opcional)
- Consulta la oferta para obtener `id_persona_lead` y `url`
- Consulta la persona para obtener email y nombre
- Si hay email y URL: llama a `enviar-oferta-email` con `offerIds: [offerId]`
- Si hay email pero no URL (PDF generado client-side): recibe opcionalmente `pdfBase64` y `filename` para enviar como `preGeneratedAttachments`
- Muestra toast de exito/error sin bloquear

#### 2. Modificar los 6 lugares restantes

En cada lugar, despues de la descarga/generacion exitosa del PDF, agregar una llamada al servicio:

**a) `NewProductOfferDialog.tsx`** (~linea 713):
- Despues de `generateOfferPDF`, llamar a `sendOfferEmailAfterDownload` con el offerId y datos del prospecto que ya tiene disponibles (`formValues.email`, `formValues.razon_social`)

**b) `Propiedades.tsx` - `handleDownloadOffer`** (~linea 1127):
- Despues de descargar o generar el PDF, llamar al servicio con `offer.id` y `offer.numero_propiedad`
- Los datos del lead (`offer.lead_email`, `offer.lead_name`) ya estan disponibles en el objeto `offer`

**c) `Propiedades.tsx` - Boton productos** (~linea 6547):
- Despues de descargar o generar, llamar al servicio

**d) `MisPropiedades.tsx` - `handleDownloadOffer`** (~linea 997):
- Mismo patron

**e) `Pagos.tsx` - `handleDownloadOffer`** (~linea 635):
- Mismo patron (aqui el email del comprador puede no estar disponible, el servicio lo obtendra de la BD)

**f) `DetalleCuentaCobranza.tsx`** (~linea 1960):
- Mismo patron

#### 3. Logica del servicio

```text
async sendOfferEmailAfterDownload(params: {
  offerId: number;
  propertyNumber?: string;
  // Opcion 1: datos ya disponibles en el llamador
  recipientEmail?: string;
  recipientName?: string;
  // Opcion 2: si no se proveen, se consultan de la BD
})
  1. Si no hay recipientEmail, consultar oferta -> persona -> email
  2. Si no hay email, mostrar toast info y salir
  3. Verificar si la oferta tiene URL guardada (usar como referencia para el email)
  4. Llamar edge function enviar-oferta-email con offerIds: [offerId]
  5. Mostrar toast de confirmacion
  6. No lanzar errores (fire-and-forget)
```

### Archivos a crear/modificar

1. **Crear** `src/services/ofertaEmailService.ts` - Servicio centralizado
2. **Modificar** `src/components/admin/NewProductOfferDialog.tsx` - Agregar envio de email
3. **Modificar** `src/pages/admin/Propiedades.tsx` - Agregar envio en ambos handlers (propiedad y producto)
4. **Modificar** `src/pages/admin/inmobiliarias/MisPropiedades.tsx` - Agregar envio
5. **Modificar** `src/pages/admin/Pagos.tsx` - Agregar envio
6. **Modificar** `src/pages/admin/DetalleCuentaCobranza.tsx` - Agregar envio

### Consideraciones

- El envio de email usa `offerIds` (no `preGeneratedAttachments`), asi el edge function genera el PDF server-side desde la URL guardada o lo regenera si es necesario
- Si la oferta no tiene URL guardada aun (primera generacion), se usa `preGeneratedAttachments` solo desde `NewOfferDialog` y `NewProductOfferDialog` (que generan el PDF en el cliente)
- Para los demas lugares (descarga), la oferta ya deberia tener URL guardada al momento del envio
- El toast de "Oferta enviada a X" se muestra como informativo, sin bloquear el flujo
