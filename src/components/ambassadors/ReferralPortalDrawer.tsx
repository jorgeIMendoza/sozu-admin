import { useAmbassadors } from '@/store/AmbassadorsContext';
import {
  Ambassador,
  COMMISSION_STATUS_HELP,
  COMMISSION_STATUS_LABEL,
  PROTECTION_STATUS_LABEL,
  Referral,
  TIMELINE_STAGES,
  mapStatusForAmbassador,
  nextStepFor,
  protectionStatusFor,
  stageIndex,
} from '@/types/ambassadors';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, Circle, Info, Mail, MessageCircle, Phone, Shield, ShieldAlert, ShieldCheck, ShieldX, UserCheck } from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
const dateLong = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const dateShort = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-MX') : '—');

function ProtectionBadge({ referral, ambassador }: { referral: Referral; ambassador: Ambassador }) {
  const status = protectionStatusFor(referral);
  const map = {
    protegido: { Icon: ShieldCheck, cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
    pendiente: { Icon: Shield, cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
    duplicado_revision: { Icon: ShieldAlert, cls: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
    no_valido: { Icon: ShieldX, cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  } as const;
  const { Icon, cls } = map[status];
  const validDays = ambassador.protectionDays ?? 90;
  const validUntil = new Date(
    new Date(referral.registeredAt).getTime() + validDays * 86400000,
  );

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Protección del referido</div>
        <Badge variant="outline" className={cls}>
          <Icon className="h-3 w-3 mr-1" />
          {PROTECTION_STATUS_LABEL[status]}
        </Badge>
      </div>
      <p className="text-sm mt-3">
        Este referido está registrado a tu nombre desde{' '}
        <strong>{dateLong(referral.registeredAt)}</strong>. Su protección está sujeta a la validación
        interna y a las reglas del programa de Embajadores.
      </p>
      <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
        <div>
          <div className="text-muted-foreground">Código de embajador</div>
          <div className="font-mono">{ambassador.code}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Vigencia hasta</div>
          <div>{validUntil.toLocaleDateString('es-MX')}</div>
        </div>
      </div>
    </Card>
  );
}

function Timeline({ referral }: { referral: Referral }) {
  const idx = stageIndex(referral.status);
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-3">Avance del proceso</div>
      <ol className="space-y-2">
        {TIMELINE_STAGES.map((s, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <li key={s.key} className="flex items-center gap-3">
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : current ? (
                <div className="h-4 w-4 rounded-full bg-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              )}
              <span
                className={
                  current
                    ? 'text-sm font-medium'
                    : done
                    ? 'text-sm text-muted-foreground'
                    : 'text-sm text-muted-foreground/60'
                }
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export function ReferralPortalDrawer({
  referralId,
  onOpenChange,
}: {
  referralId: string | null;
  onOpenChange: (id: string | null) => void;
}) {
  const { referrals, ambassadors } = useAmbassadors();
  const ref = referrals.find((r) => r.id === referralId);
  const amb = ref ? ambassadors.find((a) => a.id === ref.ambassadorId) : null;

  if (!ref || !amb) {
    return (
      <Sheet open={!!referralId} onOpenChange={(o) => !o && onOpenChange(null)}>
        <SheetContent />
      </Sheet>
    );
  }

  const nextStep = ref.nextStepOverride ?? nextStepFor(ref.status);
  const adv = {
    name: ref.assignedAdvisorName,
    role: ref.assignedAdvisorRole,
    phone: ref.assignedAdvisorPhone,
    email: ref.assignedAdvisorEmail,
  };

  return (
    <TooltipProvider>
      <Sheet open={!!ref} onOpenChange={(o) => !o && onOpenChange(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{ref.clientName}</SheetTitle>
            <SheetDescription>
              Registrado el {dateLong(ref.registeredAt)}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-4">
            {/* Resumen */}
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Estatus</div>
                  <Badge variant="outline">{mapStatusForAmbassador(ref.status)}</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Próximo paso</div>
                  <div className="text-sm font-medium">{nextStep}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Interés</div>
                  <div className="text-sm capitalize">{ref.interestType}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Estatus de comisión</div>
                  <Badge variant="outline">
                    {ref.commissionStatus === 'potencial' ? 'Sin comisión generada' : COMMISSION_STATUS_LABEL[ref.commissionStatus]}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Asesor responsable */}
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground mb-3">
                <UserCheck className="h-3.5 w-3.5" /> Asesor responsable
              </div>
              {adv.name ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                      {adv.name.split(' ').map(p => p[0]).slice(0,2).join('')}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold">{adv.name}</div>
                      <div className="text-xs text-muted-foreground">{adv.role ?? 'Asesor SOZU'}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {adv.phone && <div><div className="text-muted-foreground">Teléfono</div><div>{adv.phone}</div></div>}
                    {adv.email && <div><div className="text-muted-foreground">Email</div><div className="truncate">{adv.email}</div></div>}
                    {ref.assignedAt && <div><div className="text-muted-foreground">Asignado el</div><div>{dateShort(ref.assignedAt)}</div></div>}
                    {ref.lastAdvisorUpdate && <div><div className="text-muted-foreground">Última actualización</div><div>{dateShort(ref.lastAdvisorUpdate)}</div></div>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {adv.phone && (
                      <a href={`tel:${adv.phone}`}>
                        <Button size="sm" variant="outline"><Phone className="h-3.5 w-3.5 mr-1" />Contactar asesor</Button>
                      </a>
                    )}
                    {adv.phone && (
                      <a href={`https://wa.me/${adv.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline"><MessageCircle className="h-3.5 w-3.5 mr-1" />WhatsApp</Button>
                      </a>
                    )}
                    {adv.email && (
                      <a href={`mailto:${adv.email}`}>
                        <Button size="sm" variant="outline"><Mail className="h-3.5 w-3.5 mr-1" />Enviar correo</Button>
                      </a>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    El asesor asignado es responsable del seguimiento comercial de tu referido. Puedes
                    contactarlo únicamente para dudas generales sobre el avance del proceso.
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    El seguimiento comercial, presentación del desarrollo, negociación y cierre de venta
                    son responsabilidad del asesor asignado y del equipo interno de SOZU.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aún no se ha asignado un asesor. Recibirás una notificación en cuanto tu referido sea
                  asignado al equipo comercial.
                </p>
              )}
            </Card>

            <ProtectionBadge referral={ref} ambassador={amb} />

            <Timeline referral={ref} />

            {/* Comisión */}
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-3">Comisión</div>
              {ref.commissionStatus === 'potencial' ? (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                  La comisión se calculará una vez que el referido concrete una compra y la operación sea
                  validada por SOZU. Aún no existe comisión generada.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {(['generada', 'autorizada', 'pagada'] as const).map((st) => {
                    const active = ref.commissionStatus === st;
                    const show =
                      st === 'pagada' ? ref.commissionStatus === 'pagada' :
                      st === 'autorizada' ? ref.commissionStatus === 'autorizada' || ref.commissionStatus === 'pagada' :
                      true;
                    return (
                      <div key={st} className={`rounded-md border p-3 ${active ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium capitalize">
                            Comisión {COMMISSION_STATUS_LABEL[st].toLowerCase()}
                          </span>
                          <Tooltip>
                            <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                            <TooltipContent className="max-w-xs">{COMMISSION_STATUS_HELP[st]}</TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="text-lg font-semibold mt-1">{show ? fmt(ref.commissionAmount) : '—'}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 text-xs text-muted-foreground">
                Condición para generar comisión: <strong>{amb.commissionTrigger}</strong>.
                {ref.estimatedPaymentDate && ref.commissionStatus !== 'potencial' && (
                  <> {' '}Fecha estimada de pago: <strong>{dateShort(ref.estimatedPaymentDate)}</strong>.</>
                )}
                {ref.paymentDate && (
                  <> {' '}Pagada el <strong>{dateShort(ref.paymentDate)}</strong>.</>
                )}
              </div>
            </Card>

            {/* Comentarios públicos */}
            {ref.publicComments && (
              <Card className="p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-2">
                  Mensaje del equipo
                </div>
                <p className="text-sm">{ref.publicComments}</p>
              </Card>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
