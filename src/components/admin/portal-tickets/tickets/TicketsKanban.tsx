import { useEffect, useRef, useState, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, Mail, Pencil, Phone } from "lucide-react";
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
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());

  const columnas = etapas
    .filter((e) => e.pipelineId === pipelineId)
    .sort((a, b) => a.orden - b.orden);

  // La 1ª vez que hay etapas + tickets de este pipeline, colapsar las etapas SIN tickets.
  // (Se marca por pipeline; los toggles manuales del usuario ya no se sobrescriben.)
  const iniciado = useRef<string | null>(null);
  useEffect(() => {
    if (!columnas.length || !tickets.length || iniciado.current === pipelineId) return;
    iniciado.current = pipelineId;
    setColapsadas(new Set(columnas.filter((e) => !tickets.some((t) => t.etapaId === e.id)).map((e) => e.id)));
  }, [pipelineId, columnas, tickets]);

  const toggle = (id: string) =>
    setColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Handlers de "soltar" compartidos: la columna abierta y la colapsada aceptan drops.
  const dropHandlers = (etapaId: string) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setSobre(etapaId);
    },
    onDragLeave: () => setSobre((s) => (s === etapaId ? null : s)),
    onDrop: () => {
      if (arrastrando) moverEtapa(arrastrando, etapaId);
      setArrastrando(null);
      setSobre(null);
    },
  });

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columnas.map((etapa) => {
        const items = tickets.filter((t) => t.etapaId === etapa.id);

        // ── Columna COLAPSADA: pestaña vertical angosta (sigue aceptando drops) ──
        if (colapsadas.has(etapa.id)) {
          return (
            <div
              key={etapa.id}
              {...dropHandlers(etapa.id)}
              className={cn(
                "flex w-11 shrink-0 self-stretch flex-col items-center rounded-lg border bg-muted/30 transition-colors",
                sobre === etapa.id && "border-primary bg-accent/60",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(etapa.id)}
                title={`Mostrar "${etapa.nombre}"`}
                className="flex min-h-[240px] flex-1 cursor-pointer flex-col items-center gap-2 py-2 text-muted-foreground transition-opacity hover:opacity-80"
              >
                <ChevronRight className="size-4 shrink-0" />
                <span className="text-xs font-semibold [writing-mode:vertical-lr]">{etapa.nombre}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {items.length}
                </span>
              </button>
            </div>
          );
        }

        // ── Columna ABIERTA ──
        return (
          <div
            key={etapa.id}
            {...dropHandlers(etapa.id)}
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
              <button
                type="button"
                onClick={() => toggle(etapa.id)}
                title="Contraer columna"
                aria-label={`Contraer "${etapa.nombre}"`}
                className="ml-auto text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
              >
                <ChevronLeft className="size-3.5" />
              </button>
            </div>

            <div className="flex max-h-[calc(100vh-330px)] flex-col gap-2 overflow-y-auto p-2">
              {items.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Sin tickets en esta etapa
                </p>
              )}
              {items.map((t) => {
                const ownerLabel = t.propietarios
                  .map((id) => agentes.find((a) => a.id === id)?.nombre)
                  .filter(Boolean)
                  .join(", ");
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
                    <h4 className="font-semibold text-primary">
                      <span className="mr-1 text-xs font-medium tabular-nums text-muted-foreground">
                        #{t.numero}
                      </span>
                      {t.nombre}
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">{antiguedad(t.fechaCreacion)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.propietarios.length > 1 ? "Propietarios" : "Propietario"}:{" "}
                      {ownerLabel || "Sin asignar"}
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
