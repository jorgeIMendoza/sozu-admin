/**
 * Motor de valor presente de esquemas de financiamiento.
 * Funciones puras: no importa React, Zustand ni componentes.
 * El valor presente NO altera el precio de lista; produce factores y precios
 * nominales equivalentes por esquema.
 */
import type {
  AdvertenciaEsquema,
  EsquemaFinanciamiento,
  FlujoMensual,
  Torre,
  TramoEscalonado,
  ResultadoVPN,
} from "../types/dominio";

/**
 * Convierte una tasa anual efectiva en tasa mensual equivalente.
 * Fórmula: tasa_mensual = (1 + tasa_anual)^(1/12) − 1
 * Conversión geométrica, nunca división entre 12.
 */
export function tasaMensual(tasaAnual: number): number {
  return Math.pow(1 + tasaAnual, 1 / 12) - 1;
}

/**
 * Meses entre hoy y la fecha de entrega estimada de la torre, redondeado
 * hacia arriba, más la holgura de entrega configurada en el motor.
 * horizonte = ceil(meses(hoy, entrega)) + holgura
 */
export function horizonteMeses(
  fechaEntrega: string,
  holgura: number,
  desde: Date = new Date(),
): number {
  const fin = new Date(fechaEntrega);
  const meses =
    (fin.getFullYear() - desde.getFullYear()) * 12 +
    (fin.getMonth() - desde.getMonth()) +
    (fin.getDate() - desde.getDate()) / 30.4375;
  return Math.max(0, Math.ceil(meses)) + (holgura || 0);
}

/**
 * Horizonte del calendario de un esquema.
 * Preventa: el horizonte de la torre. Post-entrega: su propio plazo, porque el
 * inmueble ya está terminado y no existe pago contra entrega.
 */
export function horizonteEfectivo(
  esquema: EsquemaFinanciamiento,
  horizonteTorre: number,
): number {
  if (esquema.tipo_esquema === "post_entrega") {
    return Math.max(
      0,
      Math.round(esquema.mes_inicio_mensualidades || 0) +
        Math.max(0, Math.round(esquema.num_mensualidades || 0)),
    );
  }
  return horizonteTorre;
}

/**
 * Construye el calendario de flujos como proporciones del precio (0 a 1).
 * Enganche en partes iguales de los meses 0..meses_enganche−1; mensualidades
 * desde mes_inicio_mensualidades; entrega en el mes del horizonte.
 * Al final normaliza en el pago de entrega para que la suma sea exactamente 1.
 */
export function construirFlujos(
  esquema: EsquemaFinanciamiento,
  horizonte: number,
): FlujoMensual[] {
  const flujos: FlujoMensual[] = [];

  const mesesEnganche = Math.max(1, Math.round(esquema.meses_enganche || 1));
  if (esquema.pct_enganche > 0) {
    const parte = esquema.pct_enganche / mesesEnganche;
    for (let m = 0; m < mesesEnganche; m++) {
      flujos.push({ mes: m, pct: parte, concepto: "enganche" });
    }
  }

  const n = Math.max(0, Math.round(esquema.num_mensualidades || 0));
  if (n > 0 && esquema.pct_mensualidades > 0) {
    const inicio = Math.max(0, Math.round(esquema.mes_inicio_mensualidades || 0));
    const pesos = pesosMensualidades(esquema, n);
    for (let i = 0; i < n; i++) {
      flujos.push({
        mes: inicio + i,
        pct: esquema.pct_mensualidades * pesos[i]!,
        concepto: "mensualidad",
      });
    }
  }

  const suma = flujos.reduce((a, f) => a + f.pct, 0);
  const entrega = 1 - suma;
  if (esquema.pct_entrega > 0 || Math.abs(entrega) > 1e-9) {
    flujos.push({
      mes: horizonte,
      pct: esquema.pct_entrega > 0 ? entrega : esquema.pct_entrega,
      concepto: "entrega",
    });
  }

  return flujos.sort((a, b) => a.mes - b.mes);
}

/**
 * Pesos relativos de cada mensualidad (suman 1) según el escalonamiento.
 * Lineal: peso_i ∝ (1 + g)^(i−1). Tramos: tres bloques parejos con peso propio.
 */
