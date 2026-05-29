import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Kanban } from 'lucide-react';
import KpiCards from '@/components/dashboard/KpiCards';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import PipelineBoard from '@/components/dashboard/PipelineBoard';
import AttentionPanel from '@/components/dashboard/AttentionPanel';
import RenewalsPanel from '@/components/dashboard/RenewalsPanel';
import SignatureTracker from '@/components/dashboard/SignatureTracker';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import WorkloadPanel from '@/components/dashboard/WorkloadPanel';
import StatusDistribution from '@/components/dashboard/StatusDistribution';
import CaseDrawer from '@/components/dashboard/CaseDrawer';
import { mockRequests } from '@/data/mockData';
import type { LegalRequest, CaseStatus } from '@/types/legal';

type ViewMode = 'executive' | 'operative';

const tabs: { key: ViewMode; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'executive', label: 'Vista Ejecutiva', icon: LayoutDashboard },
  { key: 'operative', label: 'Vista Operativa', icon: Kanban },
];

const KPI_FILTERS: Record<string, (r: LegalRequest) => boolean> = {
  active: (r) => !['fully_signed', 'cancelled', 'rejected', 'archived'].includes(r.status),
  review: (r) => ['in_legal_review', 'missing_information'].includes(r.status),
  validation: (r) => ['in_validation', 'in_signature_process', 'partially_signed'].includes(r.status),
  completed: (r) => r.status === 'fully_signed',
  urgent: (r) => r.priority === 'high' && !['fully_signed', 'cancelled', 'archived'].includes(r.status),
};

const KPI_DRAWER_TITLES: Record<string, string> = {
  active: 'Expedientes activos',
  review: 'Pendientes de revisión',
  validation: 'Firma titular pendiente',
  completed: 'Firmados este mes',
  urgent: 'Expedientes urgentes',
};

export default function Dashboard() {
  const [view, setView] = useState<ViewMode>('operative');
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCases, setDrawerCases] = useState<LegalRequest[]>([]);
  const [drawerTitle, setDrawerTitle] = useState('');

  const openDrawer = useCallback((title: string, cases: LegalRequest[]) => {
    setDrawerTitle(title);
    setDrawerCases(cases);
    setDrawerOpen(true);
  }, []);

  const handleKpiClick = useCallback((key: string | null) => {
    setKpiFilter(key);
    if (key && KPI_FILTERS[key]) {
      const filtered = mockRequests.filter(KPI_FILTERS[key]);
      openDrawer(KPI_DRAWER_TITLES[key] || 'Expedientes', filtered);
    }
  }, [openDrawer]);

  const handleStatusFilter = useCallback((status: CaseStatus) => {
    const filtered = mockRequests.filter(r => r.status === status);
    const label = filtered.length > 0 ? `Estatus: ${status}` : 'Expedientes';
    openDrawer(label, filtered);
  }, [openDrawer]);

  return (
    <div className="px-10 py-8 space-y-6 max-w-[1440px]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"
      >
        <div className="space-y-1">
          <h1 className="text-[24px] font-bold leading-tight text-foreground">Panel de Operaciones Legales</h1>
          <p className="text-[13px] text-muted-foreground">Centro de control de contratos y expedientes · SOZU Legal OS</p>
        </div>
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`flex items-center gap-1.5 text-[12px] font-medium px-4 py-2 rounded-md transition-all cursor-pointer ${
                view === t.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Active filter indicator */}
      {kpiFilter && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">Filtro activo:</span>
          <span className="text-[12px] font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
            {KPI_DRAWER_TITLES[kpiFilter]}
          </span>
          <button onClick={() => setKpiFilter(null)} className="text-[12px] text-muted-foreground hover:text-foreground underline cursor-pointer">
            Limpiar
          </button>
        </div>
      )}

      {/* Filters */}
      <DashboardFilters filters={filters} onFiltersChange={setFilters} />

      {/* KPIs */}
      <KpiCards activeFilter={kpiFilter} onFilterChange={handleKpiClick} />

      {/* Views */}
      {view === 'operative' ? (
        <OperativeView openDrawer={openDrawer} onStatusFilter={handleStatusFilter} />
      ) : (
        <ExecutiveView openDrawer={openDrawer} onStatusFilter={handleStatusFilter} />
      )}

      <CaseDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={drawerTitle}
        cases={drawerCases}
      />
    </div>
  );
}

interface ViewProps {
  openDrawer: (title: string, cases: LegalRequest[]) => void;
  onStatusFilter: (status: CaseStatus) => void;
}

function OperativeView({ openDrawer, onStatusFilter }: ViewProps) {
  return (
    <div className="space-y-6">
      <PipelineBoard onColumnClick={onStatusFilter} />
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8">
          <AttentionPanel />
        </div>
        <div className="lg:col-span-4">
          <SignatureTracker openDrawer={openDrawer} />
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <RenewalsPanel />
        <ActivityFeed />
      </div>
    </div>
  );
}

function ExecutiveView({ openDrawer, onStatusFilter }: ViewProps) {
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4">
          <StatusDistribution onStatusClick={onStatusFilter} />
        </div>
        <div className="lg:col-span-4">
          <WorkloadPanel openDrawer={openDrawer} />
        </div>
        <div className="lg:col-span-4">
          <SignatureTracker openDrawer={openDrawer} />
        </div>
      </div>
      <AttentionPanel />
      <div className="grid lg:grid-cols-2 gap-5">
        <RenewalsPanel />
        <ActivityFeed />
      </div>
    </div>
  );
}
