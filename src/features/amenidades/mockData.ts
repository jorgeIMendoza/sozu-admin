// =============================================================
// Portal Condominio · Amenidades — datos mock (solo Catálogo)
// UN catálogo `Amenidad`: 9 espacios reservables de Margot (migrados desde el
// modelo anterior) + amenidades de uso libre (Gimnasio, Lobby, Sky Bar…).
// Desarrollo "Margot" explícito (nunca id_proyecto=1 por defecto).
//
// El motor de reservas arranca SIN datos hardcodeados: reservas, bloqueos y
// abonos STP quedan vacíos. Solo el Catálogo trae información. Las reservas
// reales llegarán por el flujo del residente + conciliación STP. // SWAP POINT.
// SWAP POINT: en real, el catálogo vendría de BD (amenidades_proyectos) y la
// media de Supabase Storage; aquí todo es mock local.
// =============================================================
import type {
  AbonoExcepcion,
  Amenidad,
  BloqueoMantenimiento,
  ConfiguracionReserva,
  MediaItem,
  ModeloCobro,
  Reserva,
  TipoAmenidad,
} from "./types";

const CONDOMINIO = "margot"; // NUNCA default a 1

// Base temporal capturada una vez (runtime de la app), para el sello de
// auditoría del alta inicial del catálogo.
const BASE = Date.now();
const H = 3600_000;
const isoFromBase = (hrs: number) => new Date(BASE + hrs * H).toISOString();

const FRANJAS_SALA = ["08:00-10:00", "10:00-12:00", "12:00-14:00", "16:00-18:00"];
const FRANJAS_ASADOR = ["10:00-14:00", "14:00-18:00", "18:00-22:00"];
const FRANJAS_COCINA = ["10:00-14:00", "14:00-18:00", "18:00-22:00"];

// SWAP POINT: media real desde Supabase Storage. En mock usamos el placeholder
// local del proyecto; el video se representa como item (sin archivo real).
const PH = "/placeholder.svg";
function img(id: string, orden: number, esPortada = false, titulo?: string): MediaItem {
  return { id, tipo: "imagen", url: PH, orden, esPortada, titulo };
}
function vid(id: string, orden: number, titulo?: string): MediaItem {
  return { id, tipo: "video", url: PH, orden, titulo };
}

function reservaCfg(
  modeloCobro: ModeloCobro,
  tarifa: number,
  depositoGarantia: number,
  franjasHorarias: string[],
  capacidad: number,
  clabeStp: string,
  umbralMorosidadDias: number | null = 30,
): ConfiguracionReserva {
  return {
    modeloCobro,
    tarifa,
    depositoGarantia,
    franjasHorarias,
    capacidad,
    clabeStp,
    requiereValidacionAdmin: true,
    umbralMorosidadDias,
  };
}

function amenidad(
  id: string,
  nombre: string,
  tipo: TipoAmenidad,
  ubicacion: string,
  descripcion: string,
  media: MediaItem[],
  reserva: ConfiguracionReserva | null,
): Amenidad {
  return {
    id,
    condominioId: CONDOMINIO,
    nombre,
    tipo,
    ubicacion,
    descripcion,
    media,
    modalidadUso: reserva ? "reservable" : "libre",
    reserva,
    activo: true,
    auditoria: [
      {
        id: `aud-seed-${id}`,
        timestamp: isoFromBase(-240),
        usuario: "Carga inicial",
        accion: "Amenidad creada",
        detalle: `Alta inicial de ${nombre} (${reserva ? "reservable" : "uso libre"}).`,
      },
    ],
  };
}

