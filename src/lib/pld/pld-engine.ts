// ─── Types ────────────────────────────────────────────────────────────────────

export type PldStatus =
  | 'APROBADO'
  | 'PENDIENTE'
  | 'INCOMPLETO'
  | 'EN_REVISION'
  | 'OBSERVADO'
  | 'BLOQUEADO';

export type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO';

export interface PagoInfo {
  id: number;
  monto: number;
  fecha_pago: string;
  clave_rastreo: string | null;
  url_cep: string | null;
  url_recibo: string | null;
  descripcion: string | null;
  id_metodos_pago: number | null; // 1 = efectivo
  nombre_ordenante: string | null;
  rfc_ordenante: string | null;
  curp_ordenante: string | null;
}

export interface OrdenanteDistinto {
  pagoId: number;
  monto: number;
  fecha_pago: string;
  nombre_ordenante: string;
  rfc_ordenante: string | null;
  curp_ordenante: string | null;
  clave_rastreo: string;
}

export interface PldResult {
  pldStatus: PldStatus;
  riesgo: RiskLevel;
  hasSinCR: boolean;
  hasSinCep: boolean;
  // Regla 1 — PRECAUCIÓN: nombre ordenante ≠ nombre cliente
  hasNombreDistinto: boolean;
  pagosNombreDistinto: OrdenanteDistinto[];
  // Regla 2 — BLOQUEO: RFC/CURP ordenante ≠ RFC/CURP cliente
  hasRfcDistinto: boolean;
  pagosRfcDistinto: OrdenanteDistinto[];
  // Regla 3 — BLOQUEO: efectivo excedido
  hasEfectivoExcedido: boolean;
  montoPagadoEfectivo: number;
  limiteEfectivo: number;
  // Regla 4 — INFO: CEP sin RFC
  hasCepSinRfc: boolean;
  // Regla 5 — INFO: comprador sin RFC/CURP
  hasBuyerSinRfc: boolean;
  // Legacy alias (backward compat)
  hasOrdenanteDistinto: boolean;
  pagosOrdenanteDistinto: OrdenanteDistinto[];
  escrituraBloqueada: boolean;
  totalPagado: number;
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

/** Minúsculas, sin tildes, sin caracteres especiales, espacios colapsados. */
export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // elimina diacríticos
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mayúsculas, sin espacios/guiones/puntos, solo alfanumérico + Ñ + &. */
export function normalizarRfc(s: string | null | undefined): string {
  return (s ?? '')
    .toUpperCase()
    .replace(/[\s\-.]/g, '')
    .replace(/[^A-ZÑ&0-9]/g, '')
    .trim();
}

/** Detecta si un rfc_curp_ordenante raw es RFC o CURP y clasifica. */
export function clasificarRfcCurp(raw: string | null): { rfc: string | null; curp: string | null } {
  if (!raw) return { rfc: null, curp: null };
  const v = raw.toUpperCase().replace(/[\s-]/g, '');
  // CURP: exactamente 18 chars con patrón específico
  if (/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$/.test(v)) return { rfc: null, curp: v };
  // RFC persona física (13) o moral (12)
  if (/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(v)) return { rfc: v, curp: null };
  // Ambiguo por longitud
  if (v.length >= 17) return { rfc: null, curp: v };
  if (v.length >= 9)  return { rfc: v, curp: null };
  return { rfc: null, curp: null };
}

// ─── PLD Engine ───────────────────────────────────────────────────────────────

/**
 * Motor PLD central. Aplica las 5 reglas y devuelve estatus, riesgo y listas
 * de pagos problemáticos. Sin side-effects, sin queries — solo lógica pura.
 */
export function derivePld(
  pagos: PagoInfo[],
  precioFinal: number,
  clienteNombre: string,
  clienteRfc: string | null,
  clienteCurp: string | null,
  valorUma: number,
): PldResult {
  const limiteEfectivo = (valorUma || 0) * 8025;
  const empty: PldResult = {
    pldStatus: 'PENDIENTE',
    riesgo: 'BAJO',
    hasSinCR: false,
    hasSinCep: false,
    hasNombreDistinto: false,
    pagosNombreDistinto: [],
    hasRfcDistinto: false,
    pagosRfcDistinto: [],
    hasEfectivoExcedido: false,
    montoPagadoEfectivo: 0,
    limiteEfectivo,
    hasCepSinRfc: false,
    hasBuyerSinRfc: false,
    hasOrdenanteDistinto: false,
    pagosOrdenanteDistinto: [],
    escrituraBloqueada: false,
    totalPagado: 0,
  };
  if (!pagos.length) return empty;

  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
  const hasSinCR    = pagos.some(p => !p.clave_rastreo);
  const hasSinCep   = pagos.some(p => p.clave_rastreo && !p.url_cep);

  const clienteNorm     = normalizarTexto(clienteNombre);
  const clienteRfcNorm  = normalizarRfc(clienteRfc);
  const clienteCurpNorm = normalizarRfc(clienteCurp);

  // ── Regla 1: Nombre ordenante ≠ nombre cliente → PRECAUCIÓN ───────────────
  const seenNombre = new Set<string>();
  const pagosNombreDistinto: OrdenanteDistinto[] = [];
  for (const p of pagos) {
    if (!p.clave_rastreo || !p.nombre_ordenante) continue;
    if (normalizarTexto(p.nombre_ordenante) === clienteNorm) continue;
    const key = normalizarTexto(p.nombre_ordenante);
    if (!seenNombre.has(key)) {
      seenNombre.add(key);
      pagosNombreDistinto.push({
        pagoId: p.id,
        monto: p.monto,
        fecha_pago: p.fecha_pago,
        nombre_ordenante: p.nombre_ordenante,
        rfc_ordenante: p.rfc_ordenante,
        curp_ordenante: p.curp_ordenante,
        clave_rastreo: p.clave_rastreo,
      });
    }
  }
  const hasNombreDistinto = pagosNombreDistinto.length > 0;

  // ── Regla 2: RFC/CURP ordenante ≠ RFC/CURP cliente → BLOQUEO ─────────────
  const hasBuyerSinRfc =
    !clienteRfcNorm &&
    !clienteCurpNorm &&
    pagos.some(p => p.clave_rastreo && (p.rfc_ordenante || p.curp_ordenante));

  const seenRfc = new Set<string>();
  const pagosRfcDistinto: OrdenanteDistinto[] = [];
  for (const p of pagos) {
    if (!p.clave_rastreo) continue;
    const rawCepVal = p.rfc_ordenante ?? p.curp_ordenante;
    if (!rawCepVal) continue;
    if (!clienteRfcNorm && !clienteCurpNorm) continue;
    const cepNorm     = normalizarRfc(rawCepVal);
    const matchesRfc  = !!clienteRfcNorm  && cepNorm === clienteRfcNorm;
    const matchesCurp = !!clienteCurpNorm && cepNorm === clienteCurpNorm;
    if (matchesRfc || matchesCurp) continue;
    if (!seenRfc.has(cepNorm)) {
      seenRfc.add(cepNorm);
      pagosRfcDistinto.push({
        pagoId: p.id,
        monto: p.monto,
        fecha_pago: p.fecha_pago,
        nombre_ordenante: p.nombre_ordenante ?? '—',
        rfc_ordenante: p.rfc_ordenante,
        curp_ordenante: p.curp_ordenante,
        clave_rastreo: p.clave_rastreo,
      });
    }
  }
  const hasRfcDistinto = pagosRfcDistinto.length > 0;

  // ── Regla 3: Efectivo excedido → BLOQUEO ──────────────────────────────────
  const montoPagadoEfectivo = pagos
    .filter(p => p.id_metodos_pago === 1)
    .reduce((s, p) => s + p.monto, 0);
  const hasEfectivoExcedido = limiteEfectivo > 0 && montoPagadoEfectivo > limiteEfectivo;

  // ── Status general ────────────────────────────────────────────────────────
  const escrituraBloqueada   = hasRfcDistinto || hasEfectivoExcedido;
  const hasOrdenanteDistinto = hasNombreDistinto || hasRfcDistinto;
  const pagosOrdenanteDistinto = pagosNombreDistinto; // legacy alias

  const riesgo: RiskLevel = escrituraBloqueada ? 'ALTO' : hasNombreDistinto ? 'MEDIO' : 'BAJO';

  let pldStatus: PldStatus;
  if (escrituraBloqueada) {
    pldStatus = 'BLOQUEADO';
  } else if (hasNombreDistinto) {
    pldStatus = 'OBSERVADO';
  } else if (precioFinal > 0 && totalPagado >= precioFinal * 0.99) {
    pldStatus = 'APROBADO';
  } else {
    pldStatus = 'PENDIENTE';
  }

  return {
    pldStatus,
    riesgo,
    hasSinCR,
    hasSinCep,
    hasNombreDistinto,
    pagosNombreDistinto,
    hasRfcDistinto,
    pagosRfcDistinto,
    hasEfectivoExcedido,
    montoPagadoEfectivo,
    limiteEfectivo,
    hasCepSinRfc: false,
    hasBuyerSinRfc,
    hasOrdenanteDistinto,
    pagosOrdenanteDistinto,
    escrituraBloqueada,
    totalPagado,
  };
}
