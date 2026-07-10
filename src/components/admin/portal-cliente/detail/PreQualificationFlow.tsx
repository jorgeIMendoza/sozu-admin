import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight,
  ArrowLeft,
  Calculator,
  Send,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import {
  calculateEstimateFromRates,
  hasRates,
  type SelectedBank,
  type PrequalificationData,
} from "@/lib/portal-cliente/mortgage-data";

interface PreQualificationFlowProps {
  bank: SelectedBank;
  pendingBalance: number;
  onComplete: (data: PrequalificationData) => void;
  onCancel: () => void;
}

type Screen = "credit-data" | "estimate" | "submitted";

const PLAZOS: number[] = [10, 15, 20];

const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 0 });

const PreQualificationFlow = ({ bank, pendingBalance, onComplete, onCancel }: PreQualificationFlowProps) => {
  const [screen, setScreen] = useState<Screen>("credit-data");
  const [montoFinanciar, setMontoFinanciar] = useState<number>(pendingBalance);
  const [plazoAnios, setPlazoAnios] = useState<number>(20);
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState<PrequalificationData | null>(null);
  const [sending, setSending] = useState(false);

  const bankHasRates = hasRates(bank.rates);
  const estimate = calculateEstimateFromRates(montoFinanciar, plazoAnios, bank.rates);

  const handleSubmit = () => {
    if (!consent) return;
    const data: PrequalificationData = {
      idBanco: bank.idBanco,
      bankName: bank.nombre,
      montoFinanciar,
      plazoAnios,
      estimatedMonthlyMin: estimate?.monthlyMin,
      estimatedMonthlyMax: estimate?.monthlyMax,
      estimatedRateMin: estimate?.rateMin,
      estimatedRateMax: estimate?.rateMax,
      estimatedCatMin: estimate?.catMin ?? undefined,
      estimatedCatMax: estimate?.catMax ?? undefined,
      consentimientoCompartirDatos: true,
      submittedAt: new Date().toISOString(),
    };
    setSubmitted(data);
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setScreen("submitted");
    }, 700);
  };

  // Bloque de consentimiento + envío (compartido por credit-data sin tasas y estimate)
  const consentAndSend = (
    <div className="space-y-3 pt-1">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        <span className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
          <span>Autorizo a SOZU compartir mis datos con {bank.nombre} para iniciar mi crédito hipotecario, conforme al Aviso de Privacidad (LFPDPPP).</span>
        </span>
      </label>
      <Button
        disabled={!consent}
        onClick={handleSubmit}
        className="w-full rounded-xl h-11 text-sm font-semibold gap-2"
      >
        <Send className="w-4 h-4" />
        Enviar a {bank.nombre}
      </Button>
    </div>
  );

  if (sending) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-14 gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xs text-muted-foreground">Enviando a {bank.nombre}…</p>
      </div>
    );
  }

  // ── Screen: credit-data (monto + plazo) ──
  if (screen === "credit-data") {
    return (
      <div className="animate-fade-in space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">
            Crédito hipotecario con {bank.nombre}
          </p>
          <h3 className="font-display font-semibold text-base text-foreground mt-0.5">
            ¿Cuánto necesitas financiar?
          </h3>
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-medium text-muted-foreground">Monto a financiar</p>
          <p className="font-display font-bold text-lg tabular-nums text-foreground">
            ${fmt(montoFinanciar)} <span className="text-xs font-normal text-muted-foreground">MXN</span>
          </p>
          <Slider
            min={100000}
            max={Math.max(pendingBalance, 100000)}
            step={50000}
            value={[montoFinanciar]}
            onValueChange={(v) => setMontoFinanciar(v[0])}
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            El resto lo cubrirías con recursos propios al escriturar. Tu saldo pendiente es de ${fmt(pendingBalance)} MXN.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Plazo</p>
          <div className="grid grid-cols-3 gap-2">
            {PLAZOS.map((p) => {
              const sel = p === plazoAnios;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlazoAnios(p)}
                  className={`h-10 rounded-xl border text-xs font-medium transition-all ${
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
        </div>

        {bankHasRates ? (
          <div className="space-y-2 pt-1">
            <Button
              className="w-full rounded-xl h-11 text-sm font-semibold gap-2"
              onClick={() => setScreen("estimate")}
            >
              <Calculator className="w-4 h-4" />
              Ver estimación
              <ChevronRight className="w-4 h-4" />
            </Button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-xs text-muted-foreground py-1.5 hover:text-foreground transition-colors"
            >
              ← Cambiar banco
            </button>
          </div>
        ) : (
          <>
            {consentAndSend}
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-xs text-muted-foreground py-1.5 hover:text-foreground transition-colors"
            >
              ← Cambiar banco
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Screen: estimate (solo si el banco tiene tasas) ──
  if (screen === "estimate" && estimate) {
    return (
      <div className="animate-fade-in space-y-3.5">
        <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">
          Estimación con {bank.nombre}
        </p>

        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
          <p className="text-[11px] text-muted-foreground">Tu mensualidad estimada estaría entre</p>
          <p className="font-display font-bold text-xl text-foreground tabular-nums mt-0.5 leading-tight">
            ${fmt(estimate.monthlyMin)} - ${fmt(estimate.monthlyMax)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            MXN al mes durante {plazoAnios} años
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Monto", value: `$${fmt(montoFinanciar)}` },
            { label: "Tasa fija anual", value: `${estimate.rateMin}% - ${estimate.rateMax}%` },
            {
              label: "CAT promedio",
              value:
                estimate.catMin != null && estimate.catMax != null
                  ? `${estimate.catMin}% - ${estimate.catMax}%`
                  : "-",
            },
          ].map((c) => (
            <div key={c.label} className="bg-card border border-border rounded-xl p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <p className="font-display font-semibold text-xs tabular-nums text-foreground mt-0.5 leading-tight">
                {c.value}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-muted/50 border border-border rounded-xl p-3 flex gap-2">
          <Calculator className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Estimación referencial con las tasas de {bank.nombre}. La tasa y CAT definitivos los determina el banco al revisar tu perfil. No constituye una oferta vinculante.
          </p>
        </div>

        {consentAndSend}

        <Button
          variant="outline"
          className="w-full rounded-xl h-10 text-xs gap-2"
          onClick={() => setScreen("credit-data")}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Ajustar monto o plazo
        </Button>
      </div>
    );
  }

  // ── Screen: submitted ──
  if (screen === "submitted" && submitted) {
    return (
      <div className="animate-fade-in flex flex-col items-center text-center gap-3.5 pt-3">
        <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-success" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-base text-foreground">
            ¡Tu solicitud fue enviada!
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
            El broker de {bank.nombre} se pondrá en contacto contigo lo antes posible.
          </p>
        </div>

        <div className="w-full border border-border rounded-xl p-4 space-y-2 text-left">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Resumen enviado a {bank.nombre}
          </p>
          {[
            ["Monto a financiar", `$${fmt(submitted.montoFinanciar)} MXN`],
            ["Plazo", `${submitted.plazoAnios} años`],
            ...(submitted.estimatedMonthlyMin != null
              ? [
                  [
                    "Mensualidad estimada",
                    `$${fmt(submitted.estimatedMonthlyMin)} - $${fmt(submitted.estimatedMonthlyMax!)} MXN`,
                  ] as [string, string],
                  [
                    "Tasa fija",
                    `${submitted.estimatedRateMin}% - ${submitted.estimatedRateMax}%`,
                  ] as [string, string],
                ]
              : []),
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{l}</span>
              <span className="text-foreground font-medium tabular-nums text-right">{v}</span>
            </div>
          ))}
        </div>

        <Button
          className="w-full rounded-xl h-11 text-sm font-semibold mt-1"
          onClick={() => onComplete(submitted)}
        >
          Listo
        </Button>
      </div>
    );
  }

  return null;
};

export default PreQualificationFlow;
