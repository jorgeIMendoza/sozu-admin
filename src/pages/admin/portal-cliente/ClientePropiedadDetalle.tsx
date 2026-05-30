import { useParams } from "react-router-dom";
import { getPropertyCategory } from "@/lib/portal-cliente/mock-data";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";
import PropertyAcquisitionDetail from "@/components/admin/portal-cliente/investor/PropertyAcquisitionDetail";
import PropertyPatrimonyDetail from "@/components/admin/portal-cliente/investor/PropertyPatrimonyDetail";

const ClientePropiedadDetalle = () => {
  const { cuentaId } = useParams<{ cuentaId: string }>();

  const { data: portfolio = [], isLoading } = usePortfolioCliente();
  const investment = portfolio.find((p) => p.property.id === cuentaId);

  if (isLoading) {
    return (
      <section className="px-5 md:px-0 pt-4 pb-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-64 bg-muted rounded-2xl" />
          <div className="h-32 bg-muted rounded-2xl" />
        </div>
      </section>
    );
  }

  if (!investment) {
    return (
      <section className="px-5 md:px-0 pt-4 pb-6">
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-[13px] text-muted-foreground">Propiedad no encontrada.</p>
        </div>
      </section>
    );
  }

  const category = getPropertyCategory(investment);

  return (
    <section className="px-5 md:px-0 pt-4 pb-6">
      {category === "in_acquisition" ? (
        <PropertyAcquisitionDetail investment={investment} />
      ) : category === "active_patrimony" ? (
        <PropertyPatrimonyDetail investment={investment} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-[13px] text-muted-foreground">
            Esta propiedad está archivada.
          </p>
        </div>
      )}
    </section>
  );
};

export default ClientePropiedadDetalle;
