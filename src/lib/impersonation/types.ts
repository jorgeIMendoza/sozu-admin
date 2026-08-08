/**
 * Tipos del núcleo de impersonación. Cerrado a modificación: los portales no
 * agregan campos aquí, publican su target y registran sus reglas.
 */

/** Modo de vista al impersonar. Ver `ImpersonationViewModeContext`. */
export type ImpersonationViewMode = 'completa' | 'fiel';

/** Usuario impersonado, tal como lo publica cada portal. */
export interface ImpersonationTarget {
  email: string | null;
  personaId: number | null;
  nombre: string | null;
  /** `usuarios.rol_id`. Null en los portales que aún no lo publican (legacy). */
  rolId: number | null;
  /** `roles.nombre`. Opcional; algunos contextos solo guardan el nombre. */
  rolNombre?: string | null;
}

/** Entrada de la resolución de identidad efectiva. */
export interface EffectiveIdentityInput {
  /** Rol del usuario REALMENTE logueado (`usuarios.rol_id`). */
  profileRolId: number | null | undefined;
  profileRolNombre: string | null | undefined;
  profilePersonaId?: number | null;
  puedeImpersonar?: boolean | null;
  /** Null cuando no se está impersonando. */
  target: ImpersonationTarget | null;
  viewMode: ImpersonationViewMode;
}

/** Recortes que una regla puede imponer sobre la vista. */
export interface ViewRestrictions {
  /** Rutas que no se pintan en el menú. */
  hiddenPaths: string[];
  /** Campos/bloques en solo lectura → nota de quién los administra. */
  readOnly: Record<string, string>;
}

/** Contexto que recibe una regla para decidir. */
export interface ViewRuleContext<F = unknown> {
  /** Ruta actual (para acotar por portal). */
  pathname: string;
  viewMode: ImpersonationViewMode;
  isImpersonating: boolean;
  /** ¿El usuario ve el portal completo (Super Admin / puede_impersonar)? */
  fullAccess: boolean;
  target: ImpersonationTarget | null;
  /** Datos que la propia regla declaró necesitar. */
  facts: F;
}

/**
 * Punto de extensión. Una regla nueva = un archivo nuevo + su import en
 * `rules/index.ts`. Nunca se edita el núcleo.
 */
export interface ViewRule<F = unknown> {
  id: string;
  /** Prefijo de ruta donde aplica (p. ej. `/admin/agent`). Vacío = global. */
  scope?: string;
  /** Devuelve los recortes, o `null` si la regla no aplica en este contexto. */
  evaluate: (ctx: ViewRuleContext<F>) => Partial<ViewRestrictions> | null;
}
