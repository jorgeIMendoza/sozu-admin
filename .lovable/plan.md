# Portal de Alta Dirección

Crear un nuevo portal ejecutivo `/admin/portal-alta-direccion/*` inspirado en el proyecto **Sozu Executive Suite**, con vista 360° para directivos: dashboard financiero/comercial, pipeline, cobranza, contratos, facturas, comisiones, red comercial, citas, ofertas, reportes, auditoría y configuración. Acceso restringido a **Super Admin (rol_id === 1)**, mismo patrón que Portal Escrituración.

## Estrategia de datos (mixta)
- **De BD real (consultas read-only):** propiedades, desarrollos/proyectos, cuentas de cobranza, ofertas, contratos, comisiones, usuarios/personas, citas, facturas. Reutilizar hooks existentes (`useCuentasCobranzaPaginadas`, `useCobranzaDashboard`, `useInventarioDisponible`, etc.) cuando aplique.
- **Mock data** (en `src/data/altaDireccion/mockData.ts`) para módulos sin tabla clara aún: tendencias mensuales agregadas, KPIs ejecutivos compuestos, auditoría ejemplo.
- Cada página marca claramente con un `Pill` "Datos en vivo" o "Demo" cuando la fuente sea mock.

## Permisos
- Super Admin (rol_id 1) — todo el portal.
- Bloqueo en `PermissionRoute.tsx` análogo al de Portal Escrituración.
- Sin DDL/DML — no se requieren cambios de BD ni nueva tabla de roles.

## Estructura del portal

```text
/admin/portal-alta-direccion/
├── dashboard                  Dashboard ejecutivo (KPIs financieros + 3 gráficas recharts)
├── citas                      Citas comerciales (vivo: configuracion_citas_horarios)
├── prospectos                 Prospectos / leads (vivo: leads)
├── pipeline                   Pipeline de oportunidades por etapa
├── ofertas                    Ofertas + aprobaciones (vivo: ofertas)
│
├── cobranza                   Resumen cobranza (vivo: cuentas_cobranza, hook existente)
├── contratos                  Contratos (vivo: documentos_propiedad / mifiel)
├── facturas                   Facturas emitidas (vivo: facturas)
├── comisiones                 Comisiones aprobadas/pagadas (vivo: comisiones)
│
├── red-comercial              Personas (agentes, brokers, embajadores) (vivo: usuarios)
├── reportes                   Reportes ejecutivos (mix vivo + agregados mock)
├── auditoria                  Bitácora (mock)
└── configuracion              Preferencias del portal (mock)
```

## Cambios en código (frontend únicamente)

**Nuevos archivos**
- `src/components/admin/portal-alta-direccion/PortalAltaDireccionLayout.tsx` — sidebar con 3 grupos (Comercial, Operación, Administración) + header, basado en el de Portal Escrituración.
- `src/components/admin/portal-alta-direccion/ui.tsx` — `Kpi`, `Panel`, `PageHeader`, `Pill` (idéntico patrón).
- `src/components/admin/portal-alta-direccion/GlobalFilterBar.tsx` — filtros globales (proyecto, canal, periodo, búsqueda) con contexto local.
- `src/contexts/AltaDireccionFiltersContext.tsx` — provider para los filtros globales.
- `src/data/altaDireccion/mockData.ts` — series mensuales, KPIs compuestos, eventos auditoría.
- `src/pages/admin/portal-alta-direccion/` — un archivo por página (Dashboard, Citas, Prospectos, Pipeline, Ofertas, Cobranza, Contratos, Facturas, Comisiones, RedComercial, Reportes, Auditoria, Configuracion). 13 archivos.
- `src/hooks/useAltaDireccionDashboard.ts` — agrega métricas de varias tablas (counts) en una sola query.

**Archivos a modificar**
- `src/App.tsx` — registrar 13 rutas lazy `portal-alta-direccion/*`.
- `src/components/admin/AdminLayout.tsx` — agregar branch `if (location.pathname.startsWith("/admin/portal-alta-direccion")) return <PortalAltaDireccionLayout />`.
- `src/components/auth/PermissionRoute.tsx` — agregar guard que solo deja pasar a `rol_id === 1`.
- `src/utils/validRoutes.ts` — agregar las 13 rutas.
- `src/components/admin/AdminSidebar.tsx` — entrada "Portal Alta Dirección" visible solo para Super Admin (estilo `ExternalLink`, igual a Portal Cobranza).

## Permisos al Super Admin
No se requiere DDL/DML. La autorización se hace en el cliente con `profile.rol_id === 1`. Si quieres también ocultarlo del menú dinámico para otros roles ya queda automáticamente fuera porque no se registra en `submenus`.

## Plan de ejecución (en pasos / chats separados)

**Paso 1 — Esqueleto**
- Layout, ui.tsx, FilterBar/contexto, ruteo en App.tsx, guard en PermissionRoute, AdminLayout branch, validRoutes, entrada en AdminSidebar para Super Admin.
- Páginas vacías (placeholder con PageHeader) para validar navegación.

**Paso 2 — Dashboard ejecutivo + datos mixtos**
- `useAltaDireccionDashboard` con counts agregados (propiedades vendidas/apartadas/disponibles, ofertas pendientes, cuentas cobranza vencidas, comisiones devengadas).
- 3 gráficas recharts (ingresos por desarrollo, ingresos por canal, tendencia mensual) — agregados mock.
- 12 KPIs en 3 filas, badge "Datos en vivo" / "Demo" por tarjeta.

**Paso 3 — Comercial (Citas, Prospectos, Pipeline, Ofertas)**
- Tablas read-only con paginación usando hooks existentes; drawers de detalle simples.

**Paso 4 — Operación (Cobranza, Contratos, Facturas, Comisiones)**
- KPIs + tablas resumen con datos vivos (sin acciones de edición — es vista ejecutiva).

**Paso 5 — Administración (Red Comercial, Reportes, Auditoría, Configuración)**
- Red Comercial: lista de agentes/brokers/embajadores (vivo).
- Reportes: tarjetas con descargas (placeholder).
- Auditoría / Configuración: mock.

**Paso 6 — QA y pulido**
- Verificar acceso bloqueado para roles ≠ 1, navegación, breakpoints mobile, performance del dashboard.

## Detalles técnicos clave
- Sidebar reutiliza patrón visual de `PortalEscrituracionLayout` (244px fijo en desktop, Sheet en mobile, grupos con label uppercase tracking-widest).
- Reglas de terminología: "Desarrollo", "Departamento", "Disponible", "2 citas", 2 decimales en montos, emails normalizados.
- Sin edge functions, sin DDL, sin DML — todo es UI + hooks de lectura. Por lo tanto **no se generan archivos en `Ejecuciones_manuales/`** en esta entrega.
- Solo Super Admin lo ve; no se toca el sistema dinámico de menús (`submenus` / `usuarios_submenus_excluidos`).

¿Procedo con el Paso 1 (esqueleto del portal navegable) tras tu aprobación, y los pasos 2-6 los vamos liberando uno por uno en chats subsecuentes?
