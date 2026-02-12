

## Plan: Crear Menu CRM con Workflow de Ofertas y Dashboard Ejecutivo

### Resumen

Se creara un nuevo menu "CRM" con dos submenus:
1. **Workflow de Ofertas** - Vista tipo tablero Kanban (solo visual, sin drag-and-drop) con 10 columnas que muestran el pipeline de ofertas desde su generacion hasta el cierre de venta.
2. **Dashboard Ejecutivo** - Vista con resumenes estadisticos por inmobiliaria, agente y proyecto.

Ambas vistas respetan restricciones de visibilidad por rol (Agente solo ve sus ofertas, Inmobiliaria ve las de sus agentes, Super Admin ve todo).

---

### Parte 1: Datos en Base de Datos (Migracion SQL)

Se ejecutara una sola migracion que:

1. **Crea el menu "CRM"** en la tabla `menus` con orden 15 (despues de Comunicacion)
2. **Crea 2 submenus**:
   - "Workflow de Ofertas" con ruta `/admin/crm/workflow-ofertas` (orden 1)
   - "Dashboard Ejecutivo" con ruta `/admin/crm/dashboard-ejecutivo` (orden 2)
3. **Asigna permisos al Super Admin (rol_id=1)**:
   - Workflow: permisos Leer (1) y Actualizar (3)
   - Dashboard: solo permiso Leer (1)
4. **Configura permisos disponibles** en `submenus_permisos_disponibles`:
   - Workflow: solo Leer y Actualizar activos
   - Dashboard: solo Leer activo

---

### Parte 2: Rutas y Navegacion

**Archivos a modificar:**

- `src/utils/validRoutes.ts` - Agregar las 2 nuevas rutas
- `src/App.tsx` - Agregar las 2 rutas con lazy loading
- `src/hooks/useDynamicMenus.ts` - Agregar iconos para las nuevas rutas y el menu CRM (menu_id=15)

---

### Parte 3: Pagina Workflow de Ofertas

**Archivo nuevo: `src/pages/admin/crm/WorkflowOfertas.tsx`**

Vista tipo tablero con columnas horizontales scrolleables. Cada columna es un "stage" del pipeline.

**Logica de filtrado por rol:**
- **Super Admin**: ve todo. Filtros: Inmobiliaria (select), Agentes de esa inmobiliaria (multiselect), Proyecto (multiselect)
- **Inmobiliaria (rol 4)**: ve ofertas de sus agentes. Filtros: Agente (multiselect de sus agentes), Proyecto (multiselect de proyectos con acceso; read-only si solo tiene 1)
- **Agente Inmobiliario/Interno (rol 3/9)**: solo ve ofertas donde `email_creador` = su email. Filtro de proyecto (multiselect de proyectos con acceso)

**Las 10 columnas del tablero:**

| Columna | Condicion SQL (todas con fecha_generacion >= 2026-01-01 y activo=true) |
|---|---|
| Expiradas (oculta por default) | Vigencia expirada (fecha_generacion + 5 dias < hoy) |
| Nuevas Ofertas | id_esquema_pago_seleccionado IS NULL y vigente |
| Pendientes de Aprobacion | id_esquema_pago_seleccionado IS NOT NULL, vigente, id_estatus_aprobacion=1 |
| Aprobadas | id_esquema_pago_seleccionado IS NOT NULL, vigente, id_estatus_aprobacion=2 |
| Rechazadas | id_esquema_pago_seleccionado IS NOT NULL, vigente, id_estatus_aprobacion=3 (mostrar comentario_justificacion) |
| En Revision | id_esquema_pago_seleccionado IS NOT NULL, vigente, id_estatus_aprobacion=4 (mostrar comentario_justificacion) |
| Apartado | Tiene cuenta_cobranza activa y propiedad estatus_disponibilidad=4 |
| Generacion de Contrato | cuenta_cobranza.contrato_draft IS NOT NULL |
| Firma de Contrato | cuenta_cobranza tiene documento tipo 42 (Contrato firmado por cliente) activo |
| Cierre de Venta | Propiedad con estatus_disponibilidad=5 (Vendido) |

**Cards de ofertas:**
Cada card mostrara: nombre de propiedad, prospecto (id_persona_lead), agente (email_creador), precio, fecha de generacion.

**Detalle al hacer click en una card (Dialog/Sheet):**
- Datos de la propiedad (nombre, proyecto, precio, estatus)
- Datos del prospecto (nombre del lead)
- Datos del agente (nombre, si es interno o externo)
- Resumen del deal (esquema seleccionado, precio)
- Checklist de lo que falta para avanzar a la siguiente etapa:
  - Nuevas Ofertas: para es_manual=true -> aprobar oferta; para es_manual=false -> seleccionar esquema de pago
  - Pendientes: aprobar la oferta
  - Aprobadas: pagar el apartado
  - Apartado: documentos de compradores verificados + iniciar generacion de contrato
  - Generacion de contrato: subir contrato firmado por cliente
  - Firma de contrato: subir contrato firmado completamente + pagar enganche

**Cadena de datos para obtener proyecto de una propiedad:**
propiedad -> id_edificio_modelo -> edificios_modelos -> edificio -> id_proyecto -> proyecto

**Cadena para obtener inmobiliaria de un email_creador:**
email_creador -> usuarios (email) -> id_persona -> entidades_relacionadas (tipo=19 Agente) -> id_persona_duena_lead = inmobiliaria persona id

---

### Parte 4: Pagina Dashboard Ejecutivo

**Archivo nuevo: `src/pages/admin/crm/DashboardEjecutivo.tsx`**

Misma logica de filtrado por rol que el Workflow.

**Contenido:**
- Tarjetas resumen con cantidad de ofertas por etapa
- Tabla/grafico de ofertas por inmobiliaria (cantidad y quien tiene mas)
- Valor potencial en dinero: suma de precios de ofertas que ya tienen esquema de pago seleccionado (tomando el mayor precio por propiedad si tiene multiples ofertas)
- Desglose por agente
- Desglose por proyecto
- Ventas cerradas por inmobiliaria: propiedades con estatus Vendido (id=5), cantidad y monto total
- Se usara la libreria `recharts` (ya instalada) para graficos de barras y pie charts

---

### Parte 5: Detalle Tecnico - Archivos

| Accion | Archivo |
|---|---|
| Migracion | SQL: crear menu, submenus, permisos Super Admin, permisos disponibles |
| Modificar | `src/utils/validRoutes.ts` - 2 rutas nuevas |
| Modificar | `src/App.tsx` - 2 lazy imports + 2 Route |
| Modificar | `src/hooks/useDynamicMenus.ts` - iconos para rutas y menu_id 15 |
| Crear | `src/pages/admin/crm/WorkflowOfertas.tsx` |
| Crear | `src/pages/admin/crm/DashboardEjecutivo.tsx` |

**Total: 4 archivos modificados, 2 archivos nuevos, 1 migracion SQL**

