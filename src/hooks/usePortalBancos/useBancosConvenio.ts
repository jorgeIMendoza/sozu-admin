import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bancos con los que SOZU tiene convenio — fuente de verdad real.
 *
 * Lee `public.bancos_convenio` (metadata de convenio) unida al catálogo real
 * `public.bancos`. Reemplaza la constante mock `BANKS` del Portal Bancos.
 *
 * Probe graceful: si la tabla aún no existe en BD (DDL pendiente de aplicar,
 * ver `Ejecuciones_manuales/portal_bancos_administrador.md`), las consultas
 * devuelven `[]` en vez de romper la UI.
 */

export interface BancoConvenio {
  id: number;
  id_banco: number;
  nombre: string;
  color_marca: string | null;
  producto_nombre: string | null;
  tasa_desde: number | null;
  orden: number;
  activo: boolean;
}

export interface BancoCatalogo {
  id: number;
  nombre: string;
  activo: boolean;
}

const CONVENIO_KEY = ["bancos-convenio"] as const;

async function fetchBancosConvenio(): Promise<BancoConvenio[]> {
  const { data, error } = await (supabase as any)
    .from("bancos_convenio")
    .select(
      "id, id_banco, color_marca, producto_nombre, tasa_desde, orden, activo, bancos!bancos_convenio_id_banco_fkey(nombre)",
    )
    .order("orden", { ascending: true });
  // Tabla inexistente / error → degradar a lista vacía (no romper el portal).
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    id_banco: r.id_banco,
    nombre: r.bancos?.nombre ?? `Banco ${r.id_banco}`,
    color_marca: r.color_marca ?? null,
    producto_nombre: r.producto_nombre ?? null,
    tasa_desde: r.tasa_desde != null ? Number(r.tasa_desde) : null,
    orden: r.orden ?? 100,
    activo: !!r.activo,
  }));
}

export function useBancosConvenio() {
  return useQuery({
    queryKey: CONVENIO_KEY,
    queryFn: fetchBancosConvenio,
    staleTime: 60_000,
  });
}

/** Catálogo completo de bancos (para el selector de "Agregar banco a convenio"). */
export function useBancosCatalogo() {
  return useQuery({
    queryKey: ["bancos-catalogo"],
    queryFn: async (): Promise<BancoCatalogo[]> => {
      const { data, error } = await (supabase as any)
        .from("bancos")
        .select("id, nombre, activo")
        .eq("activo", true)
        .order("nombre", { ascending: true });
      if (error || !data) return [];
      return data as BancoCatalogo[];
    },
    staleTime: 5 * 60_000,
  });
}

export interface NuevoBancoConvenio {
  id_banco: number;
  color_marca?: string | null;
  producto_nombre?: string | null;
  tasa_desde?: number | null;
  orden?: number | null;
}

/** Alta de un banco al convenio. */
export function useAgregarBancoConvenio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NuevoBancoConvenio) => {
      const { error } = await (supabase as any).from("bancos_convenio").insert({
        id_banco: input.id_banco,
        color_marca: input.color_marca ?? null,
        producto_nombre: input.producto_nombre ?? null,
        tasa_desde: input.tasa_desde ?? null,
        orden: input.orden ?? 100,
        activo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONVENIO_KEY }),
  });
}

/** Edición de metadata de un convenio existente. */
export function useActualizarBancoConvenio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: number;
      patch: Partial<Omit<BancoConvenio, "id" | "id_banco" | "nombre">>;
    }) => {
      const { error } = await (supabase as any)
        .from("bancos_convenio")
        .update({ ...patch, fecha_actualizacion: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONVENIO_KEY }),
  });
}

/** Baja/alta de un convenio (activo). */
export function useToggleBancoConvenioActivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const { error } = await (supabase as any)
        .from("bancos_convenio")
        .update({ activo, fecha_actualizacion: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONVENIO_KEY }),
  });
}
