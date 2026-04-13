import { useState } from 'react';
import { mockObraProjects, type ObraProject } from '@/data/cobranza/obraData';
import { formatCurrency } from '@/components/cobranza/StatusBadges';
import { cn } from '@/lib/utils';
import {
  HardHat, Save, Copy, RefreshCw, BarChart3, ChevronDown, ChevronRight,
  Calendar, Building2, DollarSign, Activity, TrendingUp, AlertTriangle, Layers,
} from 'lucide-react';

type Section = 'general' | 'presupuestal' | 'erogacion' | 'forecast' | 'fisico' | 'financiero' | 'flujo';

const sectionMeta: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'Datos Generales del Proyecto', icon: Building2 },
  { id: 'presupuestal', label: 'Base Presupuestal', icon: DollarSign },
  { id: 'erogacion', label: 'Erogación y Compromisos', icon: Layers },
  { id: 'forecast', label: 'Monto por Erogar / Forecast', icon: BarChart3 },
  { id: 'fisico', label: 'Avance Físico', icon: Activity },
  { id: 'financiero', label: 'Avance Financiero', icon: TrendingUp },
  { id: 'flujo', label: 'Flujo y Liquidez', icon: AlertTriangle },
];

interface ProjectInputs {
  // General
  entidadLegal: string;
  fechaCorte: string;
  periodoPresupuestal: string;
  responsableCaptura: string;
  moneda: string;
  estatusProyecto: string;
  // Presupuestal
  presupuestoOriginal: number;
  cambiosAprobados: number;
  adicionales: number;
  deductivos: number;
  metaMensualCobranza: number;
  // Erogación
  montoErogadoPeriodo: number;
  comprometidoNoPagado: number;
  cuentasPorPagar: number;
  anticiposEntregados: number;
  anticiposAmortizados: number;
  retenciones: number;
  estimacionesPagadas: number;
  estimacionesEnRevision: number;
  estimacionesPorPagar: number;
  // Forecast
  provisionSemanal: number;
  provisionMensual: number;
  flujoRequerido4Sem: number;
  flujoRequerido3Mes: number;
  // Físico
  avanceFisicoProgramado: number;
  avanceFisicoReal: number;
  observacionesFisico: string;
  // Financiero
  avanceFinancieroProgramado: number;
  avanceFinancieroReal: number;
  // Flujo
  cobranzaProyectadaSemanal: number;
  cobranzaRealSemanal: number;
  cobranzaProyectadaMensual: number;
  cobranzaRealMensual: number;
}

function buildDefaults(p: ObraProject): ProjectInputs {
  return {
    entidadLegal: p.project === 'Margot' || p.project === 'Bottura' ? 'SOZU Desarrollos SAPI de CV' : p.project === 'Daiku' ? 'Proyectos Daiku SA de CV' : 'Monócolo Inmobiliaria SA de CV',
    fechaCorte: p.fechaCorte,
    periodoPresupuestal: 'Marzo 2026',
    responsableCaptura: 'Tomás Peterson',
    moneda: 'MXN',
    estatusProyecto: 'En ejecución',
    presupuestoOriginal: Math.round(p.presupuesto * 0.95),
    cambiosAprobados: Math.round(p.presupuesto * 0.03),
    adicionales: Math.round(p.presupuesto * 0.025),
    deductivos: Math.round(p.presupuesto * 0.005),
    metaMensualCobranza: Math.round(p.provisionSemanal * 4.3),
    montoErogadoPeriodo: Math.round(p.provisionSemanal * 2),
    comprometidoNoPagado: Math.round(p.porErogar * 0.12),
    cuentasPorPagar: Math.round(p.porErogar * 0.08),
    anticiposEntregados: Math.round(p.erogado * 0.15),
    anticiposAmortizados: Math.round(p.erogado * 0.12),
    retenciones: Math.round(p.erogado * 0.05),
    estimacionesPagadas: Math.round(p.erogado * 0.7),
    estimacionesEnRevision: Math.round(p.provisionSemanal * 1.5),
    estimacionesPorPagar: Math.round(p.provisionSemanal * 2.5),
    provisionSemanal: p.provisionSemanal,
    provisionMensual: Math.round(p.provisionSemanal * 4.3),
    flujoRequerido4Sem: p.flujoRequeridoProximo,
    flujoRequerido3Mes: Math.round(p.flujoRequeridoProximo * 3.2),
    avanceFisicoProgramado: p.avanceFisico + 3,
    avanceFisicoReal: p.avanceFisico,
    observacionesFisico: p.observaciones,
    avanceFinancieroProgramado: p.avanceFinanciero + 2,
    avanceFinancieroReal: p.avanceFinanciero,
    cobranzaProyectadaSemanal: Math.round(p.provisionSemanal * 1.1),
    cobranzaRealSemanal: Math.round(p.provisionSemanal * 0.95),
    cobranzaProyectadaMensual: Math.round(p.provisionSemanal * 4.5),
    cobranzaRealMensual: Math.round(p.provisionSemanal * 3.8),
  };
}

