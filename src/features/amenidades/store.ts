// =============================================================
// Portal Condominio · Amenidades — store (Zustand, mock)
// Máquina de estados del SLOT, doble caducidad (48h/24h), reloj de demo y
// conciliación STP simulada. Sin backend real: cada integración es `// SWAP POINT`.
// En memoria (sin persist) porque el estado es sensible al tiempo.
// =============================================================
import { create } from "zustand";
import type {
  AbonoExcepcion,
  BloqueoMantenimiento,
  EntradaAuditoria,
  EspacioReservable,
  EstadoSlot,
  Reserva,
} from "./types";
import { MOCK_ABONOS_EXCEPCION, MOCK_BLOQUEOS, MOCK_ESPACIOS, MOCK_RESERVAS } from "./mockData";
import { estadoDeSlot, limiteHold, limitePago } from "./logic";

// SWAP POINT: duraciones de caducidad y umbral de morosidad configurables por
// condominio (hoy constantes del módulo).
const CONFIG_DEFAULT = { holdHoras: 48, pagoHoras: 24, umbralMorosidadDias: 30 };

let secuencia = 200; // para códigos de reserva RSV-000xxx (demo)
function nuevoCodigo(): string {
  secuencia += 1;
  return `RSV-${String(secuencia).padStart(6, "0")}`;
}

