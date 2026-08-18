import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalPersonalImpersonation } from "@/contexts/PortalPersonalImpersonationContext";
import { useMisContactosIds, enLotes } from "@/hooks/useCrmContactosPortal";
import { useComisionesPorEmail } from "@/hooks/useComisionesPorEmail";
import { usePerfilPersonal } from "@/hooks/usePortalPersonalPerfil";

/**
 * Datos del Inicio del Portal del Personal, todos reales.
 *
 *   - `useResumenReferidos` — cuántos contactos posee la persona, cuántos ya
 *     tienen un negocio en marcha y cuántos están incompletos. Es la base de
 *     "Mi meta": la meta se mide en referidos registrados, no en un contador
 *     inventado.
 *   - `useAvisosPersonal` — la bandeja de avisos. Combina dos fuentes:
 *       1. Avisos DERIVADOS de sus propios datos (lo accionable de hoy).
 *       2. Avisos DIFUNDIDOS desde `avisos_app_agente` para su rol, que es la
 *          tabla con la que el equipo manda comunicados a los portales.
 *
 * El link de referido desapareció a propósito: el vínculo ya no se rastrea con
 * un código, sino con la propiedad del contacto en Mis referidos
 * (`crm_leads_atribucion.id_propietario`). Quien da de alta el contacto queda
 * como su referidor.
 */

export interface ResumenReferidos {
  /** Contactos de los que la persona es propietaria. */
  total: number;
  /** De esos, los que ya tienen al menos un negocio activo. */
  conNegocio: number;
  /** Los que no tienen ni correo ni teléfono capturado. */
  incompletos: number;
}

export function useResumenReferidos() {
  const { erIds, isLoading: cargandoIds, ownerNoResuelto } = useMisContactosIds();

  const { data, isLoading } = useQuery<ResumenReferidos>({
    queryKey: ["portal-personal-resumen-referidos", erIds?.length ?? null, erIds?.[0] ?? null],
    enabled: !ownerNoResuelto && erIds != null,
    staleTime: 60_000,
    queryFn: async () => {
      const ids = erIds ?? [];
      if (!ids.length) return { total: 0, conNegocio: 0, incompletos: 0 };

      // Negocios activos de esos contactos (por lotes: pueden ser miles de ids).
      const negocios = await enLotes(ids, 300, async (lote) => {
        const { data } = await (supabase as any)
          .from("crm_negocios")
          .select("id_entidad_relacionada")
          .eq("activo", true)
          .in("id_entidad_relacionada", lote);
        return ((data as any[]) ?? []);
      });
      const conNegocio = new Set(negocios.map((n) => Number(n.id_entidad_relacionada))).size;

      // Contactos sin correo ni teléfono: waterfall entidad → persona.
      const entidades = await enLotes(ids, 300, async (lote) => {
        const { data } = await (supabase as any)
          .from("entidades_relacionadas")
          .select("id, id_persona")
          .in("id", lote);
        return ((data as any[]) ?? []);
      });
      const personaIds = Array.from(
        new Set(entidades.map((e) => Number(e.id_persona)).filter(Boolean)),
      );
      const personas = await enLotes(personaIds, 300, async (lote) => {
        const { data } = await (supabase as any)
          .from("personas")
          .select("id, email, telefono")
          .in("id", lote);
        return ((data as any[]) ?? []);
      });
      const sinDatos = new Set(
        personas
          .filter((p) => !(p.email ?? "").trim() && !(p.telefono ?? "").trim())
          .map((p) => Number(p.id)),
      );
      const incompletos = entidades.filter((e) => sinDatos.has(Number(e.id_persona))).length;

      return { total: ids.length, conNegocio, incompletos };
    },
  });

  return {
    resumen: data ?? { total: 0, conNegocio: 0, incompletos: 0 },
    isLoading: cargandoIds || isLoading,
  };
}

export type TonoAviso = "ambar" | "verde" | "gris";

export interface AvisoPersonal {
  id: string;
  tono: TonoAviso;
  titulo: string;
  detalle?: string;
  accion?: { texto: string; to: string };
  /** Viene de `avisos_app_agente` (comunicado del equipo), no de sus datos. */
  esDifusion?: boolean;
}

