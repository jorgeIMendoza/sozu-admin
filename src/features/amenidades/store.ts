// =============================================================
// Portal Condominio · Amenidades — store (Zustand, mock)
// UN catálogo `amenidades`; `espacios` (lo que consume el motor de reservas) se
// DERIVA de las amenidades reservable && activo. La máquina de estados del slot,
// la doble caducidad (48h/24h) y la conciliación STP simulada quedan intactas:
// solo cambia su FUENTE de datos y se agrega el CRUD del catálogo.
// En memoria (sin persist) porque el estado de reservas es sensible al tiempo.
// SWAP POINT: persistencia real (BD/Storage) y localStorage opcional del catálogo.
// =============================================================
import { create } from "zustand";
import type {
  AbonoExcepcion,
  Amenidad,
  BloqueoMantenimiento,
  ConfiguracionReserva,
  EntradaAuditoria,
  EspacioReservable,
  EstadoSlot,
  ModalidadUso,
  MediaItem,
  Reserva,
  TipoAmenidad,
} from "./types";
import { MOCK_ABONOS_EXCEPCION, MOCK_AMENIDADES, MOCK_BLOQUEOS, MOCK_RESERVAS } from "./mockData";
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

/**
 * Deriva la lista que consume el motor de reservas a partir del catálogo.
 * Solo amenidades reservable && activo entran al calendario/bandejas.
 * `requierePago` = modeloCobro no gratuito y (tarifa + depósito) > 0.
 */
export function derivarEspacios(amenidades: Amenidad[]): EspacioReservable[] {
  return amenidades
    .filter((a) => a.modalidadUso === "reservable" && a.activo && a.reserva)
    .map((a) => {
      const r = a.reserva as ConfiguracionReserva;
      const requierePago = r.modeloCobro !== "gratuito" && r.tarifa + r.depositoGarantia > 0;
      return {
        id: a.id,
        nombre: a.nombre,
        tipo: a.tipo,
        capacidad: r.capacidad,
        cuotaRenta: r.tarifa,
        depositoGarantia: r.depositoGarantia,
        requierePago,
        franjasHorarias: r.franjasHorarias,
        clabeStp: r.clabeStp,
        activo: a.activo,
      };
    });
}

// Valores editables de una amenidad (lo que produce el editor de ficha).
export interface AmenidadFormValues {
  nombre: string;
  tipo: TipoAmenidad;
  ubicacion: string;
  descripcion: string;
  media: MediaItem[];
  modalidadUso: ModalidadUso;
  reserva: ConfiguracionReserva | null;
}

// Normaliza integridad: libre ⇒ reserva null; reservable ⇒ reserva obligatorio.
function normalizar(v: AmenidadFormValues): AmenidadFormValues {
  if (v.modalidadUso === "libre") return { ...v, reserva: null };
  return v;
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
  amenidades: Amenidad[];
  espacios: EspacioReservable[]; // DERIVADO de amenidades (recalculado en cada mutación de catálogo)
  reservas: Reserva[];
  bloqueos: BloqueoMantenimiento[];
  abonosExcepcion: AbonoExcepcion[];
  config: typeof CONFIG_DEFAULT;
  ahora: number; // reloj del módulo (ms). Avanza con el tiempo real o el demo.
  usuario: string;

  setUsuario: (n: string) => void;
  amenidadById: (id: string) => Amenidad | undefined;
  espacioById: (id: string) => EspacioReservable | undefined;
  reservaById: (id: string) => Reserva | undefined;

  // CRUD del catálogo
  crearAmenidad: (v: AmenidadFormValues) => string;
  editarAmenidad: (id: string, v: AmenidadFormValues) => void;
  toggleActivo: (id: string) => void;

  // Transiciones del motor de reservas (sin cambios)
  solicitar: (input: SolicitarInput) => { ok: boolean; motivo?: string };
  validar: (reservaId: string) => void;
  rechazar: (reservaId: string, motivo: string) => void;
  conciliarPago: (reservaId: string, referenciaStp?: string) => void;
  bloquearMantenimiento: (b: Omit<BloqueoMantenimiento, "id" | "creadoPor">) => void;
  liberarMantenimiento: (bloqueoId: string) => void;

  // Reloj / caducidades / conciliación
  aplicarCaducidades: () => void;
  sincronizarReloj: () => void;
  avanzarReloj: (horas: number) => void; // DEV
  simularAbonoStp: (reservaId: string) => void; // DEV

  reset: () => void;
}

