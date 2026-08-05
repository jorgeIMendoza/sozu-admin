import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";

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
  /** false = nunca pulsó "Confirmar mi Email", así que aún no tiene credenciales. */
  emailConfirmado: boolean;
}

export interface BancoRoles {
  operadorRolId: number | null;
  supervisorRolId: number | null;
}

/** Mensaje real de un error de `functions.invoke` (vive en `error.context`). */
const extractInvokeError = extractEdgeFunctionError;

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
        .select("email, nombre, rol_id, activo, telefono, email_confirmado")
        .eq("id_banco", idBanco)
        .eq("activo", true) // Ejecutivos inactivos no se muestran ni tienen acceso al portal
        .in("rol_id", rolIds)
        .order("nombre", { ascending: true });
      if (error || !data) return [];
      return (data as any[]).map((u) => ({
        email: u.email,
        nombre: u.nombre ?? "",
        rolId: u.rol_id,
        rolPortal: (u.rol_id === supervisorRolId ? "admin" : "agente") as RolBancoPortal,
        activo: !!u.activo,
        telefono: u.telefono ?? null,
        emailConfirmado: u.email_confirmado !== false,
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
      // Los roles de banco operan bajo RLS por "dueño del registro", así que la cuenta no
      // puede quedar sin persona: sin ella `current_persona_id()` es NULL y esa rama de las
      // policies siempre da falso. Antes este flujo creaba el usuario sin vincular nada.
      // Se reutiliza la persona si ya existe con ese correo; si no, se crea con los mismos
      // datos del formulario (mismo patrón que el alta de embajadores).
      const emailNorm = input.email.toLowerCase().trim();
      const { data: personasCoincidentes } = await supabase
        .from("personas")
        .select("id")
        .eq("email", emailNorm)
        .order("id")
        .limit(1);

      let idPersona: number | null = personasCoincidentes?.[0]?.id ?? null;
      if (!idPersona) {
        const { data: nuevaPersona, error: personaError } = await supabase
          .from("personas")
          .insert({
            nombre_legal: input.nombre.trim(),
            email: emailNorm,
            telefono: input.telefono?.trim() || null,
            clave_pais_telefono: "MX",
            tipo_persona: "pf",
            activo: true,
          })
          .select("id")
          .single();
        if (personaError || !nuevaPersona) {
          throw personaError ?? new Error("No se pudo crear la persona del ejecutivo.");
        }
        idPersona = nuevaPersona.id;
      }

      const response = await supabase.functions.invoke("create-user", {
        body: {
          email: emailNorm,
          nombre: input.nombre.trim(),
          rol_id: rolId,
          id_persona: idPersona,
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

/**
 * Un UPDATE sobre `usuarios` que RLS no permite no devuelve error: filtra las filas
 * y afecta 0 sin quejarse. Por eso todas las mutaciones piden `.select()` y aquí se
 * verifica que sí tocaron la fila; sin esto la UI cantaba "desactivado" mientras el
 * ejecutivo seguía activo en BD (y en el listado).
 */
function assertFilaActualizada(filas: unknown[] | null, accion: string) {
  if (!filas || filas.length === 0) {
    throw new Error(
      `No se pudo ${accion}: tu rol no tiene permiso para modificar este usuario en la base de datos.`,
    );
  }
}

/** Baja/reactivación: `usuarios.activo`. Al reactivar, resetea la contraseña a temporal. */
export function useSetActivoEjecutivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, activo }: { email: string; activo: boolean }) => {
      const { data: filas, error } = await supabase
        .from("usuarios")
        .update({ activo, fecha_actualizacion: new Date().toISOString() })
        .eq("email", email)
        .select("email");
      if (error) throw error;
      assertFilaActualizada(filas, activo ? "reactivar al ejecutivo" : "desactivar al ejecutivo");

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

/**
 * Reenvía el correo con el botón "Confirmar mi Email". Necesario cuando el envío
 * del alta falló: sin esto no había forma de reintentar desde el portal y el
 * ejecutivo se quedaba sin credenciales (las manda el trigger al confirmar).
 */
export function useReenviarConfirmacionEjecutivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const response = await supabase.functions.invoke("reenviar-confirmacion-email", {
        body: { email: email.toLowerCase().trim() },
      });
      if (response.error) throw new Error(await extractInvokeError(response.error));
      if (response.data && response.data.success === false) {
        throw new Error(response.data.message || "No se pudo reenviar el correo");
      }
      return response.data;
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
      const { data: filas, error } = await supabase
        .from("usuarios")
        .update({ rol_id: rolId, fecha_actualizacion: new Date().toISOString() })
        .eq("email", email)
        .select("email");
      if (error) throw error;
      assertFilaActualizada(filas, "cambiar el rol");
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
      const { data: filas, error } = await supabase
        .from("usuarios")
        .update({
          nombre: nombre.trim(),
          telefono: telefono?.trim() || null,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("email", email)
        .select("email");
      if (error) throw error;
      assertFilaActualizada(filas, "actualizar al ejecutivo");

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
