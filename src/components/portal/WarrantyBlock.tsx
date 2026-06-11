import { useState } from "react";
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Scale,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useWarrantyForProperty,
  computeWarrantyDates,
  getWarrantyStatusInfo,
} from "@/lib/offers/post-delivery-data";

interface Props {
  propertyId: string;
}

const WarrantyBlock = ({ propertyId }: Props) => {
  const warranty = useWarrantyForProperty(propertyId);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (!warranty) return null;

  const { status, expirationDate, monthsRemaining, daysRemaining } =
    computeWarrantyDates(warranty);
  const info = getWarrantyStatusInfo(status);

  const remainingLabel = (() => {
    if (status === "expirada") return "Expirada";
    if (daysRemaining < 30) {
      const d = Math.ceil(daysRemaining);
      return `Expira en ${d} día${d === 1 ? "" : "s"}`;
    }
    if (monthsRemaining < 1) return `Expira en ${Math.ceil(daysRemaining)} días`;
    const m = Math.floor(monthsRemaining);
    return `${m} mes${m === 1 ? "" : "es"} restantes`;
  })();

  const handleReportIncident = () => {
    navigate(`/propiedades/${warranty.propertyId}?incidentNew=1&warrantyClaim=1`);
  };

  return (
    <div className="px-4 mt-6 animate-fade-in">
      <div className="rounded-2xl border border-border bg-card p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground">Garantía</p>
              <p className="text-xs text-muted-foreground truncate">
                {warranty.shortDescription} · {remainingLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[11px] font-semibold px-2 py-1 rounded-full ${info.className}`}
            >
              {info.label}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {/* Periodo */}
            <div className="rounded-xl bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Inicio
                  </p>
                  <p className="text-sm font-medium text-foreground mt-1 tabular-nums">
                    {new Date(warranty.startDate).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Expira
                  </p>
                  <p className="text-sm font-medium text-foreground mt-1 tabular-nums">
                    {expirationDate.toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              {status === "proxima_expiracion" && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 p-2">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning-foreground">
                    Te recomendamos revisar tu propiedad y reportar cualquier defecto
                    antes de que expire.
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {warranty.description}
            </p>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                ¿Qué cubre?
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                {warranty.coverageIntro}
              </p>
              <div className="space-y-3">
                {warranty.coverageSections.map((section, idx) => (
                  <div key={idx}>
                    <p className="text-[11px] uppercase tracking-wider text-success font-semibold mb-1.5">
                      {section.category}
                    </p>
                    <ul className="space-y-1.5">
                      {section.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0 mt-2" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                ¿Qué NO cubre?
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                {warranty.exclusionsIntro}
              </p>
              <ul className="space-y-1.5">
                {warranty.exclusions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0 mt-2" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-muted/30 p-3">
              <Scale className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Esta garantía se otorga conforme a lo establecido en el contrato de
                compraventa y en el {warranty.legalReference}.
              </p>
            </div>

            {status !== "expirada" && (
              <button
                onClick={handleReportIncident}
                className="w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-3 hover:bg-primary/90 transition-colors"
              >
                Reportar defecto cubierto
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WarrantyBlock;
