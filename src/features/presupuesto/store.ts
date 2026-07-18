// =============================================================
// Portal Condominio · Presupuesto — store (Zustand, mock, en memoria)
// Fuente única del erogado = Tesorería (registrarErogacionDesdeTesoreria).
// Un presupuesto aprobado por ejercicio; cambios post-aprobación => modificación
// auditada. Auditoría append-only. Reloj de demo (mes actual). Sin backend real.
// =============================================================
import { create } from "zustand";
import type {
  Concepto,
  EntradaAuditoria,
  Erogacion,
  Presupuesto,
  PropuestaRevision,
} from "./types";
import {
  MOCK_AUDITORIA_INICIAL,
  MOCK_EROGACIONES,
  MOCK_PRESUPUESTO,
  MOCK_PROPUESTAS,
} from "./mockData";
import { mesActualDelEjercicio, presupuestoAnualConcepto } from "./logic";

function entrada(usuario: string, accion: string, detalle: string): EntradaAuditoria {
  return {
    id: `aud-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    timestamp: new Date().toISOString(),
    usuario,
    accion,
    detalle,
  };
}

export interface NuevaErogacionInput {
  conceptoId: string;
  monto: number;
  proveedor: string;
  concepto: string; // descripción del egreso
  fecha?: string; // ISO; default: fecha del reloj demo
  egresoTesoreriaId?: string; // // SWAP POINT: id del egreso en Tesorería
}

interface PresupuestoState {
  presupuesto: Presupuesto;
  erogaciones: Erogacion[];
  propuestas: PropuestaRevision[];
  auditoria: EntradaAuditoria[];
  usuario: string;
  ahora: number; // reloj del módulo (ms) → determina el mes actual

  setUsuario: (n: string) => void;
  mesActual: () => number;

  // Presupuesto (edición solo en borrador; en aprobado exige modificación auditada)
  editarConceptoMensual: (conceptoId: string, nuevoMensual: number) => { ok: boolean; motivo?: string };
  modificarConceptoAprobado: (conceptoId: string, nuevoMensual: number, justificacion: string) => void;
  aprobarPresupuesto: () => void;

  // Erogaciones (fuente Tesorería — NUNCA captura directa en Presupuesto)
  registrarErogacionDesdeTesoreria: (input: NuevaErogacionInput) => Erogacion;

  // Propuestas
  adoptarPropuesta: (propuestaId: string) => void;
  descartarPropuesta: (propuestaId: string, nota: string) => void;

  // DEV
  avanzarMes: () => void;
  reset: () => void;
}

function freshState() {
  return {
    presupuesto: structuredClone(MOCK_PRESUPUESTO),
    erogaciones: structuredClone(MOCK_EROGACIONES),
    propuestas: structuredClone(MOCK_PROPUESTAS),
    auditoria: structuredClone(MOCK_AUDITORIA_INICIAL) as EntradaAuditoria[],
    ahora: Date.now(),
  };
}

export const usePresupuestoStore = create<PresupuestoState>((set, get) => ({
  ...freshState(),
  usuario: "Administración (demo)",

  setUsuario: (n) => set({ usuario: n || "Administración (demo)" }),

  mesActual: () => {
    const { ahora, presupuesto } = get();
    return mesActualDelEjercicio(ahora, presupuesto.ejercicio);
  },

  editarConceptoMensual: (conceptoId, nuevoMensual) => {
    const { presupuesto } = get();
    if (presupuesto.estado !== "borrador") {
      return {
        ok: false,
        motivo: "El presupuesto está aprobado: usa una modificación presupuestal (queda auditada).",
      };
    }
    set((s) => ({
      presupuesto: {
        ...s.presupuesto,
        conceptos: s.presupuesto.conceptos.map((c) =>
          c.id === conceptoId ? { ...c, presupuestoMensual: nuevoMensual, presupuestoPorMes: null } : c,
        ),
      },
    }));
    return { ok: true };
  },

  modificarConceptoAprobado: (conceptoId, nuevoMensual, justificacion) => {
    const { presupuesto, usuario } = get();
    const c = presupuesto.conceptos.find((x) => x.id === conceptoId);
    if (!c) return;
    const anterior = c.presupuestoMensual;
    set((s) => ({
      presupuesto: {
        ...s.presupuesto,
        conceptos: s.presupuesto.conceptos.map((x) =>
          x.id === conceptoId ? { ...x, presupuestoMensual: nuevoMensual, presupuestoPorMes: null } : x,
        ),
      },
      auditoria: [
        ...s.auditoria,
        entrada(
          usuario,
          "Modificación presupuestal",
          `Concepto "${c.nombre}": mensual ${anterior.toLocaleString("es-MX")} → ${nuevoMensual.toLocaleString("es-MX")}. Justificación: ${justificacion || "(sin nota)"}.`,
        ),
      ],
    }));
  },

  aprobarPresupuesto: () => {
    const { presupuesto, usuario } = get();
    if (presupuesto.estado === "aprobado") return;
    set((s) => ({
      presupuesto: {
        ...s.presupuesto,
        estado: "aprobado",
        fechaAprobacion: new Date().toISOString(),
        aprobadoPor: usuario,
      },
      auditoria: [
        ...s.auditoria,
        entrada(usuario, "Presupuesto aprobado", `Ejercicio ${presupuesto.ejercicio} aprobado.`),
      ],
    }));
  },

  registrarErogacionDesdeTesoreria: (input) => {
    const { ahora } = get();
    const fecha = input.fecha ?? new Date(ahora).toISOString().slice(0, 10);
    const nueva: Erogacion = {
      id: `ero-${Date.now()}-${Math.round(Math.random() * 1e5)}`,
      conceptoId: input.conceptoId,
      egresoTesoreriaId: input.egresoTesoreriaId ?? `teso-${Date.now()}`, // SWAP POINT
      fecha,
      monto: input.monto,
      proveedor: input.proveedor,
      concepto: input.concepto,
    };
    set((s) => ({ erogaciones: [...s.erogaciones, nueva] }));
    return nueva;
  },

  adoptarPropuesta: (propuestaId) => {
    const { propuestas, presupuesto, usuario } = get();
    const p = propuestas.find((x) => x.id === propuestaId);
    if (!p || p.estado !== "abierta") return;
    // Aplica los cambios como modificación presupuestal auditada.
    const detalleCambios = Object.entries(p.cambios)
      .map(([cid, val]) => {
        const c = presupuesto.conceptos.find((x) => x.id === cid);
        return `${c?.nombre ?? cid}: ${(c?.presupuestoMensual ?? 0).toLocaleString("es-MX")} → ${val.toLocaleString("es-MX")}`;
      })
      .join("; ");
    set((s) => ({
      presupuesto: {
        ...s.presupuesto,
        conceptos: s.presupuesto.conceptos.map((c) =>
          c.id in p.cambios ? { ...c, presupuestoMensual: p.cambios[c.id], presupuestoPorMes: null } : c,
        ),
      },
      propuestas: s.propuestas.map((x) => (x.id === propuestaId ? { ...x, estado: "adoptada" } : x)),
      auditoria: [
        ...s.auditoria,
        entrada(
          usuario,
          "Propuesta adoptada",
          `Propuesta de ${p.autor} adoptada como modificación presupuestal. Cambios: ${detalleCambios}.`,
        ),
      ],
    }));
  },

  descartarPropuesta: (propuestaId, nota) => {
    const { propuestas, usuario } = get();
    const p = propuestas.find((x) => x.id === propuestaId);
    if (!p || p.estado !== "abierta") return;
    set((s) => ({
      propuestas: s.propuestas.map((x) =>
        x.id === propuestaId ? { ...x, estado: "descartada", nota: nota || x.nota } : x,
      ),
      auditoria: [
        ...s.auditoria,
        entrada(usuario, "Propuesta descartada", `Propuesta de ${p.autor} descartada. Nota: ${nota || "(sin nota)"}.`),
      ],
    }));
  },

  avanzarMes: () => {
    set((s) => {
      const d = new Date(s.ahora);
      d.setMonth(d.getMonth() + 1);
      return { ahora: d.getTime() };
    });
  },

  reset: () => set({ ...freshState() }),
}));

// Selector util para la integración con Tesorería (cascada Área→Centro→Concepto).
export function catalogoCascada(p: Presupuesto) {
  return p.areas
    .slice()
    .sort((a, b) => a.numero - b.numero)
    .map((area) => ({
      area,
      centros: p.centrosCosto
        .filter((cc) => cc.areaId === area.id)
        .map((centro) => ({
          centro,
          conceptos: p.conceptos.filter((c) => c.centroCostoId === centro.id && c.activo),
        })),
    }));
}

/** Presupuesto anual total (helper para KPIs y umbral de fondo). */
export function presupuestoAnualTotal(p: Presupuesto): number {
  return p.conceptos.filter((c) => c.activo).reduce((s, c) => s + presupuestoAnualConcepto(c), 0);
}
