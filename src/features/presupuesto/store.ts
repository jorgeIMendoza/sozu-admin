// =============================================================
// Portal Condominio · Presupuesto — store (Zustand, mock, en memoria)
// FUENTE ÚNICA del erogado = egresos de Tesorería (viven aquí). Las erogaciones
// se DERIVAN de los egresos clasificados. CRUD del catálogo (Áreas/Centros/
// Conceptos) con reglas: borrador = libre; aprobado = Modificación Presupuestal
// con motivo + auditoría. Auditoría append-only. Sin backend real (// SWAP POINT).
// =============================================================
import { create } from "zustand";
import type {
  AreaGasto,
  CentroCosto,
  Concepto,
  EgresoTesoreria,
  EntradaAuditoria,
  Erogacion,
  Presupuesto,
  PropuestaRevision,
} from "./types";
import {
  MOCK_AUDITORIA_INICIAL,
  MOCK_EGRESOS,
  MOCK_PRESUPUESTO,
  MOCK_PROPUESTAS,
} from "./mockData";
import {
  erogacionesDesdeEgresos,
  erogadoPorMesDe,
  erogacionesDeConcepto,
  mesActualDelEjercicio,
  presupuestoAnualConcepto,
} from "./logic";

function entrada(usuario: string, accion: string, detalle: string): EntradaAuditoria {
  return {
    id: `aud-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    timestamp: new Date().toISOString(),
    usuario,
    accion,
    detalle,
  };
}

const uid = (p: string) => `${p}-${Date.now()}-${Math.round(Math.random() * 1e5)}`;

export type Resultado = { ok: boolean; motivo?: string };

export interface NuevoEgresoInput {
  conceptoPresupuestalId: string | null;
  monto: number;
  proveedor: string;
  concepto: string;
  categoria: string;
  fecha?: string; // ISO; default: fecha del reloj demo
  estatus?: EgresoTesoreria["estatus"];
}

interface PresupuestoState {
  presupuesto: Presupuesto;
  egresos: EgresoTesoreria[]; // FUENTE ÚNICA
  erogaciones: Erogacion[]; // DERIVADO de egresos clasificados (se recalcula)
  propuestas: PropuestaRevision[];
  auditoria: EntradaAuditoria[];
  usuario: string;
  ahora: number; // reloj del módulo (ms) → determina el mes actual

  setUsuario: (n: string) => void;
  mesActual: () => number;

  // Presupuesto (montos)
  editarConceptoMensual: (conceptoId: string, nuevoMensual: number) => Resultado;
  modificarConceptoAprobado: (conceptoId: string, nuevoMensual: number, justificacion: string) => void;
  aprobarPresupuesto: () => void;
  reabrirBorrador: () => void; // DEV: volver a borrador para probar edición libre

  // CRUD del catálogo (motivo obligatorio si el presupuesto está aprobado)
  crearArea: (nombre: string, motivo?: string) => Resultado;
  renombrarArea: (id: string, nombre: string, motivo?: string) => Resultado;
  reordenarArea: (id: string, dir: -1 | 1, motivo?: string) => Resultado;
  toggleAreaActiva: (id: string, motivo?: string) => Resultado;
  crearCentro: (areaId: string, nombre: string, motivo?: string) => Resultado;
  renombrarCentro: (id: string, nombre: string, motivo?: string) => Resultado;
  moverCentro: (id: string, nuevoAreaId: string, motivo?: string) => Resultado;
  toggleCentroActivo: (id: string, motivo?: string) => Resultado;
  crearConcepto: (centroCostoId: string, nombre: string, mensual: number, motivo?: string) => Resultado;
  editarConcepto: (conceptoId: string, cambios: { nombre?: string; presupuestoMensual?: number; presupuestoPorMes?: number[] | null }, motivo?: string) => Resultado;
  toggleConceptoActivo: (conceptoId: string, motivo?: string) => Resultado;

  // Egresos (fuente Tesorería)
  registrarEgreso: (input: NuevoEgresoInput) => EgresoTesoreria;
  clasificarEgreso: (egresoId: string, conceptoPresupuestalId: string) => void;

  // Propuestas
  adoptarPropuesta: (propuestaId: string) => void;
  descartarPropuesta: (propuestaId: string, nota: string) => void;

  // DEV
  avanzarMes: () => void;
  reset: () => void;
}

function freshState() {
  const egresos = structuredClone(MOCK_EGRESOS);
  return {
    presupuesto: structuredClone(MOCK_PRESUPUESTO),
    egresos,
    erogaciones: erogacionesDesdeEgresos(egresos),
    propuestas: structuredClone(MOCK_PROPUESTAS),
    auditoria: structuredClone(MOCK_AUDITORIA_INICIAL) as EntradaAuditoria[],
    ahora: Date.now(),
  };
}

export const usePresupuestoStore = create<PresupuestoState>((set, get) => {
  // Aplica un cambio de catálogo respetando el estado del presupuesto.
  // Borrador → aplica + auditoría ligera. Aprobado → exige motivo y lo registra
  // como "Modificación presupuestal". Devuelve {ok,motivo}.
  const cambioCatalogo = (
    mutar: (p: Presupuesto) => Presupuesto,
    accionBorrador: string,
    detalle: string,
    motivo?: string,
  ): Resultado => {
    const { presupuesto, usuario } = get();
    const aprobado = presupuesto.estado !== "borrador";
    if (aprobado && !motivo?.trim()) {
      return { ok: false, motivo: "El presupuesto está aprobado: se requiere una justificación (Modificación Presupuestal)." };
    }
    const accion = aprobado ? "Modificación presupuestal" : accionBorrador;
    const det = aprobado ? `${detalle} Justificación: ${motivo!.trim()}.` : detalle;
    set((s) => ({ presupuesto: mutar(s.presupuesto), auditoria: [...s.auditoria, entrada(usuario, accion, det)] }));
    return { ok: true };
  };

  // Erogado (ejercicio) de un concepto — para la guarda de desactivación.
  const erogadoDeConcepto = (conceptoId: string): number => {
    const { erogaciones, presupuesto } = get();
    return erogadoPorMesDe(erogacionesDeConcepto(erogaciones, conceptoId), presupuesto.ejercicio).reduce((a, b) => a + b, 0);
  };

  const setEgresos = (egresos: EgresoTesoreria[]) =>
    set({ egresos, erogaciones: erogacionesDesdeEgresos(egresos) });

  return {
    ...freshState(),
    usuario: "Administración (demo)",

    setUsuario: (n) => set({ usuario: n || "Administración (demo)" }),
    mesActual: () => {
      const { ahora, presupuesto } = get();
      return mesActualDelEjercicio(ahora, presupuesto.ejercicio);
    },

    // ── Montos ───────────────────────────────────────────────
    editarConceptoMensual: (conceptoId, nuevoMensual) => {
      const { presupuesto } = get();
      if (presupuesto.estado !== "borrador") {
        return { ok: false, motivo: "El presupuesto está aprobado: usa una modificación presupuestal (queda auditada)." };
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
        presupuesto: { ...s.presupuesto, estado: "aprobado", fechaAprobacion: new Date().toISOString(), aprobadoPor: usuario },
        auditoria: [...s.auditoria, entrada(usuario, "Presupuesto aprobado", `Ejercicio ${presupuesto.ejercicio} aprobado.`)],
      }));
    },

    reabrirBorrador: () => {
      const { presupuesto, usuario } = get();
      if (presupuesto.estado === "borrador") return;
      set((s) => ({
        presupuesto: { ...s.presupuesto, estado: "borrador" },
        auditoria: [...s.auditoria, entrada(usuario, "Presupuesto reabierto", `Ejercicio ${presupuesto.ejercicio} reabierto a borrador (edición libre).`)],
      }));
    },

    // ── CRUD Áreas ───────────────────────────────────────────
    crearArea: (nombre, motivo) => {
      if (!nombre.trim()) return { ok: false, motivo: "El nombre es obligatorio." };
      const numero = get().presupuesto.areas.reduce((mx, a) => Math.max(mx, a.numero), 0) + 1;
      const nueva: AreaGasto = { id: uid("a"), numero, nombre: nombre.trim(), activo: true };
      return cambioCatalogo((p) => ({ ...p, areas: [...p.areas, nueva] }), "Área creada", `Área creada: "${nueva.nombre}" (#${numero}).`, motivo);
    },

    renombrarArea: (id, nombre, motivo) => {
      if (!nombre.trim()) return { ok: false, motivo: "El nombre es obligatorio." };
      const prev = get().presupuesto.areas.find((a) => a.id === id);
      return cambioCatalogo(
        (p) => ({ ...p, areas: p.areas.map((a) => (a.id === id ? { ...a, nombre: nombre.trim() } : a)) }),
        "Área renombrada",
        `Área "${prev?.nombre ?? id}" → "${nombre.trim()}".`,
        motivo,
      );
    },

    reordenarArea: (id, dir, motivo) => {
      const areas = [...get().presupuesto.areas].sort((a, b) => a.numero - b.numero);
      const idx = areas.findIndex((a) => a.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= areas.length) return { ok: false, motivo: "No se puede mover más." };
      const a1 = areas[idx], a2 = areas[j];
      return cambioCatalogo(
        (p) => ({
          ...p,
          areas: p.areas.map((a) => (a.id === a1.id ? { ...a, numero: a2.numero } : a.id === a2.id ? { ...a, numero: a1.numero } : a)),
        }),
        "Áreas reordenadas",
        `Orden: "${a1.nombre}" ↔ "${a2.nombre}".`,
        motivo,
      );
    },

    toggleAreaActiva: (id, motivo) => {
      const p0 = get().presupuesto;
      const area = p0.areas.find((a) => a.id === id);
      if (!area) return { ok: false, motivo: "Área no encontrada." };
      if (area.activo) {
        // Guarda: no desactivar si algún concepto del área tiene erogado en el ejercicio.
        const centrosArea = new Set(p0.centrosCosto.filter((cc) => cc.areaId === id).map((cc) => cc.id));
        const conErogado = p0.conceptos.some((c) => centrosArea.has(c.centroCostoId) && erogadoDeConcepto(c.id) > 0);
        if (conErogado) return { ok: false, motivo: "No se puede desactivar: el área tiene conceptos con erogado en el ejercicio." };
      }
      const nuevo = !area.activo;
      return cambioCatalogo(
        (p) => ({ ...p, areas: p.areas.map((a) => (a.id === id ? { ...a, activo: nuevo } : a)) }),
        nuevo ? "Área activada" : "Área desactivada",
        `Área "${area.nombre}" ${nuevo ? "activada" : "desactivada"}.`,
        motivo,
      );
    },

    // ── CRUD Centros de costo ────────────────────────────────
    crearCentro: (areaId, nombre, motivo) => {
      if (!nombre.trim()) return { ok: false, motivo: "El nombre es obligatorio." };
      const p0 = get().presupuesto;
      const area = p0.areas.find((a) => a.id === areaId);
      if (!area) return { ok: false, motivo: "Área no encontrada." };
      const idx = p0.centrosCosto.filter((cc) => cc.areaId === areaId).length + 1;
      const nuevo: CentroCosto = { id: uid("cc"), areaId, codigo: `${area.numero}.${idx}`, nombre: nombre.trim(), activo: true };
      return cambioCatalogo((p) => ({ ...p, centrosCosto: [...p.centrosCosto, nuevo] }), "Centro creado", `Centro de costo "${nuevo.nombre}" (${nuevo.codigo}) en "${area.nombre}".`, motivo);
    },

    renombrarCentro: (id, nombre, motivo) => {
      if (!nombre.trim()) return { ok: false, motivo: "El nombre es obligatorio." };
      const prev = get().presupuesto.centrosCosto.find((cc) => cc.id === id);
      return cambioCatalogo(
        (p) => ({ ...p, centrosCosto: p.centrosCosto.map((cc) => (cc.id === id ? { ...cc, nombre: nombre.trim() } : cc)) }),
        "Centro renombrado",
        `Centro "${prev?.nombre ?? id}" → "${nombre.trim()}".`,
        motivo,
      );
    },

    moverCentro: (id, nuevoAreaId, motivo) => {
      const p0 = get().presupuesto;
      const centro = p0.centrosCosto.find((cc) => cc.id === id);
      const area = p0.areas.find((a) => a.id === nuevoAreaId);
      if (!centro || !area) return { ok: false, motivo: "Centro o área no encontrada." };
      if (centro.areaId === nuevoAreaId) return { ok: true };
      const idx = p0.centrosCosto.filter((cc) => cc.areaId === nuevoAreaId && cc.id !== id).length + 1;
      const codigo = `${area.numero}.${idx}`;
      return cambioCatalogo(
        (p) => ({ ...p, centrosCosto: p.centrosCosto.map((cc) => (cc.id === id ? { ...cc, areaId: nuevoAreaId, codigo } : cc)) }),
        "Centro movido",
        `Centro "${centro.nombre}" movido a "${area.nombre}" (${codigo}).`,
        motivo,
      );
    },

    toggleCentroActivo: (id, motivo) => {
      const p0 = get().presupuesto;
      const centro = p0.centrosCosto.find((cc) => cc.id === id);
      if (!centro) return { ok: false, motivo: "Centro no encontrado." };
      if (centro.activo) {
        const conErogado = p0.conceptos.some((c) => c.centroCostoId === id && erogadoDeConcepto(c.id) > 0);
        if (conErogado) return { ok: false, motivo: "No se puede desactivar: el centro tiene conceptos con erogado en el ejercicio." };
      }
      const nuevo = !centro.activo;
      return cambioCatalogo(
        (p) => ({ ...p, centrosCosto: p.centrosCosto.map((cc) => (cc.id === id ? { ...cc, activo: nuevo } : cc)) }),
        nuevo ? "Centro activado" : "Centro desactivado",
        `Centro "${centro.nombre}" ${nuevo ? "activado" : "desactivado"}.`,
        motivo,
      );
    },

    // ── CRUD Conceptos ───────────────────────────────────────
    crearConcepto: (centroCostoId, nombre, mensual, motivo) => {
      if (!nombre.trim()) return { ok: false, motivo: "El nombre es obligatorio." };
      if (!(mensual >= 0)) return { ok: false, motivo: "El presupuesto mensual debe ser ≥ 0." };
      const nuevo: Concepto = { id: uid("k"), centroCostoId, nombre: nombre.trim(), presupuestoMensual: mensual, presupuestoPorMes: null, activo: true };
      return cambioCatalogo((p) => ({ ...p, conceptos: [...p.conceptos, nuevo] }), "Concepto creado", `Concepto "${nuevo.nombre}" (mensual ${mensual.toLocaleString("es-MX")}).`, motivo);
    },

    editarConcepto: (conceptoId, cambios, motivo) => {
      const prev = get().presupuesto.conceptos.find((c) => c.id === conceptoId);
      if (!prev) return { ok: false, motivo: "Concepto no encontrado." };
      const desc: string[] = [];
      if (cambios.nombre !== undefined && cambios.nombre.trim() !== prev.nombre) desc.push(`nombre → "${cambios.nombre.trim()}"`);
      if (cambios.presupuestoMensual !== undefined && cambios.presupuestoMensual !== prev.presupuestoMensual)
        desc.push(`mensual ${prev.presupuestoMensual.toLocaleString("es-MX")} → ${cambios.presupuestoMensual.toLocaleString("es-MX")}`);
      if (cambios.presupuestoPorMes !== undefined) desc.push("presupuesto por mes");
      return cambioCatalogo(
        (p) => ({
          ...p,
          conceptos: p.conceptos.map((c) =>
            c.id === conceptoId
              ? {
                  ...c,
                  nombre: cambios.nombre?.trim() || c.nombre,
                  presupuestoMensual: cambios.presupuestoMensual ?? c.presupuestoMensual,
                  presupuestoPorMes: cambios.presupuestoPorMes !== undefined ? cambios.presupuestoPorMes : c.presupuestoPorMes,
                }
              : c,
          ),
        }),
        "Concepto editado",
        `Concepto "${prev.nombre}"${desc.length ? `: ${desc.join(", ")}` : ""}.`,
        motivo,
      );
    },

    toggleConceptoActivo: (conceptoId, motivo) => {
      const prev = get().presupuesto.conceptos.find((c) => c.id === conceptoId);
      if (!prev) return { ok: false, motivo: "Concepto no encontrado." };
      const nuevo = !prev.activo;
      // Nunca hard-delete. Un concepto con erogado se conserva (su erogado sigue contando).
      return cambioCatalogo(
        (p) => ({ ...p, conceptos: p.conceptos.map((c) => (c.id === conceptoId ? { ...c, activo: nuevo } : c)) }),
        nuevo ? "Concepto activado" : "Concepto desactivado",
        `Concepto "${prev.nombre}" ${nuevo ? "activado" : "desactivado (historial conservado)"}.`,
        motivo,
      );
    },

    // ── Egresos (fuente Tesorería) ───────────────────────────
    registrarEgreso: (input) => {
      const { ahora } = get();
      const fecha = input.fecha ?? new Date(ahora).toISOString().slice(0, 10);
      const nuevo: EgresoTesoreria = {
        id: uid("teso"),
        fecha,
        monto: input.monto,
        proveedor: input.proveedor,
        concepto: input.concepto,
        categoria: input.categoria,
        estatus: input.estatus ?? "pagado",
        conceptoPresupuestalId: input.conceptoPresupuestalId,
      };
      setEgresos([nuevo, ...get().egresos]);
      return nuevo;
    },

    clasificarEgreso: (egresoId, conceptoPresupuestalId) => {
      setEgresos(get().egresos.map((e) => (e.id === egresoId ? { ...e, conceptoPresupuestalId } : e)));
      const c = get().presupuesto.conceptos.find((x) => x.id === conceptoPresupuestalId);
      set((s) => ({ auditoria: [...s.auditoria, entrada(get().usuario, "Egreso clasificado", `Egreso ${egresoId} clasificado en "${c?.nombre ?? conceptoPresupuestalId}".`)] }));
    },

    // ── Propuestas ───────────────────────────────────────────
    adoptarPropuesta: (propuestaId) => {
      const { propuestas, presupuesto, usuario } = get();
      const p = propuestas.find((x) => x.id === propuestaId);
      if (!p || p.estado !== "abierta") return;
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
        auditoria: [...s.auditoria, entrada(usuario, "Propuesta adoptada", `Propuesta de ${p.autor} adoptada como modificación presupuestal. Cambios: ${detalleCambios}.`)],
      }));
    },

    descartarPropuesta: (propuestaId, nota) => {
      const { propuestas, usuario } = get();
      const p = propuestas.find((x) => x.id === propuestaId);
      if (!p || p.estado !== "abierta") return;
      set((s) => ({
        propuestas: s.propuestas.map((x) => (x.id === propuestaId ? { ...x, estado: "descartada", nota: nota || x.nota } : x)),
        auditoria: [...s.auditoria, entrada(usuario, "Propuesta descartada", `Propuesta de ${p.autor} descartada. Nota: ${nota || "(sin nota)"}.`)],
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
  };
});

// Selector util para la integración con Tesorería (cascada Área→Centro→Concepto).
// Solo elementos ACTIVOS: el selector del "Nuevo egreso" refleja el catálogo vigente.
export function catalogoCascada(p: Presupuesto) {
  return p.areas
    .filter((a) => a.activo)
    .slice()
    .sort((a, b) => a.numero - b.numero)
    .map((area) => ({
      area,
      centros: p.centrosCosto
        .filter((cc) => cc.areaId === area.id && cc.activo)
        .map((centro) => ({
          centro,
          conceptos: p.conceptos.filter((c) => c.centroCostoId === centro.id && c.activo),
        })),
    }));
}

/** Presupuesto anual total (helper para KPIs y umbral de fondo). Solo activos. */
export function presupuestoAnualTotal(p: Presupuesto): number {
  return p.conceptos.filter((c) => c.activo).reduce((s, c) => s + presupuestoAnualConcepto(c), 0);
}
