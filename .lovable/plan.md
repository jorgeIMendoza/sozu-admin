

# Fix: Comprador faltante en CC-1748 + Historial de propietarios no muestra cuentas canceladas

## Problema 1: CC-1748 sin compradores
La cuenta de cobranza 1748 no tiene registro en la tabla `compradores`. Se necesita insertar a Mauricio López Rebollar (id_persona 1431) con 100% de copropiedad.

**Acción**: INSERT en `compradores` para CC-1748.

## Problema 2: Historial no muestra a Mauricio
El `OwnerHistoryDialog` tiene dos filtros que excluyen la CC cancelada de Mauricio:
- Línea 68-69: filtra `ofertas.activo = true` (la oferta 1970 es `activo=false`)
- Línea 85: filtra `id_tipo_cancelacion IS NULL` (la CC 1748 tiene `id_tipo_cancelacion = 3`)

Estos filtros solo se relajan cuando `esReventa = true` (id_tipo_transaccion = 2), pero la propiedad 708 tiene id_tipo_transaccion = 3.

**Solución**: Cambiar la lógica para **siempre** incluir ofertas inactivas y cuentas con tipos de cancelación históricos (3=Rescisión, 7=Reventa), independientemente del flag `esReventa`. 

### Cambios en `OwnerHistoryDialog.tsx`:

1. **Ofertas**: Quitar el filtro `activo=true` completamente — siempre traer todas las ofertas de la propiedad (sin producto).

2. **Cuentas**: Reemplazar `.is('id_tipo_cancelacion', null)` por un filtro OR que incluya cuentas sin cancelación **o** con tipos de cancelación 3 y 7. Quitar el filtro `activo=true`.

3. **Agregar campo `id_tipo_cancelacion`** al SELECT de cuentas y al tipo `OwnerHistoryEntry` para poder mostrar visualmente que la cuenta fue cancelada.

4. **UI**: Mostrar las cuentas canceladas con un estilo visual distinto (color rojo/gris, badge "Cancelada") en el timeline, entre el propietario de origen y el propietario actual.

