import { supabase } from '@/integrations/supabase/client';

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

/** Documentos con una vigente por tipo. */
export const TIPOS_PERSONALES_SIMPLES = [1, 5, 6, 8, 11] as const;

/**
 * Grupo identidad: una vigente por GRUPO, no por tipo. Son formatos alternativos
 * del mismo documento.
 *   2/3 = frente y reverso por separado (legacy; el frente solo también cuenta,
 *         473 personas en prod no tienen reverso)
 *   4   = pasaporte
 *   63  = INE completo (frente y reverso en un solo PDF)
 */
export const TIPOS_IDENTIDAD = [2, 3, 4, 63] as const;

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

  const tiposAExpirar = (TIPOS_IDENTIDAD as readonly number[]).includes(tipoId)
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

  const tiposDelGrupo = (TIPOS_IDENTIDAD as readonly number[]).includes(tipoId)
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
