import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";

export type TipoCuentaCaso = "Propiedad" | "Producto" | "Servicio";

export interface CasoVenta {
  id_cuenta_cobranza: number;
  folio: string;
  tipo: TipoCuentaCaso;
  proyecto_nombre: string;
  propiedad_label: string;
  numero_departamento: string;
  edificio_nombre: string;
  modelo_nombre: string;
  compradores: string[];
  propietario: string;
  dias_desde_compra: number;
  precio_final: number;
  metraje: number;
  precio_m2: number;
  fecha_compra: string;
}

const ESTATUS_APARTADO = 4;
const ESTATUS_VENDIDO = 5;
const ESTATUS_EN_CICLO = [ESTATUS_APARTADO, ESTATUS_VENDIDO];

function diffDays(from: string, to: Date) {
  const d = new Date(from);
  return Math.round((to.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function useCicloVentaCasos() {
  return useQuery({
    queryKey: ["ciclo_venta_casos_vendidas"],
    queryFn: async (): Promise<CasoVenta[]> => {
      const { data: cuentas, error: ccErr } = await supabase
        .from("cuentas_cobranza")
        .select(
          "id, id_oferta, precio_final, fecha_compra, es_aprobado, activo",
        )
        .eq("activo", true)
        .eq("es_aprobado", true)
        .is("id_cuenta_cobranza_padre", null)
        .not("fecha_compra", "is", null)
        .order("fecha_compra", { ascending: false })
        .limit(1000);
      if (ccErr) throw ccErr;
      if (!cuentas || cuentas.length === 0) return [];

      const ofertaIds = Array.from(
        new Set(cuentas.map((c: any) => c.id_oferta).filter((v): v is number => v != null)),
      );

      const { data: ofertas, error: ofErr } = ofertaIds.length
        ? await supabase
            .from("ofertas")
            .select("id, id_propiedad, id_producto")
            .in("id", ofertaIds)
        : { data: [] as Array<{ id: number; id_propiedad: number | null; id_producto: number | null }>, error: null };
      if (ofErr) throw ofErr;

      const propiedadIdsFromOfertas = Array.from(
        new Set(
          (ofertas || [])
            .map((o) => o.id_propiedad)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: propiedadesVendidas, error: propErr } = propiedadIdsFromOfertas.length
        ? await supabase
            .from("propiedades")
            .select(
              "id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno, m2_interiores, m2_exteriores, m2_loft, precio_lista, id_estatus_disponibilidad",
            )
            .in("id", propiedadIdsFromOfertas)
            .in("id_estatus_disponibilidad", ESTATUS_EN_CICLO)
            .eq("activo", true)
        : { data: [] as Array<any>, error: null };
      if (propErr) throw propErr;
      if (!propiedadesVendidas || propiedadesVendidas.length === 0) return [];

      const ofertaToPropiedad = new Map<number, number>();
      const ofertaToProducto = new Map<number, number | null>();
      (ofertas || []).forEach((o) => {
        if (o.id_propiedad != null) ofertaToPropiedad.set(o.id, o.id_propiedad);
        ofertaToProducto.set(o.id, o.id_producto);
      });

      const propiedadMap = new Map<number, { numero: string; idEdificioModelo: any; idEntidadDueno: any; metraje: number; precioLista: number; }>(
        propiedadesVendidas.map((p): [number, { numero: string; idEdificioModelo: any; idEntidadDueno: any; metraje: number; precioLista: number; }] => [
          p.id,
          {
            numero: p.numero_propiedad ?? "",
            idEdificioModelo: p.id_edificio_modelo,
            idEntidadDueno: p.id_entidad_relacionada_dueno,
            metraje:
              (Number(p.m2_interiores) || 0) +
              (Number(p.m2_exteriores) || 0) +
              (Number((p as any).m2_loft) || 0),
            precioLista: Number(p.precio_lista) || 0,
          },
        ]),
      );

      const emIds = Array.from(
        new Set(
          propiedadesVendidas
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
        (edms || []).map((em) => [
          em.id,
          { idEdificio: em.id_edificio, idModelo: em.id_modelo },
        ]),
      );

      const modeloIds = Array.from(
        new Set((edms || []).map((em) => em.id_modelo).filter((v): v is number => v != null)),
      );
      const { data: modelos, error: mdErr } = modeloIds.length
        ? await supabase.from("modelos").select("id, nombre").in("id", modeloIds)
        : { data: [] as Array<{ id: number; nombre: string | null }>, error: null };
      if (mdErr) throw mdErr;
      const modeloMap = new Map((modelos || []).map((m) => [m.id, m.nombre ?? ""]));

      const edificioIds = Array.from(
        new Set(
          Array.from(emMap.values())
            .map((v) => v.idEdificio)
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
          (edificios || []).map((e) => e.id_proyecto).filter((v): v is number => v != null),
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

      const productoMap = new Map<number, { categoria: string }>(
        ((productos || []) as Array<{ id: number; categorias_producto: { nombre: string | null } | null }>).map((p) => [
          p.id,
          { categoria: (p.categorias_producto?.nombre || "").toLowerCase() },
        ]),
      );

      const cuentaIds = cuentas.map((c: any) =>
        typeof c.id === "string" ? Number(c.id) : c.id,
      );

      const { data: compradores, error: compErr } = cuentaIds.length
        ? await supabase
            .from("compradores")
            .select("id_cuenta_cobranza, id_persona, porcentaje_copropiedad")
            .in("id_cuenta_cobranza", cuentaIds)
            .eq("activo", true)
        : { data: [] as Array<{ id_cuenta_cobranza: number; id_persona: number; porcentaje_copropiedad: number }>, error: null };
      if (compErr) throw compErr;

      const compradorPersonaIds = Array.from(
        new Set((compradores || []).map((c) => c.id_persona).filter((v): v is number => v != null)),
      );

      const entidadDuenoIds = Array.from(
        new Set(
          propiedadesVendidas
            .map((p) => p.id_entidad_relacionada_dueno)
            .filter((v): v is number => v != null),
        ),
      );

      const { data: entidadesDueno, error: entErr } = entidadDuenoIds.length
        ? await (supabase as any)
            .from("entidades_relacionadas")
            .select("id, id_persona, personas!fk_entrel_persona(nombre_legal, nombre_comercial)")
            .in("id", entidadDuenoIds)
        : { data: [] as any[], error: null };
      if (entErr) throw entErr;

      const entidadDuenoNombre = new Map<number, string>(
        ((entidadesDueno || []) as Array<{ id: number; personas: { nombre_legal: string | null; nombre_comercial: string | null } | null }>).map((e) => [
          e.id,
          e.personas?.nombre_comercial || e.personas?.nombre_legal || "",
        ]),
      );

      const { data: personasComp, error: pErr } = compradorPersonaIds.length
        ? await (supabase as any)
            .from("personas")
            .select("id, nombre_legal, nombre_comercial")
            .in("id", compradorPersonaIds)
        : { data: [] as any[], error: null };
      if (pErr) throw pErr;

      const personaCompMap = new Map<number, string>(
        ((personasComp || []) as Array<{ id: number; nombre_legal: string | null; nombre_comercial: string | null }>).map((p) => [
          p.id,
          p.nombre_comercial || p.nombre_legal || "",
        ]),
      );

      const compradoresPorCuenta = new Map<number, string[]>();
      (compradores || []).forEach((c) => {
        if (c.id_cuenta_cobranza == null) return;
        const nombre = personaCompMap.get(c.id_persona) || "";
        if (!nombre) return;
        const list = compradoresPorCuenta.get(c.id_cuenta_cobranza) ?? [];
        list.push(nombre);
        compradoresPorCuenta.set(c.id_cuenta_cobranza, list);
      });

      const now = new Date();

      return cuentas
        .map((c: any): CasoVenta | null => {
          const idNum = typeof c.id === "string" ? Number(c.id) : c.id;
          const idOferta = c.id_oferta as number | null;
          const idPropiedad = idOferta != null ? ofertaToPropiedad.get(idOferta) : undefined;
          if (idPropiedad == null) return null;
          const prop = propiedadMap.get(idPropiedad);
          if (!prop) return null;
          const emInfo = prop.idEdificioModelo != null ? emMap.get(prop.idEdificioModelo) : undefined;
          const idEdificio = emInfo?.idEdificio ?? null;
          const edif = idEdificio != null ? edificioMap.get(idEdificio) : undefined;
          const proyectoNombre = edif?.idProyecto != null ? proyectoMap.get(edif.idProyecto) ?? "" : "";
          const modeloNombre = emInfo?.idModelo != null ? modeloMap.get(emInfo.idModelo) ?? "" : "";
          const idProducto = idOferta != null ? ofertaToProducto.get(idOferta) ?? null : null;
          const producto = idProducto != null ? productoMap.get(idProducto) : undefined;

          let tipo: TipoCuentaCaso = "Propiedad";
          if (producto) {
            tipo = producto.categoria === "servicios" ? "Servicio" : "Producto";
          }

          const precioFinal = Number(c.precio_final) || 0;
          const metraje = prop.metraje;
          const precioM2 = metraje > 0 ? +(precioFinal / metraje).toFixed(2) : 0;

          const fechaCompra = c.fecha_compra
            ? new Date(c.fecha_compra).toISOString().slice(0, 10)
            : "";
          const dias = fechaCompra ? diffDays(fechaCompra, now) : 0;

          const propietario = prop.idEntidadDueno != null
            ? entidadDuenoNombre.get(prop.idEntidadDueno) ?? ""
            : "";

          const propiedadLabel = [edif?.nombre, prop.numero].filter(Boolean).join(" · ");

          return {
            id_cuenta_cobranza: idNum,
            folio: formatCuentaCobranzaId(idNum, tipo),
            tipo,
            proyecto_nombre: proyectoNombre,
            propiedad_label: propiedadLabel || proyectoNombre,
            numero_departamento: prop.numero,
            edificio_nombre: edif?.nombre ?? "",
            modelo_nombre: modeloNombre,
            compradores: compradoresPorCuenta.get(idNum) ?? [],
            propietario,
            dias_desde_compra: dias,
            precio_final: precioFinal,
            metraje,
            precio_m2: precioM2,
            fecha_compra: fechaCompra,
          };
        })
        .filter((c): c is CasoVenta => c !== null)
        .sort((a, b) => (b.fecha_compra > a.fecha_compra ? 1 : -1));
    },
  });
}
