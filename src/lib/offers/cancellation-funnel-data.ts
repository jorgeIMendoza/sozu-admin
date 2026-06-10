import {
  Search,
  DollarSign,
  Calendar,
  Clock,
  HelpCircle,
  Heart,
  Sparkles,
  MessageCircle,
} from "lucide-react";

/**
 * (18.10.C) Catálogo de razones del funnel de cancelación tipo Netflix +
 * mensajes empáticos contextuales del Paso 3.
 *
 * Mantener separado del componente facilita iteración del copy sin tocar UI.
 */

export type CancellationReasonId =
  | "found_other"
  | "price_high"
  | "payment_scheme"
  | "need_time"
  | "unresolved_doubts"
  | "situation_changed"
  | "not_right_moment"
  | "other";

export interface CancellationReason {
  id: CancellationReasonId;
  label: string;
  description: string;
  icon: typeof Search;
}

export const CANCELLATION_REASONS: CancellationReason[] = [
  {
    id: "found_other",
    label: "Encontré otra propiedad",
    description: "Decidí ir por otra opción",
    icon: Search,
  },
  {
    id: "price_high",
    label: "El precio es más alto de lo que esperaba",
    description: "El precio total no se ajusta a mi presupuesto",
    icon: DollarSign,
  },
  {
    id: "payment_scheme",
    label: "El esquema de pago no me funciona",
    description: "El enganche o las mensualidades no encajan",
    icon: Calendar,
  },
  {
    id: "need_time",
    label: "Necesito más tiempo para decidir",
    description: "No estoy listo para comprometerme aún",
    icon: Clock,
  },
  {
    id: "unresolved_doubts",
    label: "Tengo dudas que no se han resuelto",
    description: "Hay cosas que no me quedan claras",
    icon: HelpCircle,
  },
  {
    id: "situation_changed",
    label: "Mi situación cambió",
    description: "Algo cambió en lo laboral, familiar o financiero",
    icon: Heart,
  },
  {
    id: "not_right_moment",
    label: "No es el momento adecuado para mí",
    description: "Prefiero esperar a otra etapa de mi vida",
    icon: Sparkles,
  },
  {
    id: "other",
    label: "Otra razón",
    description: "Mi motivo no está en esta lista",
    icon: MessageCircle,
  },
];

export interface EmpatheticMessage {
  contextLabel: string;
  title: string;
  body: string;
  ctaLabel: string;
  whatsappMessage: string;
}

