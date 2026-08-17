/**
 * FUENTE ÚNICA de los documentos obligatorios de un expediente.
 *
 * La lista canónica es la del **perfil de cliente** (`ClientePerfil.tsx`): es lo que el
 * cliente ve y sube. Regla acordada con Eduardo (2026-07-30):
 *
 *   · Si un portal exige un documento como obligatorio, el cliente también lo tiene que
 *     subir como obligatorio → los `required` de aquí son la unión de lo que exige
 *     cualquier portal.
 *   · Cada portal valida y muestra **solo su subconjunto** (campo `portales`).
 *
 * Antes cada pantalla tenía su propia copia de "los 5 grupos" (CSF, domicilio, INE, CURP,
 * acta) y ninguna distinguía persona física de moral, así que:
 *   · a una PF se le exigía el acta de nacimiento que el perfil marcaba opcional;
 *   · a una PM se le pedían CURP y acta de nacimiento — imposible: las 13 cuentas con
 *     comprador moral de Bottura salían 0% listas.
 */

// ── Catálogo de tipos de documento ────────────────────────────────────────────
// Mismos ids que usa el perfil de cliente (ClientePerfil.tsx).
export const INE_COMPLETO_TIPO_ID = 63;
/** INE frente (2), INE reverso (3), pasaporte (4), INE completo en un PDF (63). */
export const ID_DOC_TIPO_IDS = [2, 3, 4, INE_COMPLETO_TIPO_ID];
/** Reformas / protocolizaciones posteriores al acta constitutiva (PM). */
export const REFORMAS_TIPO_ID = 57;
/** Anexos de persona moral: el slot `otros` del portal del cliente, nunca obligatorio. */
export const OTROS_DOCUMENTOS_TIPO_ID = 69;
/** Acta de matrimonio: obligatoria solo para quien está casado. */
export const ACTA_MATRIMONIO_TIPO_ID = 11;
/** Beneficiario controlador (PM): lo sube el área legal, no el cliente. */
export const BENEFICIARIO_CONTROLADOR_TIPO_ID = 64;

/** Estatus de verificación que cuenta como validado. */
export const ESTATUS_VALIDADO = 2;

/**
 * `personas.id_estado_civil` que cuentan como casado: bienes mancomunados (2) o
 * separados (3). Mismo criterio que `ESTADOS_CIVIL_CASADO` de la edge function
 * `cliente-expediente`, que es quien se lo pide al cliente.
 */
export const ESTADOS_CIVIL_CASADO = [2, 3];

/** `tipos_relacion.clave` del representante legal en `personas_relacionadas`. */
export const REL_CLAVE_REP_LEGAL = 'REPRESENTANTE_LEGAL';

export type TipoPersona = 'pf' | 'pm';
/** De quién es el documento: de la persona del expediente o de su representante legal. */
export type DocOwner = 'self' | 'rep';
/** Portales que validan expedientes. Cada uno declara qué grupos le bloquean. */
export type PortalExpediente = 'escrituracion' | 'juridico' | 'socio_bancario' | 'notaria' | 'cobranza';

export interface GrupoObligatorio {
  key: string;
  label: string;
  /** Cualquiera de estos tipos satisface el grupo (p. ej. INE frente o INE completo). */
  ids: readonly number[];
  owner: DocOwner;
  /** Portales para los que este grupo es obligatorio. */
  portales: readonly PortalExpediente[];
  /**
   * El grupo solo se exige si se cumple la condición. `casado` mira
   * `personas.id_estado_civil` contra {@link ESTADOS_CIVIL_CASADO}; sin dato de
   * estado civil no se exige, igual que hace el portal del cliente.
   */
  condicion?: 'casado';
  /**
   * Se muestra en las listas pero NO cuenta para el avance del expediente. Para
   * documentos que el expediente registra sin bloquear a nadie.
   */
  informativo?: boolean;
}

/** Datos de la persona que deciden si un grupo condicional aplica. */
export interface ContextoPersona {
  /** `personas.id_estado_civil` del titular del expediente. */
  idEstadoCivil?: number | null;
  /** Idem del representante legal, para los grupos con `owner: 'rep'`. */
  repIdEstadoCivil?: number | null;
}

