import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  derivePld,
  clasificarRfcCurp,
  type PagoInfo,
  type PldStatus,
  type RiskLevel,
  type OrdenanteDistinto,
} from '@/lib/pld/pld-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PldPaymentFlag = 'verde' | 'amarillo' | 'rojo' | 'naranja' | 'gris';

export interface PldPaymentFlagInfo {
  flag: PldPaymentFlag;
  tooltip: string;
}

export interface PldForCuentaResult {
  pldStatus: PldStatus;
  riesgo: RiskLevel;
  escrituraBloqueada: boolean;
  hasRfcDistinto: boolean;
  hasNombreDistinto: boolean;
  hasEfectivoExcedido: boolean;
  montoPagadoEfectivo: number;
  limiteEfectivo: number;
  pagosRfcDistinto: OrdenanteDistinto[];
  pagosNombreDistinto: OrdenanteDistinto[];
  motivoPrincipal: string;
  fechaActualizacion: string;
  /** Mapa pago_id → flag + tooltip para la columna PLD en la tabla. */
  flagsPorPago: Map<number, PldPaymentFlagInfo>;
  isLoading: boolean;
}

/** Input mínimo de un pago para el motor PLD. Coincide con lo que devuelve rpPagosCuenta. */
export interface PagoInputPld {
  id: number;
  monto: number;
  fecha_pago: string;
  clave_rastreo: string | null;
  url_cep: string | null;
  url_recibo: string | null;
  descripcion: string | null;
  id_metodos_pago: number | null;
  validacion_documental_efectivo: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

function buildMotivoPrincipal(
  pldStatus: PldStatus,
  hasRfcDistinto: boolean,
  hasEfectivoExcedido: boolean,
  montoPagadoEfectivo: number,
  limiteEfectivo: number,
  hasNombreDistinto: boolean,
  totalPagado: number,
): string {
  if (hasRfcDistinto) return 'RFC/CURP en CEP no coincide con el comprador';
  if (hasEfectivoExcedido) {
    return `Límite de efectivo excedido — pagado ${fmtMxn(montoPagadoEfectivo)} / límite ${fmtMxn(limiteEfectivo)}`;
  }
  if (hasNombreDistinto) return 'Nombre de ordenante difiere del comprador';
  if (pldStatus === 'APROBADO') return 'Todos los pagos verificados';
  if (totalPagado === 0) return 'Sin pagos registrados';
  return 'Sin pagos STP — no verificable';
}

function buildFlagsPorPago(
  pagos: PagoInputPld[],
  pagosRfcDistinto: OrdenanteDistinto[],
  pagosNombreDistinto: OrdenanteDistinto[],
  hasEfectivoExcedido: boolean,
  limiteEfectivo: number,
): Map<number, PldPaymentFlagInfo> {
  const rfcSet    = new Set(pagosRfcDistinto.map(p => p.pagoId));
  const nombreSet = new Set(pagosNombreDistinto.map(p => p.pagoId));
  const flags     = new Map<number, PldPaymentFlagInfo>();

  for (const p of pagos) {
    let flag: PldPaymentFlag;
    let tooltip: string;

    if (rfcSet.has(p.id)) {
      flag    = 'rojo';
      tooltip = 'RFC/CURP en CEP no coincide con el comprador';
    } else if (hasEfectivoExcedido && p.id_metodos_pago === 1) {
      flag    = 'rojo';
      tooltip = 'Límite de efectivo excedido en la cuenta';
    } else if (nombreSet.has(p.id)) {
      flag    = 'amarillo';
      tooltip = 'Nombre de ordenante difiere del comprador';
    } else if (!p.clave_rastreo && p.id_metodos_pago === 1 && p.validacion_documental_efectivo) {
      flag    = 'verde';
      tooltip = 'Ticket de depósito y estado de cuenta validados';
    } else if (!p.clave_rastreo && p.url_recibo && (p.id_metodos_pago === 1 || p.id_metodos_pago === 2 || p.id_metodos_pago === 5)) {
      flag    = 'amarillo';
      tooltip = 'Comprobante adjunto — pendiente confirmar ticket y estado de cuenta';
    } else if (!p.clave_rastreo) {
      flag    = 'gris';
      tooltip = 'Sin clave de rastreo ni comprobante documental';
    } else {
      flag    = 'verde';
      tooltip = 'Sin alerta PLD';
    }

    flags.set(p.id, { flag, tooltip });
  }

  return flags;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const EMPTY_RESULT: Omit<PldForCuentaResult, 'isLoading'> = {
  pldStatus: 'PENDIENTE',
  riesgo: 'BAJO',
  escrituraBloqueada: false,
  hasRfcDistinto: false,
  hasNombreDistinto: false,
  hasEfectivoExcedido: false,
  montoPagadoEfectivo: 0,
  limiteEfectivo: 0,
  pagosRfcDistinto: [],
  pagosNombreDistinto: [],
  motivoPrincipal: 'Sin pagos disponibles',
  fechaActualizacion: '',
  flagsPorPago: new Map(),
};

/**
 * Computa el estatus PLD para una cuenta específica de cobranza.
 * Acotado a la cuenta visible — no carga todo el proyecto.
 *
 * @param primaryCuentaId  id_cuenta_cobranza de la cuenta en contexto
 * @param pagosInput       pagos ya cargados por RelacionPagos (rpPagosCuenta)
 * @param valorUma         valor_uma de la cuenta (para límite de efectivo)
 * @param precioFinal      precio_final de la cuenta (para determinar APROBADO)
 */
export function usePldForCuenta(
  primaryCuentaId: number | null,
  pagosInput: PagoInputPld[],
  valorUma: number,
  precioFinal: number,
): PldForCuentaResult {
  const enabled = !!primaryCuentaId && pagosInput.length > 0;

  // ── Query 1: RFC y CURP del comprador ────────────────────────────────────
  const { data: personaData, isLoading: loadingPersona } = useQuery({
    queryKey: ['pld-persona-cuenta', primaryCuentaId],
    enabled: !!primaryCuentaId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: compradores } = await supabase
        .from('compradores')
        .select('id_persona')
        .eq('id_cuenta_cobranza', primaryCuentaId!)
        .eq('activo', true)
        .limit(1);
      const id_persona = compradores?.[0]?.id_persona;
      if (!id_persona) return null;
      const { data: persona } = await supabase
        .from('personas')
        .select('id, nombre_legal, rfc, curp')
        .eq('id', id_persona)
        .maybeSingle();
      return persona as { id: number; nombre_legal: string; rfc: string | null; curp: string | null } | null;
    },
  });

