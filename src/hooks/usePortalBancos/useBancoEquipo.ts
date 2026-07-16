import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Equipo del Portal Bancos = usuarios REALES del sistema (con login) cuyos roles
 * son "Operador Banco" (=Agente en el portal) o "Supervisor Banco" (=Admin),
 * vinculados a un banco vía `usuarios.id_banco`.
 *
 * Fuente de verdad: tabla `public.usuarios` — la MISMA que Admin Panel → Usuarios
 * del Sistema. Por eso cualquier alta/baja/cambio hecho aquí se refleja al
 * instante en Admin Panel (y viceversa): todas las mutaciones invalidan la query
 * `['usuarios']`.
 *
 * Reemplaza el antiguo equipo de contacto (`bancos_agentes`, sin login).
 */

export type RolBancoPortal = "agente" | "admin";

export interface EjecutivoBanco {
  email: string;
  nombre: string;
  rolId: number;
  /** 'agente' = Operador Banco · 'admin' = Supervisor Banco */
  rolPortal: RolBancoPortal;
  activo: boolean;
  telefono: string | null;
}

export interface BancoRoles {
  operadorRolId: number | null;
  supervisorRolId: number | null;
}

/**
 * Extrae el mensaje real de un error de `supabase.functions.invoke`.
 * En non-2xx, supabase-js devuelve un `FunctionsHttpError` cuyo cuerpo JSON
 * (`{ error: "..." }`) vive en `error.context` (un Response), no en `.message`
 * (que solo dice "Edge Function returned a non-2xx status code"). Sin esto, el
 * motivo real queda oculto.
 */
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
    /* cuerpo no-JSON o ya consumido: usar el mensaje genérico */
  }
  return error?.message ?? "Error desconocido";
}

// Detección por NOMBRE (los ids difieren entre ambientes). Tolerante a
// singular/plural: "Operador Banco" / "Operador Bancos".
function matchOperador(nombre: string) {
  return nombre.trim().toLowerCase().startsWith("operador banco");
}
function matchSupervisor(nombre: string) {
  return nombre.trim().toLowerCase().startsWith("supervisor banco");
}

/** Resuelve los ids de rol de banco por nombre desde la tabla `roles`. */
export function useBancoRoles() {
  return useQuery({
    queryKey: ["banco-roles"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BancoRoles> => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, nombre")
        .eq("activo", true);
      if (error) throw error;
      const rows = (data ?? []) as { id: number; nombre: string }[];
      const operador = rows.find((r) => matchOperador(r.nombre ?? ""));
      const supervisor = rows.find((r) => matchSupervisor(r.nombre ?? ""));
      return {
        operadorRolId: operador?.id ?? null,
        supervisorRolId: supervisor?.id ?? null,
      };
    },
  });
}

const EQUIPO_KEY = (idBanco?: number | null) =>
  ["portal-bancos-equipo", idBanco ?? "none"] as const;

/**
 * Usuarios del sistema (ejecutivos) del banco indicado. Incluye activos e
 * inactivos. Consulta directa a `usuarios` (mismo patrón que Admin Panel).
 */
export function useBancoEquipo(idBanco?: number | null) {
  const { data: roles } = useBancoRoles();
  const operadorRolId = roles?.operadorRolId ?? null;
  const supervisorRolId = roles?.supervisorRolId ?? null;
  const rolIds = [operadorRolId, supervisorRolId].filter(
    (v): v is number => v != null,
  );

  return useQuery({
    queryKey: [...EQUIPO_KEY(idBanco), rolIds.join("-")],
    enabled: idBanco != null && rolIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<EjecutivoBanco[]> => {
      if (idBanco == null || rolIds.length === 0) return [];
      // `usuarios.id_banco` no está en los tipos generados (types.ts) todavía;
      // cast a any igual que en EditUserDialog para poder filtrar por banco.
      const { data, error } = await (supabase as any)
        .from("usuarios")
        .select("email, nombre, rol_id, activo, telefono")
        .eq("id_banco", idBanco)
        .in("rol_id", rolIds)
        .order("activo", { ascending: false })
        .order("nombre", { ascending: true });
      if (error || !data) return [];
      return (data as any[]).map((u) => ({
        email: u.email,
        nombre: u.nombre ?? "",
        rolId: u.rol_id,
        rolPortal: (u.rol_id === supervisorRolId ? "admin" : "agente") as RolBancoPortal,
        activo: !!u.activo,
        telefono: u.telefono ?? null,
      }));
    },
  });
}