/** ¿Este grupo se le exige a esta persona? Solo los condicionales pueden decir que no. */
export function grupoAplica(grupo: GrupoObligatorio, ctx: ContextoPersona = {}): boolean {
  if (grupo.condicion !== 'casado') return true;
  const estadoCivil = grupo.owner === 'rep' ? ctx.repIdEstadoCivil : ctx.idEstadoCivil;
  return estadoCivil != null && ESTADOS_CIVIL_CASADO.includes(estadoCivil);
}

const TODOS_LOS_PORTALES: readonly PortalExpediente[] =
  ['escrituracion', 'juridico', 'socio_bancario', 'notaria', 'cobranza'];

/**
 * Persona física. `acta` está obligatoria porque escrituración la exige; por la regla de
 * fusión, el perfil de cliente también la pide obligatoria.
 */
export const GRUPOS_PF: readonly GrupoObligatorio[] = [
  { key: 'identidad', label: 'Identificación oficial (INE o pasaporte)',         ids: ID_DOC_TIPO_IDS, owner: 'self', portales: TODOS_LOS_PORTALES },
  { key: 'curp',      label: 'CURP',                           ids: [5],             owner: 'self', portales: TODOS_LOS_PORTALES },
  { key: 'csf',       label: 'Constancia de situación fiscal',  ids: [6],             owner: 'self', portales: TODOS_LOS_PORTALES },
  { key: 'domicilio', label: 'Comprobante de domicilio',       ids: [8],             owner: 'self', portales: TODOS_LOS_PORTALES },
  // Cobranza muestra la lista canónica completa del perfil de cliente, acta incluida.
  { key: 'acta',      label: 'Acta de nacimiento',             ids: [1],             owner: 'self', portales: ['escrituracion', 'juridico', 'notaria', 'cobranza'] },
  // Solo para casados: la pide el portal del cliente con esta misma condición.
  { key: 'matrimonio', label: 'Acta de matrimonio',            ids: [ACTA_MATRIMONIO_TIPO_ID], owner: 'self', portales: TODOS_LOS_PORTALES, condicion: 'casado' },
];

/**
 * Persona moral: documentos de la empresa (`self`) + del representante legal (`rep`).
 * Los tipos 6 y 8 aparecen en los dos owners; el owner decide contra qué persona se
 * evalúa el grupo, así que no colisionan.
 */
export const GRUPOS_PM: readonly GrupoObligatorio[] = [
  { key: 'acta_constitutiva', label: 'Acta constitutiva',               ids: [7],  owner: 'self', portales: TODOS_LOS_PORTALES },
  { key: 'registro_comercio', label: 'Registro Público de Comercio',    ids: [10], owner: 'self', portales: TODOS_LOS_PORTALES },
  { key: 'csf_empresa',       label: 'CSF de la empresa',               ids: [6],  owner: 'self', portales: TODOS_LOS_PORTALES },
  { key: 'domicilio_empresa', label: 'Domicilio fiscal de la empresa',  ids: [8],  owner: 'self', portales: TODOS_LOS_PORTALES },
  { key: 'poder_notarial',    label: 'Poder notarial',                  ids: [9],  owner: 'rep',  portales: TODOS_LOS_PORTALES },
  { key: 'identidad_rep',     label: 'Identificación del rep. legal (INE o pasaporte)',   ids: ID_DOC_TIPO_IDS, owner: 'rep', portales: TODOS_LOS_PORTALES },
  { key: 'curp_rep',          label: 'CURP del rep. legal',             ids: [5],  owner: 'rep',  portales: TODOS_LOS_PORTALES },
  { key: 'csf_rep',           label: 'CSF del rep. legal',              ids: [6],  owner: 'rep',  portales: TODOS_LOS_PORTALES },
  { key: 'domicilio_rep',     label: 'Domicilio del rep. legal',        ids: [8],  owner: 'rep',  portales: TODOS_LOS_PORTALES },
  // Al representante se le piden los MISMOS seis documentos que a cualquier persona
  // física: la edge function reusa una sola lista para titular, representante y
  // accionista. Faltaban su acta de nacimiento y la de matrimonio.
  { key: 'acta_rep',          label: 'Acta de nacimiento del rep. legal', ids: [1], owner: 'rep', portales: ['escrituracion', 'juridico', 'notaria', 'cobranza'] },
  { key: 'matrimonio_rep',    label: 'Acta de matrimonio del rep. legal', ids: [ACTA_MATRIMONIO_TIPO_ID], owner: 'rep', portales: TODOS_LOS_PORTALES, condicion: 'casado' },
  // Lo sube el área legal desde el back office, no el cliente (por eso la edge
  // function lo deja fuera del expediente del portal). Se registra pero no bloquea.
  { key: 'beneficiario_controlador', label: 'Beneficiario controlador', ids: [BENEFICIARIO_CONTROLADOR_TIPO_ID], owner: 'self', portales: TODOS_LOS_PORTALES, informativo: true },
];

