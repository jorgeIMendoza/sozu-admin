/**
 * Hook de datos para el modal de comprobantes de pago del Portal Notaría.
 *
 * Responsabilidades:
 *   - Waterfall multi-step: cuenta principal → id_propiedad → bodegas/estacionamientos
 *     → ofertas → cuentas_cobranza adicionales → pagos de cada cuenta
 *   - NO usa PostgREST triple-join; cada paso es una query explícita (ver CLAUDE.md)
 *   - Aplica filtro MVP `.eq('id_notario', notarioId)` — NO es mecanismo de seguridad
 *     (ver aviso en notaria-download.service.ts)
 *   - Construye PagosZipInput para buildPagosZip (URLs en bruto — NO resueltas)
 *   - Emite evento de auditoría PAGOS_DOWNLOAD con metadatos enriquecidos
 *
 * Cuentas incluidas: unidad principal + bodega(s) + estacionamiento(s).
 * Excluidas explícitamente: cocina, closet, condensadora, muebles, extras.
 * (El patrón bodegas/estacionamientos es exhaustivo; los extras no tienen tabla propia.)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildPagosZip,
  classifyDocUrl,
  type CuentaEscriturable,
  type PagoComprobante,
  type PagosZipInput,
  type BuildZipResult,
} from '@/services/notaria-download.service';
import { registrarActividadNotaria } from '@/services/notaria-actividad.service';

// ─── Display types (solo para presentación — sin URLs) ────────────────────────

export interface CuentaPagosDisplay {
  cuentaId: number;
  tipo: 'principal' | 'bodega' | 'estacionamiento';
  folderIndex: number;
  totalPagos: number;
  conComprobante: number;   // pagos con al menos una URL no-nula (válida o inválida)
  sinComprobante: number;   // pagos sin ninguna URL
}

export interface UseNotariaPagosResult {
  cuentas: CuentaPagosDisplay[];
  isLoading: boolean;
  isError: boolean;
  totalPagos: number;
  conComprobante: number;
  sinComprobante: number;
  invalidUrlsCount: number;   // URLs no-nulas clasificadas como 'invalid'
  download: () => Promise<void>;
  isDownloading: boolean;
  downloadProgress: { current: number; total: number } | null;
  downloadResult: BuildZipResult | null;
  downloadError: string | null;
}

// ─── Raw pago row from DB ─────────────────────────────────────────────────────

interface RawPago {
  id: number;
  fecha_pago: string | null;
  monto: number;
  descripcion: string | null;
  url_cep: string | null;
  url_recibo: string | null;
  id_cuenta_cobranza: number;
  metodos_pago: { nombre: string } | null;
}

// ─── Waterfall helper: get all pagos for a list of cuentas_cobranza ids ───────

async function fetchPagosPorCuentas(cuentaIds: number[]): Promise<RawPago[]> {
  if (cuentaIds.length === 0) return [];
  const { data } = await (supabase as any)
    .from('pagos')
    .select('id, fecha_pago, monto, descripcion, url_cep, url_recibo, id_cuenta_cobranza, metodos_pago!pagos_id_metodos_pago_fkey(nombre)')
    .in('id_cuenta_cobranza', cuentaIds)
    .eq('activo', true)
    .order('fecha_pago', { ascending: true });
  return (data ?? []) as RawPago[];
}

// ─── Convert raw pagos to PagoComprobante[] ───────────────────────────────────

function toPagoComprobante(raw: RawPago): PagoComprobante {
  return {
    pagoId: raw.id,
    fecha: raw.fecha_pago,
    monto: Number(raw.monto),
    metodo: raw.metodos_pago?.nombre ?? 'Otro',
    concepto: raw.descripcion,
    urlCep: raw.url_cep,
    urlRecibo: raw.url_recibo,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotariaPagos({
  idCuentaCobranza,
  notarioId,
  proyecto,
  unidad,
  notariaNombre,
  usuarioEmail,
  enabled = true,
}: {
  idCuentaCobranza: number | null;
  notarioId: number | null;
  proyecto: string;
  unidad: string;
  notariaNombre: string | null;
  usuarioEmail: string | null;
  enabled?: boolean;
}): UseNotariaPagosResult {
  const [isDownloading, setIsDownloading]       = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [downloadResult, setDownloadResult]     = useState<BuildZipResult | null>(null);
  const [downloadError, setDownloadError]       = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notaria-pagos', idCuentaCobranza, notarioId],
    enabled: enabled && !!idCuentaCobranza && !!notarioId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      // ── Paso 1: verificar cuenta principal con filtro MVP notarioId ──────────
      // ESTE FILTRO NO ES UN MECANISMO DE SEGURIDAD — ver service.
      const { data: cuentaRow, error: cuentaErr } = await (supabase as any)
        .from('cuentas_cobranza')
        .select('id, id_propiedad')
        .eq('id', idCuentaCobranza)
        .eq('id_notario', notarioId)
        .eq('activo', true)
        .single();

      if (cuentaErr || !cuentaRow) return null;

      const idPropiedad: number = cuentaRow.id_propiedad;

      // ── Paso 2: pagos de la cuenta principal ─────────────────────────────────
      const pagosPrincipal = await fetchPagosPorCuentas([idCuentaCobranza!]);

      // ── Paso 3: waterfall bodegas ─────────────────────────────────────────────
      const { data: bodegasRows } = await (supabase as any)
        .from('bodegas')
        .select('id_producto')
        .eq('id_propiedad', idPropiedad)
        .eq('activo', true);

      const bodegaProductIds = [...new Set<number>(
        (bodegasRows ?? []).map((r: { id_producto: number }) => r.id_producto).filter(Boolean),
      )];

      let pagosBodega: RawPago[] = [];
      let cuentasBodegaIds: number[] = [];
      if (bodegaProductIds.length > 0) {
        const { data: ofertasBodega } = await (supabase as any)
          .from('ofertas')
          .select('id')
          .in('id_producto', bodegaProductIds)
          .eq('id_propiedad', idPropiedad)
          .eq('activo', true);
        const ofertaBodegaIds = (ofertasBodega ?? []).map((r: { id: number }) => r.id);
        if (ofertaBodegaIds.length > 0) {
          const { data: cuentasBodega } = await (supabase as any)
            .from('cuentas_cobranza')
            .select('id')
            .in('id_oferta', ofertaBodegaIds)
            .eq('activo', true);
          cuentasBodegaIds = (cuentasBodega ?? []).map((r: { id: number }) => r.id);
          pagosBodega = await fetchPagosPorCuentas(cuentasBodegaIds);
        }
      }

      // ── Paso 4: waterfall estacionamientos ────────────────────────────────────
      const { data: estRows } = await (supabase as any)
        .from('estacionamientos')
        .select('id_producto')
        .eq('id_propiedad', idPropiedad)
        .eq('activo', true);

      const estProductIds = [...new Set<number>(
        (estRows ?? []).map((r: { id_producto: number }) => r.id_producto).filter(Boolean),
      )];

      let pagosEst: RawPago[] = [];
      let cuentasEstIds: number[] = [];
      if (estProductIds.length > 0) {
        const { data: ofertasEst } = await (supabase as any)
          .from('ofertas')
          .select('id')
          .in('id_producto', estProductIds)
          .eq('id_propiedad', idPropiedad)
          .eq('activo', true);
        const ofertaEstIds = (ofertasEst ?? []).map((r: { id: number }) => r.id);
        if (ofertaEstIds.length > 0) {
          const { data: cuentasEst } = await (supabase as any)
            .from('cuentas_cobranza')
            .select('id')
            .in('id_oferta', ofertaEstIds)
            .eq('activo', true);
          cuentasEstIds = (cuentasEst ?? []).map((r: { id: number }) => r.id);
          pagosEst = await fetchPagosPorCuentas(cuentasEstIds);
        }
      }

      return {
        idPropiedad,
        pagosPrincipal,
        cuentasBodegaIds,
        pagosBodega,
        cuentasEstIds,
        pagosEst,
      };
    },
  });

  // ── Derived display data ────────────────────────────────────────────────────

  const cuentasEscriturables: CuentaEscriturable[] = [];
  const cuentasDisplay: CuentaPagosDisplay[] = [];
  let totalPagos = 0;
  let conComprobante = 0;
  let sinComprobante = 0;
  let invalidUrlsCount = 0;

  if (data && idCuentaCobranza) {
    let folderIndex = 1;

    const buildCuenta = (
      cuentaId: number,
      tipo: 'principal' | 'bodega' | 'estacionamiento',
      rawPagos: RawPago[],
    ) => {
      const pagos = rawPagos
        .filter(p => p.id_cuenta_cobranza === cuentaId)
        .map(toPagoComprobante);

      let con = 0;
      let sin = 0;
      for (const p of pagos) {
        const hasAny = !!(p.urlCep || p.urlRecibo);
        if (hasAny) { con++; } else { sin++; }
        for (const raw of [p.urlCep, p.urlRecibo]) {
          if (raw && classifyDocUrl(raw).type === 'invalid') invalidUrlsCount++;
        }
      }

      cuentasEscriturables.push({ cuentaId, tipo, folderIndex, pagos });
      cuentasDisplay.push({ cuentaId, tipo, folderIndex, totalPagos: pagos.length, conComprobante: con, sinComprobante: sin });
      totalPagos += pagos.length;
      conComprobante += con;
      sinComprobante += sin;
      folderIndex++;
    };

    // Principal
    buildCuenta(idCuentaCobranza, 'principal', data.pagosPrincipal);

    // Bodegas — each cuentaId gets its own folder
    for (const cuentaId of data.cuentasBodegaIds) {
      buildCuenta(cuentaId, 'bodega', data.pagosBodega);
    }

    // Estacionamientos
    for (const cuentaId of data.cuentasEstIds) {
      buildCuenta(cuentaId, 'estacionamiento', data.pagosEst);
    }
  }

  // ── Download action ─────────────────────────────────────────────────────────

  const download = async () => {
    if (isDownloading || !idCuentaCobranza) return;
    setIsDownloading(true);
    setDownloadProgress(null);
    setDownloadResult(null);
    setDownloadError(null);

    const fechaGeneracion = new Date().toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const input: PagosZipInput = {
      proyecto,
      unidad,
      cuentaPrincipalId: idCuentaCobranza,
      cuentas: cuentasEscriturables,
      usuarioEmail,
      notariaNombre,
      fechaGeneracion,
    };

    try {
      const result = await buildPagosZip(
        input,
        (current, total) => setDownloadProgress({ current, total }),
      );
      setDownloadResult(result);

      if (result.success) {
        const descargaParcial = result.skippedCount > 0 || result.failedFiles.length > 0 || result.invalidUrlsCount > 0;
        registrarActividadNotaria({
          idCuentaCobranza,
          evento: 'PAGOS_DOWNLOAD',
          usuarioEmail,
          meta: {
            id_notario: notarioId,
            proyecto,
            unidad,
            comprobantes_incluidos: result.includedCount,
            pagos_sin_comprobante: result.skippedCount,
            archivos_fallidos: result.failedFiles.length,
            archivos_duplicados: result.duplicatesSkipped,
            archivos_invalidos: result.invalidUrlsCount,
            cuentas_incluidas: cuentasEscriturables.length,
            descarga_parcial: descargaParcial,
          },
        });
      }
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Error desconocido al generar el ZIP');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  return {
    cuentas: cuentasDisplay,
    isLoading,
    isError,
    totalPagos,
    conComprobante,
    sinComprobante,
    invalidUrlsCount,
    download,
    isDownloading,
    downloadProgress,
    downloadResult,
    downloadError,
  };
}
