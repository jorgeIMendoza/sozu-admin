import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OfertaComercial, PaymentPlan } from "./offer-data";
import type { Agent } from "./agent-data";
import { calcDynamicScheme, calcEscalonadoScheme, mesesMensualidadesRestantes } from "@/utils/escalonadoUtils";
import { normalizeAvatarUrl } from "@/lib/avatarUrl";
import { isValidRFC } from "@/utils/fiscalDataValidation";

// ── Helpers ──────────────────────────────────────────────────────────────────

const COUNTRY_DIAL: Record<string, string> = { MX: "52", US: "1", IN: "91" };

function toDialCode(clave: string | null | undefined): string {
  // clave_pais_telefono es CHAR(n): puede venir con espacios de relleno ("MX   ")
  // o como dial ("+52"/"52") o código de país ("MX"). Normalizar con trim.
  const c = (clave ?? "").trim();
  if (!c) return "52";
  if (/^\+?\d+$/.test(c)) return c.replace("+", "");
  return COUNTRY_DIAL[c.toUpperCase()] ?? "52";
}

function buildWhatsapp(clave: string | null | undefined, telefono: string): string {
  return `${toDialCode(clave)}${telefono.replace(/\D/g, "")}`;
}

/**
 * Equipo al que pertenece el asesor, derivado del dominio del correo.
 * ej. luz@sozu.mx → "SOZU" · pablo@investimento.com → "Investimento".
 */
