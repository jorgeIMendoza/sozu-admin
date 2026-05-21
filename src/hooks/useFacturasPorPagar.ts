import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EstadoFacturaPorPagar =
  | "en_revision"
  | "aprobada_para_pago"
  | "pagada"
  | "bloqueada"
  | "rechazada";

export type TipoBeneficiario =
  | "inmobiliaria"
  | "broker"
  | "aliado_comercial"
  | "agente_externo";

export type TipoCuenta = "Propiedad" | "Producto" | "Servicio";

export type EstatusComision = "pendiente" | "aprobada" | "pagada";

export interface FacturaPorPagar {
  id_factura: number;
  folio_cfdi: string;
  uuid_sat: string;
  beneficiario_nombre: string;
  beneficiario_rfc: string;
  beneficiario_tipo: TipoBeneficiario;
  venta_referencia: string;
  id_cuenta_cobranza: number;
  concepto: string;
  monto_subtotal: number;
  iva: number;
  monto_total: number;
  fecha_emision: string;
  fecha_pago_real?: string;
  estado: EstadoFacturaPorPagar;
  dias_desde_emision: number;
  ya_se_cobro_al_desarrollador: boolean;
  factura_cobrar_referencia?: string;
  // ─── Campos detallados ───
  tipo: TipoCuenta;
  proyecto_nombre: string;
  modelo_nombre: string;
  producto_nombre: string;
  numero_departamento: string;
  estatus_comision: EstatusComision;
  url_factura: string | null;
}

const IVA_RATE = 0.16;
const AGENTE_INMOBILIARIO_ROL_ID = 3;
const TIPO_DOC_FACTURA_EXTERNA = 46;
const DOMINIOS_INTERNOS = ["sozu.com", "investimento.mx", "tallwood.mx", "daiku.mx"];
const DOC_BATCH_SIZE = 200;

