// Centralized portal host resolution.
// In production uses {portal}.sozu.com; otherwise uses {portal}-dev.sozu.com.

import { ENVIRONMENT } from './config';

export type PortalKey = 'admin' | 'agentes' | 'inmobiliarias' | 'clientes' | 'embajadores' | 'bancos';

export const IS_PRODUCTION = ENVIRONMENT.toLowerCase() === 'production';

export function getPortalHost(portal: PortalKey): string {
  const suffix = IS_PRODUCTION ? '' : '-dev';
  return `https://${portal}${suffix}.sozu.com`;
}

// ---------------------------------------------------------------------------
// Detección del subdominio actual.
//
// La app es un solo bundle servido en todos los hosts: App.tsx decide en runtime
// qué árbol de <Routes> montar según el hostname. Antes esa detección vivía
// inline en App.tsx; se centraliza aquí porque también la necesitan
// useCanReturnToAdmin (para ocultar el botón de volver al admin) y
// computePortalHostAccess (para el gate de "sin acceso a este portal").
//
// Solo se listan los subdominios que montan rutas /admin. `registro` y
// `propietarios` quedan fuera a propósito: sus árboles no tienen /admin.
// ---------------------------------------------------------------------------

export const PORTAL_SUBDOMAIN_KEYS = [
  'agentes',
  'inmobiliarias',
  'clientes',
  'embajadores',
  'bancos',
] as const;
export type PortalSubdomain = (typeof PORTAL_SUBDOMAIN_KEYS)[number];

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

/** Match de host de portal, tanto producción (`x.sozu.com`) como dev (`x-dev.sozu.com`). */
export const matchPortalHost = (portal: string): boolean =>
  hostname === `${portal}.sozu.com` || hostname === `${portal}-dev.sozu.com`;

/** Subdominio de portal actual, o null en admin.sozu.com / localhost / cualquier host desconocido. */
export const CURRENT_PORTAL_SUBDOMAIN: PortalSubdomain | null =
  PORTAL_SUBDOMAIN_KEYS.find((p) => matchPortalHost(p)) ?? null;

export const IS_PORTAL_SUBDOMAIN = CURRENT_PORTAL_SUBDOMAIN !== null;

/** Prefijo de ruta que atiende cada subdominio de portal (ver los árboles de App.tsx). */
export const PORTAL_ROUTE_PREFIX: Record<PortalSubdomain, string> = {
  agentes: '/admin/agent',
  inmobiliarias: '/admin/portal-inmobiliaria',
  clientes: '/admin/portal-cliente',
  embajadores: '/admin/portal-embajador',
  bancos: '/admin/portal-bancos',
};

export const PORTAL_LABELS: Record<PortalSubdomain, string> = {
  agentes: 'Portal de Agentes',
  inmobiliarias: 'Portal de Inmobiliarias',
  clientes: 'Portal de Clientes',
  embajadores: 'Portal de Embajadores',
  bancos: 'Portal de Bancos',
};

export function getPortalLoginUrl(portal: PortalKey): string {
  // El portal de clientes/inmobiliarias usa /auth/login; agentes usa /login (landing actual).
  // Mantenemos /auth/login como default (consistente con ConfirmacionEmail).
  return `${getPortalHost(portal)}/auth/login`;
}

export function getPortalChangePasswordUrl(portal: PortalKey): string {
  return `${getPortalHost(portal)}/auth/change-password`;
}