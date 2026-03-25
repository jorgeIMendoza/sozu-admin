

## Plan: Prospectos con Múltiples Proyectos de Interés

### Situación actual
- La base de datos **ya soporta** múltiples proyectos por prospecto (la constraint `uq_entrel_persona_tipo_proy_cuenta` permite varias filas con diferente `id_proyecto` para la misma persona)
- No se necesita crear tablas ni migraciones
- El problema es que la UI solo lee `entidades_relacionadas[0]` y muestra un solo proyecto

### Cambios

**1. Admin Prospectos (`src/pages/admin/Prospectos.tsx`)**
- **Query**: En lugar de tomar solo `entidades_relacionadas[0]`, agrupar todas las relaciones tipo 7 activas por persona, recolectando todos los proyectos
- **Tipo `Prospecto`**: Cambiar `proyecto_nombre`/`id_proyecto` por arrays `proyectos: { id: number; nombre: string; entidad_relacionada_id: number }[]`
- **Columna "Proyecto de Interés"**: Mostrar badges/chips con los nombres de todos los proyectos asignados, con un botón "+" para agregar otro proyecto
- **Selector de proyecto inline**: Al hacer clic en "+", mostrar un Combobox para seleccionar un nuevo proyecto (que crea una nueva fila en `entidades_relacionadas`). Los chips existentes tendrán un botón "x" para desasociar (desactivar la fila correspondiente)
- **Crear prospecto**: Mantener la selección de un proyecto inicial (obligatorio), funciona igual
- **Editar prospecto**: El selector de proyecto en el dialog de edición cambia a multi-proyecto (misma lógica de chips + agregar)
- **Exportar Excel**: Listar los proyectos separados por coma en la columna "Proyecto"

**2. Portal Inmobiliaria - Prospectos (`src/pages/admin/portal-inmobiliaria/InmobProspectos.tsx`)**
- **Query**: Agrupar las relaciones por `id_persona` para consolidar múltiples proyectos en un solo registro
- **Columna "Proyecto"**: Mostrar múltiples badges con los nombres de proyecto

**3. AddProspectoFloatingDialog (`src/components/admin/AddProspectoFloatingDialog.tsx`)**
- **Modo crear nuevo**: Funciona igual (un proyecto inicial)
- **Modo editar existente**: Al seleccionar un prospecto, mostrar sus proyectos actuales como chips. Agregar un botón "Agregar proyecto" que inserta una nueva fila en `entidades_relacionadas` para ese prospecto
- Permitir quitar un proyecto (desactivar la fila correspondiente), siempre que quede al menos uno

**4. Mutations nuevas/ajustadas**
- `addProjectToProspect`: Inserta nueva fila en `entidades_relacionadas` con `id_persona`, `id_tipo_entidad=7`, `id_proyecto`, `id_persona_duena_lead` del agente
- `removeProjectFromProspect`: Desactiva (`activo=false`) la fila de `entidades_relacionadas` por su ID específico
- El mutation existente `updateProjectMutation` se reemplaza por estas dos operaciones

### Archivos a modificar
- `src/pages/admin/Prospectos.tsx` — query multi-proyecto, UI chips, mutations add/remove
- `src/pages/admin/portal-inmobiliaria/InmobProspectos.tsx` — query agrupada, UI multi-badges
- `src/components/admin/AddProspectoFloatingDialog.tsx` — modo editar con multi-proyecto

### Sin migraciones de base de datos
La estructura actual de `entidades_relacionadas` ya permite múltiples filas por prospecto con diferentes proyectos.

