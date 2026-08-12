import { useState, useMemo, useEffect } from "react";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { useAgentOnboardingStatus } from "@/hooks/useAgentOnboardingStatus";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Lock, Mail, Search, EyeOff, Plus, ExternalLink, HelpCircle, MessageSquareWarning,
  Eye, LayoutGrid, Rows3, LayoutList, Share2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/ui/action-button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import { PipelineOfferDetailDialog } from "@/components/admin/agent-portal/PipelineOfferDetailDialog";
import { OfertaNoAvanceDialog } from "@/components/admin/agent-portal/OfertaNoAvanceDialog";
import { ShareDigitalOfferDialog } from "@/components/admin/offers/ShareDigitalOfferDialog";
import { fetchNoAvancePorOferta } from "@/hooks/useMotivosNoAvance";
import { IconTip } from "@/components/ui/icon-tip";
import { IconButton } from "@/components/ui/icon-button";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { buildOfferUrl } from "@/lib/offers/offer-links";
import {
  ETAPAS, agruparOfertasPorUnidad, etapaDeOferta, fetchEtapasCanonicas, setNegocioEtapa,
  type EtapaClave, type EtapaDef,
} from "@/lib/portal-agente/negocios";

const STAGES = [
  { key: 'all', label: 'Todas', color: 'bg-gray-100 text-gray-800', borderColor: 'border-gray-400' },
  { key: 'nuevas', label: 'Nuevas', color: 'bg-blue-100 text-blue-800', borderColor: 'border-blue-400' },
  { key: 'pendientes', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', borderColor: 'border-yellow-400' },
  { key: 'aprobadas', label: 'Aprobadas', color: 'bg-green-100 text-green-800', borderColor: 'border-green-400' },
  { key: 'rechazadas', label: 'Rechazadas', color: 'bg-red-100 text-red-800', borderColor: 'border-red-400' },
  { key: 'revision', label: 'Revisión', color: 'bg-purple-100 text-purple-800', borderColor: 'border-purple-400' },
  { key: 'apartado', label: 'Apartado', color: 'bg-orange-100 text-orange-800', borderColor: 'border-orange-400' },
  { key: 'gen_contrato', label: 'Contrato', color: 'bg-indigo-100 text-indigo-800', borderColor: 'border-indigo-400' },
  { key: 'firma_contrato', label: 'Firma', color: 'bg-teal-100 text-teal-800', borderColor: 'border-teal-400' },
  { key: 'cierre', label: 'Cierre', color: 'bg-emerald-100 text-emerald-800', borderColor: 'border-emerald-500' },
  { key: 'expiradas', label: 'Expiradas', color: 'bg-gray-100 text-gray-500', borderColor: 'border-gray-300' },
] as const;

// Same MIN_DATE as WorkflowOffers: 1 month
const MIN_DATE = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
})();

function isVigente(fechaGeneracion: string): boolean {
  const expira = new Date(fechaGeneracion);
  expira.setDate(expira.getDate() + 5);
  return expira >= new Date();
}

function classifyOffer(o: any): string {
  if (o.estatus_disponibilidad === 5) return 'cierre';
  if (o.tiene_contrato_firmado) return 'firma_contrato';
  if (o.contrato_draft) return 'gen_contrato';
  if (o.cuenta_cobranza_id && o.estatus_disponibilidad === 4) return 'apartado';

  const vigente = isVigente(o.fecha_generacion);
  if (!vigente && !o.cuenta_cobranza_id) return 'expiradas';

  if (!o.id_esquema_pago_seleccionado) return vigente ? 'nuevas' : 'expiradas';

  if (o.id_estatus_aprobacion === 1) return vigente ? 'pendientes' : 'expiradas';
  if (o.id_estatus_aprobacion === 2) return 'aprobadas';
  if (o.id_estatus_aprobacion === 3) return vigente ? 'rechazadas' : 'expiradas';
  if (o.id_estatus_aprobacion === 4) return vigente ? 'revision' : 'expiradas';

  return 'nuevas';
}

