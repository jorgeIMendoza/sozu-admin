import type {
  FactorPrecio,
  Modelo,
  MotorPrecio,
  Propiedad,
  Proyecto,
  TipoFactor,
  Torre,
} from "../types/dominio";
import { migrarMotorAAnclaje } from "../engine/anclaje";

/** Catálogo de características extra (idéntico al de la ficha de Propiedad). */
export const CATALOGO_EXTRAS = [
  "Aire Acondicionado",
  "Area de lavado",
  "Bodega",
  "Campana",
  "Closet",
  "Cocina integral",
  "Cuarto de Servicio",
  "Cuarto de TV",
  "Desayunador",
  "Flex",
  "Jacuzzi",
  "Muebles de baño",
  "Terraza",
  "Tina",
  "Ventilador de techo",
];

/** Generador congruencial lineal con semilla fija (determinista). */
function crearRng(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const PROYECTOS: Proyecto[] = [
  {
    id_proyecto: "pry-daiku",
    nombre: "Daiku",
    desarrollador: "Investimento",
    ciudad: "Guadalajara, Jalisco",
    num_departamentos: 163,
    activo: true,
  },
  {
    id_proyecto: "pry-monocolo",
    nombre: "Monócolo",
    desarrollador: "Investimento",
    ciudad: "Guadalajara, Jalisco",
    num_departamentos: 145,
    activo: true,
  },
];

export const TORRES: Torre[] = [
  {
    id_torre: "tor-daiku",
    id_proyecto: "pry-daiku",
    nombre: "DAIKU",
    fecha_entrega_estimada: "2027-06-30",
    activo: true,
  },
  {
    id_torre: "tor-tempo",
    id_proyecto: "pry-monocolo",
    nombre: "Tempo",
    fecha_entrega_estimada: "2028-03-31",
    activo: true,
  },
  {
    id_torre: "tor-vita",
    id_proyecto: "pry-monocolo",
    nombre: "Vita",
    fecha_entrega_estimada: "2028-09-30",
    activo: true,
  },
  {
    id_torre: "tor-aria",
    id_proyecto: "pry-monocolo",
    nombre: "Aria",
    fecha_entrega_estimada: "2029-03-31",
    activo: true,
  },
];

export const MODELOS: Modelo[] = [
  {
    id_modelo: "mod-parota-plus",
    id_proyecto: "pry-daiku",
    nombre: "PAROTA PLUS",
    recamaras: 2,
    banos_completos: 2,
    medios_banos: 0,
    caracteristicas: ["Walk-In Closet", "Barra de Cocina", "Cuarto de Lavado", "Balcón"],
    activo: true,
  },
  {
    id_modelo: "mod-parota",
    id_proyecto: "pry-daiku",
    nombre: "PAROTA",
    recamaras: 2,
    banos_completos: 2,
    medios_banos: 0,
    caracteristicas: ["Barra de Cocina", "Cuarto de Lavado", "Balcón"],
    activo: true,
  },
  {
    id_modelo: "mod-ceiba",
    id_proyecto: "pry-daiku",
    nombre: "CEIBA",
    recamaras: 1,
    banos_completos: 1,
    medios_banos: 0,
    caracteristicas: ["Barra de Cocina", "Balcón"],
    activo: true,
  },
  {
    id_modelo: "mod-tempo-a",
    id_proyecto: "pry-monocolo",
    nombre: "TEMPO A",
    recamaras: 2,
    banos_completos: 2,
    medios_banos: 1,
    caracteristicas: [
      "Walk-In Closet",
      "Barra de Cocina",
      "Cuarto de Lavado",
      "Balcón",
      "Cuarto de Servicio",
    ],
    activo: true,
  },
  {
    id_modelo: "mod-vita-b",
    id_proyecto: "pry-monocolo",
    nombre: "VITA B",
    recamaras: 3,
    banos_completos: 3,
    medios_banos: 1,
    caracteristicas: [
      "Walk-In Closet",
      "Barra de Cocina",
      "Cuarto de Lavado",
      "Terraza",
      "Cuarto de Servicio",
    ],
    activo: true,
  },
  {
    id_modelo: "mod-aria-ph",
    id_proyecto: "pry-monocolo",
    nombre: "ARIA PH",
    recamaras: 3,
    banos_completos: 3,
    medios_banos: 1,
    caracteristicas: [
      "Walk-In Closet",
      "Barra de Cocina",
      "Cuarto de Lavado",
      "Terraza",
      "Cuarto de Servicio",
      "Jacuzzi",
    ],
    activo: true,
  },
];

const BASE_DAIKU = {
  id_proyecto: "pry-daiku",
  id_torre: "tor-daiku",
  m2_loft: 0,
  m2_exteriores: 0,
  num_cajones: 1,
  tipo_cajon: "independiente" as const,
  tiene_bodega: false,
  m2_bodega: 0,
  caracteristicas_extra: [] as string[],
  propietario: "Tallwood",
  tipo_transaccion: "Pre-venta",
  tipo_propiedad: "Departamento",
  estatus: "Disponible",
  activo: true,
};

/** Siete unidades ancla reales de Daiku. No deben alterarse. */
const ANCLAS: Propiedad[] = (
  [
    ["104", 1, 76.64, "Sur", 5339796.2],
    ["105", 1, 75.98, "Sur", 5293811.53],
    ["106", 1, 75.98, "Sur", 5293811.53],
    ["109", 1, 77.12, "Oriente", 5359840.0],
    ["110", 1, 77.12, "Oriente", 5359840.0],
    ["305", 3, 75.98, "Sur", 5346617.6],
    ["306", 3, 75.98, "Sur", 5346617.6],
  ] as Array<[string, number, number, string, number]>
).map(([numero, nivel, m2, vista, precio]) => ({
  ...BASE_DAIKU,
  id_propiedad: `prop-daiku-${numero}`,
  id_modelo: "mod-parota-plus",
  numero,
  nivel,
  m2_interiores: m2,
  vista,
  orientacion: vista,
  precio_lista_actual: precio,
}));

function elegir<T>(rng: () => number, opciones: Array<[T, number]>): T {
  const u = rng();
  let acc = 0;
  for (const [valor, peso] of opciones) {
    acc += peso;
    if (u < acc) return valor;
  }
  return opciones[opciones.length - 1]![0];
}

const rango = (rng: () => number, min: number, max: number) => min + rng() * (max - min);

function generarDaiku(): Propiedad[] {
  const rng = crearRng(20260814);
  const usados = new Set(ANCLAS.map((a) => a.numero));
  const props: Propiedad[] = [];

  // Pool determinista: niveles 1..14, con 11 o 12 unidades por nivel.
  const pool: Array<{ numero: string; nivel: number }> = [];
  for (let nivel = 1; nivel <= 14; nivel++) {
    const porNivel = nivel <= 12 ? 12 : 11;
    for (let seq = 1; seq <= porNivel; seq++) {
      const numero = String(nivel * 100 + seq);
      if (usados.has(numero)) continue;
      usados.add(numero);
      pool.push({ numero, nivel });
    }
  }

  for (const entrada of pool) {
    if (props.length >= 156) break;
    const { numero, nivel } = entrada;


    const idModelo = elegir(rng, [
      ["mod-parota-plus", 0.7],
      ["mod-parota", 0.2],
      ["mod-ceiba", 0.1],
    ]);
    const m2 =
      idModelo === "mod-parota-plus"
        ? rango(rng, 75.98, 77.12)
        : idModelo === "mod-parota"
          ? rango(rng, 71.4, 73.2)
          : rango(rng, 48.5, 52.3);
    const m2_interiores = r2(m2);

    const vista = elegir(rng, [
      ["Sur", 0.4],
      ["Oriente", 0.35],
      ["Poniente", 0.15],
      ["Norte", 0.1],
    ]);

    const num_cajones = elegir(rng, [
      [1, 0.85],
      [2, 0.12],
      [3, 0.03],
    ]);
    const tipo_cajon: "independiente" | "tandem" =
      num_cajones > 1 && rng() < 1 / 3 ? "tandem" : "independiente";

    const tiene_bodega = rng() < 0.2;
    const m2_bodega = tiene_bodega ? r2(rango(rng, 3.0, 6.5)) : 0;

    const nExtras = Math.floor(rng() * 4);
    const extras: string[] = [];
    for (let i = 0; i < nExtras; i++) {
      const c = CATALOGO_EXTRAS[Math.floor(rng() * CATALOGO_EXTRAS.length)]!;
      if (!extras.includes(c)) extras.push(c);
    }

    const estatus = elegir(rng, [
      ["Disponible", 0.78],
      ["Apartada", 0.14],
      ["Vendida", 0.08],
    ]);

    props.push({
      ...BASE_DAIKU,
      id_propiedad: `prop-daiku-${numero}`,
      id_modelo: idModelo,
      numero,
      nivel,
      m2_interiores,
      vista,
      orientacion: vista,
      num_cajones,
      tipo_cajon,
      tiene_bodega,
      m2_bodega,
      caracteristicas_extra: extras,
      estatus,
      precio_lista_actual: r2(69500 * m2_interiores * (1 + 0.005 * (nivel - 1))),
    });
  }

  return [...ANCLAS, ...props];
}

function generarMonocolo(): Propiedad[] {
  const rng = crearRng(20260815);
  const config: Array<{
    idTorre: string;
    idModelo: string;
    total: number;
    min: number;
    max: number;
    extMin: number;
    extMax: number;
    cajones: number;
    pCountry: number;
    prefijo: string;
  }> = [
    {
      idTorre: "tor-tempo",
      idModelo: "mod-tempo-a",
      total: 50,
      min: 88,
      max: 94,
      extMin: 6,
      extMax: 9.5,
      cajones: 2,
      pCountry: 0.15,
      prefijo: "T",
    },
    {
      idTorre: "tor-vita",
      idModelo: "mod-vita-b",
      total: 50,
      min: 118,
      max: 132,
      extMin: 9,
      extMax: 14,
      cajones: 2,
      pCountry: 0.35,
      prefijo: "V",
    },
    {
      idTorre: "tor-aria",
      idModelo: "mod-aria-ph",
      total: 45,
      min: 140,
      max: 168,
      extMin: 14,
      extMax: 24,
      cajones: 3,
      pCountry: 0.6,
      prefijo: "A",
    },
  ];

  const props: Propiedad[] = [];
  for (const c of config) {
    let nivel = 1;
    let seq = 1;
    for (let i = 0; i < c.total; i++) {
      if (seq > 3) {
        seq = 1;
        nivel = nivel === 18 ? 1 : nivel + 1;
      }
      const numero = `${c.prefijo}${nivel * 100 + seq}`;
      seq += 1;

      const vista =
        rng() < c.pCountry
          ? "Country Club"
          : elegir(rng, [
              ["Sur", 0.3],
              ["Oriente", 0.3],
              ["Poniente", 0.2],
              ["Norte", 0.2],
            ]);
      const orientacion = vista === "Country Club" ? "Poniente" : vista;

      props.push({
        id_propiedad: `prop-mono-${numero}`,
        id_proyecto: "pry-monocolo",
        id_torre: c.idTorre,
        id_modelo: c.idModelo,
        numero,
        nivel,
        m2_interiores: r2(rango(rng, c.min, c.max)),
        m2_exteriores: r2(rango(rng, c.extMin, c.extMax)),
        m2_loft: 0,
        vista,
        orientacion,
        num_cajones: c.cajones,
        tipo_cajon: "independiente",
        tiene_bodega: true,
        m2_bodega: r2(rango(rng, 4.0, 9.0)),
        caracteristicas_extra: [],
        propietario: "Tallwood",
        tipo_transaccion: "Pre-venta",
        tipo_propiedad: "Departamento",
        estatus: "Disponible",
        precio_lista_actual: 0,
        activo: true,
      });
    }
  }
  return props;
}

export const PROPIEDADES: Propiedad[] = [...generarDaiku(), ...generarMonocolo()];

function factores(
  prefijo: string,
  entradas: Array<[TipoFactor, string, number]>,
): FactorPrecio[] {
  return entradas.map(([tipo, clave, valor]) => ({
    id_factor: `${prefijo}-${tipo}-${clave.toLowerCase().replace(/\s+/g, "-")}`,
    tipo_factor: tipo,
    clave,
    etiqueta: clave,
    valor,
    activo: true,
  }));
}

const EXTRAS_BASE: Array<[TipoFactor, string, number]> = CATALOGO_EXTRAS.map((c) => {
  const mapa: Record<string, number> = {
    Jacuzzi: 0.008,
    Terraza: 0.006,
    "Cuarto de Servicio": 0.005,
    "Aire Acondicionado": 0.004,
    "Cocina integral": 0.003,
    "Cuarto de TV": 0.002,
    Desayunador: 0.002,
    Closet: 0.001,
  };
  return ["extras", c, mapa[c] ?? 0];
});

const VISTAS_BASE: Array<[TipoFactor, string, number]> = [
  ["vista", "Sur", 1.0],
  ["vista", "Oriente", 1.0],
  ["vista", "Poniente", 0.98],
  ["vista", "Norte", 1.01],
  ["vista", "Country Club", 1.18],
];

const ORIENTACIONES_BASE: Array<[TipoFactor, string, number]> = [
  ["orientacion", "Sur", 1.0],
  ["orientacion", "Oriente", 1.0],
  ["orientacion", "Norte", 1.01],
  ["orientacion", "Poniente", 0.985],
];

const MOTOR_DAIKU_LEGADO = {
  id_motor: "motor-daiku",
  id_proyecto: "pry-daiku",
  nombre: "Motor Daiku",
  precio_base_m2: 69500,
  k_ext: 0.35,
  k_loft: 0.65,
  nivel: { coef_a: 0.008, coef_b: 0.00008 },
  tamano: { m2_referencia: 76.0, theta: 0.05 },
  precio_cajon: 280000,
  factor_cajon_tandem: 0.65,
  precio_m2_bodega: 22000,
  tasa_descuento_anual: 0.14,
  activo: true,
  actualizado_en: "2026-08-14T20:40:00.000Z",
  estado_calibracion: "sin_calibrar",
  fecha_calibracion: null,
  meses_holgura_entrega: 0,
  vpn_objetivo_factor: null,
  vigencia_oferta_dias: 15,
  factores: factores("dk", [
    ["torre", "DAIKU", 1.0],
    ...VISTAS_BASE,
    ...ORIENTACIONES_BASE,
    ["plano", "PAROTA PLUS", 1.01],
    ["plano", "PAROTA", 1.0],
    ["plano", "CEIBA", 0.99],
    ...EXTRAS_BASE,
  ]),
} as unknown as MotorPrecio;

const MOTOR_MONOCOLO_LEGADO = {
  id_motor: "motor-monocolo",
  id_proyecto: "pry-monocolo",
  nombre: "Motor Monócolo",
  precio_base_m2: 94000,
  k_ext: 0.35,
  k_loft: 0.65,
  nivel: { coef_a: 0.01, coef_b: 0.00006 },
  tamano: { m2_referencia: 120.0, theta: 0.06 },
  precio_cajon: 380000,
  factor_cajon_tandem: 0.65,
  precio_m2_bodega: 28000,
  tasa_descuento_anual: 0.14,
  activo: true,
  actualizado_en: "2026-08-14T20:40:00.000Z",
  estado_calibracion: "sin_calibrar",
  fecha_calibracion: null,
  meses_holgura_entrega: 0,
  vpn_objetivo_factor: null,
  vigencia_oferta_dias: 15,
  factores: factores("mc", [
    ["torre", "Tempo", 1.0],
    ["torre", "Vita", 1.035],
    ["torre", "Aria", 1.08],
    ...VISTAS_BASE,
    ...ORIENTACIONES_BASE,
    ["plano", "TEMPO A", 1.0],
    ["plano", "VITA B", 1.02],
    ["plano", "ARIA PH", 1.04],
    ...EXTRAS_BASE,
  ]),
} as unknown as MotorPrecio;

/**
 * Los motores semilla se declaran en el formato anterior y se migran al modelo
 * de anclaje por modelo con la misma rutina que migra un localStorage viejo.
 * Así la semilla y la migración no pueden divergir.
 */
function migrarSemilla(motor: MotorPrecio): MotorPrecio {
  return migrarMotorAAnclaje(motor, PROPIEDADES, MODELOS, TORRES).motor;
}

export const MOTOR_DAIKU: MotorPrecio = migrarSemilla(MOTOR_DAIKU_LEGADO);
export const MOTOR_MONOCOLO: MotorPrecio = migrarSemilla(MOTOR_MONOCOLO_LEGADO);

export const MOTORES_SEMILLA: Record<string, MotorPrecio> = {
  "pry-daiku": MOTOR_DAIKU,
  "pry-monocolo": MOTOR_MONOCOLO,
};

export const MODELOS_POR_ID: Record<string, Modelo> = Object.fromEntries(
  MODELOS.map((m) => [m.id_modelo, m]),
);
export const TORRES_POR_ID: Record<string, Torre> = Object.fromEntries(
  TORRES.map((t) => [t.id_torre, t]),
);

export const PROPIEDADES_POR_ID: Record<string, Propiedad> = Object.fromEntries(
  PROPIEDADES.map((p) => [p.id_propiedad, p]),
);
