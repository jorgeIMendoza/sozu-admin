import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/admin/legal-flow/LegalFlowSidebar';
import { Bell } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { mockNotifications } from '@/data/legalFlow/mockData';
import sozuMark from '@/assets/sozu-logo-black.png';

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Panel de Operaciones',
  '/requests': 'Solicitudes Legales',
  '/requests/new': 'Nueva Solicitud',
  '/templates': 'Catálogo de Plantillas',
  '/notifications': 'Notificaciones',
  '/settings': 'Configuración',
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const unreadCount = mockNotifications.filter((n) => !n.read).length;
  const location = useLocation();
  const currentLabel = ROUTE_LABELS[location.pathname] || 'Expediente';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-6 shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-8 w-8" />
              <div className="hidden sm:flex items-center text-[13px] text-muted-foreground gap-1.5">
                <img src={sozuMark} alt="SOZU" className="h-4 w-4 object-contain" />
                <span className="font-medium text-foreground">SOZU Legal OS</span>
                <span className="text-muted-foreground/40">·</span>
                <span>{currentLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent"
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-[16px] w-[16px] items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                CM
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
