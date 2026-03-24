

## Problema

Al agendar una cita de capacitación grupal (ej. "Capacitacion de Daiku Keity", sábado 28 marzo 9am), el backend rechaza con "no_disponible" aunque el frontend muestra el slot como disponible.

**Causa raíz**: La función `checkAvailability` en el edge function `agendar-capacitacion` consulta Google Calendar buscando eventos personales del dueño del calendario. Si encuentra cualquier evento (incluso los creados por el service account para las sesiones recurrentes), bloquea la reserva. Esto es correcto para citas 1:1 pero incorrecto para capacitaciones grupales donde la disponibilidad se gestiona por configuración de slots + conteo de reservas en BD.

## Plan

### 1. Modificar `checkAvailability` en el edge function

**Archivo**: `supabase/functions/agendar-capacitacion/index.ts`

- Agregar parámetro `maxInvitados` a la función `checkAvailability`
- Cuando `maxInvitados > 1` (sesión grupal): después de validar el slot en BD, retornar `true` sin hacer la verificación de Google Calendar
- Para citas 1:1 (`maxInvitados <= 1`): mantener el comportamiento actual con verificación de GCal

### 2. Actualizar la llamada a `checkAvailability`

En el handler principal (~línea 1533), pasar `scheduleMaxInvitados` como nuevo argumento para que la función sepa si debe omitir la verificación de GCal.

### 3. Desplegar el edge function actualizado

---

**Resultado esperado**: Las capacitaciones grupales se podrán agendar correctamente basándose solo en la configuración de horarios y el conteo de reservas existentes, sin ser bloqueadas por eventos en Google Calendar.

