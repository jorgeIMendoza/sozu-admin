/**
 * Acciones de estado de cuenta de un usuario: resetear contraseña, desactivar y
 * reactivar. Punto único para las ~8 pantallas que antes lo hacían a mano, cada una
 * con su propia idea de qué debía pasar.
 *
 * ─── La regla ────────────────────────────────────────────────────────────────
 * La clasificación del rol vive en BD: `roles.requiere_confirmacion_email`.
 *   true  = rol de PORTAL/externo (Cliente, Agente Inmobiliario, Inmobiliaria,
 *           Embajador, Notario, Socio Bancario, roles de Banco).
 *   false = rol INTERNO (todo lo demás, incluidos Agente Interno y Directores).
 *
 * | acción              | rol INTERNO                                  | rol de PORTAL                                        |
 * |---------------------|----------------------------------------------|------------------------------------------------------|
 * | resetear contraseña | Temporal123!. NO des-confirma, NO manda correo | des-confirma + correo de confirmación + Temporal123! |
 * | desactivar          | activo=false + Temporal123!. NO des-confirma  | activo=false y nada más                              |
 * | reactivar           | activo=true y nada más                        | activo=true + des-confirma + correo + Temporal123!   |
 *
 * El front NO decide sobre la confirmación del correo: esa bifurcación ya vive dentro
 * de la edge function `reset-user-password`, que lee el mismo flag. Aquí solo se decide
 * SI se invoca o no, según la tabla de arriba, y se lee el flag para redactar el toast.
 *
 * ─── El ban de Auth: transversal a la tabla de arriba ────────────────────────
 * Además de lo anterior, y para TODOS los roles por igual, desactivar BANEA la cuenta
 * en Auth y reactivar le quita el ban. `usuarios.activo` es una columna que GoTrue no
 * conoce: sin el ban, el ex empleado hacía `signInWithPassword` y obtenía un JWT válido
 * contra PostgREST, Storage y las edge functions aunque el front le dijera "Cuenta
 * Desactivada" — y a un rol interno la baja encima le dejaba la contraseña en
 * Temporal123!, que es pública. El ban es el único corte real.
 *
 * ─── Por qué se verifican las filas afectadas ────────────────────────────────
 * Un UPDATE sobre `usuarios` que RLS no permite NO devuelve error: filtra las filas y
 * afecta 0 en silencio. Varias pantallas cantaban "usuario desactivado" mientras en BD
 * seguía activo. Por eso todo UPDATE de aquí pide `.select()` y falla explícitamente
 * cuando no tocó ninguna fila.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";

/** Contraseña que repone `reset-user-password`. Solo para textos de UI. */
export const PASSWORD_TEMPORAL = "Temporal123!";

/** A quién se le aplica la acción. Por correo(s) o por la persona ligada. */
export type ObjetivoUsuario =
  | { email: string | string[] }
  | { idPersona: number };

export interface OpcionesEstadoCuenta {
  /**
   * `true` cuando la pantalla da de baja/alta otra entidad (una persona, un agente) y
   * el usuario puede simplemente no existir. En ese caso se devuelve `null` en vez de
   * reventar la mutación completa.
   */
  permitirSinUsuario?: boolean;
}

export interface ResultadoEstadoCuenta {
  /** Correos que realmente se tocaron. */
  emails: string[];
  /** Alguno de los afectados es de un rol de portal. */
  hayPortal: boolean;
  /** Alguno de los afectados es de un rol interno. */
  hayInternos: boolean;
  /** Atajo de `hayPortal`: la UI debe hablar de correo de confirmación. */
  requiereConfirmacion: boolean;
  /** Se repuso Temporal123! a alguien. */
  passwordTemporal: boolean;
  /** Salió (o debió salir) correo de confirmación. */
  correoConfirmacionEnviado: boolean;
  /**
   * Motivo si el ban/des-ban de Auth falló. NO es fatal (el cambio de `activo` ya quedó
   * hecho) pero SÍ es grave: en una baja significa que el usuario conserva una sesión
   * válida, y en un alta que no podrá entrar aunque la UI lo muestre activo.
   */
  banFallo: string | null;
  /**
   * Motivo del primer fallo complementario (ban o reset). NO es fatal: el cambio de
   * `activo` ya quedó hecho y la pantalla debe reportarlo como advertencia, no como
   * error. Es el canal único que ya leen todas las pantallas; `banFallo` permite
   * distinguir el caso para redactar mejor el título.
   */
  resetFallo: string | null;
  /** Texto listo para el toast, ya redactado según el tipo de rol. */
  mensaje: string;
}