function entrada(usuario: string, accion: string, detalle: string): EntradaAuditoria {
  return {
    id: `aud-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    timestamp: new Date().toISOString(),
    usuario,
    accion,
    detalle,
  };
}

export interface SolicitarInput {
  espacioId: string;
  fecha: string;
  franja: string;
  unidad: string;
  residenteNombre: string;
  unidadAlCorriente: boolean;
  saldoVencidoDias: number;
}

interface AmenidadesState {
  espacios: EspacioReservable[];
  reservas: Reserva[];
  bloqueos: BloqueoMantenimiento[];
  abonosExcepcion: AbonoExcepcion[];
  config: typeof CONFIG_DEFAULT;
  ahora: number; // reloj del módulo (ms). Avanza con el tiempo real o el demo.
  usuario: string;

  setUsuario: (n: string) => void;
  espacioById: (id: string) => EspacioReservable | undefined;
  reservaById: (id: string) => Reserva | undefined;

  // Transiciones
  solicitar: (input: SolicitarInput) => { ok: boolean; motivo?: string };
  validar: (reservaId: string) => void;
  rechazar: (reservaId: string, motivo: string) => void;
  conciliarPago: (reservaId: string, referenciaStp?: string) => void;
  bloquearMantenimiento: (b: Omit<BloqueoMantenimiento, "id" | "creadoPor">) => void;
  liberarMantenimiento: (bloqueoId: string) => void;

  // Reloj / caducidades / conciliación
  aplicarCaducidades: () => void;
  sincronizarReloj: () => void; // avanza a tiempo real (nunca retrocede) + caduca
  avanzarReloj: (horas: number) => void; // DEV
  simularAbonoStp: (reservaId: string) => void; // DEV

  reset: () => void;
}

export const useAmenidadesStore = create<AmenidadesState>((set, get) => {
  const mutarReserva = (
    reservaId: string,
    fn: (r: Reserva) => Reserva,
    audit?: { accion: string; detalle: string },
  ) => {
    set((s) => ({
      reservas: s.reservas.map((r) => {
        if (r.id !== reservaId) return r;
        const next = fn(r);
        if (!audit) return next;
        return { ...next, auditoria: [...next.auditoria, entrada(get().usuario, audit.accion, audit.detalle)] };
      }),
    }));
  };

  return {
    espacios: structuredClone(MOCK_ESPACIOS),
    reservas: structuredClone(MOCK_RESERVAS),
    bloqueos: structuredClone(MOCK_BLOQUEOS),
    abonosExcepcion: structuredClone(MOCK_ABONOS_EXCEPCION),
    config: { ...CONFIG_DEFAULT },
    ahora: Date.now(),
    usuario: "Administración (demo)",

    setUsuario: (n) => set({ usuario: n || "Administración (demo)" }),
    espacioById: (id) => get().espacios.find((e) => e.id === id),
    reservaById: (id) => get().reservas.find((r) => r.id === id),

    // disponible → apartado (con guarda de concurrencia)
    solicitar: (input) => {
      const s = get();
      // SWAP POINT: transacción atómica server-side sobre el slot para resolver
      // concurrencia. Hoy en mock: rechaza si el slot ya no está 'disponible'.
      const { estado } = estadoDeSlot(s.reservas, s.bloqueos, input.espacioId, input.fecha, input.franja);
      if (estado !== "disponible") {
        return { ok: false, motivo: "Ese horario ya no está disponible." };
      }
      const espacio = s.espacios.find((e) => e.id === input.espacioId);
      const cuota = espacio?.cuotaRenta ?? 0;
      const deposito = espacio?.depositoGarantia ?? 0;
      const nueva: Reserva = {
        id: `res-${Date.now()}-${Math.round(Math.random() * 1e5)}`,
        codigoReserva: null,
        espacioId: input.espacioId,
        fecha: input.fecha,
        franja: input.franja,
        estado: "apartado",
        unidad: input.unidad,
        residenteNombre: input.residenteNombre,
        unidadAlCorriente: input.unidadAlCorriente,
        saldoVencidoDias: input.saldoVencidoDias,
        cuota,
        deposito,
        montoTotal: cuota + deposito,
        pagoConciliado: false,
        referenciaStp: null,
        holdCreadoEn: new Date().toISOString(),
        pagoHabilitadoEn: null,
        motivoRechazo: null,
        auditoria: [
          entrada(
            `${input.residenteNombre} (${input.unidad})`,
            "Solicitud creada",
            `Apartó ${espacio?.nombre ?? input.espacioId} · ${input.franja} (${input.fecha}).`,
          ),
        ],
      };
      set((st) => ({ reservas: [...st.reservas, nueva] }));
      return { ok: true };
    },

    // apartado → por_pagar (o → reservada si el espacio es sin costo)
    validar: (reservaId) => {
      const s = get();
      const r = s.reservas.find((x) => x.id === reservaId);
      if (!r || r.estado !== "apartado") return;
      const espacio = s.espacios.find((e) => e.id === r.espacioId);
      const requierePago = !!espacio?.requierePago;
      if (!requierePago) {
        mutarReserva(
          reservaId,
          (rr) => ({ ...rr, estado: "reservada", codigoReserva: rr.codigoReserva ?? nuevoCodigo(), pagoConciliado: true }),
          { accion: "Reserva validada", detalle: "Espacio sin costo: confirmada directamente (sin pago)." },
        );
        return;
      }
      const codigo = nuevoCodigo();
      mutarReserva(
        reservaId,
        (rr) => ({ ...rr, estado: "por_pagar", codigoReserva: codigo, pagoHabilitadoEn: new Date().toISOString() }),
        {
          accion: "Reserva validada",
          detalle: `Elegibilidad confirmada. Código ${codigo}. CLABE habilitada; en espera de abono STP.`,
        },
      );
    },

    // apartado → disponible (rechazo admin)
    rechazar: (reservaId, motivo) => {
      const r = get().reservas.find((x) => x.id === reservaId);
      if (!r || r.estado !== "apartado") return;
      mutarReserva(
        reservaId,
        (rr) => ({ ...rr, estado: "disponible", motivoRechazo: motivo }),
        { accion: "Rechazada", detalle: `Motivo: ${motivo}. Slot liberado.` },
      );
    },

    // por_pagar → reservada (conciliación STP; NO acción manual de "ya pagué")
    conciliarPago: (reservaId, referenciaStp) => {
      const r = get().reservas.find((x) => x.id === reservaId);
      if (!r || r.estado !== "por_pagar") return;
      const ref = referenciaStp ?? `STP-${Math.floor(8000000 + Math.random() * 999999)}`;
      mutarReserva(
        reservaId,
        (rr) => ({ ...rr, estado: "reservada", pagoConciliado: true, referenciaStp: ref }),
        {
          accion: "Pago conciliado",
          detalle: `Abono $${r.montoTotal.toLocaleString("es-MX")} conciliado (ref ${ref}). Reserva confirmada.`,
        },
      );
    },

    bloquearMantenimiento: (b) =>
      set((s) => ({
        bloqueos: [
          ...s.bloqueos,
          { ...b, id: `blq-${Date.now()}`, creadoPor: get().usuario },
        ],
      })),

    liberarMantenimiento: (bloqueoId) =>
      set((s) => ({ bloqueos: s.bloqueos.filter((b) => b.id !== bloqueoId) })),

    aplicarCaducidades: () => {
      const { reservas, config, ahora, usuario } = get();
      let cambio = false;
      const next = reservas.map((r) => {
        if (r.estado === "apartado") {
          const lim = limiteHold(r, config.holdHoras);
          if (lim != null && ahora > lim) {
            cambio = true;
            return {
              ...r,
              estado: "disponible" as EstadoSlot,
              auditoria: [...r.auditoria, entrada("Sistema", "Hold caducado", "El apartado superó las 48 h de validación. Slot liberado.")],
            };
          }
        }
        if (r.estado === "por_pagar") {
          const lim = limitePago(r, config.pagoHoras);
          if (lim != null && ahora > lim) {
            cambio = true;
            return {
              ...r,
              estado: "disponible" as EstadoSlot,
              auditoria: [...r.auditoria, entrada("Sistema", "Ventana de pago caducada", "No se concilió el abono en 24 h. Slot liberado.")],
            };
          }
        }
        return r;
      });
      if (cambio) set({ reservas: next });
    },

    sincronizarReloj: () => {
      set((s) => ({ ahora: Math.max(s.ahora, Date.now()) }));
      get().aplicarCaducidades();
    },

    avanzarReloj: (horas) => {
      set((s) => ({ ahora: s.ahora + horas * 3600_000 }));
      get().aplicarCaducidades();
    },

    simularAbonoStp: (reservaId) => get().conciliarPago(reservaId),

    reset: () =>
      set({
        espacios: structuredClone(MOCK_ESPACIOS),
        reservas: structuredClone(MOCK_RESERVAS),
        bloqueos: structuredClone(MOCK_BLOQUEOS),
        abonosExcepcion: structuredClone(MOCK_ABONOS_EXCEPCION),
        config: { ...CONFIG_DEFAULT },
        ahora: Date.now(),
      }),
  };
});
