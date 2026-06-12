import { Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PropertyData, StageInfo } from "@/lib/offers/mock-data";

interface PortalHeaderProps {
  property: PropertyData;
  currentStage: StageInfo;
  onMenuOpen: () => void;
}

const statusLabel: Record<string, string> = {
  preventa: "En Preventa",
  pago_final: "Pago Pendiente",
  escrituracion: "En Escrituración",
  entrega: "Por Entregar",
  post_entrega: "Entregado",
};

const PortalHeader = ({ property, currentStage, onMenuOpen }: PortalHeaderProps) => {
  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-foreground text-lg leading-tight truncate">
            {property.projectName}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-muted-foreground">
              Unidad {property.unitNumber}
            </span>
            <Badge
              variant={currentStage.status === "active" ? "default" : "secondary"}
              className="text-xs font-medium"
            >
              {statusLabel[currentStage.id] || currentStage.label}
            </Badge>
          </div>
        </div>
        <button
          onClick={onMenuOpen}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
          aria-label="Menú"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default PortalHeader;
