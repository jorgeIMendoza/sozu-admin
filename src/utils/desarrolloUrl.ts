// URL pública de un desarrollo en el sitio web SOZU.
// Formato: https://www.sozu.com/desarrollo/<slug>/  (slug = nombre del proyecto)

export function desarrolloSlug(nombre: string): string {
  return (nombre || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function desarrolloUrl(nombre: string): string {
  return `https://www.sozu.com/desarrollo/${desarrolloSlug(nombre)}/`;
}
