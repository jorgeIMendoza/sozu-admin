import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Wrench,
  RotateCcw,
  FastForward,
  XCircle,
  Clock,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { formatMXN } from "@/lib/portal-condominio/format";
import { KPICard, StatusBadge } from "@/pages/admin/portal-condominio/_helpers";
import { useAmenidadesStore } from "./store";
import { estadoDeSlot, limiteHold, limitePago, restanteMs } from "./logic";
import type { EspacioReservable, Reserva } from "./types";
import {
  Leyenda,
  TIPO_ICON,
  TIPO_LABEL,
  EstadoBadge,
  fmtContador,
  fmtFecha,
  fmtFechaHora,
  addDays,
  inicioDeSemana,
  isoDate,
} from "./ui";
import { CalendarioEspacio } from "./CalendarioEspacio";
import { SlotModal, type SlotSel } from "./SlotModal";
import { BloqueoModal } from "./BloqueoModal";

type TabInterna = "calendario" | "validar" | "excepciones";

export function AmenidadesReservas() {
  const { profile } = useAuth();
  const store = useAmenidadesStore();
  const { espacios, reservas, bloqueos, abonosExcepcion, ahora, config } = store;

  useEffect(() => {
    if (profile?.nombre) store.setUsuario(`${profile.nombre} (Administración)`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.nombre]);

  // Sincroniza el reloj con el tiempo real y aplica caducidades (no retrocede
  // si el demo avanzó el reloj manualmente).
  useEffect(() => {
    store.sincronizarReloj();
    const t = setInterval(() => store.sincronizarReloj(), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tab, setTab] = useState<TabInterna>("calendario");
  const [espacioSel, setEspacioSel] = useState<string>(espacios[0]?.id ?? "");
  const [slot, setSlot] = useState<SlotSel | null>(null);
  const [bloqueoOpen, setBloqueoOpen] = useState(false);

  const porValidar = reservas.filter((r) => r.estado === "apartado");
  const porPagar = reservas.filter((r) => r.estado === "por_pagar");
  const confirmadas30 = useMemo(() => {
    const hoy = isoDate(new Date(ahora));
    const hasta = isoDate(addDays(new Date(ahora), 30));
    return reservas.filter((r) => r.estado === "reservada" && r.fecha >= hoy && r.fecha <= hasta);
  }, [reservas, ahora]);
  const porPagarPorVencer = porPagar.filter((r) => {
    const rem = restanteMs(limitePago(r, config.pagoHoras), ahora);
    return rem != null && rem <= 12 * 3600_000;
  });
  const totalExcepciones = porPagarPorVencer.length + abonosExcepcion.length;

  // Urgencia: apartados cuya validación caduca en < 2 h.
  const porValidarUrgente = porValidar.filter((r) => {
    const rem = restanteMs(limiteHold(r, config.holdHoras), ahora);
    return rem != null && rem <= 2 * 3600_000;
  }).length;
  const montoPorPagar = porPagar.reduce((s, r) => s + r.montoTotal, 0);

  const espacio = espacios.find((e) => e.id === espacioSel) ?? espacios[0];

  const abrirDetalle = (r: Reserva) => {
    const esp = espacios.find((e) => e.id === r.espacioId);
    if (esp) setSlot({ espacio: esp, fecha: r.fecha, franja: r.franja, estado: r.estado, reserva: r });
  };

  return (
    <div>
      {/* KPIs — clickeables, orientados a la acción */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <button type="button" onClick={() => setTab("validar")} className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl">
          <KPICard
            title="Solicitudes por validar"
            value={String(porValidar.length)}
            subtitle={porValidarUrgente > 0 ? `${porValidarUrgente} caduca en < 2 h` : porValidar.length ? "Requieren revisión" : "Sin pendientes"}
            variant={porValidarUrgente > 0 ? "danger" : porValidar.length ? "warning" : "default"}
          />
        </button>
        <button type="button" onClick={() => setTab("excepciones")} className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl">
          <KPICard
            title="Reservas por pagar"
            value={String(porPagar.length)}
            subtitle={porPagar.length ? `${formatMXN(montoPorPagar)} esperado` : "Sin pagos en tránsito"}
            variant={porPagar.length ? "warning" : "default"}
          />
        </button>
        <button type="button" onClick={() => setTab("calendario")} className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl">
          <KPICard
            title="Confirmadas (próx. 30 días)"
            value={String(confirmadas30.length)}
            subtitle="Reservas con pago conciliado"
            variant="success"
          />
        </button>
        <button type="button" onClick={() => setTab("excepciones")} className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl">
          <KPICard
            title="Excepciones de pago"
            value={String(totalExcepciones)}
            subtitle={totalExcepciones ? "Requieren intervención" : "Todo conciliado"}
            variant={totalExcepciones ? "danger" : "default"}
          />
        </button>
      </div>

      {/* Tabs internas + controles demo */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
          {([
            { k: "calendario", label: "Calendario" },
            { k: "validar", label: `Solicitudes por validar${porValidar.length ? ` (${porValidar.length})` : ""}` },
            { k: "excepciones", label: `Excepciones${totalExcepciones ? ` (${totalExcepciones})` : ""}` },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn("px-3 py-1.5 rounded-md font-medium transition-colors", tab === t.k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>
        {import.meta.env.DEV && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground tabular-nums">Reloj demo: {fmtFechaHora(new Date(ahora).toISOString())}</span>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => store.avanzarReloj(6)}>
              <FastForward className="h-3.5 w-3.5" /> +6 h
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => store.reset()}>
              <RotateCcw className="h-3.5 w-3.5" /> Repoblar
            </Button>
          </div>
        )}
      </div>

      {tab === "calendario" && (
        <>
          {/* Fila-selector compacta de espacios (scroll horizontal) */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {espacios.map((e) => (
              <EspacioChip
                key={e.id}
                espacio={e}
                activo={e.id === espacioSel}
                reservas={reservas}
                bloqueos={bloqueos}
                ahora={ahora}
                onClick={() => setEspacioSel(e.id)}
              />
            ))}
          </div>

          {/* Barra de control encima de la grilla */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-3">
              <select value={espacioSel} onChange={(e) => setEspacioSel(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-background text-sm">
                {espacios.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
              <Leyenda />
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[13px]" onClick={() => setBloqueoOpen(true)}>
              <Wrench className="h-4 w-4" /> Bloquear por mantenimiento
            </Button>
          </div>

          {espacio && <CalendarioEspacio espacio={espacio} onSelect={setSlot} />}
        </>
      )}

      {tab === "validar" && <BandejaValidar reservas={porValidar} onDetalle={abrirDetalle} />}

      {tab === "excepciones" && (
        <BandejaExcepciones
          porPagarPorVencer={porPagarPorVencer}
          abonos={abonosExcepcion}
          ahora={ahora}
          pagoHoras={config.pagoHoras}
          onDetalle={abrirDetalle}
        />
      )}

      <SlotModal slot={slot} onClose={() => setSlot(null)} />
      <BloqueoModal open={bloqueoOpen} onClose={() => setBloqueoOpen(false)} espacioIdInicial={espacioSel} />
    </div>
  );
}

function EspacioChip({
  espacio,
  activo,
  reservas,
  bloqueos,
  ahora,
  onClick,
}: {
  espacio: EspacioReservable;
  activo: boolean;
  reservas: Reserva[];
  bloqueos: import("./types").BloqueoMantenimiento[];
  ahora: number;
  onClick: () => void;
}) {
  const Icon = TIPO_ICON[espacio.tipo];
  const { ocupados, total } = useMemo(() => {
    const ini = inicioDeSemana(new Date(ahora));
    const dias = Array.from({ length: 7 }, (_, i) => isoDate(addDays(ini, i)));
    let ocupados = 0;
    let total = 0;
    for (const fecha of dias) {
      for (const franja of espacio.franjasHorarias) {
        total += 1;
        const { estado } = estadoDeSlot(reservas, bloqueos, espacio.id, fecha, franja);
        if (estado !== "disponible") ocupados += 1;
      }
    }
    return { ocupados, total };
  }, [espacio, reservas, bloqueos, ahora]);
  const pct = total ? Math.round((ocupados / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      title={`${espacio.nombre} · ${TIPO_LABEL[espacio.tipo]} · Cap. ${espacio.capacidad} · ${ocupados}/${total} ocupados esta semana`}
      className={cn(
        "shrink-0 text-left rounded-lg border bg-card px-3 py-2 transition-colors hover:border-primary/40 min-w-[180px]",
        activo ? "border-primary ring-1 ring-primary/20" : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-6 w-6 rounded-md flex items-center justify-center shrink-0", activo ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-semibold truncate flex-1">{espacio.nombre}</span>
        {espacio.requierePago ? (
          <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">{formatMXN(espacio.cuotaRenta)}</span>
        ) : (
          <span className="text-[10px] font-medium text-success whitespace-nowrap">Sin costo</span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{ocupados}/{total}</span>
      </div>
    </button>
  );
}

// ── Bandeja: solicitudes por validar ───────────────────────
function BandejaValidar({ reservas, onDetalle }: { reservas: Reserva[]; onDetalle: (r: Reserva) => void }) {
  if (reservas.length === 0) {
    return <div className="rounded-xl border border-border bg-card py-12 text-center text-muted-foreground">Sin solicitudes por validar.</div>;
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left">Espacio</th>
            <th className="px-3 py-2 text-left">Unidad / Residente</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">Fecha / Franja</th>
            <th className="px-3 py-2 text-left">Elegibilidad</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">Caduca (48 h)</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {reservas.map((r) => (
            <FilaValidar key={r.id} r={r} onDetalle={() => onDetalle(r)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilaValidar({ r, onDetalle }: { r: Reserva; onDetalle: () => void }) {
  const store = useAmenidadesStore();
  const ahora = useAmenidadesStore((s) => s.ahora);
  const config = useAmenidadesStore((s) => s.config);
  const espacio = store.espacios.find((e) => e.id === r.espacioId);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmMoroso, setConfirmMoroso] = useState(false);

  const moroso = !r.unidadAlCorriente && r.saldoVencidoDias >= config.umbralMorosidadDias;
  const cont = fmtContador(restanteMs(limiteHold(r, config.holdHoras), ahora));

  return (
    <tr className={cn("hover:bg-muted/30 align-top", moroso && "border-l-2 border-l-amber-400 bg-amber-50/40 dark:bg-amber-950/20")}>

      <td className="px-3 py-2">
        <button className="font-medium text-left hover:text-primary" onClick={onDetalle}>{espacio?.nombre ?? r.espacioId}</button>
      </td>
      <td className="px-3 py-2">
        <p className="tabular-nums">{r.unidad}</p>
        <p className="text-[11px] text-muted-foreground">{r.residenteNombre}</p>
      </td>
      <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap">{fmtFecha(r.fecha)}<br />{r.franja}</td>
      <td className="px-3 py-2">
        {r.unidadAlCorriente ? (
          <StatusBadge label="Al corriente" tone="success" />
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> Saldo vencido {r.saldoVencidoDias} d
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums", cont.urgente ? "text-destructive font-semibold" : "text-muted-foreground")}>
          <Clock className="h-3.5 w-3.5" /> {cont.texto}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        {!rechazando ? (
          <div className="flex flex-col items-end gap-1.5">
            {moroso && !confirmMoroso && (
              <span className="text-[11px] text-warning">
                Morosidad —{" "}
                <button className="underline font-medium" onClick={() => setConfirmMoroso(true)}>autorizar de todos modos</button>
              </span>
            )}
            <div className="flex gap-1.5 justify-end">
              <Button size="sm" className="h-8 gap-1 text-[11px] bg-success hover:bg-success/90" disabled={moroso && !confirmMoroso} onClick={() => store.validar(r.id)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Validar
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-[11px] border-destructive/40 text-destructive hover:bg-destructive/5" onClick={() => setRechazando(true)}>
                <XCircle className="h-3.5 w-3.5" /> Rechazar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1.5 w-64 ml-auto">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo del rechazo (obligatorio)…" className="text-[12px]" />
            <div className="flex gap-1.5">
              <Button size="sm" variant="destructive" className="h-7 text-[11px]" disabled={!motivo.trim()} onClick={() => { store.rechazar(r.id, motivo.trim()); setRechazando(false); setMotivo(""); }}>
                Confirmar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => { setRechazando(false); setMotivo(""); }}>Cancelar</Button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Bandeja: excepciones de pago ───────────────────────────
function BandejaExcepciones({
  porPagarPorVencer,
  abonos,
  ahora,
  pagoHoras,
  onDetalle,
}: {
  porPagarPorVencer: Reserva[];
  abonos: import("./types").AbonoExcepcion[];
  ahora: number;
  pagoHoras: number;
  onDetalle: (r: Reserva) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        La confirmación de reservas ocurre por conciliación STP automática. La administración solo resuelve
        estas excepciones; no confirma pagos normales.
        {/* SWAP POINT: feed de conciliación STP real; el paso por_pagar → reservada lo dispara el
            abono conciliado automáticamente, no un click de admin. */}
      </p>

      {/* (a) por_pagar por vencer sin abono */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
          <Clock className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-semibold">Reservas por pagar próximas a vencer sin abono</h3>
        </div>
        {porPagarPorVencer.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin reservas por vencer.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {porPagarPorVencer.map((r) => {
                const cont = fmtContador(restanteMs(limitePago(r, pagoHoras), ahora));
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <button className="font-medium text-left hover:text-primary" onClick={() => onDetalle(r)}>{r.codigoReserva ?? r.id}</button>
                      <p className="text-[11px] text-muted-foreground tabular-nums">{r.unidad} · {fmtFecha(r.fecha)} · {r.franja}</p>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMXN(r.montoTotal)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums", cont.urgente ? "text-destructive font-semibold" : "text-warning")}>
                        <Clock className="h-3.5 w-3.5" /> {cont.texto}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* (b) abonos STP que no casan */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
          <Landmark className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold">Abonos STP sin reserva coincidente</h3>
        </div>
        {abonos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin abonos por conciliar.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Referencia STP</th>
                <th className="px-4 py-2 text-right">Monto</th>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {abonos.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono tabular-nums">{a.referenciaStp}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatMXN(a.monto)}</td>
                  <td className="px-4 py-2 text-xs tabular-nums">{fmtFechaHora(a.fecha)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{a.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
