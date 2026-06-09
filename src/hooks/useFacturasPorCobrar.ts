import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import { fetchAllRows, fetchInBatches } from "@/utils/supabasePagination";

export type EstadoFacturaPorCobrar =
  | "timbrada_pendiente"
  | "cobro_parcial"
  | "cobrada"
  | "vencida"
  | "cancelada";

export type TipoCuenta = "Propiedad" | "Producto" | "Servicio";

export type EstadoFacturaSozu = "sin_generar" | "draft" | "timbrada";

export type EstatusPagoFactura =
  | "espera_autorizacion"
  | "autorizada"
  | "pagada"
  | "rechazada";

export interface FacturaPorCobrar {
  id_factura: number;
  folio_cfdi: string;
  uuid_sat: string;
  desarrollador_nombre: string;
  desarrollador_rfc: string;
  venta_referencia: string;
  id_cuenta_cobranza: number;
  concepto: string;
  monto_subtotal: number;
  iva: number;
  monto_total: number;
  fecha_emision: string;
  fecha_pago_esperada: string;
  fecha_pago_real?: string;
  monto_cobrado: number;
  estado: EstadoFacturaPorCobrar;
  dias_desde_emision: number;
  dias_para_vencer: number;
  // ─── Campos detallados para la tabla ───
  tipo: TipoCuenta;
  proyecto_nombre: string;
  modelo_nombre: string;
  producto_nombre: string;
  numero_departamento: string;
  entidad_duena: string;
  precio_final: number;
  porcentaje_comision: number;
  iva_incluido: boolean;
  monto_comision: number;
  url_factura_comision: string | null;
  url_factura_xml_comision: string | null;
  estado_factura_sozu: EstadoFacturaSozu;
  estatus_pago: EstatusPagoFactura;
  fecha_pago_comision: string | null;
}

