import type {
  AnclaProyecto,
  BaseModelo,
  FactorPrecio,
  Modelo,
  MotorPrecio,
  Propiedad,
  Torre,
} from "../types/dominio";
import { calcularAreaPonderada } from "./pricing";
import { describirAncla } from "./anclaje";
import { SIN_ORIENTACION } from "../services/inventarioReal";

/**
 * MOTOR SEMILLA DERIVADO DEL INVENTARIO REAL
 *
 * Antes cada proyecto traía un motor escrito a mano en el mock. Con inventario
 * real eso no escala: los desarrollos se dan de alta en Inventarios y el módulo
 * de Precios tiene que poder arrancar sobre cualquiera de ellos.
 *
 * La semilla se construye **desde los precios de lista capturados**, y sale
 * deliberadamente en su estado más neutral:
 *
 *   - Curva de nivel plana (`coef_a = coef_b = 0`) y tamaño plano (`theta = 0`).
 *   - Todas las familias de factores en 1.0000 y los extras en 0.
 *   - Un `precio_base_m2` por modelo = precio por m² ponderado real del modelo.
 *
 * Así el motor arranca reproduciendo el promedio real de cada modelo y sin
 * afirmar ninguna estructura de precios que nadie ha decidido todavía. Poner
 * curvas inventadas de arranque sería peor que no ponerlas: se leerían como una
 * política vigente. Estimar esas curvas es justamente el trabajo de Calibración.
 *
 * Por eso el motor nace `sin_calibrar` y su lista nace en **borrador**: no es
 * una lista de precios, es el punto de partida para construirla.
 */

/** Ponderación del área exterior y del loft dentro del área ponderada. */
const K_EXT = 0.35;
const K_LOFT = 0.65;

/** Tasa de descuento anual de referencia para el VPN de los esquemas. */
const TASA_DESCUENTO_ANUAL = 0.14;

/** Días que una cotización permanece vigente. */
const VIGENCIA_OFERTA_DIAS = 15;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function idFactor(tipo: string, clave: string): string {
  const limpia = clave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `sem-${tipo}-${limpia || "sin-clave"}`;
}

function factor(
  tipo: FactorPrecio["tipo_factor"],
  clave: string,
  valor: number,
): FactorPrecio {
  return {
    id_factor: idFactor(tipo, clave),
    tipo_factor: tipo,
    clave,
    etiqueta: clave,
    valor,
    activo: true,
  };
}

/**
 * Motor neutro para el intervalo en que todavía no hay uno sembrado.
 *
 * Con datos por red hay renders antes de que el inventario llegue. Devolver
 * `null` obligaría a cada pantalla del módulo a defenderse, y basta con que una
 * lo olvide para que la sección reviente. Este motor calcula 0 en todo, que es
 * lo correcto cuando no hay nada que calcular; `usePreciosProyecto` expone
 * además `motorListo` para distinguirlo de un motor real.
 */
export const MOTOR_VACIO: MotorPrecio = {
  id_motor: "motor-vacio",
  id_proyecto: "",
  nombre: "Sin motor",
  ancla: {
    id_torre: "",
    nivel: 1,
    clave_vista: "",
    clave_orientacion: SIN_ORIENTACION,
    descripcion: "Sin ancla definida",
  },
  bases_modelo: [],
  k_ext: K_EXT,
  k_loft: K_LOFT,
  nivel: { coef_a: 0, coef_b: 0 },
  tamano: { theta: 0 },
  precio_cajon: 0,
  factor_cajon_tandem: 0.65,
  precio_m2_bodega: 0,
  factores: [],
  tasa_descuento_anual: TASA_DESCUENTO_ANUAL,
  activo: false,
  actualizado_en: "",
  estado_calibracion: "sin_calibrar",
  fecha_calibracion: null,
  meses_holgura_entrega: 0,
  vpn_objetivo_factor: null,
  vigencia_oferta_dias: VIGENCIA_OFERTA_DIAS,
};

export interface ResultadoSemilla {
  motor: MotorPrecio;
  /** Modelos sin ninguna unidad con precio de lista: su base quedó en 0. */
  modelosSinPrecio: string[];
  /** Unidades sin precio de lista capturado, que no aportaron a ninguna base. */
  unidadesSinPrecio: number;
}

/**
 * Construye el motor semilla de un proyecto a partir de su inventario real.
 *
 * `precio_base_m2` de cada modelo es el precio por m² ponderado del propio
 * modelo: `Σ precio_lista / Σ área ponderada` sobre sus unidades con precio.
 * Se usa la suma de razones y no el promedio de los precios por m² unidad a
 * unidad porque este último sobrepondera a las unidades chicas, que son las que
 * más se desvían.
 *
 * Los conceptos gravados (cajón y bodega) arrancan en 0: el inventario registra
 * cuántos cajones y cuántos m² de bodega tiene cada unidad, pero no cuánto vale
 * cada uno. Mientras no se capturen, su valor viaja dentro del precio por m² y
 * el desglose exento/gravado no está listo para facturar. Es parte de lo que
 * falta para que el borrador pueda publicarse.
 */
