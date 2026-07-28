import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Mail, Phone, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  LINK_NO_VIGENTE,
  cargarReservacionPublica,
  parseReservationToken,
} from "@/lib/offers/reservation-token";
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

/** Fila que devuelve el RPC `get_reservacion_publica`. */
type Apartado = {
  id: number;
  email: string;
  nombre: string | null;
  telefono: string | null;
  estatus: string;
  activo: boolean;
  id_oferta: number | null;
  nombre_persona?: string | null;
  telefono_persona?: string | null;
};

export default function CapturaDatosReservaPage() {
  const { apartadoId } = useParams<{ apartadoId: string }>();
  const navigate = useNavigate();
  // Credencial del link: el segmento de la URL debe ser el token de la reservación.
  const token = parseReservationToken(apartadoId);

  const [apartado, setApartado] = useState<Apartado | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) { setLoadError(LINK_NO_VIGENTE); setLoadingPage(false); return; }

    (async () => {
      const row = await cargarReservacionPublica(supabase, token);

      if (!row) { setLoadError(LINK_NO_VIGENTE); setLoadingPage(false); return; }
      if (!row.activo) { setLoadError("Este link ha sido desactivado."); setLoadingPage(false); return; }
      if (row.estatus === "autorizado") {
        navigate(`/reservar/${token}/confirmacion`, { replace: true });
        return;
      }

      setApartado(row);

      // La RPC ya trae los datos de la persona ligada al correo de la reservación.
      if (row.nombre_persona) setNombre(row.nombre_persona);
      if (row.telefono_persona) setTelefono(row.telefono_persona);
      if (!row.nombre_persona && row.nombre) setNombre(row.nombre);
      if (!row.telefono_persona && row.telefono) setTelefono(row.telefono);

      setLoadingPage(false);
    })();
  }, [token, navigate]);

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
      // Todo el guardado ocurre server-side: upsert de la persona por el correo de
      // la reservación, vínculo con la reservación y alta como Prospecto. El
      // navegador no escribe en personas ni entidades_relacionadas.
      const { data: ok, error } = await (supabase as any).rpc("guardar_datos_reservacion", {
        p_token: token,
        p_nombre: nombre.trim(),
        p_telefono: telefono.trim(),
      });
      if (error || ok === false) throw new Error("Error guardando datos");

      navigate(`/reservar/${token}/hold`);
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
        {apartado.id_oferta && (
          <div className="flex gap-3 mb-4">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-[11px] font-mono text-muted-foreground border border-border">
              Oferta {`O-${String(apartado.id_oferta).padStart(6, "0")}`}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-[11px] font-mono text-muted-foreground border border-border">
              {`RES-${String(apartado.id).padStart(6, "0")}`}
            </span>
          </div>
        )}
        <h1 className="text-xl font-bold text-foreground leading-tight">Confirma tus datos</h1>
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
