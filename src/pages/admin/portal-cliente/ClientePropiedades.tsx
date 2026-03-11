import { ChevronRight, TrendingUp, Home, Loader2, Calendar, AlertTriangle } from "lucide-react";
import { fmtMXN as fmt } from "@/lib/clienteMockData";
import { useClienteResumenFinanciero, type PropertyFinancialSummary } from "@/hooks/useClienteResumenFinanciero";
import { useAuth } from "@/contexts/AuthContext";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";
import { useNavigate } from "react-router-dom";

const ClientePropiedades = () => {
  const { profile } = useAuth();
  const { impersonatedClientePersonaId, isImpersonating } = useClienteImpersonation();
  const effectivePersonaId = isImpersonating ? impersonatedClientePersonaId : profile?.id_persona;
  const { data: resumen, isLoading } = useClienteResumenFinanciero(effectivePersonaId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const properties = resumen?.properties || [];

  return (
    <div className="max-w-lg mx-auto lg:max-w-none">
      <section className="px-5 pt-6 pb-4 lg:px-0">
        <h2 className="font-bold text-lg text-foreground mb-4">Mis propiedades</h2>
        {properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tienes propiedades registradas.</p>
        ) : (
          <div className="space-y-3">
            {properties.map((prop) => (
              <PropertyCard key={prop.cuentaId} property={prop} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

function PropertyCard({ property }: { property: PropertyFinancialSummary }) {
  const navigate = useNavigate();
  const progress = property.precioFinal > 0 ? Math.min(100, (property.totalPaid / property.precioFinal) * 100) : 0;

  const statusBadge = (() => {
    switch (property.estatusPropiedad) {
      case 7: return { label: "Escrituración", color: "bg-purple-500/15 text-purple-600" };
      case 8: return { label: "Entregada", color: "bg-[hsl(var(--inmob-green))]/20 text-[hsl(var(--inmob-green))]" };
      case 9: return { label: "Pagada", color: "bg-[hsl(var(--inmob-green))]/20 text-[hsl(var(--inmob-green))]" };
      case 5: return { label: "Vendido", color: "bg-amber-500/15 text-amber-600" };
      default: return null;
    }
  })();

  const maintenanceOverdue = property.mantenimientosAtrasados > 0;

  return (
    <div
      onClick={() => navigate(`/admin/portal-cliente/propiedad/${property.cuentaId}`)}
      className="w-full text-left rounded-2xl overflow-hidden bg-card shadow-[0_2px_16px_-4px_hsl(var(--foreground)/0.08)] border border-border cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden">
        {property.imageUrl ? (
          <img src={property.imageUrl} alt={property.proyecto} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
            <Home className="w-10 h-10 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
        {statusBadge && (
          <div className="absolute top-3 right-3">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-bold text-base text-white leading-tight">{property.proyecto}</h3>
          <p className="text-white/70 text-xs mt-0.5">Unidad {property.unidad} · {property.direccion || property.edificio}</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground">Valor del activo</p>
            <p className="font-bold text-lg text-foreground tabular-nums">{fmt(property.valorEstimado)}</p>
          </div>
          {property.appreciationPercent !== 0 && (
            <div className="flex items-center gap-1 text-[hsl(var(--inmob-green))]">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs font-semibold tabular-nums">+{property.appreciationPercent.toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div>
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[hsl(var(--inmob-green))]" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-[11px]">
            <span className="text-muted-foreground">Pagado <span className="font-semibold text-foreground tabular-nums">{fmt(property.totalPaid)}</span></span>
            <span className="text-muted-foreground">Pendiente <span className="font-semibold text-foreground tabular-nums">{fmt(property.pending)}</span></span>
          </div>
        </div>
        {maintenanceOverdue && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-semibold">{property.mantenimientosAtrasados} cuota{property.mantenimientosAtrasados > 1 ? "s" : ""} atrasada{property.mantenimientosAtrasados > 1 ? "s" : ""}</span>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs font-medium text-[hsl(var(--inmob-green))] flex items-center gap-1">
            Ver detalle
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

export default ClientePropiedades;
