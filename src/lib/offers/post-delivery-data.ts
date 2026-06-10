// ── Post-entrega: data layer (garantía vicios ocultos + incidencias + manuales) ──

import { useMemo } from "react";
import { create } from "zustand";

// ── Garantía de vicios ocultos ──

export type WarrantyStatus = "vigente" | "proxima_expiracion" | "expirada";

export interface WarrantyCoverageSection {
  category: string;
  items: string[];
}

export interface Warranty {
  id: string;
  propertyId: string;
  name: string;
  shortDescription: string;
  description: string;
  coverageIntro: string;
  coverageSections: WarrantyCoverageSection[];
  exclusionsIntro: string;
  exclusions: string[];
  startDate: string;
  durationMonths: number;
  legalReference: string;
}

// ── Incidencias ──

export type IncidentStatus = "abierto" | "en_revision" | "resuelto" | "cerrado";
export type IncidentSeverity = "baja" | "media" | "alta" | "urgente";
export type IncidentCategory =
  | "electrico"
  | "plomeria"
  | "acabados"
  | "electrodomestico"
  | "estructura"
  | "otro";

export interface IncidentTimelineEvent {
  id: string;
  type:
    | "creado"
    | "asignado"
    | "tecnico_visita"
    | "resolucion_propuesta"
    | "cerrado"
    | "comentario";
  timestamp: string;
  actor: "cliente" | "ops" | "tecnico";
  message: string;
}

export interface Incident {
  id: string;
  propertyId: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  category: IncidentCategory;
  title: string;
  description: string;
  photos: string[];
  warrantyClaimed?: boolean;
  createdAt: string;
  lastUpdatedAt: string;
  timeline: IncidentTimelineEvent[];
}

// ── Manuales ──

export type ManualCategory =
  | "electrodomesticos"
  | "mantenimiento"
  | "garantia"
  | "planos";

export interface Manual {
  id: string;
  propertyId: string;
  category: ManualCategory;
  name: string;
  description?: string;
  fileExtension: "pdf";
  fileSize: number;
  url: string;
  lastUpdated: string;
}

// ── Initial state ──

const initialWarranties: Warranty[] = [
  {
    id: "warranty-margot-707",
    propertyId: "margot-707",
    name: "Garantía de vicios ocultos",
    shortDescription: "1 año desde la entrega",
    description:
      "SOZU otorga 1 año de garantía sobre defectos preexistentes no visibles al momento de la entrega de tu propiedad, conforme al contrato de compraventa y al Código Civil Federal. Cubre todos los elementos físicos de tu unidad y las áreas comunes del condominio en lo que te corresponde como copropietario.",
    coverageIntro:
      "Esta garantía cubre todos los defectos ocultos en los siguientes elementos de tu propiedad:",
    coverageSections: [
      {
        category: "Estructura",
        items: [
          "Cimentación y zapatas",
          "Estructura portante (muros de carga, columnas, vigas)",
          "Losas de entrepiso y azotea",
          "Elementos estructurales de áreas comunes",
        ],
      },
      {
        category: "Impermeabilización",
        items: [
          "Azoteas y techos",
          "Baños y áreas húmedas",
          "Cocina y zona de lavado",
          "Juntas de dilatación y sellos perimetrales",
        ],
      },
      {
        category: "Instalaciones",
        items: [
          "Instalación eléctrica (cableado, centros de carga, contactos)",
          "Instalación hidráulica y sanitaria",
          "Instalación de gas",
          "Equipo hidroneumático y sistema de bombeo del condominio",
          "Detectores de humo y gas",
        ],
      },
      {
        category: "Acabados",
        items: [
          "Pisos y zoclos",
          "Plafones y pintura",
          "Carpintería y herrería",
          "Vidrios y cancelería",
          "Mobiliario fijo (cocina, closets, vanidades de baño)",
        ],
      },
    ],
    exclusionsIntro: "Esta garantía NO cubre los siguientes casos:",
    exclusions: [
      "Desgaste normal por uso de instalaciones y acabados",
      "Modificaciones, remodelaciones o instalaciones realizadas por el cliente",
      "Daños accidentales, por terceros o caso fortuito",
      "Falta de mantenimiento preventivo a cargo del cliente",
      "Defectos manifiestos visibles al momento de la entrega",
      "Daños derivados de uso indebido de la propiedad",
    ],
    startDate: "2024-08-15T00:00:00",
    durationMonths: 12,
    legalReference: "Código Civil Federal, artículos 2142 a 2161",
  },
];

