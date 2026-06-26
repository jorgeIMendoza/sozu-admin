import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Agentes/ejecutivos de contacto por banco — fuente de verdad real
 * (`public.bancos_agentes`). Reemplaza el mock `agents-store`.
 *
 * Son registros de contacto (sin acceso/login). Probe graceful: si la tabla
 * aún no existe, las consultas devuelven `[]`.
 */

export type AgenteRol = "agente" | "admin";

export interface BancoAgente {
  id: number;
  id_banco: number;
  nombre: string;
  email: string | null;
  telefono: string | null;
  rol: AgenteRol;
  activo: boolean;
}

const KEY = (idBanco?: number | null) => ["bancos-agentes", idBanco ?? "all"] as const;

export function useBancosAgentes(idBanco?: number | null) {
  return useQuery({
    queryKey: KEY(idBanco),
    enabled: idBanco != null,
    staleTime: 60_000,
    queryFn: async (): Promise<BancoAgente[]> => {
      if (idBanco == null) return [];
      const { data, error } = await (supabase as any)
        .from("bancos_agentes")
        .select("id, id_banco, nombre, email, telefono, rol, activo")
        .eq("id_banco", idBanco)
        .order("activo", { ascending: false })
        .order("nombre", { ascending: true });
      if (error || !data) return [];
      return (data as any[]).map((a) => ({
        id: a.id,
        id_banco: a.id_banco,
        nombre: a.nombre ?? "",
        email: a.email ?? null,
        telefono: a.telefono ?? null,
        rol: (a.rol === "admin" ? "admin" : "agente") as AgenteRol,
        activo: !!a.activo,
      }));
    },
  });
}

export interface NuevoAgente {
  id_banco: number;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  rol?: AgenteRol;
}

export function useCrearAgente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NuevoAgente) => {
      const { error } = await (supabase as any).from("bancos_agentes").insert({
        id_banco: input.id_banco,
        nombre: input.nombre,
        email: input.email ?? null,
        telefono: input.telefono ?? null,
        rol: input.rol ?? "agente",
        activo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bancos-agentes"] }),
  });
}

export function useActualizarAgente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: number;
      patch: Partial<Omit<BancoAgente, "id" | "id_banco">>;
    }) => {
      const { error } = await (supabase as any)
        .from("bancos_agentes")
        .update({ ...patch, fecha_actualizacion: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bancos-agentes"] }),
  });
}

export function useSetActivoAgente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const { error } = await (supabase as any)
        .from("bancos_agentes")
        .update({ activo, fecha_actualizacion: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bancos-agentes"] }),
  });
}
