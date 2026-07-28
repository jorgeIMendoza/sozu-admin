import { usePortal, type SelectedUnit } from "@/lib/portal-cliente/onboarding-store";
import { supabase } from "@/integrations/supabase/client";
import { margotWordmark, margotIsotipo } from "@/lib/portal-cliente/onboarding-assets";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
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
  Loader2,
  AlertCircle,
} from "lucide-react";

interface Unit {
  id: string;
  numero: string;
  piso: string;
  modelo: string | null;
  m2Int: number | null;
  m2Ext: number | null;
  descripcion: string | null;
  imagen: string | null;
}

const MARGOT = { nombre: "Margot", ciudad: "Guadalajara, Chapultepec" };

// Trae las unidades reales de Margot (waterfall explícito, sin joins anidados de PostgREST).
async function fetchMargotUnits(): Promise<Unit[]> {
  const { data: proy, error: e1 } = await supabase
    .from("proyectos")
    .select("id")
    .eq("nombre", "Margot")
    .eq("activo", true)
    .limit(1);
  if (e1) throw e1;
  const proyId = proy?.[0]?.id;
  if (!proyId) return [];

  const { data: edificios } = await supabase
    .from("edificios")
    .select("id")
    .eq("id_proyecto", proyId)
    .eq("activo", true);
  const edificioIds = (edificios ?? []).map((e) => e.id);
  if (edificioIds.length === 0) return [];

  const { data: ems } = await supabase
    .from("edificios_modelos")
    .select("id, id_modelo")
    .in("id_edificio", edificioIds);
  const emList = ems ?? [];
  const emIds = emList.map((em) => em.id);
  if (emIds.length === 0) return [];

  const modeloIds = [...new Set(emList.map((em) => em.id_modelo).filter(Boolean))];
  const { data: modelos } = await supabase
    .from("modelos")
    .select("id, nombre")
    .in("id", modeloIds);
  const modeloName = new Map<number, string>((modelos ?? []).map((m) => [m.id, m.nombre]));
  const emModelo = new Map<number, string | null>(
    emList.map((em) => [em.id, em.id_modelo ? modeloName.get(em.id_modelo) ?? null : null]),
  );

  const { data: props } = await supabase
    .from("propiedades")
    .select("id, numero_piso, numero_propiedad, m2_interiores, m2_exteriores, descripcion, url_imagen_portada, id_edificio_modelo")
    .in("id_edificio_modelo", emIds)
    .eq("activo", true);

  return (props ?? []).map((p: any) => ({
    id: String(p.id),
    numero: p.numero_propiedad ?? "",
    piso: p.numero_piso ?? "",
    modelo: emModelo.get(p.id_edificio_modelo) ?? null,
    m2Int: p.m2_interiores != null ? Number(p.m2_interiores) : null,
    m2Ext: p.m2_exteriores != null ? Number(p.m2_exteriores) : null,
    descripcion: p.descripcion ?? null,
    imagen: p.url_imagen_portada ?? null,
  }));
}

