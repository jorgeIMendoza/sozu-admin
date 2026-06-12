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
