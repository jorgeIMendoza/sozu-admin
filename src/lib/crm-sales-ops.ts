// Sales Operations & Task Automation utilities (ported from sozu-crm)

export type SlaStatus = "on_track" | "due_soon" | "overdue" | "critical" | "escalated";

export type SlaResult = {
  status: SlaStatus;
  rule: string;
  minutes_elapsed: number | null;
  minutes_budget: number;
  reason: string;
  recommendation: string;
};

const MIN = 60_000;

function minutesSince(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / MIN));
}

function slaStatus(elapsed: number | null, budget: number): SlaStatus {
  if (elapsed == null) return "overdue";
  if (elapsed > budget * 2) return "critical";
  if (elapsed > budget) return "overdue";
  if (elapsed > budget * 0.7) return "due_soon";
  return "on_track";
}

export function calculateSlaStatus(
  contact: any,
  ctx?: { intelLabel?: string; lastApptAttendedAt?: string | null; hasNextTask?: boolean },
): SlaResult {
  const label = ctx?.intelLabel;
  const lastContact = contact.last_contacted_at;
  const created = contact.created_at;

  if (ctx?.lastApptAttendedAt && ctx.hasNextTask === false) {
    const m = minutesSince(ctx.lastApptAttendedAt);
    return {
      status: slaStatus(m, 4 * 60),
      rule: "post_appointment_followup",
      minutes_elapsed: m,
      minutes_budget: 240,
      reason: "Cita asistida sin siguiente tarea",
      recommendation: "Crear deal o tarea de seguimiento inmediato",
    };
  }

  if (label === "Hot" || label === "High intent") {
    const m = minutesSince(lastContact ?? contact.last_activity_at);
    return {
      status: slaStatus(m, 120),
      rule: "hot_lead_followup",
      minutes_elapsed: m,
      minutes_budget: 120,
      reason: "Lead caliente sin contacto en 2h",
      recommendation: "Llamar y agendar cita hoy",
    };
  }

  if (contact.lead_status === "qualified") {
    const m = minutesSince(created);
    return {
      status: slaStatus(m, 24 * 60),
      rule: "qualified_no_appointment",
      minutes_elapsed: m,
      minutes_budget: 1440,
      reason: "Lead calificado >24h sin cita",
      recommendation: "Contactar y agendar cita",
    };
  }

  if (contact.lead_status === "new" || !lastContact) {
    const m = minutesSince(created);
    return {
      status: slaStatus(m, 15),
      rule: "new_lead_first_contact",
      minutes_elapsed: m,
      minutes_budget: 15,
      reason: "Lead nuevo sin primer contacto",
      recommendation: "Speed-to-lead: contactar en <15 min",
    };
  }

  return {
    status: "on_track",
    rule: "default_cadence",
    minutes_elapsed: minutesSince(lastContact),
    minutes_budget: 72 * 60,
    reason: "Cadencia regular",
    recommendation: "Mantener seguimiento programado",
  };
}

export type FollowUpPriority = "P0" | "P1" | "P2" | "P3";

export function getFollowUpPriority(sla: SlaResult, intelLabel?: string): FollowUpPriority {
  if (sla.status === "critical" || sla.status === "escalated") return "P0";
  if (sla.status === "overdue") return "P1";
  if (intelLabel === "Hot" || intelLabel === "High intent") return "P1";
  if (sla.status === "due_soon") return "P2";
  return "P3";
}

export const SLA_TONE: Record<SlaStatus, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  due_soon: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  overdue: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  critical: "bg-red-500/15 text-red-700 dark:text-red-400",
  escalated: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
};

export type SequenceStep = {
  timing: string;
  channel: "call" | "whatsapp_mock" | "email_mock" | "task";
  copy: string;
  objective: string;
};

export type Sequence = {
  id: string;
  name: string;
  stage: string;
  objective: string;
  steps: SequenceStep[];
};

