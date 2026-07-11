import { useState } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { Plus, Pencil, Trash2, AlertCircle, ChevronDown, ChevronRight, TrendingUp, Database } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/portal-estructura-comisiones/utils/calculations';
import { useForecastTotalGlobal } from '@/hooks/usePortalAltaDireccion/useForecastIngresos';
import { useProyectosTallwoodReales, type RealProjectData } from '@/hooks/usePortalEstructuraComisiones/useProyectosTallwoodReales';
import type { Project } from '@/lib/portal-estructura-comisiones/types/simulator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProjectInventory from '../shared/ProjectInventory';
import PricingStrategy from '../shared/PricingStrategy';

export default function ProjectsTab() {
  const { projects, addProject, updateProject, deleteProject } = useSimulator();
  const { total: forecastTotal, isLoading: forecastLoading } = useForecastTotalGlobal();
  const { getRealData } = useProyectosTallwoodReales();
  const [editing, setEditing] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'inventory' | 'pricing'>('inventory');

  const emptyProject: Project = {
    id: '', name: '', totalUnits: 100, averagePrice: 10000000,
    stage: 'Preventa', startDate: '2025-01-01', endDate: '2027-12-31',
    salesStartDate: '2025-01-01', deliveryDate: '2027-12-31',
    monthlyAbsorption: 4, totalCommissionPct: 6,
    channelMix: {}, monthlyForecast: Array(12).fill(4),
  };

  const handleSave = (project: Project) => {
    if (project.id) {
      updateProject(project);
    } else {
      addProject({ ...project, id: crypto.randomUUID() });
    }
    setOpen(false);
    setEditing(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedProject(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Proyectos</h2>
          <p className="text-sm text-muted-foreground">Gestiona los proyectos inmobiliarios del grupo</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Nuevo Proyecto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Proyecto' : 'Nuevo Proyecto'}</DialogTitle>
            </DialogHeader>
            <ProjectForm
              project={editing || emptyProject}
              real={editing ? getRealData(editing.name) : undefined}
              onSave={handleSave}
              onCancel={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Forecast de Ingresos Totales — mismo número global del Forecast de
          Ingresos del Portal Alta Dirección (cuentas con flujo + inventario
          disponible, todos los tipos). */}
      <div className="metric-card flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Forecast de Ingresos Totales</p>
          <p className="text-2xl font-bold tabular-nums">
            {forecastLoading ? '—' : formatCurrency(forecastTotal)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Cuentas con flujo + inventario disponible (Propiedad, Producto y Servicio)
          </p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
          <TrendingUp className="h-5 w-5" />
        </span>
      </div>

      <div className="space-y-4">
        {projects.map(project => {
          const real = getRealData(project.name);
          const display = {
            totalUnits: real ? real.totalUnits : project.totalUnits,
            averagePrice: real ? real.averagePrice : project.averagePrice,
            monthlyAbsorption: real ? real.monthlyAbsorption : project.monthlyAbsorption,
            totalCommissionPct: real ? real.totalCommissionPct : project.totalCommissionPct,
            salesStartDate: real ? real.salesStartDate : project.salesStartDate,
            deliveryDate: real ? real.deliveryDate : project.deliveryDate,
            stage: real?.stage ?? project.stage,
          };
          return (
          <div key={project.id} className="metric-card">
            {/* Project Header */}
            <div className="flex items-start justify-between">
              <button onClick={() => toggleExpand(project.id)} className="flex items-start gap-2 text-left group">
                {expandedProject === project.id
                  ? <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />
                }
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-1.5">
                    {project.name}
                    {real && <Database className="h-3.5 w-3.5 text-muted-foreground" aria-label="Datos reales de BD" />}
                  </h3>
                  <span className="inline-block mt-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                    {display.stage}
                  </span>
                </div>
              </button>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(project); setOpen(true); }} className="rounded-md p-1.5 hover:bg-muted">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => deleteProject(project.id)} className="rounded-md p-1.5 hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            </div>

            {/* Summary Grid */}
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Unidades</p>
                <p className="font-semibold">{formatNumber(display.totalUnits)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Precio Prom.</p>
                <p className="font-semibold">{formatCurrency(display.averagePrice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absorción/mes</p>
                <p className="font-semibold">
                  {display.monthlyAbsorption != null ? `${display.monthlyAbsorption.toFixed(1)} uds` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Comisión Total</p>
                <p className="font-semibold">
                  {display.totalCommissionPct != null ? `${display.totalCommissionPct.toFixed(1)}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Inicio de Venta</p>
                <p className="font-semibold text-xs">{display.salesStartDate || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entrega</p>
                <p className="font-semibold text-xs">{display.deliveryDate || '—'}</p>
              </div>
            </div>

            {/* Expanded: Inventory & Pricing */}
            {expandedProject === project.id && (
              <div className="mt-5 pt-5 border-t space-y-4">
                {/* Section Tabs */}
                <div className="flex gap-1 border-b">
                  <button
                    onClick={() => setActiveSection('inventory')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeSection === 'inventory'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Inventario de Unidades
                  </button>
                  <button
                    onClick={() => setActiveSection('pricing')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeSection === 'pricing'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Estrategia de Precios
                  </button>
                </div>

                {activeSection === 'inventory' && <ProjectInventory projectId={project.id} />}
                {activeSection === 'pricing' && <PricingStrategy projectId={project.id} />}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectForm({ project, real, onSave, onCancel }: { project: Project; real?: RealProjectData; onSave: (p: Project) => void; onCancel: () => void }) {
  const [form, setForm] = useState(project);
  const set = (key: keyof Project, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const dateError = !real && form.deliveryDate && form.salesStartDate && form.deliveryDate <= form.salesStartDate;

  const realHint = real ? <p className="mt-1 text-[11px] text-muted-foreground">Dato real de BD — no editable</p> : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Nombre</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del proyecto" />
        </div>
        <div>
          <Label>Total Unidades</Label>
          {real
            ? <Input disabled value={formatNumber(real.totalUnits)} />
            : <Input type="number" value={form.totalUnits} onChange={e => set('totalUnits', +e.target.value)} />}
          {realHint}
        </div>
        <div>
          <Label>Precio Promedio ($)</Label>
          {real
            ? <Input disabled value={formatCurrency(real.averagePrice)} />
            : <Input type="number" value={form.averagePrice} onChange={e => set('averagePrice', +e.target.value)} />}
          {realHint}
        </div>
        <div>
          <Label>Etapa</Label>
          {real
            ? <Input disabled value={real.stage ?? '—'} />
            : <Input value={form.stage} onChange={e => set('stage', e.target.value)} />}
          {realHint}
        </div>
        <div>
          <Label>Absorción Mensual</Label>
          {real
            ? <Input disabled value={real.monthlyAbsorption != null ? `${real.monthlyAbsorption.toFixed(1)} uds` : '—'} />
            : <Input type="number" value={form.monthlyAbsorption} onChange={e => set('monthlyAbsorption', +e.target.value)} />}
          {realHint}
        </div>
        <div>
          <Label>Comisión Total (%)</Label>
          {real
            ? <Input disabled value={real.totalCommissionPct != null ? `${real.totalCommissionPct.toFixed(1)}%` : '—'} />
            : <Input type="number" step="0.1" value={form.totalCommissionPct} onChange={e => set('totalCommissionPct', +e.target.value)} />}
          {realHint}
        </div>
        <div>
          <Label>Inicio de Venta</Label>
          {real
            ? <Input disabled value={real.salesStartDate ?? '—'} />
            : <Input type="date" value={form.salesStartDate} onChange={e => set('salesStartDate', e.target.value)} />}
          {realHint}
        </div>
        <div>
          <Label>Entrega / Escrituración</Label>
          {real
            ? <Input disabled value={real.deliveryDate ?? '—'} />
            : (
              <Input
                type="date"
                value={form.deliveryDate}
                onChange={e => set('deliveryDate', e.target.value)}
                className={dateError ? 'border-destructive' : ''}
              />
            )}
          {realHint}
          {dateError && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              La fecha de entrega debe ser posterior a la fecha de inicio de venta.
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name || !!dateError}>Guardar</Button>
      </div>
    </div>
  );
}
