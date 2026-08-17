/**
 * Encadenamiento criptográfico de la bitácora de precios.
 *
 * Cada evento incluye el hash del evento anterior, de modo que alterar un evento
 * intermedio rompe la cadena a partir de ese punto. El hash se calcula con
 * crypto.subtle (API nativa del navegador), sin dependencias externas.
 *
 * SWAP POINT: en producción el hash se calcula del lado del servidor, dentro de
 * la Edge Function que es la única con permiso de INSERT sobre bitacora_precio.
 */

import type { EventoAuditoria } from "../types/dominio";

/** hash_anterior del primer evento de la cadena. */
export const HASH_GENESIS = "0".repeat(64);

/** Serialización determinista: llaves de objeto ordenadas alfabéticamente. */
export function serializarDeterminista(valor: unknown): string {
  const normalizar = (v: unknown): unknown => {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return v.map(normalizar);
    if (typeof v === "object") {
      const entradas = Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => typeof x !== "function" && x !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      const salida: Record<string, unknown> = {};
      for (const [k, x] of entradas) salida[k] = normalizar(x);
      return salida;
    }
    return v;
  };
  return JSON.stringify(normalizar(valor));
}

function aHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 hexadecimal en minúsculas. */
export async function sha256(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", datos);
  return aHex(digest);
}

/** Concatenación determinista de los campos que entran al hash. */
export function construirPayload(evento: Omit<EventoAuditoria, "hash">): string {
  return [
    evento.secuencia,
    evento.ocurrido_en,
    evento.actor.id_persona,
    evento.id_proyecto,
    evento.tipo,
    `${evento.entidad.tipo}:${evento.entidad.id}`,
    serializarDeterminista(evento.antes),
    serializarDeterminista(evento.despues),
    String(evento.impacto_pesos),
    evento.hash_anterior,
  ].join("|");
}

export async function calcularHash(
  evento: Omit<EventoAuditoria, "hash">,
): Promise<string> {
  return sha256(construirPayload(evento));
}

export interface DatosEventoBase {
  actor: EventoAuditoria["actor"];
  id_proyecto: string;
  tipo: EventoAuditoria["tipo"];
  entidad: EventoAuditoria["entidad"];
  antes?: unknown;
  despues?: unknown;
  impacto_pesos?: number | null;
  motivo?: { causa: string; descripcion: string } | null;
  /**
   * Fecha real del hecho. Se usa cuando el hecho ocurrió antes de detectarse
   * (por ejemplo, el vencimiento diferido de una oferta) o al sembrar datos de
   * demostración. Si se omite, se usa el momento actual.
   */
  ocurrido_en?: string;
}

/** Identificador de evento ordenable cronológicamente. */
function idEvento(secuencia: number, ocurridoEn: string): string {
  return `ev-${ocurridoEn.replace(/[-:.TZ]/g, "")}-${String(secuencia).padStart(6, "0")}`;
}

export async function crearEvento(
  datos: DatosEventoBase,
  hashAnterior: string,
  secuencia: number,
): Promise<EventoAuditoria> {
  const ocurrido_en = datos.ocurrido_en ?? new Date().toISOString();
  const sinHash: Omit<EventoAuditoria, "hash"> = {
    id_evento: idEvento(secuencia, ocurrido_en),
    secuencia,
    ocurrido_en,
    actor: datos.actor,
    id_proyecto: datos.id_proyecto,
    tipo: datos.tipo,
    entidad: datos.entidad,
    antes: datos.antes ?? null,
    despues: datos.despues ?? null,
    impacto_pesos: datos.impacto_pesos ?? null,
    motivo: datos.motivo ?? null,
    libro: "Comercial",
    hash_anterior: hashAnterior,
  };
  return { ...sinHash, hash: await calcularHash(sinHash) };
}

export interface ResultadoVerificacion {
  integra: boolean;
  eventosVerificados: number;
  primerFalloEn: number | null;
  detalle: string | null;
}

export async function verificarCadena(
  eventos: EventoAuditoria[],
): Promise<ResultadoVerificacion> {
  const ordenados = [...eventos].sort((a, b) => a.secuencia - b.secuencia);
  let anterior = HASH_GENESIS;
  let verificados = 0;

  for (const ev of ordenados) {
    if (ev.hash_anterior !== anterior) {
      return {
        integra: false,
        eventosVerificados: verificados,
        primerFalloEn: ev.secuencia,
        detalle:
          "El campo hash_anterior no coincide con el hash del evento previo. La cadena fue alterada o se eliminó un evento.",
      };
    }
    const { hash, ...resto } = ev;
    const recalculado = await calcularHash(resto);
    if (recalculado !== hash) {
      return {
        integra: false,
        eventosVerificados: verificados,
        primerFalloEn: ev.secuencia,
        detalle: `El hash almacenado no corresponde al contenido del evento. Esperado ${recalculado}, almacenado ${hash}.`,
      };
    }
    anterior = hash;
    verificados += 1;
  }

  return {
    integra: true,
    eventosVerificados: verificados,
    primerFalloEn: null,
    detalle: null,
  };
}
