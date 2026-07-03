import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OfertaComercial, PaymentPlan } from "./offer-data";
import type { Agent } from "./agent-data";
import { mesesEntreFechas, calcDynamicScheme, calcEscalonadoScheme } from "@/utils/escalonadoUtils";

// ── Helpers ──────────────────────────────────────────────────────────────────

const COUNTRY_DIAL: Record<string, string> = { MX: "52", US: "1", IN: "91" };

function toDialCode(clave: string | null | undefined): string {
  if (!clave) return "52";
  if (/^\+?\d+$/.test(clave)) return clave.replace("+", "");
  return COUNTRY_DIAL[clave.toUpperCase()] ?? "52";
}

function buildWhatsapp(clave: string | null | undefined, telefono: string): string {
  return `${toDialCode(clave)}${telefono.replace(/\D/g, "")}`;
}

// ── Helpers (idénticos a construction-progress-data.ts del portal-cliente) ───

function toEmbedUrl(url: string): string {
  if (!url) return url;
  if (url.includes("/embed/")) return url;
  const watchMatch = url.match(/[?&]v=([^&#]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  return url;
}

function calcProgressFromDates(inicio: string | null, entrega: string | null): number {
  if (!inicio || !entrega) return 0;
  const start = new Date(inicio).getTime();
  const end   = new Date(entrega).getTime();
  const now   = Date.now();
  if (end <= start) return 0;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

const DEFAULT_MILESTONES = [
  { phase: "Cimentación",   pct: 5,   done: false },
  { phase: "Estructura",    pct: 28,  done: false },
  { phase: "Albañilería",   pct: 55,  done: false },
  { phase: "Instalaciones", pct: 75,  done: false },
  { phase: "Acabados",      pct: 90,  done: false },
  { phase: "Entrega",       pct: 100, done: false },
];

function applyProgressToMilestones(milestones: typeof DEFAULT_MILESTONES, pct: number) {
  return milestones.map((m) => ({ ...m, done: pct >= m.pct }));
}

function fmtDate(ts: string): string {
  return new Date(ts).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

// Supabase Pro image transform — only rewrites Supabase Storage object URLs
// No resize: only format conversion + quality, preserves original dimensions
function toOptimizedUrl(url: string, _width: number, quality = 80): string {
  if (!url) return url;
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const base = url.slice(0, idx) + "/storage/v1/render/image/public/" + url.slice(idx + marker.length);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}quality=${quality}&format=webp`;
}

// ── Payment plan calculator ──────────────────────────────────────────────────

function calcPaymentPlans(
  esquemas: any[],
  listPrice: number,
  fechaGeneracion?: string,
  fechaEntrega?: string | null,
): PaymentPlan[] {
  const mesesEfectivos =
    fechaGeneracion && fechaEntrega
      ? mesesEntreFechas(fechaGeneracion, fechaEntrega)
      : 0;

  return esquemas.map((e) => {
    const pctDesc     = Number(e.porcentaje_descuento_aumento ?? 0);
    const finalPrice  = listPrice * (1 + pctDesc / 100);
    const pctEnganche = Number(e.porcentaje_enganche ?? 0);
    const downPaymentAmount = finalPrice * (pctEnganche / 100);

    // Escalonado: tramos with fixed monthly amounts (stored in centavos)
    const tramos = e.tramos_mensualidad;
    const isEscalonado = Array.isArray(tramos) && tramos.length > 0
      && tramos.some((t: any) => (t.monto_mensualidad ?? 0) > 0);

    let nMensual: number;
    let monthlyAmount: number;
    let installmentsTotal: number;
    let finalPaymentAmount: number;
    let pctMensual: number;
    let pctEntrega: number;
    let installmentsEndDate = "";

    if (isEscalonado) {
      // Los esquemas dinámicos (no manuales) recalculan meses y fecha final contra
      // la fecha de entrega ACTUAL del proyecto. Los manuales conservan sus tramos.
      // Cálculo compartido con el diálogo de inventario de agentes (calcEscalonadoScheme).
      const recomputeVsEntrega = e.es_manual !== true && !!fechaEntrega && !!fechaGeneracion;
      const esc = calcEscalonadoScheme(
        e,
        listPrice,
        recomputeVsEntrega ? mesesEntreFechas(fechaGeneracion!, fechaEntrega!) : 0
      );
      nMensual           = esc.meses;
      monthlyAmount      = esc.mensualidad;
      installmentsTotal  = esc.mensualidadesTotal;
      finalPaymentAmount = esc.entrega;
      installmentsEndDate = recomputeVsEntrega ? fechaEntrega! : "";
      pctMensual         = finalPrice > 0 ? Math.floor((installmentsTotal / finalPrice) * 100) : 0;
      pctEntrega         = finalPrice > 0 ? Math.floor((finalPaymentAmount / finalPrice) * 100) : 0;
    } else if (mesesEfectivos > 0 && Number(e.porcentaje_mensualidades ?? 0) > 0) {
      const dyn = calcDynamicScheme(e, listPrice, mesesEfectivos);
      nMensual           = dyn.meses;
      monthlyAmount      = dyn.mensualidad;
      installmentsTotal  = dyn.mensualidadesTotal;
      finalPaymentAmount = dyn.entrega;
      pctMensual         = dyn.porcentajeMensualidades;
      pctEntrega         = dyn.porcentajeEntrega;
    } else {
      pctMensual  = Number(e.porcentaje_mensualidades ?? 0);
      pctEntrega  = Number(e.porcentaje_entrega ?? 0);
      nMensual    = Number(e.numero_mensualidades ?? 0);
      installmentsTotal  = finalPrice * (pctMensual / 100);
      monthlyAmount      = nMensual > 0 ? installmentsTotal / nMensual : 0;
      finalPaymentAmount = finalPrice * (pctEntrega / 100);
    }

    return {
      id: String(e.id),
      name: e.nombre ?? `Plan ${e.orden ?? e.id}`,
      type: nMensual > 0 ? "escalonado" : "standard",
      isPersonalized: e.es_manual === true,
      finalPrice,
      discountPct:    pctDesc < 0 ? Math.abs(pctDesc) : undefined,
      discountAmount: pctDesc < 0 ? Math.abs(listPrice - finalPrice) : undefined,
      downPaymentPct: pctEnganche,
      downPaymentAmount,
      installments: nMensual > 0
        ? { count: nMensual, monthlyAmount, endDate: installmentsEndDate }
        : undefined,
      installmentsPct: pctMensual,
      finalPaymentPct: pctEntrega,
      finalPaymentAmount,
    } as PaymentPlan;
  });
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export interface OfferWithAgent {
  offer: OfertaComercial;
  agent: Agent | null;
}

async function fetchOfertaFromDB(ofertaId: string): Promise<OfferWithAgent | null> {
  const numId = parseInt(ofertaId.replace(/^[A-Z]+-/, ""), 10);
  if (isNaN(numId)) return null;

  // 1. Oferta base
  const { data: oferta } = await supabase
    .from("ofertas")
    .select("id, id_propiedad, id_esquema_pago_seleccionado, fecha_generacion, email_creador, activo, mostrar_piso_en_oferta, mostrar_precio_m2_en_oferta, id_persona_lead")
    .eq("id", numId)
    .eq("activo", true)
    .maybeSingle();

  if (!oferta) return null;

  const propiedadId = oferta.id_propiedad;

  // 2. Propiedad
  const { data: propiedad } = await supabase
    .from("propiedades")
    .select("id, numero_propiedad, numero_piso, m2_interiores, m2_exteriores, precio_lista, id_edificio_modelo, id_vista, url_imagen_portada")
    .eq("id", propiedadId)
    .maybeSingle();

  if (!propiedad) return null;

  // 3. Edificio_modelo → modelo + edificio → proyectoId
  const { data: emData } = await supabase
    .from("edificios_modelos")
    .select("id, id_edificio, id_modelo, edificios:edificios_modelos_id_edificio_fkey!inner(id, nombre, id_proyecto), modelos:edificios_modelos_id_modelo_fkey(id, nombre, numero_recamaras, numero_completo_banos, numero_medio_bano, plano_arquitectonico, url_imagen_portada)")
    .eq("id", propiedad.id_edificio_modelo)
    .maybeSingle();

  const edificio = (emData as any)?.edificios;
  const modelo   = (emData as any)?.modelos;
  const proyectoId: number = edificio?.id_proyecto;

  if (!proyectoId) return null;

  // 4. Todo lo del proyecto en paralelo — esquemas filtrados por proyecto
  const [
    { data: proyecto },
    { data: multimedias },
    { data: videos },
    { data: amenidadesProyecto },
    { data: vista },
    { data: esquemas },
  ] = await Promise.all([
    supabase
      .from("proyectos")
      .select("id, nombre, descripcion, direccion, latitud, longitud, url_logo, precio_m2_actual, fecha_lanzamiento, fecha_entrega, fecha_entrega_proyecto, id_estatus_proyecto, fecha_actualizacion, url_imagen_portada")
      .eq("id", proyectoId)
      .maybeSingle(),
    supabase
      .from("multimedias_proyecto")
      .select("url")
      .eq("id_proyecto", proyectoId)
      .eq("es_imagen", true)
      .eq("activo", true)
      .order("id", { ascending: false })
      .limit(20),
    supabase
      .from("videos_youtube")
      .select("id, nombre, link, fecha_creacion")
      .eq("id_proyecto", proyectoId)
      .eq("activo", true)
      .order("id", { ascending: false })
      .limit(5),
    supabase
      .from("amenidades_proyectos")
      .select("amenidades:amenidades_proyectos_id_amenidad_fkey(id, nombre, url)")
      .eq("id_proyecto", proyectoId)
      .eq("activo", true),
    propiedad.id_vista
      ? supabase.from("vistas").select("nombre").eq("id", propiedad.id_vista).maybeSingle()
      : Promise.resolve({ data: null }),
    // Esquemas filtrados por proyecto (no todos los esquemas de la BD)
    supabase
      .from("esquemas_pago")
      .select("id, nombre, porcentaje_descuento_aumento, porcentaje_enganche, porcentaje_mensualidades, numero_mensualidades, porcentaje_entrega, es_manual, orden, tramos_mensualidad")
      .eq("id_proyecto", proyectoId)
      .eq("activo", true)
      .order("orden", { ascending: true }),
  ]);

  if (!proyecto) return null;

  // 5. Campos opcionales + agente — todos en paralelo para evitar waterfall
  //    (05062026_ofertas_schema_marketing_presencia.md)
  //    Si las columnas no existen en DB, estas queries retornan null y se usan fallbacks
  const modeloId = modelo?.id;
  const [
    { data: proyectoMkt },
    { data: modeloExtra },
    { data: showroom },
    { data: agentUser },
    { data: leadPersona },
    { data: multimediasModelo },
  ] = await Promise.all([
    supabase
      .from("proyectos")
      .select("url_sitio_web, instagram_handle, facebook_handle, youtube_handle, slogan")
      .eq("id", proyectoId)
      .maybeSingle(),
    modeloId
      ? supabase
          .from("modelos")
          .select("url_tour_360, highlights")
          .eq("id", modeloId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("showrooms_proyecto")
      .select("nombre, descripcion_direccion, horarios, latitud, longitud")
      .eq("id_proyecto", proyectoId)
      .eq("activo", true)
      .order("fecha_actualizacion", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Agente: busca persona por email del creador de la oferta en el mismo batch
    oferta.email_creador
      ? supabase
          .from("usuarios")
          .select("id_persona, foto_perfil_url, frase_perfil, personas:id_persona(id, nombre_legal, email, telefono, clave_pais_telefono)")
          .eq("email", oferta.email_creador)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Prospecto lead: email vinculado a la oferta (no expuesto en URL)
    (oferta as any).id_persona_lead
      ? supabase
          .from("personas")
          .select("email")
          .eq("id", (oferta as any).id_persona_lead)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Imágenes del modelo: planos y vistas de propiedad
    modeloId
      ? (supabase as any)
          .from("multimedias_modelo")
          .select("url, ver_como_imagen_de_propiedad, ver_como_ubicacion_en_oferta")
          .eq("id_modelo", modeloId)
          .eq("activo", true)
          .order("id", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  // Model media: floor plan + property images
  const modeloMediaRows: any[] = (multimediasModelo as any[]) ?? [];
  const floorPlanRow = modeloMediaRows.find((m) => m.ver_como_ubicacion_en_oferta && m.url);
  const floorPlanUrl: string | undefined = floorPlanRow?.url
    ? toOptimizedUrl(floorPlanRow.url, 1200, 85)
    : (modelo?.plano_arquitectonico ? toOptimizedUrl(modelo.plano_arquitectonico, 1200, 85) : undefined);
  const modeloPropertyImages: string[] = modeloMediaRows
    .filter((m) => m.ver_como_imagen_de_propiedad && m.url)
    .map((m) => toOptimizedUrl(m.url, 1200, 80));

  // Construir agentId y datos del agente a partir del resultado paralelo
  const agentPersona = (agentUser as any)?.personas ?? null;
  let agentId = "AGT-SOZU";
  if ((agentUser as any)?.id_persona) agentId = `AGT-${(agentUser as any).id_persona}`;

  // 6. Construcción — misma lógica que construction-progress-data.ts
  const videoRows = (videos ?? []) as any[];
  const fotoRows  = (multimedias ?? []) as any[];
  const latestVideo = videoRows[0];

  const globalProgress = calcProgressFromDates(
    (proyecto as any).fecha_lanzamiento,
    (proyecto as any).fecha_entrega_proyecto ?? (proyecto as any).fecha_entrega,
  );

  const milestones = applyProgressToMilestones(DEFAULT_MILESTONES, globalProgress);

  const constructionPhotos = fotoRows.slice(0, 6).map((f: any) => ({
    src: toOptimizedUrl(f.url, 800, 75),
    alt: `${(proyecto as any).nombre}`,
  }));

  const lastUpdatedRaw = latestVideo?.fecha_creacion ?? (proyecto as any).fecha_actualizacion;
  const lastUpdated = lastUpdatedRaw ? fmtDate(lastUpdatedRaw) : undefined;

  // 7. Galería principal — portada primero, luego modelo, luego proyecto
  const portadaRaw: string | undefined =
    (propiedad as any).url_imagen_portada || (modelo as any)?.url_imagen_portada || undefined;

  const proyectoGalleryUrls: string[] = fotoRows
    .map((m: any) => toOptimizedUrl(m.url, 1200, 80))
    .filter(Boolean);
  if (proyectoGalleryUrls.length === 0 && (proyecto as any).url_imagen_portada) {
    proyectoGalleryUrls.push(toOptimizedUrl((proyecto as any).url_imagen_portada, 1200, 80));
  }

  // Model property images excluding portada to avoid duplicate
  const modeloGalleryImages: string[] = modeloMediaRows
    .filter((m) => m.ver_como_imagen_de_propiedad && m.url && m.url !== portadaRaw)
    .map((m) => toOptimizedUrl(m.url, 1200, 80));

  const galleryUrls: string[] = [
    ...(portadaRaw ? [toOptimizedUrl(portadaRaw, 1200, 80)] : []),
    ...modeloGalleryImages,
    ...proyectoGalleryUrls,
  ].filter(Boolean);

  // 8. Amenidades
  const amenidadesNames: string[] = (amenidadesProyecto ?? [])
    .map((ap: any) => ap.amenidades?.nombre)
    .filter(Boolean);

  // 9. Esquemas de pago
  const listPrice    = Number(propiedad.precio_lista ?? 0);
  const selectedId   = oferta.id_esquema_pago_seleccionado;
  const allEsqs      = (esquemas ?? []).filter((e: any) => !e.es_manual);
  const selectedIsManual = selectedId
    ? (esquemas ?? []).some((e: any) => e.id === selectedId && e.es_manual)
    : false;

  // Strip internal naming pattern (manual_NNNN_*) and show clean label
  const normalizeManualName = (e: any): any => {
    if (!e.es_manual) return e;
    const cleaned = e.nombre.replace(/^manual_\d+_/i, '').replace(/_/g, ' ').trim();
    return { ...e, nombre: cleaned || 'Plan personalizado' };
  };

  let filteredEsqs: any[];
  if (selectedIsManual && selectedId) {
    // Manual selected: show it first (clean name) + all non-manual for comparison
    const manualEsq = (esquemas ?? []).find((e: any) => e.id === selectedId);
    filteredEsqs = [
      ...(manualEsq ? [normalizeManualName(manualEsq)] : []),
      ...allEsqs,
    ].slice(0, 6);
  } else {
    filteredEsqs = selectedId
      ? [
          ...allEsqs.filter((e: any) => e.id === selectedId),
          ...allEsqs.filter((e: any) => e.id !== selectedId),
        ].slice(0, 6)
      : allEsqs.slice(0, 6);
  }
  const entregaFecha = (proyecto as any).fecha_entrega_proyecto
    ?? (proyecto as any).fecha_entrega
    ?? null;

  const paymentPlans = calcPaymentPlans(filteredEsqs, listPrice, oferta.fecha_generacion, entregaFecha);

  // 9b. If manual scheme selected, override with actual acuerdos when plan was modified
  if (selectedIsManual && selectedId && paymentPlans.length > 0) {
    const { data: cuentas } = await (supabase as any)
      .from('cuentas_cobranza')
      .select('id')
      .eq('id_oferta', numId)
      .eq('activo', true);

    if (cuentas && cuentas.length > 0) {
      const cuentaIds = (cuentas as any[]).map((c: any) => c.id);
      const { data: acuerdos } = await (supabase as any)
        .from('acuerdos_pago')
        .select('id, monto, id_concepto')
        .in('id_cuenta_cobranza', cuentaIds)
        .eq('activo', true);

      if (acuerdos && (acuerdos as any[]).length > 0) {
        const conceptoIds = [...new Set((acuerdos as any[]).map((a: any) => a.id_concepto))] as number[];
        const { data: conceptos } = await (supabase as any)
          .from('conceptos_pago')
          .select('id, nombre')
          .in('id', conceptoIds);
        const conceptoMap: Record<number, string> = {};
        ((conceptos ?? []) as any[]).forEach((c: any) => { conceptoMap[c.id] = (c.nombre ?? '').toLowerCase(); });

        let engancheTotal = 0, mensualidadesTotal = 0, entregaTotal = 0, nMensualidades = 0;
        for (const a of acuerdos as any[]) {
          const nombre = conceptoMap[a.id_concepto] ?? '';
          const monto = Number(a.monto ?? 0);
          if (nombre.includes('apartado') || nombre.includes('enganche')) {
            engancheTotal += monto;
          } else if (nombre.includes('parcialidad') || nombre.includes('mensualidad')) {
            mensualidadesTotal += monto;
            nMensualidades++;
          } else if (nombre.includes('contra entrega') || nombre.includes('entrega')) {
            entregaTotal += monto;
          }
        }

        const tpl = paymentPlans[0];
        const fp = tpl.finalPrice;
        const pctE   = fp > 0 ? Number((engancheTotal   / fp * 100).toFixed(1)) : 0;
        const pctP   = fp > 0 ? Number((mensualidadesTotal / fp * 100).toFixed(1)) : 0;
        const pctEnt = fp > 0 ? Number((entregaTotal     / fp * 100).toFixed(1)) : 0;

        const isModified =
          Math.abs(tpl.downPaymentPct  - pctE)   > 0.5 ||
          Math.abs(tpl.installmentsPct - pctP)   > 0.5 ||
          Math.abs(tpl.finalPaymentPct - pctEnt) > 0.5 ||
          (tpl.installments?.count ?? 0) !== nMensualidades;

        if (isModified) {
          const perPago = nMensualidades > 0 ? mensualidadesTotal / nMensualidades : 0;
          const syntheticPlan: PaymentPlan = {
            ...tpl,
            name: `${tpl.name} modificado`,
            downPaymentPct: pctE,
            downPaymentAmount: engancheTotal,
            installmentsPct: pctP,
            installments: nMensualidades > 0
              ? { count: nMensualidades, monthlyAmount: perPago, endDate: tpl.installments?.endDate ?? '' }
              : undefined,
            finalPaymentPct: pctEnt,
            finalPaymentAmount: entregaTotal,
          };
          paymentPlans.splice(0, 1, syntheticPlan);
        }
      }
    }
  }

  // 10. Expiración (7 días desde generación)
  // Vigencia siempre 7 días — calculado en código, sin campo en DB
  const validUntilDate = new Date(oferta.fecha_generacion);
  validUntilDate.setDate(validUntilDate.getDate() + 7);

  const area = Number(propiedad.m2_interiores ?? 0) + Number(propiedad.m2_exteriores ?? 0);

  const offer = {
    id: String(numId),
    shortLink: `/oferta/${numId}`,
    propertyId: String(propiedadId),
    property: {
      projectName:    (proyecto as any).nombre ?? "",
      buildingName:   edificio?.nombre ?? "",
      unitModel:      modelo?.nombre ?? "",
      unitNumber:     propiedad.numero_propiedad ?? "",
      level:          oferta.mostrar_piso_en_oferta ? (propiedad.numero_piso ?? undefined) : undefined,
      view:           (vista as any)?.nombre ?? undefined,
      area:           area > 0 ? `${area.toFixed(1)} m²` : undefined,
      bedrooms:       Number(modelo?.numero_recamaras ?? 0),
      bathrooms:      Number(modelo?.numero_completo_banos ?? 0),
      halfBathrooms:  Number(modelo?.numero_medio_bano ?? 0),
      parkingSpots:   1,
      parkingType:    "incluido",
      hasBalcony:     false,
      listPrice,
      pricePerM2:     oferta.mostrar_precio_m2_en_oferta
        ? Number((proyecto as any).precio_m2_actual ?? 0)
        : undefined,
    },
    estimatedDelivery:       entregaFecha ? new Date(entregaFecha).toISOString() : undefined,
    // highlights: del modelo (JSONB text[]) — fallback [] si columna aún no existe
    highlights:              Array.isArray((modeloExtra as any)?.highlights)
                               ? (modeloExtra as any).highlights
                               : [],
    gallery:                 galleryUrls,
    galleryCaptions:         galleryUrls.map(() => ""),
    videoUrl:                undefined,
    floorPlanUrl,
    materialsPaletteUrl:     undefined,
    constructionProgress:    globalProgress,
    constructionLastUpdated: lastUpdated,
    constructionVideoUrl:    latestVideo ? toEmbedUrl(latestVideo.link) : undefined,
    constructionVideoTitle:  latestVideo?.nombre ?? undefined,
    constructionPhotos,
    constructionMilestones:  milestones,
    constructionDescription: undefined,
    amenities:               amenidadesNames,
    amenitiesEnriched:       [],
    location: {
      address: (proyecto as any).direccion ?? "",
      lat:     Number((proyecto as any).latitud ?? 0),
      lng:     Number((proyecto as any).longitud ?? 0),
      nearby:  [],
    },
    paymentPlans,
    prospectEmail: (leadPersona as any)?.email ?? undefined,
    generatedAt: oferta.fecha_generacion ?? new Date().toISOString(),
    generatedBy: oferta.email_creador ?? "SOZU",
    agentId,
    validUntil: validUntilDate.toISOString(),
    status: "active",
    // development: siempre presente si hay proyecto — fallbacks para campos opcionales
    development: {
      website:        (proyectoMkt as any)?.url_sitio_web ?? undefined,
      tagline:        (proyectoMkt as any)?.slogan ?? undefined,
      logoUrl:        (proyecto as any).url_logo ?? undefined,
      logoUrlInverse: undefined,
      legalName:      (proyecto as any).nombre,
      socials: ((proyectoMkt as any)?.instagram_handle ||
                (proyectoMkt as any)?.facebook_handle  ||
                (proyectoMkt as any)?.youtube_handle)
        ? {
            instagram: (proyectoMkt as any)?.instagram_handle ?? undefined,
            facebook:  (proyectoMkt as any)?.facebook_handle  ?? undefined,
            youtube:   (proyectoMkt as any)?.youtube_handle   ?? undefined,
          }
        : undefined,
      showroom: (showroom as any)?.descripcion_direccion
        ? (() => {
            const lat = (showroom as any).latitud;
            const lon = (showroom as any).longitud;
            const hasCoords = lat != null && lon != null;
            return {
              address:            (showroom as any).descripcion_direccion,
              googleMapsUrl:      hasCoords ? `https://www.google.com/maps?q=${lat},${lon}` : undefined,
              googleMapsEmbedUrl: hasCoords ? `https://www.google.com/maps?q=${lat},${lon}&output=embed` : undefined,
              schedule:           (showroom as any).horarios
                ? [{ daysLabel: "Horarios", hours: (showroom as any).horarios }]
                : [],
            };
          })()
        : undefined,
    },
    // tour360: del modelo — fallback undefined muestra card "próximamente"
    tour360: (modeloExtra as any)?.url_tour_360
      ? {
          provider:         "kuula" as const,
          embedUrl:         (modeloExtra as any).url_tour_360,
          fallbackUrl:      (modeloExtra as any).url_tour_360,
          durationEstimate: "8-12 minutos",
        }
      : undefined,
    parkingSlots:        [],
    parkingLevelLayouts: [],
  } as unknown as OfertaComercial;

  // Construir Agent inline — datos ya disponibles — datos ya disponibles del batch paralelo
  const agent: Agent | null = agentPersona
    ? (() => {
        const firstName = (agentPersona.nombre_legal ?? "").split(" ")[0];
        const phone = agentPersona.telefono
          ? `${agentPersona.clave_pais_telefono ?? "+52"} ${agentPersona.telefono}`
          : "";
        const whatsapp = agentPersona.telefono
          ? buildWhatsapp(agentPersona.clave_pais_telefono, agentPersona.telefono)
          : "";
        return {
          id: agentId,
          fullName: agentPersona.nombre_legal ?? "",
          firstName,
          title: "Asesor SOZU",
          photoUrl: (agentUser as any)?.foto_perfil_url ?? "",
          bio: (agentUser as any)?.frase_perfil ?? "Estoy aquí para acompañarte en cada paso de tu decisión de compra. ¡Contáctame sin compromiso!",
          phone,
          email: agentPersona.email ?? "",
          whatsapp,
          brokerage: "SOZU",
          isAllied: false,
        } as Agent;
      })()
    : null;

  return { offer, agent };
}

