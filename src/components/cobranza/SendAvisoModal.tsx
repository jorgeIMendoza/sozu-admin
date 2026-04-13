import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import {
  type AvisoCategory, type AvisoChannel, type AvisoRecord,
  avisoCategoryLabels, cobranzaTemplates, addAviso,
} from '@/data/avisosData';
import { addBitacoraEntry, type BitacoraEntry } from '@/data/bitacoraData';

interface SendAvisoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  clientName: string;
  caseId?: string;
  onAvisoSent?: (aviso: AvisoRecord) => void;
}

const executives = ['Luz Ochoa', 'Tomás Peterson'];

export function SendAvisoModal({ open, onOpenChange, accountId, clientName, caseId, onAvisoSent }: SendAvisoModalProps) {
  const [category, setCategory] = useState<AvisoCategory>('cobranza_preventiva');
  const [channel, setChannel] = useState<AvisoChannel>('email');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [executive, setExecutive] = useState(executives[0]);
  const [useTemplate, setUseTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const filteredTemplates = useMemo(() =>
    cobranzaTemplates.filter(t => t.category === category && t.channel === channel),
    [category, channel]
  );

  const isValid = subject.trim() && message.trim();

  const resetForm = useCallback(() => {
    setCategory('cobranza_preventiva');
    setChannel('email');
    setSubject('');
    setMessage('');
    setExecutive(executives[0]);
    setUseTemplate(false);
    setSelectedTemplate('');
  }, []);

  const handleTemplateSelect = useCallback((tplId: string) => {
    const tpl = cobranzaTemplates.find(t => t.id === tplId);
    if (tpl) {
      setSelectedTemplate(tplId);
      setSubject(tpl.subject);
      setMessage(tpl.preview);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    const aviso: AvisoRecord = {
      id: `AV-${Date.now()}`,
      accountId,
      clientName,
      caseId,
      category,
      channel,
      subject: subject.trim(),
      preview: message.trim(),
      sentBy: executive,
      sentDate: new Date().toISOString(),
      status: 'enviado',
    };
    addAviso(aviso);

    // Auto-register in Bitácora
    const bitacoraEntry: BitacoraEntry = {
      id: `bit-av-${Date.now()}`,
      accountId,
      category: 'comunicacion',
      eventType: channel === 'email' ? 'email' : channel === 'whatsapp' ? 'whatsapp' : 'sms',
      title: `Aviso enviado: ${subject.trim()}`,
      description: `Se envió aviso de ${avisoCategoryLabels[category]} al cliente ${clientName} vía ${channel}. ${caseId ? `Caso: ${caseId}.` : ''}`,
      user: executive,
      date: new Date().toISOString(),
      origin: 'Avisos',
      result: 'Enviado',
    };
    addBitacoraEntry(bitacoraEntry);

    onAvisoSent?.(aviso);
    resetForm();
    onOpenChange(false);
  }, [isValid, accountId, clientName, caseId, category, channel, subject, message, executive, onAvisoSent, resetForm, onOpenChange]);

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  }, [onOpenChange, resetForm]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[15px] flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" strokeWidth={1.75} />
            Enviar aviso
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Envía un aviso personalizado a {clientName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-foreground mb-1 block">Categoría *</label>
              <select value={category} onChange={e => setCategory(e.target.value as AvisoCategory)}
                className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]">
                {Object.entries(avisoCategoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground mb-1 block">Canal *</label>
              <select value={channel} onChange={e => setChannel(e.target.value as AvisoChannel)}
                className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]">
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          </div>

          {filteredTemplates.length > 0 && (
            <div>
              <label className="text-[12px] font-medium text-foreground mb-1 block">Usar plantilla</label>
              <select value={selectedTemplate} onChange={e => handleTemplateSelect(e.target.value)}
                className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]">
                <option value="">— Seleccionar plantilla —</option>
                {filteredTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-[12px] font-medium text-foreground mb-1 block">Asunto *</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Ej: Recordatorio de pago próximo"
              className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]" />
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1 block">Mensaje *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Escribe el contenido del aviso..."
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] resize-none" />
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1 block">Ejecutivo *</label>
            <select value={executive} onChange={e => setExecutive(e.target.value)}
              className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]">
              {executives.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!isValid}>
            <Send className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Enviar aviso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
