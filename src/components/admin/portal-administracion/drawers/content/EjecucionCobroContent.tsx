import { useState } from "react";
import {
  Clock,
  DollarSign,
  Home,
  User,
  Receipt,
  FileOutput,
  Check,
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

export type EjecucionCobroEntity = {
  folio: string;
  propiedad: string;
  cliente: string;
  desarrollador_receptor: string;
  monto_factura: number;
  estado_actual: "Por emitir" | "Emitida, esperando cobro" | "Vencida";
  dias_desde_autorizacion: number;
  /** Si la factura ya está timbrada, se muestra el folio CFDI/UUID actual. */
  folio_cfdi_actual?: string;
};

const ESTADO_TONE: Record<EjecucionCobroEntity["estado_actual"], string> = {
  "Por emitir":
    "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300",
  "Emitida, esperando cobro":
    "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300",
  Vencida:
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
  const [folioCfdi, setFolioCfdi] = useState(entity.folio_cfdi_actual ?? "");
  const [metodoCobro, setMetodoCobro] = useState<string>("");

  const necesitaEmitir = entity.estado_actual === "Por emitir";

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
            label="Días desde autorización"
            value={`${entity.dias_desde_autorizacion} ${
              entity.dias_desde_autorizacion === 1 ? "día" : "días"
            }`}
          />
        </div>
      </Section>

      <Section title="Estado actual">
        <Badge variant="outline" className={ESTADO_TONE[entity.estado_actual]}>
          {entity.estado_actual}
        </Badge>
        {entity.folio_cfdi_actual && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            CFDI vigente: {entity.folio_cfdi_actual}
          </p>
        )}
      </Section>

      {necesitaEmitir && (
        <Section title="Emitir CFDI">
          <div className="space-y-3">
            <div>
              <Label htmlFor="folio-cfdi" className="text-xs">
                Folio CFDI / UUID SAT
              </Label>
              <Input
                id="folio-cfdi"
                value={folioCfdi}
                onChange={(e) => setFolioCfdi(e.target.value)}
                placeholder="Ej. A1B2C3D4-…"
                className="mt-1 font-mono text-sm"
              />
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!folioCfdi.trim()}
              onClick={() => handleAction("Factura marcada como emitida")}
            >
              <FileOutput className="h-3.5 w-3.5 mr-1.5" />
              Marcar como emitida
            </Button>
          </div>
        </Section>
      )}

      <Section title="Registrar cobro">
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
            disabled={!metodoCobro || (necesitaEmitir && !folioCfdi.trim())}
            onClick={() => handleAction("Factura marcada como cobrada")}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Marcar como cobrada
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
