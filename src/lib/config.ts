// Centralized configuration constants

/**
 * Validates that an env variable exists and is non-empty, with optional fallback.
 */
function requireEnv(name: string, value: unknown, fallback?: string): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  if (fallback) {
    return fallback.trim();
  }
  throw new Error(
    `[config] Falta la variable de entorno requerida: ${name}. ` +
    `Verifica tu archivo .env / .env.production / .env.development.`
  );
}

/**
 * Validates that a string looks like a valid http(s) URL, with optional fallback.
 */
function requireUrl(name: string, value: unknown, fallback?: string): string {
  const v = requireEnv(name, value, fallback);
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
 * Validates that a string looks like a JWT (3 base64url segments separated by dots), with optional fallback.
 */
function requireJwt(name: string, value: unknown, fallback?: string): string {
  const v = requireEnv(name, value, fallback);
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
  import.meta.env.VITE_SUPABASE_PROJECT_ID,
  'supabase-dev'
);
export const SUPABASE_URL = requireUrl(
  'VITE_SUPABASE_URL',
  import.meta.env.VITE_SUPABASE_URL,
  'https://supabase-dev.sozu.com'
);
export const SUPABASE_PUBLISHABLE_KEY = requireJwt(
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
);

// N8N Webhook Configuration (required)
export const N8N_WEBHOOK_BASE_URL = requireUrl(
  'VITE_N8N_WEBHOOK_BASE_URL',
  import.meta.env.VITE_N8N_WEBHOOK_BASE_URL,
  'https://n8n-dev.sozu.com/webhook'
);

// Environment Configuration (optional, defaults to 'preview')
export const ENVIRONMENT = (import.meta.env.VITE_ENVIRONMENT || 'preview').trim();

// App Version (injected at build time)
export const APP_VERSION = `v${__APP_VERSION__}-${__BUILD_TIMESTAMP__}`;