

# Plan: Múltiples citas de capacitación por agente (por proyecto)

## Problema actual
El sistema trata la capacitación como un evento único: busca **una sola cita** (la más reciente) y la usa como indicador binario de completitud. Un agente asignado a múltiples proyectos no puede tener citas de capacitación independientes por proyecto.

## Cambios propuestos

### 1. Modificar la consulta de citas existentes en el step de capacitación
**Archivo**: `src/components/admin/AgentOnboardingStepDialog.tsx` (~línea 1496)

- Cambiar la query `agent-training-cita` para traer **todas** las citas activas del agente (no solo una), agrupadas por `id_configuracion_cita` (que se asocia a un proyecto vía `configuracion_citas_proyectos`).
- Mostrar las citas como una **lista por configuración/proyecto**, donde cada una puede tener su propio estado (agendada, completada, etc.).
- Permitir agendar una nueva cita aunque ya exista otra completada, siempre que sea para una configuración/proyecto diferente.
- Mantener el comportamiento actual de desactivar la cita anterior **solo dentro del mismo config** al reagendar.

### 2. Actualizar la lógica de completitud del onboarding
**Archivo**: `src/hooks/useAgentOnboardingStatus.ts` (~línea 90-113)

- Cambiar la query para traer todas las citas activas (no solo 5).
- `trainingComplete` = verdadero si **al menos una** cita tiene estatus confirmada/asistió (mantener comportamiento actual — una capacitación basta para desbloquear ofertas).
- `trainingPartial` = verdadero si hay al menos una cita programada pero ninguna confirmada.

### 3. Rediseñar la UI del step de capacitación (AgentTrainingStep)
**Archivo**: `src/components/admin/AgentOnboardingStepDialog.tsx` (~línea 1916+)

- Mostrar un listado de capacitaciones existentes (fecha, proyecto/config, estado) con badges.
- Debajo del listado, mantener el formulario de agendar nueva cita (calendario + slots), que ahora permite agendar otra cita sin desactivar las ya confirmadas.
- Si ya existe una cita **programada** para la misma configuración, preseleccionarla como antes.

### 4. Actualizar la celda de capacitación en tabla de Agentes (admin)
**Archivo**: `src/pages/admin/Agentes.tsx` (AgentTrainingCell, línea 51-170)

- Cambiar la query para traer **todas** las citas activas del agente.
- Mostrar un resumen compacto: ej. "2/3 completadas" o badges apilados.
- Mantener los botones de "Asistió" / "No asistió" para cada cita pendiente.

### 5. Historial de citas por proyecto (vista admin)
**Archivo**: Nuevo componente o sección dentro del dialog de onboarding/agentes.

- Al hacer clic en la celda de capacitación de un agente, abrir un dialog/panel que muestre el historial completo de citas de ese agente, filtrable por proyecto.
- Incluir: fecha, hora, proyecto/config, estado, fecha de confirmación.
- Datos ya disponibles en `reservas_citas` + `configuracion_citas_usuarios` + `configuracion_citas_proyectos`.

## Detalle técnico

No se requieren cambios de base de datos. La relación cita → proyecto ya existe:
```text
reservas_citas.id_configuracion_cita → configuracion_citas_usuarios.id
configuracion_citas_proyectos (id_configuracion_cita, id_proyecto)
```

La lógica de desactivación al reagendar se limita al mismo `id_configuracion_cita`, no a todas las citas del agente.

