

## Plan: Agregar logica de entrega al cambio de estatus de documentos

### Problema
Cuando se cambia el estatus de un documento de categoria 7 (Entrega) a "Validado" usando el dialogo de cambio de estatus, el sistema no detecta que es el ultimo documento pendiente y no dispara el flujo de confirmacion de entrega (generacion de cuenta de mantenimiento).

### Solucion

**Archivo: `src/components/admin/DocumentsTab.tsx`**

Modificar la funcion `handleStatusChange` para que, cuando el nuevo estatus sea **2 (Validado)** y el documento pertenezca a **categoria 7**, verifique si con esta validacion todos los documentos de categoria 7 quedarian completos. Si es asi, en lugar de solo actualizar el estatus, debe abrir el dialogo de "Confirmar Entrega" (el mismo que ya existe en el flujo de upload).

### Pasos tecnicos

1. **En `handleStatusChange`** (linea ~837): Antes de hacer el update directo, agregar una verificacion:
   - Consultar si el documento es de categoria 7
   - Si el nuevo estatus es 2 (Validado), contar cuantos documentos de categoria 7 quedan sin validar (excluyendo el documento actual que esta por validarse)
   - Si este es el ultimo pendiente (noVerificados restantes = 0 despues de validar este):
     - Validar que exista entidad administradora con cuenta madre STP (misma validacion que el flujo de upload)
     - Abrir el dialogo de "Confirmar Entrega" en lugar de hacer el update simple
     - Guardar el documento y comentario pendientes para procesarlos cuando se confirme la entrega
   - Si NO es el ultimo, hacer el update normal como hasta ahora

2. **Guardar contexto del documento pendiente**: Agregar un estado para almacenar el documento, nuevo estatus y comentario que se usaran cuando el usuario confirme la entrega en el dialogo existente.

3. **Modificar el handler de "Confirmar Entrega"**: Asegurar que al confirmar, ademas de llamar `procesarUltimoDocumento()`, tambien actualice el estatus del documento pendiente (el que se estaba validando desde el dialogo de cambio de estatus).

### Flujo resultante

```text
Usuario cambia estatus de doc cat.7 a "Validado"
    |
    v
Es el ultimo doc cat.7 pendiente?
    |           |
   NO          SI
    |           |
    v           v
Update      Validar admin/STP
normal          |
                v
          Abrir dialogo
          "Confirmar Entrega"
                |
                v
          Usuario confirma
                |
                v
          1. Webhook N8N (genera cuenta mant.)
          2. Update estatus doc a Validado
          3. Insert comentario
```

### Archivos a modificar
- `src/components/admin/DocumentsTab.tsx` (unico archivo)