/** Normaliza `personas.tipo_persona` ('pf' | 'pm' | 'física' | 'moral' | …). */
export function normalizarTipoPersona(valor: string | null | undefined): TipoPersona {
  const v = (valor ?? '').trim().toLowerCase();
  if (v === 'pm' || v.startsWith('moral') || v.includes('moral')) return 'pm';
  return 'pf';
}

/**
 * Grupos que un portal muestra para ese tipo de persona. Incluye los condicionales
 * y los informativos: la UI los pinta todos. Para saber cuáles **cuentan** contra
 * una persona concreta, ver {@link gruposQueCuentan}.
 */
export function gruposObligatorios(
  tipoPersona: TipoPersona,
  portal: PortalExpediente = 'escrituracion',
): readonly GrupoObligatorio[] {
  const base = tipoPersona === 'pm' ? GRUPOS_PM : GRUPOS_PF;
  return base.filter(g => g.portales.includes(portal));
}

/**
 * Grupos que cuentan para el avance de una persona: los de {@link gruposObligatorios}
 * menos los informativos y menos los condicionales que no le aplican.
 */
export function gruposQueCuentan(
  tipoPersona: TipoPersona,
  portal: PortalExpediente = 'escrituracion',
  ctx: ContextoPersona = {},
): readonly GrupoObligatorio[] {
  return gruposObligatorios(tipoPersona, portal).filter(g => !g.informativo && grupoAplica(g, ctx));
}

/** Todos los tipos de documento que hay que traer de la base para evaluar cualquier caso. */
export const ALL_TIPO_IDS_OBLIGATORIOS: number[] = [
  ...new Set([...GRUPOS_PF, ...GRUPOS_PM].flatMap(g => [...g.ids])),
];

export interface DocParaEvaluar {
  id: number;
  id_persona: number;
  id_tipo_documento: number;
  id_estatus_verificacion: number | null;
  fecha_creacion: string | null;
}

export type LatestDoc = { id: number; estatusId: number; fecha: string };

/**
 * Doc más reciente por (persona, tipo). Clave por TIPO y no por grupo: así el mismo mapa
 * sirve para PF y PM sin depender de qué grupos se estén evaluando.
 *
 * `fecha_creacion` nula → sentinel '9999…' (se considera el más nuevo, igual que
 * `ORDER BY fecha_creacion DESC NULLS FIRST` en PostgreSQL). Desempate por id mayor.
 */
export function buildLatestPorPersonaTipo(docs: DocParaEvaluar[]): Record<string, LatestDoc> {
  const map: Record<string, LatestDoc> = {};
  for (const d of docs) {
    if (!d.id_persona) continue;
    const key = `${d.id_persona}__${d.id_tipo_documento}`;
    const fecha = d.fecha_creacion ?? '9999-12-31T23:59:59Z';
    const ex = map[key];
    if (!ex || fecha > ex.fecha || (fecha === ex.fecha && d.id > ex.id)) {
      map[key] = { id: d.id, estatusId: d.id_estatus_verificacion ?? 0, fecha };
    }
  }
  return map;
}

// ── Identificación oficial: INE completo, pasaporte, y el legacy como fallback ──
export const INE_FRENTE_TIPO_ID = 2;
export const INE_REVERSO_TIPO_ID = 3;
export const PASAPORTE_TIPO_ID = 4;
/** Frente y reverso por separado: deprecados por el INE completo (tipo 63). */
export const INE_LEGACY_TIPO_IDS = [INE_FRENTE_TIPO_ID, INE_REVERSO_TIPO_ID];

