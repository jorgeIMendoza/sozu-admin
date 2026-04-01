
Objetivo: corregir el flujo de agendar cita con prospecto para que realmente se envíe la invitación/correo al prospecto y a los destinatarios esperados, sin mostrar “cita generada” cuando Google no mandó nada.

Hallazgo principal
- El problema no parece ser de mobile ni del video; es del flujo backend.
- Hoy `AgendarCitaShowroomDialog.tsx` reutiliza la Edge Function `agendar-capacitacion`, pero:
  1. no le manda `tipo_cita_id` del showroom;
  2. la función nunca agrega el correo del prospecto a `bookingAttendees`;
  3. la función solo intenta invitar al agente y a `correos_enterado`;
  4. si Google rechaza attendees, la función reintenta sin attendees y aun así responde éxito.
- Resultado: la cita sí se guarda, pero el prospecto no queda como invitado del evento y no recibe correo. En ciertos casos, tampoco lo recibe nadie más.

Plan de corrección
1. Corregir el origen del tipo de cita en mobile/portal de agente
- Actualizar `src/components/admin/AgendarCitaShowroomDialog.tsx` para incluir `id_tipo_cita` del config seleccionado.
- Así la Edge Function dejará de tratar citas de showroom como si fueran capacitación.

2. Corregir la resolución de destinatarios dentro de `agendar-capacitacion`
- Ajustar `supabase/functions/agendar-capacitacion/index.ts` para distinguir explícitamente:
  - capacitación/agente;
  - cita con prospecto/showroom.
- Para showroom:
  - obtener el email real del prospecto;
  - agregarlo como attendee principal del evento;
  - mantener agente y `correos_enterado` como invitados adicionales si aplica.
- Corregir también el nombre/descripción del evento, porque hoy mezcla nombre del prospecto con correo del agente.

3. Corregir persistencia de la cita
- Guardar `id_tipo_cita` correcto al insertar/actualizar `reservas_citas`.
- Alinear la lógica de “reagendar cita existente” para que busque por el tipo correcto y no genere inconsistencias.

4. Quitar el falso positivo de “éxito”
- Endurecer el manejo de errores cuando Google no acepta attendees.
- En vez de “crear la cita igual y callar”, devolver un error o warning explícito cuando el evento se creó sin invitados.
- Agregar logs claros con:
  - attendees calculados;
  - respuesta de Google;
  - si el evento quedó sin invitados.

5. Validar efectos colaterales
- Verificar que el flujo de capacitación (tipo 1) siga funcionando como hoy.
- Confirmar que `TodasLasCitas.tsx` pueda seguir leyendo RSVP del invitado correcto, ahora sí usando el prospecto como attendee real.

Verificación que haré al implementar
- Crear una cita showroom desde el portal de agente.
- Confirmar que:
  - la cita se guarda en `reservas_citas`;
  - el `id_tipo_cita` queda correcto;
  - el evento en Google Calendar incluye al prospecto;
  - el prospecto recibe la invitación/correo;
  - agente/enterados reciben correo cuando corresponda;
  - ya no aparezca “éxito” si Google no pudo invitar a nadie.

Detalles técnicos
- Archivos principales:
  - `src/components/admin/AgendarCitaShowroomDialog.tsx`
  - `supabase/functions/agendar-capacitacion/index.ts`
- No encontré un envío separado por Postmark al crear la cita; actualmente el “correo” depende del alta de attendees en Google Calendar. Por eso, si el prospecto no entra como attendee, no sale ningún correo.
- También detecté un bug relacionado: la cita de showroom puede estarse guardando con tipo incorrecto, lo que puede afectar reprogramaciones y seguimiento posterior.
