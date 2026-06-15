import {
  LayoutDashboard,
  Inbox,
  FileText,
  Bell,
  Archive,
  ArrowLeft,
  LogOut,
  Stamp,
} from 'lucide-react';
import { NavLink } from '@/components/admin/legal-flow/NavLink';
import { useNavigate } from 'react-router-dom';
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
import { APP_VERSION, SOZU_LOGO_URL } from '@/lib/config';

const BASE = '/admin/legal-flow';

const mainNav = [
  { title: 'Panel de Operaciones', url: `${BASE}`, icon: LayoutDashboard, end: true },
  { title: 'Solicitudes Legales', url: `${BASE}/requests`, icon: Inbox },
];

const escrituracionNav = [
  { title: 'Expedientes', url: `${BASE}/escrituracion/expedientes`, icon: Stamp },
];

const catalogNav = [
  { title: 'Catálogo de Plantillas', url: `${BASE}/templates`, icon: FileText },
  { title: 'Expedientes Archivados', url: `${BASE}/archived`, icon: Archive },
];

const systemNav = [
  { title: 'Notificaciones', url: `${BASE}/notifications`, icon: Bell },
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
  // "Volver al admin" sólo para Super Administrador (rol_id = 1). El rol 2
  // (Admin Cobranza) y cualquier otro rol no deben verlo.
  const isSuperAdmin = profile?.rol_id === 1;
  const displayName = profile?.nombre || 'Usuario Legal';
  const initials = displayName.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border-soft px-5 py-4 flex flex-col gap-1">
        <img src={SOZU_LOGO_URL} alt="SOZU" className={collapsed ? 'h-6 w-6 object-contain' : 'h-6 w-auto object-contain object-left dark:invert'} />
        {!collapsed && (
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">Legal Flow</p>
        )}
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin px-2 py-3">
        <NavGroup label="Operaciones" items={mainNav} collapsed={collapsed} />
        <NavGroup label="Escrituración" items={escrituracionNav} collapsed={collapsed} />
        <NavGroup label="Registro Legal" items={catalogNav} collapsed={collapsed} />
        <NavGroup label="Sistema" items={systemNav} collapsed={collapsed} />
        {isSuperAdmin && (
          <SidebarGroup className="mt-2">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate('/admin')} className="rounded-md pl-4 pr-3 py-2 text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground">
                    <ArrowLeft className="mr-3 size-4 shrink-0" />
                    {!collapsed && <span>Volver al admin</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border-soft px-3 pt-1 pb-4 space-y-1">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">{displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{profile?.rol_nombre || 'Legal'}</p>
              </div>
            </div>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="w-full rounded-md px-2 py-1.5 text-[12px] text-destructive hover:bg-destructive/10 justify-center gap-1.5"
            >
              <LogOut className="size-4 shrink-0" />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
            <p className="text-[10px] text-muted-foreground/40 font-mono text-center pt-0.5">{APP_VERSION}</p>
          </>
        ) : (
          <SidebarMenuButton
            onClick={handleSignOut}
            tooltip="Cerrar sesión"
            className="justify-center rounded-md text-destructive hover:bg-destructive/10"
          >
            <LogOut className="size-4" />
          </SidebarMenuButton>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function NavGroup({ label, items, collapsed }: { label: string; items: typeof mainNav; collapsed: boolean }) {
  return (
    <SidebarGroup className="mt-1">
      {!collapsed && (
        <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60 font-semibold mb-1 px-1">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={(item as any).end}
                  className="relative rounded-md pl-4 pr-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors duration-150"
                  activeClassName="bg-primary/[0.06] text-primary"
                >
                  <item.icon className="mr-3 size-4 shrink-0 opacity-60" />
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
