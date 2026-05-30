import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import type { LegalRequest } from "@/types/legal-flow";

/**
 * Expedientes Archivados — cuentas de cobranza cuyo bien (Propiedad)
 * está en estatus "Vendido" (id_estatus_disponibilidad = 5).
 *
 * El expediente que se muestra es el folio de la cuenta de cobranza
 * (CC-XXXXXX). Adicional al enrich estándar se incluye el agente vendedor
 * (vía `oferta.email_creador` → `usuarios.nombre`) y la fecha de compra
 * de la cuenta.
 *
 * Arquitectura: partir de `cuentas_cobranza` paginadas y filtrar Vendido
 * en JS — igual que `useCobrosPorGestionar`. Partir de `propiedades` no
 * funciona porque la BD tiene ~8k Vendido y PostgREST corta a 1000.
 */

const ESTATUS_VENDIDO = 5;

export function useLegalFlowExpedientesArchivados() {
  return useQuery<LegalRequest[]>({
    queryKey: ["legal_flow_expedientes_archivados"],
    queryFn: fetchExpedientesArchivados,
    staleTime: 60_000,
  });
}

async function fetchExpedientesArchivados(): Promise<LegalRequest[]> {
  // 1) Paginar cuentas_cobranza activas, sin padre. Universo manejable
  //    (~1.5k rows). Filtros adicionales (tipo Propiedad, Vendido) se
  //    aplican en JS después del enrich.
  const cuentasRows: Array<any> = [];
  const PAGE = 1000;
  const ccCols =
    "id, id_oferta, id_propiedad, precio_final, fecha_compra, fecha_creacion";
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = (await (supabase as any)
      .from("cuentas_cobranza")
      .select(ccCols)
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .order("id", { ascending: false })
      .range(offset, offset + PAGE - 1)) as any;
    if (error) throw error;
    const batch = (data || []) as Array<any>;
    cuentasRows.push(...batch);
    if (batch.length < PAGE) break;
    if (offset > 100_000) break; // safety
  }
  if (!cuentasRows.length) return [];

  // 2) Ofertas para resolver id_propiedad efectivo (cc.id_propiedad suele
  //    venir NULL y la propiedad real vive en oferta.id_propiedad) +
  //    id_producto y email_creador (agente vendedor) + id_persona_lead.
  const ofertaIds = Array.from(
    new Set(
      cuentasRows.map((c) => c.id_oferta).filter((v): v is number => !!v),
    ),
  );
  const ofs: Array<any> = [];
  for (let offset = 0; ofertaIds.length && offset < ofertaIds.length; offset += PAGE) {
    const slice = ofertaIds.slice(offset, offset + PAGE);
    const { data, error } = (await (supabase as any)
      .from("ofertas")
      .select("id, id_propiedad, id_producto, id_persona_lead, email_creador")
      .in("id", slice)) as any;
    if (error) throw error;
    ofs.push(...((data || []) as Array<any>));
  }
  const ofMap = new Map<number, any>(ofs.map((o: any) => [o.id, o]));

  // 3) id_propiedad efectivo por cuenta (cc.id_propiedad o oferta.id_propiedad).
  const propIdsEfectivos = Array.from(
    new Set(
      cuentasRows
        .map((c) => c.id_propiedad ?? ofMap.get(c.id_oferta)?.id_propiedad ?? null)
        .filter((v): v is number => !!v),
    ),
  );

  // 4) Propiedades correspondientes — incluye id_estatus_disponibilidad
  //    para filtrar Vendido en JS.
  const props: Array<any> = [];
  for (let offset = 0; propIdsEfectivos.length && offset < propIdsEfectivos.length; offset += PAGE) {
    const slice = propIdsEfectivos.slice(offset, offset + PAGE);
    const { data, error } = (await (supabase as any)
      .from("propiedades")
      .select(
        "id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad",
      )
      .in("id", slice)) as any;
    if (error) throw error;
    props.push(...((data || []) as Array<any>));
  }
  const propMap = new Map<number, any>(props.map((p: any) => [p.id, p]));

  // 5) edificios_modelos → id_edificio + modelo.
  const emIds = Array.from(
    new Set(
      props.map((p) => p.id_edificio_modelo).filter((v): v is number => !!v),
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

  // 6) edificios → proyecto.
  const edIds = Array.from(
    new Set(
      (ems || []).map((e: any) => e.id_edificio).filter((v: any): v is number => !!v),
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
      (eds || []).map((e: any) => e.id_proyecto).filter((v: any): v is number => !!v),
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

  // 7) Productos (para tipo Propiedad/Producto/Servicio).
  const productoIds = Array.from(
    new Set(
      ofs.map((o: any) => o.id_producto).filter((v: any): v is number => !!v),
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

  // 8) Entidad dueña → titular.
  const entIds = Array.from(
    new Set(
      props
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

  // 9) Personas (comprador / lead de la oferta).
  const personaIds = Array.from(
    new Set(
      ofs.map((o: any) => o.id_persona_lead).filter((v: any): v is number => !!v),
    ),
  );
  const { data: pers } = personaIds.length
    ? ((await (supabase as any)
        .from("personas")
        .select("id, nombre_legal")
        .in("id", personaIds)) as any)
    : { data: [] };
  const persMap = new Map<number, any>((pers || []).map((p: any) => [p.id, p]));

  // 10) Usuarios — para mapear oferta.email_creador → nombre (agente vendedor).
  const emailsCreadores = Array.from(
    new Set(
      ofs.map((o: any) => o.email_creador).filter((v: any): v is string => !!v),
    ),
  );
  const { data: usuariosCreadores } = emailsCreadores.length
    ? ((await (supabase as any)
        .from("usuarios")
        .select("email, nombre")
        .in("email", emailsCreadores)) as any)
    : { data: [] };
  const usuarioByEmail = new Map<string, any>(
    (usuariosCreadores || []).map((u: any) => [u.email, u]),
  );

  // 11) Componer + filtrar a propiedad Vendido y tipo Propiedad.
  const result: LegalRequest[] = [];
  for (const c of cuentasRows) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo: number | null = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    if (!idPropEfectivo) continue;
    const propiedad = propMap.get(idPropEfectivo);
    if (!propiedad) continue;
    if (propiedad.id_estatus_disponibilidad !== ESTATUS_VENDIDO) continue;

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
    if (tipo !== "Propiedad") continue;

    const folio = formatCuentaCobranzaId(c.id, tipo);
    const proyecto = proyectoNombre || "Sin proyecto";
    const unidad = propiedad.numero_propiedad
      ? `Unidad ${propiedad.numero_propiedad}`
      : "";
    const title = [proyecto, "Contrato firmado", unidad]
      .filter(Boolean)
      .join(" — ");

    const titular =
      entidad?.personas?.nombre_comercial ||
      entidad?.personas?.nombre_legal ||
      "";
    const counterparty = persona?.nombre_legal || "Sin comprador registrado";
    const agenteEmail: string | null = oferta?.email_creador ?? null;
    const agenteVendedor = agenteEmail
      ? usuarioByEmail.get(agenteEmail)?.nombre ?? agenteEmail
      : null;

    const createdAt: string =
      (c.fecha_compra as string) ||
      (c.fecha_creacion as string) ||
      new Date().toISOString();

    result.push({
      id: folio,
      title,
      type: "new_contract",
      company: "SOZU Desarrollos",
      project: proyecto,
      modelo: modeloNombre ?? undefined,
      property: unidad || undefined,
      requester: agenteVendedor || "—",
      requesterDept: "Comercial",
      counterparty,
      counterparties: [counterparty],
      titular: titular || undefined,
      cuentaCobranza: folio,
      agenteVendedor: agenteVendedor || undefined,
      fechaCompra: (c.fecha_compra as string) || undefined,
      estimatedValue: Number(c.precio_final ?? 0),
      priority: "medium",
      description: `Cuenta ${folio} con propiedad en estatus Vendido.`,
      dueDate: createdAt,
      status: "archived",
      createdAt,
      updatedAt: (c.fecha_compra as string) || createdAt,
    });
  }

  return result;
}