export const EMPATHETIC_MESSAGES: Record<CancellationReasonId, EmpatheticMessage> = {
  found_other: {
    contextLabel: "Encontraste otra propiedad",
    title: "Está bien explorar opciones — eso es estar haciendo bien las cosas.",
    body: "A veces toma ver varias unidades antes de encontrar la indicada. Antes de cerrar, ¿te gustaría que Ramón te muestre otras unidades disponibles que se ajusten mejor a lo que buscas? Quizás haya algo que aún no viste.",
    ctaLabel: "Hablar con Ramón sobre otras unidades",
    whatsappMessage:
      "Hola Ramón, estoy considerando cancelar mi apartado porque encontré otra propiedad. Antes de cerrar, me gustaría ver qué otras opciones tienen disponibles.",
  },
  price_high: {
    contextLabel: "El precio es un factor",
    title: "El precio importa — y vale la pena revisar todas las opciones antes de cerrar.",
    body: "Hay seis esquemas de financiamiento con descuentos progresivos según el enganche (F2 con 3%, F3 con 5%, hasta F6 con 15%). Ramón puede platicarte cuál podría ajustarse mejor a tu flujo, o explorar unidades con precio más bajo dentro del mismo desarrollo.",
    ctaLabel: "Platicar de los esquemas con más descuento",
    whatsappMessage:
      "Hola Ramón, el precio de la unidad me parece más alto de lo que esperaba. Antes de cancelar mi apartado, me gustaría entender bien los esquemas F4, F5 y F6, o ver si hay otras unidades a mejor precio.",
  },
  payment_scheme: {
    contextLabel: "El esquema de pago",
    title: "Tenemos seis esquemas distintos — uno seguramente encaja contigo.",
    body: "Si el enganche del 20% es alto, hay opciones con menos enganche pero mensualidades más altas. Si las mensualidades te aprietan, hay esquemas con más enganche y menos pagos mensuales. Ramón puede ayudarte a encontrar la combinación que mejor se ajuste a tu flujo.",
    ctaLabel: "Pedir a Ramón que arme un esquema a mi medida",
    whatsappMessage:
      "Hola Ramón, el esquema de pago actual no me funciona. ¿Puedes ayudarme a ver otras combinaciones de enganche y mensualidades antes de que cancele mi apartado?",
  },
  need_time: {
    contextLabel: "Necesitas más tiempo",
    title: "Lo entendemos completamente — esta es una decisión que merece pensarse.",
    body: "Tu apartado provisional tiene varios días más de vigencia. Puedes usarlos para pensarlo con calma, hablar con tu familia, o revisar el contrato con un abogado. Si necesitas extender el plazo más allá del vencimiento, Ramón puede explorar opciones contigo.",
    ctaLabel: "Pedir a Ramón un poco más de tiempo",
    whatsappMessage:
      "Hola Ramón, necesito más tiempo para decidir sobre mi apartado. ¿Hay alguna forma de extender el plazo o de pausar el proceso por unos días?",
  },
  unresolved_doubts: {
    contextLabel: "Tienes dudas",
    title: "Las dudas son normales — y por eso tu asesor existe.",
    body: "Ramón es experto en este desarrollo y puede aclarar cualquier punto del contrato, de la entrega, del avance de obra o de los pagos. Una llamada de 10 minutos antes de cancelar puede aclarar dudas que vale la pena resolver.",
    ctaLabel: "Hablar con Ramón para resolver dudas",
    whatsappMessage:
      "Hola Ramón, tengo dudas que no se han resuelto sobre mi apartado. ¿Tienes tiempo para platicar antes de que decida cancelar?",
  },
  situation_changed: {
    contextLabel: "Mi situación cambió",
    title: "Lo entendemos. La vida cambia, y a veces los planes con ella.",
    body: "Si crees que es solo cuestión de timing, Ramón puede comentar las opciones contigo. Si la decisión está tomada por causas mayores, respetamos completamente y el proceso de cancelación es rápido y sin cargos.",
    ctaLabel: "Hablar con Ramón antes de cerrar",
    whatsappMessage:
      "Hola Ramón, mi situación cambió y estoy considerando cancelar mi apartado. ¿Podemos platicar un momento antes de que tome la decisión final?",
  },
  not_right_moment: {
    contextLabel: "No es el momento",
    title: "Está bien. A veces simplemente no es el momento.",
    body: "Si en el futuro vuelve a serlo, aquí estaremos. Mientras tanto, Ramón puede mantenerte informado de nuevos desarrollos, promociones especiales, o unidades que se liberen en este mismo proyecto. Sin presión.",
    ctaLabel: "Pedir a Ramón que me mantenga informado",
    whatsappMessage:
      "Hola Ramón, no es el momento adecuado para mí ahora. Voy a cancelar mi apartado pero me gustaría que me mantengas informado si hay novedades.",
  },
  other: {
    contextLabel: "Una razón distinta",
    title: "Sea lo que sea, gracias por compartir hasta aquí.",
    body: "Si quieres platicarlo con Ramón antes de cerrar definitivamente, está disponible. A veces poner en palabras la razón ayuda a clarificarla — y Ramón puede ofrecerte perspectiva o simplemente acompañarte en el cierre.",
    ctaLabel: "Hablar con Ramón antes de cerrar",
    whatsappMessage:
      "Hola Ramón, estoy considerando cancelar mi apartado por una razón que no estaba en la lista. ¿Tienes un momento para platicar antes?",
  },
};
