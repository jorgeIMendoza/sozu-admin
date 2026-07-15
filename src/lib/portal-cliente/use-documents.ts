import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";
import type { DocumentRecord, DocumentStatus, DocumentType } from "./document-data";

function estatusToStatus(id: number): DocumentStatus {
  switch (id) {
    case 2: return "validado";
    case 3: return "rechazado";
    default: return "recibido"; // 1=pendiente de revisión en ops = ya subido
  }
}

function categoriaToType(id: number): DocumentType {
  switch (id) {
    case 1: return "identificacion";
    case 4: return "cfdi";
    case 8: return "comprobante";
    default: return "otro";
  }
}

function guessExt(url: string): "pdf" | "jpg" | "png" {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "png";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "jpg";
  return "pdf";
}

async function fetchDocuments(personaId: number): Promise<DocumentRecord[]> {
  const { data: docs } = await supabase
    .from("documentos")
    .select("id, id_tipo_documento, id_cuenta_cobranza, url, id_estatus_verificacion, fecha_creacion, fecha_actualizacion, numero")
    .eq("id_persona", personaId)
    .eq("activo", true)
    .eq("es_draft", false)
    .not("id_cuenta_cobranza", "is", null)
    .not("id_tipo_documento", "in", "(21,22)");

  // Exclude tipos 21 (Factura XML) and 22 (Factura PDF) — shown in FacturasSection instead
  const filtered = (docs ?? []).filter(d => ![21, 22].includes(Number(d.id_tipo_documento)));
  if (!filtered.length) return [];

  const tipoIds = [...new Set(filtered.map((d) => d.id_tipo_documento as number).filter(Boolean))];
  const { data: tipos } = tipoIds.length
    ? await supabase
        .from("tipos_documento")
        .select("id, nombre, id_categoria_documento")
        .in("id", tipoIds)
    : { data: [] };

  const tipoMap = Object.fromEntries((tipos ?? []).map((t) => [t.id as number, t]));

  const records: DocumentRecord[] = filtered.map((doc): DocumentRecord => {
    const tipo = tipoMap[doc.id_tipo_documento as number];
    const categoriaId = Number(tipo?.id_categoria_documento ?? 9);
    const url = String(doc.url);

    return {
      id: String(doc.id),
      propertyId: doc.id_cuenta_cobranza ? String(doc.id_cuenta_cobranza) : "persona",
      type: categoriaToType(categoriaId),
      status: estatusToStatus(Number(doc.id_estatus_verificacion)),
      name: String(tipo?.nombre ?? "Documento"),
      origin: "client_uploaded",
      fileExtension: guessExt(url),
      fileName: url.split("/").pop() ?? url,
      url,
      uploadedAt: String(doc.fecha_creacion),
      validatedAt: (doc.id_estatus_verificacion === 2 || doc.id_estatus_verificacion === 3)
        ? String(doc.fecha_actualizacion ?? doc.fecha_creacion)
        : undefined,
      description: doc.numero ? `Ref. ${String(doc.numero)}` : undefined,
    };
  });

  // Fetch file sizes in parallel via HEAD requests for public URLs
  const sizes = await Promise.all(
    records.map(async (r) => {
      if (!r.url || r.url === "#") return null;
      try {
        const res = await fetch(r.url, { method: "HEAD" });
        const len = res.headers.get("content-length");
        return len ? Number(len) : null;
      } catch {
        return null;
      }
    }),
  );

  return records.map((r, i) => ({
    ...r,
    fileSize: sizes[i] ?? undefined,
  }));
}

export function useClienteDocuments() {
  const { profile } = useAuth();
  const { isImpersonating, impersonatedClientePersonaId } = useClienteImpersonation();
  const personaId = isImpersonating ? impersonatedClientePersonaId : profile?.id_persona;

  return useQuery({
    queryKey: ["cliente-documents", personaId],
    queryFn: () => fetchDocuments(personaId!),
    enabled: !!personaId,
  });
}
