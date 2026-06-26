import { create } from "zustand";

// ── Tipos del dominio ──

export interface Agent {
  id: string;
  fullName: string;
  firstName: string;
  title: string;
  photoUrl: string;

  email: string;
  phone: string;
  whatsapp: string;

  brokerage?: string;
  brokerageLogo?: string;
  isAllied: boolean;

  yearsExperience?: number;
  unitsClosedTotal?: number;
  unitsManagedInProject?: number;
  languages?: string[];
  specialization?: string;
  responseTimeAvg?: string;

  bio?: string;
}

// Imagen fallback para foto de agente — logo SOZU desde Storage prod
// resize=contain evita que Supabase recorte el logo horizontal al cuadrar
export const AGENT_PHOTO_FALLBACK =
  "https://tzmhgfjmddkfyffkkmto.supabase.co/storage/v1/render/image/public/imagenes_generales/Sozu_logo_n.png?width=300&height=150&quality=80&format=webp&resize=contain";

const initialAgents: Agent[] = [];

// ── Store ──

interface AgentState {
  agents: Agent[];
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: structuredClone(initialAgents),
  reset: () => set({ agents: structuredClone(initialAgents) }),
}));

// ── Selectors ──

export function getAgentById(id: string): Agent | undefined {
  return useAgentStore.getState().agents.find((a) => a.id === id);
}

export function useAgentById(id: string): Agent | undefined {
  return useAgentStore((s) => s.agents.find((a) => a.id === id));
}

export function getAllAgents(): Agent[] {
  return useAgentStore.getState().agents;
}

// ── Helpers de contacto ──

export function buildAgentWhatsAppLink(agent: Agent, prefilledMessage?: string): string {
  const msg = prefilledMessage ?? `Hola ${agent.firstName}, tengo interés en una oferta de SOZU.`;
  return `https://wa.me/${agent.whatsapp}?text=${encodeURIComponent(msg)}`;
}

export function buildAgentPhoneLink(agent: Agent): string {
  return `tel:${agent.phone.replace(/\s/g, "")}`;
}

export function buildAgentEmailLink(agent: Agent, subject?: string): string {
  const subj = subject ?? "Consulta sobre oferta SOZU";
  return `mailto:${agent.email}?subject=${encodeURIComponent(subj)}`;
}
