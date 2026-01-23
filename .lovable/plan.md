
# Plan: Corregir consulta de documentos en indicadores de progreso

## Problema identificado

Los componentes `PropertyProgressTimeline` y `PropertyProgressBadge` consultan una tabla/vista inexistente (`documentos_cuenta`) en lugar de la tabla real (`documentos`). Esto causa que la condición "Documentos de entrega verificados" siempre muestre "Sin documentos de entrega", incluso cuando existen documentos verificados.

### Evidencia
La cuenta 207 tiene **8 documentos de categoría 7 (Entrega)** todos verificados:
- Factura XML
- Factura PDF
- Escritura
- Acta de entrega
- Periodo de cobertura
- Póliza de garantía
- Anexo A
- Declaración de fondos

Sin embargo, el componente muestra "Sin documentos de entrega" porque la consulta a `documentos_cuenta` falla silenciosamente.

## Solución

Cambiar la consulta de `documentos_cuenta` a `documentos` en ambos componentes.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/PropertyProgressTimeline.tsx` | Línea 99: cambiar `documentos_cuenta` → `documentos` |
| `src/components/admin/PropertyProgressBadge.tsx` | Línea 119: cambiar `documentos_cuenta` → `documentos` |

## Cambios específicos

### PropertyProgressTimeline.tsx (línea 99)
```typescript
// Antes
const { data: rawDocs, error } = await supabaseAny
  .from('documentos_cuenta')  // ❌ No existe
  .select('id, id_tipo_documento, id_estatus_verificacion, id_persona')

// Después
const { data: rawDocs, error } = await supabaseAny
  .from('documentos')  // ✅ Tabla correcta
  .select('id, id_tipo_documento, id_estatus_verificacion, id_persona')
```

### PropertyProgressBadge.tsx (línea 119)
```typescript
// Antes
const { data: rawDocs, error } = await supabaseAny
  .from('documentos_cuenta')  // ❌ No existe
  .select('id, id_tipo_documento, id_estatus_verificacion, id_persona')

// Después
const { data: rawDocs, error } = await supabaseAny
  .from('documentos')  // ✅ Tabla correcta
  .select('id, id_tipo_documento, id_estatus_verificacion, id_persona')
```

## Resultado esperado

Después del cambio:
- La cuenta 207 mostrará **8/8 verificados** en la condición de documentos de entrega
- La etapa "Entrega" pasará a **100%** (todos los requisitos cumplidos)
- El indicador cambiará de azul (en progreso) a verde (completado)
