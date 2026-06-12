import { create } from "zustand";
import obraDaiku1 from "@/assets/obra-daiku-1.jpg";
import obraDaiku2 from "@/assets/obra-daiku-2.jpg";
import obraDaiku3 from "@/assets/obra-daiku-3.jpg";
import obraDaiku4 from "@/assets/obra-daiku-4.jpg";

export interface ConstructionPhoto {
  src: string;
  alt: string;
}

export interface ConstructionMilestone {
  phase: string;
  pct: number;
  done: boolean;
}

export interface ConstructionUpdate {
  id: string;
  date: string;
  month: string;
  stage: string;
  progressPercent?: number;
  description: string;
  photos: ConstructionPhoto[];
  videoUrl?: string;
  videoTitle?: string;
}

export interface ConstructionProgressData {
  projectId: string;
  globalProgress: number;
  lastUpdated: string;
  estimatedDelivery: string; // ISO date
  milestones: ConstructionMilestone[];
  featuredVideoUrl?: string;
  featuredVideoTitle?: string;
  updates: ConstructionUpdate[];
  notificationsEnabled: boolean;
}

const initialConstructionMap: Record<string, ConstructionProgressData> = {
  "daiku-712": {
    projectId: "daiku-712",
    globalProgress: 28,
    lastUpdated: "12 Mayo 2026",
    estimatedDelivery: "2028-06-30T00:00:00",
    milestones: [
      { phase: "Cimentación", pct: 5, done: true },
      { phase: "Estructura", pct: 28, done: true },
      { phase: "Albañilería", pct: 60, done: false },
      { phase: "Instalaciones", pct: 80, done: false },
      { phase: "Acabados", pct: 95, done: false },
      { phase: "Entrega", pct: 100, done: false },
    ],
    featuredVideoUrl: "https://www.youtube.com/embed/KQf-8tqXAQ8",
    featuredVideoTitle: "AVANCE DE OBRA · MAYO 2026 · DAIKU",
    notificationsEnabled: true,
    updates: [
      {
        id: "daiku-may-2026",
        date: "12 Mayo 2026",
        month: "Mayo 2026",
        stage: "Estructura",
        progressPercent: 28,
        description:
          "Avance en armado de columnas de niveles superiores. Cimbra y colado de trabes principales en perímetro. Cuadrilla completa trabajando en estructura del cuerpo central.",
        photos: [
          { src: obraDaiku1, alt: "Armado de columnas vista panorámica" },
          { src: obraDaiku2, alt: "Trabajos en altura sobre columnas" },
          { src: obraDaiku3, alt: "Cuadrilla trabajando en columnas" },
          { src: obraDaiku4, alt: "Cimbra y trabes en perímetro" },
        ],
        videoUrl: "https://www.youtube.com/embed/KQf-8tqXAQ8",
        videoTitle: "AVANCE DE OBRA · MAYO 2026 · DAIKU",
      },
      {
        id: "daiku-feb-2026",
        date: "12 Febrero 2026",
        month: "Febrero 2026",
        stage: "Estructura",
        progressPercent: 18,
        description:
          "Se finalizó el colado de la losa del nivel 2. Avance en armado de columnas para el nivel 3. Trabajos de cimbra en perímetro norte.",
        photos: [
          { src: obraDaiku1, alt: "Armado de columnas nivel 3" },
          { src: obraDaiku2, alt: "Vista general de estructura" },
          { src: obraDaiku3, alt: "Cimbra perímetro norte" },
          { src: obraDaiku4, alt: "Detalle de armado estructural" },
        ],
      },
      {
        id: "daiku-jan-2026",
        date: "15 Enero 2026",
        month: "Enero 2026",
        stage: "Cimentación",
        progressPercent: 10,
        description:
          "Completada la cimentación profunda con pilas y zapatas. Inicio de muros de contención en sótano. Instalaciones hidráulicas subterráneas concluidas.",
        photos: [
          { src: obraDaiku3, alt: "Cimentación profunda" },
          { src: obraDaiku4, alt: "Muros de contención" },
        ],
      },
    ],
  },
  "bottura-709": {
    projectId: "bottura-709",
    globalProgress: 92,
    lastUpdated: "21 Abril 2026",
    estimatedDelivery: "2026-09-30T00:00:00",
    milestones: [
      { phase: "Cimentación", pct: 5, done: true },
      { phase: "Estructura", pct: 30, done: true },
      { phase: "Albañilería", pct: 60, done: true },
      { phase: "Instalaciones", pct: 80, done: true },
      { phase: "Acabados", pct: 95, done: false },
      { phase: "Entrega", pct: 100, done: false },
    ],
    featuredVideoUrl: "https://www.youtube.com/embed/eKaju9YdtXU",
    featuredVideoTitle: "AVANCE DE OBRA · MARZO 2026 · BOTTURA",
    notificationsEnabled: false,
    updates: [
      {
        id: "bottura-apr-2026",
        date: "21 Abril 2026",
        month: "Abril 2026",
        stage: "Detalles",
        progressPercent: 92,
        description:
          "Instalación de pisos en niveles 5-7. Aplicación de pasta y pintura en áreas comunes. Pruebas hidráulicas completadas.",
        photos: [
          { src: obraDaiku1, alt: "Acabados interiores" },
          { src: obraDaiku2, alt: "Áreas comunes" },
        ],
        videoUrl: "https://www.youtube.com/embed/eKaju9YdtXU",
        videoTitle: "AVANCE DE OBRA · MARZO 2026 · BOTTURA",
      },
      {
        id: "bottura-dec-2025",
        date: "31 Marzo 2026",
        month: "Diciembre 2025",
        stage: "Acabados",
        progressPercent: 78,
        description:
          "Avance en acabados finos y revisión de instalaciones eléctricas. Cierre de fachada principal.",
        photos: [
          { src: obraDaiku3, alt: "Fachada principal" },
        ],
      },
    ],
  },
};

