/**
 * Roles cuyo usuario DEBE quedar ligado a una persona (`usuarios.id_persona`).
 *
 * Estos roles operan bajo reglas de RLS basadas en "dueño del registro": las policies
 * comparan contra `current_persona_id()` / `get_current_user_persona_id()`. Si el usuario
 * no tiene persona, esa rama siempre da falso y el portal correspondiente falla o —peor—
 * termina operando con los datos de otra persona.
 *
 * Caso real que motivó esto: usuarios con rol Embajador y `usuarios.id_persona` en NULL.
 * El portal no los podía ligar a su registro y caía en el primer embajador de la lista,
 * registrando los referidos a su nombre y atribuyéndole la comisión a quien no
 * correspondía. RLS lo bloqueaba con un 403 que no explicaba la causa.
 *
 * Se comparan NOMBRES y no ids a propósito: los ids de rol no son estables entre dev y
 * prod, y el flujo de equipo de banco ya resuelve sus roles por nombre.
 */

const ROLES_REQUIEREN_PERSONA = [
  'embajador',
  'agente inmobiliario',
  'inmobiliaria',
  'operador banco',
  'supervisor banco',
];

/** Minusculas y sin espacios, para comparar sin importar como este escrito el rol. */
function normaliza(valor: string): string {
  return valor.trim().toLowerCase();
}

/** ¿El rol exige que el usuario esté ligado a una persona? */
export function rolRequierePersona(nombreRol?: string | null): boolean {
  if (!nombreRol) return false;
  return ROLES_REQUIEREN_PERSONA.includes(normaliza(nombreRol));
}

/** Mensaje único, para que se vea lo mismo desde cualquier pantalla de alta. */
export function mensajeFaltaPersona(nombreRol: string): string {
  return (
    `El rol "${nombreRol}" trabaja con reglas de acceso por dueño del registro, ` +
    `así que el usuario debe quedar ligado a una persona. ` +
    `Selecciona una persona existente o créala antes de dar de alta la cuenta.`
  );
}
