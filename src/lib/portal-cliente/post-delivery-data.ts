// ── Post-entrega: data layer (garantía vicios ocultos + incidencias + manuales) ──

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

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

// ── DB → TS mappers ──

const DB_ESTATUS_MAP: Record<string, IncidentStatus> = {
  NUEVO: "abierto",
  EN_ATENCION: "en_revision",
  ASIGNADO: "en_revision",
  EN_REVISION: "en_revision",
  RESUELTO: "resuelto",
  CERRADO: "cerrado",
};

const DB_PRIORIDAD_MAP: Record<string, IncidentSeverity> = {
  BAJA: "baja",
  MEDIA: "media",
  ALTA: "alta",
  CRITICA: "urgente",
  URGENTE: "urgente",
};

// postventa_categorias_garantia IDs → IncidentCategory
const DB_CATEGORIA_MAP: Record<number, IncidentCategory> = {
  1: "electrico",   // Eléctrica
  2: "plomeria",    // Sanitaria
  3: "plomeria",    // Hidráulica
  4: "electrodomestico", // HVAC
  5: "electrodomestico", // Calentador/Boiler
  6: "acabados",    // Acabados
  7: "acabados",    // Carpintería
  8: "otro",        // Paquete Muebles
  9: "electrodomestico", // Electrodomésticos
};

// IncidentCategory → DB category id for inserts
const CATEGORIA_TO_DB_ID: Record<IncidentCategory, number> = {
  electrico: 1,
  plomeria: 3,
  acabados: 6,
  electrodomestico: 9,
  estructura: 6,
  otro: 1,
};

const DB_TIPO_EVENTO_MAP: Record<string, IncidentTimelineEvent["type"]> = {
  CREACION: "creado",
  ASIGNACION: "asignado",
  VISITA: "tecnico_visita",
  TECNICO_VISITA: "tecnico_visita",
  RESOLUCION: "resolucion_propuesta",
  CIERRE: "cerrado",
  COMENTARIO: "comentario",
  COMENTARIO_CLIENTE: "comentario",
};

// ── Static warranty content (same for all SOZU units) ──

const WARRANTY_CONTENT = {
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
  legalReference: "Código Civil Federal, artículos 2142 a 2161",
} satisfies Omit<Warranty, "id" | "propertyId" | "startDate" | "durationMonths">;

// ── DB row shapes ──

interface TicketRow {
  id: number;
  id_cuenta_cobranza: number | null;
  id_postventa_categoria_garantia: number;
  subcategoria: string;
  descripcion: string;
  prioridad: string;
  estatus: string;
  es_reclamo_garantia: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
  postventa_log_actividades: LogRow[];
  postventa_evidencias: EvidenciaRow[];
}

interface LogRow {
  id: number;
  tipo_evento: string;
  descripcion: string;
  fecha_creacion: string;
}

interface EvidenciaRow {
  id: number;
  url: string;
  tipo_archivo: string;
}

interface GarantiaRow {
  id: number;
  id_propiedad: number;
  fecha_inicio: string;
  fecha_vencimiento: string;
}

interface ManualRow {
  id: number;
  id_propiedad: number | null;
  categoria: ManualCategory;
  nombre: string;
  descripcion: string | null;
  url: string;
  tamano_bytes: number;
  fecha_creacion: string;
}

// ── Internal mappers ──

function inferActor(tipoEvento: string): "cliente" | "ops" | "tecnico" {
  if (tipoEvento === "CREACION" || tipoEvento === "COMENTARIO_CLIENTE") return "cliente";
  if (
    tipoEvento === "VISITA" ||
    tipoEvento === "TECNICO_VISITA" ||
    tipoEvento === "RESOLUCION"
  )
    return "tecnico";
  return "ops";
}

function mapTicket(row: TicketRow): Incident {
  return {
    id: String(row.id),
    propertyId: String(row.id_cuenta_cobranza ?? 0),
    status: DB_ESTATUS_MAP[row.estatus] ?? "abierto",
    severity: DB_PRIORIDAD_MAP[row.prioridad] ?? "media",
    category: DB_CATEGORIA_MAP[row.id_postventa_categoria_garantia] ?? "otro",
    title: row.subcategoria,
    description: row.descripcion,
    photos: row.postventa_evidencias
      .filter((e) => e.tipo_archivo === "FOTO")
      .map((e) => e.url),
    warrantyClaimed: row.es_reclamo_garantia,
    createdAt: row.fecha_creacion,
    lastUpdatedAt: row.fecha_actualizacion,
    timeline: row.postventa_log_actividades.map((log) => ({
      id: String(log.id),
      type: DB_TIPO_EVENTO_MAP[log.tipo_evento] ?? "comentario",
      timestamp: log.fecha_creacion,
      actor: inferActor(log.tipo_evento),
      message: log.descripcion,
    })),
  };
}

