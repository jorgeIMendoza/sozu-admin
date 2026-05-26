import { useState } from "react";
import {
  Clock,
  DollarSign,
  User,
  Receipt,
  Building2,
  Landmark,
  Upload,
  Send,
} from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Section, KV } from "./_shared";

export type EjecucionPagoExternoEntity = {
  folio: string;
  beneficiario_nombre: string;
  beneficiario_tipo: "Inmobiliaria" | "Broker" | "Aliado comercial" | "Agente externo";
  venta_ref: string;
  monto: number;
  clabe_destino: string;
  dias_desde_autorizacion: number;
};

export function EjecucionPagoExternoContent({
  entity,
  onClose,
}: {
  entity: EjecucionPagoExternoEntity;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [claveRastreo, setClaveRastreo] = useState("");
  const [fechaPago, setFechaPago] = useState(today);
  const [comprobante, setComprobante] = useState<string>("");

  const puedeConfirmar = !!claveRastreo.trim() && !!fechaPago;

  const handleConfirmar = () => {
    toast({
      title: "Pago a externo registrado",
      description:
        "Ejecución registrada en demo — pendiente de sincronización con base real.",
    });
    onClose();
  };

  return (
    <div className="space-y-6">
      <Section title="Datos del pago">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Receipt} label="Folio comisión" value={entity.folio} mono />
          <KV icon={User} label="Beneficiario" value={entity.beneficiario_nombre} />
          <KV
            icon={Building2}
            label="Tipo"
            value={<Badge variant="outline">{entity.beneficiario_tipo}</Badge>}
          />
          <KV icon={Receipt} label="Venta referenciada" value={entity.venta_ref} mono />
          <KV icon={DollarSign} label="Monto a pagar" value={fmtMxn(entity.monto)} />
          <KV icon={Landmark} label="CLABE destino" value={entity.clabe_destino} mono />
          <KV
            icon={Clock}
            label="Días desde autorización"
            value={`${entity.dias_desde_autorizacion} ${
              entity.dias_desde_autorizacion === 1 ? "día" : "días"
            }`}
          />
        </div>
      </Section>

      <Section title="Confirmar ejecución SPEI">
        <div className="space-y-3">
          <div>
            <Label htmlFor="clave-rastreo" className="text-xs">
              Clave de rastreo STP
            </Label>
            <Input
              id="clave-rastreo"
              value={claveRastreo}
              onChange={(e) => setClaveRastreo(e.target.value)}
              placeholder="Ej. 2026052500123456789"
              className="mt-1 font-mono text-sm"
            />
          </div>
          <div>
            <Label htmlFor="fecha-pago" className="text-xs">
              Fecha de pago
            </Label>
            <Input
              id="fecha-pago"
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="comprobante" className="text-xs">
              Comprobante (PDF)
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="comprobante"
                type="file"
                accept="application/pdf"
                onChange={(e) => setComprobante(e.target.files?.[0]?.name ?? "")}
                className="text-xs"
              />
              {comprobante && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                  <Upload className="inline h-3 w-3 mr-0.5" />
                  {comprobante}
                </span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!puedeConfirmar}
            onClick={handleConfirmar}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Confirmar ejecución
          </Button>
        </div>
      </Section>

      <div className="border-t pt-3 flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
