import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function EstadoVacio({
  icono: Icono,
  titulo,
  texto,
}: {
  icono: LucideIcon;
  titulo: string;
  texto: string;
}) {
  return (
    <Card className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-10 text-center">
      <Icono className="size-12 text-muted-foreground/40" strokeWidth={1.5} />
      <h2 className="text-xl font-semibold text-foreground">{titulo}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{texto}</p>
    </Card>
  );
}
