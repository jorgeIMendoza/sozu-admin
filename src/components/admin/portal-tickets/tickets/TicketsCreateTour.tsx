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
  { sel: "ct-enviar", titulo: "7. ¡Créalo!", texto: 'Da clic en "Crear ticket". No termino hasta que crees el tuyo. 😉', gate: "crear" },
];

const TIP_W = 300;

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

  const paso = PASOS[i];

  // Reiniciar al abrir el tutorial.
  useEffect(() => {
    if (open) {
      setI(0);
      setHecho(false);
    }
  }, [open]);

  // Al abrir el formulario, capturar cuántos tickets había (para detectar el nuevo).
  useEffect(() => {
    if (open && dialogOpen) baseCount.current = tickets.length;
    // tickets.length intencionalmente fuera de deps: solo re-snapshot al abrir/cerrar el form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dialogOpen]);

  // Gate "abrir": avanzar cuando el formulario se abre.
  useEffect(() => {
    if (!open || hecho) return;
    if (paso?.gate === "abrir" && dialogOpen) setI((n) => n + 1);
    // Si cierran el form a mitad de los pasos explicativos, regresar a "abre el formulario".
    else if (paso && !paso.gate && !dialogOpen) setI(0);
  }, [open, hecho, dialogOpen, paso]);

  // Gate "crear": cuando la lista crece respecto al snapshot → ¡creado!
  useEffect(() => {
    if (!open || hecho) return;
    if (paso?.gate === "crear" && tickets.length > baseCount.current) setHecho(true);
  }, [open, hecho, tickets.length, paso]);

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

  let tipStyle: CSSProperties;
  if (rect) {
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - TIP_W - 8);
    const abajoHay = window.innerHeight - rect.bottom > 190;
    tipStyle = abajoHay
      ? { top: rect.bottom + 12, left }
      : { top: rect.top - 12, left, transform: "translateY(-100%)" };
  } else {
    tipStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

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
                {paso.gate === "abrir" ? "Esperando tu clic…" : "Esperando tu ticket…"}
              </span>
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
