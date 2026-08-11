/**
 * Construcción de los links de la oferta digital.
 *
 * La oferta pública SIEMPRE vive en un host propio (`ofertas.sozu.com`, o
 * `ofertas-dev.sozu.com` fuera de producción). Antes cada pantalla armaba el link
 * con `window.location.origin`, así que el host dependía de DÓNDE se generó la
 * oferta: desde el Portal de Agentes salía `https://agentes.sozu.com/oferta/...`,
 * y ese host NO monta las rutas `/oferta/*` (ver el árbol de agentes en App.tsx) —
 * el catch-all lo rebota a la landing y el cliente nunca ve su oferta.
 *
 * Por eso el origin es fijo y no se deriva de la ubicación actual: el link que se
 * copia, se manda por WhatsApp/correo o se abre en una pestaña es el mismo sin
 * importar el portal desde el que se emitió. Única excepción: en local se usa el
 * origin actual, porque no hay host de ofertas al que apuntar.
 */
import { IS_PRODUCTION } from "@/lib/portalUrls";

/** Host canónico de la oferta pública. */
export const OFFERS_ORIGIN = `https://ofertas${IS_PRODUCTION ? "" : "-dev"}.sozu.com`;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

const isLocalHostname = (hostname: string): boolean =>
  LOCAL_HOSTNAMES.has(hostname) ||
  hostname.endsWith(".local") ||
  // Red local del `vite --host` (10.x / 192.168.x) para probar desde el celular.
  /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(hostname);

/** Origin al que deben apuntar los links de oferta que salen de la app. */
export function offersOrigin(): string {
  if (typeof window === "undefined") return OFFERS_ORIGIN;
  return isLocalHostname(window.location.hostname) ? window.location.origin : OFFERS_ORIGIN;
}

/** `1234` → `O-001234`. Si ya viene con folio (`O-001234`), se respeta. */
export function offerSlug(offerId: string | number): string {
  const raw = String(offerId ?? "").trim();
  return /^\d+$/.test(raw) ? `O-${raw.padStart(6, "0")}` : raw;
}

/** Ruta interna de la oferta (sin host): `/oferta/O-001234[/<token>]`. */
export function offerPath(offerId: string | number, token?: string | null): string {
  const base = `/oferta/${offerSlug(offerId)}`;
  return token ? `${base}/${token}` : base;
}

/**
 * Link absoluto de la oferta en el host de ofertas.
 *
 * @param token `reservaciones.token` (uuid). Con token es el link personal del
 *   cliente — el único que permite apartar. Sin token es la versión demo.
 */
export function buildOfferUrl(offerId: string | number, token?: string | null): string {
  return `${offersOrigin()}${offerPath(offerId, token)}`;
}
