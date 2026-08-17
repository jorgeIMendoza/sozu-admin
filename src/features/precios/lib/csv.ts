/** Exportación a CSV compatible con Excel en español (UTF-8 con BOM). */

function escapar(valor: string | number): string {
  const s = String(valor ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function descargarCSV(
  nombreArchivo: string,
  encabezados: string[],
  filas: Array<Array<string | number>>,
): void {
  const lineas = [
    encabezados.map(escapar).join(";"),
    ...filas.map((f) => f.map(escapar).join(";")),
  ];
  // BOM UTF-8 para que Excel respete acentos y el signo de m².
  const contenido = "\uFEFF" + lineas.join("\r\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
