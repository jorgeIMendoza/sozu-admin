import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BankLead, LeadStatus } from "@/lib/portal-bancos/bank-leads";

/**
 * Solicitudes de crédito reales del Portal Bancos.
 *
 * Fuente de verdad: `public.bancos_solicitudes` (lo que el cliente envía desde
 * Pago Final → banco aliado, ver `useCrearSolicitudCredito`). Este hook cierra
 * el círculo: trae las solicitudes del banco seleccionado, resuelve el cliente
 * y la propiedad vía waterfall (cuentas_cobranza → oferta → persona / propiedad
 * → edificio → proyecto) y las mapea al modelo `BankLead` que consume la mesa
 * hipotecaria (Bandeja / Pipeline / Tablero).
 *
 * Reemplaza el store mock `useBankStore`. Probe graceful: si la tabla aún no
 * existe (DDL pendiente) o hay error, devuelve `[]` sin romper el portal.
 *
 * Campos no persistidos en `bancos_solicitudes` (ingreso, situación laboral,
 * avance de obra, score) se rellenan con neutrales — no se muestran en la mesa
 * o son referenciales. Los campos reales (cliente, propiedad, monto, plazo,
 * tasa, estatus, fechas) provienen íntegramente de la BD.
 */

const KEY = (idBanco?: number | null) => ["solicitudes-banco", idBanco ?? "none"] as const;

// `bancos_solicitudes.estatus` tiene un valor extra ('expirada') que el modelo
// de la mesa (LeadStatus) no contempla. Se mapea a 'desistido' (terminal
// neutral) para el render; el resto es 1:1.
const ESTATUS_VALIDOS: LeadStatus[] = [
  "nuevo", "asignado", "contactado", "en_evaluacion",
  "pre_aprobado", "oferta_vinculante", "en_coordinacion",
  "formalizado", "rechazado", "desistido",
];
function mapEstatus(v: string | null | undefined): LeadStatus {
  if (v === "expirada") return "desistido";
  return (ESTATUS_VALIDOS.includes(v as LeadStatus) ? v : "nuevo") as LeadStatus;
}

function phone(p: { telefono?: string | null; clave_pais_telefono?: string | null } | null): string {
  if (!p?.telefono) return "";
  const clave = p.clave_pais_telefono ? `+${String(p.clave_pais_telefono).replace(/^\+/, "")} ` : "";
  return `${clave}${p.telefono}`.trim();
}

