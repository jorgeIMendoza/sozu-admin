/** Utilidades de formato numérico del módulo Precios. */

export function formatoMoneda(valor: number): string {
  return `$${valor.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatoM2(valor: number): string {
  return `${valor.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m²`;
}

export function formatoPorcentaje(valor: number, decimales = 1): string {
  const signo = valor > 0 ? "+" : valor < 0 ? "−" : "";
  return `${signo}${Math.abs(valor).toFixed(decimales)}%`;
}

export function formatoMultiplicador(valor: number): string {
  return valor.toFixed(4);
}

export function formatoFecha(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 14/08/2026 22:41:05 */
export function formatoFechaHora(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 14/08/2026 */
export function formatoFechaCorta(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "en 8 días", "hoy", "hace 2 días" */
export function tiempoRestante(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const dias = Math.round(ms / 86400000);
  if (dias === 0) return "vence hoy";
  if (dias > 0) return `en ${dias} día${dias === 1 ? "" : "s"}`;
  const d = Math.abs(dias);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}
