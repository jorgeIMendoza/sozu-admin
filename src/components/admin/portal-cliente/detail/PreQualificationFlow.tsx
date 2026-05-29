import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  ArrowLeft,
  Info,
  Calculator,
  Send,
  CheckCircle2,
} from "lucide-react";
import {
  BANK_RATES,
  INGRESO_LABELS,
  SITUACION_LABORAL_LABELS,
  calculateEstimateRange,
  calculateLTV,
  calculateLeadScore,
  type PreferredBankId,
  type IngresoRange,
  type SituacionLaboral,
  type PrequalificationData,
} from "@/lib/portal-cliente/mortgage-data";

interface PreQualificationFlowProps {
  bankId: PreferredBankId;
  pendingBalance: number;
  propertyValue: number;
  propertyLabel: string;
  onComplete: (data: PrequalificationData) => void;
  onCancel: () => void;
}

type Screen = "credit-data" | "estimate" | "borrower-data" | "submitted";

const PLAZOS: Array<10 | 15 | 20> = [10, 15, 20];

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { maximumFractionDigits: 0 });

const PreQualificationFlow = ({
  bankId,
  pendingBalance,
  propertyValue,
  onComplete,
  onCancel,
}: PreQualificationFlowProps) => {
  const [screen, setScreen] = useState<Screen>("credit-data");
  const [montoFinanciar, setMontoFinanciar] = useState<number>(pendingBalance);
  const [plazoAnios, setPlazoAnios] = useState<10 | 15 | 20>(20);
  const [ingresoRange, setIngresoRange] = useState<IngresoRange | null>(null);
  const [situacionLaboral, setSituacionLaboral] = useState<SituacionLaboral | null>(null);
  const [esClienteActual, setEsClienteActual] = useState<boolean | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState<PrequalificationData | null>(null);
  const [sending, setSending] = useState(false);

  const estimate = calculateEstimateRange(bankId, montoFinanciar, plazoAnios);

  const formValid =
    !!ingresoRange &&
    !!situacionLaboral &&
    esClienteActual !== null &&
    nombre.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(email) &&
    telefono.length === 10 &&
    consent;

  const handleSubmit = () => {
    if (!formValid || !ingresoRange || !situacionLaboral || esClienteActual === null) return;
    const ltv = calculateLTV(montoFinanciar, propertyValue);
    const score = calculateLeadScore(ltv, ingresoRange, estimate.monthlyMax);
    const data: PrequalificationData = {
      montoFinanciar,
      plazoAnios,
      ingresoRange,
      situacionLaboral,
      esClienteActual,
      contacto: { nombre: nombre.trim(), email: email.trim(), telefono },
      consentimientoCompartirDatos: true,
      estimatedMonthlyMin: estimate.monthlyMin,
      estimatedMonthlyMax: estimate.monthlyMax,
      estimatedRateMin: estimate.rateMin,
      estimatedRateMax: estimate.rateMax,
      estimatedCatMin: estimate.catMin,
      estimatedCatMax: estimate.catMax,
      ltv,
      score,
      submittedAt: new Date().toISOString(),
    };
    setSubmitted(data);
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setScreen("submitted");
    }, 800);
  };

  if (sending) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Enviando a {bankId}…</p>
      </div>
    );
  }

  // ── Screen: credit-data ──
  if (screen === "credit-data") {
    return (
      <div className="animate-fade-in space-y-5">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">
            Pre-calificación con {bankId}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Paso 1 de 2</p>
        </div>
        <div>
          <h3 className="font-display font-bold text-xl text-foreground">
            ¿Cuánto necesitas financiar?
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            Te tomará menos de 3 minutos. No te pedimos RFC ni documentos en esta etapa.
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Monto a financiar</Label>
          <p className="font-display font-bold text-2xl tabular-nums text-foreground">
            ${fmt(montoFinanciar)} MXN
          </p>
          <Slider
            min={100000}
            max={pendingBalance}
            step={50000}
            value={[montoFinanciar]}
            onValueChange={(v) => setMontoFinanciar(v[0])}
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            El resto lo cubrirías con recursos propios al escriturar. Tu saldo pendiente es de ${fmt(pendingBalance)} MXN.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Plazo</Label>
          <div className="grid grid-cols-3 gap-2">
            {PLAZOS.map((p) => {
              const sel = p === plazoAnios;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlazoAnios(p)}
                  className={`h-11 rounded-xl border text-sm font-medium transition-all ${
                    sel
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {p} años
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Más plazo = mensualidad menor, intereses totales mayores.
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <Button
            className="w-full rounded-xl h-12 text-sm font-semibold gap-2"
            onClick={() => setScreen("estimate")}
          >
            Calcular mi estimación
            <ChevronRight className="w-4 h-4" />
          </Button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-xs text-muted-foreground py-2 hover:text-foreground transition-colors"
          >
            ← Cambiar banco
          </button>
        </div>
      </div>
    );
  }

  // ── Screen: estimate ──
  if (screen === "estimate") {
    return (
      <div className="animate-fade-in space-y-4">
        <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">
          Estimación con {bankId}
        </p>

        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">
            Tu mensualidad estimada estaría entre
          </p>
          <p className="font-display font-bold text-3xl text-foreground tabular-nums mt-1 leading-tight">
            ${fmt(estimate.monthlyMin)} – ${fmt(estimate.monthlyMax)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            MXN al mes durante {plazoAnios} años
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Monto", value: `$${fmt(montoFinanciar)}` },
            { label: "Tasa fija anual", value: `${estimate.rateMin}% – ${estimate.rateMax}%` },
            { label: "CAT promedio", value: `${estimate.catMin}% – ${estimate.catMax}%` },
          ].map((c) => (
            <div key={c.label} className="bg-card border border-border rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {c.label}
              </p>
              <p className="font-display font-semibold text-sm tabular-nums text-foreground mt-1 leading-tight">
                {c.value}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-muted/50 border border-border rounded-xl p-4 flex gap-2.5">
          <Calculator className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Esta estimación usa los rangos de mercado de {bankId} al primer trimestre de 2026. La tasa y CAT definitivos los determina el banco al revisar tu perfil.
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Esta estimación es referencial y no constituye una oferta vinculante de crédito. Las condiciones definitivas (tasa, CAT, plazo y monto) serán determinadas por la institución financiera tras analizar tu perfil. Es tu derecho solicitar la oferta vinculante para comparar distintas opciones de crédito.
        </p>

        <div className="space-y-2 pt-1">
          <Button
            className="w-full rounded-xl h-12 text-sm font-semibold gap-2"
            onClick={() => setScreen("borrower-data")}
          >
            Continuar con mis datos
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl h-11 text-sm gap-2"
            onClick={() => setScreen("credit-data")}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Ajustar monto o plazo
          </Button>
        </div>
      </div>
    );
  }

  // ── Screen: borrower-data ──
  if (screen === "borrower-data") {
    return (
      <div className="animate-fade-in space-y-5">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">
            Pre-calificación con {bankId}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Paso 2 de 2</p>
        </div>
        <div>
          <h3 className="font-display font-bold text-xl text-foreground">
            Cuéntanos un poco más
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            Estos datos ayudan a tu broker bancario a tener una conversación más productiva contigo.
          </p>
        </div>

        {/* Ingreso */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Ingreso mensual bruto</Label>
          <p className="text-xs text-muted-foreground">
            Suma los ingresos comprobables de quienes vivirán en la propiedad.
          </p>
          <div className="space-y-2">
            {(Object.keys(INGRESO_LABELS) as IngresoRange[]).map((r) => {
              const sel = ingresoRange === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setIngresoRange(r)}
                  className={`w-full text-left p-3 rounded-xl border text-sm font-medium transition-all ${
                    sel
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20 text-foreground"
                      : "border-border text-foreground"
                  }`}
                >
                  {INGRESO_LABELS[r]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Situación */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Situación laboral</Label>
          <Select
            value={situacionLaboral ?? undefined}
            onValueChange={(v) => setSituacionLaboral(v as SituacionLaboral)}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Selecciona una opción" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SITUACION_LABORAL_LABELS) as SituacionLaboral[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SITUACION_LABORAL_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cliente actual */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">¿Eres cliente actual de {bankId}?</Label>
          <p className="text-xs text-muted-foreground">
            Tener nómina, tarjeta o inversiones con {bankId} puede mejorar tu tasa hasta 1.25 puntos.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Sí", value: true },
              { label: "No", value: false },
            ].map((o) => {
              const sel = esClienteActual === o.value;
              return (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setEsClienteActual(o.value)}
                  className={`h-11 rounded-xl border text-sm font-medium transition-all ${
                    sel
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contacto */}
        <div className="space-y-3 p-4 rounded-xl border border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Datos de contacto</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              El broker de {bankId} te contactará en menos de 24 horas.
            </p>
          </div>
          <div className="space-y-2">
            <Input
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="h-10 rounded-lg"
            />
            <Input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-lg"
            />
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="10 dígitos"
              value={telefono}
              onChange={(e) =>
                setTelefono(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              className="h-10 rounded-lg"
            />
          </div>
        </div>

        {/* Consent */}
        <label className="flex items-start gap-2.5 cursor-pointer">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            className="mt-0.5"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            Acepto que SOZU comparta mis datos con {bankId} para iniciar mi proceso de crédito hipotecario, conforme al Aviso de Privacidad.
          </span>
        </label>

        <div className="space-y-2 pt-1">
          <Button
            disabled={!formValid}
            onClick={handleSubmit}
            className="w-full rounded-xl h-12 text-sm font-semibold gap-2"
          >
            <Send className="w-4 h-4" />
            Enviar a {bankId}
          </Button>
          <button
            type="button"
            onClick={() => setScreen("estimate")}
            className="w-full text-xs text-muted-foreground py-2 hover:text-foreground transition-colors"
          >
            ← Volver a la estimación
          </button>
        </div>
      </div>
    );
  }

  // ── Screen: submitted ──
  if (screen === "submitted" && submitted) {
    return (
      <div className="animate-fade-in flex flex-col items-center text-center gap-4 pt-4">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <div>
          <h3 className="font-display font-bold text-xl text-foreground">
            ¡Tu intención de crédito fue enviada!
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
            Un broker de {bankId} te contactará en menos de 24 horas al {submitted.contacto.telefono}.
          </p>
        </div>

        <div className="w-full border border-border rounded-xl p-4 space-y-2 text-left">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Resumen enviado a {bankId}
          </p>
          {[
            ["Monto a financiar", `$${fmt(submitted.montoFinanciar)} MXN`],
            ["Plazo", `${submitted.plazoAnios} años`],
            [
              "Mensualidad estimada",
              `$${fmt(submitted.estimatedMonthlyMin)} – $${fmt(submitted.estimatedMonthlyMax)} MXN`,
            ],
            [
              "Tasa fija",
              `${submitted.estimatedRateMin}% – ${submitted.estimatedRateMax}%`,
            ],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{l}</span>
              <span className="text-foreground font-medium tabular-nums text-right">
                {v}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed text-left">
          Esta no es una pre-aprobación bancaria. La oferta vinculante la emitirá {bankId} tras revisar tu perfil. Para dudas o aclaraciones puedes contactar a CONDUSEF: condusef.gob.mx, (55) 5340 0999.
        </p>

        <Button
          className="w-full rounded-xl h-12 text-sm font-semibold mt-2"
          onClick={() => onComplete(submitted)}
        >
          Listo
        </Button>
      </div>
    );
  }

  // sending state (between submit and "submitted" screen)
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Enviando a {bankId}…</p>
    </div>
  );
};

export default PreQualificationFlow;
