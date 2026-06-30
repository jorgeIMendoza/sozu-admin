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

const dotColor: Record<string, string> = {
  warning: "bg-amber-400",
  primary: "bg-primary",
  success: "bg-emerald-500",
  destructive: "bg-red-500",
  muted: "bg-muted-foreground/40",
};

const activeRing: Record<string, string> = {
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  primary: "border-primary/30 bg-primary/8 text-primary",
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  destructive: "border-red-300 bg-red-50 text-red-700",
  muted: "border-foreground/20 bg-foreground/5 text-foreground",
};

const DocumentStatsBar = ({ stats, activeStatus, onSelectStatus }: StatsBarProps) => {
  const isAllActive = activeStatus === null;

  return (
    <div className="flex gap-1.5 overflow-x-auto px-5 md:px-0 pb-3 scrollbar-hide">
      <button
        onClick={() => onSelectStatus(null)}
        className={`flex-shrink-0 h-8 flex items-center gap-2 px-3 rounded-md border text-sm font-medium transition-all ${
          isAllActive
            ? "border-foreground/20 bg-foreground/5 text-foreground"
            : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30"
        }`}
      >
        <span className="tabular-nums font-semibold">{stats.total}</span>
        <span className="text-[11px] font-normal opacity-70">Todos</span>
      </button>

      {ORDER.map((status) => {
        const info = getStatusInfo(status);
        const count = stats[status];
        const isActive = activeStatus === status;
        const tone = info.tone ?? "muted";
        return (
          <button
            key={status}
            onClick={() => onSelectStatus(isActive ? null : status)}
            className={`flex-shrink-0 h-8 flex items-center gap-2 px-3 rounded-md border text-sm font-medium transition-all ${
              isActive
                ? activeRing[tone]
                : count === 0
                  ? "border-border/50 bg-card text-muted-foreground/50 hover:text-muted-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? dotColor[tone] : count > 0 ? dotColor[tone] : "bg-border"}`} />
            <span className="tabular-nums font-semibold">{count}</span>
            <span className="text-[11px] font-normal opacity-80">{info.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DocumentStatsBar;
