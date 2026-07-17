import { X, Loader2 } from 'lucide-react';

interface ChecklistEstatusModalProps {
  modal: { itemId: number; nombre: string } | null;
  obs: string;
  isLoading: boolean;
  onClose: () => void;
  onChangeObs: (obs: string) => void;
  onGuardar: () => void;
}

export function ChecklistEstatusModal({
  modal,
  obs,
  isLoading,
  onClose,
  onChangeObs,
  onGuardar,
}: ChecklistEstatusModalProps) {
  if (!modal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">Marcar como No cumple</p>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{modal.nombre}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-0.5 ml-4 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
            Observación <span className="text-red-500">*</span>
          </label>
          <textarea
            value={obs}
            onChange={e => onChangeObs(e.target.value)}
            placeholder="Describe el problema encontrado…"
            rows={4}
            autoFocus
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            La observación se guardará en el ítem y en el log de observaciones de la entrega.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={onGuardar}
            disabled={!obs.trim() || isLoading}
            className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
              : 'Guardar y marcar No cumple'}
          </button>
        </div>
      </div>
    </div>
  );
}