const AgentPipeline = () => {
  const { profile, user } = useAuth();
  const { impersonatedAgentEmail, isImpersonating } = useAgentImpersonation();
  const navigate = useNavigate();
  const agentEmail = isImpersonating ? impersonatedAgentEmail : (user?.email || profile?.email);
  const personaId = profile?.id_persona;
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';
  const { hasTrainingComplete, isLoading: onboardingLoading } = useAgentOnboardingStatus(personaId);
  const [activeStage, setActiveStage] = useState<string>('all');
  // tabla = estándar de cobranza · tarjetas = la vista original · tablero = kanban por etapa
  const [vista, setVista] = useState<'tabla' | 'tarjetas' | 'tablero'>('tabla');
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropEtapa, setDropEtapa] = useState<EtapaClave | null>(null);
  const [overrideEtapa, setOverrideEtapa] = useState<Record<number, EtapaClave>>({});
  const [searchProspecto, setSearchProspecto] = useState<string>('');
  const [selectedOferta, setSelectedOferta] = useState<any>(null);
  const [shareOferta, setShareOferta] = useState<any>(null);
  const [noAvanceOferta, setNoAvanceOferta] = useState<any>(null);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const { permissions } = useAgentPortalPermissions();
  const pipelinePerms = permissions['/admin/agent/pipeline'];
  const { presentationMode, mask } = useAgentPresentation();
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();

  // Log page view
  useEffect(() => {
    registrarVista('/admin/agent/pipeline');
    track({ page: 'agent_pipeline', elementId: 'page_view', elementType: 'page' });
  }, []);

  // Link del cliente (con token) y su versión demo, para el popup de compartir.
  const baseUrlDe = (o: any) => buildOfferUrl(o.id);
  const shareUrlDe = (o: any) => buildOfferUrl(o.id, o?.reserva_token);

  /** Deja el PDF en Storage para adjuntarlo al correo (nadie pidió el archivo local). */
  const prepararPdf = async (o: any) => {
    const { generarPdfOferta } = await import('@/lib/offers/offer-pdf');
    await generarPdfOferta({
      propertyId: o.id_propiedad,
      offerId: o.id,
      propertyNumber: o.propiedad_nombre || '',
      leadName: o.lead_nombre,
      leadEmail: o.lead_email,
      leadPhone: o.lead_telefono,
      creatorEmail: o.email_creador,
      isProductOffer: !!o.is_producto,
      productId: o.id_producto,
    }, { descargar: false });
  };

  const descargarPdf = async (o: any) => {
    setDescargandoPdf(true);
    try {
      const { generarYDescargarPdfOferta } = await import('@/lib/offers/offer-pdf');
      const n = await generarYDescargarPdfOferta({
        propertyId: o.id_propiedad,
        offerId: o.id,
        propertyNumber: o.propiedad_nombre || '',
        leadName: o.lead_nombre,
        leadEmail: o.lead_email,
        leadPhone: o.lead_telefono,
        creatorEmail: o.email_creador,
        isProductOffer: !!o.is_producto,
        productId: o.id_producto,
      });
      toast({ title: 'PDF descargado', description: `Se descargaron ${n} PDF(s).` });
    } catch (err) {
      console.error('Error generando el PDF de la oferta:', err);
      toast({
        title: 'Error al generar el PDF',
        description: 'No se pudo generar el PDF de la oferta. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setDescargandoPdf(false);
    }
  };

  // Etapas canónicas desde la BD (pipeline `ventas_sozu`). Respaldo: el arreglo del front
  // mientras la migración 03 no esté aplicada.
  const { data: etapas = ETAPAS } = useQuery({
    queryKey: ['etapas-canonicas'],
    queryFn: fetchEtapasCanonicas,
    staleTime: 5 * 60_000,
  });
  const etapaDefDb = (clave: EtapaClave): EtapaDef =>
    etapas.find((e) => e.clave === clave) ?? ETAPAS.find((e) => e.clave === clave) ?? ETAPAS[0];

  const { data: ofertas = [], isLoading } = useQuery({
    queryKey: ['agent-pipeline', agentEmail],
    queryFn: async () => {
      if (!agentEmail) return [];

      const { data: ofertasData } = await (supabase as any)
        .from('ofertas')
        .select('id, email_creador, fecha_generacion, fecha_creacion, id_esquema_pago_seleccionado, id_estatus_aprobacion, activo, id_propiedad, id_persona_lead, id_producto, url')
        .eq('email_creador', agentEmail)
        .eq('activo', true)
        .gte('fecha_generacion', MIN_DATE)
        .order('fecha_generacion', { ascending: false });

      if (!ofertasData || ofertasData.length === 0) return [];

      const propIds = [...new Set(ofertasData.map((o: any) => o.id_propiedad).filter(Boolean))] as number[];
      const leadIds = [...new Set(ofertasData.map((o: any) => o.id_persona_lead).filter(Boolean))] as number[];
      const productoIds = [...new Set(ofertasData.map((o: any) => o.id_producto).filter(Boolean))] as number[];
      const ofertaIds = ofertasData.map((o: any) => o.id);

      const [propRes, leadRes, cuentaRes, productosRes] = await Promise.all([
        propIds.length > 0
          ? (supabase as any).from('propiedades').select('id, numero_propiedad, precio_lista, id_estatus_disponibilidad, id_edificio_modelo').in('id', propIds)
          : { data: [] as any[] },
        leadIds.length > 0
          ? (supabase as any).from('personas').select('id, nombre_legal, nombre_comercial, email, telefono, clave_pais_telefono').in('id', leadIds)
          : { data: [] as any[] },
        ofertaIds.length > 0
          ? (supabase as any).from('cuentas_cobranza').select('id, id_oferta, contrato_draft').in('id_oferta', ofertaIds).eq('activo', true)
          : { data: [] as any[] },
        productoIds.length > 0
          ? (supabase as any).from('productos_servicios').select('id, nombre, precio_lista, id_proyecto').in('id', productoIds)
          : { data: [] as any[] },
      ]) as [{ data: any[] }, { data: any[] }, { data: any[] }, { data: any[] }];

      // Build proyecto map from propiedades (edificios_modelos -> edificios -> proyectos)
      const edModeloIds = [...new Set((propRes.data || []).map((p: any) => p.id_edificio_modelo).filter(Boolean))];
      let propToProject = new Map<number, string>();

      if (edModeloIds.length > 0) {
        const { data: edModelos } = await (supabase as any)
          .from('edificios_modelos').select('id, id_edificio').in('id', edModeloIds);
        const edificioIds = [...new Set((edModelos || []).map((em: any) => em.id_edificio).filter(Boolean))];
        if (edificioIds.length > 0) {
          const { data: edificios } = await (supabase as any)
            .from('edificios').select('id, id_proyecto').in('id', edificioIds);
          const projIds = [...new Set((edificios || []).map((e: any) => e.id_proyecto).filter(Boolean))];
          if (projIds.length > 0) {
            const { data: projs } = await (supabase as any)
              .from('proyectos').select('id, nombre').in('id', projIds);
            const projMap = new Map((projs || []).map((p: any) => [p.id, p.nombre]));
            const edToProjId = new Map((edificios || []).map((e: any) => [e.id, e.id_proyecto]));
            const emToEdId = new Map((edModelos || []).map((em: any) => [em.id, em.id_edificio]));
            (propRes.data || []).forEach((p: any) => {
              const edId = emToEdId.get(p.id_edificio_modelo);
              const projId = edId ? edToProjId.get(edId) : null;
              const projName = projId ? (projMap.get(projId) as string) : null;
              if (projName) propToProject.set(p.id, projName);
            });
          }
        }
      }

      // Also get project names for productos
      const productoProjIds = [...new Set((productosRes.data || []).map((p: any) => p.id_proyecto).filter(Boolean))] as number[];
      let productoToProject = new Map<number, string>();
      if (productoProjIds.length > 0) {
        const { data: projs } = await (supabase as any)
          .from('proyectos').select('id, nombre').in('id', productoProjIds);
        (projs || []).forEach((p: any) => productoToProject.set(p.id, p.nombre));
      }

      // Check for signed contracts
      const cuentaIds = (cuentaRes.data || []).map((c: any) => c.id);
      let signedSet = new Set<number>();
      if (cuentaIds.length > 0) {
        const { data: docs } = await (supabase as any)
          .from('documentos')
          .select('id_cuenta_cobranza')
          .in('id_cuenta_cobranza', cuentaIds)
          .eq('id_tipo_documento', 42)
          .eq('activo', true);
        (docs || []).forEach((d: any) => signedSet.add(d.id_cuenta_cobranza));
      }

      // Get inmobiliaria for the agent
      let inmobiliariaNombre = '';
      const { data: usrData } = await (supabase as any)
        .from('usuarios').select('id_persona').eq('email', agentEmail).eq('activo', true).limit(1);
      if (usrData && usrData[0]?.id_persona) {
        const agentPersonaId = usrData[0].id_persona;
        const { data: erData } = await (supabase as any)
          .from('entidades_relacionadas')
          .select('id_persona_duena_lead')
          .eq('id_persona', agentPersonaId)
          .eq('id_tipo_entidad', 19)
          .eq('activo', true)
          .limit(1);
        if (erData && erData[0]?.id_persona_duena_lead) {
          const { data: inmobPersona } = await (supabase as any)
            .from('personas').select('nombre_comercial, nombre_legal').eq('id', erData[0].id_persona_duena_lead).limit(1);
          inmobiliariaNombre = inmobPersona?.[0]?.nombre_comercial || inmobPersona?.[0]?.nombre_legal || '';
        }
      }

      const propMap = new Map<number, any>((propRes.data || []).map((p: any) => [p.id, p]));
      const leadMap = new Map<number, string>((leadRes.data || []).map((l: any) => [l.id, l.nombre_legal || l.nombre_comercial || 'Sin nombre']));
      const leadDatosMap = new Map<number, any>((leadRes.data || []).map((l: any) => [l.id, l]));

      // Token de la reservación: es la credencial del link que se comparte con el
      // cliente. Sin token el link solo sirve como demo (no permite apartar).
      const { data: reservasData } = ofertaIds.length > 0
        ? await (supabase as any)
            .from('reservaciones')
            .select('id_oferta, token')
            .in('id_oferta', ofertaIds)
            .eq('activo', true)
            .order('id', { ascending: false })
        : { data: [] as any[] };
      const tokenByOferta = new Map<number, string>();
      for (const r of (reservasData || [])) {
        if (!tokenByOferta.has(r.id_oferta)) tokenByOferta.set(r.id_oferta, r.token);
      }
      const productoMap = new Map<number, any>((productosRes.data || []).map((p: any) => [p.id, p]));
      const cuentaByOferta = new Map<number, any>();
      (cuentaRes.data || []).forEach((c: any) => { if (c.id_oferta) cuentaByOferta.set(c.id_oferta, c); });

      // Razón de no avance ya capturada (solo aplica a las expiradas). Silencioso
      // mientras el DDL de `ofertas_no_avance` no esté ejecutado en el ambiente.
      const noAvanceMap = await fetchNoAvancePorOferta(ofertaIds);

      return ofertasData.map((o: any) => {
        const prop = propMap.get(o.id_propiedad);
        const producto = o.id_producto ? productoMap.get(o.id_producto) : null;
        const cuenta = cuentaByOferta.get(o.id);
        const isProducto = !!o.id_producto;
        const proyectoNombre = isProducto
          ? (producto?.id_proyecto ? productoToProject.get(producto.id_proyecto) || '' : '')
          : (propToProject.get(o.id_propiedad) || '');

        const enriched = {
          ...o,
          lead_nombre: leadMap.get(o.id_persona_lead) || 'Sin prospecto',
          lead_email: leadDatosMap.get(o.id_persona_lead)?.email || null,
          lead_telefono: leadDatosMap.get(o.id_persona_lead)?.telefono || null,
          lead_clave_pais: leadDatosMap.get(o.id_persona_lead)?.clave_pais_telefono || 'MX',
          reserva_token: tokenByOferta.get(o.id) || null,
          propiedad_nombre: prop?.numero_propiedad || '',
          producto_nombre: producto?.nombre || '',
          precio: isProducto ? (producto?.precio_lista || null) : (prop?.precio_lista || null),
          proyecto_nombre: proyectoNombre,
          inmobiliaria_nombre: inmobiliariaNombre || 'Interno',
          estatus_disponibilidad: prop?.id_estatus_disponibilidad,
          cuenta_cobranza_id: cuenta?.id,
          contrato_draft: cuenta?.contrato_draft,
          tiene_contrato_firmado: cuenta ? signedSet.has(cuenta.id) : false,
          is_producto: isProducto,
          no_avance: noAvanceMap.get(o.id) || null,
        };
        enriched.stage = classifyOffer(enriched);
        // Etapa canónica del pipeline `ventas_sozu`, derivada de los mismos hechos que usarán
        // los triggers del archivo 05. Convive con `stage` (la clasificación histórica que
        // alimenta los filtros y el aviso de expiradas sin razón).
        enriched.etapa = etapaDeOferta(enriched);
        return enriched;
      });
    },
    enabled: !!agentEmail,
    staleTime: 30_000,
  });

  // Un negocio por UNIDAD: en prod hay hasta 19 ofertas activas sobre la misma unidad
  // (recotizaciones). Se colapsan conservando la etapa más avanzada y el conteo de versiones.
  const negocios = useMemo(
    () => agruparOfertasPorUnidad((ofertas as any[]).map((o) => ({ ...o, stage: o.etapa })))
      .map((n: any) => (overrideEtapa[n.id] ? { ...n, stage: overrideEtapa[n.id] } : n)),
    [ofertas, overrideEtapa],
  );

  const porEtapa = useMemo(() => {
    const map: Record<string, any[]> = {};
    negocios.forEach((n: any) => { (map[n.stage] ||= []).push(n); });
    return map;
  }, [negocios]);

  // Filtro por etapa canónica: se aplica igual a tabla, tarjetas y tablero, y los conteos
  // salen de los NEGOCIOS (una unidad = un negocio), no de las ofertas sueltas. Antes el chip
  // decía "Todas (19)" contando ofertas mientras la tabla mostraba 4 unidades.
  const negociosVisibles = useMemo(() => {
    const q = searchProspecto.trim().toLowerCase();
    return negocios.filter((n: any) =>
      (activeStage === 'all' || n.stage === activeStage) &&
      (!q || (n.lead_nombre || '').toLowerCase().includes(q)));
  }, [negocios, searchProspecto, activeStage]);

  const opcionesEtapa: SearchableOption[] = useMemo(() => {
    const conteo = (clave: string) => negocios.filter((n: any) => n.stage === clave).length;
    return [
      { value: 'all', label: `Todas las etapas (${negocios.length})` },
      ...etapas
        .map((e) => ({ etapa: e, n: conteo(e.clave) }))
        .filter(({ n }) => n > 0)
        .map(({ etapa, n }) => ({
          value: etapa.clave,
          label: `${etapa.label} (${n})`,
          hint: etapa.automatica ? 'La mueve el sistema' : 'La mueves tú',
        })),
    ];
  }, [negocios, etapas]);

  // Solo se arrastra hacia etapas manuales: las automáticas las dispara un hecho real.
  const moverEtapa = async (negocio: any, destino: EtapaClave) => {
    const def = etapaDefDb(destino);
    if (def.automatica) {
      toast({
        title: `"${def.label}" la mueve el sistema`,
        description: 'Se activa con un hecho real: la oferta, el apartado aplicado o el estatus de la propiedad.',
      });
      return;
    }
    if (negocio.stage === destino) return;

    const previo = negocio.stage as EtapaClave;
    setOverrideEtapa((prev) => ({ ...prev, [negocio.id]: destino }));
    try {
      if (!negocio.id_negocio) {
        throw new Error('Este negocio todavía no existe en crm_negocios: faltan las migraciones 02, 03 y 05.');
      }
      await setNegocioEtapa(negocio.id_negocio, destino);
      track({ page: 'agent_pipeline', elementId: 'mover_etapa', metadata: { negocio: negocio.id_negocio, etapa: destino } });
      toast({ title: `Movido a ${def.label}` });
    } catch (e: any) {
      setOverrideEtapa((prev) => ({ ...prev, [negocio.id]: previo }));
      toast({ title: 'No se pudo mover la etapa', description: e?.message, variant: 'destructive' });
    }
  };

  // Negocios cerrados como perdidos a los que todavía nadie les capturó la razón.
  // Se cuenta por NEGOCIO (unidad), igual que la tabla, para que el aviso y el filtro cuadren.
  const expiradasSinRazon = useMemo(
    () => negocios.filter((n: any) => n.stage === 'perdido' && !n.no_avance),
    [negocios],
  );

  // Monto de lo que sigue vivo: negocios que no están perdidos.
  const totalMonto = useMemo(
    () => negocios.filter((n: any) => n.stage !== 'perdido')
      .reduce((sum: number, n: any) => sum + (n.precio || 0), 0),
    [negocios],
  );

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(v);

  // El detalle recibe la etapa CANÓNICA (la que ve el agente en la tabla/tarjeta). La
  // clasificación legacy (`classifyOffer`) se conserva para el aviso de expiradas.
  const getStageInfo = (clave: string) => {
    const def = etapaDefDb(clave as EtapaClave);
    return { key: def.clave, label: def.label, color: def.chip, borderColor: 'border-border' };
  };

  return (
    <div >
      <AgentPortalHeader />

      {/* Toolbar */}
      <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-3 pt-1 pb-3">
        {!isLoading ? (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            {negocios.length} {negocios.length === 1 ? 'negocio' : 'negocios'} · {ofertas.length} ofertas · {mask(formatCurrency(totalMonto))} abiertos · últimos 30 días
          </p>
        ) : <span />}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {([
              { v: 'tabla' as const,    icon: Rows3,      label: 'Vista de tabla' },
              { v: 'tarjetas' as const, icon: LayoutList, label: 'Vista de tarjetas' },
              { v: 'tablero' as const,  icon: LayoutGrid, label: 'Vista de tablero por etapa' },
            ]).map(({ v, icon: Icono, label }) => (
              <IconTip key={v} label={label}>
                <button
                  onClick={() => setVista(v)}
                  aria-label={label}
                  className={cn('rounded-md p-1.5 transition-colors',
                    vista === v ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                >
                  <Icono className="size-4" />
                </button>
              </IconTip>
            ))}
          </div>

          {pipelinePerms.canCreate && (
          isAgentRole && !onboardingLoading && !hasTrainingComplete ? (
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground/70">
              <Lock className="h-3.5 w-3.5" /> Completa tu capacitación
            </span>
          ) : (
            <ActionButton
              icon={Plus}
              onClick={() => {
                track({ page: 'agent_pipeline', elementId: 'btn_nueva_oferta', elementLabel: 'Nueva oferta' });
                navigate('/admin/agent/inventario/unidades?openFilters=true');
              }}
            >
              Nueva oferta
            </ActionButton>
          )
          )}
        </div>
      </div>

      {/* Búsqueda + filtro de etapa. El filtro es una lista: con 10 etapas los chips
          desbordaban y el texto quedaba ilegible. */}
      <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-2 pb-3">
        <div className="relative flex min-w-[200px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/70" />
          <Input
            placeholder="Buscar prospecto…"
            value={searchProspecto}
            onChange={(e) => setSearchProspecto(e.target.value)}
            className="h-10 rounded-md border-border bg-card pl-9 text-sm shadow-none focus-visible:ring-primary/30"
          />
        </div>
        <div className="w-[240px] shrink-0">
          <SearchableSelect
            value={activeStage}
            onValueChange={(v) => {
              track({ page: 'agent_pipeline', elementId: 'filtro_etapa', elementLabel: v });
              setActiveStage(v);
            }}
            options={opcionesEtapa}
            placeholder="Todas las etapas"
          />
        </div>
      </div>

      {/* Banner modo presentación */}
      {presentationMode && (
        <div className="mx-auto mb-2 max-w-[1040px]">
          <div className="flex items-center gap-2.5 rounded-md border border-amber-300 bg-orange-100 px-4 py-2.5">
            <EyeOff className="h-4 w-4 shrink-0 text-orange-700" />
            <span className="text-xs font-semibold text-orange-700">
              Modo presentación · nombres de prospecto y montos ocultos. Desactívalo arriba para verlos.
            </span>
          </div>
        </div>
      )}

      {/* Aviso: ofertas expiradas sin razón capturada */}
      {!isLoading && expiradasSinRazon.length > 0 && (
        <div className="mx-auto mb-2 max-w-[1040px]">
          <div className="flex flex-wrap items-center gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5">
            <MessageSquareWarning className="h-4 w-4 shrink-0 text-amber-700" />
            <span className="text-xs font-semibold text-amber-800">
              {expiradasSinRazon.length === 1
                ? '1 negocio cerrado sin razón registrada.'
                : `${expiradasSinRazon.length} negocios cerrados sin razón registrada.`}
              {' '}Cuéntanos por qué no avanzaron para mejorar precio, esquemas y producto.
            </span>
            {activeStage !== 'perdido' && (
              <button
                onClick={() => {
                  track({ page: 'agent_pipeline', elementId: 'btn_ver_expiradas_sin_razon', elementLabel: 'Ver perdidos' });
                  setActiveStage('perdido');
                }}
                className="ml-auto shrink-0 rounded-md border border-amber-400 bg-card px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                Ver cerrados
              </button>
            )}
          </div>
        </div>
      )}

      {/* Negocios: un renglón por unidad. Tabla estándar, tarjetas o tablero por etapa. */}
      <div className="mx-auto max-w-[1040px] space-y-2.5">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
          </div>
        ) : vista === 'tabla' ? (
          negociosVisibles.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card py-12 text-center text-sm text-muted-foreground">
              No hay negocios que mostrar
            </div>
          ) : (
          <div className="rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1118px] table-fixed text-sm whitespace-nowrap">
                <thead className="sozu-thead [&_th]:uppercase [&_th]:tracking-wide [&_th]:px-3">
                  <tr>
                    <th className="w-[206px] text-left">Desarrollo · Unidad</th>
                    <th className="w-[120px] text-center">Tipo</th>
                    <th className="w-[190px] text-left">Prospecto</th>
                    <th className="w-[158px] text-center">Etapa</th>
                    <th className="w-[120px] text-center">Valor</th>
                    <th className="w-[124px] text-center">Oferta</th>
                    <th className="w-[184px] pr-4" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {negociosVisibles.map((negocio: any) => {
                    const def = etapaDefDb(negocio.stage as EtapaClave);
                    const ofertaLabel = negocio.is_producto
                      ? `OP-${String(negocio.id).padStart(6, '0')}`
                      : `O-${String(negocio.id).padStart(6, '0')}`;
                    const unidad = negocio.is_producto
                      ? (negocio.producto_nombre || 'Producto')
                      : (negocio.propiedad_nombre || '—');
                    const genDate = negocio.fecha_generacion ? new Date(negocio.fecha_generacion) : null;
                    const ofertaUrl = negocio.reserva_token
                      ? `${baseUrlDe(negocio)}/${negocio.reserva_token}` : baseUrlDe(negocio);
                    const ccLabel = negocio.cuenta_cobranza_id
                      ? formatCuentaCobranzaId(negocio.cuenta_cobranza_id, (negocio.is_producto ? 'Producto' : 'Propiedad') as any)
                      : null;

                    return (
                      <tr key={negocio.id}
                        className="h-[48px] cursor-pointer border-b border-border/50 transition-colors duration-100 hover:bg-muted/20"
                        onClick={() => setSelectedOferta(negocio)}>
                        <td className="px-3 text-left">
                          <p className="truncate text-[13px] font-semibold text-foreground">
                            {negocio.proyecto_nombre || 'Sin desarrollo'}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {unidad}{ccLabel ? ` · ${ccLabel}` : ''}
                          </p>
                        </td>
                        <td className="px-3 text-center">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            negocio.is_producto ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-100' : 'bg-muted text-muted-foreground ring-1 ring-border/60')}>
                            {negocio.is_producto ? 'Producto' : 'Propiedad'}
                          </span>
                        </td>
                        <td className="px-3 text-left">
                          <p className="truncate text-[12px] font-medium text-foreground">{mask(negocio.lead_nombre)}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{mask(negocio.lead_email || 'Sin correo')}</p>
                        </td>
                        <td className="px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', def.chip)}>
                              {def.label}
                            </span>
                            {def.automatica && (
                              <IconTip label="La mueve el sistema con un hecho real (oferta, apartado aplicado, estatus de la propiedad).">
                                <Lock className="size-3 shrink-0 cursor-default text-muted-foreground/50" />
                              </IconTip>
                            )}
                          </div>
                        </td>
                        <td className="px-3 text-center">
                          <span className="text-[12px] font-semibold tabular-nums">
                            {negocio.precio ? mask(formatCurrency(negocio.precio)) : '—'}
                          </span>
                        </td>
                        <td className="px-3 text-center">
                          <p className="truncate font-mono text-[11px] font-semibold text-primary">{ofertaLabel}</p>
                          {genDate && (
                            <p className="text-[10px] tabular-nums text-muted-foreground">
                              {format(genDate, 'dd MMM yyyy', { locale: es })}
                              {negocio.ofertas_count > 1 && ` · ${negocio.ofertas_count} versiones`}
                            </p>
                          )}
                        </td>
                        <td className="px-3 pr-5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <IconButton
                              icon={Eye}
                              tooltip="Detalle del negocio"
                              ariaLabel="Detalle del negocio"
                              onClick={() => setSelectedOferta(negocio)}
                            />
                            <IconButton
                              icon={Share2}
                              tooltip="Compartir: link del cliente y demo"
                              ariaLabel="Compartir la oferta"
                              onClick={() => setShareOferta(negocio)}
                            />
                            <IconButton
                              icon={ExternalLink}
                              tooltip={negocio.reserva_token
                                ? 'Abrir el link del cliente'
                                : 'Vista previa: esta oferta no tiene link de cliente'}
                              ariaLabel="Abrir la oferta digital"
                              onClick={() => window.open(ofertaUrl, '_blank', 'noopener')}
                            />
                            {negocio.stage === 'perdido' && (
                              <IconButton
                                icon={MessageSquareWarning}
                                tooltip={negocio.no_avance ? 'Editar la razón por la que no avanzó' : '¿Por qué no avanzó?'}
                                ariaLabel="Razón de no avance"
                                className={negocio.no_avance ? undefined : 'border-amber-300 text-amber-600 hover:bg-amber-50'}
                                onClick={() => {
                                  track({ page: 'agent_pipeline', elementId: 'btn_motivo_no_avance',
                                    elementLabel: negocio.no_avance ? 'Editar razón' : '¿Por qué no avanzó?',
                                    metadata: { id_oferta: negocio.id } });
                                  setNoAvanceOferta(negocio);
                                }}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )
        ) : vista === 'tablero' ? (
          <div className="overflow-x-auto pb-2">
            <div className="flex w-max gap-3">
              {etapas.map((etapa) => {
                const items = (porEtapa[etapa.clave] ?? []).filter((o: any) =>
                  !searchProspecto.trim() || (o.lead_nombre || '').toLowerCase().includes(searchProspecto.trim().toLowerCase()));
                const monto = items.reduce((sum: number, o: any) => sum + (o.precio || 0), 0);
                const activa = dropEtapa === etapa.clave && !etapa.automatica;
                return (
                  <div key={etapa.clave}
                    onDragOver={(e) => { if (!etapa.automatica) { e.preventDefault(); setDropEtapa(etapa.clave); } }}
                    onDragLeave={() => setDropEtapa((prev) => (prev === etapa.clave ? null : prev))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDropEtapa(null);
                      const negocio = negocios.find((n: any) => n.id === dragId);
                      if (negocio) moverEtapa(negocio, etapa.clave);
                      setDragId(null);
                    }}
                    className={cn('w-[248px] shrink-0 rounded-xl border bg-muted/30 transition-colors',
                      activa && 'border-primary/60 bg-primary/5',
                      dragId != null && etapa.automatica && 'opacity-50')}>
                    <div className="flex items-center justify-between gap-2 rounded-t-xl border-b bg-card px-3 py-2">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', etapa.chip)}>
                        {etapa.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {etapa.automatica && (
                          <IconTip label="La mueve el sistema con un hecho real. No admite arrastre.">
                            <Lock className="size-3 cursor-default text-muted-foreground/50" />
                          </IconTip>
                        )}
                        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{items.length}</span>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {mask(formatCurrency(monto))}
                    </div>
                    <div className="space-y-2 p-2">
                      {items.length === 0 ? (
                        <p className="px-1 py-3 text-center text-[11px] text-muted-foreground/60">
                          {etapa.automatica ? 'Sin negocios' : 'Arrastra aquí'}
                        </p>
                      ) : items.map((negocio: any) => (
                        <div key={negocio.id} draggable
                          onDragStart={() => setDragId(negocio.id)}
                          onDragEnd={() => { setDragId(null); setDropEtapa(null); }}
                          onClick={() => setSelectedOferta(negocio)}
                          className={cn('w-full cursor-grab rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-primary/40 active:cursor-grabbing',
                            dragId === negocio.id && 'opacity-40')}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-[12px] font-semibold text-foreground">
                              {negocio.proyecto_nombre || 'Sin desarrollo'}
                            </p>
                            <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                              negocio.is_producto ? 'bg-sky-50 text-sky-700' : 'bg-muted text-muted-foreground')}>
                              {negocio.is_producto ? 'Producto' : 'Propiedad'}
                            </span>
                          </div>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {negocio.is_producto ? (negocio.producto_nombre || 'Producto') : (negocio.propiedad_nombre || '—')}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-foreground">{mask(negocio.lead_nombre)}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{mask(negocio.lead_email || 'Sin correo')}</p>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold tabular-nums text-foreground">
                              {negocio.precio ? mask(formatCurrency(negocio.precio)) : '—'}
                            </span>
                            {negocio.ofertas_count > 1 && (
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                                {negocio.ofertas_count} vers.
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : negociosVisibles.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card py-12 text-center text-sm text-muted-foreground">
            No hay negocios en esta etapa
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {negociosVisibles.map((negocio: any) => (
              <OfertaCard
                key={negocio.id}
                oferta={negocio}
                etapa={etapaDefDb(negocio.stage as EtapaClave)}
                formatCurrency={formatCurrency}
                onClick={() => setSelectedOferta(negocio)}
                onShare={() => setShareOferta(negocio)}
                onAbrir={() => window.open(
                  negocio.reserva_token ? `${baseUrlDe(negocio)}/${negocio.reserva_token}` : baseUrlDe(negocio),
                  '_blank', 'noopener')}
                onRegistrarNoAvance={() => {
                  track({
                    page: 'agent_pipeline',
                    elementId: 'btn_motivo_no_avance',
                    elementLabel: negocio.no_avance ? 'Editar razón' : '¿Por qué no avanzó?',
                    metadata: { id_oferta: negocio.id },
                  });
                  setNoAvanceOferta(negocio);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Compartir / reenviar: mismo popup que al generar la oferta. El PDF se
          genera aquí a demanda, sin depender de haberlo descargado antes. */}
      {shareOferta && (
        <ShareDigitalOfferDialog
          open={!!shareOferta}
          onOpenChange={(v) => { if (!v) setShareOferta(null); }}
          url={shareUrlDe(shareOferta)}
          previewUrl={baseUrlDe(shareOferta)}
          leadName={shareOferta.lead_nombre}
          leadEmail={shareOferta.lead_email ?? undefined}
          leadPhone={shareOferta.lead_telefono ?? undefined}
          leadPhoneCountry={shareOferta.lead_clave_pais ?? 'MX'}
          propertyNumber={shareOferta.propiedad_nombre}
          projectName={shareOferta.proyecto_nombre}
          offerIds={shareOferta.id ? [shareOferta.id] : undefined}
          forceLight
          downloadingPdf={descargandoPdf}
          onDownloadPdf={() => descargarPdf(shareOferta)}
          onPreparePdf={() => prepararPdf(shareOferta)}
        />
      )}

      {selectedOferta && (
        <PipelineOfferDetailDialog
          open={!!selectedOferta}
          onOpenChange={(v) => { if (!v) setSelectedOferta(null); }}
          oferta={selectedOferta}
          formatCurrency={formatCurrency}
          stageInfo={getStageInfo(selectedOferta.stage)}
          canUpdate={pipelinePerms.canUpdate}
          onRegistrarNoAvance={() => {
            setNoAvanceOferta(selectedOferta);
            setSelectedOferta(null);
          }}
        />
      )}

      {/* Razón por la que la oferta expirada no avanzó de etapa */}
      {noAvanceOferta && (
        <OfertaNoAvanceDialog
          open={!!noAvanceOferta}
          onOpenChange={(v) => { if (!v) setNoAvanceOferta(null); }}
          oferta={noAvanceOferta}
          registradoPor={agentEmail}
          canUpdate={pipelinePerms.canUpdate}
        />
      )}
    </div>
  );
};

/**
 * Tarjeta de negocio con lectura de producto de e-commerce: cabecera con la unidad, el precio
 * como dato dominante, la etapa como pastilla y las acciones abajo en botones con caja.
 */
function OfertaCard({ oferta, etapa, formatCurrency, onClick, onShare, onAbrir, onRegistrarNoAvance }: {
  oferta: any;
  etapa: EtapaDef;
  formatCurrency: (v: number) => string;
  onClick?: () => void;
  onShare?: () => void;
  onAbrir?: () => void;
  onRegistrarNoAvance?: () => void;
}) {
  const { mask } = useAgentPresentation();
  const ofertaLabel = oferta.is_producto
    ? `OP-${String(oferta.id).padStart(6, '0')}`
    : `O-${String(oferta.id).padStart(6, '0')}`;
  const unidad = oferta.is_producto
    ? (oferta.producto_nombre || 'Producto')
    : (oferta.propiedad_nombre || '—');
  const genDate = oferta.fecha_generacion ? new Date(oferta.fecha_generacion) : null;
  const ccLabel = oferta.cuenta_cobranza_id
    ? formatCuentaCobranzaId(oferta.cuenta_cobranza_id, (oferta.is_producto ? 'Producto' : 'Propiedad') as any)
    : null;
  const esPerdido = etapa.clave === 'perdido';

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card',
        // Hover sutil: solo borde y una sombra suave. Sin desplazamiento vertical, que hacía
        // "saltar" la tarjeta y movía los botones bajo el cursor.
        'transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-sm',
      )}
    >
      {/* Cabecera: tipo + etapa */}
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
        <span className={cn(
          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
          oferta.is_producto ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-100' : 'bg-card text-muted-foreground ring-1 ring-border',
        )}>
          {oferta.is_producto ? 'Producto' : 'Propiedad'}
        </span>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', etapa.chip)}>
          {etapa.label}
          {etapa.automatica && <Lock className="size-2.5 shrink-0 opacity-60" />}
        </span>
      </div>

      {/* Cuerpo: unidad, desarrollo y precio */}
      <div className="flex-1 px-3.5 py-3">
        <p className="truncate text-[15px] font-bold leading-tight text-foreground">{unidad}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {oferta.proyecto_nombre || 'Sin desarrollo'}{ccLabel ? ` · ${ccLabel}` : ''}
        </p>

        <p className="mt-2.5 text-xl font-bold tabular-nums leading-none text-foreground">
          {oferta.precio ? mask(formatCurrency(oferta.precio)) : '—'}
        </p>

        <div className="mt-3 border-t pt-2.5">
          <p className="truncate text-[13px] font-semibold text-foreground">{mask(oferta.lead_nombre)}</p>
          <p className="truncate text-[11px] text-muted-foreground">{mask(oferta.lead_email || 'Sin correo')}</p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="font-mono font-semibold text-primary">{ofertaLabel}</span>
          {genDate && <span className="tabular-nums">· {format(genDate, 'dd MMM yyyy', { locale: es })}</span>}
          {oferta.ofertas_count > 1 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">
              {oferta.ofertas_count} versiones
            </span>
          )}
        </div>

        {esPerdido && !oferta.no_avance && (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">
            Falta registrar por qué no avanzó
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-2 border-t px-3.5 py-2.5" onClick={(e) => e.stopPropagation()}>
        <IconButton icon={Eye} tooltip="Detalle del negocio" ariaLabel="Detalle" onClick={onClick} />
        <IconButton icon={Share2} tooltip="Compartir: link del cliente y demo" ariaLabel="Compartir" onClick={onShare} />
        <IconButton
          icon={ExternalLink}
          tooltip={oferta.reserva_token ? 'Abrir el link del cliente' : 'Vista previa: esta oferta no tiene link de cliente'}
          ariaLabel="Abrir la oferta digital"
          onClick={onAbrir}
        />
        {esPerdido && (
          <IconButton
            icon={MessageSquareWarning}
            tooltip={oferta.no_avance ? 'Editar la razón por la que no avanzó' : '¿Por qué no avanzó?'}
            ariaLabel="Razón de no avance"
            className={oferta.no_avance ? undefined : 'border-amber-300 text-amber-600 hover:bg-amber-50'}
            onClick={onRegistrarNoAvance}
          />
        )}
      </div>
    </div>
  );
}

export default AgentPipeline;
