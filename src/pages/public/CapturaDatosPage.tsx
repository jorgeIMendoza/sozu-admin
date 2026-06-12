import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Mail, Phone, ShieldCheck } from "lucide-react";
import OfferFlowShell from "@/components/offer/OfferFlowShell";
import { useOfertaFlowStore } from "@/lib/offer-flow-store";

function InputField({
  id, icon: Icon, type = "text", placeholder, value, onChange, required, pattern, minLength, autoComplete,
}: {
  id: string; icon: React.ElementType; type?: string; placeholder: string; value: string;
  onChange: (v: string) => void; required?: boolean; pattern?: string; minLength?: number; autoComplete?: string;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        pattern={pattern}
        minLength={minLength}
        className="w-full h-11 pl-9 pr-4 rounded-xl border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
      />
    </div>
  );
}

export default function CapturaDatosPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const { setProspect, setOfertaId } = useOfertaFlowStore();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 3) e.fullName = "Ingresa tu nombre completo";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Correo inválido";
    if (phone.replace(/\D/g, "").length < 10) e.phone = "Mínimo 10 dígitos";
    return e;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setOfertaId(offerId ?? "");
    setProspect({ fullName: fullName.trim(), email: email.trim().toLowerCase(), phone: phone.trim() });
    // TODO: send magic link via Supabase edge function
    setTimeout(() => {
      setLoading(false);
      navigate(`/oferta/${offerId}/verificar-email`);
    }, 800);
  };

  return (
    <OfferFlowShell title="Tus datos de contacto">
      <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
        <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Solo necesitamos esta información para reservar la unidad a tu nombre y enviarte el acceso.
          </p>

          <div className="space-y-3">
            <div>
              <InputField id="fullName" autoComplete="name" icon={User} placeholder="Nombre completo" value={fullName} onChange={setFullName} required minLength={3} />
              {errors.fullName && <p role="alert" className="text-[11px] text-destructive mt-1">{errors.fullName}</p>}
            </div>
            <div>
              <InputField id="email" autoComplete="email" icon={Mail} type="email" placeholder="Correo electrónico" value={email} onChange={setEmail} required />
              {errors.email && <p role="alert" className="text-[11px] text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <InputField id="phone" autoComplete="tel" icon={Phone} type="tel" placeholder="Teléfono (10 dígitos)" value={phone} onChange={setPhone} required />
              {errors.phone && <p role="alert" className="text-[11px] text-destructive mt-1">{errors.phone}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 px-1">
          <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Tus datos están protegidos bajo la{" "}
            <abbr title="Ley Federal de Protección de Datos Personales en Posesión de los Particulares">
              LFPDPPP
            </abbr>{" "}
            de México. No los compartiremos con terceros sin tu consentimiento.
          </p>
        </div>

        <div className="mt-auto pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full motion-safe:animate-spin" />
            ) : (
              "Continuar al apartado"
            )}
          </button>
        </div>
      </form>
    </OfferFlowShell>
  );
}
