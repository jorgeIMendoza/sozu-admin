import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Historial de comisiones ya devengadas — externas e internas.
 *
 * Esta vista **no calcula estructura**: lee lo que ya ocurrió. Es la contraparte
 * del resto del portal, que modela lo que *debería* pagarse, y sirve para
 * auditar el pago real contra esa estructura.
 *
 * **El modelo real.** `comisionistas` guarda una fila por beneficiario y cuenta
 * —no solo los internos— con su `porcentaje_comision`, `aprobada` y `pagada`.
 * Lo que distingue externo de interno es el **rol del usuario**, no la tabla:
 * los roles 3 (Agente Inmobiliario), 4 (Inmobiliaria) y 31 (Supervisor de
 * agentes externos) son terceros; el resto es personal de SOZU. Verificado
 * contra Producción: de 348 filas vigentes, 108 son externas y 240 internas.
 *
 * `cuentas_cobranza.porcentaje_comision_venta` es la comisión de venta **total**
 * de la cuenta; los comisionistas son su reparto.
 *
 * Waterfall explícito en todos los pasos (patrón #1 de CLAUDE.md): la cadena
 * cuenta → propiedad → edificio_modelo → edificio → proyecto tiene cuatro
 * niveles y el join anidado de PostgREST devuelve `null` sin error, lo que aquí
 * dejaría comisiones sin proyecto — justo la columna por la que se agrupa el
 * análisis.
 */

export type TipoComision = "externa" | "interna";
export type EstatusComision = "pagada" | "autorizada" | "en_espera";

/** Roles cuyo titular es un tercero, no personal de SOZU (ver CLAUDE.md). */
const ROLES_EXTERNOS = new Set([3, 4, 31]);

/** Solo desde Vendida hay comisión devengada. */
const ESTATUS_VENDIDAS = [5, 7, 8, 9];

/** PostgREST corta en 1000 filas por respuesta; hay ~1,400 cuentas con comisión. */
const LOTE = 1000;

export interface ComisionHistorial {
  clave: string;
  tipo: TipoComision;
  idCuenta: number;
  folio: string;
  /** Proyecto del inmueble, o el nombre del producto si la cuenta es de ese tipo. */
  contexto: string;
  idProyecto: number | null;
  esProducto: boolean;
  unidad: string | null;
  precioFinal: number;
  /** A quién se le paga. */
  beneficiario: string;
  /** Su rol en el sistema, que es lo que define si es externo o interno. */
  rol: string;
  pct: number;
  monto: number;
  estatus: EstatusComision;
  fechaPago: string | null;
  /** Estatus del flujo de autorización de la cuenta para este tipo de comisión. */
  autorizacionCuenta: string | null;
  notasRechazo: string | null;
}

export function useHistorialComisiones() {
  return useQuery<ComisionHistorial[]>({
    queryKey: ["historial-comisiones"],
    staleTime: 60_000,
    queryFn: async () => {
      /* 1. Cuentas padre con comisión de venta. `id_cuenta_cobranza_padre IS NULL`
            evita contar dos veces: bodegas y estacionamientos cuelgan de la
            cuenta principal y su comisión ya está en ella. */
      const cuentas: any[] = [];
      for (let desde = 0; ; desde += LOTE) {
        const { data, error } = await supabase
          .from("cuentas_cobranza")
          .select(
            "id, id_propiedad, precio_final, porcentaje_comision_venta, " +
            "fecha_pago_comision, es_pagada_comision_venta, " +
            "estatus_autorizacion_comision_externa, notas_rechazo_comision_externa, " +
            "estatus_autorizacion_comision_interna, notas_rechazo_comision_interna",
          )
          .eq("activo", true)
          .is("id_cuenta_cobranza_padre", null)
          .not("id_propiedad", "is", null)
          .order("id", { ascending: false })
          .range(desde, desde + LOTE - 1);
        if (error) return [];
        cuentas.push(...(data ?? []));
        if (!data || data.length < LOTE) break;
      }
      if (!cuentas.length) return [];

      /* 2. La cadena hasta el proyecto, nivel por nivel. */
      const idsPropiedad = [...new Set(cuentas.map(c => c.id_propiedad).filter(Boolean))];
      const propiedades = await enLotes(idsPropiedad, ids =>
        supabase
          .from("propiedades")
          .select("id, numero_propiedad, id_edificio_modelo")
          .in("id", ids)
          .in("id_estatus_disponibilidad", ESTATUS_VENDIDAS),
      );

      const idsEdModelo = [...new Set(propiedades.map(p => p.id_edificio_modelo).filter(Boolean))];
      const edModelos = await enLotes(idsEdModelo, ids =>
        supabase.from("edificios_modelos").select("id, id_edificio").in("id", ids));

      const idsEdificio = [...new Set(edModelos.map(e => e.id_edificio).filter(Boolean))];
      const edificios = await enLotes(idsEdificio, ids =>
        supabase.from("edificios").select("id, id_proyecto").in("id", ids));

      const idsProyecto = [...new Set(edificios.map(e => e.id_proyecto).filter(Boolean))];
      const proyectos = await enLotes(idsProyecto, ids =>
        supabase.from("proyectos").select("id, nombre").in("id", ids));

      /* 3. Los comisionistas de esas cuentas y el rol de cada uno. */
      const idsCuenta = cuentas.map(c => c.id);
      const comisionistas = await enLotes(idsCuenta, ids =>
        (supabase as any)
          .from("comisionistas")
          .select("id_cuenta_cobranza, email_usuario, porcentaje_comision, aprobada, pagada, fecha_pago_comision")
          .eq("activo", true)
          .in("id_cuenta_cobranza", ids), 500);

      const emails = [...new Set(comisionistas.map(c => c.email_usuario).filter(Boolean))];
      const usuarios = await enLotes(emails, lote =>
        supabase.from("usuarios").select("email, nombre, rol_id").in("email", lote), 500);

      const idsRol = [...new Set(usuarios.map(u => u.rol_id).filter(Boolean))];
      const roles = idsRol.length
        ? (await supabase.from("roles").select("id, nombre").in("id", idsRol)).data ?? []
        : [];

      /* --- Índices --- */
      const propPorId = new Map(propiedades.map(p => [p.id, p]));
      const edificioPorModelo = new Map(edModelos.map(e => [e.id, e.id_edificio]));
      const proyectoPorEdificio = new Map(edificios.map(e => [e.id, e.id_proyecto]));
      const nombreProyecto = new Map(proyectos.map(p => [p.id, p.nombre as string]));
      const usuarioPorEmail = new Map(usuarios.map(u => [u.email as string, u]));
      const nombreRol = new Map(roles.map(r => [r.id as number, r.nombre as string]));

      const porCuenta = new Map<number, any[]>();
      for (const c of comisionistas) {
        const lista = porCuenta.get(c.id_cuenta_cobranza);
        if (lista) lista.push(c);
        else porCuenta.set(c.id_cuenta_cobranza, [c]);
      }

      const salida: ComisionHistorial[] = [];

      for (const cuenta of cuentas) {
        const prop = propPorId.get(cuenta.id_propiedad);
        // Sin propiedad vendida no hay comisión devengada todavía.
        if (!prop) continue;

        const idEdificio = edificioPorModelo.get(prop.id_edificio_modelo);
        const idProyecto = idEdificio != null ? proyectoPorEdificio.get(idEdificio) ?? null : null;
        const contexto = idProyecto != null
          ? nombreProyecto.get(idProyecto) ?? `Proyecto ${idProyecto}`
          : "Sin proyecto";
        const precio = Number(cuenta.precio_final ?? 0);

        for (const com of porCuenta.get(cuenta.id) ?? []) {
          const usuario = usuarioPorEmail.get(com.email_usuario);
          const rolId = usuario?.rol_id as number | undefined;
          const tipo: TipoComision =
            rolId != null && ROLES_EXTERNOS.has(rolId) ? "externa" : "interna";
          const pct = Number(com.porcentaje_comision ?? 0);

          salida.push({
            clave: `${cuenta.id}-${com.email_usuario}`,
            tipo,
            idCuenta: cuenta.id,
            folio: `CC-${String(cuenta.id).padStart(6, "0")}`,
            contexto,
            idProyecto,
            esProducto: false,
            unidad: (prop.numero_propiedad as string) ?? null,
            precioFinal: precio,
            beneficiario: (usuario?.nombre as string) || com.email_usuario,
            rol: rolId != null ? nombreRol.get(rolId) ?? `Rol ${rolId}` : "Sin rol",
            pct,
            monto: precio * pct / 100,
            estatus: com.pagada ? "pagada" : com.aprobada ? "autorizada" : "en_espera",
            fechaPago: (com.fecha_pago_comision as string)
              ?? (cuenta.fecha_pago_comision as string) ?? null,
            autorizacionCuenta: tipo === "externa"
              ? (cuenta.estatus_autorizacion_comision_externa as string) ?? null
              : (cuenta.estatus_autorizacion_comision_interna as string) ?? null,
            notasRechazo: tipo === "externa"
              ? (cuenta.notas_rechazo_comision_externa as string) ?? null
              : (cuenta.notas_rechazo_comision_interna as string) ?? null,
          });
        }
      }

      return salida;
    },
  });
}

/**
 * Consulta por lotes: `in()` con miles de ids revienta la URL y PostgREST corta
 * en 1000 filas por respuesta.
 */
/*
 * Los `any` de esta función y de `cuentas` son deliberados: el cliente de
 * Supabase infiere tipos por tabla y consulta, así que un genérico estricto aquí
 * obliga a castear en cada llamada y pelea con `GenericStringError`. Es el mismo
 * criterio del patrón #8 de CLAUDE.md para tablas fuera de los tipos generados.
 */
async function enLotes<T = any>(
  ids: any[],
  consulta: (lote: any[]) => any,
  tamano = LOTE,
): Promise<T[]> {
  if (!ids.length) return [];
  const salida: T[] = [];
  for (let i = 0; i < ids.length; i += tamano) {
    const { data } = await consulta(ids.slice(i, i + tamano));
    salida.push(...((data ?? []) as T[]));
  }
  return salida;
}

export interface ResumenProyecto {
  idProyecto: number | null;
  proyecto: string;
  externaPagada: number;
  externaPendiente: number;
  internaPagada: number;
  internaPendiente: number;
  total: number;
  operaciones: number;
  unidades: number;
}

/**
 * Pago total por proyecto, separado en cuatro y no en un total único.
 *
 * Las cuatro cifras responden preguntas distintas: cuánto salió ya, cuánto
 * falta, y de eso cuánto es de terceros y cuánto del equipo. Un total único las
 * esconde, y es la diferencia entre auditar y solo mirar.
 */
export function resumirPorProyecto(filas: ComisionHistorial[]): ResumenProyecto[] {
  const mapa = new Map<string, ResumenProyecto & { cuentas: Set<number> }>();

  for (const f of filas) {
    const clave = f.idProyecto != null ? String(f.idProyecto) : f.contexto;
    let r = mapa.get(clave);
    if (!r) {
      r = {
        idProyecto: f.idProyecto, proyecto: f.contexto,
        externaPagada: 0, externaPendiente: 0,
        internaPagada: 0, internaPendiente: 0,
        total: 0, operaciones: 0, unidades: 0,
        cuentas: new Set<number>(),
      };
      mapa.set(clave, r);
    }

    const pagada = f.estatus === "pagada";
    if (f.tipo === "externa") {
      if (pagada) r.externaPagada += f.monto; else r.externaPendiente += f.monto;
    } else {
      if (pagada) r.internaPagada += f.monto; else r.internaPendiente += f.monto;
    }
    r.total += f.monto;
    r.operaciones++;
    r.cuentas.add(f.idCuenta);
  }

  return [...mapa.values()]
    .map(({ cuentas, ...r }) => ({ ...r, unidades: cuentas.size }))
    .sort((a, b) => b.total - a.total);
}
