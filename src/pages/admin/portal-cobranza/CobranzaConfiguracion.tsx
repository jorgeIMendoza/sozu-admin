import { useState, lazy, Suspense } from 'react';
import { Settings, Mail, MessageSquare, FileText, Shield, Clock, List, Users, ChevronRight, CreditCard, AlertTriangle, Milestone, Send, Zap, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import { mockAutomationRules } from '@/data/cobranza/mockData';
import { cn } from '@/lib/utils';

// Lazy-load existing modules
const AdministrarAvisos = lazy(() => import('@/pages/admin/comunicacion/AdministrarAvisos'));
const EnviarAvisos = lazy(() => import('@/pages/admin/comunicacion/EnviarAvisos'));
const RolesPermisos = lazy(() => import('@/pages/admin/RolesPermisos'));
const EntidadesLegales = lazy(() => import('@/pages/admin/EntidadesLegales'));
const CategoriasProductos = lazy(() => import('@/pages/admin/CategoriasProductos'));

type ConfigView = 
  | null 
  | 'plantillas-correo' 
  | 'centro-campanas' 
  | 'roles-permisos' 
  | 'entidades-legales' 
  | 'tipos-cobro';

interface ConfigSection {
  icon: any;
  title: string;
  description: string;
  items: string;
  category: string;
  view: ConfigView;
}

const configSections: ConfigSection[] = [
  { icon: Mail, title: 'Plantillas de Correo', description: 'Plantillas para recordatorios, notificaciones, estados de cuenta y campañas', items: '8 plantillas activas', category: 'Comunicación', view: 'plantillas-correo' },
  { icon: MessageSquare, title: 'Plantillas de WhatsApp', description: 'Mensajes predefinidos para envío por WhatsApp Business', items: '7 plantillas activas', category: 'Comunicación', view: null },
  { icon: FileText, title: 'Plantilla Legal', description: 'Notificación formal para casos prelegal/legal, editable por autorizados', items: '1 plantilla configurada', category: 'Comunicación', view: null },
  { icon: Send, title: 'Centro de Campañas', description: 'Campañas masivas de recordatorios, seguimiento y comunicación por canal', items: '3 campañas programadas', category: 'Comunicación', view: 'centro-campanas' },
  { icon: Shield, title: 'Roles y Permisos', description: 'Accesos: Super Admin, Cobranza, Supervisor, Legal, Comercial, Dirección, Auditoría', items: '7 roles configurados', category: 'Administración', view: 'roles-permisos' },
  { icon: Users, title: 'Ejecutivos de Cobranza', description: 'Asignación de cartera y carga de trabajo: Luz Ochoa, Tomás Peterson', items: '2 ejecutivos activos', category: 'Administración', view: null },
  { icon: List, title: 'Entidades Legales', description: 'Razones sociales cobradoras: Tallwood, Real Estate Ventures, Komakai, Corporativo Jmdq, Hevi Holding, DZOG CAPITAL', items: '6 entidades', category: 'Administración', view: 'entidades-legales' },
  { icon: List, title: 'Relación Proyecto ↔ Entidad Legal', description: 'Mapeo de qué entidades cobran en cada proyecto', items: '4 proyectos configurados', category: 'Administración', view: null },
  { icon: List, title: 'Tipos de Cobro', description: 'Categorías: Propiedad, Producto, Servicio. Subtipos: departamento, bodega, estacionamiento, condensadora, paquete de muebles, servicio administrativo, etc.', items: '3 categorías · 11 subtipos', category: 'Administración', view: 'tipos-cobro' },
  { icon: List, title: 'Catálogos', description: 'Tipos de caso, tipos de promesa, estatus de conciliación, estatus CEP, estatus legal, motivos de atraso, orígenes de pago, días de pago, tipos documentales', items: '9 catálogos', category: 'Administración', view: null },
  { icon: CreditCard, title: 'Orígenes de Pago', description: 'Configuración de vías de pago: STP, Efectivo, Cheque, Transferencia, STP manual', items: '5 orígenes configurados', category: 'Administración', view: null },
  { icon: AlertTriangle, title: 'Penalización', description: 'Reglas de penalización, umbrales, opciones de regularización', items: '3 reglas activas', category: 'Administración', view: null },
  { icon: List, title: 'Checklist Documental', description: 'Documentos requeridos por proyecto y tipo de operación', items: '3 checklists por proyecto', category: 'Automatización', view: null },
  { icon: Milestone, title: 'Hitos y Onboarding', description: 'Configuración de hitos del proceso y checklist de onboarding de cuenta', items: '6 hitos definidos', category: 'Automatización', view: null },
];

const categories = ['Automatización', 'Comunicación', 'Administración'];

const viewTitles: Record<string, string> = {
  'plantillas-correo': 'Plantillas de Correo',
  'centro-campanas': 'Centro de Campañas',
  'roles-permisos': 'Roles y Permisos',
  'entidades-legales': 'Entidades Legales',
  'tipos-cobro': 'Tipos de Cobro',
};

function InlineLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'automations'>('config');
  const [activeView, setActiveView] = useState<ConfigView>(null);

  // If a sub-view is active, render it inline
  if (activeView) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView(null)}
            className="flex items-center gap-1.5 text-[13px] text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            Configuración
          </button>
          <span className="text-muted-foreground text-[13px]">/</span>
          <span className="text-[13px] font-semibold text-foreground">{viewTitles[activeView]}</span>
        </div>
        <Suspense fallback={<InlineLoader />}>
          {activeView === 'plantillas-correo' && <AdministrarAvisos />}
          {activeView === 'centro-campanas' && <EnviarAvisos />}
          {activeView === 'roles-permisos' && <RolesPermisos />}
          {activeView === 'entidades-legales' && <EntidadesLegales />}
          {activeView === 'tipos-cobro' && <CategoriasProductos />}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="sozu-page-title">Configuración</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Administración de plantillas, reglas, permisos y catálogos</p>
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
          <button onClick={() => setActiveTab('config')}
            className={cn('px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors', activeTab === 'config' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            Configuración
          </button>
          <button onClick={() => setActiveTab('automations')}
            className={cn('px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors', activeTab === 'automations' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            Automatizaciones ({mockAutomationRules.length})
          </button>
        </div>
      </div>

      {activeTab === 'config' ? (
        <>
          {categories.map(cat => (
            <div key={cat}>
              <h2 className="sozu-section-title mb-3">{cat}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {configSections.filter(s => s.category === cat).map(section => {
                  const hasView = section.view !== null;
                  return (
                    <div
                      key={section.title}
                      onClick={() => hasView && setActiveView(section.view)}
                      className={cn(
                        'sozu-kpi-card !p-4 flex items-start gap-3 group',
                        hasView ? 'cursor-pointer' : 'opacity-70'
                      )}
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
                        <section.icon className="w-[18px] h-[18px] text-primary" strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-[13px] font-semibold text-foreground">{section.title}</h3>
                          {hasView ? (
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-100 shrink-0" strokeWidth={1.75} />
                          ) : (
                            <span className="sozu-chip bg-muted text-muted-foreground text-[10px] shrink-0">Próximamente</span>
                          )}
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{section.description}</p>
                        <p className="text-[12px] text-primary mt-1.5 font-medium">{section.items}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="sozu-kpi-card !p-4">
              <div className="flex items-center gap-1.5 mb-1"><Zap className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} /><span className="text-[11px] text-muted-foreground">Reglas Activas</span></div>
              <p className="text-xl font-semibold text-foreground">{mockAutomationRules.filter(r => r.active).length}</p>
            </div>
            <div className="sozu-kpi-card !p-4">
              <div className="flex items-center gap-1.5 mb-1"><Send className="w-3.5 h-3.5 text-success" strokeWidth={1.75} /><span className="text-[11px] text-muted-foreground">Envíos este Mes</span></div>
              <p className="text-xl font-semibold text-foreground">{mockAutomationRules.reduce((s, r) => s + r.runsThisMonth, 0)}</p>
            </div>
            <div className="sozu-kpi-card !p-4">
              <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} /><span className="text-[11px] text-muted-foreground">Última Ejecución</span></div>
              <p className="text-[13px] font-semibold text-foreground">27 Mar 2026</p>
            </div>
          </div>

          <div className="sozu-kpi-card !p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="sozu-section-title">Reglas de Automatización</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="sozu-thead">
                <tr>
                  <th>Regla</th>
                  <th>Disparador</th>
                  <th>Acción</th>
                  <th>Canal</th>
                  <th className="text-center">Ejecuciones</th>
                  <th className="text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {mockAutomationRules.map(rule => (
                  <tr key={rule.id} className="sozu-table-row h-[52px]">
                    <td className="px-4 text-[13px] font-medium text-foreground">{rule.name}</td>
                    <td className="px-4 text-[12px] text-muted-foreground">{rule.trigger}</td>
                    <td className="px-4 text-[12px] text-foreground">{rule.action}</td>
                    <td className="px-4 text-[12px] text-muted-foreground">{rule.channel}</td>
                    <td className="px-4 text-center text-[13px] font-semibold text-foreground tabular-nums">{rule.runsThisMonth}</td>
                    <td className="px-4 text-center">
                      {rule.active
                        ? <span className="sozu-chip bg-success-bg text-success"><CheckCircle2 className="w-3 h-3" strokeWidth={1.75} /> Activa</span>
                        : <span className="sozu-chip bg-muted text-muted-foreground">Inactiva</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
