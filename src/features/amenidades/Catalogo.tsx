// =============================================================
// Portal Condominio · Amenidades — Catálogo (vista unificada)
// Grid de TODAS las amenidades (libres y reservables). Alta, edición,
// activar/desactivar (soft-disable con confirmación) y acceso al calendario
// para las reservables. Inactivas atenuadas, no ocultas.
// =============================================================
import { useMemo, useState } from "react";
import { Plus, MapPin, Pencil, Power, PowerOff, CalendarDays, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMXN } from "@/lib/portal-condominio/format";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAmenidadesStore } from "./store";
import type { Amenidad } from "./types";
import { TIPO_ICON, TIPO_LABEL, MODALIDAD_LABEL } from "./ui";

type FiltroModalidad = "todas" | "libre" | "reservable";
type FiltroEstado = "todas" | "activas" | "inactivas";

export function Catalogo({
  onNueva,
  onEditar,
  onVerCalendario,
}: {
  onNueva: () => void;
  onEditar: (a: Amenidad) => void;
  onVerCalendario: (espacioId: string) => void;
}) {
  const amenidades = useAmenidadesStore((s) => s.amenidades);
  const toggleActivo = useAmenidadesStore((s) => s.toggleActivo);
  const [fModalidad, setFModalidad] = useState<FiltroModalidad>("todas");
  const [fEstado, setFEstado] = useState<FiltroEstado>("todas");
  const [porDesactivar, setPorDesactivar] = useState<Amenidad | null>(null);

  const lista = useMemo(() => {
    return amenidades.filter((a) => {
      if (fModalidad !== "todas" && a.modalidadUso !== fModalidad) return false;
      if (fEstado === "activas" && !a.activo) return false;
      if (fEstado === "inactivas" && a.activo) return false;
      return true;
    });
  }, [amenidades, fModalidad, fEstado]);

  const confirmarToggle = (a: Amenidad) => {
    if (a.activo) setPorDesactivar(a); // desactivar → pide confirmación
    else toggleActivo(a.id); // reactivar → directo
  };

  return (
    <div>
      {/* Barra: filtros + alta */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmento
            value={fModalidad}
            onChange={(v) => setFModalidad(v as FiltroModalidad)}
            opciones={[
              { k: "todas", label: "Todas" },
              { k: "libre", label: "Uso libre" },
              { k: "reservable", label: "Reservables" },
            ]}
          />
          <Segmento
            value={fEstado}
            onChange={(v) => setFEstado(v as FiltroEstado)}
            opciones={[
              { k: "todas", label: "Todas" },
              { k: "activas", label: "Activas" },
              { k: "inactivas", label: "Inactivas" },
            ]}
          />
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={onNueva}>
          <Plus className="h-4 w-4" /> Nueva amenidad
        </Button>
      </div>

      {lista.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">Sin amenidades para este filtro.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map((a) => (
            <AmenidadCard
              key={a.id}
              amenidad={a}
              onEditar={() => onEditar(a)}
              onToggle={() => confirmarToggle(a)}
              onVerCalendario={() => onVerCalendario(a.id)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!porDesactivar} onOpenChange={(o) => !o && setPorDesactivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar “{porDesactivar?.nombre}”</AlertDialogTitle>
            <AlertDialogDescription>
              Se retira del catálogo{porDesactivar?.modalidadUso === "reservable" ? " y del motor de reservas" : ""}.
              No se borra: el historial de reservas se conserva y puedes reactivarla cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (porDesactivar) toggleActivo(porDesactivar.id); setPorDesactivar(null); }}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AmenidadCard({
  amenidad: a,
  onEditar,
  onToggle,
  onVerCalendario,
}: {
  amenidad: Amenidad;
  onEditar: () => void;
  onToggle: () => void;
  onVerCalendario: () => void;
}) {
  const Icon = TIPO_ICON[a.tipo];
  const portada = a.media.find((m) => m.esPortada && m.tipo === "imagen") ?? a.media.find((m) => m.tipo === "imagen");
  const reservable = a.modalidadUso === "reservable";
  const precio = a.reserva
    ? a.reserva.modeloCobro === "gratuito" || a.reserva.tarifa === 0
      ? "Sin costo"
      : formatMXN(a.reserva.tarifa)
    : null;

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden flex flex-col", !a.activo && "opacity-60")}>
      {/* Portada */}
      <div className="h-32 bg-muted flex items-center justify-center relative">
        {portada ? (
          <img src={portada.url} alt={a.nombre} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Icon className="h-7 w-7" />
            <ImageOff className="h-3.5 w-3.5" />
          </div>
        )}
        <span
          className={cn(
            "absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium",
            reservable ? "bg-primary/90 text-primary-foreground" : "bg-background/90 text-foreground border border-border",
          )}
        >
          {MODALIDAD_LABEL[a.modalidadUso]}{reservable && precio ? ` · ${precio}` : ""}
        </span>
        {!a.activo && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-700 text-white">Inactiva</span>
        )}
      </div>

      {/* Cuerpo */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <span className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight truncate">{a.nombre}</h3>
            <p className="text-[11px] text-muted-foreground">{TIPO_LABEL[a.tipo]}</p>
          </div>
        </div>
        {a.ubicacion && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {a.ubicacion}
          </p>
        )}
        {a.descripcion && <p className="text-xs text-muted-foreground line-clamp-2">{a.descripcion}</p>}

        {/* Acciones */}
        <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="h-8 gap-1 text-[12px]" onClick={onEditar}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          {reservable && a.activo && (
            <Button size="sm" variant="outline" className="h-8 gap-1 text-[12px]" onClick={onVerCalendario}>
              <CalendarDays className="h-3.5 w-3.5" /> Calendario
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className={cn("h-8 gap-1 text-[12px] ml-auto", a.activo ? "text-destructive border-destructive/40 hover:bg-destructive/5" : "text-success border-success/40 hover:bg-success/5")}
            onClick={onToggle}
          >
            {a.activo ? <><PowerOff className="h-3.5 w-3.5" /> Desactivar</> : <><Power className="h-3.5 w-3.5" /> Activar</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Segmento({
  value,
  onChange,
  opciones,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: { k: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
      {opciones.map((o) => (
        <button
          key={o.k}
          onClick={() => onChange(o.k)}
          className={cn(
            "px-2.5 py-1 rounded-md font-medium transition-colors",
            value === o.k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
