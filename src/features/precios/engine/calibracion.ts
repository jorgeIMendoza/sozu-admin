/**
 * Calibración del motor de precios por mínimos cuadrados ordinarios sobre una
 * especificación log-lineal.
 *
 * IMPORTANTE: este archivo NO modifica engine/pricing.ts. La calibración sólo
 * propone valores nuevos para los parámetros del motor; la estructura de la
 * fórmula de precio es la misma.
 *
 * La regresión corre sobre el COMPONENTE EXENTO del precio:
 *   precio_exento_observado = precio_lista_actual − componente_gravado_calculado
 * porque cajones y bodega son montos aditivos y de valor conocido.
 */

import type { FactorPrecio, MotorPrecio, TipoFactor } from "../types/dominio";

export interface ObservacionCalibracion {
  id_propiedad: string;
  numero: string;
  nivel: number;
  vista: string;
  orientacion: string;
  torre: string;
  modelo: string;
  area_ponderada: number;
  precio_actual: number;
  componente_gravado: number;
}

export interface ConfigCalibracion {
  cuadratico: boolean;
  porModelo: boolean;
  excluirAtipicos: boolean;
  umbralSigma: number;
}

export const CONFIG_CALIBRACION_INICIAL: ConfigCalibracion = {
  cuadratico: true,
  porModelo: true,
  excluirAtipicos: false,
  umbralSigma: 2,
};

export interface EstadisticosCalibracion {
  r2: number;
  r2Ajustado: number;
  rmse: number;
  mape: number;
  n: number;
  k: number;
  sigmaResidual: number;
}

export interface ResidualCalibracion {
  id_propiedad: string;
  observado: number;
  predicho: number;
  residual: number;
  residualPct: number;
  sigmas: number;
}

export interface PropuestaMotor {
  precio_base_m2: number;
  coef_a: number;
  coef_b: number;
  theta: number;
  m2_referencia: number;
  factores: Array<{ tipo: TipoFactor; clave: string; valor: number; referencia: boolean }>;
}

export interface ResultadoCalibracion {
  ok: true;
  ejecutada_en: string;
  config: ConfigCalibracion;
  estadisticos: EstadisticosCalibracion;
  residuales: ResidualCalibracion[];
  referenciasOmitidas: Record<string, string>;
  propuesta: PropuestaMotor;
  betaArea: number;
}

export interface ErrorCalibracion {
  ok: false;
  mensaje: string;
}

/** Grupos de variables indicadoras estimadas por la regresión. */
const GRUPOS: Array<{
  tipo: TipoFactor;
  etiqueta: string;
  valor: (o: ObservacionCalibracion) => string;
}> = [
  { tipo: "vista", etiqueta: "Vista", valor: (o) => o.vista },
  { tipo: "orientacion", etiqueta: "Orientación", valor: (o) => o.orientacion },
  { tipo: "torre", etiqueta: "Torre", valor: (o) => o.torre },
  { tipo: "plano", etiqueta: "Plano", valor: (o) => o.modelo },
];

/**
 * Resuelve A·x = b por eliminación gaussiana con pivoteo parcial.
 * Devuelve null si el sistema es singular o está mal condicionado.
 */
export function resolverSistema(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]!]);

  for (let col = 0; col < n; col++) {
    let mejor = col;
    for (let f = col + 1; f < n; f++) {
      if (Math.abs(M[f]![col]!) > Math.abs(M[mejor]![col]!)) mejor = f;
    }
    if (Math.abs(M[mejor]![col]!) < 1e-10) return null;
    if (mejor !== col) {
      const tmp = M[col]!;
      M[col] = M[mejor]!;
      M[mejor] = tmp;
    }
    const pivote = M[col]![col]!;
    for (let f = 0; f < n; f++) {
      if (f === col) continue;
      const factor = M[f]![col]! / pivote;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[f]![c] = M[f]![c]! - factor * M[col]![c]!;
    }
  }

  return Array.from({ length: n }, (_, i) => M[i]![n]! / M[i]![i]!);
}

interface Diseno {
  X: number[][];
  y: number[];
  nombres: string[];
  referencias: Record<string, string>;
  columnasPorGrupo: Record<string, Array<{ clave: string; indice: number }>>;
  absorbidas: string[];
}

