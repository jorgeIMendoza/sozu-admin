import * as Icons from "lucide-react";
import { Zap } from "lucide-react";
import type { DocumentRecord } from "@/lib/offers/document-data";
import { getStatusInfo, getTypeInfo, formatFileSize } from "@/lib/offers/document-data";

interface ListItemProps {
  document: DocumentRecord;
  onClick: () => void;
}

const DocumentListItem = ({ document, onClick }: ListItemProps) => {
  const typeInfo = getTypeInfo(document.type);
  const statusInfo = getStatusInfo(document.status);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = ((Icons as any)[typeInfo.icon] ?? Icons.FileText) as React.ComponentType<{
    className?: string;
  }>;

  const isContractLike =
    document.type === "contrato" ||
    document.type === "escritura" ||
    document.status === "firmado";
  const hasFile = !!document.fileExtension;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/30 transition-colors flex items-start gap-3"
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isContractLike
            ? "bg-primary/10 text-primary"
            : !hasFile
              ? "bg-muted text-muted-foreground"
              : "bg-muted/60 text-foreground/70"
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{document.name}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          <span>{typeInfo.label}</span>
          <span>·</span>
          {hasFile ? (
            <span className="tabular-nums">
              {document.fileExtension?.toUpperCase()} ·{" "}
              {document.fileSize ? formatFileSize(document.fileSize) : "—"}
            </span>
          ) : (
            <span>Pendiente de subir</span>
          )}
        </div>
        {document.status === "rechazado" && document.rejectionReason && (
          <p className="text-[11px] text-destructive mt-1 leading-relaxed line-clamp-1">
            {document.rejectionReason}
          </p>
        )}
      </div>

      <span
        className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusInfo.className}`}
      >
        {document.status === "firmado" && <Zap className="w-2.5 h-2.5" />}
        {statusInfo.label}
      </span>
    </button>
  );
};

export default DocumentListItem;
