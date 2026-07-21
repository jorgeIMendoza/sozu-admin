import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { mesesMensualidadesRestantes, calcDynamicScheme, calcEscalonadoScheme, expandirTramos } from "@/utils/escalonadoUtils";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useInventarioDisponiblePaginado } from "@/hooks/useInventarioDisponiblePaginado";
import type { InventarioPropiedad } from "@/hooks/useInventarioDisponible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building2, Loader2, ArrowLeft, BedDouble, Bath, ShowerHead, Maximize2, FileText, ChevronLeft, ChevronRight, X, Layers, Car, Search, SlidersHorizontal, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import bodegaIcon from "@/assets/icons/bodega.png";
import useEmblaCarousel from "embla-carousel-react";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewOfferDialog } from "@/components/admin/NewOfferDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentOnboardingStatus } from "@/hooks/useAgentOnboardingStatus";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { PropertyFloorPlanButton } from "@/components/admin/agent-portal/PropertyFloorPlanButton";
import { optimizedImage } from "@/utils/optimizedImage";
import { OptImg } from "@/components/ui/OptImg";

const PAGE_SIZE = 30;
type SortOrder = "none" | "asc" | "desc";
type TriState = "todos" | "si" | "no";

/** Select de filtro con etiqueta (estilo CC). */
const FilterSelect = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) => (
  <div className="flex w-full flex-col gap-1.5">
    <span className="px-0.5 text-xs font-medium text-muted-foreground">{label}</span>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-[38px] text-[13px] font-normal text-muted-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);

