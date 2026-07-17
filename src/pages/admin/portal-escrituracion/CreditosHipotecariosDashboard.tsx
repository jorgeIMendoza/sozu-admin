import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Download, Loader2, X, RefreshCw, ChevronDown,
  Building2, Landmark, CheckCircle2, Clock, AlertTriangle,
  XCircle, FileText, Lock, DollarSign, CalendarDays,
  TrendingUp, ShieldCheck, ShieldAlert, BarChart3, Plus,
  Eye, FileCheck, FileX, CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type VoboStatus = 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO' | 'NO_APLICA';
type BankPaymentStatus = 'PENDIENTE' | 'PROGRAMADO' | 'PAGADO' | 'RECHAZADO' | 'PARCIAL';
type ReconciliationStatus = 'CONCILIADO' | 'DIFERENCIA' | 'PENDIENTE_CREDITO' | 'SOBREPAGO';
type SelectedBank = 'TODOS' | string;

interface Banco {
  id: number;
  nombre: string;
}

interface MortgageRow {
  cuentaId: number;
  cuentaLabel: string;
  creditoId: number;
  proyectoId: number;
  proyectoNombre: string;
  unidad: string;
  clienteNombre: string;
  bancoId: number | null;
  bancoNombre: string;
  escrituraValue: number;
  paidAmount: number;
  mortgageCreditAmount: number;
  requiredMortgageAmount: number;
  conciliatedAmount: number;
  difference: number;
  reconciliationStatus: ReconciliationStatus;
  voboStatus: VoboStatus;
  bankPaymentStatus: BankPaymentStatus;
  fechaCitaFirma: string | null;
  escrituraBloqueada: boolean;
  hasSinCR: boolean;
  fechaActualizacion: string;
}

// ─── Conciliation Engine ──────────────────────────────────────────────────────

const RECONCILIATION_TOLERANCE = 1;

function deriveReconciliation(
  paidAmount: number,
  mortgageCreditAmount: number,
  escrituraValue: number,
): { conciliatedAmount: number; difference: number; status: ReconciliationStatus } {
  if (mortgageCreditAmount === 0 && paidAmount === 0) {
    return { conciliatedAmount: 0, difference: escrituraValue, status: 'PENDIENTE_CREDITO' };
  }
  const conciliatedAmount = paidAmount + mortgageCreditAmount;
  const difference = escrituraValue - conciliatedAmount;
  let status: ReconciliationStatus;
  if (Math.abs(difference) <= RECONCILIATION_TOLERANCE) {
    status = 'CONCILIADO';
  } else if (difference > RECONCILIATION_TOLERANCE) {
    status = 'DIFERENCIA';
  } else {
    status = 'SOBREPAGO';
  }
  return { conciliatedAmount, difference, status };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const bom = '﻿';
  const lines = [headers, ...rows].map(r =>
    r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','),
  );
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Meta maps ────────────────────────────────────────────────────────────────

