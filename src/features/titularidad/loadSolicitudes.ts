// =============================================================
// Portal Condominio · Titularidad — carga REAL (Fase 1: solo lectura)
// Lee `solicitudes_propietario` (las crea el onboarding público de propietarios
// vía la Edge Function registrar-solicitud-propietario) y las mapea al modelo
// SolicitudTitularidad que consume la bandeja/detalle. Waterfall explícito
// (nunca joins anidados de PostgREST). Las acciones de decisión siguen en memoria
// hasta la Fase 2 (RPC de aprobación + reasignación de titularidad).
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import type {
  Campo,
  Cruce,
  DocumentoExpediente,
  EstadoSolicitud,
  EstadoValidacion,
  Semaforo,
  SolicitudTitularidad,
  TipoDocumento,
  TipoPersona,
} from "./types";

// tablas nuevas / sin tipos generados → cast a any (patrón del proyecto)
const sb = supabase as unknown as {
  from: (t: string) => any;
};

const IDS_VACIO = [-1]; // .in() nunca vacío

function campo<T>(valor: T | null, estado: EstadoValidacion = "en_revision"): Campo<T> {
  return { valor, estado, idDocumentoFuente: null };
}

const ESTATUS_A_ESTADO: Record<string, EstadoSolicitud> = {
  pendiente: "nueva",
  en_revision: "en_revision",
  aprobada_n1: "aprobada",
  aprobada_n2: "aprobada",
  rechazada: "rechazada",
};

// id_tipo_documento → tipo del expediente (verificado 2026-08-08).
const TIPO_DOC: Record<number, TipoDocumento> = {
  2: "identificacion",
  3: "identificacion",
  59: "identificacion",
  63: "identificacion",
  23: "escritura",
  14: "predial",
  5: "curp_constancia",
  6: "constancia_moral", // Constancia de Situación Fiscal
  7: "acta_constitutiva",
  9: "poder",
};

const ESTATUS_VERIF: Record<number, EstadoValidacion> = {
  1: "en_revision",
  2: "validado",
  3: "rechazado",
  4: "expirado",
};

function estadoCruce(status: string): Semaforo {
  if (status === "fail") return "rojo";
  if (status === "ok") return "verde";
  return "ambar"; // idle / warn → requiere revisión humana
}

function basename(url: string | null): string {
  if (!url) return "documento";
  try {
    return decodeURIComponent(url.split("?")[0].split("/").pop() || "documento");
  } catch {
    return "documento";
  }
}

