import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLegalFlowSolicitudesRecibidas } from "@/hooks/useLegalFlowSolicitudesRecibidas";
import { useLegalFlowFirmaTitular } from "@/hooks/useLegalFlowFirmaTitular";

/* ──────────────────────────────────────────────────────────
   Tipos
   ────────────────────────────────────────────────────────── */

export type TipoNotificacionLegal =
  | "solicitud_recibida"
  | "expediente_en_revision"
  | "firma_titular_pendiente"
  | "documento_rechazado"
  | "documento_validado";

export type NivelNotificacionLegal = "info" | "warning" | "success" | "error";

export interface NotificacionLegalFlow {
  id: string;
  tipo: TipoNotificacionLegal;
  nivel: NivelNotificacionLegal;
  titulo: string;
  mensaje: string;
  /** Folio CC-XXXXXX para navegar al detalle. */
  folio_cuenta: string;
  fecha_evento: string;
  dias_esperando: number;
  critico: boolean;
}

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

const UMBRAL_CRITICO_DIAS = 7;

/* ──────────────────────────────────────────────────────────
   Hook público
   ────────────────────────────────────────────────────────── */

/**
 * Notificaciones reales para SOZU Legal Flow. Compone tres fuentes:
 *
 * 1. Solicitudes recibidas: cuentas en Apartado sin promoción todavía
 *    (status='Solicitud recibida') o promovidas a 'En revisión legal'.
 * 2. Firma titular: cuentas con Contrato firmado completamente en estatus
 *    Pendiente — Legal debe validar.
 * 3. Bitácora reciente (últimos 14 días): rechazos y validaciones de
 *    documentos para acompañar el trabajo del área legal.
 */
export function useNotificacionesLegalFlow() {
  const { data: solicitudes = [] } = useLegalFlowSolicitudesRecibidas();
  const { data: firmaTitular = [] } = useLegalFlowFirmaTitular();

  const bitacoraQuery = useQuery({
    queryKey: ["notificaciones-legal-flow-bitacora"],
    staleTime: 60_000,
    queryFn: fetchBitacoraReciente,
  });

  const data: NotificacionLegalFlow[] = [];

  // 1. Solicitudes recibidas → cada cuenta Apartado se vuelve una
  //    notificación. Si ya pasó a "En revisión legal" cambia el tono.
  for (const r of solicitudes) {
    const dias = diasDesde(r.createdAt);
    const enRevision = r.status === "En revisión legal";
    data.push({
      id: `solicitud:${r.idCuentaCobranza ?? r.id}`,
      tipo: enRevision ? "expediente_en_revision" : "solicitud_recibida",
      nivel: enRevision ? "info" : "warning",
      titulo: enRevision
        ? `Expediente en revisión legal · ${r.id}`
        : `Solicitud nueva por revisar · ${r.id}`,
      mensaje: [r.project, r.property, r.counterparty]
        .filter(Boolean)
        .join(" · ") || "Expediente legal pendiente",
      folio_cuenta: r.id,
      fecha_evento: r.createdAt,
      dias_esperando: dias,
      critico: !enRevision && dias > UMBRAL_CRITICO_DIAS,
    });
  }

  // 2. Firma titular → cuentas con contrato pendiente de validación.
  for (const r of firmaTitular) {
    const dias = diasDesde(r.updatedAt ?? r.createdAt);
    data.push({
      id: `firma-titular:${r.idCuentaCobranza ?? r.id}`,
      tipo: "firma_titular_pendiente",
      nivel: "warning",
      titulo: `Contrato pendiente de validación · ${r.id}`,
      mensaje: [r.project, r.property, r.counterparty]
        .filter(Boolean)
        .join(" · ") || "Contrato firmado pendiente de validar por Legal",
      folio_cuenta: r.id,
      fecha_evento: r.updatedAt ?? r.createdAt,
      dias_esperando: dias,
      critico: dias > 3,
    });
  }

  // 3. Bitácora reciente: rechazos (warning/error) y validaciones de docs
  //    (success). Mantiene un máximo razonable para no saturar el panel.
  for (const b of bitacoraQuery.data ?? []) {
    data.push(b);
  }

  // Orden: críticos primero, luego por fecha desc.
  data.sort((a, b) => {
    if (a.critico !== b.critico) return a.critico ? -1 : 1;
    return new Date(b.fecha_evento).getTime() - new Date(a.fecha_evento).getTime();
  });

  return {
    data,
    isLoading: bitacoraQuery.isLoading,
    error: bitacoraQuery.error,
  };
}