// ── Agent from DB ─────────────────────────────────────────────────────────────

async function fetchAgentFromDB(agentId: string): Promise<Agent | null> {
  // agentId format: "AGT-{persona_id}"
  const personaId = parseInt(agentId.replace("AGT-", ""), 10);
  if (isNaN(personaId)) return null;

  const { data: persona } = await supabase
    .from("personas")
    .select("id, nombre_legal, email, telefono, clave_pais_telefono")
    .eq("id", personaId)
    .maybeSingle();

  if (!persona) return null;

  const firstName = (persona.nombre_legal ?? "").split(" ")[0];
  const phone = persona.telefono
    ? `${persona.clave_pais_telefono ?? "+52"} ${persona.telefono}`
    : "";
  const whatsapp = persona.telefono
    ? buildWhatsapp(persona.clave_pais_telefono, persona.telefono)
    : "";

  return {
    id: agentId,
    fullName: persona.nombre_legal ?? "",
    firstName,
    title: "Asesor SOZU",
    photoUrl: "",
    phone,
    email: persona.email ?? "",
    whatsapp,
    brokerage: "SOZU",
    isAllied: false,
  } as Agent;
}

export function useAgentFromDB(agentId: string) {
  return useQuery({
    queryKey: ["agent-db", agentId],
    queryFn:  () => fetchAgentFromDB(agentId),
    enabled:  !!agentId && agentId.startsWith("AGT-") && !agentId.startsWith("AGT-SOZU"),
    staleTime: 10 * 60 * 1000,
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOfferFromDB(ofertaId: string) {
  return useQuery({
    queryKey: ["oferta-db", ofertaId],
    queryFn:  () => fetchOfertaFromDB(ofertaId),
    enabled:  !!ofertaId && !isNaN(parseInt(ofertaId.replace(/^[A-Z]+-/, ""), 10)),
    staleTime: 0,
  });
}