export default function InputsObraPage() {
  const [selectedProject, setSelectedProject] = useState(mockObraProjects[0].id);
  const [openSections, setOpenSections] = useState<Set<Section>>(new Set(['general', 'presupuestal']));
  const [saved, setSaved] = useState(false);

  const project = mockObraProjects.find(p => p.id === selectedProject)!;
  const [inputs, setInputs] = useState<ProjectInputs>(buildDefaults(project));

  const toggleSection = (s: Section) => {
    const next = new Set(openSections);
    next.has(s) ? next.delete(s) : next.add(s);
    setOpenSections(next);
  };

  const handleProjectChange = (id: string) => {
    setSelectedProject(id);
    const p = mockObraProjects.find(pr => pr.id === id)!;
    setInputs(buildDefaults(p));
    setSaved(false);
  };

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  // Calculated fields
  const presupuestoVigente = inputs.presupuestoOriginal + inputs.cambiosAprobados + inputs.adicionales - inputs.deductivos;
  const montoPorErogar = presupuestoVigente - project.erogado;
  const gapFisico = inputs.avanceFinancieroReal - inputs.avanceFisicoReal;
  const flujoNetoSemanal = inputs.cobranzaRealSemanal - inputs.provisionSemanal;
  const flujoNetoMensual = inputs.cobranzaRealMensual - inputs.provisionMensual;
  const deficitSemanal = flujoNetoSemanal < 0 ? Math.abs(flujoNetoSemanal) : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="sozu-page-title">Inputs de Obra</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Captura y administración de variables base para control presupuestal</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedProject} onChange={e => handleProjectChange(e.target.value)} className="sozu-filter-select">
            {mockObraProjects.map(p => <option key={p.id} value={p.id}>{p.project}</option>)}
          </select>
          <button onClick={handleSave} className="sozu-btn-secondary flex items-center gap-1.5">
            <Copy className="w-3.5 h-3.5" strokeWidth={1.75} /> Duplicar Corte
          </button>
          <button onClick={handleSave} className="sozu-btn-secondary flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} /> Actualizar Corte
          </button>
          <button onClick={handleSave} className={cn('sozu-btn-primary flex items-center gap-1.5', saved && 'bg-success hover:bg-success')}>
            <Save className="w-3.5 h-3.5" strokeWidth={1.75} /> {saved ? 'Guardado ✓' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Calculated Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <CalcCard label="Presupuesto Vigente" value={formatCurrency(presupuestoVigente)} icon={HardHat} calc />
        <CalcCard label="Monto por Erogar" value={formatCurrency(montoPorErogar)} icon={DollarSign} calc />
        <CalcCard label="Gap Físico / Financiero" value={`${gapFisico > 0 ? '+' : ''}${gapFisico.toFixed(1)}%`} icon={Activity} danger={Math.abs(gapFisico) > 3} calc />
        <CalcCard label="Flujo Neto Semanal" value={formatCurrency(flujoNetoSemanal)} icon={TrendingUp} danger={flujoNetoSemanal < 0} calc />
        <CalcCard label="Déficit Semanal" value={formatCurrency(deficitSemanal)} icon={AlertTriangle} danger={deficitSemanal > 0} calc />
        <CalcCard label="Flujo Neto Mensual" value={formatCurrency(flujoNetoMensual)} icon={BarChart3} danger={flujoNetoMensual < 0} calc />
      </div>

      {inputs && montoPorErogar > 0 && Math.abs(gapFisico) > 5 && (
        <div className="sozu-kpi-card !p-3 border-l-4 border-l-warning bg-warning-bg/30 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-[12px] text-muted-foreground">
            <span className="font-semibold text-warning">Advertencia:</span> Existe una desviación significativa entre avance físico ({inputs.avanceFisicoReal}%) y financiero ({inputs.avanceFinancieroReal}%). Revisar ejecución presupuestal.
          </p>
        </div>
      )}

      {/* Sections */}
      {sectionMeta.map(sec => {
        const isOpen = openSections.has(sec.id);
        return (
          <div key={sec.id} className="sozu-kpi-card !p-0 overflow-hidden">
            <button onClick={() => toggleSection(sec.id)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left">
              {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> : <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />}
              <sec.icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
              <span className="text-[13px] font-semibold text-foreground">{sec.label}</span>
            </button>
            {isOpen && (
              <div className="border-t border-border px-5 py-4">
                <SectionFields section={sec.id} inputs={inputs} setInputs={setInputs} project={project} presupuestoVigente={presupuestoVigente} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionFields({ section, inputs, setInputs, project, presupuestoVigente }: { section: Section; inputs: ProjectInputs; setInputs: (v: ProjectInputs) => void; project: ObraProject; presupuestoVigente: number }) {
  const update = (field: keyof ProjectInputs, value: any) => setInputs({ ...inputs, [field]: value });

  switch (section) {
    case 'general':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReadOnlyField label="Proyecto" value={project.project} />
          <InputField label="Entidad Legal" value={inputs.entidadLegal} onChange={v => update('entidadLegal', v)} />
          <InputField label="Fecha de Corte" value={inputs.fechaCorte} type="date" onChange={v => update('fechaCorte', v)} />
          <InputField label="Periodo Presupuestal" value={inputs.periodoPresupuestal} onChange={v => update('periodoPresupuestal', v)} />
          <InputField label="Responsable de Captura" value={inputs.responsableCaptura} onChange={v => update('responsableCaptura', v)} />
          <SelectField label="Moneda" value={inputs.moneda} options={['MXN', 'USD']} onChange={v => update('moneda', v)} />
          <SelectField label="Estatus del Proyecto" value={inputs.estatusProyecto} options={['En ejecución', 'En pausa', 'Finalizado', 'En planeación']} onChange={v => update('estatusProyecto', v)} />
        </div>
      );
    case 'presupuestal':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <NumberField label="Presupuesto Original" value={inputs.presupuestoOriginal} onChange={v => update('presupuestoOriginal', v)} />
            <NumberField label="Cambios Aprobados" value={inputs.cambiosAprobados} onChange={v => update('cambiosAprobados', v)} />
            <NumberField label="Adicionales" value={inputs.adicionales} onChange={v => update('adicionales', v)} />
            <NumberField label="Deductivos" value={inputs.deductivos} onChange={v => update('deductivos', v)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReadOnlyField label="Presupuesto Vigente (calculado)" value={formatCurrency(presupuestoVigente)} highlight />
            <NumberField label="Meta Mensual de Cobranza Vinculada" value={inputs.metaMensualCobranza} onChange={v => update('metaMensualCobranza', v)} />
          </div>
        </div>
      );
    case 'erogacion':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ReadOnlyField label="Monto Erogado Acumulado" value={formatCurrency(project.erogado)} />
            <NumberField label="Monto Erogado del Periodo" value={inputs.montoErogadoPeriodo} onChange={v => update('montoErogadoPeriodo', v)} />
            <NumberField label="Comprometido No Pagado" value={inputs.comprometidoNoPagado} onChange={v => update('comprometidoNoPagado', v)} />
            <NumberField label="Cuentas por Pagar de Obra" value={inputs.cuentasPorPagar} onChange={v => update('cuentasPorPagar', v)} />
            <NumberField label="Anticipos Entregados" value={inputs.anticiposEntregados} onChange={v => update('anticiposEntregados', v)} />
            <NumberField label="Anticipos Amortizados" value={inputs.anticiposAmortizados} onChange={v => update('anticiposAmortizados', v)} />
            <NumberField label="Retenciones" value={inputs.retenciones} onChange={v => update('retenciones', v)} />
            <NumberField label="Estimaciones Pagadas" value={inputs.estimacionesPagadas} onChange={v => update('estimacionesPagadas', v)} />
            <NumberField label="Estimaciones en Revisión" value={inputs.estimacionesEnRevision} onChange={v => update('estimacionesEnRevision', v)} />
            <NumberField label="Estimaciones por Pagar" value={inputs.estimacionesPorPagar} onChange={v => update('estimacionesPorPagar', v)} />
          </div>
        </div>
      );
    case 'forecast':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReadOnlyField label="Monto por Erogar (calculado)" value={formatCurrency(presupuestoVigente - project.erogado)} highlight />
          <NumberField label="Provisión Semanal de Obra" value={inputs.provisionSemanal} onChange={v => update('provisionSemanal', v)} />
          <NumberField label="Provisión Mensual de Obra" value={inputs.provisionMensual} onChange={v => update('provisionMensual', v)} />
          <NumberField label="Flujo Requerido Próx. 4 Semanas" value={inputs.flujoRequerido4Sem} onChange={v => update('flujoRequerido4Sem', v)} />
          <NumberField label="Flujo Requerido Próx. 3 Meses" value={inputs.flujoRequerido3Mes} onChange={v => update('flujoRequerido3Mes', v)} />
        </div>
      );
    case 'fisico':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NumberField label="Avance Físico Programado %" value={inputs.avanceFisicoProgramado} onChange={v => update('avanceFisicoProgramado', v)} suffix="%" />
            <NumberField label="Avance Físico Real %" value={inputs.avanceFisicoReal} onChange={v => update('avanceFisicoReal', v)} suffix="%" />
            <ReadOnlyField label="Desviación Física (calculado)" value={`${(inputs.avanceFisicoReal - inputs.avanceFisicoProgramado).toFixed(1)}%`} highlight danger={inputs.avanceFisicoReal < inputs.avanceFisicoProgramado} />
          </div>
          <TextareaField label="Observaciones de Avance Físico" value={inputs.observacionesFisico} onChange={v => update('observacionesFisico', v)} />
        </div>
      );
    case 'financiero':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <NumberField label="Avance Financiero Programado %" value={inputs.avanceFinancieroProgramado} onChange={v => update('avanceFinancieroProgramado', v)} suffix="%" />
          <NumberField label="Avance Financiero Real %" value={inputs.avanceFinancieroReal} onChange={v => update('avanceFinancieroReal', v)} suffix="%" />
          <ReadOnlyField label="Desviación Financiera (calculado)" value={`${(inputs.avanceFinancieroReal - inputs.avanceFinancieroProgramado).toFixed(1)}%`} highlight danger={inputs.avanceFinancieroReal < inputs.avanceFinancieroProgramado} />
          <ReadOnlyField label="% Erogado vs Presupuesto" value={`${((project.erogado / presupuestoVigente) * 100).toFixed(1)}%`} highlight />
        </div>
      );
    case 'flujo':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <NumberField label="Cobranza Proyectada Semanal" value={inputs.cobranzaProyectadaSemanal} onChange={v => update('cobranzaProyectadaSemanal', v)} />
            <NumberField label="Cobranza Real Semanal" value={inputs.cobranzaRealSemanal} onChange={v => update('cobranzaRealSemanal', v)} />
            <NumberField label="Cobranza Proyectada Mensual" value={inputs.cobranzaProyectadaMensual} onChange={v => update('cobranzaProyectadaMensual', v)} />
            <NumberField label="Cobranza Real Mensual" value={inputs.cobranzaRealMensual} onChange={v => update('cobranzaRealMensual', v)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ReadOnlyField label="Flujo Neto Semanal (calculado)" value={formatCurrency(inputs.cobranzaRealSemanal - inputs.provisionSemanal)} highlight danger={(inputs.cobranzaRealSemanal - inputs.provisionSemanal) < 0} />
            <ReadOnlyField label="Flujo Neto Mensual (calculado)" value={formatCurrency(inputs.cobranzaRealMensual - inputs.provisionMensual)} highlight danger={(inputs.cobranzaRealMensual - inputs.provisionMensual) < 0} />
            <ReadOnlyField label="Déficit Semanal" value={formatCurrency(Math.max(0, inputs.provisionSemanal - inputs.cobranzaRealSemanal))} highlight danger={(inputs.provisionSemanal - inputs.cobranzaRealSemanal) > 0} />
            <ReadOnlyField label="Déficit Mensual" value={formatCurrency(Math.max(0, inputs.provisionMensual - inputs.cobranzaRealMensual))} highlight danger={(inputs.provisionMensual - inputs.cobranzaRealMensual) > 0} />
          </div>
        </div>
      );
    default:
      return null;
  }
}

/* ─── Field Components ─── */
function InputField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-[38px] px-3 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
    </div>
  );
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">{label}</label>
      <div className="relative">
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
          className="w-full h-[38px] px-3 rounded-lg border border-border bg-background text-[13px] text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-[38px] px-3 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none" />
    </div>
  );
}

function ReadOnlyField({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">{label}</label>
      <div className={cn(
        'h-[38px] px-3 rounded-lg border flex items-center text-[13px] font-medium tabular-nums',
        highlight ? 'bg-muted/50 border-border' : 'bg-background border-border',
        danger ? 'text-danger' : 'text-foreground'
      )}>
        {value}
      </div>
    </div>
  );
}

function CalcCard({ label, value, icon: Icon, calc, danger }: { label: string; value: string; icon: React.ElementType; calc?: boolean; danger?: boolean }) {
  return (
    <div className="sozu-kpi-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={cn('w-4 h-4', danger ? 'text-danger' : 'text-primary')} strokeWidth={1.75} />
      </div>
      <p className={cn('text-xl font-semibold tabular-nums', danger ? 'text-danger' : 'text-foreground')}>{value}</p>
      {calc && <p className="text-[10px] text-muted-foreground mt-0.5 italic">Calculado automáticamente</p>}
    </div>
  );
}
