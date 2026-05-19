import { TIMELINE_MILESTONES } from '@/data/escrituracion/dashboardMockData';
import { CheckCircle2, Circle } from 'lucide-react';

export function Timeline() {
  return (
    <div className="relative pl-3 mt-6">
      {/* Linea vertical */}
      <div className="absolute left-5 top-2 bottom-6 w-0.5 bg-slate-100" />
      
      <div className="space-y-6">
        {TIMELINE_MILESTONES.map((item, idx) => {
          const isCompleted = item.status === 'completed';
          const isInProgress = item.status === 'in-progress';
          
          return (
            <div key={idx} className="relative flex gap-4 items-start group">
              <div className="relative z-10 flex-shrink-0 mt-0.5 bg-white">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 bg-white" />
                ) : isInProgress ? (
                  <div className="relative w-5 h-5 flex items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20 animate-ping"></span>
                    <Circle className="relative w-4 h-4 text-emerald-500 fill-emerald-50" />
                  </div>
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 bg-white" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-sm font-medium ${isCompleted || isInProgress ? 'text-slate-900' : 'text-slate-500'}`}>
                    {item.etapa}
                  </span>
                  <span className="text-xs text-slate-400 whitespace-nowrap ml-3">{item.date}</span>
                </div>
                
                {item.title && (
                  <div className="text-sm text-slate-600 font-medium mt-1">
                    {item.title}
                  </div>
                )}
                {item.desc && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    {item.desc}
                  </div>
                )}
                {isInProgress && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    En curso
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
