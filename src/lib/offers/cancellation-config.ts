import {
  Home,
  Wallet,
  Clock,
  HelpCircle,
  Heart,
  Calendar,
  MoreHorizontal,
} from "lucide-react";
import type { CancellationReason } from "./offer-data";

export interface ReasonConfig {
  id: CancellationReason;
  icon: typeof Home;
  label: string;
  description: string;
  subReasonPrompt?: string;
  subReasonOptions?: string[];
}

export interface CounterOfferConfig {
  empathyMsg: string;
  insight: string;
  ctaLabel: string;
  ctaAction: "show_plans" | "talk_to_agent" | "respect_decision";
  ctaSubtext?: string;
}

// ── Razones ──

export const CANCELLATION_REASONS: ReasonConfig[] = [
  {
    id: "found_other_property",
    icon: Home,
    label: "Encontré otra propiedad",
    description: "Decidí ir por otra opción",
    subReasonPrompt: "¿De SOZU o de otra empresa?",
    subReasonOptions: [
      "Otra propiedad de SOZU",
      "Propiedad de otra empresa",
      "Prefiero no decir",
    ],
  },
  {
    id: "price_too_high",
    icon: Wallet,
    label: "El precio es más alto de lo que esperaba",
    description: "El precio total no se ajusta a mi presupuesto",
  },
  {
    id: "payment_plan_doesnt_work",
    icon: Wallet,
    label: "El esquema de pago no me funciona",
    description: "El enganche o las mensualidades no encajan",
  },
  {
    id: "need_more_time",
    icon: Clock,
    label: "Necesito más tiempo para decidir",
    description: "No estoy listo para comprometerme aún",
  },
  {
    id: "unresolved_doubts",
    icon: HelpCircle,
    label: "Tengo dudas que no se han resuelto",
    description: "Hay cosas que no me quedan claras",
  },
  {
    id: "life_situation_changed",
    icon: Heart,
    label: "Mi situación cambió",
    description: "Algo cambió en lo laboral, familiar o financiero",
  },
  {
    id: "not_right_moment",
    icon: Calendar,
    label: "No es el momento adecuado para mí",
    description: "Prefiero esperar a otra etapa de mi vida",
  },
  {
    id: "other",
    icon: MoreHorizontal,
    label: "Otra razón",
    description: "Mi motivo no está en esta lista",
  },
];

// ── Counter-offers por razón ──

export const COUNTER_OFFERS: Record<CancellationReason, CounterOfferConfig> = {
  found_other_property: {
    empathyMsg: "Entendemos. Encontrar la propiedad correcta es lo más importante.",
    insight:
      "Antes de cerrar, comentárselo a tu agente puede darte una segunda mirada. A veces detalles del comparativo que no se ven a primera vista cambian la decisión.",
    ctaLabel: "Comentar con Ramón antes de cerrar",
    ctaAction: "talk_to_agent",
    ctaSubtext: "Una llamada de 10 minutos. Sin presión.",
  },
  price_too_high: {
    empathyMsg: "El precio importa. Tenemos margen para revisarlo.",
    insight:
      "SOZU ofrece 7 esquemas distintos para esta unidad. Con un enganche más alto, el ahorro llega hasta 6% del precio. Con uno más bajo, la entrada es más cómoda. Quizá uno te funcione mejor.",
    ctaLabel: "Ver los 7 esquemas",
    ctaAction: "show_plans",
    ctaSubtext: "Toma 2 minutos compararlos.",
  },
  payment_plan_doesnt_work: {
    empathyMsg: "Hay 7 esquemas distintos para esta unidad. Vale la pena revisarlos.",
    insight:
      "Tu agente puede armarte una propuesta basada en tu situación financiera específica — desde 6% de enganche con plan escalonado, hasta 90% con descuento del 6%. Una conversación puede abrir opciones.",
    ctaLabel: "Hablar con Ramón sobre opciones",
    ctaAction: "talk_to_agent",
    ctaSubtext: "Responde en menos de 30 minutos.",
  },
  need_more_time: {
    empathyMsg: "Tomarse el tiempo correcto es la decisión más sana.",
    insight:
      "Tu pre-apartado sigue activo durante 15 días desde que lo creaste. No tienes que decidir ahora. Tu agente puede acompañarte en este proceso.",
    ctaLabel: "Hablar con Ramón antes de cancelar",
    ctaAction: "talk_to_agent",
    ctaSubtext: "Compartir tus dudas suele ayudar a aclarar la decisión.",
  },
  unresolved_doubts: {
    empathyMsg: "No deberías cancelar con dudas. Vale la pena resolverlas primero.",
    insight:
      "Tu agente responde en menos de 30 minutos por WhatsApp. Una conversación corta puede ayudarte a decidir con toda la información en la mesa.",
    ctaLabel: "Hablar con Ramón ahora",
    ctaAction: "talk_to_agent",
    ctaSubtext: "Decide después de tener todas las respuestas, no antes.",
  },
  life_situation_changed: {
    empathyMsg: "Lo entendemos. La vida cambia y a veces los planes con ella.",
    insight:
      "Si crees que es solo cuestión de timing, tu agente puede comentar las opciones. Si la decisión está tomada, respetamos completamente.",
    ctaLabel: "Hablar con Ramón antes de cerrar",
    ctaAction: "talk_to_agent",
    ctaSubtext: "Sin compromiso.",
  },
  not_right_moment: {
    empathyMsg: "Respetamos tu tiempo. La decisión correcta llega en su momento.",
    insight:
      "Si en el futuro vuelves a considerar SOZU, tu agente estará disponible. No es una despedida, es una pausa.",
    ctaLabel: "Mantener mi pre-apartado un día más",
    ctaAction: "respect_decision",
    ctaSubtext: "A veces dormir sobre la decisión cambia las cosas.",
  },
  other: {
    empathyMsg: "Gracias por compartirlo. Cada feedback nos ayuda a mejorar.",
    insight:
      "Si hay algo específico que podríamos cambiar para mantenerte interesado, vale la pena decirlo. Si la decisión es firme, respetamos.",
    ctaLabel: "Hablar con Ramón sobre lo que pasó",
    ctaAction: "talk_to_agent",
    ctaSubtext: "Tu opinión nos importa.",
  },
};
