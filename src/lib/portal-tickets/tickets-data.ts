// Capa de datos del Portal Tickets de Seguimiento.
// Datos semilla deterministas (aún sin tablas en BD); la UI es 100% funcional
// sobre el store en memoria.

export type Priority = "alta" | "media" | "baja" | "sin";

export type Ticket = {
  id: string;
  numero: number;
  nombre: string;
  pipelineId: string;
  etapaId: string;
  prioridad: Priority;
  categoriaId: string;
  propietarioId: string | null;
  solicitante: string;
  inmueble: string;
  descripcion: string;
  fechaCreacion: string;
  fechaCierre: string | null;
  fuente: string;
  actividad: { id: string; fecha: string; autor: string; texto: string }[];
};

export type Pipeline = { id: string; nombre: string; descripcion: string };
export type Etapa = {
  id: string;
  pipelineId: string;
  nombre: string;
  orden: number;
  cerrada: boolean;
};
export type Categoria = { id: string; nombre: string };
export type Agente = { id: string; nombre: string; rol: string; email: string };

export const PRIORIDADES: { id: Priority; nombre: string }[] = [
  { id: "alta", nombre: "Alta" },
  { id: "media", nombre: "Media" },
  { id: "baja", nombre: "Baja" },
  { id: "sin", nombre: "Sin prioridad" },
];

export const PIPELINES_SEED: Pipeline[] = [
  {
    id: "p-atencion",
    nombre: "Atención al Cliente",
    descripcion: "Reportes de residentes y clientes finales",
  },
  {
    id: "p-mantenimiento",
    nombre: "Mantenimiento Interno",
    descripcion: "Órdenes de trabajo generadas por el equipo de operación",
  },
];

export const ETAPAS_SEED: Etapa[] = [
  { id: "e-nuevo", pipelineId: "p-atencion", nombre: "Nuevo", orden: 1, cerrada: false },
  { id: "e-asignado", pipelineId: "p-atencion", nombre: "Asignado para atención", orden: 2, cerrada: false },
  { id: "e-revision", pipelineId: "p-atencion", nombre: "En revisión", orden: 3, cerrada: false },
  { id: "e-cerrado", pipelineId: "p-atencion", nombre: "Cerrado", orden: 4, cerrada: true },
  { id: "m-solicitud", pipelineId: "p-mantenimiento", nombre: "Solicitud", orden: 1, cerrada: false },
  { id: "m-programado", pipelineId: "p-mantenimiento", nombre: "Programado", orden: 2, cerrada: false },
  { id: "m-ejecucion", pipelineId: "p-mantenimiento", nombre: "En ejecución", orden: 3, cerrada: false },
  { id: "m-cerrado", pipelineId: "p-mantenimiento", nombre: "Cerrado", orden: 4, cerrada: true },
];

export const CATEGORIAS_SEED: Categoria[] = [
  { id: "c-calentador", nombre: "Calentador Eléctrico" },
  { id: "c-carpinteria", nombre: "Carpintería" },
  { id: "c-agua", nombre: "Agua y drenaje" },
  { id: "c-infra", nombre: "Desperfecto Infraestructura" },
  { id: "c-electricidad", nombre: "Electricidad" },
  { id: "c-plomeria", nombre: "Plomería" },
  { id: "c-pintura", nombre: "Pintura y acabados" },
  { id: "c-cerrajeria", nombre: "Cerrajería" },
  { id: "c-jardineria", nombre: "Jardinería y áreas comunes" },
  { id: "c-limpieza", nombre: "Limpieza" },
];

export const AGENTES_SEED: Agente[] = [
  { id: "a-isabel", nombre: "Isabel Hernández", rol: "Agente de soporte", email: "isabel.h@sozu.mx" },
  { id: "a-jose", nombre: "José Ramírez", rol: "Coordinador de mantenimiento", email: "jose.r@sozu.mx" },
  { id: "a-abel", nombre: "Abel Salazar", rol: "Supervisor de zona", email: "abel.s@sozu.mx" },
  { id: "a-lupita", nombre: "Lupita Torres", rol: "Agente de soporte", email: "lupita.t@sozu.mx" },
  { id: "a-liliana", nombre: "Liliana Elizabeth", rol: "Agente de soporte", email: "liliana.e@sozu.mx" },
  { id: "a-sergio", nombre: "Sergio Machuca", rol: "Super Administrador", email: "sergio.m@sozu.mx" },
];

export const USUARIO_ACTUAL = AGENTES_SEED[5];

const APELLIDOS = [
  "Bernal García", "Cárdenas", "Chang", "González García", "Luna", "Buendía",
  "Castañón", "Arias Bermúdez", "Saenz Solis", "Ochoa Camacho", "Cruz Bernal",
  "Ortega Ramírez", "Herrador Collado", "Villalobos", "Nájera", "Del Valle",
  "Zepeda", "Ibarra", "Rentería", "Quintero",
];

