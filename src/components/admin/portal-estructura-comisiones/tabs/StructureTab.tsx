import { useState } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { Plus, Trash2, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/portal-estructura-comisiones/utils/calculations';
import type { Role, RoleAssignment } from '@/lib/portal-estructura-comisiones/types/simulator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

export default function StructureTab() {
  const { roles, roleAssignments, projects, addRole, deleteRole, addRoleAssignment, updateRoleAssignment, deleteRoleAssignment } = useSimulator();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  const centralAssignments = roleAssignments.filter(ra => !ra.projectId);
  const totalMonthlyCost = roleAssignments.reduce((s, ra) => {
    return s + ra.headcount * (ra.baseSalary * (1 + ra.benefitsPct / 100) + ra.fixedBonus);
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Estructura Organizacional</h2>
          <p className="text-sm text-muted-foreground">
            Costo fijo mensual total: <span className="font-semibold text-foreground">{formatCurrency(totalMonthlyCost)}</span>
          </p>
        </div>
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo Rol</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Rol</DialogTitle></DialogHeader>
            <RoleForm onSave={(r) => { addRole(r); setRoleDialogOpen(false); }} onCancel={() => setRoleDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Roles list */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Roles Definidos</h3>
        <div className="flex flex-wrap gap-2">
          {roles.map(role => (
            <div key={role.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm group">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{role.name}</span>
              <Badge variant={role.belongsTo === 'sozu_central' ? 'default' : 'secondary'} className="text-[10px]">
                {role.belongsTo === 'sozu_central' ? 'SOZU' : 'Proyecto'}
              </Badge>
              {role.participatesInCommission && (
                <Badge variant="outline" className="text-[10px] border-accent text-accent">Comisión</Badge>
              )}
              <button onClick={() => deleteRole(role.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Central assignments */}
      <AssignmentSection
        title="SOZU Central"
        assignments={centralAssignments}
        roles={roles}
        onUpdate={updateRoleAssignment}
        onDelete={deleteRoleAssignment}
        onAdd={(ra) => addRoleAssignment(ra)}
        projectId={null}
        availableRoles={roles.filter(r => r.belongsTo === 'sozu_central')}
      />

      {/* Per-project assignments */}
      {projects.map(project => {
        const projAssignments = roleAssignments.filter(ra => ra.projectId === project.id);
        return (
          <AssignmentSection
            key={project.id}
            title={project.name}
            assignments={projAssignments}
            roles={roles}
            onUpdate={updateRoleAssignment}
            onDelete={deleteRoleAssignment}
            onAdd={(ra) => addRoleAssignment(ra)}
            projectId={project.id}
            availableRoles={roles.filter(r => r.belongsTo === 'project')}
          />
        );
      })}
    </div>
  );
}

function AssignmentSection({ title, assignments, roles, onUpdate, onDelete, onAdd, projectId, availableRoles }: {
  title: string;
  assignments: RoleAssignment[];
  roles: Role[];
  onUpdate: (ra: RoleAssignment) => void;
  onDelete: (id: string) => void;
  onAdd: (ra: RoleAssignment) => void;
  projectId: string | null;
  availableRoles: Role[];
}) {
  const monthlyCost = assignments.reduce((s, ra) =>
    s + ra.headcount * (ra.baseSalary * (1 + ra.benefitsPct / 100) + ra.fixedBonus), 0);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">Costo mensual: {formatCurrency(monthlyCost)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          if (availableRoles.length === 0) return;
          onAdd({
            id: crypto.randomUUID(),
            roleId: availableRoles[0].id,
            projectId,
            headcount: 1,
            baseSalary: 20000,
            fixedBonus: 0,
            benefitsPct: 30,
          });
        }}>
          <Plus className="h-3 w-3 mr-1" /> Agregar
        </Button>
      </div>
      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Sin asignaciones</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Rol</th>
              <th>HC</th>
              <th>Sueldo Base</th>
              <th>Bono Fijo</th>
              <th>Prestaciones %</th>
              <th>Costo Total/mes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(ra => {
              const role = roles.find(r => r.id === ra.roleId);
              const totalCost = ra.headcount * (ra.baseSalary * (1 + ra.benefitsPct / 100) + ra.fixedBonus);
              return (
                <tr key={ra.id}>
                  <td>
                    <select
                      value={ra.roleId}
                      onChange={e => onUpdate({ ...ra, roleId: e.target.value })}
                      className="rounded border bg-transparent px-2 py-1 text-sm"
                    >
                      {availableRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <Input type="number" className="w-16 h-8 text-sm" value={ra.headcount}
                      onChange={e => onUpdate({ ...ra, headcount: +e.target.value })} />
                  </td>
                  <td>
                    <Input type="number" className="w-28 h-8 text-sm" value={ra.baseSalary}
                      onChange={e => onUpdate({ ...ra, baseSalary: +e.target.value })} />
                  </td>
                  <td>
                    <Input type="number" className="w-24 h-8 text-sm" value={ra.fixedBonus}
                      onChange={e => onUpdate({ ...ra, fixedBonus: +e.target.value })} />
                  </td>
                  <td>
                    <Input type="number" className="w-20 h-8 text-sm" value={ra.benefitsPct}
                      onChange={e => onUpdate({ ...ra, benefitsPct: +e.target.value })} />
                  </td>
                  <td className="font-semibold font-mono text-sm">{formatCurrency(totalCost)}</td>
                  <td>
                    <button onClick={() => onDelete(ra.id)} className="rounded p-1 hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RoleForm({ onSave, onCancel }: { onSave: (r: Role) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Role['type']>('operative');
  const [belongsTo, setBelongsTo] = useState<Role['belongsTo']>('project');
  const [commission, setCommission] = useState(true);

  return (
    <div className="space-y-4">
      <div>
        <Label>Nombre del Rol</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Gerente de Ventas" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as Role['type'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="strategic">Estratégico</SelectItem>
              <SelectItem value="operative">Operativo</SelectItem>
              <SelectItem value="support">Soporte</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Pertenece a</Label>
          <Select value={belongsTo} onValueChange={(v) => setBelongsTo(v as Role['belongsTo'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sozu_central">SOZU Central</SelectItem>
              <SelectItem value="project">Proyecto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={commission} onCheckedChange={setCommission} />
        <Label>Participa en comisión</Label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button disabled={!name} onClick={() => onSave({ id: crypto.randomUUID(), name, type, belongsTo, participatesInCommission: commission })}>Guardar</Button>
      </div>
    </div>
  );
}
