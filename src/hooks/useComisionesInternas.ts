import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";

export type EstadoComisionInterna =
  | "devengada"
  | "aprobada"
  | "autorizada"
  | "dispersada"
  | "cancelada";

export type TipoCuentaInterna = "Propiedad" | "Producto" | "Servicio";

export interface ComisionInterna {
  id_comision_interna: number;
  folio_comision: string;
  id_cuenta_cobranza: number;
  comisionista_email: string;
  comisionista_nombre: string;
  comisionista_rol: string;
  porcentaje_comision: number;
  monto_comision: number;
  comision_total_cuenta: number;
  comision_a_dispersar: number;
  precio_final: number;
  estado: EstadoComisionInterna;
  fecha_devengo: string;
  fecha_aprobacion?: string;
  fecha_autorizacion?: string;
  fecha_dispersion?: string;
  dias_desde_devengo: number;
  dias_esperando_director?: number;
  dias_esperando_dispersion?: number;
  venta_referencia: string;
  tipo: TipoCuentaInterna;
  proyecto_nombre: string;
  modelo_nombre: string;
  edificio_nombre: string;
  numero_departamento: string;
  producto_nombre: string;
}

const AGENTE_INMOBILIARIO_ROL_ID = 3;
const DOMINIOS_INTERNOS = ["sozu.com", "investimento.mx", "tallwood.mx", "daiku.mx"];

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

