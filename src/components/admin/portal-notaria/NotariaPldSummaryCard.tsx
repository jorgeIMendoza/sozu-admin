/**
 * Versión read-only de PldSummaryCard para el Portal Notaría.
 * Idéntico visualmente a PldSummaryCard pero:
 *   - Sin useNavigate
 *   - Sin enlace "Ver en PLD"
 *   - Sin prop cuentaId (no navega a ningún lugar)
 * La notaría puede ver el estado PLD pero no navegar a la herramienta administrativa.
 */

import { AlertTriangle, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';

const PLD_STATUS_CFG: Record<string, { label: string; dotClass: string; cardClass: string; icon: React.ReactNode }> = {
  BLOQUEADO: { label: 'Bloqueado',       dotClass: 'bg-red-500',     cardClass: 'border-red-300',     icon: <ShieldAlert className="w-4 h-4 text-red-500" /> },
  OBSERVADO: { label: 'En observación',  dotClass: 'bg-amber-500',   cardClass: 'border-amber-300',   icon: <ShieldAlert className="w-4 h-4 text-amber-500" /> },
  APROBADO:  { label: 'Aprobado',        dotClass: 'bg-emerald-500', cardClass: 'border-emerald-200', icon: <ShieldCheck className="w-4 h-4 text-emerald-500" /> },
  PENDIENTE: { label: 'Pendiente',       dotClass: 'bg-slate-400',   cardClass: 'border-slate-200',   icon: <Shield className="w-4 h-4 text-slate-400" /> },
};

interface NotariaPldSummaryCardProps {
  pldStatus: string;
  motivoPrincipal: string;
  escrituraBloqueada: boolean;
}

export function NotariaPldSummaryCard({ pldStatus, motivoPrincipal, escrituraBloqueada }: NotariaPldSummaryCardProps) {
  const cfg = PLD_STATUS_CFG[pldStatus] ?? PLD_STATUS_CFG.PENDIENTE;
  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm ${cfg.cardClass}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PLD</p>
        {cfg.icon}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dotClass}`} />
        <p className={`text-lg font-bold ${
          pldStatus === 'BLOQUEADO' ? 'text-red-600' :
          pldStatus === 'OBSERVADO' ? 'text-amber-600' :
          pldStatus === 'APROBADO'  ? 'text-emerald-600' : 'text-slate-700'
        }`}>{cfg.label}</p>
      </div>
      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{motivoPrincipal}</p>
      {escrituraBloqueada && (
        <div className="mt-2 flex items-center gap-1 text-xs text-red-600 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Escritura bloqueada
        </div>
      )}
    </div>
  );
}
