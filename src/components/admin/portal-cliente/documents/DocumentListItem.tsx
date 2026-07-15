import * as Icons from "lucide-react";
import { ChevronRight, Zap } from "lucide-react";
import type { DocumentRecord } from "@/lib/portal-cliente/document-data";
import { getStatusInfo, getTypeInfo, formatFileSize } from "@/lib/portal-cliente/document-data";

interface ListItemProps {
  document: DocumentRecord;
  onClick: () => void;
}

const iconBgByTone: Record<string, string> = {
  warning: "bg-amber-50 text-amber-600",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-50 text-emerald-600",
  destructive: "bg-red-50 text-red-500",
  muted: "bg-muted text-muted-foreground",
};

const DocumentListItem = ({ document, onClick }: ListItemProps) => {
  const typeInfo = getTypeInfo(document.type);
  const statusInfo = getStatusInfo(document.status);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = ((Icons as any)[typeInfo.icon] ?? Icons.FileText) as React.ComponentType<{
    className?: string;
  }>;

  const ext =
    document.fileExtension?.toUpperCase() ??
    (document.url && document.url !== "#"
      ? document.url.split(".").pop()?.slice(0, 4).toUpperCase()
      : undefined);
  const hasFile = !!ext;

  const typeLabel =
    document.name && document.name !== "Otro" && document.name !== "Documento"
      ? document.name.split(" ")[0]
      : typeInfo.label;

  const iconClass = iconBgByTone[statusInfo.tone] ?? iconBgByTone.muted;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left bg-card hover:bg-muted/20 transition-colors"
    >
      <div
        className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${iconClass}`}
      >
        <Icon className="w-[18px] h-[18px]" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug truncate">{document.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
          {hasFile ? (
            <>
              <span className="font-semibold uppercase text-[10px]">{ext}</span>
              {document.fileSize && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">{formatFileSize(document.fileSize)}</span>
                </>
              )}
            </>
          ) : (
            <span>{typeLabel} · Pendiente de subir</span>
          )}
          {document.description && (
            <>
              <span>·</span>
              <span className="truncate max-w-[120px]">{document.description}</span>
            </>
          )}
        </div>
        {document.status === "rechazado" && document.rejectionReason && (
          <p className="text-[11px] text-destructive mt-0.5 line-clamp-1">
            {document.rejectionReason}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.className}`}
        >
          {document.status === "firmado" && <Zap className="w-2.5 h-2.5" />}
          {statusInfo.label}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
      </div>
    </button>
  );
};

export default DocumentListItem;
