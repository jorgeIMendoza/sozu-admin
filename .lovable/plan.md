
# Plan: Crear Menú "Configuraciones/Logs" con 4 Submenus

## Resumen

Crear el menú faltante "Configuraciones/Logs" (ID 13) con los 4 submenus que aparecen en la imagen:

```text
Configuraciones/Logs (Menu ID: 13)
├── Pregunta a Aloris-IA    → /admin/consultas-ia
├── Logs de Actividad       → /admin/logs-actividad
├── Rastreo CLABEs STP      → /admin/rastreo-clabes-stp
└── Rastreo Pagos STP       → /admin/rastreo-pagos-stp
```

## Verificación del Frontend

El código ya está preparado:
- Iconos mapeados en `useDynamicMenus.ts` líneas 87-90
- Icono del menú 13: Activity (línea 113)
- Restricción por email ya implementada (solo jorge.mendoza@sozu.com)

## Detalles Técnicos

### Migración de Base de Datos

```sql
-- Crear menú Configuraciones/Logs
INSERT INTO public.menus (id, nombre, orden, activo)
VALUES (13, 'Configuraciones/Logs', 13, true)
ON CONFLICT (id) DO NOTHING;

-- Crear los 4 submenus
INSERT INTO public.submenus (id, nombre, menu_id, vista_front_end, orden, activo) VALUES
(51, 'Pregunta a Aloris-IA', 13, '/admin/consultas-ia', 51, true),
(52, 'Logs de Actividad', 13, '/admin/logs-actividad', 52, true),
(53, 'Rastreo CLABEs STP', 13, '/admin/rastreo-clabes-stp', 53, true),
(54, 'Rastreo Pagos STP', 13, '/admin/rastreo-pagos-stp', 54, true)
ON CONFLICT (id) DO NOTHING;
```

### Mapeo de Iconos (Ya Existente)

| Ruta | Icono |
|------|-------|
| /admin/consultas-ia | Bot |
| /admin/logs-actividad | Activity |
| /admin/rastreo-clabes-stp | CreditCard |
| /admin/rastreo-pagos-stp | CreditCard |

### Restricción de Acceso (Ya Existente)

El código en `useDynamicMenus.ts` ya filtra este menú:

```typescript
const LOGS_ALLOWED_EMAIL = 'jorge.mendoza@sozu.com';
const LOGS_MENU_ID = 13;

// En el filtrado:
if (submenu.menu_id === LOGS_MENU_ID && userEmail !== LOGS_ALLOWED_EMAIL) {
  return false;
}
```

Solo el usuario `jorge.mendoza@sozu.com` podrá ver este menú.

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Insertar menú 13 y 4 submenus |

No se requieren cambios en código frontend - todo está preparado.

## Resultado Esperado

Después de aplicar la migración:
1. El usuario jorge.mendoza@sozu.com verá el menú "Configuraciones/Logs"
2. Dentro aparecerán los 4 submenus en el orden correcto
3. Otros usuarios no verán este menú
