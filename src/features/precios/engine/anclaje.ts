/**
 * ANCLAJE POR MODELO
 *
 * Traduce un motor con precio_base_m2 escalar y familia de factores "plano" al
 * modelo de anclaje por modelo: un precio base por m² por Modelo, una unidad
 * ancla explícita del proyecto y familias de factores renormalizadas para que
 * la categoría ancla valga exactamente 1.0000.
 *
 * Toda transformación de este archivo es matemáticamente neutral: los precios
 * calculados de cada unidad no cambian, solo cambia dónde está el cero de la
 * escala.
 */
import type {
  AnclaProyecto,
  BaseModelo,
  Modelo,
  MotorPrecio,
  Propiedad,
  TipoFactor,
  Torre,
} from "../types/dominio";
import { calcularAreaPonderada, calcularPrecio } from "./pricing";

export const FAMILIAS_ANCLADAS: TipoFactor[] = ["torre", "vista", "orientacion"];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** ¿El motor ya está en formato de anclaje por modelo? */
export function esMotorAnclado(m: unknown): boolean {
  const x = m as Partial<MotorPrecio> | null;
  return !!x && Array.isArray(x.bases_modelo) && !!x.ancla;
}

/** Categoría activa con el multiplicador más bajo de una familia. */
export function categoriaMinima(
  motor: Pick<MotorPrecio, "factores">,
  tipo: TipoFactor,
): { clave: string; valor: number } | null {
  const activos = motor.factores.filter((f) => f.activo && f.tipo_factor === tipo);
  if (activos.length === 0) return null;
  const min = activos.reduce((a, b) => (b.valor < a.valor ? b : a));
  return { clave: min.clave, valor: min.valor };
}

/** Valor actual de una categoría de una familia (1 si no existe). */
export function valorFactor(
  motor: Pick<MotorPrecio, "factores">,
  tipo: TipoFactor,
  clave: string,
): number {
  const f = motor.factores.find((x) => x.activo && x.tipo_factor === tipo && x.clave === clave);
  return f ? f.valor : 1;
}

export function describirAncla(
  ancla: Omit<AnclaProyecto, "descripcion">,
  torres: Torre[],
): string {
  const torre = torres.find((t) => t.id_torre === ancla.id_torre);
  return `Torre ${torre?.nombre ?? ancla.id_torre} · Nivel ${ancla.nivel} · Vista ${ancla.clave_vista} · Orientación ${ancla.clave_orientacion}`;
}

/**
 * Reexpresa la curva de nivel para que el nivel ancla valga exactamente 1.0000.
 *
 * f_old(n) = 1 + a(n−n0) − b(n−n0)²   con m = n1 − n0
 * k        = 1 / f_old(n1)
 * a'       = k(a − 2bm)      b' = k·b      base' = base × f_old(n1)
 *
 * De modo que f_new(n) = k · f_old(n) exactamente, para todo n.
 */
function reanclarNivel(
  nivel: { coef_a: number; coef_b: number },
  nivelViejo: number,
  nivelNuevo: number,
): { nivel: { coef_a: number; coef_b: number }; factorBase: number } {
  const m = nivelNuevo - nivelViejo;
  const { coef_a: a, coef_b: b } = nivel;
  const fAncla = 1 + a * m - b * m * m;
  if (fAncla === 0) return { nivel, factorBase: 1 };
  const k = 1 / fAncla;
  return {
    nivel: { coef_a: k * (a - 2 * b * m), coef_b: k * b },
    factorBase: fAncla,
  };
}

/**
 * Cambia el ancla de un motor ya anclado, de forma neutral: renormaliza las
 * familias contra las nuevas categorías y compensa los precios base.
 */
