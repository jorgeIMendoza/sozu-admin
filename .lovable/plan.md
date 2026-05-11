
# Portal Escrituración — Plan de implementación

Voy a crear un nuevo portal `Portal Escrituración`, espejando la estructura del proyecto "SOZU Property Suite" pero adaptado a la convención que ya tenemos (`Portal Cobranza`, `Portal Inmobiliaria`, etc.). Reutilizamos `AdminLayout` con un layout dedicado y todas las pantallas vivirán bajo `/admin/portal-escrituracion/*`.

Como en el proyecto de referencia el "tema central" es la escrituración (con `escrituracion`, `notarias`, `credito`, `expedientes`, `entregas`, `daiku`, `postventa`, `portal cliente`, `reportes`, `usuarios`, `auditoría`, `configuración`), tomaré sólo lo relevante al **cierre legal + entrega**, que es la columna vertebral de "Escrituración". Los módulos restantes ya existen en otros portales (Cobranza, Cliente, etc.).

## Alcance del Portal Escrituración

Menú (sidebar propio, mismo estilo que `PortalCobranzaLayout`):

```text
Operación
 ├─ Dashboard
 ├─ Expedientes (pipeline)
 ├─ Unidades en escrituración
 └─ Crédito hipotecario

Cierre legal
 ├─ Pipeline notarial
 ├─ Notarías
 ├─ Notarios
 └─ Avalúos

Documentación
 ├─ Expedientes / PLD
 ├─ Borradores
 └─ Plantillas de escritura

Entrega
 ├─ Programación de firmas
 ├─ Entregas físicas
 └─ Inscripción RPP

Sistema
 ├─ Reportes
 ├─ Auditoría
 └─ Configuración
```

Todas las páginas usarán **mock data** (estilo del repo de referencia) con KPIs, tablas, filtros, paneles y badges. Reutilizamos los componentes shadcn ya presentes (`Card`, `Badge`, `Table`, `Tabs`, `Progress`) y los patrones visuales de `PortalCobranza` para conservar coherencia con SOZU Admin.

## Pasos de ejecución (te diré "siguiente" entre cada uno)

### Paso 1 — Base de datos (SQL que tú ejecutarás)
- Insertar `menus` nuevo: `Portal Escrituración` (orden tras `Portal Cobranza`).
- Insertar 5 grupos lógicos como submenus padre + ~17 submenús hijos con `vista_front_end = '/admin/portal-escrituracion/...'`.
- Insertar permisos `leer/crear/actualizar/eliminar/exportar/aprobar` por submenu.
- Asignar TODOS los permisos al rol Super Admin (rol_id = 1) — esto es lo único que pides explícito.
- Como `is_super_admin()` ya da bypass global, esto es redundante en runtime pero deja la matriz limpia para futuros roles.

Entrego un único bloque SQL para que lo ejecutes tú (no DDL, sólo `INSERT`s).

### Paso 2 — Layout, ruteo y guardas
- Crear `src/components/admin/portal-escrituracion/PortalEscrituracionLayout.tsx` (clon adaptado de `PortalCobranzaLayout`).
- Registrar `if (location.pathname.startsWith("/admin/portal-escrituracion"))` en `AdminLayout.tsx`.
- En `PermissionRoute.tsx`, permitir el portal sólo si `profile.rol_id === 1` (Super Admin), igual que se hace para `portal-cobranza`.
- Rutas perezosas en `App.tsx` con `lazyRetry`.

### Paso 3 — Dashboard + KPIs
- `EscDashboard.tsx`: KPIs (Expedientes activos, Pipeline MXN, En riesgo, Escrituras del mes), gráficos `recharts` (cobranza semanal del cierre, distribución por notaría, pie de status), tabla "Próximas firmas".

### Paso 4 — Pipeline notarial (módulo estrella)
- `EscExpedientes.tsx`: réplica del `escrituracion.tsx` del repo de referencia: barra de etapas (Expediente → Avalúo → Instrucción → Borrador → VoBo → Firma → Registro → Entrega), tabla filtrable, panel de detalle con milestones, alta de expediente.

### Paso 5 — Notarías + Notarios + Avalúos
- `EscNotarias.tsx`, `EscNotarios.tsx`, `EscAvaluos.tsx`: listas con búsqueda, tarjetas por notaría (titular, zona, carga, SLA), tabla de avalúos con banco y monto.

### Paso 6 — Documentación
- `EscExpedientesPLD.tsx`, `EscBorradores.tsx`, `EscPlantillas.tsx`: checklists, estado por documento, previsualización mock.

### Paso 7 — Entrega
- `EscFirmas.tsx` (calendario simple por semana), `EscEntregasFisicas.tsx` (lista con checklist), `EscInscripcionRPP.tsx`.

### Paso 8 — Crédito hipotecario
- `EscCredito.tsx`: pipeline por banco, montos autorizados/dispersados, SLAs por institución.

### Paso 9 — Sistema
- `EscReportes.tsx`, `EscAuditoria.tsx`, `EscConfiguracion.tsx` con placeholders accionables (no inventamos lógica de backend).

### Paso 10 — QA visual y verificación
- Probar navegación entre submenús con Super Admin.
- Verificar build limpio.
- Confirmar que el submenu se renderiza vía `useDynamicMenus` (basta con los INSERTs del Paso 1).

## Detalle técnico

- **Rutas:** `/admin/portal-escrituracion/{dashboard, expedientes, unidades, credito, pipeline, notarias, notarios, avaluos, pld, borradores, plantillas, firmas, entregas, rpp, reportes, auditoria, configuracion}`.
- **Acceso:** sólo `rol_id = 1` (Super Admin) entra por ahora. Para sumar otros roles luego basta otorgarles los permisos del Paso 1.
- **Mock data:** archivos `src/data/escrituracion/*.ts` (similar a `src/data/cobranza/*.ts`) con tipados y constantes — sin tocar la BD.
- **Diseño:** mismos tokens semánticos (`bg-primary`, `text-muted-foreground`, etc.), badges `StatusBadge` adaptados a `Badge` shadcn con variantes ya existentes.
- **Restricciones de tu workspace:** no ejecutaré DDL ni edge functions. El SQL del Paso 1 te lo entrego para que lo corras tú; el resto es 100% front-end + mock.

## Lo que NO incluye este plan (lo aclaro por transparencia)

- No conecto el portal a tablas reales (`propiedades`, `cuentas_cobranza`, `notarias`, etc.) en esta entrega; lo definimos luego módulo por módulo cuando me digas qué consultas usar.
- No creo `is_escrituracion_*` policies en RLS (no hay tablas nuevas).
- No agrego subdomain branding (`escrituracion.sozu.com`); el portal vive bajo `admin.sozu.com/admin/portal-escrituracion`. Si lo quieres como subdominio, lo agrego en una fase posterior.

¿Arrancamos por el **Paso 1 (SQL de menús + permisos Super Admin)** y luego seguimos con el **Paso 2 (layout + rutas)**, o prefieres que ejecute Pasos 1–3 de corrido en cuanto apruebes?