function teamFromEmail(email?: string | null): string {
  const domain = email?.split("@")[1]?.split(".")[0]?.trim().toLowerCase();
  if (!domain) return "SOZU";
  if (domain === "sozu") return "SOZU";
  return domain.charAt(0).toUpperCase() + domain.slice(1);
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
  // El endpoint de transformación /render/image/ solo existe en Supabase Cloud
  // (*.supabase.co). En self-hosted (dev: supabase-dev.sozu.com) 404ea y rompe
  // las imágenes → devolver la URL pública original sin transformar.
  if (!url.includes(".supabase.co/")) return url;
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
  // Meses de mensualidades RESTANTES: de hoy a la entrega MENOS 1 mes (el mes de
  // entrega es el Pago a escrituración, no mensualidad). Si ya estamos en/después
  // del mes de entrega → 0 mensualidades → todo el saldo va a escrituración.
  // (fechaGeneracion se ignora: el conteo baja conforme pasan los días).
  const mesesEfectivos = mesesMensualidadesRestantes(fechaEntrega);

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
      const recomputeVsEntrega = e.es_manual !== true && !!fechaEntrega;
      const esc = calcEscalonadoScheme(
        e,
        listPrice,
        recomputeVsEntrega ? mesesEfectivos : 0
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
    .select("id, numero_propiedad, numero_piso, m2_interiores, m2_exteriores, precio_lista, id_edificio_modelo, id_vista, url_imagen_portada, clabe_stp_tmp_apartado")
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
    { data: categoriasMultimedia },
  ] = await Promise.all([
    supabase
      .from("proyectos")
      .select("id, nombre, descripcion, direccion, latitud, longitud, url_logo, precio_m2_actual, fecha_lanzamiento, fecha_entrega, fecha_entrega_proyecto, id_estatus_proyecto, fecha_actualizacion, url_imagen_portada")
      .eq("id", proyectoId)
      .maybeSingle(),
    supabase
      .from("multimedias_proyecto")
      .select("url, id_categoria")
      .eq("id_proyecto", proyectoId)
      .eq("es_imagen", true)
      .eq("activo", true)
      .order("id", { ascending: false })
      .limit(50),
    supabase
      .from("videos_youtube")
      .select("id, nombre, link, fecha_creacion")
      .eq("id_proyecto", proyectoId)
      .eq("activo", true)
      .order("id", { ascending: false })
      .limit(5),
    supabase
      .from("amenidades_proyectos")
      .select("url_imagen, amenidades:amenidades_proyectos_id_amenidad_fkey(id, nombre, url)")
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
    supabase
      .from("categorias_multimedia_proyecto")
      .select("id, nombre")
      .eq("activo", true),
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
    { data: bodegasRows },
    { data: estacionamientosRows },
    { data: tiposEstacionamiento },
  ] = await Promise.all([
    supabase
      .from("proyectos")
      .select("url_sitio_web, instagram_handle, facebook_handle, youtube_handle, slogan")
      .eq("id", proyectoId)
      .maybeSingle(),
    modeloId
      ? supabase
          .from("modelos")
          .select("url_tour_360")
          .eq("id", modeloId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("showrooms_proyecto")
      .select("nombre, descripcion_direccion, latitud, longitud")
      .eq("id_proyecto", proyectoId)
      .eq("activo", true)
      .order("fecha_actualizacion", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Agente: busca persona por email del creador de la oferta en el mismo batch
    oferta.email_creador
      ? supabase
          .from("usuarios")
          .select("nombre, id_persona, foto_perfil_url, frase_perfil, telefono, clave_pais_telefono")
          .eq("email", oferta.email_creador)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Prospecto lead: email vinculado a la oferta (no expuesto en URL)
    (oferta as any).id_persona_lead
      ? supabase
          .from("personas")
          .select("email, rfc")
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
    // Bodegas de la propiedad (extras vinculados a la unidad de la oferta)
    (supabase as any)
      .from("bodegas")
      .select("id, nombre, ubicacion, m2, es_incluido, id_producto")
      .eq("id_propiedad", propiedadId)
      .eq("activo", true)
      .order("id", { ascending: true }),
    // Estacionamientos de la propiedad (con id_tipo → tipos_estacionamiento)
    (supabase as any)
      .from("estacionamientos")
      .select("id, nombre, ubicacion, m2, es_incluido, id_tipo")
      .eq("id_propiedad", propiedadId)
      .eq("activo", true)
      .order("id", { ascending: true }),
    // Catálogo de tipos de estacionamiento (Normal, Tandem, Doble, Carlift)
    (supabase as any)
      .from("tipos_estacionamiento")
      .select("id, nombre")
      .eq("activo", true),
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

  // ── Plano de ubicación en el nivel (edificios_niveles_planos) para señalar la unidad ──
  // Mismo dato que la Ficha Técnica del cliente: imagen del nivel + regiones (polígonos)
  // que resaltan la unidad. FloorPlanCanvas hace el match del depto sobre estas regiones.
  const numeroPisoNivel = (propiedad as any).numero_piso != null ? Number((propiedad as any).numero_piso) : null;
  let planoUbicacionUrl: string | undefined;
  let planoUbicacionRegiones: any[] = [];
  if (edificio?.id && numeroPisoNivel) {
    const { data: nivelPlano } = await (supabase as any)
      .from("edificios_niveles_planos")
      .select("imagen_url, regiones")
      .eq("id_edificio", edificio.id)
      .eq("nivel", numeroPisoNivel)
      .eq("activo", true)
      .maybeSingle();
    if (nivelPlano) {
      planoUbicacionUrl = (nivelPlano as any).imagen_url
        ? toOptimizedUrl((nivelPlano as any).imagen_url, 1200, 85)
        : undefined;
      planoUbicacionRegiones = (nivelPlano as any).regiones || [];
    }
  }
  // Depto derivado (numero_propiedad menos dígitos del piso) para el match del resaltado.
  const rawPropNum = ((propiedad as any).numero_propiedad || "").toString().trim();
  const propNumDigits = rawPropNum.replace(/\D/g, "");
  const pisoDigits = (numeroPisoNivel?.toString() || "").replace(/\D/g, "");
  const extractedDepto =
    pisoDigits && propNumDigits.startsWith(pisoDigits) && propNumDigits.length > pisoDigits.length
      ? propNumDigits.slice(pisoDigits.length)
      : propNumDigits;
  const unitDepto = extractedDepto.length === 1 ? extractedDepto.padStart(2, "0") : extractedDepto || rawPropNum;

  // Construir agentId y datos del agente a partir del resultado paralelo.
  // personas se trae en query APARTE (no embed) para no depender del schema-cache
  // de PostgREST: en dev el embed falla y dejaba al agente null. Solo se consulta
  // si el creador tiene persona vinculada (los super admin no la tienen).
  let agentPersona: any = null;
  if ((agentUser as any)?.id_persona) {
    const { data: ap } = await supabase
      .from("personas")
      .select("id, nombre_legal, email, telefono, clave_pais_telefono")
      .eq("id", (agentUser as any).id_persona)
      .maybeSingle();
    agentPersona = ap ?? null;
  }
  let agentId = "AGT-SOZU";
  if ((agentUser as any)?.id_persona) agentId = `AGT-${(agentUser as any).id_persona}`;

  // 6. Construcción — misma lógica que construction-progress-data.ts
  const videoRows = (videos ?? []) as any[];
  const fotoRows  = (multimedias ?? []) as any[];
  const latestVideo = videoRows[0];

  // Split project photos: "Avances de obra" → construcción; el resto → galería.
  // (resolver id por nombre; los ids difieren dev/prod)
  const catRows = (categoriasMultimedia ?? []) as { id: number; nombre: string }[];
  const avancesId = catRows.find((c) => c.nombre === "Avances de obra")?.id ?? null;
  // Galería principal: SOLO fotos con categoría "General". Fallback (si no existe
  // esa categoría en el catálogo): todo lo que no sea "Avances de obra".
  const generalId = catRows.find((c) => /general/i.test(c.nombre))?.id ?? null;
  const avanceFotos  = fotoRows.filter((f: any) => avancesId != null && f.id_categoria === avancesId);
  const galleryFotos = generalId != null
    ? fotoRows.filter((f: any) => f.id_categoria === generalId)
    : fotoRows.filter((f: any) => avancesId == null || f.id_categoria !== avancesId);

  const globalProgress = calcProgressFromDates(
    (proyecto as any).fecha_lanzamiento,
    (proyecto as any).fecha_entrega_proyecto ?? (proyecto as any).fecha_entrega,
  );

  const milestones = applyProgressToMilestones(DEFAULT_MILESTONES, globalProgress);

  const constructionPhotos = avanceFotos.slice(0, 6).map((f: any) => ({
    src: toOptimizedUrl(f.url, 800, 75),
    alt: `${(proyecto as any).nombre}`,
  }));

  const lastUpdatedRaw = latestVideo?.fecha_creacion ?? (proyecto as any).fecha_actualizacion;
  const lastUpdated = lastUpdatedRaw ? fmtDate(lastUpdatedRaw) : undefined;

  // 7. Galería principal — SOLO portada del proyecto + multimedia "General".
  // Principal = portada del proyecto (ej. portada de Bottura); luego todas las
  // fotos de multimedia con categoría "General". Sin imágenes de modelo/propiedad.
  const portadaProyecto: string | undefined = (proyecto as any).url_imagen_portada || undefined;

  const generalGalleryUrls: string[] = galleryFotos
    .map((m: any) => m.url as string | null | undefined)
    .filter((u): u is string => Boolean(u) && u !== portadaProyecto)
    .map((u) => toOptimizedUrl(u, 1200, 80));

  const galleryUrls: string[] = [
    ...(portadaProyecto ? [toOptimizedUrl(portadaProyecto, 1200, 80)] : []),
    ...generalGalleryUrls,
  ].filter(Boolean);

  // 8. Amenidades
  const amenidadesNames: string[] = (amenidadesProyecto ?? [])
    .map((ap: any) => ap.amenidades?.nombre)
    .filter(Boolean);

  // Bento enriquecido: foto real (url_imagen) + nombre. Sin foto → solo texto.
  // El icono del catálogo NO se usa en la oferta (solo PDF).
  const amenitiesEnriched = (amenidadesProyecto ?? [])
    .map((ap: any, i: number) => {
      const name = ap.amenidades?.nombre;
      if (!name) return null;
      return {
        id: String(ap.amenidades?.id ?? i),
        name,
        shortDescription: "",
        images: ap.url_imagen
          ? [{ url: toOptimizedUrl(ap.url_imagen, 800, 80), caption: name }]
          : [],
        size: (ap.url_imagen && i % 5 === 0 ? "large" : "medium") as "large" | "medium" | "small",
        iconName: "",
      };
    })
    .filter(Boolean);

  // 9. Esquemas de pago
  const listPrice    = Number(propiedad.precio_lista ?? 0);
  const selectedId   = oferta.id_esquema_pago_seleccionado;

  // Si el esquema seleccionado fue VERSIONADO (desactivado al editarlo), no aparece en la
  // lista activa del proyecto. Lo traemos aparte para que la oferta del cliente siga
  // mostrando su plan CONGELADO (los porcentajes con los que lo aceptó).
  let esquemasAug = (esquemas ?? []) as any[];
  if (selectedId != null && !esquemasAug.some((e: any) => e.id === selectedId)) {
    const { data: selEsq } = await (supabase as any)
      .from("esquemas_pago")
      .select("id, nombre, porcentaje_descuento_aumento, porcentaje_enganche, porcentaje_mensualidades, numero_mensualidades, porcentaje_entrega, es_manual, orden, tramos_mensualidad")
      .eq("id", selectedId)
      .maybeSingle();
    if (selEsq) esquemasAug = [...esquemasAug, selEsq];
  }

  // ¿La oferta ya está formalizada con cuenta de cobranza (apartado/venta)? Entonces el
  // plan queda congelado: se muestra SOLO el seleccionado (no el selector completo).
  const { data: cuentasOferta } = await (supabase as any)
    .from("cuentas_cobranza")
    .select("id")
    .eq("id_oferta", numId)
    .eq("activo", true)
    .limit(1);
  const ofertaTieneCuenta = Array.isArray(cuentasOferta) && cuentasOferta.length > 0;

  const allEsqs      = esquemasAug.filter((e: any) => !e.es_manual);
  const selectedIsManual = selectedId
    ? esquemasAug.some((e: any) => e.id === selectedId && e.es_manual)
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
    const manualEsq = esquemasAug.find((e: any) => e.id === selectedId);
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

  // 9c. Desglose financiero AUTORITATIVO server-side (RPC get_oferta_financials).
  //     Fuente de verdad no manipulable desde consola: apartado $20k, enganche neto,
  //     parcialidades (hoy→entrega−1 mes), pago a escrituración y vigencia.
  //     Si el RPC aún no existe en la BD (DDL pendiente) → se conservan los montos
  //     calculados en TS arriba (fallback graceful).
  let vigenciaHasta: string | null = null;
  let mesesRestantes: number | null = null;
  let finAgente: any = null;
  try {
    const { data: fin, error: finErr } = await (supabase as any).rpc("get_oferta_financials", {
      p_oferta_id: numId,
    });
    if (!finErr && fin) {
      // Datos del creador vía RPC (usuarios tiene RLS que bloquea anon en la oferta pública)
      finAgente = fin.agente ?? null;
    }
    if (!finErr && fin && Array.isArray(fin.planes)) {
      const finById = new Map<string, any>(fin.planes.map((p: any) => [String(p.esquema_id), p]));
      for (let i = 0; i < paymentPlans.length; i++) {
        const pl = paymentPlans[i];
        const f = finById.get(pl.id);
        if (!f) continue;
        paymentPlans[i] = {
          ...pl,
          finalPrice:            Number(f.precio_final),
          downPaymentPct:        Number(f.pct_enganche),
          downPaymentAmount:     Number(f.enganche_total),
          apartado:              Number(f.apartado),
          downPaymentNetAmount:  Number(f.enganche_neto),
          installments: Number(f.meses) > 0
            ? { count: Number(f.meses), monthlyAmount: Number(f.mensualidad_monto), endDate: pl.installments?.endDate ?? "" }
            : undefined,
          installmentsPct:       Number(f.pct_mensualidades),
          finalPaymentPct:       Number(f.pct_escrituracion),
          finalPaymentAmount:    Number(f.escrituracion_monto),
        };
      }
      vigenciaHasta  = fin.vigencia_hasta ?? null;
      mesesRestantes = fin.meses_restantes != null ? Number(fin.meses_restantes) : null;
    }
  } catch {
    /* RPC ausente o error → fallback a montos calculados en TS */
  }

  // 9d. Normalizar porcentajes a enteros que SIEMPRE sumen 100% (UI/comprensión).
  //     Enganche + Mensualidades se redondean; Escrituración absorbe el resto para
  //     garantizar exactamente 100. Los MONTOS quedan intactos (precisión completa).
  for (let i = 0; i < paymentPlans.length; i++) {
    const pl = paymentPlans[i];
    const eng = Math.round(pl.downPaymentPct ?? 0);
    const mens = pl.installmentsPct > 0 ? Math.round(pl.installmentsPct) : 0;
    const esc = Math.max(0, 100 - eng - mens);
    paymentPlans[i] = {
      ...pl,
      downPaymentPct: eng,
      installmentsPct: mens,
      finalPaymentPct: esc,
    };
  }

  // Congelado: si la oferta ya tiene cuenta de cobranza (aceptada/apartada), mostrar SOLO
  // el plan seleccionado. Sin cuenta, se conserva el selector con los planes activos.
  if (ofertaTieneCuenta && selectedId != null) {
    const soloSel = paymentPlans.filter((pl) => pl.id === String(selectedId));
    if (soloSel.length > 0) {
      paymentPlans.length = 0;
      paymentPlans.push(...soloSel);
    }
  }

  // 10. Expiración (7 días desde generación).
  // Autoritativa del RPC (vigencia_hasta) si disponible; si no, fallback en código.
  const validUntilDate = vigenciaHasta
    ? new Date(vigenciaHasta)
    : (() => {
        const d = new Date(oferta.fecha_generacion);
        d.setDate(d.getDate() + 7);
        return d;
      })();

  const area = Number(propiedad.m2_interiores ?? 0) + Number(propiedad.m2_exteriores ?? 0);

  // ── Extras reales de la unidad: bodegas + estacionamientos ──
  const tipoEstacMap = new Map<number, string>(
    ((tiposEstacionamiento as any[]) ?? []).map((t) => [t.id, t.nombre])
  );
  // ── Esquema de pago + CLABE por bodega ──
  // La bodega se vende como "oferta de producto" (ofertas con id_producto). El esquema
  // y la CLABE reales viven en ESA oferta, no en la bodega ni en la unidad. Tomamos la
  // oferta de producto del MISMO lead que la oferta de la unidad (misma propiedad),
  // que es la que corresponde a este comprador. Fuente: id_esquema_pago_seleccionado +
  // clabe_stp_tmp_producto (ver NewProductOfferDialog).
  // Gate CLABE: solo se muestra si el lead tiene RFC válido (oferta formalizada con
  // datos fiscales del cliente). Mismo criterio que el PDF (offerPdfStorageService).
  const leadRfcValido = isValidRFC((leadPersona as any)?.rfc);
  const leadIdOferta = (oferta as any).id_persona_lead ?? null;
  const bodegaPagoByProducto = new Map<
    number,
    { pctEnganche: number; pctEntrega: number; pctMensualidades: number; numMensualidades: number; clabeStp?: string }
  >();
  const bodegaProductoIds = Array.from(
    new Set(((bodegasRows as any[]) ?? []).map((b) => b.id_producto).filter((v) => v != null))
  );
  if (leadIdOferta && bodegaProductoIds.length > 0) {
    const { data: prodOfertas } = await (supabase as any)
      .from("ofertas")
      .select("id, id_producto, id_esquema_pago_seleccionado, clabe_stp_tmp_producto")
      .eq("id_propiedad", propiedadId)
      .eq("id_persona_lead", leadIdOferta)
      .in("id_producto", bodegaProductoIds)
      .order("id", { ascending: false });
    const prodRows = (prodOfertas as any[]) ?? [];
    const esquemaIds = Array.from(
      new Set(prodRows.map((o) => o.id_esquema_pago_seleccionado).filter((v) => v != null))
    );
    const esqMap = new Map<number, any>();
    if (esquemaIds.length > 0) {
      const { data: esquemas } = await (supabase as any)
        .from("esquemas_pago")
        .select("id, porcentaje_enganche, porcentaje_entrega, porcentaje_mensualidades, numero_mensualidades")
        .in("id", esquemaIds);
      for (const e of (esquemas as any[]) ?? []) esqMap.set(e.id, e);
    }
    // Recorremos de más reciente a más antigua (order desc): la primera oferta con
    // esquema para cada producto es la vigente.
    for (const o of prodRows) {
      if (bodegaPagoByProducto.has(o.id_producto)) continue;
      const esq = o.id_esquema_pago_seleccionado ? esqMap.get(o.id_esquema_pago_seleccionado) : null;
      if (!esq) continue;
      bodegaPagoByProducto.set(o.id_producto, {
        pctEnganche: Number(esq.porcentaje_enganche ?? 0),
        pctEntrega: Number(esq.porcentaje_entrega ?? 0),
        pctMensualidades: Number(esq.porcentaje_mensualidades ?? 0),
        numMensualidades: Number(esq.numero_mensualidades ?? 0),
        clabeStp: leadRfcValido ? o.clabe_stp_tmp_producto || undefined : undefined,
      });
    }
  }

  const bodegas = ((bodegasRows as any[]) ?? []).map((b) => ({
    id: b.id,
    nombre: b.nombre ?? "",
    ubicacion: b.ubicacion ?? undefined,
    m2: b.m2 != null ? Number(b.m2) : undefined,
    incluido: !!b.es_incluido,
    idProducto: b.id_producto != null ? Number(b.id_producto) : undefined,
    pago: b.id_producto != null ? bodegaPagoByProducto.get(Number(b.id_producto)) : undefined,
  }));
  const estacionamientos = ((estacionamientosRows as any[]) ?? []).map((e) => ({
    id: e.id,
    nombre: e.nombre ?? "",
    ubicacion: e.ubicacion ?? undefined,
    m2: e.m2 != null ? Number(e.m2) : undefined,
    incluido: !!e.es_incluido,
    tipo: e.id_tipo != null ? tipoEstacMap.get(e.id_tipo) : undefined,
  }));
  // Solo exponer la CLABE de la unidad si el lead tiene RFC válido (ver leadRfcValido).
  const clabeStp = leadRfcValido ? (propiedad as any).clabe_stp_tmp_apartado || undefined : undefined;

  // ── Desarrolladora que lleva el proyecto: entidad relacionada tipo 4
  // (Dueño Vendedor — es donde vive el dato real, ej. Tallwood en Daiku).
  // 2 pasos (sin embed PostgREST) para no depender del schema-cache en dev.
  let developerName: string | undefined;
  let developerLogoUrl: string | undefined;
  let developerWebsite: string | undefined;
  const { data: devRel } = await supabase
    .from("entidades_relacionadas")
    .select("id_persona")
    .eq("id_proyecto", proyectoId)
    .eq("id_tipo_entidad", 4)
    .eq("activo", true)
    .limit(1)
    .maybeSingle();
  if ((devRel as any)?.id_persona) {
    const { data: devPer } = await supabase
      .from("personas")
      .select("nombre_comercial, nombre_legal, url_logo, url_sitio_web")
      .eq("id", (devRel as any).id_persona)
      .maybeSingle();
    if (devPer) {
      developerName = ((devPer as any).nombre_comercial ?? (devPer as any).nombre_legal) || undefined;
      developerLogoUrl = (devPer as any).url_logo ? toOptimizedUrl((devPer as any).url_logo, 240, 85) : undefined;
      developerWebsite = (devPer as any).url_sitio_web || undefined;
    }
  }

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
      // Metraje a precisión completa (hasta 2 decimales, sin redondear): así el
      // metraje mostrado coincide con el divisor real usado en pricePerM2.
      area:           area > 0 ? `${area.toLocaleString("es-MX", { maximumFractionDigits: 2 })} m²` : undefined,
      bedrooms:       Number(modelo?.numero_recamaras ?? 0),
      bathrooms:      Number(modelo?.numero_completo_banos ?? 0),
      halfBathrooms:  Number(modelo?.numero_medio_bano ?? 0),
      // Conteo y tipo reales desde la tabla estacionamientos (antes hardcode 1/incluido)
      parkingSpots:   estacionamientos.length,
      parkingType:    estacionamientos.every((e) => e.incluido) ? "incluido" : "no incluido",
      hasBalcony:     false,
      listPrice,
      // $/m² = precio_lista / m² total (interiores + exteriores), consistente
      // con PDFs y admin. NO usar proyecto.precio_m2_actual (valor de proyecto
      // desligado del metraje real de la unidad → number mostrado no cuadra).
      pricePerM2:     oferta.mostrar_precio_m2_en_oferta && area > 0
        ? listPrice / area
        : undefined,
    },
    estimatedDelivery:       entregaFecha ? new Date(entregaFecha).toISOString() : undefined,
    // highlights: eliminado de la oferta digital (las amenidades ya comunican lo destacado).
    // La columna modelos.highlights se elimina vía DDL (Ejecuciones_manuales).
    highlights:              [],
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
    amenitiesEnriched,
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
      developerName,
      developerLogoUrl,
      // Si la desarrolladora no tiene web, el footer usa SOZU como fallback del link.
      developerWebsite,
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
    bodegas,
    estacionamientos,
    clabeStp,
    planoUbicacionUrl,
    planoUbicacionRegiones,
    unitDepto,
    ...(mesesRestantes != null ? { mesesRestantes } : {}),
  } as unknown as OfertaComercial;

  // Construir Agent inline. SIEMPRE se arma una tarjeta (nunca null) con los datos
  // REALES del creador de la oferta (es el responsable): nombre, email y teléfono.
  // Lo ÚNICO que cambia sin perfil es la foto → si no subió foto_perfil_url se usa
  // el logo SOZU (AgentCard pinta AGENT_PHOTO_FALLBACK cuando photoUrl está vacío).
  // Fuente preferida = RPC (finAgente, bypassa RLS de usuarios en la oferta pública).
  // Fallback = agentUser/agentPersona del batch (solo visible con sesión interna).
  const DEFAULT_BIO =
    "Estoy aquí para acompañarte en cada paso de tu decisión de compra. ¡Contáctame sin compromiso!";
  // Teléfono: RPC ya hace COALESCE(usuarios, personas). Fallback al batch con sesión.
  const clavePais =
    finAgente?.clave_pais ??
    (agentUser as any)?.clave_pais_telefono ?? agentPersona?.clave_pais_telefono;
  const tel =
    finAgente?.telefono ??
    (agentUser as any)?.telefono ?? agentPersona?.telefono ?? null;
  const phone = tel ? `+${toDialCode(clavePais)} ${tel}` : "";
  const whatsapp = tel ? buildWhatsapp(clavePais, tel) : "";
  const nombre = (
    finAgente?.nombre_legal ?? finAgente?.nombre ??
    agentPersona?.nombre_legal ?? (agentUser as any)?.nombre ?? ""
  ).trim();
  const fotoUrl = finAgente?.foto_perfil_url ?? (agentUser as any)?.foto_perfil_url;

  const agentEmail = finAgente?.email ?? agentPersona?.email ?? oferta.email_creador ?? "";
  const agent: Agent = {
    id: agentId,
    fullName: nombre || "Tu asesor",
    firstName: nombre ? nombre.split(" ")[0] : "tu asesor",
    title: "",
    photoUrl: fotoUrl ? normalizeAvatarUrl(fotoUrl) : "",
    bio: finAgente?.frase_perfil ?? (agentUser as any)?.frase_perfil ?? DEFAULT_BIO,
    phone,
    email: agentEmail,
    whatsapp,
    brokerage: teamFromEmail(agentEmail),
    isAllied: false,
  } as Agent;

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
    fullName: persona.nombre_legal ?? "Tu asesor",
    firstName: firstName || "tu asesor",
    title: "",
    photoUrl: "",
    phone,
    email: persona.email ?? "",
    whatsapp,
    brokerage: teamFromEmail(persona.email),
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
