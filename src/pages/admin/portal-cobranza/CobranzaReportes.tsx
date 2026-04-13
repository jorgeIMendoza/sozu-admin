import { Download, FileText, BarChart3, AlertTriangle, Gavel, FolderOpen, CreditCard, FileCheck, DollarSign, Users, Clock, Handshake, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReportItem {
  name: string;
  description: string;
  category: string;
  meta?: string;
  granularity?: string;
  realtime?: boolean;
}

const reports: ReportItem[] = [
  // Financiero
  { name: 'Cobrado por mes', description: 'Detalle de pagos cobrados por periodo mensual', category: 'Financiero', meta: 'Mensual · Filtrable por proyecto y entidad legal', granularity: 'Mensual' },
  { name: 'Cobrado acumulado', description: 'Acumulado histórico de cobranza por proyecto y periodo', category: 'Financiero', meta: 'YTD · Anual', granularity: 'Acumulado' },
  { name: 'Por cobrar por proyecto', description: 'Desglose de saldos pendientes por proyecto activo', category: 'Financiero', meta: 'En tiempo real', realtime: true },
  { name: 'Cobrado vs proyectado', description: 'Comparativo entre meta de cobranza y cobranza real', category: 'Financiero', meta: 'Mensual · Trimestral' },
  { name: 'Recovery rate', description: 'Tasa de recuperación de cartera vencida por periodo', category: 'Financiero', meta: 'Mensual' },
  { name: 'Saldos vencidos por periodo', description: 'Evolución de saldos vencidos a través del tiempo', category: 'Financiero', meta: 'Tendencia mensual' },
  { name: 'Cobrado por entidad legal', description: 'Desglose de cobranza realizada por cada entidad legal cobradora', category: 'Financiero', meta: 'Filtrable por proyecto · En tiempo real', realtime: true },
  { name: 'Por cobrar por entidad legal', description: 'Saldos pendientes desglosados por entidad legal', category: 'Financiero', meta: 'Filtrable por proyecto' },
  { name: 'Cobrado por tipo de cobro', description: 'Cobranza segmentada por propiedad, producto y servicio', category: 'Financiero', meta: 'En tiempo real · Desglose por subtipo', realtime: true },
  { name: 'Flujo semanal vs pagos de obra', description: 'Comparativo entre cobranza proyectada, cobrada y provisión de obra', category: 'Financiero', meta: 'Semanal · Configurable' },
  { name: 'Mix de cobranza', description: 'Distribución porcentual entre propiedades, productos y servicios', category: 'Financiero', meta: 'Por proyecto y periodo' },
  // Cartera
  { name: 'Cartera vencida durante obra', description: 'Resumen de cartera vencida por proyecto en etapa de construcción', category: 'Cartera' },
  { name: 'Cartera por proyecto', description: 'Desglose de cartera total por proyecto activo', category: 'Cartera' },
  { name: 'Cartera por ejecutivo', description: 'Distribución de cartera asignada por ejecutivo de cobranza', category: 'Cartera' },
  { name: 'Cartera por entidad legal', description: 'Distribución de cartera asignada por entidad legal cobradora', category: 'Cartera' },
  { name: 'Aging de cartera', description: 'Distribución de cartera vencida por rangos de antigüedad', category: 'Cartera' },
  { name: 'Cuentas 100% conciliadas', description: 'Listado de cuentas con todos los pagos conciliados y CEPs validados', category: 'Cartera', realtime: true },
  // Vencimientos
  { name: 'Clientes con 1 parcialidad vencida', description: 'Listado de clientes con una parcialidad pendiente — alerta preventiva', category: 'Vencimientos' },
  { name: 'Clientes con 2+ parcialidades vencidas', description: 'Listado de clientes con dos o más parcialidades vencidas — prioridad alta', category: 'Vencimientos' },
  { name: 'Clientes con 3+ parcialidades vencidas', description: 'Clientes en riesgo prelegal por acumulación de vencimientos', category: 'Vencimientos' },
  { name: 'Próximos vencimientos', description: 'Parcialidades con vencimiento en los próximos 7, 15 y 30 días', category: 'Vencimientos' },
  // Conciliación
  { name: 'Pagos sin CEP', description: 'Pagos históricos que no tienen CEP validado', category: 'Conciliación', meta: 'Incluye antigüedad · Filtrable por entidad legal' },
  { name: 'Pagos directos a desarrolladora', description: 'Pagos hechos directamente a cuentas de la desarrolladora', category: 'Conciliación' },
  { name: 'Cobranza por proyecto y periodo', description: 'Desglose cruzado de cobrado, pendiente, vencido por proyecto y periodo', category: 'Conciliación', meta: 'Tabla pivote' },
  { name: 'Resumen de pagos por CLABE', description: 'Pagos vinculados a una CLABE específica para rastreo', category: 'Conciliación', meta: 'Búsqueda por CLABE' },
  { name: 'Conciliaciones pendientes', description: 'Incidencias de pago abiertas o en revisión', category: 'Conciliación' },
  { name: 'Productos 100% conciliados', description: 'Productos y servicios con todos sus pagos conciliados', category: 'Conciliación', realtime: true },
  // Operativo
  { name: 'Pagos del mes', description: 'Todos los pagos recibidos en el periodo actual', category: 'Operativo' },
  { name: 'Documentación incompleta', description: 'Cuentas con documentos faltantes o rechazados', category: 'Operativo' },
  { name: 'Promesas activas e incumplidas', description: 'Compromisos de pago vigentes y no cumplidos', category: 'Operativo' },
  { name: 'Carga de trabajo por ejecutivo', description: 'Distribución de cuentas, casos y promesas por ejecutivo', category: 'Operativo' },
  { name: 'Tiempos de atención', description: 'Promedio de tiempo de respuesta por tipo de caso y SLA', category: 'Operativo', meta: 'Incluye % fuera SLA' },
  { name: 'Estados de cuenta enviados', description: 'Registro de envíos de estados de cuenta por periodo', category: 'Operativo' },
  { name: 'Solicitudes de comprobantes', description: 'Solicitudes de comprobantes atendidas y pendientes', category: 'Operativo' },
  // Legal
  { name: 'Clientes en penalización', description: 'Cuentas penalizadas o en riesgo de penalización', category: 'Legal' },
  { name: 'Cuentas escaladas a legal', description: 'Cuentas en proceso prelegal o legal', category: 'Legal' },
  { name: 'Contratos faltantes', description: 'Cuentas sin contrato firmado cargado', category: 'Legal' },
  { name: 'Convenios de terminación', description: 'Convenios firmados o en proceso con detalle de penalidad y devolución', category: 'Legal' },
  { name: 'Unidades liberadas comercialmente', description: 'Unidades liberadas tras rescisión o terminación de convenio', category: 'Legal' },
  // Entidad Legal
  { name: 'Cobranza por concepto', description: 'Reporte detallado por entidad legal, proyecto, tipo y subtipo de cobro', category: 'Entidad Legal', meta: 'Exportable · Tabla detallada' },
  { name: 'Proyecto vs Entidad Legal vs Tipo', description: 'Tabla pivot cruzando proyecto, entidad cobradora y categoría de cobro', category: 'Entidad Legal', meta: 'Reporte pivot' },
  { name: 'Vencido por entidad legal', description: 'Saldos vencidos agrupados por entidad legal cobradora', category: 'Entidad Legal', meta: 'En tiempo real', realtime: true },
];

const categoryIcons: Record<string, React.ElementType> = {
  Financiero: DollarSign,
  Cartera: BarChart3,
  Vencimientos: AlertTriangle,
  Operativo: FolderOpen,
  Conciliación: CreditCard,
  Legal: Gavel,
  'Entidad Legal': Shield,
};

const categoryOrder = ['Financiero', 'Cartera', 'Vencimientos', 'Conciliación', 'Operativo', 'Legal', 'Entidad Legal'];

export default function ReportesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="sozu-page-title">Centro de Reportes</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Genera y exporta reportes ejecutivos, financieros y operativos · {reports.length} reportes disponibles</p>
      </div>

      {categoryOrder.map(cat => {
        const CatIcon = categoryIcons[cat] || FileText;
        const catReports = reports.filter(r => r.category === cat);
        if (catReports.length === 0) return null;
        return (
          <div key={cat}>
            <h2 className="sozu-section-title mb-3 flex items-center gap-2">
              <CatIcon className="w-4 h-4 text-primary" strokeWidth={1.75} />
              {cat}
              <span className="text-[11px] text-muted-foreground font-normal">({catReports.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {catReports.map(report => (
                <div key={report.name} className="sozu-kpi-card !p-4 flex flex-col justify-between">
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[13px] font-semibold text-foreground">{report.name}</p>
                      {report.realtime && <span className="sozu-chip bg-success-bg text-success text-[9px]">En vivo</span>}
                    </div>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{report.description}</p>
                    {report.meta && <p className="text-[10px] text-primary font-medium mt-1">{report.meta}</p>}
                    {report.granularity && <p className="text-[10px] text-muted-foreground mt-0.5">Granularidad: {report.granularity}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-[12px] px-2.5">
                      <Download className="w-3 h-3 mr-1" strokeWidth={1.75} />Excel
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[12px] px-2.5">
                      <Download className="w-3 h-3 mr-1" strokeWidth={1.75} />PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