function pesosMensualidades(esquema: EsquemaFinanciamiento, n: number): number[] {
  if (!esquema.escalonadas) return Array.from({ length: n }, () => 1 / n);

  if (esquema.modo_escalonamiento === "lineal") {
    const g = esquema.factor_crecimiento ?? 0;
    const crudos = Array.from({ length: n }, (_, i) => Math.pow(1 + g, i));
    const total = crudos.reduce((a, v) => a + v, 0);
    return crudos.map((v) => v / total);
  }

  // Tramos: tres bloques consecutivos lo más parejos posible.
  const pesosTramo = (esquema.tramos ?? []).map((t: TramoEscalonado) => t.peso);
  const tres = [pesosTramo[0] ?? 1 / 3, pesosTramo[1] ?? 1 / 3, pesosTramo[2] ?? 1 / 3];
  const sumaPesos = tres.reduce((a, v) => a + v, 0) || 1;
  const tamanos = repartirBloques(n);
  const salida: number[] = [];
  for (let k = 0; k < 3; k++) {
    const cuantos = tamanos[k]!;
    if (cuantos === 0) continue;
    const porMes = tres[k]! / sumaPesos / cuantos;
    for (let i = 0; i < cuantos; i++) salida.push(porMes);
  }
  return salida;
}

/** Divide n mensualidades en tres bloques consecutivos de tamaño parejo. */
export function repartirBloques(n: number): [number, number, number] {
  const base = Math.floor(n / 3);
  const resto = n % 3;
  return [base + (resto > 0 ? 1 : 0), base + (resto > 1 ? 1 : 0), base];
}

/**
 * Aplica un precio concreto a un calendario: monto, factor de descuento y
 * valor presente por flujo. valor_presente = monto / (1 + i)^t
 */
export function aplicarPrecio(
  flujos: FlujoMensual[],
  precio: number,
  tasa: number,
): FlujoMensual[] {
  return flujos.map((f) => {
    const factor = 1 / Math.pow(1 + tasa, f.mes);
    const monto = precio * f.pct;
    return { ...f, monto, factor_descuento: factor, valor_presente: monto * factor };
  });
}

/**
 * Precio nominal que iguala el valor presente del esquema base.
 * precio_equivalente = precio_lista × (factor_base / factor_esquema)
 */
export function precioNominalEquivalente(
  precioLista: number,
  factorBase: number,
  factorEsquema: number,
): number {
  if (factorEsquema <= 0) return precioLista;
  return precioLista * (factorBase / factorEsquema);
}

/**
 * Calcula el resultado completo de valor presente de un esquema.
 * factor_vpn = Σ pct(t) / (1 + i)^t
 * ajuste_equivalente = (factor_base / factor_esquema) − 1
 * brecha_politica = pct_ajuste_manual − ajuste_equivalente
 * descuento_max_autorizable = 1 − (vpn_objetivo / factor_esquema)
 */
export function calcularVPN(
  esquema: EsquemaFinanciamiento,
  horizonte: number,
  tasaAnual: number,
  esquemaBase: EsquemaFinanciamiento | null,
  vpnObjetivo: number | null,
  contexto?: { nombreTorre?: string | undefined; horizonteMinimo?: number | undefined },
): ResultadoVPN {
  const i = tasaMensual(tasaAnual);
  const flujosBase = construirFlujos(esquema, horizonte);
  const flujos = aplicarPrecio(flujosBase, 1, i);

  const factor_vpn = flujos.reduce((a, f) => a + (f.valor_presente ?? 0), 0);
  const factor_vpn_con_ajuste = factor_vpn * (1 + esquema.pct_ajuste_manual);
  const plazo_promedio_ponderado = flujos.reduce((a, f) => a + f.mes * f.pct, 0);

  const factorBase = esquemaBase
    ? esquemaBase.id_esquema === esquema.id_esquema
      ? factor_vpn
      : construirFlujos(esquemaBase, horizonte)
          .map((f) => f.pct / Math.pow(1 + i, f.mes))
          .reduce((a, v) => a + v, 0)
    : null;

  const ajuste_equivalente =
    factorBase !== null && factor_vpn > 0 ? factorBase / factor_vpn - 1 : 0;
  const brecha_politica = esquema.pct_ajuste_manual - ajuste_equivalente;

  const objetivo = vpnObjetivo ?? factorBase ?? factor_vpn;
  const descuento_max_autorizable = factor_vpn > 0 ? 1 - objetivo / factor_vpn : 0;

  const advertencias = validar(esquema, horizonte, {
    brecha_politica,
    descuento_max_autorizable,
    hayBase: Boolean(esquemaBase),
    nombreTorre: contexto?.nombreTorre,
    horizonteMinimo: contexto?.horizonteMinimo ?? horizonte,
    ajuste_equivalente,
  });

  return {
    id_esquema: esquema.id_esquema,
    horizonte_meses: horizonte,
    tasa_mensual: i,
    flujos,
    factor_vpn,
    factor_vpn_con_ajuste,
    plazo_promedio_ponderado,
    ajuste_equivalente,
    brecha_politica,
    descuento_max_autorizable,
    advertencias,
  };
}