/* ──────────────────────────────────────────────────────────
   Bitácora reciente — rechazos y validaciones de documentos
   ────────────────────────────────────────────────────────── */

async function fetchBitacoraReciente(): Promise<NotificacionLegalFlow[]> {
  const desde = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data, error } = await (supabase as any)
    .from("legal_flow_bitacora")
    .select(
      "id, id_cuenta_cobranza, tipo, titulo, mensaje, scope, fecha_creacion, autor_nombre, autor_email",
    )
    .gte("fecha_creacion", desde)
    .eq("activo", true)
    .in("tipo", ["rechazo", "validacion"])
    .order("fecha_creacion", { ascending: false })
    .limit(50);
  if (error) {
    // Si la tabla aún no existe en el ambiente (DDL pendiente), devolvemos
    // vacío en vez de romper el panel completo.
    if ((error as any)?.code === "42P01") return [];
    throw error;
  }

  const rows = ((data ?? []) as Array<any>).filter((r) => {
    // Sólo nos interesan eventos de documentos para el feed legal.
    if (r.tipo === "rechazo") return true;
    if (r.tipo === "validacion" && r.scope === "documento") return true;
    return false;
  });

  if (rows.length === 0) return [];

  const cuentaIds = Array.from(
    new Set(rows.map((r) => r.id_cuenta_cobranza).filter((v): v is number => !!v)),
  );
  const folioPorCuenta = await fetchFolios(cuentaIds);

  return rows.map<NotificacionLegalFlow>((r) => {
    const folio = folioPorCuenta.get(r.id_cuenta_cobranza) ?? `CC-${String(r.id_cuenta_cobranza).padStart(6, "0")}`;
    const isRechazo = r.tipo === "rechazo";
    const titulo = isRechazo
      ? `Rechazo registrado · ${folio}`
      : `Documento validado · ${folio}`;
    const detalleAutor = r.autor_nombre || r.autor_email || "Sistema";
    const tituloBitacora: string = (r.titulo as string | null) ?? "";
    const mensajeBitacora: string = (r.mensaje as string | null) ?? "";
    return {
      id: `bitacora:${r.id}`,
      tipo: isRechazo ? "documento_rechazado" : "documento_validado",
      nivel: isRechazo ? "error" : "success",
      titulo,
      mensaje:
        [tituloBitacora, mensajeBitacora].filter(Boolean).join(" — ") +
        ` · por ${detalleAutor}`,
      folio_cuenta: folio,
      fecha_evento: r.fecha_creacion as string,
      dias_esperando: diasDesde(r.fecha_creacion as string),
      critico: isRechazo,
    };
  });
}

async function fetchFolios(cuentaIds: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (cuentaIds.length === 0) return out;
  // Para el folio precisamos saber si la cuenta es Propiedad (CC-) o
  // Producto/Servicio (CCP-). Resolvemos vía oferta.id_producto.
  const { data: cuentas, error } = await (supabase as any)
    .from("cuentas_cobranza")
    .select("id, id_oferta")
    .in("id", cuentaIds);
  if (error) {
    // Fallback: usar CC-XXXXXX.
    for (const id of cuentaIds) out.set(id, `CC-${String(id).padStart(6, "0")}`);
    return out;
  }
  const ofertaIds = Array.from(
    new Set(((cuentas as any[]) ?? []).map((c) => c.id_oferta).filter((v): v is number => !!v)),
  );
  const ofertaMap = new Map<number, boolean>();
  if (ofertaIds.length > 0) {
    const { data: ofs } = await (supabase as any)
      .from("ofertas")
      .select("id, id_producto")
      .in("id", ofertaIds);
    for (const o of (ofs as any[]) ?? []) {
      ofertaMap.set(o.id as number, !!o.id_producto);
    }
  }
  for (const c of (cuentas as any[]) ?? []) {
    const esProducto = c.id_oferta ? ofertaMap.get(c.id_oferta as number) === true : false;
    const prefix = esProducto ? "CCP" : "CC";
    out.set(c.id as number, `${prefix}-${String(c.id).padStart(6, "0")}`);
  }
  return out;
}