export type OrigenIdentidad = 'ine_completo' | 'pasaporte' | 'ine_legacy' | 'ninguno';

export interface ResolucionIdentidad {
  cumplida: boolean;
  origen: OrigenIdentidad;
  /** Tipos que mandan hoy (63; o 4; o el par 2+3). Se resaltan en la UI. */
  tiposVigentes: number[];
  /** Presentes en la base pero ya sin efecto: se pintan como deprecados. */
  tiposDeprecados: number[];
  /** El legacy caducó: el único camino es subir el INE completo en un PDF. */
  exigeIneCompleto: boolean;
}

/**
 * Regla de negocio 2026-07-31, alineada con el portal del cliente (que es quien la dicta):
 *
 *  1. **Identificación oficial = INE o pasaporte**, uno u otro.
 *  2. El canal vigente del INE es el **completo** (frente y reverso en un PDF, tipo 63).
 *     `Frente INE` (2) y `Reverso INE` (3) quedan **deprecados**.
 *  3. Al subir una identificación nueva, el portal del cliente ya expira las demás
 *     (`commitDoc(..., ID_DOC_TIPO_IDS.filter(t => t !== tipoId))`): así solo queda una
 *     versión vigente. Aquí solo se **lee** ese resultado.
 *  4. Mientras el legacy siga **validado**, vale como fallback — el par frente + reverso,
 *     igual que exige el portal del cliente. Quien ya lo tenía aprobado no se rompe.
 *  5. Si el legacy está **expirado o rechazado**, el fallback muere: solo cuenta el INE
 *     completo. (20 personas en prod al 2026-07-31.)
 */
export function resolverIdentidad(
  personaId: number | null,
  latest: Record<string, LatestDoc>,
): ResolucionIdentidad {
  const vacia: ResolucionIdentidad = {
    cumplida: false, origen: 'ninguno', tiposVigentes: [], tiposDeprecados: [], exigeIneCompleto: false,
  };
  if (!personaId) return vacia;

  const doc = (t: number) => latest[`${personaId}__${t}`];
  const validado = (t: number) => doc(t)?.estatusId === ESTATUS_VALIDADO;
  const caduco = (t: number) => doc(t)?.estatusId === 4 || doc(t)?.estatusId === 3;
  const legacyPresente = INE_LEGACY_TIPO_IDS.filter(t => !!doc(t));

  // 1. INE completo subido → manda, y el legacy queda deprecado aunque siga en la base.
  if (doc(INE_COMPLETO_TIPO_ID)) {
    return {
      cumplida: validado(INE_COMPLETO_TIPO_ID),
      origen: 'ine_completo',
      tiposVigentes: [INE_COMPLETO_TIPO_ID],
      tiposDeprecados: legacyPresente,
      exigeIneCompleto: false,
    };
  }

  // 2. Pasaporte: alternativa válida por sí sola, no deprecada.
  if (validado(PASAPORTE_TIPO_ID)) {
    return { ...vacia, cumplida: true, origen: 'pasaporte', tiposVigentes: [PASAPORTE_TIPO_ID], tiposDeprecados: legacyPresente };
  }

  // 3. Fallback legacy: basta el FRENTE validado. Muchas cargas históricas subieron un
  //    solo PDF con ambos lados bajo el tipo "Frente INE" (780 frentes contra 174 reversos
  //    en prod), así que exigir el reverso castigaría a quien ya cumplió. El reverso, si
  //    existe y está validado, suma pero no bloquea.
  if (validado(INE_FRENTE_TIPO_ID)) {
    return {
      ...vacia, cumplida: true, origen: 'ine_legacy',
      tiposVigentes: INE_LEGACY_TIPO_IDS.filter(validado),
    };
  }

  // 4. Sin identificación vigente. Si el legacy existe pero caducó (o está incompleto),
  //    el único camino es el INE completo.
  return {
    ...vacia,
    tiposDeprecados: legacyPresente,
    // El frente no está validado (expirado, rechazado o en revisión): el único camino
    // vigente es el INE completo.
    exigeIneCompleto: legacyPresente.length > 0,
  };
}

