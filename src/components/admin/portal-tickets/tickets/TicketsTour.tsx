// Recorrido guiado (coach-marks) del Portal de Tickets: oscurece la pantalla, resalta el
// elemento REAL (por su atributo data-tour) y muestra un globito con UNA frase corta.
// Filosofía: mostrar > explicar. Sin dependencias externas (overlay + spotlight con box-shadow).
import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Paso = { sel: string; titulo: string; texto: string };

const PASOS: Paso[] = [
  { sel: "crear", titulo: "Crea un ticket", texto: "Empieza aquí para levantar uno nuevo." },
  { sel: "vista", titulo: "Lista o tablero", texto: "Alterna entre lista y tablero Kanban." },
  { sel: "pipeline", titulo: "Filtra por flujo", texto: "Un pipeline, o todos a la vez." },
  { sel: "buscar", titulo: "Busca al instante", texto: "Por nombre o por folio (#1005)." },
  { sel: "tutorial", titulo: "¿Dudas luego?", texto: "Reabre este recorrido cuando quieras." },
];

const PAD = 8;
const TIP_W = 300;
const TIP_H = 160; // alto aproximado del globo (para centrar/limitar)

// Coloca el globo AL LADO del objetivo (izq/der) cuando hay espacio, para no tapar el
// elemento ni un posible dropdown; si no, abajo/arriba. Centrado si no hay objetivo.
function posicionGlobo(rect: DOMRect | null): CSSProperties {
  if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  const GAP = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampTop = (t: number) => Math.min(Math.max(t, 8), Math.max(8, vh - TIP_H - 8));
  const clampLeft = (l: number) => Math.min(Math.max(l, 8), Math.max(8, vw - TIP_W - 8));
  const centroV = clampTop(rect.top + rect.height / 2 - TIP_H / 2);
  if (rect.left >= TIP_W + GAP) return { top: centroV, left: rect.left - GAP - TIP_W };
  if (vw - rect.right >= TIP_W + GAP) return { top: centroV, left: rect.right + GAP };
  if (vh - rect.bottom >= TIP_H + GAP) return { top: rect.bottom + GAP, left: clampLeft(rect.left) };
  return { top: rect.top - GAP, left: clampLeft(rect.left), transform: "translateY(-100%)" };
}

export function TicketsTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  const paso = PASOS[i];

  // Medir el elemento objetivo (y re-medir en scroll/resize).
  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;
    const medir = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${paso.sel}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    document
      .querySelector<HTMLElement>(`[data-tour="${paso.sel}"]`)
      ?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    medir();
    const t = window.setTimeout(medir, 280); // re-medir tras el scroll
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(medir);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, i, paso?.sel]);

  // Teclado: Esc cierra, flechas navegan.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setI((n) => Math.min(PASOS.length - 1, n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const primero = i === 0;
  const ultimo = i === PASOS.length - 1;

  const tipStyle = posicionGlobo(rect);

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(2,6,23,0.62)",
          }}
        />
      ) : (
        <div className="fixed inset-0" style={{ background: "rgba(2,6,23,0.62)" }} />
      )}

      <div
        role="dialog"
        aria-label="Tutorial del Portal de Tickets"
        data-tour-tooltip
        className="fixed w-[300px] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl transition-all duration-200"
        style={tipStyle}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar tutorial"
          className="absolute right-2 top-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <p className="pr-5 text-sm font-semibold text-foreground">{paso.titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">{paso.texto}</p>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {PASOS.map((_, idx) => (
              <span
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === i ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {!primero && (
              <button
                type="button"
                onClick={() => setI((n) => Math.max(0, n - 1))}
                className="inline-flex items-center rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                <ChevronLeft className="size-3.5" />
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={() => (ultimo ? onClose() : setI((n) => n + 1))}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {ultimo ? "Listo" : "Siguiente"}
              {!ultimo && <ChevronRight className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
