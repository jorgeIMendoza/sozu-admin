
# Plan: Implementar Activity Logging para todas las operaciones de pagos

## Resumen del problema

Después de revisar el código, encontré que **muchos componentes relacionados con pagos no tienen logging de actividad implementado**, a pesar de que la aplicación ya tiene un sistema robusto de logging (`useActivityLogger`).

## Archivos que necesitan Activity Logging

### 1. Cuentas de Cobranza - Operaciones sin logging

| Archivo | Operaciones sin logging |
|---------|------------------------|
| `src/pages/admin/DetalleCuentaCobranza.tsx` | - `handleUploadEvidence` (subir evidencia de pago) - `handleSaveClaveRastreo` (guardar clave de rastreo) - Ajustes de monto de pagos |
| `src/components/admin/AddCepDialog.tsx` | - Subida de CEP (Comprobante Electrónico de Pago) |
| `src/components/admin/EditCuentaCobranzaDialog.tsx` | - `deleteAcuerdoMutation` (eliminar acuerdos de pago) - Actualizaciones de montos y fechas de acuerdos |
| `src/components/admin/AddManualPaymentDialog.tsx` | - Creación de pagos manuales - Reactivación de pagos |

### 2. Comisiones - Operaciones sin logging

| Archivo | Operaciones sin logging |
|---------|------------------------|
| `src/pages/admin/PagarComisiones.tsx` | - `pagarComisionMutation` (pagar comisión individual) - `pagarTodasMutation` (pagar múltiples comisiones) - Subida de evidencia de pago |
| `src/pages/admin/ComisionesExternas.tsx` | - `pagarComisionMutation` (pagar comisión externa) - Subida de evidencia de pago (aunque importa `useActivityLogger`, no lo usa) |

### 3. Archivos que YA tienen logging (parcial o completo)

| Archivo | Estado |
|---------|--------|
| `src/pages/admin/DetalleCuentaMantenimiento.tsx` | Ya tiene logging para evidencia de pago |
| `src/components/admin/EditPaymentDialog.tsx` | Ya tiene logging para actualización de pagos |
| `src/components/admin/TransferPaymentDialog.tsx` | Ya importa `useActivityLogger` |

---

## Cambios a implementar

### Archivo 1: `src/components/admin/AddCepDialog.tsx`
- Importar `useActivityLogger`
- Agregar logging en `handleUpload`:
  - Registrar subida de CEP con `registrarSubidaDocumento`
  - Incluir: `tipo: 'cep_pago'`, `id_pago`, `id_cuenta_cobranza`, `nombre_archivo`, `url`
  - Manejar errores con estatus `'error'`

### Archivo 2: `src/pages/admin/DetalleCuentaCobranza.tsx`
- Usar `useActivityLogger` (ya importado pero no usado completamente)
- Agregar logging en:
  - `handleUploadEvidence`: `registrarSubidaDocumento` con tipo `'evidencia_pago_cobranza'`
  - `handleSaveClaveRastreo`: `registrarActualizacion` con entidad `'pago'`
  - Funciones de ajuste de monto: `registrarActualizacion` con workflow `'ajuste_monto_pago'`

### Archivo 3: `src/components/admin/EditCuentaCobranzaDialog.tsx`
- Importar `useActivityLogger`
- Agregar logging en:
  - `deleteAcuerdoMutation`: `registrarEliminacion` con entidad `'acuerdo_pago'`
  - `updateAmountMutation`: `registrarActualizacion` con entidad `'acuerdo_pago'`
  - `updateDateMutation`: `registrarActualizacion` con entidad `'acuerdo_pago'`

### Archivo 4: `src/components/admin/AddManualPaymentDialog.tsx`
- Ya importa `useActivityLogger`
- Verificar y agregar logging en:
  - Creación de pago manual: `registrarCreacion` o `registrarPago`
  - Reactivación de pago: `registrarRestauracion`

### Archivo 5: `src/pages/admin/PagarComisiones.tsx`
- Importar `useActivityLogger`
- Agregar logging en:
  - `pagarComisionMutation`: `registrarPago` con datos de comisión
  - `pagarTodasMutation`: `registrarPago` para cada comisión pagada

### Archivo 6: `src/pages/admin/ComisionesExternas.tsx`
- Ya importa `useActivityLogger` pero no lo usa
- Agregar logging en:
  - `pagarComisionMutation`: `registrarPago` con datos de comisión externa

---

## Detalles técnicos

### Patrón de implementación

Para cada operación, seguir este patrón:

```typescript
// 1. Importar el hook
import { useActivityLogger } from "@/hooks/useActivityLogger";

// 2. Inicializar las funciones necesarias
const { 
  registrarCreacion, 
  registrarActualizacion, 
  registrarEliminacion,
  registrarSubidaDocumento,
  registrarPago 
} = useActivityLogger();

// 3. Registrar en caso de éxito
await registrarSubidaDocumento({
  tipo: 'evidencia_pago_cobranza',
  id_pago: pagoId,
  id_cuenta_cobranza: cuentaId,
  nombre_archivo: file.name,
  url: publicUrl
});

// 4. Registrar en caso de error
await registrarSubidaDocumento(
  { tipo: 'evidencia_pago_cobranza', id_pago: pagoId },
  'error',
  error.message
);
```

### Datos a incluir en cada log

| Tipo de operación | Entidad | Datos a registrar |
|-------------------|---------|-------------------|
| Subir CEP | `cep_pago` | id_pago, id_cuenta_cobranza, nombre_archivo, url |
| Subir evidencia | `evidencia_pago` | id_pago, id_cuenta, tipo_cuenta, nombre_archivo, url |
| Guardar clave rastreo | `pago` | id_pago, clave_rastreo anterior, clave_rastreo nueva |
| Eliminar acuerdo | `acuerdo_pago` | id_acuerdo, monto, concepto, id_cuenta |
| Actualizar monto | `acuerdo_pago` | id_acuerdo, monto_anterior, monto_nuevo |
| Pagar comisión | `comision` | email_usuario, id_cuenta, monto, url_evidencia |

---

## Archivos a modificar

1. `src/components/admin/AddCepDialog.tsx`
2. `src/pages/admin/DetalleCuentaCobranza.tsx`
3. `src/components/admin/EditCuentaCobranzaDialog.tsx`
4. `src/components/admin/AddManualPaymentDialog.tsx`
5. `src/pages/admin/PagarComisiones.tsx`
6. `src/pages/admin/ComisionesExternas.tsx`

---

## Resultado esperado

Después de implementar estos cambios, todas las siguientes acciones quedarán registradas en el log de actividad:
- Subida de CEP
- Subida de evidencia de pago (cobranza y mantenimiento)
- Guardado de clave de rastreo
- Ajustes de monto en pagos
- Eliminación de acuerdos de pago
- Actualización de fechas y montos de acuerdos
- Creación de pagos manuales
- Reactivación de pagos
- Pago de comisiones internas y externas
