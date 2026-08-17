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
  /** Lead de la oferta (cliente / contacto / prospecto que la originó). */
  cliente_lead: string;
  /** Agente creador de la oferta (nombre de la persona, si se resuelve). */
  agente: string;
  dias_desde_compra: number;
  precio_final: number;
  metraje: number;
  precio_m2: number;
  fecha_compra: string;
}

const ESTATUS_APARTADO = 4;
const ESTATUS_VENDIDO = 5;
const ESTATUS_EN_CICLO = [ESTATUS_APARTADO, ESTATUS_VENDIDO];

/**
 * Límite de elementos por filtro `.in(...)`. PostgREST arma el filtro en el
 * query-string; una lista larga (cientos de correos o ids) revienta el límite
 * de longitud de URL del proxy y la petición falla con "TypeError: Failed to
 * fetch". Por eso las consultas por lista se parten en lotes.
 */
const IN_CHUNK = 150;

const nombreDePersona = (p: { nombre_legal?: string | null; nombre_comercial?: string | null } | null | undefined) =>
  p?.nombre_comercial || p?.nombre_legal || "";

/**
 * `SELECT ... WHERE col IN (ids)` a prueba de URLs largas: parte los ids en
 * lotes y los corre en paralelo. `run` recibe cada lote y devuelve la respuesta
 * de Supabase. Deduplica ids y omite la consulta si no hay ninguno.
 */
async function selectIn<T, I extends number | string = number>(
  ids: I[],
  run: (chunk: I[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return [];
  const chunks: I[][] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) chunks.push(unique.slice(i, i + IN_CHUNK));
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await run(chunk);
      if (error) throw error;
      return data ?? [];
    }),
  );
  return results.flat();
}

const diffDays = (from: string, to: Date) =>
  Math.round((to.getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));

/**
 * Expedientes en ciclo de venta: cuentas de cobranza aprobadas cuya propiedad
 * está en estatus Apartado (4) o Vendido (5).
 *
 * Estrategia: se traen las cuentas candidatas y sus ofertas, se acota el
 * universo a las propiedades EN CICLO y, a partir de ahí, TODO el enriquecimiento
 * (proyecto, modelo, compradores, propietario, agente, lead) se hace SOLO sobre
 * las cuentas que sobreviven ese filtro. Así no se hidratan cientos de cuentas
 * que luego se descartan, y las listas `.in(...)` quedan chicas.
 */
