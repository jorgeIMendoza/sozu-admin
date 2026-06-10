import { useState, useEffect } from "react";
import { ShieldCheck, ChevronRight, CheckCircle2, Loader2, PenTool } from "lucide-react";
import type { InvestmentProperty } from "@/lib/offers/mock-data";
import {
  simulateClientSignature,
  useResaleProcess,
  type ResaleScenario,
} from "@/lib/offers/resale-data";

interface ResaleStepSignatureProps {
  property: InvestmentProperty;
  scenario: ResaleScenario;
  onComplete: () => void;
}

const ResaleStepSignature = ({ property, onComplete }: ResaleStepSignatureProps) => {
  const [method, setMethod] = useState<"efirma" | "biometric" | null>(null);
  const process = useResaleProcess(property.property.id);
  const status = process?.status ?? "contract_accepted";

  const handleSelectMethod = (m: "efirma" | "biometric") => {
    setMethod(m);
    // SWAP POINT MIFIEL: en producción aquí se invoca el widget real:
    // window.mifiel.widget({ widgetId, appendTo: "mifiel-container", onSuccess: () => onComplete() })
    simulateClientSignature(property.property.id);
  };

  useEffect(() => {
    if (status === "completed") {
      const t = setTimeout(() => onComplete(), 1000);
      return () => clearTimeout(t);
    }
  }, [status, onComplete]);

  const showOptions = !method && (status === "contract_accepted" || status === "not_started");
  const showSigning = status === "client_signing";
  const showInProgress = status === "client_signed" || status === "sozu_signing";
  const showCompleted = status === "completed";

  return (
    <div className="animate-fade-in pb-6">
      {/* Header */}
      <div className="px-5 pt-6 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center mb-4">
          <PenTool className="w-7 h-7 text-primary" />
        </div>
        <h2 className="font-display font-bold text-xl text-foreground">
          Firma del contrato
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {property.property.projectName} {property.property.unitNumber}
        </p>
      </div>

      {/* Widget mock */}
      <div className="rounded-2xl border border-border bg-card mx-5 mt-5 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="bg-foreground text-background px-2 py-1 rounded text-[10px] font-bold tracking-wider">
              MIFIEL
            </span>
            <span className="text-[10px] text-muted-foreground">Powered by MIFIEL</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-success font-semibold">
            <ShieldCheck className="w-3 h-3" />
            NOM-151 · Validez legal
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* SWAP POINT MIFIEL: este bloque se reemplaza por <div id="mifiel-container" />
             donde se monta el iframe real del widget. */}

          {showOptions && (
            <>
              <p className="text-sm text-foreground leading-relaxed">
                Tu contrato está listo para firmarse. Elige el método de firma electrónica que prefieras.
              </p>
              <button
                onClick={() => handleSelectMethod("efirma")}
                className="w-full rounded-xl border border-border p-4 hover:border-primary/40 transition-colors text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">
                    Con tu e.firma del SAT
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Equivalente legal a firma autógrafa. Necesitas tu archivo .key y .cer.
                </p>
              </button>
              <button
                onClick={() => handleSelectMethod("biometric")}
                className="w-full rounded-xl border border-primary/30 bg-primary/[0.03] p-4 text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                    Firma biométrica
                    <span className="text-[9px] uppercase font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                      Recomendado
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-primary" />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Selfie + INE. No necesitas e.firma.
                </p>
              </button>
            </>
          )}

          {showSigning && (
            <div className="flex flex-col items-center text-center py-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-sm text-foreground font-medium">Procesando tu firma...</p>
              <p className="text-[11px] text-muted-foreground mt-1">No cierres esta pantalla.</p>
            </div>
          )}

          {showInProgress && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 py-2 text-sm">
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                <span className="text-foreground">Cliente firmó</span>
              </div>
              <div className="flex items-center gap-3 py-2 text-sm">
                <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                <span className="text-muted-foreground">SOZU firmando...</span>
              </div>
            </div>
          )}

          {showCompleted && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 py-2 text-sm">
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                <span className="text-foreground">Cliente firmó</span>
              </div>
              <div className="flex items-center gap-3 py-2 text-sm">
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                <span className="text-foreground">SOZU firmó</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="px-5 mt-4 mb-6 text-[11px] text-muted-foreground text-center leading-relaxed">
        La firma electrónica avanzada vía MIFIEL tiene la misma validez jurídica que la firma autógrafa, conforme al Código de Comercio (Art. 89 y 97).
      </p>
    </div>
  );
};

export default ResaleStepSignature;
