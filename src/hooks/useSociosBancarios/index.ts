import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProyectosSozuIds } from "@/hooks/usePortalSocioBancario/proyectosSozu";

/**
 * Admin de Socios Bancarios (solo Super Administrador).
 *
 * Modelo (M:N) — ver Ejecuciones_manuales/portal_socio_bancario_admin.md:
 *   socios_bancarios · socio_bancario_desarrollos · usuarios_socio_bancario.
 *
 * // SWAP POINT: nombres reales de tablas/columnas (confirmar con Jorge). Probe
 * graceful: si las tablas aún no existen, las consultas devuelven vacío y
 * `tablesMissing=true` para que el admin muestre un banner honesto (no rompe).
 * Sin hard-delete: baja = estado 'inactivo' + auditoría. Contraseñas: nunca —
 * el alta de usuario dispara invitación de Supabase Auth (edge function).
 */

export type EstadoSocio = "activo" | "inactivo";
export type EstadoUsuarioSocio = "invitado" | "activo" | "inactivo";

export interface SocioBancario {
  id: number;
  nombre: string;
  razon_social: string | null;
  rfc: string | null;
  estado: EstadoSocio;
}

export interface SocioBancarioListItem extends SocioBancario {
  desarrollosActivos: number;
  usuariosActivos: number;
}

export interface DesarrolloAsignado {
  id: number;
  id_desarrollo: number;
  nombre: string | null;
  estado: EstadoSocio;
}

export interface UsuarioSocio {
  id: number;
  id_socio_bancario: number;
  nombre: string | null;
  correo: string;
  telefono: string | null;
  estado: EstadoUsuarioSocio;
  ultimo_acceso: string | null;
}

/** Mensaje real de un error de functions.invoke (el motivo vive en error.context). */
async function extractInvokeError(error: any): Promise<string> {
  const ctx = error?.context;
  try {
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } else if (ctx && typeof ctx.text === "function") {
      const t = await ctx.text();
      if (t) return t;
    }
  } catch {
    /* cuerpo no-JSON o consumido */
  }
  return error?.message ?? "Error desconocido";
}

// ── Lista de bancos con conteos ─────────────────────────────
export function useSociosBancarios() {
  const query = useQuery({
    queryKey: ["socios-bancarios"],
    staleTime: 60_000,
    queryFn: async (): Promise<{ items: SocioBancarioListItem[]; tablesMissing: boolean }> => {
      const { data: socios, error } = await (supabase as any)
        .from("socios_bancarios")
        .select("id, nombre, razon_social, rfc, estado")
        .order("nombre", { ascending: true });
      if (error) return { items: [], tablesMissing: true }; // tabla ausente → banner honesto
      const list = (socios ?? []) as SocioBancario[];
      if (!list.length) return { items: [], tablesMissing: false };

      const ids = list.map((s) => s.id);
      const [{ data: desas }, { data: usrs }] = await Promise.all([
        (supabase as any)
          .from("socio_bancario_desarrollos")
          .select("id_socio_bancario, estado")
          .in("id_socio_bancario", ids)
          .eq("estado", "activo"),
        (supabase as any)
          .from("usuarios_socio_bancario")
          .select("id_socio_bancario, estado")
          .in("id_socio_bancario", ids)
          .eq("estado", "activo"),
      ]);
      const countBy = (rows: any[] | null) => {
        const m = new Map<number, number>();
        (rows ?? []).forEach((r) => m.set(r.id_socio_bancario, (m.get(r.id_socio_bancario) ?? 0) + 1));
        return m;
      };
      const dMap = countBy(desas);
      const uMap = countBy(usrs);
      return {
        items: list.map((s) => ({
          ...s,
          desarrollosActivos: dMap.get(s.id) ?? 0,
          usuariosActivos: uMap.get(s.id) ?? 0,
        })),
        tablesMissing: false,
      };
    },
  });
  return {
    items: query.data?.items ?? [],
    tablesMissing: query.data?.tablesMissing ?? false,
    isLoading: query.isLoading,
  };
}

