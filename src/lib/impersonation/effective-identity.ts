import type { EffectiveIdentityInput, ImpersonationTarget, ImpersonationViewMode } from './types';

/**
 * Núcleo de la impersonación. Funciones PURAS, sin React ni Supabase, para que
 * el comportamiento quede cubierto por tests en Node antes de migrar cada portal.
 *
 * Contrato de compatibilidad (lo que NO debe cambiar al migrar lo legacy):
 *   1. Sin impersonación → todo se resuelve con el perfil logueado, igual que hoy.
 *   2. Impersonando en "Vista completa" → también con el perfil logueado (modo soporte).
 *   3. Impersonando en "Vista fiel" → con el rol del impersonado.
 *   4. Si el portal aún no publica el `rolId` del impersonado (legacy), se cae al
 *      perfil logueado: migrar un portal a medias nunca apaga menús por accidente.
 */

const SUPER_ADMIN_ROLE_NAME = 'Super Administrador';
export const SUPER_ADMIN_ROLE_ID = 1;

/** ¿La vista fiel está realmente activa? Requiere impersonado Y modo fiel. */
export function isFielViewActive(
  target: ImpersonationTarget | null,
  viewMode: ImpersonationViewMode
): boolean {
  return viewMode === 'fiel' && !!target?.email;
}

/**
 * ¿Se resuelven permisos con el rol del impersonado? Solo si la vista fiel está
 * activa Y el portal publicó su `rolId`. Sin `rolId` no hay nada que simular.
 */
export function usesTargetRole(
  target: ImpersonationTarget | null,
  viewMode: ImpersonationViewMode
): boolean {
  return isFielViewActive(target, viewMode) && typeof target?.rolId === 'number';
}

/** Rol con el que hay que consultar `submenus_permisos`. */
export function resolveEffectiveRolId(input: EffectiveIdentityInput): number | null {
  const { profileRolId, target, viewMode } = input;
  if (usesTargetRole(target, viewMode)) return target!.rolId!;
  return profileRolId ?? null;
}

/** Persona efectiva: al impersonar SIEMPRE es la del impersonado (en ambos modos),
 *  porque los datos que se ven en pantalla son los suyos, no los del admin. */
export function resolveEffectivePersonaId(input: EffectiveIdentityInput): number | null {
  const { profilePersonaId, target } = input;
  if (target?.email) return target.personaId ?? null;
  return profilePersonaId ?? null;
}

/**
 * ¿El usuario ve el portal COMPLETO, sin los recortes que aplican al usuario real?
 * Lo ven Super Admin y los roles con `puede_impersonar`... salvo en vista fiel,
 * que es justo el modo para comprobar qué ve el otro.
 */
export function resolveFullAccess(input: EffectiveIdentityInput): boolean {
  const { profileRolNombre, puedeImpersonar, target, viewMode } = input;
  if (isFielViewActive(target, viewMode)) return false;
  return profileRolNombre === SUPER_ADMIN_ROLE_NAME || puedeImpersonar === true;
}

/**
 * ¿Se aplica el atajo "Super Admin ve todo" al resolver permisos? En vista fiel
 * depende del impersonado (por id o por nombre de rol, según lo que publique el
 * portal), no del admin.
 */
export function resolveIsSuperAdminView(input: EffectiveIdentityInput): boolean {
  const { profileRolNombre, target, viewMode } = input;
  if (isFielViewActive(target, viewMode)) {
    if (typeof target?.rolId === 'number') return target.rolId === SUPER_ADMIN_ROLE_ID;
    if (target?.rolNombre) return target.rolNombre === SUPER_ADMIN_ROLE_NAME;
    // Portal legacy sin rol publicado: se conserva el comportamiento de hoy.
    return profileRolNombre === SUPER_ADMIN_ROLE_NAME;
  }
  return profileRolNombre === SUPER_ADMIN_ROLE_NAME;
}
