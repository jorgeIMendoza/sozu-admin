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

/**
 * La RPC no existe en este ambiente: el front va adelante del DDL.
 *
 * PostgREST responde `PGRST202` con "Could not find the function public.x(args) in the schema
 * cache"; Postgres responde `42883` ("function ... does not exist") cuando sí llega a ejecutar.
 * Se checan los dos códigos y, como red de seguridad, el texto — PostgREST cambia la redacción
 * entre versiones.
 *
 * Sirve para degradar con un aviso claro en vez de escupir el error crudo al usuario.
 */
export const esRpcInexistente = (e: unknown): boolean => {
  if (!e || typeof e !== 'object') return false;
  const { code, message } = e as { code?: string; message?: string };
  if (code === 'PGRST202' || code === '42883') return true;
  const texto = (message ?? '').toLowerCase();
  return texto.includes('could not find the function')
    || texto.includes('schema cache')
    || texto.includes('does not exist');
};

/** `retry` de React Query que no insiste cuando el problema es de permisos. */
export const retrySalvoSinPermiso = (intentos: number, error: unknown): boolean =>
  !esSinPermiso(error) && intentos < 2;
