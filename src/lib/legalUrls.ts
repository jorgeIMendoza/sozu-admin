/**
 * Páginas legales públicas de SOZU (viven en el sitio corporativo, no en este
 * repo: se enlazan para no mantener dos versiones del mismo texto legal).
 *
 * Verificadas con HTTP 200 el 2026-07-28. No existe una página específica de
 * cookies: el sitio cubre ese tema en la Política de datos.
 */
export const LEGAL_URLS = {
  avisoPrivacidad: 'https://www.sozu.com/aviso-de-privacidad',
  terminos: 'https://www.sozu.com/terminos-y-condiciones',
  politicaDatos: 'https://www.sozu.com/politica-de-datos',
} as const;

export type LegalKey = keyof typeof LEGAL_URLS;

export const LEGAL_LABELS: Record<LegalKey, string> = {
  avisoPrivacidad: 'Aviso de privacidad',
  terminos: 'Términos y condiciones',
  politicaDatos: 'Política de datos',
};

/** Los tres enlaces en el orden en que se muestran en los pies de página. */
export const LEGAL_LINKS: { key: LegalKey; label: string; href: string }[] = (
  Object.keys(LEGAL_URLS) as LegalKey[]
).map((key) => ({ key, label: LEGAL_LABELS[key], href: LEGAL_URLS[key] }));
