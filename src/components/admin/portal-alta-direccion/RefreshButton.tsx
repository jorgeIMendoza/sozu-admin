import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botón "Refrescar" para las páginas de reporte del Portal Alta
 * Dirección. Invalida los queries cuyo `queryKey[0]` empieza con uno de
 * los prefijos pasados, forzando un refetch — necesario porque las
 * vistas usan `staleTime` largo (5 min) para cargas rápidas en
 * revisitas, y el Director debe poder ver datos frescos cuando lo
 * necesite.
 */
export function RefreshButton({
  keyPrefixes,
  className,
}: {
  keyPrefixes: string[];
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  const handleClick = async () => {
    setSpinning(true);
    try {
      await Promise.all(
        keyPrefixes.map((prefix) =>
          queryClient.invalidateQueries({
            predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === prefix,
          }),
        ),
      );
    } finally {
      // Pequeño delay para que el spin sea visible al menos 400ms.
      setTimeout(() => setSpinning(false), 400);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-9 gap-1.5 text-[12px]", className)}
      onClick={handleClick}
      disabled={spinning}
      aria-label="Refrescar datos"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
      Refrescar
    </Button>
  );
}
