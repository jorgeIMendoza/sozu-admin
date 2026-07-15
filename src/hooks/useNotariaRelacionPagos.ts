/**
 * Hook de datos READ-ONLY para el modal de Relación de Pagos del Portal Notaría.
 *
 * Responsabilidades:
 *   - Paso 0 (seguridad MVP): validar que la cuenta pertenece a la notaría del usuario.
 *     Si la cuenta no le pertenece, todos los steps quedan deshabilitados.
 *   - Waterfall read-only: principal → bodega → estacionamiento.
 *     Misma lógica que el rpMode de RelacionPagos.tsx (queries directas por cuentaId/idPropiedad).
 *   - Orden fecha_pago ASC en todas las tablas (igual que el portal administrativo).
 *
 * RESTRICCIONES ABSOLUTAS — NO NEGOCIABLES:
 *   - Cero mutations. Cero INSERT/UPDATE/DELETE/RPC de escritura.
 *   - Sin auto-validación de comprobantes.
 *   - Sin efectos secundarios de escritura.
 *   - El filtro id_notario NO es un mecanismo de seguridad (ver notaria-download.service.ts).
 *     La funcionalidad NO debe liberarse a Producción sin RLS en cuentas_cobranza + pagos.
 *
 * Excepción administrador: notarioId puede ser cualquier id cuando el usuario
 * es tomas.peterson@investimento.mx — el selector administrativo en AppNotariaDashboard
 * gestiona esto antes de llamar al hook.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotariaRpPagoRow {
  id: number;
  fecha_pago: string | null;
  monto: number;
  clave_rastreo: string | null;
  id_metodos_pago: number;
  descripcion: string | null;
  url_recibo: string | null;
  url_cep: string | null;
  validacion_documental_efectivo: boolean;
  metodo_pago: string;
  id_cuenta_cobranza: number;
}

export interface NotariaRpAplicacionRow {
  id: number;
  monto: number;
  id_pago: number;
  es_multa: boolean;
  concepto_nombre: string | null;
}

export interface UseNotariaRelacionPagosResult {
  pagosPrincipal: NotariaRpPagoRow[];
  aplicacionesPrincipal: NotariaRpAplicacionRow[];
  pagosBodega: NotariaRpPagoRow[];
  aplicacionesBodega: NotariaRpAplicacionRow[];
  pagosEst: NotariaRpPagoRow[];
  aplicacionesEst: NotariaRpAplicacionRow[];
  idPropiedad: number | null;
  cuentaIdPrincipal: number | null;
  isLoading: boolean;
  isError: boolean;
}

// ─── Internal raw types ───────────────────────────────────────────────────────

type RawPago = {
  id: number;
  fecha_pago: string | null;
  monto: number;
  clave_rastreo: string | null;
  id_metodos_pago: number;
  descripcion: string | null;
  url_recibo: string | null;
  url_cep: string | null;
  validacion_documental_efectivo: boolean;
  id_cuenta_cobranza: number;
  metodos_pago: { nombre: string } | null;
};

type RawAplicacion = {
  id: number;
  monto: number;
  id_pago: number;
  es_multa: boolean;
  acuerdos_pago: {
    conceptos_pago: { nombre: string } | null;
  } | null;
};

function toRpPagoRow(raw: RawPago, cuentaId: number): NotariaRpPagoRow {
  return {
    id: raw.id,
    fecha_pago: raw.fecha_pago,
    monto: Number(raw.monto),
    clave_rastreo: raw.clave_rastreo,
    id_metodos_pago: raw.id_metodos_pago,
    descripcion: raw.descripcion,
    url_recibo: raw.url_recibo,
    url_cep: raw.url_cep,
    validacion_documental_efectivo: raw.validacion_documental_efectivo ?? false,
    metodo_pago: raw.metodos_pago?.nombre ?? 'Otro',
    id_cuenta_cobranza: raw.id_cuenta_cobranza ?? cuentaId,
  };
}

function toAplicacionRow(raw: RawAplicacion): NotariaRpAplicacionRow {
  return {
    id: raw.id,
    monto: Number(raw.monto),
    id_pago: raw.id_pago,
    es_multa: raw.es_multa,
    concepto_nombre: raw.acuerdos_pago?.conceptos_pago?.nombre ?? null,
  };
}

const PAGO_SELECT = 'id, fecha_pago, monto, clave_rastreo, id_metodos_pago, descripcion, url_recibo, url_cep, validacion_documental_efectivo, id_cuenta_cobranza, metodos_pago!pagos_id_metodos_pago_fkey(nombre)';
const APLICACION_SELECT = 'id, monto, id_pago, es_multa, acuerdos_pago!aplicaciones_pago_id_acuerdo_pago_fkey(conceptos_pago!acuerdos_pago_id_concepto_fkey(nombre))';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotariaRelacionPagos({
  cuentaId,
  notarioId,
  enabled = true,
}: {
  cuentaId: number | null;
  notarioId: number | null;
  enabled?: boolean;
}): UseNotariaRelacionPagosResult {
  const isEnabled = enabled && !!cuentaId && !!notarioId;

  // ── Paso 0: validación de pertenencia (seguridad MVP) ─────────────────────
  // Confirma que cc.id_notario = notarioId. Si falla, idPropiedad queda null
  // y todos los pasos siguientes permanecen deshabilitados.
  // ESTE FILTRO NO ES UN MECANISMO DE SEGURIDAD — ver notaria-download.service.ts.
  const { data: cuentaBase, isLoading: cuentaBaseLoading, isError } = useQuery({
    queryKey: ['notaria-rp-base', cuentaId, notarioId],
    enabled: isEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('cuentas_cobranza')
        .select('id, id_propiedad')
        .eq('id', cuentaId!)
        .eq('id_notario', notarioId!)
        .eq('activo', true)
        .single();
      if (error || !data) return null;
      return { idPropiedad: data.id_propiedad as number };
    },
  });

  const idPropiedad = cuentaBase?.idPropiedad ?? null;
  const securityPassed = cuentaBase !== undefined && cuentaBase !== null;

  // ── Paso 0.5: Resolver cuenta principal — regla institucional del RPC ─────
  // El RPC get_relacion_pagos identifica la cuenta principal con:
  //   tipo_cuenta = 'propiedad'  ↔  cc.id_propiedad IS NOT NULL
  //   producto = null             ↔  ofertas.id_producto IS NULL
  // Esta query replica fielmente esa lógica sin necesidad del RPC de búsqueda.
  // Fallback controlado: si no se resuelve, se usa la cuenta recibida (cuentaId).
  const { data: cuentaIdPrincipalResolved, isLoading: isLoadingPrincipal } = useQuery({
    queryKey: ['notaria-rp-cuenta-principal', idPropiedad],
    enabled: !!idPropiedad,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: cuentas } = await (supabase as any)
        .from('cuentas_cobranza')
        .select('id, id_oferta')
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);

      if (!cuentas?.length) return null;

      const ofertaIds = (cuentas as { id: number; id_oferta: number | null }[])
        .map(c => c.id_oferta)
        .filter((id): id is number => id != null);

      if (!ofertaIds.length) return null;

      const { data: ofertas } = await supabase
        .from('ofertas')
        .select('id, id_producto')
        .in('id', ofertaIds);

      const ofertaMap: Record<number, { id_producto: number | null }> = {};
      for (const o of ofertas ?? []) ofertaMap[(o as any).id] = o as any;

      const principal = (cuentas as { id: number; id_oferta: number | null }[]).find(c => {
        const oferta = c.id_oferta != null ? ofertaMap[c.id_oferta] : undefined;
        return oferta !== undefined && oferta.id_producto === null;
      });

      return typeof principal?.id === 'number' ? (principal.id as number) : null;
    },
  });

  // La cuenta efectiva para el waterfall de pagos principales:
  // — Si se resolvió una cuenta principal distinta a la recibida (caso accesoria), usarla.
  // — Fallback controlado: usar la cuenta recibida si no hay resolución.
  const cuentaIdPrincipal: number | null = idPropiedad
    ? (typeof cuentaIdPrincipalResolved === 'number' ? cuentaIdPrincipalResolved : null)
    : null;
  const effectiveCuentaId: number = cuentaIdPrincipal ?? cuentaId!;
  // Paso 1 y 2 esperan a que Paso 0.5 haya completado (evita flash de datos incorrectos)
  const principalReady = !idPropiedad || cuentaIdPrincipalResolved !== undefined;

  // ── Paso 1: pagos de la cuenta principal ─────────────────────────────────
  const { data: pagosPrincipalRaw = [], isLoading: isLoadingPrincipalPagos } = useQuery({
    queryKey: ['notaria-rp-principal-pagos', effectiveCuentaId],
    enabled: !!effectiveCuentaId && securityPassed && principalReady,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('pagos')
        .select(PAGO_SELECT)
        .eq('id_cuenta_cobranza', effectiveCuentaId)
        .eq('activo', true)
        .order('fecha_pago', { ascending: true });
      return (data ?? []) as RawPago[];
    },
  });

  const pagosPrincipal = pagosPrincipalRaw.map(p => toRpPagoRow(p, effectiveCuentaId));

  // ── Paso 2: aplicaciones de la cuenta principal ───────────────────────────
  const { data: aplicacionesPrincipalRaw = [], isLoading: isLoadingPrincipalApl } = useQuery({
    queryKey: ['notaria-rp-principal-aplicaciones', effectiveCuentaId],
    enabled: !!effectiveCuentaId && securityPassed && principalReady && pagosPrincipalRaw.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const pagoIds = pagosPrincipalRaw.map(p => p.id);
      if (!pagoIds.length) return [];
      const { data } = await (supabase as any)
        .from('aplicaciones_pago')
        .select(APLICACION_SELECT)
        .in('id_pago', pagoIds)
        .eq('activo', true);
      return (data ?? []) as RawAplicacion[];
    },
  });

  const aplicacionesPrincipal = aplicacionesPrincipalRaw.map(toAplicacionRow);

  // ── Paso 3: pagos de bodegas ──────────────────────────────────────────────
  const { data: pagosBodegaRaw = [], isLoading: isLoadingBodegaPagos } = useQuery({
    queryKey: ['notaria-rp-bodega-pagos', idPropiedad],
    enabled: !!idPropiedad,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: bodegas } = await supabase
        .from('bodegas')
        .select('id_producto')
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const productIds = [...new Set((bodegas ?? []).map(b => b.id_producto).filter(Boolean))] as number[];
      if (!productIds.length) return [];

      const { data: ofertas } = await supabase
        .from('ofertas')
        .select('id')
        .in('id_producto', productIds)
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const ofertaIds = (ofertas ?? []).map(o => o.id);
      if (!ofertaIds.length) return [];

      const { data: cuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id')
        .in('id_oferta', ofertaIds)
        .eq('activo', true);
      const cuentaBodegaIds = (cuentas ?? []).map(c => c.id);
      if (!cuentaBodegaIds.length) return [];

      const { data } = await (supabase as any)
        .from('pagos')
        .select(PAGO_SELECT)
        .in('id_cuenta_cobranza', cuentaBodegaIds)
        .eq('activo', true)
        .order('fecha_pago', { ascending: true });
      return (data ?? []) as RawPago[];
    },
  });

  const pagosBodega = pagosBodegaRaw.map(p => toRpPagoRow(p, p.id_cuenta_cobranza));

  // ── Paso 4: aplicaciones de bodegas ──────────────────────────────────────
  const { data: aplicacionesBodegaRaw = [], isLoading: isLoadingBodegaApl } = useQuery({
    queryKey: ['notaria-rp-bodega-aplicaciones', idPropiedad],
    enabled: !!idPropiedad && pagosBodegaRaw.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const pagoIds = pagosBodegaRaw.map(p => p.id);
      if (!pagoIds.length) return [];
      const { data } = await (supabase as any)
        .from('aplicaciones_pago')
        .select(APLICACION_SELECT)
        .in('id_pago', pagoIds)
        .eq('activo', true);
      return (data ?? []) as RawAplicacion[];
    },
  });

  const aplicacionesBodega = aplicacionesBodegaRaw.map(toAplicacionRow);

  // ── Paso 5: pagos de estacionamientos ────────────────────────────────────
  const { data: pagosEstRaw = [], isLoading: isLoadingEstPagos } = useQuery({
    queryKey: ['notaria-rp-est-pagos', idPropiedad],
    enabled: !!idPropiedad,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: estacionamientos } = await supabase
        .from('estacionamientos')
        .select('id_producto')
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const productIds = [...new Set((estacionamientos ?? []).map(e => e.id_producto).filter(Boolean))] as number[];
      if (!productIds.length) return [];

      const { data: ofertas } = await supabase
        .from('ofertas')
        .select('id')
        .in('id_producto', productIds)
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const ofertaIds = (ofertas ?? []).map(o => o.id);
      if (!ofertaIds.length) return [];

      const { data: cuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id')
        .in('id_oferta', ofertaIds)
        .eq('activo', true);
      const cuentaEstIds = (cuentas ?? []).map(c => c.id);
      if (!cuentaEstIds.length) return [];

      const { data } = await (supabase as any)
        .from('pagos')
        .select(PAGO_SELECT)
        .in('id_cuenta_cobranza', cuentaEstIds)
        .eq('activo', true)
        .order('fecha_pago', { ascending: true });
      return (data ?? []) as RawPago[];
    },
  });

  const pagosEst = pagosEstRaw.map(p => toRpPagoRow(p, p.id_cuenta_cobranza));

  // ── Paso 6: aplicaciones de estacionamientos ──────────────────────────────
  const { data: aplicacionesEstRaw = [], isLoading: isLoadingEstApl } = useQuery({
    queryKey: ['notaria-rp-est-aplicaciones', idPropiedad],
    enabled: !!idPropiedad && pagosEstRaw.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const pagoIds = pagosEstRaw.map(p => p.id);
      if (!pagoIds.length) return [];
      const { data } = await (supabase as any)
        .from('aplicaciones_pago')
        .select(APLICACION_SELECT)
        .in('id_pago', pagoIds)
        .eq('activo', true);
      return (data ?? []) as RawAplicacion[];
    },
  });

  const aplicacionesEst = aplicacionesEstRaw.map(toAplicacionRow);

  const isLoading =
    cuentaBaseLoading || isLoadingPrincipal ||
    isLoadingPrincipalPagos || isLoadingPrincipalApl ||
    isLoadingBodegaPagos || isLoadingBodegaApl ||
    isLoadingEstPagos || isLoadingEstApl;

  return {
    pagosPrincipal,
    aplicacionesPrincipal,
    pagosBodega,
    aplicacionesBodega,
    pagosEst,
    aplicacionesEst,
    idPropiedad,
    cuentaIdPrincipal,
    isLoading,
    isError,
  };
}
