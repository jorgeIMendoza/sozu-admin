import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";
import { getPortfolioTotals } from "@/lib/portal-cliente/mock-data";
import WelcomeSection from "@/components/admin/portal-cliente/WelcomeSection";
import HeroFinancialSummary from "@/components/admin/portal-cliente/HeroFinancialSummary";
import ActivitySection from "@/components/admin/portal-cliente/ActivitySection";
import QuickActionsGrid from "@/components/admin/portal-cliente/QuickActionsGrid";
import CompactFinancialSummary from "@/components/admin/portal-cliente/CompactFinancialSummary";
import PendingsByProperty from "@/components/admin/portal-cliente/PendingsByProperty";
import PropertyCard from "@/components/admin/portal-cliente/PropertyCard";

function EmptyPortfolio() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
        <Building2 className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-[15px] font-semibold text-foreground mb-1">
        Aún no tienes propiedades
      </h3>
      <p className="text-[13px] text-muted-foreground max-w-xs">
        Cuando adquieras una propiedad con SOZU aparecerá aquí con toda su información.
      </p>
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="px-4 pt-3 md:px-0 md:pt-6 space-y-4 animate-pulse">
      <div className="h-14 w-56 rounded-lg bg-muted" />
      <div className="h-48 rounded-2xl bg-muted" />
      <div className="h-32 rounded-xl bg-muted" />
      <div className="h-32 rounded-xl bg-muted" />
    </div>
  );
}

const ClienteInicio = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isImpersonating, impersonatedClienteName } = useClienteImpersonation();

  const { data: portfolio, isLoading } = usePortfolioCliente();

  const effectiveName = isImpersonating
    ? (impersonatedClienteName ?? "Cliente")
    : (profile?.nombre ?? "Usuario");

  const safePortfolio = portfolio ?? [];
  const totals = getPortfolioTotals(safePortfolio);

  const handleSelectProperty = (id: string) =>
    navigate(`/admin/portal-cliente/propiedad/${id}`);

  const handleQuickAction = (action: string) => {
    if (action === "property") navigate("/admin/portal-cliente/en-adquisicion");
    else if (action === "balance") navigate("/admin/portal-cliente/estado-de-cuenta");
    else if (action === "payments") navigate("/admin/portal-cliente/pagos");
    else if (action === "documents") navigate("/admin/portal-cliente/documentos");
  };

  if (isLoading) return <PortfolioSkeleton />;

  // ── 1. Saludo (siempre arriba) ──────────────────────────────────────────
  const greeting = (
    <WelcomeSection name={effectiveName} activeProperties={safePortfolio.length} />
  );

  if (!safePortfolio.length) {
    return (
      <div className="px-4 pt-3 md:px-0 md:pt-6">
        {greeting}
        <EmptyPortfolio />
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 md:px-0 md:pt-6">

      {/* 1. Saludo — siempre visible */}
      {greeting}

      {/* 2. Resumen financiero */}
      <div className="hidden md:block">
        <HeroFinancialSummary portfolio={safePortfolio} />
      </div>
      <div className="md:hidden">
        <CompactFinancialSummary
          totalInvested={totals.totalInvested}
          totalPaid={totals.totalPaid}
          totalPending={totals.totalPending}
          appreciationPercent={totals.appreciationPercent}
        />
      </div>

      {/* 3. Accesos rápidos — mobile: inline aquí; desktop: sidebar derecho */}
      <div className="md:hidden">
        <QuickActionsGrid onAction={handleQuickAction} />
      </div>

      {/* Grid desktop (2 col) / mobile lineal */}
      <div className="md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-6 md:mt-4">

        {/* Columna principal */}
        <div className="xl:col-span-2 space-y-2">

          {/* 4. Tu actividad */}
          <ActivitySection portfolio={safePortfolio} onPayNow={handleSelectProperty} />

          {/* 5. Pendientes por propiedad — mobile: aquí; desktop: sidebar */}
          <div className="md:hidden">
            <PendingsByProperty portfolio={safePortfolio} onSelect={handleSelectProperty} />
          </div>

          {/* 6. Mis propiedades */}
          <section
            className="px-5 md:px-0 py-4 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <h2 className="font-semibold text-[15px] text-foreground mb-3">
              Mis propiedades
            </h2>
            <div className="space-y-3 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
              {safePortfolio.slice(0, 3).map((inv) => (
                <PropertyCard
                  key={inv.property.id}
                  investment={inv}
                  onSelect={handleSelectProperty}
                />
              ))}
            </div>
            {safePortfolio.length > 3 && (
              <button
                data-cta="cliente.inicio.ver-en-adquisicion"
                onClick={() => navigate("/admin/portal-cliente/en-adquisicion")}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-medium text-primary hover:bg-primary/5 transition-colors border border-dashed border-primary/30"
              >
                Ver todas ({safePortfolio.length} propiedades)
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </section>
        </div>

        {/* Sidebar derecho — solo desktop */}
        <aside className="hidden md:block md:sticky md:top-28 md:self-start space-y-2">
          <QuickActionsGrid onAction={handleQuickAction} />
          <PendingsByProperty portfolio={safePortfolio} onSelect={handleSelectProperty} />
        </aside>

      </div>
    </div>
  );
};

export default ClienteInicio;
