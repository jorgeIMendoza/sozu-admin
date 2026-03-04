

## Plan: Portal de Inmobiliarias (con CTA Tracking y Activity Logs)

### Fase 1: Infraestructura

1. **Migración SQL** — Insertar en `menus`, `submenus`, `submenus_permisos`, `submenus_permisos_disponibles`:
   - Menu: "Portal Inmobiliaria"
   - 8 submenus: Dashboard, Agentes, Pipeline, Prospectos, Citas, Comisiones, Reportes, Configuracion
   - Permisos para rol 1 (Super Admin) y rol 4 (Inmobiliaria)

2. **Layout** — Crear `PortalInmobiliariaLayout.tsx` con sidebar SOZU (verde, logo, iconos). Detectar en `AdminLayout.tsx` rutas `/admin/portal-inmobiliaria/*`.

3. **Rutas** — 8 rutas lazy-loaded en `App.tsx`, envueltas en `InmobiliariasThemeWrapper`. Actualizar `validRoutes.ts` y `useDynamicMenus.ts`.

### Fase 2: Páginas (datos reales)

Cada página filtra datos por agentes vinculados a la inmobiliaria via `entidades_relacionadas` (`id_tipo_entidad = 19`).

- **Dashboard**: KPIs (agentes, pipeline, ofertas, apartados, ingresos), embudo de conversión, gráficos recharts, tabla desempeño por agente
- **Agentes**: Tabla con estatus, proyectos, prospectos, ofertas, ventas, conversión
- **Pipeline**: Vista Kanban por estatus de oferta
- **Prospectos**: Tabla con cliente, proyecto, unidad, agente, estatus
- **Citas**: Grid de cards con badge estatus, fecha, hora, agente
- **Comisiones**: KPIs + tabla detalle por agente
- **Reportes**: 4 gráficos (ingreso por agente, por proyecto, comisión mensual, conversión)
- **Configuración**: Datos fiscales, bancarios, roles (lectura)

### Fase 3: CTA Tracking y Activity Logs

- **CTA Tracking** (`useCtaTracker`): Prefijo `inmob_` para page views y acciones clave. Actualizar `MedicionesCTA.tsx` con contexto "Portal Inmobiliaria".
- **Activity Logs** (`useActivityLogger`): `registrarVista` en cada página, `registrarExportacion` en descargas, acciones CRUD con métodos correspondientes.

### Fase 4: Estilos

- Tema `sozu-theme` via wrapper existente
- Clases `sozu-card`, `sozu-stat-card`, `sozu-table-header` en `index.css`
- Sidebar blanco, texto gris, activo verde SOZU, logo superior

### Orden de implementación (3-4 mensajes)

1. Infraestructura (migración, layout, rutas) + Dashboard con tracking
2. Agentes + Pipeline + Prospectos con tracking
3. Citas + Comisiones + Reportes + Configuración con tracking
4. Contexto "Portal Inmobiliaria" en MedicionesCTA

