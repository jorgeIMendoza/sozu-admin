

## Ocultar datos bancarios cuando no hay plan de pago seleccionado

### Problema
Cuando una oferta no tiene un plan de pago seleccionado (`id_esquema_pago_seleccionado = null`), el PDF sigue mostrando la seccion de datos bancarios. El usuario quiere que se comporte igual que cuando no hay RFC: si no hay esquema seleccionado, no se muestran datos bancarios.

### Cambios

#### 1. `src/services/ofertaPdfNativeService.ts` (Propiedad - PDF nativo)
- Linea ~793: agregar condicion `data.offerData.id_esquema_pago_seleccionado` al calculo de `showBanking`
- Actualmente: `showBanking = hasValidRFC && (clabe || efectivo)`
- Nuevo: `showBanking = hasValidRFC && !!data.offerData.id_esquema_pago_seleccionado && (clabe || efectivo)`

#### 2. `src/services/ofertaProductoPdfNativeService.ts` (Producto - PDF nativo)
- Linea ~492-495: agregar condicion de `id_esquema_pago_seleccionado` y RFC al bloque de banking
- Actualmente: `if (hasClabe || hasCashAccount)`
- Nuevo: `if (data.offerData.id_esquema_pago_seleccionado && (hasClabe || hasCashAccount))`

#### 3. `src/components/admin/OfferPDFTemplateSozu.tsx` (Propiedad - HTML template)
- Linea ~623: agregar condicion de esquema seleccionado
- Actualmente: `leadInfo?.hasValidRFC && (clabe || efectivo)`
- Nuevo: `leadInfo?.hasValidRFC && offerData.id_esquema_pago_seleccionado && (clabe || efectivo)`

#### 4. `src/components/admin/OfferPDFTemplateProducto.tsx` (Producto - HTML template)
- Linea ~442: agregar condicion de esquema seleccionado
- Actualmente: `(offerData.clabe_stp_tmp_producto || offerData.clabe_stp)`
- Nuevo: `offerData.id_esquema_pago_seleccionado && (offerData.clabe_stp_tmp_producto || offerData.clabe_stp)`
- Linea ~432 (divider): misma condicion

#### 5. `src/components/admin/OfferPDFTemplate.tsx` (Template legacy)
- Linea ~381: agregar condicion de esquema seleccionado
- Actualmente: `leadInfo?.rfc`
- Nuevo: `leadInfo?.rfc && offerData.id_esquema_pago_seleccionado`

#### 6. Archivos en `public/despia/` (copias para Despia)
- `public/despia/paquete-pdf-ofertas/services/ofertaPdfNativeService.ts` y `ofertaProductoPdfNativeService.ts`: aplicar los mismos cambios para mantener sincronizados

### Resumen
Se agrega una sola condicion (`id_esquema_pago_seleccionado` debe existir) en 6 archivos, afectando tanto los PDF nativos (jsPDF) como los templates HTML. Si no hay plan seleccionado, la seccion de "Datos Bancarios" simplemente no aparece en el PDF generado.
