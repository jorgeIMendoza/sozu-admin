// Centralized portal host resolution.
// In production uses {portal}.sozu.com; otherwise uses {portal}-dev.sozu.com.

import { ENVIRONMENT } from './config';

export type PortalKey = 'admin' | 'agentes' | 'inmobiliarias' | 'clientes';

export const IS_PRODUCTION = ENVIRONMENT.toLowerCase() === 'production';

export function getPortalHost(portal: PortalKey): string {
  const suffix = IS_PRODUCTION ? '' : '-dev';
  return `https://${portal}${suffix}.sozu.com`;
}

export function getPortalLoginUrl(portal: PortalKey): string {
  // El portal de clientes/inmobiliarias usa /auth/login; agentes usa /login (landing actual).
  // Mantenemos /auth/login como default (consistente con ConfirmacionEmail).
  return `${getPortalHost(portal)}/auth/login`;
}

export function getPortalChangePasswordUrl(portal: PortalKey): string {
  return `${getPortalHost(portal)}/auth/change-password`;
}