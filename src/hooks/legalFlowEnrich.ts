import { supabase } from "@/integrations/supabase/client";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import type {
  LegalRequest,
  CaseStatus,
  CompradorDetalle,
  TipoPersona,
} from "@/types/legal-flow";

/**
 * Helper compartido entre `useLegalFlowSolicitudesRecibidas` y
 * `useLegalFlowExpedientesArchivados`. Recibe el conjunto de cuentas
 * candidatas (ya filtradas por status de propiedad en JS) y devuelve
 * `LegalRequest[]` con el enrich completo:
 *
 *  - Proyecto / edificio / modelo / propiedad
 *  - Producto / categoría (gate `tipo === 'Propiedad'`)
 *  - Entidad dueña (titular)
 *  - Compradores (`compradores` table + `personas`), incluye tipo,
 *    RFC, email y teléfono para el modal de detalle.
 *  - Agente vendedor (`oferta.email_creador` → `usuarios.nombre`),
 *    incluye teléfono y email para el popover de Solicitante.
 *  - Inmobiliaria del agente (vía `entidades_relacionadas` tipo=19
 *    → `id_persona_duena_lead` → `personas.nombre_legal`). Si no hay
 *    inmobiliaria, el caller mostrará "Agente Independiente".
 *  - Fecha de compra y fecha límite = compra + 15 días naturales.
 *
 * Las propiedades se reciben preresueltas (`propsForCuentas`) para que
 * el caller pueda hacer su gate de status (Apartado / Vendido) en JS
 * y sólo pase las que correspondan.
 */

const TIPO_ENTIDAD_AGENTE = 19;

// Dominios que identifican a empleados/agentes internos del grupo SOZU.
// Mantener alineado con DOMINIOS_INTERNOS_GRUPO en otros lugares del repo.
const DOMINIOS_INTERNOS_SOZU = ["sozu.com", "investimento.mx", "tallwood.mx", "daiku.mx"];
function isDominioInternoSozu(email: string | null | undefined): boolean {
  if (!email) return false;
  const dominio = email.split("@")[1]?.toLowerCase();
  return DOMINIOS_INTERNOS_SOZU.some((d) => dominio === d);
}

interface EnrichInput {
  cuentas: Array<any>;
  ofertas: Array<any>;
  propiedades: Array<any>;
  status: CaseStatus;
  /** Texto del título para la tarjeta (p.ej. "Solicitud de contrato" / "Contrato firmado"). */
  titlePhrase: string;
}

