import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import type { LegalRequest } from "@/types/legal-flow";

/**
 * Solicitudes Legales recibidas — primera etapa del Pipeline de Contratos
 * en SOZU Legal Flow.
 *
 * Universo: cuentas de cobranza cuyo bien (Propiedad) está en estatus
 * "Apartado" (id_estatus_disponibilidad = 4). Una vez la propiedad pasa
 * a "Vendido" deja de ser una solicitud y entra al ciclo posterior del
 * pipeline jurídico.
 *
 * El "expediente" en la columna *Solicitud recibida* es el ID de la
 * cuenta de cobranza con el padding estándar (CC-XXXXXX / CCP-XXXXXX).
 */

const ESTATUS_APARTADO = 4;

export function useLegalFlowSolicitudesRecibidas() {
  return useQuery<LegalRequest[]>({
    queryKey: ["legal_flow_solicitudes_recibidas"],
    queryFn: fetchSolicitudesRecibidas,
    staleTime: 60_000,
  });
}

async function fetchSolicitudesRecibidas(): Promise<LegalRequest[]> {
  // 1) Cuentas base — activas, sin cuenta padre, aprobadas, con id_oferta.
  const { data: cuentas, error: ccErr } = await (supabase as any)
    .from("cuentas_cobranza")
    .select(
      "id, id_oferta, id_propiedad, precio_final, fecha_compra, fecha_creacion",
    )
    .eq("activo", true)
    .is("id_cuenta_cobranza_padre", null)
    .order("fecha_creacion", { ascending: false })
    .limit(1000);
  if (ccErr) throw ccErr;
  const cuentasRows = (cuentas || []) as Array<any>;
  if (!cuentasRows.length) return [];

  // 2) Ofertas → id_propiedad (fallback) + id_producto + id_persona_lead.
  const ofertaIds = Array.from(
    new Set(cuentasRows.map((c) => c.id_oferta).filter((v): v is number => !!v)),
  );
  const { data: ofs } = ofertaIds.length
    ? ((await (supabase as any)
        .from("ofertas")
        .select("id, id_propiedad, id_producto, id_persona_lead")
        .in("id", ofertaIds)) as any)
    : { data: [] };
  const ofMap = new Map<number, any>((ofs || []).map((o: any) => [o.id, o]));

  // 3) Resolver id_propiedad efectivo por cuenta y filtrar a Apartado.
  const propIds = Array.from(
    new Set(
      cuentasRows
        .map((c) => c.id_propiedad ?? ofMap.get(c.id_oferta)?.id_propiedad ?? null)
        .filter((v): v is number => !!v),
    ),
  );
  const { data: props } = propIds.length
    ? ((await (supabase as any)
        .from("propiedades")
        .select(
          "id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad",
        )
        .in("id", propIds)
        .eq("id_estatus_disponibilidad", ESTATUS_APARTADO)) as any)
    : { data: [] };
  const apartadosByProp = new Map<number, any>(
    ((props || []) as Array<any>).map((p) => [p.id, p]),
  );
  if (apartadosByProp.size === 0) return [];

  // 4) edificios_modelos → id_edificio + modelo.
  const emIds = Array.from(
    new Set(
      ((props || []) as Array<any>)
        .map((p) => p.id_edificio_modelo)
        .filter((v): v is number => !!v),
    ),
  );
  const { data: ems } = emIds.length
    ? ((await (supabase as any)
        .from("edificios_modelos")
        .select(
          "id, id_edificio, modelos!edificios_modelos_id_modelo_fkey(nombre)",
        )
        .in("id", emIds)) as any)
    : { data: [] };
  const emMap = new Map<number, any>((ems || []).map((em: any) => [em.id, em]));

  // 5) edificios → proyecto.
  const edIds = Array.from(
    new Set(
      (ems || [])
        .map((e: any) => e.id_edificio)
        .filter((v: any): v is number => !!v),
    ),
  );
  const { data: eds } = edIds.length
    ? ((await (supabase as any)
        .from("edificios")
        .select("id, nombre, id_proyecto")
        .in("id", edIds)) as any)
    : { data: [] };
  const edMap = new Map<number, any>((eds || []).map((e: any) => [e.id, e]));

  const projIds = Array.from(
    new Set(
      (eds || [])
        .map((e: any) => e.id_proyecto)
        .filter((v: any): v is number => !!v),
    ),
  );
  const { data: projs } = projIds.length
    ? ((await (supabase as any)
        .from("proyectos")
        .select("id, nombre")
        .in("id", projIds)) as any)
    : { data: [] };
  const projMap = new Map<number, string>(
    (projs || []).map((p: any) => [p.id, p.nombre as string]),
  );

  // 6) Productos (para tipo Producto/Servicio).
  const productoIds = Array.from(
    new Set(
      (ofs || [])
        .map((o: any) => o.id_producto)
        .filter((v: any): v is number => !!v),
    ),
  );
  const { data: prods } = productoIds.length
    ? ((await (supabase as any)
        .from("productos_servicios")
        .select(
          "id, nombre, id_categoria, categorias_producto!productos_servicios_id_categoria_fkey(nombre)",
        )
        .in("id", productoIds)) as any)
    : { data: [] };
  const prodMap = new Map<number, any>((prods || []).map((p: any) => [p.id, p]));

  // 7) Entidad dueña → titular (persona.nombre_comercial || nombre_legal).
  const entIds = Array.from(
    new Set(
      ((props || []) as Array<any>)
        .map((p) => p.id_entidad_relacionada_dueno)
        .filter((v: any): v is number => !!v),
    ),
  );
  const { data: ents } = entIds.length
    ? ((await (supabase as any)
        .from("entidades_relacionadas")
        .select(
          "id, personas!fk_entrel_persona(nombre_legal, nombre_comercial)",
        )
        .in("id", entIds)) as any)
    : { data: [] };
  const entMap = new Map<number, any>((ents || []).map((e: any) => [e.id, e]));

  // 8) Personas (comprador / lead de la oferta).
  const personaIds = Array.from(
    new Set(
      (ofs || [])
        .map((o: any) => o.id_persona_lead)
        .filter((v: any): v is number => !!v),
    ),
  );
  const { data: pers } = personaIds.length
    ? ((await (supabase as any)
        .from("personas")
        .select("id, nombre_legal")
        .in("id", personaIds)) as any)
    : { data: [] };
  const persMap = new Map<number, any>((pers || []).map((p: any) => [p.id, p]));

  // 9) Construir LegalRequest por cuenta apartada.
  const result: LegalRequest[] = [];
  for (const c of cuentasRows) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo: number | null = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    if (!idPropEfectivo) continue;
    const propiedad = apartadosByProp.get(idPropEfectivo);
    if (!propiedad) continue;

    const em = propiedad.id_edificio_modelo
      ? emMap.get(propiedad.id_edificio_modelo)
      : null;
    const edificio = em?.id_edificio ? edMap.get(em.id_edificio) : null;
    const proyectoNombre = edificio?.id_proyecto
      ? projMap.get(edificio.id_proyecto)
      : null;
    const modeloNombre: string | null = em?.modelos?.nombre ?? null;
    const producto = oferta?.id_producto ? prodMap.get(oferta.id_producto) : null;
    const entidad = propiedad.id_entidad_relacionada_dueno
      ? entMap.get(propiedad.id_entidad_relacionada_dueno)
      : null;
    const persona = oferta?.id_persona_lead ? persMap.get(oferta.id_persona_lead) : null;

    let tipo: "Propiedad" | "Producto" | "Servicio" = "Propiedad";
    if (oferta?.id_producto && producto) {
      const cat = (producto.categorias_producto?.nombre || "").toLowerCase();
      tipo = cat === "servicios" ? "Servicio" : "Producto";
    }

    const folio = formatCuentaCobranzaId(c.id, tipo);
    const proyecto = proyectoNombre || "Sin proyecto";
    const unidad = tipo === "Propiedad"
      ? (propiedad.numero_propiedad ? `Unidad ${propiedad.numero_propiedad}` : "")
      : (producto?.nombre ?? "");
    const title = [proyecto, "Solicitud de contrato", unidad]
      .filter(Boolean)
      .join(" — ");

    const titular =
      entidad?.personas?.nombre_comercial ||
      entidad?.personas?.nombre_legal ||
      "";
    const counterparty = persona?.nombre_legal || "Sin comprador registrado";

    const createdAt: string =
      (c.fecha_creacion as string) ||
      (c.fecha_compra as string) ||
      new Date().toISOString();
    // Sin SLA definido para esta etapa: usamos +7 días desde creación como
    // due date orientativo para que la UI muestre antigüedad/vencido.
    const dueDate = new Date(
      new Date(createdAt).getTime() + 7 * 86_400_000,
    ).toISOString();

    result.push({
      id: folio,
      title,
      type: "new_contract",
      company: "SOZU Desarrollos",
      project: proyecto,
      property: unidad || undefined,
      requester: "—",
      requesterDept: "Comercial",
      counterparty,
      counterparties: [counterparty],
      titular: titular || undefined,
      cuentaCobranza: folio,
      estimatedValue: Number(c.precio_final ?? 0),
      priority: "medium",
      description: `Solicitud automática generada por apartado de ${unidad || "bien"} (${folio}). Pendiente de iniciar revisión legal.`,
      dueDate,
      status: "request_received",
      createdAt,
      updatedAt: createdAt,
    });
  }

  return result;
}
