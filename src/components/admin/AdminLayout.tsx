import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { PortalInmobiliariaLayout } from "./portal-inmobiliaria/PortalInmobiliariaLayout";
import { PortalClienteLayout } from "./portal-cliente/PortalClienteLayout";
import { PortalCobranzaLayout } from "./portal-cobranza/PortalCobranzaLayout";
import { AdminHeader } from "./AdminHeader";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { AgentPortalLayout } from "./agent-portal/AgentPortalLayout";
import { PortalEscrituracionLayout } from "./portal-escrituracion/PortalEscrituracionLayout";
import { PortalAltaDireccionLayout } from "./portal-alta-direccion/PortalAltaDireccionLayout";
import { PortalAdministracionLayout } from "./portal-administracion/PortalAdministracionLayout";
import { PortalEmbajadorLayout } from "./portal-embajador/PortalEmbajadorLayout";
import { PortalNotariaLayout } from "./portal-notaria/PortalNotariaLayout";
import { PortalJuridicoLayout } from "./portal-juridico/PortalJuridicoLayout";
import { LegalFlowLayout } from "./legal-flow/LegalFlowLayout";
import { PortalCondominioLayout } from "./portal-condominio/PortalCondominioLayout";
import { PortalCRMLayout } from "./portal-crm/PortalCRMLayout";
import { PortalBancosLayout } from "./portal-bancos/PortalBancosLayout";
import { PortalEstructuraComisionesLayout } from "./portal-estructura-comisiones/PortalEstructuraComisionesLayout";
import { PortalProductosLayout } from "./portal-productos/PortalProductosLayout";
import { PortalSocioBancarioLayout } from "./portal-socio-bancario/PortalSocioBancarioLayout";
import { PortalTicketsLayout } from "./portal-tickets/PortalTicketsLayout";

const SIMPLIFIED_ROLES = ["Agente Inmobiliario"];

export const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { profile } = useAuth();
  const { setTheme } = useTheme();
  
  const isSimplifiedRole = SIMPLIFIED_ROLES.includes(profile?.rol_nombre ?? "");

  useEffect(() => {
    if (isSimplifiedRole) {
      setTheme("light");
    }
  }, [isSimplifiedRole, setTheme]);

  // Use AgentPortalLayout for ALL roles on agent portal routes
  if (location.pathname.startsWith("/admin/agent/")) {
    return <AgentPortalLayout />;
  }

  // Use PortalInmobiliariaLayout for portal inmobiliaria routes
  if (location.pathname.startsWith("/admin/portal-inmobiliaria")) {
    return <PortalInmobiliariaLayout />;
  }

  // Use PortalClienteLayout for portal cliente routes
  if (location.pathname.startsWith("/admin/portal-cliente")) {
    return <PortalClienteLayout />;
  }

  // Use PortalCobranzaLayout for portal cobranza routes
  if (location.pathname.startsWith("/admin/portal-cobranza")) {
    return <PortalCobranzaLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-escrituracion")) {
    return <PortalEscrituracionLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-alta-direccion")) {
    return <PortalAltaDireccionLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-administracion")) {
    return <PortalAdministracionLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-condominio")) {
    return <PortalCondominioLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-embajador")) {
    return <PortalEmbajadorLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-notaria")) {
    return <PortalNotariaLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-juridico")) {
    return <PortalJuridicoLayout />;
  }

  if (location.pathname.startsWith("/admin/legal-flow")) {
    return <LegalFlowLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-crm")) {
    return <PortalCRMLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-bancos")) {
    return <PortalBancosLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-estructura-comisiones")) {
    return <PortalEstructuraComisionesLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-socio-bancario")) {
    return <PortalSocioBancarioLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-productos")) {
    return <PortalProductosLayout />;
  }

  if (location.pathname.startsWith("/admin/portal-tickets")) {
    return <PortalTicketsLayout />;
  }

  // Este render solo se alcanza en el panel admin (todos los portales retornan
  // antes, arriba). Los roles "simplificados" también necesitan aquí su sidebar
  // y su header: antes se les suprimían ambos y quedaban sin menú, sin nombre y
  // sin rol — solo el contenido suelto. Su experiencia reducida vive en el
  // portal (AgentPortalLayout y compañía), no en el panel admin. AdminHeader ya
  // tiene su propia variante para estos roles y la aplica solo.
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPath={location.pathname}
      />

      <div className="flex flex-col min-h-screen transition-all duration-300 lg:ml-64">
        <AdminHeader
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 px-8 py-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};