export function Step1IdentifyUnit() {
  const unitId = usePortal((s) => s.onboarding.unitId);
  const confirmed = usePortal((s) => s.onboarding.unitConfirmed);
  const selectedUnit = usePortal((s) => s.onboarding.selectedUnit);
  const setOnb = usePortal((s) => s.setOnboarding);

  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showFloor, setShowFloor] = useState(false);
  const [activeFloor, setActiveFloor] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchMargotUnits()
      .then((u) => {
        if (!alive) return;
        setUnits(u);
        if (u.length === 0) setError("No hay unidades disponibles para Margot en este momento.");
      })
      .catch((e) => {
        console.error("fetchMargotUnits:", e);
        if (alive) setError("No se pudieron cargar las unidades. Intenta de nuevo o contáctanos.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const selected = selectedUnit && selectedUnit.id === unitId ? selectedUnit : null;

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return units.filter((u) => u.numero.toLowerCase().startsWith(q.toLowerCase())).slice(0, 8);
  }, [query, units]);

  const floors = useMemo(() => {
    const s = new Set<string>();
    units.forEach((u) => u.piso && s.add(u.piso));
    return Array.from(s).sort((a, b) => Number(b) - Number(a)); // 17 → 1
  }, [units]);

  const unitsOfActiveFloor = useMemo(
    () =>
      activeFloor
        ? units
            .filter((u) => u.piso === activeFloor)
            .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
        : [],
    [activeFloor, units],
  );

  const notFound = query.trim().length >= 2 && suggestions.length === 0;

  function pick(u: Unit) {
    const su: SelectedUnit = {
      id: u.id,
      numero: u.numero,
      piso: u.piso,
      modelo: u.modelo,
      m2Interiores: u.m2Int,
      m2Exteriores: u.m2Ext,
      descripcion: u.descripcion,
      imagen: u.imagen,
    };
    setOnb({ unitId: u.id, selectedUnit: su, unitConfirmed: false });
    setQuery("");
  }

  function clearSelection() {
    setOnb({ unitId: null, selectedUnit: null, unitConfirmed: false });
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
          {margotIsotipo ? (
            <img src={margotIsotipo} alt="" className="h-5 w-auto" aria-hidden />
          ) : (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Desarrollo
          </div>
          <div className="flex items-center gap-2">
            {margotWordmark ? (
              <img src={margotWordmark} alt={MARGOT.nombre} className="h-4 w-auto" />
            ) : (
              <span className="text-sm font-semibold text-foreground">{MARGOT.nombre}</span>
            )}
            <span className="text-xs text-muted-foreground">· {MARGOT.ciudad}</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando unidades de Margot…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && !selected && (
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
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej. 302"
                className="num pl-9"
                autoFocus
              />
            </div>
            {suggestions.length > 0 && (
              <div className="overflow-hidden rounded-md border border-border bg-card">
                {suggestions.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => pick(u)}
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-secondary/60"
                  >
                    <div className="flex items-center gap-2">
                      <Home className="h-3.5 w-3.5 text-primary" />
                      <span className="num font-semibold text-foreground">Depto {u.numero}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Piso <span className="num">{u.piso}</span>
                      {u.modelo ? ` · Modelo ${u.modelo}` : ""}
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
                  <span className="num font-semibold text-foreground">SOZU 33 2312 2610</span>.
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
              <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-[5.5rem_1fr]">
                {/* Selector de piso: columna clara, con scroll propio y sin cortarse */}
                <div className="min-w-0">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Piso
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 sm:max-h-80 sm:flex-col sm:gap-1 sm:overflow-x-hidden sm:overflow-y-auto sm:pr-1.5">
                    {floors.map((f) => {
                      const active = f === activeFloor;
                      return (
                        <button
                          key={f}
                          onClick={() => setActiveFloor(f)}
                          className={`num shrink-0 rounded-md border px-3 py-2 text-center text-sm font-medium transition sm:w-full ${
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

                <div className="min-w-0">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {activeFloor ? (
                      <>
                        Unidades del piso <span className="num">{activeFloor}</span>
                      </>
                    ) : (
                      "Elige un piso"
                    )}
                  </div>
                  {activeFloor ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {unitsOfActiveFloor.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => pick(u)}
                          className="flex flex-col items-start gap-0.5 rounded-md border border-border bg-card px-3 py-2 text-left transition hover:border-primary/40 hover:bg-secondary/40"
                        >
                          <span className="num text-sm font-semibold text-foreground">{u.numero}</span>
                          {u.modelo && <span className="text-[11px] text-muted-foreground">{u.modelo}</span>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Selecciona un piso a la izquierda.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selected && (
        <ConfirmationCard
          unit={selected}
          onReject={clearSelection}
          onConfirm={() => setOnb({ unitConfirmed: true })}
          confirmed={confirmed}
        />
      )}
    </div>
  );
}

function ConfirmationCard({
  unit,
  onReject,
  onConfirm,
  confirmed,
}: {
  unit: SelectedUnit;
  onReject: () => void;
  onConfirm: () => void;
  confirmed: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div
        className="relative h-40 w-full overflow-hidden"
        style={{
          background: unit.imagen
            ? `url('${unit.imagen}') center/cover no-repeat`
            : "linear-gradient(135deg, #2b2b2b, #a48b6a)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        {margotWordmark && (
          <img
            src={margotWordmark}
            alt="Margot"
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
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {MARGOT.nombre}
            </div>
            <div className="mt-0.5 text-xl font-semibold text-foreground">
              Unidad <span className="num">{unit.numero}</span>
            </div>
            <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {MARGOT.ciudad} · Piso <span className="num">{unit.piso}</span>
              </span>
            </div>
          </div>
          {unit.modelo && (
            <div className="shrink-0 rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Modelo
              </div>
              <div className="text-sm font-semibold text-foreground">{unit.modelo}</div>
            </div>
          )}
        </div>

        <dl className="mt-4 divide-y divide-border rounded-md border border-border bg-secondary/20 text-sm">
          <SpecRow label="Superficie interior" value={fmtM2(unit.m2Interiores)} />
          <SpecRow label="Superficie exterior" value={fmtM2(unit.m2Exteriores)} />
          <SpecRow label="Piso" value={<span className="num">{unit.piso}</span>} />
        </dl>

        {unit.descripcion && (
          <p className="mt-4 text-sm leading-relaxed text-foreground/80">{unit.descripcion}</p>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Las descripciones e imágenes son ilustrativas y pueden variar por disponibilidad de
          modelos e inventario.
        </p>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onReject}>
            <X className="mr-1 h-3.5 w-3.5" /> No es este · buscar otro
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={confirmed} className="sm:min-w-56">
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

function fmtM2(v: number | null) {
  if (v === null || v === undefined) return "—";
  return (
    <span>
      <span className="num">{v.toFixed(2)}</span> <span className="text-xs text-muted-foreground">m²</span>
    </span>
  );
}
