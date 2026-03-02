

# Restriccion: No enviar email si la oferta no muestra datos bancarios

## Problema
El sistema envia ofertas por correo incluso cuando el PDF no contiene la seccion de "Datos Bancarios". El usuario quiere que si la oferta no muestra datos bancarios, NO se envie el correo.

## Logica actual de "Datos Bancarios" en el PDF
La seccion se muestra cuando se cumplen TODAS estas condiciones (definido en `ofertaPdfNativeService.ts` lineas 791-798):

```text
showBanking = hasValidRFC 
  AND id_esquema_pago_seleccionado exists 
  AND (clabe_stp_tmp_apartado exists OR (proyecto mostrar_seccion_efectivo AND ownerStpBankAccount exists))
```

## Solucion

### Archivo: `src/services/ofertaEmailService.ts`

Modificar `sendOfferEmailAfterDownload` para consultar la oferta con su propiedad y proyecto, y aplicar la misma logica de visibilidad de datos bancarios antes de enviar:

1. Consultar la oferta con `id_esquema_pago_seleccionado`, `id_propiedad`, `id_persona_lead`
2. Consultar la propiedad con `clabe_stp_tmp_apartado` y datos del proyecto (`mostrar_seccion_efectivo_en_oferta`)
3. Consultar el RFC del lead desde `personas`
4. Evaluar `showBanking` con la misma formula que usa el PDF
5. Si `showBanking` es `false`, hacer `return` sin enviar y loguear la razon

Para ofertas de producto: consultar si la oferta tiene `clabe_stp_tmp_producto`. Si no tiene, no enviar.

### Puntos de envio afectados (ambos pasan por esta funcion)
- `NewOfferDialog.tsx` - linea 1047: envia email para oferta principal y productos
- `NewProductOfferDialog.tsx` - linea 747: envia email para oferta de producto

Como ambos usan `sendOfferEmailAfterDownload`, la validacion centralizada en el servicio cubre todos los casos sin necesidad de modificar los dialogos.

### Archivo unico a modificar
- `src/services/ofertaEmailService.ts`
