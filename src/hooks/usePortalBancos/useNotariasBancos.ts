import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Notarías activas del Portal Bancos — réplica de la regla del Dashboard de
 * Notarías de Escrituración ("N notarías activas en este proyecto").
 *
 * Regla (por proyecto): una notaría es activa si `notarios.activo = true` y
 * tiene al menos una cuenta de cobranza asignada (`cuentas_cobranza.id_notario`)
 * entre las propiedades del proyecto, usando la cuenta representativa (la más
 * reciente por `fecha_actualizacion`) de cada propiedad — igual que el dashboard.
 *
 * En error/vacío devuelve `[]`.
 */

export interface NotariaContacto {
  id: number;
  /** Nombre de la notaría, p.ej. "Notaría 51, Guadalajara". */
  notaria: string;
  /** Titular / persona de contacto. */
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  /** Escrituras (cuentas) asignadas a esta notaría en el proyecto. */
  escriturasAsignadas: number;
}

export interface ProyectoOption {
  id: number;
  nombre: string;
}

/** Proyectos publicados de SOZU (id_tipo_entidad = 5), igual que el dashboard. */
export function useProyectosNotariasBancos() {
  return useQuery({
    queryKey: ["proyectos-notarias-bancos"],
    queryFn: async (): Promise<ProyectoOption[]> => {
      const { data: rels } = await (supabase as any)
        .from("entidades_relacionadas")
        .select("id_proyecto")
        .eq("id_tipo_entidad", 5)
        .eq("activo", true);
      const ids = ((rels ?? []) as any[]).map((r) => r.id_proyecto).filter(Boolean);
      if (!ids.length) return [];
      const { data } = await (supabase as any)
        .from("proyectos")
        .select("id, nombre")
        .in("id", ids)
        .eq("publicar", true)
        .eq("activo", true)
        .order("nombre");
      return (data ?? []) as ProyectoOption[];
    },
    staleTime: 60_000,
  });
}

async function fetchNotariasProyecto(proyectoId: number): Promise<NotariaContacto[]> {
  const sb = supabase as any;

  // Waterfall proyecto → propiedades (explícito, sin triple join).
  const { data: edificios } = await sb
    .from("edificios").select("id").eq("id_proyecto", proyectoId).eq("activo", true);
  if (!edificios?.length) return [];

  const { data: modelos } = await sb
    .from("edificios_modelos").select("id").in("id_edificio", edificios.map((e: any) => e.id));
  if (!modelos?.length) return [];

  const { data: props } = await sb
    .from("propiedades")
    .select("id")
    .eq("activo", true)
    .in("id_edificio_modelo", modelos.map((m: any) => m.id));
  if (!props?.length) return [];
  const propIds = props.map((p: any) => p.id);

  // Cuentas del proyecto → cuenta representativa (más reciente) por propiedad.
  const { data: cuentas } = await sb
    .from("cuentas_cobranza")
    .select("id, id_propiedad, id_notario, fecha_actualizacion")
    .eq("activo", true)
    .in("id_propiedad", propIds);
  if (!cuentas?.length) return [];

  const repByProp = new Map<number, any>();
  for (const c of cuentas as any[]) {
    const ex = repByProp.get(c.id_propiedad);
    if (!ex || (c.fecha_actualizacion ?? "") > (ex.fecha_actualizacion ?? "")) {
      repByProp.set(c.id_propiedad, c);
    }
  }

  // Conteo por notaría (solo cuentas representativas con notaría asignada).
  const countByNotario = new Map<number, number>();
  for (const c of repByProp.values()) {
    if (c.id_notario == null) continue;
    countByNotario.set(c.id_notario, (countByNotario.get(c.id_notario) || 0) + 1);
  }
  const notarioIds = [...countByNotario.keys()];
  if (!notarioIds.length) return [];

  // Datos de contacto de las notarías activas asignadas.
  const { data: notarios, error } = await sb
    .from("notarios")
    .select("id, notaria, nombre, email, telefono, direccion")
    .in("id", notarioIds)
    .eq("activo", true)
    .order("notaria", { ascending: true });
  if (error || !notarios) return [];

  return (notarios as any[]).map((n) => ({
    id: n.id,
    notaria: n.notaria,
    nombre: n.nombre ?? null,
    email: n.email ?? null,
    telefono: n.telefono ?? null,
    direccion: n.direccion ?? null,
    escriturasAsignadas: countByNotario.get(n.id) ?? 0,
  }));
}

export function useNotariasBancos(proyectoId: number | null | undefined) {
  return useQuery({
    queryKey: ["notarias-bancos", proyectoId],
    queryFn: () => fetchNotariasProyecto(proyectoId as number),
    enabled: proyectoId != null,
    staleTime: 60_000,
  });
}
