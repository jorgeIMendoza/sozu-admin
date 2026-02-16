

## Simplificar payload de `generar-factura-comision-sozu`

### Cambio

En el Edge Function `generar-factura-comision-sozu/index.ts`, reemplazar el payload complejo (receptor, conceptos, api_key, etc.) por uno simple:

```json
{
  "tipo_factura": "comision"
}
```

### Detalle tecnico

**Archivo:** `supabase/functions/generar-factura-comision-sozu/index.ts`

1. Eliminar la construccion del objeto `facturaPayload` con todos los campos (api_key, receptor, conceptos, etc.)
2. Eliminar la lectura de los secretos `COMISIONES_SOZU_API_KEY_DRAFT` ya que no se enviara en el payload
3. Eliminar la consulta a `personas` para obtener datos fiscales del propietario (ya no se necesitan para el payload)
4. Enviar al endpoint `/generaFactura` de n8n solo: `{ "tipo_factura": "comision" }`
5. Mantener todo lo demas igual: validaciones previas, registro del documento en BD, actualizacion de `cuentas_cobranza`, y notificacion por correo

**Archivo:** `supabase/functions/timbrar-factura-comision-sozu/index.ts`

1. Aplicar el mismo cambio: simplificar el payload a `{ "tipo_factura": "comision" }` en lugar del payload complejo actual
2. Eliminar la lectura de `COMISIONES_SOZU_API_KEY`
3. Eliminar la consulta a `personas` para datos fiscales (no se necesita para el payload, aunque se mantiene para la notificacion por correo)

