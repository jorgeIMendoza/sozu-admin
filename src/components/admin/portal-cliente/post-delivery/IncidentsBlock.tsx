import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Plus, ChevronRight, ShieldCheck } from "lucide-react";
import {
  useIncidentsForCuenta,
  getIncidentStatusInfo,
  getIncidentCategoryLabel,
  type Incident,
} from "@/lib/portal-cliente/post-delivery-data";
import IncidentDetailSheet from "./IncidentDetailSheet";
import NewIncidentSheet from "./NewIncidentSheet";

interface Props {
  cuentaId: string;
}

const IncidentsBlock = ({ cuentaId }: Props) => {
  const { data: incidents = [], isLoading } = useIncidentsForCuenta(cuentaId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [prefilledWarrantyClaim, setPrefilledWarrantyClaim] = useState(false);

  useEffect(() => {
    if (searchParams.get("incidentNew") === "1") {
      const claim = searchParams.get("warrantyClaim") === "1";
      setPrefilledWarrantyClaim(claim);
      setNewOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("incidentNew");
      next.delete("warrantyClaim");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const activeIncidents = incidents.filter((i) => i.status !== "cerrado");
  const closedCount = incidents.length - activeIncidents.length;

  const subtitle = isLoading
    ? "Cargando…"
    : activeIncidents.length > 0
      ? `${activeIncidents.length} activa${activeIncidents.length === 1 ? "" : "s"}${closedCount > 0 ? ` · ${closedCount} cerrada${closedCount === 1 ? "" : "s"}` : ""}`
      : closedCount > 0
        ? `${closedCount} cerrada${closedCount === 1 ? "" : "s"}`
        : "Sin incidencias reportadas";

  const handleOpenNew = () => {
    setPrefilledWarrantyClaim(false);
    setNewOpen(true);
  };

  return (
    <div className="px-4 mt-4 animate-fade-in">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-warning" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Incidencias</p>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          </div>
        </div>

        <button
          onClick={handleOpenNew}
          className="w-full mb-3 rounded-xl bg-foreground text-background text-sm font-semibold py-3 hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Reportar nueva incidencia
        </button>

        {incidents.length > 0 && (
          <div className="space-y-2">
            {incidents.map((inc) => {
              const statusInfo = getIncidentStatusInfo(inc.status);
              return (
                <button
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className="w-full text-left rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {inc.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {getIncidentCategoryLabel(inc.category)}
                        {inc.warrantyClaimed && " · Bajo garantía"}
                        {" · "}
                        {new Date(inc.lastUpdatedAt).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {inc.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-semibold px-2 py-1 rounded-full ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  {inc.warrantyClaimed && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-success">
                      <ShieldCheck className="w-3 h-3" />
                      Reclamo bajo garantía
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <IncidentDetailSheet
        cuentaId={cuentaId}
        incident={selectedIncident}
        open={!!selectedIncident}
        onClose={() => setSelectedIncident(null)}
      />
      <NewIncidentSheet
        cuentaId={cuentaId}
        prefilledWarrantyClaim={prefilledWarrantyClaim}
        open={newOpen}
        onClose={() => setNewOpen(false)}
      />
    </div>
  );
};

export default IncidentsBlock;