/** El grupo de identificación oficial no se evalúa por "algún tipo validado". */
export const ES_GRUPO_IDENTIDAD = (key: string) => key === 'identidad' || key === 'identidad_rep';

export interface ResolucionGrupo {
  /** Documento vigente del grupo (el más reciente entre sus tipos que mandan). */
  doc: LatestDoc | null;
  cumplido: boolean;
}

/**
 * Documento vigente y cumplimiento de un grupo, con el mismo criterio en todas las
 * pantallas. El grupo de identificación oficial usa `resolverIdentidad` (INE completo >
 * pasaporte > par legacy) y su vigente sale de los tipos que mandan, no del más nuevo
 * a secas: un frente rechazado no tapa un pasaporte validado.
 */
export function resolverGrupo(
  personaId: number | null,
  grupo: GrupoObligatorio,
  latest: Record<string, LatestDoc>,
): ResolucionGrupo {
  if (!personaId) return { doc: null, cumplido: false };

  const masReciente = (tipos: readonly number[]): LatestDoc | null => {
    let mejor: LatestDoc | null = null;
    for (const t of tipos) {
      const d = latest[`${personaId}__${t}`];
      if (d && (!mejor || d.fecha > mejor.fecha || (d.fecha === mejor.fecha && d.id > mejor.id))) mejor = d;
    }
    return mejor;
  };

  if (ES_GRUPO_IDENTIDAD(grupo.key)) {
    const res = resolverIdentidad(personaId, latest);
    const doc = res.tiposVigentes.length ? masReciente(res.tiposVigentes) : masReciente(grupo.ids);
    return { doc, cumplido: res.cumplida };
  }

  const doc = masReciente(grupo.ids);
  return { doc, cumplido: doc?.estatusId === ESTATUS_VALIDADO };
}

function grupoCumplido(
  personaId: number | null,
  grupo: GrupoObligatorio,
  latest: Record<string, LatestDoc>,
): boolean {
  return resolverGrupo(personaId, grupo, latest).cumplido;
}

export interface EvaluacionExpediente {
  completos: number;
  total: number;
  /** Labels de los grupos que faltan o cuyo doc más reciente no está validado. */
  faltantes: string[];
  /** true cuando es PM y no hay representante legal ligado: no se puede completar. */
  faltaRepLegal: boolean;
}

/**
 * Evalúa una persona del expediente. Para PM, `repPersonaId` es la persona del
 * representante legal (`personas.id_entidad_relacionada_rep_leg` →
 * `entidades_relacionadas.id_persona`).
 */
export function evaluarPersona(
  args: {
    personaId: number;
    tipoPersona: TipoPersona;
    repPersonaId?: number | null;
    portal?: PortalExpediente;
  } & ContextoPersona,
  latest: Record<string, LatestDoc>,
): EvaluacionExpediente {
  const { personaId, tipoPersona, repPersonaId = null, portal = 'escrituracion' } = args;
  const grupos = gruposQueCuentan(tipoPersona, portal, args);
  const faltantes: string[] = [];
  let completos = 0;

  for (const g of grupos) {
    const dueño = g.owner === 'rep' ? repPersonaId : personaId;
    if (grupoCumplido(dueño, g, latest)) completos++;
    else faltantes.push(g.label);
  }

  return {
    completos,
    total: grupos.length,
    faltantes,
    faltaRepLegal: tipoPersona === 'pm' && !repPersonaId && grupos.some(g => g.owner === 'rep'),
  };
}

/**
 * Evalúa una cuenta completa. Conservador en copropiedad: el expediente vale lo que el
 * comprador peor documentado (no se puede escriturar a medias).
 */
export function evaluarCuenta(
  compradores: Array<{ personaId: number; tipoPersona: TipoPersona; repPersonaId?: number | null } & ContextoPersona>,
  latest: Record<string, LatestDoc>,
  portal: PortalExpediente = 'escrituracion',
): EvaluacionExpediente {
  if (!compradores.length) {
    return { completos: 0, total: gruposQueCuentan('pf', portal).length, faltantes: [], faltaRepLegal: false };
  }
  const evaluaciones = compradores.map(c => evaluarPersona({ ...c, portal }, latest));
  // El "peor" = el que le falta más para su propio total (los totales difieren PF vs PM).
  let peor = evaluaciones[0];
  for (const e of evaluaciones) {
    if (e.total - e.completos > peor.total - peor.completos) peor = e;
  }
  return {
    completos: peor.completos,
    total: peor.total,
    faltantes: [...new Set(evaluaciones.flatMap(e => e.faltantes))],
    faltaRepLegal: evaluaciones.some(e => e.faltaRepLegal),
  };
}

