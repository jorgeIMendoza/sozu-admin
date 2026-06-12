import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Scale,
  MapPin,
  Phone,
  Mail,
  FileText,
  Download,
  X,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Building2,
  ExternalLink,
  Info,
  Calendar,
} from "lucide-react";
import type { StageInfo, InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import {
  type AppointmentSlot,
  type ScheduledAppointment,
} from "@/lib/portal-cliente/escrituracion-data";

interface EscrituracionSheetProps {
  stage: StageInfo;
  investment: InvestmentProperty;
  open: boolean;
  onClose: () => void;
}

const EscrituracionSheet = ({
  stage,
  investment,
  open,
  onClose,
}: EscrituracionSheetProps) => {
  const rawNotary = investment.property.notary;
  const data = rawNotary
    ? {
        notary: {
          name: rawNotary.notaria,
          notaryName: rawNotary.name,
          address: rawNotary.address,
          phone: rawNotary.phone,
          email: rawNotary.email,
          mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(rawNotary.address)}`,
        },
        costs: { available: false as const, items: [] as { concept: string; amount: number }[], totalAmount: 0, amountPaid: 0, amountPending: 0 },
        deedDocument: { available: false as const, fileName: undefined as string | undefined },
        availableSlots: [] as AppointmentSlot[],
        scheduledAppointment: undefined as ScheduledAppointment | undefined,
      }
    : null;
  const [reviewed, setReviewed] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<ScheduledAppointment | null>(null);

  if (!data) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[75dvh] overflow-y-auto px-5 pb-8 [&>button:last-child]:hidden"
        >
          <div className="flex flex-col items-center text-center pt-8 pb-4 gap-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Scale className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-foreground">
                Escrituración pendiente
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
                La información de escrituración estará disponible cuando tu
                unidad esté lista para este proceso.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const { notary, costs, deedDocument, availableSlots } = data;

  const selectedSlot = availableSlots.find((s) => s.date === selectedDate);
  const canSchedule = reviewed && deedDocument.available && selectedDate && selectedTime && investment.financials.pendingBalance <= 0;

  const handleSchedule = () => {
    if (!selectedDate || !selectedTime) return;
    const slot = availableSlots.find((s) => s.date === selectedDate);
    setAppointment({
      date: slot?.displayDate || selectedDate,
      time: selectedTime,
      notary: notary.name,
      address: notary.address,
    });
  };

  // ── Appointment confirmed state ──
  if (appointment) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[75dvh] overflow-y-auto px-5 pb-8 [&>button:last-child]:hidden"
        >
          <div className="flex flex-col items-center text-center pt-6 pb-2 gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">
                Cita agendada
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
                Tu firma de escrituración está confirmada.
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Fecha</span>
              <span className="text-sm font-medium text-foreground">
                {appointment.date}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Hora</span>
              <span className="text-sm font-medium text-foreground">
                {appointment.time} hrs
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Notaría</span>
              <span className="text-sm font-medium text-foreground text-right max-w-[60%]">
                {appointment.notary}
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-sm text-muted-foreground">Dirección</span>
              <span className="text-sm font-medium text-foreground text-right max-w-[60%] leading-snug">
                {appointment.address}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full mt-4 rounded-xl h-11 text-sm gap-2"
            onClick={() =>
              window.open(
                `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Firma+de+Escritura&dates=20260310T100000/20260310T120000&details=Escrituración+${investment.property.projectName}+${investment.property.unitNumber}&location=${encodeURIComponent(appointment.address)}`,
                "_blank"
              )
            }
          >
            <Calendar className="w-4 h-4" />
            Agregar a calendario
          </Button>
          <button
            onClick={onClose}
            className="w-full mt-2 h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </SheetContent>
      </Sheet>
    );
  }

  // ── PDF viewer modal ──
  if (pdfOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-border">
          <span className="text-sm font-semibold text-foreground truncate">
            {deedDocument.fileName}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted"
              onClick={() => {
                /* mock download */
              }}
            >
              <Download className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted"
              onClick={() => setPdfOpen(false)}
            >
              <X className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-muted/30">
          <div className="text-center p-8">
            <FileText className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Vista previa del documento
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {deedDocument.fileName}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[75dvh] overflow-y-auto px-5 pb-8 [&>button:last-child]:hidden"
      >
        {/* Header */}
        <SheetHeader className="text-left pb-3">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <SheetTitle className="text-foreground font-display">
                Escrituración en proceso
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                Tu unidad está lista para formalizarse ante notario.
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* ── 1. Notary info ── */}
        <section className="mt-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Notaría asignada
          </h3>
          <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2.5">
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {notary.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {notary.notaryName}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {notary.address}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground">{notary.phone}</p>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground">{notary.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 text-xs text-primary gap-1.5 h-8"
              onClick={() => window.open(notary.mapsUrl, "_blank")}
            >
              <ExternalLink className="w-3 h-3" />
              Ver ubicación en mapa
            </Button>
          </div>
        </section>

        {/* ── 2. Notarial costs ── */}
        <section className="mt-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Gastos notariales de la operación
          </h3>
          {costs.available ? (
            <div className="p-4 rounded-xl bg-muted/30 border border-border">
              <div className="space-y-2.5">
                {costs.items.map((item) => (
                  <div
                    key={item.concept}
                    className="flex justify-between items-start"
                  >
                    <span className="text-xs text-muted-foreground max-w-[60%] leading-snug">
                      {item.concept}
                    </span>
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      ${item.amount.toLocaleString("es-MX")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Total
                  </span>
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    ${costs.totalAmount.toLocaleString("es-MX")} MXN
                  </span>
                </div>
                {costs.amountPaid > 0 && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">
                      Monto cubierto
                    </span>
                    <span className="text-xs text-primary tabular-nums">
                      -${costs.amountPaid.toLocaleString("es-MX")}
                    </span>
                  </div>
                )}
                {costs.amountPending > 0 && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">
                      Monto pendiente
                    </span>
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      ${costs.amountPending.toLocaleString("es-MX")} MXN
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Estamos en proceso de cálculo de gastos notariales. Te
                  avisaremos cuando estén listos.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── 3. Deed document ── */}
        <section className="mt-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Proyecto de escritura para revisión
          </h3>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Revisa cuidadosamente el documento antes de agendar tu firma.
          </p>
          {deedDocument.available ? (
            <Button
              variant="outline"
              className="w-full rounded-xl h-11 text-sm gap-2 border-border"
              onClick={() => setPdfOpen(true)}
            >
              <FileText className="w-4 h-4" />
              Visualizar proyecto (.PDF)
            </Button>
          ) : (
            <div className="p-4 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  El proyecto de escritura estará disponible en breve. Te
                  notificaremos cuando esté listo.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── 4. Review confirmation ── */}
        {deedDocument.available && (
          <section className="mt-5">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-border hover:bg-muted/20 transition-colors">
              <Checkbox
                checked={reviewed}
                onCheckedChange={(v) => setReviewed(!!v)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground leading-snug">
                Confirmo que he revisado el proyecto de escritura.
              </span>
            </label>
          </section>
        )}

        {/* ── 5. Appointment scheduler ── */}
        <section className="mt-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Agenda tu firma
          </h3>

          {/* Date selection */}
          <div className="space-y-2 mb-3">
            <p className="text-xs text-muted-foreground">
              Selecciona fecha disponible
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {availableSlots.map((slot) => (
                <button
                  key={slot.date}
                  onClick={() => {
                    setSelectedDate(slot.date);
                    setSelectedTime(null);
                  }}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                    selectedDate === slot.date
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                      : "border-border text-foreground hover:border-primary/30"
                  }`}
                >
                  {slot.displayDate}
                </button>
              ))}
            </div>
          </div>

          {/* Time selection */}
          {selectedSlot && (
            <div className="space-y-2 animate-fade-in">
              <p className="text-xs text-muted-foreground">
                Selecciona horario
              </p>
              <div className="flex gap-2 flex-wrap">
                {selectedSlot.times.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`px-4 py-2 rounded-lg border text-xs font-medium transition-all ${
                      selectedTime === time
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                        : "border-border text-foreground hover:border-primary/30"
                    }`}
                  >
                    {time} hrs
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Schedule button */}
          <Button
            disabled={!canSchedule}
            className="w-full mt-5 rounded-xl h-12 text-sm font-semibold gap-2"
            onClick={handleSchedule}
          >
            <CalendarCheck className="w-4 h-4" />
            Agendar cita
          </Button>

          {!reviewed && deedDocument.available && (
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Debes confirmar la revisión del proyecto de escritura para agendar.
            </p>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
};

export default EscrituracionSheet;
