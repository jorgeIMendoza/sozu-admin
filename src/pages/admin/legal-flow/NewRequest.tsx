import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Send, CheckCircle2 } from 'lucide-react';

const STEPS = [
  { title: '¿Qué necesitas?', description: 'Tipo de solicitud y nivel de urgencia.' },
  { title: '¿Quién participa?', description: 'Empresa, proyecto y contraparte involucrada.' },
  { title: 'Detalles adicionales', description: 'Descripción, fecha límite y documentos de soporte.' },
];

export default function NewRequest() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      toast.success('Solicitud legal enviada', {
        description: 'Tu solicitud ha sido recibida. Se creará un expediente automáticamente.',
      });
      setSubmitting(false);
      navigate('/admin/legal-flow/requests');
    }, 800);
  };

  return (
    <div className="px-10 py-8 max-w-2xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <button onClick={() => navigate('/admin/legal-flow/requests')} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4 cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a solicitudes
        </button>
        <h1 className="text-[24px] font-bold tracking-tight">Nueva Solicitud Legal</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Envía una solicitud al departamento legal. Nosotros nos encargamos.</p>
      </motion.div>

      {/* Step indicator */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center gap-2">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold transition-all duration-300 ${
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]' :
                'bg-muted text-muted-foreground/60'
              }`}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-[11px] font-medium text-center leading-tight ${
                i === step ? 'text-primary font-semibold' :
                i > step ? 'text-muted-foreground/40' : 'text-foreground/70'
              }`}>
                {s.title}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-[2px] flex-1 mx-3 mt-[-20px] rounded-full transition-colors duration-300 ${i < step ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </motion.div>

      <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="text-[15px] font-semibold">{STEPS[step].title}</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">{STEPS[step].description}</p>
            </div>
          </div>
          <div className="panel-body space-y-5">
            {step === 0 && (
              <>
                <div>
                  <Label htmlFor="title" className="text-[14px] font-medium">Título de la solicitud</Label>
                  <Input id="title" placeholder="Ej. Contrato de arrendamiento Torre Reforma Unidad 1802" required className="mt-1.5 h-[38px] rounded-lg" />
                  <p className="text-[12px] text-muted-foreground/60 mt-1.5">Un nombre breve y descriptivo para tu solicitud.</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label className="text-[14px] font-medium">Tipo de solicitud</Label>
                    <Select required>
                      <SelectTrigger className="mt-1.5 h-[38px] rounded-lg"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nuevo contrato">Nuevo Contrato</SelectItem>
                        <SelectItem value="Nuevo convenio">Carta Acuerdo</SelectItem>
                        <SelectItem value="Modificatorio">Convenio Modificatorio</SelectItem>
                        <SelectItem value="Renovación">Renovación de Contrato</SelectItem>
                        <SelectItem value="Terminación">Terminación de Contrato</SelectItem>
                        <SelectItem value="Validación externa">Validación de Documento Externo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[14px] font-medium">Nivel de urgencia</Label>
                    <Select required>
                      <SelectTrigger className="mt-1.5 h-[38px] rounded-lg"><SelectValue placeholder="Seleccionar prioridad" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alto">
                          <span className="flex items-center gap-2"><span className="priority-dot priority-dot-Alto" /> Alta — Atención inmediata</span>
                        </SelectItem>
                        <SelectItem value="Medio">
                          <span className="flex items-center gap-2"><span className="priority-dot priority-dot-Medio" /> Media — Plazo estándar</span>
                        </SelectItem>
                        <SelectItem value="Bajo">
                          <span className="flex items-center gap-2"><span className="priority-dot priority-dot-Bajo" /> Baja — Sin urgencia</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label className="text-[14px] font-medium">Empresa SOZU</Label>
                    <Select>
                      <SelectTrigger className="mt-1.5 h-[38px] rounded-lg"><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sozu-dev">SOZU Developments</SelectItem>
                        <SelectItem value="sozu-cap">SOZU Capital</SelectItem>
                        <SelectItem value="sozu-tech">SOZU Tech</SelectItem>
                        <SelectItem value="sozu-ops">SOZU Operations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[14px] font-medium">Proyecto</Label>
                    <Input placeholder="Ej. Torre Reforma" className="mt-1.5 h-[38px] rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[14px] font-medium">Propiedad / Unidad <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <Input placeholder="Ej. Unidad 1802" className="mt-1.5 h-[38px] rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[14px] font-medium">Contraparte</Label>
                    <Input placeholder="Nombre de la entidad legal" required className="mt-1.5 h-[38px] rounded-lg" />
                    <p className="text-[12px] text-muted-foreground/60 mt-1.5">La empresa o persona con la que se celebrará el contrato.</p>
                  </div>
                </div>
                <div>
                  <Label className="text-[14px] font-medium">Valor estimado de la operación (MXN) <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input type="number" placeholder="0" className="mt-1.5 h-[38px] rounded-lg font-mono max-w-[220px]" />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <Label className="text-[14px] font-medium">Descripción</Label>
                  <Textarea placeholder="Describe tu solicitud: qué necesitas, términos clave, requisitos especiales..." rows={4} className="mt-1.5 rounded-lg" />
                </div>
                <div>
                  <Label className="text-[14px] font-medium">Fecha límite</Label>
                  <Input type="date" required className="mt-1.5 h-[38px] rounded-lg max-w-[220px]" />
                </div>
                <div>
                  <Label className="text-[14px] font-medium">Archivos adjuntos <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input type="file" multiple className="mt-1.5 h-[38px] rounded-lg" />
                  <p className="text-[12px] text-muted-foreground/60 mt-1.5">Sube documentos de soporte, contratos de referencia o comunicaciones.</p>
                </div>
                <div>
                  <Label className="text-[14px] font-medium">Notas internas <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Textarea placeholder="Notas internas para el equipo legal..." rows={2} className="mt-1.5 rounded-lg" />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-6">
          <Button
            type="button"
            variant="ghost"
            className="h-9 text-[13px] gap-1.5"
            onClick={() => step > 0 ? setStep(step - 1) : navigate('/admin/legal-flow/requests')}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {step > 0 ? 'Anterior' : 'Cancelar'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" className="h-9 text-[13px] gap-1.5 rounded-lg" onClick={() => setStep(step + 1)}>
              Siguiente <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button type="submit" className="h-9 text-[13px] gap-1.5 rounded-lg" disabled={submitting}>
              <Send className="h-3.5 w-3.5" /> {submitting ? 'Enviando...' : 'Enviar Solicitud'}
            </Button>
          )}
        </div>
      </motion.form>
    </div>
  );
}