export function reanclarMotor(
  motor: MotorPrecio,
  nueva: Omit<AnclaProyecto, "descripcion">,
  torres: Torre[],
): MotorPrecio {
  const torreNueva = torres.find((t) => t.id_torre === nueva.id_torre);
  const claveTorre = torreNueva?.nombre ?? nueva.id_torre;

  const objetivo: Record<string, string> = {
    torre: claveTorre,
    vista: nueva.clave_vista,
    orientacion: nueva.clave_orientacion,
  };

  let compensacion = 1;
  const factores = motor.factores.map((f) => ({ ...f }));
  for (const tipo of FAMILIAS_ANCLADAS) {
    const clave = objetivo[tipo]!;
    const v = valorFactor({ factores }, tipo, clave);
    if (!v || v <= 0) continue;
    compensacion *= v;
    for (const f of factores) {
      if (f.tipo_factor === tipo) f.valor = f.valor / v;
    }
  }

  const rn = reanclarNivel(motor.nivel, motor.ancla?.nivel ?? 1, nueva.nivel);
  compensacion *= rn.factorBase;

  return {
    ...motor,
    nivel: rn.nivel,
    factores,
    // El precio base del proyecto se reexpresa igual que los de modelo: los
    // factores por modelo son razones y no cambian, así que ningún precio se
    // mueve. Dejar el base sin compensar rompería `base × factor = efectivo`.
    precio_base_m2_proyecto: (motor.precio_base_m2_proyecto ?? 0) * compensacion,
    bases_modelo: motor.bases_modelo.map((b) => ({
      ...b,
      precio_base_m2: b.precio_base_m2 * compensacion,
    })),
    ancla: { ...nueva, descripcion: describirAncla(nueva, torres) },
  };
}

export interface ResultadoMigracion {
  motor: MotorPrecio;
  ok: boolean;
  error: string | null;
  /** Máxima diferencia en pesos observada durante la verificación. */
  maxDelta: number;
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
}

export const ERROR_MIGRACION =
  "La migración al modelo de anclaje por modelo no pudo aplicarse sin alterar precios. El motor quedó en su estado anterior. Reporta este caso al equipo técnico.";

/**
 * Migra un motor en formato anterior al anclaje por modelo.
 * Si la verificación de neutralidad falla, devuelve el motor original intacto.
 */
