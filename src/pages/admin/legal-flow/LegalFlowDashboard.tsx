import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Kanban } from 'lucide-react';
import DashboardFilters from '@/components/admin/legal-flow/dashboard/DashboardFilters';
import PipelineBoard from '@/components/admin/legal-flow/dashboard/PipelineBoard';
import WorkloadPanel from '@/components/admin/legal-flow/dashboard/WorkloadPanel';
import StatusDistribution from '@/components/admin/legal-flow/dashboard/StatusDistribution';
import CaseDrawer from '@/components/admin/legal-flow/dashboard/CaseDrawer';
import { mockRequests } from '@/data/legalFlow/mockData';
import type { LegalRequest, CaseStatus } from '@/types/legal-flow';

type ViewMode = 'executive' | 'operative';

const tabs: { key: ViewMode; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'executive', label: 'Vista Ejecutiva', icon: LayoutDashboard },
  { key: 'operative', label: 'Vista Operativa', icon: Kanban },
];

export default function Dashboard() {
  const [view, setView] = useState<ViewMode>('operative');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCases, setDrawerCases] = useState<LegalRequest[]>([]);
  const [drawerTitle, setDrawerTitle] = useState('');

  const openDrawer = useCallback((title: string, cases: LegalRequest[]) => {
    setDrawerTitle(title);
    setDrawerCases(cases);
    setDrawerOpen(true);
  }, []);

  // Click en una columna del Pipeline: abre el drawer con los expedientes
  // REALES de esa etapa (los mismos que muestra la columna), no con mock.
  const handleColumnClick = useCallback((status: CaseStatus, cases: LegalRequest[]) => {
    openDrawer(`Estatus: ${status}`, cases);
  }, [openDrawer]);

  // Click en el donut de la Vista Ejecutiva (distribución por estatus).
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
        className="flex flex-col sm:flex-row sm:items-end justify-end gap-3"
      >
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

      {/* Buscador */}
      <DashboardFilters value={search} onChange={setSearch} />

      {/* Views */}
      {view === 'operative' ? (
        <OperativeView search={search} onColumnClick={handleColumnClick} />
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

function OperativeView({
  search,
  onColumnClick,
}: {
  search: string;
  onColumnClick: (status: CaseStatus, cases: LegalRequest[]) => void;
}) {
  return (
    <div className="space-y-6">
      <PipelineBoard search={search} onColumnClick={onColumnClick} />
    </div>
  );
}

function ExecutiveView({ openDrawer, onStatusFilter }: ViewProps) {
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6">
          <StatusDistribution onStatusClick={onStatusFilter} />
        </div>
        <div className="lg:col-span-6">
          <WorkloadPanel openDrawer={openDrawer} />
        </div>
      </div>
    </div>
  );
}