const VOBO_META: Record<VoboStatus, { label: string; cls: string }> = {
  PENDIENTE:   { label: 'Pendiente',   cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  EN_REVISION: { label: 'En revisión', cls: 'bg-sky-50 text-sky-700 border border-sky-200' },
  APROBADO:    { label: 'Aprobado',    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  RECHAZADO:   { label: 'Rechazado',   cls: 'bg-red-50 text-red-700 border border-red-200' },
  NO_APLICA:   { label: 'N/A',         cls: 'bg-slate-100 text-slate-500' },
};

const BANK_PAYMENT_META: Record<BankPaymentStatus, { label: string; cls: string }> = {
  PENDIENTE:   { label: 'Pendiente',   cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  PROGRAMADO:  { label: 'Programado',  cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  PAGADO:      { label: 'Pagado',      cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  RECHAZADO:   { label: 'Rechazado',   cls: 'bg-red-50 text-red-700 border border-red-200' },
  PARCIAL:     { label: 'Parcial',     cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
};

const RECONCILIATION_META: Record<ReconciliationStatus, { label: string; cls: string }> = {
  CONCILIADO:       { label: 'Conciliado',     cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  DIFERENCIA:       { label: 'Diferencia',     cls: 'bg-red-50 text-red-700 border border-red-200' },
  SOBREPAGO:        { label: 'Sobrepago',       cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  PENDIENTE_CREDITO:{ label: 'Pte. crédito',   cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 animate-pulse rounded-lg ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-8 w-8 rounded-xl" />
      </div>
      <Shimmer className="h-8 w-20 mb-2" />
      <div className="space-y-1.5 mt-3">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-3/4" />
        <Shimmer className="h-3 w-2/3" />
      </div>
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function VoboBadge({ status }: { status: VoboStatus }) {
  const m = VOBO_META[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
}

function BankPaymentBadge({ status }: { status: BankPaymentStatus }) {
  const m = BANK_PAYMENT_META[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
}

function ReconciliationBadge({ status, difference }: { status: ReconciliationStatus; difference: number }) {
  const m = RECONCILIATION_META[status];
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {m.label}
      </span>
      {status !== 'CONCILIADO' && status !== 'PENDIENTE_CREDITO' && (
        <span className={`text-xs font-mono font-semibold ${difference < 0 ? 'text-violet-600' : 'text-red-600'}`}>
          {difference < 0 ? '+' : ''}{fmtMxn(Math.abs(difference))}
        </span>
      )}
    </div>
  );
}

function BlockedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
      <Lock className="w-3 h-3" /> PLD
    </span>
  );
}

// ─── Bank Card ────────────────────────────────────────────────────────────────

interface BankStats {
  totalCredit: number;
  inProcess: number;
  voboApproved: number;
  signingAppts: number;
  paidToDev: number;
  differences: number;
}

function getBankStats(rows: MortgageRow[], bankFilter: string): BankStats {
  const filtered = bankFilter === 'TODOS'
    ? rows
    : rows.filter(r => r.bancoNombre.toLowerCase() === bankFilter.toLowerCase());
  return {
    totalCredit:  filtered.reduce((s, r) => s + r.mortgageCreditAmount, 0),
    inProcess:    filtered.length,
    voboApproved: filtered.filter(r => r.voboStatus === 'APROBADO').length,
    signingAppts: filtered.filter(r => r.fechaCitaFirma !== null).length,
    paidToDev:    filtered.filter(r => r.bankPaymentStatus === 'PAGADO').length,
    differences:  filtered.filter(r => r.reconciliationStatus === 'DIFERENCIA' || r.reconciliationStatus === 'SOBREPAGO').length,
  };
}

const BANK_COLOR: Record<string, { bg: string; icon: string; border: string; accent: string }> = {
  bbva:      { bg: 'bg-blue-50',    icon: 'text-blue-600',    border: 'border-blue-200',    accent: 'text-blue-600' },
  santander: { bg: 'bg-red-50',     icon: 'text-red-600',     border: 'border-red-200',     accent: 'text-red-600' },
  banorte:   { bg: 'bg-orange-50',  icon: 'text-orange-600',  border: 'border-orange-200',  accent: 'text-orange-600' },
  todos:     { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-200', accent: 'text-emerald-600' },
};

function bankColor(name: string) {
  const lower = name.toLowerCase();
  if (lower === 'todos') return BANK_COLOR.todos;
  if (lower.includes('bbva'))      return BANK_COLOR.bbva;
  if (lower.includes('santander')) return BANK_COLOR.santander;
  if (lower.includes('banorte'))   return BANK_COLOR.banorte;
  return BANK_COLOR.todos;
}

function BankCard({
  name,
  stats,
  selected,
  onClick,
  loading,
}: {
  name: string;
  stats: BankStats;
  selected: boolean;
  onClick: () => void;
  loading?: boolean;
}) {
  if (loading) return <CardSkeleton />;
  const col = bankColor(name === 'TODOS' ? 'todos' : name);
  const pct = stats.inProcess > 0 ? Math.round((stats.paidToDev / stats.inProcess) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className={`text-left w-full bg-white border-2 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${
        selected ? `border-emerald-500 ring-2 ring-emerald-500/20` : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {name === 'TODOS' ? 'Todos los bancos' : name}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">crédito hipotecario</p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ml-2 ${col.bg}`}>
          <Landmark className={`w-4 h-4 ${col.icon}`} />
        </div>
      </div>

      <p className={`text-2xl font-bold tabular-nums mb-0.5 ${col.accent}`}>
        {fmtMxn(stats.totalCredit)}
      </p>
      <p className="text-xs text-slate-500 mb-3">crédito total</p>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Pagados al dev.</span>
          <span className={`font-semibold ${col.accent}`}>{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Mini stats */}
      <div className="space-y-1.5">
        {[
          { label: 'En proceso',    value: stats.inProcess,    color: 'text-slate-700' },
          { label: 'VoBo aprobado', value: stats.voboApproved, color: 'text-emerald-600' },
          { label: 'Citas de firma',value: stats.signingAppts, color: 'text-sky-600' },
          { label: 'Pagados a dev', value: stats.paidToDev,    color: 'text-teal-600' },
          { label: 'Diferencias',   value: stats.differences,  color: stats.differences > 0 ? 'text-red-600' : 'text-slate-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{label}</span>
            <span className={`text-xs font-semibold tabular-nums ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {stats.differences > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-red-600 bg-red-50 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-medium">{stats.differences} diferencia{stats.differences !== 1 ? 's' : ''}</span>
        </div>
      )}
    </button>
  );
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <div className="text-xs font-medium text-slate-900 text-right ml-3">{children}</div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  row,
  onClose,
  onVoboUpdate,
  onBankPaymentUpdate,
  updatingVobo,
  updatingPayment,
}: {
  row: MortgageRow;
  onClose: () => void;
  onVoboUpdate: (creditoId: number, status: VoboStatus) => void;
  onBankPaymentUpdate: (creditoId: number, status: BankPaymentStatus) => void;
  updatingVobo: boolean;
  updatingPayment: boolean;
}) {
  const navigate = useNavigate();
  const isBlocked = row.escrituraBloqueada;
  const canScheduleFirma = row.voboStatus === 'APROBADO' && !isBlocked;
  const canMarkPaid = !isBlocked;

  const conciliationPct = row.escrituraValue > 0
    ? Math.min(100, Math.round((row.conciliatedAmount / row.escrituraValue) * 100))
    : 0;

  return (
    <div className="w-[360px] min-w-[360px] bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/50">
        <div>
          <p className="text-sm font-bold text-slate-900">{row.cuentaLabel}</p>
          <p className="text-xs text-slate-500 mt-0.5">{row.proyectoNombre} · Unidad {row.unidad}</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* PLD block banner */}
        {isBlocked && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-3 py-3">
            <Lock className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700">Escritura bloqueada — PLD</p>
              <p className="text-xs text-red-600 mt-0.5">
                {row.hasSinCR
                  ? 'Pagos sin clave de rastreo STP detectados.'
                  : 'Sobrepago detectado. Requiere revisión.'}
              </p>
            </div>
          </div>
        )}

        {/* Ficha principal */}
        <div className="bg-slate-50 rounded-2xl p-3">
          <DetailRow label="Cliente">{row.clienteNombre}</DetailRow>
          <DetailRow label="Banco">
            <span className="font-semibold">{row.bancoNombre || '—'}</span>
          </DetailRow>
          <DetailRow label="Actualizado">{fmtDate(row.fechaActualizacion)}</DetailRow>
        </div>

        {/* Conciliación */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Conciliación</p>
          <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
            <DetailRow label="Valor escritura">{fmtMxn(row.escrituraValue)}</DetailRow>
            <DetailRow label="Pagado por cliente">{fmtMxn(row.paidAmount)}</DetailRow>
            <DetailRow label="Crédito requerido">{fmtMxn(row.requiredMortgageAmount)}</DetailRow>
            <DetailRow label="Crédito registrado">{fmtMxn(row.mortgageCreditAmount)}</DetailRow>
            <div className="border-t border-slate-200 pt-2 mt-1">
              <DetailRow label="Total conciliado">
                <span className="font-bold text-slate-900">{fmtMxn(row.conciliatedAmount)}</span>
              </DetailRow>
              <DetailRow label="Diferencia">
                <span className={`font-bold ${Math.abs(row.difference) <= 1 ? 'text-emerald-600' : row.difference > 0 ? 'text-red-600' : 'text-violet-600'}`}>
                  {row.difference === 0 ? '$ 0' : `${row.difference > 0 ? '-' : '+'}${fmtMxn(Math.abs(row.difference))}`}
                </span>
              </DetailRow>
            </div>
            <div className="pt-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500">Avance</span>
                <span className="font-semibold text-emerald-600">{conciliationPct}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    row.reconciliationStatus === 'CONCILIADO' ? 'bg-emerald-500'
                    : row.reconciliationStatus === 'SOBREPAGO' ? 'bg-violet-500'
                    : 'bg-amber-400'
                  }`}
                  style={{ width: `${conciliationPct}%` }}
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <ReconciliationBadge status={row.reconciliationStatus} difference={row.difference} />
            </div>
          </div>
        </div>

        {/* VoBo Banco */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">VoBo Banco</p>
          <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
            <DetailRow label="Estatus"><VoboBadge status={row.voboStatus} /></DetailRow>
            {row.fechaCitaFirma && (
              <DetailRow label="Cita de firma">{fmtDate(row.fechaCitaFirma)}</DetailRow>
            )}
            <div className="flex gap-2 pt-1">
              <button
                disabled={isBlocked || updatingVobo || row.voboStatus === 'APROBADO'}
                onClick={() => onVoboUpdate(row.creditoId, 'APROBADO')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-medium transition-colors"
              >
                {updatingVobo ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Aprobar
              </button>
              <button
                disabled={isBlocked || updatingVobo || row.voboStatus === 'RECHAZADO'}
                onClick={() => onVoboUpdate(row.creditoId, 'RECHAZADO')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-700 text-xs font-medium transition-colors"
              >
                <XCircle className="w-3 h-3" />
                Rechazar
              </button>
            </div>
            <button
              disabled={isBlocked || updatingVobo}
              onClick={() => onVoboUpdate(row.creditoId, 'EN_REVISION')}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600 text-xs transition-colors"
            >
              <Eye className="w-3 h-3" />
              Marcar en revisión
            </button>
          </div>
        </div>

        {/* Pago banco al desarrollador */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pago banco al desarrollador</p>
          <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
            <DetailRow label="Estatus"><BankPaymentBadge status={row.bankPaymentStatus} /></DetailRow>
            <div className="flex gap-2 pt-1">
              <button
                disabled={!canMarkPaid || updatingPayment || row.bankPaymentStatus === 'PAGADO'}
                onClick={() => onBankPaymentUpdate(row.creditoId, 'PAGADO')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-medium transition-colors"
              >
                {updatingPayment ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                Pagado
              </button>
              <button
                disabled={!canMarkPaid || updatingPayment}
                onClick={() => onBankPaymentUpdate(row.creditoId, 'PROGRAMADO')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-700 text-xs font-medium transition-colors"
              >
                <Clock className="w-3 h-3" />
                Programar
              </button>
            </div>
            {!canMarkPaid && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Acción bloqueada por PLD
              </p>
            )}
          </div>
        </div>

        {/* Acciones rápidas */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Acciones rápidas</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={!canScheduleFirma}
              onClick={() => toast.warning(
                row.voboStatus !== 'APROBADO'
                  ? 'Se requiere VoBo aprobado para programar la firma'
                  : 'Escritura bloqueada por PLD'
              )}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />Programar firma
            </button>
            <button
              onClick={() => toast.info('Las notas se registran en el perfil del comprador dentro del módulo de Expedientes.')}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />Agregar nota
            </button>
            <button
              onClick={() => downloadCsv(
                `credito_${row.cuentaLabel}_${row.clienteNombre.replace(/\s+/g, '_')}.csv`,
                ['Cuenta','Proyecto','Unidad','Cliente','Banco','VoBo','Pago banco','Conciliación','Crédito','Fecha firma'],
                [[
                  row.cuentaLabel,
                  row.proyectoNombre,
                  row.unidad,
                  row.clienteNombre,
                  row.bancoNombre,
                  VOBO_META[row.voboStatus]?.label ?? row.voboStatus,
                  BANK_PAYMENT_META[row.bankPaymentStatus]?.label ?? row.bankPaymentStatus,
                  RECONCILIATION_META[row.reconciliationStatus]?.label ?? row.reconciliationStatus,
                  fmtMxn(row.mortgageCreditAmount),
                  fmtDate(row.fechaCitaFirma),
                ]],
              )}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />Descargar exp.
            </button>
            <button
              onClick={() => navigate(`/admin/portal-escrituracion/expedientes?cuenta=${row.cuentaId}`)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-slate-50 transition-colors"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />Ver documentos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ title, sub, onRetry, noDDL }: { title: string; sub?: string; onRetry?: () => void; noDDL?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Landmark className="w-8 h-8 text-slate-300" />
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {sub && <p className="text-xs text-slate-400 text-center max-w-xs">{sub}</p>}
      {noDDL && (
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 max-w-sm text-left">
          <p className="text-xs font-semibold text-amber-800 mb-1">Tabla no encontrada</p>
          <p className="text-xs text-amber-700">
            Ejecutar el DDL en{' '}
            <code className="font-mono bg-amber-100 px-1 rounded">
              Ejecuciones_manuales/creditos_hipotecarios_schema.md
            </code>{' '}
            para habilitar este módulo.
          </p>
        </div>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export function CreditosHipotecariosDashboard() {
  const qc = useQueryClient();

  // UI state
  const [proyectoId, setProyectoId]           = useState<number | null>(null);
  const [proyectoNombre, setProyectoNombre]   = useState('');
  const [selectedBank, setSelectedBank]       = useState<SelectedBank>('TODOS');
  const [search, setSearch]                   = useState('');
  const [filtroVoBo, setFiltroVoBo]           = useState<VoboStatus | 'TODOS'>('TODOS');
  const [filtroPago, setFiltroPago]           = useState<BankPaymentStatus | 'TODOS'>('TODOS');
  const [filtroConc, setFiltroConc]           = useState<ReconciliationStatus | 'TODOS'>('TODOS');
  const [page, setPage]                       = useState(0);
  const [selected, setSelected]               = useState<MortgageRow | null>(null);
  const [tableError, setTableError]           = useState(false);

  useEffect(() => { setPage(0); }, [proyectoId, selectedBank, search, filtroVoBo, filtroPago, filtroConc]);

  // ── Proyectos ──────────────────────────────────────────────────────────────
  const { data: proyectos = [], isLoading: loadingProyectos } = useQuery({
    queryKey: ['proyectos-creditos-dashboard'],
    queryFn: async () => {
      const { data: rels } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto')
        .eq('id_tipo_entidad', 5)
        .eq('activo', true);
      const ids = (rels || []).map((r: any) => r.id_proyecto).filter(Boolean);
      if (!ids.length) return [];
      const { data } = await supabase
        .from('proyectos').select('id, nombre').in('id', ids).eq('publicar', true).eq('activo', true).order('nombre');
      return (data || []) as { id: number; nombre: string }[];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (proyectos.length > 0 && !proyectoId) {
      setProyectoId(proyectos[0].id);
      setProyectoNombre(proyectos[0].nombre);
    }
  }, [proyectos, proyectoId]);

  // ── Bancos ─────────────────────────────────────────────────────────────────
  const { data: bancos = [] } = useQuery<Banco[]>({
    queryKey: ['bancos-hipotecarios'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bancos')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      return (data || []) as Banco[];
    },
    staleTime: 300_000,
  });

  // ── Main data ──────────────────────────────────────────────────────────────
  const {
    data: rows = [],
    isLoading: loadingRows,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['creditos-hipotecarios-dashboard', proyectoId],
    queryFn: async (): Promise<MortgageRow[]> => {
      if (!proyectoId) return [];
      setTableError(false);

      // Paso 1: edificios → modelos → propiedades → cuentas
      const { data: edificios } = await supabase
        .from('edificios').select('id').eq('id_proyecto', proyectoId).eq('activo', true);
      if (!edificios?.length) return [];

      const { data: modelos } = await supabase
        .from('edificios_modelos').select('id').in('id_edificio', edificios.map((e: any) => e.id));
      if (!modelos?.length) return [];

      const { data: props } = await supabase
        .from('propiedades')
        .select('id, numero_propiedad, fecha_actualizacion')
        .eq('activo', true)
        .in('id_edificio_modelo', modelos.map((m: any) => m.id))
        .order('numero_propiedad');
      if (!props?.length) return [];

      const propIds = props.map((p: any) => p.id);

      // Paso 2: cuentas de cobranza — todas las cuentas activas de las propiedades
      const { data: cuentasList } = await supabase
        .from('cuentas_cobranza')
        .select('id, id_propiedad, precio_final, id_oferta, fecha_actualizacion, tipo_financiamiento')
        .eq('activo', true)
        .in('id_propiedad', propIds);
      if (!cuentasList?.length) return [];

      // Paso 2b: clasificar principal vs escriturable via bodegas + estacionamientos
      const ofertaIdsAll = [...new Set((cuentasList as any[]).map(c => c.id_oferta).filter(Boolean))];
      const ofertaMap: Record<number, { id_producto: number | null }> = {};
      if (ofertaIdsAll.length) {
        const { data: ofertasList } = await supabase
          .from('ofertas').select('id, id_producto').in('id', ofertaIdsAll);
        (ofertasList || []).forEach((o: any) => { ofertaMap[o.id] = { id_producto: o.id_producto ?? null }; });
      }

      // Paso 2c: productos escriturables por propiedad (solo los que aparecen en bodegas o estacionamientos)
      const [{ data: bodegasAll }, { data: estacAll }] = await Promise.all([
        supabase.from('bodegas').select('id_propiedad, id_producto').in('id_propiedad', propIds).eq('activo', true),
        supabase.from('estacionamientos').select('id_propiedad, id_producto').in('id_propiedad', propIds).eq('activo', true),
      ]);
      const escriturableProds: Record<number, Set<number>> = {};
      [...(bodegasAll || []), ...(estacAll || [])].forEach((x: any) => {
        if (!escriturableProds[x.id_propiedad]) escriturableProds[x.id_propiedad] = new Set();
        if (x.id_producto) escriturableProds[x.id_propiedad].add(x.id_producto);
      });

      // Clasificar cada cuenta: principal (depto), escriturable (bodega/estac con oferta propia), o comercial
      // Excluye: condensadoras, paquetes amueblados y cualquier producto no registrado en bodegas/estacionamientos
      const principalByProp: Record<number, any> = {};
      const escriturablesByProp: Record<number, any[]> = {};
      (cuentasList as any[]).forEach(c => {
        const idProd = ofertaMap[c.id_oferta]?.id_producto ?? null;
        const isPrincipal = !idProd;
        const isEscriturable = isPrincipal ||
          (idProd !== null && (escriturableProds[c.id_propiedad]?.has(idProd) ?? false));
        if (isPrincipal && !principalByProp[c.id_propiedad]) principalByProp[c.id_propiedad] = c;
        if (isEscriturable) {
          if (!escriturablesByProp[c.id_propiedad]) escriturablesByProp[c.id_propiedad] = [];
          escriturablesByProp[c.id_propiedad].push(c);
        }
      });

      const principalIds = Object.values(principalByProp).map((c: any) => c.id);
      const allEscriturableIds = Object.values(escriturablesByProp).flat().map((c: any) => c.id);
      if (!principalIds.length) return [];

      // Mapa inverso: cuentaId principal → propId (para búsqueda O(1) en construcción de filas)
      const principalIdToPropId: Record<number, number> = {};
      Object.entries(principalByProp).forEach(([propId, c]) => {
        principalIdToPropId[(c as any).id] = Number(propId);
      });

      // Paso 3: creditos_hipotecarios (tabla nueva — puede no existir aún)
      const { data: creditos, error: creditosError } = await (supabase as any)
        .from('creditos_hipotecarios')
        .select('id, id_cuenta_cobranza, id_banco, monto_credito, vobo_banco, pago_banco_estatus, fecha_cita_firma, fecha_actualizacion')
        .in('id_cuenta_cobranza', principalIds)
        .eq('activo', true);

      if (creditosError) {
        // Tabla no existe aún → mostrar estado especial
        setTableError(true);
        return [];
      }

      if (!creditos?.length) return [];

      // Paso 4: banco lookup
      const bancoIds = [...new Set((creditos as any[]).map(c => c.id_banco).filter(Boolean))];
      const bancoMap: Record<number, string> = {};
      if (bancoIds.length) {
        const { data: bancosData } = await supabase
          .from('bancos').select('id, nombre').in('id', bancoIds);
        (bancosData || []).forEach((b: any) => { bancoMap[b.id] = b.nombre; });
      }

      // Paso 5: pagos totales por cuenta (solo propiedades con crédito hipotecario)
      const propIdsConCredito = new Set(
        (creditos as any[])
          .map((cr: any) => principalIdToPropId[Number(cr.id_cuenta_cobranza)])
          .filter((id): id is number => id !== undefined),
      );
      const relevantEscriturableIds = Object.entries(escriturablesByProp)
        .filter(([propId]) => propIdsConCredito.has(Number(propId)))
        .flatMap(([, cuentas]) => (cuentas as any[]).map((c: any) => Number(c.id)));

      let pagosData: any[] = [];
      if (relevantEscriturableIds.length) {
        const { data: pagosResult, error: pagosError } = await supabase
          .from('pagos')
          .select('id_cuenta_cobranza, monto, clave_rastreo')
          .in('id_cuenta_cobranza', relevantEscriturableIds)
          .eq('activo', true);
        if (pagosError) throw pagosError;
        pagosData = pagosResult ?? [];
      }

      const pagosByCuenta: Record<number, { total: number; hasSinCR: boolean }> = {};
      pagosData.forEach((p: any) => {
        if (!pagosByCuenta[p.id_cuenta_cobranza]) {
          pagosByCuenta[p.id_cuenta_cobranza] = { total: 0, hasSinCR: false };
        }
        pagosByCuenta[p.id_cuenta_cobranza].total += p.monto;
        if (!p.clave_rastreo) pagosByCuenta[p.id_cuenta_cobranza].hasSinCR = true;
      });

      // Paso 6: compradores + personas
      const { data: comprsList } = await supabase
        .from('compradores').select('id_cuenta_cobranza, id_persona').in('id_cuenta_cobranza', principalIds).eq('activo', true);
      const personaIds = [...new Set((comprsList || []).map((c: any) => c.id_persona))];
      const personaMap: Record<number, string> = {};
      if (personaIds.length) {
        const { data: personas } = await supabase.from('personas').select('id, nombre_legal').in('id', personaIds);
        (personas || []).forEach((p: any) => { personaMap[p.id] = p.nombre_legal; });
      }
      const clienteByCuenta: Record<number, string> = {};
      (comprsList || []).forEach((c: any) => {
        if (!clienteByCuenta[c.id_cuenta_cobranza]) clienteByCuenta[c.id_cuenta_cobranza] = personaMap[c.id_persona] ?? '—';
      });

      // Paso 7: armar propMap
      const propMap: Record<number, string> = {};
      props.forEach((p: any) => { propMap[p.id] = p.numero_propiedad; });

      // Paso 8: construir filas
      return (creditos as any[]).map(cr => {
        const propIdNum = principalIdToPropId[cr.id_cuenta_cobranza] ?? 0;
        const cuenta = principalByProp[propIdNum];
        if (!cuenta) return null;

        const unidad = propMap[propIdNum] ?? '—';

        // Escritura = suma de cuentas escriturables (depto + bodega + estac escriturable)
        // Excluye condensadoras, paquetes amueblados y cualquier producto comercial no escriturable
        const cuentasEscriturables = escriturablesByProp[propIdNum] ?? [cuenta];
        const escrituraValue = cuentasEscriturables.reduce(
          (s: number, c: any) => s + Number(c.precio_final ?? 0), 0,
        );

        // Pagado = suma de pagos de cuentas escriturables únicamente
        const paidAmount = cuentasEscriturables.reduce(
          (s: number, c: any) => s + (pagosByCuenta[c.id]?.total ?? 0), 0,
        );
        const hasSinCR = cuentasEscriturables.some((c: any) => pagosByCuenta[c.id]?.hasSinCR ?? false);

        const registeredMortgageAmount = Number(cr.monto_credito ?? 0);
        const requiredMortgageAmount = Math.max(escrituraValue - paidAmount, 0);
        const sobrepago = escrituraValue > 0 && paidAmount > escrituraValue * 1.01;
        const escrituraBloqueada = hasSinCR || sobrepago;

        const { conciliatedAmount, difference, status: reconciliationStatus } = deriveReconciliation(
          paidAmount, registeredMortgageAmount, escrituraValue,
        );

        return {
          cuentaId: cuenta.id,
          cuentaLabel: `CC-${String(cuenta.id).padStart(6, '0')}`,
          creditoId: cr.id,
          proyectoId: proyectoId!,
          proyectoNombre,
          unidad,
          clienteNombre: clienteByCuenta[cuenta.id] ?? '—',
          bancoId: cuenta.tipo_financiamiento === 'CREDITO_HIPOTECARIO' ? (cr.id_banco ?? null) : null,
          bancoNombre: cuenta.tipo_financiamiento === 'CREDITO_HIPOTECARIO' && cr.id_banco
            ? (bancoMap[cr.id_banco] ?? '—')
            : '—',
          escrituraValue,
          paidAmount,
          mortgageCreditAmount: registeredMortgageAmount,
          requiredMortgageAmount,
          conciliatedAmount,
          difference,
          reconciliationStatus,
          voboStatus: (cr.vobo_banco as VoboStatus) ?? 'PENDIENTE',
          bankPaymentStatus: (cr.pago_banco_estatus as BankPaymentStatus) ?? 'PENDIENTE',
          fechaCitaFirma: cr.fecha_cita_firma ?? null,
          escrituraBloqueada,
          hasSinCR,
          fechaActualizacion: cr.fecha_actualizacion ?? cuenta.fecha_actualizacion,
        } satisfies MortgageRow;
      }).filter(Boolean) as MortgageRow[];
    },
    enabled: !!proyectoId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateVoboMutation = useMutation({
    mutationFn: async ({ creditoId, status }: { creditoId: number; status: VoboStatus }) => {
      const { error } = await (supabase as any)
        .from('creditos_hipotecarios')
        .update({ vobo_banco: status, fecha_actualizacion: new Date().toISOString() })
        .eq('id', creditoId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['creditos-hipotecarios-dashboard', proyectoId] });
      const labels: Record<VoboStatus, string> = {
        APROBADO: 'VoBo banco aprobado', RECHAZADO: 'VoBo banco rechazado',
        EN_REVISION: 'VoBo en revisión', PENDIENTE: 'VoBo marcado pendiente', NO_APLICA: 'VoBo N/A',
      };
      toast.success(labels[status]);
      setSelected(null);
    },
    onError: () => toast.error('Error al actualizar VoBo banco'),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ creditoId, status }: { creditoId: number; status: BankPaymentStatus }) => {
      const { error } = await (supabase as any)
        .from('creditos_hipotecarios')
        .update({ pago_banco_estatus: status, fecha_actualizacion: new Date().toISOString() })
        .eq('id', creditoId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['creditos-hipotecarios-dashboard', proyectoId] });
      const labels: Record<BankPaymentStatus, string> = {
        PAGADO: 'Banco marcado como pagado al desarrollador',
        PROGRAMADO: 'Pago programado',
        PENDIENTE: 'Estatus actualizado a pendiente',
        RECHAZADO: 'Pago rechazado registrado',
        PARCIAL: 'Pago parcial registrado',
      };
      toast.success(labels[status]);
      setSelected(null);
    },
    onError: () => toast.error('Error al actualizar pago banco'),
  });

  // ── Bank stats ─────────────────────────────────────────────────────────────
  const todosStats = useMemo(() => getBankStats(rows, 'TODOS'), [rows]);

  // Bancos hipotecarios relevantes (BBVA, Santander, Banorte)
  const mortgageBancos = useMemo(() => (
    bancos.filter(b => {
      const l = b.nombre.toLowerCase();
      return l.includes('bbva') || l.includes('santander') || l.includes('banorte');
    })
  ), [bancos]);

  const [visibleBanks, setVisibleBanks] = useState<Set<string>>(new Set());

  // Inicializar con todos los bancos hipotecarios al cargarlos
  useEffect(() => {
    if (mortgageBancos.length > 0 && visibleBanks.size === 0) {
      setVisibleBanks(new Set(mortgageBancos.map(b => b.nombre)));
    }
  }, [mortgageBancos]);

  const toggleBank = (nombre: string) => {
    setVisibleBanks(prev => {
      const next = new Set(prev);
      if (next.has(nombre)) { next.delete(nombre); } else { next.add(nombre); }
      return next;
    });
  };

  const bankCardList = useMemo(() => (
    ['TODOS', ...mortgageBancos.filter(b => visibleBanks.has(b.nombre)).map(b => b.nombre)]
  ), [mortgageBancos, visibleBanks]);

  // ── Global KPIs ────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    total:       rows.length,
    totalCredit: rows.reduce((s, r) => s + r.mortgageCreditAmount, 0),
    totalPaid:   rows.reduce((s, r) => s + r.paidAmount, 0),
    conciliados: rows.filter(r => r.reconciliationStatus === 'CONCILIADO').length,
    diferencias: rows.filter(r => r.reconciliationStatus === 'DIFERENCIA' || r.reconciliationStatus === 'SOBREPAGO').length,
    voboOk:      rows.filter(r => r.voboStatus === 'APROBADO').length,
    bancoPagado: rows.filter(r => r.bankPaymentStatus === 'PAGADO').length,
    bloqueados:  rows.filter(r => r.escrituraBloqueada).length,
  }), [rows]);

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      if (selectedBank !== 'TODOS' && r.bancoNombre.toLowerCase() !== selectedBank.toLowerCase()) return false;
      if (filtroVoBo !== 'TODOS' && r.voboStatus !== filtroVoBo) return false;
      if (filtroPago !== 'TODOS' && r.bankPaymentStatus !== filtroPago) return false;
      if (filtroConc !== 'TODOS' && r.reconciliationStatus !== filtroConc) return false;
      if (q && !`${r.cuentaLabel} ${r.unidad} ${r.clienteNombre} ${r.bancoNombre}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, selectedBank, search, filtroVoBo, filtroPago, filtroConc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleProyecto = (id: number) => {
    const p = proyectos.find(x => x.id === id);
    if (p) { setProyectoId(p.id); setProyectoNombre(p.nombre); setSelected(null); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Créditos Hipotecarios</h1>
          <p className="text-sm text-slate-500 mt-0.5">Control de créditos, VoBo bancario y conciliación</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Proyecto selector */}
          <div className="relative">
            <select
              value={proyectoId ?? ''}
              onChange={e => handleProyecto(Number(e.target.value))}
              disabled={loadingProyectos}
              className="appearance-none bg-white border border-slate-200 text-sm font-medium text-slate-700 rounded-xl pl-3 pr-8 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50"
            >
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button
            onClick={() => toast.info('Los créditos hipotecarios se asignan desde el módulo de Cobranza al configurar el esquema de pago.')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo crédito
          </button>
          <button
            onClick={() => downloadCsv(
              `creditos_hipotecarios_${proyectoId ?? 'todos'}_${new Date().toISOString().slice(0, 10)}.csv`,
              ['Cuenta','Proyecto','Unidad','Cliente','Banco','VoBo','Pago banco','Conciliación','Crédito requerido','Crédito registrado','Escritura','Diferencia','Fecha firma'],
              filtered.map(r => [
                r.cuentaLabel,
                r.proyectoNombre,
                r.unidad,
                r.clienteNombre,
                r.bancoNombre,
                VOBO_META[r.voboStatus]?.label ?? r.voboStatus,
                BANK_PAYMENT_META[r.bankPaymentStatus]?.label ?? r.bankPaymentStatus,
                RECONCILIATION_META[r.reconciliationStatus]?.label ?? r.reconciliationStatus,
                fmtMxn(r.requiredMortgageAmount),
                fmtMxn(r.mortgageCreditAmount),
                fmtMxn(r.escrituraValue),
                fmtMxn(r.difference),
                fmtDate(r.fechaCitaFirma),
              ]),
            )}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* KPI chips */}
      {!loadingRows && rows.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: `${kpis.total} expedientes`,               cls: 'bg-slate-100 text-slate-700' },
            { label: `${fmtMxn(kpis.totalCredit)} en crédito`,  cls: 'bg-blue-50 text-blue-700' },
            { label: `${kpis.conciliados} conciliados`,         cls: 'bg-emerald-50 text-emerald-700' },
            { label: `${kpis.diferencias} con diferencia`,      cls: kpis.diferencias > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500' },
            { label: `${kpis.voboOk} VoBo aprobado`,            cls: 'bg-teal-50 text-teal-700' },
            { label: `${kpis.bancoPagado} banco pagó`,          cls: 'bg-sky-50 text-sky-700' },
            ...(kpis.bloqueados > 0 ? [{ label: `${kpis.bloqueados} bloqueados PLD`, cls: 'bg-red-100 text-red-700' }] : []),
          ].map(({ label, cls }) => (
            <span key={label} className={`px-3 py-1 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
          ))}
        </div>
      )}

      {/* Bank toggle chips */}
      {mortgageBancos.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mr-1">Bancos</span>
          {mortgageBancos.map(b => {
            const active = visibleBanks.has(b.nombre);
            const col = bankColor(b.nombre);
            return (
              <button
                key={b.id}
                onClick={() => toggleBank(b.nombre)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  active
                    ? `${col.bg} ${col.accent} ${col.border}`
                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Landmark className="w-3 h-3" />
                {b.nombre}
                {active
                  ? <X className="w-3 h-3 opacity-60" />
                  : <Plus className="w-3 h-3 opacity-60" />
                }
              </button>
            );
          })}
        </div>
      )}

      {/* Bank cards */}
      <div className={`grid gap-4 mb-6 ${bankCardList.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : bankCardList.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        {loadingRows ? (
          [1, 2, 3, 4].map(i => <CardSkeleton key={i} />)
        ) : (
          bankCardList.map(name => (
            <BankCard
              key={name}
              name={name}
              stats={getBankStats(rows, name)}
              selected={selectedBank === name}
              onClick={() => setSelectedBank(prev => prev === name ? 'TODOS' : name)}
            />
          ))
        )}
      </div>

      {/* Tabla + panel */}
      <div className="flex flex-1 min-h-0 gap-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Table area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-200 bg-slate-50/50">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por ID, unidad o cliente…"
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <p className="text-sm font-semibold text-slate-700">
              {selectedBank === 'TODOS' ? 'Todos los bancos' : selectedBank}
            </p>

            {/* Filtro VoBo */}
            <div className="relative">
              <select
                value={filtroVoBo}
                onChange={e => setFiltroVoBo(e.target.value as VoboStatus | 'TODOS')}
                className="appearance-none bg-white border border-slate-200 rounded-xl text-xs text-slate-600 pl-3 pr-7 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="TODOS">VoBo: Todos</option>
                {(['PENDIENTE','EN_REVISION','APROBADO','RECHAZADO','NO_APLICA'] as VoboStatus[]).map(v => (
                  <option key={v} value={v}>{VOBO_META[v].label}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Filtro Pago banco */}
            <div className="relative">
              <select
                value={filtroPago}
                onChange={e => setFiltroPago(e.target.value as BankPaymentStatus | 'TODOS')}
                className="appearance-none bg-white border border-slate-200 rounded-xl text-xs text-slate-600 pl-3 pr-7 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="TODOS">Pago banco: Todos</option>
                {(['PENDIENTE','PROGRAMADO','PAGADO','RECHAZADO','PARCIAL'] as BankPaymentStatus[]).map(v => (
                  <option key={v} value={v}>{BANK_PAYMENT_META[v].label}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Filtro Conciliación */}
            <div className="relative">
              <select
                value={filtroConc}
                onChange={e => setFiltroConc(e.target.value as ReconciliationStatus | 'TODOS')}
                className="appearance-none bg-white border border-slate-200 rounded-xl text-xs text-slate-600 pl-3 pr-7 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="TODOS">Conciliación: Todos</option>
                {(['CONCILIADO','DIFERENCIA','SOBREPAGO','PENDIENTE_CREDITO'] as ReconciliationStatus[]).map(v => (
                  <option key={v} value={v}>{RECONCILIATION_META[v].label}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={() => refetch()}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loadingRows ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : tableError ? (
              <EmptyState
                title="Módulo no activado"
                sub="La tabla creditos_hipotecarios no existe en la base de datos."
                noDDL
                onRetry={refetch}
              />
            ) : isError ? (
              <EmptyState title="Error al cargar datos" sub="Intenta de nuevo." onRetry={refetch} />
            ) : filtered.length === 0 ? (
              <EmptyState
                title={rows.length === 0 ? 'Sin créditos hipotecarios registrados' : 'Sin resultados para los filtros aplicados'}
                sub={rows.length === 0 ? 'Registra el primer crédito hipotecario para este proyecto.' : undefined}
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    {[
                      'ID Cuenta', 'Unidad — Cliente', 'Banco',
                      'Escritura', 'Pagado', 'Crédito requerido',
                      'Conciliación', 'VoBo banco', 'Pago banco dev.',
                      'Cita firma',
                    ].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(row => {
                    const isSelected = selected?.cuentaId === row.cuentaId;
                    return (
                      <tr
                        key={row.cuentaId}
                        onClick={() => setSelected(isSelected ? null : row)}
                        className={`cursor-pointer transition-colors border-l-2 ${
                          row.escrituraBloqueada ? 'border-l-red-400' : 'border-l-transparent'
                        } ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-700">
                          {row.cuentaLabel}
                          {row.escrituraBloqueada && (
                            <div className="mt-0.5"><BlockedBadge /></div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs font-semibold text-slate-800">{row.unidad}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[160px]">{row.clienteNombre}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs font-semibold text-slate-700">{row.bancoNombre || '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-xs tabular-nums text-slate-700">
                          {fmtMxn(row.escrituraValue)}
                        </td>
                        <td className="px-3 py-3 text-xs tabular-nums text-slate-700">
                          {fmtMxn(row.paidAmount)}
                        </td>
                        <td className="px-3 py-3 text-xs tabular-nums text-slate-700">
                          {fmtMxn(row.requiredMortgageAmount)}
                        </td>
                        <td className="px-3 py-3">
                          <ReconciliationBadge status={row.reconciliationStatus} difference={row.difference} />
                        </td>
                        <td className="px-3 py-3">
                          <VoboBadge status={row.voboStatus} />
                        </td>
                        <td className="px-3 py-3">
                          <BankPaymentBadge status={row.bankPaymentStatus} />
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {fmtDate(row.fechaCitaFirma)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                >
                  ‹ Anterior
                </button>
                <span className="px-3 py-1 text-xs text-slate-600">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                >
                  Siguiente ›
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            row={selected}
            onClose={() => setSelected(null)}
            onVoboUpdate={(id, s) => updateVoboMutation.mutate({ creditoId: id, status: s })}
            onBankPaymentUpdate={(id, s) => updatePaymentMutation.mutate({ creditoId: id, status: s })}
            updatingVobo={updateVoboMutation.isPending}
            updatingPayment={updatePaymentMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}