function construirDiseno(
  obs: ObservacionCalibracion[],
  cfg: ConfigCalibracion,
): Diseno {
  const nombres = ["intercepto", "ln_area", "nivel"];
  if (cfg.cuadratico) nombres.push("nivel2");

  const referencias: Record<string, string> = {};
  const columnasPorGrupo: Record<string, Array<{ clave: string; indice: number }>> = {};

  const gruposActivos = GRUPOS.filter((g) => cfg.porModelo || g.tipo !== "plano");
  const categoriasPorGrupo: Record<string, string[]> = {};

  for (const g of gruposActivos) {
    const conteo = new Map<string, number>();
    for (const o of obs) {
      const v = g.valor(o);
      conteo.set(v, (conteo.get(v) ?? 0) + 1);
    }
    const ordenadas = [...conteo.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    const ref = ordenadas[0]?.[0] ?? "";
    referencias[g.tipo] = ref;
    const resto = ordenadas.map(([c]) => c).filter((c) => c !== ref);
    categoriasPorGrupo[g.tipo] = resto;
    columnasPorGrupo[g.tipo] = resto.map((clave) => {
      nombres.push(`${g.tipo}:${clave}`);
      return { clave, indice: nombres.length - 1 };
    });
  }

  const X = obs.map((o) => {
    const fila: number[] = [1, Math.log(o.area_ponderada), o.nivel - 1];
    if (cfg.cuadratico) fila.push((o.nivel - 1) * (o.nivel - 1));
    for (const g of gruposActivos) {
      const v = g.valor(o);
      for (const c of categoriasPorGrupo[g.tipo]!) fila.push(v === c ? 1 : 0);
    }
    return fila;
  });

  const y = obs.map((o) => o.precio_actual - o.componente_gravado);

  // Algunas variables del inventario son redundantes entre sí (por ejemplo,
  // vista y orientación pueden coincidir unidad por unidad). Sin depurarlas el
  // sistema normal es singular, así que se descartan las columnas que no
  // aportan información nueva y se reportan como absorbidas.
  const { X: Xdep, mapa, descartadas } = depurarColumnas(X, nombres);
  const absorbidas: string[] = descartadas.map((i) => nombres[i]!);
  const columnasDepuradas: Diseno["columnasPorGrupo"] = {};
  for (const [grupo, cols] of Object.entries(columnasPorGrupo)) {
    columnasDepuradas[grupo] = cols
      .filter((c) => mapa.has(c.indice))
      .map((c) => ({ clave: c.clave, indice: mapa.get(c.indice)! }));
  }

  return {
    X: Xdep,
    y,
    nombres: nombres.filter((_, i) => mapa.has(i)),
    referencias,
    columnasPorGrupo: columnasDepuradas,
    absorbidas,
  };
}

/**
 * Elimina columnas linealmente dependientes por Gram-Schmidt modificado.
 * Devuelve la matriz depurada y el mapa de índice original -> índice nuevo.
 */
function depurarColumnas(
  X: number[][],
  nombres: string[],
): { X: number[][]; mapa: Map<number, number>; descartadas: number[] } {
  const k = nombres.length;
  const n = X.length;
  const base: number[][] = [];
  const mapa = new Map<number, number>();
  const descartadas: number[] = [];
  const conservadas: number[] = [];

  for (let c = 0; c < k; c++) {
    const col = X.map((f) => f[c]!);
    const norma0 = Math.sqrt(col.reduce((s, v) => s + v * v, 0));
    let resto = col.slice();
    for (const q of base) {
      const dot = resto.reduce((s, v, i) => s + v * q[i]!, 0);
      for (let i = 0; i < n; i++) resto[i] = resto[i]! - dot * q[i]!;
    }
    const norma = Math.sqrt(resto.reduce((s, v) => s + v * v, 0));
    if (norma0 === 0 || norma / norma0 < 1e-8) {
      descartadas.push(c);
      continue;
    }
    resto = resto.map((v) => v / norma);
    base.push(resto);
    mapa.set(c, conservadas.length);
    conservadas.push(c);
  }

  return {
    X: X.map((f) => conservadas.map((c) => f[c]!)),
    mapa,
    descartadas,
  };
}

function estimar(
  obs: ObservacionCalibracion[],
  cfg: ConfigCalibracion,
): { beta: number[]; diseno: Diseno; est: EstadisticosCalibracion; residuales: ResidualCalibracion[] } | null {
  const diseno = construirDiseno(obs, cfg);
  const { X, y } = diseno;
  const n = X.length;
  const k = X[0]?.length ?? 0;
  if (n <= k + 1) return null;

  const lnY = y.map((v) => Math.log(v));

  const XtX: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const Xty = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    const fila = X[i]!;
    for (let a = 0; a < k; a++) {
      const va = fila[a]!;
      if (va !== 0) {
        Xty[a] = Xty[a]! + va * lnY[i]!;
        for (let b = a; b < k; b++) XtX[a]![b] = XtX[a]![b]! + va * fila[b]!;
      }
    }
  }
  for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) XtX[a]![b] = XtX[b]![a]!;

  const beta = resolverSistema(XtX, Xty);
  if (!beta) return null;

  const mediaLnY = lnY.reduce((s, v) => s + v, 0) / n;
  let ssr = 0;
  let sst = 0;
  let sumaErrCuad = 0;
  let sumaAbsPct = 0;
  const residualesLog: number[] = [];
  const predichos: number[] = [];

  for (let i = 0; i < n; i++) {
    const fila = X[i]!;
    let yhat = 0;
    for (let a = 0; a < k; a++) yhat += fila[a]! * beta[a]!;
    const r = lnY[i]! - yhat;
    residualesLog.push(r);
    predichos.push(Math.exp(yhat));
    ssr += r * r;
    sst += (lnY[i]! - mediaLnY) ** 2;
    const errPesos = Math.exp(yhat) - y[i]!;
    sumaErrCuad += errPesos * errPesos;
    sumaAbsPct += Math.abs(errPesos) / y[i]!;
  }

  const r2 = sst > 0 ? 1 - ssr / sst : 0;
  const gradosLibres = k - 1;
  const r2Ajustado =
    n - gradosLibres - 1 > 0 ? 1 - (1 - r2) * ((n - 1) / (n - gradosLibres - 1)) : r2;
  const sigma = Math.sqrt(ssr / n);

  const residuales: ResidualCalibracion[] = obs.map((o, i) => ({
    id_propiedad: o.id_propiedad,
    observado: y[i]!,
    predicho: predichos[i]!,
    residual: y[i]! - predichos[i]!,
    residualPct: ((y[i]! - predichos[i]!) / predichos[i]!) * 100,
    sigmas: sigma > 0 ? residualesLog[i]! / sigma : 0,
  }));

  return {
    beta,
    diseno,
    residuales,
    est: {
      r2,
      r2Ajustado,
      rmse: Math.sqrt(sumaErrCuad / n),
      mape: (sumaAbsPct / n) * 100,
      n,
      k: gradosLibres,
      sigmaResidual: sigma,
    },
  };
}

