# Portal Tickets de Seguimiento — menú, submenús y permisos

## Objetivo

Dar de alta en BD el menú `Portal Tickets de Seguimiento` con sus 9 submenús y otorgar
todos los permisos al rol **Super Administrador (rol_id = 1)**, de modo que el portal
aparezca en el sidebar y el sistema de roles/permisos existente controle su visibilidad
(el front no tiene menús fijos: lee `menus`/`submenus` y filtra con `useAllowedMenus`).

## Auditoría

- `menus` y `submenus` tienen `id` como `GENERATED ALWAYS AS IDENTITY` → nunca fijar `id`.
- Un submenú sólo es visible si existe al menos una fila en `submenus_permisos`
  (permiso `leer` = 1) para el rol.
- `submenus_permisos_disponibles` define el catálogo de permisos que la pantalla
  "Administrar Menús" puede ofrecer; sin él el submenú no se puede administrar en la UI.
- Cada `vista_front_end` ya existe como `<Route>` en `src/App.tsx`.

## Diagnóstico

Script idempotente: usa `ON CONFLICT DO NOTHING` / `NOT EXISTS` para poder re-ejecutarse
sin duplicar filas. No se elimina nada.

## DDL

```sql
BEGIN;

-- 1) Menú padre (idempotente)
INSERT INTO public.menus (nombre, orden, activo)
SELECT 'Portal Tickets de Seguimiento', 260, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.menus WHERE nombre = 'Portal Tickets de Seguimiento'
);

UPDATE public.menus SET activo = true
WHERE nombre = 'Portal Tickets de Seguimiento' AND activo IS DISTINCT FROM true;

-- 2) Submenús
WITH m AS (
  SELECT id FROM public.menus WHERE nombre = 'Portal Tickets de Seguimiento'
), v(nombre, ruta, orden) AS (
  VALUES
    ('Todos los tickets', '/admin/portal-tickets/todos',                      10),
    ('Mis tickets',       '/admin/portal-tickets/mis-tickets',                20),
    ('Sin asignar',       '/admin/portal-tickets/sin-asignar',                30),
    ('Pipeline',          '/admin/portal-tickets/pipeline',                   40),
    ('Pipelines',         '/admin/portal-tickets/configuracion/pipelines',    50),
    ('Etapas',            '/admin/portal-tickets/configuracion/etapas',       60),
    ('Categorías',        '/admin/portal-tickets/configuracion/categorias',   70),
    ('Prioridades',       '/admin/portal-tickets/configuracion/prioridades',  80),
    ('Equipo',            '/admin/portal-tickets/configuracion/equipo',       90)
)
INSERT INTO public.submenus (menu_id, nombre, vista_front_end, orden, activo, solo_usuarioa)
SELECT m.id, v.nombre, v.ruta, v.orden, true, false
FROM m CROSS JOIN v
WHERE NOT EXISTS (
  SELECT 1 FROM public.submenus s WHERE s.vista_front_end = v.ruta
);

-- 3) Permisos DISPONIBLES por submenú (leer, crear, actualizar, eliminar, exportar)
INSERT INTO public.submenus_permisos_disponibles (submenu_id, permiso_id, activo)
SELECT s.id, p.permiso_id, true
FROM public.submenus s
JOIN public.menus mm ON mm.id = s.menu_id
CROSS JOIN (VALUES (1),(2),(3),(4),(6)) AS p(permiso_id)
WHERE mm.nombre = 'Portal Tickets de Seguimiento'
  AND NOT EXISTS (
    SELECT 1 FROM public.submenus_permisos_disponibles d
    WHERE d.submenu_id = s.id AND d.permiso_id = p.permiso_id
  );

-- 4) Asignación de permisos al Super Administrador (rol_id = 1)
INSERT INTO public.submenus_permisos (submenu_id, permiso_id, rol_id, activo)
SELECT s.id, p.permiso_id, 1, true
FROM public.submenus s
JOIN public.menus mm ON mm.id = s.menu_id
CROSS JOIN (VALUES (1),(2),(3),(4),(6)) AS p(permiso_id)
WHERE mm.nombre = 'Portal Tickets de Seguimiento'
  AND NOT EXISTS (
    SELECT 1 FROM public.submenus_permisos sp
    WHERE sp.submenu_id = s.id AND sp.permiso_id = p.permiso_id AND sp.rol_id = 1
  );

-- 5) Relación menú ↔ rol (si el proyecto usa menus_roles para el sidebar)
INSERT INTO public.menus_roles (menu_id, rol_id, activo)
SELECT mm.id, 1, true
FROM public.menus mm
WHERE mm.nombre = 'Portal Tickets de Seguimiento'
  AND NOT EXISTS (
    SELECT 1 FROM public.menus_roles mr WHERE mr.menu_id = mm.id AND mr.rol_id = 1
  );

COMMIT;
```

> Para dar acceso a otro rol (ej. Administrador de Proyectos), repetir el bloque 4
> y 5 cambiando `1` por el `rol_id` correspondiente y ajustando los `permiso_id`.

## Validación

```sql
SELECT mm.nombre AS menu, s.nombre AS submenu, s.vista_front_end, s.orden, s.activo
FROM public.submenus s
JOIN public.menus mm ON mm.id = s.menu_id
WHERE mm.nombre = 'Portal Tickets de Seguimiento'
ORDER BY s.orden;

SELECT s.nombre, p.nombre AS permiso, sp.rol_id
FROM public.submenus_permisos sp
JOIN public.submenus s ON s.id = sp.submenu_id
JOIN public.menus mm ON mm.id = s.menu_id
JOIN public.permisos p ON p.id = sp.permiso_id
WHERE mm.nombre = 'Portal Tickets de Seguimiento'
ORDER BY s.orden, p.id;
```

## Resultado esperado

- 9 submenús activos bajo el menú `Portal Tickets de Seguimiento`.
- 45 filas en `submenus_permisos` para `rol_id = 1` (9 submenús × 5 permisos).
- El portal aparece en el sidebar del Super Admin y responde en
  `/admin/portal-tickets/todos`. Los submenús que se apaguen en "Administrar Menús"
  desaparecen del portal y quedan bloqueados por URL directa.