import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProyectosSozuIds } from "@/hooks/usePortalSocioBancario/proyectosSozu";

/**
 * Admin de Socios Bancarios (solo Super Administrador).
 *
 * Modelo M:N vigente (migrations#372 + edge#163). Ver
 * Ejecuciones_manuales/portal_socio_bancario_admin.md:
 *   - socios_bancarios (activo boolean, creado_por, revocado_por, fecha_revocacion)
 *   - socio_bancario_desarrollos (id_socio_bancario, id_desarrollo, activo; trigger
 *     exige desarrollo comercializado por SOZU, tipo_entidad 5)
 *   - Usuarios de banco viven en `usuarios` (rol 'Socio Bancario', id_socio_bancario);
 *     su estado se DERIVA de activo + email_confirmado (no hay campo estado).
 *   - Alta/reenvío/revocación vía edge function invite-socio-bancario-user (por correo).
 *
 * Probe graceful: si las tablas/columnas aún no existen en el ambiente, las
 * consultas devuelven vacío y `tablesMissing=true` (banner honesto). Sin
 * hard-delete: baja = activo=false + auditoría. Contraseñas: nunca.
 */

const ROL_SOCIO_BANCARIO = "Socio Bancario";

export interface SocioBancario {
  id: number;
  nombre: string;
  razon_social: string | null;
  rfc: string | null;
  activo: boolean;
}

export interface SocioBancarioListItem extends SocioBancario {
  desarrollosActivos: number;
  usuariosActivos: number;
}

export interface DesarrolloAsignado {
  id: number;
  id_desarrollo: number;
  nombre: string | null;
}

/** Estado derivado del usuario de banco (no hay columna `estado`). */
export type EstadoUsuarioSocio = "invitado" | "activo" | "revocado";

export interface UsuarioSocio {
  email: string;
  nombre: string | null;
  telefono: string | null;
  activo: boolean;
  email_confirmado: boolean;
  auth_user_id: string | null;
  estado: EstadoUsuarioSocio;
}

