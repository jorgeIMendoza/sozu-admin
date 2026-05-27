import { useState } from "react";
import {
  Clock,
  DollarSign,
  User,
  Receipt,
  Briefcase,
  Send,
} from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Section, KV } from "./_shared";

export type EjecucionDispersionEntity = {
  folio: string;
  comisionista_nombre: string;
  comisionista_rol: string;
  venta_ref: string;
  monto: number;
  metodo_inicial: "STP" | "Nómina";
  dias_desde_autorizacion: number;
};

export function EjecucionDispersionContent({
  entity,
  onClose,
}: {
  entity: EjecucionDispersionEntity;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [metodo, setMetodo] = useState<"STP" | "Nómina">(entity.metodo_inicial);
  const [claveRastreo, setClaveRastreo] = useState("");

  const requiereClave = metodo === "STP";
  const puedeConfirmar = !requiereClave || !!claveRastreo.trim();

  const handleConfirmar = () => {
    toast({
      title: `Dispersión registrada vía ${metodo}`,
      description:
        "Ejecución registrada en demo — pendiente de sincronización con base real.",
    });
    onClose();
  };

  return (
    <div className="space-y-6">
      <Section title="Datos de la dispersión">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Receipt} label="Folio comisión" value={entity.folio} mono />
          <KV icon={User} label="Comisionista" value={entity.comisionista_nombre} />
          <KV icon={Briefcase} label="Rol" value={entity.comisionista_rol} />
          <KV icon={Receipt} label="Venta referenciada" value={entity.venta_ref} mono />
          <KV icon={DollarSign} label="Monto a dispersar" value={fmtMxn(entity.monto)} />
          <KV
            icon={Clock}
            label="Días desde autorización"
            value={`${entity.dias_desde_autorizacion} ${
              entity.dias_desde_autorizacion === 1 ? "día" : "días"
            }`}
          />
        </div>
      </Section>

      <Section title="Confirmar dispersión">
        <div className="space-y-3">
          <div>
            <Label htmlFor="metodo-dispersion" className="text-xs">
              Método de dispersión
            </Label>
            <Select value={metodo} onValueChange={(v) => setMetodo(v as "STP" | "Nómina")}>
              <SelectTrigger id="metodo-dispersion" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STP">STP (SPEI inmediato)</SelectItem>
                <SelectItem value="Nómina">Nómina (siguiente corte)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {requiereClave && (
            <div>
              <Label htmlFor="clave-rastreo-disp" className="text-xs">
                Clave de rastreo STP
              </Label>
              <Input
                id="clave-rastreo-disp"
                value={claveRastreo}
                onChange={(e) => setClaveRastreo(e.target.value)}
                placeholder="Ej. 2026052500987654321"
                className="mt-1 font-mono text-sm"
              />
            </div>
          )}
          <Button
            size="sm"
            className="w-full"
            disabled={!puedeConfirmar}
            onClick={handleConfirmar}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Confirmar dispersión
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