interface UsuarioObjetivo {
  email: string;
  requiereConfirmacion: boolean;
}

function normalizaEmails(valor: string | string[]): string[] {
  const lista = Array.isArray(valor) ? valor : [valor];
  return [...new Set(lista.map((e) => (e ?? "").trim()).filter(Boolean))];
}

/**
 * Resuelve a quién se le va a aplicar la acción y con qué clasificación de rol.
 *
 * Se consulta `roles` en una query aparte en vez de con un embed `roles(...)`: si RLS
 * recortara el recurso embebido, la fila llegaría sin rol y todos parecerían internos
 * — o sea, nadie recibiría su correo de confirmación y el fallo sería mudo.
 * `requiere_confirmacion_email` aún no está en los tipos generados, de ahí el cast.
 */
async function resolverObjetivo(objetivo: ObjetivoUsuario): Promise<UsuarioObjetivo[]> {
  let query = supabase.from("usuarios").select("email, rol_id");

  if ("idPersona" in objetivo) {
    query = query.eq("id_persona", objetivo.idPersona);
  } else {
    const emails = normalizaEmails(objetivo.email);
    if (emails.length === 0) return [];
    query = query.in("email", emails);
  }

  const { data, error } = await query;
  if (error) throw new Error(`No se pudo consultar el usuario: ${error.message}`);

  const filas = (data ?? []).filter((u) => u?.email);
  if (filas.length === 0) return [];

  const rolIds = [...new Set(filas.map((u) => u.rol_id).filter((id): id is number => id != null))];
  const porRol = new Map<number, boolean>();
  if (rolIds.length > 0) {
    const { data: roles } = await (supabase as any)
      .from("roles")
      .select("id, requiere_confirmacion_email")
      .in("id", rolIds);
    ((roles ?? []) as any[]).forEach((r) => {
      porRol.set(Number(r.id), r.requiere_confirmacion_email === true);
    });
  }

  return filas.map((u) => ({
    email: String(u.email),
    // Default tolerante: si la columna aún no existe en el ambiente, se trata como rol
    // interno y por tanto NO se manda correo ni se des-confirma a nadie.
    requiereConfirmacion: u.rol_id != null && porRol.get(Number(u.rol_id)) === true,
  }));
}

function exigeUsuario(
  usuarios: UsuarioObjetivo[],
  opciones: OpcionesEstadoCuenta,
  accion: string,
): boolean {
  if (usuarios.length > 0) return true;
  if (opciones.permitirSinUsuario) return false;
  throw new Error(`No se encontró el usuario a ${accion}.`);
}

/** UPDATE de `usuarios.activo` con verificación de filas afectadas. */
async function actualizarActivo(emails: string[], activo: boolean): Promise<string[]> {
  const { data, error } = await supabase
    .from("usuarios")
    .update({ activo, fecha_actualizacion: new Date().toISOString() })
    .in("email", emails)
    .select("email");

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      `No se pudo ${activo ? "reactivar" : "desactivar"} al usuario: la base de datos no ` +
        `modificó ninguna fila (tu rol no tiene permiso para hacerlo).`,
    );
  }
  return data.map((fila) => String((fila as { email: string }).email));
}

/**
 * Invoca `reset-user-password`. La función decide sola si des-confirma y manda correo
 * (rol de portal) o si solo repone la contraseña temporal (rol interno).
 */
