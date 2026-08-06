// Tutorial de onboarding del Portal de Tickets. Modal por pasos (shadcn Dialog +
// framer-motion). Se auto-abre la 1ª vez (el workspace guarda la marca en localStorage)
// y se puede reabrir cuando se quiera con el botón "Tutorial".
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  Plus,
  ListChecks,
  LayoutGrid,
  Users,
  Mic,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Paso = { icon: LucideIcon; titulo: string; texto: string };

const PASOS: Paso[] = [
  {
    icon: Sparkles,
    titulo: "Bienvenido al Portal de Tickets",
    texto:
      "Aquí levantas, asignas y das seguimiento a tickets de escrituración, servicio, entregas y mantenimiento. Te muestro lo esencial en menos de un minuto.",
  },
  {
    icon: Plus,
    titulo: "Crea un ticket",
    texto:
      'Con "Crear ticket" eliges pipeline, etapa, prioridad y categoría, y lo vinculas a un contacto y a un proyecto. Cada ticket tiene un folio (#) para ubicarlo rápido.',
  },
  {
    icon: ListChecks,
    titulo: "Tres vistas y búsqueda",
    texto:
      '"Todos", "Mis tickets" (donde eres responsable o lo creaste) y "Sin asignar". Filtra por pipeline —o elige "Todos los pipelines"— y busca por nombre o por folio.',
  },
  {
    icon: LayoutGrid,
    titulo: "Tablero Kanban",
    texto:
      "Arrastra un ticket entre etapas para cambiar su estado. Las columnas sin tickets se colapsan solas; ábrelas con un clic cuando las necesites.",
  },
  {
    icon: Users,
    titulo: "Responsables y avisos",
    texto:
      "Asigna uno o varios propietarios. Al asignar les llega un aviso por correo (y WhatsApp si tienen teléfono); al cerrar el ticket se avisa a los propietarios y a quien lo creó.",
  },
  {
    icon: Mic,
    titulo: "Evidencia y notas de voz",
    texto:
      "Sube fotos y videos como evidencia, y graba notas de voz —en el ticket o en cada seguimiento— desde la computadora o el celular.",
  },
  {
    icon: CheckCircle2,
    titulo: "¡Listo!",
    texto:
      'Eso es lo esencial. Puedes reabrir este tutorial cuando quieras con el botón "Tutorial" en la parte superior.',
  },
];

export function TutorialDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  const paso = PASOS[i];
  const Icono = paso.icon;
  const primero = i === 0;
  const ultimo = i === PASOS.length - 1;

  const cerrar = () => {
    onOpenChange(false);
    // Reiniciar al primer paso tras la animación de salida (para la próxima apertura).
    setTimeout(() => setI(0), 250);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : cerrar())}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <DialogTitle className="sr-only">Tutorial del Portal de Tickets</DialogTitle>

        <div className="flex justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pb-3 pt-9">
          <AnimatePresence mode="wait">
            <motion.span
              key={i}
              initial={reduce ? false : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"
            >
              <Icono className="size-7" />
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="px-6 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
              transition={{ duration: 0.2 }}
              className="min-h-[116px] text-center"
            >
              <h2 className="text-lg font-semibold text-foreground">{paso.titulo}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{paso.texto}</p>
            </motion.div>
          </AnimatePresence>

          {/* Indicadores de paso */}
          <div className="mt-5 flex items-center justify-center gap-1.5">
            {PASOS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Ir al paso ${idx + 1}`}
                onClick={() => setI(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === i ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={cerrar} className="text-muted-foreground">
              Saltar
            </Button>
            <div className="flex items-center gap-2">
              {!primero && (
                <Button variant="outline" size="sm" onClick={() => setI((n) => Math.max(0, n - 1))}>
                  <ChevronLeft className="size-4" />
                  Atrás
                </Button>
              )}
              <Button size="sm" onClick={() => (ultimo ? cerrar() : setI((n) => n + 1))}>
                {ultimo ? "Entendido" : "Siguiente"}
                {!ultimo && <ChevronRight className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