const initialIncidents: Incident[] = [
  {
    id: "inc-margot-707-001",
    propertyId: "margot-707",
    status: "cerrado",
    severity: "media",
    category: "plomeria",
    title: "Filtración en baño principal",
    description:
      "Apareció una mancha de humedad en el techo del baño principal, debajo de la regadera del piso superior. No era visible al momento de la entrega.",
    photos: ["filtracion-bano-1.jpg", "filtracion-bano-2.jpg"],
    warrantyClaimed: true,
    createdAt: "2025-03-12T14:30:00",
    lastUpdatedAt: "2025-03-22T11:00:00",
    timeline: [
      { id: "ev-001-1", type: "creado", timestamp: "2025-03-12T14:30:00", actor: "cliente", message: "Reporte inicial con 2 fotos. Reclamado bajo garantía de vicios ocultos." },
      { id: "ev-001-2", type: "asignado", timestamp: "2025-03-13T09:15:00", actor: "ops", message: "Procedente bajo garantía. Asignado al equipo de impermeabilización." },
      { id: "ev-001-3", type: "tecnico_visita", timestamp: "2025-03-15T10:00:00", actor: "tecnico", message: "Sello defectuoso en juntas del baño superior. Se procede a re-impermeabilizar." },
      { id: "ev-001-4", type: "resolucion_propuesta", timestamp: "2025-03-20T16:00:00", actor: "tecnico", message: "Trabajos completados. Reparación bajo garantía sin costo." },
      { id: "ev-001-5", type: "cerrado", timestamp: "2025-03-22T11:00:00", actor: "cliente", message: "Cliente confirmó resolución satisfactoria." },
    ],
  },
  {
    id: "inc-margot-707-002",
    propertyId: "margot-707",
    status: "en_revision",
    severity: "baja",
    category: "electrodomestico",
    title: "Calentador de agua tarda en encender",
    description:
      "El calentador del baño principal tarda aproximadamente 30 segundos en encender cuando se abre el agua caliente.",
    photos: [],
    warrantyClaimed: true,
    createdAt: "2026-04-28T09:00:00",
    lastUpdatedAt: "2026-04-30T15:45:00",
    timeline: [
      { id: "ev-002-1", type: "creado", timestamp: "2026-04-28T09:00:00", actor: "cliente", message: "Reporte inicial sin fotos. Reclamado bajo garantía." },
      { id: "ev-002-2", type: "asignado", timestamp: "2026-04-30T15:45:00", actor: "ops", message: "Asignado a técnico de electromecánica. Próxima visita: 5 de mayo." },
    ],
  },
];

const MOCK_PDF_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

