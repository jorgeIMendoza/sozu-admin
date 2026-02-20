

## Plan: Corregir Edge Function de Timbrado de Factura

### Problemas identificados

1. **Environment "development"**: Igual que el bug corregido en `generar-factura-comision-sozu`, la funcion `timbrar-factura-comision-sozu` aun acepta el environment del frontend. Desde el preview se enviaria `"development"` a N8N.

2. **URL "pendiente-de-url-n8n" pasa validacion**: La validacion actual (linea 136) solo verifica que `url_factura_comision` no sea null/vacio. Como ahora puede tener el valor `'pendiente-de-url-n8n'`, la funcion intentaria timbrar sin que exista un draft real.

3. **Usa clave de produccion**: La API key es `'COMISIONES_SOZU_API_KEY'` (produccion), asi que el timbrado es real y definitivo.

### Cambios necesarios

**Archivo: `supabase/functions/timbrar-factura-comision-sozu/index.ts`**

1. **Forzar environment a 'produccion'** (igual que se hizo en generar):
   - Linea 115-116: Cambiar de `const environment = envFromBody || 'produccion'` a `const environment = 'produccion'`

2. **Validar que el draft sea real antes de timbrar**:
   - Linea 136-138: Agregar validacion para rechazar URLs que no sean URLs reales (que no empiecen con `http`):
   ```
   if (!cuenta.url_factura_comision || !cuenta.url_factura_comision.startsWith('http')) {
     throw new Error('No existe factura draft valida para timbrar. La URL actual no es valida.');
   }
   ```

3. **Aplicar la misma logica de respuesta tolerante de N8N**: Aceptar respuestas `{"status":"ok"}` sin URL, similar a lo hecho en `generar-factura-comision-sozu`.

### Seccion tecnica

- Solo se modifica un archivo: `supabase/functions/timbrar-factura-comision-sozu/index.ts`
- Se desplegara automaticamente tras la edicion
- No requiere cambios en la base de datos
- La validacion previene que se timbre una factura que no tiene draft real
- El environment forzado evita que N8N reciba un ambiente inexistente

