/**
 * Autorización de rutas de portal — núcleo puro consumido por `PermissionRoute`.
 *
 * Por qué existe
 * --------------
 * `PermissionRoute` tenía un `if` escrito a mano por cada portal, y cada uno
 * repetía el mismo bucle sobre `allowedPaths`. Copiar el bloque anterior era el
 * flujo normal para agregar un portal nuevo, y bastaba olvidar el bucle para
 * dejar un gate que ignoraba la base de datos: el submenú aparecía en el
 * sidebar (porque el sidebar sí lee `submenus_permisos`) pero la ruta devolvía
 * 403. Eso fue exactamente lo que pasó con `/admin/portal-embajador`, cuyo gate
 * solo aceptaba rol_id 1/2/23, los nombres 'Embajador'/'Cliente' y una fila en
 * `user_roles`: cualquier otro rol con permiso de lectura en BD (p. ej. Admin
 * Soporte, rol 30) veía el menú y chocaba con "Acceso Denegado".
 *
 * Aquí la autorización es una TABLA declarativa (`PORTAL_GATES`) y una sola
 * función (`decidePortalAccess`). El permiso en BD es siempre una condición
 * suficiente, así que un portal nuevo se autoriza correctamente con solo
 * agregar su prefijo a la tabla, y los tests recorren la tabla completa para
 * garantizar que ningún gate vuelva a ignorar la BD.
 *
 * Patrón "coarse"
 * ---------------
 * Muchas rutas de portal (`expediente/:id`, `cases/:id`, `bandeja-ejecucion`,
 * las pestañas de Precios…) no tienen submenú propio y nunca aparecen en
 * `allowedPaths`. Por eso basta tener permiso de lectura sobre CUALQUIER
 * submenú bajo el prefijo del portal para habilitar todas sus rutas.
 */

/** Roles de banco detectados por NOMBRE: sus ids difieren entre ambientes. */
export const isRolDeBanco = (rolNombre: string | null | undefined): boolean => {
  const n = (rolNombre ?? '').trim().toLowerCase();
  return n === 'banco' || n.startsWith('operador banco') || n.startsWith('supervisor banco');
};

export interface PortalGate {
  /** Prefijo de ruta que cubre este gate. */
  prefix: string;
  /**
   * rol_id que entran SIN fila en `submenus_permisos`. Son bypass históricos:
   * varios roles de portal dependen de ellos y pueden no tener permisos propios
   * en algún ambiente. Nunca son la única vía de entrada — el permiso en BD
   * también alcanza.
   */
  rolesBypass?: number[];
  /** Igual que `rolesBypass` pero por rol_nombre (ids que varían por ambiente). */
  nombresBypass?: string[];
  /**
   * Rutas de administración del portal que exigen permiso de lectura EXACTO
   * sobre esa vista en BD, sin coarse ni bypass por rol.
   */
  adminPaths?: string[];
  /**
   * true si el gate acepta además la señal de `useHasEmbajadorRole`
   * (rol dual vía `user_roles`, sin cambiar el rol principal del usuario).
   */
  aceptaRolEmbajadorDual?: boolean;
}

/**
 * OJO: agregar un portal aquí es lo único necesario para que su permiso en BD
 * funcione. No volver a escribir gates a mano en `PermissionRoute`.
 */
