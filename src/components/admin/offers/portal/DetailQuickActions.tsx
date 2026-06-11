import { Receipt, Clock, FileText, ScrollText, Building2, RefreshCcw, ChevronRight } from "lucide-react";

interface DetailQuickActionsProps {
  onAction: (action: string) => void;
  isDelivered: boolean;
}

const DetailQuickActions = ({ onAction, isDelivered }: DetailQuickActionsProps) => {
  const groups = [
    {
      title: "Finanzas",
      items: [
        { id: "balance", label: "Estado de cuenta", icon: Receipt },
        { id: "payments", label: "Historial de pagos", icon: Clock },
      ],
    },
    {
      title: "Documentos",
      items: [
        { id: "contract", label: "Contrato firmado", icon: FileText },
        { id: "notarial", label: "Documentos notariales", icon: ScrollText },
      ],
    },
    {
      title: "Propiedad",
      items: [
        { id: "details", label: "Detalles técnicos", icon: Building2 },
        ...(isDelivered ? [{ id: "resale", label: "Reventa", icon: RefreshCcw }] : []),
      ],
    },
  ];

  return (
    <section className="px-5 py-4 space-y-4">
      {groups.map((group) => (
        <div key={group.title}>
          <h4 className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1.5">
            {group.title}
          </h4>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => onAction(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted group"
              >
                <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                <span className="text-sm text-foreground flex-1 text-left">{item.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
};

export default DetailQuickActions;