export const SEQUENCES: Sequence[] = [
  {
    id: "new_lead",
    name: "Lead nuevo",
    stage: "new",
    objective: "Contactar en <15 min y calificar",
    steps: [
      { timing: "Min 0", channel: "call", copy: "Llamada de bienvenida y calificación inicial.", objective: "Primer contacto y SQL básico" },
      { timing: "Min 5", channel: "whatsapp_mock", copy: "Hola {{nombre}}, soy {{asesor}} de {{desarrollo}}. ¿Tienes 2 minutos?", objective: "Backup multicanal" },
      { timing: "Hora 2", channel: "call", copy: "Segundo intento de llamada con propuesta de cita.", objective: "Insistencia" },
      { timing: "Día 1", channel: "whatsapp_mock", copy: "{{nombre}}, te comparto el diferenciador de {{desarrollo}}: {{diferenciador}}.", objective: "Educar" },
      { timing: "Día 3", channel: "task", copy: "Mover a nurturing si no responde.", objective: "Cierre de cadencia inicial" },
    ],
  },
  {
    id: "hot_lead",
    name: "Lead hot",
    stage: "hot",
    objective: "Cerrar cita en 48h",
    steps: [
      { timing: "Inmediato", channel: "call", copy: "Llamada prioritaria — lead caliente.", objective: "No perder ventana" },
      { timing: "Hora 1", channel: "whatsapp_mock", copy: "{{nombre}}, te aparté esta info de {{desarrollo}}: {{propuesta}}. ¿Cuándo te marcamos?", objective: "Personalizar" },
      { timing: "Día 1", channel: "email_mock", copy: "Propuesta formal + ficha técnica + agenda.", objective: "Avanzar a cita" },
      { timing: "Día 2", channel: "call", copy: "Seguimiento de decisión.", objective: "Cerrar cita" },
    ],
  },
  {
    id: "post_appointment",
    name: "Post-cita asistida",
    stage: "appointment_attended",
    objective: "Mover a apartado",
    steps: [
      { timing: "Mismo día", channel: "whatsapp_mock", copy: "Gracias {{nombre}} por tu visita a {{desarrollo}}. Próximo paso: {{cita}}.", objective: "Cerrar loop" },
      { timing: "Día 1", channel: "email_mock", copy: "Propuesta + inventario disponible.", objective: "Mantener momentum" },
      { timing: "Día 3", channel: "whatsapp_mock", copy: "{{nombre}}, quedan {{unidades}} unidades con este precio.", objective: "Urgencia" },
      { timing: "Día 7", channel: "call", copy: "Llamada de cierre.", objective: "Decisión" },
    ],
  },
  {
    id: "out_of_budget",
    name: "Fuera de presupuesto",
    stage: "nurture",
    objective: "Mantener relación / alternativa",
    steps: [
      { timing: "Día 0", channel: "whatsapp_mock", copy: "{{nombre}}, te comparto opciones más accesibles en {{desarrollo}}.", objective: "Alternativa" },
      { timing: "Día 7", channel: "email_mock", copy: "Contenido educativo + plan de financiamiento.", objective: "Educar" },
      { timing: "Día 30", channel: "whatsapp_mock", copy: "Nuevas opciones disponibles.", objective: "Nurturing largo plazo" },
    ],
  },
  {
    id: "no_answer",
    name: "No contesta",
    stage: "stale",
    objective: "Reactivar o cerrar",
    steps: [
      { timing: "Día 0", channel: "call", copy: "Intento 1.", objective: "Reactivar" },
      { timing: "Día 1", channel: "whatsapp_mock", copy: "Intento 2 multicanal.", objective: "Reactivar" },
      { timing: "Día 3", channel: "email_mock", copy: "Intento 3 con beneficio claro.", objective: "Reactivar" },
      { timing: "Día 7", channel: "task", copy: "Pausar y marcar como nurturing.", objective: "Cerrar cadencia" },
    ],
  },
];

