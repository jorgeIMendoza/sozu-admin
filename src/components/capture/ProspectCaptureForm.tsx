import { useRef, useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import type { OfertaComercial } from "@/lib/offers/offer-data";
import { LEGAL_URLS } from "@/lib/legalUrls";

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
  defaultFullName?: string;
  defaultPhone?: string;
  defaultDialCode?: string;
  onBack?: () => void;
  onComplete: (data: { fullName: string; email: string; phone: string }) => void;
  /**
   * Si se provee, activa el flujo de dos pasos: primero "Actualizar datos"
   * (persiste nombre/teléfono en BD y confirma que son correctos), luego "Continuar".
   * Debe devolver true si el guardado fue exitoso.
   */
  onSaveData?: (data: { fullName: string; phoneDigits: string; countryCode: string }) => Promise<boolean>;
  /** Texto del botón principal. Por defecto "Confirmar y continuar". */
  submitLabel?: string;
  /** Bloquea el botón mientras el llamador procesa (p. ej. creando la cuenta). */
  submitting?: boolean;
  /** Contenido extra antes del CTA (p. ej. la subida de la Constancia). */
  extraFields?: React.ReactNode;
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

const ProspectCaptureForm = ({ offer, agentName, context, defaultEmail, defaultFullName, defaultPhone, defaultDialCode, onBack, onComplete, onSaveData, submitLabel, submitting = false, extraFields }: Props) => {
  const isFormal = context === "formal_direct";
  const emailLocked = isFormal || Boolean(defaultEmail);

  const [fullName, setFullName] = useState(defaultFullName ?? "");
  const [email] = useState(defaultEmail ?? "");
  const [countryCode, setCountryCode] = useState(defaultDialCode ?? "+52");
  const [phoneDigits, setPhoneDigits] = useState((defaultPhone ?? "").replace(/\D/g, "").slice(0, 10));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Valores con los que se cargó la pantalla: si no cambian, no hay nada que guardar.
  const originales = useRef({
    fullName: (defaultFullName ?? "").trim(),
    phoneDigits: (defaultPhone ?? "").replace(/\D/g, "").slice(0, 10),
  });

  const markDirty = () => setSaveError(null);

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

  /**
   * Confirmar y continuar. El guardado solo ocurre si el usuario cambió nombre o
   * teléfono; si los deja igual, no se toca la BD y se avanza directo. Un fallo
   * al guardar tampoco detiene el flujo: los datos viajan en memoria.
   */
  const handleConfirmarYContinuar = async () => {
    if (!isValid || saving) return;

    const nombreLimpio = fullName.trim();
    const telLimpio = phoneDigits.replace(/\D/g, "");
    const huboCambios =
      nombreLimpio !== originales.current.fullName ||
      telLimpio !== originales.current.phoneDigits;

    if (onSaveData && huboCambios) {
      setSaving(true);
      setSaveError(null);
      try {
        const ok = await onSaveData({ fullName: nombreLimpio, phoneDigits: telLimpio, countryCode });
        if (!ok) setSaveError("Tus datos se aplicarán al continuar con tu solicitud.");
        else originales.current = { fullName: nombreLimpio, phoneDigits: telLimpio };
      } catch {
        setSaveError("Tus datos se aplicarán al continuar con tu solicitud.");
      } finally {
        setSaving(false);
      }
    }

    handleSubmit();
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
          onChange={(v) => { setFullName(v); markDirty(); }}
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
              onChange={(e) => { setCountryCode(e.target.value); markDirty(); }}
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
                markDirty();
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
          Datos protegidos conforme al{" "}
          <a
            href={LEGAL_URLS.avisoPrivacidad}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
          >
            Aviso de privacidad
          </a>{" "}
          de SOZU (LFPDPPP México).
        </p>
      </div>

      {extraFields}

      {/* CTA — un solo paso: confirma y continúa. Si el usuario editó algo se
          guarda en BD; si dejó los datos tal cual, solo avanza. */}
      <div className="space-y-2">
        <button
          type="button"
          disabled={!isValid || saving || submitting}
          onClick={handleConfirmarYContinuar}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          {saving || submitting ? (
            <><Loader2 className="w-4 h-4 motion-safe:animate-spin" />{submitting ? (submitLabel ?? "Procesando…") : "Guardando…"}</>
          ) : (
            submitLabel ?? "Confirmar y continuar"
          )}
        </button>
        {saveError && (
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">{saveError}</p>
        )}
        <p className="text-[10px] leading-relaxed text-muted-foreground/60 text-center">
          Al continuar aceptas el{" "}
          <a href={LEGAL_URLS.avisoPrivacidad} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            Aviso de privacidad
          </a>
          , los{" "}
          <a href={LEGAL_URLS.terminos} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            Términos y condiciones
          </a>{" "}
          y la{" "}
          <a href={LEGAL_URLS.politicaDatos} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            Política de datos
          </a>{" "}
          de SOZU.
        </p>
      </div>

    </div>
  );
};

export default ProspectCaptureForm;