const initialManuals: Manual[] = [
  { id: "manual-margot-707-001", propertyId: "margot-707", category: "electrodomesticos", name: "Calentador Cinsa modelo C-2010", description: "Manual de operación, mantenimiento y limpieza del calentador instalado.", fileExtension: "pdf", fileSize: 1240000, url: MOCK_PDF_URL, lastUpdated: "2024-08-15T00:00:00" },
  { id: "manual-margot-707-002", propertyId: "margot-707", category: "electrodomesticos", name: "Extractor Spar serie X3", description: "Manual de instalación, uso y limpieza.", fileExtension: "pdf", fileSize: 870000, url: MOCK_PDF_URL, lastUpdated: "2024-08-15T00:00:00" },
  { id: "manual-margot-707-003", propertyId: "margot-707", category: "electrodomesticos", name: "Aire acondicionado LG inverter", description: "Manual técnico, garantía y recomendaciones de uso eficiente.", fileExtension: "pdf", fileSize: 2340000, url: MOCK_PDF_URL, lastUpdated: "2024-08-15T00:00:00" },
  { id: "manual-margot-707-004", propertyId: "margot-707", category: "mantenimiento", name: "Guía de mantenimiento preventivo", description: "Calendario sugerido de mantenimientos por área de tu unidad.", fileExtension: "pdf", fileSize: 540000, url: MOCK_PDF_URL, lastUpdated: "2024-08-15T00:00:00" },
  { id: "manual-margot-707-005", propertyId: "margot-707", category: "garantia", name: "Póliza oficial SOZU - Margot 707", description: "Documento legal con la garantía de vicios ocultos firmada al momento de la entrega.", fileExtension: "pdf", fileSize: 980000, url: MOCK_PDF_URL, lastUpdated: "2024-08-15T00:00:00" },
  { id: "manual-margot-707-006", propertyId: "margot-707", category: "planos", name: "Plano arquitectónico unidad 707", description: "Plano de planta de tu departamento con cotas y áreas.", fileExtension: "pdf", fileSize: 1800000, url: MOCK_PDF_URL, lastUpdated: "2024-08-15T00:00:00" },
  { id: "manual-margot-707-007", propertyId: "margot-707", category: "planos", name: "Plano de instalaciones eléctricas", description: "Ubicación de cajas, circuitos y centros de carga.", fileExtension: "pdf", fileSize: 1450000, url: MOCK_PDF_URL, lastUpdated: "2024-08-15T00:00:00" },
];

// ── Zustand store ──

interface PostDeliveryState {
  warranties: Warranty[];
  incidents: Incident[];
  manuals: Manual[];
  createIncident: (
    data: Omit<Incident, "id" | "createdAt" | "lastUpdatedAt" | "timeline" | "status">,
  ) => string;
  addIncidentComment: (incidentId: string, message: string) => void;
  closeIncident: (incidentId: string) => void;
  reset: () => void;
}

export const usePostDeliveryStore = create<PostDeliveryState>((set, get) => ({
  warranties: structuredClone(initialWarranties),
  incidents: structuredClone(initialIncidents),
  manuals: structuredClone(initialManuals),

  createIncident: (data) => {
    const newId = `inc-${data.propertyId}-${Date.now()}`;
    const now = new Date().toISOString();
    const newIncident: Incident = {
      ...data,
      id: newId,
      status: "abierto",
      createdAt: now,
      lastUpdatedAt: now,
      timeline: [
        {
          id: `ev-${newId}-1`,
          type: "creado",
          timestamp: now,
          actor: "cliente",
          message:
            data.photos.length > 0
              ? `Reporte inicial con ${data.photos.length} foto(s).`
              : "Reporte inicial sin fotos.",
        },
      ],
    };
    set({ incidents: [newIncident, ...get().incidents] });
    return newId;
  },

  addIncidentComment: (incidentId, message) => {
    const incidents = get().incidents.map((inc) => {
      if (inc.id !== incidentId) return inc;
      const now = new Date().toISOString();
      const event: IncidentTimelineEvent = {
        id: `ev-${incidentId}-${Date.now()}`,
        type: "comentario",
        timestamp: now,
        actor: "cliente",
        message,
      };
      return { ...inc, lastUpdatedAt: now, timeline: [...inc.timeline, event] };
    });
    set({ incidents });
  },

  closeIncident: (incidentId) => {
    const incidents = get().incidents.map((inc) => {
      if (inc.id !== incidentId) return inc;
      const now = new Date().toISOString();
      const event: IncidentTimelineEvent = {
        id: `ev-${incidentId}-${Date.now()}`,
        type: "cerrado",
        timestamp: now,
        actor: "cliente",
        message: "Cliente confirmó resolución satisfactoria.",
      };
      return {
        ...inc,
        status: "cerrado" as const,
        lastUpdatedAt: now,
        timeline: [...inc.timeline, event],
      };
    });
    set({ incidents });
  },

  reset: () =>
    set({
      warranties: structuredClone(initialWarranties),
      incidents: structuredClone(initialIncidents),
      manuals: structuredClone(initialManuals),
    }),
}));

