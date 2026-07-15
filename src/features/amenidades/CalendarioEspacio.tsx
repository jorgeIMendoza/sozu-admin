import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAmenidadesStore } from "./store";
import { bloqueoDe, estadoDeSlot, limiteHold, limitePago, restanteMs } from "./logic";
import type { EspacioReservable, EstadoSlot, Reserva } from "./types";
import {
  ESTADO_CELDA,
  ESTADO_DOT,
  ESTADO_ICON,
  ESTADO_LABEL,
  addDays,
  etiquetaDia,
  fmtContador,
  inicioDeSemana,
  isoDate,
} from "./ui";
import type { SlotSel } from "./SlotModal";

export function CalendarioEspacio({
  espacio,
  onSelect,
}: {
  espacio: EspacioReservable;
  onSelect: (s: SlotSel) => void;
}) {
  const reservas = useAmenidadesStore((s) => s.reservas);
  const bloqueos = useAmenidadesStore((s) => s.bloqueos);
  const ahora = useAmenidadesStore((s) => s.ahora);
  const [vista, setVista] = useState<"semana" | "mes">("semana");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [mesOffset, setMesOffset] = useState(0);

  const toSlot = (fecha: string, franja: string): SlotSel => {
    const { estado, reserva } = estadoDeSlot(reservas, bloqueos, espacio.id, fecha, franja);
    const blq = estado === "mantenimiento" ? bloqueoDe(bloqueos, espacio.id, fecha) : undefined;
    return { espacio, fecha, franja, estado, reserva, bloqueoId: blq?.id, bloqueoMotivo: blq?.motivo };
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
          {(["semana", "mes"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={cn("px-3 py-1 rounded-md font-medium", vista === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              {v === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => (vista === "semana" ? setSemanaOffset((o) => o - 1) : setMesOffset((o) => o - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => (vista === "semana" ? setSemanaOffset(0) : setMesOffset(0))}>
            Hoy
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => (vista === "semana" ? setSemanaOffset((o) => o + 1) : setMesOffset((o) => o + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {vista === "semana" ? (
        <VistaSemana espacio={espacio} ahora={ahora} offset={semanaOffset} toSlot={toSlot} onSelect={onSelect} />
      ) : (
        <VistaMes
          espacio={espacio}
          ahora={ahora}
          offset={mesOffset}
          toSlot={toSlot}
          onDia={(fecha) => {
            // Cambia a la semana que contiene el día elegido.
            const iniNow = inicioDeSemana(new Date(ahora)).getTime();
            const iniDia = inicioDeSemana(new Date(fecha + "T00:00:00")).getTime();
            setSemanaOffset(Math.round((iniDia - iniNow) / (7 * 24 * 3600_000)));
            setVista("semana");
          }}
        />
      )}
    </div>
  );
}

function VistaSemana({
  espacio,
  ahora,
  offset,
  toSlot,
  onSelect,
}: {
  espacio: EspacioReservable;
  ahora: number;
  offset: number;
  toSlot: (fecha: string, franja: string) => SlotSel;
  onSelect: (s: SlotSel) => void;
}) {
  const config = useAmenidadesStore((s) => s.config);
  const hoy = isoDate(new Date(ahora));
  const dias = useMemo(() => {
    const ini = addDays(inicioDeSemana(new Date(ahora)), offset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(ini, i));
  }, [ahora, offset]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-20 text-left text-[11px] text-muted-foreground font-medium px-1">Franja</th>
            {dias.map((d) => {
              const { dow, num } = etiquetaDia(d);
              const esHoy = isoDate(d) === hoy;
              return (
                <th key={d.toISOString()} className={cn("text-center text-[11px] font-medium rounded-t-md", esHoy ? "text-primary bg-primary/5" : "text-muted-foreground")}>
                  <div>{dow}</div>
                  <div className={cn("tabular-nums", esHoy ? "text-primary font-bold" : "text-foreground")}>{num}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {espacio.franjasHorarias.map((franja) => (
            <tr key={franja}>
              <td className="text-[11px] text-muted-foreground tabular-nums px-1 whitespace-nowrap">{franja}</td>
              {dias.map((d) => {
                const fecha = isoDate(d);
                const slot = toSlot(fecha, franja);
                return (
                  <td key={fecha} className={cn(isoDate(d) === hoy && "bg-primary/5")}>
                    <CeldaSemana slot={slot} ahora={ahora} config={config} esPasado={fecha < hoy} onSelect={onSelect} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function contadorDeReserva(r: Reserva | undefined, config: { holdHoras: number; pagoHoras: number }, ahora: number) {
  if (!r) return null;
  if (r.estado === "apartado") return fmtContador(restanteMs(limiteHold(r, config.holdHoras), ahora));
  if (r.estado === "por_pagar") return fmtContador(restanteMs(limitePago(r, config.pagoHoras), ahora));
  return null;
}

function CeldaSemana({
  slot,
  ahora,
  config,
  esPasado,
  onSelect,
}: {
  slot: SlotSel;
  ahora: number;
  config: { holdHoras: number; pagoHoras: number };
  esPasado: boolean;
  onSelect: (s: SlotSel) => void;
}) {
  const { estado, reserva } = slot;
  const Icon = ESTADO_ICON[estado];
  const cont = contadorDeReserva(reserva, config, ahora);
  const titulo = [
    `${slot.espacio.nombre}`,
    `${slot.fecha} · ${slot.franja}`,
    `Estado: ${ESTADO_LABEL[estado]}`,
    reserva ? `Residente: ${reserva.residenteNombre} (${reserva.unidad})` : null,
    slot.bloqueoMotivo ? `Motivo: ${slot.bloqueoMotivo}` : null,
    cont ? `Caduca en: ${cont.texto}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <button
      onClick={() => onSelect(slot)}
      title={titulo}
      className={cn(
        "relative w-full h-12 rounded-md border text-[10px] font-medium transition-colors flex flex-col items-center justify-center gap-0.5 px-1 overflow-hidden",
        ESTADO_CELDA[estado],
        esPasado && "opacity-40",
      )}
    >
      {Icon && <Icon className="absolute top-0.5 right-0.5 h-2.5 w-2.5 opacity-70" />}
      {reserva && (
        <span className="tabular-nums font-semibold leading-none">{reserva.unidad}</span>
      )}
      {cont && (
        <span className={cn("tabular-nums leading-none text-[9px]", cont.urgente ? "text-destructive font-bold" : "opacity-80")}>
          {cont.texto}
        </span>
      )}
    </button>
  );
}

function VistaMes({
  espacio,
  ahora,
  offset,
  toSlot,
  onDia,
}: {
  espacio: EspacioReservable;
  ahora: number;
  offset: number;
  toSlot: (fecha: string, franja: string) => SlotSel;
  onDia: (fecha: string) => void;
}) {
  const { celdas, mesLabel, mesIdx } = useMemo(() => {
    const base = new Date(ahora);
    const primero = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const ini = inicioDeSemana(primero);
    const celdas = Array.from({ length: 42 }, (_, i) => addDays(ini, i));
    return {
      celdas,
      mesIdx: primero.getMonth(),
      mesLabel: primero.toLocaleDateString("es-MX", { month: "long", year: "numeric" }),
    };
  }, [ahora, offset]);

  const resumenDia = (fecha: string): Partial<Record<EstadoSlot, number>> => {
    const acc: Partial<Record<EstadoSlot, number>> = {};
    for (const franja of espacio.franjasHorarias) {
      const { estado } = toSlot(fecha, franja);
      if (estado === "disponible") continue;
      acc[estado] = (acc[estado] ?? 0) + 1;
    }
    return acc;
  };

  return (
    <div>
      <p className="text-sm font-medium capitalize mb-2">{mesLabel}</p>
      <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground mb-1">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((d) => {
          const fecha = isoDate(d);
          const enMes = d.getMonth() === mesIdx;
          const resumen = resumenDia(fecha);
          const estados = Object.keys(resumen) as EstadoSlot[];
          return (
            <button
              key={fecha}
              onClick={() => onDia(fecha)}
              className={cn(
                "h-16 rounded-md border border-border p-1 text-left hover:bg-muted/40 transition-colors",
                !enMes && "opacity-40",
              )}
            >
              <div className="text-[11px] tabular-nums font-medium">{d.getDate()}</div>
              <div className="flex flex-wrap gap-0.5 mt-1">
                {estados.map((e) => (
                  <span key={e} className={cn("inline-block h-1.5 w-1.5 rounded-full", ESTADO_DOT[e])} title={`${ESTADO_LABEL[e]}: ${resumen[e]}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