const AgentUnidadesProyecto = () => {
  const [searchParams] = useSearchParams();
  const proyectoIdParam = searchParams.get("proyecto");
  const modeloIdParam = searchParams.get("modelo");
  const openFiltersParam = searchParams.get("openFilters");
  const navigate = useNavigate();

  // Persistencia de filtros (sessionStorage). Si se llega con proyecto/modelo en la
  // URL, esos mandan y se ignora lo guardado (contexto nuevo desde inventario/detalle).
  const FILTERS_KEY = "agent-unidades-filters";
  const hasUrlPreselect = !!proyectoIdParam || !!modeloIdParam;
  const storedFilters: any = (() => {
    if (hasUrlPreselect) return {};
    try { return JSON.parse(sessionStorage.getItem(FILTERS_KEY) || "{}"); } catch { return {}; }
  })();
  const { permissions: agentPerms } = useAgentPortalPermissions();
  const canGenerateOffer = agentPerms['/admin/agent/inventario']?.canGenerateOffer;
  const canGenerateDigitalOffer = agentPerms['/admin/agent/inventario']?.canGenerateDigitalOffer;
  const { profile } = useAuth();
  const { impersonatedAgentPersonaId, isImpersonating } = useAgentImpersonation();
  const personaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';
  const { percentage, isLoading: isLoadingOnboarding, hasTrainingComplete, hasBasicIdentityComplete } = useAgentOnboardingStatus(personaId);

  // Permissions, logging, tracking
  const { permissions } = useAgentPortalPermissions();
  const unidadesPerms = permissions['/admin/agent/inventario'];
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();

  // Log page view
  useEffect(() => {
    registrarVista('/admin/agent/inventario/unidades');
    track({ page: 'agent_unidades', elementId: 'page_view', elementType: 'page' });
  }, []);

  // State declarations from line 41 to line 100
  const [page, setPage] = useState(0);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [selectedSchemeId, setSelectedSchemeId] = useState<number | null>(null);

  // Filters
  const [filterProjectNames, setFilterProjectNames] = useState<string[]>(() => storedFilters.filterProjectNames ?? []);
  const [filterModelNames, setFilterModelNames] = useState<string[]>(() => storedFilters.filterModelNames ?? []);
  const [filterLevels, setFilterLevels] = useState<string[]>(() => storedFilters.filterLevels ?? []);
  const [filterBodega, setFilterBodega] = useState<TriState>(() => storedFilters.filterBodega ?? "todos");
  const [filterEstacionamiento, setFilterEstacionamiento] = useState<TriState>(() => storedFilters.filterEstacionamiento ?? "todos");
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(openFiltersParam === 'true');
  const [sortOrder] = useState<SortOrder>(() => storedFilters.sortOrder ?? "none");
  const [priceRange, setPriceRange] = useState<[number, number] | null>(() => storedFilters.priceRange ?? null);
  const [priceRangeLocal, setPriceRangeLocal] = useState<[number, number] | null>(null);
  const priceCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recamarasFilter, setRecamarasFilter] = useState<string[]>(() => storedFilters.recamarasFilter ?? []);
  const [searchQuery, setSearchQuery] = useState(() => storedFilters.searchQuery ?? "");
  const [lastKnownTotalCount, setLastKnownTotalCount] = useState(PAGE_SIZE);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const isSearchActive = normalizedSearchQuery.length > 0;
  const requestedPage = isSearchActive ? 0 : page;
  const requestedPageSize = isSearchActive ? Math.max(PAGE_SIZE, lastKnownTotalCount) : PAGE_SIZE;

  // Resolve proyecto/modelo ID from URL to name for pre-selecting filter, then clean URL
  const [paramsResolved, setParamsResolved] = useState(!proyectoIdParam && !modeloIdParam);
  useEffect(() => {
    if (!proyectoIdParam && !modeloIdParam) return;
    const resolveParams = async () => {
      const promises: Promise<void>[] = [];
      if (proyectoIdParam) {
        const pid = parseInt(proyectoIdParam);
        if (!isNaN(pid)) {
          promises.push(
            (supabase as any).from("proyectos").select("nombre").eq("id", pid).maybeSingle()
              .then(({ data }: any) => { if (data?.nombre) setFilterProjectNames([data.nombre]); })
          );
        }
      }
      if (modeloIdParam) {
        const mid = parseInt(modeloIdParam);
        if (!isNaN(mid)) {
          promises.push(
            (supabase as any).from("modelos").select("nombre").eq("id", mid).maybeSingle()
              .then(({ data }: any) => { if (data?.nombre) setFilterModelNames([data.nombre]); })
          );
        }
      }
      await Promise.all(promises);
      setParamsResolved(true);
      navigate('/admin/agent/inventario/unidades', { replace: true });
    };
    resolveParams();
  }, []);

  const bedroomsForQuery = useMemo(() => {
    if (recamarasFilter.length === 0) return [];
    const nums: number[] = [];
    recamarasFilter.forEach(opt => {
      if (opt === '4+') { nums.push(4, 5, 6, 7, 8, 9, 10); }
      else { const n = parseInt(opt); if (!isNaN(n)) nums.push(n); }
    });
    return nums;
  }, [recamarasFilter]);

  // bodegaValue, estacionamientoValue, query hook, pageProperties, filter options, price bounds, helpers - lines 102 to 258
  const bodegaValue = filterBodega === "si" ? true : filterBodega === "no" ? false : null;
  const estacionamientoValue = filterEstacionamiento === "si" ? true : filterEstacionamiento === "no" ? false : null;

  const { data: inventarioData, isLoading: isLoadingData, isFetching } = useInventarioDisponiblePaginado({
    projectNames: filterProjectNames.length > 0 ? filterProjectNames : undefined,
    modelNames: filterModelNames.length > 0 ? filterModelNames : undefined,
    bedrooms: bedroomsForQuery,
    levels: filterLevels.length > 0 ? filterLevels : undefined,
    hasBodega: bodegaValue,
    hasEstacionamiento: estacionamientoValue,
    sortPrice: sortOrder === "none" ? null : sortOrder,
    minPrice: priceRange ? priceRange[0] : null,
    maxPrice: priceRange ? priceRange[1] : null,
    page: requestedPage,
    pageSize: requestedPageSize,
  });

  const pageProperties = useMemo(() => {
    return (inventarioData?.propiedades || []).map((p: InventarioPropiedad) => {
      const propImgs = p.propiedad_imagenes || [];
      const modelImgs = p.modelo_imagenes || [];
      const images = propImgs.length > 0 ? propImgs : modelImgs;
      return {
        id: p.id,
        numero_propiedad: p.numero_propiedad,
        numero: p.numero_propiedad,
        piso: p.numero_piso,
        precio_lista: p.precio_lista,
        m2_interiores: p.m2_interiores,
        m2_exteriores: p.m2_exteriores,
        m2_total: (p.m2_interiores || 0) + (p.m2_exteriores || 0),
        proyecto_id: p.proyecto_id,
        proyecto_nombre: p.proyecto_nombre,
        edificio_nombre: p.edificio_nombre,
        modelo_id: p.modelo_id,
        modelo_nombre: p.modelo_nombre,
        recamaras: p.numero_recamaras,
        banos: p.numero_completo_banos,
        medio_bano: p.numero_medio_bano,
        bodegas_count: p.bodegas_count,
        estacionamientos_count: p.estacionamientos_count,
        estacionamientos_tipos: p.estacionamientos_tipos || [],
        model_images: images,
        esquemas_pago: p.esquemas_pago || [],
      };
    });
  }, [inventarioData?.propiedades]);

  const availableProjectNames = inventarioData?.filterOptions?.proyectos || [];
  const availableModelNames = inventarioData?.filterOptions?.modelos || [];
  const availableLevelOptions = useMemo(() => {
    const levels = inventarioData?.filterOptions?.niveles || [];
    return [...levels].sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      if (!isNaN(na)) return -1;
      if (!isNaN(nb)) return 1;
      return a.localeCompare(b);
    });
  }, [inventarioData?.filterOptions?.niveles]);
  const availableRecamaras = inventarioData?.filterOptions?.recamaras || [];
  const totalCount = inventarioData?.totalCount || 0;
  const totalPages = inventarioData?.totalPages || 0;
  const projectCounts = inventarioData?.projectCounts || {};
  const isLoading = isLoadingData;

  useEffect(() => {
    if (totalCount > 0) {
      setLastKnownTotalCount((current) => Math.max(current, totalCount));
    }
  }, [totalCount]);

  const priceBoundsRef = useRef<{ min: number; max: number } | null>(null);
  const priceBounds = useMemo(() => {
    const props = inventarioData?.propiedades || [];
    if (props.length === 0) return priceBoundsRef.current || { min: 0, max: 10000000 };
    const prices = props.map(p => p.precio_lista).filter(Boolean) as number[];
    if (prices.length === 0) return priceBoundsRef.current || { min: 0, max: 10000000 };
    const computed = { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
    if (!priceRange) {
      priceBoundsRef.current = computed;
    }
    return priceBoundsRef.current || computed;
  }, [inventarioData?.propiedades, priceRange]);

  const hasActiveFilters = filterProjectNames.length > 0 || filterModelNames.length > 0 || recamarasFilter.length > 0 || filterLevels.length > 0 || filterBodega !== "todos" || filterEstacionamiento !== "todos" || priceRange !== null;

  const clearAllFilters = () => {
    setFilterProjectNames([]);
    setFilterModelNames([]);
    setRecamarasFilter([]);
    setFilterLevels([]);
    setFilterBodega("todos");
    setFilterEstacionamiento("todos");
    setPriceRange(null);
    priceBoundsRef.current = null;
    setPage(0);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(price);

  const getSchemesForProperty = (prop: any) => prop.esquemas_pago || [];

  const calcSchemeAmounts = (scheme: any, precioLista: number, mesesEfectivos: number = 0) => {
    // Escalonado con monto fijo: tramos_mensualidad trae montos en centavos y las
    // columnas planas (porcentaje_mensualidades=0) no reflejan las mensualidades.
    // Mismo cálculo que calcPaymentPlans en use-offer-db.ts.
    const tramos = scheme.tramos_mensualidad;
    const isEscalonadoConMontoFijo = Array.isArray(tramos) && tramos.length > 0
      && tramos.some((t: any) => (t.monto_mensualidad ?? 0) > 0);

    if (isEscalonadoConMontoFijo) {
      const pctDesc = Number(scheme.porcentaje_descuento_aumento ?? 0);
      const precioFinal = precioLista * (1 + pctDesc / 100);
      const enganche = precioFinal * (Number(scheme.porcentaje_enganche ?? 0) / 100);

      let meses: number;
      let mensualidadesTotal: number;
      let mensualidad: number;
      if (mesesEfectivos > 0) {
        // Esquema dinámico: recalcular meses contra la fecha de entrega actual del proyecto
        meses = mesesEfectivos;
        mensualidad = ((tramos.find((t: any) => (t.monto_mensualidad ?? 0) > 0)?.monto_mensualidad || 0) / 100);
        mensualidadesTotal = mensualidad * meses;
      } else {
        const tramosExpanded = expandirTramos(tramos);
        meses = tramosExpanded.reduce((s: number, t: any) => s + (Number(t.numero_mensualidades) || 0), 0);
        mensualidadesTotal = tramosExpanded.reduce((s: number, t: any) =>
          s + ((t.monto_mensualidad || 0) / 100) * (Number(t.numero_mensualidades) || 0), 0);
        mensualidad = meses > 0 ? mensualidadesTotal / meses : 0;
      }

      const entrega = Math.max(0, precioFinal - enganche - mensualidadesTotal);
      return {
        precioAjustado: precioFinal,
        enganche,
        mensualidadesTotal,
        entrega,
        mensualidad,
        numMensualidades: meses,
        porcentajeMensualidades: precioFinal > 0 ? (mensualidadesTotal / precioFinal) * 100 : 0,
        porcentajeEntrega: precioFinal > 0 ? (entrega / precioFinal) * 100 : 0,
      };
    }

    const result = calcDynamicScheme(scheme, precioLista, mesesEfectivos);
    return {
      precioAjustado: result.precioFinal,
      enganche: result.enganche,
      mensualidadesTotal: result.mensualidadesTotal,
      entrega: result.entrega,
      mensualidad: result.mensualidad,
      numMensualidades: result.meses,
      porcentajeMensualidades: result.porcentajeMensualidades,
      porcentajeEntrega: result.porcentajeEntrega,
    };
  };

  // Esquema escalonado: el monto mensual vive en tramos_mensualidad. Usa el mismo
  // cálculo que la oferta digital / PDF (calcEscalonadoScheme, compartido en escalonadoUtils).
  const calcEscalonadoAmounts = (scheme: any, precioLista: number, mesesEfectivos: number = 0) => {
    const result = calcEscalonadoScheme(scheme, precioLista, mesesEfectivos);
    return {
      precioAjustado: result.precioFinal,
      enganche: result.enganche,
      mensualidadesTotal: result.mensualidadesTotal,
      entrega: result.entrega,
      mensualidad: result.mensualidad,
      numMensualidades: result.meses,
      porcentajeMensualidades: result.porcentajeMensualidades,
      porcentajeEntrega: result.porcentajeEntrega,
    };
  };

  const { data: selectedProjectData } = useQuery({
    queryKey: ["proyecto-fecha-entrega", selectedProperty?.proyecto_id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("proyectos").select("id, fecha_entrega, fecha_entrega_proyecto").eq("id", selectedProperty.proyecto_id).maybeSingle();
      return data;
    },
    enabled: !!selectedProperty?.proyecto_id,
  });
  // Misma prioridad que la oferta digital: fecha_entrega_proyecto ?? fecha_entrega
  const fechaEntregaEfectiva = selectedProjectData?.fecha_entrega_proyecto ?? selectedProjectData?.fecha_entrega;
  // Mensualidades restantes: hoy → entrega − 1 mes (mes de entrega = escrituración),
  // misma regla que la oferta digital / PDF (mesesMensualidadesRestantes).
  const efectivaMesesAgente = mesesMensualidadesRestantes(fechaEntregaEfectiva);

  // Esquemas del proyecto traídos directo de la tabla (incluye tramos_mensualidad),
  // igual que la oferta digital. El RPC del listado no devuelve tramos, así que los
  // esquemas escalonados solo pueden calcular sus mensualidades con estos datos.
  const { data: schemesDirect } = useQuery({
    queryKey: ["esquemas-proyecto-agente", selectedProperty?.proyecto_id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("esquemas_pago")
        .select("id, nombre, porcentaje_descuento_aumento, porcentaje_enganche, porcentaje_mensualidades, numero_mensualidades, porcentaje_entrega, es_manual, orden, tramos_mensualidad")
        .eq("id_proyecto", selectedProperty.proyecto_id)
        .eq("activo", true)
        .eq("es_manual", false)
        .order("orden", { ascending: true });
      return data || [];
    },
    enabled: !!selectedProperty?.proyecto_id,
  });
  // Preferir esquemas directos (con tramos); si aún no cargan, usar los del RPC como fallback.
  const dialogSchemes = (schemesDirect && schemesDirect.length > 0)
    ? schemesDirect
    : (selectedProperty ? getSchemesForProperty(selectedProperty) : []);

  useEffect(() => { setPage(0); }, [filterProjectNames, filterModelNames, recamarasFilter, filterLevels, filterBodega, filterEstacionamiento, priceRange, normalizedSearchQuery]);

  // Guardar filtros para no reiniciarlos al navegar dentro de la sesión.
  useEffect(() => {
    const payload = { filterProjectNames, filterModelNames, filterLevels, filterBodega, filterEstacionamiento, sortOrder, recamarasFilter, priceRange, searchQuery };
    try { sessionStorage.setItem(FILTERS_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
  }, [filterProjectNames, filterModelNames, filterLevels, filterBodega, filterEstacionamiento, sortOrder, recamarasFilter, priceRange, searchQuery]);
  useEffect(() => { setSelectedSchemeId(null); }, [selectedProperty?.id]);


  const filteredPageProperties = useMemo(() => {
    if (!isSearchActive) {
      return pageProperties;
    }

    return pageProperties.filter((p) =>
      String(p.numero_propiedad ?? "").toLowerCase().includes(normalizedSearchQuery)
    );
  }, [isSearchActive, normalizedSearchQuery, pageProperties]);

  const recamarasOptions = availableRecamaras.length > 0
    ? [...new Set([...availableRecamaras.map(n => n <= 3 ? String(n) : '4+')])]
    : ['1', '2', '3', '4+'];

  const triStateOptions: { value: TriState; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "si", label: "Sí" },
    { value: "no", label: "No" },
  ];


  const activeFilterCount = (filterProjectNames.length > 0 ? 1 : 0) + (filterModelNames.length > 0 ? 1 : 0) + (recamarasFilter.length > 0 ? 1 : 0) + (filterLevels.length > 0 ? 1 : 0) + (filterBodega !== "todos" ? 1 : 0) + (filterEstacionamiento !== "todos" ? 1 : 0) + (priceRange ? 1 : 0);

  const filterContent = (
    <div className="space-y-5">
      {availableProjectNames.length > 0 && (
        <FilterSelect
          label="Desarrollo"
          value={filterProjectNames[0] || "all"}
          onChange={(v) => setFilterProjectNames(v === "all" ? [] : [v])}
          options={[{ v: "all", l: "Todos" }, ...availableProjectNames.map((n) => ({ v: n, l: projectCounts[n] != null ? `${n} (${projectCounts[n]})` : n }))]}
        />
      )}
      {availableModelNames.length > 0 && (
        <FilterSelect
          label="Modelo"
          value={filterModelNames[0] || "all"}
          onChange={(v) => setFilterModelNames(v === "all" ? [] : [v])}
          options={[{ v: "all", l: "Todos" }, ...availableModelNames.map((m) => ({ v: m, l: m }))]}
        />
      )}
      {availableLevelOptions.length > 0 && (
        <FilterSelect
          label="Nivel"
          value={filterLevels[0] || "all"}
          onChange={(v) => setFilterLevels(v === "all" ? [] : [v])}
          options={[{ v: "all", l: "Todos los niveles" }, ...availableLevelOptions.map((l) => ({ v: l, l: `Nivel ${l}` }))]}
        />
      )}
      <FilterSelect
        label="Recámaras"
        value={recamarasFilter[0] || "all"}
        onChange={(v) => setRecamarasFilter(v === "all" ? [] : [v])}
        options={[{ v: "all", l: "Todas" }, ...recamarasOptions.map((o) => ({ v: o, l: `${o} recámara${o === "1" ? "" : "s"}` }))]}
      />

      <div className="grid grid-cols-2 gap-3">
        <FilterSelect
          label="Bodega"
          value={filterBodega}
          onChange={(v) => setFilterBodega(v as TriState)}
          options={triStateOptions.map((o) => ({ v: o.value, l: o.label }))}
        />
        <FilterSelect
          label="Estacionamiento"
          value={filterEstacionamiento}
          onChange={(v) => setFilterEstacionamiento(v as TriState)}
          options={triStateOptions.map((o) => ({ v: o.value, l: o.label }))}
        />
      </div>

      {/* Rango de precio (al final) */}
      <div className="flex w-full flex-col gap-2.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-xs font-medium text-muted-foreground">Rango de precio</span>
          {priceRange && (
            <button onClick={() => setPriceRange(null)} className="text-[11px] font-medium text-[hsl(158_64%_38%)]">Restablecer</button>
          )}
        </div>
        <Slider
          min={priceBounds.min}
          max={priceBounds.max}
          step={10000}
          value={priceRangeLocal || priceRange || [priceBounds.min, priceBounds.max]}
          onValueChange={(val) => setPriceRangeLocal(val as [number, number])}
          onValueCommit={(val) => { setPriceRangeLocal(null); setPriceRange(val as [number, number]); }}
          className="w-full py-1 [&>span]:h-5 [&_[role=slider]]:h-5 [&_[role=slider]]:w-5"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-[#F6F7F8] px-2.5 py-1.5 text-xs font-semibold tabular-nums text-[#171A1D]">{formatPrice((priceRangeLocal || priceRange)?.[0] ?? priceBounds.min)}</span>
          <span className="text-[11px] text-muted-foreground">a</span>
          <span className="rounded-md bg-[#F6F7F8] px-2.5 py-1.5 text-xs font-semibold tabular-nums text-[#171A1D]">{formatPrice((priceRangeLocal || priceRange)?.[1] ?? priceBounds.max)}</span>
        </div>
      </div>
    </div>
  );

  const handleOpenFilters = () => {
    setFiltersDrawerOpen(true);
    track({ page: 'agent_unidades', elementId: 'btn_filtros', elementLabel: 'Filtros' });
  };

  const handleClickUnit = (prop: any) => {
    setSelectedProperty(prop);
    track({ page: 'agent_unidades', elementId: 'btn_detalle_unidad', elementLabel: `Depto ${prop.numero || prop.id}`, metadata: { propiedad_id: prop.id, proyecto: prop.proyecto_nombre } });
  };

  const handleConfigureOffer = () => {
    track({ page: 'agent_unidades', elementId: 'btn_configurar_oferta', elementLabel: 'Configurar Oferta', metadata: { propiedad_id: selectedProperty?.id, proyecto: selectedProperty?.proyecto_nombre } });
  };

  return (
    <div className="pb-24 light" style={{ colorScheme: "light" }}>
      {/* No verificado badge - fixed */}
      {isAgentRole && !isLoadingOnboarding && percentage < 100 && (
        <div className="fixed top-3 right-4 z-50">
          <Badge
            variant="outline"
            className="border-destructive/30 text-destructive gap-1 bg-white shadow-sm"
          >
            <span className="h-2 w-2 rounded-full bg-destructive inline-block" />
            No verificado
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[hsl(var(--agent-bg))] pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/admin/agent/inventario")} className="h-10 w-10 shrink-0 rounded-md bg-white border border-gray-200 flex items-center justify-center transition-colors hover:bg-gray-50" title="Regresar">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9AA3AD]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm font-medium text-[#171A1D] placeholder:text-[#9AA3AD] shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
              placeholder="Buscar unidad…"
            />
          </div>
          <button
            onClick={handleOpenFilters}
            className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-[#171A1D] shadow-sm transition-colors hover:bg-gray-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={clearAllFilters}
            disabled={!hasActiveFilters}
            title="Limpiar filtros"
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors",
              hasActiveFilters
                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-gray-200 bg-white text-gray-300 cursor-not-allowed"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filtros - panel lateral derecho (diseño CC) */}
      <Sheet open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
        <SheetContent side="right" className="light w-full sm:w-[380px] sm:max-w-[380px] p-0 gap-0 flex flex-col">
          <SheetHeader className="space-y-2 border-b px-6 pt-6 pb-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <SlidersHorizontal className="size-4" /> Filtros
            </SheetTitle>
            <p className="text-sm text-muted-foreground">Filtra las unidades disponibles. Los cambios se aplican al instante.</p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">{filterContent}</div>
          <div className="border-t px-6 py-4 flex items-center justify-between gap-3">
            <button
              onClick={clearAllFilters}
              disabled={!hasActiveFilters}
              className="h-9 rounded-md px-3 text-[13px] font-medium text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
            >
              Limpiar
            </button>
            <button
              onClick={() => setFiltersDrawerOpen(false)}
              className="h-9 rounded-md border border-primary bg-white px-4 text-[13px] font-medium text-primary hover:bg-primary/[0.06]"
            >
              Ver resultados
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Properties Grid */}
      <div className="mt-2">
        {isLoading || !paramsResolved ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPageProperties.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay unidades disponibles</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPageProperties.map((prop: any) => (
                <UnitCard key={prop.id} prop={prop} formatPrice={formatPrice} onClick={() => handleClickUnit(prop)} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-4 pb-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                  {isFetching && !isLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1.5" />}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Property Detail - modal centrado (izq carrusel · der info) */}
      <Dialog open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <DialogContent
          className="light w-[95vw] max-w-4xl p-0 gap-0 overflow-hidden rounded-md max-h-[90vh]"
          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
        >
          <DialogTitle className="sr-only">Detalle del departamento</DialogTitle>
          <DialogDescription className="sr-only">Información, precio y esquemas de pago de la unidad seleccionada</DialogDescription>
          {selectedProperty && (
            <div className="grid max-h-[90vh] md:grid-cols-2">
              {/* Izquierda: carrusel (llena la columna) */}
              <div className="relative bg-gray-100 aspect-[4/3] md:aspect-auto md:h-[90vh]">
                {selectedProperty.model_images?.length > 0 ? (
                  <DetailCarousel images={selectedProperty.model_images} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Package className="h-10 w-10 text-muted-foreground/30" /></div>
                )}
              </div>
              {/* Derecha: información */}
              <div className="flex min-h-0 flex-col md:max-h-[90vh]">
                <div className="shrink-0 space-y-0.5 px-[22px] pt-[22px] pb-3">
                  <h2 className="text-[18px] font-bold text-[#171A1D]">Departamento {selectedProperty.numero || selectedProperty.id}</h2>
                  <p className="text-[12px] font-normal text-[#6B7280]">{selectedProperty.proyecto_nombre}</p>
                </div>
                <div className="flex-1 overflow-y-auto px-[22px] space-y-4 pb-5">
                {/* Contexto */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedProperty.edificio_nombre && <span className="inline-flex items-center rounded-md bg-[#F6F7F8] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]">{selectedProperty.edificio_nombre}</span>}
                  {selectedProperty.modelo_nombre && <span className="inline-flex items-center rounded-md bg-[#F6F7F8] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]">{selectedProperty.modelo_nombre}</span>}
                  {selectedProperty.piso && <span className="inline-flex items-center gap-1 rounded-md bg-[#F6F7F8] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]"><Layers className="h-3 w-3 text-[hsl(158_64%_38%)]" /> Nivel {selectedProperty.piso}</span>}
                </div>

                {/* Specs */}
                <div className="flex flex-wrap gap-x-5 gap-y-2.5 rounded-md border border-[#ECEEF0] bg-white p-3.5 text-sm font-medium text-[#4B5563]">
                  {selectedProperty.m2_total > 0 && <span className="flex items-center gap-1.5"><Maximize2 className="h-4 w-4 text-[hsl(158_64%_38%)]" /> {selectedProperty.m2_total.toFixed(2)} m²</span>}
                  {selectedProperty.recamaras > 0 && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-[hsl(158_64%_38%)]" /> {selectedProperty.recamaras} rec.</span>}
                  {selectedProperty.banos > 0 && <span className="flex items-center gap-1.5"><Bath className="h-4 w-4 text-[hsl(158_64%_38%)]" /> {selectedProperty.banos} baño{selectedProperty.banos > 1 ? "s" : ""}</span>}
                  {selectedProperty.medio_bano > 0 && <span className="flex items-center gap-1.5"><ShowerHead className="h-4 w-4 text-[hsl(158_64%_38%)]" /> {selectedProperty.medio_bano} ½ baño</span>}
                  {selectedProperty.bodegas_count > 0 && <span className="flex items-center gap-1.5"><img src={bodegaIcon} alt="" className="h-4 w-4 opacity-70" /> {selectedProperty.bodegas_count} bodega{selectedProperty.bodegas_count > 1 ? "s" : ""}</span>}
                  {selectedProperty.estacionamientos_count > 0 && <span className="flex items-center gap-1.5"><Car className="h-4 w-4 text-[hsl(158_64%_38%)]" /> {selectedProperty.estacionamientos_count} estac.{selectedProperty.estacionamientos_tipos?.length > 0 && <span className="text-[#9AA3AD]"> ({[...new Set(selectedProperty.estacionamientos_tipos as string[])].join(", ")})</span>}</span>}
                </div>

                <PropertyFloorPlanButton propertyId={selectedProperty.id} />
                {selectedProperty.precio_lista > 0 && (
                  <div className="rounded-md border border-[hsl(158_64%_38%)]/20 bg-[hsl(158_64%_38%)]/[0.06] px-5 py-4 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(158_64%_38%)]/80">Precio de Lista</p>
                    <p className="mt-1 text-2xl font-bold text-[hsl(158_64%_38%)]">{formatPrice(selectedProperty.precio_lista)}</p>
                  </div>
                )}
                {dialogSchemes.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-[#171A1D] flex items-center gap-2 py-2">
                      <span className="h-4 w-1 rounded-full bg-[hsl(158_64%_38%)]" />
                      Esquemas de Pago
                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[hsl(158_64%_38%)]/10 text-[11px] font-semibold text-[hsl(158_64%_38%)]">{dialogSchemes.length}</span>
                    </p>
                    <div className="space-y-2.5 pt-1.5">
                      {dialogSchemes.map((scheme: any) => {
                        const isSchemeEscalonado = Array.isArray(scheme.tramos_mensualidad)
                          && scheme.tramos_mensualidad.some((t: any) => (t.monto_mensualidad ?? 0) > 0);
                        const mesesParaScheme = (scheme.porcentaje_mensualidades > 0 && efectivaMesesAgente > 0) ? efectivaMesesAgente : 0;
                        const amounts = isSchemeEscalonado
                          ? calcEscalonadoAmounts(scheme, selectedProperty.precio_lista, efectivaMesesAgente)
                          : calcSchemeAmounts(scheme, selectedProperty.precio_lista, mesesParaScheme);
                        const isSelected = selectedSchemeId === scheme.id;
                        return (
                          <button
                            key={scheme.id}
                            type="button"
                            onClick={() => setSelectedSchemeId(prev => prev === scheme.id ? null : scheme.id)}
                            className={`relative w-full text-left rounded-md border p-4 space-y-3 transition-all duration-200 ${
                              isSelected
                                ? "border-[hsl(158_64%_38%)] bg-[hsl(158_64%_38%)]/[0.05] ring-2 ring-[hsl(158_64%_38%)]/20 shadow-sm"
                                : "border-border/60 bg-card hover:border-[hsl(158_64%_38%)]/40 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`h-2 w-2 rounded-full shrink-0 transition-colors ${isSelected ? "bg-[hsl(158_64%_38%)]" : "bg-muted-foreground/25"}`} />
                                <p className="font-semibold text-sm text-[hsl(var(--agent-text,0_0%_10%))] truncate">{scheme.nombre}</p>
                              </div>
                              {scheme.porcentaje_descuento_aumento !== 0 && scheme.porcentaje_descuento_aumento != null && (
                                <Badge variant="outline" className={scheme.porcentaje_descuento_aumento < 0
                                  ? "shrink-0 border-[hsl(158_64%_38%)]/30 bg-[hsl(158_64%_38%)]/10 text-[hsl(158_64%_38%)] text-[11px] font-semibold"
                                  : "shrink-0 border-destructive/30 bg-destructive/10 text-destructive text-[11px] font-semibold"}>
                                  {scheme.porcentaje_descuento_aumento > 0 ? "+" : ""}{scheme.porcentaje_descuento_aumento}%
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {scheme.porcentaje_enganche > 0 && (
                                <span className="inline-flex items-baseline gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                  <span className="font-semibold text-[hsl(var(--agent-text,0_0%_10%))]">{scheme.porcentaje_enganche}%</span> Enganche
                                </span>
                              )}
                              {amounts.porcentajeMensualidades > 0 && (
                                <span className="inline-flex items-baseline gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                  <span className="font-semibold text-[hsl(var(--agent-text,0_0%_10%))]">{amounts.porcentajeMensualidades.toFixed(1)}%</span> Mensualidades
                                </span>
                              )}
                              {amounts.porcentajeEntrega > 0 && (
                                <span className="inline-flex items-baseline gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                  <span className="font-semibold text-[hsl(var(--agent-text,0_0%_10%))]">{amounts.porcentajeEntrega.toFixed(1)}%</span> Entrega
                                </span>
                              )}
                              {amounts.numMensualidades > 0 && (
                                <span className="inline-flex items-baseline gap-1 rounded-md bg-[hsl(158_64%_38%)]/10 px-2 py-1 text-[11px] text-[hsl(158_64%_38%)]/80">
                                  <span className="font-semibold text-[hsl(158_64%_38%)]">{amounts.numMensualidades}</span> meses
                                </span>
                              )}
                            </div>
                            {selectedProperty.precio_lista > 0 && (
                              <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-3 border-t border-border/50">
                                {amounts.enganche > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Enganche</p>
                                    <p className="text-xs font-semibold text-[hsl(var(--agent-text,0_0%_10%))]">{formatPrice(amounts.enganche)}</p>
                                  </div>
                                )}
                                {amounts.mensualidadesTotal > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mensualidad</p>
                                    <p className="text-xs font-semibold text-[hsl(var(--agent-text,0_0%_10%))]">
                                      {formatPrice(amounts.mensualidad)}
                                      {amounts.numMensualidades > 0 && <span className="font-normal text-muted-foreground"> × {amounts.numMensualidades}</span>}
                                    </p>
                                  </div>
                                )}
                                {amounts.entrega > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Entrega</p>
                                    <p className="text-xs font-semibold text-[hsl(var(--agent-text,0_0%_10%))]">{formatPrice(amounts.entrega)}</p>
                                  </div>
                                )}
                                <div className="space-y-0.5">
                                  <p className="text-[10px] uppercase tracking-wide text-[hsl(158_64%_38%)]/70">Precio final</p>
                                  <p className="text-xs font-bold text-[hsl(158_64%_38%)]">{formatPrice(amounts.precioAjustado)}</p>
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {selectedSchemeId && (
                  <div className="bg-[hsl(158_64%_38%)]/[0.07] border border-[hsl(158_64%_38%)]/20 rounded-md px-3 py-2.5 text-xs text-[hsl(158_64%_38%)] font-medium flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Plan seleccionado: <span className="font-semibold">{dialogSchemes.find((s: any) => s.id === selectedSchemeId)?.nombre || ""}</span></span>
                  </div>
                )}
              </div>
              <div className="shrink-0 px-[22px] py-4 border-t border-[#ECEEF0] bg-background">
                {canGenerateOffer && (
                  isAgentRole && !hasTrainingComplete ? (
                    <Button className="w-full gap-2 rounded-md" size="lg" disabled>
                      <FileText className="h-5 w-5" /> Completa tu capacitación para generar ofertas
                    </Button>
                  ) : (
                  <div onClick={(e) => { e.stopPropagation(); handleConfigureOffer(); }}>
                    <NewOfferDialog
                      propertyId={selectedProperty.id}
                      propertyNumber={selectedProperty.numero || `${selectedProperty.id}`}
                      hideManualMode={true}
                      hidePdfOptions={true}
                      preSelectedSchemeId={selectedSchemeId}
                      hideBankingInPdf={isAgentRole && !hasBasicIdentityComplete}
                      forceLight={true}
                      enableDigitalOffer={canGenerateDigitalOffer}
                      customTrigger={
                        <button className="group relative w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-md border border-[hsl(158_64%_38%)] bg-white text-[hsl(158_64%_38%)] font-semibold text-sm hover:bg-[hsl(158_64%_38%)] hover:text-white active:scale-[0.98] transition-all">
                          <FileText className="h-5 w-5" />
                          <span>
                            Configurar Oferta
                            {selectedSchemeId && (
                              <span className="ml-1 text-xs opacity-80">({dialogSchemes.find((s: any) => s.id === selectedSchemeId)?.nombre})</span>
                            )}
                          </span>
                        </button>
                      }
                    />
                  </div>
                  )
                )}
              </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Unit card component
const UnitCard = React.memo(({ prop, formatPrice, onClick }: {
  prop: any;
  formatPrice: (price: number) => string;
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
    className="cursor-pointer overflow-hidden rounded-md border border-[#E7E9EC] bg-white shadow-[0_1px_3px_rgba(20,30,25,0.04)] transition-colors hover:border-[#CBD2D9]"
  >
    <div className="relative aspect-video overflow-hidden bg-gray-100">
      <UnitCardImage images={prop.model_images || []} />
      <span className="absolute right-2.5 top-2.5 rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-[#171A1D] shadow-sm">
        Depto. {prop.numero || prop.id}
      </span>
    </div>
    <div className="p-4 space-y-2.5">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-bold text-[#171A1D]">{prop.modelo_nombre || `Depto. ${prop.numero || prop.id}`}</p>
        <p className="truncate text-[11.5px] font-medium text-[#9AA3AD]">
          {prop.proyecto_nombre}{prop.piso ? ` · Nivel ${prop.piso}` : ""}
        </p>
      </div>
      {prop.precio_lista > 0 && (
        <p className="text-[15px] font-bold tabular-nums text-primary">{formatPrice(prop.precio_lista)}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#F0F1F3] pt-3 text-[13px] font-medium text-[#4B5563]">
        {prop.m2_total > 0 && <span className="flex items-center gap-1.5"><Maximize2 className="h-4 w-4 text-primary" /> {prop.m2_total.toFixed(1)} m²</span>}
        {prop.recamaras > 0 && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-primary" /> {prop.recamaras}</span>}
        {prop.banos > 0 && <span className="flex items-center gap-1.5"><Bath className="h-4 w-4 text-primary" /> {prop.banos}</span>}
        {prop.bodegas_count > 0 && <span className="flex items-center gap-1.5"><img src={bodegaIcon} alt="" className="h-4 w-4 opacity-60" /> {prop.bodegas_count}</span>}
        {prop.estacionamientos_count > 0 && <span className="flex items-center gap-1.5"><Car className="h-4 w-4 text-primary" /> {prop.estacionamientos_count}</span>}
      </div>
    </div>
  </div>
));
UnitCard.displayName = "UnitCard";

// Simple image for unit card
const UnitCardImage = ({ images }: { images: any[] }) => {
  if (images.length === 0) {
    return (
      <div className="h-full bg-muted/60 flex items-center justify-center">
        <Package className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }
  return <img src={optimizedImage(images[0].url, { width: 480, resize: "cover" })} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />;
};

// Detail carousel
const DetailCarousel = ({ images }: { images: any[] }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [currentIndex, setCurrentIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  if (images.length === 0) return null;

  return (
    <div className="relative h-full w-full">
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {images.map((img: any, i: number) => (
            <div key={img.id || i} className="min-w-0 flex-[0_0_100%] h-full">
              <OptImg src={img.url} w={900} alt="" className="w-full h-full object-contain" />
            </div>
          ))}
        </div>
      </div>
      {images.length > 1 && (
        <>
          <button onClick={scrollPrev} className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/60">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={scrollNext} className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/60">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_: any, i: number) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === currentIndex ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AgentUnidadesProyecto;
