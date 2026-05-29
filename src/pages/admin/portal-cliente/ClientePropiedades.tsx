import { useNavigate } from "react-router-dom";
import PropertyCard from "@/components/admin/portal-cliente/PropertyCard";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";

const ClientePropiedades = () => {
  const navigate = useNavigate();
  const { data: portfolio = [], isLoading } = usePortfolioCliente();

  if (isLoading) {
    return (
      <section className="px-5 md:px-0 pt-6 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 md:px-0 pt-6 pb-4">
      <h2 className="md:hidden font-semibold text-lg text-foreground mb-4">
        Mis propiedades
      </h2>
      {portfolio.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-[13px] text-muted-foreground">No tienes propiedades registradas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {portfolio.map((inv) => (
            <PropertyCard
              key={inv.property.id}
              investment={inv}
              onSelect={(id) => navigate(`/admin/portal-cliente/propiedad/${id}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default ClientePropiedades;