  // ── Query 2: datos STP de ordenante por clave_rastreo ────────────────────
  const clavesRastreo = useMemo(
    () => [...new Set(pagosInput.map(p => p.clave_rastreo).filter((c): c is string => !!c))],
    [pagosInput],
  );

  const { data: stpData, isLoading: loadingStp } = useQuery({
    queryKey: ['pld-stp-cuenta', primaryCuentaId, clavesRastreo.join(',')],
    enabled: enabled && clavesRastreo.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('pagos_stp_raw')
        .select('claverastreo, nombre_ordenante, rfc_curp_ordenante')
        .in('claverastreo', clavesRastreo);
      return (data ?? []) as Array<{
        claverastreo: string;
        nombre_ordenante: string | null;
        rfc_curp_ordenante: string | null;
      }>;
    },
  });

  const isLoading = (!!primaryCuentaId && loadingPersona) ||
    (clavesRastreo.length > 0 && loadingStp);

  // ── Compute PLD ───────────────────────────────────────────────────────────
  const computed = useMemo((): Omit<PldForCuentaResult, 'isLoading'> => {
    if (!primaryCuentaId || pagosInput.length === 0) return EMPTY_RESULT;

    // Construir mapas de ordenante desde pagos_stp_raw
    const ordenanteMap:    Record<string, string>       = {};
    const rfcOrdenanteMap: Record<string, string | null> = {};
    const curpOrdenanteMap:Record<string, string | null> = {};
    (stpData ?? []).forEach(r => {
      if (r.nombre_ordenante) ordenanteMap[r.claverastreo] = r.nombre_ordenante;
      if (r.rfc_curp_ordenante) {
        const { rfc, curp } = clasificarRfcCurp(r.rfc_curp_ordenante);
        rfcOrdenanteMap[r.claverastreo]  = rfc;
        curpOrdenanteMap[r.claverastreo] = curp;
      }
    });

    // Enriquecer pagos con datos del ordenante
    const pagoInfos: PagoInfo[] = pagosInput.map(p => ({
      id:            p.id,
      monto:         p.monto,
      fecha_pago:    p.fecha_pago,
      clave_rastreo: p.clave_rastreo,
      url_cep:       p.url_cep,
      url_recibo:    p.url_recibo,
      descripcion:   p.descripcion,
      id_metodos_pago: p.id_metodos_pago ?? null,
      nombre_ordenante: p.clave_rastreo ? (ordenanteMap[p.clave_rastreo]     ?? null) : null,
      rfc_ordenante:    p.clave_rastreo ? (rfcOrdenanteMap[p.clave_rastreo]   ?? null) : null,
      curp_ordenante:   p.clave_rastreo ? (curpOrdenanteMap[p.clave_rastreo]  ?? null) : null,
    }));

    const clienteNombre = personaData?.nombre_legal ?? '—';
    const clienteRfc    = personaData?.rfc    ?? null;
    const clienteCurp   = personaData?.curp   ?? null;

    const pldResult = derivePld(pagoInfos, precioFinal, clienteNombre, clienteRfc, clienteCurp, valorUma);

    const motivoPrincipal = buildMotivoPrincipal(
      pldResult.pldStatus,
      pldResult.hasRfcDistinto,
      pldResult.hasEfectivoExcedido,
      pldResult.montoPagadoEfectivo,
      pldResult.limiteEfectivo,
      pldResult.hasNombreDistinto,
      pldResult.totalPagado,
    );

    const flagsPorPago = buildFlagsPorPago(
      pagosInput,
      pldResult.pagosRfcDistinto,
      pldResult.pagosNombreDistinto,
      pldResult.hasEfectivoExcedido,
      pldResult.limiteEfectivo,
    );

    // Fecha de referencia: pago más reciente de la lista
    const fechaActualizacion = pagosInput.length > 0
      ? pagosInput.reduce((latest, p) =>
          p.fecha_pago > latest ? p.fecha_pago : latest, pagosInput[0].fecha_pago)
      : '';

    return {
      pldStatus:           pldResult.pldStatus,
      riesgo:              pldResult.riesgo,
      escrituraBloqueada:  pldResult.escrituraBloqueada,
      hasRfcDistinto:      pldResult.hasRfcDistinto,
      hasNombreDistinto:   pldResult.hasNombreDistinto,
      hasEfectivoExcedido: pldResult.hasEfectivoExcedido,
      montoPagadoEfectivo: pldResult.montoPagadoEfectivo,
      limiteEfectivo:      pldResult.limiteEfectivo,
      pagosRfcDistinto:    pldResult.pagosRfcDistinto,
      pagosNombreDistinto: pldResult.pagosNombreDistinto,
      motivoPrincipal,
      fechaActualizacion,
      flagsPorPago,
    };
  }, [primaryCuentaId, pagosInput, stpData, personaData, precioFinal, valorUma]);

  return { ...computed, isLoading };
}
