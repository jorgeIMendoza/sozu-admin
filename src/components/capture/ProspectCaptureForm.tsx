import { useState } from "react";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import type { OfertaComercial } from "@/lib/offers/offer-data";

const COUNTRY_CODES = [
  { code: "+52", flag: "🇲🇽" },
  { code: "+1",  flag: "🇺🇸" },
  { code: "+57", flag: "🇨🇴" },
  { code: "+54", flag: "🇦🇷" },
  { code: "+55", flag: "🇧🇷" },
  { code: "+56", flag: "🇨🇱" },
  { code: "+51", flag: "🇵🇪" },
];

interface Props {
  offer: OfertaComercial;
  agentName?: string;
  context: "pre_reservation" | "formal_direct";
  defaultEmail?: string;
  onBack?: () => void;
  onComplete: (data: { fullName: string; email: string; phone: string }) => void;
}

const Field = ({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
}) => (
  <div className="space-y-1">
    <label className="text-xs font-semibold text-foreground">
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`w-full h-11 px-3 rounded-lg bg-card border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 transition-colors ${
        error
          ? "border-destructive focus:ring-destructive/15"
          : "border-border focus:border-primary focus:ring-primary/15"
      }`}
    />
    {error && <p className="text-[11px] text-destructive">{error}</p>}
  </div>
);

const ProspectCaptureForm = ({ offer, agentName, context, defaultEmail, onBack, onComplete }: Props) => {
  const isFormal = context === "formal_direct";
  const emailLocked = isFormal || Boolean(defaultEmail);

  const [fullName, setFullName] = useState("");
  const [email] = useState(defaultEmail ?? "");
  const [countryCode, setCountryCode] = useState("+52");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validatePhone = (digits: string) => {
    const clean = digits.replace(/\D/g, "");
    if (clean.length > 0 && clean.length < 10) {
      setErrors((prev) => ({ ...prev, phone: "Mínimo 10 dígitos" }));
    } else {
      setErrors((prev) => { const n = { ...prev }; delete n.phone; return n; });
    }
  };

  const emailValid = emailLocked
    ? email.trim().length > 0
    : email.trim().length > 0 && !errors.email;

  const isValid =
    fullName.trim().length >= 3 &&
    emailValid &&
    phoneDigits.replace(/\D/g, "").length >= 10 &&
    Object.keys(errors).length === 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onComplete({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: countryCode + phoneDigits.replace(/\D/g, ""),
    });
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="space-y-1.5">
        {!isFormal && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50">
            Paso 1 de 3 · Tus datos
          </p>
        )}
        <h1 className="text-xl font-bold text-foreground leading-tight">
          Empecemos por lo básico
        </h1>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          {isFormal ? (
            <>
              Con estos datos creamos tu cuenta en SOZU para avanzar con la reserva
              {agentName ? <> — {agentName} te acompañará en el proceso</> : null}.
            </>
          ) : (
            <>
              Solo necesitamos saber cómo contactarte
              {agentName ? (
                <> — {agentName} te contactará en las próximas 24 horas</>
              ) : null}
              .
            </>
          )}
        </p>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <Field
          label="Nombre completo"
          value={fullName}
          onChange={setFullName}
          placeholder="Juan Pérez García"
          required
        />

        {/* Email — always locked in formal_direct */}
        {emailLocked ? (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Email</label>
            <div className="w-full h-11 px-3 rounded-lg bg-muted/40 border border-border/50 text-sm text-muted-foreground flex items-center gap-2 select-none cursor-default">
              <span className="flex-1 truncate">{email || <span className="text-muted-foreground/40 italic">No disponible</span>}</span>
              <Lock className="w-3 h-3 shrink-0 text-muted-foreground/40" />
            </div>
          </div>
        ) : (
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={() => {}}
            placeholder="juan@email.com"
            error={errors.email}
            required
          />
        )}

        {/* Phone — country code selector + number */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Teléfono <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="h-11 pl-2 pr-1 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/15 transition-colors shrink-0"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="numeric"
              value={phoneDigits}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                setPhoneDigits(digits);
              }}
              onBlur={() => validatePhone(phoneDigits)}
              placeholder="3312345678"
              maxLength={10}
              className={`flex-1 h-11 px-3 rounded-lg bg-card border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 transition-colors tabular-nums ${
                errors.phone
                  ? "border-destructive focus:ring-destructive/15"
                  : "border-border focus:border-primary focus:ring-primary/15"
              }`}
            />
          </div>
          {errors.phone && <p className="text-[11px] text-destructive">{errors.phone}</p>}
        </div>
      </div>

      {/* Privacy note */}
      <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
        <ShieldCheck className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Datos protegidos bajo el Aviso de Privacidad de SOZU (LFPDPPP México).
        </p>
      </div>

      {/* CTA */}
      <div className="space-y-2">
        <button
          type="button"
          disabled={!isValid}
          onClick={handleSubmit}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          {isFormal ? "Continuar con la reserva" : "Continuar"}
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-[10px] text-muted-foreground/50 text-center">
          Al continuar aceptas el Aviso de Privacidad y los Términos de SOZU.
        </p>
      </div>

    </div>
  );
};

export default ProspectCaptureForm;
