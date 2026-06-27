import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, User, Building2, Calendar, DollarSign, X, CalendarDays, Search, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MonthMultiSelector, getMonthFilterLabel } from "@/components/ui/month-multi-selector";
import { InmobPipelineOfferDetailDialog } from "@/components/admin/portal-inmobiliaria/InmobPipelineOfferDetailDialog";
import {
  useOfertasPipeline,
  STAGES,
  type PipelineCard,
} from "@/hooks/usePortalAltaDireccion/useOfertasPipeline";

// PipelineCard, STAGES, classifyOffer y el fetch/enriquecimiento viven ahora
// en el hook compartido `useOfertasPipeline` (única fuente de verdad que
// también consume el Dashboard General). Ver imports arriba.

export default function AltaDireccionPipelinePage() {
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set(["expiradas"]));
  const [manuallyToggled, setManuallyToggled] = useState<Set<string>>(new Set());
  const [selectedCard, setSelectedCard] = useState<PipelineCard | null>(null);

  // Filters — inicializables desde la URL para soportar la navegación desde
  // el CTA "Nuevas ofertas" del Dashboard General (tipo, mes, proyectos).
  const [searchParams] = useSearchParams();
  const [selectedAgentes, setSelectedAgentes] = useState<string[]>([]);
  const [selectedProyectos, setSelectedProyectos] = useState<string[]>(() => {
    const p = searchParams.get("proyectos");
    return p ? p.split(",").filter(Boolean) : [];
  });
  const [selectedTipoOferta, setSelectedTipoOferta] = useState<string>(
    () => searchParams.get("tipo") || "all",
  );
  const [searchOfertaId, setSearchOfertaId] = useState<string>("");
  const [searchProspecto, setSearchProspecto] = useState<string>("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
    const m = searchParams.get("mes");
    return m ? m.split(",").filter(Boolean) : [];
  });

  // Fetch de ofertas vía hook compartido — misma fuente de verdad que el
  // KPI "Nuevas ofertas" (Aprobadas) del Dashboard General.
  const { data: ofertas = [], isLoading } = useOfertasPipeline(selectedMonths);

  // Derive agente options from loaded data (email → display name)
  const availableAgentes = useMemo(() => {
    const m = new Map<string, string>();
    ofertas.forEach((o) => {
      if (o.email_creador) m.set(o.email_creador, o.agente_nombre || o.email_creador);
    });
    return Array.from(m.entries()).map(([email, nombre]) => ({ email, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [ofertas]);

  // Derive proyecto options from loaded data
  const availableProyectos = useMemo(() => {
    const m = new Map<number, string>();
    ofertas.forEach((o) => {
      if (o.proyecto_id && o.proyecto_nombre) m.set(o.proyecto_id, o.proyecto_nombre);
    });
    return Array.from(m.entries()).map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [ofertas]);

  // Filter offers
  const filteredOfertas = useMemo(() => {
    let result = ofertas;
    if (searchOfertaId.trim()) {
      const searchClean = searchOfertaId.replace(/^(O|OP)-?/i, "").trim().toLowerCase();
      if (searchClean) {
        result = result.filter((o) => {
          const paddedId = String(o.id).padStart(6, "0");
          return paddedId.includes(searchClean) || String(o.id).includes(searchClean);
        });
      }
    }
    if (searchProspecto.trim()) {
      const q = searchProspecto.trim().toLowerCase();
      result = result.filter((o) => (o.lead_nombre || "").toLowerCase().includes(q));
    }
    if (selectedAgentes.length > 0) {
      result = result.filter((o) => selectedAgentes.includes(o.email_creador));
    }
    if (selectedProyectos.length > 0) {
      const projIds = selectedProyectos.map(Number);
      result = result.filter((o) => o.proyecto_id && projIds.includes(o.proyecto_id));
    }
    if (selectedTipoOferta === "propiedad") {
      result = result.filter((o) => !o.id_producto);
    } else if (selectedTipoOferta === "producto") {
      result = result.filter((o) => !!o.id_producto);
    }
    return result;
  }, [ofertas, selectedAgentes, selectedProyectos, selectedTipoOferta, searchOfertaId, searchProspecto]);

  const stageMap = useMemo(() => {
    const m = new Map<string, PipelineCard[]>();
    STAGES.forEach((s) => m.set(s.key, []));
    filteredOfertas.forEach((o) => {
      if (o.stage) {
        const arr = m.get(o.stage);
        if (arr) arr.push(o);
      }
    });
    // Dedup cierre by property/product combination
    const cierre = m.get("cierre") || [];
    if (cierre.length > 0) {
      const seen = new Set<string>();
      m.set("cierre", cierre
        .filter((o) => !!o.cuenta_cobranza_id)
        .filter((o) => {
          const key = o.id_producto
            ? `prod-${o.id_producto}-${o.id_propiedad || "none"}`
            : `prop-${o.id_propiedad}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }));
    }
    m.forEach((cards) => {
      cards.sort((a, b) => new Date(b.fecha_generacion).getTime() - new Date(a.fecha_generacion).getTime());
    });
    return m;
  }, [filteredOfertas]);

  // Auto-collapse empty stages
  useEffect(() => {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      STAGES.forEach((stage) => {
        if (manuallyToggled.has(stage.key)) return;
        const count = stageMap.get(stage.key)?.length || 0;
        if (count === 0) next.add(stage.key);
        else if (stage.key !== "expiradas") next.delete(stage.key);
      });
      return next;
    });
  }, [stageMap, manuallyToggled]);

  const toggleCollapse = (key: string) => {
    setManuallyToggled((prev) => new Set(prev).add(key));
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);

  const agenteNameToEmail = useMemo(() => {
    const m = new Map<string, string>();
    availableAgentes.forEach((a) => m.set(a.nombre, a.email));
    return m;
  }, [availableAgentes]);
  const selectedAgenteNames = useMemo(
    () => selectedAgentes.map((email) => availableAgentes.find((a) => a.email === email)?.nombre || email),
    [selectedAgentes, availableAgentes]
  );
  const proyNameToId = useMemo(() => {
    const m = new Map<string, string>();
    availableProyectos.forEach((p) => m.set(p.nombre, String(p.id)));
    return m;
  }, [availableProyectos]);
  const selectedProyNames = useMemo(
    () => selectedProyectos.map((id) => availableProyectos.find((p) => String(p.id) === id)?.nombre || id),
    [selectedProyectos, availableProyectos]
  );

  const hasActiveFilters =
    selectedAgentes.length > 0 || selectedProyectos.length > 0 || selectedTipoOferta !== "all" ||
    selectedMonths.length > 0 || searchOfertaId.trim().length > 0 || searchProspecto.trim().length > 0;

  const clearAllFilters = () => {
    setSelectedAgentes([]);
    setSelectedProyectos([]);
    setSelectedTipoOferta("all");
    setSelectedMonths([]);
    setSearchOfertaId("");
    setSearchProspecto("");
  };

  const monthFilterLabel = useMemo(() => getMonthFilterLabel(selectedMonths), [selectedMonths]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Vista general de ofertas de todos los agentes</p>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Agentes</label>
              <MultiSelectFilter
                options={availableAgentes.map((a) => a.nombre)}
                values={selectedAgenteNames}
                onValuesChange={(names) => {
                  const emails = names.map((n) => agenteNameToEmail.get(n) || n);
                  setSelectedAgentes(emails);
                }}
                placeholder="Todos los agentes"
              />
            </div>

            <div className="min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Proyectos</label>
              {availableProyectos.length <= 1 ? (
                <Select value={availableProyectos[0] ? String(availableProyectos[0].id) : ""} disabled>
                  <SelectTrigger><SelectValue placeholder={availableProyectos[0]?.nombre || "Sin proyectos"} /></SelectTrigger>
                  <SelectContent>{availableProyectos.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <MultiSelectFilter
                  options={availableProyectos.map((p) => p.nombre)}
                  values={selectedProyNames}
                  onValuesChange={(names) => {
                    const ids = names.map((n) => proyNameToId.get(n) || n);
                    setSelectedProyectos(ids);
                  }}
                  placeholder="Todos los proyectos"
                />
              )}
            </div>

            <div className="min-w-[160px]">
              <label className="text-sm font-medium mb-1 block">Tipo de Oferta</label>
              <Select value={selectedTipoOferta} onValueChange={setSelectedTipoOferta}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="propiedad">Propiedades</SelectItem>
                  <SelectItem value="producto">Productos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[160px]">
              <label className="text-sm font-medium mb-1 block">Buscar Oferta</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="O-001234"
                  value={searchOfertaId}
                  onChange={(e) => setSearchOfertaId(e.target.value)}
                  className="pl-8 h-10"
                />
              </div>
            </div>

            <div className="min-w-[180px]">
              <label className="text-sm font-medium mb-1 block">Prospecto</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar prospecto..."
                  value={searchProspecto}
                  onChange={(e) => setSearchProspecto(e.target.value)}
                  className="pl-8 h-10"
                />
              </div>
            </div>

            <div className="min-w-[180px]">
              <label className="text-sm font-medium mb-1 block">Periodo</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                    <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{monthFilterLabel}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <MonthMultiSelector value={selectedMonths} onChange={setSelectedMonths} />
                </PopoverContent>
              </Popover>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-10">
                <X className="h-3 w-3 mr-1" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96 w-72 shrink-0" />)}
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4 min-w-max">
            {STAGES.map((stage) => {
              const cards = stageMap.get(stage.key) || [];
              const collapsed = collapsedStages.has(stage.key);

              if (collapsed) {
                return (
                  <div key={stage.key} className="min-w-[48px]">
                    <button
                      className={cn(
                        "h-full min-h-[200px] w-12 rounded-lg border flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors hover:opacity-80",
                        stage.color
                      )}
                      onClick={() => toggleCollapse(stage.key)}
                      title={`Mostrar ${stage.label}`}
                    >
                      <ChevronRight className="h-4 w-4 shrink-0" />
                      <span className="[writing-mode:vertical-lr] text-xs font-semibold whitespace-nowrap">{stage.label}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{cards.length}</Badge>
                    </button>
                  </div>
                );
              }

              return (
                <div key={stage.key} className="min-w-[300px] max-w-[300px]">
                  <div className={cn("rounded-t-lg px-3 py-2 flex items-center justify-between", stage.color)}>
                    <span className="font-semibold text-sm">{stage.label}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">{cards.length}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleCollapse(stage.key)} title="Contraer columna">
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="border border-t-0 rounded-b-lg bg-muted/30 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-320px)] overflow-y-auto">
                    {cards.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">Sin ofertas</p>
                    ) : (
                      cards.map((card) => (
                        <Card key={card.id} className="sozu-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedCard(card)}>
                          <CardContent className="p-3 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1">
                                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  {card.lead_nombre || "Sin cliente"}
                                </p>
                                {card.proyecto_nombre && (
                                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                    <Building2 className="h-3 w-3 shrink-0" />
                                    {card.proyecto_nombre} · {card.propiedad_nombre || "—"}
                                  </p>
                                )}
                              </div>
                              <a
                                href={`/oferta/${card.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Ver oferta digital"
                                className="text-[10px] shrink-0 font-mono text-primary hover:underline inline-flex items-center gap-0.5"
                              >
                                {card.is_producto ? "OP" : "O"}-{String(card.id).padStart(6, "0")}
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {card.is_producto ? "Producto" : "Propiedad"}
                              </Badge>
                              {card.is_producto && card.producto_nombre && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 truncate max-w-[180px]">
                                  {card.producto_nombre}
                                </Badge>
                              )}
                            </div>
                            {card.cuenta_cobranza_id && (
                              <p className="text-[11px] text-muted-foreground font-mono">
                                {card.is_producto ? "CCP" : "CC"}-{String(card.cuenta_cobranza_id).padStart(6, "0")}
                              </p>
                            )}
                            {((card.precio_final_cuenta != null && card.precio_final_cuenta > 0) || (card.precio != null && card.precio > 0)) && (
                              <p className="text-sm font-bold text-foreground flex items-center gap-1">
                                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                {formatCurrency(card.precio_final_cuenta && card.precio_final_cuenta > 0 ? card.precio_final_cuenta : (card.precio || 0))}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="truncate max-w-[60%] flex items-center gap-1">
                                {card.agente_nombre || card.email_creador}
                                {card.is_internal && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-warning/30 text-warning bg-warning/10 shrink-0 rounded-full font-medium">
                                    Usuario Interno
                                  </Badge>
                                )}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(card.fecha_generacion), "dd MMM yyyy", { locale: es })}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      {selectedCard && (
        <InmobPipelineOfferDetailDialog
          open={!!selectedCard}
          onOpenChange={(v) => { if (!v) setSelectedCard(null); }}
          card={selectedCard}
          stageInfo={STAGES.find((s) => s.key === selectedCard.stage) || STAGES[0]}
        />
      )}
    </div>
  );
}
