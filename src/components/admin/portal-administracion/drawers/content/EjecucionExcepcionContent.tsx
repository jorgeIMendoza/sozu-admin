import {
  Calendar,
  DollarSign,
  User,
  Receipt,
  Tag,
  AlertTriangle,
  Check,
} from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Section, KV } from "./_shared";

export type EjecucionExcepcionEntity = {
  folio: string;
  tipo: "Descuento" | "Parcial fuera de esquema" | "Ajuste manual" | "Otro";
  venta_concepto_afectado: string;
  delta: number;
  aprobada_por: string;
  fecha_aprobacion: string;
  decision_texto: string;
};

const TIPO_TONE: Record<EjecucionExcepcionEntity["tipo"], string> = {
  Descuento:
    "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300",
  "Parcial fuera de esquema":
    "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300",
  "Ajuste manual":
    "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300",
  Otro: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/40 dark:text-slate-300",
};

export function EjecucionExcepcionContent({
  entity,
  onClose,
}: {
  entity: EjecucionExcepcionEntity;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const deltaPositivo = entity.delta >= 0;

  const handleConfirmar = () => {
    toast({
      title: "Excepción aplicada en sistema",
      description:
        "Ejecución registrada en demo — pendiente de sincronización con base real.",
    });
    onClose();
  };

  return (
    <div className="space-y-6">
      <Section title="Datos de la excepción">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Receipt} label="Folio excepción" value={entity.folio} mono />
          <KV
            icon={Tag}
            label="Tipo"
            value={<Badge variant="outline" className={TIPO_TONE[entity.tipo]}>{entity.tipo}</Badge>}
          />
          <KV
            icon={AlertTriangle}
            label="Venta / concepto afectado"
            value={entity.venta_concepto_afectado}
          />
          <KV
            icon={DollarSign}
            label="Delta monetario"
            value={
              <span className={deltaPositivo ? "text-emerald-700" : "text-red-700"}>
                {deltaPositivo ? "+" : ""}
                {fmtMxn(entity.delta)}
              </span>
            }
          />
          <KV icon={User} label="Aprobada por" value={entity.aprobada_por} />
          <KV icon={Calendar} label="Fecha aprobación" value={entity.fecha_aprobacion} />
        </div>
      </Section>

      <Section title="Decisión de Dirección">
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
            {entity.decision_texto}
          </p>
        </div>
      </Section>

      <Section title="Aplicar en sistema">
        <p className="text-xs text-muted-foreground mb-3">
          Al confirmar, el ajuste se registrará en la cuenta de cobranza correspondiente.
          En demo esta acción no muta el estado para facilitar pruebas repetidas.
        </p>
        <Button size="sm" className="w-full" onClick={handleConfirmar}>
          <Check className="h-3.5 w-3.5 mr-1.5" />
          Confirmar aplicación
        </Button>
      </Section>

      <div className="border-t pt-3 flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