export function useCicloVentaCasos() {
  return useQuery({
    queryKey: ["ciclo_venta_casos_vendidas"],
    staleTime: 60_000,
    queryFn: async (): Promise<CasoVenta[]> => {
      // 1) Cuentas candidatas (aprobadas, principales, con fecha de compra).
      const { data: cuentas, error: ccErr } = await supabase
        .from("cuentas_cobranza")
        .select("id, id_oferta, precio_final, fecha_compra")
        .eq("activo", true)
        .eq("es_aprobado", true)
        .is("id_cuenta_cobranza_padre", null)
        .not("fecha_compra", "is", null)
        .order("fecha_compra", { ascending: false })
        .limit(1000);
      if (ccErr) throw ccErr;
      if (!cuentas?.length) return [];

      // 2) Ofertas de esas cuentas (para llegar a la propiedad/producto/lead/agente).
      const ofertaIds = cuentas.map((c) => c.id_oferta).filter((v): v is number => v != null);
      const ofertas = await selectIn<{
        id: number;
        id_propiedad: number | null;
        id_producto: number | null;
        email_creador: string | null;
        id_persona_lead: number | null;
      }>(ofertaIds, (chunk) =>
        supabase
          .from("ofertas")
          .select("id, id_propiedad, id_producto, email_creador, id_persona_lead")
          .in("id", chunk),
      );
      const ofertaById = new Map(ofertas.map((o) => [o.id, o]));

      // 3) Propiedades EN CICLO (estatus 4/5). Define el universo que sobrevive.
      const propIds = ofertas.map((o) => o.id_propiedad).filter((v): v is number => v != null);
      const propiedades = await selectIn<any>(propIds, (chunk) =>
        supabase
          .from("propiedades")
          .select(
            "id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno, m2_interiores, m2_exteriores, m2_loft, id_estatus_disponibilidad",
          )
          .in("id", chunk)
          .in("id_estatus_disponibilidad", ESTATUS_EN_CICLO)
          .eq("activo", true),
      );
      if (!propiedades.length) return [];

      const propiedadMap = new Map<number, { numero: string; idEdificioModelo: number | null; idEntidadDueno: number | null; metraje: number }>(
        propiedades.map((p) => [
          p.id,
          {
            numero: p.numero_propiedad ?? "",
            idEdificioModelo: p.id_edificio_modelo ?? null,
            idEntidadDueno: p.id_entidad_relacionada_dueno ?? null,
            metraje: (Number(p.m2_interiores) || 0) + (Number(p.m2_exteriores) || 0) + (Number(p.m2_loft) || 0),
          },
        ]),
      );

      // 4) Cuentas que sobreviven: su oferta apunta a una propiedad EN CICLO.
      const cuentasVigentes = cuentas.filter((c) => {
        const oferta = c.id_oferta != null ? ofertaById.get(c.id_oferta) : undefined;
        return oferta?.id_propiedad != null && propiedadMap.has(oferta.id_propiedad);
      });
      if (!cuentasVigentes.length) return [];

      const ofertasVigentes = cuentasVigentes
        .map((c) => (c.id_oferta != null ? ofertaById.get(c.id_oferta) : undefined))
        .filter((o): o is NonNullable<typeof o> => !!o);

      // 5) Enriquecimiento acotado a lo que sobrevive.
      const emIds = propiedades.map((p) => p.id_edificio_modelo).filter((v): v is number => v != null);
      const productoIds = ofertasVigentes.map((o) => o.id_producto).filter((v): v is number => v != null);
      const cuentaVigenteIds = cuentasVigentes.map((c) => c.id);
      const duenoIds = propiedades.map((p) => p.id_entidad_relacionada_dueno).filter((v): v is number => v != null);
      const emails = ofertasVigentes.map((o) => o.email_creador).filter((v): v is string => !!v);
      const leadIds = ofertasVigentes.map((o) => o.id_persona_lead).filter((v): v is number => v != null);

      // Ola A — todo depende sólo del universo ya acotado; corre en paralelo.
      const [edms, productos, compradores, duenos, usuariosAgente] = await Promise.all([
        selectIn<{ id: number; id_edificio: number | null; id_modelo: number | null }>(emIds, (ch) =>
          supabase.from("edificios_modelos").select("id, id_edificio, id_modelo").in("id", ch),
        ),
        selectIn<{ id: number; categorias_producto: { nombre: string | null } | null }>(productoIds, (ch) =>
          (supabase as any)
            .from("productos_servicios")
            .select("id, categorias_producto!productos_servicios_id_categoria_fkey(nombre)")
            .in("id", ch),
        ),
        selectIn<{ id_cuenta_cobranza: number; id_persona: number }>(cuentaVigenteIds, (ch) =>
          supabase.from("compradores").select("id_cuenta_cobranza, id_persona").in("id_cuenta_cobranza", ch).eq("activo", true),
        ),
        selectIn<{ id: number; personas: { nombre_legal: string | null; nombre_comercial: string | null } | null }>(duenoIds, (ch) =>
          (supabase as any)
            .from("entidades_relacionadas")
            .select("id, personas!fk_entrel_persona(nombre_legal, nombre_comercial)")
            .in("id", ch),
        ),
        selectIn<{ email: string; id_persona: number | null; nombre: string | null }, string>(emails, (ch) =>
          (supabase as any).from("usuarios").select("email, id_persona, nombre").in("email", ch),
        ),
      ]);

      const emMap = new Map(edms.map((em) => [em.id, { idEdificio: em.id_edificio, idModelo: em.id_modelo }]));
      const productoCategoria = new Map<number, string>(
        productos.map((p) => [p.id, (p.categorias_producto?.nombre || "").toLowerCase()]),
      );
      const duenoNombre = new Map<number, string>(duenos.map((e) => [e.id, nombreDePersona(e.personas)]));

      // Ola B — depende de la ola A.
      const modeloIds = edms.map((em) => em.id_modelo).filter((v): v is number => v != null);
      const edificioIds = edms.map((em) => em.id_edificio).filter((v): v is number => v != null);
      const compradorPersonaIds = compradores.map((c) => c.id_persona).filter((v): v is number => v != null);
      const agentePersonaIds = usuariosAgente.map((u) => u.id_persona).filter((v): v is number => v != null);

      const [modelos, edificios, personasComp, personasLeadAgente] = await Promise.all([
        selectIn<{ id: number; nombre: string | null }>(modeloIds, (ch) =>
          supabase.from("modelos").select("id, nombre").in("id", ch),
        ),
        selectIn<{ id: number; nombre: string | null; id_proyecto: number | null }>(edificioIds, (ch) =>
          supabase.from("edificios").select("id, nombre, id_proyecto").in("id", ch),
        ),
        selectIn<{ id: number; nombre_legal: string | null; nombre_comercial: string | null }>(compradorPersonaIds, (ch) =>
          (supabase as any).from("personas").select("id, nombre_legal, nombre_comercial").in("id", ch),
        ),
        selectIn<{ id: number; nombre_legal: string | null; nombre_comercial: string | null }>(
          [...leadIds, ...agentePersonaIds],
          (ch) => (supabase as any).from("personas").select("id, nombre_legal, nombre_comercial").in("id", ch),
        ),
      ]);

      const modeloNombre = new Map(modelos.map((m) => [m.id, m.nombre ?? ""]));
      const edificioMap = new Map(edificios.map((e) => [e.id, { nombre: e.nombre ?? "", idProyecto: e.id_proyecto }]));
      const personaCompMap = new Map<number, string>(personasComp.map((p) => [p.id, nombreDePersona(p)]));
      const personaLeadAgenteMap = new Map<number, string>(personasLeadAgente.map((p) => [p.id, nombreDePersona(p)]));

      // Ola C — proyectos (dependen de edificios).
      const proyectoIds = edificios.map((e) => e.id_proyecto).filter((v): v is number => v != null);
      const proyectos = await selectIn<{ id: number; nombre: string | null }>(proyectoIds, (ch) =>
        supabase.from("proyectos").select("id, nombre").in("id", ch),
      );
      const proyectoNombre = new Map(proyectos.map((p) => [p.id, p.nombre ?? ""]));

      // Índices finales por cuenta / oferta.
      const compradoresPorCuenta = new Map<number, string[]>();
      compradores.forEach((c) => {
        const nombre = personaCompMap.get(c.id_persona);
        if (!nombre) return;
        const list = compradoresPorCuenta.get(c.id_cuenta_cobranza) ?? [];
        list.push(nombre);
        compradoresPorCuenta.set(c.id_cuenta_cobranza, list);
      });

      const agenteNombrePorEmail = new Map<string, string>();
      usuariosAgente.forEach((u) => {
        const nombre = (u.id_persona != null ? personaLeadAgenteMap.get(u.id_persona) : "") || u.nombre || u.email?.split("@")[0] || "";
        agenteNombrePorEmail.set(u.email, nombre);
      });

      const now = new Date();

      return cuentasVigentes
        .map((c): CasoVenta | null => {
          const oferta = c.id_oferta != null ? ofertaById.get(c.id_oferta) : undefined;
          const prop = oferta?.id_propiedad != null ? propiedadMap.get(oferta.id_propiedad) : undefined;
          if (!oferta || !prop) return null;

          const emInfo = prop.idEdificioModelo != null ? emMap.get(prop.idEdificioModelo) : undefined;
          const edif = emInfo?.idEdificio != null ? edificioMap.get(emInfo.idEdificio) : undefined;
          const idProducto = oferta.id_producto ?? null;
          const categoria = idProducto != null ? productoCategoria.get(idProducto) : undefined;

          const tipo: TipoCuentaCaso =
            categoria == null ? "Propiedad" : categoria === "servicios" ? "Servicio" : "Producto";

          const precioFinal = Number(c.precio_final) || 0;
          const metraje = prop.metraje;
          const fechaCompra = c.fecha_compra ? new Date(c.fecha_compra).toISOString().slice(0, 10) : "";

          return {
            id_cuenta_cobranza: c.id,
            folio: formatCuentaCobranzaId(c.id, tipo),
            tipo,
            proyecto_nombre: edif?.idProyecto != null ? proyectoNombre.get(edif.idProyecto) ?? "" : "",
            propiedad_label: [edif?.nombre, prop.numero].filter(Boolean).join(" · ") || (edif?.nombre ?? ""),
            numero_departamento: prop.numero,
            edificio_nombre: edif?.nombre ?? "",
            modelo_nombre: emInfo?.idModelo != null ? modeloNombre.get(emInfo.idModelo) ?? "" : "",
            compradores: compradoresPorCuenta.get(c.id) ?? [],
            propietario: prop.idEntidadDueno != null ? duenoNombre.get(prop.idEntidadDueno) ?? "" : "",
            cliente_lead: oferta.id_persona_lead != null ? personaLeadAgenteMap.get(oferta.id_persona_lead) ?? "" : "",
            agente: oferta.email_creador ? agenteNombrePorEmail.get(oferta.email_creador) ?? oferta.email_creador : "",
            dias_desde_compra: fechaCompra ? diffDays(fechaCompra, now) : 0,
            precio_final: precioFinal,
            metraje,
            precio_m2: metraje > 0 ? +(precioFinal / metraje).toFixed(2) : 0,
            fecha_compra: fechaCompra,
          };
        })
        .filter((c): c is CasoVenta => c !== null)
        .sort((a, b) => (b.fecha_compra > a.fecha_compra ? 1 : -1));
    },
  });
}