/**
 * Trae los documentos obligatorios (todos los tipos, PF y PM) de las personas indicadas.
 *
 * Chunks de 100 personas: PostgREST corta en `max-rows` sin avisar, y un corte silencioso
 * aquí se traduce en expedientes que aparecen incompletos sin razón. Se pide explícitamente
 * `.limit()` por chunk y se ordena para que el resultado sea estable entre llamadas.
 */
export async function fetchDocsObligatorios(
  personaIds: number[],
  cliente: { from: (t: string) => any },
): Promise<DocParaEvaluar[]> {
  if (!personaIds.length) return [];
  const CHUNK = 100;
  const out: DocParaEvaluar[] = [];
  for (let i = 0; i < personaIds.length; i += CHUNK) {
    const chunk = personaIds.slice(i, i + CHUNK);
    const { data } = await cliente
      .from('documentos')
      .select('id, id_persona, id_tipo_documento, id_estatus_verificacion, fecha_creacion')
      .in('id_persona', chunk)
      .in('id_tipo_documento', ALL_TIPO_IDS_OBLIGATORIOS)
      .eq('activo', true)
      .eq('es_draft', false)
      .order('id_persona', { ascending: true })
      .order('id', { ascending: false })
      .limit(1000);
    if (data) out.push(...(data as DocParaEvaluar[]));
  }
  return out;
}

/**
 * Representante legal que el cliente registró desde el portal nuevo
 * (`personas_relacionadas` + `tipos_relacion.clave = REPRESENTANTE_LEGAL`).
 *
 * Devuelve solo ese camino: quien llama debe caer al legacy
 * `personas.id_entidad_relacionada_rep_leg` cuando aquí no haya nada, que es lo
 * que hace la edge function `cliente-expediente`. Si la tabla no existe todavía
 * en el ambiente, devuelve vacío y el legacy sigue mandando.
 */
export async function fetchRepLegalRegistrado(
  personaIds: number[],
  cliente: { from: (t: string) => any },
): Promise<Record<number, number>> {
  const out: Record<number, number> = {};
  if (!personaIds.length) return out;
  const CHUNK = 100;
  for (let i = 0; i < personaIds.length; i += CHUNK) {
    const { data, error } = await cliente
      .from('personas_relacionadas')
      .select('id_persona, id_persona_relacion, tipos_relacion!inner(clave)')
      .in('id_persona', personaIds.slice(i, i + CHUNK))
      .eq('activo', true)
      .eq('tipos_relacion.clave', REL_CLAVE_REP_LEGAL);
    if (error) return out;
    for (const r of (data ?? []) as Array<{ id_persona: number; id_persona_relacion: number | null }>) {
      if (r.id_persona_relacion && !out[r.id_persona]) out[r.id_persona] = r.id_persona_relacion;
    }
  }
  return out;
}

/** `personas.id_estado_civil` de las personas dadas: decide el acta de matrimonio. */
export async function fetchEstadoCivil(
  personaIds: number[],
  cliente: { from: (t: string) => any },
): Promise<Record<number, number | null>> {
  const out: Record<number, number | null> = {};
  const ids = [...new Set(personaIds)];
  if (!ids.length) return out;
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await cliente
      .from('personas')
      .select('id, id_estado_civil')
      .in('id', ids.slice(i, i + CHUNK));
    for (const r of (data ?? []) as Array<{ id: number; id_estado_civil: number | null }>) {
      out[r.id] = r.id_estado_civil ?? null;
    }
  }
  return out;
}

