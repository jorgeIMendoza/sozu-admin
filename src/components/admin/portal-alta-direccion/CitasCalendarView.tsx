/**
 * Vista de calendario mensual para "Citas Comerciales" (Portal Alta Dirección).
 *
 * Alternativa visual a la lista: pinta las citas del mes en una cuadrícula
 * Lun–Dom, con navegación de mes y color por estado. Al hacer clic en una cita
 * se abre un diálogo de solo lectura con su detalle completo.
 *
 * Es puramente de presentación: recibe las citas ya filtradas desde la página
 * (mismos filtros que la lista) y no ejecuta ninguna consulta ni mutación.
 */
import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Building2, User, UserCircle, Hash, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/admin/portal-alta-direccion/ui";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  type CitaRow,
  fmtFolio,
  fmtHora,
  fmtCreacion,
  getEstadoDisplay,
  nombreAsistente,
  nombreAgente,
} from "@/pages/admin/portal-alta-direccion/citas-utils";

/** Punto de color por estado, para los chips del calendario. */
const ESTADO_DOT: Record<string, string> = {
  agendada: "bg-sky-500",
  pendiente: "bg-amber-500",
  confirmada: "bg-emerald-500",
  asistio: "bg-emerald-600",
  cancelada: "bg-red-500",
  otro: "bg-muted-foreground",
};

/** Convierte "YYYY-MM-DD" a Date local (sin desfase por zona horaria). */
function parseFechaLocal(f: string): Date {
  const [y, m, d] = f.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CitasCalendarView({ citas }: { citas: CitaRow[] }) {
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<CitaRow | null>(null);

  // Días a pintar: semanas completas (Lun–Dom) que cubren el mes del cursor.
  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const fin = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: inicio, end: fin });
  }, [cursor]);

  // Índice fecha → citas de ese día (ordenadas por hora de inicio).
  const citasPorDia = useMemo(() => {
    const map = new Map<string, CitaRow[]>();
    for (const c of citas) {
      if (!c.fecha) continue;
      const arr = map.get(c.fecha) ?? [];
      arr.push(c);
      map.set(c.fecha, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.hora_inicio || "").localeCompare(b.hora_inicio || ""));
    }
    return map;
  }, [citas]);

  const mesLabel = format(cursor, "MMMM yyyy", { locale: es });

  return (
    <div>
      {/* Barra de navegación de mes */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor((d) => addMonths(d, -1))} title="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setCursor(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor((d) => addMonths(d, 1))} title="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h3 className="text-sm font-semibold capitalize">{mesLabel}</h3>
      </div>

      {/* Encabezado de días de la semana */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Cuadrícula del mes */}
      <div className="grid grid-cols-7 gap-px rounded-lg border bg-border overflow-hidden">
        {dias.map((dia) => {
          const key = format(dia, "yyyy-MM-dd");
          const delDia = citasPorDia.get(key) ?? [];
          const fueraDeMes = !isSameMonth(dia, cursor);
          const hoy = isToday(dia);
          return (
            <div
              key={key}
              className={cn(
                "min-h-[104px] bg-card p-1.5 flex flex-col gap-1",
                fueraDeMes && "bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    fueraDeMes ? "text-muted-foreground/60" : "text-muted-foreground",
                    hoy && "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold",
                  )}
                >
                  {format(dia, "d")}
                </span>
                {delDia.length > 0 && (
                  <span className="text-[10px] text-muted-foreground tabular-nums">{delDia.length}</span>
                )}
              </div>

              <div className="flex flex-col gap-0.5 overflow-hidden">
                {delDia.slice(0, 3).map((c) => {
                  const { key: estadoKey, label } = getEstadoDisplay(c);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelected(c)}
                      title={`${fmtHora(c.hora_inicio)} · ${nombreAsistente(c)} · ${label}`}
                      className={cn(
                        "group flex items-center gap-1 rounded px-1 py-0.5 text-left text-[10.5px] transition-colors hover:bg-muted",
                        estadoKey === "cancelada" && "opacity-60",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", ESTADO_DOT[estadoKey])} />
                      <span className="tabular-nums text-muted-foreground shrink-0">{fmtHora(c.hora_inicio)}</span>
                      <span className="truncate font-medium">{nombreAsistente(c)}</span>
                    </button>
                  );
                })}
                {delDia.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setSelected(delDia[3])}
                    className="px-1 text-left text-[10px] text-primary hover:underline"
                  >
                    +{delDia.length - 3} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda de colores */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <LegendItem dot="bg-sky-500" label="Agendada" />
        <LegendItem dot="bg-amber-500" label="Pendiente" />
        <LegendItem dot="bg-emerald-500" label="Confirmada" />
        <LegendItem dot="bg-emerald-600" label="Asistió" />
        <LegendItem dot="bg-red-500" label="Cancelada" />
      </div>

      <CitaDetalleDialog cita={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function LegendItem({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </span>
  );
}

/** Diálogo de solo lectura con el detalle completo de una cita. */
function CitaDetalleDialog({ cita, onClose }: { cita: CitaRow | null; onClose: () => void }) {
  if (!cita) return null;
  const { label, tone } = getEstadoDisplay(cita);
  const agente = nombreAgente(cita);
  const ubicacion = cita.ubicacion || "—";
  const creada = fmtCreacion(cita.fecha_creacion);
  const fechaLegible = cita.fecha
    ? format(parseFechaLocal(cita.fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
    : "—";
  const horario = cita.hora_fin
    ? `${fmtHora(cita.hora_inicio)} – ${fmtHora(cita.hora_fin)}`
    : fmtHora(cita.hora_inicio);

  return (
    <Dialog open={!!cita} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{fmtFolio(cita.id)}</span>
            <Pill className={tone}>{label}</Pill>
          </DialogTitle>
          <DialogDescription className="capitalize">{fechaLegible}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <DetalleRow icon={Clock} label="Horario" value={horario} />
          <DetalleRow icon={Hash} label="Tipo" value={cita.tipos_cita?.nombre || "—"} />
          <DetalleRow icon={User} label="Cliente / Asistente" value={nombreAsistente(cita)} />
          <DetalleRow icon={Building2} label="Desarrollo" value={cita.proyectos?.nombre || "—"} />
          <DetalleRow icon={MapPin} label="Ubicación" value={ubicacion} />
          <DetalleRow icon={UserCircle} label="Agente" value={agente} />
          <DetalleRow
            icon={CalendarDays}
            label="Creada"
            value={creada.fecha === "—" ? "—" : `${creada.fecha}${creada.hora ? ` · ${creada.hora}` : ""}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetalleRow({
  icon: Icon,
  label,
  value,
  muted = false,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  /** true = valor "por diseño" (p. ej. "No aplica"): se muestra atenuado e itálico. */
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("font-medium break-words", muted && "italic text-muted-foreground")}>{value}</p>
      </div>
    </div>
  );
}
