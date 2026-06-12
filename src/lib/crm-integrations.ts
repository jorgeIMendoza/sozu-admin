// Integration types and helpers (ported from sozu-crm)

export type ConnectorStatus =
  | "disconnected"
  | "mock"
  | "sandbox_ready"
  | "dry_run_ready"
  | "encryption_pending"
  | "secrets_configured"
  | "read_only_ready"
  | "read_only_connected"
  | "read_only_error"
  | "connected_test"
  | "connected_live"
  | "error";

export type ConnectorMode = "mock" | "sandbox" | "dry_run" | "read_only" | "test" | "live";

export const STATUS_LABEL: Record<ConnectorStatus, string> = {
  disconnected: "Sin conectar",
  mock: "Mock",
  sandbox_ready: "Sandbox listo",
  dry_run_ready: "Dry-run listo",
  encryption_pending: "Cifrado pendiente",
  secrets_configured: "Secrets configurados",
  read_only_ready: "Read-only listo",
  read_only_connected: "Read-only conectado",
  read_only_error: "Read-only error",
  connected_test: "Conectado · test",
  connected_live: "Conectado · live",
  error: "Error",
};

export const STATUS_TONE: Record<ConnectorStatus, string> = {
  disconnected: "bg-muted text-muted-foreground",
  mock: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  sandbox_ready: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  dry_run_ready: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  encryption_pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  secrets_configured: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  read_only_ready: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  read_only_connected: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  read_only_error: "bg-red-500/15 text-red-700 dark:text-red-400",
  connected_test: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  connected_live: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  error: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export const CATEGORY_LABEL: Record<string, string> = {
  ads: "Plataformas Ads",
  conversions: "Conversiones",
  webhooks: "Webhooks",
  analytics: "Analytics",
  ai: "AI / LLM",
  other: "Otros",
};

export type Connector = {
  id: string;
  organization_id: string;
  connector_key: string;
  display_name: string;
  category: string;
  status: ConnectorStatus;
  mode: ConnectorMode;
  required_credentials: string[];
  checklist: string[];
  non_secret_config: Record<string, unknown>;
  last_test_at: string | null;
  last_error: string | null;
  encryption_status: "pending" | "encrypted" | "plaintext_placeholder" | "not_applicable";
};

export function redactSecret(value: unknown): string {
  if (value == null) return "—";
  const s = String(value);
  if (s.length <= 8) return "•".repeat(s.length);
  return `${s.slice(0, 4)}••••${s.slice(-2)}`;
}

export function redactPayload(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(redactPayload);
  const SENSITIVE = /(token|secret|api[_-]?key|password|access[_-]?token|refresh[_-]?token|authorization|bearer|signature|verify[_-]?token)/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE.test(k)) out[k] = redactSecret(v);
    else if (v && typeof v === "object") out[k] = redactPayload(v);
    else out[k] = v;
  }
  return out;
}
