/**
 * Personas que cuelgan de una persona moral: su representante legal y sus
 * accionistas. Es el equivalente interno de lo que el cliente hace desde su
 * portal, para cuando hay que resolverlo desde el back office.
 *
 * Las reglas son las MISMAS que aplica la edge function `cliente-expediente`
 * (acción `alta_persona`), porque los dos escriben en la misma tabla y un
 * criterio distinto de cada lado deja expedientes que cuadran en una pantalla y
 * no en la otra:
 *
 *   · Solo una persona MORAL tiene personas ligadas.
 *   · Correo y teléfono son obligatorios al dar de alta a alguien nuevo: son el
 *     único modo de pedirle después sus documentos.
 *   · Un accionista necesita expediente propio solo si pasa del 25%; por debajo
 *     la ley no lo exige y pedirlo es trabajo inútil.
 *   · Entre todos los accionistas activos no se puede pasar de 100%.
 *
 * Diferencia deliberada con el portal: aquí también se puede **ligar a una
 * persona que ya existe** en el sistema. El cliente no puede (le colgaría del
 * expediente a alguien que él no registró), pero el back office sí: el caso
 * normal es que el representante ya esté capturado.
 */

import {
  REL_CLAVE_ACCIONISTA,
  REL_CLAVE_REP_LEGAL,
  UMBRAL_ACCIONISTA,
} from '@/utils/expediente-obligatorios';

export { UMBRAL_ACCIONISTA };

export type RolLigado = 'representante' | 'accionista';

/** `tipos_relacion.clave` de cada rol. */
export const CLAVE_DE_ROL: Record<RolLigado, string> = {
  representante: REL_CLAVE_REP_LEGAL,
  accionista: REL_CLAVE_ACCIONISTA,
};

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Los teléfonos que se capturan son de México: 10 dígitos, sin lada de país. */
const TELEFONO_DIGITOS = 10;
/** `personas.clave_pais_telefono` es FK a `paises.id` ("MX"), no una lada. */
const PAIS_TELEFONO = 'MX';

/** Códigos de PostgreSQL que aquí significan algo concreto para el usuario. */
const PG_DUPLICADO = '23505';
const PG_CHECK = '23514';

export interface PersonaLigada {
  /** `personas_relacionadas.id`; null cuando viene de la columna legacy. */
  vinculoId: number | null;
  personaId: number;
  nombre: string;
  tipoPersona: 'pf' | 'pm';
  rol: RolLigado;
  porcentaje: number | null;
  /**
   * Viene de `personas.id_entidad_relacionada_rep_leg`, no de la tabla de
   * relaciones: se muestra pero no se edita ni se da de baja desde aquí.
   */
  legacy: boolean;
}

type Cliente = { from: (t: string) => any };

const normalizarTipo = (v: string | null | undefined): 'pf' | 'pm' =>
  (v ?? '').trim().toLowerCase().includes('moral') || (v ?? '').trim().toLowerCase() === 'pm' ? 'pm' : 'pf';

const nombreDe = (p: { nombre_legal?: string | null; nombre_comercial?: string | null } | null, id: number) =>
  p?.nombre_legal || p?.nombre_comercial || `Persona ${id}`;

/** Error con mensaje ya listo para mostrarle a quien lo provocó. */
export class ErrorPersonaLigada extends Error {
  constructor(public readonly codigo: string, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorPersonaLigada';
  }
}

/** `tipos_relacion.id` de un rol, por su clave. */
async function idDeRol(rol: RolLigado, cliente: Cliente): Promise<number> {
  const { data } = await cliente
    .from('tipos_relacion')
    .select('id')
    .eq('clave', CLAVE_DE_ROL[rol])
    .maybeSingle();
  if (!data?.id) {
    throw new ErrorPersonaLigada('catalogo_incompleto', `El catálogo no tiene el rol ${CLAVE_DE_ROL[rol]}.`);
  }
  return data.id as number;
}

/**
 * Representante y accionistas de una persona moral: los de
 * `personas_relacionadas` más el representante legacy de `personas`, igual que
 * resuelve `ligadasDe()` en la edge function.
 */
