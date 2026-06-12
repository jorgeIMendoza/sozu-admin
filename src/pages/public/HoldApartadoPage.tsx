import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail } from "lucide-react";

type Reservacion = {
  id: number;
  email: string;
  nombre: string | null;
  estatus: string;
  activo: boolean;
};

export default function HoldApartadoPage() {
  const { apartadoId } = useParams<{ apartadoId: string }>();

  const [reservacion, setReservacion] = useState<Reservacion | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    if (!apartadoId) { setLoadError("Link inválido."); setLoadingPage(false); return; }
    const numericId = parseInt(apartadoId.replace(/^[A-Z]+-/, ""), 10);
    if (!numericId) { setLoadError("Link inválido."); setLoadingPage(false); return; }

    (async () => {
      const { data, error } = await (supabase as any)
        .from("reservaciones")
        .select("id, email, nombre, estatus, activo")
        .eq("id", numericId)
        .maybeSingle();

      if (error || !data) { setLoadError("Este link no existe o ya no es válido."); setLoadingPage(false); return; }
      if (!data.activo) { setLoadError("Este link ha sido desactivado."); setLoadingPage(false); return; }

      setReservacion(data);
      setLoadingPage(false);
    })();
  }, [apartadoId]);

  if (loadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !reservacion) {
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

  const folio = `RES-${String(reservacion.id).padStart(6, "0")}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-5 pt-10 pb-6 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h1 className="text-xl font-bold text-foreground">¡Reservación registrada!</h1>
        <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
          Tu lugar está apartado. Tu agente te contactará para continuar el proceso.
        </p>
      </div>

      <div className="flex-1 px-5 pb-10 space-y-4">
        {/* Folio */}
        <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Detalle de reservación
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted-foreground">Folio</span>
              <span className="text-[13px] font-mono font-semibold text-foreground">{folio}</span>
            </div>
            {reservacion.nombre && (
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-muted-foreground">Nombre</span>
                <span className="text-[13px] font-medium text-foreground">{reservacion.nombre}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted-foreground">Correo</span>
              <span className="text-[13px] text-foreground">{reservacion.email}</span>
            </div>
          </div>
        </div>

        {/* Próximamente */}
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex gap-3">
          <Clock className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-foreground">Confirmación con tarjeta — próximamente</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Pronto podrás confirmar tu reservación con una retención en tarjeta de crédito.
              Por ahora tu agente coordinará los siguientes pasos contigo directamente.
            </p>
          </div>
        </div>

        {/* Email notice */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 flex gap-3">
          <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-foreground">Revisa tu correo</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Enviamos los detalles de tu reservación a{" "}
              <strong className="text-foreground">{reservacion.email}</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
