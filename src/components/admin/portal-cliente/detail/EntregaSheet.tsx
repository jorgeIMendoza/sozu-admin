import { useState, useRef, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Home,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  X,
  Camera,
  AlertTriangle,
  PenTool,
  Calendar,
  MapPin,
  Hash,
  ChevronLeft,
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import type { StageInfo, InvestmentProperty } from "@/lib/portal-cliente/types";
import {
  useEntregaData,
  defectCategories,
  unitLocations,
  type DefectTicket,
} from "@/lib/portal-cliente/entrega-data";

interface EntregaSheetProps {
  stage: StageInfo;
  investment: InvestmentProperty;
  open: boolean;
  onClose: () => void;
}

type EntregaView = "main" | "accept" | "sign" | "signed" | "report" | "tickets" | "ticket-detail";

const ticketStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  abierto: { label: "Abierto", bg: "bg-warning/15", text: "text-warning" },
  en_revision: { label: "En revisión", bg: "bg-primary/15", text: "text-primary" },
  en_proceso: { label: "En proceso", bg: "bg-primary/15", text: "text-primary" },
  resuelto: { label: "Resuelto", bg: "bg-success/15", text: "text-success" },
};

const EntregaSheet = ({ stage, investment, open, onClose }: EntregaSheetProps) => {
  const { data, isLoading } = useEntregaData(
    investment.property.idPropiedad,
    investment.property.projectId,
  );

  const [view, setView] = useState<EntregaView>("main");
  const [reviewed, setReviewed] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  // Signature
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // Tickets
  const [localTickets, setLocalTickets] = useState<DefectTicket[]>([]);
  const tickets = [...(data?.tickets ?? []), ...localTickets];
  const [ticketCategory, setTicketCategory] = useState("");
  const [ticketLocation, setTicketLocation] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketPhotos, setTicketPhotos] = useState<string[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<DefectTicket | null>(null);

  // ── Signature canvas handlers ──
  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "hsl(var(--foreground))";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  }, [isDrawing]);

  const endDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  if (isLoading) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto px-5 pb-8 [&>button:last-child]:hidden">
          <div className="flex flex-col items-center text-center pt-8 pb-4 gap-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center animate-pulse">
              <Home className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Cargando información de entrega…</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }


  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const confirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSignatureData(canvas.toDataURL());
    setView("signed");
  };

  // ── Ticket submission ──
  const handleSubmitTicket = () => {
    if (!ticketCategory || !ticketDescription || !ticketLocation) return;
    const newTicket: DefectTicket = {
      id: `ticket-${Date.now()}`,
      folio: `INC-${String(localTickets.length + 1).padStart(4, "0")}`,
      category: ticketCategory,
      description: ticketDescription,
      location: ticketLocation,
      photos: ticketPhotos,
      status: "abierto",
      createdAt: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }),
    };
    setLocalTickets([newTicket, ...localTickets]);
    setTicketCategory("");
    setTicketLocation("");
    setTicketDescription("");
    setTicketPhotos([]);
    setView("tickets");
  };

  const handleAddPhoto = () => {
    // Mock photo addition
    setTicketPhotos([...ticketPhotos, `foto-${ticketPhotos.length + 1}.jpg`]);
  };

  // ── PDF Viewer ──
  if (pdfOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-border">
          <span className="text-sm font-semibold text-foreground truncate">Convenio de Aceptación de Entrega</span>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted">
              <Download className="w-4 h-4 text-muted-foreground" />
            </button>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted" onClick={() => setPdfOpen(false)}>
              <X className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-muted/30">
          <div className="text-center p-8">
            <FileText className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Convenio de Aceptación de Entrega</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{investment.property.projectName} - Unidad {investment.property.unitNumber}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── SIGNED STATE ──
  if (view === "signed") {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto px-5 pb-8 [&>button:last-child]:hidden">
          <div className="flex flex-col items-center text-center pt-6 pb-2 gap-4">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">Entrega aceptada</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
                La entrega de tu unidad ha sido formalizada exitosamente.
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Fecha de firma</span>
              <span className="text-sm font-medium text-foreground">
                {new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Hora</span>
              <span className="text-sm font-medium text-foreground">
                {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} hrs
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Unidad</span>
              <span className="text-sm font-medium text-foreground">
                {investment.property.projectName} {investment.property.unitNumber}
              </span>
            </div>
          </div>

          {signatureData && (
            <div className="mt-4 p-3 rounded-xl border border-border bg-card">
              <p className="text-[11px] text-muted-foreground mb-2">Firma digital</p>
              <img src={signatureData} alt="Firma" className="w-full h-20 object-contain" />
            </div>
          )}

          <Button variant="outline" className="w-full mt-4 rounded-xl h-11 text-sm gap-2">
            <Download className="w-4 h-4" />
            Descargar documento firmado
          </Button>

          <p className="text-[10px] text-muted-foreground text-center mt-3 leading-relaxed max-w-xs mx-auto">
            La firma digital tiene validez conforme a los términos aceptados en el contrato de compraventa.
          </p>

          <button onClick={onClose} className="w-full mt-3 h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors">
            Cerrar
          </button>
        </SheetContent>
      </Sheet>
    );
  }

  // ── SIGNATURE VIEW ──
  if (view === "sign") {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto px-5 pb-8 [&>button:last-child]:hidden">
          <SheetHeader className="text-left pb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setView("accept")} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-foreground" />
              </button>
              <div>
                <SheetTitle className="text-foreground font-display">Firma digital</SheetTitle>
                <p className="text-sm text-muted-foreground">Dibuja tu firma en el recuadro.</p>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-4 rounded-xl border-2 border-dashed border-border bg-card overflow-hidden">
            <canvas
              ref={canvasRef}
              width={320}
              height={160}
              className="w-full touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>

          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" className="flex-1 rounded-xl text-xs" onClick={clearSignature}>
              Limpiar
            </Button>
            <Button
              size="sm"
              className="flex-1 rounded-xl text-xs gap-1.5"
              disabled={!hasSigned}
              onClick={confirmSignature}
            >
              <PenTool className="w-3 h-3" />
              Confirmar firma
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-3 leading-relaxed">
            La firma digital tiene validez conforme a los términos aceptados en el contrato de compraventa.
          </p>
        </SheetContent>
      </Sheet>
    );
  }

  // ── ACCEPT DELIVERY VIEW ──
  if (view === "accept") {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto px-5 pb-8 [&>button:last-child]:hidden">
          <SheetHeader className="text-left pb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setView("main")} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-foreground" />
              </button>
              <div>
                <SheetTitle className="text-foreground font-display">Aceptación de entrega</SheetTitle>
                <p className="text-sm text-muted-foreground">Formaliza la recepción de tu unidad.</p>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border">
            <p className="text-sm text-foreground leading-relaxed">
              Al aceptar la entrega confirmas que la unidad fue recibida en condiciones satisfactorias conforme al checklist técnico.
            </p>
          </div>

          {/* Convenio PDF */}
          <section className="mt-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Convenio de aceptación
            </h3>
            <Button
              variant="outline"
              className="w-full rounded-xl h-11 text-sm gap-2 border-border"
              onClick={() => setPdfOpen(true)}
            >
              <FileText className="w-4 h-4" />
              Revisar Convenio de Aceptación
            </Button>
          </section>

          {/* Checkbox */}
          <section className="mt-4">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-border hover:bg-muted/20 transition-colors">
              <Checkbox checked={reviewed} onCheckedChange={(v) => setReviewed(!!v)} className="mt-0.5" />
              <span className="text-sm text-foreground leading-snug">
                He leído y acepto los términos del convenio de aceptación de entrega.
              </span>
            </label>
          </section>

          <Button
            className="w-full mt-5 rounded-xl h-12 text-sm font-semibold gap-2"
            disabled={!reviewed}
            onClick={() => setView("sign")}
          >
            <PenTool className="w-4 h-4" />
            Firmar digitalmente
          </Button>
        </SheetContent>
      </Sheet>
    );
  }

  // ── REPORT DEFECT VIEW ──
  if (view === "report") {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto px-5 pb-8 [&>button:last-child]:hidden">
          <SheetHeader className="text-left pb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setView("main")} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-foreground" />
              </button>
              <div>
                <SheetTitle className="text-foreground font-display">Registrar incidencia</SheetTitle>
                <p className="text-sm text-muted-foreground">Documenta la falla con detalle.</p>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Categoría</label>
              <Select value={ticketCategory} onValueChange={setTicketCategory}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {defectCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ubicación en la unidad</label>
              <Select value={ticketLocation} onValueChange={setTicketLocation}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Selecciona ubicación" />
                </SelectTrigger>
                <SelectContent>
                  {unitLocations.map((loc) => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descripción detallada</label>
              <Textarea
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                placeholder="Describe la falla con el mayor detalle posible..."
                className="rounded-xl min-h-[100px] resize-none"
              />
            </div>

            {/* Photos */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Evidencia fotográfica</label>
              <div className="flex gap-2 flex-wrap">
                {ticketPhotos.map((photo, i) => (
                  <div key={i} className="w-16 h-16 rounded-lg bg-muted/50 border border-border flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                ))}
                <button
                  onClick={handleAddPhoto}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-0.5 hover:border-primary/30 transition-colors"
                >
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground">Foto</span>
                </button>
              </div>
            </div>
          </div>

          <Button
            className="w-full mt-5 rounded-xl h-12 text-sm font-semibold gap-2"
            disabled={!ticketCategory || !ticketDescription || !ticketLocation}
            onClick={handleSubmitTicket}
          >
            Enviar incidencia
          </Button>
        </SheetContent>
      </Sheet>
    );
  }

  // ── TICKETS LIST VIEW ──
  if (view === "tickets") {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto px-5 pb-8 [&>button:last-child]:hidden">
          <SheetHeader className="text-left pb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setView("main")} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-foreground" />
              </button>
              <div>
                <SheetTitle className="text-foreground font-display">Incidencias registradas</SheetTitle>
                <p className="text-sm text-muted-foreground">{tickets.length} incidencia{tickets.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-4 space-y-2.5">
            {tickets.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No hay incidencias registradas.</p>
              </div>
            ) : (
              tickets.map((ticket) => {
                const cfg = ticketStatusConfig[ticket.status];
                return (
                  <button
                    key={ticket.id}
                    onClick={() => { setSelectedTicket(ticket); setView("ticket-detail"); }}
                    className="w-full text-left p-3.5 rounded-xl border border-border hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Hash className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">{ticket.folio}</span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-foreground font-medium">{ticket.category}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ticket.location} · {ticket.createdAt}</p>
                  </button>
                );
              })
            )}
          </div>

          <Button
            variant="outline"
            className="w-full mt-4 rounded-xl h-11 text-sm gap-2"
            onClick={() => setView("report")}
          >
            <Plus className="w-4 h-4" />
            Nueva incidencia
          </Button>
        </SheetContent>
      </Sheet>
    );
  }

  // ── TICKET DETAIL VIEW ──
  if (view === "ticket-detail" && selectedTicket) {
    const cfg = ticketStatusConfig[selectedTicket.status];
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto px-5 pb-8 [&>button:last-child]:hidden">
          <SheetHeader className="text-left pb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setView("tickets")} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-foreground" />
              </button>
              <div>
                <SheetTitle className="text-foreground font-display">{selectedTicket.folio}</SheetTitle>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2.5">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Categoría</span>
                <span className="text-xs font-medium text-foreground">{selectedTicket.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Ubicación</span>
                <span className="text-xs font-medium text-foreground">{selectedTicket.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Fecha</span>
                <span className="text-xs font-medium text-foreground">{selectedTicket.createdAt}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Descripción</h4>
              <p className="text-sm text-foreground leading-relaxed">{selectedTicket.description}</p>
            </div>

            {selectedTicket.photos.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Evidencia</h4>
                <div className="flex gap-2 flex-wrap">
                  {selectedTicket.photos.map((_, i) => (
                    <div key={i} className="w-16 h-16 rounded-lg bg-muted/50 border border-border flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── MAIN VIEW ──
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto px-5 pb-8 [&>button:last-child]:hidden">
        {/* Header */}
        <SheetHeader className="text-left pb-3">
          <div className="flex items-center gap-3">
            <Home className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <SheetTitle className="text-foreground font-display">Entrega de tu unidad</SheetTitle>
              <p className="text-sm text-muted-foreground">Agenda, recibe y formaliza.</p>
            </div>
          </div>
        </SheetHeader>

        {/* ── 1. Appointment ── */}
        {data?.scheduledAppointment ? (
          <>
            {/* ── Appointment summary ── */}
            <section className="mt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Cita confirmada
              </h3>
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {data.scheduledAppointment.date}
                    {data.scheduledAppointment.time ? ` - ${data.scheduledAppointment.time} hrs` : ""}
                  </span>
                </div>
                {data.scheduledAppointment.location && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground leading-relaxed">{data.scheduledAppointment.location}</span>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full mt-3 rounded-xl h-10 text-xs gap-2"
                onClick={() =>
                  window.open(
                    `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Entrega+${investment.property.projectName}+${investment.property.unitNumber}&location=${encodeURIComponent(data.scheduledAppointment!.location)}`,
                    "_blank"
                  )
                }
              >
                <Calendar className="w-3.5 h-3.5" />
                Agregar a calendario
              </Button>
            </section>

            {/* ── 2. Delivery actions ── */}
            <section className="mt-6">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Confirmación de entrega
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setView("accept")}
                  className="p-4 rounded-xl border border-success/30 bg-success/5 hover:bg-success/10 transition-colors text-center"
                >
                  <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Aceptar entrega</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Firmar aceptación</p>
                </button>

                <button
                  onClick={() => setView("report")}
                  className="p-4 rounded-xl border border-warning/30 bg-warning/5 hover:bg-warning/10 transition-colors text-center"
                >
                  <div className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Levantar fallas</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Registrar incidencia</p>
                </button>
              </div>
            </section>

          </>
        ) : (
          <section className="mt-6 flex flex-col items-center text-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Calendar className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Cita pendiente de agendar</p>
              <p className="text-xs text-muted-foreground mt-1">
                SOZU coordinará la fecha y hora de entrega contigo.
              </p>
            </div>
          </section>
        )}

        {/* ── Tickets summary (always visible) ── */}
        {tickets.length > 0 && (
          <section className="mt-5">
            <button
              onClick={() => setView("tickets")}
              className="w-full p-3.5 rounded-xl border border-border hover:bg-muted/20 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-sm font-medium text-foreground">
                  {tickets.length} incidencia{tickets.length !== 1 ? "s" : ""} registrada{tickets.length !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="text-xs text-primary font-medium">Ver todas →</span>
            </button>
          </section>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default EntregaSheet;
