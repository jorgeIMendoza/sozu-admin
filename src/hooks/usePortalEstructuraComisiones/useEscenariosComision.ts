import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  escaleraEfectiva, desglosePorVenta, type MetaEscalon,
} from "./useMetasEscalon";

/**
 * Escenarios de comisión de un proyecto.
 *
 * Un escenario es un **conjunto de ventas, cada una ligada a un Canal de Venta**.
 * Guarda solo la hipótesis; la comisión se **recalcula** al abrirlo con la
 * configuración vigente de canales, comisionistas e incentivos. Congelar los
 * importes crearía una segunda fuente que se desincroniza.
 *
 * El `orden` importa: la escalera de incentivos es **marginal**, así que la
 * tercera venta *de un canal* cae en otro tramo que la primera.
 *
 * Ver `Ejecuciones_manuales/20260812_escenarios_de_comision.md`.
 */

const ESCENARIOS_KEY = "comisiones-escenarios";

const TABLE_MISSING_CODE = "PGRST205";
const DUPLICATE_KEY_CODE = "23505";

export interface VentaEscenario {
  id: number;
  orden: number;
  idCanal: string;
}

export interface EscenarioComision {
  id: number;
  idProyecto: number;
  nombre: string;
  descripcion: string | null;
  ventas: VentaEscenario[];
}

/** `null` = las tablas no existen todavía (DDL pendiente). */
export function useEscenariosComision(idProyecto: number | null) {
  return useQuery<EscenarioComision[] | null>({
    queryKey: [ESCENARIOS_KEY, idProyecto],
    enabled: idProyecto != null,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: escenarios, error } = await (supabase as any)
        .from("comisiones_escenarios")
        .select("id, id_proyecto, nombre, descripcion")
        .eq("id_proyecto", idProyecto)
        .eq("activo", true)
        .order("nombre");
      if (error) return error.code === TABLE_MISSING_CODE ? null : [];
      if (!escenarios?.length) return [];

      const ids = escenarios.map((e: { id: number }) => e.id);
      const { data: ventas } = await (supabase as any)
        .from("comisiones_escenario_ventas")
        .select("id, id_escenario, orden, id_canal")
        .in("id_escenario", ids)
        .order("orden");

      const porEscenario = new Map<number, VentaEscenario[]>();
      for (const v of (ventas ?? []) as Array<Record<string, unknown>>) {
        const idEsc = Number(v.id_escenario);
        const fila = { id: Number(v.id), orden: Number(v.orden), idCanal: String(v.id_canal) };
        const lista = porEscenario.get(idEsc);
        if (lista) lista.push(fila);
        else porEscenario.set(idEsc, [fila]);
      }

      return (escenarios as Array<Record<string, unknown>>).map(e => ({
        id: Number(e.id),
        idProyecto: Number(e.id_proyecto),
        nombre: String(e.nombre),
        descripcion: (e.descripcion as string | null) ?? null,
        ventas: porEscenario.get(Number(e.id)) ?? [],
      }));
    },
  });
}

function traducirError(error: { code?: string; message?: string }): Error {
  if (error.code === TABLE_MISSING_CODE) {
    return new Error(
      "La base de datos aún no tiene las tablas de escenarios. Ejecuta " +
      "Ejecuciones_manuales/20260812_escenarios_de_comision.md.",
    );
  }
  if (error.code === DUPLICATE_KEY_CODE) {
    return new Error("Ya existe un escenario con ese nombre en este proyecto.");
  }
  if (error.code === "23514") {
    return new Error("El nombre del escenario no puede estar vacío.");
  }
  return new Error(error.message ?? "No se pudo guardar el escenario.");
}

export interface GuardarEscenarioInput {
  /** `undefined` = alta; con valor = modificación. */
  id?: number;
  nombre: string;
  descripcion: string | null;
  /** Canales de cada venta, en orden. El índice define el `orden` (1-based). */
  canalesPorVenta: string[];
}

/**
 * Alta y modificación en una sola operación.
 *
 * Al editar, las ventas se reemplazan completas (borrar e insertar) en vez de
 * hacer un diff fila por fila: el orden es posicional, así que un diff parcial
 * dejaría huecos o duplicaría el `orden`. Son pocas filas por escenario.
 */
