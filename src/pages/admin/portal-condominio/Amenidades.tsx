import { PageHeader, EstadoVista } from "./_helpers";
import { useCondominio } from "@/contexts/CondominioContext";
import { useCondominioDataset } from "@/hooks/condominio/useCondominioData";

export default function Amenidades() {
  const { proyectoId } = useCondominio();
  const { data, isLoading, error } = useCondominioDataset(proyectoId);
  const amenidades = data?.amenidades ?? [];

  return (
    <div>
      <PageHeader title="Amenidades" subtitle={`${amenidades.length} amenidades`} />

      {(isLoading || error) ? (
        <EstadoVista isLoading={isLoading} error={error} />
      ) : amenidades.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">Este condominio no tiene amenidades registradas.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {amenidades.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {a.url && (
                <div className="h-32 bg-muted flex items-center justify-center">
                  <img src={a.url} alt={a.nombre} className="h-full w-full object-cover" loading="lazy" />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold">{a.nombre}</h3>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        La gestión de reservas de amenidades aún no está habilitada para este condominio.
      </p>
    </div>
  );
}
