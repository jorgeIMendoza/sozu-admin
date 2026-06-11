import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Mail, Phone, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

function InputField({
  id, icon: Icon, type = "text", placeholder, value, onChange, readOnly, autoComplete,
}: {
  id: string;
  icon: React.ElementType;
  type?: string;
  placeholder: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  autoComplete?: string;
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
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        className={`w-full h-11 pl-9 pr-4 rounded-xl border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${readOnly ? "opacity-60 cursor-default select-none" : ""}`}
      />
    </div>
  );
}

type Apartado = {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  hold_status: string;
  activo: boolean;
  id_oferta: number | null;
};

export default function CapturaDatosReservaPage() {
  const { apartadoId } = useParams<{ apartadoId: string }>();
  const navigate = useNavigate();

  const [apartado, setApartado] = useState<Apartado | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!apartadoId) { setLoadError("Link inválido."); setLoadingPage(false); return; }

    (async () => {
      const { data, error } = await (supabase as any)
        .from("apartados_provisionales")
        .select("id, email, nombre, telefono, hold_status, activo, id_oferta")
        .eq("id", apartadoId)
        .maybeSingle();

      if (error || !data) { setLoadError("Este link no existe o ya no es válido."); setLoadingPage(false); return; }
      if (!data.activo) { setLoadError("Este link ha sido desactivado."); setLoadingPage(false); return; }
      if (data.hold_status === "autorizado") {
        navigate(`/reservar/${apartadoId}/confirmacion`, { replace: true });
        return;
      }

      setApartado(data);

      // Pre-fill si ya existe persona con ese email
      const { data: persona } = await supabase
        .from("personas")
        .select("nombre_legal, telefono")
        .eq("email", data.email)
        .eq("activo", true)
        .maybeSingle();

      if (persona) {
        if (persona.nombre_legal) setNombre(persona.nombre_legal);
        if (persona.telefono) setTelefono(persona.telefono);
      } else if (data.nombre) {
        setNombre(data.nombre);
        if (data.telefono) setTelefono(data.telefono);
      }

      setLoadingPage(false);
    })();
  }, [apartadoId, navigate]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (nombre.trim().length < 3) e.nombre = "Ingresa tu nombre completo";
    if (telefono.replace(/\D/g, "").length < 10) e.telefono = "Mínimo 10 dígitos";
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!apartado) return;
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);

    try {
      const email = apartado.email.trim().toLowerCase();
      const nombreTrim = nombre.trim();
      const telefonoTrim = telefono.trim();

      // UPSERT persona by email
      let personaId: number | null = null;
      const { data: personaExisting } = await supabase
        .from("personas")
        .select("id")
        .eq("email", email)
        .eq("activo", true)
        .maybeSingle();

      if (personaExisting) {
        await supabase
          .from("personas")
          .update({ nombre_legal: nombreTrim, telefono: telefonoTrim })
          .eq("id", personaExisting.id);
        personaId = personaExisting.id;
      } else {
        const { data: newPersona, error: insertError } = await (supabase as any)
          .from("personas")
          .insert({ email, nombre_legal: nombreTrim, telefono: telefonoTrim, es_draft: true, activo: true })
          .select("id")
          .single();
        if (insertError || !newPersona) throw new Error("Error guardando datos");
        personaId = newPersona.id;
      }

      // UPDATE apartados_provisionales
      await (supabase as any)
        .from("apartados_provisionales")
        .update({ id_persona: personaId, nombre: nombreTrim, telefono: telefonoTrim, updated_at: new Date().toISOString() })
        .eq("id", apartado.id);

      // UPSERT entidades_relacionadas como Prospecto (id_tipo_entidad=7) si hay proyecto
      if (apartado.id_oferta && personaId) {
        const { data: oferta } = await (supabase as any)
          .from("ofertas")
          .select("id_proyecto")
          .eq("id", apartado.id_oferta)
          .maybeSingle();

        if (oferta?.id_proyecto) {
          const { data: existing } = await (supabase as any)
            .from("entidades_relacionadas")
            .select("id")
            .eq("id_persona", personaId)
            .eq("id_tipo_entidad", 7)
            .eq("id_proyecto", oferta.id_proyecto)
            .maybeSingle();

          if (existing) {
            await (supabase as any)
              .from("entidades_relacionadas")
              .update({ activo: true })
              .eq("id", existing.id);
          } else {
            await (supabase as any)
              .from("entidades_relacionadas")
              .insert({ id_persona: personaId, id_tipo_entidad: 7, id_proyecto: oferta.id_proyecto, activo: true });
          }
        }
      }

      navigate(`/reservar/${apartadoId}/hold`);
    } catch {
      toast({ title: "Error", description: "No se pudieron guardar tus datos. Intenta de nuevo.", duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  if (loadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !apartado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <h1 className="text-base font-semibold text-foreground">Link inválido</h1>
        <p className="text-[13px] text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center mb-6">
          <span className="text-primary-foreground text-[11px] font-bold">SZ</span>
        </div>
        <h1 className="text-xl font-bold text-foreground leading-tight">Tus datos de contacto</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Para reservar la unidad a tu nombre y enviarte el acceso necesitamos confirmarte.
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 pb-10">
        <form onSubmit={handleSubmit} className="space-y-4 flex flex-col h-full">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            {/* Email — readonly */}
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Correo electrónico</p>
              <InputField
                id="email"
                icon={Mail}
                type="email"
                placeholder="Correo electrónico"
                value={apartado.email}
                readOnly
              />
              <p className="text-[11px] text-muted-foreground mt-1">Este correo fue registrado por tu agente.</p>
            </div>

            {/* Nombre */}
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Nombre completo</p>
              <InputField
                id="nombre"
                autoComplete="name"
                icon={User}
                placeholder="Nombre completo"
                value={nombre}
                onChange={setNombre}
              />
              {errors.nombre && <p role="alert" className="text-[11px] text-destructive mt-1">{errors.nombre}</p>}
            </div>

            {/* Teléfono */}
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Teléfono (10 dígitos)</p>
              <InputField
                id="telefono"
                autoComplete="tel"
                icon={Phone}
                type="tel"
                placeholder="Teléfono (10 dígitos)"
                value={telefono}
                onChange={setTelefono}
              />
              {errors.telefono && <p role="alert" className="text-[11px] text-destructive mt-1">{errors.telefono}</p>}
            </div>
          </div>

          <div className="flex items-start gap-2.5 px-1">
            <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Tus datos están protegidos bajo la{" "}
              <abbr title="Ley Federal de Protección de Datos Personales en Posesión de los Particulares">LFPDPPP</abbr>{" "}
              de México.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Continuar al apartado"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