export function useGuardarEscenario(idProyecto: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GuardarEscenarioInput) => {
      if (idProyecto == null) throw new Error("Selecciona un proyecto primero.");
      if (!input.nombre.trim()) throw new Error("El nombre del escenario es obligatorio.");

      let idEscenario = input.id;

      if (idEscenario === undefined) {
        const { data, error } = await (supabase as any)
          .from("comisiones_escenarios")
          .insert({
            id_proyecto: idProyecto,
            nombre: input.nombre.trim(),
            descripcion: input.descripcion,
            activo: true,
          })
          .select("id")
          .single();
        if (error) throw traducirError(error);
        idEscenario = Number(data.id);
      } else {
        const { error } = await (supabase as any)
          .from("comisiones_escenarios")
          .update({
            nombre: input.nombre.trim(),
            descripcion: input.descripcion,
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq("id", idEscenario);
        if (error) throw traducirError(error);

        const { error: errorBorrado } = await (supabase as any)
          .from("comisiones_escenario_ventas")
          .delete()
          .eq("id_escenario", idEscenario);
        if (errorBorrado) throw traducirError(errorBorrado);
      }

      if (input.canalesPorVenta.length > 0) {
        const filas = input.canalesPorVenta.map((idCanal, i) => ({
          id_escenario: idEscenario,
          orden: i + 1,
          id_canal: Number(idCanal),
        }));
        const { error } = await (supabase as any)
          .from("comisiones_escenario_ventas")
          .insert(filas);
        if (error) throw traducirError(error);
      }

      return idEscenario as number;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ESCENARIOS_KEY, idProyecto] }),
  });
}

/** Baja lógica: no se pierde un análisis por un clic. */
export function useEliminarEscenario(idProyecto: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any)
        .from("comisiones_escenarios")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw traducirError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ESCENARIOS_KEY, idProyecto] }),
  });
}

/* ------------------------------------------------------------------ */
/* Conciliación del escenario                                          */
/* ------------------------------------------------------------------ */

/** Comisionista de un canal, con su porcentaje base y sus escalones propios. */
export interface ComisionistaDelCanal {
  idPersonal: string | null;
  nombre: string;
  pctBase: number;
  escalonesPropios: MetaEscalon[];
}

export interface ConfigCanal {
  idCanal: string;
  nombre: string;
  comisionTotalPct: number;
  comisionExternaPct: number;
  /** `false` si el canal ya no aplica al proyecto; el escenario lo conserva. */
  aplica: boolean;
  escalonesDelCanal: MetaEscalon[];
  comisionistas: ComisionistaDelCanal[];
}

export interface VentaConciliada {
  orden: number;
  idCanal: string;
  canalNombre: string;
  /** Posición de esta venta DENTRO de su canal: define el tramo marginal. */
  ordinalEnCanal: number;
  totalPct: number;
  externoPct: number;
  dispersadoPct: number;
  remanentePct: number;
  totalImporte: number;
  externoImporte: number;
  dispersadoImporte: number;
  remanenteImporte: number;
  /** Incremento del tramo aplicado, `null` si va a la comisión base. */
  incrementoPct: number | null;
}

export interface EscenarioConciliado {
  ventas: VentaConciliada[];
  totales: {
    totalPct: number; externoPct: number; dispersadoPct: number; remanentePct: number;
    totalImporte: number; externoImporte: number; dispersadoImporte: number; remanenteImporte: number;
  };
  /** Ventas por canal, para el resumen. */
  ventasPorCanal: Array<{ idCanal: string; nombre: string; ventas: number }>;
  /** Canales usados en el escenario que ya no aplican al proyecto. */
  canalesNoVigentes: string[];
  /** true si en alguna venta lo dispersado rebasa la comisión del canal. */
  hayExcedido: boolean;
}

/**
 * Concilia un escenario venta por venta.
 *
 * Para cada venta: se calcula su posición dentro de su canal —eso define el
 * tramo marginal de la escalera— y con ella el porcentaje de cada comisionista.
 * Luego, por venta:
 *
 *   comisión total del canal − dispersado externamente − total dispersado
 *   = remanente
 */