const ASUNTOS = [
  "grieta en muro", "regadera sin presión", "calentador no enciende",
  "puertas hinchadas", "fuga en tarja", "apagador sin corriente",
  "humedad en plafón", "chapa dañada", "drenaje tapado",
  "pintura descarapelada", "ventana no cierra", "boiler con fuga",
  "lámpara fundida en pasillo", "portón automático atascado", "cisterna con sedimento",
];

const INMUEBLES = [
  "Torre A - Depto 302", "Torre B - Depto 108", "Residencial Alameda 14",
  "Torre C - PH 2", "Condominio Roble 7", "Torre A - Depto 505", "Casa Club",
  "Villas del Sol 23", "Torre D - Depto 210", "Plaza Central - Local 4",
];

export const FUENTES = ["Portal", "Correo", "Teléfono", "WhatsApp", "Visita en sitio"];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AHORA = new Date("2026-07-30T18:00:00Z").getTime();

export function generarTickets(cantidad = 168): Ticket[] {
  const rnd = mulberry32(20260730);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const dia = 86400000;

  const tickets: Ticket[] = [];
  for (let i = 0; i < cantidad; i++) {
    const pipeline = rnd() < 0.72 ? PIPELINES_SEED[0] : PIPELINES_SEED[1];
    const etapas = ETAPAS_SEED.filter((e) => e.pipelineId === pipeline.id);
    const r = rnd();
    const etapa = r < 0.32 ? etapas[0] : r < 0.5 ? etapas[1] : r < 0.62 ? etapas[2] : etapas[3];
    const creado = new Date(AHORA - Math.floor(rnd() * 420 + 1) * dia);
    const cerrado = etapa.cerrada
      ? new Date(creado.getTime() + Math.floor(rnd() * 30 + 2) * dia)
      : null;
    const sinAsignar =
      etapa.id === "e-nuevo" || etapa.id === "m-solicitud" ? rnd() < 0.55 : rnd() < 0.08;
    const propietario = sinAsignar ? null : pick(AGENTES_SEED).id;
    const numero = 1000 + i * 3 + Math.floor(rnd() * 3);
    const asunto = pick(ASUNTOS);
    const solicitante = pick(APELLIDOS);
    const prioridad: Priority =
      etapa.id === "e-nuevo" || etapa.id === "m-solicitud"
        ? rnd() < 0.5
          ? "sin"
          : pick(["alta", "media", "baja"] as Priority[])
        : pick(["alta", "media", "media", "baja"] as Priority[]);
    const categoria = pick(CATEGORIAS_SEED);
    const inmueble = pick(INMUEBLES);

    tickets.push({
      id: `t-${numero}-${i}`,
      numero,
      nombre: `${numero} - ${asunto}`,
      pipelineId: pipeline.id,
      etapaId: etapa.id,
      prioridad,
      categoriaId: categoria.id,
      propietarioId: propietario,
      solicitante,
      inmueble,
      descripcion: `El residente ${solicitante} reporta ${asunto} en ${inmueble}. Se requiere visita técnica para diagnóstico y cotización de la reparación.`,
      fechaCreacion: creado.toISOString(),
      fechaCierre: cerrado ? cerrado.toISOString() : null,
      fuente: pick(FUENTES),
      actividad: [
        {
          id: `act-${i}-1`,
          fecha: creado.toISOString(),
          autor: "Sistema",
          texto: `Ticket creado desde ${pick(FUENTES)}.`,
        },
        ...(propietario
          ? [
              {
                id: `act-${i}-2`,
                fecha: new Date(creado.getTime() + dia).toISOString(),
                autor: "Sistema",
                texto: `Asignado a ${AGENTES_SEED.find((a) => a.id === propietario)!.nombre}.`,
              },
            ]
          : []),
        ...(cerrado
          ? [
              {
                id: `act-${i}-3`,
                fecha: cerrado.toISOString(),
                autor: "Sistema",
                texto: "Ticket cerrado. Trabajo verificado con el residente.",
              },
            ]
          : []),
      ],
    });
  }
  return tickets.sort(
    (a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime(),
  );
}

export function antiguedad(iso: string) {
  const dias = Math.floor((AHORA - new Date(iso).getTime()) / 86400000);
  if (dias < 1) return "Abierto hoy";
  if (dias < 30) return `Abierto por ${dias} día${dias === 1 ? "" : "s"}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `Abierto por ${meses} mes${meses === 1 ? "" : "es"}`;
  const anios = Math.floor(meses / 12);
  return `Abierto por ${anios === 1 ? "un año" : `${anios} años`}`;
}

const TZ = "America/Mexico_City";

export function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  });
}

export function fechaLarga(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}