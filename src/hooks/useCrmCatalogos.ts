// Catálogos del CRM (estados de lead, categorías, propietarios), extraídos de crm.tsx.
// Fetchers + hook reutilizados por la lista de contactos, la ficha y los diálogos.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Catálogo fijo de estados de lead: fallback cuando crm_estados_lead no existe o está vacía.
export const META_LEAD_STATUSES: { value: string; label: string; color?: string }[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "en_curso", label: "En curso" },
  { value: "negocio_abierto", label: "Negocio abierto" },
  { value: "sin_calificar", label: "Sin calificar" },
  { value: "intento_contacto", label: "Intento de contacto" },
  { value: "conectado", label: "Conectado" },
  { value: "programo_cita", label: "Programó cita" },
  { value: "asistio_cita", label: "Asistió a cita" },
  { value: "fuera_presupuesto", label: "Fuera de presupuesto" },
  { value: "compra_futura", label: "Compra futura" },
  { value: "sin_respuesta_7", label: "Sin respuesta 7+" },
  { value: "tiempo_entrega", label: "Tiempo de entrega" },
  { value: "asesor_inmobiliario", label: "Asesor inmobiliario" },
  { value: "registro_error", label: "Registro por error" },
  { value: "proveedor", label: "Proveedor" },
  { value: "fuera_area", label: "Fuera del área" },
];

// Estados de lead configurables (tabla crm_estados_lead, administrable en Configuración
// › Estados de lead). Si la tabla aún no existe o está vacía, cae al catálogo fijo de
// arriba para no romper. La `clave` es el valor guardado en crm_leads_atribucion.estatus_lead.
export type LeadStateOpt = { value: string; label: string; color?: string };
export const fetchLeadStates = async (): Promise<LeadStateOpt[]> => {
  const { data, error } = await (supabase as any)
    .from("crm_estados_lead")
    .select("clave, nombre, color, orden")
    .eq("activo", true)
    .order("orden");
  if (error || !data || data.length === 0) return META_LEAD_STATUSES;
  return data.map((r: any) => ({ value: r.clave, label: r.nombre, color: r.color ?? undefined }));
};
export const useLeadStates = () => useQuery({ queryKey: ["crm-estados-lead"], queryFn: fetchLeadStates });

export const fetchCrmCategorias = async (): Promise<{ id: number; nombre: string }[]> => {
  const { data, error } = await (supabase as any)
    .from("crm_categorias")
    .select("id, nombre")
    .eq("activo", true)
    .order("orden");
  if (error) return []; // tabla aún no desplegada en este ambiente → sin categorías
  return data ?? [];
};

export type CrmOwner = { id: string; full_name: string; email: string };

// Propietarios posibles del CRM = usuarios activos cuyo rol tiene acceso a alguna
// ruta /admin/portal-crm/... (mismo criterio que el selector "Ver como"). Se deriva
// dinámicamente en vez de hardcodear rol_ids: así incluye Super Admin, Agente Interno,
// Admin CRM y cualquier otro rol admin del CRM (p. ej. el que solo existe en producción)
// sin depender del ambiente. Fallback a [1, 9] si aún no hay submenús del CRM en BD.
export const fetchCrmOwners = async (): Promise<CrmOwner[]> => {
  let rolIds: number[] = [];
  const { data: subs } = await (supabase as any)
    .from("submenus")
    .select("id")
    .like("vista_front_end", "/admin/portal-crm/%");
  const submenuIds = (subs ?? []).map((s: any) => s.id);
  if (submenuIds.length) {
    const { data: perms } = await (supabase as any)
      .from("submenus_permisos")
      .select("rol_id")
      .in("submenu_id", submenuIds)
      .eq("activo", true);
    rolIds = Array.from(new Set((perms ?? []).map((p: any) => p.rol_id)));
  }
  if (!rolIds.length) rolIds = [1, 9]; // fallback: Super Admin + Agente Interno
  const { data } = await (supabase as any)
    .from("usuarios")
    .select("auth_user_id, nombre, email")
    .eq("activo", true)
    .in("rol_id", rolIds);
  return (data ?? [])
    .map((u: any) => ({ id: u.auth_user_id, full_name: u.nombre, email: u.email }))
    .sort((a: CrmOwner, b: CrmOwner) => (a.full_name ?? "").localeCompare(b.full_name ?? "")) as CrmOwner[];
};
