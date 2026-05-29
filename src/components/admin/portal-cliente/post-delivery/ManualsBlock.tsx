import { useState } from "react";
import { BookOpen, FileText, ChevronDown, ChevronUp, FolderOpen } from "lucide-react";
import {
  useManualesForCuenta,
  getManualCategoryLabel,
  type ManualCategory,
  type Manual,
} from "@/lib/portal-cliente/post-delivery-data";
import PDFViewerSheet from "./PDFViewerSheet";

interface Props {
  cuentaId: string;
}

const CATEGORY_ORDER: ManualCategory[] = [
  "electrodomesticos",
  "mantenimiento",
  "garantia",
  "planos",
];

const ManualsBlock = ({ cuentaId }: Props) => {
  const { data: manuals = [], isLoading } = useManualesForCuenta(cuentaId);
  const [expanded, setExpanded] = useState(false);
  const [selectedManual, setSelectedManual] = useState<Manual | null>(null);

  if (isLoading) return null;

  const grouped = manuals.reduce<Record<ManualCategory, Manual[]>>(
    (acc, m) => {
      acc[m.category].push(m);
      return acc;
    },
    { electrodomesticos: [], mantenimiento: [], garantia: [], planos: [] },
  );

  const isEmpty = manuals.length === 0;

  return (
    <div className="px-4 mt-4 animate-fade-in">
      <div className="rounded-2xl border border-border bg-card p-4">
        <button
          onClick={() => !isEmpty && setExpanded(!expanded)}
          className={`w-full flex items-center justify-between gap-3 ${isEmpty ? "cursor-default" : ""}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isEmpty ? "bg-muted" : "bg-primary/10"}`}>
              <BookOpen className={`w-5 h-5 ${isEmpty ? "text-muted-foreground" : "text-primary"}`} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground">
                Manuales y guías
              </p>
              <p className="text-xs text-muted-foreground">
                {isEmpty
                  ? "Aún no hay documentos disponibles"
                  : `${manuals.length} documento${manuals.length === 1 ? "" : "s"} disponibles`}
              </p>
            </div>
          </div>
          {!isEmpty && (expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ))}
        </button>

        {isEmpty && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2.5 text-muted-foreground">
            <FolderOpen className="w-4 h-4 shrink-0" />
            <p className="text-xs">Los manuales se publicarán conforme estén listos.</p>
          </div>
        )}

        {!isEmpty && expanded && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {CATEGORY_ORDER.map((cat) => {
              const items = grouped[cat];
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    {getManualCategoryLabel(cat)} ({items.length})
                  </p>
                  <div className="space-y-2">
                    {items.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedManual(m)}
                        className="w-full text-left rounded-xl border border-border bg-card p-3 hover:bg-muted/30 transition-colors flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {m.name}
                          </p>
                          {m.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {m.description}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-0.5 uppercase">
                            {m.tipoArchivo}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedManual && (
        <PDFViewerSheet
          open={!!selectedManual}
          onClose={() => setSelectedManual(null)}
          title={selectedManual.name}
          url={selectedManual.url}
        />
      )}
    </div>
  );
};

export default ManualsBlock;