interface ConstructionState {
  progressMap: Record<string, ConstructionProgressData>;
  toggleNotifications: (propertyId: string) => void;
  setNotificationsEnabled: (propertyId: string, enabled: boolean) => void;
  reset: () => void;
}

export const useConstructionStore = create<ConstructionState>((set, get) => ({
  progressMap: structuredClone(initialConstructionMap),
  toggleNotifications: (propertyId) => {
    const map = get().progressMap;
    const current = map[propertyId];
    if (!current) return;
    set({
      progressMap: {
        ...map,
        [propertyId]: { ...current, notificationsEnabled: !current.notificationsEnabled },
      },
    });
  },
  setNotificationsEnabled: (propertyId, enabled) => {
    const map = get().progressMap;
    const current = map[propertyId];
    if (!current || current.notificationsEnabled === enabled) return;
    set({
      progressMap: {
        ...map,
        [propertyId]: { ...current, notificationsEnabled: enabled },
      },
    });
  },
  reset: () => set({ progressMap: structuredClone(initialConstructionMap) }),
}));

// ── Legacy API ──

export function getConstructionProgress(propertyId: string): ConstructionProgressData | undefined {
  return useConstructionStore.getState().progressMap[propertyId];
}

export function shouldShowConstructionProgress(activeStageId: string | undefined): boolean {
  if (!activeStageId) return false;
  return ["preventa", "pago_final", "escrituracion", "entrega"].includes(activeStageId);
}

export function toggleConstructionNotifications(propertyId: string): void {
  useConstructionStore.getState().toggleNotifications(propertyId);
}

export function setConstructionNotificationsEnabled(propertyId: string, enabled: boolean): void {
  useConstructionStore.getState().setNotificationsEnabled(propertyId, enabled);
}

// ── Hooks reactivos ──

export function useConstructionProgress(propertyId: string): ConstructionProgressData | undefined {
  return useConstructionStore((s) => s.progressMap[propertyId]);
}

export function useConstructionNotificationsEnabled(propertyId: string): boolean {
  return useConstructionStore((s) => s.progressMap[propertyId]?.notificationsEnabled ?? false);
}
