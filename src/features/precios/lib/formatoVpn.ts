/** Formatos específicos del motor de valor presente. */

/** 0.3 -> "30.00%" */
export function pct2(valor: number): string {
  return `${(valor * 100).toFixed(2)}%`;
}

/** 0.015 -> "+1.50%" ; -0.05 -> "−5.00%" */
export function pctFirmado(valor: number): string {
  const signo = valor > 0 ? "+" : valor < 0 ? "−" : "";
  return `${signo}${Math.abs(valor * 100).toFixed(2)}%`;
}

/** 0.9429 -> "0.9429" */
export function factor4(valor: number): string {
  return valor.toFixed(4);
}

/** Puntos porcentuales de brecha: -0.0336 -> "−3.36 pts" */
export function puntos(valor: number): string {
  const signo = valor > 0 ? "+" : valor < 0 ? "−" : "";
  return `${signo}${Math.abs(valor * 100).toFixed(2)} pts`;
}

/** Color de chip según la magnitud de la brecha en puntos porcentuales. */
export function claseBrecha(valor: number): string {
  const pts = Math.abs(valor * 100);
  if (pts <= 0.5) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (pts <= 1.5) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}