// ── Cónyuge (propiedad mancomunada) ───────────────────────────────────────────
/**
 * Criterio autorizado por Eduardo (2026-08-03): **si `personas.id_conyuge` está presente,
 * el expediente incluye también los documentos del cónyuge.**
 *
 * No existe campo de régimen matrimonial en la base (`personas.regimen` guarda el régimen
 * FISCAL del SAT: 601, 603, 605…), así que no se puede distinguir mancomunado de separación
 * de bienes. Con el vínculo presente se asume que aplica. En prod hay 126 personas con
 * cónyuge ligado y 315 filas de compradores que lo tienen.
 *
 * El cónyuge se evalúa con los MISMOS grupos que un comprador persona física: son dos
 * entidades distintas, cada una con su juego completo de documentos.
 */
export function personasDelExpediente(
  compradores: Array<{ personaId: number; nombre?: string; tipoPersona: TipoPersona; repPersonaId?: number | null; conyugePersonaId?: number | null } & ContextoPersona>,
): Array<{ personaId: number; nombre?: string; tipoPersona: TipoPersona; repPersonaId?: number | null; esConyugeDe?: number } & ContextoPersona> {
  const salida: Array<{ personaId: number; nombre?: string; tipoPersona: TipoPersona; repPersonaId?: number | null; esConyugeDe?: number } & ContextoPersona> = [];
  for (const c of compradores) {
    salida.push({
      personaId: c.personaId,
      nombre: c.nombre,
      tipoPersona: c.tipoPersona,
      repPersonaId: c.repPersonaId ?? null,
      idEstadoCivil: c.idEstadoCivil ?? null,
      repIdEstadoCivil: c.repIdEstadoCivil ?? null,
    });
    // Solo persona física puede tener cónyuge; una PM no. Que esté ligado ya implica
    // casado, así que su acta de matrimonio se le exige aunque su ficha no lo diga.
    if (c.tipoPersona === 'pf' && c.conyugePersonaId) {
      salida.push({ personaId: c.conyugePersonaId, tipoPersona: 'pf', esConyugeDe: c.personaId, idEstadoCivil: ESTADOS_CIVIL_CASADO[0] });
    }
  }
  // Dedup por si el cónyuge también figura como comprador de la misma cuenta.
  const vistos = new Set<number>();
  return salida.filter(p => (vistos.has(p.personaId) ? false : (vistos.add(p.personaId), true)));
}

// ── Personas del expediente resueltas desde la base ──────────────────────────
export interface PersonaExpedienteResuelta {
  personaId: number;
  nombre: string;
  tipoPersona: TipoPersona;
  repPersonaId: number | null;
  /** Presente cuando la persona entra al expediente como cónyuge de ese comprador. */
  esConyugeDe?: number;
  /** Nombre del comprador titular (solo cuando esConyugeDe está presente). */
  nombreTitular?: string;
  /** `personas.id_estado_civil`: decide si se le exige el acta de matrimonio. */
  idEstadoCivil: number | null;
  /** Idem del representante legal. */
  repIdEstadoCivil: number | null;
}

/**
 * Resuelve las personas que componen un expediente: compradores de la cuenta (o los
 * `personaIds` dados), su representante legal cuando son PM y su cónyuge cuando
 * `personas.id_conyuge` está presente. Es el ÚNICO lugar que arma esa lista:
 * cualquier pantalla que la necesite parte de aquí.
 *
 * El representante sale de la **unión de dos caminos**, igual que la edge function
 * `cliente-expediente`: `personas_relacionadas` con la clave `REPRESENTANTE_LEGAL`
 * (lo que registra el cliente desde el portal nuevo) y el legacy
 * `personas.id_entidad_relacionada_rep_leg` (lo que dejó el back office). Mirar solo
 * el legacy deja ciego al admin en cuanto el cliente registre al suyo: hoy 1,087 de
 * las 1,156 personas morales de producción no tienen esa columna.
 */