async function fetchSolicitudesBanco(idBanco: number): Promise<BankLead[]> {
  // 1. Solicitudes activas del banco.
  const { data: sols, error } = await (supabase as any)
    .from("bancos_solicitudes")
    .select(
      "id, id_cuenta_cobranza, id_banco, id_agente, estatus, motivo_cierre, notas_banco, " +
        "monto_financiar, plazo_anios, mensualidad_estimada_min, mensualidad_estimada_max, " +
        "tasa_estimada_min, tasa_estimada_max, cat_estimado_min, cat_estimado_max, " +
        "fecha_envio, fecha_respuesta_banco, fecha_creacion, fecha_actualizacion",
    )
    .eq("id_banco", idBanco)
    .eq("activo", true)
    .order("fecha_envio", { ascending: false });
  if (error || !sols || sols.length === 0) return [];

  // 2. Cuentas de cobranza referenciadas.
  const ccIds = Array.from(new Set(sols.map((s: any) => s.id_cuenta_cobranza).filter(Boolean)));
  const { data: ccs } = ccIds.length
    ? ((await (supabase as any)
        .from("cuentas_cobranza")
        .select("id, id_oferta, id_propiedad, precio_final, fecha_compra")
        .in("id", ccIds)) as any)
    : { data: [] };
  const ccById = new Map<number, any>((ccs || []).map((c: any) => [c.id, c]));

  // 3. Ofertas → persona_lead + fallback de propiedad.
  const ofertaIds = Array.from(new Set((ccs || []).map((c: any) => c.id_oferta).filter(Boolean)));
  const { data: ofs } = ofertaIds.length
    ? ((await (supabase as any)
        .from("ofertas")
        .select("id, id_persona_lead, id_propiedad")
        .in("id", ofertaIds)) as any)
    : { data: [] };
  const ofertaById = new Map<number, any>((ofs || []).map((o: any) => [o.id, o]));

  // 4. Personas (cliente).
  const personaIds = Array.from(
    new Set((ofs || []).map((o: any) => o.id_persona_lead).filter(Boolean)),
  );
  const { data: pers } = personaIds.length
    ? ((await (supabase as any)
        .from("personas")
        .select("id, nombre_legal, email, telefono, clave_pais_telefono")
        .in("id", personaIds)) as any)
    : { data: [] };
  const personaById = new Map<number, any>((pers || []).map((p: any) => [p.id, p]));

  // 5. Propiedad → edificio_modelo → edificio → proyecto (proyecto/unidad/dirección).
  const propIds = Array.from(
    new Set(
      sols
        .map((s: any) => {
          const cc = ccById.get(s.id_cuenta_cobranza);
          const of = cc?.id_oferta ? ofertaById.get(cc.id_oferta) : null;
          return cc?.id_propiedad ?? of?.id_propiedad ?? null;
        })
        .filter(Boolean),
    ),
  );
  const { data: props } = propIds.length
    ? ((await (supabase as any)
        .from("propiedades")
        .select("id, numero_propiedad, id_edificio_modelo")
        .in("id", propIds)) as any)
    : { data: [] };
  const propById = new Map<number, any>((props || []).map((p: any) => [p.id, p]));

  const emIds = Array.from(
    new Set((props || []).map((p: any) => p.id_edificio_modelo).filter(Boolean)),
  );
  const { data: ems } = emIds.length
    ? ((await (supabase as any)
        .from("edificios_modelos")
        .select("id, id_edificio")
        .in("id", emIds)) as any)
    : { data: [] };
  const edIdByEm = new Map<number, number | null>((ems || []).map((e: any) => [e.id, e.id_edificio]));

  const edIds = Array.from(new Set((ems || []).map((e: any) => e.id_edificio).filter(Boolean)));
  const { data: eds } = edIds.length
    ? ((await (supabase as any).from("edificios").select("id, id_proyecto").in("id", edIds)) as any)
    : { data: [] };
  const projIdByEd = new Map<number, number | null>((eds || []).map((e: any) => [e.id, e.id_proyecto]));

  const projIds = Array.from(new Set((eds || []).map((e: any) => e.id_proyecto).filter(Boolean)));
  const { data: projs } = projIds.length
    ? ((await (supabase as any)
        .from("proyectos")
        .select("id, nombre, direccion, fecha_entrega_proyecto, fecha_entrega")
        .in("id", projIds)) as any)
    : { data: [] };
  const projById = new Map<number, any>((projs || []).map((p: any) => [p.id, p]));

  // 6. Mapear a BankLead.
  return sols.map((s: any): BankLead => {
    const cc = ccById.get(s.id_cuenta_cobranza);
    const of = cc?.id_oferta ? ofertaById.get(cc.id_oferta) : null;
    const persona = of?.id_persona_lead ? personaById.get(of.id_persona_lead) : null;
    const idProp = cc?.id_propiedad ?? of?.id_propiedad ?? null;
    const prop = idProp ? propById.get(idProp) : null;
    const emId = prop?.id_edificio_modelo ?? null;
    const edId = emId != null ? edIdByEm.get(emId) ?? null : null;
    const projId = edId != null ? projIdByEd.get(edId) ?? null : null;
    const proj = projId != null ? projById.get(projId) : null;

    const status = mapEstatus(s.estatus);
    const num = (v: any) => (v != null ? Number(v) : 0);
    const monto = num(s.monto_financiar);
    const precio = num(cc?.precio_final);
    const fechaEnvio = s.fecha_envio ?? s.fecha_creacion ?? new Date().toISOString();
    const fechaEscrituracion = proj?.fecha_entrega_proyecto ?? proj?.fecha_entrega ?? "";

    return {
      id: String(s.id),
      bankId: String(s.id_banco),
      status,
      assignedAgentId: s.id_agente != null ? String(s.id_agente) : undefined,
      closeReason: s.motivo_cierre ?? undefined,
      client: {
        fullName: persona?.nombre_legal || "Cliente sin nombre",
        phone: phone(persona),
        email: persona?.email || "",
        // No persistidos en la solicitud — neutrales (no se muestran en la mesa).
        ingresoRange: "30k-60k",
        situacionLaboral: "asalariado",
        esClienteActual: false,
        consent: { granted: true, timestamp: fechaEnvio, ley: "LFPDPPP" },
      },
      credit: {
        montoFinanciar: monto,
        plazoAnios: (s.plazo_anios as 5 | 10 | 15 | 20) ?? 20,
        estMonthlyMin: num(s.mensualidad_estimada_min),
        estMonthlyMax: num(s.mensualidad_estimada_max),
        estRateMin: num(s.tasa_estimada_min),
        estRateMax: num(s.tasa_estimada_max),
        estCatMin: num(s.cat_estimado_min),
        estCatMax: num(s.cat_estimado_max),
      },
      property: {
        project: proj?.nombre || "Sin proyecto",
        unit: prop?.numero_propiedad || "—",
        address: proj?.direccion || "",
        totalValue: precio,
        saldoFinanciar: monto,
        // Unidad en pago final (cercana a escrituración) — referencial.
        avanceObra: 100,
        etapa: "Terminado",
        fechaEscrituracion,
      },
      sozu: {
        leadId: `SOL-${String(s.id).padStart(5, "0")}`,
        score: "verde",
        declaredAt: fechaEnvio,
        agenteComercial: { name: "—", phone: "" },
      },
      activity: [
        {
          id: `${s.id}-creado`,
          ts: fechaEnvio,
          author: "Cliente",
          type: "creado",
          note: `Solicitud enviada por el cliente${
            s.monto_financiar ? ` · financiar ${Math.round(monto).toLocaleString("es-MX")}` : ""
          }`,
        },
        ...(s.notas_banco
          ? [
              {
                id: `${s.id}-nota`,
                ts: s.fecha_actualizacion ?? fechaEnvio,
                author: "Banco",
                type: "nota" as const,
                note: s.notas_banco as string,
              },
            ]
          : []),
      ],
      createdAt: s.fecha_creacion ?? fechaEnvio,
      lastUpdate: s.fecha_actualizacion ?? fechaEnvio,
    };
  });
}

