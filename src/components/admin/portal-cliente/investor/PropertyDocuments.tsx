import { useNavigate } from "react-router-dom";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  getTypeInfo,
  type DocumentRecord,
  type DocumentStatus,
} from "@/lib/portal-cliente/document-data";
import { useClienteDocuments } from "@/lib/portal-cliente/use-documents";

interface Props {
  propertyId: string;
}

const STATUS_CONFIG: Record<
  DocumentStatus,
  { Icon: typeof CheckCircle2; label: string; classes: string }
> = {
  validado: { Icon: CheckCircle2, label: "Validado",  classes: "bg-success/15 text-success" },
  firmado:  { Icon: CheckCircle2, label: "Firmado",   classes: "bg-success/15 text-success" },
  recibido: { Icon: Clock,        label: "Recibido",  classes: "bg-primary/15 text-primary" },
  pendiente:{ Icon: AlertCircle,  label: "Pendiente", classes: "bg-warning/15 text-warning" },
  rechazado:{ Icon: AlertCircle,  label: "Rechazado", classes: "bg-destructive/15 text-destructive" },
};

const PropertyDocuments = ({ propertyId }: Props) => {
  const navigate = useNavigate();
  // Misma fuente que ClienteDocumentos → datos siempre consistentes
  const { data: allDocs = [], isLoading } = useClienteDocuments();
  const propertyDocs = allDocs.filter((d) => d.propertyId === propertyId);

  const recent = propertyDocs.slice(0, 5);
  const total = propertyDocs.length;
  const pending = propertyDocs.filter(
    (d) => d.status === "pendiente" || d.status === "rechazado",
  ).length;

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-5 md:p-6 pb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Documentos
          </h2>
        </div>
        {!isLoading && total > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {total} documento{total !== 1 ? "s" : ""}
            {pending > 0 && (
              <>
                {" "}·{" "}
                <span className="text-warning font-medium">
                  {pending} requiere{pending > 1 ? "n" : ""} atención
                </span>
              </>
            )}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="px-5 md:px-6 pb-6 space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-muted" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="px-5 md:px-6 pb-6">
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <FileText className="w-6 h-6 mx-auto text-muted-foreground" />
            <p className="mt-2 text-[12px] text-muted-foreground">
              Aún no hay documentos asociados a esta propiedad.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="px-5 md:px-6 pb-2">
            {recent.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </div>
          {total > 5 && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/admin/portal-cliente/documentos?propiedad=${propertyId}`,
                )
              }
              className="w-full px-5 py-3 bg-muted/30 border-t border-border text-[12px] font-semibold text-primary hover:bg-muted/40 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              Ver los {total} documentos
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
};

const DocumentRow = ({ doc }: { doc: DocumentRecord }) => {
  const cfg = STATUS_CONFIG[doc.status];
  const Icon = cfg.Icon;
  const typeInfo = getTypeInfo(doc.type);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
      <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{doc.name}</p>
        <p className="text-[11px] text-muted-foreground">{typeInfo.label}</p>
      </div>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${cfg.classes}`}
      >
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
    </div>
  );
};

export default PropertyDocuments;