export function migrarMotorAAnclaje(
  motorViejo: MotorPrecio,
  props: Propiedad[],
  modelos: Modelo[],
  torres: Torre[],
): ResultadoMigracion {
  const propsProyecto = props.filter(
    (p) => p.activo && p.id_proyecto === motorViejo.id_proyecto,
  );
  const torresProyecto = torres.filter((t) => t.id_proyecto === motorViejo.id_proyecto);
  const modelosProyecto = modelos.filter((m) => m.id_proyecto === motorViejo.id_proyecto);

  const baseGlobal = motorViejo.precio_base_m2 ?? 0;
  const m2refGlobal = motorViejo.tamano.m2_referencia ?? 0;
  const theta = motorViejo.tamano.theta;

  // Paso 1 — determinar el ancla a partir de lo realmente almacenado.
  const minTorre = categoriaMinima(motorViejo, "torre");
  const minVista = categoriaMinima(motorViejo, "vista");
  const minOrient = categoriaMinima(motorViejo, "orientacion");
  const nivelAncla = propsProyecto.length
    ? Math.min(...propsProyecto.map((p) => p.nivel))
    : 1;

  const torreAncla =
    torresProyecto.find((t) => t.nombre === minTorre?.clave) ?? torresProyecto[0];

  const anclaSin: Omit<AnclaProyecto, "descripcion"> = {
    id_torre: torreAncla?.id_torre ?? "",
    nivel: nivelAncla,
    clave_vista: minVista?.clave ?? "",
    clave_orientacion: minOrient?.clave ?? "",
  };
  const ancla: AnclaProyecto = {
    ...anclaSin,
    descripcion: describirAncla(anclaSin, torresProyecto),
  };

  // Paso 2 — producto del ancla.
  const vTorre = minTorre?.valor ?? 1;
  const vVista = minVista?.valor ?? 1;
  const vOrient = minOrient?.valor ?? 1;
  const productoAncla = vTorre * vVista * vOrient;

  // El nivel ancla reexpresa la curva de nivel de forma exacta.
  const rn = reanclarNivel(motorViejo.nivel, 1, nivelAncla);

  // Pasos 3 y 4 — precio base y m² de referencia por modelo.
  const bases_modelo: BaseModelo[] = modelosProyecto.map((mod) => {
    const fPlano = valorFactor(motorViejo, "plano", mod.nombre);
    const unidades = propsProyecto.filter((p) => p.id_modelo === mod.id_modelo);
    const m2ref = unidades.length
      ? r2(
          unidades.reduce((a, p) => a + calcularAreaPonderada(p, motorViejo), 0) /
            unidades.length,
        )
      : m2refGlobal;
    // Compensación de tamaño: al pasar de un m² de referencia global a uno por
    // modelo, f_tamano cambia en un factor constante por modelo. Se absorbe en
    // el precio base para que la migración sea estrictamente neutral.
    const compTamano = m2ref > 0 ? Math.pow(m2refGlobal / m2ref, theta) : 1;
    return {
      id_modelo: mod.id_modelo,
      nombre_modelo: mod.nombre,
      precio_base_m2:
        baseGlobal * fPlano * productoAncla * compTamano * rn.factorBase,
      // Se completa abajo, cuando ya se conoce el base del proyecto.
      factor_modelo: 1,
      m2_referencia: m2ref,
      activo: mod.activo,
    };
  });

  /*
   * Precio base del PROYECTO en el formato anterior: el escalar del motor,
   * reexpresado contra el ancla nueva. Cada modelo guarda su separación
   * respecto a él, que en este formato es exactamente su factor de plano.
   */
  const precio_base_m2_proyecto =
    baseGlobal * productoAncla * rn.factorBase;
  for (const b of bases_modelo) {
    b.factor_modelo =
      precio_base_m2_proyecto > 0
        ? +(b.precio_base_m2 / precio_base_m2_proyecto).toFixed(6)
        : 1;
  }

  // Pasos 5 y 6 — renormalizar familias y eliminar plano y el base global.
  const factores = motorViejo.factores
    .filter((f) => f.tipo_factor !== "plano")
    .map((f) => {
      if (f.tipo_factor === "torre") return { ...f, valor: f.valor / (vTorre || 1) };
      if (f.tipo_factor === "vista") return { ...f, valor: f.valor / (vVista || 1) };
      if (f.tipo_factor === "orientacion")
        return { ...f, valor: f.valor / (vOrient || 1) };
      return { ...f };
    });

  const nuevo: MotorPrecio = {
    ...motorViejo,
    ancla,
    precio_base_m2_proyecto,
    bases_modelo,
    nivel: rn.nivel,
    tamano: { theta },
    factores,
  };
  delete (nuevo as { precio_base_m2?: number }).precio_base_m2;

  // Paso 7 — verificación de neutralidad, unidad por unidad.
  const modelosPorId = Object.fromEntries(modelos.map((m) => [m.id_modelo, m]));
  const torresPorId = Object.fromEntries(torres.map((t) => [t.id_torre, t]));
  let maxDelta = 0;
  for (const p of propsProyecto) {
    const antes = calcularPrecio(
      p,
      modelosPorId[p.id_modelo],
      torresPorId[p.id_torre],
      motorViejo,
    ).precio_calculado;
    const despues = calcularPrecio(
      p,
      modelosPorId[p.id_modelo],
      torresPorId[p.id_torre],
      nuevo,
    ).precio_calculado;
    maxDelta = Math.max(maxDelta, Math.abs(antes - despues));
  }

  const resumen = (m: MotorPrecio) => ({
    precio_base_m2: m.precio_base_m2 ?? null,
    m2_referencia: m.tamano.m2_referencia ?? null,
    bases_modelo: (m.bases_modelo ?? []).map((b) => ({
      modelo: b.nombre_modelo,
      precio_base_m2: r2(b.precio_base_m2),
      m2_referencia: b.m2_referencia,
    })),
    ancla: m.ancla?.descripcion ?? null,
    factores: m.factores.length,
  });

  if (maxDelta > 0.01) {
    return {
      motor: motorViejo,
      ok: false,
      error: ERROR_MIGRACION,
      maxDelta,
      antes: resumen(motorViejo),
      despues: resumen(motorViejo),
    };
  }

  return {
    motor: nuevo,
    ok: true,
    error: null,
    maxDelta,
    antes: resumen(motorViejo),
    despues: resumen(nuevo),
  };
}