export async function fetchPersonasExpediente(
  args: { cuentaId?: number | null; personaIds?: number[] },
  cliente: { from: (t: string) => any },
): Promise<PersonaExpedienteResuelta[]> {
  let ids = [...new Set(args.personaIds ?? [])];
  if (!ids.length && args.cuentaId) {
    const { data } = await cliente
      .from('compradores')
      .select('id_persona')
      .eq('id_cuenta_cobranza', args.cuentaId)
      .eq('activo', true);
    ids = [...new Set((data ?? []).map((c: any) => c.id_persona as number).filter(Boolean))] as number[];
  }
  if (!ids.length) return [];

  type PersonaRow = {
    id: number; nombre_legal: string | null; nombre_comercial: string | null;
    tipo_persona: string | null; id_conyuge: number | null;
    id_entidad_relacionada_rep_leg: number | null; id_estado_civil: number | null;
  };
  const { data: personas } = await cliente
    .from('personas')
    .select('id, nombre_legal, nombre_comercial, tipo_persona, id_conyuge, id_entidad_relacionada_rep_leg, id_estado_civil')
    .in('id', ids);
  const rows = (personas ?? []) as PersonaRow[];

  // Camino nuevo: el representante que registró el cliente desde el portal.
  const repPorPersona = await fetchRepLegalRegistrado(ids, cliente);

  // Camino legacy: entidad relacionada → persona. Solo para quien no salió arriba.
  const repEntidadIds = [...new Set(
    rows.filter(r => !repPorPersona[r.id]).map(r => r.id_entidad_relacionada_rep_leg).filter((v): v is number => v != null),
  )];
  const repPersonaPorEntidad: Record<number, number> = {};
  if (repEntidadIds.length) {
    const { data: reps } = await cliente
      .from('entidades_relacionadas')
      .select('id, id_persona')
      .in('id', repEntidadIds);
    for (const r of (reps ?? []) as Array<{ id: number; id_persona: number | null }>) {
      if (r.id_persona) repPersonaPorEntidad[r.id] = r.id_persona;
    }
  }

  const nombreDe = (r: PersonaRow) => r.nombre_legal || r.nombre_comercial || `Persona ${r.id}`;
  const porId = new Map(rows.map(r => [r.id, r]));

  const repDe = (r: PersonaRow): number | null =>
    repPorPersona[r.id]
    ?? (r.id_entidad_relacionada_rep_leg != null ? repPersonaPorEntidad[r.id_entidad_relacionada_rep_leg] ?? null : null);

  // Estado civil de los representantes: son personas distintas de las consultadas.
  const repIds = [...new Set(rows.map(repDe).filter((v): v is number => v != null))].filter(id => !porId.has(id));
  const estadoCivilRep = await fetchEstadoCivil(repIds, cliente);

  const base = ids
    .map(id => porId.get(id))
    .filter((r): r is PersonaRow => !!r)
    .map(r => {
      const repPersonaId = repDe(r);
      return {
        personaId: r.id,
        nombre: nombreDe(r),
        tipoPersona: normalizarTipoPersona(r.tipo_persona),
        repPersonaId,
        conyugePersonaId: r.id_conyuge ?? null,
        idEstadoCivil: r.id_estado_civil ?? null,
        repIdEstadoCivil: repPersonaId == null
          ? null
          : estadoCivilRep[repPersonaId] ?? porId.get(repPersonaId)?.id_estado_civil ?? null,
      };
    });

  const expandidas = personasDelExpediente(base);

  // Nombres de los cónyuges que no venían en la lista original.
  const faltanNombre = expandidas.filter(p => p.esConyugeDe && !porId.has(p.personaId)).map(p => p.personaId);
  const nombreConyuge: Record<number, string> = {};
  if (faltanNombre.length) {
    const { data: cs } = await cliente
      .from('personas')
      .select('id, nombre_legal, nombre_comercial')
      .in('id', faltanNombre);
    for (const c of (cs ?? []) as Array<{ id: number; nombre_legal: string | null; nombre_comercial: string | null }>) {
      nombreConyuge[c.id] = c.nombre_legal || c.nombre_comercial || `Persona ${c.id}`;
    }
  }

  const nombrePorId = new Map(base.map(b => [b.personaId, b.nombre]));
  return expandidas.map(p => ({
    personaId: p.personaId,
    nombre: p.nombre ?? nombreConyuge[p.personaId] ?? nombrePorId.get(p.personaId) ?? `Persona ${p.personaId}`,
    tipoPersona: p.tipoPersona,
    repPersonaId: p.repPersonaId ?? null,
    esConyugeDe: p.esConyugeDe,
    nombreTitular: p.esConyugeDe ? nombrePorId.get(p.esConyugeDe) : undefined,
    idEstadoCivil: p.idEstadoCivil ?? null,
    repIdEstadoCivil: p.repIdEstadoCivil ?? null,
  }));
}
