import { create } from "zustand";
import sozuLogo from "@/assets/sozu-logo.png";

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

// ── Mock de agentes ──

const initialAgents: Agent[] = [
  {
    id: "AGT-RAMON",
    fullName: "Ramón Escobar",
    firstName: "Ramón",
    title: "Agente Inmobiliario Senior",
    photoUrl: "/images/agents/ramon-escobar.png",
    email: "joseramon.escobar@sozu.com",
    phone: "+52 33 1013 7670",
    whatsapp: "523310137670",
    brokerage: "SOZU",
    brokerageLogo: sozuLogo,
    isAllied: false,
    yearsExperience: 7,
    unitsClosedTotal: 84,
    unitsManagedInProject: 12,
    languages: ["Español", "Inglés"],
    specialization: "Preventa Zona Norte Guadalajara",
    responseTimeAvg: "Responde en menos de 30 min",
    bio: "Llevo 7 años acompañando a familias e inversionistas en la decisión más importante de su patrimonio. Mi compromiso: cero presión, máxima claridad. Conozco cada unidad de Daiku como si fuera mía.",
  },
  {
    id: "AGT-LUZ",
    fullName: "Luz Ochoa",
    firstName: "Luz",
    title: "Coordinadora de Pagos · Equipo SOZU",
    photoUrl:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face&q=80",
    email: "luz.ochoa@sozu.mx",
    phone: "+52 33 3306 6660",
    whatsapp: "523333066660",
    brokerage: "SOZU",
    brokerageLogo: sozuLogo,
    isAllied: false,
    yearsExperience: 5,
    unitsClosedTotal: 62,
    unitsManagedInProject: 18,
    languages: ["Español"],
    specialization: "Comercialización Daiku · Bottura",
    responseTimeAvg: "Responde en menos de 1 hora",
    bio: "Soy parte del equipo interno SOZU. Te acompaño desde la preventa hasta que recibas tus llaves. Mi prioridad es que entiendas cada peso y cada paso.",
  },
  {
    id: "AGT-ALIADO-CARLOS",
    fullName: "Carlos Mendoza Velázquez",
    firstName: "Carlos",
    title: "Agente Aliado SOZU",
    photoUrl:
      "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=400&h=400&fit=crop&crop=face&q=80",
    email: "carlos.mendoza@inmoaliados.mx",
    phone: "+52 33 2145 8730",
    whatsapp: "523321458730",
    brokerage: "Inmobiliaria Aliados GDL",
    isAllied: true,
    yearsExperience: 12,
    unitsClosedTotal: 210,
    unitsManagedInProject: 4,
    languages: ["Español", "Inglés", "Italiano"],
    specialization: "Inversión patrimonial · Patrimonio multinacional",
    responseTimeAvg: "Responde en menos de 2 horas",
    bio: "Como agente aliado de SOZU, te acompaño en SOZU pero también en cualquier proyecto que se ajuste a tu perfil. Mi enfoque: tu patrimonio crece más allá de una unidad.",
  },
];

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
