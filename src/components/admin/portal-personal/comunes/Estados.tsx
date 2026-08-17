import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function EstadoCarga({ filas = 4 }: { filas?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: filas }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Skeletons con la forma de las tarjetas del inventario. */
export function EstadoCargaTarjetas({ tarjetas = 6 }: { tarjetas?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: tarjetas }).map((_, i) => (
        <div key={i} className="card-sozu overflow-hidden">
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EstadoVacio({
  titulo,
  descripcion,
  icono: Icono = Inbox,
  accion,
}: {
  titulo: string;
  descripcion: string;
  icono?: LucideIcon;
  accion?: { etiqueta: string; onClick: () => void };
}) {
  return (
    <div className="card-sozu flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <Icono className="size-6 text-gris" />
      <p className="text-sm font-bold text-negro">{titulo}</p>
      <p className="max-w-sm text-sm text-gris">{descripcion}</p>
      {accion && (
        <Button variant="outline" className="mt-2" onClick={accion.onClick}>
          {accion.etiqueta}
        </Button>
      )}
    </div>
  );
}


export function EstadoError({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="card-sozu flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <AlertTriangle className="size-6 text-rojo" />
      <p className="text-sm font-bold text-negro">No pudimos cargar esta información</p>
      <p className="max-w-sm text-sm text-gris">
        Ocurrió un problema al consultar los datos. Puedes intentarlo de nuevo.
      </p>
      <Button variant="outline" onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  );
}