const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;

/** Genera las advertencias de calidad y política del esquema. */
function validar(
  e: EsquemaFinanciamiento,
  horizonte: number,
  ctx: {
    brecha_politica: number;
    descuento_max_autorizable: number;
    hayBase: boolean;
    nombreTorre?: string | undefined;
    horizonteMinimo: number;
    ajuste_equivalente: number;
  },
): AdvertenciaEsquema[] {
  const av: AdvertenciaEsquema[] = [];
  const suma = e.pct_enganche + e.pct_mensualidades + e.pct_entrega;

  if (Math.abs(suma - 1) > 0.0001) {
    av.push({
      codigo: "SUMA_INVALIDA",
      severidad: "critica",
      mensaje: `Los porcentajes del esquema suman ${pct(suma)} en lugar de 100%.`,
    });
  }

  const fin = e.mes_inicio_mensualidades + e.num_mensualidades;
  if (e.tipo_esquema !== "post_entrega") {
    const margen = ctx.horizonteMinimo - fin;
    if (margen < 0) {
      av.push({
        codigo: "PLAZO_INEJECUTABLE",
        severidad: "critica",
        mensaje: `El esquema requiere ${e.num_mensualidades} mensualidades pero solo faltan ${ctx.horizonteMinimo} meses para la entrega estimada de la torre ${ctx.nombreTorre ?? "más próxima"}. Un comprador que firme hoy no puede completar este calendario.`,
      });
    } else if (margen <= 2) {
      av.push({
        codigo: "PLAZO_POR_VENCER",
        severidad: "advertencia",
        mensaje: `Este esquema deja de ser ejecutable en ${margen} ${margen === 1 ? "mes" : "meses"}. Con el horizonte actual de la torre ${ctx.nombreTorre ?? "más próxima"} quedan ${margen} ${margen === 1 ? "mes" : "meses"} de margen.`,
      });
    }
  }

  if (e.tipo_esquema === "post_entrega" && e.pct_entrega > 0) {
    av.push({
      codigo: "POST_ENTREGA_CON_ENTREGA",
      severidad: "critica",
      mensaje:
        "Un esquema post-entrega no puede tener pago contra entrega: el inmueble ya está terminado.",
    });
  }

  if (
    (e.num_mensualidades > 0 && e.pct_mensualidades === 0) ||
    (e.num_mensualidades === 0 && e.pct_mensualidades > 0)
  ) {
    av.push({
      codigo: "MENSUALIDADES_SIN_PORCENTAJE",
      severidad: "advertencia",
      mensaje:
        "El esquema define mensualidades sin porcentaje asignado, o porcentaje de mensualidades sin número de pagos.",
    });
  }

  if (!e.es_base && Math.abs(ctx.brecha_politica) * 100 > 1.5) {
    av.push({
      codigo: "BRECHA_POLITICA_ALTA",
      severidad: "advertencia",
      mensaje: `El ajuste aplicado es de ${pct(e.pct_ajuste_manual)} pero el valor presente justifica ${pct(ctx.ajuste_equivalente)}. Diferencia de ${(ctx.brecha_politica * 100).toFixed(2)} puntos.`,
    });
  }

  if (
    e.pct_ajuste_manual < 0 &&
    e.pct_ajuste_manual < -ctx.descuento_max_autorizable - 1e-9
  ) {
    av.push({
      codigo: "SOBREDESCUENTO",
      severidad: "critica",
      mensaje: `El descuento de ${pct(Math.abs(e.pct_ajuste_manual))} excede el máximo autorizable de ${pct(Math.max(0, ctx.descuento_max_autorizable))} para este esquema. Cada venta bajo este esquema destruye valor presente respecto al objetivo.`,
    });
  }

  if (!ctx.hayBase) {
    av.push({
      codigo: "SIN_ESQUEMA_BASE",
      severidad: "critica",
      mensaje:
        "El proyecto no tiene exactamente un esquema marcado como base. Los ajustes equivalentes no pueden calcularse.",
    });
  }

  if (e.escalonadas && e.modo_escalonamiento === "tramos") {
    const s = (e.tramos ?? []).reduce((a: number, t: TramoEscalonado) => a + t.peso, 0);
    if (Math.abs(s - 1) > 0.0001) {
      av.push({
        codigo: "TRAMOS_INVALIDOS",
        severidad: "advertencia",
        mensaje: `Los pesos de los tramos suman ${pct(s)} en lugar de 100%.`,
      });
    }
  }

  return av;
}