async function invocarReset(email: string): Promise<{ requiereConfirmacion: boolean }> {
  const response = await supabase.functions.invoke("reset-user-password", {
    body: { email },
  });
  // El motivo real viaja en el cuerpo: `.message` solo dice "non-2xx status code".
  if (response.error) throw new Error(await extractEdgeFunctionError(response.error));
  if (response.data?.error) throw new Error(String(response.data.error));
  return { requiereConfirmacion: response.data?.requiereConfirmacion === true };
}

/** Ejecuta el reset sobre varios correos y acumula el primer fallo sin abortar. */
async function resetearVarios(
  emails: string[],
): Promise<{ ok: string[]; fallo: string | null }> {
  const ok: string[] = [];
  let fallo: string | null = null;
  for (const email of emails) {
    try {
      await invocarReset(email);
      ok.push(email);
    } catch (e: any) {
      fallo = fallo ?? (e?.message || "No se pudo reponer la contraseña.");
    }
  }
  return { ok, fallo };
}

/**
 * Banea / des-banea la cuenta en Auth (`reset-user-password`, acción `banear` /
 * `desbanear`, mismo gate de autorización que el reset). Aplica a cualquier rol.
 */
async function invocarAccesoAuth(email: string, permitirAcceso: boolean): Promise<void> {
  const response = await supabase.functions.invoke("reset-user-password", {
    body: { email, accion: permitirAcceso ? "desbanear" : "banear" },
  });
  if (response.error) throw new Error(await extractEdgeFunctionError(response.error));
  if (response.data?.error) throw new Error(String(response.data.error));
}

/**
 * Aplica el ban/des-ban a todo el lote y devuelve el primer fallo sin abortar: que una
 * fila falle no debe dejar al resto con la sesión viva.
 */
async function accesoAuthVarios(
  emails: string[],
  permitirAcceso: boolean,
): Promise<string | null> {
  let fallo: string | null = null;
  for (const email of emails) {
    try {
      await invocarAccesoAuth(email, permitirAcceso);
    } catch (e: any) {
      const motivo = e?.message || "error desconocido";
      fallo = fallo ?? (permitirAcceso
        ? `No se pudo rehabilitar la cuenta en el sistema de acceso (${motivo}). ` +
          `El usuario figura activo pero todavía no podrá iniciar sesión: vuelve a intentar la reactivación.`
        : `No se pudo revocar la sesión en el sistema de acceso (${motivo}). ` +
          `El usuario podría seguir entrando con su contraseña actual: vuelve a intentar la desactivación.`);
    }
  }
  return fallo;
}

function listaCorreos(emails: string[]): string {
  return emails.length === 1 ? emails[0] : `${emails.length} usuarios`;
}

// ─── Acciones ────────────────────────────────────────────────────────────────

/**
 * Resetear contraseña.
 *   interno → Temporal123!, sin correo, sin tocar la confirmación.
 *   portal  → des-confirma, manda correo de confirmación y deja Temporal123!.
 * Aquí el reset ES la acción: si falla, se propaga el error.
 */
export async function resetearPassword(
  objetivo: ObjetivoUsuario,
  opciones: OpcionesEstadoCuenta = {},
): Promise<ResultadoEstadoCuenta | null> {
  const usuarios = await resolverObjetivo(objetivo);
  if (!exigeUsuario(usuarios, opciones, "resetear")) return null;

  const emails = usuarios.map((u) => u.email);
  for (const email of emails) {
    await invocarReset(email);
  }

  const hayPortal = usuarios.some((u) => u.requiereConfirmacion);
  const hayInternos = usuarios.some((u) => !u.requiereConfirmacion);
  const destino = listaCorreos(emails);

  let mensaje: string;
  if (hayPortal && hayInternos) {
    mensaje =
      `Contraseña restablecida a ${PASSWORD_TEMPORAL}. A los usuarios de portal se les ` +
      `envió además un correo de confirmación para que definan una nueva.`;
  } else if (hayPortal) {
    mensaje =
      `Se envió un correo de confirmación a ${destino}. Al confirmarlo podrá definir su ` +
      `nueva contraseña.`;
  } else {
    mensaje =
      `La contraseña quedó en ${PASSWORD_TEMPORAL}. Se le pedirá cambiarla al entrar.`;
  }

  return {
    emails,
    hayPortal,
    hayInternos,
    requiereConfirmacion: hayPortal,
    passwordTemporal: true,
    correoConfirmacionEnviado: hayPortal,
    banFallo: null,
    resetFallo: null,
    mensaje,
  };
}

