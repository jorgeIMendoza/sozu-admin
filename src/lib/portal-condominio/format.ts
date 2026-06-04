// Utilidades de formato compartidas por el Portal Condominio (datos reales).

export function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n || 0);
}

// Devuelve la fecha de hoy en formato YYYY-MM-DD (comparable como string ISO).
export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Normaliza una fecha de Postgres (date o timestamptz) a YYYY-MM-DD.
export function fechaISO(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// "2025-06-01" -> "Jun 2025"
export function etiquetaMes(iso: string): string {
  const [y, m] = iso.split("-");
  const idx = Number(m) - 1;
  return `${MESES_ES[idx] ?? m} ${y}`;
}
