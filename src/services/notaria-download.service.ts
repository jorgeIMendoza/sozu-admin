/**
 * AVISO DE SEGURIDAD — LEER ANTES DE MODIFICAR
 * ──────────────────────────────────────────────────────────────────────────────
 * MVP: El acceso a los datos de descarga está restringido por filtros en los
 * hooks React (useNotariaExpediente, useNotariaPagos) que aplican
 * `.eq('id_notario', notarioId)` sobre las cuentas_cobranza.
 *
 * ESTE FILTRO NO ES UN MECANISMO DE SEGURIDAD. Es una capa de compatibilidad
 * de MVP para limitar el alcance desde la UI. Un usuario autenticado con la
 * anon key puede omitir los filtros de los hooks y acceder directamente a
 * datos de otras notarías vía la API REST de Supabase.
 *
 * Esta funcionalidad NO debe liberarse a producción sin implementar la política
 * RLS en cuentas_cobranza descrita en:
 *   Ejecuciones_manuales/20260710_rls_notaria_cuentas.md
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * ARQUITECTURA DE STORAGE (auditada 2026-07-10):
 *
 * Bucket `documentos` — PÚBLICO. Todas las URLs en `documentos.url`,
 * `pagos.url_cep` y `pagos.url_recibo` son URLs HTTPS completas ya listas
 * para fetch sin autenticación.
 *
 * Buckets privados: `proyectos_escritura`, `firmas-digitales`. Sus registros
 * almacenan paths relativos que requieren signed URL en tiempo de uso.
 * Para el Portal Notaría (grupos obligatorios + comprobantes de pago), todos
 * los archivos viven en el bucket `documentos` público.
 *
 * PRODUCCIÓN: el bucket `documentos` debe convertirse a privado y requerir
 * políticas de Storage + signed URLs. Ver capas pendientes en:
 *   Ejecuciones_manuales/20260710_rls_notaria_cuentas.md
 *
 * Signed URL TTL recomendado: 3600 s (1 hora) — consistente con
 * RevisionDocumentacion.tsx y PdfViewerDialog.tsx.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

// ─── URL resolution ────────────────────────────────────────────────────────────

export type DocUrlType =
  | 'public_url'          // URL HTTPS completa en bucket público de Supabase
  | 'external_historical' // URL HTTPS completa a servicio externo (legado api.sozu.com, etc.)
  | 'private_path'        // Path relativo que requiere signed URL antes de descargar
  | 'invalid';            // null, vacío, o formato no reconocido

const SUPABASE_PUBLIC_STORAGE = /\/storage\/v1\/object\/public\//;

// Clasifica una URL almacenada en BD sin realizar ninguna petición HTTP.
export function classifyDocUrl(rawUrl: string | null | undefined): { type: DocUrlType; url: string | null } {
  if (!rawUrl || rawUrl.trim() === '') return { type: 'invalid', url: null };
  const u = rawUrl.trim();
  if (SUPABASE_PUBLIC_STORAGE.test(u)) return { type: 'public_url', url: u };
  if (u.startsWith('https://') || u.startsWith('http://')) return { type: 'external_historical', url: u };
  return { type: 'private_path', url: u };
}

const SIGNED_URL_TTL = 3600; // 1 hora — consistente con el resto del codebase

// Resuelve una URL de documento a una URL descargable:
// - public_url / external_historical → devuelve la URL tal cual
// - private_path → genera signed URL (bucket 'documentos' por defecto)
// - invalid → devuelve null
export async function resolveDocUrl(
  rawUrl: string | null | undefined,
  opts?: { bucket?: string; ttl?: number },
): Promise<string | null> {
  const { type, url } = classifyDocUrl(rawUrl);
  if (type === 'invalid' || !url) return null;
  if (type === 'public_url' || type === 'external_historical') return url;
  const bucket = opts?.bucket ?? 'documentos';
  const ttl = opts?.ttl ?? SIGNED_URL_TTL;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(url, ttl);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface GrupoDocStatus {
  grupoKey: string;
  grupoLabel: string;
  estatusId: number | null;   // null = sin documento; 1=Pendiente, 2=Validado, 3=Rechazado
  docId: number | null;
  url: string | null;         // URL almacenada en BD — puede ser pública, externa o path privado
}

export interface CompradorExpediente {
  idPersona: number;
  nombre: string;
  folderIndex: number;        // 1-based
  grupos: GrupoDocStatus[];
}

export interface ExpedienteZipInput {
  proyecto: string;
  unidad: string;
  cuentaId: number;
  compradores: CompradorExpediente[];
  usuarioEmail: string | null;
  fechaGeneracion: string;    // "DD/MM/YYYY HH:mm" — generado en el componente con new Date()
}

export interface PagoComprobante {
  pagoId: number;
  fecha: string | null;
  monto: number;
  metodo: string;
  concepto: string | null;
  urlCep: string | null;
  urlRecibo: string | null;
}

export interface CuentaEscriturable {
  tipo: 'principal' | 'bodega' | 'estacionamiento';
  cuentaId: number;
  folderIndex: number;        // 1-based
  pagos: PagoComprobante[];
}

export interface PagosZipInput {
  proyecto: string;
  unidad: string;
  cuentaPrincipalId: number;
  cuentas: CuentaEscriturable[];
  usuarioEmail: string | null;
  notariaNombre: string | null;
  fechaGeneracion: string;
}

export interface BuildZipResult {
  success: boolean;
  includedCount: number;
  skippedCount: number;
  failedFiles: string[];
  duplicatesSkipped: number;
  invalidUrlsCount: number;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function sanitize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}

function padId(id: number, length = 6): string {
  return String(id).padStart(length, '0');
}

// Resuelve la URL y descarga como Blob. Retorna null si la URL es inválida
// o si la descarga falla (sin lanzar excepción — el ZIP continúa con el resto).
async function fetchBlob(rawUrl: string | null | undefined): Promise<{ blob: Blob; ext: string } | null> {
  const url = await resolveDocUrl(rawUrl);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'pdf';
    return { blob, ext: ext.length > 5 ? 'pdf' : ext };
  } catch {
    return null;
  }
}

async function triggerDownload(zip: JSZip, filename: string): Promise<void> {
  const content = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ─── Resumen expediente ────────────────────────────────────────────────────────

const ESTATUS_LABEL: Record<number, string> = {
  1: 'Pendiente de validación',
  2: 'Validado',
  3: 'Rechazado',
  4: 'Expirado',
};

function buildResumenExpediente(input: ExpedienteZipInput, failedUrls: string[]): string {
  const S = '=================================================';
  const D = '-------------------------------------------------';
  const lines: string[] = [
    S,
    'EXPEDIENTE DE ESCRITURACIÓN — PORTAL NOTARÍA SOZU',
    S,
    `Proyecto  : ${input.proyecto}`,
    `Unidad    : ${input.unidad}`,
    `Cuenta    : CC-${padId(input.cuentaId)}`,
    `Generado  : ${input.fechaGeneracion}`,
    '',
    D,
    'COMPRADORES',
    D,
  ];

  input.compradores.forEach((c, i) => {
    lines.push(`[${String(c.folderIndex).padStart(2, '0')}] ${c.nombre}  ${i === 0 ? '(Titular)' : '(Copropietario)'}`);
  });

  lines.push('', D, 'ESTADO DE DOCUMENTOS', D);

  let totalIncluidos = 0;
  let totalFaltantes = 0;

  for (const c of input.compradores) {
    const folder = `${String(c.folderIndex).padStart(2, '0')}_${sanitize(c.nombre)}`;
    lines.push(`[${folder}]`);
    for (const g of c.grupos) {
      const incluido = g.estatusId === 2 && g.url !== null;
      const estadoStr = g.estatusId != null
        ? (ESTATUS_LABEL[g.estatusId] ?? `Estatus ${g.estatusId}`)
        : 'Sin documento';
      const nota = incluido ? '→ INCLUIDO' : `→ ${estadoStr.toUpperCase()} (no incluido)`;
      lines.push(`  ${incluido ? '✓' : '✗'} ${g.grupoLabel.padEnd(38)} ${nota}`);
      if (incluido) totalIncluidos++; else totalFaltantes++;
    }
    lines.push('');
  }

  if (failedUrls.length > 0) {
    lines.push(D, 'ERRORES DE DESCARGA', D);
    failedUrls.forEach(u => lines.push(`  - ${u}`));
    lines.push('');
  }

  lines.push(D, 'RESUMEN', D);
  lines.push(`Compradores          : ${input.compradores.length}`);
  lines.push(`Documentos incluidos : ${totalIncluidos}`);
  lines.push(`Documentos faltantes : ${totalFaltantes}`);
  lines.push('');
  lines.push(
    totalFaltantes > 0
      ? 'NOTA: Expediente generado con documentos incompletos.\nLos grupos marcados con ✗ deben cargarse y validarse\nen el Portal de Expedientes antes de proceder con la escrituración.'
      : 'Expediente completo — todos los documentos validados.',
  );
  lines.push(S);
  return lines.join('\n');
}

// ─── buildExpedienteZip ────────────────────────────────────────────────────────

export async function buildExpedienteZip(
  input: ExpedienteZipInput,
  onProgress?: (current: number, total: number) => void,
): Promise<BuildZipResult> {
  const downloadable = input.compradores.flatMap(c =>
    c.grupos.filter(g => g.estatusId === 2 && g.url)
  );
  const total = downloadable.length;
  const failedFiles: string[] = [];
  let skippedCount = 0;
  let current = 0;

  const zip = new JSZip();

  for (const comprador of input.compradores) {
    const folderName = `${String(comprador.folderIndex).padStart(2, '0')}_${sanitize(comprador.nombre)}`;
    const folder = zip.folder(folderName)!;

    for (const grupo of comprador.grupos) {
      if (grupo.estatusId !== 2 || !grupo.url) { skippedCount++; continue; }
      current++;
      onProgress?.(current, total);
      const result = await fetchBlob(grupo.url);
      if (!result) { failedFiles.push(`${grupo.grupoLabel} (${comprador.nombre})`); continue; }
      folder.file(`${grupo.grupoKey}_${sanitize(comprador.nombre)}.${result.ext}`, result.blob);
    }
  }

  zip.file('RESUMEN_EXPEDIENTE.txt', buildResumenExpediente(input, failedFiles));

  if (total === 0) {
    return { success: false, includedCount: 0, skippedCount, failedFiles, duplicatesSkipped: 0, invalidUrlsCount: 0 };
  }

  const zipName = `EXPEDIENTE_${sanitize(input.proyecto)}_${sanitize(input.unidad)}_CC-${padId(input.cuentaId)}.zip`;
  await triggerDownload(zip, zipName);

  return { success: true, includedCount: total - failedFiles.length, skippedCount, failedFiles, duplicatesSkipped: 0, invalidUrlsCount: 0 };
}

// ─── Resumen pagos ─────────────────────────────────────────────────────────────

interface ArchivoLog {
  tipo: 'cep' | 'recibo';
  estado: 'incluido' | 'fallido' | 'invalido' | 'duplicado';
  rawUrl: string;
  fileName: string | null;
}

interface PagoLog {
  pagoId: number;
  cuentaId: number;
  fecha: string | null;
  monto: number;
  metodo: string;
  concepto: string | null;
  archivos: ArchivoLog[];
  sinComprobante: boolean;
}

function buildResumenPagos(
  input: PagosZipInput,
  pagoLogs: PagoLog[],
  duplicatesSkipped: number,
  failedCount: number,
  invalidCount: number,
): string {
  const S = '=================================================';
  const D = '-------------------------------------------------';
  const TIPO_LABEL: Record<string, string> = {
    principal: 'Unidad principal',
    bodega: 'Bodega',
    estacionamiento: 'Estacionamiento',
  };
  const fmtMonto = (n: number) =>
    n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  const fmtFecha = (f: string | null) =>
    f ? new Date(f).toLocaleDateString('es-MX') : '—';

  const lines: string[] = [
    S,
    'COMPROBANTES DE PAGO — PORTAL NOTARÍA SOZU',
    S,
    `Proyecto          : ${input.proyecto}`,
    `Unidad            : ${input.unidad}`,
    `Cuenta principal  : CC-${padId(input.cuentaPrincipalId)}`,
    `Generado          : ${input.fechaGeneracion}`,
    `Usuario           : ${input.usuarioEmail ?? '—'}`,
    `Notaría           : ${input.notariaNombre ?? '—'}`,
    '',
    'NOTA: La unidad principal, bodega(s) y estacionamiento(s) incluidos',
    'constituyen UNA SOLA OPERACIÓN DE ESCRITURACIÓN. Los comprobantes',
    'se agrupan por cuenta para facilitar su identificación y verificación.',
    '',
    D,
    'CUENTAS ESCRITURABLES INCLUIDAS',
    D,
  ];

  for (const c of input.cuentas) {
    const pagosCount = pagoLogs.filter(p => p.cuentaId === c.cuentaId).length;
    lines.push(
      `[${String(c.folderIndex).padStart(2, '0')}] CC-${padId(c.cuentaId)}  ${TIPO_LABEL[c.tipo] ?? c.tipo}`
      + `  (${pagosCount} pago${pagosCount !== 1 ? 's' : ''})`,
    );
  }

  lines.push('', D, 'DETALLE POR CUENTA', D);

  for (const cuenta of input.cuentas) {
    const tipoLabel = (TIPO_LABEL[cuenta.tipo] ?? cuenta.tipo).toUpperCase().replace(/ /g, '_');
    const folderStr = `${String(cuenta.folderIndex).padStart(2, '0')}_${tipoLabel}_CC-${padId(cuenta.cuentaId)}`;
    lines.push(`[${folderStr}]`);
    const pagosCuenta = pagoLogs.filter(p => p.cuentaId === cuenta.cuentaId);
    for (const pago of pagosCuenta) {
      const header = `Pago #${pago.pagoId} | ${pago.metodo}`
        + ` | ${fmtFecha(pago.fecha)} | ${fmtMonto(pago.monto)}`
        + (pago.concepto ? ` | ${pago.concepto}` : '');
      if (pago.sinComprobante) {
        lines.push(`  ✗ ${header}`);
        lines.push(`    (Sin comprobante — pago registrado sin archivo adjunto)`);
      } else {
        const anyOk = pago.archivos.some(a => a.estado === 'incluido');
        lines.push(`  ${anyOk ? '✓' : '!'} ${header}`);
        for (const archivo of pago.archivos) {
          const tipo = archivo.tipo.toUpperCase().padEnd(6);
          let estadoStr: string;
          if (archivo.estado === 'incluido')   estadoStr = `INCLUIDO  → ${archivo.fileName ?? '—'}`;
          else if (archivo.estado === 'fallido')   estadoStr = `FALLIDO   (error de descarga)`;
          else if (archivo.estado === 'invalido')  estadoStr = `INVÁLIDO  (URL no reconocida: ${archivo.rawUrl.slice(0, 60)})`;
          else                                     estadoStr = `DUPLICADO (mismo archivo ya incluido)`;
          lines.push(`    → ${tipo} ${estadoStr}`);
        }
      }
    }
    if (pagosCuenta.length === 0) lines.push('  (Sin pagos registrados)');
    lines.push('');
  }

  const totalPagos = pagoLogs.length;
  const includedArchivos = pagoLogs.flatMap(p => p.archivos).filter(a => a.estado === 'incluido').length;
  const sinComprobante = pagoLogs.filter(p => p.sinComprobante).length;

  lines.push(D, 'RESUMEN GENERAL', D);
  lines.push(`Cuentas escriturables          : ${input.cuentas.length}`);
  lines.push(`Total de pagos encontrados     : ${totalPagos}`);
  lines.push(`Comprobantes incluidos         : ${includedArchivos}`);
  if (sinComprobante > 0)      lines.push(`Pagos sin comprobante          : ${sinComprobante}`);
  if (duplicatesSkipped > 0)   lines.push(`Archivos duplicados omitidos   : ${duplicatesSkipped}`);
  if (failedCount > 0)         lines.push(`Archivos fallidos (red/acceso) : ${failedCount}`);
  if (invalidCount > 0)        lines.push(`URLs inválidas (formato)       : ${invalidCount}`);
  lines.push(S);
  return lines.join('\n');
}

// ─── buildPagosZip ─────────────────────────────────────────────────────────────
//
// Deduplication strategy (dedupeKey):
//   - public_url / external_historical: strips query string (removes signed URL tokens
//     and cache-busting params) → same physical file deduped across pagos and cuentas
//   - private_path: uses raw path as key → two references to the same Storage path
//     are the same file regardless of signed URL token
//   - Each pago can contribute 2 files (url_cep AND url_recibo when both exist)
//   - Dedup key is lower-cased to avoid case mismatches
//
// This handles: signed URLs for the same path, same file in url_cep of one pago
// and url_recibo of another, same file across accounts, external/historical URLs
// with query params.

function dedupeKey(rawUrl: string): string {
  const { type, url } = classifyDocUrl(rawUrl);
  if (type === 'invalid' || !url) return `invalid:${rawUrl}`;
  if (type === 'private_path') return `path:${url}`;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export async function buildPagosZip(
  input: PagosZipInput,
  onProgress?: (current: number, total: number) => void,
): Promise<BuildZipResult> {
  // Pre-compute total unique downloadable URLs (non-invalid, pre-dedup) for progress bar
  const urlsUnicas = new Set<string>();
  for (const c of input.cuentas) {
    for (const p of c.pagos) {
      for (const rawUrl of ([p.urlCep, p.urlRecibo].filter(Boolean) as string[])) {
        const { type } = classifyDocUrl(rawUrl);
        if (type !== 'invalid') urlsUnicas.add(dedupeKey(rawUrl));
      }
    }
  }
  const total = urlsUnicas.size;

  const urlsAgregadas = new Set<string>();
  const pagoLogs: PagoLog[] = [];
  const failedFiles: string[] = [];
  let duplicatesSkipped = 0;
  let invalidUrlsCount = 0;
  let skippedCount = 0;
  let current = 0;

  const zip = new JSZip();
  const TIPO_FOLDER: Record<string, string> = {
    principal: 'UNIDAD_PRINCIPAL',
    bodega: 'BODEGA',
    estacionamiento: 'ESTACIONAMIENTO',
  };

  for (const cuenta of input.cuentas) {
    const folderName =
      `${String(cuenta.folderIndex).padStart(2, '0')}_${TIPO_FOLDER[cuenta.tipo] ?? cuenta.tipo.toUpperCase()}_CC-${padId(cuenta.cuentaId)}`;
    const folder = zip.folder(folderName)!;
    let consecutivo = 1;

    for (const pago of cuenta.pagos) {
      const urlsToProcess: { rawUrl: string; tipo: 'cep' | 'recibo' }[] = [];
      if (pago.urlCep)    urlsToProcess.push({ rawUrl: pago.urlCep,    tipo: 'cep' });
      if (pago.urlRecibo) urlsToProcess.push({ rawUrl: pago.urlRecibo, tipo: 'recibo' });

      if (urlsToProcess.length === 0) {
        skippedCount++;
        pagoLogs.push({
          pagoId: pago.pagoId, cuentaId: cuenta.cuentaId,
          fecha: pago.fecha, monto: pago.monto, metodo: pago.metodo, concepto: pago.concepto,
          archivos: [], sinComprobante: true,
        });
        continue;
      }

      const archivos: ArchivoLog[] = [];

      for (const { rawUrl, tipo } of urlsToProcess) {
        const { type: urlType } = classifyDocUrl(rawUrl);
        if (urlType === 'invalid') {
          invalidUrlsCount++;
          archivos.push({ tipo, estado: 'invalido', rawUrl, fileName: null });
          continue;
        }
        const key = dedupeKey(rawUrl);
        if (urlsAgregadas.has(key)) {
          duplicatesSkipped++;
          archivos.push({ tipo, estado: 'duplicado', rawUrl, fileName: null });
          continue;
        }
        urlsAgregadas.add(key);
        current++;
        onProgress?.(current, total);

        const fetchResult = await fetchBlob(rawUrl);
        const fechaStr = pago.fecha
          ? new Date(pago.fecha).toISOString().slice(0, 10).replace(/-/g, '')
          : 'SINFECHA';
        const montoStr = pago.monto.toFixed(2).replace('.', '-');
        const metodoStr = sanitize(pago.metodo || 'DESCONOCIDO');
        const ext = fetchResult?.ext ?? 'pdf';
        const fileName =
          `pago_${String(consecutivo).padStart(2, '0')}_${metodoStr}_${fechaStr}_${montoStr}_${tipo}.${ext}`;

        if (!fetchResult) {
          failedFiles.push(`Pago #${pago.pagoId} ${tipo.toUpperCase()} (${rawUrl})`);
          archivos.push({ tipo, estado: 'fallido', rawUrl, fileName });
        } else {
          folder.file(fileName, fetchResult.blob);
          consecutivo++;
          archivos.push({ tipo, estado: 'incluido', rawUrl, fileName });
        }
      }

      pagoLogs.push({
        pagoId: pago.pagoId, cuentaId: cuenta.cuentaId,
        fecha: pago.fecha, monto: pago.monto, metodo: pago.metodo, concepto: pago.concepto,
        archivos, sinComprobante: false,
      });
    }
  }

  zip.file(
    'RESUMEN_PAGOS.txt',
    buildResumenPagos(input, pagoLogs, duplicatesSkipped, failedFiles.length, invalidUrlsCount),
  );

  const includedCount = pagoLogs.flatMap(p => p.archivos).filter(a => a.estado === 'incluido').length;

  if (total === 0) {
    return { success: false, includedCount: 0, skippedCount, failedFiles, duplicatesSkipped, invalidUrlsCount };
  }

  const zipName = `PAGOS_${sanitize(input.proyecto)}_${sanitize(input.unidad)}_CC-${padId(input.cuentaPrincipalId)}.zip`;
  await triggerDownload(zip, zipName);

  return { success: true, includedCount, skippedCount, failedFiles, duplicatesSkipped, invalidUrlsCount };
}