function esDominioInterno(email: string | null | undefined) {
  if (!email) return true;
  const dom = email.split("@")[1]?.toLowerCase();
  if (!dom) return true;
  return DOMINIOS_INTERNOS.includes(dom);
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function diffDays(from: string, to: Date) {
  const d = new Date(from);
  return Math.round((to.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function useFacturasPorPagar() {
  return useQuery({
    queryKey: ["facturas_por_pagar_alta_direccion"],
    queryFn: async (): Promise<FacturaPorPagar[]> => {
      const { data: comisionistas, error: cmErr } = await supabase
        .from("comisionistas")
        .select(
          "id_cuenta_cobranza, email_usuario, porcentaje_comision, aprobada, pagada, fecha_pago_comision, fecha_creacion",
        )
        .eq("activo", true);
      if (cmErr) throw cmErr;
      if (!comisionistas || comisionistas.length === 0) return [];

      const emails = Array.from(
        new Set(comisionistas.map((c) => c.email_usuario).filter((v): v is string => !!v)),
      );

      const [
        { data: usuarios, error: usErr },
        { data: personas, error: peErr },
      ] = await Promise.all([
        emails.length
          ? supabase.from("usuarios").select("email, nombre, rol_id").in("email", emails)
          : Promise.resolve({ data: [] as Array<{ email: string; nombre: string | null; rol_id: number | null }>, error: null }),
        emails.length
          ? (supabase as any)
              .from("personas")
              .select("email, nombre_legal, nombre_comercial, rfc, tipo_persona")
              .in("email", emails)
              .eq("activo", true)
          : Promise.resolve({ data: [] as Array<{ email: string; nombre_legal: string | null; nombre_comercial: string | null; rfc: string | null; tipo_persona: string | null }>, error: null }),
      ]);
      if (usErr) throw usErr;
      if (peErr) throw peErr;

      const usuariosMap = new Map<string, { nombre: string; rolId: number | null }>();
      (usuarios || []).forEach((u: any) => {
        if (u.email) usuariosMap.set(u.email, { nombre: u.nombre ?? "", rolId: u.rol_id ?? null });
      });

      const personasMap = new Map<
        string,
        { nombre: string; rfc: string; tipoPersona: string | null }
      >();
      ((personas || []) as Array<{ email: string | null; nombre_legal: string | null; nombre_comercial: string | null; rfc: string | null; tipo_persona: string | null }>).forEach((p) => {
        if (p.email) {
          personasMap.set(p.email, {
            nombre: p.nombre_comercial || p.nombre_legal || "",
            rfc: p.rfc || "",
            tipoPersona: p.tipo_persona,
          });
        }
      });

      const comisionistasExternos = comisionistas.filter((c) => {
        if (!c.email_usuario) return false;
        const persona = personasMap.get(c.email_usuario);
        const usuario = usuariosMap.get(c.email_usuario);
        const esInmobiliaria = persona?.tipoPersona === "pm";
        const esAgenteExterno =
          usuario?.rolId === AGENTE_INMOBILIARIO_ROL_ID && !esDominioInterno(c.email_usuario);
        return esInmobiliaria || esAgenteExterno;
      });

      if (comisionistasExternos.length === 0) return [];

      const cuentaIds = Array.from(
        new Set(
          comisionistasExternos
            .map((c) => c.id_cuenta_cobranza)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: cuentas, error: ccErr } = cuentaIds.length
        ? await supabase
            .from("cuentas_cobranza")
            .select(
              "id, id_oferta, precio_final, porcentaje_comision_venta, fecha_compra, es_pagada_comision_venta",
            )
            .in("id", cuentaIds)
        : { data: [] as Array<any>, error: null };
      if (ccErr) throw ccErr;

      const cuentaMap = new Map(
        (cuentas || []).map((c: any) => {
          const idNum = typeof c.id === "string" ? Number(c.id) : c.id;
          return [
            idNum,
            {
              id: idNum,
              idOferta: c.id_oferta as number | null,
              precioFinal: Number(c.precio_final) || 0,
              porcentajeVenta: Number(c.porcentaje_comision_venta) || 0,
              fechaCompra: c.fecha_compra as string | null,
              esPagadaComisionVenta: !!c.es_pagada_comision_venta,
            },
          ];
        }),
      );

      const ofertaIds = Array.from(
        new Set(
          Array.from(cuentaMap.values())
            .map((c) => c.idOferta)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: ofertas, error: ofErr } = ofertaIds.length
        ? await supabase
            .from("ofertas")
            .select("id, id_propiedad, id_producto")
            .in("id", ofertaIds)
        : { data: [] as Array<{ id: number; id_propiedad: number | null; id_producto: number | null }>, error: null };
      if (ofErr) throw ofErr;

      const ofertaMap = new Map<number, { idPropiedad: number | null; idProducto: number | null }>(
        (ofertas || []).map((o) => [o.id, { idPropiedad: o.id_propiedad, idProducto: o.id_producto }]),
      );

      const propiedadIds = Array.from(
        new Set(
          (ofertas || [])
            .map((o) => o.id_propiedad)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: propiedades, error: prErr } = propiedadIds.length
        ? await supabase
            .from("propiedades")
            .select("id, numero_propiedad, id_edificio_modelo")
            .in("id", propiedadIds)
        : { data: [] as Array<{ id: number; numero_propiedad: string | null; id_edificio_modelo: number | null }>, error: null };
      if (prErr) throw prErr;

      const propiedadMap = new Map(
        (propiedades || []).map((p) => [
          p.id,
          { numero: p.numero_propiedad ?? "", idEdificioModelo: p.id_edificio_modelo },
        ]),
      );

      const emIds = Array.from(
        new Set(
          (propiedades || [])
            .map((p) => p.id_edificio_modelo)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: edms, error: emErr } = emIds.length
        ? await supabase
            .from("edificios_modelos")
            .select("id, id_edificio, id_modelo")
            .in("id", emIds)
        : { data: [] as Array<{ id: number; id_edificio: number | null; id_modelo: number | null }>, error: null };
      if (emErr) throw emErr;

      const emMap = new Map(
        (edms || []).map((em) => [em.id, { idEdificio: em.id_edificio, idModelo: em.id_modelo }]),
      );

      const modeloIds = Array.from(
        new Set(
          (edms || [])
            .map((em) => em.id_modelo)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: modelos, error: mdErr } = modeloIds.length
        ? await supabase.from("modelos").select("id, nombre").in("id", modeloIds)
        : { data: [] as Array<{ id: number; nombre: string | null }>, error: null };
      if (mdErr) throw mdErr;
      const modeloMap = new Map((modelos || []).map((m) => [m.id, m.nombre ?? ""]));

      const edificioIds = Array.from(
        new Set(
          (edms || [])
            .map((em) => em.id_edificio)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: edificios, error: edErr } = edificioIds.length
        ? await supabase
            .from("edificios")
            .select("id, nombre, id_proyecto")
            .in("id", edificioIds)
        : { data: [] as Array<{ id: number; nombre: string | null; id_proyecto: number | null }>, error: null };
      if (edErr) throw edErr;

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

      const { data: proyectos, error: prjErr } = proyectoIds.length
        ? await supabase.from("proyectos").select("id, nombre").in("id", proyectoIds)
        : { data: [] as Array<{ id: number; nombre: string | null }>, error: null };
      if (prjErr) throw prjErr;
      const proyectoMap = new Map((proyectos || []).map((p) => [p.id, p.nombre ?? ""]));

      const productoIds = Array.from(
        new Set(
          (ofertas || [])
            .map((o) => o.id_producto)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: productos, error: prodErr } = productoIds.length
        ? await (supabase as any)
            .from("productos_servicios")
            .select(
              "id, nombre, id_categoria, categorias_producto!productos_servicios_id_categoria_fkey(nombre)",
            )
            .in("id", productoIds)
        : { data: [] as any[], error: null };
      if (prodErr) throw prodErr;

      const productoMap = new Map<number, { nombre: string; categoria: string }>(
        ((productos || []) as Array<{ id: number; nombre: string | null; categorias_producto: { nombre: string | null } | null }>).map((p) => [
          p.id,
          { nombre: p.nombre ?? "", categoria: (p.categorias_producto?.nombre || "").toLowerCase() },
        ]),
      );

      type DocRow = { id_cuenta_cobranza: number | null; url: string | null; numero: string | null };
      const docChunks: number[][] = [];
      for (let i = 0; i < cuentaIds.length; i += DOC_BATCH_SIZE) {
        docChunks.push(cuentaIds.slice(i, i + DOC_BATCH_SIZE));
      }
      const docResults = await Promise.all(
        docChunks.map((batch) =>
          supabase
            .from("documentos")
            .select("id_cuenta_cobranza, url, numero")
            .in("id_cuenta_cobranza", batch)
            .eq("id_tipo_documento", TIPO_DOC_FACTURA_EXTERNA)
            .eq("activo", true),
        ),
      );
      for (const { error } of docResults) {
        if (error) throw error;
      }
      const docs: DocRow[] = docResults.flatMap(({ data }) => (data ?? []) as DocRow[]);

      const docMap = new Map<number, { url: string | null; numero: string | null }>();
      (docs || []).forEach((d: any) => {
        if (d.id_cuenta_cobranza != null) {
          docMap.set(d.id_cuenta_cobranza, { url: d.url, numero: d.numero });
        }
      });

      const now = new Date();

      return comisionistasExternos.map((c, idx): FacturaPorPagar => {
        const persona = c.email_usuario ? personasMap.get(c.email_usuario) : undefined;
        const usuario = c.email_usuario ? usuariosMap.get(c.email_usuario) : undefined;
        const esInmobiliaria = persona?.tipoPersona === "pm";
        const tipoBeneficiario: TipoBeneficiario = esInmobiliaria ? "inmobiliaria" : "agente_externo";

        const cuenta = c.id_cuenta_cobranza != null ? cuentaMap.get(c.id_cuenta_cobranza) : undefined;
        const oferta = cuenta?.idOferta != null ? ofertaMap.get(cuenta.idOferta) : undefined;
        const prop = oferta?.idPropiedad != null ? propiedadMap.get(oferta.idPropiedad) : undefined;
        const em = prop?.idEdificioModelo != null ? emMap.get(prop.idEdificioModelo) : undefined;
        const edif = em?.idEdificio != null ? edificioMap.get(em.idEdificio) : undefined;
        const proyectoNombre = edif?.idProyecto != null ? proyectoMap.get(edif.idProyecto) ?? "" : "";
        const modeloNombre = em?.idModelo != null ? modeloMap.get(em.idModelo) ?? "" : "";
        const producto = oferta?.idProducto != null ? productoMap.get(oferta.idProducto) : undefined;
        const doc = c.id_cuenta_cobranza != null ? docMap.get(c.id_cuenta_cobranza) : undefined;

        let tipoCuenta: TipoCuenta = "Propiedad";
        if (producto) {
          tipoCuenta = producto.categoria === "servicios" ? "Servicio" : "Producto";
        }

        const precioFinal = cuenta?.precioFinal ?? 0;
        const pctComExterno = Number(c.porcentaje_comision) || 0;
        const montoTotal = +((precioFinal * pctComExterno) / 100).toFixed(2);
        const subtotal = +(montoTotal / (1 + IVA_RATE)).toFixed(2);
        const iva = +(montoTotal - subtotal).toFixed(2);

        const fechaEmision = cuenta?.fechaCompra
          ? toIsoDate(new Date(cuenta.fechaCompra))
          : c.fecha_creacion
            ? toIsoDate(new Date(c.fecha_creacion))
            : toIsoDate(now);

        const diasDesdeEmision = diffDays(fechaEmision, now);
        const yaCobroDesarrollador = !!cuenta?.esPagadaComisionVenta;

        let estado: EstadoFacturaPorPagar;
        if (c.pagada) estado = "pagada";
        else if (c.aprobada && yaCobroDesarrollador) estado = "aprobada_para_pago";
        else if (c.aprobada && !yaCobroDesarrollador) estado = "bloqueada";
        else estado = "en_revision";

        const estatusComision: EstatusComision = c.pagada
          ? "pagada"
          : c.aprobada
            ? "aprobada"
            : "pendiente";

        const beneficiarioNombre =
          persona?.nombre || usuario?.nombre || c.email_usuario || "Sin beneficiario";
        const beneficiarioRfc = persona?.rfc || "";

        const idFactura = (c.id_cuenta_cobranza ?? 0) * 1000 + idx;
        const cuentaIdRef = c.id_cuenta_cobranza ?? idFactura;
        const folio = doc?.numero || `EXT-${cuentaIdRef}-${idx + 1}`;
        const propiedadLabel = [edif?.nombre, prop?.numero].filter(Boolean).join(" ");
        const ventaReferencia = `COB-${cuentaIdRef} · ${propiedadLabel || producto?.nombre || proyectoNombre || "Sin referencia"}`;

        return {
          id_factura: idFactura,
          folio_cfdi: folio,
          uuid_sat: "",
          beneficiario_nombre: beneficiarioNombre,
          beneficiario_rfc: beneficiarioRfc,
          beneficiario_tipo: tipoBeneficiario,
          venta_referencia: ventaReferencia,
          id_cuenta_cobranza: cuentaIdRef,
          concepto: `Comisión ${pctComExterno}% — ${propiedadLabel || producto?.nombre || `Proyecto ${proyectoNombre}`}`,
          monto_subtotal: subtotal,
          iva,
          monto_total: montoTotal,
          fecha_emision: fechaEmision,
          fecha_pago_real: c.fecha_pago_comision ? toIsoDate(new Date(c.fecha_pago_comision)) : undefined,
          estado,
          dias_desde_emision: diasDesdeEmision,
          ya_se_cobro_al_desarrollador: yaCobroDesarrollador,
          factura_cobrar_referencia: yaCobroDesarrollador ? `COB-${cuentaIdRef}` : undefined,
          tipo: tipoCuenta,
          proyecto_nombre: proyectoNombre,
          modelo_nombre: modeloNombre,
          producto_nombre: producto?.nombre ?? "",
          numero_departamento: prop?.numero ?? "",
          estatus_comision: estatusComision,
          url_factura: doc?.url ?? null,
        };
      });
    },
  });
}
