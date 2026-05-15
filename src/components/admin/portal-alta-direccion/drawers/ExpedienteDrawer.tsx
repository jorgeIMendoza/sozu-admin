import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Pill } from "@/components/admin/portal-alta-direccion/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ENTITY_LABEL,
  ENTITY_TONE,
  ENTITY_SUBTITLE,
  type EntityType,
  type VentaContext,
} from "./types";
import { VentaContextCard } from "./VentaContextCard";

export type ExpedienteDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  /** Identificador visible: ej. "COB-1041", "F-V-1184", "COM-871". */
  entityId: string;
  /** Override del subtitle por defecto (descripción del entityType). */
  subtitle?: string;
  ventaContext: VentaContext;
  children: React.ReactNode;
};

export function ExpedienteDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  subtitle,
  ventaContext,
  children,
}: ExpedienteDrawerProps) {
  const navigate = useNavigate();

  const verExpediente = () => {
    onOpenChange(false);
    navigate(
      `/admin/portal-alta-direccion/ciclo-venta?caso=${encodeURIComponent(ventaContext.folio)}`
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "w-full sm:max-w-[640px] p-0 flex flex-col",
          "data-[state=open]:duration-200"
        )}
      >
        {/* ─── Header sticky (shadcn ya renderiza el botón X en top-right) ─── */}
        <SheetHeader className="px-6 py-4 border-b border-border space-y-2 text-left">
          <div className="flex items-center gap-2">
            <Pill className={ENTITY_TONE[entityType]}>{ENTITY_LABEL[entityType]}</Pill>
          </div>
          <SheetTitle className="text-lg font-bold tracking-tight font-mono">
            {entityId}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {subtitle || ENTITY_SUBTITLE[entityType]}
          </SheetDescription>
        </SheetHeader>

        {/* ─── Body scrolleable ─── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <VentaContextCard ctx={ventaContext} />
          {children}
        </div>

        {/* ─── Footer sticky: link al expediente completo ─── */}
        <div className="border-t border-border bg-card px-6 py-3">
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-primary hover:text-primary/80"
            onClick={verExpediente}
          >
            Ver expediente completo
            <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