function construirPropuesta(
  beta: number[],
  diseno: Diseno,
  cfg: ConfigCalibracion,
  motor: MotorPrecio,
): PropuestaMotor {
  const b0 = beta[0]!;
  const b1 = beta[1]!;
  const b2 = beta[2]!;
  const b3 = cfg.cuadratico ? beta[3]! : 0;

  const bases = motor.bases_modelo ?? [];
  const m2ref =
    motor.tamano.m2_referencia ??
    (bases.length ? bases.reduce((a, b) => a + b.m2_referencia, 0) / bases.length : 1);
  // El motor reproduce la unidad de referencia como precio_base_m2 × m2_referencia.
  const precio_base_m2 = Math.exp(b0 + b1 * Math.log(m2ref)) / m2ref;

  const factores: PropuestaMotor["factores"] = [];
  for (const g of GRUPOS) {
    const columnas = diseno.columnasPorGrupo[g.tipo];
    if (!columnas) continue;
    const ref = diseno.referencias[g.tipo];
    if (ref) factores.push({ tipo: g.tipo, clave: ref, valor: 1, referencia: true });
    for (const c of columnas) {
      factores.push({
        tipo: g.tipo,
        clave: c.clave,
        valor: Math.exp(beta[c.indice]!),
        referencia: false,
      });
    }
  }

  return {
    precio_base_m2,
    coef_a: b2,
    coef_b: -b3,
    theta: 1 - b1,
    m2_referencia: m2ref,
    factores,
  };
}

/**
 * Corre la calibración completa. Devuelve un error legible si el sistema no
 * puede resolverse.
 */
export function calibrar(
  observaciones: ObservacionCalibracion[],
  cfg: ConfigCalibracion,
  motor: MotorPrecio,
  excluidas: string[] = [],
): ResultadoCalibracion | ErrorCalibracion {
  const base = observaciones.filter(
    (o) =>
      o.precio_actual > 0 &&
      o.precio_actual - o.componente_gravado > 0 &&
      o.area_ponderada > 0 &&
      !excluidas.includes(o.id_propiedad),
  );

  const errorGenerico: ErrorCalibracion = {
    ok: false,
    mensaje:
      "La calibración no pudo resolverse: hay variables perfectamente correlacionadas o insuficientes observaciones. Revisa la variedad del inventario.",
  };

  let usadas = base;
  let salida = estimar(usadas, cfg);
  if (!salida) return errorGenerico;

  if (cfg.excluirAtipicos) {
    const fuera = new Set(
      salida.residuales
        .filter((r) => Math.abs(r.sigmas) > cfg.umbralSigma)
        .map((r) => r.id_propiedad),
    );
    if (fuera.size > 0 && usadas.length - fuera.size > 10) {
      usadas = base.filter((o) => !fuera.has(o.id_propiedad));
      const segunda = estimar(usadas, cfg);
      if (!segunda) return errorGenerico;
      salida = segunda;
    }
  }

  return {
    ok: true,
    ejecutada_en: new Date().toISOString(),
    config: cfg,
    estadisticos: salida.est,
    residuales: salida.residuales,
    referenciasOmitidas: {
      ...salida.diseno.referencias,
      ...(salida.diseno.absorbidas.length
        ? {
            "variables redundantes absorbidas":
              salida.diseno.absorbidas.join(", "),
          }
        : {}),
    },
    propuesta: construirPropuesta(salida.beta, salida.diseno, cfg, motor),
    betaArea: salida.beta[1]!,
  };
}

