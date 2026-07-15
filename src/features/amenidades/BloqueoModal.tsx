import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAmenidadesStore } from "./store";

export function BloqueoModal({
  open,
  onClose,
  espacioIdInicial,
}: {
  open: boolean;
  onClose: () => void;
  espacioIdInicial?: string;
}) {
  const espacios = useAmenidadesStore((s) => s.espacios);
  const bloquear = useAmenidadesStore((s) => s.bloquearMantenimiento);
  const [espacioId, setEspacioId] = useState(espacioIdInicial ?? espacios[0]?.id ?? "");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [motivo, setMotivo] = useState("");

  const valido = espacioId && inicio && fin && fin >= inicio && motivo.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bloquear por mantenimiento</DialogTitle>
          <DialogDescription>El espacio no será reservable durante el rango indicado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs text-muted-foreground">
            Espacio
            <select value={espacioId} onChange={(e) => setEspacioId(e.target.value)} className="mt-1 w-full h-9 px-2 rounded-md border border-border bg-background text-sm">
              {espacios.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted-foreground">
              Desde
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="mt-1 w-full h-9 px-2 rounded-md border border-border bg-background text-sm tabular-nums" />
            </label>
            <label className="block text-xs text-muted-foreground">
              Hasta
              <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className="mt-1 w-full h-9 px-2 rounded-md border border-border bg-background text-sm tabular-nums" />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">
            Motivo
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Limpieza profunda, reparación, evento…" className="mt-1 w-full h-9 px-2 rounded-md border border-border bg-background text-sm" />
          </label>
          <Button
            className="w-full"
            disabled={!valido}
            onClick={() => {
              bloquear({ espacioId, fechaInicio: inicio, fechaFin: fin, motivo: motivo.trim() });
              onClose();
              setInicio(""); setFin(""); setMotivo("");
            }}
          >
            Crear bloqueo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
