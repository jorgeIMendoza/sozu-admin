import {
  LayoutDashboard,
  Inbox,
  FilePlus,
  FileText,
  Bell,
  Settings,
  Archive,
} from 'lucide-react';
import { NavLink } from '@/components/admin/legal-flow/NavLink';
import sozuLogo from '@/assets/sozu-logo-black.png';
import sozuMark from '@/assets/sozu-logo-black.png';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

const mainNav = [
  { title: 'Panel de Operaciones', url: '/', icon: LayoutDashboard },
  { title: 'Solicitudes Legales', url: '/requests', icon: Inbox },
  { title: 'Nueva Solicitud', url: '/requests/new', icon: FilePlus },
];

const catalogNav = [
  { title: 'Catálogo de Plantillas', url: '/templates', icon: FileText },
  { title: 'Expedientes Archivados', url: '/archived', icon: Archive },
];

const systemNav = [
  { title: 'Notificaciones', url: '/notifications', icon: Bell },
  { title: 'Configuración', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <div className="flex items-center justify-center">
          {collapsed ? (
            <img src={sozuMark} alt="SOZU" className="h-7 w-7 shrink-0 object-contain" />
          ) : (
            <img src={sozuLogo} alt="SOZU" className="h-7 w-auto object-contain" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin px-2 py-3">
        <NavGroup label="Operaciones" items={mainNav} collapsed={collapsed} />
        <NavGroup label="Registro Legal" items={catalogNav} collapsed={collapsed} />
        <NavGroup label="Sistema" items={systemNav} collapsed={collapsed} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              CM
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-foreground leading-tight">
                Carlos Mendoza
              </span>
              <span className="text-[11px] text-muted-foreground leading-tight">Administrador Legal</span>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function NavGroup({ label, items, collapsed }: { label: string; items: typeof mainNav; collapsed: boolean }) {
  return (
    <SidebarGroup className="mt-1">
      <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60 font-semibold mb-1 px-2">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === '/'}
                  className="rounded-lg px-2.5 py-[9px] text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                >
                  <item.icon className="mr-2.5 h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
