import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PenTool, ChevronRight, ShieldAlert, ArrowRight } from 'lucide-react';
import { mockRequests } from '@/data/mockData';
import type { LegalRequest } from '@/types/legal';

interface Props {
  openDrawer?: (title: string, cases: LegalRequest[]) => void;
}

export default function SignatureTracker({ openDrawer }: Props) {
  const inSignature = mockRequests.filter(r => r.status === 'in_signature_process');
  const partiallySigned = mockRequests.filter(r => r.status === 'partially_signed');
  const recentlySigned = mockRequests.filter(r => r.status === 'fully_signed');
  const kycBlocked = mockRequests.filter(r =>
    r.signers?.some(s => s.kycStatus === 'pending' || s.biometricStatus === 'pending')
  );

  const sections = [
    { title: 'Pendientes de firma', items: inSignature, actionLabel: 'Ver firmas' },
    { title: 'Parcialmente firmados', items: partiallySigned, actionLabel: 'Reenviar' },
    { title: 'Firmados recientemente', items: recentlySigned, actionLabel: 'Ver detalle' },
    { title: 'Bloqueados por KYC / Biometría', items: kycBlocked, actionLabel: 'Validar KYC' },
  ];

  return (
    <motion.div
      className="panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
    >
      <div className="panel-header">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <PenTool className="h-4 w-4" strokeWidth={1.75} />
          Seguimiento de Firmas
        </h2>
      </div>
      <div className="p-5 space-y-5">
        {sections.map((sec) => (
          <div key={sec.title}>
            <button
              onClick={() => openDrawer?.(sec.title, sec.items)}
              className="flex items-center justify-between mb-2 w-full text-left group cursor-pointer hover:bg-accent -mx-1 px-1 py-1 rounded-lg transition-colors"
            >
              <span className="text-[12px] font-semibold text-foreground group-hover:text-primary transition-colors">{sec.title}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold tabular-nums bg-muted rounded-md px-2 py-0.5">{sec.items.length}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            </button>
            {sec.items.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 py-1">Sin expedientes</p>
            ) : (
              <div className="space-y-1">
                {sec.items.slice(0, 3).map((r) => (
                  <Link
                    key={r.id}
                    to={`/cases/${r.id}`}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-accent transition-colors group border border-transparent hover:border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate group-hover:text-primary transition-colors">{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground/60">
                          {r.signers ? `${r.signers.filter(s => s.status === 'signed').length}/${r.signers.length} firmantes` : 'Sin firmantes'}
                        </span>
                        {r.signers?.some(s => s.kycStatus === 'pending') && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-destructive font-medium">
                            <ShieldAlert className="h-3 w-3" /> KYC pendiente
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/8 px-2.5 py-1 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {sec.actionLabel} <ChevronRight className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
