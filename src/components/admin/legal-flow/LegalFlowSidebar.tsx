import {
  LayoutDashboard,
  Inbox,
  FilePlus,
  FileText,
  Bell,
  Settings,
  Archive,
  ArrowLeft,
  LogOut,
} from 'lucide-react';
import { NavLink } from '@/components/admin/legal-flow/NavLink';
import { useNavigate } from 'react-router-dom';
import sozuLogo from '@/assets/sozu-logo-black.png';
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
import { useAuth } from '@/contexts/AuthContext';

const BASE = '/admin/legal-flow';

const mainNav = [
  { title: 'Panel de Operaciones', url: `${BASE}`, icon: LayoutDashboard, end: true },
  { title: 'Solicitudes Legales', url: `${BASE}/requests`, icon: Inbox },
  { title: 'Nueva Solicitud', url: `${BASE}/requests/new`, icon: FilePlus },
];

const catalogNav = [
  { title: 'Catálogo de Plantillas', url: `${BASE}/templates`, icon: FileText },
  { title: 'Expedientes Archivados', url: `${BASE}/archived`, icon: Archive },
];

const systemNav = [
  { title: 'Notificaciones', url: `${BASE}/notifications`, icon: Bell },
  { title: 'Configuración', url: `${BASE}/settings`, icon: Settings },
];

export function LegalFlowSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  const displayName = profile?.nombre || 'Usuario Legal';
  const initials = displayName.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <div className="flex items-center justify-center">
          <img src={sozuLogo} alt="SOZU" className={collapsed ? 'h-7 w-7 object-contain' : 'h-7 w-auto object-contain'} />
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin px-2 py-3">
        <NavGroup label="Operaciones" items={mainNav} collapsed={collapsed} />
        <NavGroup label="Registro Legal" items={catalogNav} collapsed={collapsed} />
        <NavGroup label="Sistema" items={systemNav} collapsed={collapsed} />
        {isSuperAdmin && (
          <SidebarGroup className="mt-2">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate('/admin')} className="rounded-lg px-2.5 py-[9px] text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground">
                    <ArrowLeft className="mr-2.5 h-[18px] w-[18px]" strokeWidth={1.75} />
                    {!collapsed && <span>Volver al admin</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        {!collapsed ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                {initials}
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-foreground leading-tight">{displayName}</span>
                <span className="text-[11px] text-muted-foreground leading-tight">{profile?.rol_nombre || 'Legal'}</span>
              </div>
            </div>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="rounded-lg px-2.5 py-[9px] text-[13px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="mr-2.5 h-[18px] w-[18px]" strokeWidth={1.75} />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </div>
        ) : (
          <SidebarMenuButton
            onClick={handleSignOut}
            tooltip="Cerrar sesión"
            className="justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </SidebarMenuButton>
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
                  end={(item as any).end}
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