export async function fetchPersonasLigadas(personaId: number, cliente: Cliente): Promise<PersonaLigada[]> {
  if (!personaId) return [];

  const { data: rows } = await cliente
    .from('personas_relacionadas')
    .select('id, id_persona_relacion, porcentaje, tipos_relacion!inner(clave), personas:id_persona_relacion(nombre_legal, nombre_comercial, tipo_persona)')
    .eq('id_persona', personaId)
    .eq('activo', true)
    .in('tipos_relacion.clave', Object.values(CLAVE_DE_ROL));

  const salida: PersonaLigada[] = (rows ?? []).map((r: any) => ({
    vinculoId: r.id as number,
    personaId: r.id_persona_relacion as number,
    nombre: nombreDe(r.personas, r.id_persona_relacion),
    tipoPersona: normalizarTipo(r.personas?.tipo_persona),
    rol: r.tipos_relacion?.clave === CLAVE_DE_ROL.accionista ? 'accionista' : 'representante',
    porcentaje: r.porcentaje == null ? null : Number(r.porcentaje),
    legacy: false,
  }));

  // Representante que dejó el back office en la columna vieja: cuenta igual, pero
  // no se edita desde aquí porque no vive en esta tabla.
  const yaEstan = new Set(salida.map(l => l.personaId));
  const { data: p } = await cliente
    .from('personas').select('id_entidad_relacionada_rep_leg').eq('id', personaId).maybeSingle();
  const entidadId = p?.id_entidad_relacionada_rep_leg as number | null | undefined;
  if (entidadId) {
    const { data: er } = await cliente
      .from('entidades_relacionadas').select('id_persona').eq('id', entidadId).maybeSingle();
    const repId = er?.id_persona as number | null | undefined;
    if (repId && !yaEstan.has(repId)) {
      const { data: rp } = await cliente
        .from('personas').select('nombre_legal, nombre_comercial, tipo_persona').eq('id', repId).maybeSingle();
      salida.push({
        vinculoId: null,
        personaId: repId,
        nombre: nombreDe(rp, repId),
        tipoPersona: normalizarTipo(rp?.tipo_persona),
        rol: 'representante',
        porcentaje: null,
        legacy: true,
      });
    }
  }

  return salida;
}

/** Cuánto porcentaje queda libre entre los accionistas activos. */
export function porcentajeDisponible(ligadas: PersonaLigada[]): number {
  const asignado = ligadas
    .filter(l => l.rol === 'accionista')
    .reduce((suma, l) => suma + (l.porcentaje ?? 0), 0);
  return Math.max(0, 100 - asignado);
}

/**
 * Valida el porcentaje de un accionista con las dos reglas de la edge function:
 * el umbral (por debajo no hace falta expediente) y la suma entre todos.
 * `vinculoIdExcluido` deja fuera del cálculo el vínculo que se está editando.
 */
function validarPorcentaje(
  porcentaje: number | null | undefined,
  ligadas: PersonaLigada[],
  vinculoIdExcluido?: number | null,
): number {
  const p = typeof porcentaje === 'number' ? porcentaje : parseFloat(String(porcentaje ?? ''));
  if (!Number.isFinite(p) || p <= 0 || p > 100) {
    throw new ErrorPersonaLigada('porcentaje_invalido', 'El porcentaje debe estar entre 0 y 100.');
  }
  if (p <= UMBRAL_ACCIONISTA) {
    throw new ErrorPersonaLigada(
      'porcentaje_menor',
      `Solo hace falta el expediente de accionistas con más del ${UMBRAL_ACCIONISTA}% de las acciones.`,
    );
  }
  const otros = ligadas.filter(l => l.vinculoId !== vinculoIdExcluido);
  const disponible = porcentajeDisponible(otros);
  if (p > disponible) {
    throw new ErrorPersonaLigada(
      'porcentaje_total',
      `Entre todos los accionistas no pueden pasar del 100%. Disponible: ${disponible}%.`,
    );
  }
  return p;
}

/** Inserta el vínculo, o lo reactiva si ya existía dado de baja. */
async function vincular(
  args: { personaId: number; personaRelacionId: number; rol: RolLigado; porcentaje: number | null },
  cliente: Cliente,
): Promise<void> {
  const { personaId, personaRelacionId, rol, porcentaje } = args;
  if (personaId === personaRelacionId) {
    throw new ErrorPersonaLigada('autorreferencia', 'Una persona no puede ligarse a sí misma.');
  }
  const idRol = await idDeRol(rol, cliente);

  // El UNIQUE es por (persona, relacionada, tipo): un vínculo dado de baja sigue
  // ocupando la fila, así que se reactiva en vez de insertar otro.
  const { data: previo } = await cliente
    .from('personas_relacionadas')
    .select('id')
    .eq('id_persona', personaId)
    .eq('id_persona_relacion', personaRelacionId)
    .eq('id_tipo_relacion', idRol)
    .maybeSingle();

  const { error } = previo?.id
    ? await cliente.from('personas_relacionadas').update({ activo: true, porcentaje }).eq('id', previo.id)
    : await cliente.from('personas_relacionadas').insert({
        id_persona: personaId,
        id_persona_relacion: personaRelacionId,
        id_tipo_relacion: idRol,
        porcentaje,
        activo: true,
      });

  if (error) {
    // El trigger anti-ciclo: sin él, dos empresas accionistas la una de la otra
    // cuelgan el recorrido del árbol.
    if (error.code === PG_CHECK) {
      throw new ErrorPersonaLigada('ciclo', 'Esa empresa ya cuelga de esta, no se puede ligar en los dos sentidos.');
    }
    throw new ErrorPersonaLigada('error_vinculo', error.message ?? 'No se pudo crear el vínculo.');
  }
}

/**
 * Da de alta una persona nueva y la liga. Espejo de `alta_persona` de la edge
 * function: mismas validaciones y mismos mensajes.
 */
