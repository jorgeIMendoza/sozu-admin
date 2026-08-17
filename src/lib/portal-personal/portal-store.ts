/**
 * Estado global — Zustand con structuredClone(initial), updates inmutables,
 * reset() y persistencia en localStorage.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  EscenarioGuardado,
  LogAuditoria,
  MetaPersonal,
  Referido,
  Usuario,
} from "./tipos";
import {
  LOGS_INICIALES,
  META,
  REFERIDOS,
  USUARIO_ACTUAL,
  USUARIOS_SUPLANTABLES,
} from "./mock";

export type EstadoCarga = "cargando" | "listo" | "error";

/** Filtros del módulo Inventario (Nivel 2), por desarrollo. */
export type FiltrosInventario = {
  modelo: string;
  nivel: string;
  recamaras: string;
  bodega: string;
  estacionamiento: string;
  rango: [number, number] | null;
  q: string;
};

export const FILTROS_VACIOS: FiltrosInventario = {
  modelo: "todos",
  nivel: "todos",
  recamaras: "todas",
  bodega: "todas",
  estacionamiento: "todos",
  rango: null,
  q: "",
};

type PortalState = {
  usuario: Usuario;
  suplantando_id: string | null;
  modo_presentacion: boolean;
  referidos: Referido[];
  escenarios: EscenarioGuardado[];
  meta: MetaPersonal;
  logs: LogAuditoria[];
  carga: EstadoCarga;
  /** Estado de navegación del módulo Inventario, vivo durante la sesión. */
  inventario_slug: string | null;
  inventario_unidad_id: string | null;
  filtros_inventario: Record<string, FiltrosInventario>;
};

const initial: PortalState = {
  usuario: USUARIO_ACTUAL,
  suplantando_id: null,
  modo_presentacion: false,
  referidos: REFERIDOS,
  escenarios: [],
  meta: META,
  logs: LOGS_INICIALES,
  carga: "listo",
  inventario_slug: null,
  inventario_unidad_id: null,
  filtros_inventario: {},
};

type PortalActions = {
  setModoPresentacion: (v: boolean) => void;
  suplantar: (id: string | null) => void;
  aceptarReglas: (version: string) => void;
  firmarConflictoInteres: () => void;
  confirmarCuentaBancaria: () => void;
  agregarReferido: (r: Referido) => void;
  cambiarEstadoReferido: (id: string, estado: Referido["estado"]) => void;
  guardarEscenario: (e: EscenarioGuardado) => void;
  /** Soft-disable, nunca hard-delete. */
  deprecarEscenario: (id: string, motivo: string) => void;
  ajustarMeta: (objetivo: number) => void;
  setCarga: (c: EstadoCarga) => void;
  setFiltrosInventario: (slug: string, f: FiltrosInventario) => void;
  limpiarFiltrosInventario: (slug: string) => void;
  abrirNivelInventario: (slug: string | null, unidadId?: string | null) => void;
  registrarLog: (accion: string, detalle: string) => void;
  reset: () => void;
};

export const usePortal = create<PortalState & PortalActions>()(
  persist(
    (set, get) => ({
      ...structuredClone(initial),

      setModoPresentacion: (v) => set({ modo_presentacion: v }),

      suplantar: (id) => {
        const u = USUARIOS_SUPLANTABLES.find((x) => x.id === id);
        set({ suplantando_id: id, usuario: u ?? USUARIO_ACTUAL });
      },

      aceptarReglas: (version) => {
        set((s) => ({ usuario: { ...s.usuario, reglas_aceptadas_version: version } }));
        get().registrarLog("aceptacion_reglas", `Reglas del Programa v${version}`);
      },

      firmarConflictoInteres: () => {
        set((s) => ({
          usuario: {
            ...s.usuario,
            conflicto_interes_firmado_en: new Date().toISOString(),
          },
        }));
        get().registrarLog("firma_conflicto_interes", "Declaración aceptada por el colaborador");
      },

      confirmarCuentaBancaria: () => {
        set((s) => ({ usuario: { ...s.usuario, cuenta_bancaria_confirmada: true } }));
        get().registrarLog("confirmacion_cuenta", "Cuenta bancaria confirmada");
      },

      agregarReferido: (r) => {
        set((s) => ({ referidos: [r, ...s.referidos] }));
        get().registrarLog("alta_referido", `${r.nombre} · origen ${r.origen}`);
      },

      cambiarEstadoReferido: (id, estado) => {
        set((s) => ({
          referidos: s.referidos.map((r) => (r.id === id ? { ...r, estado } : r)),
        }));
        get().registrarLog("cambio_estado_referido", `${id} → ${estado}`);
      },

      guardarEscenario: (e) => {
        set((s) => ({ escenarios: [e, ...s.escenarios] }));
        get().registrarLog("guardar_escenario", e.nombre);
      },

      deprecarEscenario: (id, motivo) => {
        set((s) => ({
          escenarios: s.escenarios.map((e) =>
            e.id === id
              ? {
                  ...e,
                  auditoria: {
                    ...e.auditoria,
                    deprecado_en: new Date().toISOString(),
                    deprecado_por: s.usuario.id,
                    motivo,
                  },
                }
              : e,
          ),
        }));
        get().registrarLog("deprecar_escenario", `${id} · ${motivo}`);
      },

      ajustarMeta: (objetivo) =>
        set((s) => ({ meta: { ...s.meta, objetivo_referidos: objetivo } })),

      setCarga: (carga) => set({ carga }),

      setFiltrosInventario: (slug, f) =>
        set((s) => ({ filtros_inventario: { ...s.filtros_inventario, [slug]: f } })),

      limpiarFiltrosInventario: (slug) =>
        set((s) => ({
          filtros_inventario: { ...s.filtros_inventario, [slug]: { ...FILTROS_VACIOS } },
        })),

      abrirNivelInventario: (slug, unidadId = null) =>
        set({ inventario_slug: slug, inventario_unidad_id: unidadId }),

      /** Log append-only: nunca se edita ni se borra. */
      registrarLog: (accion, detalle) =>
        set((s) => ({
          logs: [
            ...s.logs,
            {
              id: `log-${s.logs.length + 1}`,
              fecha: new Date().toLocaleString("es-MX"),
              usuario_id: s.usuario.id,
              accion,
              detalle,
              hash_previo: s.logs[s.logs.length - 1]?.id ?? null,
            },
          ],
        })),

      reset: () => set(structuredClone(initial)),
    }),
    { name: "sozu-portal-personal" },
  ),
);

/** Helpers de demo / time-travel, solo en desarrollo. */
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>)["__sozu"] = {
    reset: () => usePortal.getState().reset(),
    presentacion: (v: boolean) => usePortal.getState().setModoPresentacion(v),
    logs: () => usePortal.getState().logs,
  };
}
