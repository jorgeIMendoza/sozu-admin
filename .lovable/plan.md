

# Plan: Cambiar color principal del portal inmobiliaria de `#22C55E` a `#239E6C`

## Cambios

### 1. `src/index.css` — Actualizar tokens `.inmob-portal`
Cambiar todas las referencias de `142 71% 45%` a `156 64% 38%` (equivalente HSL de `#239E6C`):
- `--primary`, `--success`, `--ring`, `--sidebar-primary`, `--sidebar-ring`, `--chart-1`
- `--inmob-green`: `156 64% 38%`
- `--inmob-green-light`: `156 64% 93%`
- `--inmob-green-dark`: `156 64% 30%`
- `--sidebar-accent`: `156 64% 93%`
- `--sidebar-accent-foreground`: `156 64% 25%`

### 2. `src/pages/admin/portal-inmobiliaria/InmobDashboard.tsx`
- Funnel colors: actualizar gradiente de tonos de `#239E6C` (de oscuro a claro)
- Bar chart fill: `#22C55E` → `#239E6C`
- Area chart stroke/fill: `#22C55E` → `#239E6C`

### 3. `src/pages/admin/portal-inmobiliaria/InmobReportes.tsx`
- `COLORS[0]`: `#22C55E` → `#239E6C`
- Bar "aprobadas" fill: → `#239E6C`
- Line chart stroke/dot: → `#239E6C`

