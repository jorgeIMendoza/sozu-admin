export type NotificationChannel = "email" | "whatsapp";

export type NotificationTemplateId =
  | "confirmation"
  | "reminder_day_5"
  | "reminder_day_10"
  | "reminder_day_14";

export interface NotificationTemplate {
  id: NotificationTemplateId;
  label: string;
  scheduledOffsetMinutes: number;
  channels: NotificationChannel[];
  email: {
    subject: string;
    preheader?: string;
    body: string;
    ctaLabel: string;
    ctaPath: string;
  };
  whatsapp: {
    body: string;
    quickReplies?: string[];
  };
}

// ── Variables disponibles ──
// {{firstName}} {{propertyLabel}} {{amountMXN}} {{daysRemaining}}
// {{validUntilDate}} {{agentFirstName}} {{agentFullName}} {{agentPhone}}
// {{reservationId}} {{offerId}}

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: "confirmation",
    label: "Confirmación inicial",
    scheduledOffsetMinutes: 2,
    channels: ["email", "whatsapp"],
    email: {
      subject: "Tu pre-apartado de {{propertyLabel}} está confirmado ✓",
      preheader: "Folio {{reservationId}} · Retención de \${{amountMXN}} MXN registrada",
      body: `Hola {{firstName}},

¡Bienvenido! Tu pre-apartado quedó registrado exitosamente. Aquí están los detalles:

**Lo que apartaste**
{{propertyLabel}}

**Folio**
{{reservationId}}

**Monto retenido**
\${{amountMXN}} MXN (100% reembolsable)

**Vigencia**
Hasta {{validUntilDate}}

**Lo que sigue**
{{agentFirstName}} te contactará por WhatsApp dentro de las próximas 24 horas para acompañarte. Si tienes cualquier duda antes, puedes escribirle directamente.

Recuerda que puedes cancelar y recibir tu reembolso completo en cualquier momento durante los 15 días.

Cualquier cosa, aquí estamos.`,
      ctaLabel: "Ver mi pre-apartado",
      ctaPath: "/mi-pre-apartado/{{reservationId}}",
    },
    whatsapp: {
      body: `Hola {{firstName}} 👋

Soy {{agentFirstName}} de SOZU. Tu pre-apartado de {{propertyLabel}} quedó confirmado.

📋 Folio: {{reservationId}}
💳 Retención: \${{amountMXN}} MXN
📅 Vigencia: {{validUntilDate}}

Te llamo en las próximas 24 horas para conocernos. Mientras tanto, puedes ver el detalle en tu panel.`,
      quickReplies: ["Ver mi panel", "Tengo una duda", "¿Puedes llamar después?"],
    },
  },

  {
    id: "reminder_day_5",
    label: "Recordatorio día 5",
    scheduledOffsetMinutes: 5 * 24 * 60,
    channels: ["email", "whatsapp"],
    email: {
      subject: "{{firstName}}, ¿cómo va tu decisión sobre {{propertyLabel}}?",
      preheader: "Quedan {{daysRemaining}} días · {{agentFirstName}} responde rápido",
      body: `Hola {{firstName}},

Han pasado 5 días desde que pre-apartaste {{propertyLabel}}. Te quedan {{daysRemaining}} días para decidir, sin presión de ningún tipo.

¿Tienes alguna duda que podamos ayudar a resolver? Es completamente normal tener preguntas en este momento. Algunas cosas que a otros pre-clientes les ha ayudado a decidir:

- Conocer en persona el avance de obra (podemos coordinar visita)
- Revisar los 7 esquemas de financiamiento con más detalle
- Hablar con quien decida contigo (pareja, asesor financiero)

{{agentFirstName}} sigue disponible y responde en menos de 30 minutos por WhatsApp. No estás solo en esta decisión.`,
      ctaLabel: "Conversar con {{agentFirstName}}",
      ctaPath: "/mi-pre-apartado/{{reservationId}}",
    },
    whatsapp: {
      body: `Hola {{firstName}} 👋

{{agentFirstName}} aquí. Vi que llevas 5 días con tu pre-apartado de {{propertyLabel}}. Solo paso a saludarte.

¿Hay alguna duda con la que te pueda ayudar? Sin compromiso — solo estoy aquí.

Te quedan {{daysRemaining}} días.`,
      quickReplies: ["Tengo una duda", "Quiero visitar la obra", "Todo bien por ahora"],
    },
  },

  {
    id: "reminder_day_10",
    label: "Recordatorio día 10",
    scheduledOffsetMinutes: 10 * 24 * 60,
    channels: ["email", "whatsapp"],
    email: {
      subject: "Quedan 5 días en tu pre-apartado de {{propertyLabel}}",
      preheader: "Tu agente {{agentFirstName}} sigue disponible para acompañarte",
      body: `Hola {{firstName}},

Solo quedan 5 días en tu pre-apartado de {{propertyLabel}}. Es un buen momento para revisar dónde estás:

**Si quieres avanzar al apartado formal**
Tus \${{amountMXN}} retenidos se aplican directamente al enganche. {{agentFirstName}} te guía con los documentos (INE, comprobante de domicilio, RFC) y la firma del contrato preliminar.

**Si necesitas más tiempo**
Conversemos. A veces hay opciones que no consideraste — un esquema de pago distinto, una visita guiada, hablar con quien decide contigo.

**Si decidiste no continuar**
Está bien. Puedes cancelar desde tu panel cuando quieras y procesamos el reembolso completo en 3-5 días hábiles.

No hay decisión incorrecta. Solo nos interesa que sea la decisión correcta **para ti**.`,
      ctaLabel: "Conversar con {{agentFirstName}}",
      ctaPath: "/mi-pre-apartado/{{reservationId}}",
    },
    whatsapp: {
      body: `{{firstName}}, recordatorio amistoso:

Te quedan 5 días en tu pre-apartado de {{propertyLabel}}. ¿Cómo estás con la decisión?

Sin presión — solo para que lo tengas presente. Estoy aquí para lo que necesites.

– {{agentFirstName}}`,
      quickReplies: ["Quiero avanzar", "Necesito más info", "Voy a cancelar"],
    },
  },

  {
    id: "reminder_day_14",
    label: "Recordatorio día 14",
    scheduledOffsetMinutes: 14 * 24 * 60,
    channels: ["email", "whatsapp"],
    email: {
      subject: "Mañana vence tu pre-apartado — ¿avanzamos o cerramos?",
      preheader: "Último aviso · Decisión flexible hasta el último minuto",
      body: `Hola {{firstName}},

Mañana vence tu pre-apartado de {{propertyLabel}}. Quería avisarte para que no se pase desapercibido.

**Si decidiste avanzar**
Excelente decisión. {{agentFirstName}} te llama hoy mismo si me confirmas. Tus \${{amountMXN}} se aplican al enganche y firmamos contrato preliminar.

**Si necesitas más tiempo**
Comentémoslo. Hay casos donde podemos extender 5 días adicionales si hay una razón concreta (esperando un documento, viaje de pareja, etc.).

**Si decidiste no continuar**
Está perfecto. Puedes cancelar desde tu panel y el reembolso de \${{amountMXN}} llega a tu tarjeta en 3-5 días hábiles. Sin penalización.

Lo importante es que tomes la decisión con calma. Conversemos hoy si puedes.`,
      ctaLabel: "Ver mi pre-apartado",
      ctaPath: "/mi-pre-apartado/{{reservationId}}",
    },
    whatsapp: {
      body: `{{firstName}}, recordatorio importante:

Tu pre-apartado de {{propertyLabel}} vence MAÑANA. Te llamo hoy si puedes para conversar antes.

3 opciones:
✅ Avanzar al apartado formal
⏸️ Pedir extensión (5 días más)
❌ Cancelar y recibir reembolso

¿Qué te queda mejor?

– {{agentFirstName}}`,
      quickReplies: ["Avanzar", "Pedir extensión", "Cancelar", "Llámame"],
    },
  },
];

// ── Helpers ──

export function getTemplateById(id: NotificationTemplateId): NotificationTemplate | undefined {
  return NOTIFICATION_TEMPLATES.find((t) => t.id === id);
}

export interface TemplateContext {
  firstName: string;
  propertyLabel: string;
  amountMXN: string;
  daysRemaining: number;
  validUntilDate: string;
  agentFirstName: string;
  agentFullName: string;
  agentPhone: string;
  reservationId: string;
  offerId: string;
}

/**
 * Reemplaza variables {{var}} en un string con valores del contexto.
 * Si una variable no existe en el contexto, queda como `{{var}}` literal
 * para detectar errores de configuración.
 */
export function renderTemplate(template: string, ctx: TemplateContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = (ctx as any)[key];
    return value !== undefined && value !== null ? String(value) : `{{${key}}}`;
  });
}
