import type { ReactNode } from 'react';

export function KpiCard({
  label, value, sub, icon, tone = 'default',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}) {
  const toneText = tone === 'positive' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : tone === 'danger' ? 'text-red-600' : 'text-slate-900';
  const iconBg = tone === 'positive' ? 'bg-emerald-50 text-emerald-600' : tone === 'warning' ? 'bg-amber-50 text-amber-600' : tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {icon && <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>}
      </div>
      <div className={`mt-3 text-3xl font-bold ${toneText}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

import type { EstatusPago } from '@/lib/portal-productos/types';

const STATUS_STYLES: Record<EstatusPago, { bg: string; text: string; label: string }> = {
  pagado: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Pagado' },
  al_corriente: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Al corriente' },
  atrasado: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Atrasado' },
  vencido: { bg: 'bg-red-50', text: 'text-red-700', label: 'Vencido' },
};

export function StatusBadge({ estatus, dias }: { estatus: EstatusPago; dias?: number }) {
  const s = STATUS_STYLES[estatus];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${estatus === 'pagado' || estatus === 'al_corriente' ? 'bg-emerald-500' : estatus === 'atrasado' ? 'bg-amber-500' : 'bg-red-500'}`} />
      {s.label}
      {estatus === 'vencido' && dias ? <span className="ml-1 font-semibold">· {dias} días</span> : null}
    </span>
  );
}

export function SatBadge({ tieneSat }: { tieneSat: boolean }) {
  if (tieneSat) {
    return <span title="Clasificación SAT registrada" className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />;
  }
  return (
    <span title="Sin clasificación SAT" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Sin SAT
    </span>
  );
}