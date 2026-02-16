
# Plan: Factura de Comision de Venta Sozu (Automatica al Cambiar a Vendido)

## Resumen

Cuando una propiedad cambia a estatus "Vendido" (5), si el propietario/aportante tiene `facturar = true` en `entidades_relacionadas`, se genera automaticamente una factura draft de comision de venta desde Sozu (Real Estate Ventures) hacia el propietario. Esta factura se muestra en Pagar Comisiones y puede timbrarse desde ahi.

## Cambio Clave vs Plan Anterior

El trigger NO sera en la base de datos. Se creara una **Edge Function dedicada** (`generar-factura-comision-sozu`) que sera invocada desde todos los puntos del codigo donde una propiedad cambia a Vendido:

1. **`check-property-sold-status`** (Edge Function) - cuando el sistema automatico cambia de Apartado a Vendido
2. **`JuicioTerminadoDialog.tsx`** - cuando manualmente se marca como vendido desde juicio terminado
3. **Cualquier cambio manual futuro** - se puede llamar bajo demanda

## Secrets Necesarios

- `COMISIONES_SOZU_API_KEY_DRAFT` - API key de FacturAPI para generar facturas draft
- `COMISIONES_SOZU_API_KEY` - API key de FacturAPI para timbrar facturas definitivas

---

## Pasos de Implementacion

### Paso 1: Migracion de Base de Datos

- Crear nuevo tipo de documento (ID 47): "Factura de comision de venta Sozu"
- Agregar columna `id_documento_factura_comision_sozu` (integer, nullable, FK a documentos) en `cuentas_cobranza`

### Paso 2: Agregar Secrets

Solicitar al usuario que agregue los dos secrets:
- `COMISIONES_SOZU_API_KEY_DRAFT`
- `COMISIONES_SOZU_API_KEY`

### Paso 3: Nueva Edge Function `generar-factura-comision-sozu`

Responsabilidades:
1. Recibe `id_cuenta_cobranza` como parametro
2. Obtiene la propiedad asociada y verifica que este en estatus Vendido (5)
3. Obtiene el propietario via `propiedades.id_entidad_relacionada_dueno` -> `entidades_relacionadas`
4. Verifica que `facturar = true` en esa entidad
5. Si cumple:
   - Obtiene datos fiscales del propietario (RFC, regimen, etc.) de `personas`
   - Calcula monto: `precio_final * porcentaje_comision_venta / 100`
   - Verifica si incluye IVA o no (campo `iva_incluido` de la entidad/proyecto)
   - Llama a `N8N_WEBHOOK_BASE_URL/generaFactura` con:
     - `api_key`: secret `COMISIONES_SOZU_API_KEY_DRAFT`
     - `tipo_factura`: "comision_venta_sozu"
     - Datos del receptor (propietario)
     - `es_draft: true`
   - Registra documento en tabla `documentos` con tipo 47 y `es_draft = true`
   - Actualiza `cuentas_cobranza.id_documento_factura_comision_sozu`
   - Envia correo via `enviar-notificacion` al email del propietario, CC a super admins

### Paso 4: Nueva Edge Function `timbrar-factura-comision-sozu`

Responsabilidades:
1. Recibe `id_cuenta_cobranza` y `id_documento` como parametros
2. Obtiene los mismos datos que el paso anterior
3. Llama a `N8N_WEBHOOK_BASE_URL/generaFactura` con:
   - `api_key`: secret `COMISIONES_SOZU_API_KEY`
   - `es_draft: false`
   - `id_documento` del draft existente
4. Actualiza el documento existente: `es_draft = false`, `id_estatus_verificacion = 2`
5. Envia correo con factura timbrada al propietario + CC super admins

### Paso 5: Modificar `check-property-sold-status`

Despues de cambiar exitosamente el estatus a Vendido (linea ~270), agregar llamada interna a `generar-factura-comision-sozu`:

```text
// Despues de actualizar propiedad a Vendido exitosamente:
try {
  // Llamar a la funcion de factura de comision
  const facturaResponse = await fetch(
    `${supabaseUrl}/functions/v1/generar-factura-comision-sozu`,
    { body: { id_cuenta_cobranza }, headers: auth }
  );
  // Log resultado pero NO bloquear el flujo principal
} catch (error) {
  console.error('Error generando factura comision sozu:', error);
  // No lanzar error - la factura se puede generar despues manualmente
}
```

### Paso 6: Modificar `JuicioTerminadoDialog.tsx`

Despues de actualizar la propiedad a estatus 5 (linea ~361), agregar llamada a la Edge Function `generar-factura-comision-sozu` con el `id_cuenta_cobranza`.

### Paso 7: Modificar UI en `PagarComisiones.tsx`

Agregar nueva columna "Factura Comision Sozu" en las tablas de comisiones:

- **Sin factura**: No aplica (propietario no tiene `facturar = true`) o aun no se ha generado
- **Draft**: Badge amarillo "Draft" + boton "Timbrar"
- **Timbrada**: Badge verde "Timbrada" + icono para ver/descargar

Al hacer clic en "Timbrar":
1. Mostrar dialogo de confirmacion
2. Invocar Edge Function `timbrar-factura-comision-sozu`
3. Actualizar la tabla

### Paso 8: Query actualizada en `PagarComisiones.tsx`

Modificar `fetchAllComisionistas` para incluir en el SELECT:
- `id_documento_factura_comision_sozu` de `cuentas_cobranza`
- JOIN al documento para obtener `es_draft` y `url`

---

## Flujo Completo

```text
Propiedad cambia a Vendido (5)
        |
        v
Se invoca generar-factura-comision-sozu
        |
        v
Obtener propietario via id_entidad_relacionada_dueno
        |
        v
facturar = true?
   NO --> fin (no aplica)
   SI --> continuar
        |
        v
Calcular monto comision (precio_final * porcentaje / 100)
        |
        v
Llamar N8N /generaFactura con COMISIONES_SOZU_API_KEY_DRAFT
        |
        v
Registrar documento tipo 47 (es_draft = true)
        |
        v
Enviar correo al propietario + CC super admins
        |
        v
En PagarComisiones: mostrar badge "Draft"
        |
        v
Usuario hace clic "Timbrar"
        |
        v
Llamar N8N /generaFactura con COMISIONES_SOZU_API_KEY (es_draft = false)
        |
        v
Actualizar documento (es_draft = false)
        |
        v
Enviar correo con factura timbrada
        |
        v
Mostrar badge "Timbrada"
```

## Correos de Super Admins (CC)

- rodrigo.terveen@sozu.com
- joseramon.escobar@sozu.com
- jorge.mendoza@sozu.com

## Archivos a Crear/Modificar

| Archivo | Accion |
|---------|--------|
| `supabase/functions/generar-factura-comision-sozu/index.ts` | Crear |
| `supabase/functions/timbrar-factura-comision-sozu/index.ts` | Crear |
| `supabase/functions/check-property-sold-status/index.ts` | Modificar (agregar llamada post-vendido) |
| `src/components/admin/JuicioTerminadoDialog.tsx` | Modificar (agregar llamada post-vendido) |
| `src/pages/admin/PagarComisiones.tsx` | Modificar (nueva columna + accion timbrar) |
| `supabase/config.toml` | Agregar config para las 2 nuevas funciones |
| Migracion SQL | Nuevo tipo_documento + columna en cuentas_cobranza |
