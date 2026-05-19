import { useEscrituracionDashboard } from '@/contexts/EscrituracionDashboardContext';
import { EXPEDIENTES_TABLE } from '@/data/escrituracion/dashboardMockData';
import { Timeline } from './Timeline';
import { X, CalendarDays, Users, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function RightDetailPanel() {
  const { expedienteSeleccionado, setExpedienteSeleccionado } = useEscrituracionDashboard();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (expedienteSeleccionado) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [expedienteSeleccionado]);

  if (!expedienteSeleccionado && !isOpen) return null;

  const exp = EXPEDIENTES_TABLE.find(e => e.id === expedienteSeleccionado);
  
  if (!exp) return null;

  const isEnTiempo = exp.sla === 'En tiempo';

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 z-40 lg:hidden"
          onClick={() => setExpedienteSeleccionado(null)}
        />
      )}

      {/* Drawer Panel */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-slate-50 border-l border-slate-200 shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} lg:relative lg:translate-x-0 lg:shadow-none lg:w-80 xl:w-96 lg:z-0 flex flex-col h-[calc(100vh-theme(spacing.16))] rounded-l-2xl lg:rounded-none overflow-hidden`}>
        
        {/* Header */}
        <div className="flex-none p-5 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">{exp.id}</h2>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${isEnTiempo ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                • {exp.sla}
              </span>
            </div>
            <button 
              onClick={() => setExpedienteSeleccionado(null)}
              className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-sm text-slate-500 font-medium mb-5">
            Unidad {exp.unidad} • {exp.proyecto}
          </p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400 mb-1 text-xs uppercase tracking-wider">Cliente</p>
              <p className="font-medium text-slate-900 truncate">{exp.cliente}</p>
            </div>
            <div>
              <p className="text-slate-400 mb-1 text-xs uppercase tracking-wider">Monto</p>
              <p className="font-medium text-slate-900">{formatCurrency(exp.monto)}</p>
            </div>
            <div>
              <p className="text-slate-400 mb-1 text-xs uppercase tracking-wider">Pago</p>
              <p className="font-medium text-slate-900">{exp.pago} {exp.banco !== '—' && `- ${exp.banco}`}</p>
            </div>
            <div>
              <p className="text-slate-400 mb-1 text-xs uppercase tracking-wider">Notaría</p>
              <p className="font-medium text-slate-900 truncate">{exp.notaria}</p>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <span>Firma programada: <span className="font-medium text-slate-900">{exp.fechaFirma}</span></span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 pb-24">
          
          {/* Card Asignar Notaría */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-emerald-700 font-medium mb-2 text-sm">
              <Users className="w-4 h-4" />
              Asignar unidad a notaría
            </div>
            <p className="text-xs text-emerald-600/80 mb-3 leading-relaxed">
              Al asignar, la notaría detona el pipeline en su módulo.
            </p>
            <select className="w-full text-sm rounded-lg border-emerald-200 bg-white text-slate-700 py-2 px-3 outline-none focus:ring-2 focus:ring-emerald-500/20">
              <option value="">Selecciona notaría...</option>
              <option value="63">Notaría 63</option>
              <option value="51">Notaría 51</option>
              <option value="59">Notaría 59</option>
            </select>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Milestones</h3>
            <Timeline />
          </div>

        </div>

        {/* Sticky Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
          <button className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3 px-4 font-medium transition-colors shadow-sm">
            Avanzar etapa
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
