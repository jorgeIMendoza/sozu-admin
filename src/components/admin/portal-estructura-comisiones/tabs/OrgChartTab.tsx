import { useState, useMemo } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { calculateScenario, formatCurrency } from '@/lib/portal-estructura-comisiones/utils/calculations';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, ChevronDown } from 'lucide-react';
import RoleAnalysisPanel, { type RoleCardInfo } from '../shared/RoleAnalysisPanel';
import type { Role, RoleAssignment } from '@/lib/portal-estructura-comisiones/types/simulator';


export default function OrgChartTab() {
  const { roles, roleAssignments, projects, scenarios, channels } = useSimulator();
  const [selectedRole, setSelectedRole] = useState<RoleCardInfo | null>(null);

  const result = useMemo(() => {
    if (!scenarios[0]) return null;
    return calculateScenario(scenarios[0], projects, roles, channels);
  }, [scenarios, projects, roles, channels]);

  const centralRoles = useMemo(() => {
    return roles
      .filter(r => r.belongsTo === 'sozu_central')
      .map(role => {
        const assigns = roleAssignments.filter(ra => ra.roleId === role.id && !ra.projectId);
        const totalHC = assigns.reduce((s, a) => s + a.headcount, 0);
        const monthlyCost = assigns.reduce((s, a) => s + a.headcount * (a.baseSalary * (1 + a.benefitsPct / 100) + a.fixedBonus), 0);
        const rb = result?.roleBreakdown.find(r => r.roleId === role.id);
        return { role, assignments: assigns, totalHeadcount: totalHC, monthlyCost, annualCommission: rb?.totalCommissionEarned || 0 };
      });
  }, [roles, roleAssignments, result]);

  const projectRolesMap = useMemo(() => {
    return projects.map(project => {
      const projRoles = roles
        .filter(r => r.belongsTo === 'project')
        .map(role => {
          const assigns = roleAssignments.filter(ra => ra.roleId === role.id && ra.projectId === project.id);
          if (assigns.length === 0) return null;
          const totalHC = assigns.reduce((s, a) => s + a.headcount, 0);
          const monthlyCost = assigns.reduce((s, a) => s + a.headcount * (a.baseSalary * (1 + a.benefitsPct / 100) + a.fixedBonus), 0);
          const rb = result?.roleBreakdown.find(r => r.roleId === role.id);
          return { role, assignments: assigns, totalHeadcount: totalHC, monthlyCost, annualCommission: rb?.totalCommissionEarned || 0 };
        })
        .filter(Boolean) as RoleCardInfo[];
      return { project, roles: projRoles };
    });
  }, [projects, roles, roleAssignments, result]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold">Estructura Organizacional</h2>
        <p className="text-sm text-muted-foreground">Organigrama interactivo · Haz clic en un rol para ver detalle</p>
      </div>

      {/* Org chart */}
      <div className="flex flex-col items-center gap-0">
        {/* SOZU Central */}
        <div className="rounded-xl border-2 border-primary bg-card p-4 text-center min-w-[200px] shadow-md">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SOZU Central</div>
          <div className="text-lg font-bold mt-1">Equipo Estratégico</div>
        </div>

        {/* Connector */}
        <div className="w-px h-6 bg-border" />

        {/* Central roles */}
        <div className="flex flex-wrap gap-3 justify-center">
          {centralRoles.map(info => (
            <button
              key={info.role.id}
              onClick={() => setSelectedRole(info)}
              className="rounded-lg border bg-card px-4 py-3 text-left hover:border-accent hover:shadow-md transition-all min-w-[160px] group"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                <span className="font-semibold text-sm">{info.role.name}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {info.totalHeadcount} persona{info.totalHeadcount !== 1 ? 's' : ''} · {formatCurrency(info.monthlyCost)}/mes
              </div>
            </button>
          ))}
        </div>

        {/* Connectors to projects */}
        <div className="w-px h-6 bg-border" />
        <ChevronDown className="h-4 w-4 text-muted-foreground -mt-1 -mb-1" />

        {/* Projects */}
        <div className="grid gap-6 sm:grid-cols-2 w-full mt-2">
          {projectRolesMap.map(({ project, roles: projRoles }) => (
            <div key={project.id} className="rounded-xl border bg-card overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                <Building2 className="h-4 w-4 text-accent" />
                <span className="font-bold">{project.name}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">{project.totalUnits} uds</Badge>
              </div>
              <div className="p-3 space-y-2">
                {projRoles.map(info => (
                  <button
                    key={info.role.id}
                    onClick={() => setSelectedRole(info)}
                    className="w-full rounded-lg border px-3 py-2 text-left hover:border-accent hover:bg-muted/30 transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm">{info.role.name}</div>
                      <div className="text-xs text-muted-foreground">{info.totalHeadcount} HC</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono">{formatCurrency(info.monthlyCost)}/mes</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role analysis panel */}
      <RoleAnalysisPanel
        info={selectedRole}
        open={!!selectedRole}
        onClose={() => setSelectedRole(null)}
      />
    </div>
  );
}

