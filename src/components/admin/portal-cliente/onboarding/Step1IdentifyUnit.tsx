import { usePortal } from "@/lib/portal-cliente/onboarding-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import {
  Building2,
  MapPin,
  Phone,
  Search,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Home,
  Maximize2,
  LayoutGrid,
} from "lucide-react";

export function Step1IdentifyUnit() {
  const projects = usePortal((s) => s.projects);
  const properties = usePortal((s) => s.properties);
  const unitId = usePortal((s) => s.onboarding.unitId);
  const setOnb = usePortal((s) => s.setOnboarding);

  // Margot como contexto fijo. // SWAP POINT: cuando haya más desarrollos activos, reactivar selector.
  const margot = projects.find((p) => p.key === "margot")!;
  const margotUnits = useMemo(
    () => properties.filter((p) => p.project === "margot"),
    [properties],
  );

  const confirmed = usePortal((s) => s.onboarding.unitConfirmed);
  const [query, setQuery] = useState("");
  const [showFloor, setShowFloor] = useState(false);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);

  const selected = margotUnits.find((u) => u.id === unitId) ?? null;

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return margotUnits
      .filter((u) => u.unit.startsWith(q))
      .slice(0, 6);
  }, [query, margotUnits]);

  const floors = useMemo(() => {
    const s = new Set<number>();
    margotUnits.forEach((u) => u.floor && s.add(u.floor));
    return Array.from(s).sort((a, b) => b - a); // 17 → 2
  }, [margotUnits]);

  const unitsOfActiveFloor = useMemo(
    () => (activeFloor ? margotUnits.filter((u) => u.floor === activeFloor) : []),
    [activeFloor, margotUnits],
  );

  const notFound = query.trim().length >= 2 && suggestions.length === 0;

  function pick(id: string) {
    setOnb({ unitId: id });
    setOnb({ unitConfirmed: false });
    setQuery("");
  }

  function clearSelection() {
    setOnb({ unitId: null });
    setOnb({ unitConfirmed: false });
    setQuery("");
    setActiveFloor(null);
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-foreground">Identifica tu propiedad</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecciona tu departamento en Margot para registrarlo como dueño.
        </p>
      </header>

      {/* Contexto Margot (chip fijo) */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-card">
          {margot.brand?.isotipo ? (
            <img src={margot.brand.isotipo} alt="" className="h-5 w-auto" aria-hidden />
          ) : (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Desarrollo
          </div>
          <div className="flex items-center gap-2">
            {margot.brand?.wordmark ? (
              <img src={margot.brand.wordmark} alt={margot.name} className="h-4 w-auto" />
            ) : (
              <span className="text-sm font-semibold text-foreground">{margot.name}</span>
            )}
            <span className="text-xs text-muted-foreground">· {margot.city}</span>
          </div>
        </div>
      </div>

      {!selected && (
        <div className="space-y-5">
          {/* Camino primario: número */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Escribe tu número de departamento
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Ej. 308"
                inputMode="numeric"
                className="num pl-9"
                autoFocus
              />
            </div>
            {suggestions.length > 0 && (
              <div className="overflow-hidden rounded-md border border-border bg-card">
                {suggestions.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => pick(u.id)}
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-secondary/60"
                  >
                    <div className="flex items-center gap-2">
                      <Home className="h-3.5 w-3.5 text-primary" />
                      <span className="num font-semibold text-foreground">
                        Depto {u.unit}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Piso <span className="num">{u.floor}</span> · Modelo {u.model}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {notFound && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                <Phone className="mt-0.5 h-3.5 w-3.5 text-primary" />
                <span>
                  No localizamos esa unidad en Margot. Contáctanos:{" "}
                  <span className="num font-semibold text-foreground">
                    SOZU 33 2312 2610
                  </span>
                  .
                </span>
              </div>
            )}
          </div>

          {/* Camino secundario: por piso */}
          <div className="rounded-lg border border-border bg-card">
            <button
              onClick={() => setShowFloor((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-foreground hover:bg-secondary/40"
            >
              <span>
                <span className="text-muted-foreground">¿No recuerdas tu número?</span>{" "}
                <span className="font-medium">Elígelo por piso</span>
              </span>
              {showFloor ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showFloor && (
              <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-[auto_1fr]">
                {/* Explorador vertical de pisos (estilo Patrimonio) */}
                <div className="flex sm:flex-col sm:items-stretch">
                  <div className="hidden text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:mb-1 sm:block">
                    Piso
                  </div>
                  <div className="flex flex-1 gap-1 overflow-x-auto sm:max-h-72 sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden">
                    {floors.map((f) => {
                      const active = f === activeFloor;
                      return (
                        <button
                          key={f}
                          onClick={() => setActiveFloor(f)}
                          className={`num flex h-9 w-12 shrink-0 items-center justify-center rounded-md border text-sm transition ${
                            active
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-card text-foreground hover:bg-secondary/60"
                          }`}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {activeFloor ? (
                      <>
                        Unidades del piso <span className="num">{activeFloor}</span>
                      </>
                    ) : (
                      "Elige un piso"
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {unitsOfActiveFloor.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => pick(u.id)}
                        className="group flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:border-primary/40 hover:bg-secondary/40"
                      >
                        <span className="num font-semibold text-foreground">{u.unit}</span>
                        <span className="text-xs text-muted-foreground">· {u.model}</span>
                      </button>
                    ))}
                    {!activeFloor && (
                      <div className="text-xs text-muted-foreground">
                        Selecciona un piso a la izquierda.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selected && <ConfirmationCard property={selected} onReject={clearSelection} onConfirm={() => setOnb({ unitConfirmed: true })} confirmed={confirmed} />}
    </div>
  );
}

function ConfirmationCard({
  property,
  onReject,
  onConfirm,
  confirmed,
}: {
  property: ReturnType<typeof usePortal.getState>["properties"][number];
  onReject: () => void;
  onConfirm: () => void;
  confirmed: boolean;
}) {
  const projects = usePortal((s) => s.projects);
  const project = projects.find((p) => p.key === property.project)!;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Imagen. // SWAP POINT: fotografía/render profesional de Margot. */}
      <div
        className="relative h-40 w-full overflow-hidden"
        style={{
          background: property.image
            ? `url('${property.image}') center/cover no-repeat`
            : project.cover,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        {project.brand?.wordmarkLight && (
          <img
            src={project.brand.wordmarkLight}
            alt={project.name}
            className="absolute bottom-3 left-3 h-4 w-auto opacity-95 drop-shadow-md"
          />
        )}
        <div className="absolute right-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-foreground shadow-sm">
          Confirma tu propiedad
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {project.brand?.isotipo && (
                <img src={project.brand.isotipo} alt="" className="h-3.5 w-auto" aria-hidden />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {project.name}
              </span>
            </div>
            <div className="mt-0.5 text-xl font-semibold text-foreground">
              Unidad <span className="num">{property.unit}</span>
            </div>
            <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{property.address}</span>
            </div>
          </div>
          {property.model && (
            <div className="shrink-0 rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Modelo
              </div>
              <div className="text-sm font-semibold text-foreground">{property.model}</div>
              {property.floor && (
                <div className="text-[10px] text-muted-foreground">
                  Piso <span className="num">{property.floor}</span> de{" "}
                  <span className="num">{property.floorTotal ?? "—"}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ficha */}
        <dl className="mt-4 divide-y divide-border rounded-md border border-border bg-secondary/20 text-sm">
          <SpecRow label="Superficie interior" value={fmtM2(property.mInt)} />
          <SpecRow label="Superficie exterior" value={fmtM2(property.mExt)} />
          <SpecRow label="Recámaras" value={<span className="num">{property.bedrooms ?? "—"}</span>} />
          <SpecRow label="Baños completos" value={<span className="num">{property.baths ?? "—"}</span>} />
          <SpecRow label="Medios baños" value={<span className="num">{property.halfBaths ?? "—"}</span>} />
          <SpecRow
            label="Cajones de estacionamiento"
            value={<span className="num">{property.parking ?? "—"}</span>}
          />
        </dl>

        {property.features && property.features.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Características
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {property.features.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {property.description && (
          <p className="mt-4 text-sm leading-relaxed text-foreground/80">
            {property.description}
          </p>
        )}

        {property.floorPlan && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Planta del departamento
              </div>
              <span className="text-[10px] text-muted-foreground">
                Toca para ampliar
              </span>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="group relative mt-2 block w-full overflow-hidden rounded-md border border-border bg-secondary/30 transition hover:border-primary/40 hover:shadow-sm"
                  aria-label="Ampliar planta del departamento"
                >
                  <img
                    src={property.floorPlan}
                    alt={`Planta del departamento ${property.unit} · Modelo ${property.model}`}
                    className="mx-auto block max-h-72 w-auto object-contain p-3"
                    loading="lazy"
                  />
                  <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 text-[10px] font-medium text-foreground shadow-sm ring-1 ring-border">
                    <Maximize2 className="h-3 w-3" />
                    Ampliar
                  </div>
                  <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 text-[10px] font-medium text-foreground shadow-sm ring-1 ring-border">
                    <LayoutGrid className="h-3 w-3" />
                    Modelo {property.model}
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl p-0 sm:p-0">
                <div className="border-b border-border px-5 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Planta · Modelo {property.model}
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    Unidad <span className="num">{property.unit}</span>
                    {property.floor && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Piso <span className="num">{property.floor}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="max-h-[75vh] overflow-auto bg-secondary/30 p-4">
                  <img
                    src={property.floorPlan}
                    alt={`Planta ampliada · departamento ${property.unit}`}
                    className="mx-auto block h-auto w-full max-w-3xl object-contain"
                  />
                </div>
                <div className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
                  Planta arquitectónica ilustrativa. Medidas y acabados pueden variar
                  respecto al inmueble entregado.
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}


        <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          Folio real:{" "}
          <span className="num font-semibold text-foreground">{property.folioReal}</span>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Las descripciones e imágenes son ilustrativas y pueden variar en marca por
          disponibilidad de modelos e inventario.
        </p>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onReject}>
            <X className="mr-1 h-3.5 w-3.5" /> No es este · buscar otro
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={confirmed}
            className="sm:min-w-56"
          >
            <Check className="mr-1 h-4 w-4" />
            {confirmed ? "Confirmado" : "Sí, es mi departamento"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function fmtM2(v?: number) {
  if (v === undefined || v === null) return "—";
  return (
    <span>
      <span className="num">{v.toFixed(2)}</span>{" "}
      <span className="text-xs text-muted-foreground">m²</span>
    </span>
  );
}
