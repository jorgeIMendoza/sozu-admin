import { CheckCircle2, Landmark, Wallet, Clock } from "lucide-react";
import {
  useSolicitudCreditoVigente,
  puedeCambiarBanco,
  type SolicitudEstatus,
} from "@/hooks/usePortalBancos/useSolicitudesCredito";
import { useBancosConvenio } from "@/hooks/usePortalBancos/useBancosConvenio";

export type TipoFinanciamiento = "RECURSOS_PROPIOS" | "CREDITO_HIPOTECARIO" | null | undefined;

interface PaymentMethodBadgeProps {
  cuentaId: number;
  tipo: TipoFinanciamiento;
  className?: string;
}

const ESTATUS_LINEA: Record<SolicitudEstatus, string> = {
  nuevo: "Solicitud enviada. El broker se pondrá en contacto contigo lo antes posible.",
  asignado: "Un ejecutivo del banco fue asignado a tu solicitud.",
  contactado: "El banco ya hizo el primer contacto contigo.",
  en_evaluacion: "El banco está evaluando tu solicitud.",
  pre_aprobado: "¡Pre-aprobado! El banco continuará con los siguientes pasos.",
  oferta_vinculante: "El banco emitió tu oferta vinculante.",
  en_coordinacion: "Coordinando notario y fecha de firma con el banco.",
  formalizado: "Crédito formalizado. Listo para escriturar.",
  rechazado: "El banco declinó la solicitud. Puedes elegir otro banco.",
  desistido: "Solicitud cancelada. Puedes elegir otro banco.",
  expirada: "Venció el plazo de respuesta del banco. Puedes elegir otro banco.",
};

/**
 * Confirma al cliente la forma de pago final que eligió (recursos propios o
 * crédito hipotecario con banco aliado) para que sepa que su selección quedó
 * registrada. No renderiza nada hasta que se haya elegido una forma de pago.
 */
const PaymentMethodBadge = ({ cuentaId, tipo, className = "" }: PaymentMethodBadgeProps) => {
  const esCredito = tipo === "CREDITO_HIPOTECARIO";
  const { data: solicitud } = useSolicitudCreditoVigente(esCredito ? cuentaId : null);
  const { data: convenios } = useBancosConvenio();

  if (!tipo) return null;

  if (tipo === "RECURSOS_PROPIOS") {
    return (
      <div className={`rounded-2xl border border-success/20 bg-success/5 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 text-success" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
              <p className="text-[11px] uppercase tracking-wider font-semibold text-success">Forma de pago final elegida</p>
            </div>
            <p className="text-sm font-semibold text-foreground mt-0.5">Recursos propios</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              Liquidarás el saldo restante con transferencia. Tu selección quedó registrada. Todo listo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // CREDITO_HIPOTECARIO
  const bancoNombre =
    solicitud != null
      ? convenios?.find((c) => c.id_banco === solicitud.id_banco)?.nombre ?? "tu banco"
      : "tu banco";
  const linea = solicitud ? ESTATUS_LINEA[solicitud.estatus] : "Selección registrada. Completa tu pre-calificación con el banco.";
  const cambiable = puedeCambiarBanco(solicitud);

  return (
    <div className={`rounded-2xl border border-primary/20 bg-primary/5 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Landmark className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <p className="text-[11px] uppercase tracking-wider font-semibold text-primary">Forma de pago final elegida</p>
          </div>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            Crédito hipotecario{solicitud ? ` · ${bancoNombre}` : ""}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 flex items-start gap-1">
            <Clock className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
            <span>{linea}</span>
          </p>
          {!cambiable && solicitud && (
            <p className="text-[10px] text-muted-foreground/80 mt-1">
              La selección es definitiva mientras el banco responde.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodBadge;