/**
 * Desactivar.
 *   interno → `activo=false`, ban en Auth y contraseña a Temporal123! (no se des-confirma).
 *   portal  → `activo=false` y ban en Auth.
 *
 * Orden: primero el UPDATE de `usuarios` y solo después el ban. El UPDATE es la prueba
 * de autorización — si RLS lo filtra, `actualizarActivo` revienta y no se banea a nadie
 * que no se tenga permiso de tocar. Al revés se podría dejar baneada a una cuenta que
 * en BD sigue activa.
 */
export async function desactivarUsuario(
  objetivo: ObjetivoUsuario,
  opciones: OpcionesEstadoCuenta = {},
): Promise<ResultadoEstadoCuenta | null> {
  const usuarios = await resolverObjetivo(objetivo);
  if (!exigeUsuario(usuarios, opciones, "desactivar")) return null;

  const emails = await actualizarActivo(
    usuarios.map((u) => u.email),
    false,
  );

  // Solo se toca a quien el UPDATE realmente modificó: si RLS filtró parte del lote,
  // reponerle la contraseña a alguien que sigue activo sería un daño colateral.
  const tocados = new Set(emails);
  const afectados = usuarios.filter((u) => tocados.has(u.email));
  const internos = afectados.filter((u) => !u.requiereConfirmacion).map((u) => u.email);
  const hayPortal = afectados.some((u) => u.requiereConfirmacion);

  // Ban en Auth para TODOS los afectados, sea cual sea el rol: es lo que corta la
  // sesión viva y el login. Va antes del reset — reponer Temporal123! a una cuenta que
  // todavía puede iniciar sesión sería justo la contraseña pública que se quiere evitar.
  const banFallo = await accesoAuthVarios(emails, false);

  const { fallo } = internos.length > 0
    ? await resetearVarios(internos)
    : { fallo: null as string | null };

  const mensaje = internos.length > 0
    ? `El usuario ya no tiene acceso al sistema y su contraseña quedó en ${PASSWORD_TEMPORAL}.`
    : "El usuario ya no tiene acceso al sistema.";

  return {
    emails,
    hayPortal,
    hayInternos: internos.length > 0,
    requiereConfirmacion: hayPortal,
    passwordTemporal: internos.length > 0 && !fallo,
    correoConfirmacionEnviado: false,
    banFallo,
    resetFallo: banFallo ?? fallo,
    mensaje,
  };
}

/**
 * Reactivar.
 *   interno → `activo=true` + se le quita el ban de Auth (conserva su contraseña).
 *   portal  → `activo=true`, se le quita el ban, se des-confirma, llega correo de
 *             confirmación y la contraseña queda en Temporal123!.
 *
 * El des-ban va antes del correo de confirmación: si no, el usuario recibiría el enlace,
 * lo confirmaría, definiría contraseña y aun así no podría iniciar sesión.
 */