export async function altaPersonaLigada(
  args: {
    personaId: number;
    rol: RolLigado;
    nombre: string;
    tipoPersona: 'pf' | 'pm';
    correo: string;
    telefono: string;
    porcentaje?: number | null;
    ligadasActuales: PersonaLigada[];
  },
  cliente: Cliente,
): Promise<number> {
  const nombre = args.nombre.trim();
  if (nombre.length < 3) throw new ErrorPersonaLigada('nombre_requerido', 'El nombre es obligatorio.');

  const correo = args.correo.trim().toLowerCase();
  if (!CORREO_RE.test(correo)) throw new ErrorPersonaLigada('correo_invalido', 'El correo no es válido.');

  const telefono = String(args.telefono ?? '').replace(/\D/g, '');
  if (telefono.length !== TELEFONO_DIGITOS) {
    throw new ErrorPersonaLigada('telefono_invalido', `El teléfono debe tener ${TELEFONO_DIGITOS} dígitos.`);
  }

  const porcentaje = args.rol === 'accionista'
    ? validarPorcentaje(args.porcentaje, args.ligadasActuales)
    : null;

  const { data: creada, error } = await cliente
    .from('personas')
    // En minúscula: es lo único que hay en la tabla y el back office compara exacto.
    .insert({
      nombre_legal: nombre,
      tipo_persona: args.tipoPersona,
      email: correo,
      telefono,
      clave_pais_telefono: PAIS_TELEFONO,
    })
    .select('id')
    .maybeSingle();

  if (error || !creada?.id) {
    // `personas.email` es UNIQUE en toda la tabla.
    if (error?.code === PG_DUPLICADO) {
      throw new ErrorPersonaLigada(
        'correo_duplicado',
        'Ese correo ya está registrado en otra persona. Búscala y lígala en vez de crearla de nuevo.',
      );
    }
    throw new ErrorPersonaLigada('error_alta', error?.message ?? 'No se pudo crear la persona.');
  }

  await vincular({ personaId: args.personaId, personaRelacionId: creada.id, rol: args.rol, porcentaje }, cliente);
  return creada.id as number;
}

/** Liga a una persona que ya existe. El portal del cliente no puede hacer esto. */
export async function ligarPersonaExistente(
  args: {
    personaId: number;
    personaRelacionId: number;
    rol: RolLigado;
    porcentaje?: number | null;
    ligadasActuales: PersonaLigada[];
  },
  cliente: Cliente,
): Promise<void> {
  if (args.ligadasActuales.some(l => l.personaId === args.personaRelacionId && l.rol === args.rol)) {
    throw new ErrorPersonaLigada('ya_ligada', 'Esa persona ya está ligada con ese rol.');
  }
  const porcentaje = args.rol === 'accionista'
    ? validarPorcentaje(args.porcentaje, args.ligadasActuales)
    : null;
  await vincular({
    personaId: args.personaId,
    personaRelacionId: args.personaRelacionId,
    rol: args.rol,
    porcentaje,
  }, cliente);
}

/** Cambia el porcentaje de un accionista ya ligado. */
export async function editarPorcentajeLigada(
  args: { vinculoId: number; porcentaje: number; ligadasActuales: PersonaLigada[] },
  cliente: Cliente,
): Promise<void> {
  const porcentaje = validarPorcentaje(args.porcentaje, args.ligadasActuales, args.vinculoId);
  const { error } = await cliente
    .from('personas_relacionadas').update({ porcentaje }).eq('id', args.vinculoId);
  if (error) throw new ErrorPersonaLigada('error_edicion', error.message ?? 'No se pudo actualizar.');
}

/**
 * Baja lógica del vínculo. La persona NO se borra: sus documentos siguen siendo
 * suyos y puede estar ligada a otra empresa.
 */
export async function bajaPersonaLigada(vinculoId: number, cliente: Cliente): Promise<void> {
  const { error } = await cliente
    .from('personas_relacionadas').update({ activo: false }).eq('id', vinculoId);
  if (error) throw new ErrorPersonaLigada('error_baja', error.message ?? 'No se pudo quitar el vínculo.');
}

/** Busca personas por nombre, correo o RFC para ligar una que ya existe. */
export async function buscarPersonas(
  termino: string,
  cliente: Cliente,
  excluirIds: number[] = [],
): Promise<Array<{ id: number; nombre: string; tipoPersona: 'pf' | 'pm'; email: string | null; rfc: string | null }>> {
  const q = termino.trim();
  if (q.length < 3) return [];
  const like = `%${q}%`;
  const { data } = await cliente
    .from('personas')
    .select('id, nombre_legal, nombre_comercial, tipo_persona, email, rfc')
    .or(`nombre_legal.ilike.${like},nombre_comercial.ilike.${like},email.ilike.${like},rfc.ilike.${like}`)
    .limit(20);
  return (data ?? [])
    .filter((p: any) => !excluirIds.includes(p.id))
    .map((p: any) => ({
      id: p.id as number,
      nombre: nombreDe(p, p.id),
      tipoPersona: normalizarTipo(p.tipo_persona),
      email: p.email ?? null,
      rfc: p.rfc ?? null,
    }));
}
