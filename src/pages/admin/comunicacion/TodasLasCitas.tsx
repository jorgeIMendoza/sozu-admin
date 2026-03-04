import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Mail, Users, Eye } from "lucide-react";
import { format, startOfWeek, addDays, isBefore, isToday, isSameDay, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<number, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  1: { label: "Agendada", variant: "outline" },
  2: { label: "Pendiente", variant: "secondary" },
  3: { label: "Confirmada", variant: "default" },
};

interface ConfigCita {
  id: number;
  nombre: string;
  id_usuario_email: string;
  calendario_email: string;
  correos_enterado: string[];
  correos_enterado_fijos: string[];
  duracion_minutos: number;
  max_invitados: number;
  descripcion_invitacion: string | null;
  hora_inicio: number;
  hora_fin: number;
}

interface Cita {
  id: number;
  id_configuracion_cita: number;
  id_estatus_cita: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  nombre_prospecto: string | null;
  email_agente: string | null;
  notas: string | null;
  activo: boolean;
}

function parseTime(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

function CitaCard({ cita, config }: { cita: Cita; config?: ConfigCita }) {
  const st = STATUS_MAP[cita.id_estatus_cita] || { label: "?", variant: "outline" as const };
  const hasInvitados = !!(cita.email_agente || cita.nombre_prospecto);
  const isPast = isBefore(new Date(cita.fecha + "T23:59:59"), new Date()) && !isToday(new Date(cita.fecha));

  return (
    <div
      className={cn(
        "absolute inset-x-0.5 rounded border px-1.5 py-0.5 text-[10px] leading-tight overflow-hidden cursor-default transition-colors z-10",
        isPast
          ? "bg-muted/60 border-muted text-muted-foreground"
          : hasInvitados
            ? "bg-primary/10 border-primary/30 text-foreground"
            : "bg-muted/40 border-border text-muted-foreground opacity-60"
      )}
      title={`${cita.hora_inicio} - ${cita.hora_fin}\n${cita.nombre_prospecto || ""}\n${cita.email_agente || ""}`}
    >
      <div className="flex items-center gap-1 font-medium truncate">
        <Badge variant={st.variant} className="text-[8px] px-1 py-0 h-3.5 leading-none">{st.label}</Badge>
        <span className="truncate">{config?.nombre || `#${cita.id_configuracion_cita}`}</span>
      </div>
      {cita.nombre_prospecto && (
        <div className="truncate flex items-center gap-0.5 mt-0.5">
          <Users className="h-2.5 w-2.5 flex-shrink-0" />
          {cita.nombre_prospecto}
        </div>
      )}
      {cita.email_agente && (
        <div className="truncate flex items-center gap-0.5">
          <Mail className="h-2.5 w-2.5 flex-shrink-0" />
          {cita.email_agente}
        </div>
      )}
      {config && (
        <div className="truncate flex items-center gap-0.5 text-muted-foreground">
          <User className="h-2.5 w-2.5 flex-shrink-0" />
          {config.id_usuario_email}
        </div>
      )}
      {config?.correos_enterado_fijos && config.correos_enterado_fijos.length > 0 && (
        <div className="truncate flex items-center gap-0.5 text-muted-foreground">
          <Eye className="h-2.5 w-2.5 flex-shrink-0" />
          Siempre: {config.correos_enterado_fijos.join(", ")}
        </div>
      )}
      {config?.correos_enterado && config.correos_enterado.length > 0 && (
        <div className="truncate flex items-center gap-0.5 text-muted-foreground">
          <Eye className="h-2.5 w-2.5 flex-shrink-0" />
          {config.correos_enterado.join(", ")}
        </div>
      )}
    </div>
  );
}

export default function TodasLasCitas() {
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [ownerFilter, setOwnerFilter] = useState("all");

  useEffect(() => {
    registrarVista("/admin/comunicacion/todas-las-citas");
    track({ page: "todas_las_citas", elementId: "page_view", elementType: "page" });
  }, []);

  const { data: configs = [] } = useQuery({
    queryKey: ["all-citas-configs"],
    queryFn: async () => {
      const { data } = await (supabase.from("configuracion_citas_usuarios") as any)
        .select("id, nombre, id_usuario_email, calendario_email, correos_enterado, correos_enterado_fijos, duracion_minutos, max_invitados, descripcion_invitacion, hora_inicio, hora_fin")
        .eq("activo", true);
      return (data || []) as ConfigCita[];
    },
  });

  const weekEnd = addDays(weekStart, 6);
  const { data: citas = [], isLoading } = useQuery({
    queryKey: ["all-citas-reservas-week", weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await (supabase.from("reservas_citas") as any)
        .select("*")
        .eq("activo", true)
        .gte("fecha", format(weekStart, "yyyy-MM-dd"))
        .lte("fecha", format(weekEnd, "yyyy-MM-dd"))
        .order("hora_inicio", { ascending: true });
      return (data || []) as Cita[];
    },
  });

  const configMap = useMemo(() => {
    const m = new Map<number, ConfigCita>();
    configs.forEach(c => m.set(c.id, c));
    return m;
  }, [configs]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    configs.forEach(c => set.add(c.id_usuario_email));
    return Array.from(set).sort();
  }, [configs]);

  // Compute time range from configs or default 9-20
  const { minHour, maxHour } = useMemo(() => {
    let min = 9, max = 20;
    if (configs.length > 0) {
      const starts = configs.map(c => c.hora_inicio ?? 9).filter(Boolean);
      const ends = configs.map(c => c.hora_fin ?? 20).filter(Boolean);
      if (starts.length) min = Math.min(...starts);
      if (ends.length) max = Math.max(...ends);
    }
    return { minHour: min, maxHour: max };
  }, [configs]);

  const hours = useMemo(() => {
    const h: number[] = [];
    for (let i = minHour; i < maxHour; i++) h.push(i);
    return h;
  }, [minHour, maxHour]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const filteredCitas = useMemo(() => {
    return citas.filter((c) => {
      if (ownerFilter === "all") return true;
      const config = configMap.get(c.id_configuracion_cita);
      return config?.id_usuario_email === ownerFilter;
    });
  }, [citas, ownerFilter, configMap]);

  // Group citas by day
  const citasByDay = useMemo(() => {
    const map = new Map<string, Cita[]>();
    filteredCitas.forEach(c => {
      const key = c.fecha;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [filteredCitas]);

  const now = new Date();
  const slotHeight = 64; // px per hour

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Todas las Citas</h1>
        <div className="flex items-center gap-2">
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Dueño" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los dueños</SelectItem>
              {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            {format(weekStart, "d MMM", { locale: es })} – {format(weekEnd, "d MMM yyyy", { locale: es })}
          </span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Cargando citas...</p>
      ) : (
        <div className="border rounded-lg overflow-auto bg-card">
          <div className="grid min-w-[800px]" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
            {/* Header row */}
            <div className="border-b border-r bg-muted/30 p-2" />
            {days.map(day => {
              const past = isBefore(day, now) && !isToday(day);
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-b border-r p-2 text-center text-xs font-medium",
                    today && "bg-primary/5",
                    past && "bg-muted/40 text-muted-foreground"
                  )}
                >
                  <div className="uppercase">{format(day, "EEE", { locale: es })}</div>
                  <div className={cn("text-lg font-bold", today && "text-primary")}>{format(day, "d")}</div>
                </div>
              );
            })}

            {/* Time grid */}
            {hours.map(hour => (
              <>
                {/* Time label */}
                <div key={`label-${hour}`} className="border-r border-b text-[10px] text-muted-foreground pr-1 text-right pt-0.5" style={{ height: slotHeight }}>
                  {String(hour).padStart(2, "0")}:00
                </div>
                {/* Day columns */}
                {days.map(day => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const past = isBefore(day, now) && !isToday(day);
                  const today = isToday(day);
                  const dayCitas = citasByDay.get(dayKey) || [];
                  // Citas that overlap this hour slot
                  const slotCitas = dayCitas.filter(c => {
                    const start = parseTime(c.hora_inicio);
                    const end = parseTime(c.hora_fin);
                    return start < hour + 1 && end > hour;
                  });

                  return (
                    <div
                      key={`${hour}-${dayKey}`}
                      className={cn(
                        "border-r border-b relative",
                        past && "bg-muted/20",
                        today && "bg-primary/[0.02]"
                      )}
                      style={{ height: slotHeight }}
                    >
                      {/* Half-hour line */}
                      <div className="absolute left-0 right-0 border-b border-dashed border-border/40" style={{ top: slotHeight / 2 }} />

                      {slotCitas.map(cita => {
                        const start = parseTime(cita.hora_inicio);
                        const end = parseTime(cita.hora_fin);
                        const topOffset = Math.max(0, (start - hour)) * slotHeight;
                        const bottomClip = Math.min(1, end - hour) * slotHeight;
                        const h = bottomClip - topOffset;

                        // Only render from the slot where it starts
                        if (start < hour && start >= hour - 1) return null;
                        if (Math.floor(start) !== hour && start >= hour) return null;
                        // Render if starts in this hour
                        if (start >= hour && start < hour + 1) {
                          const totalDuration = end - start;
                          const cardHeight = totalDuration * slotHeight;
                          return (
                            <div key={cita.id} className="absolute inset-x-0" style={{ top: topOffset, height: cardHeight, zIndex: 10 }}>
                              <CitaCard cita={cita} config={configMap.get(cita.id_configuracion_cita)} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