export const MOCK_AMENIDADES: Amenidad[] = [
  // ── Reservables (9, migrados) ────────────────────────────
  amenidad("esp-sj1", "Sala de Juntas 1", "sala_juntas", "Torre A · Piso 2",
    "Sala equipada para juntas de condóminos y reuniones privadas. Proyector y pizarrón.",
    [img("m-sj1-1", 0, true)],
    reservaCfg("por_hora", 300, 500, FRANJAS_SALA, 10, "646180157000000001")),
  amenidad("esp-sj2", "Sala de Juntas 2", "sala_juntas", "Torre A · Piso 2",
    "Sala de juntas mediana con mesa central para reuniones de comité.",
    [img("m-sj2-1", 0, true)],
    reservaCfg("por_hora", 300, 500, FRANJAS_SALA, 8, "646180157000000002")),
  // Sin costo: prueba el camino apartado → validado → reservada (salta por_pagar).
  amenidad("esp-tv", "Sala de TV", "sala_tv", "Torre B · PB",
    "Sala de proyección y TV para uso recreativo de los residentes.",
    [img("m-tv-1", 0, true)],
    reservaCfg("gratuito", 0, 0, ["16:00-18:00", "18:00-20:00", "20:00-22:00"], 12, "646180157000000003", null)),
  amenidad("esp-as1", "Asador 1", "asador", "Roof Garden · Torre A",
    "Área de asador con parrilla, mesa y bancas. Vista a la ciudad.",
    [img("m-as1-1", 0, true)],
    reservaCfg("por_uso", 250, 400, FRANJAS_ASADOR, 15, "646180157000000004")),
  amenidad("esp-as2", "Asador 2", "asador", "Roof Garden · Torre A",
    "Área de asador con parrilla y comedor exterior techado.",
    [img("m-as2-1", 0, true)],
    reservaCfg("por_uso", 250, 400, FRANJAS_ASADOR, 15, "646180157000000005")),
  amenidad("esp-as3", "Asador 3", "asador", "Roof Garden · Torre B",
    "Asador con parrilla de gas y área de convivencia.",
    [img("m-as3-1", 0, true)],
    reservaCfg("por_uso", 250, 400, FRANJAS_ASADOR, 15, "646180157000000006")),
  amenidad("esp-as4", "Asador 4", "asador", "Roof Garden · Torre B",
    "Asador con vista panorámica y mobiliario exterior.",
    [img("m-as4-1", 0, true)],
    reservaCfg("por_uso", 250, 400, FRANJAS_ASADOR, 15, "646180157000000007")),
  amenidad("esp-coA", "Cocina Equipada A", "cocina_equipada", "Salón de eventos · PB",
    "Cocina equipada para eventos privados: estufa, horno, refrigerador y barra.",
    [img("m-coA-1", 0, true)],
    reservaCfg("por_uso", 500, 800, FRANJAS_COCINA, 20, "646180157000000008")),
  amenidad("esp-coB", "Cocina Equipada B", "cocina_equipada", "Salón de eventos · PB",
    "Segunda cocina equipada con comedor amplio para reuniones familiares.",
    [img("m-coB-1", 0, true)],
    reservaCfg("por_uso", 500, 800, FRANJAS_COCINA, 20, "646180157000000009")),

  // ── Uso libre (catálogo promocional, sin motor de reservas) ─
  amenidad("amn-gym", "Gimnasio", "gimnasio", "Torre A · Piso 1",
    "Gimnasio equipado con cardio, peso libre y área funcional. Acceso libre con credencial.",
    [img("m-gym-1", 0, true), img("m-gym-2", 1), vid("m-gym-3", 2, "Recorrido del gimnasio")],
    null),
  amenidad("amn-lobby", "Lobby", "lobby", "Torre A · PB",
    "Recepción principal con sala de espera y atención a visitantes.",
    [img("m-lobby-1", 0, true)],
    null),
  amenidad("amn-skybar", "Sky Bar", "sky_bar", "Roof · Torre A",
    "Terraza-bar en la azotea con vista panorámica. Uso libre para residentes.",
    [img("m-sky-1", 0, true), img("m-sky-2", 1)],
    null),
  amenidad("amn-roof", "Roof Garden", "roof_garden", "Azotea · Torre B",
    "Jardín en azotea con áreas verdes y zonas de descanso.",
    [img("m-roof-1", 0, true)],
    null),
  amenidad("amn-juegos", "Sala de Juegos", "sala_juegos", "Torre B · Piso 1",
    "Sala lúdica con mesa de billar, futbolito y juegos de mesa.",
    [img("m-juegos-1", 0, true)],
    null),
  amenidad("amn-cowork", "Coworking", "coworking", "Torre A · Piso 3",
    "Espacio de trabajo compartido con internet de alta velocidad y cabinas.",
    [img("m-cowork-1", 0, true)],
    null),
];

// ── Motor de reservas: SIN datos hardcodeados ──────────────
// El calendario arranca vacío (todo disponible), las bandejas sin pendientes y
// los KPIs en 0. Las reservas reales entran por el flujo del residente y la
// conciliación STP. // SWAP POINT.
export const MOCK_RESERVAS: Reserva[] = [];
export const MOCK_BLOQUEOS: BloqueoMantenimiento[] = [];
export const MOCK_ABONOS_EXCEPCION: AbonoExcepcion[] = [];