/** Aplica una propuesta (o parte de ella) sobre una copia del motor. */
export function aplicarPropuesta(
  motor: MotorPrecio,
  propuesta: PropuestaMotor,
  solo?: { parametro: string },
): MotorPrecio {
  const copia: MotorPrecio = structuredClone(motor);
  const todo = !solo;

  if (todo || solo?.parametro === "precio_base_m2")
    copia.precio_base_m2 = propuesta.precio_base_m2;
  if (todo || solo?.parametro === "coef_a") copia.nivel = { ...copia.nivel, coef_a: propuesta.coef_a };
  if (todo || solo?.parametro === "coef_b") copia.nivel = { ...copia.nivel, coef_b: propuesta.coef_b };
  if (todo || solo?.parametro === "theta")
    copia.tamano = { ...copia.tamano, theta: propuesta.theta };

  for (const f of propuesta.factores) {
    const clave = `${f.tipo}:${f.clave}`;
    if (!todo && solo?.parametro !== clave) continue;
    const existente = copia.factores.find(
      (x) => x.tipo_factor === f.tipo && x.clave === f.clave,
    );
    if (existente) {
      existente.valor = f.valor;
      existente.activo = true;
    } else {
      const nuevo: FactorPrecio = {
        id_factor: `cal-${f.tipo}-${f.clave.toLowerCase().replace(/\s+/g, "-")}`,
        tipo_factor: f.tipo,
        clave: f.clave,
        etiqueta: f.clave,
        valor: f.valor,
        activo: true,
      };
      copia.factores.push(nuevo);
    }
  }

  return copia;
}

export interface FilaCoeficiente {
  bloque: string;
  parametro: string;
  etiqueta: string;
  actual: number;
  propuesto: number;
  formato: "moneda" | "multiplicador" | "coeficiente";
  referencia?: boolean;
}

const ETIQUETA_BLOQUE: Record<string, string> = {
  torre: "Factores de torre",
  vista: "Factores de vista",
  orientacion: "Factores de orientación",
  plano: "Factores de plano",
};

/** Construye las filas comparativas actual vs. propuesto (sin impacto). */
export function construirFilasCoeficientes(
  motor: MotorPrecio,
  propuesta: PropuestaMotor,
): FilaCoeficiente[] {
  const filas: FilaCoeficiente[] = [
    {
      bloque: "Parámetros base",
      parametro: "precio_base_m2",
      etiqueta: "Precio base por m²",
      actual:
        motor.precio_base_m2 ??
        (motor.bases_modelo?.length
          ? motor.bases_modelo.reduce((a, b) => a + b.precio_base_m2, 0) /
            motor.bases_modelo.length
          : 0),
      propuesto: propuesta.precio_base_m2,
      formato: "moneda",
    },
    {
      bloque: "Curva de nivel",
      parametro: "coef_a",
      etiqueta: "Pendiente por piso (a)",
      actual: motor.nivel.coef_a,
      propuesto: propuesta.coef_a,
      formato: "coeficiente",
    },
    {
      bloque: "Curva de nivel",
      parametro: "coef_b",
      etiqueta: "Amortiguamiento (b)",
      actual: motor.nivel.coef_b,
      propuesto: propuesta.coef_b,
      formato: "coeficiente",
    },
    {
      bloque: "Curva de tamaño",
      parametro: "theta",
      etiqueta: "Theta (θ)",
      actual: motor.tamano.theta,
      propuesto: propuesta.theta,
      formato: "coeficiente",
    },
  ];

  for (const tipo of ["torre", "vista", "orientacion", "plano"] as TipoFactor[]) {
    const delTipo = propuesta.factores.filter((f) => f.tipo === tipo);
    for (const f of delTipo) {
      const actual =
        motor.factores.find((x) => x.activo && x.tipo_factor === tipo && x.clave === f.clave)
          ?.valor ?? 1;
      filas.push({
        bloque: ETIQUETA_BLOQUE[tipo]!,
        parametro: `${tipo}:${f.clave}`,
        etiqueta: `${ETIQUETA_BLOQUE[tipo]!.replace("Factores de ", "Factor ")} · ${f.clave}`,
        actual,
        propuesto: f.valor,
        formato: "multiplicador",
        referencia: f.referencia,
      });
    }
  }

  return filas;
}
