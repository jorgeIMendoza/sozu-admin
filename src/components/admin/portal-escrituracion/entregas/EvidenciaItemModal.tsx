import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, UploadCloud, FileCheck, X, ImageIcon } from 'lucide-react';
import { fmtDt } from './EntregaTypes';

interface EvidenciaItemModalProps {
  open: boolean;
  onClose: () => void;
  itemId: number | null;
  itemNombre: string;
  entregaId: number;
  tipoDefecto?: 'GENERAL' | 'INCIDENCIA' | 'REPARACION' | 'VALIDACION';
  onDone?: () => void;
}

type TipoEvidencia = 'GENERAL' | 'INCIDENCIA' | 'REPARACION' | 'VALIDACION';

const TIPO_LABEL: Record<TipoEvidencia, string> = {
  GENERAL:    'General',
  INCIDENCIA: 'Incidencia',
  REPARACION: 'Reparación',
  VALIDACION: 'Validación',
};

export function EvidenciaItemModal({
  open, onClose, itemId, itemNombre, entregaId, tipoDefecto = 'GENERAL', onDone,
}: EvidenciaItemModalProps) {
  const { profile } = useAuth();
  const [file, setFile]               = useState<File | null>(null);
  const [tipo, setTipo]               = useState<TipoEvidencia>(tipoDefecto);
  const [saving, setSaving]           = useState(false);
  const [evidencias, setEvidencias]   = useState<any[]>([]);
  const [loadingEvs, setLoadingEvs]   = useState(false);

  useEffect(() => {
    if (open) {
      setFile(null);
      setTipo(tipoDefecto);
      void loadEvidencias();
    }
  }, [open, itemId]);

  const loadEvidencias = async () => {
    setLoadingEvs(true);
    const q = (supabase as any)
      .from('entregas_evidencia')
      .select('id, nombre, url, tipo_evidencia, fecha_creacion, tipo')
      .eq('activo', true)
      .order('fecha_creacion', { ascending: false });

    if (itemId !== null) {
      q.eq('id_item', itemId);
    } else {
      // Evidencias generales de la entrega sin ítem específico
      q.eq('id_entrega', entregaId).is('id_item', null);
    }

    const { data } = await q;
    setEvidencias(data ?? []);
    setLoadingEvs(false);
  };

  const handleSubmit = async () => {
    if (!file) { toast.error('Selecciona un archivo'); return; }
    if (file.type.startsWith('video/') && file.size > 100 * 1024 * 1024) {
      toast.error('El video no puede superar 100 MB');
      return;
    }
    setSaving(true);
    try {
      const ext  = file.name.split('.').pop() ?? 'bin';
      const path = itemId !== null
        ? `entregas/${entregaId}/items/${itemId}/${Date.now()}.${ext}`
        : `entregas/${entregaId}/general/${Date.now()}.${ext}`;

      const { error: se } = await supabase.storage.from('documentos').upload(path, file, { upsert: false });
      if (se) throw se;

      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);

      const payload: Record<string, unknown> = {
        id_entrega:    entregaId,
        url:           publicUrl,
        nombre:        file.name,
        tipo:          file.type.startsWith('video/') ? 'VIDEO' : 'FOTO',
        tipo_evidencia: tipo,
        subido_por:    profile?.email ?? null,
        activo:        true,
      };
      if (itemId !== null) payload.id_item = itemId;

      const { error: ie } = await (supabase as any).from('entregas_evidencia').insert(payload);
      if (ie) throw ie;

      toast.success('Evidencia cargada');
      setFile(null);
      await loadEvidencias();
      onDone?.();
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al subir evidencia');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">Evidencia fotográfica</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{itemNombre}</p>
          </div>
          <button onClick={onClose} className="shrink-0 ml-3 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Evidencias existentes */}
          {loadingEvs ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          ) : evidencias.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {evidencias.length} evidencia{evidencias.length !== 1 ? 's' : ''} registrada{evidencias.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {evidencias.map(ev => {
                  const badge = (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium text-white ${
                      ev.tipo_evidencia === 'INCIDENCIA' ? 'bg-red-500' :
                      ev.tipo_evidencia === 'REPARACION' ? 'bg-orange-500' :
                      ev.tipo_evidencia === 'VALIDACION' ? 'bg-emerald-500' : 'bg-slate-500'
                    }`}>
                      {TIPO_LABEL[ev.tipo_evidencia as TipoEvidencia] ?? ev.tipo_evidencia}
                    </span>
                  );
                  return ev.tipo === 'VIDEO' ? (
                    <div key={ev.id} className="relative rounded-xl overflow-hidden bg-slate-100 aspect-square">
                      <video
                        src={ev.url}
                        controls
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1 left-1 pointer-events-none">{badge}</div>
                    </div>
                  ) : (
                    <a key={ev.id} href={ev.url} target="_blank" rel="noopener noreferrer"
                      className="relative rounded-xl overflow-hidden bg-slate-100 aspect-square group">
                      <img src={ev.url} alt={ev.nombre ?? 'Evidencia'} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end p-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity ${
                          ev.tipo_evidencia === 'INCIDENCIA' ? 'bg-red-500' :
                          ev.tipo_evidencia === 'REPARACION' ? 'bg-orange-500' :
                          ev.tipo_evidencia === 'VALIDACION' ? 'bg-emerald-500' : 'bg-slate-500'
                        }`}>
                          {TIPO_LABEL[ev.tipo_evidencia as TipoEvidencia] ?? ev.tipo_evidencia}
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tipo de evidencia */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tipo de evidencia</label>
            <div className="flex gap-2 flex-wrap">
              {(['GENERAL', 'INCIDENCIA', 'REPARACION', 'VALIDACION'] as TipoEvidencia[]).map(t => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                    tipo === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}>
                  {TIPO_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Dropzone */}
          <div className={`relative rounded-xl border-2 border-dashed transition-colors ${
            file ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
          }`}>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center gap-2 py-7 pointer-events-none">
              {file ? (
                <>
                  <FileCheck className="w-7 h-7 text-blue-500" />
                  <p className="text-xs font-medium text-blue-700 text-center px-4 break-all">{file.name}</p>
                  <p className="text-[11px] text-slate-400">{(file.size / 1024).toFixed(0)} KB · clic para cambiar</p>
                </>
              ) : (
                <>
                  <ImageIcon className="w-7 h-7 text-slate-300" />
                  <p className="text-xs font-medium text-slate-500">Toca para seleccionar foto o video</p>
                  <p className="text-[11px] text-slate-400">Imagen o video</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2 transition-colors">
            Cerrar
          </button>
          <button onClick={handleSubmit} disabled={saving || !file}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <UploadCloud className="w-3.5 h-3.5" />}
            Cargar
          </button>
        </div>
      </div>
    </div>
  );
}