/** Suma de flujos descontados de un esquema, como factor puro. */
function factorDe(
  esquema: EsquemaFinanciamiento,
  horizonte: number,
  i: number,
): number {
  return construirFlujos(esquema, horizonte)
    .map((f) => f.pct / Math.pow(1 + i, f.mes))
    .reduce((a, v) => a + v, 0);
}

/**
 * Valor presente de un esquema evaluado torre por torre.
 * El factor base usado para el ajuste equivalente es el del esquema base en
 * esa misma torre: peras con peras.
 */
export function calcularVPNPorTorre(
  esquema: EsquemaFinanciamiento,
  torres: Torre[],
  tasaAnual: number,
  holgura: number,
  esquemaBase: EsquemaFinanciamiento | null,
  vpnObjetivo: number | null,
  desde: Date = new Date(),
): Record<string, ResultadoVPN> {
  const salida: Record<string, ResultadoVPN> = {};
  for (const t of torres) {
    const hTorre = horizonteMeses(t.fecha_entrega_estimada, holgura, desde);
    const h = horizonteEfectivo(esquema, hTorre);
    salida[t.id_torre] = calcularVPN(esquema, h, tasaAnual, esquemaBase, vpnObjetivo, {
      nombreTorre: t.nombre,
      horizonteMinimo: hTorre,
    });
  }
  return salida;
}

/**
 * Factor de VPN ponderado del proyecto: promedio por número de unidades
 * disponibles de cada torre, nunca promedio simple. Solo se ponderan las
 * torres donde el esquema es ejecutable.
 */
export function factorPonderado(
  porTorre: Record<string, ResultadoVPN>,
  unidadesPorTorre: Record<string, number>,
): { factor: number; torresConsideradas: string[]; parcial: boolean } {
  const ids = Object.keys(porTorre);
  const validos = ids.filter((id) => !esInejecutable(porTorre[id]));
  const usados = validos.length > 0 ? validos : ids;
  let peso = 0;
  let acum = 0;
  for (const id of usados) {
    const w = Math.max(0, unidadesPorTorre[id] ?? 0) || 1;
    peso += w;
    acum += w * porTorre[id]!.factor_vpn;
  }
  return {
    factor: peso > 0 ? acum / peso : 0,
    torresConsideradas: usados,
    parcial: usados.length !== ids.length,
  };
}

/**
 * Códigos que hacen que el calendario del esquema sea internamente incoherente
 * y, por tanto, comercialmente inaplicable.
 */
export const CODIGOS_INEJECUTABLE = ["PLAZO_INEJECUTABLE", "POST_ENTREGA_CON_ENTREGA"];

/** El calendario del esquema no puede ejecutarse con el horizonte vigente. */
export function esInejecutable(r: ResultadoVPN | undefined): boolean {
  return Boolean(r?.advertencias.some((a) => CODIGOS_INEJECUTABLE.includes(a.codigo)));
}

/** Motivo textual de la advertencia que vuelve inejecutable al esquema. */
export function motivoCritico(r: ResultadoVPN | undefined): string {
  return (
    r?.advertencias.find((a) => CODIGOS_INEJECUTABLE.includes(a.codigo))?.mensaje ?? ""
  );
}

export { factorDe };