/** Solicitudes reales del banco seleccionado (vacío si no hay banco / DDL pendiente). */
export function useSolicitudesBanco(idBanco?: number | null) {
  return useQuery({
    queryKey: KEY(idBanco),
    enabled: idBanco != null,
    staleTime: 30_000,
    queryFn: () => fetchSolicitudesBanco(idBanco as number),
  });
}

export interface ActualizarSolicitudInput {
  id: number;
  idBanco: number; // para invalidar la query del banco
  patch: {
    estatus?: LeadStatus;
    id_agente?: number | null;
    motivo_cierre?: string | null;
    notas_banco?: string | null;
    fecha_respuesta_banco?: string | null;
  };
}

/**
 * Persiste la gestión del banco sobre una solicitud (cambio de estatus,
 * asignación de ejecutivo, notas, motivo de cierre). Escribe directamente en
 * `bancos_solicitudes` — el CHECK de la columna `estatus` admite todos los
 * valores de `LeadStatus`.
 */
export function useActualizarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: ActualizarSolicitudInput): Promise<boolean> => {
      const { error } = await (supabase as any)
        .from("bancos_solicitudes")
        .update({ ...patch, fecha_actualizacion: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: (_ok, vars) => {
      qc.invalidateQueries({ queryKey: KEY(vars.idBanco) });
    },
  });
}
