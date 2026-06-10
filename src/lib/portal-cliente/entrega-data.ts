import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface EntregaAppointment {
  date: string;
  time: string;
  location: string;
  contactName: string;
  contactPhone: string;
}

export interface DefectTicket {
  id: string;
  folio: string;
  category: string;
  description: string;
  location: string;
  photos: string[];
  status: "abierto" | "en_revision" | "en_proceso" | "resuelto";
  createdAt: string;
}

export interface EntregaData {
  propertyId: string;
  scheduledAppointment?: EntregaAppointment;
  deliveryAccepted: boolean;
  signatureDate?: string;
  tickets: DefectTicket[];
}

const ID_TIPO_CITA_ENTREGA = 7;

export function useEntregaData(idPropiedad?: number, projectId?: number) {
  const citaQuery = useQuery({
    queryKey: ["entrega-cita", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await (supabase as any)
        .from("reservas_citas")
        .select("id, fecha, hora_inicio, ubicacion, estatus, id_estatus_cita")
        .eq("id_tipo_cita", ID_TIPO_CITA_ENTREGA)
        .eq("id_proyecto", projectId)
        .eq("activo", true)
        .order("fecha", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!projectId,
  });

  const ticketsQuery = useQuery({
    queryKey: ["entrega-tickets", idPropiedad],
    queryFn: async () => {
      if (!idPropiedad) return [];
      const { data, error } = await (supabase as any)
        .from("postventa_tickets")
        .select(
          "id, subcategoria, descripcion, estatus, fecha_creacion, id_postventa_categoria_garantia",
        )
        .eq("id_propiedad", idPropiedad)
        .eq("activo", true)
        .order("fecha_creacion", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RawTicket[];
    },
    enabled: !!idPropiedad,
  });

  const cita = citaQuery.data;
  const scheduledAppointment: EntregaAppointment | undefined = cita
    ? {
        date: String(cita.fecha ?? ""),
        time: cita.hora_inicio ? String(cita.hora_inicio).slice(0, 5) : "",
        location: String(cita.ubicacion ?? ""),
        contactName: "",
        contactPhone: "",
      }
    : undefined;

  const tickets: DefectTicket[] = (ticketsQuery.data ?? []).map((t) => ({
    id: String(t.id),
    folio: `TKT-${String(t.id).padStart(5, "0")}`,
    category: String(t.subcategoria ?? "Sin categoría"),
    description: String(t.descripcion ?? ""),
    location: "",
    photos: [],
    status: mapEstatus(String(t.estatus ?? "abierto")),
    createdAt: String(t.fecha_creacion ?? ""),
  }));

  const entregaData: EntregaData = {
    propertyId: String(idPropiedad ?? ""),
    scheduledAppointment,
    deliveryAccepted: false,
    tickets,
  };

  return {
    data: entregaData,
    isLoading: citaQuery.isLoading || ticketsQuery.isLoading,
    error: citaQuery.error ?? ticketsQuery.error,
  };
}

interface RawTicket {
  id: number;
  subcategoria: string | null;
  descripcion: string | null;
  estatus: string | null;
  fecha_creacion: string | null;
  id_postventa_categoria_garantia: number | null;
}

function mapEstatus(raw: string): DefectTicket["status"] {
  const map: Record<string, DefectTicket["status"]> = {
    abierto: "abierto",
    en_revision: "en_revision",
    en_proceso: "en_proceso",
    resuelto: "resuelto",
  };
  return map[raw] ?? "abierto";
}

export const defectCategories = [
  "Acabados",
  "Instalaciones eléctricas",
  "Instalaciones hidráulicas",
  "Carpintería",
  "Equipamiento",
  "Herrería / Aluminio",
  "Pintura",
  "Pisos y azulejos",
  "Otro",
];

export const unitLocations = [
  "Sala / Comedor",
  "Cocina",
  "Recámara principal",
  "Recámara 2",
  "Baño principal",
  "Baño 2",
  "Balcón / Terraza",
  "Pasillo",
  "Área de lavado",
  "Clóset",
  "Entrada",
];
