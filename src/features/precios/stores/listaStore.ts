import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OverridePrecio {
  precio: number;
  causa: string;
  descripcion: string;
  precio_motor_al_aplicar: number;
  creado_en: string;
}

/** Mínimo de caracteres exigido a la descripción de un override. */
export const MIN_MOTIVO = 20;
/** Mínimo cuando la causa seleccionada es "Otro". */
export const MIN_MOTIVO_OTRO = 40;

/** Catálogo tipificado de causas de override. */
export const CAUSAS_OVERRIDE = [
  "Unidad muestra o departamento piloto",
  "Acuerdo comercial cerrado previamente",
  "Corrección de dato de inventario",
  "Precio heredado de lista anterior",
  "Condición física particular de la unidad",
  "Instrucción del desarrollador",
  "Otro",
] as const;

export function minimoDescripcion(causa: string): number {
  return causa === "Otro" ? MIN_MOTIVO_OTRO : MIN_MOTIVO;
}

export interface FiltrosLista {
  busqueda: string;
  torre: string;
  modelo: string;
  vista: string;
  estatus: string;
  soloConAlertas: boolean;
  soloConOverride: boolean;
  deltaMayorA5: boolean;
  soloDisponibles: boolean;
  soloRepreciables: boolean;
}

export type DireccionOrden = "asc" | "desc";

interface EstadoLista {
  overrides: Record<string, OverridePrecio>;
  filtros: FiltrosLista;
  columnasVisibles: string[];
  orden: { columna: string; direccion: DireccionOrden } | null;
  pagina: number;
  tamanoPagina: 25 | 50 | 100;
  seleccion: string[];
  franjaExpandida: boolean;
  vistaInventario: VistaInventario;
  metricaPlano: MetricaPlano;
  torrePlano: string;
  modoVersion: ModoVersion;
  /**
   * Escenario guardado que se está viendo, o `null` para el borrador vivo.
   *
   * Va aparte de `modoVersion` porque no es un modo más: es "cuál de los N
   * escenarios". Cuando tiene valor manda sobre el modo, y elegir Borrador o
   * Publicada lo limpia, para que nunca haya dos controles peleándose por
   * decir qué lista se muestra.
   */
  idEscenarioVista: string | null;

}

export const COLUMNAS_DISPONIBLES: Array<{ clave: string; titulo: string }> = [
  { clave: "torre", titulo: "Torre" },
  { clave: "modelo", titulo: "Modelo" },
  { clave: "numero", titulo: "No." },
  { clave: "nivel", titulo: "Nivel" },
  { clave: "vista", titulo: "Vista" },
  { clave: "area_int", titulo: "Área Int." },
  { clave: "area_pond", titulo: "Área Pond." },
  { clave: "cajones", titulo: "Cajones" },
  { clave: "factores", titulo: "Factores" },
  { clave: "exento", titulo: "Exento" },
  { clave: "gravado", titulo: "Gravado" },
  { clave: "precio_calculado", titulo: "Precio Calculado" },
  { clave: "precio_m2_calc", titulo: "$/m² Calc." },
  { clave: "precio_actual", titulo: "Precio Actual" },
  { clave: "precio_m2_actual", titulo: "$/m² Actual" },
  { clave: "delta", titulo: "Delta" },
  { clave: "delta_m2", titulo: "Δ $/m²" },
  { clave: "estatus", titulo: "Estatus" },
  { clave: "delta_baseline", titulo: "Δ vs. baseline" },
  { clave: "alertas", titulo: "Alertas" },
  { clave: "precio_publicado", titulo: "Precio publicado" },
  { clave: "delta_vs_publicado", titulo: "Δ vs. publicado" },
];

/** Columnas que nacen ocultas en el selector. */
export const COLUMNAS_OCULTAS_POR_DEFECTO = [
  "delta_baseline",
  "precio_publicado",
  "delta_vs_publicado",
];

/** Métricas disponibles en el plano de torre. */
export type MetricaPlano =
  | "precio_calculado"
  | "precio_m2"
  | "delta_pct"
  | "estatus"
  | "alertas";

export type VistaInventario = "lista" | "plano";

/** Conmutador Borrador / Publicada de la Tabla de Precios. */
export type ModoVersion = "borrador" | "publicada";


const estadoInicial: EstadoLista = {
  overrides: {},
  filtros: {
    busqueda: "",
    torre: "todos",
    modelo: "todos",
    vista: "todos",
    estatus: "todos",
    soloConAlertas: false,
    soloConOverride: false,
    deltaMayorA5: false,
    soloDisponibles: false,
    soloRepreciables: false,
  },
  columnasVisibles: COLUMNAS_DISPONIBLES.filter(
    (c) => !COLUMNAS_OCULTAS_POR_DEFECTO.includes(c.clave),
  ).map((c) => c.clave),
  orden: null,
  pagina: 1,
  tamanoPagina: 50,
  seleccion: [],
  franjaExpandida: false,
  vistaInventario: "lista",
  metricaPlano: "precio_m2",
  torrePlano: "todas",
  modoVersion: "borrador",
  idEscenarioVista: null,
};


