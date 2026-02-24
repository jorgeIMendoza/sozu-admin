

## Rediseno del Portal de Agentes e Inmobiliarias con Bottom Tabs

### Objetivo
Reemplazar completamente la experiencia actual de los roles "Agente Inmobiliario" (3) e "Inmobiliaria" (4) con una nueva interfaz mobile-first basada en el mockup de https://sozu-agente-ventas.lovable.app/, incluyendo navegacion inferior con 5 pestanas: Inicio, Inventario, Pipeline, Comisiones y Perfil.

### Paleta de colores del mockup
- **Verde oscuro (CTA principal)**: `#2D5A3D` (botones solidos como "Completar perfil profesional")
- **Dorado/Amber (alertas y badges)**: `#F59E0B` / `#FEF3C7` (badges de oferta, alertas de atencion)
- **Fondo**: `#FAFAFA` (gris muy claro)
- **Tarjetas**: `#FFFFFF` con bordes suaves `border-gray-100`
- **Texto principal**: `#1A1A1A`
- **Texto secundario**: `#6B7280`
- **Verde metrica**: `#0D7C5F` (tarjeta de "Comision pendiente")
- **Borde lateral Pipeline**: Colores por etapa (gris, amarillo, verde, azul, etc.)

---

### Estructura de archivos

#### Archivos nuevos a crear

1. **`src/components/admin/agent-portal/AgentPortalLayout.tsx`**
   - Layout principal con bottom tab navigation
   - 5 iconos: Home, Building, BarChart3, DollarSign, User
   - Indicador visual de tab activo (verde oscuro)
   - Renderiza el contenido de cada tab como sub-rutas

2. **`src/pages/admin/agent-portal/AgentInicio.tsx`**
   - Saludo personalizado ("Buenos dias, [nombre]")
   - Banner de progreso de activacion profesional con barra de porcentaje
   - Seccion "Requieren tu atencion": ofertas aprobadas pendientes de aceptacion del cliente, firma y enganche pendientes
   - Seccion "Acciones clave": botones de "Agendar cita" y "Nuevo prospecto"
   - Seccion "Metricas comerciales": 4 tarjetas (comision pendiente, comision pagada, ventas activas, ventas cerradas)
   - Seccion "Showrooms activos": lista de showrooms con citas del dia
   - Datos reales desde tablas: `ofertas`, `cuentas_cobranza`, `comisionistas`, `configuracion_citas`, `reservas_citas`

3. **`src/pages/admin/agent-portal/AgentInventario.tsx`**
   - Barra de filtros + busqueda en la parte superior
   - Lista de proyectos como tarjetas con imagen hero, nombre, ubicacion, precio desde, unidades disponibles, avance
   - Accion "Ver unidades" que lleva al detalle del proyecto
   - Datos reales desde `proyectos`, `propiedades`, `edificios`, `multimedia`
   - Reutilizara la logica existente de `InventarioGlobal.tsx` adaptando la UI

4. **`src/pages/admin/agent-portal/AgentPipeline.tsx`**
   - Header con conteo total de ofertas y monto en proceso
   - Filtros horizontales scrolleables por etapa (Todas, Prospectos, Pendiente, Ofertas, Apartados, Gen. Contrato, Firma, Cierre)
   - Layout tipo Kanban en columnas (desktop) o stacked cards (mobile)
   - Cada tarjeta de oferta muestra: nombre del cliente, proyecto/unidad, monto, esquema de pago, tiempo en etapa, CTA contextual
   - Boton "+ Nueva oferta" que redirige al inventario
   - Datos reales desde `ofertas`, `cuentas_cobranza`, `prospectos`, `propiedades`

5. **`src/pages/admin/agent-portal/AgentComisiones.tsx`**
   - Estado condicional: si el perfil no esta completo, muestra pantalla de bloqueo con checklist (Identidad, Datos fiscales, Cuenta bancaria)
   - Si el perfil esta completo: tabla/lista de comisiones con estatus (pendiente, aprobada, pagada), montos y detalles de la venta
   - Datos reales desde `comisionistas`, `cuentas_cobranza`, `documentos`

6. **`src/pages/admin/agent-portal/AgentPerfil.tsx`**
   - Header con avatar, nombre, tipo de agente, badge de estado
   - Tarjeta "Nivel de Agente" con indicador visual
   - Barra de progreso "Estado de tu perfil profesional"
   - Alerta si no puede recibir pagos
   - "Centro de Activacion": 4 items clickeables con icono (Identidad/Contrato, Info Fiscal, Cuenta Bancaria, Capacitacion)
   - "Activacion profesional": 4 bloques expandibles con formularios integrados (no dialogs)
     - Bloque 1: INE, datos personales, contrato, firma digital
     - Bloque 2: RFC, regimen fiscal, uso CFDI, constancia
     - Bloque 3: Banco, CLABE, titular
     - Bloque 4: Agendar y completar capacitacion
   - Datos reales desde `personas`, `documentos`, `entidades_relacionadas`, `reservas_citas`

