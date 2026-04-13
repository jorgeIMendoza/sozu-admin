import { useState, useMemo } from 'react';
import { Search, Plus, MoreHorizontal, Copy, Power, Trash2, Pencil, Mail, MessageSquare, FileText, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { avisoCategoryLabels, type AvisoCategory, type AvisoChannel } from '@/data/avisosData';

// ── Extended Aviso Definition ───────────────────────────────────
interface AvisoDefinition {
  id: string;
  name: string;
  type: 'manual' | 'automatico';
  channel: AvisoChannel | 'interno' | 'mixto';
  category: AvisoCategory;
  templateId: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  subject: string;
  body: string;
  variables: string[];
}

const extendedCategories: Record<string, string> = {
  ...avisoCategoryLabels,
  promesa_pago: 'Promesa de pago',
  conciliacion: 'Conciliación',
  seguimiento_general: 'Seguimiento general',
};

const channelLabels: Record<string, string> = {
  email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS', interno: 'Interno / Bitácora', mixto: 'Mixto',
};
const channelIcons: Record<string, React.ReactNode> = {
  email: <Mail className="w-3.5 h-3.5" />, whatsapp: <MessageSquare className="w-3.5 h-3.5" />,
  sms: <FileText className="w-3.5 h-3.5" />, interno: <FileText className="w-3.5 h-3.5" />, mixto: <FileText className="w-3.5 h-3.5" />,
};

const cobranzaVariables = [
  '{{nombre_cliente}}', '{{proyecto}}', '{{unidad}}', '{{id_cuenta}}',
  '{{monto_vencido}}', '{{monto_por_cobrar}}', '{{fecha_pago}}',
  '{{proxima_fecha_vencimiento}}', '{{telefono_cobranza}}', '{{ejecutivo}}',
  '{{entidad_legal}}', '{{estado_cuenta_url}}',
];

const mockDefinitions: AvisoDefinition[] = [
  { id: 'AD-001', name: 'Recordatorio preventivo de pago', type: 'automatico', channel: 'email', category: 'cobranza_preventiva', templateId: 'TPL-COB-001', active: true, createdAt: '2026-01-15', createdBy: 'Luz Ochoa', subject: 'Recordatorio de pago próximo - {{proyecto}}', body: 'Estimado {{nombre_cliente}}, le recordamos que su próxima fecha de pago es el {{proxima_fecha_vencimiento}}...', variables: ['nombre_cliente', 'proyecto', 'proxima_fecha_vencimiento', 'monto_por_cobrar'] },
  { id: 'AD-002', name: 'Aviso de parcialidad vencida', type: 'manual', channel: 'email', category: 'cobranza_vencida', templateId: 'TPL-COB-002', active: true, createdAt: '2026-01-20', createdBy: 'Luz Ochoa', subject: 'Parcialidad vencida - Acción requerida', body: 'Estimado {{nombre_cliente}}, su cuenta {{id_cuenta}} presenta un saldo vencido de ${{monto_vencido}}...', variables: ['nombre_cliente', 'id_cuenta', 'monto_vencido'] },
  { id: 'AD-003', name: 'Estado de cuenta mensual', type: 'automatico', channel: 'email', category: 'estado_cuenta', templateId: 'TPL-COB-003', active: true, createdAt: '2026-02-01', createdBy: 'Tomás Peterson', subject: 'Estado de cuenta actualizado - {{proyecto}}', body: 'Adjunto encontrará su estado de cuenta actualizado...', variables: ['nombre_cliente', 'proyecto', 'estado_cuenta_url'] },
  { id: 'AD-004', name: 'Solicitud de comprobante', type: 'manual', channel: 'email', category: 'comprobante', templateId: 'TPL-COB-004', active: true, createdAt: '2026-02-10', createdBy: 'Luz Ochoa', subject: 'Solicitud de comprobante de pago', body: 'Estimado {{nombre_cliente}}, le solicitamos enviar el comprobante de su último pago...', variables: ['nombre_cliente', 'id_cuenta', 'fecha_pago'] },
  { id: 'AD-005', name: 'Aviso de penalización', type: 'manual', channel: 'email', category: 'penalizacion', templateId: 'TPL-COB-005', active: true, createdAt: '2026-02-15', createdBy: 'Tomás Peterson', subject: 'Aviso de penalización por incumplimiento', body: 'Le informamos que su cuenta ha sido sujeta a proceso de penalización...', variables: ['nombre_cliente', 'id_cuenta', 'monto_vencido', 'entidad_legal'] },
  { id: 'AD-006', name: 'Notificación prelegal', type: 'manual', channel: 'email', category: 'legal', templateId: 'TPL-COB-006', active: false, createdAt: '2026-02-20', createdBy: 'Tomás Peterson', subject: 'Notificación formal de incumplimiento', body: 'Por medio de la presente se le notifica formalmente...', variables: ['nombre_cliente', 'id_cuenta', 'entidad_legal'] },
  { id: 'AD-007', name: 'Recordatorio WhatsApp preventivo', type: 'manual', channel: 'whatsapp', category: 'cobranza_preventiva', templateId: 'TPL-COB-007', active: true, createdAt: '2026-03-01', createdBy: 'Luz Ochoa', subject: 'Recordatorio de pago', body: 'Hola {{nombre_cliente}}, le recordamos que su pago de {{proyecto}} vence el {{proxima_fecha_vencimiento}}.', variables: ['nombre_cliente', 'proyecto', 'proxima_fecha_vencimiento'] },
  { id: 'AD-008', name: 'Seguimiento de promesa de pago', type: 'manual', channel: 'email', category: 'cobranza_vencida', templateId: 'TPL-COB-008', active: true, createdAt: '2026-03-05', createdBy: 'Luz Ochoa', subject: 'Seguimiento de compromiso de pago', body: 'Damos seguimiento al compromiso de pago registrado...', variables: ['nombre_cliente', 'id_cuenta', 'fecha_pago'] },
  { id: 'AD-009', name: 'Documentación faltante', type: 'manual', channel: 'email', category: 'documentacion', templateId: 'TPL-COB-009', active: true, createdAt: '2026-03-10', createdBy: 'Tomás Peterson', subject: 'Documentación pendiente - Expediente', body: 'Le solicitamos actualizar la documentación de su expediente...', variables: ['nombre_cliente', 'proyecto', 'unidad'] },
  { id: 'AD-010', name: 'Bienvenida cobranza', type: 'automatico', channel: 'email', category: 'general', templateId: 'TPL-COB-010', active: true, createdAt: '2026-01-10', createdBy: 'Tomás Peterson', subject: 'Bienvenida al área de cobranza - {{proyecto}}', body: 'Estimado {{nombre_cliente}}, le damos la bienvenida al seguimiento de su cuenta...', variables: ['nombre_cliente', 'proyecto', 'ejecutivo', 'telefono_cobranza'] },
];

export default function AdminAvisosPage() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [definitions, setDefinitions] = useState<AvisoDefinition[]>(mockDefinitions);
  const [editItem, setEditItem] = useState<AvisoDefinition | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return definitions.filter(d => {
      if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.templateId.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory !== 'all' && d.category !== filterCategory) return false;
      if (filterChannel !== 'all' && d.channel !== filterChannel) return false;
      if (filterType !== 'all' && d.type !== filterType) return false;
      return true;
    });
  }, [definitions, search, filterCategory, filterChannel, filterType]);

  const toggleActive = (id: string) => {
    setDefinitions(prev => prev.map(d => d.id === id ? { ...d, active: !d.active } : d));
  };

  const duplicate = (item: AvisoDefinition) => {
    const dup: AvisoDefinition = { ...item, id: `AD-${Date.now()}`, name: `${item.name} (copia)`, createdAt: new Date().toISOString().split('T')[0] };
    setDefinitions(prev => [dup, ...prev]);
  };

  const deleteItem = (id: string) => {
    setDefinitions(prev => prev.filter(d => d.id !== id));
    setMenuOpen(null);
  };

  // New/Edit form state
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formType, setFormType] = useState<'manual' | 'automatico'>('manual');
  const [formChannel, setFormChannel] = useState<AvisoChannel | 'interno' | 'mixto'>('email');
  const [formCategory, setFormCategory] = useState<string>('cobranza_preventiva');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formActive, setFormActive] = useState(true);

  const openEdit = (item: AvisoDefinition) => {
    setEditItem(item);
    setFormName(item.name);
    setFormSubject(item.subject);
    setFormBody(item.body);
    setFormType(item.type);
    setFormChannel(item.channel);
    setFormCategory(item.category);
    setFormTemplateId(item.templateId);
    setFormActive(item.active);
    setShowNew(true);
    setMenuOpen(null);
  };

  const openNew = () => {
    setEditItem(null);
    setFormName('');
    setFormSubject('');
    setFormBody('');
    setFormType('manual');
    setFormChannel('email');
    setFormCategory('cobranza_preventiva');
    setFormTemplateId('');
    setFormActive(true);
    setShowNew(true);
  };

  const handleSave = () => {
    if (!formName.trim() || !formSubject.trim()) return;
    if (editItem) {
      setDefinitions(prev => prev.map(d => d.id === editItem.id ? { ...d, name: formName, subject: formSubject, body: formBody, type: formType, channel: formChannel, category: formCategory as AvisoCategory, templateId: formTemplateId, active: formActive } : d));
    } else {
      const newDef: AvisoDefinition = {
        id: `AD-${Date.now()}`, name: formName, type: formType, channel: formChannel, category: formCategory as AvisoCategory,
        templateId: formTemplateId || `TPL-COB-${Date.now().toString().slice(-3)}`, active: formActive, createdAt: new Date().toISOString().split('T')[0],
        createdBy: 'Luz Ochoa', subject: formSubject, body: formBody, variables: [],
      };
      setDefinitions(prev => [newDef, ...prev]);
    }
    setShowNew(false);
  };

  const insertVariable = (v: string) => {
    setFormBody(prev => prev + v);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Administrar Avisos</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Crea y gestiona avisos de cobranza con plantillas y variables dinámicas.</p>
        </div>
        <Button size="sm" onClick={openNew} className="h-9 gap-1.5">
          <Plus className="w-3.5 h-3.5" />Nuevo Aviso
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar aviso o template..."
            className="w-full h-[38px] pl-9 pr-3 rounded-lg border border-border bg-background text-[13px]" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
          <option value="all">Categoría</option>
          {Object.entries(extendedCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} className="h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
          <option value="all">Canal</option>
          {Object.entries(channelLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
          <option value="all">Tipo</option>
          <option value="manual">Manual</option>
          <option value="automatico">Automático</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[260px]">Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Template ID</TableHead>
              <TableHead className="text-center">Activo</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead>Por</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(d => (
              <TableRow key={d.id} className="group">
                <TableCell>
                  <span className="text-[13px] font-medium text-foreground">{d.name}</span>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${d.type === 'automatico' ? 'bg-info/10 text-info' : 'bg-muted text-muted-foreground'}`}>
                    {d.type === 'automatico' ? 'Auto' : 'Manual'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                    {channelIcons[d.channel]}{channelLabels[d.channel]}
                  </span>
                </TableCell>
                <TableCell><span className="text-[12px] text-muted-foreground">{extendedCategories[d.category] || d.category}</span></TableCell>
                <TableCell><code className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{d.templateId}</code></TableCell>
                <TableCell className="text-center">
                  <button onClick={() => toggleActive(d.id)} className={`w-8 h-5 rounded-full transition-colors ${d.active ? 'bg-primary' : 'bg-muted-foreground/30'} relative`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${d.active ? 'left-[14px]' : 'left-0.5'}`} />
                  </button>
                </TableCell>
                <TableCell><span className="text-[12px] text-muted-foreground">{d.createdAt}</span></TableCell>
                <TableCell><span className="text-[12px] text-muted-foreground">{d.createdBy}</span></TableCell>
                <TableCell>
                  <div className="relative">
                    <button onClick={() => setMenuOpen(menuOpen === d.id ? null : d.id)} className="p-1.5 rounded-md hover:bg-muted">
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {menuOpen === d.id && (
                      <div className="absolute right-0 top-8 z-50 w-44 bg-card border border-border rounded-lg shadow-lg py-1">
                        <button onClick={() => openEdit(d)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted"><Pencil className="w-3.5 h-3.5" />Editar</button>
                        <button onClick={() => { duplicate(d); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted"><Copy className="w-3.5 h-3.5" />Duplicar</button>
                        <button onClick={() => { toggleActive(d.id); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted"><Power className="w-3.5 h-3.5" />{d.active ? 'Desactivar' : 'Activar'}</button>
                        <hr className="my-1 border-border" />
                        <button onClick={() => deleteItem(d.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" />Eliminar</button>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground text-[13px]">Sin resultados</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* New / Edit Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px]">{editItem ? 'Editar aviso' : 'Nuevo aviso de cobranza'}</DialogTitle>
            <DialogDescription className="text-[13px]">Configura el aviso con variables dinámicas de cobranza.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 py-3">
            {/* Left: Config */}
            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-medium mb-1 block">Nombre del aviso *</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]" placeholder="Ej: Recordatorio preventivo de pago" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-medium mb-1 block">Tipo</label>
                  <select value={formType} onChange={e => setFormType(e.target.value as any)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                    <option value="manual">Manual</option>
                    <option value="automatico">Automático</option>
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block">Canal</label>
                  <select value={formChannel} onChange={e => setFormChannel(e.target.value as any)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                    {Object.entries(channelLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-medium mb-1 block">Categoría</label>
                  <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                    {Object.entries(extendedCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block">Template ID</label>
                  <input value={formTemplateId} onChange={e => setFormTemplateId(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]" placeholder="TPL-COB-XXX" />
                </div>
              </div>
              <div>
                <label className="text-[12px] font-medium mb-1 block">Asunto *</label>
                <input value={formSubject} onChange={e => setFormSubject(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]" placeholder="Asunto del correo" />
              </div>
              <div>
                <label className="text-[12px] font-medium mb-1 block">Contenido del mensaje *</label>
                <textarea value={formBody} onChange={e => setFormBody(e.target.value)} rows={6}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] resize-none" placeholder="Escribe el cuerpo del aviso..." />
              </div>
              <div>
                <label className="text-[12px] font-medium mb-1 block">Variables disponibles</label>
                <div className="flex flex-wrap gap-1.5">
                  {cobranzaVariables.map(v => (
                    <button key={v} type="button" onClick={() => insertVariable(v)}
                      className="px-2 py-0.5 text-[11px] rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-mono">{v}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} className="rounded" />
                <label className="text-[12px] font-medium">Aviso activo</label>
              </div>
            </div>
            {/* Right: Preview */}
            <div className="space-y-3">
              <label className="text-[12px] font-medium mb-1 block">Vista previa</label>
              <div className="bg-muted/30 rounded-xl border border-border p-5 min-h-[300px]">
                <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    {channelIcons[formChannel]}
                    <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{channelLabels[formChannel]}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{extendedCategories[formCategory]}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-foreground mb-2">{formSubject || 'Sin asunto'}</p>
                  <hr className="my-2 border-border" />
                  <p className="text-[13px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{formBody || 'El contenido del mensaje aparecerá aquí...'}</p>
                </div>
                {formBody && (
                  <div className="mt-3 p-3 bg-card rounded-lg border border-border">
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Variables detectadas:</p>
                    <div className="flex flex-wrap gap-1">
                      {cobranzaVariables.filter(v => formBody.includes(v)).map(v => (
                        <span key={v} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary font-mono">{v}</span>
                      ))}
                      {cobranzaVariables.filter(v => formBody.includes(v)).length === 0 && (
                        <span className="text-[11px] text-muted-foreground">Ninguna variable en uso</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={!formName.trim() || !formSubject.trim()}>
              {editItem ? 'Guardar cambios' : 'Crear aviso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