interface AccionesLista {
  aplicarOverride: (
    idPropiedad: string,
    precio: number,
    causa: string,
    descripcion: string,
    precioMotor: number,
  ) => boolean;
  quitarOverride: (idPropiedad: string) => void;
  setFiltro: <K extends keyof FiltrosLista>(campo: K, valor: FiltrosLista[K]) => void;
  limpiarFiltros: () => void;
  toggleColumna: (columna: string) => void;
  setOrden: (columna: string) => void;
  setPagina: (n: number) => void;
  setTamanoPagina: (n: 25 | 50 | 100) => void;
  toggleSeleccion: (idPropiedad: string) => void;
  setSeleccion: (ids: string[]) => void;
  limpiarSeleccion: () => void;
  setFranjaExpandida: (v: boolean) => void;
  setVistaInventario: (v: VistaInventario) => void;
  setMetricaPlano: (m: MetricaPlano) => void;
  setTorrePlano: (t: string) => void;
  setModoVersion: (m: ModoVersion) => void;
  /** Ver un escenario guardado, o `null` para volver al borrador vivo. */
  setEscenarioVista: (id: string | null) => void;

  reset: () => void;
}

/** Migración de estados persistidos anteriores (overrides con `motivo`). */
function migrar(estado: unknown): EstadoLista & Partial<AccionesLista> {
  const base = structuredClone(estadoInicial);
  const s = (estado ?? {}) as Record<string, unknown>;

  const overridesViejos = (s["overrides"] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const overrides: Record<string, OverridePrecio> = {};
  for (const [id, o] of Object.entries(overridesViejos)) {
    const precio = Number(o["precio"]) || 0;
    overrides[id] = {
      precio,
      causa: (o["causa"] as string) ?? "Otro",
      descripcion: (o["descripcion"] as string) ?? (o["motivo"] as string) ?? "",
      precio_motor_al_aplicar: Number(o["precio_motor_al_aplicar"]) || precio,
      creado_en: (o["creado_en"] as string) ?? new Date().toISOString(),
    };
  }

  const columnas = Array.isArray(s["columnasVisibles"])
    ? (s["columnasVisibles"] as string[])
    : base.columnasVisibles;
  const nuevas = ["precio_m2_calc", "precio_m2_actual", "delta_m2"].filter(
    (c) => !columnas.includes(c),
  );

  return {
    ...base,
    ...(s as Partial<EstadoLista>),
    overrides,
    filtros: { ...base.filtros, ...((s["filtros"] as object) ?? {}) },
    columnasVisibles: [...columnas, ...nuevas],
    seleccion: [],
  };
}

export const useListaStore = create<EstadoLista & AccionesLista>()(
  persist(
    (set) => ({
      ...structuredClone(estadoInicial),

      aplicarOverride: (idPropiedad, precio, causa, descripcion, precioMotor) => {
        const limpio = descripcion.trim();
        if (!causa) return false;
        if (limpio.length < minimoDescripcion(causa)) return false;
        if (!Number.isFinite(precio) || precio <= 0) return false;
        set((s) => ({
          ...s,
          overrides: {
            ...s.overrides,
            [idPropiedad]: {
              precio,
              causa,
              descripcion: limpio,
              precio_motor_al_aplicar: precioMotor,
              creado_en: new Date().toISOString(),
            },
          },
        }));
        return true;
      },

      quitarOverride: (idPropiedad) =>
        set((s) => {
          const { [idPropiedad]: _quitado, ...resto } = s.overrides;
          return { ...s, overrides: resto };
        }),

      setFiltro: (campo, valor) =>
        set((s) => ({ ...s, filtros: { ...s.filtros, [campo]: valor }, pagina: 1 })),

      limpiarFiltros: () =>
        set((s) => ({
          ...s,
          filtros: structuredClone(estadoInicial.filtros),
          pagina: 1,
        })),

      toggleColumna: (columna) =>
        set((s) => ({
          ...s,
          columnasVisibles: s.columnasVisibles.includes(columna)
            ? s.columnasVisibles.filter((c) => c !== columna)
            : [...s.columnasVisibles, columna],
        })),

      setOrden: (columna) =>
        set((s) => ({
          ...s,
          pagina: 1,
          orden:
            s.orden && s.orden.columna === columna
              ? s.orden.direccion === "asc"
                ? { columna, direccion: "desc" }
                : null
              : { columna, direccion: "asc" },
        })),

      setPagina: (n) => set((s) => ({ ...s, pagina: Math.max(1, n) })),

      setTamanoPagina: (n) => set((s) => ({ ...s, tamanoPagina: n, pagina: 1 })),

      toggleSeleccion: (idPropiedad) =>
        set((s) => ({
          ...s,
          seleccion: s.seleccion.includes(idPropiedad)
            ? s.seleccion.filter((x) => x !== idPropiedad)
            : [...s.seleccion, idPropiedad],
        })),

      setSeleccion: (ids) => set((s) => ({ ...s, seleccion: ids })),

      limpiarSeleccion: () => set((s) => ({ ...s, seleccion: [] })),

      setFranjaExpandida: (v) => set((s) => ({ ...s, franjaExpandida: v })),

      setVistaInventario: (v) => set((s) => ({ ...s, vistaInventario: v })),

      setMetricaPlano: (m) => set((s) => ({ ...s, metricaPlano: m })),

      setTorrePlano: (t) => set((s) => ({ ...s, torrePlano: t })),

      setModoVersion: (m) =>
        set((s) => ({
          ...s,
          modoVersion: m,
          // Volver al borrador o a la publicada sale de cualquier escenario.
          idEscenarioVista: null,
          seleccion: [],
        })),

      setEscenarioVista: (id) =>
        set((s) => ({
          ...s,
          idEscenarioVista: id,
          // Un escenario es una foto: no se edita ni se opera sobre él.
          seleccion: [],
        })),

      reset: () => set(structuredClone(estadoInicial)),
    }),
    {
      name: "sozu-precios-lista",
      version: 2,
      migrate: (persistido) => migrar(persistido) as never,
      merge: (persistido, actual) => ({ ...actual, ...migrar(persistido) }),
    },
  ),
);
