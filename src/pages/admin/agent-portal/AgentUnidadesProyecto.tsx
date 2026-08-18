import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { mesesMensualidadesRestantes, calcDynamicScheme, calcEscalonadoScheme, expandirTramos } from "@/utils/escalonadoUtils";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useInventarioDisponiblePaginado } from "@/hooks/useInventarioDisponiblePaginado";
import type { InventarioPropiedad } from "@/hooks/useInventarioDisponible";
import { fetchExtrasDetalleUnidad, fetchExtrasPorPropiedad, precioTotalUnidad } from "@/lib/inventario/precio-unidad";
import { resolverMensualidadesFijas } from "@/lib/offers/mensualidades-fijas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalFilters, FilterSelect, FilterField } from "@/components/ui/modal-filters";
import { ModalViewerDetail } from "@/components/ui/modal-viewer-detail";
import { Building2, Loader2, ArrowLeft, BedDouble, Bath, ShowerHead, Maximize2, FileText, ChevronLeft, ChevronRight, X, Layers, Car, Search, Package, Warehouse, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";
import { Slider } from "@/components/ui/slider";
import { NewOfferDialog } from "@/components/admin/NewOfferDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentOnboardingStatus } from "@/hooks/useAgentOnboardingStatus";
import { useInventarioPortal } from "@/hooks/useInventarioPortal";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { PropertyFloorPlanButton } from "@/components/admin/agent-portal/PropertyFloorPlanButton";
import { OptImg } from "@/components/ui/opt-img";
import {
  ESTACIONAMIENTO_TODOS,
  filtroACantidades,
  normalizarFiltroEstacionamiento,
  opcionesEstacionamiento,
  type FiltroEstacionamiento,
} from "@/utils/estacionamientoFiltro";

const PAGE_SIZE = 30;
type SortOrder = "none" | "asc" | "desc";
type TriState = "todos" | "si" | "no";

const AgentUnidadesProyecto = () => {
  const [searchParams] = useSearchParams();
  const proyectoIdParam = searchParams.get("proyecto");
  const modeloIdParam = searchParams.get("modelo");
  const openFiltersParam = searchParams.get("openFilters");
  const navigate = useNavigate();

  // Misma vista para Portal Agente y Portal del Personal: el portal activo define
  // rutas, permisos, analítica y los filtros persistidos.
  const { basePath, portalPrefix, permisos: inventarioPerms } = useInventarioPortal();
  const PAGE = `${portalPrefix}_unidades`;

  // Persistencia de filtros (sessionStorage). Si se llega con proyecto/modelo en la
  // URL, esos mandan y se ignora lo guardado (contexto nuevo desde inventario/detalle).
  const FILTERS_KEY = `${portalPrefix}-unidades-filters`;
  const hasUrlPreselect = !!proyectoIdParam || !!modeloIdParam;
  const storedFilters: any = (() => {
    if (hasUrlPreselect) return {};
    try { return JSON.parse(sessionStorage.getItem(FILTERS_KEY) || "{}"); } catch { return {}; }
  })();
  const canGenerateOffer = inventarioPerms?.canGenerateOffer;
  const canGenerateDigitalOffer = inventarioPerms?.canGenerateDigitalOffer;
  const { profile } = useAuth();
  const { impersonatedAgentPersonaId, isImpersonating } = useAgentImpersonation();
  const personaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';
  const { percentage, isLoading: isLoadingOnboarding, hasTrainingComplete, hasBasicIdentityComplete } = useAgentOnboardingStatus(personaId);

  // Logging, tracking
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();

  // Log page view
  useEffect(() => {
    registrarVista(`${basePath}/unidades`);
    track({ page: PAGE, elementId: 'page_view', elementType: 'page' });
  }, [basePath, PAGE]);

  // State declarations from line 41 to line 100
  const [page, setPage] = useState(0);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [selectedSchemeId, setSelectedSchemeId] = useState<number | null>(null);

  // Filters
  const [filterProjectNames, setFilterProjectNames] = useState<string[]>(() => storedFilters.filterProjectNames ?? []);
  const [filterModelNames, setFilterModelNames] = useState<string[]>(() => storedFilters.filterModelNames ?? []);
  const [filterLevels, setFilterLevels] = useState<string[]>(() => storedFilters.filterLevels ?? []);
  const [filterBodega, setFilterBodega] = useState<TriState>(() => storedFilters.filterBodega ?? "todos");
  // Cantidad exacta de cajones ("todos" | "0" | "1" | …). Lo guardado por la versión
  // sí/no del filtro se normaliza a "todos".
  const [filterEstacionamiento, setFilterEstacionamiento] = useState<FiltroEstacionamiento>(
    () => normalizarFiltroEstacionamiento(storedFilters.filterEstacionamiento),
  );
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
      navigate(`${basePath}/unidades`, { replace: true });
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
  const estacionamientosValue = filtroACantidades(filterEstacionamiento);

  const { data: inventarioData, isLoading: isLoadingData, isFetching } = useInventarioDisponiblePaginado({
    projectNames: filterProjectNames.length > 0 ? filterProjectNames : undefined,
    modelNames: filterModelNames.length > 0 ? filterModelNames : undefined,
    bedrooms: bedroomsForQuery,
    levels: filterLevels.length > 0 ? filterLevels : undefined,
    hasBodega: bodegaValue,
    estacionamientos: estacionamientosValue,
    sortPrice: sortOrder === "none" ? null : sortOrder,
    minPrice: priceRange ? priceRange[0] : null,
    maxPrice: priceRange ? priceRange[1] : null,
    page: requestedPage,
    pageSize: requestedPageSize,
  });

  // Valor de bodegas y estacionamientos de las unidades de la página. La RPC del
  // inventario solo devuelve el conteo, así que el costo se trae aparte (una consulta
  // por tabla para las ≤30 unidades visibles) y se suma al precio de lista: la tarjeta
  // muestra el valor total, que es lo que el cliente termina pagando.
  const propiedadIdsPagina = useMemo(
    () => (inventarioData?.propiedades || []).map((p: InventarioPropiedad) => p.id),
    [inventarioData?.propiedades],
  );
  const { data: extrasPagina } = useQuery({
    queryKey: ["inventario-extras", propiedadIdsPagina],
    queryFn: () => fetchExtrasPorPropiedad(propiedadIdsPagina),
    enabled: propiedadIdsPagina.length > 0,
    staleTime: 5 * 60_000,
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
        // Lo que se muestra: precio de lista + bodegas + estacionamientos de esa unidad.
        precio_total: precioTotalUnidad(p.precio_lista, extrasPagina?.get(p.id)),
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
  }, [inventarioData?.propiedades, extrasPagina]);

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

  const hasActiveFilters = filterProjectNames.length > 0 || filterModelNames.length > 0 || recamarasFilter.length > 0 || filterLevels.length > 0 || filterBodega !== "todos" || filterEstacionamiento !== ESTACIONAMIENTO_TODOS || priceRange !== null;

  const clearAllFilters = () => {
    setFilterProjectNames([]);
    setFilterModelNames([]);
    setRecamarasFilter([]);
    setFilterLevels([]);
    setFilterBodega("todos");
    setFilterEstacionamiento(ESTACIONAMIENTO_TODOS);
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

  // Modo fijo de mensualidades (unidad → proyecto). Si no está configurado, `null` y
  // se conserva la regla dinámica de siempre.
  const { data: mensualidadesFijasAgente } = useQuery({
    queryKey: ["mensualidades-fijas-agente", selectedProperty?.id, selectedProperty?.proyecto_id],
    queryFn: () => resolverMensualidadesFijas(selectedProperty?.id, selectedProperty?.proyecto_id),
    enabled: !!selectedProperty?.proyecto_id,
  });

  // Mensualidades: si el proyecto/unidad las fija, ese número; si no, hoy → entrega − 1
  // mes (el mes de entrega es la escrituración). Misma regla que la oferta digital / PDF.
  const efectivaMesesAgente = mesesMensualidadesRestantes(
    fechaEntregaEfectiva,
    new Date(),
    mensualidadesFijasAgente,
  );

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

  // Bodegas y estacionamientos de la unidad, con su costo. Misma fuente que la tarjeta
  // del listado (`@/lib/inventario/precio-unidad`): el detalle sí desglosa, la tarjeta
  // solo muestra el total, pero la fórmula es una sola.
  const { data: unidadExtras } = useQuery({
    queryKey: ["unidad-extras-costo", selectedProperty?.id],
    queryFn: () => fetchExtrasDetalleUnidad(selectedProperty?.id),
    enabled: !!selectedProperty?.id,
  });
  const extrasConCosto = (unidadExtras ?? []).filter((e) => e.costo > 0);
  const extrasTotal = extrasConCosto.reduce((suma, e) => suma + e.costo, 0);

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

  // Cantidades de cajones que existen en el inventario consultado (las calcula la RPC
  // antes de aplicar este filtro, así que no se colapsan al elegir una).
  const estacionamientoOptions = opcionesEstacionamiento(inventarioData?.filterOptions?.estacionamientos);

  // El filtro se guarda entre sesiones y el inventario cambia: si la cantidad elegida ya
  // no existe (otro desarrollo, unidad vendida), el select se quedaría en blanco y sin
  // forma de limpiarlo. Se cae a "Todos".
  useEffect(() => {
    if (filterEstacionamiento === ESTACIONAMIENTO_TODOS) return;
    if (estacionamientoOptions.length <= 1) return;
    if (!estacionamientoOptions.some((o) => o.value === filterEstacionamiento)) {
      setFilterEstacionamiento(ESTACIONAMIENTO_TODOS);
    }
  }, [estacionamientoOptions, filterEstacionamiento]);

  const triStateOptions: { value: TriState; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "si", label: "Sí" },
    { value: "no", label: "No" },
  ];


  const activeFilterCount = (filterProjectNames.length > 0 ? 1 : 0) + (filterModelNames.length > 0 ? 1 : 0) + (recamarasFilter.length > 0 ? 1 : 0) + (filterLevels.length > 0 ? 1 : 0) + (filterBodega !== "todos" ? 1 : 0) + (filterEstacionamiento !== ESTACIONAMIENTO_TODOS ? 1 : 0) + (priceRange ? 1 : 0);

  const filterContent = (
    <>
      {availableProjectNames.length > 0 && (
        <FilterSelect
          label="Desarrollo"
          value={filterProjectNames[0] || "all"}
          onChange={(v) => setFilterProjectNames(v === "all" ? [] : [v])}
          options={[{ value: "all", label: "Todos" }, ...availableProjectNames.map((n) => ({ value: n, label: projectCounts[n] != null ? `${n} (${projectCounts[n]})` : n }))]}
        />
      )}
      {availableModelNames.length > 0 && (
        <FilterSelect
          label="Modelo"
          value={filterModelNames[0] || "all"}
          onChange={(v) => setFilterModelNames(v === "all" ? [] : [v])}
          options={[{ value: "all", label: "Todos" }, ...availableModelNames.map((m) => ({ value: m, label: m }))]}
        />
      )}
      {availableLevelOptions.length > 0 && (
        <FilterSelect
          label="Nivel"
          value={filterLevels[0] || "all"}
          onChange={(v) => setFilterLevels(v === "all" ? [] : [v])}
          options={[{ value: "all", label: "Todos los niveles" }, ...availableLevelOptions.map((l) => ({ value: l, label: `Nivel ${l}` }))]}
        />
      )}
      <FilterSelect
        label="Recámaras"
        value={recamarasFilter[0] || "all"}
        onChange={(v) => setRecamarasFilter(v === "all" ? [] : [v])}
        options={[{ value: "all", label: "Todas" }, ...recamarasOptions.map((o) => ({ value: o, label: `${o} recámara${o === "1" ? "" : "s"}` }))]}
      />

      <div className="grid grid-cols-2 gap-3">
        <FilterSelect
          label="Bodega"
          value={filterBodega}
          onChange={(v) => setFilterBodega(v as TriState)}
          options={triStateOptions}
        />
        <FilterSelect
          label="Estacionamiento"
          value={filterEstacionamiento}
          onChange={(v) => setFilterEstacionamiento(v)}
          options={estacionamientoOptions}
        />
      </div>

      {/* Rango de precio (al final) */}
      <FilterField
        label="Rango de precio"
        action={priceRange && (
          <button onClick={() => setPriceRange(null)} className="text-sm font-medium text-primary">Restablecer</button>
        )}
      >
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
          <span className="rounded-md bg-muted px-2.5 py-1.5 text-xs font-semibold tabular-nums text-foreground">{formatPrice((priceRangeLocal || priceRange)?.[0] ?? priceBounds.min)}</span>
          <span className="text-xs text-muted-foreground">a</span>
          <span className="rounded-md bg-muted px-2.5 py-1.5 text-xs font-semibold tabular-nums text-foreground">{formatPrice((priceRangeLocal || priceRange)?.[1] ?? priceBounds.max)}</span>
        </div>
      </FilterField>
    </>
  );

  const handleOpenFilters = () => {
    setFiltersDrawerOpen(true);
    track({ page: PAGE, elementId: 'btn_filtros', elementLabel: 'Filtros' });
  };

  const handleClickUnit = (prop: any) => {
    setSelectedProperty(prop);
    track({ page: PAGE, elementId: 'btn_detalle_unidad', elementLabel: `Depto ${prop.numero || prop.id}`, metadata: { propiedad_id: prop.id, proyecto: prop.proyecto_nombre } });
  };

  const handleConfigureOffer = () => {
    track({ page: PAGE, elementId: 'btn_configurar_oferta', elementLabel: 'Configurar Oferta', metadata: { propiedad_id: selectedProperty?.id, proyecto: selectedProperty?.proyecto_nombre } });
  };

  return (
    <div className="light" style={{ colorScheme: "light" }}>
      {/* No verificado badge - fixed */}
      {isAgentRole && !isLoadingOnboarding && percentage < 100 && (
        <div className="fixed top-3 right-4 z-50">
          <Badge
            variant="outline"
            className="border-destructive/30 text-destructive gap-1 bg-card shadow-sm"
          >
            <span className="h-2 w-2 rounded-full bg-destructive inline-block" />
            No verificado
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(basePath)} className="h-10 w-10 shrink-0 rounded-md bg-card border border-gray-200 flex items-center justify-center transition-colors hover:bg-gray-50" title="Regresar">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-200 bg-card pl-9 pr-3 text-sm font-medium text-foreground placeholder:text-muted-foreground/70 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
              placeholder="Buscar unidad…"
            />
          </div>
          <button
            onClick={handleOpenFilters}
            className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-gray-200 bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-gray-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
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
                : "border-gray-200 bg-card text-gray-300 cursor-not-allowed"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filtros - panel lateral estándar (ui/modal-filters) */}
      <ModalFilters
        open={filtersDrawerOpen}
        onOpenChange={setFiltersDrawerOpen}
        subtitle="Filtra las unidades disponibles. Los cambios se aplican al instante."
        onClear={clearAllFilters}
        clearDisabled={!hasActiveFilters}
        onApply={() => setFiltersDrawerOpen(false)}
        className="light"
      >
        {filterContent}
      </ModalFilters>

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
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                  {isFetching && !isLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1.5" />}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  Siguiente <ChevronRight className="h-4 w-4" /> 
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detalle de unidad - estándar visor + detalle (ui/modal-viewer-detail) */}
      {selectedProperty && (
        <ModalViewerDetail
          open={!!selectedProperty}
          onOpenChange={(open) => !open && setSelectedProperty(null)}
          title={`Departamento ${selectedProperty.numero || selectedProperty.id}`}
          subtitle={selectedProperty.proyecto_nombre}
          className="light"
          resourceClassName="aspect-[4/3] md:aspect-auto"
          resource={
            selectedProperty.model_images?.length > 0 ? (
              <DetailCarousel images={selectedProperty.model_images} />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-10 w-10 text-muted-foreground/30" />
              </div>
            )
          }
          footer={
            <>
              <Button variant="cancel" onClick={() => setSelectedProperty(null)}>Cerrar</Button>
              {canGenerateOffer && (
                isAgentRole && !hasTrainingComplete ? (
                  <Button variant="primary-outline" disabled>
                     Completa tu capacitación
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
                        <Button variant="primary-outline">
                          Configurar Oferta
                          {selectedSchemeId && (
                            <span className="ml-1 text-xs opacity-80">({dialogSchemes.find((s: any) => s.id === selectedSchemeId)?.nombre})</span> )}
                        </Button>
                      }
                    />
                  </div>
                )
              )}
            </>
          }
        >
                {/* Contexto */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedProperty.edificio_nombre && <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{selectedProperty.edificio_nombre}</span>}
                  {selectedProperty.modelo_nombre && <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{selectedProperty.modelo_nombre}</span>}
                  {selectedProperty.piso && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"><Layers className="h-3 w-3 text-primary" /> Nivel {selectedProperty.piso}</span>}
                </div>

                {/* Specs */}
                <div className="flex flex-wrap gap-x-5 gap-y-2.5 rounded-md border border-border bg-card p-3.5 text-sm font-medium text-muted-foreground">
                  {selectedProperty.m2_total > 0 && <span className="flex items-center gap-1.5"><Maximize2 className="h-4 w-4 text-primary" /> {selectedProperty.m2_total.toFixed(2)} m²</span>}
                  {selectedProperty.recamaras > 0 && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-primary" /> {selectedProperty.recamaras} rec.</span>}
                  {selectedProperty.banos > 0 && <span className="flex items-center gap-1.5"><Bath className="h-4 w-4 text-primary" /> {selectedProperty.banos} baño{selectedProperty.banos > 1 ? "s" : ""}</span>}
                  {selectedProperty.medio_bano > 0 && <span className="flex items-center gap-1.5"><ShowerHead className="h-4 w-4 text-primary" /> {selectedProperty.medio_bano} ½ baño</span>}
                  {selectedProperty.bodegas_count > 0 && <span className="flex items-center gap-1.5"><Warehouse className="h-4 w-4 text-primary" /> {selectedProperty.bodegas_count} bodega{selectedProperty.bodegas_count > 1 ? "s" : ""}</span>}
                  {selectedProperty.estacionamientos_count > 0 && <span className="flex items-center gap-1.5"><Car className="h-4 w-4 text-primary" /> {selectedProperty.estacionamientos_count} estac.{selectedProperty.estacionamientos_tipos?.length > 0 && <span className="text-muted-foreground/70"> ({[...new Set(selectedProperty.estacionamientos_tipos as string[])].join(", ")})</span>}</span>}
                </div>

                <PropertyFloorPlanButton propertyId={selectedProperty.id} />
                {selectedProperty.precio_lista > 0 && (
                  <div className="rounded-md border border-primary/20 bg-primary/[0.06] px-5 py-4">
                    {extrasTotal > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-muted-foreground">Propiedad</span>
                          <span className="font-semibold tabular-nums text-foreground">{formatPrice(selectedProperty.precio_lista)}</span>
                        </div>
                        {extrasConCosto.map((extra) => (
                          <div key={extra.id} className="flex items-baseline justify-between gap-3 text-xs">
                            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                              {extra.tipo === "bodega"
                                ? <Warehouse className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                                : <Car className="h-3.5 w-3.5 shrink-0 text-primary/70" />}
                              <span className="truncate">{extra.nombre}</span>
                            </span>
                            <span className="tabular-nums text-muted-foreground">+{formatPrice(extra.costo)}</span>
                          </div>
                        ))}
                        <div className="flex items-baseline justify-between gap-3 border-t border-primary/20 pt-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">Total</span>
                          <span className="text-2xl font-bold tabular-nums text-primary">{formatPrice(selectedProperty.precio_lista + extrasTotal)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">Precio de Lista</p>
                        <p className="mt-1 text-2xl font-bold text-primary">{formatPrice(selectedProperty.precio_lista)}</p>
                      </div>
                    )}
                  </div>
                )}
                {dialogSchemes.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2 py-2">
                      <span className="h-4 w-1 rounded-full bg-primary" />
                      Esquemas de Pago
                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary/10 text-xs font-semibold text-primary">{dialogSchemes.length}</span>
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
                                ? "border-primary bg-primary/[0.05] ring-2 ring-primary/20 shadow-sm"
                                : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`h-2 w-2 rounded-full shrink-0 transition-colors ${isSelected ? "bg-primary" : "bg-muted-foreground/25"}`} />
                                <p className="font-semibold text-sm text-foreground truncate">{scheme.nombre}</p>
                              </div>
                              {scheme.porcentaje_descuento_aumento !== 0 && scheme.porcentaje_descuento_aumento != null && (
                                <Badge variant="outline" className={scheme.porcentaje_descuento_aumento < 0
                                  ? "shrink-0 border-primary/30 bg-primary/10 text-primary text-xs font-semibold"
                                  : "shrink-0 border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold"}>
                                  {scheme.porcentaje_descuento_aumento > 0 ? "+" : ""}{scheme.porcentaje_descuento_aumento}%
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {scheme.porcentaje_enganche > 0 && (
                                <span className="inline-flex items-baseline gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                                  <span className="font-semibold text-foreground">{scheme.porcentaje_enganche}%</span> Enganche
                                </span>
                              )}
                              {amounts.porcentajeMensualidades > 0 && (
                                <span className="inline-flex items-baseline gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                                  <span className="font-semibold text-foreground">{amounts.porcentajeMensualidades.toFixed(1)}%</span> Mensualidades
                                </span>
                              )}
                              {amounts.porcentajeEntrega > 0 && (
                                <span className="inline-flex items-baseline gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                                  <span className="font-semibold text-foreground">{amounts.porcentajeEntrega.toFixed(1)}%</span> Entrega
                                </span>
                              )}
                              {amounts.numMensualidades > 0 && (
                                <span className="inline-flex items-baseline gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary/80">
                                  <span className="font-semibold text-primary">{amounts.numMensualidades}</span> meses
                                </span>
                              )}
                            </div>
                            {selectedProperty.precio_lista > 0 && (
                              <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-3 border-t border-border/50">
                                {amounts.enganche > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Enganche</p>
                                    <p className="text-xs font-semibold text-foreground">{formatPrice(amounts.enganche)}</p>
                                  </div>
                                )}
                                {amounts.mensualidadesTotal > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Mensualidad</p>
                                    <p className="text-xs font-semibold text-foreground">
                                      {formatPrice(amounts.mensualidad)}
                                      {amounts.numMensualidades > 0 && <span className="font-normal text-muted-foreground"> × {amounts.numMensualidades}</span>}
                                    </p>
                                  </div>
                                )}
                                {amounts.entrega > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Entrega</p>
                                    <p className="text-xs font-semibold text-foreground">{formatPrice(amounts.entrega)}</p>
                                  </div>
                                )}
                                <div className="space-y-0.5">
                                  <p className="text-xs uppercase tracking-wide text-primary/70">Precio final</p>
                                  <p className="text-xs font-bold text-primary">{formatPrice(amounts.precioAjustado)}</p>
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
                  <div className="bg-primary/[0.07] border border-primary/20 rounded-md px-3 py-2.5 text-xs text-primary font-medium flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Plan seleccionado: <span className="font-semibold">{dialogSchemes.find((s: any) => s.id === selectedSchemeId)?.nombre || ""}</span></span>
                  </div>
                )}
        </ModalViewerDetail>
      )}
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
    className="cursor-pointer overflow-hidden rounded-md border border-border bg-card shadow-[0_1px_3px_rgba(20,30,25,0.04)] transition-colors hover:border-border"
  >
    <div className="relative aspect-video overflow-hidden bg-gray-100">
      <UnitCardImage images={prop.model_images || []} />
      <span className="absolute right-2.5 top-2.5 rounded-md bg-card px-2.5 py-1 text-xs font-bold text-foreground shadow-sm">
        Depto. {prop.numero || prop.id}
      </span>
    </div>
    <div className="p-4 space-y-2.5">
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-foreground">{prop.modelo_nombre || `Depto. ${prop.numero || prop.id}`}</p>
        <p className="truncate text-xs font-medium text-muted-foreground/70">
          {prop.proyecto_nombre}{prop.piso ? ` · Nivel ${prop.piso}` : ""}
        </p>
      </div>
      {(prop.precio_total ?? prop.precio_lista) > 0 && (
        <p className="text-base font-bold tabular-nums text-primary">{formatPrice(prop.precio_total ?? prop.precio_lista)}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-sm font-medium text-muted-foreground">
        {prop.m2_total > 0 && <span className="flex items-center gap-1.5"><Maximize2 className="h-4 w-4 text-primary" /> {prop.m2_total.toFixed(1)} m²</span>}
        {prop.recamaras > 0 && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-primary" /> {prop.recamaras}</span>}
        {prop.banos > 0 && <span className="flex items-center gap-1.5"><Bath className="h-4 w-4 text-primary" /> {prop.banos}</span>}
        {prop.bodegas_count > 0 && <span className="flex items-center gap-1.5"><Warehouse className="h-4 w-4 text-primary" /> {prop.bodegas_count}</span>}
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
  return <OptImg src={images[0].url} w={640} h={360} resize="cover" alt="" className="h-full w-full object-cover" />;
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
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === currentIndex ? "w-5 bg-card" : "w-1.5 bg-card/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AgentUnidadesProyecto;
