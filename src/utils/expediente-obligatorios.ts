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

/** Estatus de verificación que cuenta como validado. */
export const ESTATUS_VALIDADO = 2;

export type TipoPersona = 'pf' | 'pm';
/** De quién es el documento: de la persona del expediente o de su representante legal. */
export type DocOwner = 'self' | 'rep';
/** Portales que validan expedientes. Cada uno declara qué grupos le bloquean. */
export type PortalExpediente = 'escrituracion' | 'juridico' | 'socio_bancario' | 'notaria';

export interface GrupoObligatorio {
  key: string;
  label: string;
  /** Cualquiera de estos tipos satisface el grupo (p. ej. INE frente o INE completo). */
  ids: readonly number[];
  owner: DocOwner;
  /** Portales para los que este grupo es obligatorio. */
  portales: readonly PortalExpediente[];
}

const TODOS_LOS_PORTALES: readonly PortalExpediente[] =
  ['escrituracion', 'juridico', 'socio_bancario', 'notaria'];

/**
 * Persona física. `acta` está obligatoria porque escrituración la exige; por la regla de
 * fusión, el perfil de cliente también la pide obligatoria.
 */
export const GRUPOS_PF: readonly GrupoObligatorio[] = [
  { key: 'identidad', label: 'Identificación oficial (INE o pasaporte)',         ids: ID_DOC_TIPO_IDS, owner: 'self', portales: TODOS_LOS_PORTALES },
  { key: 'curp',      label: 'CURP',                           ids: [5],             owner: 'self', portales: TODOS_LOS_PORTALES },
  { key: 'csf',       label: 'Constancia de situación fiscal',  ids: [6],             owner: 'self', portales: TODOS_LOS_PORTALES },
  { key: 'domicilio', label: 'Comprobante de domicilio',       ids: [8],             owner: 'self', portales: TODOS_LOS_PORTALES },
  { key: 'acta',      label: 'Acta de nacimiento',             ids: [1],             owner: 'self', portales: ['escrituracion', 'juridico', 'notaria'] },
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
];

/** Normaliza `personas.tipo_persona` ('pf' | 'pm' | 'física' | 'moral' | …). */
export function normalizarTipoPersona(valor: string | null | undefined): TipoPersona {
  const v = (valor ?? '').trim().toLowerCase();
  if (v === 'pm' || v.startsWith('moral') || v.includes('moral')) return 'pm';
  return 'pf';
}

/** Grupos que un portal exige para ese tipo de persona. */
export function gruposObligatorios(
  tipoPersona: TipoPersona,
  portal: PortalExpediente = 'escrituracion',
): readonly GrupoObligatorio[] {
  const base = tipoPersona === 'pm' ? GRUPOS_PM : GRUPOS_PF;
  return base.filter(g => g.portales.includes(portal));
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

  // 3. Fallback legacy: el PAR frente + reverso, y solo si ambos siguen validados.
  if (validado(INE_FRENTE_TIPO_ID) && validado(INE_REVERSO_TIPO_ID)) {
    return { ...vacia, cumplida: true, origen: 'ine_legacy', tiposVigentes: [...INE_LEGACY_TIPO_IDS] };
  }

  // 4. Sin identificación vigente. Si el legacy existe pero caducó (o está incompleto),
  //    el único camino es el INE completo.
  return {
    ...vacia,
    tiposDeprecados: legacyPresente,
    exigeIneCompleto: legacyPresente.length > 0 && (legacyPresente.some(caduco) || !validado(INE_FRENTE_TIPO_ID) || !validado(INE_REVERSO_TIPO_ID)),
  };
}

/** El grupo de identificación oficial no se evalúa por "algún tipo validado". */
export const ES_GRUPO_IDENTIDAD = (key: string) => key === 'identidad' || key === 'identidad_rep';

/**
 * Un grupo está cumplido si su documento más reciente está validado. El grupo de
 * identificación oficial usa `resolverIdentidad` (INE completo > pasaporte > par legacy).
 */
function grupoCumplido(
  personaId: number | null,
  grupo: GrupoObligatorio,
  latest: Record<string, LatestDoc>,
): boolean {
  if (!personaId) return false;
  if (ES_GRUPO_IDENTIDAD(grupo.key)) return resolverIdentidad(personaId, latest).cumplida;
  return grupo.ids.some(tipoId => latest[`${personaId}__${tipoId}`]?.estatusId === ESTATUS_VALIDADO);
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
  },
  latest: Record<string, LatestDoc>,
): EvaluacionExpediente {
  const { personaId, tipoPersona, repPersonaId = null, portal = 'escrituracion' } = args;
  const grupos = gruposObligatorios(tipoPersona, portal);
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
  compradores: Array<{ personaId: number; tipoPersona: TipoPersona; repPersonaId?: number | null }>,
  latest: Record<string, LatestDoc>,
  portal: PortalExpediente = 'escrituracion',
): EvaluacionExpediente {
  if (!compradores.length) {
    return { completos: 0, total: gruposObligatorios('pf', portal).length, faltantes: [], faltaRepLegal: false };
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
