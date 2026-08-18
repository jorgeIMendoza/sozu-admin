/**
 * FUENTE ÚNICA DE VERDAD.
 * Todos los montos derivados se calculan aquí. Ninguna pantalla recalcula.
 * Prohibido calcular rendimiento, plusvalía o proyección del inmueble:
 * aquí solo se calcula la ganancia del colaborador.
 */
import {
  CAMPANIA_VIGENTE,
  DESARROLLOS,
  HITOS_PAGO,
  MI_COMISION_POR_CANAL,
  ESQUEMAS_PAGO,
  GANANCIAS,
  NEGOCIOS,
  UNIDADES,
} from "./mock";
import type {
  ComisionCanal,
  Desarrollo,
  Ganancia,
  HitoPago,
  Negocio,
  Unidad,
  Usuario,
} from "./tipos";

export const MASK = "••••••";

export function mxn(n: number, decimales = 0): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/** Enmascara montos de ganancia personal y PII en Modo presentación. */
export function enmascarar(valor: string, modoPresentacion: boolean): string {
  return modoPresentacion ? MASK : valor;
}

export function precioTotalUnidad(u: Unidad): number {
  return u.precio + u.productos_adicionales.reduce((a, p) => a + p.monto, 0);
}

/** Ganancia del colaborador por unidad, según la campaña vigente. */
export function gananciaPorUnidad(u: Unidad): number {
  return Math.round(precioTotalUnidad(u) * CAMPANIA_VIGENTE.pct_comision);
}

export function gananciaPorMonto(monto: number): number {
  return Math.round(monto * CAMPANIA_VIGENTE.pct_comision);
}

/**
 * Estas funciones sólo necesitan la fecha de entrega, así que piden lo mínimo:
 * así sirven igual para un desarrollo del mock que para un proyecto real de BD.
 */
type ConEntrega = Pick<Desarrollo, "entrega_estimada">;

/** Horizonte de cobro estimado — obligatorio junto a todo monto proyectado. */
export function cobroEstimado(dev: ConEntrega): string {
  return dev.entrega_estimada;
}

export type NodoLinea = {
  titulo: string;
  fecha: string;
  alcanzado: boolean;
  icono: "user-check" | "file-text" | "pen-line" | "key-round" | "banknote";
};

/** Fecha estimada de escrituración del desarrollo. */
function fechaEscrituracion(dev: ConEntrega): string {
  return dev.entrega_estimada;
}

/**
 * INVARIANTE — UNA SOLA FECHA: el trimestre del encabezado y el último nodo
 * de la línea de tiempo se leen de aquí. Siempre es la fecha del PAGO.
 */
export function fechaDePago(dev: ConEntrega): string {
  const [trimestre, anioTexto] = dev.entrega_estimada.split(" ");
  const anio = Number(anioTexto);
  const q = Number((trimestre ?? "").replace("Q", ""));
  // Un proyecto real puede no tener fecha de entrega capturada: mejor decirlo
  // que inventar un trimestre.
  if (!Number.isFinite(anio) || !Number.isFinite(q) || q < 1 || q > 4) return "Por definir";
  const siguiente = q + 1;
  return siguiente > 4 ? `Q1 ${anio + 1}` : `Q${siguiente} ${anio}`;
}

/** SWAP POINT: supabase.reglas_programa.hitos_pago */
export function hitosDePago(dev: ConEntrega): HitoPago[] {
  return HITOS_PAGO.map((h) => ({ ...h, fecha_estimada: fechaDePago(dev) }));
}

export function lineaDeCobro(
  dev: ConEntrega,
  etapaAlcanzada = 1,
  hitos: HitoPago[] = hitosDePago(dev),
): NodoLinea[] {
  const base: NodoLinea[] = [
    { titulo: "Referido confirmado", fecha: "Hoy", alcanzado: true, icono: "user-check" },
    { titulo: "Oferta enviada", fecha: "≈ 3 semanas", alcanzado: false, icono: "file-text" },
    { titulo: "Contrato firmado", fecha: "≈ 2 meses", alcanzado: false, icono: "pen-line" },
    {
      titulo: "Escrituración",
      fecha: fechaEscrituracion(dev),
      alcanzado: false,
      icono: "key-round",
    },
  ];
  // El nodo "Tu pago" se expande en un nodo por hito cuando hay más de uno.
  const nodosPago: NodoLinea[] = hitos.map((h) => ({
    titulo: hitos.length === 1 ? "Tu pago" : `Tu pago · ${h.concepto} (${h.porcentaje}%)`,
    fecha: h.fecha_estimada,
    alcanzado: false,
    icono: "banknote" as const,
  }));
  const nodos = [...base, ...nodosPago];
  return nodos.map((n, i) => ({ ...n, alcanzado: i < etapaAlcanzada }));
}