export const DEFAULT_AUTOMATION_RULES = [
  { name: "Speed-to-lead", trigger_type: "lead_created", condition: { minutes_without_contact: 15 }, action_type: "create_task", action_payload: { title: "Llamar lead nuevo", priority: "high" }, priority: "high" },
  { name: "Hot lead seguimiento 2h", trigger_type: "lead_label_hot", condition: { minutes_without_contact: 120 }, action_type: "create_task", action_payload: { title: "Seguimiento urgente lead hot", priority: "urgent" }, priority: "urgent" },
  { name: "Cita asistida sin deal", trigger_type: "appointment_attended", condition: { hours_without_deal: 4 }, action_type: "create_task", action_payload: { title: "Crear deal / enviar propuesta", priority: "high" }, priority: "high" },
  { name: "Deal sin próxima tarea", trigger_type: "deal_open", condition: { no_next_task: true }, action_type: "create_task", action_payload: { title: "Definir siguiente acción del deal", priority: "normal" }, priority: "normal" },
  { name: "Asesor saturado", trigger_type: "advisor_backlog", condition: { overdue_tasks_gte: 10 }, action_type: "create_escalation", action_payload: { severity: "warning" }, priority: "high" },
  { name: "Lead con tracking issue pero alto fit", trigger_type: "lead_intel_tracking_issue", condition: { fit_score_gte: 60 }, action_type: "create_task", action_payload: { title: "Revisar atribución y completar tracking", priority: "normal" }, priority: "normal" },
];

export type MessageKind =
  | "whatsapp_new_lead"
  | "whatsapp_hot_lead"
  | "whatsapp_post_appointment"
  | "email_followup"
  | "appointment_reminder"
  | "no_answer"
  | "reactivation"
  | "out_of_budget";

export type MessageContext = {
  contact_name?: string;
  development?: string;
  advisor_name?: string;
  label?: string;
  score?: number;
  next_action?: string;
  appointment_at?: string;
  differentiator?: string;
};

export function generateMessage(
  kind: MessageKind,
  ctx: MessageContext,
): { subject?: string; body: string; channel: "whatsapp_mock" | "email_mock"; disclaimer: string } {
  const name = ctx.contact_name ?? "{{nombre}}";
  const dev = ctx.development ?? "el desarrollo";
  const adv = ctx.advisor_name ?? "tu asesor";
  const diff = ctx.differentiator ?? "amenidades premium y ubicación privilegiada";
  const disclaimer = "Mensaje generado en modo mock/sandbox — no se envió a ningún canal real.";

  switch (kind) {
    case "whatsapp_new_lead":
      return { body: `Hola ${name}, soy ${adv} de ${dev}. ¿Tienes un momento para platicar sobre nuestras unidades disponibles? 🏢`, channel: "whatsapp_mock", disclaimer };
    case "whatsapp_hot_lead":
      return { body: `${name}, vi que tienes alto interés en ${dev}. ${diff}. ¿Cuándo podemos agendar tu visita?`, channel: "whatsapp_mock", disclaimer };
    case "whatsapp_post_appointment":
      return { body: `${name}, fue un placer mostrarte ${dev}. Recuerda: ${diff}. ¿Tienes alguna duda antes de tomar tu decisión?`, channel: "whatsapp_mock", disclaimer };
    case "email_followup":
      return {
        subject: `Seguimiento · ${dev}`,
        body: `Hola ${name},\n\nGracias por tu interés en ${dev}.\n\n${diff}\n\nQuedo a tus órdenes,\n${adv}`,
        channel: "email_mock",
        disclaimer,
      };
    case "appointment_reminder":
      return { body: `Recordatorio: tienes visita a ${dev}${ctx.appointment_at ? ` el ${ctx.appointment_at}` : ""}. ¡Te esperamos!`, channel: "whatsapp_mock", disclaimer };
    case "no_answer":
      return { body: `${name}, intenté contactarte para platicarte sobre ${dev}. ¿Hay un buen momento para llamarte?`, channel: "whatsapp_mock", disclaimer };
    case "reactivation":
      return { body: `${name}, tengo novedades interesantes sobre ${dev} que creo pueden interesarte. ¿Platicamos esta semana?`, channel: "whatsapp_mock", disclaimer };
    case "out_of_budget":
      return { body: `${name}, entiendo tu presupuesto. Tenemos opciones en ${dev} que podrían ajustarse mejor. ¿Te las comparto?`, channel: "whatsapp_mock", disclaimer };
    default:
      return { body: `Mensaje de seguimiento para ${name} · ${dev}`, channel: "whatsapp_mock", disclaimer };
  }
}
