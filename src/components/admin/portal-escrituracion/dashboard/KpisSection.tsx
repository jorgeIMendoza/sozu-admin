import { Package, FileCheck, FolderOpen, Receipt, ShieldAlert, Clock3, Wallet, Landmark, CalendarDays, Scale, PackageCheck, ShieldCheck } from 'lucide-react';
import { useEscrituracionDashboard } from '@/contexts/EscrituracionDashboardContext';

const KPI_CONFIG = [
  { key: 'inventario',            label: 'Inventario',              icon: Package,      iconColor: '#3B82F6', iconBg: '#DBEAFE', unit: 'unidades'   },
  { key: 'escriturados',          label: 'Escriturados',            icon: FileCheck,    iconColor: '#22C55E', iconBg: '#DCFCE7', unit: 'unidades'   },
  { key: 'expedientesDocumentos', label: 'Expedientes Docs.',       icon: FolderOpen,   iconColor: '#6B7280', iconBg: '#F3F4F6', unit: 'unidades'   },
  { key: 'relacionPagos',         label: 'Relación Pagos',          icon: Receipt,      iconColor: '#06B6D4', iconBg: '#CFFAFE', unit: 'unidades'   },
  { key: 'alertasPld',            label: 'Alertas PLD',             icon: ShieldAlert,  iconColor: '#EF4444', iconBg: '#FEE2E2', unit: 'alertas'    },
  { key: 'enProceso',             label: 'En Proceso',              icon: Clock3,       iconColor: '#6366F1', iconBg: '#EEF2FF', unit: 'expedientes'},
  { key: 'recursosPropios',       label: 'Recursos propios',        icon: Wallet,       iconColor: '#A855F7', iconBg: '#F3E8FF', unit: 'unidades'   },
  { key: 'creditoHipotecario',    label: 'Crédito hipotecario',     icon: Landmark,     iconColor: '#F59E0B', iconBg: '#FEF3C7', unit: 'unidades'   },
  { key: 'citas',                 label: 'Citas',                   icon: CalendarDays, iconColor: '#F43F5E', iconBg: '#FFE4E6', unit: 'citas'      },
  { key: 'demandas',              label: 'Demandas',                icon: Scale,        iconColor: '#F97316', iconBg: '#FFEDD5', unit: 'demandas'   },
  { key: 'entregas',              label: 'Entregas',                icon: PackageCheck, iconColor: '#14B8A6', iconBg: '#CCFBF1', unit: 'unidades'   },
  { key: 'postventa',             label: 'Postventa',               icon: ShieldCheck,  iconColor: '#0EA5E9', iconBg: '#E0F2FE', unit: 'unidades'   },
] as const;

const CLICKABLE_CARDS: Record<string, { filterValue: string }> = {
  inventario:   { filterValue: 'Todas'      },
  escriturados: { filterValue: 'Escriturado'},
  demandas:     { filterValue: 'En demanda' },
  entregas:     { filterValue: 'Entregado'  },
};

const ACTIVE_RING: Record<string, string> = {
  inventario:   'ring-2 ring-blue-300 border-blue-400',
  escriturados: 'ring-2 ring-emerald-300 border-emerald-400',
  demandas:     'ring-2 ring-orange-300 border-orange-400',
  entregas:     'ring-2 ring-teal-300 border-teal-400',
};

export function KpisSection() {
  const {
    inventarioActivo, escrituradosActivo, expedientesDocumentosActivo,
    relacionPagosActivo, alertasPldActivo, enProcesoActivo,
    recursosPropiosActivo, creditoHipotecarioActivo, citasActivo,
    demandasActivo, entregasActivo, postventaActivo,
    filtroEtapa, setFiltroEtapa,
  } = useEscrituracionDashboard();

  const displayData = {
    inventario:            inventarioActivo,
    escriturados:          escrituradosActivo,
    expedientesDocumentos: expedientesDocumentosActivo,
    relacionPagos:         relacionPagosActivo,
    alertasPld:            alertasPldActivo,
    enProceso:             enProcesoActivo,
    recursosPropios:       recursosPropiosActivo,
    creditoHipotecario:    creditoHipotecarioActivo,
    citas:                 citasActivo,
    demandas:              demandasActivo,
    entregas:              entregasActivo,
    postventa:             postventaActivo,
  };

  return (
    <div className="w-full overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
      <div className="flex gap-3 min-w-max">
        {KPI_CONFIG.map((kpi) => {
          const clickable  = CLICKABLE_CARDS[kpi.key];
          const isClickable = !!clickable;
          const isActive    = isClickable && filtroEtapa === clickable.filterValue;
          const handleClick = isClickable
            ? () => setFiltroEtapa(
                kpi.key === 'inventario' || filtroEtapa !== clickable.filterValue
                  ? clickable.filterValue
                  : 'Todas',
              )
            : undefined;

          const Icon = kpi.icon;

          return (
            <div
              key={kpi.key}
              onClick={handleClick}
              className={`sz-kpi-card${isClickable ? ' sz-kpi-card--clickable' : ''} ${
                isActive ? `${ACTIVE_RING[kpi.key]}` : ''
              }`}
            >
              {/* Icono */}
              <div
                className="sz-kpi-card__icon"
                style={{ background: kpi.iconBg }}
              >
                <Icon
                  size={18}
                  strokeWidth={1.75}
                  style={{ color: kpi.iconColor }}
                />
              </div>

              {/* Valor + label */}
              <div className="mt-auto">
                <div className="sz-kpi-card__value">
                  {displayData[kpi.key as keyof typeof displayData]}
                </div>
                <div className="sz-kpi-card__label">{kpi.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