export const PORTAL_GATES: PortalGate[] = [
  { prefix: '/admin/portal-estructura-comisiones', rolesBypass: [1, 2] },
  { prefix: '/admin/portal-productos', rolesBypass: [1, 2] },
  { prefix: '/admin/portal-tickets', rolesBypass: [1, 2] },
  { prefix: '/admin/portal-personal', rolesBypass: [1, 2] },
  {
    // El rol Cliente (23) entra por rol, sin fila en `user_roles`: todo cliente
    // puede referir con su misma cuenta.
    prefix: '/admin/portal-embajador',
    rolesBypass: [1, 2, 23],
    nombresBypass: ['Embajador', 'Cliente'],
    aceptaRolEmbajadorDual: true,
  },
  // Módulo de Precios: el submenú registrado es '/admin/inventario/precios',
  // pero sus pestañas reales (tabla, motor, calibracion, escenarios/*,
  // auditoria/*) no tienen submenú propio.
  { prefix: '/admin/inventario/precios' },
  { prefix: '/admin/portal-administracion' },
  { prefix: '/admin/legal-flow' },
  { prefix: '/admin/portal-cobranza' },
  { prefix: '/admin/portal-escrituracion' },
  { prefix: '/admin/portal-condominio' },
  { prefix: '/admin/portal-crm' },
  { prefix: '/admin/portal-socio-bancario' },
  {
    prefix: '/admin/portal-bancos',
    nombresBypass: ['Banco'],
    adminPaths: ['/admin/portal-bancos/equipo', '/admin/portal-bancos/bancos'],
  },
];

export interface PortalAccessContext {
  rolId: number | null | undefined;
  rolNombre: string | null | undefined;
  /** `allowedPaths` de `useAllowedMenus`. Para Super Admin es el wildcard {'*'}. */
  allowedPaths: Set<string>;
  isSuperAdmin: boolean;
  /** `useHasEmbajadorRole`: null mientras consulta `user_roles`. */
  hasEmbajadorRole: boolean | null;
}

/**
 * 'allow'   → renderizar la ruta.
 * 'deny'    → mandar a /admin/access-denied.
 * 'pending' → falta una señal asíncrona; mostrar spinner, no juzgar todavía.
 * null      → la ruta no pertenece a ningún gate; sigue el flujo normal.
 */
export type PortalAccessDecision = 'allow' | 'deny' | 'pending' | null;

/** ¿Hay algún permiso de lectura bajo `prefix`? (`allowedPaths` es un Set: iterar.) */
export function tieneAccesoBajo(allowedPaths: Set<string>, prefix: string): boolean {
  for (const p of allowedPaths) {
    if (p.startsWith(prefix)) return true;
  }
  return false;
}

/** Gate más específico que cubre la ruta (prefijo más largo gana). */
export function findPortalGate(pathname: string): PortalGate | null {
  let mejor: PortalGate | null = null;
  for (const gate of PORTAL_GATES) {
    if (!pathname.startsWith(gate.prefix)) continue;
    if (!mejor || gate.prefix.length > mejor.prefix.length) mejor = gate;
  }
  return mejor;
}

export function decidePortalAccess(
  pathname: string,
  ctx: PortalAccessContext,
): PortalAccessDecision {
  const gate = findPortalGate(pathname);
  if (!gate) return null;

  // Super Admin ya pasó el gate de vistas apagadas en PermissionRoute; su
  // allowedPaths es el wildcard {'*'} y no haría match por prefijo.
  if (ctx.isSuperAdmin) return 'allow';

  // Administración del portal: permiso EXPLÍCITO sobre esa vista, sin coarse.
  const adminPath = gate.adminPaths?.find((p) => pathname.startsWith(p));
  if (adminPath) {
    return ctx.allowedPaths.has(adminPath) ? 'allow' : 'deny';
  }

  // El permiso en BD es SIEMPRE suficiente: es la señal que pinta el menú, así
  // que si el sidebar lo muestra, la ruta tiene que abrir.
  if (tieneAccesoBajo(ctx.allowedPaths, gate.prefix)) return 'allow';

  if (gate.rolesBypass?.includes(ctx.rolId ?? -1)) return 'allow';
  if (gate.nombresBypass?.includes(ctx.rolNombre ?? '')) return 'allow';

  if (gate.aceptaRolEmbajadorDual) {
    if (ctx.hasEmbajadorRole === null) return 'pending';
    if (ctx.hasEmbajadorRole) return 'allow';
  }

  return 'deny';
}
