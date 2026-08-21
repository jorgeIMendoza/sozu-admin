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

/** Columnas que agrega `20260821_esquemas_pago_campos_motor_precios.md`. */
const COLUMNAS_NUEVAS =
  "tipo_esquema, mes_inicio_mensualidades, es_base, modo_escalonamiento, " +
  "factor_crecimiento, descripcion";

const COLUMNAS_BASE =
  "id, id_proyecto, nombre, porcentaje_enganche, porcentaje_mensualidades, " +
  "porcentaje_entrega, numero_mensualidades, porcentaje_descuento_aumento, " +
  "numero_pagos_enganche, tramos_mensualidad, orden, activo, fecha_creacion";

/**
 * ¿La base ya tiene las columnas del DDL pendiente?
 *
 * El front no puede ejecutar DDL, así que tiene que servir en los dos mundos:
 * antes de aplicarlo lee y escribe solo lo que existe y deriva el resto; después,
 * empieza a guardarlo sin que nadie toque el código. La respuesta se memoriza
 * por sesión porque una columna no aparece a media sesión.
 */
let soporte: boolean | null = null;
export async function soportaCamposDeMotor(): Promise<boolean> {
  if (soporte !== null) return soporte;
  const { error } = await (supabase as any)
    .from("esquemas_pago")
    .select(COLUMNAS_NUEVAS)
    .limit(0);
  soporte = !error;
  return soporte;
}

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

  const ampliado = await soportaCamposDeMotor();
  const { data, error } = await (supabase as any)
    .from("esquemas_pago")
    .select(ampliado ? `${COLUMNAS_BASE}, ${COLUMNAS_NUEVAS}` : COLUMNAS_BASE)
    .eq("id_proyecto", id)
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
      tipo_esquema: (f.tipo_esquema as EsquemaFinanciamiento["tipo_esquema"]) ?? "preventa",
      pct_enganche: pctEnganche,
      pct_mensualidades: pct(f.porcentaje_mensualidades),
      pct_entrega: pct(f.porcentaje_entrega),
      num_mensualidades: num(f.numero_mensualidades),
      escalonadas,
      modo_escalonamiento:
        (f.modo_escalonamiento as EsquemaFinanciamiento["modo_escalonamiento"]) ?? "lineal",
      tramos,
      factor_crecimiento: f.factor_crecimiento == null ? 0.05 : num(f.factor_crecimiento),
      meses_enganche: Math.max(1, num(f.numero_pagos_enganche) || 1),
      mes_inicio_mensualidades:
        f.mes_inicio_mensualidades == null ? 1 : num(f.mes_inicio_mensualidades),
      pct_ajuste_manual: pct(f.porcentaje_descuento_aumento),
      // Con la columna, el negocio decide cuál es la referencia. Sin ella se
      // deriva del esquema que no mueve el precio de lista.
      es_base: ampliado ? Boolean(f.es_base) : i === indiceBase,
      es_contado: pctEnganche >= 0.999,
      // Se traen también los dados de baja: la pantalla los lista apagados para
      // poder reactivarlos, y todo lo que calcula ya filtra por `activo`.
      activo: Boolean(f.activo),
      creado_en: String(f.fecha_creacion ?? new Date().toISOString()),
    } satisfies EsquemaFinanciamiento;
  });
}

/** Lo que la pantalla captura de un esquema, sin los campos que pone el sistema. */
export type DatosEsquemaReal = Omit<
  EsquemaFinanciamiento,
  "id_esquema" | "id_proyecto" | "activo" | "creado_en"
>;

/** El motor razona en fracciones; la tabla guarda de 0 a 100. */
const aPct = (v: number) => Math.round(v * 10000) / 100;

/**
 * Columnas de la tabla que corresponden a lo capturado.
 *
 * `fecha_actualizacion` se escribe a mano porque la tabla no tiene trigger: la
 * columna existe con DEFAULT CURRENT_TIMESTAMP, así que sin esto se llena al
 * insertar y no se vuelve a mover nunca.
 */
