import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";
import type { InvestmentProperty, StageInfo, PaymentRecord, TransactionStage, AdditionalProduct } from "./types";

const IMAGE_GRADIENTS = [
  "from-primary/20 via-primary/10 to-accent",
  "from-success/20 via-success/10 to-accent",
  "from-warning/20 via-warning/10 to-accent",
  "from-purple-500/20 via-purple-500/10 to-accent",
];

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_LONG = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function fmtMonthYear(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDeliveryDate(dateStr: string | null | undefined, estatusId: number): string {
  if (estatusId === 8) return "Entregada";
  if (!dateStr) return "Por confirmar";
  const d = new Date(dateStr);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtCurrency(amount: number, currency = "MXN"): string {
  return `$${amount.toLocaleString("es-MX")} ${currency}`;
}

function getActiveDescription(stageId: TransactionStage): string {
  switch (stageId) {
    case "preventa": return "Plan de pagos activo";
    case "pago_final": return "Liquidación pendiente";
    case "escrituracion": return "En proceso de escrituración";
    case "entrega": return "Lista para entrega";
    case "post_entrega": return "Propiedad entregada";
  }
}

function buildStages(estatusId: number, pendingBalance: number, deliveryDate: string): StageInfo[] {
  const ALL: { id: TransactionStage; label: string }[] = [
    { id: "preventa", label: "Preventa" },
    { id: "pago_final", label: "Pago Final" },
    { id: "escrituracion", label: "Escrituración" },
    { id: "entrega", label: "Entrega" },
    { id: "post_entrega", label: "Post-Entrega" },
  ];

  // Map estatus_disponibilidad id to the currently active stage index
  let activeIdx: number;
  switch (estatusId) {
    case 4: activeIdx = 0; break;  // Apartado → preventa
    case 5: activeIdx = pendingBalance > 0 ? 1 : 2; break;  // Vendido
    case 7: activeIdx = 2; break;  // Escrituración
    case 9: activeIdx = 3; break;  // Pagada completamente → entrega
    case 8: activeIdx = 4; break;  // Entregado → post_entrega
    default: activeIdx = 0;
  }

  return ALL.map((s, i): StageInfo => {
    if (i < activeIdx) {
      return { id: s.id, label: s.label, description: "Completado", status: "completed" };
    }
    if (i === activeIdx) {
      const contextMessages: Partial<Record<TransactionStage, string>> = {
        preventa: "Plan de pagos activo",
        pago_final: `Saldo pendiente: ${fmtCurrency(pendingBalance)}`,
        escrituracion: "En proceso de escrituración",
        entrega: deliveryDate !== "Por confirmar" ? `Lista para entrega · ${deliveryDate}` : "Agenda tu cita de entrega",
        post_entrega: "Propiedad entregada y escriturada",
      };
      const base: StageInfo = {
        id: s.id,
        label: s.label,
        description: getActiveDescription(s.id),
        status: "active",
        contextMessage: contextMessages[s.id],
      };
      if (s.id === "pago_final" && pendingBalance > 0) {
        return {
          ...base,
          cta: { label: "Pagar ahora", action: "balance" },
          details: { "Saldo pendiente": fmtCurrency(pendingBalance) },
        };
      }
      return base;
    }
    return { id: s.id, label: s.label, description: "Pendiente", status: "pending" };
  });
}

type PagoInfo = {
  pagoId?: number;
  trackingKey?: string;
  paymentMethodId?: number;
  fechaPago?: string;
  cepUrl?: string;
  evidenceUrl?: string;
};

async function fetchPortfolio(personaId: number): Promise<InvestmentProperty[]> {
  // 1. Get active MAIN-PROPERTY offers for this persona (exclude addon products)
  const { data: offers } = await supabase
    .from("ofertas")
    .select("id, id_propiedad")
    .eq("id_persona_lead", personaId)
    .eq("activo", true)
    .is("id_producto", null);

  if (!offers?.length) return [];

  const offerIds = offers.map((o) => o.id as number);

  // 2. Get approved billing accounts (includes clabe_stp for receipt modal)
  const { data: cuentas } = await supabase
    .from("cuentas_cobranza")
    .select("id, id_oferta, id_propiedad, precio_final, moneda, fecha_compra, fecha_escritura, clabe_stp")
    .in("id_oferta", offerIds)
    .eq("activo", true)
    .eq("es_aprobado", true);

  if (!cuentas?.length) return [];

  const cuentaIds = cuentas.map((c) => c.id as number);
  const propiedadIds = [...new Set(cuentas.map((c) => c.id_propiedad as number).filter(Boolean))];

  // 2.5 Fetch product offers (id_producto IS NOT NULL) and build additionalProducts per propiedad
  const productsByPropId: Record<number, AdditionalProduct[]> = {};
  {
    const { data: productOffers } = await supabase
      .from("ofertas")
      .select("id, id_propiedad, id_producto")
      .eq("id_persona_lead", personaId)
      .eq("activo", true)
      .not("id_producto", "is", null);

    if (productOffers?.length) {
      const productOfferIds = productOffers.map((o) => o.id as number);
      const productoIds = [...new Set(productOffers.map((o) => o.id_producto as number).filter(Boolean))];

      const [productCuentasRes, productosRes] = await Promise.all([
        supabase
          .from("cuentas_cobranza")
          .select("id, id_oferta, precio_final")
          .in("id_oferta", productOfferIds)
          .eq("activo", true)
          .eq("es_aprobado", true),
        productoIds.length
          ? supabase.from("productos_servicios").select("id, nombre, descripcion").in("id", productoIds)
          : Promise.resolve({ data: [] as { id: number; nombre: string; descripcion: string | null }[] }),
      ]);

      const productCuentas = productCuentasRes.data ?? [];
      const productosMap: Record<number, { nombre: string; descripcion: string | null }> =
        Object.fromEntries(
          (productosRes.data ?? []).map((p) => [
            p.id as number,
            { nombre: String(p.nombre), descripcion: p.descripcion ? String(p.descripcion) : null },
          ]),
        );

      const productCuentaIds = productCuentas.map((c) => c.id as number);
      if (productCuentaIds.length) {
        const { data: productPagos } = await supabase
          .from("pagos")
          .select("id_cuenta_cobranza, monto")
          .in("id_cuenta_cobranza", productCuentaIds)
          .eq("activo", true);

        const pagosByCuenta: Record<number, number> = {};
        for (const p of productPagos ?? []) {
          const cId = p.id_cuenta_cobranza as number;
          pagosByCuenta[cId] = (pagosByCuenta[cId] ?? 0) + Number(p.monto);
        }

        const ofertaMap: Record<number, { propiedadId: number; productoId: number }> =
          Object.fromEntries(
            productOffers.map((o) => [
              o.id as number,
              { propiedadId: o.id_propiedad as number, productoId: o.id_producto as number },
            ]),
          );

        for (const cc of productCuentas) {
          const oferta = ofertaMap[cc.id_oferta as number];
          if (!oferta) continue;

          const totalPaid = pagosByCuenta[cc.id as number] ?? 0;
          const totalPrice = Number(cc.precio_final);
          const pendingBalance = Math.max(0, totalPrice - totalPaid);

          let status: AdditionalProduct["status"];
          if (totalPaid === 0) status = "pendiente";
          else if (pendingBalance > 0) status = "financiado";
          else status = "pagado";

          const ps = productosMap[oferta.productoId];
          const prod: AdditionalProduct = {
            id: String(cc.id),
            name: ps?.nombre ?? "Producto",
            description: ps?.descripcion ?? undefined,
            totalPrice,
            totalPaid,
            pendingBalance,
            status,
            documents: [],
          };

          const propId = oferta.propiedadId;
          if (!productsByPropId[propId]) productsByPropId[propId] = [];
          productsByPropId[propId].push(prod);
        }
      }
    }
  }

  // 3. Parallel: properties + payments + payment schedule + persona
  const [propiedadesRes, pagosRes, acuerdosRes, personaRes] = await Promise.all([
    supabase
      .from("propiedades")
      .select("id, numero_propiedad, numero_piso, m2_interiores, id_estatus_disponibilidad, id_edificio_modelo, id_tipo_propiedad, url_imagen_portada")
      .in("id", propiedadIds),
    supabase
      .from("pagos")
      .select("id, id_cuenta_cobranza, monto, fecha_pago, descripcion, url_recibo, url_cep, clave_rastreo, id_metodos_pago")
      .in("id_cuenta_cobranza", cuentaIds)
      .eq("activo", true)
      .order("fecha_pago", { ascending: true }),
    supabase
      .from("acuerdos_pago")
      .select("id, id_cuenta_cobranza, id_concepto, fecha_pago, monto, pago_completado, orden")
      .in("id_cuenta_cobranza", cuentaIds)
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase.from("personas").select("nombre_legal, rfc").eq("id", personaId).single(),
  ]);

  const propiedades = propiedadesRes.data ?? [];
  const pagos = pagosRes.data ?? [];
  const acuerdos = acuerdosRes.data ?? [];
  const persona = personaRes.data;

  // 3.5 Link acuerdos_pago → pagos to get tracking info
  const acuerdoIds = acuerdos.map((a) => a.id as number);
  const { data: aplicaciones } = acuerdoIds.length
    ? await supabase
        .from("aplicaciones_pago")
        .select("id_acuerdo_pago, id_pago")
        .in("id_acuerdo_pago", acuerdoIds)
        .eq("activo", true)
    : { data: [] as { id_acuerdo_pago: number; id_pago: number }[] };

  const pagoById: Record<number, Record<string, unknown>> = Object.fromEntries(
    pagos.map((p) => [p.id as number, p]),
  );
  const pagoInfoPorAcuerdo: Record<number, PagoInfo> = {};
  for (const ap of (aplicaciones ?? [])) {
    const pago = pagoById[ap.id_pago as number];
    if (pago) {
      pagoInfoPorAcuerdo[ap.id_acuerdo_pago as number] = {
        pagoId: Number(pago.id),
        trackingKey: pago.clave_rastreo ? String(pago.clave_rastreo) : undefined,
        paymentMethodId: pago.id_metodos_pago ? Number(pago.id_metodos_pago) : undefined,
        fechaPago: pago.fecha_pago ? String(pago.fecha_pago).slice(0, 10) : undefined,
        cepUrl: pago.url_cep ? String(pago.url_cep) : undefined,
        evidenceUrl: pago.url_recibo ? String(pago.url_recibo) : undefined,
      };
    }
  }

  // Fetch metodos_pago names
  const metodosIds = [...new Set(pagos.map((p) => p.id_metodos_pago as number).filter(Boolean))];
  const { data: metodosData } = metodosIds.length
    ? await supabase.from("metodos_pago").select("id, nombre").in("id", metodosIds)
    : { data: [] };
  const metodosMap: Record<number, string> = Object.fromEntries(
    (metodosData ?? []).map((m) => [m.id as number, String(m.nombre)]),
  );

  // 4. Get edificios_modelos for project chain
  const edificioModeloIds = [...new Set(propiedades.map((p) => p.id_edificio_modelo as number).filter(Boolean))];
  if (!edificioModeloIds.length) return buildFromData(cuentas, propiedades, [], [], [], [], [], pagos, acuerdos, pagoInfoPorAcuerdo, metodosMap, persona, productsByPropId);

  const { data: edificiosModelos } = await supabase
    .from("edificios_modelos")
    .select("id, id_edificio, id_modelo")
    .in("id", edificioModeloIds);

  const edificioIds = [...new Set((edificiosModelos ?? []).map((em) => em.id_edificio as number).filter(Boolean))];
  const modeloIds = [...new Set((edificiosModelos ?? []).map((em) => em.id_modelo as number).filter(Boolean))];
  const tipoIds = [...new Set(propiedades.map((p) => p.id_tipo_propiedad as number).filter(Boolean))];

  // 5. Parallel: edificios + modelos + tipos_propiedad
  const [edificiosRes, modelosRes, tiposRes] = await Promise.all([
    edificioIds.length
      ? supabase.from("edificios").select("id, id_proyecto, nombre").in("id", edificioIds)
      : Promise.resolve({ data: [] }),
    modeloIds.length
      ? supabase.from("modelos").select("id, numero_recamaras, numero_completo_banos, numero_medio_bano").in("id", modeloIds)
      : Promise.resolve({ data: [] }),
    tipoIds.length
      ? supabase.from("tipos_propiedad").select("id, nombre").in("id", tipoIds)
      : Promise.resolve({ data: [] }),
  ]);

  const edificios = edificiosRes.data ?? [];
  const proyectoIds = [...new Set(edificios.map((e) => e.id_proyecto as number).filter(Boolean))];

  const { data: proyectos } = proyectoIds.length
    ? await supabase
        .from("proyectos")
        .select("id, nombre, direccion, precio_m2_actual, fecha_entrega_proyecto, costo_mantenimiento_m2, url_imagen_portada")
        .in("id", proyectoIds)
    : { data: [] };

  return buildFromData(
    cuentas,
    propiedades,
    edificiosModelos ?? [],
    edificios,
    modelosRes.data ?? [],
    tiposRes.data ?? [],
    proyectos ?? [],
    pagos,
    acuerdos,
    pagoInfoPorAcuerdo,
    metodosMap,
    persona,
    productsByPropId,
  );
}

const CONCEPTO_NAMES: Record<number, string> = {
  1: "Apartado",
  2: "Enganche",
  3: "Pago a contra entrega",
  4: "Mensualidad",
  5: "Parcialidad",
};

function buildFromData(
  cuentas: Record<string, unknown>[],
  propiedades: Record<string, unknown>[],
  edificiosModelos: Record<string, unknown>[],
  edificios: Record<string, unknown>[],
  modelos: Record<string, unknown>[],
  tipos: Record<string, unknown>[],
  proyectos: Record<string, unknown>[],
  pagos: Record<string, unknown>[],
  acuerdos: Record<string, unknown>[],
  pagoInfoPorAcuerdo: Record<number, PagoInfo> = {},
  metodosMap: Record<number, string> = {},
  persona: { nombre_legal: string | null; rfc: string | null } | null = null,
  productsByPropId: Record<number, AdditionalProduct[]> = {},
): InvestmentProperty[] {
  const propMap = Object.fromEntries(propiedades.map((p) => [p.id as number, p]));
  const emMap = Object.fromEntries(edificiosModelos.map((em) => [em.id as number, em]));
  const edificioMap = Object.fromEntries(edificios.map((e) => [e.id as number, e]));
  const modeloMap = Object.fromEntries(modelos.map((m) => [m.id as number, m]));
  const tipoMap = Object.fromEntries(tipos.map((t) => [t.id as number, t]));
  const proyectoMap = Object.fromEntries(proyectos.map((p) => [p.id as number, p]));

  return cuentas.map((cc, idx): InvestmentProperty => {
    const prop = propMap[cc.id_propiedad as number] ?? null;
    const em = prop ? emMap[prop.id_edificio_modelo as number] : null;
    const edificio = em ? edificioMap[em.id_edificio as number] : null;
    const proyecto = edificio ? proyectoMap[edificio.id_proyecto as number] : null;
    const modelo = em ? modeloMap[em.id_modelo as number] : null;
    const tipo = prop ? tipoMap[prop.id_tipo_propiedad as number] : null;

    const cuentaPagos = pagos.filter((p) => p.id_cuenta_cobranza === cc.id);
    const totalPaid = cuentaPagos.reduce((sum, p) => sum + Number(p.monto), 0);
    const pendingBalance = Math.max(0, Number(cc.precio_final) - totalPaid);

    const m2 = Number(prop?.m2_interiores ?? 0);
    const pricePerM2Initial = m2 > 0 ? Number(cc.precio_final) / m2 : 0;
    const pricePerM2Current = Number(proyecto?.precio_m2_actual ?? 0);
    const currentEstimatedValue = m2 > 0 && pricePerM2Current > 0 ? m2 * pricePerM2Current : Number(cc.precio_final);
    const estimatedAppreciation =
      pricePerM2Initial > 0 && pricePerM2Current > 0
        ? Math.round(((pricePerM2Current - pricePerM2Initial) / pricePerM2Initial) * 1000) / 10
        : 0;

    const estatusId = Number(prop?.id_estatus_disponibilidad ?? 4);
    const maintenanceFee = proyecto && m2 > 0
      ? Math.round(Number(proyecto.costo_mantenimiento_m2) * m2)
      : 0;

    const deliveryDate = fmtDeliveryDate(proyecto?.fecha_entrega_proyecto as string | null, estatusId);

    // Build payment schedule from acuerdos_pago (includes pending items)
    const cuentaAcuerdos = acuerdos
      .filter(a => a.id_cuenta_cobranza === cc.id)
      .sort((a, b) => Number(a.orden) - Number(b.orden));

    let parcialidadCount = 0;
    const paymentRecords: PaymentRecord[] = cuentaAcuerdos.map(a => {
      const idConcepto = Number(a.id_concepto);
      let concept = CONCEPTO_NAMES[idConcepto] ?? "Pago";
      if (idConcepto === 5) { parcialidadCount++; concept = `Parcialidad ${parcialidadCount}`; }
      const info = pagoInfoPorAcuerdo[a.id as number];
      return {
        date: String(a.fecha_pago).slice(0, 10),
        concept,
        amount: Number(a.monto),
        status: (a.pago_completado ? "pagado" : "pendiente") as "pagado" | "pendiente",
        pagoId: info?.pagoId,
        cepUrl: info?.cepUrl,
        evidenceUrl: info?.evidenceUrl,
        trackingKey: info?.trackingKey,
        paymentMethodName: info?.paymentMethodId ? metodosMap[info.paymentMethodId] : undefined,
      };
    });

    return {
      property: {
        id: String(cc.id),
        projectName: String(proyecto?.nombre ?? "—"),
        unitNumber: String(prop?.numero_propiedad ?? "—"),
        location: String(proyecto?.direccion ?? ""),
        type: String(tipo?.nombre ?? "Propiedad"),
        area: m2 > 0 ? `${m2.toFixed(1)} m²` : "—",
        floor: String(prop?.numero_piso ?? "—"),
        bedrooms: Number(modelo?.numero_recamaras ?? 0),
        bathrooms:
          Number(modelo?.numero_completo_banos ?? 0) +
          Number(modelo?.numero_medio_bano ?? 0),
        deliveryDate,
        imageGradient: IMAGE_GRADIENTS[idx % IMAGE_GRADIENTS.length],
        image: proyecto?.url_imagen_portada ? String(proyecto.url_imagen_portada) : undefined,
        fechaEscritura: cc.fecha_escritura ? String(cc.fecha_escritura) : undefined,
        projectId: edificio?.id_proyecto as number | undefined,
        clientName: persona?.nombre_legal ?? undefined,
        clientRFC: persona?.rfc ?? undefined,
      },
      financials: {
        initialPrice: Number(cc.precio_final),
        totalPaid,
        pendingBalance,
        estimatedAppreciation,
        currentEstimatedValue,
        pricePerM2Initial,
        pricePerM2Current,
        currency: String(cc.moneda ?? "MXN"),
        clabe: cc.clabe_stp ? String(cc.clabe_stp) : undefined,
      },
      stages: buildStages(estatusId, pendingBalance, deliveryDate),
      payments: paymentRecords,
      maintenance:
        maintenanceFee > 0
          ? {
              monthlyFee: maintenanceFee,
              nextDueDate: "—",
              status: "pendiente",
              history: [],
            }
          : undefined,
      additionalProducts: productsByPropId[cc.id_propiedad as number] ?? [],
    };
  });
}

export function usePortfolioCliente() {
  const { profile } = useAuth();
  const { isImpersonating, impersonatedClientePersonaId } = useClienteImpersonation();

  const personaId: number | null = isImpersonating
    ? impersonatedClientePersonaId
    : profile?.rol_nombre === "Cliente"
    ? (profile?.id_persona ?? null)
    : null;

  return useQuery({
    queryKey: ["portfolio-cliente", personaId],
    queryFn: () => fetchPortfolio(personaId!),
    enabled: personaId != null,
    staleTime: 5 * 60 * 1000,
  });
}
