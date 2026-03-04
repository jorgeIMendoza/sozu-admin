

## Diagnóstico

El botón "Eliminar" está habilitado porque el frontend verifica invitados buscando en la tabla `reservas_citas` con `estatus = "programada"` y `activo = true`. Sin embargo, los "2 invitados" que ves en el evento del 5 de marzo son **attendees del evento de Google Calendar** (correos de enterados/CC agregados al crear el evento), no reservas en la base de datos. La única reserva que existía para config 14 el 5 de marzo ya está `cancelada` y `activo = false`, por lo que el query no encuentra nada y el botón queda habilitado.

**En resumen**: la validación actual mira la fuente equivocada. Debe consultar los attendees reales del evento en Google Calendar.

---

## Plan de corrección

### 1. Nueva acción en la Edge Function `agendar-capacitacion`

Agregar una acción `check-config-future-attendees` que:
- Consulte `citas_calendar_events` para obtener eventos futuros activos de la configuración
- Para cada evento futuro, consulte la API de Google Calendar para obtener los attendees
- Filtre el email de la service account (`cuenta-conexiones-drive@sozu-38755.iam.gserviceaccount.com`)
- Retorne `{ has_attendees: true/false, events_with_attendees: [...] }`

### 2. Cambiar la validación en el frontend (`ConfiguracionCitas.tsx`)

- Reemplazar el `useQuery` actual que consulta `reservas_citas` por una llamada a `supabase.functions.invoke("agendar-capacitacion", { body: { action: "check-config-future-attendees", config_id, calendar_owner_email } })`
- Usar el resultado `has_attendees` para habilitar/deshabilitar el botón de eliminar
- Ajustar el mensaje del disclaimer para mostrar cuántos eventos tienen attendees

### 3. Ajustar la acción `delete-config-events` en la Edge Function

Antes de eliminar cada evento futuro de Google Calendar, verificar si tiene attendees (excluyendo la service account). Si los tiene, **saltar** ese evento y no eliminarlo. Esto agrega una capa de seguridad server-side adicional.

---

### Detalles técnicos

**Edge Function - nueva acción** (`check-config-future-attendees`):
```text
Input:  { action: "check-config-future-attendees", config_id, calendar_owner_email }
Output: { has_attendees: boolean, total_future_events: number, events_with_attendees: number }

Lógica:
1. Query citas_calendar_events WHERE config_id AND activo AND fecha >= today
2. Para cada evento, GET Google Calendar event by google_event_id
3. Contar attendees excluyendo la service account
4. Si algún evento tiene >= 1 attendee → has_attendees = true
```

**Frontend - cambio en query**:
- El `useQuery` con key `config-future-reservations` pasará a invocar la edge function
- Se mantiene `enabled: !!deleteConfigTarget?.id`
- El resultado alimenta `hasFutureReservations` (renombrado a `hasFutureAttendees`)

