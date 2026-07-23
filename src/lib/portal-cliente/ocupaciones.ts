/**
 * Catálogo curado de ocupaciones laborales para el portal del cliente.
 *
 * `personas.ocupacion` es una columna de texto libre con datos históricos sin
 * normalizar (mayúsculas, acentos faltantes, variantes). Este catálogo alimenta
 * el dropdown del perfil para capturar valores canónicos (Title Case, con
 * acentos). Para valores fuera de la lista se usa la opción "Otro" + texto libre,
 * que igualmente se normaliza con `normalizarOcupacion`.
 */

export const OCUPACIONES: string[] = [
  "Abogado/a",
  "Administrador/a",
  "Agricultor/a",
  "Ama de casa",
  "Arquitecto/a",
  "Asalariado/a",
  "Comerciante",
  "Consultor/a",
  "Contador/a público/a",
  "Dentista",
  "Diseñador/a",
  "Docente",
  "Director/a",
  "Empleado/a",
  "Empleado/a privado/a",
  "Empresario/a",
  "Enfermero/a",
  "Estudiante",
  "Ingeniero/a",
  "Independiente",
  "Jubilado/a",
  "Médico/a",
  "Negocio propio",
  "Pensionado/a",
  "Profesionista",
  "Profesor/a",
  "Servidor/a público/a",
  "Transportista",
  "Ventas",
];

/** Opciones para el SearchSelect (incluye "Otro" al final). */
export const OCUPACIONES_OPCIONES: { nombre: string }[] = [
  ...OCUPACIONES.map((nombre) => ({ nombre })),
  { nombre: "Otro" },
];

/**
 * Normaliza una ocupación de texto libre: recorta, colapsa espacios y pasa a
 * Title Case (primera letra de cada palabra en mayúscula, resto minúscula),
 * respetando conectores comunes en minúscula. No fuerza acentos (eso lo cubre el
 * catálogo / la migración de datos).
 */
export function normalizarOcupacion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const limpio = raw.trim().replace(/\s+/g, " ");
  if (!limpio) return null;
  const minus = new Set(["de", "del", "la", "el", "y", "en", "a"]);
  return limpio
    .toLocaleLowerCase("es-MX")
    .split(" ")
    .map((w, i) =>
      i > 0 && minus.has(w) ? w : w.charAt(0).toLocaleUpperCase("es-MX") + w.slice(1),
    )
    .join(" ");
}

/** ¿El valor está fuera del catálogo (→ debe capturarse como "Otro")? */
export function esOcupacionOtro(valor: string | null | undefined): boolean {
  if (!valor) return false;
  return !OCUPACIONES.includes(valor);
}