export function useComisionesInternas() {
  return useQuery({
    queryKey: ["comisiones_internas_alta_direccion"],
    queryFn: async (): Promise<ComisionInterna[]> => {
      // Lee todas las filas — `comisionistas` puede superar 1000 sumando
      // entre todas las cuentas. Sin paginación, PostgREST trunca.
      const comisionistas = await fetchAllRows((from, to) =>
        supabase
          .from("comisionistas")
          .select(
            "id_cuenta_cobranza, email_usuario, porcentaje_comision, aprobada, pagada, fecha_pago_comision, fecha_creacion, fecha_actualizacion",
          )
          .eq("activo", true)
          .range(from, to),
      );
      if (comisionistas.length === 0) return [];

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

      const personasMap = new Map<string, { nombre: string; tipoPersona: string | null }>();
      ((personas || []) as Array<{ email: string | null; nombre_legal: string | null; nombre_comercial: string | null; tipo_persona: string | null }>).forEach((p) => {
        if (p.email) {
          personasMap.set(p.email, {
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
        ? await supabase.from("roles").select("id, nombre, es_rol_interno").in("id", rolIds)
        : { data: [] as Array<{ id: number; nombre: string | null; es_rol_interno: boolean | null }>, error: null };
      if (rolesErr) throw rolesErr;
      const rolesMap = new Map(
        (roles || []).map((r: any) => [r.id, { nombre: r.nombre ?? "", esRolInterno: !!r.es_rol_interno }]),
      );

      const internos = comisionistas.filter((c) => {
        if (!c.email_usuario) return false;
        const persona = personasMap.get(c.email_usuario);
        const usuario = usuariosMap.get(c.email_usuario);
        const esInmobiliariaExterna = persona?.tipoPersona === "pm";
        const esAgenteExterno =
          usuario?.rolId === AGENTE_INMOBILIARIO_ROL_ID && !esDominioInterno(c.email_usuario);
        return !(esInmobiliariaExterna || esAgenteExterno);
      });

      if (internos.length === 0) return [];

      const cuentaIds = Array.from(
        new Set(
          internos
            .map((c) => c.id_cuenta_cobranza)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: cuentas, error: ccErr } = cuentaIds.length
        ? await supabase
            .from("cuentas_cobranza")
            .select(
              "id, id_oferta, precio_final, porcentaje_comision_venta, fecha_compra",
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

      // Comisión a dispersar = suma de todas las comisiones internas
      // (en porcentaje) por cuenta. Se aplica al precio_final para obtener el
      // monto total que el equipo interno se reparte por esa venta.
      const pctPorCuenta = new Map<number, number>();
      internos.forEach((c) => {
        if (c.id_cuenta_cobranza == null) return;
        const pct = Number(c.porcentaje_comision) || 0;
        pctPorCuenta.set(
          c.id_cuenta_cobranza,
          (pctPorCuenta.get(c.id_cuenta_cobranza) ?? 0) + pct,
        );
      });

      const now = new Date();

      return internos.map((c, idx): ComisionInterna => {
        const usuario = c.email_usuario ? usuariosMap.get(c.email_usuario) : undefined;
        const persona = c.email_usuario ? personasMap.get(c.email_usuario) : undefined;
        const rol = usuario?.rolId != null ? rolesMap.get(usuario.rolId) : undefined;
        const nombre = usuario?.nombre || persona?.nombre || c.email_usuario || "Sin nombre";

        const cuenta = c.id_cuenta_cobranza != null ? cuentaMap.get(c.id_cuenta_cobranza) : undefined;
        const oferta = cuenta?.idOferta != null ? ofertaMap.get(cuenta.idOferta) : undefined;
        const prop = oferta?.idPropiedad != null ? propiedadMap.get(oferta.idPropiedad) : undefined;
        const em = prop?.idEdificioModelo != null ? emMap.get(prop.idEdificioModelo) : undefined;
        const edif = em?.idEdificio != null ? edificioMap.get(em.idEdificio) : undefined;
        const proyectoNombre = edif?.idProyecto != null ? proyectoMap.get(edif.idProyecto) ?? "" : "";
        const modeloNombre = em?.idModelo != null ? modeloMap.get(em.idModelo) ?? "" : "";
        const producto = oferta?.idProducto != null ? productoMap.get(oferta.idProducto) : undefined;

        let tipoCuenta: TipoCuentaInterna = "Propiedad";
        if (producto) {
          tipoCuenta = producto.categoria === "servicios" ? "Servicio" : "Producto";
        }

        const precioFinal = cuenta?.precioFinal ?? 0;
        const pctVenta = cuenta?.porcentajeVenta ?? 0;
        const pctIndividual = Number(c.porcentaje_comision) || 0;
        const comisionTotalCuenta = +((precioFinal * pctVenta) / 100).toFixed(2);
        const montoIndividual = +((precioFinal * pctIndividual) / 100).toFixed(2);
        const pctDispersar = c.id_cuenta_cobranza != null
          ? pctPorCuenta.get(c.id_cuenta_cobranza) ?? 0
          : 0;
        const comisionADispersar = +((precioFinal * pctDispersar) / 100).toFixed(2);

        const fechaDevengo = cuenta?.fechaCompra
          ? toIsoDate(new Date(cuenta.fechaCompra))
          : c.fecha_creacion
            ? toIsoDate(new Date(c.fecha_creacion))
            : toIsoDate(now);
        const diasDesdeDevengo = diffDays(fechaDevengo, now);

        let estado: EstadoComisionInterna;
        if (c.pagada) estado = "dispersada";
        else if (c.aprobada) estado = "autorizada";
        else estado = "devengada";

        const fechaAprobacion = c.aprobada && c.fecha_actualizacion
          ? toIsoDate(new Date(c.fecha_actualizacion))
          : undefined;
        const fechaDispersion = c.fecha_pago_comision
          ? toIsoDate(new Date(c.fecha_pago_comision))
          : undefined;

        const cuentaIdRef = c.id_cuenta_cobranza ?? 0;
        const folio = `COM-${cuentaIdRef}-${idx + 1}`;
        const propiedadLabel = [edif?.nombre, prop?.numero].filter(Boolean).join(" ");
        const ventaRef = `COB-${cuentaIdRef} · ${propiedadLabel || producto?.nombre || proyectoNombre || "Sin referencia"}`;

        return {
          id_comision_interna: cuentaIdRef * 1000 + idx,
          folio_comision: folio,
          id_cuenta_cobranza: cuentaIdRef,
          comisionista_email: c.email_usuario ?? "",
          comisionista_nombre: nombre,
          comisionista_rol: rol?.nombre || "Sin rol",
          porcentaje_comision: pctIndividual,
          monto_comision: montoIndividual,
          comision_total_cuenta: comisionTotalCuenta,
          comision_a_dispersar: comisionADispersar,
          precio_final: precioFinal,
          estado,
          fecha_devengo: fechaDevengo,
          fecha_aprobacion: fechaAprobacion,
          fecha_autorizacion: fechaAprobacion,
          fecha_dispersion: fechaDispersion,
          dias_desde_devengo: diasDesdeDevengo,
          dias_esperando_director: estado === "autorizada" && fechaAprobacion
            ? diffDays(fechaAprobacion, now)
            : undefined,
          dias_esperando_dispersion: estado === "autorizada" && fechaAprobacion
            ? diffDays(fechaAprobacion, now)
            : undefined,
          venta_referencia: ventaRef,
          tipo: tipoCuenta,
          proyecto_nombre: proyectoNombre,
          modelo_nombre: modeloNombre,
          edificio_nombre: edif?.nombre ?? "",
          numero_departamento: prop?.numero ?? "",
          producto_nombre: producto?.nombre ?? "",
        };
      });
    },
  });
}
