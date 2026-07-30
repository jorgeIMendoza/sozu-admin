/**
 * Errores de RPC que el front debe distinguir del resto.
 *
 * Las RPC del portal de cobranza validan permisos por dentro (mismo catálogo que
 * `usePermissions`) y lanzan ERRCODE 42501 cuando el rol no tiene `leer` en el submenú
 * correspondiente. PostgREST lo devuelve como HTTP 403 con `error.code === '42501'`.
 *
 * No es una lista vacía ni un error genérico: hay que mostrar "sin permiso" y NO reintentar.
 */
export const esSinPermiso = (e: unknown): boolean =>
  !!e && typeof e === 'object' && (e as { code?: string }).code === '42501';

/** `retry` de React Query que no insiste cuando el problema es de permisos. */
export const retrySalvoSinPermiso = (intentos: number, error: unknown): boolean =>
  !esSinPermiso(error) && intentos < 2;
