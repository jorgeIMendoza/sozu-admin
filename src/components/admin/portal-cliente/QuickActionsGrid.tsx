import { Receipt, Clock, FileText } from "lucide-react";

interface QuickActionsGridProps {
  onAction: (action: string) => void;
}

const QuickActionsGrid = ({ onAction }: QuickActionsGridProps) => {
  return (
    <section className="px-5 md:px-0 py-5 animate-fade-in" style={{ animationDelay: "0.05s" }}>
      <h2 className="font-display font-semibold text-[15px] text-foreground mb-3">
        Accesos rápidos
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {/* Featured */}
        <button
          onClick={() => onAction("balance")}
          className="col-span-2 flex items-center gap-3 bg-card rounded-xl border border-border hover:border-border-soft hover:shadow-sm transition-all p-4 text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-[13px] text-foreground leading-tight">
              Estado de cuenta
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Saldo y movimientos</p>
          </div>
          <span className="text-[12px] font-medium text-primary">Ver →</span>
        </button>

        <button
          onClick={() => onAction("payments")}
          className="flex flex-col items-start gap-2.5 bg-card rounded-xl border border-border hover:border-border-soft transition-colors p-4 text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-display font-semibold text-[13px] text-foreground leading-tight">
              Historial de pagos
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Todos tus pagos</p>
          </div>
        </button>

        <button
          onClick={() => onAction("documents")}
          className="flex flex-col items-start gap-2.5 bg-card rounded-xl border border-border hover:border-border-soft transition-colors p-4 text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-display font-semibold text-[13px] text-foreground leading-tight">
              Documentos
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tu expediente</p>
          </div>
        </button>
      </div>
    </section>
  );
};

export default QuickActionsGrid;
