import { AlertCircle, HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { InvestmentProperty } from "@/lib/offers/mock-data";
import {
  type ResaleScenario,
  type ScenarioId,
  calculateEarnings,
} from "@/lib/offers/resale-data";
import { fmtMXN } from "@/lib/utils";

interface ResaleStepEarningsProps {
  property: InvestmentProperty;
  scenarios: ResaleScenario[];
  selectedScenarioId: ScenarioId;
  onSelectScenario: (id: ScenarioId) => void;
  onNext: () => void;
}

const ResaleStepEarnings = ({
  property,
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  onNext,
}: ResaleStepEarningsProps) => {
  const selected = scenarios.find((s) => s.id === selectedScenarioId)!;
  const earnings = calculateEarnings(property, selected);

  const stats = [
    { label: "Invertiste", value: fmtMXN(earnings.initialInvestment), tone: "text-foreground" },
    { label: "Plusvalía bruta", value: `+${earnings.grossAppreciationPct.toFixed(1)}%`, tone: "text-success" },
    { label: "Utilidad neta", value: `+${fmtMXN(earnings.netProfit)}`, tone: "text-success" },
    { label: "ROI neto comisión", value: `+${earnings.roiNet.toFixed(1)}%`, tone: "text-success" },
  ];

  return (
    <div className="animate-fade-in pb-6">
      {/* Header */}
      <div className="px-5 pt-4">
        <h2 className="font-display font-bold text-xl text-foreground">
          Lo que recibirías
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Después de comisión SOZU e IVA.
        </p>
      </div>

      {/* Scenario chips */}
      <div className="flex gap-2 mt-4 px-5 overflow-x-auto">
        {scenarios.map((s) => {
          const active = s.id === selectedScenarioId;
          return (
            <button
              key={s.id}
              onClick={() => onSelectScenario(s.id)}
              className={`h-9 px-4 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Net amount anchor */}
      <div className="rounded-2xl bg-success/10 border border-success/20 mx-5 mt-5 p-6 text-center">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-success mb-2">
          RECIBIRÍAS EN TU CUENTA
        </p>
        <p className="font-display font-bold text-5xl tabular-nums text-foreground leading-none">
          {fmtMXN(selected.netToClient)}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Antes de impuestos sobre la ganancia.
        </p>
      </div>

      {/* Breakdown */}
      <div className="rounded-xl border border-border bg-card p-4 mx-5 mt-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-3">
          Desglose
        </p>
        <div className="space-y-1">
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-foreground">Precio de venta</span>
            <span className="tabular-nums text-foreground">{fmtMXN(selected.totalPrice)}</span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-foreground">− Comisión SOZU 5%</span>
            <span className="tabular-nums text-destructive">−{fmtMXN(selected.commission)}</span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-foreground">− IVA 16% sobre comisión</span>
            <span className="tabular-nums text-destructive">−{fmtMXN(selected.ivaOnCommission)}</span>
          </div>
        </div>
        <div className="mt-2 pt-3 border-t border-border/60 flex justify-between font-semibold text-sm">
          <span className="text-foreground">Monto neto</span>
          <span className="tabular-nums text-success">{fmtMXN(selected.netToClient)}</span>
        </div>
      </div>

      {/* Performance */}
      <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 mx-5 mt-3">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-primary mb-3">
          Tu rendimiento
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              <p className={`font-display font-semibold text-lg tabular-nums mt-0.5 ${s.tone}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
        <div className="pt-3 mt-3 border-t border-primary/15 flex justify-between items-baseline">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            TIR anualizada
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" aria-label="Qué es la TIR">
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-xs leading-relaxed">
                <strong className="font-semibold">TIR</strong> = Tasa Interna de
                Retorno. Es el rendimiento anualizado equivalente de tu
                inversión, considerando el tiempo que mantuviste la propiedad.
              </PopoverContent>
            </Popover>
          </div>
          <span className="font-display font-bold text-2xl tabular-nums text-primary">
            ~{earnings.irr.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* ISR card */}
      <div className="rounded-xl border border-warning/20 bg-warning/[0.05] p-4 mx-5 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-warning" />
          <span className="text-[10px] uppercase tracking-widest font-semibold text-warning">
            ISR estimado
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-foreground">Retenido por el notario</span>
          <span className="font-semibold text-sm tabular-nums text-foreground">
            ~{fmtMXN(selected.estimatedISRRange.min)} a {fmtMXN(selected.estimatedISRRange.max)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
          El monto neto mostrado es estimado y se calcula{" "}
          <strong className="font-semibold">antes de impuestos sobre la ganancia</strong>{" "}
          (ISR e impuesto local del 5% conforme al art. 127 LISR). El cálculo
          definitivo lo realiza el notario público al momento de la escritura
          de compraventa.
        </p>
      </div>

      {/* CTA */}
      <div className="px-5 pt-4">
        <button
          onClick={onNext}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors active:scale-[0.98]"
        >
          Generar contrato
        </button>
        <p className="text-[11px] text-muted-foreground text-center mt-3">
          Comisión 5% + IVA. Solo se cobra si se concreta la venta.
        </p>
      </div>
    </div>
  );
};

export default ResaleStepEarnings;
