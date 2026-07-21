// =============================================================
// Portal Condominio · Titularidad — store (Zustand, mock)
// Estado en memoria con updates inmutables y auditoría append-only.
// Persistencia en localStorage SOLO para la demo (no es fuente de verdad).
// Sin backend real: cada acción de decisión es un `// SWAP POINT` documentado
// en la UI del detalle.
// =============================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AreaAsignada,
  EntradaAuditoria,
  EstadoRegistral,
  EstadoValidacion,
  NivelSolicitado,
  SolicitudTitularidad,
} from "./types";
import { MOCK_SOLICITUDES } from "./mockData";

function nuevaEntrada(usuario: string, accion: string, detalle: string): EntradaAuditoria {
  return {
    // id estable-suficiente para la demo (no colisiona en la práctica)
    id: `aud-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    timestamp: new Date().toISOString(),
    usuario,
    accion,
    detalle,
  };
}

interface TitularidadState {
  solicitudes: SolicitudTitularidad[];
  usuario: string; // revisor actual (para la bitácora)
  setUsuario: (nombre: string) => void;
  getById: (id: string) => SolicitudTitularidad | undefined;

  // Documentos / datos extraídos
  setDocumentoEstado: (
    solicitudId: string,
    documentoId: string,
    estado: EstadoValidacion,
    motivo?: string,
  ) => void;

  // Verificación humana
  setVerificacionRegistral: (solicitudId: string, estado: EstadoRegistral) => void;
  setPoderFacultades: (solicitudId: string, value: boolean | null) => void;
  setCadenaDominioConfirmada: (solicitudId: string, value: boolean) => void;

  // Ruteo / decisión
  asignarArea: (solicitudId: string, area: AreaAsignada) => void;
  aprobar: (solicitudId: string, nivel: NivelSolicitado) => void;
  rechazar: (solicitudId: string, motivo: string) => void;
  solicitarInfo: (solicitudId: string, nota: string) => void;

  reset: () => void;
}

const ESTADO_DOC_LABEL: Record<EstadoValidacion, string> = {
  validado: "Validado",
  rechazado: "Rechazado",
  por_confirmar: "Por confirmar",
  en_revision: "En revisión",
  expirado: "Expirado",
};

const REGISTRAL_LABEL: Record<EstadoRegistral, string> = {
  no_iniciada: "No iniciada",
  en_gestion: "En gestión",
  verificado: "Verificado",
  no_verificable: "No verificable",
};

export const useTitularidadStore = create<TitularidadState>()(
  persist(
    (set, get) => {
      // Aplica una transformación a una solicitud por id (inmutable) y
      // opcionalmente añade una entrada de auditoría (append-only).
      const mutar = (
        solicitudId: string,
        fn: (s: SolicitudTitularidad) => SolicitudTitularidad,
        audit?: { accion: string; detalle: string },
      ) => {
        set((state) => ({
          solicitudes: state.solicitudes.map((s) => {
            if (s.id !== solicitudId) return s;
            const next = fn(s);
            if (!audit) return next;
            const entrada = nuevaEntrada(get().usuario, audit.accion, audit.detalle);
            return { ...next, auditoria: [...next.auditoria, entrada] };
          }),
        }));
      };

      return {
        solicitudes: structuredClone(MOCK_SOLICITUDES),
        usuario: "Revisor (demo)",
        setUsuario: (nombre) => set({ usuario: nombre || "Revisor (demo)" }),
        getById: (id) => get().solicitudes.find((s) => s.id === id),

        setDocumentoEstado: (solicitudId, documentoId, estado, motivo) => {
          let docNombre = documentoId;
          mutar(
            solicitudId,
            (s) => ({
              ...s,
              documentos: s.documentos.map((d) => {
                if (d.id !== documentoId) return d;
                docNombre = d.nombreArchivo;
                return {
                  ...d,
                  estado,
                  motivoRechazo: estado === "rechazado" ? motivo ?? d.motivoRechazo : undefined,
                };
              }),
            }),
            {
              accion: `Marcó documento: ${ESTADO_DOC_LABEL[estado]}`,
              detalle:
                `${docNombre}` +
                (estado === "rechazado" && motivo ? ` · Motivo: ${motivo}` : ""),
            },
          );
        },

        setVerificacionRegistral: (solicitudId, estado) =>
          mutar(solicitudId, (s) => ({ ...s, verificacionRegistral: estado }), {
            accion: "Verificación registral",
            detalle: `Estado: ${REGISTRAL_LABEL[estado]} (confirmación de certificado RPP por folio real).`,
          }),

        setPoderFacultades: (solicitudId, value) =>
          mutar(solicitudId, (s) => ({ ...s, poderConFacultadesDominio: value }), {
            accion: "Revisión del poder (persona moral)",
            detalle:
              value === true
                ? "Poder con facultades de actos de dominio: Sí."
                : value === false
                  ? "Poder con facultades de actos de dominio: No."
                  : "Poder pendiente de revisión legal.",
          }),

        setCadenaDominioConfirmada: (solicitudId, value) =>
          mutar(solicitudId, (s) => ({ ...s, cadenaDominioConfirmada: value }), {
            accion: "Confirmación de cadena de dominio",
            detalle: value
              ? "Cadena de dominio confirmada por el revisor (independiente del semáforo automático)."
              : "Cadena de dominio marcada como NO confirmada por el revisor.",
          }),

        asignarArea: (solicitudId, area) =>
          mutar(solicitudId, (s) => ({ ...s, areaAsignada: area }), {
            accion: "Asignó área",
            detalle: `Ruteada al área: ${area}.`,
          }),

        aprobar: (solicitudId, nivel) =>
          mutar(
            solicitudId,
            (s) => ({ ...s, estado: "aprobada", nivelOtorgado: nivel, motivoRechazo: undefined }),
            {
              accion: `Aprobó Nivel ${nivel}`,
              detalle:
                nivel === 1
                  ? "Titularidad provisional reconocida para administración/cobro de mantenimiento."
                  : "Titularidad reconocida (Nivel 2): verificación registral + cadena de dominio confirmadas.",
            },
          ),

        rechazar: (solicitudId, motivo) =>
          mutar(solicitudId, (s) => ({ ...s, estado: "rechazada", motivoRechazo: motivo }), {
            accion: "Rechazó solicitud",
            detalle: `Motivo (visible al solicitante): ${motivo}`,
          }),

        solicitarInfo: (solicitudId, nota) =>
          mutar(solicitudId, (s) => ({ ...s, estado: "info_solicitada" }), {
            accion: "Solicitó más documentación",
            detalle: `Nota al solicitante: ${nota}`,
          }),

        reset: () =>
          set({ solicitudes: structuredClone(MOCK_SOLICITUDES), usuario: "Revisor (demo)" }),
      };
    },
    {
      // version bump: descarta el estado persistido con solicitudes semilla
      // (datos hardcodeados eliminados) y rehidrata desde el estado vacío.
      name: "sozu-titularidad-demo",
      version: 2,
    },
  ),
);
