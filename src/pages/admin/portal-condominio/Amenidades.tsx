import { useState } from "react";
import { PageHeader, EstadoVista } from "./_helpers";
import { useCondominio } from "@/contexts/CondominioContext";
import { useCondominioDataset } from "@/hooks/condominio/useCondominioData";
import { cn } from "@/lib/utils";
import { AmenidadesReservas } from "@/features/amenidades/AmenidadesReservas";

type Tab = "reservables" | "edificio";

export default function Amenidades() {
  const [tab, setTab] = useState<Tab>("reservables");

  return (
    <div>
      <PageHeader title="Amenidades" subtitle="Reservas de espacios · Margot" />

      <div className="inline-flex rounded-lg border border-border p-0.5 text-sm mb-4">
        {([
          { k: "reservables", label: "Espacios reservables" },
          { k: "edificio", label: "Amenidades del edificio" },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors",
              tab === t.k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "reservables" ? <AmenidadesReservas /> : <CatalogoEdificio />}
    </div>
  );
}

// Catálogo estático de amenidades del edificio (preservado tal cual).
function CatalogoEdificio() {
  const { proyectoId } = useCondominio();
  const { data, isLoading, error } = useCondominioDataset(proyectoId);
  const amenidades = data?.amenidades ?? [];

  if (isLoading || error) return <EstadoVista isLoading={isLoading} error={error} />;
  if (amenidades.length === 0) {
    return <div className="py-16 text-center text-muted-foreground">Este condominio no tiene amenidades registradas.</div>;
  }

  return (
    <>
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
      <p className="text-xs text-muted-foreground">
        Amenidades promocionales del edificio (catálogo). No son espacios reservables.
      </p>
    </>
  );
}
