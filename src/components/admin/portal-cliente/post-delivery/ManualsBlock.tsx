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
    <>
      <section className="rounded-2xl bg-card border border-border overflow-hidden animate-fade-in">
        <button
          onClick={() => !isEmpty && setExpanded(!expanded)}
          className={`w-full flex items-center justify-between p-5 ${isEmpty ? "cursor-default" : ""}`}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Manuales y guías
            </h2>
            {!isEmpty && (
              <span className="text-[10px] text-muted-foreground">
                ({manuals.length})
              </span>
            )}
          </div>
          {!isEmpty && (
            expanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {isEmpty && (
          <div className="border-t border-border px-5 py-4 flex items-center gap-2.5 text-muted-foreground">
            <FolderOpen className="w-4 h-4 shrink-0" />
            <p className="text-xs">Los manuales se publicarán conforme estén listos.</p>
          </div>
        )}

        {!isEmpty && expanded && (
          <div className="border-t border-border p-5 space-y-4 animate-fade-in">
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
                        className="w-full text-left rounded-xl border border-border bg-background p-3 hover:bg-muted/30 transition-colors flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-foreground truncate">
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
      </section>

      {selectedManual && (
        <PDFViewerSheet
          open={!!selectedManual}
          onClose={() => setSelectedManual(null)}
          title={selectedManual.name}
          url={selectedManual.url}
        />
      )}
    </>
  );
};

export default ManualsBlock;
