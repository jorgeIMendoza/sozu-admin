import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PropertyTechnicalSheet from "@/components/admin/portal-cliente/investor/PropertyTechnicalSheet";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";

const ClienteDetallesTecnicos = () => {
  const { cuentaId } = useParams<{ cuentaId: string }>();
  const navigate = useNavigate();

  const { data: portfolio = [], isLoading } = usePortfolioCliente();
  const investment = portfolio.find((p) => p.property.id === cuentaId) ?? portfolio[0];

  if (isLoading) {
    return (
      <section className="px-5 md:px-0 pt-4 pb-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-64 bg-muted rounded-2xl" />
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

  return (
    <section className="px-5 md:px-0 pt-4 pb-6">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al detalle
        </button>
      </div>
      <PropertyTechnicalSheet property={investment.property} />
    </section>
  );
};

export default ClienteDetallesTecnicos;
