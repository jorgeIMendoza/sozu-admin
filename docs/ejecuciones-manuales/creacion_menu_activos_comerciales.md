## Reparar/registrar menú de Activos Comerciales — 2026-07-03

> **Importante:** este script debe ejecutarse en la misma BD que usa el preview/admin: `https://supabase-dev.sozu.com`.
> No usa IDs fijos porque `menus.id` y `submenus.id` son `GENERATED ALWAYS AS IDENTITY`.
> Al final devuelve una verificación con el submenú, permisos disponibles y permisos asignados a Super Admin.

```sql
BEGIN;

WITH menu_finanzas AS (
  SELECT id
  FROM public.menus
  WHERE lower(trim(nombre)) = lower('Finanzas')
  LIMIT 1
),
menu_actualizado AS (
  UPDATE public.menus m
  SET
    activo = true,
    fecha_actualizacion = now()
  WHERE m.id IN (SELECT id FROM menu_finanzas)
  RETURNING m.id
),
menu_creado AS (
  INSERT INTO public.menus (nombre, orden, activo)
  SELECT 'Finanzas', 11, true
  WHERE NOT EXISTS (SELECT 1 FROM menu_finanzas)
  RETURNING id
),
menu_objetivo AS (
  SELECT id FROM menu_actualizado
  UNION ALL
  SELECT id FROM menu_creado
  LIMIT 1
),
menu_rol_actualizado AS (
  UPDATE public.menus_roles mr
  SET
    activo = true,
    fecha_actualizacion = now()
  WHERE mr.menu_id = (SELECT id FROM menu_objetivo)
    AND mr.rol_id = 1
  RETURNING mr.menu_id, mr.rol_id
),
menu_rol_insertado AS (
  INSERT INTO public.menus_roles (menu_id, rol_id, activo)
  SELECT (SELECT id FROM menu_objetivo), 1, true
  WHERE NOT EXISTS (SELECT 1 FROM menu_rol_actualizado)
  RETURNING menu_id, rol_id
),
submenu_existente AS (
  SELECT id
  FROM public.submenus
  WHERE vista_front_end = '/admin/activos-comerciales'
     OR lower(trim(nombre)) = lower('Activos Comerciales')
  ORDER BY
    CASE WHEN vista_front_end = '/admin/activos-comerciales' THEN 0 ELSE 1 END,
    id
  LIMIT 1
),
submenu_actualizado AS (
  UPDATE public.submenus s
  SET
    menu_id = (SELECT id FROM menu_objetivo),
    nombre = 'Activos Comerciales',
    vista_front_end = '/admin/activos-comerciales',
    orden = 10,
    activo = true,
    solo_usuarioa = false,
    fecha_actualizacion = now()
  WHERE s.id = (SELECT id FROM submenu_existente)
  RETURNING s.id
),
submenu_creado AS (
  INSERT INTO public.submenus (menu_id, nombre, vista_front_end, orden, activo, solo_usuarioa)
  SELECT (SELECT id FROM menu_objetivo), 'Activos Comerciales', '/admin/activos-comerciales', 10, true, false
  WHERE NOT EXISTS (SELECT 1 FROM submenu_actualizado)
  RETURNING id
),
submenu_objetivo AS (
  SELECT id FROM submenu_actualizado
  UNION ALL
  SELECT id FROM submenu_creado
  LIMIT 1
),
submenus_duplicados_desactivados AS (
  UPDATE public.submenus s
  SET
    activo = false,
    fecha_actualizacion = now()
  WHERE s.id <> (SELECT id FROM submenu_objetivo)
    AND (
      s.vista_front_end = '/admin/activos-comerciales'
      OR lower(trim(s.nombre)) = lower('Activos Comerciales')
    )
  RETURNING s.id
),
permisos_requeridos AS (
  SELECT permiso_id
  FROM (VALUES (1), (2), (3), (4), (6)) AS p(permiso_id)
),
permisos_disponibles_insertados AS (
  INSERT INTO public.submenus_permisos_disponibles (submenu_id, permiso_id, activo)
  SELECT (SELECT id FROM submenu_objetivo), pr.permiso_id, true
  FROM permisos_requeridos pr
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.submenus_permisos_disponibles spd
    WHERE spd.submenu_id = (SELECT id FROM submenu_objetivo)
      AND spd.permiso_id = pr.permiso_id
  )
  RETURNING submenu_id, permiso_id
),
permisos_disponibles_actualizados AS (
  UPDATE public.submenus_permisos_disponibles spd
  SET activo = true
  WHERE spd.submenu_id = (SELECT id FROM submenu_objetivo)
    AND spd.permiso_id IN (SELECT permiso_id FROM permisos_requeridos)
  RETURNING submenu_id, permiso_id
),
permisos_superadmin_insertados AS (
  INSERT INTO public.submenus_permisos (submenu_id, permiso_id, rol_id, activo)
  SELECT (SELECT id FROM submenu_objetivo), pr.permiso_id, 1, true
  FROM permisos_requeridos pr
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.submenus_permisos sp
    WHERE sp.submenu_id = (SELECT id FROM submenu_objetivo)
      AND sp.permiso_id = pr.permiso_id
      AND sp.rol_id = 1
  )
  RETURNING submenu_id, permiso_id, rol_id
)
UPDATE public.submenus_permisos sp
SET activo = true
WHERE sp.submenu_id = (SELECT id FROM submenu_objetivo)
  AND sp.permiso_id IN (SELECT permiso_id FROM permisos_requeridos)
  AND sp.rol_id = 1;

COMMIT;
```

