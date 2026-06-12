import { Lock, Clock } from "lucide-react";
import type { SeccionExpedienteStatus } from "@/lib/offers/formal-reservation-data";

const SeccionLocked = ({
  number,
  title,
  description,
  status,
}: {
  number: number;
  title: string;
  description: string;
  status: SeccionExpedienteStatus;
}) => {
  const isLocked = status === "locked";

  return (
    <div className="rounded-2xl bg-card border border-border p-5 opacity-60">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          {isLocked ? (
            <Lock className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Clock className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sección {number}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isLocked ? "Bloqueada" : "Pendiente"}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default SeccionLocked;
