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

/** Scope de la consulta: id de un banco, o "all" (todos, vista Super Admin). */
export type SolicitudScope = number | "all";

const KEY = (scope?: SolicitudScope | null) => ["solicitudes-banco", scope ?? "none"] as const;

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

async function fetchSolicitudesBanco(scope: SolicitudScope): Promise<BankLead[]> {
  // 1. Solicitudes activas. `scope` = un banco (id) o "all" (todos los bancos,
  // vista Super Administrador → sin filtro por banco).
  // `email_agente` es la asignación al usuario del sistema (reemplazo de
  // `id_agente`). Probe graceful: si la columna aún no existe (DDL pendiente),
  // reintenta sin ella para no ocultar las solicitudes.
  const baseCols =
    "id, id_cuenta_cobranza, id_banco, id_agente, estatus, motivo_cierre, notas_banco, " +
    "monto_financiar, plazo_anios, mensualidad_estimada_min, mensualidad_estimada_max, " +
    "tasa_estimada_min, tasa_estimada_max, cat_estimado_min, cat_estimado_max, " +
    "fecha_envio, fecha_respuesta_banco, fecha_creacion, fecha_actualizacion";
  const runQuery = (cols: string) => {
    let q = (supabase as any)
      .from("bancos_solicitudes")
      .select(cols)
      .eq("activo", true);
    if (scope !== "all") q = q.eq("id_banco", scope);
    return q.order("fecha_envio", { ascending: false });
  };
  let sols: any[] | null;
  let error: any;
  ({ data: sols, error } = await runQuery(`${baseCols}, email_agente`));
  if (error) {
    ({ data: sols, error } = await runQuery(baseCols));
  }
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

  // 6. Datos comerciales de la venta (por cuenta): compradores + total pagado.
  //    Total pagado = Σ aplicaciones_pago.monto (es_multa=false) de los acuerdos
  //    de la cuenta; saldo = precio_final − total pagado (ver CLAUDE.md).

  // 6a. Compradores (copropietarios) por cuenta.
  const { data: compradores } = ccIds.length
    ? ((await (supabase as any)
        .from("compradores")
        .select("id_cuenta_cobranza, id_persona, porcentaje_copropiedad")
        .in("id_cuenta_cobranza", ccIds)
        .eq("activo", true)) as any)
    : { data: [] };
  const compradorPersonaIds = Array.from(
    new Set((compradores || []).map((c: any) => c.id_persona).filter(Boolean)),
  );
  const { data: personasComp } = compradorPersonaIds.length
    ? ((await (supabase as any)
        .from("personas")
        .select("id, nombre_legal, nombre_comercial")
        .in("id", compradorPersonaIds)) as any)
    : { data: [] };
  const compradorNombreById = new Map<number, string>(
    (personasComp || []).map((p: any) => [p.id, p.nombre_comercial || p.nombre_legal || ""]),
  );
  const compradoresByCc = new Map<
    number,
    Array<{ idPersona: number; nombre: string; porcentaje: number }>
  >();
  (compradores || []).forEach((c: any) => {
    const nombre = compradorNombreById.get(c.id_persona) || "";
    if (!nombre || c.id_persona == null) return;
    const arr = compradoresByCc.get(c.id_cuenta_cobranza) ?? [];
    arr.push({
      idPersona: Number(c.id_persona),
      nombre,
      porcentaje: Number(c.porcentaje_copropiedad) || 0,
    });
    compradoresByCc.set(c.id_cuenta_cobranza, arr);
  });

  // 6b. Total pagado por cuenta: acuerdos de la cuenta → aplicaciones_pago.
  const { data: acuerdos } = ccIds.length
    ? ((await (supabase as any)
        .from("acuerdos_pago")
        .select("id, id_cuenta_cobranza, id_concepto")
        .in("id_cuenta_cobranza", ccIds)
        .in("id_concepto", [1, 2, 3, 5])
        .eq("activo", true)) as any)
    : { data: [] };
  const ccByAcuerdo = new Map<number, number>(
    (acuerdos || []).map((a: any) => [a.id, a.id_cuenta_cobranza]),
  );
  const acuerdoIds = (acuerdos || []).map((a: any) => a.id);
  const { data: aplicaciones } = acuerdoIds.length
    ? ((await (supabase as any)
        .from("aplicaciones_pago")
        .select("id_acuerdo_pago, monto, es_multa")
        .in("id_acuerdo_pago", acuerdoIds)
        .eq("activo", true)) as any)
    : { data: [] };
  const totalPagadoByCc = new Map<number, number>();
  (aplicaciones || []).forEach((ap: any) => {
    if (ap.es_multa) return;
    const ccId = ccByAcuerdo.get(ap.id_acuerdo_pago);
    if (ccId == null) return;
    totalPagadoByCc.set(ccId, (totalPagadoByCc.get(ccId) ?? 0) + (Number(ap.monto) || 0));
  });

  // 7. Mapear a BankLead.
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
      // Asignación al usuario del sistema (email). `id_agente` queda legacy.
      assignedAgentId: s.email_agente ? String(s.email_agente) : undefined,
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
      sale: cc
        ? (() => {
            const totalPagado = totalPagadoByCc.get(cc.id) ?? 0;
            return {
              fechaVenta: cc.fecha_compra ?? null,
              valorEscrituracion: precio,
              totalPagado: +totalPagado.toFixed(2),
              saldoPendiente: +Math.max(0, precio - totalPagado).toFixed(2),
              compradores: compradoresByCc.get(cc.id) ?? [],
            };
          })()
        : undefined,
      idCuentaCobranza: cc?.id ?? s.id_cuenta_cobranza ?? null,
      // Cliente(s) para el visor de datos personales: copropietarios reales;
      // si aún no hay filas en `compradores`, cae a la persona-lead de la oferta.
      clientes: (() => {
        const comps = cc ? compradoresByCc.get(cc.id) ?? [] : [];
        if (comps.length > 0) {
          return comps.map((c) => ({ idPersona: c.idPersona, nombre: c.nombre }));
        }
        if (persona?.id != null) {
          return [{ idPersona: Number(persona.id), nombre: persona.nombre_legal || "Cliente" }];
        }
        return [];
      })(),
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

/**
 * Solicitudes reales según el scope: un banco (id) o "all" (todos, vista Super
 * Administrador). Vacío si no hay scope / DDL pendiente.
 */
export function useSolicitudesBanco(scope?: SolicitudScope | null) {
  return useQuery({
    queryKey: KEY(scope),
    enabled: scope != null,
    staleTime: 30_000,
    queryFn: () => fetchSolicitudesBanco(scope as SolicitudScope),
  });
}

/** Un pago aplicado a la cuenta de cobranza (desglose del "Total pagado"). */
export interface PagoAplicadoBanco {
  /** pagos.fecha_pago (ISO) */
  fechaPago: string | null;
  /** metodos_pago.nombre */
  metodo: string;
  /** aplicaciones_pago.monto (monto aplicado a la cuenta) */
  montoAplicado: number;
}

/**
 * Desglose de pagos que componen el "Total pagado" de una solicitud del banco.
 * Mismo criterio que el total mostrado: aplicaciones de pago (es_multa = false)
 * de los acuerdos de la cuenta (conceptos 1,2,3,5). Se consulta bajo demanda
 * (al abrir el modal). Devuelve `[]` si no hay cuenta o error.
 */
export function usePagosCuentaBanco(idCuentaCobranza?: number | null) {
  return useQuery({
    queryKey: ["pagos-cuenta-banco", idCuentaCobranza ?? "none"],
    enabled: idCuentaCobranza != null,
    staleTime: 30_000,
    queryFn: async (): Promise<PagoAplicadoBanco[]> => {
      const ccId = idCuentaCobranza as number;
      const { data: acuerdos } = await (supabase as any)
        .from("acuerdos_pago")
        .select("id")
        .eq("id_cuenta_cobranza", ccId)
        .in("id_concepto", [1, 2, 3, 5])
        .eq("activo", true);
      const acuerdoIds = (acuerdos || []).map((a: any) => a.id);
      if (!acuerdoIds.length) return [];

      const { data: aplicaciones } = await (supabase as any)
        .from("aplicaciones_pago")
        .select(
          "monto, es_multa, pagos!fk_aplicaciones_pago_pago(fecha_pago, id_metodos_pago)",
        )
        .in("id_acuerdo_pago", acuerdoIds)
        .eq("activo", true);
      const rows = (aplicaciones || []).filter((ap: any) => !ap.es_multa);

      const metodoIds = Array.from(
        new Set(rows.map((r: any) => r.pagos?.id_metodos_pago).filter((v: any) => v != null)),
      );
      const { data: metodos } = metodoIds.length
        ? ((await (supabase as any)
            .from("metodos_pago")
            .select("id, nombre")
            .in("id", metodoIds)) as any)
        : { data: [] };
      const metodoById = new Map<number, string>(
        (metodos || []).map((m: any) => [m.id, m.nombre ?? ""]),
      );

      return rows
        .map((r: any) => ({
          fechaPago: r.pagos?.fecha_pago ?? null,
          metodo:
            r.pagos?.id_metodos_pago != null
              ? metodoById.get(r.pagos.id_metodos_pago) || "—"
              : "—",
          montoAplicado: Number(r.monto) || 0,
        }))
        .sort((a: PagoAplicadoBanco, b: PagoAplicadoBanco) =>
          (b.fechaPago ?? "").localeCompare(a.fechaPago ?? ""),
        );
    },
  });
}

export interface ActualizarSolicitudInput {
  id: number;
  idBanco: number; // para invalidar la query del banco
  patch: {
    estatus?: LeadStatus;
    /** Email del usuario del sistema asignado (reemplaza id_agente). */
    email_agente?: string | null;
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
    onSuccess: () => {
      // Invalida todas las vistas (un banco y la global "all").
      qc.invalidateQueries({ queryKey: ["solicitudes-banco"] });
    },
  });
}
