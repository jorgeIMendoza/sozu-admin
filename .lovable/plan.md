

## Plan: Edge Function para Estado de Cuenta de Mantenimiento + Integracion UI

### Objetivo
Crear una Edge Function `generar-estado-cuenta-mantenimiento` que genere el PDF en el servidor (usando `pdf-lib`, igual que `generar-estado-cuenta`) y actualizar los botones existentes en la UI para que la usen en lugar del servicio client-side con jsPDF.

### Arquitectura

La nueva Edge Function seguira exactamente el mismo patron que `generar-estado-cuenta`:
1. Recibe `{ id_cuenta }` por POST
2. Consulta datos con service_role key
3. Genera PDF con `pdf-lib`
4. Sube a storage `documentos/estados_cuenta_temp/` con TTL de 1 minuto
5. Retorna `{ success, url_estado_cuenta }`

### Archivos a crear

**1. `supabase/functions/generar-estado-cuenta-mantenimiento/index.ts`**
- Endpoint POST que recibe `{ id_cuenta }`
- Valida que la cuenta tenga `id_cuenta_cobranza_padre` (es mantenimiento)
- Consulta: cuenta padre, compradores, proyecto/propiedad, acuerdos de pago (ultimos 12 meses), aplicaciones, pagos reales
- Calcula: pago mensual acumulado, total pagado real, excedente, saldo pendiente (misma logica del servicio actual)
- Genera PDF con `pdf-lib` replicando el mismo diseno del servicio actual (header, meta info, summary cards, tabla de acuerdos, footer con CLABE)
- Sube PDF a `documentos/estados_cuenta_temp/` y retorna URL publica
- CORS headers completos

**2. `src/services/estadoCuentaMantenimientoEdgeFunctionService.ts`**
- Clase `EstadoCuentaMantenimientoEdgeFunctionService` con metodo `generateEstadoCuenta({ id_cuenta })`
- Llama a la Edge Function via `supabase.functions.invoke('generar-estado-cuenta-mantenimiento')`
- Abre el PDF en nueva pestana
- Misma interfaz que `EstadoCuentaEdgeFunctionService`

### Archivos a modificar

**3. `supabase/config.toml`**
- Agregar seccion `[functions.generar-estado-cuenta-mantenimiento]` con `verify_jwt = false`

**4. `src/pages/admin/CuentasMantenimiento.tsx`**
- Cambiar import de `EstadoCuentaMantenimientoService` a `EstadoCuentaMantenimientoEdgeFunctionService`
- Actualizar la llamada en el boton de descarga

**5. `src/pages/admin/DetalleCuentaMantenimiento.tsx`**
- Mismo cambio: usar el nuevo servicio Edge Function en lugar del client-side

### Seccion tecnica

**Logica de calculo (replicada del servicio actual):**
```
pagoAcumulado = SUM(acuerdos.monto) -- ultimos 12 meses
totalAplicado = SUM(aplicaciones_pago.monto WHERE !es_multa)
totalPagadoReal = SUM(pagos.monto)
excedente = totalPagadoReal - totalAplicado
saldoPendienteBruto = pagoAcumulado - totalAplicado
saldoPendienteReal = saldoPendienteBruto - excedente
```

**Estructura del PDF (misma que el actual):**
- Header: nombre proyecto, direccion, numero cuenta CM-XXXXXX, propiedad, cliente
- Meta info: tipo "Mantenimiento", periodo 12 meses, fecha emision
- Summary cards: Pago Mensual Acumulado, Total Pagado, Saldo Pendiente/A Favor
- Tabla: acuerdos de pago con concepto, fecha, monto, pagado, pendiente, estado
- Footer: notas + CLABE STP

**API externa:**
```
POST /functions/v1/generar-estado-cuenta-mantenimiento
Body: { "id_cuenta": 123 }
Response: { "success": true, "url_estado_cuenta": "https://...", "expiresIn": "1 minute" }
```

