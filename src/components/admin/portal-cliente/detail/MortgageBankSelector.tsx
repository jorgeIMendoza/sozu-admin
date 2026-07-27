import { Building2, ChevronRight, Sparkles, ShieldCheck, Loader2 } from "lucide-react";
import type { MortgageChoice } from "@/lib/portal-cliente/mortgage-data";
import { useBancosConvenio } from "@/hooks/usePortalBancos/useBancosConvenio";

interface MortgageBankSelectorProps {
  onConfirm: (choice: MortgageChoice) => void;
  onBack: () => void;
}

// Siglas de respaldo si el nombre no calza en el badge
const shortLabel = (nombre: string) =>
  nombre.replace(/\s*(México|Banco)\s*/gi, "").trim().slice(0, 4).toUpperCase();

const MortgageBankSelector = ({ onConfirm, onBack }: MortgageBankSelectorProps) => {
  const { data: convenios, isLoading } = useBancosConvenio();
  const banks = (convenios ?? []).filter((c) => c.activo);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
          Bancos aliados con SOZU
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Cargando bancos…</span>
        </div>
      ) : banks.length === 0 ? (
        <div className="rounded-xl border border-border p-6 text-center">
          <p className="text-xs text-muted-foreground">
            No hay bancos con convenio disponibles por ahora.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {banks.map((bank) => (
            <button
              key={bank.id}
              type="button"
              onClick={() =>
                onConfirm({
                  type: "preferred",
                  bank: {
                    idBanco: bank.id_banco,
                    nombre: bank.nombre,
                    rates: {
                      tasaMin: bank.tasa_min,
                      tasaMax: bank.tasa_max,
                      catMin: bank.cat_min,
                      catMax: bank.cat_max,
                    },
                  },
                })
              }
              className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px] tracking-tight"
                  style={bank.color_marca ? { backgroundColor: bank.color_marca } : undefined}
                >
                  {bank.color_marca ? shortLabel(bank.nombre) : <Building2 className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display font-semibold text-sm text-foreground truncate">
                      {bank.nombre}
                    </p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  {bank.producto_nombre && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {bank.producto_nombre}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      Aliado SOZU
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-5 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Cambiar método de pago
      </button>
    </div>
  );
};

export default MortgageBankSelector;
