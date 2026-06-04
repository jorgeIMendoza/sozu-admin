import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, Info, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  useNotificacionesLegalFlow,
  type NivelNotificacionLegal,
} from '@/hooks/useNotificacionesLegalFlow';

const nivelConfig: Record<NivelNotificacionLegal, { icon: React.ReactNode; accent: string }> = {
  info:    { icon: <Info className="h-4 w-4" />,           accent: 'text-[hsl(var(--status-info))] bg-[hsl(217_91%_95%)]' },
  warning: { icon: <AlertTriangle className="h-4 w-4" />,  accent: 'text-[hsl(var(--status-warning))] bg-[hsl(48_96%_89%)]' },
  success: { icon: <CheckCircle2 className="h-4 w-4" />,   accent: 'text-primary bg-primary/8' },
  error:   { icon: <XCircle className="h-4 w-4" />,        accent: 'text-destructive bg-destructive/8' },
};

export default function Notifications() {
  const { data, isLoading, error } = useNotificacionesLegalFlow();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const items = useMemo(() => data ?? [], [data]);
  const unread = items.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = () => setReadIds(new Set(items.map((n) => n.id)));
  const markRead = (id: string) =>
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="px-10 py-8 max-w-2xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div className="space-y-1">
          <h1 className="text-[24px] font-bold tracking-tight">Notificaciones</h1>
          <p className="text-[13px] text-muted-foreground">
            {isLoading ? 'Cargando…' : `${unread} sin leer · ${items.length} total`}
          </p>
        </div>
        {items.length > 0 && unread > 0 && (
          <Button variant="outline" className="h-9 text-[13px] gap-1.5 rounded-lg" onClick={markAllRead}>
            <Check className="h-3.5 w-3.5" /> Marcar como leídas
          </Button>
        )}
      </motion.div>

      {isLoading && (
        <div className="text-center py-24">
          <Loader2 className="h-6 w-6 text-muted-foreground/40 animate-spin mx-auto mb-4" />
          <p className="text-[13px] text-muted-foreground">Cargando notificaciones…</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="text-center py-24">
          <XCircle className="h-6 w-6 text-destructive/60 mx-auto mb-4" />
          <p className="text-sm font-medium">No fue posible cargar las notificaciones</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Error desconocido.'}
          </p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-2">
          {items.map((notif, i) => {
            const cfg = nivelConfig[notif.nivel];
            const read = readIds.has(notif.id);
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                className={`panel transition-all duration-200 cursor-pointer ${read ? 'opacity-50' : 'hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]'}`}
                onClick={() => markRead(notif.id)}
              >
                <div className="flex items-start gap-4 p-5">
                  <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${cfg.accent}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-[14px] ${read ? '' : 'font-semibold'}`}>{notif.titulo}</h3>
                      {!read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{notif.mensaje}</p>
                    <div className="flex items-center gap-3 mt-3 text-[12px] text-muted-foreground/60">
                      <span>{formatTime(notif.fecha_evento)}</span>
                      <Link
                        to={`/admin/legal-flow/cases/${notif.folio_cuenta}`}
                        className="font-mono hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {notif.folio_cuenta}
                      </Link>
                      {notif.critico && (
                        <span className="text-[11px] font-medium text-destructive px-1.5 py-0.5 rounded-full bg-destructive/10">
                          Crítico
                        </span>
                      )}
                      {notif.dias_esperando > 0 && (
                        <span className="text-[11px] text-muted-foreground/50">
                          hace {notif.dias_esperando} {notif.dias_esperando === 1 ? 'día' : 'días'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {items.length === 0 && (
            <div className="text-center py-24">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <Bell className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium">Todo en orden</p>
              <p className="text-[13px] text-muted-foreground mt-1">No hay notificaciones pendientes.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
