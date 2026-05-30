import type { DocumentStatus } from "@/lib/portal-cliente/document-data";
import { getStatusInfo } from "@/lib/portal-cliente/document-data";

interface StatsBarProps {
  stats: {
    total: number;
    pendiente: number;
    recibido: number;
    validado: number;
    rechazado: number;
    firmado: number;
  };
  activeStatus: DocumentStatus | null;
  onSelectStatus: (status: DocumentStatus | null) => void;
}

const ORDER: DocumentStatus[] = ["pendiente", "rechazado", "recibido", "validado", "firmado"];

const toneRing: Record<string, string> = {
  warning: "border-warning/40 bg-warning/10",
  primary: "border-primary/40 bg-primary/10",
  success: "border-success/40 bg-success/10",
  destructive: "border-destructive/40 bg-destructive/10",
};

const DocumentStatsBar = ({ stats, activeStatus, onSelectStatus }: StatsBarProps) => {
  const isAllActive = activeStatus === null;

  return (
    <div className="flex gap-2 overflow-x-auto px-5 md:px-0 pb-3 scrollbar-hide -mx-1 px-1">
      <button
        onClick={() => onSelectStatus(null)}
        className={`flex-shrink-0 rounded-xl border px-3.5 py-2 min-w-[88px] text-left transition-all ${
          isAllActive
            ? "border-foreground/30 bg-foreground/5"
            : "border-border bg-card hover:bg-muted/30"
        }`}
      >
        <div className="font-display font-bold text-xl tabular-nums text-foreground">
          {stats.total}
        </div>
        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mt-0.5">
          Todos
        </div>
      </button>

      {ORDER.map((status) => {
        const info = getStatusInfo(status);
        const count = stats[status];
        const isActive = activeStatus === status;
        return (
          <button
            key={status}
            onClick={() => onSelectStatus(isActive ? null : status)}
            className={`flex-shrink-0 rounded-xl border px-3.5 py-2 min-w-[88px] text-left transition-all ${
              isActive
                ? toneRing[info.tone]
                : "border-border bg-card hover:bg-muted/30"
            }`}
          >
            <div className="font-display font-bold text-xl tabular-nums text-foreground">
              {count}
            </div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mt-0.5">
              {info.label}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default DocumentStatsBar;
