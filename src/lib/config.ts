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

const localDevelopmentEnv: Record<string, string> = import.meta.env.DEV
  ? __LOCAL_DEVELOPMENT_ENV__
  : {};

function getPreferredEnv(name: string, runtimeValue: unknown): unknown {
  const localValue = localDevelopmentEnv[name];
  if (typeof localValue === 'string' && localValue.trim() !== '') {
    return localValue;
  }

  return runtimeValue;
}

// Supabase Configuration (required)
export const SUPABASE_PROJECT_ID = requireEnv(
  'VITE_SUPABASE_PROJECT_ID',
  getPreferredEnv('VITE_SUPABASE_PROJECT_ID', import.meta.env.VITE_SUPABASE_PROJECT_ID),
  'supabase-dev'
);
export const SUPABASE_URL = requireUrl(
  'VITE_SUPABASE_URL',
  getPreferredEnv('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  'https://supabase-dev.sozu.com'
);
export const SUPABASE_PUBLISHABLE_KEY = requireJwt(
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  getPreferredEnv('VITE_SUPABASE_PUBLISHABLE_KEY', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2BBNWN8Bu4GE'
);

// N8N Webhook Configuration (required)
export const N8N_WEBHOOK_BASE_URL = requireUrl(
  'VITE_N8N_WEBHOOK_BASE_URL',
  getPreferredEnv('VITE_N8N_WEBHOOK_BASE_URL', import.meta.env.VITE_N8N_WEBHOOK_BASE_URL),
  'https://n8n-dev.sozu.com/webhook'
);

// Environment Configuration (optional, defaults to 'preview')
export const ENVIRONMENT = String(
  getPreferredEnv('VITE_ENVIRONMENT', import.meta.env.VITE_ENVIRONMENT) || 'preview'
).trim();

// App Version (injected at build time)
export const APP_VERSION = `v${__APP_VERSION__}-${__BUILD_TIMESTAMP__}`;

// Brand assets — served from Supabase Storage with WebP conversion (no quality reduction).
export const SOZU_LOGO_URL = "https://tzmhgfjmddkfyffkkmto.supabase.co/storage/v1/render/image/public/imagenes_generales/sozu_logo.png?quality=90&format=webp";

// Production Edge Functions — always points to Supabase Cloud regardless of environment.
// Used for functions not deployed in self-hosted dev (e.g. generar-recibo-pago).
export const PROD_FUNCTIONS_BASE_URL = "https://tzmhgfjmddkfyffkkmto.supabase.co/functions/v1";
export const PROD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bWhnZmptZGRrZnlmZmtrbXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNTU0NDUsImV4cCI6MjA3MjkzMTQ0NX0.8DaFtWO6zyJg14jFo_Zm2idYKwI-mvfmUtlixG2JDSE";