/**
 * INVARIANTE — SEGURIDAD: solo el renglón del usuario autenticado.
 *
 * @deprecated Ya hay fuente real: `hooks/usePortalPersonalComisiones` resuelve
 * los canales y porcentajes de la persona desde `comisiones_reglas` (la misma
 * matriz que valida Alta Dirección). Estos tres selectores quedan solo para el
 * mock; no los uses para mostrar una comisión.
 */
export function misCanales(): ComisionCanal[] {
  return MI_COMISION_POR_CANAL;
}

export function canalReferidoDirecto(): ComisionCanal | undefined {
  return MI_COMISION_POR_CANAL.find((c) => c.aplica_a_referido_directo);
}

export function canalesDeParticipacion(): ComisionCanal[] {
  return MI_COMISION_POR_CANAL.filter(
    (c) => c.aplica_a_participacion_canal && c.mi_porcentaje > 0,
  );
}

/** Monto que le corresponde a ESTE usuario por el canal indicado. */
export function montoPorCanal(precio: number, pct: number): number {
  return Math.round(precio * pct);
}

/** El porcentaje siempre acompaña al monto, nunca se presenta aislado. */
export function pctTexto(pct: number): string {
  return `${(pct * 100).toLocaleString("es-MX", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}%`;
}

export const selectores = {
  desarrollos: (): Desarrollo[] => DESARROLLOS.filter((d) => !d.auditoria.deprecado_en),

  desarrolloPorSlug: (slug: string) => DESARROLLOS.find((d) => d.slug === slug),
  desarrolloPorId: (id: string) => DESARROLLOS.find((d) => d.id === id),

  unidadesDe: (desarrolloId: string): Unidad[] =>
    UNIDADES.filter((u) => u.desarrollo_id === desarrolloId && !u.auditoria.deprecado_en),

  unidadPorId: (id: string) => UNIDADES.find((u) => u.id === id),

  esquemasDe: (unidadId: string) => ESQUEMAS_PAGO.filter((e) => e.unidad_id === unidadId),

  precioPromedio: (desarrolloId: string): number => {
    const us = UNIDADES.filter((u) => u.desarrollo_id === desarrolloId);
    if (us.length === 0) return 0;
    return Math.round(us.reduce((a, u) => a + precioTotalUnidad(u), 0) / us.length);
  },

  negociosDelColaborador: (): Negocio[] => NEGOCIOS.filter((n) => !n.auditoria.deprecado_en),

  gananciasDelColaborador: (): Ganancia[] => GANANCIAS.filter((g) => !g.auditoria.deprecado_en),

  yaCobrado: (): number =>
    GANANCIAS.filter((g) => g.estatus === "depositado").reduce((a, g) => a + g.neto, 0),

  porCobrar: (): number =>
    GANANCIAS.filter((g) => g.estatus !== "depositado").reduce((a, g) => a + g.neto, 0),

  valorAbierto: (): number =>
    NEGOCIOS.filter(
      (n) => n.etapa !== "escriturado" && n.etapa !== "cierre_perdido",
    ).reduce((a, n) => a + n.valor, 0),

  linkReferido: (u: Usuario): string => `sozu.com/r/${u.codigo_referido}`,

  pendientesDeElegibilidad: (u: Usuario): string[] => {
    const faltantes: string[] = [];
    if (u.reglas_aceptadas_version === null) faltantes.push("Aceptar las Reglas del Programa");
    if (u.conflicto_interes_firmado_en === null)
      faltantes.push("Firmar Declaración de Conflicto de Interés");
    if (!u.cuenta_bancaria_confirmada) faltantes.push("Confirmar tu cuenta bancaria");
    return faltantes;
  },
};
