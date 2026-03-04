

# Plan: Clonar diseño exacto del Dashboard de referencia al Portal Inmobiliaria

## Estrategia

En lugar de modificar variables globales (que afectarían todo el proyecto), se actualizará el scope `.sozu-theme` en `index.css` para que sus variables CSS coincidan exactamente con las del proyecto de referencia. Luego se reescribirá `InmobDashboard.tsx` usando la misma estructura del `DashboardPage.tsx` de referencia, pero manteniendo las queries reales de Supabase.

## Cambios

### 1. `src/index.css` — Actualizar variables dentro de `.sozu-theme`
Reemplazar las variables del bloque `.sozu-theme` para que coincidan con el proyecto de referencia:
- `--primary: 139 35% 51%` (verde SOZU, no negro)
- `--foreground: 0 0% 0%` (negro puro)
- `--accent: 0 0% 96%` (gris claro, como secondary)
- `--success: 139 35% 51%`
- `--warning: 32 95% 55%`
- Agregar `--sozu-green`, `--sozu-green-light`, `--sozu-green-dark`, `--sozu-gray-muted`, `--chart-1` a `--chart-5`
- Actualizar las clases utilitarias `.sozu-card`, `.sozu-stat-card`, `.sozu-table-header` para coincidir exactamente

### 2. `tailwind.config.ts` — Agregar tokens `sozu` faltantes
Agregar `sozu.green-light`, `sozu.green-dark`, `sozu.gray-light`, `sozu.gray-muted` al config para que estén disponibles como clases Tailwind.

### 3. `src/pages/admin/portal-inmobiliaria/InmobDashboard.tsx` — Reescritura completa
Replicar la estructura exacta de `DashboardPage.tsx` de referencia:
- **StatCard**: Componente con icono en círculo verde, flecha de navegación, título gris arriba, valor grande, subtítulo + badge de trend — exactamente como el `StatCard` de referencia
- **7 KPI cards** usando `StatCard` con variantes `primary`/`warning`/`success`
- **4 mini-métricas** en fila horizontal con icono + label + valor
- **Funnel**: Usar `recharts.FunnelChart` + `Funnel` + `LabelList` + `Cell` con colores degradados verdes (como en referencia), NO el SVG custom actual
- **Alertas**: Componente con iconos `AlertTriangle`/`AlertCircle`/`Info` y estilos por tipo (`warning`/`danger`/`info`)
- **Charts**: BarChart y AreaChart con mismos estilos, colores y formateo que la referencia
- **Tabla**: Mismas columnas con mismos estilos de conversión (badges con ↑↓)
- **Activity feed**: Con iconos por tipo y timestamps

Se mantienen todas las queries de Supabase existentes (ofertas, propiedades, financialData, comisiones, prospectos) — solo cambia la capa de presentación.

### 4. `src/components/admin/portal-inmobiliaria/PortalInmobiliariaLayout.tsx` — Sin cambios
El layout ya tiene sidebar + floating mobile nav correctos.

## Archivos a modificar
| Archivo | Acción |
|---------|--------|
| `src/index.css` | Actualizar bloque `.sozu-theme` |
| `tailwind.config.ts` | Agregar tokens sozu faltantes |
| `src/pages/admin/portal-inmobiliaria/InmobDashboard.tsx` | Reescritura completa de UI |

