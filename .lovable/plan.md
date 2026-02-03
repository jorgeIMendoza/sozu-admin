
# Plan: Eliminar Límite de 1000 Registros en Vista de Usuarios del Sistema

## Problema Identificado

La vista de "Usuarios del Sistema" no muestra todos los usuarios debido al **límite por defecto de 1000 registros de Supabase**.

**Análisis de datos:**
- Total de usuarios en la tabla: **1,469**
- Usuarios con roles internos: **915**
- Usuarios con roles externos: **554**

**Causa raíz:** 
La consulta actual trae TODOS los usuarios (1,469) sin filtrar en la base de datos, pero Supabase solo retorna los primeros 1,000. Después se filtra en JavaScript por `es_rol_interno === true`, pero para entonces ya se perdieron 469 usuarios.

VIVALTA está en la **posición 1,449** (ordenado alfabéticamente), por lo que nunca llega al frontend.

## Solución

Mover el filtro de `es_rol_interno` **a la consulta SQL** para que solo traiga los 915 usuarios internos desde la base de datos (evitando el límite de 1000).

## Cambios Técnicos

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/Usuarios.tsx` | Agregar filtro `.eq('roles.es_rol_interno', true)` en la consulta de Supabase para traer solo usuarios internos desde la BD |

### Código Actual (líneas 314-327)
```typescript
const { data, error } = await supabase
  .from('usuarios')
  .select(`
    email,
    nombre,
    rol_id,
    activo,
    auth_user_id,
    id_persona,
    debe_cambiar_password,
    roles (nombre, es_rol_interno),
    personas (nombre_legal, email)
  `)
  .order('nombre', { ascending: true });
```

### Código Propuesto
```typescript
const { data, error } = await supabase
  .from('usuarios')
  .select(`
    email,
    nombre,
    rol_id,
    activo,
    auth_user_id,
    id_persona,
    debe_cambiar_password,
    roles!inner (nombre, es_rol_interno),
    personas (nombre_legal, email)
  `)
  .eq('roles.es_rol_interno', true)
  .order('nombre', { ascending: true });
```

El cambio clave es:
1. Cambiar `roles (...)` a `roles!inner (...)` para hacer un INNER JOIN
2. Agregar `.eq('roles.es_rol_interno', true)` para filtrar en la BD
3. Eliminar el filtro JavaScript redundante en línea 354-355

## Resultado Esperado

- La consulta solo traerá **915 usuarios** (todos internos)
- VIVALTA y todos los demás usuarios con roles internos serán visibles
- Mejor rendimiento al traer menos datos desde la BD
