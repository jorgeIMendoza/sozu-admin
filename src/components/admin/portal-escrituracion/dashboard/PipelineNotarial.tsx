import { PIPELINE_DATA } from '@/data/escrituracion/dashboardMockData';
import { FolderOpen, Building2, Calculator, Landmark, UserCheck, PenTool } from 'lucide-react';

const ICONS: Record<string, any> = {
  expediente:     FolderOpen,
  voboDesarrollo: Building2,
  avaluo:         Calculator,
  voboBanco:      Landmark,
  voboComprador:  UserCheck,
  firma:          PenTool,
};

export function PipelineNotarial() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Pipeline notarial</h2>
        <p className="text-sm text-slate-500">Distribución de expedientes por etapa del workflow de escrituración.</p>
      </div>

      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
          {PIPELINE_DATA.map((item, index) => {
            const Icon = ICONS[item.id] || FolderOpen;
            const isFirst = index === 0;
            
            return (
              <div key={item.id} className="flex-1 min-w-[140px] relative">
                <div className="flex flex-col bg-slate-50 rounded-xl p-4 border border-slate-100 hover:border-slate-200 transition-colors h-full">
                  <div className="flex items-center justify-between mb-3 text-slate-400">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{item.step}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700 leading-tight mb-2">{item.name}</span>
                  <span className="text-2xl font-bold text-slate-900 mt-auto">{item.count}</span>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Progress Line Inferior */}
        <div className="mt-4 flex items-center px-2">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
            {PIPELINE_DATA.map((item, index) => {
              // Simulación visual de progreso
              const width = Math.max(10, (item.count / 18) * 100);
              return (
                <div 
                  key={item.id} 
                  className={`h-full border-r border-white last:border-0 ${index < 4 ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  style={{ flex: item.count > 0 ? item.count : 1 }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