/**
 * Opciones de desarrollos que SOZU comercializa (solo estos son asignables).
 * Regla dura del brief: nunca asignar un desarrollo no-SOZU.
 */
export function useProyectosSozuOpciones() {
  return useQuery({
    queryKey: ["proyectos-sozu-opciones"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<DesarrolloAsignado[]> => {
      const ids = [...(await fetchProyectosSozuIds())];
      if (!ids.length) return [];
      const { data } = await (supabase as any)
        .from("proyectos")
        .select("id, nombre")
        .in("id", ids)
        .eq("activo", true)
        .order("nombre", { ascending: true });
      return ((data ?? []) as any[]).map((p) => ({
        id: p.id,
        id_desarrollo: p.id,
        nombre: (p.nombre ?? null) as string | null,
        estado: "activo" as EstadoSocio,
      }));
    },
  });
}

// ── Detalle de un banco ─────────────────────────────────────
export function useSocioBancarioDetalle(id: number | null) {
  return useQuery({
    queryKey: ["socio-bancario-detalle", id],
    enabled: id != null,
    staleTime: 30_000,
    queryFn: async (): Promise<SocioBancario | null> => {
      const { data, error } = await (supabase as any)
        .from("socios_bancarios")
        .select("id, nombre, razon_social, rfc, estado")
        .eq("id", id)
        .maybeSingle();
      if (error) return null;
      return (data as SocioBancario) ?? null;
    },
  });
}

// ── Desarrollos asignados a un banco (activos) ──────────────
export function useDesarrollosAsignados(idSocio: number | null) {
  return useQuery({
    queryKey: ["socio-bancario-asignados", idSocio],
    enabled: idSocio != null,
    staleTime: 30_000,
    queryFn: async (): Promise<DesarrolloAsignado[]> => {
      const { data, error } = await (supabase as any)
        .from("socio_bancario_desarrollos")
        .select("id, id_desarrollo, estado")
        .eq("id_socio_bancario", idSocio)
        .eq("estado", "activo");
      if (error || !data?.length) return [];
      const ids = (data as any[]).map((r) => r.id_desarrollo).filter((v: any) => v != null);
      const { data: proys } = ids.length
        ? await (supabase as any).from("proyectos").select("id, nombre").in("id", ids)
        : { data: [] };
      const nombreById = new Map<number, string | null>(
        ((proys ?? []) as any[]).map((p) => [p.id, p.nombre ?? null]),
      );
      return (data as any[]).map((r) => ({
        id: r.id,
        id_desarrollo: r.id_desarrollo,
        nombre: nombreById.get(r.id_desarrollo) ?? null,
        estado: r.estado as EstadoSocio,
      }));
    },
  });
}

// ── Usuarios de un banco ────────────────────────────────────
export function useUsuariosSocioBancario(idSocio: number | null) {
  return useQuery({
    queryKey: ["socio-bancario-usuarios", idSocio],
    enabled: idSocio != null,
    staleTime: 30_000,
    queryFn: async (): Promise<UsuarioSocio[]> => {
      const { data, error } = await (supabase as any)
        .from("usuarios_socio_bancario")
        .select("id, id_socio_bancario, nombre, correo, telefono, estado, ultimo_acceso")
        .eq("id_socio_bancario", idSocio)
        .order("nombre", { ascending: true });
      if (error || !data) return [];
      return data as UsuarioSocio[];
    },
  });
}

// ── Mutaciones ──────────────────────────────────────────────
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["socios-bancarios"] });
    qc.invalidateQueries({ queryKey: ["socio-bancario-detalle"] });
    qc.invalidateQueries({ queryKey: ["socio-bancario-asignados"] });
    qc.invalidateQueries({ queryKey: ["socio-bancario-usuarios"] });
  };
}

