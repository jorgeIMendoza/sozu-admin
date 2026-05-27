import { useState } from "react";
import {
  Clock,
  DollarSign,
  Home,
  User,
  Receipt,
  FileOutput,
  Check,
  FileText,
  XCircle,
  Mail,
  Calendar,
} from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Section, KV } from "./_shared";

export type EstatusCobro = "Por Autorizar" | "Autorizado" | "Declinado";

export type EjecucionCobroEntity = {
  folio: string;
  propiedad: string;
  cliente: string;
  desarrollador_receptor: string;
  monto_factura: number;
  /** Estatus de autorización del cobro (BD: estatus_autorizacion_comision). */
  estatus: EstatusCobro;
  dias_desde_compra: number;
  /** URL del PDF de la factura SOZU timbrada — siempre presente en este flujo. */
  url_factura_pdf?: string | null;
  /** Solo poblados cuando estatus='Declinado'. */
  notas_rechazo?: string | null;
  fecha_autorizacion?: string | null;
  email_autoriza?: string | null;
};

const ESTATUS_TONE: Record<EstatusCobro, string> = {
  "Por Autorizar":
    "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300",
  Autorizado:
    "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300",
  Declinado:
    "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300",
};

export function EjecucionCobroContent({
  entity,
  onClose,
}: {
  entity: EjecucionCobroEntity;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [metodoCobro, setMetodoCobro] = useState<string>("");

  const esDeclinado = entity.estatus === "Declinado";
  const esAutorizado = entity.estatus === "Autorizado";

  const handleAction = (label: string) => {
    toast({
      title: label,
      description:
        "Ejecución registrada en demo — pendiente de sincronización con base real.",
    });
    onClose();
  };

  return (
    <div className="space-y-6">
      <Section title="Datos del cobro">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Receipt} label="Folio cuenta" value={entity.folio} mono />
          <KV icon={Home} label="Propiedad" value={entity.propiedad} />
          <KV icon={User} label="Cliente" value={entity.cliente} />
          <KV icon={User} label="Desarrollador receptor" value={entity.desarrollador_receptor} />
          <KV
            icon={DollarSign}
            label="Monto factura"
            value={fmtMxn(entity.monto_factura)}
          />
          <KV
            icon={Clock}
            label="Días desde venta"
            value={`${entity.dias_desde_compra} ${
              entity.dias_desde_compra === 1 ? "día" : "días"
            }`}
          />
        </div>
      </Section>

      <Section title="Estatus">
        <Badge variant="outline" className={ESTATUS_TONE[entity.estatus]}>
          {entity.estatus}
        </Badge>
        {entity.url_factura_pdf && (
          <Button
            size="sm"
            variant="outline"
            className="ml-3 h-8"
            onClick={() => window.open(entity.url_factura_pdf!, "_blank")}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Ver factura
          </Button>
        )}
      </Section>

      {esDeclinado && (
        <Section title="Motivo de rechazo">
          <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-900 dark:text-red-200 leading-relaxed">
                {entity.notas_rechazo?.trim() || "Sin nota de rechazo capturada por Dirección."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-red-200/60 dark:border-red-900/30">
              {entity.email_autoriza && (
                <KV icon={Mail} label="Rechazado por" value={entity.email_autoriza} />
              )}
              {entity.fecha_autorizacion && (
                <KV
                  icon={Calendar}
                  label="Fecha de rechazo"
                  value={new Date(entity.fecha_autorizacion).toLocaleString("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
              )}
            </div>
          </div>
        </Section>
      )}

      {esAutorizado && (
        <Section title="Registrar cobro al desarrollador">
          <div className="space-y-3">
            <div>
              <Label htmlFor="metodo-cobro" className="text-xs">
                Método de cobro
              </Label>
              <Select value={metodoCobro} onValueChange={setMetodoCobro}>
                <SelectTrigger id="metodo-cobro" className="mt-1">
                  <SelectValue placeholder="Selecciona un método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spei">SPEI</SelectItem>
                  <SelectItem value="transferencia">Transferencia interbancaria</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!metodoCobro}
              onClick={() => handleAction("Cobro registrado")}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Marcar como cobrada
            </Button>
          </div>
        </Section>
      )}

      {entity.estatus === "Por Autorizar" && (
        <Section title="Pendiente de Dirección">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Esta factura ya fue timbrada y está pendiente de autorización del Director en el
            Portal de Alta Dirección. Una vez autorizada podrás registrar aquí el cobro al
            desarrollador.
          </p>
        </Section>
      )}

      <div className="border-t pt-3 flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