export function construirMotorSemilla(
  idProyecto: string,
  nombreProyecto: string,
  torres: Torre[],
  modelos: Modelo[],
  propiedades: Propiedad[],
): ResultadoSemilla {
  const activas = propiedades.filter((p) => p.activo);

  // El ancla es la combinación de menor valor del proyecto. Con todas las
  // familias en 1.0000 ninguna categoría domina, así que se elige el nivel más
  // bajo del inventario y la primera torre: es la referencia más estable y la
  // que un reanclaje posterior puede mover sin alterar ningún precio.
  const nivelAncla = activas.length ? Math.min(...activas.map((p) => p.nivel)) : 1;
  const torreAncla = torres[0];

  const vistasUsadas = Array.from(
    new Set(activas.map((p) => p.vista).filter((v) => v !== "")),
  ).sort();

  const anclaSin: Omit<AnclaProyecto, "descripcion"> = {
    id_torre: torreAncla?.id_torre ?? "",
    nivel: nivelAncla,
    clave_vista: vistasUsadas[0] ?? "",
    clave_orientacion: SIN_ORIENTACION,
  };
  const ancla: AnclaProyecto = {
    ...anclaSin,
    descripcion: describirAncla(anclaSin, torres),
  };

  const motorBase = {
    k_ext: K_EXT,
    k_loft: K_LOFT,
  } as MotorPrecio;

  const modelosSinPrecio: string[] = [];
  let unidadesSinPrecio = 0;

  const bases_modelo: BaseModelo[] = modelos.map((mod) => {
    const unidades = activas.filter((p) => p.id_modelo === mod.id_modelo);
    const areas = unidades.map((p) => calcularAreaPonderada(p, motorBase));

    const m2_referencia = areas.length
      ? r2(areas.reduce((a, b) => a + b, 0) / areas.length)
      : 0;

    let sumaPrecio = 0;
    let sumaArea = 0;
    for (let i = 0; i < unidades.length; i++) {
      const precio = unidades[i]!.precio_lista_actual;
      const area = areas[i]!;
      if (precio > 0 && area > 0) {
        sumaPrecio += precio;
        sumaArea += area;
      }
    }

    if (sumaArea === 0) modelosSinPrecio.push(mod.nombre);

    return {
      id_modelo: mod.id_modelo,
      nombre_modelo: mod.nombre,
      precio_base_m2: sumaArea > 0 ? r2(sumaPrecio / sumaArea) : 0,
      m2_referencia,
      activo: mod.activo,
    };
  });

  unidadesSinPrecio = activas.filter((p) => p.precio_lista_actual <= 0).length;

  // Familias completas y neutras: una categoría por cada valor que el inventario
  // realmente usa. Sin esto el motor levanta FACTOR_FALTANTE en cada unidad, que
  // es ruido: el factor no falta, todavía no se ha decidido.
  const extrasUsados = Array.from(
    new Set(activas.flatMap((p) => p.caracteristicas_extra)),
  ).sort();

  const factores: FactorPrecio[] = [
    ...torres.map((t) => factor("torre", t.nombre, 1)),
    ...vistasUsadas.map((v) => factor("vista", v, 1)),
    factor("orientacion", SIN_ORIENTACION, 1),
    ...extrasUsados.map((e) => factor("extras", e, 0)),
  ];

  const motor: MotorPrecio = {
    id_motor: `motor-${idProyecto}`,
    id_proyecto: idProyecto,
    nombre: `Motor ${nombreProyecto}`,
    ancla,
    bases_modelo,
    k_ext: K_EXT,
    k_loft: K_LOFT,
    // Curvas planas: el motor no afirma ninguna estructura antes de calibrar.
    nivel: { coef_a: 0, coef_b: 0 },
    tamano: { theta: 0 },
    // Sin capturar: el inventario tiene el conteo, no el precio.
    precio_cajon: 0,
    factor_cajon_tandem: 0.65,
    precio_m2_bodega: 0,
    factores,
    tasa_descuento_anual: TASA_DESCUENTO_ANUAL,
    activo: true,
    actualizado_en: new Date().toISOString(),
    estado_calibracion: "sin_calibrar",
    fecha_calibracion: null,
    meses_holgura_entrega: 0,
    vpn_objetivo_factor: null,
    vigencia_oferta_dias: VIGENCIA_OFERTA_DIAS,
  };

  return { motor, modelosSinPrecio, unidadesSinPrecio };
}

/**
 * Lo que le falta a un motor semilla para que su lista pueda publicarse.
 *
 * Se expone como lista de pendientes y no como un booleano porque el borrador
 * no es un estado de error: es el estado normal de una lista recién conectada
 * al inventario, y lo útil es saber qué falta capturar.
 */
export function pendientesDelBorrador(motor: MotorPrecio): string[] {
  const pendientes: string[] = [];

  const sinBase = (motor.bases_modelo ?? []).filter((b) => b.activo && b.precio_base_m2 <= 0);
  if (sinBase.length > 0) {
    pendientes.push(
      `${sinBase.length} modelo${sinBase.length === 1 ? "" : "s"} sin precio base por m²: ` +
        sinBase.map((b) => b.nombre_modelo).join(", "),
    );
  }

  if (motor.precio_cajon <= 0) {
    pendientes.push(
      "Falta el precio del cajón de estacionamiento. Sin él, su valor viaja dentro del precio por m² y el desglose exento/gravado no sirve para facturar.",
    );
  }

  if (motor.precio_m2_bodega <= 0) {
    pendientes.push(
      "Falta el precio por m² de bodega. Sin él, su valor viaja dentro del precio por m².",
    );
  }

  if (motor.estado_calibracion === "sin_calibrar") {
    pendientes.push(
      "El motor no está calibrado: las curvas de nivel y tamaño están planas y los factores de vista y torre valen 1.0000.",
    );
  }

  return pendientes;
}