export function useCrearSocioBancario() {
  const invalidate = useInvalidate();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (input: { nombre: string; razon_social?: string | null; rfc?: string | null }) => {
      const { error } = await (supabase as any).from("socios_bancarios").insert({
        nombre: input.nombre.trim(),
        razon_social: input.razon_social?.trim() || null,
        rfc: input.rfc?.trim() || null,
        estado: "activo",
        created_by: profile?.email ?? null, // auditoría
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useToggleSocioBancario() {
  const invalidate = useInvalidate();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({ id, activar }: { id: number; activar: boolean }) => {
      // Soft-disable: nunca hard-delete.
      const patch: Record<string, any> = { estado: activar ? "activo" : "inactivo" };
      if (!activar) {
        patch.revoked_by = profile?.email ?? null;
        patch.revoked_at = new Date().toISOString();
      }
      const { error } = await (supabase as any).from("socios_bancarios").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAsignarDesarrollo() {
  const invalidate = useInvalidate();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({ idSocio, idDesarrollo }: { idSocio: number; idDesarrollo: number }) => {
      // Reactivar si ya existía (evita duplicado); si no, insertar.
      const { data: existente } = await (supabase as any)
        .from("socio_bancario_desarrollos")
        .select("id")
        .eq("id_socio_bancario", idSocio)
        .eq("id_desarrollo", idDesarrollo)
        .maybeSingle();
      if (existente?.id) {
        const { error } = await (supabase as any)
          .from("socio_bancario_desarrollos")
          .update({ estado: "activo" })
          .eq("id", existente.id);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any).from("socio_bancario_desarrollos").insert({
        id_socio_bancario: idSocio,
        id_desarrollo: idDesarrollo, // regla solo-SOZU validada en UI + backend
        estado: "activo",
        created_by: profile?.email ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useQuitarDesarrollo() {
  const invalidate = useInvalidate();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      // Soft-disable de la asignación (auditable), no borrado.
      const { error } = await (supabase as any)
        .from("socio_bancario_desarrollos")
        .update({ estado: "inactivo", revoked_by: profile?.email ?? null, revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useInvitarUsuario() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      idSocio: number;
      nombre: string;
      correo: string;
      telefono?: string | null;
    }) => {
      // Invitación Supabase Auth (magic link) vía edge function service-role.
      // Nunca se captura ni almacena contraseña. // SWAP POINT: edge fn a desplegar.
      const response = await supabase.functions.invoke("invite-socio-bancario-user", {
        body: {
          id_socio_bancario: input.idSocio,
          nombre: input.nombre.trim(),
          correo: input.correo.toLowerCase().trim(),
          telefono: input.telefono?.trim() || null,
        },
      });
      if (response.error) throw new Error(await extractInvokeError(response.error));
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: invalidate,
  });
}

export function useReenviarInvitacion() {
  return useMutation({
    mutationFn: async (input: { idUsuario: number; correo: string }) => {
      const response = await supabase.functions.invoke("invite-socio-bancario-user", {
        body: { reenviar: true, id_usuario: input.idUsuario, correo: input.correo.toLowerCase().trim() },
      });
      if (response.error) throw new Error(await extractInvokeError(response.error));
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
  });
}

export function useToggleUsuarioSocio() {
  const invalidate = useInvalidate();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({ id, activar }: { id: number; activar: boolean }) => {
      // Baja = desactivación + revocar sesión (edge fn). Reactivación = estado activo.
      const patch: Record<string, any> = { estado: activar ? "activo" : "inactivo" };
      if (!activar) {
        patch.revoked_by = profile?.email ?? null;
        patch.revoked_at = new Date().toISOString();
      }
      const { error } = await (supabase as any).from("usuarios_socio_bancario").update(patch).eq("id", id);
      if (error) throw error;
      if (!activar) {
        // Revocar acceso en Supabase Auth (best-effort). // SWAP POINT: edge fn revoke.
        try {
          await supabase.functions.invoke("invite-socio-bancario-user", {
            body: { revocar: true, id_usuario: id },
          });
        } catch {
          /* la desactivación de estado ya aplicó; el revoke real lo hace el backend */
        }
      }
    },
    onSuccess: invalidate,
  });
}
