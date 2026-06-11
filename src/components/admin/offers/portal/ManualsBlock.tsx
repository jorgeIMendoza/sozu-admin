import { useState } from "react";
import { BookOpen, FileText, ChevronDown, ChevronUp } from "lucide-react";
import {
  useManualsForProperty,
  getManualCategoryLabel,
  formatFileSize,
  type ManualCategory,
  type Manual,
} from "@/lib/offers/post-delivery-data";
import PDFViewerSheet from "./PDFViewerSheet";

interface Props {
  propertyId: string;
}

const CATEGORY_ORDER: ManualCategory[] = [
  "electrodomesticos",
  "mantenimiento",
  "garantia",
  "planos",
];

const ManualsBlock = ({ propertyId }: Props) => {
  const manuals = useManualsForProperty(propertyId);
  const [expanded, setExpanded] = useState(false);
  const [selectedManual, setSelectedManual] = useState<Manual | null>(null);

  if (manuals.length === 0) return null;

  const grouped = manuals.reduce<Record<ManualCategory, Manual[]>>(
    (acc, m) => {
      acc[m.category].push(m);
      return acc;
    },
    { electrodomesticos: [], mantenimiento: [], garantia: [], planos: [] },
  );

  return (
    <div className="px-4 mt-4 animate-fade-in">
      <div className="rounded-2xl border border-border bg-card p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground">
                Manuales y guías
              </p>
              <p className="text-xs text-muted-foreground">
                {manuals.length} documento{manuals.length === 1 ? "" : "s"}{" "}
                disponibles
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {expanded && (
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
                          <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                            PDF · {formatFileSize(m.fileSize)}
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
          fileSize={selectedManual.fileSize}
        />
      )}
    </div>
  );
};

export default ManualsBlock;
