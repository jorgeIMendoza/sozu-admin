import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";

export type TipoCuentaDetalle = "Propiedad" | "Producto" | "Servicio";

export interface ComisionistaDetalle {
  email: string;
  nombre: string;
  rol: string;
  porcentaje: number;
  monto: number;
  es_externo: boolean;
  aprobada: boolean;
  pagada: boolean;
  url_evidencia_pago: string | null;
}

export type EstadoTimelineStep =
  | "completado"
  | "pendiente"
  | "no_aplica"
  | "sin_evidencia";

export type EstatusPagoFacturaDetalle =
  | "espera_autorizacion"
  | "autorizada"
  | "pagada"
  | "rechazada";

export interface TimelineStepReal {
  paso: number;
  nombre: string;
  estado: EstadoTimelineStep;
  fecha?: string;
  responsable?: string;
  detalle?: string;
  es_hito?: boolean;
  /** URL externa relacionada al paso (ej. PDF de la oferta, contrato firmado). */
  url?: string;
  /** Etiqueta visible para la URL (ej. "Ver oferta"). */
  url_label?: string;
  /** Lista de comprobantes/documentos enlazados al paso (e.g. enganche pagado en
   *  varias parcialidades por STP/transferencia/efectivo). Si se provee, se
   *  muestra debajo de `url` (cuando ambos existen). */
  urls?: Array<{ url: string; label: string }>;
  /** Detalle expandible click-to-show (paso 15: comisionistas internos). */
  expand?: {
    type: "comisionistas_internos";
    items: Array<{
      nombre: string;
      rol: string;
      porcentaje: number;
      monto: number;
      aprobada: boolean;
      pagada: boolean;
    }>;
  };
}

export interface PagoCliente {
  monto: number;
  fecha: string;
  url_recibo: string | null;
}

export interface ExpedienteVentaDetalle {
  id_cuenta_cobranza: number;
  folio: string;
  propiedad_label: string;
  proyecto_nombre: string;
  numero_departamento: string;
  modelo_nombre: string;
  edificio_nombre: string;
  tipo: TipoCuentaDetalle;
  producto_nombre: string;
  precio_final: number;
  metraje: number;
  precio_m2: number;
  porcentaje_comision_venta: number;
  comision_total_sozu: number;
  comision_externa: number;
  comision_a_dispersar: number;
  compradores: Array<{ nombre: string; porcentaje: number }>;
  propietario: string;
  rfc_comprador: string;
  fecha_compra: string;
  dias_desde_compra: number;
  estatus_disponibilidad: string;
  comisionistas: ComisionistaDetalle[];
  timeline: TimelineStepReal[];
  url_contrato_firmado: string | null;
  url_factura_sozu: string | null;
  url_factura_xml_sozu: string | null;
  factura_sozu_estado: "sin_generar" | "draft" | "timbrada";
  url_factura_externa: string | null;
  numero_factura_externa: string | null;
  pago_apartado: PagoCliente | null;
  pago_enganche: PagoCliente | null;
  oferta_comercial: {
    id_oferta: number | null;
    precio_final: number;
    precio_lista: number;
    ahorro: number;
    apartado: number;
    enganche: number;
    parcialidades_total: number;
    parcialidades_count: number;
    a_la_entrega: number;
    url_oferta: string | null;
    folio_oferta: string | null;
  };
  estatus_pago: EstatusPagoFacturaDetalle;
  fecha_pago_comision: string | null;
  notas_rechazo_comision: string | null;
}

const AGENTE_INMOBILIARIO_ROL_ID = 3;
const DOMINIOS_INTERNOS = ["sozu.com", "investimento.mx", "tallwood.mx", "daiku.mx"];

function esDominioInterno(email: string | null | undefined) {
  if (!email) return true;
  const dom = email.split("@")[1]?.toLowerCase();
  if (!dom) return true;
  return DOMINIOS_INTERNOS.includes(dom);
}

