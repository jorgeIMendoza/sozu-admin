import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { UserPlus, Users, BadgeCheck, Wallet, Receipt, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { EMBAJADOR_DOC_TYPES } from '@/hooks/useEmbajadorDocumentos';

const PASOS = [
  { icon: UserPlus, title: 'Refieres', desc: 'Registras a tu conocido como referido con su consentimiento.' },
  { icon: Users, title: 'SOZU da seguimiento', desc: 'Un asesor interno contacta, presenta y acompaña la venta. Tú no negocias ni cierras.' },
  { icon: BadgeCheck, title: 'Se concreta la venta', desc: 'Cuando tu referido compra y la operación se valida, se genera tu comisión.' },
  { icon: Wallet, title: 'Comisión autorizada', desc: 'Administración autoriza el pago de tu comisión.' },
  { icon: Receipt, title: 'Subes tu factura', desc: 'En la sección Pagos cargas tu factura para que podamos liquidar.' },
  { icon: CheckCircle2, title: 'Te pagamos', desc: 'Realizamos el pago y obtienes tu recibo en el portal.' },
];

export function EmbajadorComoFuncionaDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>¿Cómo funciona el programa de Embajadores?</DialogTitle>
          <DialogDescription>Refiere, nosotros vendemos, tú ganas.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Pasos */}
          <ol className="space-y-3">
            {PASOS.map((p, i) => {
              const Icon = p.icon;
              return (
                <li key={i} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{i + 1}. {p.title}</div>
                    <div className="text-xs text-muted-foreground">{p.desc}</div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Documentos */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <FileText className="h-4 w-4 text-primary" /> Documentos que debes subir
            </div>
            <ul className="space-y-1.5">
              {EMBAJADOR_DOC_TYPES.map((d) => (
                <li key={d.key} className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                  {d.nombre}
                  {d.requiresApproval && <span className="text-[10px] text-amber-600">(requiere aprobación)</span>}
                </li>
              ))}
              <li className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                Factura fiscal (al momento del pago, desde la sección Pagos)
              </li>
            </ul>
            <p className="text-[11px] text-muted-foreground mt-2">
              Sube tus documentos en la sección <strong>Perfil</strong>. Los aprobados ya no se pueden reemplazar.
            </p>
          </div>

          {/* Reglas */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Reglas del programa
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div>
                <div className="font-medium text-foreground mb-1">Qué haces</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Refieres clientes potenciales con su consentimiento.</li>
                  <li>Mantienes tu documentación al día.</li>
                </ul>
              </div>
              <div>
                <div className="font-medium text-foreground mb-1">Qué no haces</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>No agendas citas ni presentas inventario.</li>
                  <li>No negocias precios ni participas en el cierre.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
