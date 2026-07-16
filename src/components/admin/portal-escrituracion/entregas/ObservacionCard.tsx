import { useState, useEffect } from 'react';
import { Camera, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type ObservacionRow, PRIORIDAD_META, fmtDt } from './EntregaTypes';

const TIPO_META: Record<string, { label: string; cls: string }> = {
  INCIDENCIA: { label: 'Incidencia', cls: 'bg-red-50 text-red-600' },
  REPARACION: { label: 'Reparación', cls: 'bg-orange-50 text-orange-600' },
  VALIDACION: { label: 'Validación', cls: 'bg-emerald-50 text-emerald-700' },
};

interface ObservacionCardProps {
  obs: ObservacionRow;
  onCargarEvidencia?: (itemId: number, descripcion: string) => void;
}

export function ObservacionCard({ obs, onCargarEvidencia }: ObservacionCardProps) {
  const [evidenciasPorTipo, setEvidenciasPorTipo] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (obs.id_checklist_item === null) return;
    (supabase as any)
      .from('entregas_evidencia')
      .select('id, url, tipo, tipo_evidencia')
      .eq('id_item', obs.id_checklist_item)
      .eq('activo', true)
      .order('fecha_creacion', { ascending: true })
      .then(({ data }: { data: any[] | null }) => {
        if (!data) return;
        const grouped: Record<string, any[]> = {};
        data.forEach((ev) => {
          const t = ev.tipo_evidencia as string;
          if (!grouped[t]) grouped[t] = [];
          grouped[t].push(ev);
        });
        setEvidenciasPorTipo(grouped);
      });
  }, [obs.id_checklist_item]);

  const tiposConEvidencia = (['INCIDENCIA', 'REPARACION', 'VALIDACION'] as const).filter(
    (t) => (evidenciasPorTipo[t]?.length ?? 0) > 0,
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      {/* Encabezado: descripción + badges */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-slate-900 leading-snug">{obs.descripcion}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORIDAD_META[obs.prioridad]?.cls ?? 'bg-slate-100 text-slate-600'}`}>
            {PRIORIDAD_META[obs.prioridad]?.label ?? obs.prioridad}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
            {obs.estatus}
          </span>
        </div>
      </div>

      {/* Evidencias agrupadas por tipo (INCIDENCIA / REPARACION / VALIDACION) */}
      {tiposConEvidencia.length > 0 && (
        <div className="space-y-2 mb-3 border-t border-slate-50 pt-3">
          {tiposConEvidencia.map((tipo) => {
            const evs    = evidenciasPorTipo[tipo] ?? [];
            const meta   = TIPO_META[tipo];
            const visibles = evs.slice(0, 5);
            const extra  = evs.length - visibles.length;
            return (
              <div key={tipo} className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${meta.cls}`}>
                  {meta.label}
                </span>
                <div className="flex items-center gap-1">
                  {visibles.map((ev) =>
                    ev.tipo === 'VIDEO' ? (
                      <a key={ev.id} href={ev.url} target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 hover:bg-slate-300 transition-colors">
                        <Play className="w-3 h-3 text-slate-500" />
                      </a>
                    ) : (
                      <a key={ev.id} href={ev.url} target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                        <img src={ev.url} alt="" className="w-full h-full object-cover" />
                      </a>
                    ),
                  )}
                  {extra > 0 && (
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="text-[10px] text-slate-500 font-medium">+{extra}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pie: fecha + botón cargar evidencia */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{fmtDt(obs.fecha_creacion)}</span>
        {obs.id_checklist_item !== null && onCargarEvidencia && (
          <button
            onClick={() => onCargarEvidencia(obs.id_checklist_item!, obs.descripcion)}
            title="Cargar evidencia de esta incidencia"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors">
            <Camera className="w-3.5 h-3.5" />
            Evidencia
          </button>
        )}
      </div>
    </div>
  );
}
