import { useState, useMemo } from 'react';
import { Send, Users, User, Filter, Eye, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { mockAccounts, projects, mockLegalEntities, executives } from '@/data/mockData';
import { avisoCategoryLabels, cobranzaTemplates, addAviso, type AvisoRecord, type AvisoChannel, type AvisoCategory } from '@/data/avisosData';
import { addBitacoraEntry, type BitacoraEntry } from '@/data/bitacoraData';
import { useToast } from '@/hooks/use-toast';

type AudienceMode = 'individual' | 'filtrado' | 'masivo';

export default function EnviarAvisosPage() {
  const { toast } = useToast();
  const [selectedAviso, setSelectedAviso] = useState('');
  const [channel, setChannel] = useState<AvisoChannel>('email');
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('filtrado');
  const [filterProject, setFilterProject] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterExec, setFilterExec] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOverdue, setFilterOverdue] = useState('all');
  const [individualAccount, setIndividualAccount] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  const tpl = cobranzaTemplates.find(t => t.id === selectedAviso);

  const filteredAccounts = useMemo(() => {
    if (audienceMode === 'individual') {
      return individualAccount ? mockAccounts.filter(a => a.id === individualAccount) : [];
    }
    return mockAccounts.filter(a => {
      if (filterProject !== 'all' && a.project.id !== filterProject) return false;
      if (filterEntity !== 'all' && a.legalEntity?.id !== filterEntity) return false;
      if (filterExec !== 'all' && a.assignedExecutive !== filterExec) return false;
      if (filterStatus !== 'all') {
        if (filterStatus === 'al_corriente' && a.overdueInstallments > 0) return false;
        if (filterStatus === 'vencida' && a.overdueInstallments === 0) return false;
      }
      if (filterOverdue !== 'all') {
        if (filterOverdue === '1' && a.overdueInstallments !== 1) return false;
        if (filterOverdue === '2' && a.overdueInstallments !== 2) return false;
        if (filterOverdue === '3+' && a.overdueInstallments < 3) return false;
      }
      return true;
    });
  }, [audienceMode, individualAccount, filterProject, filterEntity, filterExec, filterStatus, filterOverdue]);

  const totalDestinatarios = filteredAccounts.length;
  const withEmail = filteredAccounts.filter(a => a.client.email).length;
  const withErrors = totalDestinatarios - withEmail;

  const handleSend = () => {
    filteredAccounts.forEach(account => {
      const aviso: AvisoRecord = {
        id: `AV-${Date.now()}-${account.id}`,
        accountId: account.id,
        clientName: account.client.name,
        category: (tpl?.category || 'general') as AvisoCategory,
        channel,
        subject: tpl?.subject || 'Aviso de cobranza',
        preview: tpl?.preview || '',
        sentBy: 'Luz Ochoa',
        sentDate: new Date().toISOString(),
        status: 'enviado',
      };
      addAviso(aviso);

      const bitEntry: BitacoraEntry = {
        id: `bit-env-${Date.now()}-${account.id}`,
        accountId: account.id,
        category: 'comunicacion',
        eventType: channel === 'email' ? 'email' : channel === 'whatsapp' ? 'whatsapp' : 'sms',
        title: `Aviso enviado: ${tpl?.name || 'Aviso de cobranza'}`,
        description: `Se envió aviso "${tpl?.name || selectedAviso}" al cliente ${account.client.name} vía ${channel}.`,
        user: 'Luz Ochoa',
        date: new Date().toISOString(),
        origin: 'Comunicación',
        result: 'Enviado',
      };
      addBitacoraEntry(bitEntry);
    });

    toast({ title: 'Avisos enviados', description: `Se enviaron ${totalDestinatarios} avisos correctamente.` });
    setShowConfirm(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Enviar Avisos</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Selecciona un aviso, define la audiencia y envía.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Configuration */}
        <div className="lg:col-span-2 space-y-4">
          {/* Aviso selection */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-[13px] font-semibold text-foreground">1. Seleccionar aviso</h3>
            <select value={selectedAviso} onChange={e => setSelectedAviso(e.target.value)}
              className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
              <option value="">— Seleccionar aviso —</option>
              {cobranzaTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium mb-1 block">Canal</label>
                <select value={channel} onChange={e => setChannel(e.target.value as AvisoChannel)}
                  className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium mb-1 block">Tipo de ejecución</label>
                <div className="flex gap-2">
                  <button onClick={() => setScheduled(false)} className={`flex-1 h-[38px] rounded-lg border text-[13px] font-medium transition-colors ${!scheduled ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}>Enviar ahora</button>
                  <button onClick={() => setScheduled(true)} className={`flex-1 h-[38px] rounded-lg border text-[13px] font-medium transition-colors ${scheduled ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}>Programar</button>
                </div>
              </div>
            </div>
            {scheduled && (
              <div>
                <label className="text-[12px] font-medium mb-1 block">Fecha y hora de envío</label>
                <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                  className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]" />
              </div>
            )}
          </div>

          {/* Audience */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-[13px] font-semibold text-foreground">2. Definir audiencia</h3>
            <div className="flex gap-2">
              {([['individual', 'Individual', User], ['filtrado', 'Grupo filtrado', Filter], ['masivo', 'Masivo', Users]] as const).map(([mode, label, Icon]) => (
                <button key={mode} onClick={() => setAudienceMode(mode)}
                  className={`flex items-center gap-1.5 px-3 h-[36px] rounded-lg border text-[13px] font-medium transition-colors ${audienceMode === mode ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>

            {audienceMode === 'individual' && (
              <div>
                <label className="text-[12px] font-medium mb-1 block">Cuenta de cobranza</label>
                <select value={individualAccount} onChange={e => setIndividualAccount(e.target.value)}
                  className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                  <option value="">— Seleccionar cuenta —</option>
                  {mockAccounts.slice(0, 30).map(a => (
                    <option key={a.id} value={a.id}>{a.id} — {a.client.name}</option>
                  ))}
                </select>
              </div>
            )}

            {(audienceMode === 'filtrado' || audienceMode === 'masivo') && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[12px] font-medium mb-1 block">Proyecto</label>
                  <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                    <option value="all">Todos</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block">Entidad legal</label>
                  <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                    <option value="all">Todas</option>
                    {mockLegalEntities.map(le => <option key={le.id} value={le.id}>{le.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block">Ejecutivo</label>
                  <select value={filterExec} onChange={e => setFilterExec(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                    <option value="all">Todos</option>
                    {executives.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block">Estatus cartera</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                    <option value="all">Todos</option>
                    <option value="al_corriente">Al corriente</option>
                    <option value="vencida">Con vencimientos</option>
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block">Parcialidades vencidas</label>
                  <select value={filterOverdue} onChange={e => setFilterOverdue(e.target.value)} className="w-full h-[38px] rounded-lg border border-border bg-background px-3 text-[13px]">
                    <option value="all">Todas</option>
                    <option value="1">1 vencida</option>
                    <option value="2">2 vencidas</option>
                    <option value="3+">3+ / Prelegal</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Summary */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            <h3 className="text-[13px] font-semibold text-foreground">Resumen de envío</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Aviso</span>
                <span className="font-medium text-foreground truncate ml-2 max-w-[160px]">{tpl?.name || '—'}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Canal</span>
                <span className="font-medium text-foreground">{channel}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Audiencia</span>
                <span className="font-medium text-foreground">{audienceMode === 'individual' ? 'Individual' : audienceMode === 'filtrado' ? 'Grupo filtrado' : 'Masivo'}</span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Total destinatarios</span>
                <span className="font-bold text-foreground text-base">{totalDestinatarios}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-success" />Con email válido</span>
                <span className="font-medium text-success">{withEmail}</span>
              </div>
              {withErrors > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-warning" />Sin datos de contacto</span>
                  <span className="font-medium text-warning">{withErrors}</span>
                </div>
              )}
              {scheduled && scheduleDate && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">Programado para</span>
                  <span className="font-medium text-foreground text-[12px]">{new Date(scheduleDate).toLocaleString('es-MX')}</span>
                </div>
              )}
            </div>

            {withErrors > 0 && (
              <div className="flex items-start gap-2 p-2.5 bg-warning/10 rounded-lg border border-warning/20">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <p className="text-[11px] text-warning">{withErrors} cuenta(s) sin datos de contacto válidos no recibirán el aviso.</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowPreview(true)} disabled={!selectedAviso} className="w-full gap-1.5">
                <Eye className="w-3.5 h-3.5" />Previsualizar
              </Button>
              <Button size="sm" onClick={() => setShowConfirm(true)} disabled={!selectedAviso || totalDestinatarios === 0} className="w-full gap-1.5">
                <Send className="w-3.5 h-3.5" />{scheduled ? 'Programar envío' : 'Enviar ahora'}
              </Button>
            </div>
          </div>

          {/* Quick audience list */}
          {totalDestinatarios > 0 && totalDestinatarios <= 10 && (
            <div className="bg-card rounded-xl border border-border p-4">
              <h4 className="text-[12px] font-semibold text-foreground mb-2">Destinatarios ({totalDestinatarios})</h4>
              <div className="space-y-1.5">
                {filteredAccounts.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-[12px]">
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <span className="text-foreground truncate">{a.client.name}</span>
                    <span className="text-muted-foreground ml-auto">{a.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Vista previa del aviso</DialogTitle>
          </DialogHeader>
          {tpl && (
            <div className="bg-muted/30 rounded-xl border border-border p-5">
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">{channel}</p>
                <p className="text-[14px] font-semibold text-foreground mb-2">{tpl.subject}</p>
                <hr className="my-2 border-border" />
                <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">{tpl.preview}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Confirmar envío</DialogTitle>
            <DialogDescription className="text-[13px]">¿Estás seguro de enviar este aviso a {totalDestinatarios} destinatario(s)?</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">Aviso:</span><span className="font-medium">{tpl?.name}</span></div>
            <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">Canal:</span><span className="font-medium">{channel}</span></div>
            <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">Destinatarios:</span><span className="font-bold">{totalDestinatarios}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSend} className="gap-1.5">
              <Send className="w-3.5 h-3.5" />Confirmar envío
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
