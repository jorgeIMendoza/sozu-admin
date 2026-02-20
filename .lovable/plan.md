

## Fix: "Invalid conference type value" en agendar-capacitacion

### Problema
La API de Google Calendar rechaza el campo `conferenceData` con `conferenceSolutionKey: { type: "hangoutsMeet" }` porque la cuenta de servicio no tiene permisos para crear conferencias de Google Meet en ese calendario.

### Solucion
Eliminar el bloque `conferenceData` del evento y el parametro `conferenceDataVersion=1` de la URL de la API. El evento se creara sin enlace de Meet.

### Cambios en `supabase/functions/agendar-capacitacion/index.ts`

1. En la funcion `createCalendarEvent`, remover del objeto `event`:
   - `conferenceData` (lineas ~101-107)

2. En la URL del fetch, remover `?conferenceDataVersion=1`:
   - Cambiar a `.../events` sin query params

3. Ajustar la respuesta final para que `meetLink` sea `null` ya que no se generara enlace de Meet automaticamente.

### Resultado
El evento se creara correctamente en el calendario sin enlace de Meet. Si en el futuro se configura Domain-Wide Delegation, se podra reactivar la creacion de Meet.