function aFila(datos: DatosEsquemaReal, ampliado: boolean): Record<string, unknown> {
  const fila: Record<string, unknown> = {
    nombre: datos.nombre.trim(),
    porcentaje_enganche: aPct(datos.pct_enganche),
    porcentaje_mensualidades: aPct(datos.pct_mensualidades),
    porcentaje_entrega: aPct(datos.pct_entrega),
    numero_mensualidades: Math.max(0, Math.round(datos.num_mensualidades)),
    porcentaje_descuento_aumento: aPct(datos.pct_ajuste_manual),
    numero_pagos_enganche: Math.max(1, Math.round(datos.meses_enganche)),
    // Sin escalonar se guarda null y no un arreglo parejo: null dice "no aplica",
    // un arreglo diría que alguien eligió esos pesos.
    tramos_mensualidad: datos.escalonadas ? datos.tramos : null,
    fecha_actualizacion: new Date().toISOString(),
  };
  if (ampliado) {
    fila.tipo_esquema = datos.tipo_esquema;
    fila.mes_inicio_mensualidades = Math.max(0, Math.round(datos.mes_inicio_mensualidades));
    fila.modo_escalonamiento = datos.modo_escalonamiento;
    fila.factor_crecimiento = datos.factor_crecimiento;
  }
  return fila;
}

/**
 * Alta de un esquema.
 *
 * `id` es GENERATED BY DEFAULT AS IDENTITY, así que se omite y lo asigna la
 * base. El `orden` va al final de los del proyecto: un esquema nuevo no tiene
 * por qué colarse antes de los que ya se ofrecen.
 */
export async function crearEsquemaReal(
  idProyecto: string,
  datos: DatosEsquemaReal,
): Promise<void> {
  const id = Number(idProyecto);
  if (!Number.isFinite(id)) throw new Error("Proyecto inválido.");
  const ampliado = await soportaCamposDeMotor();

  const { data: ultimo } = await (supabase as any)
    .from("esquemas_pago")
    .select("orden")
    .eq("id_proyecto", id)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await (supabase as any).from("esquemas_pago").insert({
    ...aFila(datos, ampliado),
    id_proyecto: id,
    id_producto: null,
    activo: true,
    orden: num(ultimo?.orden) + 1,
  });
  if (error) throw new Error(error.message);
}

export async function actualizarEsquemaReal(
  idEsquema: string,
  datos: DatosEsquemaReal,
): Promise<void> {
  const ampliado = await soportaCamposDeMotor();
  const { error } = await (supabase as any)
    .from("esquemas_pago")
    .update(aFila(datos, ampliado))
    .eq("id", Number(idEsquema));
  if (error) throw new Error(error.message);
}

/**
 * Baja y alta de un esquema, siempre por bandera.
 *
 * Nunca DELETE. `ofertas.id_esquema_pago_seleccionado` apunta aquí con
 * ON DELETE SET NULL: borrar en duro no falla, deja la oferta apuntando a nulo
 * y se pierde con qué condiciones se le cotizó a un prospecto. Un esquema que
 * ya se ofreció es historia, no un renglón desechable.
 */
export async function cambiarActivoEsquemaReal(
  idEsquema: string,
  activo: boolean,
): Promise<void> {
  const { error } = await (supabase as any)
    .from("esquemas_pago")
    .update({ activo, fecha_actualizacion: new Date().toISOString() })
    .eq("id", Number(idEsquema));
  if (error) throw new Error(error.message);
}

/**
 * Marca el esquema de referencia del proyecto para su régimen.
 *
 * En dos pasos y no en uno porque hay un índice único parcial que impide dos
 * bases activos en el mismo régimen: primero se libera el lugar, luego se ocupa.
 * Devuelve `false` si la columna todavía no existe, para que quien llame sepa
 * que la marca solo quedó en memoria.
 */
export async function marcarBaseEsquemaReal(
  idProyecto: string,
  idEsquema: string,
  tipo: EsquemaFinanciamiento["tipo_esquema"],
): Promise<boolean> {
  if (!(await soportaCamposDeMotor())) return false;
  const ahora = new Date().toISOString();

  const { error: e1 } = await (supabase as any)
    .from("esquemas_pago")
    .update({ es_base: false, fecha_actualizacion: ahora })
    .eq("id_proyecto", Number(idProyecto))
    .eq("tipo_esquema", tipo)
    .eq("es_base", true);
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await (supabase as any)
    .from("esquemas_pago")
    .update({ es_base: true, fecha_actualizacion: ahora })
    .eq("id", Number(idEsquema));
  if (e2) throw new Error(e2.message);
  return true;
}
