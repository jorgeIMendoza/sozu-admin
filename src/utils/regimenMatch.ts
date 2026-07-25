/**
 * Empata el texto de régimen fiscal que viene en la Constancia (CSF) con el
 * catálogo `regimen` de la BD.
 *
 * La CSF no escribe el nombre igual que el catálogo: trae variantes
 * ("Régimen Simplificado de Confianza", "RESICO"), a veces sin la palabra
 * "Régimen" y con la fecha de alta pegada ("Simplificado de Confianza
 * 28/04/2026"). Por eso no basta comparar cadenas: se elige el registro con
 * MAYOR coincidencia y solo se descarta si ninguno llega al umbral.
 */

export interface RegimenOption {
  id: string | number;
  nombre: string;
}

/** Códigos SAT que la CSF suele abreviar. */
const ALIASES: Record<string, string> = {
  resico: "626",
  rif: "621",
  repeco: "621",
};

/** Palabras que no aportan a la comparación. */
const STOPWORDS = new Set([
  "regimen", "regimenes", "fiscal", "fiscales", "de", "del", "la", "las", "los",
  "el", "y", "e", "o", "u", "con", "sin", "por", "para", "en", "a", "al", "su",
  "sus", "que", "opcion", "opcional",
]);

const stripAccents = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Palabras significativas del texto (sin acentos, sin dígitos, sin stopwords). */
function words(v: string): string[] {
  return stripAccents(v)
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Bigramas de caracteres, para tolerar plurales y erratas. */
function bigrams(v: string): Set<string> {
  const clean = stripAccents(v).replace(/[^a-z]/g, "");
  const out = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2));
  return out;
}

/** Coeficiente de Dice entre dos conjuntos (0 = nada en común, 1 = idénticos). */
function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((x) => { if (b.has(x)) inter++; });
  return (2 * inter) / (a.size + b.size);
}

/**
 * Devuelve el id del catálogo con mayor coincidencia, o `""` si ninguno supera
 * el umbral (entonces el usuario debe elegirlo a mano).
 */
export function matchRegimenId(texto: string, catalogo: RegimenOption[]): string {
  const raw = (texto || "").trim();
  if (!raw || !catalogo?.length) return "";

  // 1. Código SAT explícito ("626", "Régimen 626 - ...").
  const code = raw.match(/\b(\d{3})\b/)?.[1];
  if (code) {
    const byCode = catalogo.find((r) => String(r.id) === code);
    if (byCode) return String(byCode.id);
  }

  // 2. Abreviaturas conocidas (RESICO, RIF…).
  const flat = stripAccents(raw).replace(/[^a-z]/g, "");
  for (const [alias, id] of Object.entries(ALIASES)) {
    if (flat.includes(alias) && catalogo.some((r) => String(r.id) === id)) return id;
  }

  // 3. Mejor coincidencia por palabras + bigramas.
  const qWords = new Set(words(raw));
  const qGrams = bigrams(words(raw).join(""));
  let best: { id: string; score: number } | null = null;

  for (const r of catalogo) {
    const cWords = new Set(words(r.nombre));
    const cGrams = bigrams(words(r.nombre).join(""));
    // Cobertura: qué tanto del nombre del catálogo aparece en el texto leído.
    let hits = 0;
    cWords.forEach((w) => { if (qWords.has(w)) hits++; });
    const coverage = cWords.size ? hits / cWords.size : 0;
    const score = 0.6 * coverage + 0.4 * dice(qGrams, cGrams);
    if (!best || score > best.score) best = { id: String(r.id), score };
  }

  return best && best.score >= 0.45 ? best.id : "";
}
