import { useState } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import type { OfertaComercial } from "@/lib/offers/offer-data";

interface Props {
  offer: OfertaComercial;
  agentName?: string;
  context: "pre_reservation" | "formal_direct";
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
  <div className="space-y-1.5">
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
      className={`w-full h-11 px-3 rounded-lg bg-card border text-sm text-foreground focus:outline-none focus:ring-2 ${
        error
          ? "border-destructive focus:ring-destructive/15"
          : "border-border focus:border-primary focus:ring-primary/15"
      }`}
    />
    {error && <p className="text-[11px] text-destructive">{error}</p>}
  </div>
);

const ProspectCaptureForm = ({ offer, agentName, context, onBack, onComplete }: Props) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const development = offer?.development;
  const property = offer?.property;
  const propertyLabel = `${development?.legalName ?? property?.projectName ?? "esta unidad"} · ${
    property?.unitNumber ?? "—"
  }`;

  const validate = (field: string, value: string) => {
    let error = "";
    if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      error = "Email no parece válido";
    }
    if (field === "phone" && value && value.replace(/\D/g, "").length < 10) {
      error = "Teléfono debe tener al menos 10 dígitos";
    }
    if (error) setErrors((prev) => ({ ...prev, [field]: error }));
    else
      setErrors((prev) => {
        const n = { ...prev };
        delete n[field];
        return n;
      });
  };

  const isValid =
    fullName.trim().length >= 3 &&
    email.trim().length > 0 &&
    phone.replace(/\D/g, "").length >= 10 &&
    Object.keys(errors).length === 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onComplete({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
    });
  };

  const isFormal = context === "formal_direct";
  const stepLabel = isFormal ? "Paso 1 de 2 · Tus datos" : "Paso 1 de 3 · Tus datos";

  return (
    <div className="min-h-screen bg-background">
      {onBack && (
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver a la oferta
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {isFormal ? "Apartado formal" : "Pre-apartado"}
            </span>
          </div>
        </header>
      )}

      <main className="max-w-md mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {stepLabel}
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
            Empecemos por lo básico
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isFormal ? (
              <>
                Vas a apartar <strong className="text-foreground">{propertyLabel}</strong>. Con
                estos datos creamos tu cuenta en SOZU para que puedas avanzar en el proceso
                {agentName ? <> — {agentName} te acompañará durante todo el camino</> : null}.
              </>
            ) : (
              <>
                Vas a pre-apartar <strong className="text-foreground">{propertyLabel}</strong>.
                Solo necesitamos saber cómo contactarte
                {agentName ? (
                  <> — {agentName} te contactará en las próximas 24 horas para acompañarte</>
                ) : null}
                .
              </>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Tus datos están protegidos bajo el Aviso de Privacidad de SOZU (LFPDPPP México). No los
            compartimos con terceros.
          </p>
        </div>

        <div className="space-y-4">
          <Field
            label="Nombre completo"
            value={fullName}
            onChange={setFullName}
            placeholder="Juan Pérez García"
            required
          />
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(v) => setEmail(v.toLowerCase())}
            onBlur={() => validate("email", email)}
            placeholder="juan@email.com"
            error={errors.email}
            required
          />
          <Field
            label="Teléfono"
            type="tel"
            value={phone}
            onChange={setPhone}
            onBlur={() => validate("phone", phone)}
            placeholder="33 1234 5678"
            error={errors.phone}
            required
          />
        </div>

        <button
          type="button"
          disabled={!isValid}
          onClick={handleSubmit}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          {isFormal ? "Continuar al apartado formal" : "Continuar"}
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          Al continuar, aceptas el Aviso de Privacidad y los Términos de SOZU.
        </p>
      </main>
    </div>
  );
};

export default ProspectCaptureForm;