function invalidateEquipo(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["portal-bancos-equipo"] });
  // Refleja en Admin Panel → Usuarios del Sistema.
  qc.invalidateQueries({ queryKey: ["usuarios"] });
}

export interface NuevoEjecutivoInput {
  id_banco: number;
  nombre: string;
  email: string;
  telefono?: string | null;
  rolPortal: RolBancoPortal;
}

/**
 * Alta de ejecutivo = alta de usuario del sistema vía edge function `create-user`
 * (misma ruta que Admin Panel). Crea el usuario auth + fila en `usuarios` con
 * contraseña temporal `Temporal123!`, rol de banco e `id_banco`. Solo Super Admin
 * (lo valida la propia edge function).
 */
export function useCrearEjecutivoBanco() {
  const qc = useQueryClient();
  const { data: roles } = useBancoRoles();
  return useMutation({
    mutationFn: async (input: NuevoEjecutivoInput) => {
      const rolId =
        input.rolPortal === "admin"
          ? roles?.supervisorRolId
          : roles?.operadorRolId;
      if (!rolId) {
        throw new Error(
          "No se encontraron los roles de banco (Operador/Supervisor Banco) en el sistema.",
        );
      }
      const response = await supabase.functions.invoke("create-user", {
        body: {
          email: input.email.toLowerCase().trim(),
          nombre: input.nombre.trim(),
          rol_id: rolId,
          id_banco: input.id_banco,
          telefono: input.telefono?.trim() || undefined,
        },
      });
      if (response.error) throw new Error(await extractInvokeError(response.error));
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => invalidateEquipo(qc),
  });
}

/** Baja/reactivación: `usuarios.activo`. Al reactivar, resetea la contraseña a temporal. */
export function useSetActivoEjecutivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, activo }: { email: string; activo: boolean }) => {
      const { error } = await supabase
        .from("usuarios")
        .update({ activo, fecha_actualizacion: new Date().toISOString() })
        .eq("email", email);
      if (error) throw error;

      // Al reactivar, resetear contraseña (mismo comportamiento que Admin Panel).
      if (activo) {
        const response = await supabase.functions.invoke("reset-user-password", {
          body: { email },
        });
        if (response.error) throw new Error(await extractInvokeError(response.error));
        if (response.data?.error) throw new Error(response.data.error);
      }
    },
    onSuccess: () => invalidateEquipo(qc),
  });
}

/** Cambio de rol Agente↔Admin (Operador Banco ↔ Supervisor Banco). */
export function useCambiarRolEjecutivo() {
  const qc = useQueryClient();
  const { data: roles } = useBancoRoles();
  return useMutation({
    mutationFn: async ({
      email,
      rolPortal,
    }: {
      email: string;
      rolPortal: RolBancoPortal;
    }) => {
      const rolId =
        rolPortal === "admin" ? roles?.supervisorRolId : roles?.operadorRolId;
      if (!rolId) {
        throw new Error("No se encontraron los roles de banco en el sistema.");
      }
      const { error } = await supabase
        .from("usuarios")
        .update({ rol_id: rolId, fecha_actualizacion: new Date().toISOString() })
        .eq("email", email);
      if (error) throw error;
    },
    onSuccess: () => invalidateEquipo(qc),
  });
}

/**
 * Editar nombre/teléfono del ejecutivo (y email si cambia, vía edge function
 * `update-user-email` que actualiza auth.users + usuarios).
 */
export function useEditarEjecutivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      email,
      nombre,
      telefono,
      nuevoEmail,
    }: {
      email: string;
      nombre: string;
      telefono?: string | null;
      nuevoEmail?: string | null;
    }) => {
      const { error } = await supabase
        .from("usuarios")
        .update({
          nombre: nombre.trim(),
          telefono: telefono?.trim() || null,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("email", email);
      if (error) throw error;

      const dest = nuevoEmail?.toLowerCase().trim();
      if (dest && dest !== email.toLowerCase().trim()) {
        const response = await supabase.functions.invoke("update-user-email", {
          body: { oldEmail: email, newEmail: dest },
        });
        if (response.error) throw new Error(await extractInvokeError(response.error));
        if (response.data && !response.data.success) {
          throw new Error(response.data.message || "Error al actualizar email");
        }
      }
    },
    onSuccess: () => invalidateEquipo(qc),
  });
}
