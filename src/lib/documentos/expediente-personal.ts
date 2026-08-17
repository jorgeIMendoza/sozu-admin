import { supabase } from '@/integrations/supabase/client';
import { ID_DOC_TIPO_IDS, OTROS_DOCUMENTOS_TIPO_ID, REFORMAS_TIPO_ID } from '@/utils/expediente-obligatorios';

/**
 * Regla del expediente personal del cliente: una sola versión vigente.
 *
 * Al subir un documento nuevo, todo lo anterior pasa a estatus 4 (Expirado) y el
 * nuevo queda vigente. Las filas viejas se conservan `activo = true` a propósito:
 * son el histórico que consulta el área de verificación.
 *
 * Aplica SOLO a documentos que pertenecen a una persona y a los tipos del perfil
 * personal. No aplica a documentos de una cuenta de cobranza o propiedad
 * (contratos, escrituras, facturas, actas de entrega): ahí varias filas del mismo
 * tipo son legítimas — una persona con tres propiedades tiene tres contratos.
 *
 * Ver Ejecuciones_manuales/documentos/06_normalizar_documentos_duplicados_activos.md
 */

/**
 * Documentos con una vigente por tipo: acta de nacimiento (1), CURP (5), CSF (6),
 * domicilio (8), acta de matrimonio (11) y reformas al acta constitutiva (57).
 *
 * "Otros documentos" (69) queda FUERA a propósito: es el ÚNICO slot múltiple del
 * portal del cliente. Meterlo aquí borraría el anexo anterior en cada carga.
 */
export const TIPOS_PERSONALES_SIMPLES = [1, 5, 6, 8, 11, REFORMAS_TIPO_ID] as const;

/**
 * Grupo identidad: una vigente por GRUPO, no por tipo. Son formatos alternativos
 * del mismo documento — frente/reverso legacy (el frente solo también cuenta: 473
 * personas en prod no tienen reverso), pasaporte, o INE completo en un PDF.
 *
 * Se reutiliza `ID_DOC_TIPO_IDS` de `expediente-obligatorios` para no volver a
 * declarar el grupo: ese archivo es la fuente única de los obligatorios.
 */
export const TIPOS_IDENTIDAD: readonly number[] = ID_DOC_TIPO_IDS;

/**
 * Tipos MÚLTIPLES: varios documentos conviven y ninguno reemplaza al anterior.
 *
 * Es exactamente UNO: "Otros documentos" (69). Para eso se creó — cada anexo lleva
 * su `descripcion`, que es lo que los distingue; reemplazar uno concreto es una
 * acción aparte, no un efecto de subir el siguiente. Todo lo demás sigue la regla
 * de una sola versión vigente, incluidas las reformas al acta constitutiva (57),
 * que solo hicieron de anexo mientras el tipo 69 no existía.
 *
 * No basta con dejarlo fuera de la regla de vigencia única: cualquier pantalla que
 * colapse "un documento por tipo" lo esconde y parece que se borró.
 */
export const TIPOS_MULTIPLES: readonly number[] = [OTROS_DOCUMENTOS_TIPO_ID];

/** ¿De este tipo pueden convivir varios documentos vigentes? */
export function esTipoMultiple(tipoId: number): boolean {
  return TIPOS_MULTIPLES.includes(tipoId);
}

export const TIPOS_PERSONALES = [
  ...TIPOS_PERSONALES_SIMPLES,
  ...TIPOS_IDENTIDAD,
] as number[];

/** ¿Este tipo participa de la regla de una sola versión vigente? */
export function esTipoPersonal(tipoId: number): boolean {
  return TIPOS_PERSONALES.includes(tipoId);
}

/**
 * Expira las versiones previas antes de insertar una nueva.
 *
 * Para un tipo del grupo identidad expira **todo el grupo**, no solo ese tipo: si
 * el cliente sube un INE completo, el frente y el reverso legacy dejan de ser
 * vigentes, y al revés.
 *
 * No lanza: un fallo aquí no debe impedir que el documento se registre. Devuelve
 * cuántas filas expiró, o null si la llamada falló.
 */
export async function expirarPreviosPersonales(
  idPersona: number,
  tipoId: number,
): Promise<number | null> {
  if (!idPersona || !esTipoPersonal(tipoId)) return 0;

  const tiposAExpirar = TIPOS_IDENTIDAD.includes(tipoId)
    ? [...TIPOS_IDENTIDAD]
    : [tipoId];

  const { data, error } = await (supabase as any)
    .from('documentos')
    .update({ id_estatus_verificacion: 4 })
    .eq('id_persona', idPersona)
    .in('id_tipo_documento', tiposAExpirar)
    .eq('activo', true)
    .is('id_cuenta_cobranza', null)
    .neq('id_estatus_verificacion', 4)
    .select('id');

  if (error) {
    console.error('[expirarPreviosPersonales]', error);
    return null;
  }
  return data?.length ?? 0;
}

/**
 * ¿Este documento es la versión vigente de su tipo/grupo?
 *
 * Se usa para no dejar que se marque como Validado una versión superada: era la
 * vía por la que filas viejas volvían a estatus 2 y el expediente mostraba dos
 * documentos aprobados del mismo tipo.
 */
export async function esVersionVigente(
  idPersona: number,
  documentoId: number,
  tipoId: number,
): Promise<boolean> {
  if (!idPersona || !esTipoPersonal(tipoId)) return true;

  const tiposDelGrupo = TIPOS_IDENTIDAD.includes(tipoId)
    ? [...TIPOS_IDENTIDAD]
    : [tipoId];

  const { data, error } = await (supabase as any)
    .from('documentos')
    .select('id, fecha_creacion')
    .eq('id_persona', idPersona)
    .in('id_tipo_documento', tiposDelGrupo)
    .eq('activo', true)
    .is('id_cuenta_cobranza', null)
    .order('fecha_creacion', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(1);

  // Ante un error de lectura no se bloquea la acción del usuario.
  if (error) {
    console.error('[esVersionVigente]', error);
    return true;
  }
  return !data?.length || data[0].id === documentoId;
}