function diasDesde(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** Carga y mapea todas las solicitudes de propietario activas. */
export async function cargarSolicitudesTitularidad(): Promise<SolicitudTitularidad[]> {
  const { data: sols, error } = await sb
    .from("solicitudes_propietario")
    .select(
      "case_id, id_propiedad, id_entidad_relacionada, id_persona, email, tipo_persona, tipo_compra, antiguedad_compra, nivel, estatus, verificacion, ruteo, comentario_revision, fecha_creacion",
    )
    .eq("activo", true)
    .order("fecha_creacion", { ascending: false });
  if (error) throw error;
  const rows = (sols ?? []) as any[];
  if (rows.length === 0) return [];

  const personaIds = [...new Set(rows.map((r) => r.id_persona).filter(Boolean))];
  const propIds = [...new Set(rows.map((r) => r.id_propiedad).filter(Boolean))];

  // personas
  const { data: personas } = await sb
    .from("personas")
    .select("id, nombre_legal, rfc, curp, telefono")
    .in("id", personaIds.length ? personaIds : IDS_VACIO);
  const personaById = new Map<number, any>((personas ?? []).map((p: any) => [p.id, p]));

  // propiedades → edificios_modelos → modelos (waterfall)
  const { data: props } = await sb
    .from("propiedades")
    .select("id, numero_propiedad, id_edificio_modelo")
    .in("id", propIds.length ? propIds : IDS_VACIO);
  const propById = new Map<number, any>((props ?? []).map((p: any) => [p.id, p]));

  const emIds = [...new Set((props ?? []).map((p: any) => p.id_edificio_modelo).filter(Boolean))];
  const { data: ems } = await sb
    .from("edificios_modelos")
    .select("id, id_modelo")
    .in("id", emIds.length ? emIds : IDS_VACIO);
  const modeloIds = [...new Set((ems ?? []).map((e: any) => e.id_modelo).filter(Boolean))];
  const { data: modelos } = await sb
    .from("modelos")
    .select("id, nombre")
    .in("id", modeloIds.length ? modeloIds : IDS_VACIO);
  const modeloNombreById = new Map<number, string>((modelos ?? []).map((m: any) => [m.id, m.nombre]));
  const emModeloNombre = new Map<number, string>(
    (ems ?? []).map((e: any) => [e.id, e.id_modelo ? modeloNombreById.get(e.id_modelo) ?? "" : ""]),
  );

  // documentos por persona
  const { data: docs } = await sb
    .from("documentos")
    .select("id, id_persona, id_tipo_documento, url, id_estatus_verificacion")
    .in("id_persona", personaIds.length ? personaIds : IDS_VACIO)
    .eq("activo", true)
    .eq("es_draft", false);
  const docsByPersona = new Map<number, any[]>();
  for (const d of (docs ?? []) as any[]) {
    const arr = docsByPersona.get(d.id_persona) ?? [];
    arr.push(d);
    docsByPersona.set(d.id_persona, arr);
  }

  return rows.map((r) => {
    const persona = personaById.get(r.id_persona) ?? {};
    const prop = propById.get(r.id_propiedad) ?? {};
    const modelo = prop.id_edificio_modelo ? emModeloNombre.get(prop.id_edificio_modelo) ?? "" : "";
    const tipoPersona: TipoPersona = r.tipo_persona === "moral" ? "moral" : "fisica";

    const documentos: DocumentoExpediente[] = (docsByPersona.get(r.id_persona) ?? []).map(
      (d: any): DocumentoExpediente => ({
        id: `doc-${d.id}`,
        tipo: TIPO_DOC[d.id_tipo_documento] ?? "identificacion",
        nombreArchivo: basename(d.url),
        urlMock: d.url ?? "",
        requerimiento: "cargado",
        estado: ESTATUS_VERIF[d.id_estatus_verificacion] ?? "en_revision",
        vigencia: "no_aplica",
        datosExtraidos: {},
      }),
    );

    const verif = Array.isArray(r.verificacion) ? (r.verificacion as any[]) : [];
    const cruces: Cruce[] = verif.map((c: any) => ({
      id: String(c.key ?? Math.random()),
      etiqueta: String(c.label ?? c.key ?? "Cruce"),
      resultado: estadoCruce(String(c.status ?? "idle")),
      detalle: "",
      esCadenaDominio: c.key === "chain",
    }));
    const semaforoAgregado: Semaforo = cruces.some((c) => c.resultado === "rojo")
      ? "rojo"
      : cruces.some((c) => c.resultado === "ambar")
        ? "ambar"
        : cruces.length > 0
          ? "verde"
          : "ambar";

    const nivelOtorgado = r.nivel === 1 ? 1 : r.nivel === 2 ? 2 : null;

    return {
      id: r.case_id,
      tipoPersona,
      nombreODireccionRazonSocial: persona.nombre_legal ?? r.email ?? "—",
      rfc: campo<string>(persona.rfc ?? null),
      curp: tipoPersona === "fisica" ? campo<string>(persona.curp ?? null) : undefined,
      razonSocial: tipoPersona === "moral" ? campo<string>(persona.nombre_legal ?? null) : undefined,
      representanteLegal: undefined,
      correo: r.email ?? "",
      telefono: persona.telefono ?? "",
      desarrollo: "Margot",
      unidad: prop.numero_propiedad ?? "—",
      folioReal: campo<string>(null),
      direccion: "",
      modelo,
      duenoOriginalRegistrado: "Por confirmar (registro SOZU)",
      contextoCompra: r.tipo_compra === "credito" ? "credito_hipotecario" : "contado",
      antiguedad: r.antiguedad_compra === "reciente" ? "reciente" : "normal",
      documentos,
      cruces,
      semaforoAgregado,
      gravamen: { existe: false, acreedor: null },
      verificacionRegistral: "no_iniciada",
      poderConFacultadesDominio: tipoPersona === "moral" ? null : undefined,
      cadenaDominioConfirmada: null,
      estado: ESTATUS_A_ESTADO[r.estatus] ?? "nueva",
      nivelSolicitado: 1,
      nivelOtorgado,
      areaAsignada: null,
      motivoRechazo: r.comentario_revision ?? undefined,
      fechaCreacion: r.fecha_creacion ?? new Date().toISOString(),
      diasEnCola: diasDesde(r.fecha_creacion),
      auditoria: [],
    } satisfies SolicitudTitularidad;
  });
}
