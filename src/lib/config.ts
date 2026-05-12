// Centralized configuration constants

/**
 * Validates that a required env variable exists and is non-empty.
 */
function requireEnv(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `[config] Falta la variable de entorno requerida: ${name}. ` +
      `Verifica tu archivo .env / .env.production / .env.development.`
    );
  }
  return value.trim();
}

/**
 * Validates that a string looks like a valid http(s) URL.
 */
function requireUrl(name: string, value: unknown): string {
  const v = requireEnv(name, value);
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('protocolo inválido');
    }
  } catch {
    throw new Error(
      `[config] La variable ${name} no es una URL válida (http/https): "${v}"`
    );
  }
  return v;
}

/**
 * Validates that a string looks like a JWT (3 base64url segments separated by dots).
 */
function requireJwt(name: string, value: unknown): string {
  const v = requireEnv(name, value);
  const jwtRegex = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  if (!jwtRegex.test(v)) {
    throw new Error(
      `[config] La variable ${name} no tiene formato JWT válido (esperado: header.payload.signature).`
    );
  }
  return v;
}

// Supabase Configuration (required)
export const SUPABASE_PROJECT_ID = requireEnv(
  'VITE_SUPABASE_PROJECT_ID',
  import.meta.env.VITE_SUPABASE_PROJECT_ID
);
export const SUPABASE_URL = requireUrl(
  'VITE_SUPABASE_URL',
  import.meta.env.VITE_SUPABASE_URL
);
export const SUPABASE_PUBLISHABLE_KEY = requireJwt(
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

// N8N Webhook Configuration (required)
export const N8N_WEBHOOK_BASE_URL = requireUrl(
  'VITE_N8N_WEBHOOK_BASE_URL',
  import.meta.env.VITE_N8N_WEBHOOK_BASE_URL
);

// Environment Configuration (optional, defaults to 'development')
export const ENVIRONMENT = (import.meta.env.VITE_ENVIRONMENT || 'development').trim();

// App Version (injected at build time)
export const APP_VERSION = `v${__APP_VERSION__}-${__BUILD_TIMESTAMP__}`;