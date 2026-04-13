import { useState, useMemo } from 'react';
import { Search, RefreshCw, Download, Copy, Eye, X, BarChart3, CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type ExecStatus = 'completado' | 'completado_errores' | 'en_proceso' | 'programado' | 'cancelado' | 'fallido';

interface Execution {
  id: string;
  date: string;
  avisoName: string;
  trigger: 'manual' | 'automatico' | 'programado';
  channel: string;
  totalRecipients: number;
  sent: number;
  errors: number;
  status: ExecStatus;
  executedBy: string;
  errorDetails?: { recipient: string; error: string; cause: string; statusCode: string; datetime: string }[];
}

const statusLabels: Record<ExecStatus, string> = {
  completado: 'Completado', completado_errores: 'Con errores', en_proceso: 'En proceso',
  programado: 'Programado', cancelado: 'Cancelado', fallido: 'Fallido',
};
const statusStyles: Record<ExecStatus, string> = {
  completado: 'bg-success-bg text-success', completado_errores: 'bg-warning-bg text-warning',
  en_proceso: 'bg-info/10 text-info', programado: 'bg-muted text-muted-foreground',
  cancelado: 'bg-muted text-muted-foreground', fallido: 'bg-danger-bg text-danger',
};

const mockExecutions: Execution[] = [
  { id: 'EX-001', date: '2026-03-28T14:30:00', avisoName: 'Recordatorio preventivo de pago', trigger: 'automatico', channel: 'Email', totalRecipients: 45, sent: 43, errors: 2, status: 'completado_errores', executedBy: 'Sistema',
    errorDetails: [
      { recipient: 'miguel.vargas@mail.com', error: 'SMTP 550', cause: 'Correo inválido o inexistente', statusCode: '550', datetime: '2026-03-28T14:31:12' },
      { recipient: 'ana.montoya@corp.mx', error: 'SMTP 452', cause: 'Buzón lleno', statusCode: '452', datetime: '2026-03-28T14:31:15' },
    ] },
  { id: 'EX-002', date: '2026-03-27T10:00:00', avisoName: 'Estado de cuenta mensual', trigger: 'automatico', channel: 'Email', totalRecipients: 60, sent: 60, errors: 0, status: 'completado', executedBy: 'Sistema' },
  { id: 'EX-003', date: '2026-03-26T16:45:00', avisoName: 'Aviso de parcialidad vencida', trigger: 'manual', channel: 'Email', totalRecipients: 12, sent: 11, errors: 1, status: 'completado_errores', executedBy: 'Luz Ochoa',
    errorDetails: [{ recipient: 'sergio.ibarra@email.com', error: 'Bounce 550', cause: 'Dirección marcada como rebote previo', statusCode: '550', datetime: '2026-03-26T16:46:00' }] },
  { id: 'EX-004', date: '2026-03-25T09:00:00', avisoName: 'Recordatorio WhatsApp preventivo', trigger: 'manual', channel: 'WhatsApp', totalRecipients: 8, sent: 8, errors: 0, status: 'completado', executedBy: 'Luz Ochoa' },
  { id: 'EX-005', date: '2026-03-24T11:30:00', avisoName: 'Solicitud de comprobante', trigger: 'manual', channel: 'Email', totalRecipients: 5, sent: 5, errors: 0, status: 'completado', executedBy: 'Tomás Peterson' },
  { id: 'EX-006', date: '2026-03-23T08:00:00', avisoName: 'Notificación prelegal', trigger: 'manual', channel: 'Email', totalRecipients: 3, sent: 2, errors: 1, status: 'completado_errores', executedBy: 'Tomás Peterson',
    errorDetails: [{ recipient: 'emilio.zavala@test.com', error: 'Timeout', cause: 'Error técnico de conexión', statusCode: '408', datetime: '2026-03-23T08:01:30' }] },
  { id: 'EX-007', date: '2026-03-22T14:00:00', avisoName: 'Seguimiento de promesa de pago', trigger: 'manual', channel: 'Email', totalRecipients: 7, sent: 7, errors: 0, status: 'completado', executedBy: 'Luz Ochoa' },
  { id: 'EX-008', date: '2026-04-01T09:00:00', avisoName: 'Recordatorio preventivo de pago', trigger: 'programado', channel: 'Email', totalRecipients: 50, sent: 0, errors: 0, status: 'programado', executedBy: 'Luz Ochoa' },
  { id: 'EX-009', date: '2026-03-21T10:00:00', avisoName: 'Bienvenida cobranza', trigger: 'automatico', channel: 'Email', totalRecipients: 2, sent: 2, errors: 0, status: 'completado', executedBy: 'Sistema' },
  { id: 'EX-010', date: '2026-03-20T15:00:00', avisoName: 'Documentación faltante', trigger: 'manual', channel: 'Email', totalRecipients: 4, sent: 3, errors: 1, status: 'completado_errores', executedBy: 'Tomás Peterson',
    errorDetails: [{ recipient: 'lorena.estrada@corp.mx', error: 'SMTP 550', cause: 'Dominio no existe', statusCode: '550', datetime: '2026-03-20T15:01:00' }] },
];

const chartData = [
  { day: '22 Mar', enviados: 7, errores: 0 },
  { day: '23 Mar', enviados: 2, errores: 1 },
  { day: '24 Mar', enviados: 8, errores: 0 },
  { day: '25 Mar', enviados: 5, errores: 0 },
  { day: '26 Mar', enviados: 11, errores: 1 },
  { day: '27 Mar', enviados: 60, errores: 0 },
  { day: '28 Mar', enviados: 43, errores: 2 },
];

export default function EjecucionesPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [detailExec, setDetailExec] = useState<Execution | null>(null);

  const filtered = useMemo(() => {
    return mockExecutions.filter(ex => {
      if (search && !ex.avisoName.toLowerCase().includes(search.toLowerCase()) && !ex.id.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus !== 'all' && ex.status !== filterStatus) return false;
      if (filterChannel !== 'all' && ex.channel.toLowerCase() !== filterChannel) return false;
      return true;
    });
  }, [search, filterStatus, filterChannel]);

  const totalSent = mockExecutions.reduce((s, e) => s + e.sent, 0);
  const totalErrors = mockExecutions.reduce((s, e) => s + e.errors, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Ejecuciones de Avisos</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Control y auditoría de todos los envíos de comunicación de cobranza.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total ejecuciones', value: mockExecutions.length, icon: BarChart3, color: 'text-foreground' },
          { label: 'Enviados', value: totalSent, icon: CheckCircle, color: 'text-success' },
          { label: 'Errores', value: totalErrors, icon: AlertTriangle, color: 'text-warning' },
          { label: 'Programados', value: mockExecutions.filter(e => e.status === 'programado').length, icon: Clock, color: 'text-info' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} strokeWidth={1.75} />
              <span className="text-[11px] text-muted-foreground font-medium">{kpi.label}</span>
            </div>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Envíos por día</h3>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="enviados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Enviados" />
              <Bar dataKey="errores" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Errores" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ejecución..."
            className="w-full h-[38px] pl-9 pr-3 rounded-lg border border-border bg-background text-[13px]" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
          <option value="all">Estatus</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} className="h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
          <option value="all">Canal</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-[220px]">Aviso</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Dest.</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="text-right">Errores</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Ejecutado por</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(ex => (
              <TableRow key={ex.id}>
                <TableCell><span className="text-[12px] text-muted-foreground">{new Date(ex.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span></TableCell>
                <TableCell><span className="text-[13px] font-medium text-foreground">{ex.avisoName}</span></TableCell>
                <TableCell>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${ex.trigger === 'automatico' ? 'bg-info/10 text-info' : ex.trigger === 'programado' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                    {ex.trigger === 'automatico' ? 'Auto' : ex.trigger === 'programado' ? 'Prog.' : 'Manual'}
                  </span>
                </TableCell>
                <TableCell><span className="text-[12px] text-muted-foreground">{ex.channel}</span></TableCell>
                <TableCell className="text-right"><span className="text-[13px] font-medium">{ex.totalRecipients}</span></TableCell>
                <TableCell className="text-right"><span className="text-[13px] font-medium text-success">{ex.sent}</span></TableCell>
                <TableCell className="text-right">
                  {ex.errors > 0 ? <span className="text-[13px] font-medium text-destructive">{ex.errors}</span> : <span className="text-[13px] text-muted-foreground">0</span>}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[ex.status]}`}>{statusLabels[ex.status]}</span>
                </TableCell>
                <TableCell><span className="text-[12px] text-muted-foreground">{ex.executedBy}</span></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setDetailExec(ex)} className="p-1 rounded hover:bg-muted" title="Ver detalle"><Eye className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailExec} onOpenChange={() => setDetailExec(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Detalle de ejecución</DialogTitle>
          </DialogHeader>
          {detailExec && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-2 text-[13px]">
                <div><span className="text-muted-foreground">ID:</span> <span className="font-medium">{detailExec.id}</span></div>
                <div><span className="text-muted-foreground">Fecha:</span> <span className="font-medium">{new Date(detailExec.date).toLocaleString('es-MX')}</span></div>
                <div><span className="text-muted-foreground">Aviso:</span> <span className="font-medium">{detailExec.avisoName}</span></div>
                <div><span className="text-muted-foreground">Canal:</span> <span className="font-medium">{detailExec.channel}</span></div>
                <div><span className="text-muted-foreground">Enviados:</span> <span className="font-medium text-success">{detailExec.sent}</span></div>
                <div><span className="text-muted-foreground">Errores:</span> <span className="font-medium text-destructive">{detailExec.errors}</span></div>
              </div>
              {detailExec.errorDetails && detailExec.errorDetails.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-semibold text-foreground mb-2">Detalle de errores</h4>
                  <div className="space-y-2">
                    {detailExec.errorDetails.map((err, i) => (
                      <div key={i} className="bg-danger-bg/50 rounded-lg border border-danger/20 p-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[12px] font-medium text-foreground">{err.recipient}</span>
                          <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{err.statusCode}</code>
                        </div>
                        <p className="text-[11px] text-danger font-medium">{err.error}</p>
                        <p className="text-[11px] text-muted-foreground">{err.cause}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(err.datetime).toLocaleString('es-MX')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {detailExec?.errors ? (
              <Button size="sm" variant="outline" className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Reintentar fallidos</Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setDetailExec(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