const AMENIDADES_INIT = structuredClone(MOCK_AMENIDADES);

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

  // Aplica un cambio al catálogo y recalcula `espacios` en la misma transacción.
  const setCatalogo = (amenidades: Amenidad[]) =>
    set({ amenidades, espacios: derivarEspacios(amenidades) });

  return {
    amenidades: structuredClone(AMENIDADES_INIT),
    espacios: derivarEspacios(AMENIDADES_INIT),
    reservas: structuredClone(MOCK_RESERVAS),
    bloqueos: structuredClone(MOCK_BLOQUEOS),
    abonosExcepcion: structuredClone(MOCK_ABONOS_EXCEPCION),
    config: { ...CONFIG_DEFAULT },
    ahora: Date.now(),
    usuario: "Administración (demo)",

    setUsuario: (n) => set({ usuario: n || "Administración (demo)" }),
    amenidadById: (id) => get().amenidades.find((a) => a.id === id),
    espacioById: (id) => get().espacios.find((e) => e.id === id),
    reservaById: (id) => get().reservas.find((r) => r.id === id),

    // ── CRUD del catálogo ────────────────────────────────────
    crearAmenidad: (v) => {
      const val = normalizar(v);
      const id = `amn-${Date.now()}-${Math.round(Math.random() * 1e4)}`;
      const nueva: Amenidad = {
        id,
        condominioId: "margot", // SWAP POINT: condominio activo real; nunca default a 1
        nombre: val.nombre,
        tipo: val.tipo,
        ubicacion: val.ubicacion,
        descripcion: val.descripcion,
        media: val.media,
        modalidadUso: val.modalidadUso,
        reserva: val.reserva,
        activo: true,
        auditoria: [
          entrada(
            get().usuario,
            "Amenidad creada",
            `Alta de ${val.nombre} (${val.modalidadUso === "reservable" ? "reservable" : "uso libre"}).`,
          ),
        ],
      };
      setCatalogo([...get().amenidades, nueva]);
      return id;
    },

    editarAmenidad: (id, v) => {
      const val = normalizar(v);
      const next = get().amenidades.map((a) => {
        if (a.id !== id) return a;
        const cambios: string[] = [];
        if (a.nombre !== val.nombre) cambios.push("nombre");
        if (a.tipo !== val.tipo) cambios.push("tipo");
        if (a.ubicacion !== val.ubicacion) cambios.push("ubicación");
        if (a.descripcion !== val.descripcion) cambios.push("descripción");
        if (a.media.length !== val.media.length) cambios.push("media");
        if (a.modalidadUso !== val.modalidadUso) cambios.push(`modalidad → ${val.modalidadUso}`);
        if (JSON.stringify(a.reserva) !== JSON.stringify(val.reserva)) cambios.push("config. de reserva");
        return {
          ...a,
          nombre: val.nombre,
          tipo: val.tipo,
          ubicacion: val.ubicacion,
          descripcion: val.descripcion,
          media: val.media,
          modalidadUso: val.modalidadUso,
          reserva: val.reserva,
          auditoria: [
            ...a.auditoria,
            entrada(get().usuario, "Amenidad actualizada", cambios.length ? `Cambios: ${cambios.join(", ")}.` : "Sin cambios de campos."),
          ],
        };
      });
      setCatalogo(next);
    },

    // Soft-disable / re-enable. NUNCA hard-delete: preserva historial de reservas.
    toggleActivo: (id) => {
      const next = get().amenidades.map((a) => {
        if (a.id !== id) return a;
        const activo = !a.activo;
        return {
          ...a,
          activo,
          auditoria: [
            ...a.auditoria,
            entrada(
              get().usuario,
              activo ? "Amenidad activada" : "Amenidad desactivada",
              activo
                ? `${a.nombre} vuelve a estar disponible en el catálogo.`
                : `${a.nombre} se retira del catálogo${a.modalidadUso === "reservable" ? " y del motor de reservas (historial preservado)" : ""}.`,
            ),
          ],
        };
      });
      setCatalogo(next);
    },

    // ── Motor de reservas (preservado) ───────────────────────
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
      const { reservas, config, ahora } = get();
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

    reset: () => {
      const amenidades = structuredClone(MOCK_AMENIDADES);
      set({
        amenidades,
        espacios: derivarEspacios(amenidades),
        reservas: structuredClone(MOCK_RESERVAS),
        bloqueos: structuredClone(MOCK_BLOQUEOS),
        abonosExcepcion: structuredClone(MOCK_ABONOS_EXCEPCION),
        config: { ...CONFIG_DEFAULT },
        ahora: Date.now(),
      });
    },
  };
});
