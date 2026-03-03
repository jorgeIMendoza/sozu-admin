

## Plan: Sincronizar firmas con Mifiel y renombrar/editar cartas

### Problema 1: Firmas eliminadas en Mifiel siguen apareciendo
Las firmas en la tabla `firmas_digitales` no se sincronizan cuando se eliminan documentos directamente desde Mifiel. Se necesita verificar el estado real contra Mifiel y limpiar las que ya no existen.

**Solución**: Agregar un botón "Sincronizar con Mifiel" en la pestaña de Firmas que consulte cada firma con `mifiel_document_id` contra la edge function `mifiel-consultar-documento`. Si Mifiel retorna un error 404 (documento no existe), marcar la firma como "cancelado" o eliminarla de la base de datos.

**Cambios en `CartaAcuerdoDetalle.tsx`**:
- Agregar botón "Sincronizar" en el header de la pestaña Firmas
- Implementar lógica que itere las firmas con estado != "cancelado" y != "completado", consulte Mifiel, y si el documento no existe (404/error), actualice el estado a "cancelado" o elimine el registro
- Mostrar feedback de progreso y resultado

### Problema 2: Nombre del menú y título editable
En la imagen 2 se ve "Carta de Cumplimiento" como título. El nombre viene de la tabla `cartas_acuerdo.nombre` y se muestra en `CartaAcuerdoDetalle` como `{cartaNombre}`.

**Solución**: Hacer el título editable inline.

**Cambios en `CartaAcuerdoDetalle.tsx`**:
- Reemplazar el título estático `{cartaNombre}` por un campo editable (click para editar o input inline)
- Al cambiar el nombre, actualizar `cartas_acuerdo.nombre` en Supabase e invalidar queries

**Cambios en `CartaAcuerdos.tsx`** (página principal):
- El título principal ya dice "Cartas de Acuerdo" correctamente
- Verificar que el menú lateral también diga "Cartas de Acuerdo" (esto depende de la configuración de menús dinámicos en la BD, se le indicará al usuario si necesita actualizarlo manualmente)

### Resumen de archivos a modificar
1. **`src/components/admin/CartaAcuerdoDetalle.tsx`** — Agregar sincronización con Mifiel + título editable inline
2. **`src/pages/admin/legal/CartaAcuerdos.tsx`** — Asegurar título correcto "Cartas de Acuerdo"