export async function enrichLegalFlowCases({
  cuentas,
  ofertas,
  propiedades,
  status,
  titlePhrase,
}: EnrichInput): Promise<LegalRequest[]> {
  if (!cuentas.length || !propiedades.length) return [];

  const ofMap = new Map<number, any>(ofertas.map((o: any) => [o.id, o]));
  const propMap = new Map<number, any>(propiedades.map((p: any) => [p.id, p]));

  // edificios_modelos → modelo + id_edificio
  const emIds = Array.from(
    new Set(
      propiedades
        .map((p) => p.id_edificio_modelo)
        .filter((v: any): v is number => !!v),
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

  // edificios → proyecto
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

  // Productos (para tipo Propiedad/Producto/Servicio)
  const productoIds = Array.from(
    new Set(
      ofertas.map((o: any) => o.id_producto).filter((v: any): v is number => !!v),
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

  // Entidad dueña → titular
  const entIds = Array.from(
    new Set(
      propiedades
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

  // Compradores por cuenta (multi-buyer support).
  const cuentaIds = cuentas.map((c) => c.id as number);
  const { data: compradoresRows } = cuentaIds.length
    ? ((await (supabase as any)
        .from("compradores")
        .select("id_cuenta_cobranza, id_persona, porcentaje_copropiedad")
        .in("id_cuenta_cobranza", cuentaIds)
        .eq("activo", true)) as any)
    : { data: [] };
  const compradoresByCuenta = new Map<number, Array<any>>();
  (compradoresRows || []).forEach((c: any) => {
    const arr = compradoresByCuenta.get(c.id_cuenta_cobranza) ?? [];
    arr.push(c);
    compradoresByCuenta.set(c.id_cuenta_cobranza, arr);
  });

  // Personas: lead + compradores adicionales
  const personaIdsLead = ofertas
    .map((o: any) => o.id_persona_lead)
    .filter((v: any): v is number => !!v);
  const personaIdsCompradores = (compradoresRows || []).map(
    (c: any) => c.id_persona,
  );
  const personaIds = Array.from(
    new Set([...personaIdsLead, ...personaIdsCompradores]),
  );
  const { data: pers } = personaIds.length
    ? ((await (supabase as any)
        .from("personas")
        .select("id, nombre_legal, nombre_comercial, tipo_persona, rfc, email, telefono")
        .in("id", personaIds)) as any)
    : { data: [] };
  const persMap = new Map<number, any>((pers || []).map((p: any) => [p.id, p]));

  // Agente vendedor: oferta.email_creador → usuarios (nombre, telefono, rol, id_persona)
  const emailsCreadores = Array.from(
    new Set(
      ofertas
        .map((o: any) => o.email_creador)
        .filter((v: any): v is string => !!v),
    ),
  );
  const { data: usuariosCreadores } = emailsCreadores.length
    ? ((await (supabase as any)
        .from("usuarios")
        .select("email, nombre, telefono, rol_id, id_persona")
        .in("email", emailsCreadores)) as any)
    : { data: [] };
  const usuarioByEmail = new Map<string, any>(
    (usuariosCreadores || []).map((u: any) => [u.email, u]),
  );

  // Roles del agente (para identificar Agente Inmobiliario vs otros)
  const rolIds = Array.from(
    new Set(
      (usuariosCreadores || [])
        .map((u: any) => u.rol_id)
        .filter((v: any): v is number => !!v),
    ),
  );
  const { data: roles } = rolIds.length
    ? ((await (supabase as any)
        .from("roles")
        .select("id, nombre")
        .in("id", rolIds)) as any)
    : { data: [] };
  const rolMap = new Map<number, string>(
    (roles || []).map((r: any) => [r.id, r.nombre as string]),
  );

  // Inmobiliaria por agente: entidades_relacionadas tipo=19 → id_persona_duena_lead
  const agentePersonaIds = Array.from(
    new Set(
      (usuariosCreadores || [])
        .map((u: any) => u.id_persona)
        .filter((v: any): v is number => !!v),
    ),
  );
  const { data: entAgentes } = agentePersonaIds.length
    ? ((await (supabase as any)
        .from("entidades_relacionadas")
        .select("id_persona, id_persona_duena_lead")
        .in("id_persona", agentePersonaIds)
        .eq("id_tipo_entidad", TIPO_ENTIDAD_AGENTE)
        .eq("activo", true)) as any)
    : { data: [] };
  const inmobiliariaPersonaIdByAgente = new Map<number, number>(
    (entAgentes || [])
      .filter((e: any) => e.id_persona && e.id_persona_duena_lead)
      .map((e: any) => [e.id_persona, e.id_persona_duena_lead]),
  );
  const inmobiliariaPersonaIds = Array.from(
    new Set(inmobiliariaPersonaIdByAgente.values()),
  );
  const { data: inmobiliariasPersonas } = inmobiliariaPersonaIds.length
    ? ((await (supabase as any)
        .from("personas")
        .select("id, nombre_legal, nombre_comercial")
        .in("id", inmobiliariaPersonaIds)) as any)
    : { data: [] };
  const inmobiliariaNameById = new Map<number, string>(
    (inmobiliariasPersonas || []).map((p: any) => [
      p.id,
      (p.nombre_comercial || p.nombre_legal) as string,
    ]),
  );

  // Componer LegalRequests
  const result: LegalRequest[] = [];
  for (const c of cuentas) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo: number | null =
      c.id_propiedad ?? oferta?.id_propiedad ?? null;
    if (!idPropEfectivo) continue;
    const propiedad = propMap.get(idPropEfectivo);
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
    const title = [proyecto, titlePhrase, unidad].filter(Boolean).join(" — ");

    const titular =
      entidad?.personas?.nombre_comercial ||
      entidad?.personas?.nombre_legal ||
      "";

    // Compradores: empezar con la tabla `compradores`; si no hay rows,
    // caer al lead de la oferta (single buyer).
    const compradoresRowsCuenta = compradoresByCuenta.get(c.id) ?? [];
    let compradoresDetalle: CompradorDetalle[] = [];
    if (compradoresRowsCuenta.length > 0) {
      compradoresDetalle = compradoresRowsCuenta
        .map((cr: any) => {
          const p = persMap.get(cr.id_persona);
          if (!p) return null;
          return {
            idPersona: p.id as number,
            name: p.nombre_legal || p.nombre_comercial || "Sin nombre",
            tipoPersona: (p.tipo_persona as TipoPersona) ?? "pf",
            rfc: p.rfc ?? null,
            phone: p.telefono ?? null,
            email: p.email ?? null,
            porcentajeCopropiedad: Number(cr.porcentaje_copropiedad ?? 0),
          } as CompradorDetalle;
        })
        .filter((x: CompradorDetalle | null): x is CompradorDetalle => !!x);
    }
    if (compradoresDetalle.length === 0 && oferta?.id_persona_lead) {
      const p = persMap.get(oferta.id_persona_lead);
      if (p) {
        compradoresDetalle = [{
          idPersona: p.id as number,
          name: p.nombre_legal || p.nombre_comercial || "Sin nombre",
          tipoPersona: (p.tipo_persona as TipoPersona) ?? "pf",
          rfc: p.rfc ?? null,
          phone: p.telefono ?? null,
          email: p.email ?? null,
        }];
      }
    }
    const counterparties = compradoresDetalle.map((cd) => cd.name);
    const counterparty = counterparties[0] ?? "Sin comprador registrado";

    // Agente vendedor: nombre + datos de contacto + inmobiliaria
    const agenteEmail: string | null = oferta?.email_creador ?? null;
    const agenteUsuario = agenteEmail ? usuarioByEmail.get(agenteEmail) : null;
    const agenteNombre: string | null =
      agenteUsuario?.nombre ?? agenteEmail ?? null;
    const agentePhone: string | null = agenteUsuario?.telefono ?? null;
    const agenteEmailNorm: string | null = agenteEmail;
    const rolNombre: string = agenteUsuario?.rol_id
      ? rolMap.get(agenteUsuario.rol_id) ?? ""
      : "";
    // Empresa del agente:
    //  1. Si el email del creador pertenece al grupo SOZU (@sozu.com /
    //     dominios internos), la empresa es "Sozu" — caso de agentes
    //     internos (vendedores SOZU directos).
    //  2. Si el agente tiene rol Agente Inmobiliario y existe una
    //     inmobiliaria afiliada vía entidades_relacionadas, esa es su
    //     empresa.
    //  3. Cualquier otro caso queda undefined ⇒ "Agente Independiente"
    //     en la UI.
    let empresaName: string | undefined = undefined;
    const dominioInterno = isDominioInternoSozu(agenteEmail);
    if (dominioInterno) {
      empresaName = "Sozu";
    } else {
      const esAgenteInmobiliario =
        rolNombre.toLowerCase().includes("agente") &&
        rolNombre.toLowerCase().includes("inmobiliario");
      if (esAgenteInmobiliario && agenteUsuario?.id_persona) {
        const inmobPersonaId = inmobiliariaPersonaIdByAgente.get(
          agenteUsuario.id_persona,
        );
        if (inmobPersonaId) {
          empresaName = inmobiliariaNameById.get(inmobPersonaId);
        }
      }
    }

    const fechaCompra: string | null = (c.fecha_compra as string | null) ?? null;
    const fechaCreacion: string | null =
      (c.fecha_creacion as string | null) ?? null;
    const createdAt: string = fechaCompra || fechaCreacion || new Date().toISOString();
    // Fecha límite = fecha_compra + 15 días naturales (regla del usuario).
    const dueDate = fechaCompra
      ? new Date(new Date(fechaCompra).getTime() + 15 * 86_400_000).toISOString()
      : createdAt;

    result.push({
      id: folio,
      title,
      type: "new_contract",
      // `company` se conserva por compatibilidad. La UI usa empresaName
      // (o "Agente Independiente") en lugar de este campo para expedientes
      // reales en SOZU Legal Flow.
      company: empresaName || "Agente Independiente",
      project: proyecto,
      modelo: modeloNombre ?? undefined,
      property: unidad || undefined,
      requester: agenteNombre || "—",
      requesterDept: "Comercial",
      requesterPhone: agentePhone ?? undefined,
      requesterEmail: agenteEmailNorm ?? undefined,
      empresaName,
      counterparty,
      counterparties,
      compradoresDetalle,
      titular: titular || undefined,
      cuentaCobranza: folio,
      agenteVendedor: agenteNombre || undefined,
      fechaCompra: fechaCompra ?? undefined,
      estimatedValue: Number(c.precio_final ?? 0),
      priority: "medium",
      description:
        status === "request_received"
          ? `Solicitud automática generada por apartado de ${unidad || "bien"} (${folio}).`
          : `Cuenta ${folio} con propiedad en estatus Vendido.`,
      dueDate,
      status,
      createdAt: fechaCreacion || createdAt,
      updatedAt: fechaCompra || fechaCreacion || createdAt,
    });
  }

  return result;
}
