import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatMXN } from "@/lib/portal-condominio/format";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Wrench,
  Landmark,
  History,
  CalendarPlus,
  AlertTriangle,
} from "lucide-react";
import { useAmenidadesStore } from "./store";
import type { EspacioReservable, EstadoSlot, Reserva } from "./types";
import { limiteHold, limitePago, restanteMs } from "./logic";
import { EstadoBadge, fmtContador, fmtFecha, fmtFechaHora } from "./ui";

export interface SlotSel {
  espacio: EspacioReservable;
  fecha: string;
  franja: string;
  estado: EstadoSlot;
  reserva?: Reserva;
  bloqueoId?: string;
  bloqueoMotivo?: string;
}

export function SlotModal({ slot, onClose }: { slot: SlotSel | null; onClose: () => void }) {
  return (
    <Dialog open={!!slot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {slot && <SlotBody slot={slot} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function SlotBody({ slot, onClose }: { slot: SlotSel; onClose: () => void }) {
  const store = useAmenidadesStore();
  const { espacio, fecha, franja, estado, reserva } = slot;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {espacio.nombre}
          <EstadoBadge estado={estado} />
        </DialogTitle>
        <DialogDescription className="tabular-nums">
          {fmtFecha(fecha)} · {franja} · Cap. {espacio.capacidad}
        </DialogDescription>
      </DialogHeader>

      {estado === "disponible" && <ApartarForm slot={slot} onDone={onClose} />}

      {estado === "mantenimiento" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-300 bg-slate-50 dark:bg-slate-800 p-3 flex items-start gap-2">
            <Wrench className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Bloqueado por mantenimiento</p>
              <p className="text-xs text-muted-foreground">{slot.bloqueoMotivo}</p>
            </div>
          </div>
          {slot.bloqueoId && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                store.liberarMantenimiento(slot.bloqueoId!);
                onClose();
              }}
            >
              Liberar espacio
            </Button>
          )}
        </div>
      )}

      {reserva && estado !== "disponible" && estado !== "mantenimiento" && (
        <ReservaDetalle reserva={reserva} espacio={espacio} onClose={onClose} />
      )}
    </>
  );
}

function ApartarForm({ slot, onDone }: { slot: SlotSel; onDone: () => void }) {
  const solicitar = useAmenidadesStore((s) => s.solicitar);
  const [unidad, setUnidad] = useState("#1508");
  const [residente, setResidente] = useState("Residente demo");
  const [alCorriente, setAlCorriente] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Crea un apartado (simula la solicitud de un residente). Bloquea el slot de inmediato; queda en espera de
        validación de administración (caduca en 48 h).
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Unidad
          <input value={unidad} onChange={(e) => setUnidad(e.target.value)} className="mt-1 w-full h-9 px-2 rounded-md border border-border bg-background text-sm tabular-nums" />
        </label>
        <label className="text-xs text-muted-foreground">
          Residente
          <input value={residente} onChange={(e) => setResidente(e.target.value)} className="mt-1 w-full h-9 px-2 rounded-md border border-border bg-background text-sm" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={alCorriente} onChange={(e) => setAlCorriente(e.target.checked)} className="h-4 w-4 rounded border-border accent-[#57ae75]" />
        Unidad al corriente de mantenimiento
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        className="w-full bg-success hover:bg-success/90"
        onClick={() => {
          const r = solicitar({
            espacioId: slot.espacio.id,
            fecha: slot.fecha,
            franja: slot.franja,
            unidad,
            residenteNombre: residente,
            unidadAlCorriente: alCorriente,
            saldoVencidoDias: alCorriente ? 0 : 45,
          });
          if (!r.ok) setError(r.motivo ?? "No disponible.");
          else onDone();
        }}
      >
        <CalendarPlus className="h-4 w-4 mr-1.5" /> Apartar
      </Button>
    </div>
  );
}

