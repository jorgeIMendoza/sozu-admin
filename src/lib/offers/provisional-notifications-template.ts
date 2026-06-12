import type { ProvisionalNotification, NotificationChannel } from "./formal-reservation-data";

interface NotificationTemplate {
  day: 0 | 2 | 3 | 4 | 5;
  channel: NotificationChannel;
  subject: string;
  body: string;
}

// SWAP POINT: en producción el copy vive en CMS / i18n.
const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    day: 0,
    channel: "email",
    subject: "Tu apartado provisional está activo · 5 días para decidir",
    body: "Hola {{clientName}},<br/><br/>Activaste tu apartado provisional de <strong>{{developmentName}} · {{propertyLabel}}</strong>. Retuvimos <strong>$10,000 MXN</strong> en tu tarjeta terminada en <strong>****{{cardLast4}}</strong> por 5 días naturales. No es un cobro.<br/><br/>Tienes hasta <strong>{{expiresAtFormatted}}</strong> para revisar el contrato preliminar y completar tu apartado con la transferencia SPEI de $20,000 MXN.<br/><br/>Entra a tu dashboard cuando quieras: el contrato te espera con calma.",
  },
  {
    day: 0,
    channel: "whatsapp",
    subject: "Hola {{clientName}} 👋",
    body: "Tu apartado provisional de *{{developmentName}} · {{propertyLabel}}* está activo. Tienes hasta *{{expiresAtShort}}* para revisar el contrato y completar tu pago SPEI de $20,000 MXN. La retención de $10,000 en tu tarjeta termina en *{{cardLast4}}* — recuerda que no es un cobro. Cualquier duda, aquí estoy.",
  },
  {
    day: 2,
    channel: "email",
    subject: "Recordatorio: tu apartado provisional vence en 3 días",
    body: "Hola {{clientName}},<br/><br/>Van 2 días desde que activaste tu apartado provisional de <strong>{{developmentName}} · {{propertyLabel}}</strong>. Te quedan <strong>3 días</strong> para completar tu pago.<br/><br/>Si ya revisaste el contrato preliminar y tienes claro el plan, puedes completar tu apartado entrando a tu dashboard. Si todavía tienes preguntas, contacta a tu asesor antes del vencimiento.",
  },
  {
    day: 2,
    channel: "whatsapp",
    subject: "{{clientName}}, tu apartado tiene 3 días más",
    body: "Quería recordarte que tu apartado de *{{developmentName}} · {{propertyLabel}}* vence en 3 días. ¿Pudiste revisar el contrato? Si tienes dudas sobre alguna cláusula, mándame mensaje y lo platicamos.",
  },
  {
    day: 3,
    channel: "email",
    subject: "Quedan 2 días para completar tu apartado",
    body: "Hola {{clientName}},<br/><br/>Tu apartado provisional de <strong>{{developmentName}} · {{propertyLabel}}</strong> vence en <strong>2 días</strong>, el <strong>{{expiresAtFormatted}}</strong>.<br/><br/>Si decides avanzar, entra a tu dashboard y completa tu pago SPEI de $20,000 MXN. Al detectar tu pago, la retención de $10,000 en tu tarjeta se libera automáticamente.<br/><br/>Si decides no avanzar, simplemente deja que el plazo expire — no habrá cargo y la retención se libera sola.",
  },
  {
    day: 3,
    channel: "whatsapp",
    subject: "Quedan 2 días",
    body: "{{clientName}}, tu apartado de *{{developmentName}} · {{propertyLabel}}* vence en 2 días. Si necesitas que platiquemos antes de tomar la decisión, dime cuándo te marco.",
  },
  {
    day: 4,
    channel: "email",
    subject: "Importante: tu apartado vence mañana",
    body: "Hola {{clientName}},<br/><br/>Tu apartado provisional de <strong>{{developmentName}} · {{propertyLabel}}</strong> vence <strong>mañana</strong>, el <strong>{{expiresAtFormatted}}</strong>.<br/><br/>Si quieres completar tu apartado, este es el momento. Entra a tu dashboard y haz la transferencia SPEI antes de que el plazo expire.<br/><br/>Si tienes dudas que aún no se resuelven, contacta a tu asesor ahora — todavía hay tiempo para resolverlas.",
  },
  {
    day: 4,
    channel: "whatsapp",
    subject: "Vence mañana ⏰",
    body: "{{clientName}}, mañana vence tu apartado de *{{developmentName}} · {{propertyLabel}}*. Si quieres completarlo, hoy es el día ideal para revisar dudas finales y mañana hacer la transferencia. Estoy disponible.",
  },
  {
    day: 5,
    channel: "email",
    subject: "Tu apartado vence hoy a las {{expiresAtTime}}",
    body: "Hola {{clientName}},<br/><br/>Tu apartado provisional de <strong>{{developmentName}} · {{propertyLabel}}</strong> vence <strong>hoy a las {{expiresAtTime}}</strong>.<br/><br/>Si quieres completarlo, entra a tu dashboard y haz la transferencia SPEI antes de esa hora. Después del vencimiento, la unidad quedará disponible para otros clientes y la retención de $10,000 en tu tarjeta se liberará automáticamente.",
  },
  {
    day: 5,
    channel: "whatsapp",
    subject: "Último día",
    body: "{{clientName}}, hoy a las *{{expiresAtTime}}* vence tu apartado de *{{developmentName}} · {{propertyLabel}}*. Si quieres avanzar, este es el momento. Si decides no continuar, todo bien — la retención se libera sola sin cargo.",
  },
];

interface NotificationContext {
  clientName: string;
  developmentName: string;
  propertyLabel: string;
  cardLast4: string;
  expiresAtISO: string;
}

const renderTemplate = (template: string, ctx: NotificationContext): string => {
  const expires = new Date(ctx.expiresAtISO);
  const expiresAtFormatted =
    expires.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) +
    " a las " +
    expires.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
  const expiresAtShort = expires.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  const expiresAtTime = expires.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return template
    .replace(/\{\{clientName\}\}/g, ctx.clientName)
    .replace(/\{\{developmentName\}\}/g, ctx.developmentName)
    .replace(/\{\{propertyLabel\}\}/g, ctx.propertyLabel)
    .replace(/\{\{cardLast4\}\}/g, ctx.cardLast4)
    .replace(/\{\{expiresAtFormatted\}\}/g, expiresAtFormatted)
    .replace(/\{\{expiresAtShort\}\}/g, expiresAtShort)
    .replace(/\{\{expiresAtTime\}\}/g, expiresAtTime);
};

export const generateScheduledNotifications = (
  formalReservationId: string,
  activatedAtISO: string,
  ctx: NotificationContext
): ProvisionalNotification[] => {
  const activatedAt = new Date(activatedAtISO);
  const now = new Date().toISOString();

  return NOTIFICATION_TEMPLATES.map((template, idx) => {
    const scheduledAt = new Date(activatedAt);
    scheduledAt.setDate(scheduledAt.getDate() + template.day);
    const isImmediate = template.day === 0;
    return {
      id: `NOT-${formalReservationId}-${template.day}-${template.channel}-${idx}`,
      formalReservationId,
      day: template.day,
      channel: template.channel,
      subject: renderTemplate(template.subject, ctx),
      body: renderTemplate(template.body, ctx),
      scheduledAt: scheduledAt.toISOString(),
      status: isImmediate ? "sent" : "pending",
      sentAt: isImmediate ? now : null,
    };
  });
};
