

# Fix: Filtrar proyectos por estado de publicacion en Portal Agente

## Problemas identificados

### 1. Portal Agente muestra proyectos no publicados
En `AgentInventario.tsx` (linea 65), la consulta de proyectos solo filtra por `activo = true` pero NO filtra por `publicar = true`. Esto causa que el Super Admin (y cualquier rol con acceso irrestricto) vea todos los proyectos, incluyendo los no publicados.

### 2. abel1@yopmail.com ve Monocolo
El usuario tiene acceso explicito al proyecto Monocolo (ID 1902) en la tabla `proyectos_acceso`. Aunque Monocolo tiene `publicar = false`, el Portal Agente no valida este campo, por lo que se muestra igualmente.

## Solucion

### Archivo: `src/pages/admin/agent-portal/AgentInventario.tsx`

Agregar `.eq('publicar', true)` a la consulta de proyectos (linea 65):

```text
let query = (supabase as any)
  .from('proyectos')
  .select('id, nombre, direccion, url_imagen_portada, id_estatus_proyecto')
  .eq('activo', true)
  .eq('publicar', true);   // <-- NUEVO: solo proyectos publicados
```

Esto aplica para todos los roles en el portal de agente, incluyendo Super Admin. Solo los proyectos marcados como publicados apareceran en el inventario del portal.

### Sin cambios en proyectos_acceso
No es necesario remover el acceso de abel1@yopmail.com a Monocolo en `proyectos_acceso`, ya que el filtro `publicar = true` en la consulta se encargara de excluirlo automaticamente del portal.