function ReservaDetalle({
  reserva,
  espacio,
  onClose,
}: {
  reserva: Reserva;
  espacio: EspacioReservable;
  onClose: () => void;
}) {
  const store = useAmenidadesStore();
  const ahora = useAmenidadesStore((s) => s.ahora);
  const config = useAmenidadesStore((s) => s.config);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmarMorosidad, setConfirmarMorosidad] = useState(false);

  const moroso = !reserva.unidadAlCorriente && reserva.saldoVencidoDias >= config.umbralMorosidadDias;

  const contadorHold =
    reserva.estado === "apartado" ? fmtContador(restanteMs(limiteHold(reserva, config.holdHoras), ahora)) : null;
  const contadorPago =
    reserva.estado === "por_pagar" ? fmtContador(restanteMs(limitePago(reserva, config.pagoHoras), ahora)) : null;

  return (
    <div className="space-y-4">
      {/* Datos */}
      <div className="rounded-lg border border-border divide-y divide-border text-sm">
        <Row label="Residente" value={`${reserva.residenteNombre} · ${reserva.unidad}`} />
        {reserva.codigoReserva && <Row label="Código de reserva" value={reserva.codigoReserva} mono />}
        <Row label="Cuota" value={formatMXN(reserva.cuota)} mono />
        <Row label="Depósito en garantía" value={formatMXN(reserva.deposito)} mono />
        <Row label="Monto total" value={formatMXN(reserva.montoTotal)} mono bold />
        {espacio.requierePago && <Row label="CLABE STP" value={espacio.clabeStp} mono />}
        {reserva.referenciaStp && <Row label="Referencia STP" value={reserva.referenciaStp} mono />}
      </div>

      {/* Contadores de caducidad */}
      {contadorHold && (
        <div className={cn("rounded-lg border px-3 py-2 flex items-center gap-2 text-sm", contadorHold.urgente ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-warning/40 bg-warning/10 text-warning")}>
          <Clock className="h-4 w-4 shrink-0" />
          Validación caduca en <span className="font-semibold tabular-nums">{contadorHold.texto}</span> (48 h)
        </div>
      )}
      {contadorPago && (
        <div className={cn("rounded-lg border px-3 py-2 flex items-center gap-2 text-sm", contadorPago.urgente ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-warning/40 bg-warning/10 text-warning")}>
          <Clock className="h-4 w-4 shrink-0" />
          Ventana de pago caduca en <span className="font-semibold tabular-nums">{contadorPago.texto}</span> (24 h)
        </div>
      )}

      {/* Acciones por estado */}
      {reserva.estado === "apartado" && (
        <div className="space-y-2">
          {moroso && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                Unidad con saldo vencido de <span className="font-semibold tabular-nums">{reserva.saldoVencidoDias}</span> días.
                {!confirmarMorosidad && (
                  <button className="ml-1 underline font-medium" onClick={() => setConfirmarMorosidad(true)}>
                    Autorizar de todos modos
                  </button>
                )}
                {confirmarMorosidad && <span className="ml-1 font-medium">— autorización consciente activada.</span>}
              </div>
            </div>
          )}
          {!rechazando ? (
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-success hover:bg-success/90"
                disabled={moroso && !confirmarMorosidad}
                onClick={() => {
                  store.validar(reserva.id);
                  onClose();
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {espacio.requierePago ? "Validar → habilitar pago" : "Validar → confirmar (sin costo)"}
              </Button>
              <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/5" onClick={() => setRechazando(true)}>
                <XCircle className="h-4 w-4 mr-1.5" /> Rechazar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo del rechazo (obligatorio)…" className="text-sm" />
              <div className="flex gap-2">
                <Button variant="destructive" disabled={!motivo.trim()} onClick={() => { store.rechazar(reserva.id, motivo.trim()); onClose(); }}>
                  Confirmar rechazo
                </Button>
                <Button variant="ghost" onClick={() => { setRechazando(false); setMotivo(""); }}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {reserva.estado === "por_pagar" && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Landmark className="h-4 w-4 mt-0.5 shrink-0" />
            La confirmación ocurre por <span className="font-medium">conciliación STP automática</span>. No hay confirmación
            manual de pago ni botón "Ya pagué"; la administración solo atiende excepciones.
          </p>
          {import.meta.env.DEV && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => { store.simularAbonoStp(reserva.id); onClose(); }}>
              (DEV) Simular abono STP conciliado
            </Button>
          )}
        </div>
      )}

      {reserva.estado === "reservada" && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Reserva confirmada (pago conciliado por STP).
        </div>
      )}

      {/* Auditoría */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Auditoría</h4>
        </div>
        <ol className="space-y-2.5">
          {[...reserva.auditoria].reverse().map((e) => (
            <li key={e.id} className="relative pl-4">
              <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary/60" />
              <p className="text-[13px] font-medium leading-tight">{e.accion}</p>
              <p className="text-[11px] text-muted-foreground">{e.detalle}</p>
              <p className="text-[10px] text-muted-foreground/70 tabular-nums mt-0.5">{e.usuario} · {fmtFechaHora(e.timestamp)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Row({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm text-right", mono && "font-mono tabular-nums", bold && "font-semibold")}>{value}</span>
    </div>
  );
}
