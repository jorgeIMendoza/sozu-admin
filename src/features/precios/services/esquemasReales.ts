import { supabase } from "@/integrations/supabase/client";
import type { EsquemaFinanciamiento, TramoEscalonado } from "../types/dominio";

/**
 * ESQUEMAS DE FINANCIAMIENTO REALES
 *
 * El módulo de Precios traía sus esquemas de un mock con ids de proyecto
 * inventados. Al conectarlo al inventario real esos ids dejaron de existir, así
 * que Escenarios se quedó sin nada que mostrar: sin esquemas no hay comparador,
 * ni cotizador, ni flujo de proyecto, aunque el motor que los calcula estuviera
 * completo.
 *
 * Los esquemas de verdad viven en `esquemas_pago`, que es lo que se captura en
 * Inventarios → Proyectos → Editar Proyecto y lo que ven los prospectos en la
 * oferta digital. Este servicio los trae tal cual, para que Precios razone sobre
 * la misma política comercial que se le ofrece al cliente y no sobre una copia.
 */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** La base de datos guarda porcentajes de 0 a 100; el motor razona en fracciones. */
const pct = (v: unknown): number => num(v) / 100;

/**
 * Tramos de mensualidad escalonada.
 *
 * `tramos_mensualidad` es jsonb y ha guardado más de una forma con el tiempo:
 * números sueltos y objetos con peso. Se aceptan ambas y se normalizan a que
 * sumen 1, porque el motor reparte proporciones y no montos. Cualquier otra cosa
 * se ignora y el esquema queda sin escalonar, que es el comportamiento seguro:
 * mensualidades parejas.
 */
function leerTramos(valor: unknown): { escalonadas: boolean; tramos: TramoEscalonado[] } {
  const PAREJAS = { escalonadas: false, tramos: [{ peso: 0.2 }, { peso: 0.3 }, { peso: 0.5 }] };
  if (!Array.isArray(valor) || valor.length === 0) return PAREJAS;

  const pesos = valor
    .map((t) => {
      if (typeof t === "number") return t;
      if (t && typeof t === "object") {
        const o = t as Record<string, unknown>;
        return num(o.peso ?? o.porcentaje ?? o.valor);
      }
      return 0;
    })
    .filter((p) => p > 0);

  const suma = pesos.reduce((a, b) => a + b, 0);
  if (pesos.length === 0 || suma <= 0) return PAREJAS;

  return { escalonadas: true, tramos: pesos.map((p) => ({ peso: p / suma })) };
}

/**
 * Trae los esquemas activos de un proyecto.
 *
 * Cuatro campos que el motor usa no existen en la tabla y se resuelven aquí con
 * un valor por omisión declarado, no adivinado en silencio:
 *
 * - `tipo_esquema` queda en `preventa`. La tabla no distingue régimen, y preventa
 *   es lo que describe a todos los esquemas capturados hasta hoy.
 * - `mes_inicio_mensualidades` en 1: las mensualidades arrancan el mes siguiente
 *   al enganche.
 * - `factor_crecimiento` y `modo_escalonamiento` son parámetros de simulación del
 *   módulo, no política comercial guardada.
 *
 * `es_base` sale del esquema sin descuento ni aumento —el que cobra el precio de
 * lista—, que es contra el que tiene sentido medir a los demás. `es_contado` sale
 * de un enganche del 100%.
 */
export async function obtenerEsquemasProyecto(
  idProyecto: string,
): Promise<EsquemaFinanciamiento[]> {
  const id = Number(idProyecto);
  if (!Number.isFinite(id)) return [];

  const { data, error } = await (supabase as any)
    .from("esquemas_pago")
    .select(
      "id, id_proyecto, nombre, porcentaje_enganche, porcentaje_mensualidades, " +
        "porcentaje_entrega, numero_mensualidades, porcentaje_descuento_aumento, " +
        "numero_pagos_enganche, tramos_mensualidad, orden, activo, fecha_creacion",
    )
    .eq("id_proyecto", id)
    .eq("activo", true)
    // Los esquemas atados a un producto no aplican a departamentos.
    .is("id_producto", null)
    .order("orden", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  const todas = (data ?? []) as Array<Record<string, unknown>>;

  /*
   * La tabla guarda dos cosas distintas bajo el mismo techo: los esquemas que se
   * ofrecen —F1, F2…— y unos que crea el flujo de asignación para dejar
   * constancia de la condición de una unidad concreta, con nombres tipo
   * `asignacion_V-1702_Monócolo_AC`.
   *
   * Los segundos no son política comercial: nadie los elige, y en Monócolo eran
   * 6 de 11. Se distinguen porque su composición suma cero, no por el nombre:
   * medido sobre toda la base, ninguno de los 47 esquemas de asignación suma
   * 100% y ningún esquema ofrecible se queda fuera por esta regla. Un criterio
   * semántico aguanta que mañana cambie la convención de nombres.
   *
   * Es además la misma condición que el módulo exige para poder calcular: sin
   * una composición que sume 100% no hay flujo que construir.
   */
  const filas = todas.filter((f) => {
    const suma =
      num(f.porcentaje_enganche) + num(f.porcentaje_mensualidades) + num(f.porcentaje_entrega);
    return Math.abs(suma - 100) < 0.01;
  });
  if (filas.length === 0) return [];

  // El esquema base es el que no mueve el precio de lista. Si todos lo mueven,
  // el primero en el orden capturado: alguno tiene que ser la referencia.
  const iBase = filas.findIndex((f) => Math.abs(num(f.porcentaje_descuento_aumento)) < 0.0001);
  const indiceBase = iBase >= 0 ? iBase : 0;

  return filas.map((f, i) => {
    const { escalonadas, tramos } = leerTramos(f.tramos_mensualidad);
    const pctEnganche = pct(f.porcentaje_enganche);
    return {
      id_esquema: String(f.id),
      id_proyecto: idProyecto,
      nombre: (f.nombre as string) ?? `Esquema ${f.id}`,
      tipo_esquema: "preventa",
      pct_enganche: pctEnganche,
      pct_mensualidades: pct(f.porcentaje_mensualidades),
      pct_entrega: pct(f.porcentaje_entrega),
      num_mensualidades: num(f.numero_mensualidades),
      escalonadas,
      modo_escalonamiento: "lineal",
      tramos,
      factor_crecimiento: 0.05,
      meses_enganche: Math.max(1, num(f.numero_pagos_enganche) || 1),
      mes_inicio_mensualidades: 1,
      pct_ajuste_manual: pct(f.porcentaje_descuento_aumento),
      es_base: i === indiceBase,
      es_contado: pctEnganche >= 0.999,
      activo: true,
      creado_en: String(f.fecha_creacion ?? new Date().toISOString()),
    } satisfies EsquemaFinanciamiento;
  });
}
