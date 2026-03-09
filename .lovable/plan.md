

# Plan: Insertar acuerdos de penalización y devolución para CC-1748 y CC-1166

## Resumen
Actualmente CC-1748 y CC-1166 fueron canceladas antes de que existiera la lógica automatizada del `CancelCuentaDialog`. Falta crear los `acuerdos_pago` de concepto 7 (penalización) y concepto 9 (devolución), además de desactivar los acuerdos no pagados, para que todo quede homologado con el flujo estándar.

## Datos confirmados

| Cuenta | Total Pagado | Penalización | Reembolso |
|--------|-------------|--------------|-----------|
| CC-1748 | $898,474.24 | $259,774.47 | $638,699.77 |
| CCP-1166 | $259,774.47 | $0.00 | $259,774.47 |
| **Total** | | | **$898,474.24** |

## Cambios (solo datos, sin cambios de código)

### 1. CC-1748: Insertar acuerdos de cancelación
- **Acuerdo orden 22** (concepto 7 - Pago por cancelación): $259,774.47, pago_completado = true
- **Acuerdo orden 23** (concepto 9 - Devolución de pago): $638,699.77, pago_completado = true
- **Desactivar** acuerdo orden 21 (concepto 3, sin pago completado) → activo = false

### 2. CCP-1166: Insertar acuerdos de cancelación
- **Acuerdo orden 3** (concepto 9 - Devolución de pago): $259,774.47, pago_completado = true (sin penalización)
- **Desactivar** acuerdo orden 2 (concepto 3, sin pago completado) → activo = false

### 3. Insertar pago de reembolso para CC-1748
- Pago de $638,699.77 en `pagos`, método 2 (Cheque), con url_recibo apuntando al acuse del cheque ya subido
- Fecha: la misma de la cancelación (usaremos la fecha del cheque si se conoce, o la última fecha de pago)

### 4. Insertar pago de reembolso para CC-1166
- Pago de $259,774.47 en `pagos`, método 2 (Cheque), con url_recibo del mismo acuse
- Misma fecha

### 5. Crear aplicaciones de pago
- Para CC-1748 concepto 9: vincular el pago de reembolso ($638,699.77) al acuerdo de devolución
- Para CC-1166 concepto 9: vincular el pago de reembolso ($259,774.47) al acuerdo de devolución
- Los acuerdos de concepto 7 (penalización) no necesitan aplicación ya que se retienen del dinero ya pagado

Todo esto se ejecutará con el insert tool (operaciones de datos, no de esquema).

