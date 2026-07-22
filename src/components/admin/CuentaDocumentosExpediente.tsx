import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Eye, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Expediente de documentos de una cuenta de cobranza, seccionado.
 *
 * Reúne en un solo lugar TODOS los documentos relacionados a la cuenta:
 *   - Personales del comprador (vía id_persona)
 *   - De la propiedad / producto / cuenta (contrato, escrituración, facturas,
 *     entrega, y otros)
 *
 * Es de solo lectura (ver/descargar). La subida vive en cada vista contenedora
 * (botón "Subir"), que puede pasarse vía `headerRight`.
 */

type DocRow = {
  id: number;
  url: string;
  fecha: string | null;
  tipoId: number;
  tipoNombre: string;
  estatusId: number | null;
  personaId: number | null;
};

type SeccionKey = "personales" | "contrato" | "escrituracion" | "facturas" | "entrega" | "otros";

const SECCIONES: { key: SeccionKey; titulo: string }[] = [
  { key: "personales", titulo: "Documentos personales del comprador" },
  { key: "contrato", titulo: "Contrato" },
  { key: "escrituracion", titulo: "Escrituración" },
  { key: "facturas", titulo: "Facturas" },
  { key: "entrega", titulo: "Entrega" },
  { key: "otros", titulo: "Otros de la propiedad" },
];

// tipo_documento id → sección (los personales se detectan por id_persona, no por tipo).
const TIPO_A_SECCION: Record<number, SeccionKey> = {
  18: "contrato", 42: "contrato", 28: "contrato", 39: "contrato",
  23: "escrituracion", 29: "escrituracion", 20: "escrituracion", 17: "escrituracion", 44: "escrituracion", 45: "escrituracion",
  21: "facturas", 22: "facturas", 46: "facturas", 47: "facturas",
  24: "entrega", 25: "entrega", 26: "entrega", 43: "entrega",
};

function seccionDe(doc: DocRow): SeccionKey {
  if (doc.personaId) return "personales";
  return TIPO_A_SECCION[doc.tipoId] ?? "otros";
}

// Corrige URLs guardadas con path duplicado o relativas (mismo criterio que el
// resto del panel: bucket público `documentos`).
function fixUrl(raw: string): string {
  let u = raw;
  if (u && u.includes("/documentos/documentos/")) u = u.replace("/documentos/documentos/", "/documentos/");
  if (u && !u.startsWith("https://")) {
    const fileName = u.startsWith("documentos/") ? u.replace("documentos/", "") : u;
    u = supabase.storage.from("documentos").getPublicUrl(fileName).data.publicUrl;
  }
  return u;
}

function EstatusBadge({ id }: { id: number | null }) {
  const cfg = id === 2
    ? { label: "Verificado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    : id === 3
    ? { label: "Rechazado", cls: "bg-red-50 text-red-700 border-red-200" }
    : id === 4
    ? { label: "Expirado", cls: "bg-orange-50 text-orange-700 border-orange-200" }
    : { label: "Pendiente", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", cfg.cls)}>{cfg.label}</span>;
}

interface Props {
  cuentaId: number;
  propiedadId?: number | null;
  productoId?: number | null;
  personaIds?: number[];
  onView: (url: string, title: string) => void;
  headerRight?: React.ReactNode;
}

export function CuentaDocumentosExpediente({
  cuentaId,
  propiedadId,
  productoId,
  personaIds = [],
  onView,
  headerRight,
}: Props) {
  const personaKey = personaIds.join(",");

  const { data, isLoading } = useQuery({
    queryKey: ["cuenta-expediente-docs", cuentaId, propiedadId, productoId, personaKey],
    enabled: !!cuentaId,
    staleTime: 15_000,
    queryFn: async (): Promise<{ docs: DocRow[]; personas: Record<number, string> }> => {
      const orParts: string[] = [`id_cuenta_cobranza.eq.${cuentaId}`];
      if (propiedadId) orParts.push(`id_propiedad.eq.${propiedadId}`);
      if (productoId) orParts.push(`id_producto.eq.${productoId}`);
      if (personaIds.length) orParts.push(`id_persona.in.(${personaIds.join(",")})`);

      const { data: rows } = await (supabase as any)
        .from("documentos")
        .select("id, url, fecha_creacion, id_tipo_documento, id_estatus_verificacion, id_persona, tipos_documento:id_tipo_documento(nombre)")
        .or(orParts.join(","))
        .eq("activo", true)
        .order("fecha_creacion", { ascending: false });

      const docs: DocRow[] = (rows ?? []).map((d: any) => ({
        id: d.id,
        url: fixUrl(d.url),
        fecha: d.fecha_creacion,
        tipoId: d.id_tipo_documento,
        tipoNombre: d.tipos_documento?.nombre ?? "Documento",
        estatusId: d.id_estatus_verificacion ?? null,
        personaId: d.id_persona ?? null,
      }));

      // Nombres de las personas (para etiquetar los personales por comprador).
      let personas: Record<number, string> = {};
      const pids = Array.from(new Set(docs.map((d) => d.personaId).filter(Boolean))) as number[];
      if (pids.length) {
        const { data: ps } = await (supabase as any)
          .from("personas")
          .select("id, nombre_legal")
          .in("id", pids);
        personas = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.nombre_legal]));
      }
      return { docs, personas };
    },
  });

  const docs = data?.docs ?? [];
  const personas = data?.personas ?? {};
  const total = docs.length;

  const grupos = SECCIONES.map((s) => ({
    ...s,
    items: docs.filter((d) => seccionDe(d) === s.key),
  })).filter((g) => g.items.length > 0);

  const fmtFecha = (f: string | null) =>
    f ? new Date(f).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "-";

  return (
    <div>
      <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {isLoading ? "Cargando..." : `${total} documento${total !== 1 ? "s" : ""}`}
        </p>
        {headerRight}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : total === 0 ? (
        <div className="px-5 py-12 text-center space-y-2">
          <FileText className="size-7 text-muted-foreground/20 mx-auto" />
          <p className="text-[13px] text-muted-foreground">Sin documentos registrados.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {grupos.map((g) => (
            <div key={g.key} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2.5">
                {g.key === "personales"
                  ? <User className="size-3.5 text-muted-foreground" />
                  : <Building2 className="size-3.5 text-muted-foreground" />}
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {g.titulo}
                </h4>
                <span className="text-[10px] font-semibold text-muted-foreground/60">({g.items.length})</span>
              </div>
              <div className="space-y-1.5">
                {g.items.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2 hover:bg-muted/40 transition-colors"
                  >
                    <FileText className="size-4 text-muted-foreground/60 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{d.tipoNombre}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {g.key === "personales" && d.personaId && personas[d.personaId]
                          ? `${personas[d.personaId]} · ${fmtFecha(d.fecha)}`
                          : fmtFecha(d.fecha)}
                      </p>
                    </div>
                    <EstatusBadge id={d.estatusId} />
                    {d.url && (
                      <button
                        onClick={() => onView(d.url, d.tipoNombre)}
                        className="inline-flex items-center justify-center p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors shrink-0"
                        title="Ver documento"
                      >
                        <Eye className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CuentaDocumentosExpediente;
