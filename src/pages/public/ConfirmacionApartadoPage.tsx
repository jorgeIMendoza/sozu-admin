import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, Loader2, AlertCircle, Mail } from "lucide-react";
import { HOLD_AMOUNT_MXN } from "@/lib/offers/card-hold-processor";

type Apartado = {
  id: number;
  email: string;
  nombre: string | null;
  fecha_expiracion: string | null;
  fecha_activacion: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function ConfirmacionApartadoPage() {
  const { apartadoId } = useParams<{ apartadoId: string }>();
  const [apartado, setApartado] = useState<Apartado | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apartadoId) { setLoadError("Link inválido."); setLoading(false); return; }
    const numericId = parseInt(apartadoId.replace(/^[A-Z]+-/, ""), 10);
    if (!numericId) { setLoadError("Link inválido."); setLoading(false); return; }

    (async () => {
      const { data, error } = await (supabase as any)
        .from("reservaciones")
        .select("id, email, nombre, fecha_expiracion, fecha_activacion")
        .eq("id", numericId)
        .maybeSingle();

      if (error || !data) { setLoadError("No se encontró el apartado."); setLoading(false); return; }
      setApartado(data);
      setLoading(false);
    })();
  }, [apartadoId]);

  if (loading) {
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
        <p className="text-[13px] text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  const folio = `RES-${String(apartado.id).padStart(6, "0")}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-5 pt-10 pb-6 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h1 className="text-xl font-bold text-foreground">¡Unidad apartada!</h1>
        <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
          Tu retención de{" "}
          <span className="font-semibold text-foreground">${HOLD_AMOUNT_MXN.toLocaleString("es-MX")} MXN</span>{" "}
          está activa. La unidad está reservada a tu nombre.
        </p>
      </div>

      <div className="flex-1 px-5 pb-10 space-y-4">
        {/* Folio */}
        <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Detalle del apartado
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted-foreground">Folio</span>
              <span className="text-[13px] font-mono font-semibold text-foreground">{folio}</span>
            </div>
            {apartado.nombre && (
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-muted-foreground">Nombre</span>
                <span className="text-[13px] font-medium text-foreground">{apartado.nombre}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted-foreground">Correo</span>
              <span className="text-[13px] text-foreground">{apartado.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted-foreground">Monto retenido</span>
              <span className="text-[13px] font-semibold text-foreground">
                ${HOLD_AMOUNT_MXN.toLocaleString("es-MX")} MXN
              </span>
            </div>
          </div>
        </div>

        {/* Expiry */}
        {apartado.fecha_expiracion && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex gap-3">
            <Clock className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-semibold text-foreground">
                Retención activa hasta:
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {formatDate(apartado.fecha_expiracion)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Si no completas el proceso antes de esta fecha, la retención expira
                automáticamente sin ningún cargo.
              </p>
            </div>
          </div>
        )}

        {/* Email notice */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 flex gap-3">
          <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-foreground">Revisa tu correo</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Te enviamos los detalles de tu apartado y un acceso a tu portal de cliente a{" "}
              <strong className="text-foreground">{apartado.email}</strong>.
            </p>
          </div>
        </div>

        {/* Next steps */}
        <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Siguientes pasos
          </h2>
          <ol className="space-y-2.5">
            {[
              "Tu agente te contactará para guiarte en el proceso de formalización.",
              "Completa los documentos requeridos dentro del período de retención.",
              "Una vez verificado, el apartado pasa a ser formal y se aplica el enganche.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
