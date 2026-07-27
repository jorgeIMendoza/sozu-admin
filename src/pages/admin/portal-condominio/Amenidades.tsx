import { useState } from "react";
import { PageHeader } from "./_helpers";
import { cn } from "@/lib/utils";
import { useAmenidadesStore } from "@/features/amenidades/store";
import { limitePago, restanteMs } from "@/features/amenidades/logic";
import { AmenidadesReservas, type TabInterna } from "@/features/amenidades/AmenidadesReservas";
import { Catalogo } from "@/features/amenidades/Catalogo";
import { AmenidadEditor } from "@/features/amenidades/AmenidadEditor";
import type { Amenidad } from "@/features/amenidades/types";

type TabPagina = "catalogo" | TabInterna;

export default function Amenidades() {
  const [tab, setTab] = useState<TabPagina>("catalogo");
  const [espacioCal, setEspacioCal] = useState<string | undefined>(undefined);

  // Editor de ficha (alta / edición)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editando, setEditando] = useState<Amenidad | null>(null);

  // Contadores para las etiquetas de pestaña (motor de reservas).
  const reservas = useAmenidadesStore((s) => s.reservas);
  const abonos = useAmenidadesStore((s) => s.abonosExcepcion);
  const config = useAmenidadesStore((s) => s.config);
  const ahora = useAmenidadesStore((s) => s.ahora);
  const porValidar = reservas.filter((r) => r.estado === "apartado").length;
  const porPagarVencer = reservas.filter((r) => {
    if (r.estado !== "por_pagar") return false;
    const rem = restanteMs(limitePago(r, config.pagoHoras), ahora);
    return rem != null && rem <= 12 * 3600_000;
  }).length;
  const totalExcepciones = porPagarVencer + abonos.length;

  const abrirNueva = () => { setEditando(null); setEditorOpen(true); };
  const abrirEditar = (a: Amenidad) => { setEditando(a); setEditorOpen(true); };
  const verCalendario = (espacioId: string) => { setEspacioCal(espacioId); setTab("calendario"); };

  const tabs: { k: TabPagina; label: string; badge?: number }[] = [
    { k: "catalogo", label: "Catálogo" },
    { k: "calendario", label: "Calendario" },
    { k: "validar", label: "Solicitudes por validar", badge: porValidar || undefined },
    { k: "excepciones", label: "Excepciones", badge: totalExcepciones || undefined },
  ];

  return (
    <div>
      <PageHeader title="Amenidades" subtitle="Catálogo, reservas y disponibilidad · Margot" />

      <div className="inline-flex flex-wrap rounded-lg border border-border p-0.5 text-sm mb-4">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors",
              tab === t.k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.badge ? <span className="ml-1.5 tabular-nums">({t.badge})</span> : null}
          </button>
        ))}
      </div>

      {tab === "catalogo" ? (
        <Catalogo onNueva={abrirNueva} onEditar={abrirEditar} onVerCalendario={verCalendario} />
      ) : (
        <AmenidadesReservas tab={tab} onTab={(t) => setTab(t)} espacioInicial={espacioCal} />
      )}

      <AmenidadEditor open={editorOpen} amenidad={editando} onClose={() => setEditorOpen(false)} />
    </div>
  );
}