> Ejecutar en la base de datos de **desarrollo** (`https://supabase-dev.sozu.com`).
> Este script es idempotente: si el menú/submenú ya existe, reactiva `menus.activo`, activa `menus_roles`, mueve el submenú a Finanzas y completa permisos disponibles + permisos Super Admin.

## Verificación obligatoria — 2026-07-03

```sql
SELECT
  m.id AS menu_id,
  m.nombre AS menu_nombre,
  s.id AS submenu_id,
  s.nombre AS submenu_nombre,
  s.vista_front_end,
  s.activo,
  s.solo_usuarioa,
  bool_or(mr.activo) FILTER (WHERE mr.rol_id = 1) AS menu_habilitado_super_admin,
  array_agg(DISTINCT sp.permiso_id ORDER BY sp.permiso_id) FILTER (WHERE sp.rol_id = 1 AND sp.activo) AS permisos_super_admin,
  array_agg(DISTINCT spd.permiso_id ORDER BY spd.permiso_id) FILTER (WHERE spd.activo) AS permisos_disponibles
FROM public.menus m
JOIN public.submenus s ON s.menu_id = m.id
LEFT JOIN public.menus_roles mr ON mr.menu_id = m.id
LEFT JOIN public.submenus_permisos sp ON sp.submenu_id = s.id
LEFT JOIN public.submenus_permisos_disponibles spd ON spd.submenu_id = s.id
WHERE s.vista_front_end = '/admin/activos-comerciales'
GROUP BY m.id, m.nombre, s.id, s.nombre, s.vista_front_end, s.activo, s.solo_usuarioa;
```

El resultado esperado debe tener:

- `menu_nombre = Finanzas`
- `submenu_nombre = Activos Comerciales`
- `vista_front_end = /admin/activos-comerciales`
- `activo = true`
- `solo_usuarioa = false`
- `menu_habilitado_super_admin = true`
- `permisos_super_admin` contiene `{1,2,3,4,6}`
- `permisos_disponibles` contiene `{1,2,3,4,6}`

## Diagnóstico si no aparece en el sidebar/admin — 2026-07-03

Ejecuta este bloque en la misma BD. Sirve para detectar si el script se ejecutó en otra base, si quedó duplicado, inactivo o si el rol del usuario no es Super Admin.

```sql
SELECT 'conexion' AS seccion, current_database()::text AS dato_1, current_user::text AS dato_2, inet_server_addr()::text AS dato_3;

SELECT
  'submenus_activos_comerciales' AS seccion,
  s.id::text AS submenu_id,
  m.nombre AS menu_nombre,
  s.nombre AS submenu_nombre,
  s.vista_front_end,
  s.activo::text AS submenu_activo,
  s.solo_usuarioa::text AS solo_usuarioa
FROM public.submenus s
JOIN public.menus m ON m.id = s.menu_id
WHERE lower(trim(s.nombre)) LIKE '%activo%comercial%'
   OR s.vista_front_end LIKE '%activos-comerciales%'
ORDER BY s.id;

SELECT
  'permisos_super_admin' AS seccion,
  s.id::text AS submenu_id,
  r.id::text AS rol_id,
  r.nombre AS rol_nombre,
  array_agg(p.nombre ORDER BY p.id)::text AS permisos
FROM public.submenus s
JOIN public.submenus_permisos sp ON sp.submenu_id = s.id AND sp.activo = true
JOIN public.permisos p ON p.id = sp.permiso_id
JOIN public.roles r ON r.id = sp.rol_id
WHERE s.vista_front_end = '/admin/activos-comerciales'
  AND r.id = 1
GROUP BY s.id, r.id, r.nombre;

SELECT
  'usuario_actual' AS seccion,
  u.id::text AS usuario_id,
  u.email,
  u.rol_id::text AS rol_id,
  r.nombre AS rol_nombre,
  u.activo::text AS usuario_activo
FROM public.usuarios u
LEFT JOIN public.roles r ON r.id = u.rol_id
WHERE lower(trim(u.email)) = lower(trim('<REEMPLAZA_AQUI_TU_EMAIL>'));
```

Si `usuario_actual.rol_id` no es `1`, el submenú no aparecerá porque esta alta solo lo asigna a Super Admin.