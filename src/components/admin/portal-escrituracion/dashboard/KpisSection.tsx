import { Package, FileCheck, FolderOpen, Receipt, ShieldAlert, Clock3, Wallet, Landmark, CalendarDays, Scale, PackageCheck, ShieldCheck } from 'lucide-react';
import { useEscrituracionDashboard } from '@/contexts/EscrituracionDashboardContext';
import { KPI_DATA } from '@/data/escrituracion/dashboardMockData';

const KPI_CONFIG = [
  { key: 'inventario',            label: 'Inventario',                     icon: Package,      color: 'text-blue-500',   bg: 'bg-blue-50',   unit: 'unidades'  },
  { key: 'escriturados',          label: 'Escriturados',                   icon: FileCheck,    color: 'text-emerald-500',bg: 'bg-emerald-50',unit: 'unidades'  },
  { key: 'expedientesDocumentos', label: 'Expedientes Documentos',         icon: FolderOpen,   color: 'text-slate-600',  bg: 'bg-slate-100', unit: 'unidades'  },
  { key: 'relacionPagos',         label: 'Relación Pagos',                 icon: Receipt,      color: 'text-cyan-500',   bg: 'bg-cyan-50',   unit: 'unidades'  },
  { key: 'alertasPld',            label: 'Alertas PLD',                    icon: ShieldAlert,  color: 'text-red-500',    bg: 'bg-red-50',    unit: 'alertas'   },
  { key: 'enProceso',             label: 'En Proceso',                     icon: Clock3,       color: 'text-indigo-500', bg: 'bg-indigo-50', unit: 'expedientes'},
  { key: 'recursosPropios',       label: 'Recursos propios',               icon: Wallet,       color: 'text-purple-500', bg: 'bg-purple-50', unit: 'unidades'  },
  { key: 'creditoHipotecario',    label: 'Crédito hipotecario',            icon: Landmark,     color: 'text-amber-500',  bg: 'bg-amber-50',  unit: 'unidades'  },
  { key: 'citas',                 label: 'Citas',                          icon: CalendarDays, color: 'text-rose-500',   bg: 'bg-rose-50',   unit: 'citas'     },
  { key: 'demandas',              label: 'Demandas',                       icon: Scale,        color: 'text-orange-500', bg: 'bg-orange-50', unit: 'demandas'  },
  { key: 'entregas',              label: 'Entregas',                       icon: PackageCheck, color: 'text-teal-500',   bg: 'bg-teal-50',   unit: 'unidades'  },
  { key: 'postventa',             label: 'Postventa',                      icon: ShieldCheck,  color: 'text-sky-500',    bg: 'bg-sky-50',    unit: 'unidades'  },
] as const;

const CLICKABLE_CARDS: Record<string, { filterValue: string; activeClass: string }> = {
  inventario:   { filterValue: 'Todas',      activeClass: 'border-blue-400 ring-2 ring-blue-200' },
  escriturados: { filterValue: 'Escriturado', activeClass: 'border-emerald-400 ring-2 ring-emerald-200' },
  demandas:     { filterValue: 'En demanda', activeClass: 'border-orange-400 ring-2 ring-orange-200' },
  entregas:     { filterValue: 'Entregado',  activeClass: 'border-teal-400 ring-2 ring-teal-200' },
};

export function KpisSection() {
  const { proyectoActivo, inventarioActivo, escrituradosActivo, demandasActivo, entregasActivo, filtroEtapa, setFiltroEtapa } = useEscrituracionDashboard();
  const nombreProyecto = proyectoActivo?.nombre || 'Margot';

  // Usamos el mock data por defecto, o ceros si no coincide con los mocks
  const data = KPI_DATA[nombreProyecto as keyof typeof KPI_DATA] || {
    inventario: 0,
    escriturados: 0,
    expedientesDocumentos: 0,
    relacionPagos: 0,
    alertasPld: 0,
    enProceso: 0,
    recursosPropios: 0,
    creditoHipotecario: 0,
    citas: 0,
    demandas: 0,
    entregas: 0,
    postventa: 0,
  };

  const displayData = {
    ...data,
    inventario: inventarioActivo,
    escriturados: escrituradosActivo,
    demandas: demandasActivo,
    entregas: entregasActivo,
  };

  return (
    <div className="w-full overflow-x-auto pb-4 hide-scrollbar">
      <div className="flex gap-4 min-w-max">
        {KPI_CONFIG.map((kpi) => {
          const clickable = CLICKABLE_CARDS[kpi.key];
          const isClickable = !!clickable;
          const isActive = isClickable && filtroEtapa === clickable.filterValue;
          const handleClick = isClickable
            ? () => setFiltroEtapa(
                kpi.key === 'inventario' || filtroEtapa !== clickable.filterValue
                  ? clickable.filterValue
                  : 'Todas'
              )
            : undefined;
          return (
            <div
              key={kpi.key}
              onClick={handleClick}
              className={`flex flex-col bg-white border rounded-2xl p-5 shadow-sm min-w-[160px] flex-1 transition-all
                ${isClickable ? 'cursor-pointer hover:shadow-md' : ''}
                ${isActive ? clickable.activeClass : 'border-slate-200'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-slate-600">{kpi.label}</span>
                <div className={`p-2 rounded-full ${kpi.bg}`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
              <div className="mt-auto">
                <span className="text-3xl font-bold text-slate-900">
                  {displayData[kpi.key as keyof typeof displayData]}
                </span>
                <p className="text-xs text-slate-500 mt-1 font-medium">{kpi.unit}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
