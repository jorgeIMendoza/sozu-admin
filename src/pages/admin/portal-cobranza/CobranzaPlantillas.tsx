import { useState } from 'react';
import { Search, Plus, Pencil, FileText, Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { avisoCategoryLabels, type AvisoCategory, type AvisoChannel } from '@/data/cobranza/avisosData';
import { usePagination } from '@/hooks/usePagination';
import { SimplePagination } from '@/components/ui/simple-pagination';

interface Template {
  id: string;
  name: string;
  category: AvisoCategory;
  channel: AvisoChannel;
  subject: string;
  body: string;
  variables: string[];
  active: boolean;
  lastEdited: string;
  editedBy: string;
}

const cobranzaVars = [
  '{{nombre_cliente}}', '{{proyecto}}', '{{unidad}}', '{{id_cuenta}}',
  '{{monto_vencido}}', '{{monto_por_cobrar}}', '{{fecha_pago}}',
  '{{proxima_fecha_vencimiento}}', '{{ejecutivo}}', '{{entidad_legal}}', '{{estado_cuenta_url}}',
];

const mockTemplates: Template[] = [
  { id: 'TPL-001', name: 'Bienvenida cobranza', category: 'general', channel: 'email', subject: 'Bienvenida al seguimiento de tu cuenta - {{proyecto}}', body: 'Estimado {{nombre_cliente}}, le damos la bienvenida al área de cobranza de {{proyecto}}. Su ejecutivo asignado es {{ejecutivo}}.', variables: ['nombre_cliente', 'proyecto', 'ejecutivo'], active: true, lastEdited: '2026-03-15', editedBy: 'Tomás Peterson' },
  { id: 'TPL-002', name: 'Recordatorio preventivo', category: 'cobranza_preventiva', channel: 'email', subject: 'Recordatorio de pago próximo', body: 'Estimado {{nombre_cliente}}, le recordamos que su próxima fecha de pago es el {{proxima_fecha_vencimiento}} por ${{monto_por_cobrar}}.', variables: ['nombre_cliente', 'proxima_fecha_vencimiento', 'monto_por_cobrar'], active: true, lastEdited: '2026-03-20', editedBy: 'Luz Ochoa' },
  { id: 'TPL-003', name: 'Pago vencido', category: 'cobranza_vencida', channel: 'email', subject: 'Parcialidad vencida - Acción requerida', body: 'Estimado {{nombre_cliente}}, su cuenta {{id_cuenta}} presenta un saldo vencido de ${{monto_vencido}}.', variables: ['nombre_cliente', 'id_cuenta', 'monto_vencido'], active: true, lastEdited: '2026-03-18', editedBy: 'Luz Ochoa' },
  { id: 'TPL-004', name: 'Solicitud de comprobante', category: 'comprobante', channel: 'email', subject: 'Solicitud de comprobante de pago', body: 'Estimado {{nombre_cliente}}, le solicitamos enviar el comprobante de su pago del {{fecha_pago}}.', variables: ['nombre_cliente', 'fecha_pago'], active: true, lastEdited: '2026-03-10', editedBy: 'Tomás Peterson' },
  { id: 'TPL-005', name: 'Estado de cuenta', category: 'estado_cuenta', channel: 'email', subject: 'Estado de cuenta actualizado', body: 'Adjunto encontrará su estado de cuenta actualizado. Puede consultarlo en: {{estado_cuenta_url}}.', variables: ['nombre_cliente', 'estado_cuenta_url'], active: true, lastEdited: '2026-03-25', editedBy: 'Luz Ochoa' },
  { id: 'TPL-006', name: 'Pago no reflejado', category: 'comprobante', channel: 'email', subject: 'Pago no reflejado en sistema', body: 'Estimado {{nombre_cliente}}, no hemos podido identificar su pago. Le solicitamos enviar comprobante.', variables: ['nombre_cliente', 'id_cuenta'], active: true, lastEdited: '2026-03-12', editedBy: 'Tomás Peterson' },
  { id: 'TPL-007', name: 'Renegociación / Compromiso', category: 'cobranza_vencida', channel: 'email', subject: 'Propuesta de regularización', body: 'Estimado {{nombre_cliente}}, le hacemos llegar una propuesta de regularización para su cuenta {{id_cuenta}}.', variables: ['nombre_cliente', 'id_cuenta', 'monto_vencido'], active: true, lastEdited: '2026-03-08', editedBy: 'Luz Ochoa' },
  { id: 'TPL-008', name: 'Cliente en penalización', category: 'penalizacion', channel: 'email', subject: 'Aviso de penalización', body: 'Le informamos que su cuenta ha sido sujeta a proceso de penalización por la entidad legal {{entidad_legal}}.', variables: ['nombre_cliente', 'entidad_legal', 'monto_vencido'], active: true, lastEdited: '2026-02-28', editedBy: 'Tomás Peterson' },
  { id: 'TPL-009', name: 'Documentación faltante', category: 'documentacion', channel: 'email', subject: 'Documentación pendiente', body: 'Le solicitamos actualizar la documentación de su expediente para la unidad {{unidad}} del proyecto {{proyecto}}.', variables: ['nombre_cliente', 'proyecto', 'unidad'], active: true, lastEdited: '2026-03-05', editedBy: 'Luz Ochoa' },
  { id: 'TPL-010', name: 'Seguimiento legal / prelegal', category: 'legal', channel: 'email', subject: 'Notificación formal', body: 'Por medio de la presente se le notifica formalmente sobre el estado de su cuenta {{id_cuenta}}.', variables: ['nombre_cliente', 'id_cuenta', 'entidad_legal'], active: false, lastEdited: '2026-02-20', editedBy: 'Tomás Peterson' },
  { id: 'TPL-011', name: 'Recordatorio WhatsApp', category: 'cobranza_preventiva', channel: 'whatsapp', subject: 'Recordatorio de pago', body: 'Hola {{nombre_cliente}}, le recordamos que su pago de {{proyecto}} vence el {{proxima_fecha_vencimiento}}.', variables: ['nombre_cliente', 'proyecto', 'proxima_fecha_vencimiento'], active: true, lastEdited: '2026-03-22', editedBy: 'Luz Ochoa' },
];

const channelIcon = (ch: string) => ch === 'email' ? <Mail className="w-3.5 h-3.5" /> : ch === 'whatsapp' ? <MessageSquare className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />;

export default function PlantillasCobranzaPage() {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);
  const [editTpl, setEditTpl] = useState<Template | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const [fName, setFName] = useState('');
  const [fCat, setFCat] = useState<string>('general');
  const [fCh, setFCh] = useState<AvisoChannel>('email');
  const [fSubj, setFSubj] = useState('');
  const [fBody, setFBody] = useState('');

  const filtered = templates.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    return true;
  });

  const { paginated: paginatedTpl, page, setPage, totalPages, total, from, to } = usePagination(filtered, 50);

  const openEdit = (t: Template) => {
    setEditTpl(t); setFName(t.name); setFCat(t.category); setFCh(t.channel); setFSubj(t.subject); setFBody(t.body); setShowEdit(true);
  };
  const openNew = () => {
    setEditTpl(null); setFName(''); setFCat('general'); setFCh('email'); setFSubj(''); setFBody(''); setShowEdit(true);
  };
  const handleSave = () => {
    if (!fName.trim() || !fSubj.trim()) return;
    if (editTpl) {
      setTemplates(prev => prev.map(t => t.id === editTpl.id ? { ...t, name: fName, category: fCat as AvisoCategory, channel: fCh, subject: fSubj, body: fBody, lastEdited: new Date().toISOString().split('T')[0], editedBy: 'Luz Ochoa' } : t));
    } else {
      setTemplates(prev => [{ id: `TPL-${Date.now().toString().slice(-3)}`, name: fName, category: fCat as AvisoCategory, channel: fCh, subject: fSubj, body: fBody, variables: [], active: true, lastEdited: new Date().toISOString().split('T')[0], editedBy: 'Luz Ochoa' }, ...prev]);
    }
    setShowEdit(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Plantillas de Cobranza</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Templates base reutilizables para comunicaciones de cobranza.</p>
        </div>
        <Button size="sm" onClick={openNew} className="h-9 gap-1.5"><Plus className="w-3.5 h-3.5" />Nueva plantilla</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar plantilla..."
            className="w-full h-[38px] pl-9 pr-3 rounded-lg border border-border bg-background text-[13px]" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
          <option value="all">Categoría</option>
          {Object.entries(avisoCategoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Asunto</TableHead>
              <TableHead className="text-center">Activa</TableHead>
              <TableHead>Última edición</TableHead>
              <TableHead>Editor</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTpl.map(t => (
              <TableRow key={t.id}>
                <TableCell><span className="text-[13px] font-medium text-foreground">{t.name}</span></TableCell>
                <TableCell><span className="text-[12px] text-muted-foreground">{avisoCategoryLabels[t.category] || t.category}</span></TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">{channelIcon(t.channel)}{t.channel === 'email' ? 'Email' : 'WhatsApp'}</span>
                </TableCell>
                <TableCell><span className="text-[12px] text-muted-foreground truncate max-w-[200px] block">{t.subject}</span></TableCell>
                <TableCell className="text-center">
                  <span className={`inline-flex w-2 h-2 rounded-full ${t.active ? 'bg-success' : 'bg-muted-foreground/30'}`} />
                </TableCell>
                <TableCell><span className="text-[12px] text-muted-foreground">{t.lastEdited}</span></TableCell>
                <TableCell><span className="text-[12px] text-muted-foreground">{t.editedBy}</span></TableCell>
                <TableCell>
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-muted"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <SimplePagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          from={from}
          to={to}
        />
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px]">{editTpl ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
            <DialogDescription className="text-[13px]">Configura la plantilla con variables de cobranza.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 py-3">
            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-medium mb-1 block">Nombre *</label>
                <input value={fName} onChange={e => setFName(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-medium mb-1 block">Categoría</label>
                  <select value={fCat} onChange={e => setFCat(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                    {Object.entries(avisoCategoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block">Canal</label>
                  <select value={fCh} onChange={e => setFCh(e.target.value as AvisoChannel)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[12px] font-medium mb-1 block">Asunto *</label>
                <input value={fSubj} onChange={e => setFSubj(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]" />
              </div>
              <div>
                <label className="text-[12px] font-medium mb-1 block">Cuerpo *</label>
                <textarea value={fBody} onChange={e => setFBody(e.target.value)} rows={6} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] resize-none" />
              </div>
              <div>
                <label className="text-[12px] font-medium mb-1 block">Variables</label>
                <div className="flex flex-wrap gap-1.5">
                  {cobranzaVars.map(v => (
                    <button key={v} onClick={() => setFBody(prev => prev + v)} className="px-2 py-0.5 text-[11px] rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-mono">{v}</button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-[12px] font-medium mb-1 block">Vista previa</label>
              <div className="bg-muted/30 rounded-xl border border-border p-5 min-h-[280px]">
                <div className="bg-card rounded-lg border border-border p-4">
                  <p className="text-[14px] font-semibold text-foreground mb-2">{fSubj || 'Sin asunto'}</p>
                  <hr className="my-2 border-border" />
                  <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">{fBody || 'El contenido aparecerá aquí...'}</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={!fName.trim() || !fSubj.trim()}>{editTpl ? 'Guardar' : 'Crear plantilla'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
