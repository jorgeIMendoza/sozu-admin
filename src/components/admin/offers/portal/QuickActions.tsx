import { Receipt, FileText, Clock, FolderOpen, ChevronRight } from "lucide-react";

interface QuickActionsProps {
  onAction: (action: string) => void;
}

const actions = [
  { id: "balance", label: "Estado de cuenta", icon: Receipt },
  { id: "contract", label: "Contrato firmado", icon: FileText },
  { id: "payments", label: "Historial de pagos", icon: Clock },
  { id: "property", label: "Mi propiedad", icon: FolderOpen },
];

const QuickActions = ({ onAction }: QuickActionsProps) => {
  return (
    <section className="px-5 py-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
      <h2 className="font-display font-semibold text-foreground text-sm mb-2">
        Accesos rápidos
      </h2>
      <div className="space-y-0.5">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            className="w-full flex items-center gap-3 py-3 transition-all active:opacity-70 group"
          >
            <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            <span className="text-sm text-foreground flex-1 text-left">
              {action.label}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-foreground/50 transition-colors" />
          </button>
        ))}
      </div>
    </section>
  );
};

export default QuickActions;