const IVA_RATE = 0.16;
const TIPO_ENTIDAD_DESARROLLADOR = 3;
const DIAS_CREDITO = 30;

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function diffDays(from: string, to: Date) {
  const d = new Date(from);
  return Math.round((to.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function useFacturasPorCobrar() {
  return useQuery({
    queryKey: ["facturas_por_cobrar_alta_direccion"],
    queryFn: async (): Promise<FacturaPorCobrar[]> => {
      // Hay >1000 cuentas — pagina hasta agotar para evitar truncado de PostgREST.
      const cuentas = await fetchAllRows((from, to) =>
        supabase
          .from("cuentas_cobranza")
          .select(
            `
            id,
            id_oferta,
            id_propiedad,
            precio_final,
            porcentaje_comision_venta,
            fecha_compra,
            fecha_pago_comision,
            es_pagada_comision_venta,
            monto_comision_pagado,
            url_factura_comision,
            url_factura_xml_comision,
            es_draft_factura_comision,
            iva_incluido,
            id_tipo_cancelacion
          `,
          )
          .eq("activo", true)
          .eq("es_aprobado", true)
          .is("id_cuenta_cobranza_padre", null)
          .not("fecha_compra", "is", null)
          .order("fecha_compra", { ascending: false })
          .range(from, to),
      );

      if (cuentas.length === 0) return [];

      const ofertaIds = Array.from(
        new Set(cuentas.map((c) => c.id_oferta).filter((v): v is number => v != null)),
      );

      // IN(...) batcheado para evitar "TypeError: Failed to fetch" cuando la
      // lista de IDs hace que el URL exceda los ~8 KB de PostgREST.
      const ofertas = (await fetchInBatches<{ id: number; id_propiedad: number | null; id_producto: number | null }>(
        ofertaIds,
        (batch) =>
          supabase
            .from("ofertas")
            .select("id, id_propiedad, id_producto")
            .in("id", batch as number[]),
      )) ?? [];

      const ofertaMap = new Map<number, { idPropiedad: number | null; idProducto: number | null }>();
      (ofertas || []).forEach((o) => {
        ofertaMap.set(o.id, { idPropiedad: o.id_propiedad, idProducto: o.id_producto });
      });

      // id_propiedad puede venir directamente de cuentas_cobranza (cuentas
      // creadas sin oferta o con oferta sin propiedad) — fallback a la
      // propiedad de la oferta cuando exista. Sin esto, todo el waterfall
      // (proyecto / modelo / no. depto / entidad dueña) queda vacío en la
      // tabla del Portal Administración.
      const propiedadIds = Array.from(
        new Set([
          ...cuentas.map((c) => c.id_propiedad).filter((v): v is number => v != null),
          ...(ofertas || [])
            .map((o) => o.id_propiedad)
            .filter((v): v is number => v != null),
        ]),
      );

      const propiedades = await fetchInBatches<{
        id: number;
        numero_propiedad: string | null;
        id_edificio_modelo: number | null;
        id_entidad_relacionada_dueno: number | null;
      }>(propiedadIds, (batch) =>
        supabase
          .from("propiedades")
          .select("id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno")
          .in("id", batch as number[]),
      );

      const propiedadMap = new Map(
        (propiedades || []).map((p) => [
          p.id,
          {
            numero: p.numero_propiedad ?? "",
            idEdificioModelo: p.id_edificio_modelo,
            idEntidadDueno: p.id_entidad_relacionada_dueno,
          },
        ]),
      );

      const edificioModeloIds = Array.from(
        new Set(
          (propiedades || [])
            .map((p) => p.id_edificio_modelo)
            .filter((v): v is number => v != null),
        ),
      );

      const edificiosModelos = await fetchInBatches<{ id: number; id_edificio: number | null; id_modelo: number | null }>(
        edificioModeloIds,
        (batch) =>
          supabase
            .from("edificios_modelos")
            .select("id, id_edificio, id_modelo")
            .in("id", batch as number[]),
      );

      const emMap = new Map(
        (edificiosModelos || []).map((em) => [
          em.id,
          { idEdificio: em.id_edificio, idModelo: em.id_modelo },
        ]),
      );

      const modeloIds = Array.from(
        new Set(
          (edificiosModelos || [])
            .map((em) => em.id_modelo)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: modelos, error: modError } = modeloIds.length
        ? await supabase.from("modelos").select("id, nombre").in("id", modeloIds)
        : { data: [] as Array<{ id: number; nombre: string | null }>, error: null };
      if (modError) throw modError;
      const modeloMap = new Map((modelos || []).map((m) => [m.id, m.nombre ?? ""]));

      const edificioIds = Array.from(
        new Set(
          (edificiosModelos || [])
            .map((em) => em.id_edificio)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: edificios, error: edError } = edificioIds.length
        ? await supabase
            .from("edificios")
            .select("id, nombre, id_proyecto")
            .in("id", edificioIds)
        : { data: [] as Array<{ id: number; nombre: string | null; id_proyecto: number | null }>, error: null };
      if (edError) throw edError;

      const edificioMap = new Map(
        (edificios || []).map((e) => [
          e.id,
          { nombre: e.nombre ?? "", idProyecto: e.id_proyecto },
        ]),
      );

      const proyectoIds = Array.from(
        new Set(
          (edificios || [])
            .map((e) => e.id_proyecto)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: proyectos, error: prError } = proyectoIds.length
        ? await supabase
            .from("proyectos")
            .select("id, nombre")
            .in("id", proyectoIds)
        : { data: [] as Array<{ id: number; nombre: string | null }>, error: null };
      if (prError) throw prError;

      const proyectoMap = new Map(
        (proyectos || []).map((p) => [p.id, p.nombre ?? ""]),
      );

      const productoIds = Array.from(
        new Set(
          (ofertas || [])
            .map((o) => o.id_producto)
            .filter((v): v is number => v != null),
        ),
      );

      const productos = await fetchInBatches<any>(productoIds, (batch) =>
        (supabase as any)
          .from("productos_servicios")
          .select(
            "id, nombre, id_categoria, categorias_producto!productos_servicios_id_categoria_fkey(nombre)",
          )
          .in("id", batch as number[]),
      );

      const productoMap = new Map<number, { nombre: string; categoria: string }>(
        ((productos || []) as Array<{ id: number; nombre: string | null; categorias_producto: { nombre: string | null } | null }>).map((p) => [
          p.id,
          {
            nombre: p.nombre ?? "",
            categoria: (p.categorias_producto?.nombre || "").toLowerCase(),
          },
        ]),
      );

      const entidadDuenoIds = Array.from(
        new Set(
          (propiedades || [])
            .map((p) => p.id_entidad_relacionada_dueno)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: entidadesDuenas, error: entDError } = entidadDuenoIds.length
        ? await (supabase as any)
            .from("entidades_relacionadas")
            .select("id, id_persona, personas!fk_entrel_persona(nombre_legal, nombre_comercial)")
            .in("id", entidadDuenoIds)
        : { data: [] as any[], error: null };
      if (entDError) throw entDError;

      const entidadDuenoMap = new Map<number, string>(
        ((entidadesDuenas || []) as Array<{ id: number; personas: { nombre_legal: string | null; nombre_comercial: string | null } | null }>).map((e) => [
          e.id,
          e.personas?.nombre_comercial || e.personas?.nombre_legal || "",
        ]),
      );

      const { data: entidadesDes, error: entError } = proyectoIds.length
        ? await (supabase as any)
            .from("entidades_relacionadas")
            .select("id_proyecto, id_persona")
            .in("id_proyecto", proyectoIds)
            .eq("id_tipo_entidad", TIPO_ENTIDAD_DESARROLLADOR)
            .eq("activo", true)
        : { data: [] as Array<{ id_proyecto: number; id_persona: number }>, error: null };
      if (entError) throw entError;

      const proyectoToPersona = new Map<number, number>();
      ((entidadesDes || []) as Array<{ id_proyecto: number; id_persona: number }>).forEach((e) => {
        if (!proyectoToPersona.has(e.id_proyecto)) {
          proyectoToPersona.set(e.id_proyecto, e.id_persona);
        }
      });

      const personaIds = Array.from(new Set(proyectoToPersona.values()));

      const { data: personas, error: persError } = personaIds.length
        ? await supabase
            .from("personas")
            .select("id, nombre_legal, nombre_comercial, rfc")
            .in("id", personaIds)
        : { data: [] as Array<{ id: number; nombre_legal: string | null; nombre_comercial: string | null; rfc: string | null }>, error: null };
      if (persError) throw persError;

      const personaMap = new Map(
        (personas || []).map((p) => [
          p.id,
          {
            nombre: p.nombre_legal || p.nombre_comercial || "Sin desarrollador",
            rfc: p.rfc || "",
          },
        ]),
      );

      const now = new Date();

      return cuentas.map((c) => {
        const idOferta = c.id_oferta as number | null;
        const oferta = idOferta != null ? ofertaMap.get(idOferta) : undefined;
        // Fallback: cuentas_cobranza.id_propiedad cuando la oferta no la trae.
        const idProp = (c as any).id_propiedad ?? oferta?.idPropiedad ?? null;
        const prop = idProp != null ? propiedadMap.get(idProp) : undefined;
        const em = prop?.idEdificioModelo != null ? emMap.get(prop.idEdificioModelo) : undefined;
        const edif = em?.idEdificio != null ? edificioMap.get(em.idEdificio) : undefined;
        const proyectoNombre = edif?.idProyecto != null
          ? proyectoMap.get(edif.idProyecto) ?? ""
          : "";
        const modeloNombre = em?.idModelo != null ? modeloMap.get(em.idModelo) ?? "" : "";
        const producto = oferta?.idProducto != null ? productoMap.get(oferta.idProducto) : undefined;
        const entidadDuenaNombre = prop?.idEntidadDueno != null
          ? entidadDuenoMap.get(prop.idEntidadDueno) ?? ""
          : "";
        const idPersona = edif?.idProyecto != null ? proyectoToPersona.get(edif.idProyecto) : undefined;
        const persona = idPersona != null ? personaMap.get(idPersona) : undefined;

        let tipo: TipoCuenta = "Propiedad";
        if (producto) {
          tipo = producto.categoria === "servicios" ? "Servicio" : "Producto";
        }

        const precioFinal = Number(c.precio_final) || 0;
        const pct = Number(c.porcentaje_comision_venta) || 0;
        const ivaIncluido = !!c.iva_incluido;

        const comisionBase = +(precioFinal * (pct / 100)).toFixed(2);
        const montoTotal = ivaIncluido
          ? +(comisionBase * (1 + IVA_RATE)).toFixed(2)
          : comisionBase;
        const subtotal = ivaIncluido ? comisionBase : comisionBase;
        const iva = ivaIncluido ? +(montoTotal - subtotal).toFixed(2) : +(subtotal * IVA_RATE).toFixed(2);

        const fechaEmision = c.fecha_compra
          ? toIsoDate(new Date(c.fecha_compra))
          : toIsoDate(now);
        const fechaPagoEsperada = toIsoDate(
          new Date(new Date(fechaEmision).getTime() + DIAS_CREDITO * 86400 * 1000),
        );

        const diasDesdeEmision = diffDays(fechaEmision, now);
        const diasParaVencer = DIAS_CREDITO - diasDesdeEmision;

        const estado: EstadoFacturaPorCobrar =
          diasDesdeEmision > DIAS_CREDITO ? "vencida" : "timbrada_pendiente";

        const urlFactura = c.url_factura_comision;
        const esDraft = !!c.es_draft_factura_comision;
        let estadoFacturaSozu: EstadoFacturaSozu;
        if (!urlFactura) estadoFacturaSozu = "sin_generar";
        else if (esDraft) estadoFacturaSozu = "draft";
        else estadoFacturaSozu = "timbrada";

        // Estatus de pago derivado:
        //   - pagada → es_pagada_comision_venta = true
        //   - rechazada → id_tipo_cancelacion != null
        //   - autorizada → no hay columna BD para distinguir vs espera; fallback a espera
        //   - espera_autorizacion → default
        let estatusPago: EstatusPagoFactura;
        if (c.es_pagada_comision_venta) estatusPago = "pagada";
        else if ((c as any).id_tipo_cancelacion != null) estatusPago = "rechazada";
        else estatusPago = "espera_autorizacion";

        const idNum = typeof c.id === "string" ? Number(c.id) : c.id;
        const folio = formatCuentaCobranzaId(idNum, tipo);
        const numeroDepto = prop?.numero ?? "";
        const propiedadLabel = [edif?.nombre, numeroDepto].filter(Boolean).join(" ");
        const ventaRef = `${folio} · ${propiedadLabel || producto?.nombre || proyectoNombre || `Oferta ${idOferta ?? ""}`}`;

        return {
          id_factura: idNum,
          folio_cfdi: folio,
          uuid_sat: "",
          desarrollador_nombre: persona?.nombre || proyectoNombre || "Sin desarrollador",
          desarrollador_rfc: persona?.rfc || "",
          venta_referencia: ventaRef,
          id_cuenta_cobranza: idNum,
          concepto: `Comisión por intermediación ${pct}% — ${propiedadLabel || producto?.nombre || `Proyecto ${proyectoNombre}`}`,
          monto_subtotal: subtotal,
          iva,
          monto_total: montoTotal,
          fecha_emision: fechaEmision,
          fecha_pago_esperada: fechaPagoEsperada,
          monto_cobrado: Number(c.monto_comision_pagado) || 0,
          estado,
          dias_desde_emision: diasDesdeEmision,
          dias_para_vencer: diasParaVencer,
          // detallados
          tipo,
          proyecto_nombre: proyectoNombre,
          modelo_nombre: modeloNombre,
          producto_nombre: producto?.nombre ?? "",
          numero_departamento: numeroDepto,
          entidad_duena: entidadDuenaNombre,
          precio_final: precioFinal,
          porcentaje_comision: pct,
          iva_incluido: ivaIncluido,
          monto_comision: comisionBase,
          url_factura_comision: urlFactura,
          url_factura_xml_comision: c.url_factura_xml_comision || null,
          estado_factura_sozu: estadoFacturaSozu,
          estatus_pago: estatusPago,
          fecha_pago_comision: c.fecha_pago_comision
            ? new Date(c.fecha_pago_comision).toISOString().slice(0, 10)
            : null,
        };
      });
    },
  });
}
