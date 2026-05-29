import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { mockNotifications } from '@/data/mockData';
import type { Notification } from '@/types/legal';

const typeConfig: Record<Notification['type'], { icon: React.ReactNode; accent: string }> = {
  info:    { icon: <Info className="h-4 w-4" />,           accent: 'text-[hsl(var(--status-info))] bg-[hsl(217_91%_95%)]' },
  warning: { icon: <AlertTriangle className="h-4 w-4" />,  accent: 'text-[hsl(var(--status-warning))] bg-[hsl(48_96%_89%)]' },
  success: { icon: <CheckCircle2 className="h-4 w-4" />,   accent: 'text-primary bg-primary/8' },
  error:   { icon: <XCircle className="h-4 w-4" />,        accent: 'text-destructive bg-destructive/8' },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="px-10 py-8 max-w-2xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-[24px] font-bold tracking-tight">Notificaciones</h1>
          <p className="text-[13px] text-muted-foreground">{unread} sin leer</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" className="h-9 text-[13px] gap-1.5 rounded-lg" onClick={markAllRead}>
            <Check className="h-3.5 w-3.5" /> Marcar como leídas
          </Button>
        )}
      </motion.div>

      <div className="space-y-2">
        {notifications.map((notif, i) => {
          const cfg = typeConfig[notif.type];
          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
              className={`panel transition-all duration-200 cursor-pointer ${notif.read ? 'opacity-50' : 'hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]'}`}
              onClick={() => markRead(notif.id)}
            >
              <div className="flex items-start gap-4 p-5">
                <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${cfg.accent}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-[14px] ${notif.read ? '' : 'font-semibold'}`}>{notif.title}</h3>
                    {!notif.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{notif.message}</p>
                  <div className="flex items-center gap-3 mt-3 text-[12px] text-muted-foreground/60">
                    <span>{formatTime(notif.createdAt)}</span>
                    {notif.caseId && (
                      <Link to={`/cases/${notif.caseId}`} className="font-mono hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                        {notif.caseId}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-24">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto mb-4">
            <Bell className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium">Todo en orden</p>
          <p className="text-[13px] text-muted-foreground mt-1">No hay notificaciones pendientes.</p>
        </div>
      )}
    </div>
  );
}