7. **`src/pages/admin/agent-portal/AgentPerfilBloque1.tsx`** - Formulario de Identidad y Contrato
8. **`src/pages/admin/agent-portal/AgentPerfilBloque2.tsx`** - Formulario de Informacion Fiscal
9. **`src/pages/admin/agent-portal/AgentPerfilBloque3.tsx`** - Formulario de Datos Bancarios
10. **`src/pages/admin/agent-portal/AgentPerfilBloque4.tsx`** - Vista de Capacitacion (agendar/ver estado)

#### Archivos existentes a modificar

1. **`src/components/admin/AdminLayout.tsx`**
   - Detectar roles simplificados (3 y 4) y renderizar `AgentPortalLayout` en lugar del layout con sidebar
   - El layout actual con sidebar seguira para roles administrativos

2. **`src/App.tsx`**
   - Agregar nuevas rutas anidadas bajo `/admin` para las 5 pestanas del portal:
     - `/admin/agent/inicio`
     - `/admin/agent/inventario`
     - `/admin/agent/pipeline`
     - `/admin/agent/comisiones`
     - `/admin/agent/perfil`
     - `/admin/agent/perfil/bloque/:id`
   - Redireccion automatica: cuando un usuario con rol 3 o 4 accede a `/admin`, redirigir a `/admin/agent/inicio`

3. **`src/index.css`**
   - Agregar variables CSS del portal de agentes dentro de `.agent-portal`:
     - `--agent-primary: #2D5A3D`
     - `--agent-amber: #F59E0B`
     - `--agent-bg: #FAFAFA`
     - Estilos de tarjetas, badges y bottom navigation

4. **`src/components/auth/PermissionRoute.tsx`**
   - Asegurar que las nuevas rutas `/admin/agent/*` esten permitidas para roles 3 y 4

---

### Detalle tecnico por pestana

#### 1. Inicio (AgentInicio)

Consultas a la base de datos:
- Perfil del agente: `personas` + `usuarios` + `entidades_relacionadas`
- Ofertas pendientes de atencion: `ofertas` filtradas por `email_creador` del agente, con join a `propiedades`, `proyectos`
- Metricas: `comisionistas` filtrado por email del agente, sumando montos por estatus
- Showrooms activos: `configuracion_citas` con join a `proyectos`

#### 2. Inventario (AgentInventario)

- Reutiliza datos del `useInventarioDisponiblePaginado` existente
- La UI cambia de la vista actual de propiedad individual a una vista agrupada por proyecto
- Cada tarjeta de proyecto muestra imagen de portada, nombre, ubicacion, precio minimo, conteo disponible

#### 3. Pipeline (AgentPipeline)

Mapeo de etapas del mockup a la tabla `ofertas`:
- **Prospectos Activos**: Ofertas con `id_estatus_oferta` en etapa inicial
- **Pendiente Aprobacion**: Ofertas enviadas sin aprobar
- **Ofertas Aprobadas**: Ofertas aprobadas pendientes de aceptacion
- **Apartados**: Ofertas con apartado pagado
- **Gen. Contrato**: En proceso legal
- **Firma y Enganche**: Contrato firmado, enganche pendiente
- **Cierre de Venta**: Venta completada

Cada tarjeta incluye:
- Nombre del prospecto/comprador
- Proyecto + unidad
- Monto y esquema de pago
- Dias en la etapa actual
- CTA contextual (Enviar oferta, Dar seguimiento, Ver estatus, etc.)

#### 4. Comisiones (AgentComisiones)

- Estado de bloqueo si falta completar perfil (3 checks: identidad, fiscal, bancarios)
- Vista de comisiones con datos reales de `comisionistas` + `cuentas_cobranza`

#### 5. Perfil (AgentPerfil)

- Formularios inline en lugar de dialogs modales
- Cada bloque sera un componente independiente que se expande/colapsa o navega a sub-ruta
- Progreso calculado segun campos completados en `personas` y `documentos`

---

### Navegacion inferior (Bottom Tab Bar)

```text
+--------+--------+--------+--------+--------+
| Inicio | Invent | Pipeli | Comis  | Perfil |
|  (home)|  (bldg)| (chart)| (dollar)| (user)|
+--------+--------+--------+--------+--------+
```

- Fija en la parte inferior de la pantalla
- Tab activo: icono y texto en verde oscuro (#2D5A3D)
- Tab inactivo: gris (#9CA3AF)
- Fondo: blanco con sombra superior sutil
- Altura: 64px en mobile, puede ocultarse en desktop si se usa sidebar

---

### Orden de implementacion sugerido

1. AgentPortalLayout (layout + bottom tabs + rutas)
2. AgentPerfil (perfil con bloques de activacion)
3. AgentInicio (dashboard personalizado)
4. AgentInventario (lista de proyectos)
5. AgentPipeline (pipeline de ofertas)
6. AgentComisiones (estado y lista de comisiones)

Cada paso se puede probar independientemente. Se recomienda implementar en multiples iteraciones (1-2 pestanas por iteracion) para mantener los cambios manejables.