export function conciliarEscenario(
  ventas: VentaEscenario[],
  configPorCanal: Map<string, ConfigCanal>,
  precioUnidad: number,
): EscenarioConciliado {
  const ordenadas = [...ventas].sort((a, b) => a.orden - b.orden);
  const contadorPorCanal = new Map<string, number>();
  const conciliadas: VentaConciliada[] = [];
  const canalesNoVigentes = new Set<string>();

  for (const venta of ordenadas) {
    const cfg = configPorCanal.get(venta.idCanal);
    const ordinalEnCanal = (contadorPorCanal.get(venta.idCanal) ?? 0) + 1;
    contadorPorCanal.set(venta.idCanal, ordinalEnCanal);

    if (!cfg) {
      // Canal borrado del catálogo: se conserva la venta pero no hay con qué conciliar.
      conciliadas.push({
        orden: venta.orden, idCanal: venta.idCanal, canalNombre: `Canal #${venta.idCanal}`,
        ordinalEnCanal, totalPct: 0, externoPct: 0, dispersadoPct: 0, remanentePct: 0,
        totalImporte: 0, externoImporte: 0, dispersadoImporte: 0, remanenteImporte: 0,
        incrementoPct: null,
      });
      continue;
    }
    if (!cfg.aplica) canalesNoVigentes.add(cfg.nombre);

    // Lo dispersado en ESTA venta: cada comisionista con el tramo que le toca
    // según cuántas ventas lleva el canal.
    let dispersadoPct = 0;
    let incrementoPct: number | null = null;
    for (const com of cfg.comisionistas) {
      const escalera = escaleraEfectiva(cfg.escalonesDelCanal, com.escalonesPropios);
      const desglose = desglosePorVenta(com.pctBase, escalera, ordinalEnCanal, precioUnidad);
      const laVenta = desglose[ordinalEnCanal - 1];
      if (!laVenta) continue;
      dispersadoPct += laVenta.pct;
      if (laVenta.tramo) incrementoPct = laVenta.tramo.incrementoPct;
    }

    const remanentePct = cfg.comisionTotalPct - cfg.comisionExternaPct - dispersadoPct;
    const importeDe = (pct: number) => precioUnidad * pct / 100;

    conciliadas.push({
      orden: venta.orden,
      idCanal: venta.idCanal,
      canalNombre: cfg.nombre,
      ordinalEnCanal,
      totalPct: cfg.comisionTotalPct,
      externoPct: cfg.comisionExternaPct,
      dispersadoPct,
      remanentePct,
      totalImporte: importeDe(cfg.comisionTotalPct),
      externoImporte: importeDe(cfg.comisionExternaPct),
      dispersadoImporte: importeDe(dispersadoPct),
      remanenteImporte: importeDe(remanentePct),
      incrementoPct,
    });
  }

  const suma = (sel: (v: VentaConciliada) => number) => conciliadas.reduce((s, v) => s + sel(v), 0);

  const ventasPorCanal = Array.from(contadorPorCanal.entries()).map(([idCanal, ventas]) => ({
    idCanal,
    nombre: configPorCanal.get(idCanal)?.nombre ?? `Canal #${idCanal}`,
    ventas,
  })).sort((a, b) => b.ventas - a.ventas);

  return {
    ventas: conciliadas,
    totales: {
      totalPct: suma(v => v.totalPct),
      externoPct: suma(v => v.externoPct),
      dispersadoPct: suma(v => v.dispersadoPct),
      remanentePct: suma(v => v.remanentePct),
      totalImporte: suma(v => v.totalImporte),
      externoImporte: suma(v => v.externoImporte),
      dispersadoImporte: suma(v => v.dispersadoImporte),
      remanenteImporte: suma(v => v.remanenteImporte),
    },
    ventasPorCanal,
    canalesNoVigentes: Array.from(canalesNoVigentes),
    hayExcedido: conciliadas.some(v => v.remanentePct < -0.0001),
  };
}
