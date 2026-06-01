// ── Asesores reales SOZU por fase del proceso + helpers para WhatsApp contextual ──
import { create } from "zustand";
import type { TransactionStage } from "./types";

export type StageId = TransactionStage;

/** Identificador especial para flujos que no son fases del dominio (ej. reventa). */
export type SpecialFlow = "reventa";

/** Parámetro extendido: una fase real del dominio o un flujo especial. */
export type PhaseOrFlow = StageId | SpecialFlow;

export interface Advisor {
  id: string;
  name: string;
  role: string;
  avatarInitials: string;
  whatsappNumber: string; // formato internacional sin "+", listo para wa.me
  phoneNumber: string;    // formato display nacional
  email: string;
  availability: string;
  /** Fases del dominio que cubre este asesor. Vacío si solo atiende un flujo especial. */
  phases: StageId[];
  /** Flujo especial que cubre este asesor (ej. reventa). Mutuamente excluyente con phases en la práctica. */
  specialFlow?: SpecialFlow;
}

const initialAdvisorRoster: Advisor[] = [
  {
    id: "advisor-luz",
    name: "Luz Ochoa",
    role: "Coordinadora de Pagos",
    avatarInitials: "LO",
    whatsappNumber: "523333066660",
    phoneNumber: "+52 33 3306 6660",
    email: "luz.ochoa@sozu.mx",
    availability: "Lun–Vie · 9am–7pm CST",
    phases: ["preventa", "pago_final"],
  },
  {
    id: "advisor-isabel",
    name: "Isabel Hernández",
    role: "Coordinadora de Entrega y Postventa",
    avatarInitials: "IH",
    whatsappNumber: "523332540890",
    phoneNumber: "+52 33 3254 0890",
    email: "isabel.hernandez@sozu.mx",
    availability: "Lun–Vie · 9am–7pm CST",
    phases: ["escrituracion", "entrega", "post_entrega"],
  },
  {
    id: "advisor-pablo",
    name: "Pablo Espinosa",
    role: "Coordinador de Reventas",
    avatarInitials: "PE",
    whatsappNumber: "523315879918",
    phoneNumber: "+52 33 1587 9918",
    email: "pablo.espinosa@sozu.mx",
    availability: "Lun–Vie · 9am–7pm CST",
    phases: [],
    specialFlow: "reventa",
  },
];

interface AdvisorState {
  roster: Advisor[];
  reset: () => void;
}

export const useAdvisorStore = create<AdvisorState>((set) => ({
  roster: [...initialAdvisorRoster],
  reset: () => set({ roster: [...initialAdvisorRoster] }),
}));

// ── Resolución de asesor ──

/**
 * Resuelve el asesor para una fase del dominio o un flujo especial.
 * Prioridad: si el parámetro es un SpecialFlow, busca por specialFlow.
 * Si es una StageId, busca el primero cuyo `phases` incluya esa fase.
 */
function resolveAdvisor(roster: Advisor[], target: PhaseOrFlow): Advisor {
  // Caso flujo especial (ej. "reventa")
  if (target === "reventa") {
    const byFlow = roster.find((a) => a.specialFlow === "reventa");
    if (byFlow) return byFlow;
  }
  // Caso fase del dominio
  const byPhase = roster.find((a) => a.phases.includes(target as StageId));
  if (byPhase) return byPhase;
  // Fallback: primer asesor del roster (Luz por convención)
  return roster[0];
}

// ── Legacy API ──

export function getAdvisorByPhase(phase: PhaseOrFlow): Advisor {
  return resolveAdvisor(useAdvisorStore.getState().roster, phase);
}

export function getAdvisorForProperty(propertyId: string, phaseOverride?: PhaseOrFlow): Advisor {
  if (phaseOverride) return getAdvisorByPhase(phaseOverride);
  return useAdvisorStore.getState().roster[0];
}

export function getAdvisorById(id: string): Advisor | undefined {
  return useAdvisorStore.getState().roster.find((a) => a.id === id);
}

export function getAllAdvisors(): Advisor[] {
  return useAdvisorStore.getState().roster;
}

// ── Hooks reactivos ──

export function useAdvisorForProperty(propertyId: string, phaseOverride?: PhaseOrFlow): Advisor {
  return useAdvisorStore((s) => {
    if (phaseOverride) return resolveAdvisor(s.roster, phaseOverride);
    return s.roster[0];
  });
}

export function useAllAdvisors(): Advisor[] {
  return useAdvisorStore((s) => s.roster);
}

// ── WhatsApp contextual ──

export interface SupportContext {
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  flowName?: string;
  flowStep?: string;
  additionalNotes?: string;
  /** Permite forzar la resolución a un asesor distinto al de la fase activa (ej. "reventa"). */
  phaseOverride?: PhaseOrFlow;
}

export function buildContextLabel(ctx: SupportContext): string {
  const parts: string[] = [`${ctx.propertyName} ${ctx.unitNumber}`];
  if (ctx.flowName) parts.push(ctx.flowName);
  if (ctx.flowStep) parts.push(ctx.flowStep);
  if (ctx.additionalNotes) parts.push(ctx.additionalNotes);
  return parts.join(" · ");
}

export function buildContextualWhatsAppMessage(ctx: SupportContext, advisorName: string): string {
  const firstName = advisorName.split(" ")[0];
  return `Hola ${firstName}, soy cliente SOZU.\n\nContexto: ${buildContextLabel(ctx)}\n\nMi consulta:`;
}

export function buildWhatsAppLink(advisor: Advisor, prefilledMessage: string): string {
  return `https://wa.me/${advisor.whatsappNumber}?text=${encodeURIComponent(prefilledMessage)}`;
}

export function getContextualWhatsAppLink(ctx: SupportContext): { advisor: Advisor; link: string } {
  const advisor = getAdvisorForProperty(ctx.propertyId, ctx.phaseOverride);
  const message = buildContextualWhatsAppMessage(ctx, advisor.name);
  return { advisor, link: buildWhatsAppLink(advisor, message) };
}