const mxn0 = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export function useAvisosPersonal() {
  const { profile } = useAuth();
  const { impersonatedUser, isImpersonating } = usePortalPersonalImpersonation();
  const email = ((isImpersonating ? impersonatedUser?.email : profile?.email) ?? "").trim();
  const rolId = isImpersonating ? impersonatedUser?.rol_id ?? null : profile?.rol_id ?? null;

  const { resumen, isLoading: cargandoResumen } = useResumenReferidos();
  const { comisiones, isLoading: cargandoComisiones } = useComisionesPorEmail(email || null);
  const { perfil, isLoading: cargandoPerfil } = usePerfilPersonal();

  // Comunicados dirigidos a su rol. La tabla puede estar vacía: es normal.
  const { data: difusiones = [] } = useQuery({
    queryKey: ["portal-personal-avisos-difusion", rolId],
    enabled: rolId != null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("avisos_app_agente")
        .select("id, titulo, mensaje, tipo, url_accion, etiqueta_accion, ids_roles, estado, fecha_envio")
        .eq("estado", "enviado")
        .order("fecha_envio", { ascending: false })
        .limit(20);
      if (error || !data) return [];
      return ((data as any[]) ?? []).filter(
        (a) => !a.ids_roles?.length || a.ids_roles.map(Number).includes(Number(rolId)),
      );
    },
  });

  const avisos = useMemo(() => {
    const out: AvisoPersonal[] = [];

    // 1. Comunicados del equipo primero: son mensajes explícitos.
    for (const d of difusiones) {
      out.push({
        id: `difusion-${d.id}`,
        tono: d.tipo === "alerta" ? "ambar" : "gris",
        titulo: d.titulo as string,
        detalle: (d.mensaje as string) ?? undefined,
        accion: d.url_accion
          ? { texto: (d.etiqueta_accion as string) || "Abrir", to: d.url_accion as string }
          : undefined,
        esDifusion: true,
      });
    }

    // 2. Cobro bloqueado: sin cuenta de depósito no se puede dispersar nada.
    if (perfil && !perfil.cuentaDeposito) {
      out.push({
        id: "sin-cuenta-deposito",
        tono: "ambar",
        titulo: "No tienes cuenta de depósito registrada",
        detalle: "Sin ella no se puede dispersar ninguna comisión a tu nombre.",
        accion: { texto: "Ir a Mi perfil", to: "/admin/portal-personal/perfil" },
      });
    }

    // 3. Comisiones aprobadas esperando dispersión.
    const aprobadas = comisiones.filter((c) => c.aprobada && !c.pagada);
    if (aprobadas.length > 0) {
      const monto = aprobadas.reduce((a, c) => a + c.monto_comision, 0);
      out.push({
        id: "comisiones-aprobadas",
        tono: "verde",
        titulo: `${aprobadas.length} ${aprobadas.length === 1 ? "comisión aprobada" : "comisiones aprobadas"} por dispersar`,
        detalle: `Suman ${mxn0(monto)} a tu nombre.`,
        accion: { texto: "Ver mis ganancias", to: "/admin/portal-personal/ganancias" },
      });
    }

    // 4. Referidos con datos incompletos: sin correo ni teléfono no hay seguimiento.
    if (resumen.incompletos > 0) {
      out.push({
        id: "referidos-incompletos",
        tono: "ambar",
        titulo: `${resumen.incompletos} ${resumen.incompletos === 1 ? "referido sin datos de contacto" : "referidos sin datos de contacto"}`,
        detalle: "Sin correo ni teléfono no se les puede dar seguimiento.",
        accion: { texto: "Completar", to: "/admin/portal-personal/referidos" },
      });
    }

    // 5. Referidos que aún no derivan en un negocio.
    const sinNegocio = Math.max(resumen.total - resumen.conNegocio, 0);
    if (sinNegocio > 0) {
      out.push({
        id: "referidos-sin-negocio",
        tono: "gris",
        titulo: `${sinNegocio} ${sinNegocio === 1 ? "referido aún sin negocio" : "referidos aún sin negocio"}`,
        detalle: "Vincúlalos con un proyecto para que empiecen a avanzar.",
        accion: { texto: "Ver mis referidos", to: "/admin/portal-personal/referidos" },
      });
    }

    // 6. Expediente sin persona ligada: bloquea documentos y datos fiscales.
    if (perfil && perfil.personaId == null) {
      out.push({
        id: "sin-persona",
        tono: "ambar",
        titulo: "Tu cuenta no tiene una persona ligada",
        detalle: "Sin ella no podemos mostrar tu expediente ni tus datos fiscales.",
        accion: { texto: "Ir a Mi perfil", to: "/admin/portal-personal/perfil" },
      });
    }

    return out;
  }, [difusiones, perfil, comisiones, resumen]);

  return {
    avisos,
    isLoading: cargandoResumen || cargandoComisiones || cargandoPerfil,
  };
}
