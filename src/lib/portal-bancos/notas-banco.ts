/**
 * Modelo de metadatos del portal almacenados en la columna existente
 * `bancos_solicitudes.notas_banco` (para NO depender de columnas/tablas nuevas
 * que requieran DDL en cada ambiente).
 *
 * Formato canónico (JSON objeto):
 *   { "email_agente": string|null, "notas": Nota[] }
 *
 * Compatibilidad hacia atrás:
 *   - JSON arreglo  → { email_agente: null, notas: <arreglo> }  (formato previo)
 *   - texto plano   → { email_agente: null, notas: [nota legacy solo lectura] }
 *   - vacío/null    → { email_agente: null, notas: [] }
 */

export interface NotaBanco {
  id: string;
  autor_email: string;
  autor_nombre: string;
  nota: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  /** true = heredada del texto plano antiguo (solo lectura). */
  legacy?: boolean;
}

export interface NotasBancoMeta {
  email_agente: string | null;
  notas: NotaBanco[];
}

function normalizeNota(n: any): NotaBanco | null {
  if (!n || typeof n.nota !== "string") return null;
  return {
    id: String(n.id ?? ""),
    autor_email: String(n.autor_email ?? ""),
    autor_nombre: String(n.autor_nombre ?? n.autor_email ?? "Usuario"),
    nota: String(n.nota ?? ""),
    fecha_creacion: String(n.fecha_creacion ?? ""),
    fecha_actualizacion: String(n.fecha_actualizacion ?? n.fecha_creacion ?? ""),
  };
}

export function parseNotasBanco(raw: string | null | undefined): NotasBancoMeta {
  if (!raw || !raw.trim()) return { email_agente: null, notas: [] };
  try {
    const val = JSON.parse(raw);
    if (Array.isArray(val)) {
      return { email_agente: null, notas: val.map(normalizeNota).filter(Boolean) as NotaBanco[] };
    }
    if (val && typeof val === "object") {
      const notas = Array.isArray(val.notas)
        ? (val.notas.map(normalizeNota).filter(Boolean) as NotaBanco[])
        : [];
      const email = val.email_agente == null ? null : String(val.email_agente);
      return { email_agente: email || null, notas };
    }
  } catch {
    /* texto plano legacy */
  }
  return {
    email_agente: null,
    notas: [
      {
        id: "legacy",
        autor_email: "",
        autor_nombre: "Banco",
        nota: raw,
        fecha_creacion: "",
        fecha_actualizacion: "",
        legacy: true,
      },
    ],
  };
}

/** Serializa el meta a JSON (quita la marca `legacy` de las notas). */
export function serializeNotasBanco(meta: NotasBancoMeta): string {
  return JSON.stringify({
    email_agente: meta.email_agente ?? null,
    notas: meta.notas.map(({ legacy, ...n }) => n),
  });
}
