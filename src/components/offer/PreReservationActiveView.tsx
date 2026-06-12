/**
 * @deprecated F.3.C — Pre-apartado del 18.7.A reemplazado por el modelo del hold del 18.9.F
 * (FormalReservation + ApartadoProvisionalDashboard). Archivo en cuarentena: se conserva
 * para servir a clientes con PRE-XXX activos al rollout. Ningún cliente nuevo entra acá
 * (CTA removido en F.3.A; ruta de entrada removida en F.3.C). No usar para nuevas
 * funcionalidades. Migración: src/lib/formal-reservation-data.ts y
 * src/components/apartado-provisional/.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Clock, ArrowRight, ShieldCheck } from "lucide-react";
import type { OfertaComercial, PreReservation } from "@/lib/offers/offer-data";
import { formatMXN, formatPropertyTitle } from "@/lib/offers/offer-data";
import { useAgentById, type Agent } from "@/lib/offers/agent-data";
import { supabase } from "@/integrations/supabase/client";
import PublicShell from "@/components/offer/PublicShell";

interface Props {
  offer: OfertaComercial;
  preReservation: PreReservation;
}

const PreReservationActiveView = ({ offer, preReservation }: Props) => {
  const navigate = useNavigate();
  const mockAgent = useAgentById(offer.agentId ?? "");
  const [agentFromDB, setAgentFromDB] = useState<Agent | undefined>(undefined);
  const agentOfferId = offer.id;
  useEffect(() => {
    if (!agentOfferId) return;
    (async () => {
      const { data: oferta } = await supabase
        .from("ofertas").select("email_creador").eq("id", agentOfferId).single();
      if (!oferta?.email_creador) return;
      const { data: usuario } = await supabase
        .from("usuarios").select("id_persona").eq("email", oferta.email_creador).single();
      if (!usuario?.id_persona) return;
      const { data: persona } = await supabase
        .from("personas").select("nombre_legal, telefono, clave_pais_telefono").eq("id", usuario.id_persona).single();
      if (!persona?.nombre_legal) return;
      const countryCode = (persona.clave_pais_telefono ?? "+52").replace("+", "");
      const rawPhone = (persona.telefono ?? "").replace(/\s/g, "");
      setAgentFromDB({
        id: "", fullName: persona.nombre_legal,
        firstName: persona.nombre_legal.split(" ")[0],
        title: "", photoUrl: "", email: "",
        phone: rawPhone ? `${persona.clave_pais_telefono ?? "+52"} ${persona.telefono ?? ""}` : "",
        whatsapp: rawPhone ? `${countryCode}${rawPhone}` : "",
        isAllied: true,
      });
    })();
  }, [agentOfferId]);
  const agent = agentFromDB ?? mockAgent ?? undefined;

  const propertyLabel = formatPropertyTitle(offer.property);

  const expiresAt = new Date(preReservation.reservationExpiresAt);
  const createdAt = new Date(preReservation.createdAt);
  const totalMs = expiresAt.getTime() - createdAt.getTime();
  const elapsedMs = Date.now() - createdAt.getTime();
  const progressPct = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
  const daysLeft = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const interestedPlan = preReservation.interestedPlanId
    ? offer.paymentPlans.find((p) => p.id === preReservation.interestedPlanId)
    : undefined;

  return (
    <PublicShell agent={agent}>
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-6">
        {/* Banner principal */}
        <div className="rounded-2xl border border-success/30 bg-success/5 p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-success" />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-success">
                Pre-apartado activo
              </p>
              <h1 className="font-display text-xl md:text-2xl font-bold text-foreground leading-tight">
                {propertyLabel} está reservada a tu nombre
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Aportaste {formatMXN(preReservation.amountMXN)} como pre-apartado. Tienes 15 días
                completos para decidir si avanzas al apartado formal.
              </p>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                Tiempo restante
              </span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {daysLeft} día{daysLeft !== 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                Vence el{" "}
                {expiresAt.toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-warning rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Plan de interés */}
        {interestedPlan && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                Tu plan de interés inicial
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-base font-bold text-foreground">
                  Plan {interestedPlan.name}
                </span>
                {interestedPlan.discountPct > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[11px] font-bold">
                    -{interestedPlan.discountPct}% descuento
                  </span>
                )}
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Precio final con descuento</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatMXN(interestedPlan.finalPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Enganche ({interestedPlan.downPaymentPct}%)
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatMXN(interestedPlan.downPaymentAmount)}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                Podrás confirmar o cambiar tu plan en el apartado formal.
              </p>
            </div>
          </div>
        )}

        {/* CTA principal */}
        <button
          onClick={() => navigate(`/mi-pre-apartado/${preReservation.id}`)}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          Ir a mi pre-apartado
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Disclaimer */}
        <div className="rounded-xl border border-success/20 bg-success/5 p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Si decides no avanzar al apartado formal, tus {formatMXN(preReservation.amountMXN)} te
            serán devueltos automáticamente al vencer el plazo. Sin trámites ni penalizaciones.
          </p>
        </div>
      </div>
    </PublicShell>
  );
};

export default PreReservationActiveView;
