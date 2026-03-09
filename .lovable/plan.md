

# Plan: Incluir cuentas de producto canceladas en el historial + DB fix para CC-1166

## Contexto
La CC-1748 (propiedad cancelada de Mauricio) tenía 2 cuentas de producto asociadas: CC-1165 (condensadora, $0) y CC-1166 (muebles, $288,638.30 con $259,774.47 pagados). Ambas fueron canceladas (tipo 3). Actualmente el historial no las muestra porque filtra `id_cuenta_cobranza_padre IS NULL` y solo trae cuentas de propiedad. El reembolso total fue de $898,474.24 (CC-1748: $638,699.77 + CC-1166: $259,774.47).

## Cambios en Base de Datos (migración SQL)

1. **CC-1166**: Actualizar `url_evidencia_reembolso` con la misma URL del cheque que ya se usó para CC-1748 (reusar el archivo ya subido)
2. **CC-1166**: No necesita `monto_cobro_cancelacion` ya que fue reembolso total (penalización = 0)

## Cambios en `OwnerHistoryDialog.tsx`

### Query: Traer cuentas de producto hijas de cuentas canceladas

Después de obtener las cuentas principales (línea 79-86), agregar una segunda query:
- Buscar cuentas donde `id_cuenta_cobranza_padre IN (cuentaIds de cuentas canceladas)`
- Incluir también canceladas con tipos 3 y 7
- Traer `id_cuenta_cobranza_padre` para asociarlas
- Obtener pagos y nombre del producto (vía oferta → productos_inventario o el campo producto_nombre del RPC)

### Interface: Extender `OwnerHistoryEntry`

Agregar campo `cuentas_producto`:
```typescript
cuentas_producto: {
  cuenta_id: number;
  producto_nombre: string;
  precio_final: number;
  total_pagado: number;
  monto_penalizacion: number;
  monto_reembolso: number;
}[];
```

Y campos de totales consolidados:
```typescript
total_pagado_consolidado: number;  // suma propiedad + productos
total_penalizacion_consolidado: number;
total_reembolso_consolidado: number;
```

### UI: Mostrar desglose en la sección de cancelación

Dentro del bloque de cancelación (líneas 509-551), cuando hay `cuentas_producto`:

1. Mostrar tabla/lista con desglose por cuenta:
   - CC-001748 (Propiedad): Pagado $898,474.24 | Penalización $259,774.47 | Reembolso $638,699.77
   - CCP-001166 (Muebles): Pagado $259,774.47 | Penalización $0 | Reembolso $259,774.47
   - CCP-001165 (Condensadora): Pagado $0 | sin desglose
2. Mostrar **total consolidado** al final: Reembolso Total: $898,474.24
3. Mantener links de evidencia (convenio y acuse de cheque)

### Lógica de cálculo del reembolso por cuenta producto

Para cada cuenta producto cancelada:
- `monto_reembolso = total_pagado - monto_cobro_cancelacion`
- Si `monto_cobro_cancelacion = 0`, reembolso = total pagado completo

