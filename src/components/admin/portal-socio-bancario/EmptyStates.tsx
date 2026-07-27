import { ReactNode } from "react";
import { Building2, FileClock, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Estados vacíos honestos del Portal Socio Bancario.
 *
 * - `DesarrolloNoAsignado`: el usuario socio no tiene un desarrollo vinculado
 *   (idProyecto null). NO se muestran datos de ningún proyecto (evita fuga).
 * - `PendienteDeCarga`: un dato que AÚN NO EXISTE en la base (programa de obra,
 *   dictamen del perito, meta de colocación…). Nunca se fabrica un valor: se
 *   muestra este estado + un // SWAP POINT en el código.
 */

export function DesarrolloNoAsignado() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-20 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Building2 className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">Desarrollo no asignado</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          Tu usuario aún no está vinculado a un desarrollo. Una vez que el vínculo
          esté configurado en el sistema, aquí verás la información del desarrollo
          que financiaste.
        </p>
      </div>
    </div>
  );
}

/** Estado vacío para un dato pendiente de carga en la base (no fabricado). */
export function PendienteDeCarga({
  titulo,
  detalle,
  icon: Icon = FileClock,
  className,
}: {
  titulo: string;
  detalle?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center",
        className,
      )}
    >
      <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {detalle && <p className="max-w-sm text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}
