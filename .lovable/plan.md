

## Permitir subir evidencias de pago (CEP) en cuentas "En demanda"

### Problema
Cuando una cuenta de cobranza tiene una propiedad con estatus "En demanda" (id=11), todas las acciones quedan bloqueadas, incluyendo el boton de "Agregar CEP" (comprobante electronico de pago). Sin embargo, subir evidencias de pago deberia estar permitido porque es una accion de documentacion, no una modificacion a la cuenta.

### Solucion
Modificar unicamente la condicion `disabled` del boton de CEP para que no incluya `isEnDemanda`, permitiendo subir comprobantes incluso cuando la propiedad esta en demanda.

### Cambio tecnico

**Archivo:** `src/pages/admin/DetalleCuentaCobranza.tsx`

- **Linea 4340**: Cambiar `disabled={esCuentaCancelada || isReadOnly || isEnDemanda}` a `disabled={esCuentaCancelada || isReadOnly}` en el boton de "Agregar CEP".

Todas las demas acciones (transferir pagos, agregar pagos manuales, editar pagos, eliminar pagos, agregar multas, editar multas, recalcular aplicaciones, etc.) seguiran bloqueadas cuando la cuenta este "En demanda".
