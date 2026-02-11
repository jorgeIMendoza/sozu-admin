

## Plan: Corregir Error de Precision Flotante en Validacion SAT (Cuenta 374)

### Problema
La cuenta 374 tiene `precio_final = 2,292,821.44` y la suma real de pagos en la base de datos es exactamente `2,292,821.44` (41 pagos). Sin embargo, el servicio SAT suma los 41 pagos uno por uno en JavaScript usando `parseFloat`, lo cual causa errores de precision de punto flotante. El resultado puede ser algo como `2,292,821.4399999997`, que es menor que `precioFinal`, y por eso `estaPagadaCompletamente = false`.

Esto es consistente con el patron ya usado en el resto del sistema, donde se usa una tolerancia de `<= $0.01` para determinar si una cuenta esta pagada.

### Solucion

Aplicar la misma tolerancia de `$0.01` que ya se usa en el resto del sistema (triggers de escrituracion, indicadores de progreso, etc.).

### Cambio Unico

**Archivo: `src/services/satNotificationService.ts`**
- Linea 99: Cambiar la comparacion estricta por una con tolerancia

```
// Actual (falla por precision flotante):
const estaPagadaCompletamente = precioFinal > 0 && totalPagado >= precioFinal;

// Corregido (tolerancia de $0.01, igual que el resto del sistema):
const restante = precioFinal - totalPagado;
const estaPagadaCompletamente = precioFinal > 0 && restante <= 0.01;
```

Esto es exactamente el mismo patron usado en:
- El trigger `actualizar_estatus_a_escrituracion` en PostgreSQL
- Los indicadores de progreso de cuentas de cobranza
- La logica de reconciliacion de estatus de propiedades

### Archivos a modificar
- `src/services/satNotificationService.ts` (1 linea)