// ── Hooks ──

export function useIncidentsForCuenta(cuentaId: string | undefined) {
  return useQuery({
    queryKey: ["incidents", cuentaId],
    queryFn: async (): Promise<Incident[]> => {
      const { data, error } = await supabase
        .from("postventa_tickets")
        .select(
          `id, id_cuenta_cobranza, id_postventa_categoria_garantia,
           subcategoria, descripcion, prioridad, estatus, es_reclamo_garantia,
           fecha_creacion, fecha_actualizacion,
           postventa_log_actividades(id, tipo_evento, descripcion, fecha_creacion),
           postventa_evidencias(id, url, tipo_archivo)`,
        )
        .eq("id_cuenta_cobranza", Number(cuentaId))
        .eq("activo", true)
        .order("fecha_actualizacion", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as TicketRow[]).map(mapTicket);
    },
    enabled: !!cuentaId,
    staleTime: 60_000,
  });
}

export function useWarrantyForCuenta(cuentaId: string | undefined) {
  return useQuery({
    queryKey: ["warranty", cuentaId],
    queryFn: async (): Promise<Warranty | null> => {
      const { data: cc, error: e0 } = await supabase
        .from("cuentas_cobranza")
        .select("id_propiedad")
        .eq("id", Number(cuentaId))
        .maybeSingle();
      if (e0) throw e0;
      if (!cc?.id_propiedad) return null;

      const { data: garantia, error: e1 } = await supabase
        .from("postventa_garantias_unidad")
        .select("id, id_propiedad, fecha_inicio, fecha_vencimiento")
        .eq("id_propiedad", cc.id_propiedad)
        .eq("activo", true)
        .order("fecha_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e1) throw e1;
      if (!garantia) return null;

      const g = garantia as GarantiaRow;
      const start = new Date(g.fecha_inicio);
      const end = new Date(g.fecha_vencimiento);
      const durationMonths = Math.round(
        (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth()),
      );

      return {
        id: String(g.id),
        propertyId: String(g.id_propiedad),
        ...WARRANTY_CONTENT,
        startDate: g.fecha_inicio,
        durationMonths,
      };
    },
    enabled: !!cuentaId,
    staleTime: 300_000,
  });
}

export function useManualesForCuenta(cuentaId: string | undefined) {
  return useQuery({
    queryKey: ["manuales", cuentaId],
    queryFn: async (): Promise<Manual[]> => {
      const { data, error } = await supabase
        .from("postventa_manuales")
        .select(
          "id, id_propiedad, categoria, nombre, descripcion, url, tamano_bytes, fecha_creacion",
        )
        .eq("id_cuenta_cobranza", Number(cuentaId))
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return ((data ?? []) as ManualRow[]).map((m) => ({
        id: String(m.id),
        propertyId: String(m.id_propiedad ?? 0),
        category: m.categoria,
        name: m.nombre,
        description: m.descripcion ?? undefined,
        fileExtension: "pdf" as const,
        fileSize: m.tamano_bytes,
        url: m.url,
        lastUpdated: m.fecha_creacion,
      }));
    },
    enabled: !!cuentaId,
    staleTime: 300_000,
  });
}

export function useCreateIncident(cuentaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      severity: IncidentSeverity;
      category: IncidentCategory;
      title: string;
      description: string;
      warrantyClaimed: boolean;
    }) => {
      const { data: cc } = await supabase
        .from("cuentas_cobranza")
        .select("id_propiedad")
        .eq("id", Number(cuentaId))
        .maybeSingle();

      const { error } = await supabase.from("postventa_tickets").insert({
        id_cuenta_cobranza: Number(cuentaId),
        id_propiedad: cc?.id_propiedad ?? null,
        id_postventa_categoria_garantia: CATEGORIA_TO_DB_ID[input.category],
        subcategoria: input.title,
        descripcion: input.description,
        prioridad: input.severity.toUpperCase(),
        es_reclamo_garantia: input.warrantyClaimed,
        canal_recepcion: "CLIENTE",
        estatus: "NUEVO",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents", cuentaId] }),
  });
}

export function useCloseIncident(cuentaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { error } = await supabase
        .from("postventa_tickets")
        .update({
          estatus: "CERRADO",
          fecha_confirmacion_cliente: new Date().toISOString(),
        })
        .eq("id", Number(incidentId));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents", cuentaId] }),
  });
}

// ── Pure helpers ──

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
