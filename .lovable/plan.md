

# Plan: Menús Dinámicos desde Base de Datos

## Objetivo
Modificar el sistema para que los nombres de menús y submenús se obtengan dinámicamente de las tablas `menus` y `submenus` de la base de datos, eliminando los títulos hardcodeados en el código.

## Análisis de la Situación Actual

### Estructura de Base de Datos
- **Tabla `menus`**: id, nombre, activo
- **Tabla `submenus`**: id, nombre, vista_front_end, menu_id, activo

### Datos Relevantes Encontrados
El submenu con `vista_front_end: /admin/inmobiliarias/mis-propiedades` tiene:
- **En BD**: nombre = "Mi inventario"  
- **En código**: título hardcodeado = "Mis Propiedades"

### Problema Identificado
Los nombres están definidos estáticamente en `AdminSidebar.tsx` y no se sincronizan con la BD.

---

## Solución Propuesta

### Crear nuevo hook: `useDynamicMenus.ts`

Este hook obtendrá la estructura completa de menús y submenús desde la BD, respetando los permisos del usuario.

```text
┌─────────────────────────────────────────────────────────────┐
│                    useDynamicMenus                          │
├─────────────────────────────────────────────────────────────┤
│  1. Fetch menus activos                                     │
│  2. Fetch submenus con permisos del rol                     │
│  3. Construir estructura NavigationItem[]                   │
│  4. Mapear iconos por vista_front_end                       │
│  5. Retornar menús filtrados listos para renderizar         │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

```text
BD: menus + submenus
        ↓
   useDynamicMenus
        ↓
  Combina con iconos (mapeo local)
        ↓
  Filtra por permisos del rol
        ↓
   AdminSidebar renderiza
```

---

## Detalles Técnicos

### 1. Nuevo archivo: `src/hooks/useDynamicMenus.ts`

Responsabilidades:
- Consultar tabla `menus` con sus `submenus` relacionados
- Filtrar submenus según permisos del usuario (usando lógica similar a `useAllowedMenus`)
- Retornar estructura lista para el sidebar

### 2. Mapeo de Iconos

Dado que la BD no tiene campo de iconos, se mantendrá un mapeo por `vista_front_end`:

```typescript
const iconMap: Record<string, LucideIcon> = {
  '/admin': LayoutDashboard,
  '/admin/proyectos': Building2,
  '/admin/propiedades': Building,
  '/admin/inmobiliarias/mis-propiedades': Building,
  // ... etc
};
```

### 3. Modificación de `AdminSidebar.tsx`

- Eliminar arrays estáticos `navigationItems`, `inmobiliariasMenuItem`, `logsMenuItem`
- Usar el nuevo hook `useDynamicMenus()`
- Los títulos vendrán de la BD, los iconos del mapeo local

### 4. Casos Especiales

| Caso | Solución |
|------|----------|
| Menú "Configuraciones/Logs" (solo jorge.mendoza@sozu.com) | Agregar menú en BD con id específico, filtrar en hook por email |
| Menú Dashboard sin hijos | Detectar cuando menu tiene un solo submenu y aplanar |
| Super Admin | Mostrar todos los menús sin filtrar por permisos |

---

## Archivos a Modificar/Crear

| Archivo | Acción |
|---------|--------|
| `src/hooks/useDynamicMenus.ts` | **Crear** - Hook para obtener menús de BD |
| `src/components/admin/AdminSidebar.tsx` | **Modificar** - Usar hook dinámico |
| `src/hooks/useAllowedMenus.ts` | **Modificar** - Exportar lógica reutilizable |

---

## Beneficios

1. **Flexibilidad**: Cambios en BD se reflejan automáticamente
2. **Mantenibilidad**: No requiere deploy para cambiar nombres de menús
3. **Consistencia**: Una sola fuente de verdad (BD)
4. **Escalabilidad**: Agregar nuevos menús/submenús solo requiere insertar en BD

---

## Consideraciones de Rendimiento

- Los menús se cachean con React Query (staleTime alto)
- Solo se recargan cuando cambian permisos (`permissionVersion`)
- Carga inicial junto con permisos (una sola consulta combinada si es posible)

