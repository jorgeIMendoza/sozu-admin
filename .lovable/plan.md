

## Plan: Solo mostrar "Enterados" cuando hay asistentes con reserva

### Problema
La función `buildDescriptionWithAttendees` (línea 722-743 de `agendar-capacitacion/index.ts`) siempre agrega la sección "Enterados: email1, email2" a la descripción del evento de Google Calendar, incluso cuando el slot no tiene ninguna reserva. Esto causa que al guardar la configuración de citas, todos los eventos muestren "Enterados" aunque nadie haya agendado aún.

### Cambio requerido

**Archivo**: `supabase/functions/agendar-capacitacion/index.ts` (~líneas 722-743)

Mover la lógica de "Enterados" dentro del bloque que verifica si hay asistentes reales:

```typescript
const buildDescriptionWithAttendees = (baseDesc: string, _allAttendees: {email: string}[], fecha?: string, hora?: number) => {
  const parts: string[] = [];
  if (baseDesc) parts.push(baseDesc);

  // Solo agregar Enterados y Asistentes cuando hay reservas reales en el slot
  if (fecha !== undefined && hora !== undefined) {
    const slotKey = `${fecha}_${hora}`;
    const resAttendees = reservationAttendeesBySlot.get(slotKey) || [];
    if (resAttendees.length > 0) {
      const ccEmails = ccAttendees.map(a => a.email);
      if (ccEmails.length > 0) {
        parts.push(`Enterados: ${ccEmails.join(", ")}`);
      }
      parts.push(`Asistentes: ${resAttendees.map(a => a.email).join(", ")}`);
    }
  }

  return parts.join("\n\n");
};
```

Después del cambio, redesplegar la edge function `agendar-capacitacion`.