function diffDays(from: string, to: Date) {
  const d = new Date(from);
  return Math.round((to.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function useExpedienteVentaDetalle(folio: string | null | undefined) {
  return useQuery({
    queryKey: ["expediente_venta_detalle", folio],
    enabled: !!folio,
    queryFn: async (): Promise<ExpedienteVentaDetalle | null> => {
      // Acepta los 3 formatos: COB-#### (legacy), CC-000### (Propiedad), CCP-000### (Producto/Servicio)
      const match = folio?.match(/(?:COB|CCP|CC)-0*(\d+)/i);
      if (!match) return null;
      const cuentaId = Number(match[1]);

      const { data: cuenta, error: ccErr } = await supabase
        .from("cuentas_cobranza")
        .select(
          "id, id_oferta, precio_final, porcentaje_comision_venta, fecha_compra, es_aprobado, activo, iva_incluido, clabe_stp, url_factura_comision, url_factura_xml_comision, es_draft_factura_comision, fecha_pago_comision, es_pagada_comision_venta, fecha_actualizacion, contrato_draft, id_tipo_cancelacion, estatus_autorizacion_comision, notas_rechazo_comision",
        )
        .eq("id", cuentaId)
        .maybeSingle();
      if (ccErr) throw ccErr;
      if (!cuenta) return null;

      const idOferta = cuenta.id_oferta as number | null;

      const { data: oferta, error: ofErr } = idOferta != null
        ? await supabase
            .from("ofertas")
            .select("id, id_propiedad, id_producto, id_persona_lead, email_creador, fecha_generacion, fecha_creacion, url")
            .eq("id", idOferta)
            .maybeSingle()
        : { data: null, error: null };
      if (ofErr) throw ofErr;

      const idPropiedad = oferta?.id_propiedad ?? null;
      const idProducto = oferta?.id_producto ?? null;

      const { data: propiedad, error: prErr } = idPropiedad != null
        ? await supabase
            .from("propiedades")
            .select(
              "id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno, m2_interiores, m2_exteriores, m2_loft, precio_lista, id_estatus_disponibilidad",
            )
            .eq("id", idPropiedad)
            .maybeSingle()
        : { data: null, error: null };
      if (prErr) throw prErr;

      const idEdificioModelo = propiedad?.id_edificio_modelo ?? null;

      const { data: edModelo, error: emErr } = idEdificioModelo != null
        ? await supabase
            .from("edificios_modelos")
            .select("id, id_edificio, id_modelo")
            .eq("id", idEdificioModelo)
            .maybeSingle()
        : { data: null, error: null };
      if (emErr) throw emErr;

      const [{ data: modelo, error: mdErr }, { data: edificio, error: edErr }] = await Promise.all([
        edModelo?.id_modelo != null
          ? supabase.from("modelos").select("id, nombre").eq("id", edModelo.id_modelo).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        edModelo?.id_edificio != null
          ? supabase
              .from("edificios")
              .select("id, nombre, id_proyecto")
              .eq("id", edModelo.id_edificio)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (mdErr) throw mdErr;
      if (edErr) throw edErr;

      const { data: proyecto, error: prjErr } = edificio?.id_proyecto != null
        ? await supabase
            .from("proyectos")
            .select("id, nombre")
            .eq("id", edificio.id_proyecto)
            .maybeSingle()
        : { data: null, error: null };
      if (prjErr) throw prjErr;

      const { data: producto, error: prodErr } = idProducto != null
        ? await (supabase as any)
            .from("productos_servicios")
            .select(
              "id, nombre, id_categoria, categorias_producto!productos_servicios_id_categoria_fkey(nombre)",
            )
            .eq("id", idProducto)
            .maybeSingle()
        : { data: null, error: null };
      if (prodErr) throw prodErr;

      const { data: estatusDisp, error: edispErr } = propiedad?.id_estatus_disponibilidad != null
        ? await supabase
            .from("estatus_disponibilidad")
            .select("id, nombre")
            .eq("id", propiedad.id_estatus_disponibilidad)
            .maybeSingle()
        : { data: null, error: null };
      if (edispErr) throw edispErr;

      const idEntidadDueno = propiedad?.id_entidad_relacionada_dueno ?? null;
      const { data: entidadDueno, error: entErr } = idEntidadDueno != null
        ? await (supabase as any)
            .from("entidades_relacionadas")
            .select("id, id_persona, personas!fk_entrel_persona(nombre_legal, nombre_comercial)")
            .eq("id", idEntidadDueno)
            .maybeSingle()
        : { data: null, error: null };
      if (entErr) throw entErr;

      const propietario =
        entidadDueno?.personas?.nombre_comercial ||
        entidadDueno?.personas?.nombre_legal ||
        "";

      const { data: compradoresRaw, error: compErr } = await supabase
        .from("compradores")
        .select("id_persona, porcentaje_copropiedad")
        .eq("id_cuenta_cobranza", cuentaId)
        .eq("activo", true);
      if (compErr) throw compErr;

      const compradorPersonaIds = (compradoresRaw || [])
        .map((c) => c.id_persona)
        .filter((v): v is number => v != null);

      const { data: personasComp, error: pErr } = compradorPersonaIds.length
        ? await (supabase as any)
            .from("personas")
            .select("id, nombre_legal, nombre_comercial, rfc")
            .in("id", compradorPersonaIds)
        : { data: [] as any[], error: null };
      if (pErr) throw pErr;

      const personaMap = new Map<number, string>(
        ((personasComp || []) as Array<{ id: number; nombre_legal: string | null; nombre_comercial: string | null }>).map((p) => [
          p.id,
          p.nombre_comercial || p.nombre_legal || "",
        ]),
      );

      const compradores = (compradoresRaw || [])
        .map((c) => ({
          nombre: personaMap.get(c.id_persona) || "",
          porcentaje: Number(c.porcentaje_copropiedad) || 0,
        }))
        .filter((c) => !!c.nombre);

      // Comisionistas (internos + externos) de esta cuenta
      const { data: comisionistas, error: cmErr } = await supabase
        .from("comisionistas")
        .select(
          "email_usuario, porcentaje_comision, aprobada, pagada, fecha_pago_comision, fecha_creacion, url_evidencia_pago",
        )
        .eq("id_cuenta_cobranza", cuentaId)
        .eq("activo", true);
      if (cmErr) throw cmErr;

      // Documentos asociados a la cuenta o a la propiedad (todos los tipos)
      const orPropiedadFilter = idPropiedad != null
        ? `id_cuenta_cobranza.eq.${cuentaId},id_propiedad.eq.${idPropiedad}`
        : `id_cuenta_cobranza.eq.${cuentaId}`;
      const { data: documentos, error: docsErr } = await supabase
        .from("documentos")
        .select(
          "id, id_tipo_documento, url, numero, id_estatus_verificacion, fecha_creacion, fecha_actualizacion, id_cuenta_cobranza, id_propiedad",
        )
        .or(orPropiedadFilter)
        .eq("activo", true);
      if (docsErr) throw docsErr;

      // Acuerdos de pago — Apartado(1), Enganche(2), A la entrega(3), Parcialidad(5)
      const { data: acuerdos, error: acErr } = await supabase
        .from("acuerdos_pago")
        .select("id, id_concepto, monto, pago_completado, fecha_creacion, fecha_actualizacion")
        .eq("id_cuenta_cobranza", cuentaId)
        .in("id_concepto", [1, 2, 3, 5])
        .eq("activo", true);
      if (acErr) throw acErr;

      // Fechas reales y montos del pago vía aplicaciones_pago + pagos
      const acuerdoIds = (acuerdos || []).map((a: any) => a.id);
      const { data: aplicacionesPago, error: apErr } = acuerdoIds.length
        ? await (supabase as any)
            .from("aplicaciones_pago")
            .select(
              "id_acuerdo_pago, monto, pagos!fk_aplicaciones_pago_pago(id, fecha_pago, monto, url_recibo, url_cep, id_metodos_pago)",
            )
            .in("id_acuerdo_pago", acuerdoIds)
            .eq("activo", true)
        : { data: [] as any[], error: null };
      if (apErr) throw apErr;

      // Métodos de pago referenciados — para etiquetar comprobantes
      // (STP / Transferencia / Efectivo / etc.)
      const metodoIds = Array.from(
        new Set(
          ((aplicacionesPago || []) as Array<any>)
            .map((ap) => ap.pagos?.id_metodos_pago)
            .filter((v): v is number => v != null),
        ),
      );
      const { data: metodosPagoRows, error: mpErr } = metodoIds.length
        ? await supabase
            .from("metodos_pago")
            .select("id, nombre")
            .in("id", metodoIds)
        : { data: [] as Array<{ id: number; nombre: string | null }>, error: null };
      if (mpErr) throw mpErr;
      const metodoNombreById = new Map<number, string>(
        (metodosPagoRows || []).map((m) => [m.id, m.nombre ?? ""]),
      );

      const fechaPorAcuerdo = new Map<number, string>();
      const pagoPorAcuerdo = new Map<number, { monto: number; fecha: string; url_recibo: string | null }>();
      const comprobantesPorAcuerdo = new Map<number, Array<{ url: string; label: string }>>();
      const pagosVistos = new Set<string>();
      ((aplicacionesPago || []) as Array<{ id_acuerdo_pago: number; monto: number | null; pagos: { id: number | null; fecha_pago: string | null; monto: number | null; url_recibo: string | null; url_cep: string | null; id_metodos_pago: number | null } | null }>).forEach((ap) => {
        const fecha = ap.pagos?.fecha_pago;
        if (fecha && ap.id_acuerdo_pago != null) {
          if (!fechaPorAcuerdo.has(ap.id_acuerdo_pago)) {
            fechaPorAcuerdo.set(ap.id_acuerdo_pago, new Date(fecha).toISOString().slice(0, 10));
          }
          if (!pagoPorAcuerdo.has(ap.id_acuerdo_pago)) {
            // Comprobante: efectivo/transferencia → url_recibo; STP → url_cep
            const comprobante = ap.pagos?.url_recibo ?? ap.pagos?.url_cep ?? null;
            pagoPorAcuerdo.set(ap.id_acuerdo_pago, {
              monto: Number(ap.monto ?? ap.pagos?.monto ?? 0),
              fecha: new Date(fecha).toISOString().slice(0, 10),
              url_recibo: comprobante,
            });
          }
          // Lista completa de comprobantes por acuerdo (todas las parcialidades)
          const urlComprobante = ap.pagos?.url_cep ?? ap.pagos?.url_recibo ?? null;
          if (urlComprobante) {
            // Deduplicar por (acuerdo, id_pago) para no repetir si la misma factura
            // se aplica varias veces con distintos montos.
            const dedupKey = `${ap.id_acuerdo_pago}:${ap.pagos?.id ?? urlComprobante}`;
            if (!pagosVistos.has(dedupKey)) {
              pagosVistos.add(dedupKey);
              const metodoNombre = ap.pagos?.id_metodos_pago != null
                ? metodoNombreById.get(ap.pagos.id_metodos_pago) || ""
                : "";
              const fechaCorta = new Date(fecha).toISOString().slice(0, 10);
              const label = metodoNombre
                ? `Comprobante ${metodoNombre} · ${fechaCorta}`
                : `Comprobante · ${fechaCorta}`;
              const arr = comprobantesPorAcuerdo.get(ap.id_acuerdo_pago) ?? [];
              arr.push({ url: urlComprobante, label });
              comprobantesPorAcuerdo.set(ap.id_acuerdo_pago, arr);
            }
          }
        }
      });

      // Persona-lead (prospecto inicial)
      const idPersonaLead = (oferta as any)?.id_persona_lead ?? null;
      const { data: personaLead, error: plErr } = idPersonaLead != null
        ? await (supabase as any)
            .from("personas")
            .select("id, nombre_legal, nombre_comercial, fecha_creacion")
            .eq("id", idPersonaLead)
            .maybeSingle()
        : { data: null, error: null };
      if (plErr) throw plErr;

      // Última reserva de cita del prospecto en el proyecto comprado
      const idProyecto = edificio?.id_proyecto ?? null;
      const { data: ultimaReservaArr, error: rcErr } =
        idPersonaLead != null && idProyecto != null
          ? await supabase
              .from("reservas_citas")
              .select(
                "id, fecha, fecha_asistencia, id_estatus_cita, id_agente, fecha_creacion",
              )
              .eq("id_persona_prospecto", idPersonaLead)
              .eq("id_proyecto", idProyecto)
              .eq("activo", true)
              .order("fecha", { ascending: false, nullsFirst: false })
              .order("fecha_creacion", { ascending: false, nullsFirst: false })
              .limit(1)
          : { data: [] as any[], error: null };
      if (rcErr) throw rcErr;
      const ultimaReserva: any = (ultimaReservaArr || [])[0] ?? null;

      const { data: agenteReserva, error: agErr } =
        ultimaReserva?.id_agente != null
          ? await (supabase as any)
              .from("personas")
              .select("id, nombre_legal, nombre_comercial")
              .eq("id", ultimaReserva.id_agente)
              .maybeSingle()
          : { data: null, error: null };
      if (agErr) throw agErr;

      const emails = Array.from(
        new Set(
          (comisionistas || [])
            .map((c) => c.email_usuario)
            .filter((v): v is string => !!v),
        ),
      );

      const [
        { data: usuarios, error: usErr },
        { data: personasCom, error: peErr },
      ] = await Promise.all([
        emails.length
          ? supabase.from("usuarios").select("email, nombre, rol_id").in("email", emails)
          : Promise.resolve({ data: [] as Array<{ email: string; nombre: string | null; rol_id: number | null }>, error: null }),
        emails.length
          ? (supabase as any)
              .from("personas")
              .select("email, nombre_legal, nombre_comercial, tipo_persona")
              .in("email", emails)
              .eq("activo", true)
          : Promise.resolve({ data: [] as Array<{ email: string; nombre_legal: string | null; nombre_comercial: string | null; tipo_persona: string | null }>, error: null }),
      ]);
      if (usErr) throw usErr;
      if (peErr) throw peErr;

      const usuariosMap = new Map<string, { nombre: string; rolId: number | null }>();
      (usuarios || []).forEach((u: any) => {
        if (u.email) usuariosMap.set(u.email, { nombre: u.nombre ?? "", rolId: u.rol_id ?? null });
      });

      const personasComMap = new Map<string, { nombre: string; tipoPersona: string | null }>();
      ((personasCom || []) as Array<{ email: string | null; nombre_legal: string | null; nombre_comercial: string | null; tipo_persona: string | null }>).forEach((p) => {
        if (p.email) {
          personasComMap.set(p.email, {
            nombre: p.nombre_comercial || p.nombre_legal || "",
            tipoPersona: p.tipo_persona,
          });
        }
      });

      const rolIds = Array.from(
        new Set(
          (usuarios || [])
            .map((u: any) => u.rol_id)
            .filter((v: any): v is number => v != null),
        ),
      );
      const { data: roles, error: rolesErr } = rolIds.length
        ? await supabase.from("roles").select("id, nombre").in("id", rolIds)
        : { data: [] as Array<{ id: number; nombre: string | null }>, error: null };
      if (rolesErr) throw rolesErr;
      const rolesMap = new Map((roles || []).map((r: any) => [r.id, r.nombre ?? ""]));

      const precioFinal = Number(cuenta.precio_final) || 0;
      const pctVenta = Number(cuenta.porcentaje_comision_venta) || 0;
      const comisionTotalSozu = +((precioFinal * pctVenta) / 100).toFixed(2);

      const comisionistasDetalle: ComisionistaDetalle[] = (comisionistas || []).map((c) => {
        const usuario = c.email_usuario ? usuariosMap.get(c.email_usuario) : undefined;
        const persona = c.email_usuario ? personasComMap.get(c.email_usuario) : undefined;
        const esInmobiliariaExterna = persona?.tipoPersona === "pm";
        const esAgenteExterno =
          usuario?.rolId === AGENTE_INMOBILIARIO_ROL_ID && !esDominioInterno(c.email_usuario);
        const esExterno = esInmobiliariaExterna || esAgenteExterno;
        const pct = Number(c.porcentaje_comision) || 0;
        return {
          email: c.email_usuario ?? "",
          nombre: persona?.nombre || usuario?.nombre || c.email_usuario || "",
          rol: usuario?.rolId != null ? rolesMap.get(usuario.rolId) ?? "Sin rol" : "Sin rol",
          porcentaje: pct,
          monto: +((precioFinal * pct) / 100).toFixed(2),
          es_externo: esExterno,
          aprobada: !!c.aprobada,
          pagada: !!c.pagada,
          url_evidencia_pago: (c as any).url_evidencia_pago ?? null,
        };
      });

      const comisionExterna = +comisionistasDetalle
        .filter((c) => c.es_externo)
        .reduce((sum, c) => sum + c.monto, 0)
        .toFixed(2);
      const comisionADispersar = +comisionistasDetalle
        .filter((c) => !c.es_externo)
        .reduce((sum, c) => sum + c.monto, 0)
        .toFixed(2);

      const metraje =
        (Number(propiedad?.m2_interiores) || 0) +
        (Number(propiedad?.m2_exteriores) || 0) +
        (Number((propiedad as any)?.m2_loft) || 0);
      const precioM2 = metraje > 0 ? +(precioFinal / metraje).toFixed(2) : 0;

      let tipoCuenta: TipoCuentaDetalle = "Propiedad";
      if (producto) {
        const categoria = ((producto as any).categorias_producto?.nombre || "").toLowerCase();
        tipoCuenta = categoria === "servicios" ? "Servicio" : "Producto";
      }

      const fechaCompra = cuenta.fecha_compra
        ? new Date(cuenta.fecha_compra).toISOString().slice(0, 10)
        : "";
      const dias = fechaCompra ? diffDays(fechaCompra, new Date()) : 0;

      const propiedadLabel = [edificio?.nombre, propiedad?.numero_propiedad]
        .filter(Boolean)
        .join(" · ");

      // ──────────────────────────────────────────────────────────
      // Timeline del ciclo (16 pasos)
      // ──────────────────────────────────────────────────────────
      const acuerdoApartado = (acuerdos || []).find((a: any) => a.id_concepto === 1);
      const acuerdoEnganche = (acuerdos || []).find((a: any) => a.id_concepto === 2);

      const fechaApartado = acuerdoApartado
        ? fechaPorAcuerdo.get(acuerdoApartado.id)
        : undefined;
      const fechaEnganche = acuerdoEnganche
        ? fechaPorAcuerdo.get(acuerdoEnganche.id)
        : undefined;

      const docs = (documentos || []) as Array<{
        id: number;
        id_tipo_documento: number;
        id_estatus_verificacion: number | null;
        fecha_creacion: string | null;
        fecha_actualizacion: string | null;
        numero: string | null;
        url: string | null;
      }>;
      const docContratoCliente = docs.find((d) => d.id_tipo_documento === 42); // Contrato firmado por cliente
      const docContratoCompletoValidado = docs.find(
        (d) => d.id_tipo_documento === 18 && d.id_estatus_verificacion === 2,
      );
      const docContratoCompleto = docs.find((d) => d.id_tipo_documento === 18);
      const docFacturaExterna = docs.find((d) => d.id_tipo_documento === 46);
      const urlFacturaExterna = docFacturaExterna?.url ?? null;
      const numeroFacturaExterna = docFacturaExterna?.numero ?? null;
      const algunDocValidado = docs.some((d) => d.id_estatus_verificacion === 2);

      const comisionistasExternos = comisionistasDetalle.filter((c) => c.es_externo);
      const comisionistasInternos = comisionistasDetalle.filter((c) => !c.es_externo);

      const fmtDateOnly = (s: string | null | undefined) =>
        s ? new Date(s).toISOString().slice(0, 10) : undefined;

      const fechasComisionistasInternosCreacion = comisionistasInternos
        .map((_) => null) // creación viene del raw, mapeo abajo
        .filter(Boolean);
      // Re-obtengo desde el raw para acceder a fecha_creacion / fecha_pago_comision
      const internosRaw = (comisionistas || []).filter((c) => {
        const u = c.email_usuario ? usuariosMap.get(c.email_usuario) : undefined;
        const p = c.email_usuario ? personasComMap.get(c.email_usuario) : undefined;
        const esInm = p?.tipoPersona === "pm";
        const esAg = u?.rolId === AGENTE_INMOBILIARIO_ROL_ID && !esDominioInterno(c.email_usuario);
        return !(esInm || esAg);
      });
      const externosRaw = (comisionistas || []).filter((c) => {
        const u = c.email_usuario ? usuariosMap.get(c.email_usuario) : undefined;
        const p = c.email_usuario ? personasComMap.get(c.email_usuario) : undefined;
        const esInm = p?.tipoPersona === "pm";
        const esAg = u?.rolId === AGENTE_INMOBILIARIO_ROL_ID && !esDominioInterno(c.email_usuario);
        return esInm || esAg;
      });

      const fechaCreacionInternos = internosRaw
        .map((c) => fmtDateOnly(c.fecha_creacion as string | null))
        .filter((v): v is string => !!v)
        .sort()[0];
      const todosInternosPagados =
        internosRaw.length > 0 && internosRaw.every((c) => !!c.pagada);
      const fechaDispersionInternos = todosInternosPagados
        ? internosRaw
            .map((c) => fmtDateOnly(c.fecha_pago_comision as string | null))
            .filter((v): v is string => !!v)
            .sort()
            .pop()
        : undefined;
      const fechaPagoExternoMayor = externosRaw
        .filter((c) => !!c.pagada)
        .map((c) => fmtDateOnly(c.fecha_pago_comision as string | null))
        .filter((v): v is string => !!v)
        .sort()
        .pop();
      const todosExternosPagados =
        externosRaw.length > 0 && externosRaw.every((c) => !!c.pagada);

      const tieneExternos = externosRaw.length > 0;

      const pagoApartado = acuerdoApartado && pagoPorAcuerdo.has(acuerdoApartado.id)
        ? pagoPorAcuerdo.get(acuerdoApartado.id)!
        : null;
      const pagoEnganche = acuerdoEnganche && pagoPorAcuerdo.has(acuerdoEnganche.id)
        ? pagoPorAcuerdo.get(acuerdoEnganche.id)!
        : null;

      const timeline: TimelineStepReal[] = [
        {
          paso: 1,
          nombre: "Prospecto creado",
          estado: personaLead ? "completado" : "sin_evidencia",
          fecha: fmtDateOnly((personaLead as any)?.fecha_creacion),
          responsable: (oferta as any)?.email_creador || undefined,
          detalle:
            (personaLead as any)?.nombre_comercial ||
            (personaLead as any)?.nombre_legal ||
            undefined,
        },
        {
          paso: 2,
          nombre: "Cita realizada",
          estado: ultimaReserva
            ? ultimaReserva.fecha_asistencia
              ? "completado"
              : "pendiente"
            : "sin_evidencia",
          fecha: ultimaReserva
            ? fmtDateOnly(ultimaReserva.fecha_asistencia || ultimaReserva.fecha)
            : undefined,
          responsable:
            (agenteReserva as any)?.nombre_comercial ||
            (agenteReserva as any)?.nombre_legal ||
            undefined,
          detalle: ultimaReserva
            ? ultimaReserva.fecha_asistencia
              ? "Asistencia registrada"
              : "Reserva agendada, sin registro de asistencia"
            : "Sin reservas para este prospecto en el proyecto",
        },
        {
          paso: 3,
          nombre: "Oferta generada",
          estado: oferta ? "completado" : "sin_evidencia",
          fecha: fmtDateOnly(
            (oferta as any)?.fecha_generacion || (oferta as any)?.fecha_creacion,
          ),
          responsable: (oferta as any)?.email_creador || "Sistema",
          detalle: oferta
            ? `Folio O-${String((oferta as any).id).padStart(6, "0")}${
                !(oferta as any)?.url ? " · PDF aún no generado" : ""
              }`
            : undefined,
          url: (oferta as any)?.url || undefined,
          url_label: (oferta as any)?.url ? "Ver oferta" : undefined,
        },
        {
          paso: 4,
          nombre: "Apartado: CLABE generada, primer pago",
          estado: acuerdoApartado?.pago_completado
            ? "completado"
            : acuerdoApartado
              ? "pendiente"
              : "sin_evidencia",
          fecha: fechaApartado || fmtDateOnly(acuerdoApartado?.fecha_creacion),
          responsable: "STP / Cliente",
          detalle: (() => {
            const partes: string[] = [];
            const clabe = (cuenta as any)?.clabe_stp as string | null | undefined;
            if (clabe) partes.push(`CLABE STP: ${clabe}`);
            if (pagoApartado?.monto) {
              partes.push(
                `Primer pago: ${new Intl.NumberFormat("es-MX", {
                  style: "currency",
                  currency: "MXN",
                }).format(pagoApartado.monto)}`,
              );
            }
            return partes.length > 0 ? partes.join(" · ") : undefined;
          })(),
          url: pagoApartado?.url_recibo || undefined,
          url_label: pagoApartado?.url_recibo ? "Ver comprobante" : undefined,
        },
        {
          paso: 5,
          nombre: "Documentación validada",
          estado: algunDocValidado
            ? "completado"
            : docs.length > 0
              ? "pendiente"
              : "sin_evidencia",
          fecha: algunDocValidado
            ? fmtDateOnly(
                docs.find((d) => d.id_estatus_verificacion === 2)?.fecha_creacion,
              )
            : undefined,
          responsable: "Equipo Compradores",
        },
        {
          paso: 6,
          nombre: "Contrato generado",
          estado: cuenta.contrato_draft != null ? "completado" : "pendiente",
          fecha: cuenta.contrato_draft != null
            ? fmtDateOnly((cuenta as any).fecha_actualizacion)
            : undefined,
          responsable: "Edge Function generar-contrato",
        },
        {
          paso: 7,
          nombre: "Firma cliente",
          estado: acuerdoApartado?.pago_completado
            ? "completado"
            : acuerdoApartado
              ? "pendiente"
              : "sin_evidencia",
          fecha: fechaApartado || fmtDateOnly(acuerdoApartado?.fecha_creacion),
          responsable: compradores[0]?.nombre || "Cliente",
          detalle: acuerdoApartado?.pago_completado
            ? "Aproximación: momento en que la propiedad pasó a Apartado"
            : undefined,
        },
        {
          paso: 8,
          nombre: "Firma SOZU",
          estado: docContratoCompletoValidado
            ? "completado"
            : docContratoCompleto
              ? "pendiente"
              : "sin_evidencia",
          fecha: docContratoCompletoValidado
            ? fmtDateOnly(docContratoCompletoValidado.fecha_actualizacion)
            : undefined,
          responsable: "Representante legal SOZU",
          detalle: docContratoCompletoValidado
            ? "Documento 'Contrato firmado completamente' marcado Validado"
            : docContratoCompleto
              ? "Doc cargado, pendiente validar"
              : "Sin documento 'Contrato firmado completamente'",
          url: docContratoCompletoValidado?.url ?? docContratoCompleto?.url ?? undefined,
          url_label:
            docContratoCompletoValidado?.url || docContratoCompleto?.url
              ? "Ver contrato firmado"
              : undefined,
        },
        {
          paso: 9,
          nombre: "Enganche completo",
          estado: acuerdoEnganche?.pago_completado
            ? "completado"
            : acuerdoEnganche
              ? "pendiente"
              : "sin_evidencia",
          fecha: fechaEnganche || fmtDateOnly(acuerdoEnganche?.fecha_actualizacion),
          responsable: "STP / Cliente",
          urls: acuerdoEnganche
            ? comprobantesPorAcuerdo.get(acuerdoEnganche.id)
            : undefined,
        },
        {
          paso: 10,
          nombre: "VENTA reconocida",
          estado: fechaCompra ? "completado" : "pendiente",
          fecha: fechaCompra || undefined,
          responsable: "Sistema",
          detalle:
            estatusDisp?.nombre === "Vendido"
              ? "cambio a estatus Vendida"
              : estatusDisp?.nombre || undefined,
          es_hito: true,
        },
        {
          paso: 11,
          nombre: "Factura SOZU al desarrollador",
          estado:
            cuenta.url_factura_comision != null && !cuenta.es_draft_factura_comision
              ? "completado"
              : cuenta.url_factura_comision != null
                ? "pendiente"
                : "pendiente",
          fecha: cuenta.url_factura_comision != null
            ? fmtDateOnly((cuenta as any).fecha_actualizacion)
            : undefined,
          responsable: "Dirección General",
          detalle:
            cuenta.url_factura_comision == null
              ? "Pendiente generación"
              : cuenta.es_draft_factura_comision
                ? "Generada en draft, pendiente timbre"
                : "Timbrada",
          url: cuenta.url_factura_comision ?? undefined,
          url_label: cuenta.url_factura_comision
            ? cuenta.es_draft_factura_comision
              ? "Ver factura (draft)"
              : "Ver factura SOZU"
            : undefined,
        },
        {
          paso: 12,
          nombre: "Pago del desarrollador a SOZU",
          estado: cuenta.es_pagada_comision_venta
            ? "completado"
            : cuenta.url_factura_comision != null && !cuenta.es_draft_factura_comision
              ? "pendiente"
              : "no_aplica",
          fecha: cuenta.es_pagada_comision_venta
            ? fmtDateOnly((cuenta as any).fecha_pago_comision)
            : undefined,
          detalle: (() => {
            if (!cuenta.es_pagada_comision_venta) {
              return "No aplica hasta emitir factura";
            }
            const partes: string[] = [];
            const clave = (cuenta as any).clave_rastreo_comision_venta as string | null | undefined;
            if (clave) partes.push(`Clave rastreo STP: ${clave}`);
            const monto = Number((cuenta as any).monto_comision_pagado ?? 0);
            if (monto > 0) {
              partes.push(
                new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(monto),
              );
            }
            return partes.length > 0 ? partes.join(" · ") : undefined;
          })(),
        },
        {
          paso: 13,
          nombre: "Factura externo",
          estado: !tieneExternos
            ? "no_aplica"
            : docFacturaExterna
              ? "completado"
              : "pendiente",
          fecha: docFacturaExterna ? fmtDateOnly(docFacturaExterna.fecha_creacion) : undefined,
          responsable: comisionistasExternos.map((c) => c.nombre).join(", ") || undefined,
          detalle: !tieneExternos
            ? "No hay comisionistas externos en esta cuenta"
            : !docFacturaExterna
              ? "Pendiente recepción"
              : undefined,
          url: docFacturaExterna?.url ?? undefined,
          url_label: docFacturaExterna?.url ? "Ver factura externo" : undefined,
        },
        {
          paso: 14,
          nombre: "Pago a externo",
          estado: !tieneExternos
            ? "no_aplica"
            : todosExternosPagados
              ? "completado"
              : "pendiente",
          fecha: todosExternosPagados ? fechaPagoExternoMayor : undefined,
          detalle: !tieneExternos
            ? "No aplica"
            : !todosExternosPagados
              ? `${externosRaw.filter((c) => !c.pagada).length} pendiente(s)`
              : undefined,
          urls: (() => {
            const links = comisionistasExternos
              .filter((c) => c.pagada && c.url_evidencia_pago)
              .map((c) => ({
                url: c.url_evidencia_pago as string,
                label: `Evidencia · ${c.nombre}`,
              }));
            return links.length > 0 ? links : undefined;
          })(),
        },
        {
          paso: 15,
          nombre: "Cálculo de comisiones internas",
          estado:
            internosRaw.length > 0
              ? "completado"
              : "sin_evidencia",
          fecha: fechaCreacionInternos,
          responsable: "Sistema",
          detalle:
            internosRaw.length > 0
              ? `${internosRaw.length} comisionista(s) interno(s)`
              : undefined,
          expand:
            internosRaw.length > 0
              ? {
                  type: "comisionistas_internos",
                  items: comisionistasInternos.map((c) => ({
                    nombre: c.nombre,
                    rol: c.rol,
                    porcentaje: c.porcentaje,
                    monto: c.monto,
                    aprobada: c.aprobada,
                    pagada: c.pagada,
                  })),
                }
              : undefined,
        },
        {
          paso: 16,
          nombre: "Dispersión de comisiones internas",
          estado:
            internosRaw.length === 0
              ? "no_aplica"
              : todosInternosPagados
                ? "completado"
                : "pendiente",
          fecha: fechaDispersionInternos,
          detalle:
            internosRaw.length === 0
              ? "No aplica"
              : !todosInternosPagados
                ? `${internosRaw.filter((c) => !c.pagada).length} pendiente(s)`
                : undefined,
        },
      ];

      const urlFacturaSozu = (cuenta as any).url_factura_comision || null;
      const urlFacturaXmlSozu = (cuenta as any).url_factura_xml_comision || null;
      const isDraftFacturaSozu = !!(cuenta as any).es_draft_factura_comision;
      let facturaSozuEstado: "sin_generar" | "draft" | "timbrada";
      if (!urlFacturaSozu) facturaSozuEstado = "sin_generar";
      else if (isDraftFacturaSozu) facturaSozuEstado = "draft";
      else facturaSozuEstado = "timbrada";

      const rfcComprador =
        ((personasComp || []) as Array<any>).find((p) => p.rfc)?.rfc ?? "";

      return {
        id_cuenta_cobranza: cuentaId,
        folio: formatCuentaCobranzaId(cuentaId, tipoCuenta),
        propiedad_label: propiedadLabel,
        proyecto_nombre: proyecto?.nombre ?? "",
        numero_departamento: propiedad?.numero_propiedad ?? "",
        modelo_nombre: modelo?.nombre ?? "",
        edificio_nombre: edificio?.nombre ?? "",
        tipo: tipoCuenta,
        producto_nombre: (producto as any)?.nombre ?? "",
        precio_final: precioFinal,
        metraje,
        precio_m2: precioM2,
        porcentaje_comision_venta: pctVenta,
        comision_total_sozu: comisionTotalSozu,
        comision_externa: comisionExterna,
        comision_a_dispersar: comisionADispersar,
        compradores,
        propietario,
        rfc_comprador: rfcComprador,
        fecha_compra: fechaCompra,
        dias_desde_compra: dias,
        estatus_disponibilidad: estatusDisp?.nombre ?? "",
        comisionistas: comisionistasDetalle,
        timeline,
        url_contrato_firmado:
          docContratoCompletoValidado?.url ?? docContratoCompleto?.url ?? null,
        url_factura_sozu: urlFacturaSozu,
        url_factura_xml_sozu: urlFacturaXmlSozu,
        factura_sozu_estado: facturaSozuEstado,
        url_factura_externa: urlFacturaExterna,
        numero_factura_externa: numeroFacturaExterna,
        pago_apartado: pagoApartado,
        pago_enganche: pagoEnganche,
        oferta_comercial: (() => {
          const sumMonto = (concepto: number) =>
            (acuerdos || [])
              .filter((a: any) => a.id_concepto === concepto)
              .reduce((s: number, a: any) => s + Number(a.monto ?? 0), 0);
          const countConcepto = (concepto: number) =>
            (acuerdos || []).filter((a: any) => a.id_concepto === concepto).length;
          const precioLista = Number((propiedad as any)?.precio_lista) || 0;
          const ahorro =
            precioLista > 0 && precioLista > precioFinal
              ? +(precioLista - precioFinal).toFixed(2)
              : 0;
          return {
            id_oferta: oferta ? ((oferta as any).id as number) : null,
            precio_final: precioFinal,
            precio_lista: precioLista,
            ahorro,
            apartado: +sumMonto(1).toFixed(2),
            enganche: +sumMonto(2).toFixed(2),
            parcialidades_total: +sumMonto(5).toFixed(2),
            parcialidades_count: countConcepto(5),
            a_la_entrega: +sumMonto(3).toFixed(2),
            url_oferta: (oferta as any)?.url || null,
            folio_oferta: oferta
              ? `O-${String((oferta as any).id).padStart(6, "0")}`
              : null,
          };
        })(),
        estatus_pago: (() => {
          if ((cuenta as any)?.es_pagada_comision_venta) return "pagada" as const;
          const autorizacion = (cuenta as any)?.estatus_autorizacion_comision as string | null | undefined;
          if (autorizacion === "Autorizado") return "autorizada" as const;
          if (autorizacion === "Rechazado") return "rechazada" as const;
          return "espera_autorizacion" as const;
        })(),
        fecha_pago_comision: (cuenta as any)?.fecha_pago_comision
          ? new Date((cuenta as any).fecha_pago_comision).toISOString().slice(0, 10)
          : null,
        notas_rechazo_comision: (cuenta as any)?.notas_rechazo_comision ?? null,
      };
    },
  });
}