// ── Computed helpers ──

export function computeWarrantyDates(warranty: Warranty): {
  expirationDate: Date;
  status: WarrantyStatus;
  monthsRemaining: number;
  daysRemaining: number;
} {
  const start = new Date(warranty.startDate);
  const expiration = new Date(start);
  expiration.setMonth(expiration.getMonth() + warranty.durationMonths);
  const now = new Date();
  const msInDay = 1000 * 60 * 60 * 24;
  const daysRemaining = (expiration.getTime() - now.getTime()) / msInDay;
  const monthsRemaining = daysRemaining / 30.44;
  let status: WarrantyStatus;
  if (daysRemaining <= 0) status = "expirada";
  else if (daysRemaining <= 90) status = "proxima_expiracion";
  else status = "vigente";
  return { expirationDate: expiration, status, monthsRemaining, daysRemaining };
}

export function getWarrantyStatusInfo(status: WarrantyStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "vigente":
      return { label: "Vigente", className: "bg-success/10 text-success" };
    case "proxima_expiracion":
      return { label: "Próxima a expirar", className: "bg-warning/10 text-warning" };
    case "expirada":
      return { label: "Expirada", className: "bg-destructive/10 text-destructive" };
  }
}

export function getIncidentStatusInfo(status: IncidentStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "abierto":
      return { label: "Abierto", className: "bg-primary/10 text-primary" };
    case "en_revision":
      return { label: "En revisión", className: "bg-warning/10 text-warning" };
    case "resuelto":
      return { label: "Resuelto", className: "bg-success/10 text-success" };
    case "cerrado":
      return { label: "Cerrado", className: "bg-muted text-muted-foreground" };
  }
}

export function getIncidentCategoryLabel(category: IncidentCategory): string {
  return (
    {
      electrico: "Eléctrico",
      plomeria: "Plomería",
      acabados: "Acabados",
      electrodomestico: "Electrodoméstico",
      estructura: "Estructura",
      otro: "Otro",
    } as const
  )[category];
}

export function getManualCategoryLabel(category: ManualCategory): string {
  return (
    {
      electrodomesticos: "Electrodomésticos",
      mantenimiento: "Mantenimiento",
      garantia: "Garantía legal",
      planos: "Planos",
    } as const
  )[category];
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Hooks reactivos ──

export function useWarrantyForProperty(propertyId: string): Warranty | undefined {
  return usePostDeliveryStore((s) => s.warranties.find((w) => w.propertyId === propertyId));
}

export function useIncidentsForProperty(propertyId: string): Incident[] {
  const incidents = usePostDeliveryStore((s) => s.incidents);
  return useMemo(
    () =>
      incidents
        .filter((i) => i.propertyId === propertyId)
        .sort(
          (a, b) =>
            new Date(b.lastUpdatedAt).getTime() -
            new Date(a.lastUpdatedAt).getTime(),
        ),
    [incidents, propertyId],
  );
}

export function useManualsForProperty(propertyId: string): Manual[] {
  const manuals = usePostDeliveryStore((s) => s.manuals);
  return useMemo(
    () => manuals.filter((m) => m.propertyId === propertyId),
    [manuals, propertyId],
  );
}

// Legacy
export function getWarrantyForProperty(propertyId: string): Warranty | undefined {
  return usePostDeliveryStore.getState().warranties.find((w) => w.propertyId === propertyId);
}

export function getIncidentsForProperty(propertyId: string): Incident[] {
  return usePostDeliveryStore.getState().incidents.filter((i) => i.propertyId === propertyId);
}

export function getIncidentById(id: string): Incident | undefined {
  return usePostDeliveryStore.getState().incidents.find((i) => i.id === id);
}