export function estadoUsuario(u: { activo: boolean; email_confirmado: boolean }): EstadoUsuarioSocio {
  if (!u.activo) return "revocado";
  if (!u.email_confirmado) return "invitado";
  return "activo";
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

/** id del rol 'Socio Bancario' (por nombre; los ids difieren por ambiente). */
async function fetchSocioRolId(): Promise<number | null> {
  const { data } = await (supabase as any)
    .from("roles")
    .select("id, nombre")
    .ilike("nombre", ROL_SOCIO_BANCARIO)
    .maybeSingle();
  return (data?.id as number | undefined) ?? null;
}

// ── Lista de bancos con conteos ─────────────────────────────
export function useSociosBancarios() {
  const query = useQuery({
    queryKey: ["socios-bancarios"],
    staleTime: 60_000,
    queryFn: async (): Promise<{ items: SocioBancarioListItem[]; tablesMissing: boolean }> => {
      const { data: socios, error } = await (supabase as any)
        .from("socios_bancarios")
        .select("id, nombre, razon_social, rfc, activo")
        .order("nombre", { ascending: true });
      if (error) return { items: [], tablesMissing: true }; // tabla ausente → banner honesto
      const list = (socios ?? []) as SocioBancario[];
      if (!list.length) return { items: [], tablesMissing: false };

      const ids = list.map((s) => s.id);
      const rolId = await fetchSocioRolId();
      const [{ data: desas }, { data: usrs }] = await Promise.all([
        (supabase as any)
          .from("socio_bancario_desarrollos")
          .select("id_socio_bancario, activo")
          .in("id_socio_bancario", ids)
          .eq("activo", true),
        (supabase as any)
          .from("usuarios")
          .select("id_socio_bancario, activo, rol_id")
          .in("id_socio_bancario", ids)
          .eq("activo", true)
          .eq("rol_id", rolId ?? -1),
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

// ── Detalle de un banco ─────────────────────────────────────
export function useSocioBancarioDetalle(id: number | null) {
  return useQuery({
    queryKey: ["socio-bancario-detalle", id],
    enabled: id != null,
    staleTime: 30_000,
    queryFn: async (): Promise<SocioBancario | null> => {
      const { data, error } = await (supabase as any)
        .from("socios_bancarios")
        .select("id, nombre, razon_social, rfc, activo")
        .eq("id", id)
        .maybeSingle();
      if (error) return null;
      return (data as SocioBancario) ?? null;
    },
  });
}

/**
 * Opciones de desarrollos que SOZU comercializa (solo estos son asignables;
 * el trigger de BD rechaza los que no). Regla dura del brief.
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
      }));
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
        .select("id, id_desarrollo")
        .eq("id_socio_bancario", idSocio)
        .eq("activo", true);
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
      }));
    },
  });
}

// ── Usuarios de un banco (viven en `usuarios`, rol Socio Bancario) ──
export function useUsuariosSocioBancario(idSocio: number | null) {
  return useQuery({
    queryKey: ["socio-bancario-usuarios", idSocio],
    enabled: idSocio != null,
    staleTime: 30_000,
    queryFn: async (): Promise<UsuarioSocio[]> => {
      const rolId = await fetchSocioRolId();
      const { data, error } = await (supabase as any)
        .from("usuarios")
        .select("email, nombre, telefono, activo, email_confirmado, auth_user_id, rol_id")
        .eq("id_socio_bancario", idSocio)
        .eq("rol_id", rolId ?? -1)
        .order("nombre", { ascending: true });
      if (error || !data) return [];
      return (data as any[]).map((u) => {
        const base = {
          email: u.email as string,
          nombre: (u.nombre ?? null) as string | null,
          telefono: (u.telefono ?? null) as string | null,
          activo: !!u.activo,
          email_confirmado: !!u.email_confirmado,
          auth_user_id: (u.auth_user_id ?? null) as string | null,
        };
        return { ...base, estado: estadoUsuario(base) };
      });
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
        activo: true,
        creado_por: profile?.email ?? null, // auditoría
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
      const patch: Record<string, any> = { activo: activar };
      if (!activar) {
        patch.revocado_por = profile?.email ?? null;
        patch.fecha_revocacion = new Date().toISOString();
      }
      const { error } = await (supabase as any).from("socios_bancarios").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAsignarDesarrollo() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ idSocio, idDesarrollo }: { idSocio: number; idDesarrollo: number }) => {
      // Reactivar si ya existía (evita duplicado); si no, insertar. El trigger de
      // BD rechaza desarrollos no comercializados por SOZU.
      const { data: existente } = await (supabase as any)
        .from("socio_bancario_desarrollos")
        .select("id")
        .eq("id_socio_bancario", idSocio)
        .eq("id_desarrollo", idDesarrollo)
        .maybeSingle();
      if (existente?.id) {
        const { error } = await (supabase as any)
          .from("socio_bancario_desarrollos")
          .update({ activo: true })
          .eq("id", existente.id);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any)
        .from("socio_bancario_desarrollos")
        .insert({ id_socio_bancario: idSocio, id_desarrollo: idDesarrollo, activo: true });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useQuitarDesarrollo() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      // Soft-disable de la asignación (auditable), no borrado.
      const { error } = await (supabase as any)
        .from("socio_bancario_desarrollos")
        .update({ activo: false })
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
      // Invitación (magic link) vía edge function service-role. Nunca contraseña.
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
    mutationFn: async (input: { correo: string }) => {
      const response = await supabase.functions.invoke("invite-socio-bancario-user", {
        body: { reenviar: true, correo: input.correo.toLowerCase().trim() },
      });
      if (response.error) throw new Error(await extractInvokeError(response.error));
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
  });
}

export function useToggleUsuarioSocio() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ correo, activar }: { correo: string; activar: boolean }) => {
      const email = correo.toLowerCase().trim();
      if (!activar) {
        // Revocar: la edge function desactiva el usuario y revoca su acceso auth.
        const response = await supabase.functions.invoke("invite-socio-bancario-user", {
          body: { revocar: true, correo: email },
        });
        if (response.error) throw new Error(await extractInvokeError(response.error));
        if (response.data?.error) throw new Error(response.data.error);
        return;
      }
      // Reactivar: no hay acción de la edge fn en el contrato → reactivar activo.
      // SWAP POINT: si re-habilitar el acceso auth requiere backend, añadir acción.
      const { error } = await (supabase as any)
        .from("usuarios")
        .update({ activo: true })
        .eq("email", email);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