export async function reactivarUsuario(
  objetivo: ObjetivoUsuario,
  opciones: OpcionesEstadoCuenta = {},
): Promise<ResultadoEstadoCuenta | null> {
  const usuarios = await resolverObjetivo(objetivo);
  if (!exigeUsuario(usuarios, opciones, "reactivar")) return null;

  const emails = await actualizarActivo(
    usuarios.map((u) => u.email),
    true,
  );

  // Igual que en la baja: solo se manda correo a quien el UPDATE sí reactivó.
  const tocados = new Set(emails);
  const afectados = usuarios.filter((u) => tocados.has(u.email));
  const portal = afectados.filter((u) => u.requiereConfirmacion).map((u) => u.email);
  const hayInternos = afectados.some((u) => !u.requiereConfirmacion);

  // Quitar el ban que dejó la baja. Aplica a todos los roles y es idempotente: una
  // cuenta que nunca estuvo baneada no cambia.
  const banFallo = await accesoAuthVarios(emails, true);

  const { ok, fallo } = portal.length > 0
    ? await resetearVarios(portal)
    : { ok: [] as string[], fallo: null as string | null };

  let mensaje: string;
  if (portal.length > 0 && ok.length > 0) {
    mensaje =
      `Se envió un correo de confirmación a ${listaCorreos(ok)}. Al confirmarlo podrá ` +
      `definir su contraseña y entrar.`;
  } else if (portal.length > 0) {
    mensaje = "El usuario recuperó el acceso, pero no se pudo enviar el correo de confirmación.";
  } else {
    mensaje = "El usuario recuperó el acceso con la contraseña que ya tenía.";
  }

  return {
    emails,
    hayPortal: portal.length > 0,
    hayInternos,
    requiereConfirmacion: portal.length > 0,
    passwordTemporal: ok.length > 0,
    correoConfirmacionEnviado: ok.length > 0,
    banFallo,
    resetFallo: banFallo ?? fallo,
    mensaje,
  };
}

// ─── Textos y clasificación para la UI ───────────────────────────────────────

/** Qué va a pasar al resetear, para el diálogo de confirmación. */
export function textoResetPassword(requiereConfirmacion: boolean | undefined): string {
  return requiereConfirmacion
    ? "Se le enviará un correo para que confirme su email; al confirmarlo podrá definir su nueva contraseña."
    : `Su contraseña será cambiada a ${PASSWORD_TEMPORAL} y se le pedirá cambiarla al entrar.`;
}

/** Qué recibe el usuario recién creado, según el tipo de rol. */
export function textoAltaUsuario(requiereConfirmacion: boolean | undefined): string {
  return requiereConfirmacion
    ? "Recibirá un correo de confirmación; al confirmarlo definirá su propia contraseña."
    : `La contraseña inicial será ${PASSWORD_TEMPORAL} y se le pedirá cambiarla al entrar.`;
}

/** Qué va a pasar al reactivar, para el diálogo de confirmación. */
export function textoReactivarUsuario(requiereConfirmacion: boolean | undefined): string {
  return requiereConfirmacion
    ? "Recuperará el acceso y recibirá un correo de confirmación para definir su contraseña."
    : "Recuperará el acceso con la contraseña que ya tenía.";
}

/** Qué va a pasar al desactivar, para el diálogo de confirmación. */
export function textoDesactivarUsuario(requiereConfirmacion: boolean | undefined): string {
  return requiereConfirmacion
    ? "No podrá acceder al sistema hasta que sea reactivado."
    : `No podrá acceder al sistema hasta que sea reactivado y su contraseña quedará en ${PASSWORD_TEMPORAL}.`;
}

/**
 * Mapa `rol_id -> requiere_confirmacion_email` para que las pantallas redacten sus
 * textos sin una consulta por fila. Una sola query, cacheada: la clasificación cambia
 * con la configuración de roles, no con los datos.
 */
export function useRolesRequierenConfirmacion() {
  const { data } = useQuery({
    queryKey: ["roles-requieren-confirmacion"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("roles")
        .select("id, requiere_confirmacion_email");
      // Contra un ambiente sin la migración, mapa vacío = todo se trata como interno.
      if (error) return new Map<number, boolean>();
      return new Map<number, boolean>(
        ((data ?? []) as any[]).map((r) => [
          Number(r.id),
          r.requiere_confirmacion_email === true,
        ]),
      );
    },
  });

  const mapa = data ?? new Map<number, boolean>();
  return {
    mapa,
    /** ¿El rol es de portal? `false` mientras no se conozca (default seguro: interno). */
    requiereConfirmacion: (rolId: number | null | undefined) =>
      rolId == null ? false : mapa.get(Number(rolId)) === true,
  };
}
