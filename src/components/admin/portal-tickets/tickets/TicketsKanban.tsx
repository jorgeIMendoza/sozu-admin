import { useState } from "react";
import { Mail, Pencil, Phone } from "lucide-react";
import { antiguedad, fechaCorta, type Ticket } from "@/lib/portal-tickets/tickets-data";
import { useTickets } from "@/lib/portal-tickets/tickets-store";
import { PriorityDot } from "./PriorityDot";
import { cn } from "@/lib/utils";

export function TicketsKanban({
  tickets,
  pipelineId,
  onAbrir,
}: {
  tickets: Ticket[];
  pipelineId: string;
  onAbrir: (t: Ticket) => void;
}) {
  const { etapas, agentes, categorias, moverEtapa } = useTickets();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  const columnas = etapas
    .filter((e) => e.pipelineId === pipelineId)
    .sort((a, b) => a.orden - b.orden);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columnas.map((etapa) => {
        const items = tickets.filter((t) => t.etapaId === etapa.id);
        return (
          <div
            key={etapa.id}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(etapa.id);
            }}
            onDragLeave={() => setSobre((s) => (s === etapa.id ? null : s))}
            onDrop={() => {
              if (arrastrando) moverEtapa(arrastrando, etapa.id);
              setArrastrando(null);
              setSobre(null);
            }}
            className={cn(
              "flex w-[300px] shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors",
              sobre === etapa.id && "border-primary bg-accent/60",
            )}
          >
            <div className="flex items-center gap-2 border-b bg-card px-3 py-2.5">
              <span className="text-sm font-semibold">{etapa.nombre}</span>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {items.length}
              </span>
            </div>

            <div className="flex max-h-[calc(100vh-330px)] flex-col gap-2 overflow-y-auto p-2">
              {items.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Sin tickets en esta etapa
                </p>
              )}
              {items.map((t) => {
                const owner = agentes.find((a) => a.id === t.propietarioId);
                const cat = categorias.find((c) => c.id === t.categoriaId);
                return (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={() => setArrastrando(t.id)}
                    onDragEnd={() => setArrastrando(null)}
                    onClick={() => onAbrir(t)}
                    className={cn(
                      "cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md",
                      arrastrando === t.id && "opacity-50",
                    )}
                  >
                    <h4 className="font-semibold text-primary">{t.nombre}</h4>
                    <p className="mt-1 text-xs text-muted-foreground">{antiguedad(t.fechaCreacion)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Propietario: {owner?.nombre ?? "Sin asignar"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fecha de creación: {fechaCorta(t.fechaCreacion)}
                    </p>
                    {t.fechaCierre && (
                      <p className="text-xs text-muted-foreground">
                        Fecha de cierre: {fechaCorta(t.fechaCierre)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Categoría: {cat?.nombre}</p>

                    <div className="mt-2 flex items-center justify-between border-t pt-2">
                      <PriorityDot prioridad={t.prioridad} />
                      <div className="flex items-center gap-2 text-primary">
                        <Phone className="size-3.5" />
                        <Mail className="size-3.5" />
                        <Pencil className="size-3.5" />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}