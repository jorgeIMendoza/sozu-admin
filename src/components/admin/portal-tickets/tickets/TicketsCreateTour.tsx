// Tutorial interactivo "crea un ticket paso a paso" (estilo videojuego): resalta el botón
// real y ESPERA a que el usuario actúe. Te lleva de la mano por el formulario y NO termina
// hasta que la persona crea un ticket ella misma (se detecta que la lista creció).
// Overlay click-through (pointer-events-none) para que sí puedan interactuar de verdad.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, PartyPopper, X } from "lucide-react";
import { useTickets } from "@/lib/portal-tickets/tickets-store";

type Paso = { sel: string; titulo: string; texto: string; gate?: "abrir" | "crear" };

const PASOS: Paso[] = [
  { sel: "crear", titulo: "1. Abre el formulario", texto: 'Da clic en "Crear ticket". Aquí te espero.', gate: "abrir" },
  { sel: "ct-nombre", titulo: "2. Nombre", texto: 'Un título claro. Ej. "1820 — fuga en calentador".' },
  { sel: "ct-pipeline", titulo: "3. Pipeline", texto: "El flujo al que pertenece (ej. Atención al Cliente)." },
  { sel: "ct-estado", titulo: "4. Estado", texto: "La etapa inicial dentro de ese flujo." },
  { sel: "ct-solicitante", titulo: "5. Solicitante", texto: "El contacto que reporta; búscalo por nombre o correo." },
  { sel: "ct-propietarios", titulo: "6. Responsable(s)", texto: "Quién lo atiende. Recibirá el aviso al asignarlo." },
  { sel: "ct-prioridad", titulo: "7. Prioridad", texto: "Qué tan urgente es el caso." },
  { sel: "ct-categoria", titulo: "8. Categoría", texto: "Clasifícalo dentro del flujo." },
  { sel: "ct-evidencia", titulo: "9. Evidencia", texto: "Sube fotos, video o una nota de voz (opcional)." },
  { sel: "ct-enviar", titulo: "10. ¡Ya está!", texto: 'Da clic en "Crear ticket" para crearlo, o "Terminar" para salir.' },
];

const TIP_W = 300;
const TIP_H = 160; // alto aproximado del globo (para centrar/limitar)

// Coloca el globo AL LADO del objetivo (izq/der) cuando hay espacio, para no tapar el campo
// ni el dropdown del Select (que abre hacia abajo). Si no, abajo o arriba. Centrado si no hay rect.
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

export function TicketsCreateTour({
  open,
  onClose,
  dialogOpen,
}: {
  open: boolean;
  onClose: () => void;
  dialogOpen: boolean;
}) {
  const { tickets } = useTickets();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [hecho, setHecho] = useState(false);
  const baseCount = useRef(0);
  const armado = useRef(false); // el formulario ya se abrió al menos una vez

  const paso = PASOS[i];

  // Reiniciar al abrir el tutorial.
  useEffect(() => {
    if (open) {
      setI(0);
      setHecho(false);
      armado.current = false;
    }
  }, [open]);

  // Al abrir el formulario, capturar cuántos tickets había (para detectar el nuevo).
  useEffect(() => {
    if (open && dialogOpen) {
      baseCount.current = tickets.length;
      armado.current = true;
    }
    // tickets.length intencionalmente fuera de deps: solo re-snapshot al abrir/cerrar el form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dialogOpen]);

  // Gate "abrir": avanzar cuando el formulario se abre.
  useEffect(() => {
    if (!open || hecho) return;
    if (paso?.gate === "abrir" && dialogOpen) setI((n) => n + 1);
    // Si cierran el form a mitad de los pasos explicativos (no el último), volver a "abre el formulario".
    else if (paso && !paso.gate && i < PASOS.length - 1 && !dialogOpen) setI(0);
  }, [open, hecho, dialogOpen, paso, i]);

  // Bono: si crea un ticket durante el tutorial (la lista creció tras abrir el form), celebrar.
  useEffect(() => {
    if (!open || hecho) return;
    if (armado.current && tickets.length > baseCount.current) setHecho(true);
  }, [open, hecho, tickets.length]);

  // Medir el elemento objetivo (re-mide en scroll/resize y por intervalo mientras abre el form).
  useLayoutEffect(() => {
    if (!open || hecho) return;
    let raf = 0;
    const medir = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${paso.sel}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    document
      .querySelector<HTMLElement>(`[data-tour="${paso.sel}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
    medir();
    const t = window.setTimeout(medir, 280);
    const iv = window.setInterval(medir, 500);
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(medir);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(iv);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, hecho, i, paso?.sel, dialogOpen]);

  // Esc para salir.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // ── Pantalla final de éxito ──
  if (hecho) {
    return createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: "rgba(2,6,23,0.62)" }}
      >
        <div className="w-[320px] rounded-xl border border-border bg-popover p-6 text-center text-popover-foreground shadow-xl">
          <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <PartyPopper className="size-7" />
          </span>
          <p className="text-lg font-semibold">¡Creaste tu primer ticket! 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ya sabes lo esencial. Puedes repetir el tutorial cuando quieras.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Terminar
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  const esGate = !!paso.gate;
  const ultimo = i === PASOS.length - 1;

  const tipStyle = posicionGlobo(rect);

  return createPortal(
    // Contenedor click-through: los clics pasan a la app para que interactúen de verdad.
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {rect && (
        <div
          className="fixed rounded-xl ring-2 ring-primary transition-all duration-200"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px rgba(2,6,23,0.55)",
          }}
        />
      )}

      <div
        role="dialog"
        aria-label="Tutorial: crear un ticket"
        data-tour-tooltip
        className="pointer-events-auto fixed w-[300px] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl transition-all duration-200"
        style={tipStyle}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Salir del tutorial"
          className="absolute right-2 top-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <p className="pr-5 text-sm font-semibold">{paso.titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">{paso.texto}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {i + 1}/{PASOS.length}
          </span>
          <div className="flex items-center gap-1.5">
            {i > 0 && !esGate && (
              <button
                type="button"
                onClick={() => setI((n) => Math.max(0, n - 1))}
                className="inline-flex items-center rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                <ChevronLeft className="size-3.5" />
                Atrás
              </button>
            )}
            {esGate ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                Esperando tu clic…
              </span>
            ) : ultimo ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Terminar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setI((n) => n + 1)}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Siguiente
                <ChevronRight className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
