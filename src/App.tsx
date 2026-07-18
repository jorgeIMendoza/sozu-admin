import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DevelopmentBanner } from "@/components/DevelopmentBanner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { AgentImpersonationProvider } from "@/contexts/AgentImpersonationContext";
import { ClienteImpersonationProvider } from "@/contexts/ClienteImpersonationContext";
import { InmobiliariaImpersonationProvider } from "@/contexts/InmobiliariaImpersonationContext";
import { CobranzaImpersonationProvider } from "@/contexts/CobranzaImpersonationContext";
import { EmbajadorImpersonationProvider } from "@/contexts/EmbajadorImpersonationContext";
import { CrmImpersonationProvider } from "@/contexts/CrmImpersonationContext";
import { AmbassadorsProvider } from "@/store/AmbassadorsContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PermissionRoute } from "@/components/auth/PermissionRoute";
import { AdminLayout } from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import InmobiliariasThemeWrapper from "./components/admin/InmobiliariasThemeWrapper";

// Retry wrapper for lazy imports — handles stale cache after deploys
const lazyRetry = <T extends ComponentType<any>>(importFn: () => Promise<{ default: T }>) =>
  lazy<T>(() =>
    importFn().catch(() => {
      // If the chunk fails to load, reload the page once
      const key = "chunk-retry";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
      return importFn();
    })
  );

// Auth pages
const Login = lazyRetry(() => import("./pages/auth/Login"));
const ChangePassword = lazyRetry(() => import("./pages/auth/ChangePassword"));
const ConfirmacionEmail = lazyRetry(() => import("./pages/auth/ConfirmacionEmail"));
const ForgotPassword = lazyRetry(() => import("./pages/auth/ForgotPassword"));

// Lazy load non-critical route components
const Proyectos = lazyRetry(() => import("./pages/admin/Proyectos"));
const Propiedades = lazyRetry(() => import("./pages/admin/Propiedades"));
const ActivosComerciales = lazyRetry(() => import("./pages/admin/ActivosComerciales"));
const ActivosComercialesNuevo = lazyRetry(() => import("./pages/admin/ActivosComercialesNuevo"));
const ActivosComercialesDetalle = lazyRetry(() => import("./pages/admin/ActivosComercialesDetalle"));
const Modelos = lazyRetry(() => import("./pages/admin/Modelos"));
const Vistas = lazyRetry(() => import("./pages/admin/Vistas"));
const Estacionamientos = lazyRetry(() => import("./pages/admin/Estacionamientos"));
const Bodegas = lazyRetry(() => import("./pages/admin/Bodegas"));
const Pagos = lazyRetry(() => import("./pages/admin/Pagos"));
const DetalleCuentaCobranza = lazyRetry(() => import("./pages/admin/DetalleCuentaCobranza"));
const Usuarios = lazyRetry(() => import("./pages/admin/Usuarios"));
const UsuariosDirectivos = lazyRetry(() => import("./pages/admin/UsuariosDirectivos"));
const UsuariosClientes = lazyRetry(() => import("./pages/admin/UsuariosClientes"));
const NuevoUsuario = lazyRetry(() => import("./pages/admin/NuevoUsuario"));
const EntidadesLegales = lazyRetry(() => import("./pages/admin/EntidadesLegales"));
const Desarrolladores = lazyRetry(() => import("./pages/admin/Desarrolladores"));
const Inmobiliarias = lazyRetry(() => import("./pages/admin/Inmobiliarias"));
const Administradoras = lazyRetry(() => import("./pages/admin/Administradoras"));
const Notarias = lazyRetry(() => import("./pages/admin/Notarias"));
const Bancos = lazyRetry(() => import("./pages/admin/Bancos"));
const CuentasSozu = lazyRetry(() => import("./pages/admin/CuentasSozu"));
const Prospectos = lazyRetry(() => import("./pages/admin/Prospectos"));
const Compradores = lazyRetry(() => import("./pages/admin/Compradores"));
const DetalleCuentaMantenimiento = lazyRetry(() => import("./pages/admin/DetalleCuentaMantenimiento"));
const Vendedores = lazyRetry(() => import("./pages/admin/Vendedores"));
const Duenos = lazyRetry(() => import("./pages/admin/Duenos"));
const Residentes = lazyRetry(() => import("./pages/admin/Residentes"));
const Agentes = lazyRetry(() => import("./pages/admin/Agentes"));
const AdministradoresPersonas = lazyRetry(() => import("./pages/admin/AdministradoresPersonas"));
const RepresentantesLegales = lazyRetry(() => import("./pages/admin/RepresentantesLegales"));
const RepresentantesComerciales = lazyRetry(() => import("./pages/admin/RepresentantesComerciales"));
const Productos = lazyRetry(() => import("./pages/admin/Productos"));
const Servicios = lazyRetry(() => import("./pages/admin/Servicios"));
const CategoriasProductos = lazyRetry(() => import("./pages/admin/CategoriasProductos"));
const CuentasMantenimiento = lazyRetry(() => import("./pages/admin/CuentasMantenimiento"));
const ComingSoon = lazyRetry(() => import("./pages/admin/ComingSoon"));
const JuridicoAdministrar = lazyRetry(() => import("./pages/admin/juridico/JuridicoAdministrar").then(m => ({ default: m.JuridicoAdministrar })));
const RevisionDocumentacion = lazyRetry(() => import("./pages/admin/RevisionDocumentacion"));
const ConsultasIA = lazyRetry(() => import("./pages/admin/ConsultasIA"));
const Reservas = lazyRetry(() => import("./pages/admin/Reservas"));
const Contratos = lazyRetry(() => import("./pages/admin/legal/Contratos"));
const CartaAcuerdos = lazyRetry(() => import("./pages/admin/legal/CartaAcuerdos"));
const Comisiones = lazyRetry(() => import("./pages/admin/Comisiones"));
const AprobacionComisiones = lazyRetry(() => import("./pages/admin/AprobacionComisiones"));
const ComisionesExternas = lazyRetry(() => import("./pages/admin/ComisionesExternas"));
const PagarComisiones = lazyRetry(() => import("./pages/admin/PagarComisiones"));
const PagoProveedores = lazyRetry(() => import("./pages/admin/PagoProveedores"));
const ReporteDiscrepancias = lazyRetry(() => import("./pages/admin/ReporteDiscrepancias"));
const RolesPermisos = lazyRetry(() => import("./pages/admin/RolesPermisos"));
const AccessDenied = lazyRetry(() => import("./pages/admin/AccessDenied"));
const LogsActividad = lazyRetry(() => import("./pages/admin/LogsActividad"));
const RastreoClabeSTP = lazyRetry(() => import("./pages/admin/RastreoClabeSTP"));
const RastreoPagosSTP = lazyRetry(() => import("./pages/admin/RastreoPagosSTP"));
const ConfiguracionReportes = lazyRetry(() => import("./pages/admin/ConfiguracionReportes"));
const VersionProduccion = lazyRetry(() => import("./pages/admin/VersionProduccion"));
const ReportesInventarios = lazyRetry(() => import("./pages/admin/reportes/Inventarios"));
const ReportesFinanzas = lazyRetry(() => import("./pages/admin/reportes/Finanzas"));
const ValidacionContratosPDF = lazyRetry(() => import("./pages/admin/ValidacionContratosPDF"));
const ValidacionPagos = lazyRetry(() => import("./pages/admin/ValidacionPagos"));
const EstadosCuenta = lazyRetry(() => import("./pages/admin/finanzas/EstadosCuenta"));
const InformacionFinanciera = lazyRetry(() => import("./pages/admin/finanzas/InformacionFinanciera"));
const ReporteViewer = lazyRetry(() => import("./pages/admin/reportes/ReporteViewer"));
const MiInformacion = lazyRetry(() => import("./pages/admin/inmobiliarias/MiInformacion"));
const MisAgentes = lazyRetry(() => import("./pages/admin/inmobiliarias/MisAgentes"));
const MisPropiedades = lazyRetry(() => import("./pages/admin/inmobiliarias/MisPropiedades"));
const MisVentas = lazyRetry(() => import("./pages/admin/inmobiliarias/MisVentas"));
const MisProyectos = lazyRetry(() => import("./pages/admin/inmobiliarias/MisProyectos"));
const MiProyectoDetalle = lazyRetry(() => import("./pages/admin/inmobiliarias/MiProyectoDetalle"));
const MiProyectoInventario = lazyRetry(() => import("./pages/admin/inmobiliarias/MiProyectoInventario"));
const InventarioGlobal = lazyRetry(() => import("./pages/admin/inmobiliarias/InventarioGlobalAB"));
const MedicionesCTA = lazyRetry(() => import("./pages/admin/MedicionesCTA"));
const ABTests = lazyRetry(() => import("./pages/admin/ABTests"));
const AdministrarMenus = lazyRetry(() => import("./pages/admin/AdministrarMenus"));
const AdministrarAvisos = lazyRetry(() => import("./pages/admin/comunicacion/AdministrarAvisos"));
const EnviarAvisos = lazyRetry(() => import("./pages/admin/comunicacion/EnviarAvisos"));
const EjecucionesAvisos = lazyRetry(() => import("./pages/admin/comunicacion/Ejecuciones"));
const WorkflowOffers = lazyRetry(() => import("./pages/admin/crm/WorkflowOffers"));
const DashboardEjecutivo = lazyRetry(() => import("./pages/admin/crm/DashboardEjecutivo"));
const ConfiguracionCitas = lazyRetry(() => import("./pages/admin/comunicacion/ConfiguracionCitas"));
const TodasLasCitas = lazyRetry(() => import("./pages/admin/comunicacion/TodasLasCitas"));
const NotificacionesConfig = lazyRetry(() => import("./pages/admin/NotificacionesConfig"));
const NotificacionesLog = lazyRetry(() => import("./pages/admin/NotificacionesLog"));

// Portal Inmobiliaria pages
const InmobDashboard = lazyRetry(() => import("./pages/admin/portal-inmobiliaria/InmobDashboard"));
const InmobAgentes = lazyRetry(() => import("./pages/admin/portal-inmobiliaria/InmobAgentes"));
const InmobAgentProfile = lazyRetry(() => import("./pages/admin/portal-inmobiliaria/InmobAgentProfile"));
const InmobPipeline = lazyRetry(() => import("./pages/admin/portal-inmobiliaria/InmobPipeline"));
const InmobProspectos = lazyRetry(() => import("./pages/admin/portal-inmobiliaria/InmobProspectos"));
const InmobCitas = lazyRetry(() => import("./pages/admin/portal-inmobiliaria/InmobCitas"));
const InmobComisiones = lazyRetry(() => import("./pages/admin/portal-inmobiliaria/InmobComisiones"));
const InmobReportes = lazyRetry(() => import("./pages/admin/portal-inmobiliaria/InmobReportes"));
const InmobConfiguracion = lazyRetry(() => import("./pages/admin/portal-inmobiliaria/InmobConfiguracion"));

// Agent Portal pages
const AgentInicio = lazyRetry(() => import("./pages/admin/agent-portal/AgentInicio"));
const AgentInventario = lazyRetry(() => import("./pages/admin/agent-portal/AgentInventario"));
const AgentPipeline = lazyRetry(() => import("./pages/admin/agent-portal/AgentPipeline"));
const AgentComisiones = lazyRetry(() => import("./pages/admin/agent-portal/AgentComisiones"));
const AgentPerfil = lazyRetry(() => import("./pages/admin/agent-portal/AgentPerfil"));
const AgentProspectos = lazyRetry(() => import("./pages/admin/agent-portal/AgentProspectos"));
const AgentProspectoDetalle = lazyRetry(() => import("./pages/admin/agent-portal/AgentProspectoDetalle"));
const AgentUnidadesProyecto = lazyRetry(() => import("./pages/admin/agent-portal/AgentUnidadesProyecto"));
const AgentProyectoDetalle = lazyRetry(() => import("./pages/admin/agent-portal/AgentProyectoDetalle"));

// Portal Cliente pages
const ClienteInicio = lazyRetry(() => import("./pages/admin/portal-cliente/ClienteInicio"));
const ClientePerfil = lazyRetry(() => import("./pages/admin/portal-cliente/ClientePerfil"));
const ClienteHistorialPagos = lazyRetry(() => import("./pages/admin/portal-cliente/ClienteHistorialPagos"));
const ClientePropiedadDetalle = lazyRetry(() => import("./pages/admin/portal-cliente/ClientePropiedadDetalle"));
const ClienteMantenimientoPago = lazyRetry(() => import("./pages/admin/portal-cliente/ClienteMantenimientoPago"));
const ClientePropiedadPago = lazyRetry(() => import("./pages/admin/portal-cliente/ClientePropiedadPago"));
const ClienteDetallesTecnicos = lazyRetry(() => import("./pages/admin/portal-cliente/ClienteDetallesTecnicos"));
const ClienteDocumentos = lazyRetry(() => import("./pages/admin/portal-cliente/ClienteDocumentos"));
const ClienteNotificaciones = lazyRetry(() => import("./pages/admin/portal-cliente/ClienteNotificaciones"));
const ClienteEnAdquisicion = lazyRetry(() => import("./pages/admin/portal-cliente/ClienteEnAdquisicion"));
const ClientePatrimonio = lazyRetry(() => import("./pages/admin/portal-cliente/ClientePatrimonio"));
const ClientePropiedades = lazyRetry(() => import("./pages/admin/portal-cliente/ClientePropiedades"));
const ClienteEstadoCuenta = lazyRetry(() => import("./pages/admin/portal-cliente/ClienteEstadoCuenta"));
const ClienteProductos = lazyRetry(() => import("./pages/admin/portal-cliente/ClienteProductos"));

// Portal Cobranza pages
const CollectionDashboard = lazyRetry(() => import("./pages/admin/portal-cobranza/CollectionDashboard"));
const CollectionInbox = lazyRetry(() => import("./pages/admin/portal-cobranza/CollectionInbox"));
const CobranzaAtencion = lazyRetry(() => import("./pages/admin/portal-cobranza/CobranzaAtencion"));
const CollectionPayments = lazyRetry(() => import("./pages/admin/portal-cobranza/CollectionPayments"));
const CollectionProductsMaintenance = lazyRetry(() => import("./pages/admin/portal-cobranza/CollectionProductsMaintenance"));
const CobranzaConciliaciones = lazyRetry(() => import("./pages/admin/portal-cobranza/CobranzaConciliaciones"));
const CobranzaPromesas = lazyRetry(() => import("./pages/admin/portal-cobranza/CobranzaPromesas"));
const CobranzaAdminAvisos = lazyRetry(() => import("./pages/admin/portal-cobranza/CobranzaAdminAvisos"));
const CobranzaEnviarAvisos = lazyRetry(() => import("./pages/admin/portal-cobranza/CobranzaEnviarAvisos"));
const CobranzaEjecuciones = lazyRetry(() => import("./pages/admin/portal-cobranza/CobranzaEjecuciones"));
const CobranzaPlantillas = lazyRetry(() => import("./pages/admin/portal-cobranza/CobranzaPlantillas"));
const CobranzaReportes = lazyRetry(() => import("./pages/admin/portal-cobranza/CobranzaReportes"));
const CobranzaCuentaDetalle = lazyRetry(() => import("./pages/admin/portal-cobranza/CobranzaCuentaDetalle"));
const PECComingSoon = lazyRetry(() => import("./pages/admin/portal-estructura-comisiones/PECComingSoon"));
const PECDashboard = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/DashboardTab"));
const PECExecutiveDashboard = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/ExecutiveDashboardTab"));
const PECProjects = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/ProjectsTab"));
const PECChannels = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/ChannelsTab"));
const PECOrgChart = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/OrgChartTab"));
const PECStructure = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/StructureTab"));
const PECDirectorio = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/DirectorioPuestosTab"));
const PECCommissions = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/CommissionsTab"));
const PECPaymentPolicies = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/PaymentPoliciesTab"));
const PECUnitCommission = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/UnitCommissionTab"));
const PECBrokerIncentives = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/BrokerIncentivesTab"));
const PECScenarios = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/ScenariosTab"));
const PECCommSimulator = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/CommissionSimulatorTab"));
const PECDistSimulator = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/DistributionSimulatorTab"));
const PECBrokerCalc = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/MonthlyIncomeSimulatorTab"));
const PECBrokerCalculator = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/BrokerCalculatorTab"));
const PECFinancialSimulator = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/FinancialSimulatorTab"));
const PECMonthlyFlow = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/MonthlyFlowTab"));
const PECResults = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/ResultsTab"));
const PECCompensation = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/CompensationTab"));
const PECCompetitividad = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/CompetitividadTab"));
const PECBenchmark = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/BenchmarkTab"));
const PECCompetitorsBenchmark = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/CompetitorsBenchmarkTab"));
const PECInventoryAdvanced = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/InventoryAdvancedTab"));
const PECAgentPortal = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/tabs/AgentPortalTab"));
const PECAmbassadorsAdmin = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/ambassadors/AmbassadorsAdminTab"));
const PECAmbassadorsPortal = lazyRetry(() => import("./components/admin/portal-estructura-comisiones/ambassadors/AmbassadorsPortalTab"));
const PPComingSoon = lazyRetry(() => import("./pages/admin/portal-productos/ComingSoon"));
const PPResumenPage = lazyRetry(() => import("./pages/admin/portal-productos/ResumenEjecutivoPage"));
const PPCarteraPage = lazyRetry(() => import("./pages/admin/portal-productos/CarteraPage"));
const PPDetalleCuentaPage = lazyRetry(() => import("./pages/admin/portal-productos/DetalleCuentaPage"));
const PPAnalisisPage = lazyRetry(() => import("./pages/admin/portal-productos/AnalisisCobranzaPage"));
const PPHistoricoPage = lazyRetry(() => import("./pages/admin/portal-productos/HistoricoVentasPage"));
const EscDashboard = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscDashboard })));
const EscRelacionPagos = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscRelacionPagos })));
const EscExpedientes = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscExpedientes })));
const EscUnidadesListasEscriturar = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscUnidadesListasEscriturar })));
const EscUnidades = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscUnidades })));
const EscCredito = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscCredito })));
const EscPipeline = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscPipeline })));
const EscNotarias = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscNotarias })));
const EscNotarios = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscNotarios })));
const EscAvaluos = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscAvaluos })));
const EscPLD = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscPLD })));
const EscBorradores = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscBorradores })));
const EscPlantillas = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscPlantillas })));
const EscFirmas = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscFirmas })));
const EscCitas = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscCitas })));
const EscEntregas = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscEntregas })));
const EscEntregaDetalle = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscEntregaDetalle })));
const EscRPP = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscRPP })));
const EscReportesPage = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscReportes })));
const EscAuditoria = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscAuditoria })));
const EscConfiguracion = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscConfiguracion })));
const EscDemandas = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscDemandas })));
const EscPostventa = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscPostventa })));
const EscPostventaDetalle = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscPostventaDetalle })));
const EscWorkflow     = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscWorkflow })));
const EscAppNotaria         = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscAppNotaria })));
const EscAppNotariaUsuarios = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscAppNotariaUsuarios })));
const EscAppJuridico        = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscAppJuridico })));
const EscChecklistConfig    = lazyRetry(() => import("./pages/admin/portal-escrituracion/index").then(m => ({ default: m.EscChecklistConfig })));
const AppNotariaLogin       = lazyRetry(() => import("./pages/notaria/AppNotariaLogin"));

// Portal Alta Dirección
const AltaDireccionDashboard = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionDashboard })));
const AltaDireccionCitas = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionCitas })));
const AltaDireccionProspectos = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionProspectos })));
const AltaDireccionPipeline = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionPipeline })));
const AltaDireccionOffers = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionOffers })));
const AltaDireccionCobranza = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionCobranza })));
const AltaDireccionContratos = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionContratos })));
const AltaDireccionFacturas = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionFacturas })));
const AltaDireccionComisiones = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionComisiones })));
const AltaDireccionRedComercial = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionRedComercial })));
const AltaDireccionReportes = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionReportes })));
const AltaDireccionAuditoria = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionAuditoria })));
const AltaDireccionConfiguracion = lazyRetry(() => import("./pages/admin/portal-alta-direccion/index").then(m => ({ default: m.AltaDireccionConfiguracion })));
const AltaDireccionNotificaciones = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionNotificacionesPage"));
const AltaDireccionBandejaValidaciones = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionBandejaValidacionesPage"));
const AltaDireccionCicloVenta = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionCicloVentaPage"));
const AltaDireccionFacturasPorCobrar = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionFacturasPorCobrarPage"));
const AltaDireccionFacturasPorPagar = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionFacturasPorPagarPage"));
const AltaDireccionComisionesExternas = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionComisionesExternasPage"));
const AltaDireccionComisionesInternas = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionComisionesInternasPage"));
const AltaDireccionHistoricoComercial = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionHistoricoComercialPage"));
const AltaDireccionAnalisisCobranza = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionAnalisisCobranzaPage"));
const AltaDireccionIngresosEgresos = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionIngresosEgresosPage"));
const AltaDireccionForecastIngresos = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionForecastIngresosPage"));
const AltaDireccionEstructuraComisiones = lazyRetry(() => import("./pages/admin/portal-alta-direccion/AltaDireccionEstructuraComisionesPage"));
const MedicionesPortales = lazyRetry(() => import("./pages/admin/portal-alta-direccion/MedicionesPortalesPage"));
const MedicionesMenus = lazyRetry(() => import("./pages/admin/portal-alta-direccion/MedicionesMenusPage"));
const MedicionesCtas = lazyRetry(() => import("./pages/admin/portal-alta-direccion/MedicionesCtasPage"));

// Portal Socio Bancario (copias independientes de Alta Dirección / Legal Flow + Avance de Obra)
const SocioBancarioHistoricoComercial = lazyRetry(() => import("./pages/admin/portal-socio-bancario/SocioBancarioHistoricoComercialPage"));
const SocioBancarioAnalisisCobranza = lazyRetry(() => import("./pages/admin/portal-socio-bancario/SocioBancarioAnalisisCobranzaPage"));
const SocioBancarioIngresosEgresos = lazyRetry(() => import("./pages/admin/portal-socio-bancario/SocioBancarioIngresosEgresosPage"));
const SocioBancarioForecastIngresos = lazyRetry(() => import("./pages/admin/portal-socio-bancario/SocioBancarioForecastIngresosPage"));
const SocioBancarioExpedientes = lazyRetry(() => import("./pages/admin/portal-socio-bancario/SocioBancarioExpedientesPage"));
const SocioBancarioAvanceObra = lazyRetry(() => import("./pages/admin/portal-socio-bancario/SocioBancarioAvanceObraPage"));

// Portal de Administración (módulo independiente, copia de Alta Dirección)
const AdminDashboard            = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionDashboard })));
const AdminCitas                = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionCitas })));
const AdminProspectos           = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionProspectos })));
const AdminPipeline             = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionPipeline })));
const AdminOffers              = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionOffers })));
const AdminCobranza             = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionCobranza })));
const AdminContratos            = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionContratos })));
const AdminFacturas             = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionFacturas })));
const AdminComisiones           = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionComisiones })));
const AdminRedComercial         = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionRedComercial })));
const AdminReportes             = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionReportes })));
const AdminAuditoria            = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionAuditoria })));
const AdminConfiguracion        = lazyRetry(() => import("./pages/admin/portal-administracion/index").then(m => ({ default: m.AdministracionConfiguracion })));
const AdminNotificaciones       = lazyRetry(() => import("./pages/admin/portal-administracion/AdministracionNotificacionesPage"));
const AdminBandejaValidaciones  = lazyRetry(() => import("./pages/admin/portal-administracion/AdministracionBandejaValidacionesPage"));
const AdminCicloVenta           = lazyRetry(() => import("./pages/admin/portal-administracion/AdministracionCicloVentaPage"));
const AdminFacturasPorCobrar    = lazyRetry(() => import("./pages/admin/portal-administracion/AdministracionFacturasPorCobrarPage"));
const AdminFacturasPorPagar     = lazyRetry(() => import("./pages/admin/portal-administracion/AdministracionFacturasPorPagarPage"));
const AdminComisionesExternas   = lazyRetry(() => import("./pages/admin/portal-administracion/AdministracionComisionesExternasPage"));
const AdminComisionesInternas   = lazyRetry(() => import("./pages/admin/portal-administracion/AdministracionComisionesInternasPage"));
const AdminBandejaEjecucion     = lazyRetry(() => import("./pages/admin/portal-administracion/PortalAdministracionBandejaEjecucionPage"));
const AdminPagosEjecutados      = lazyRetry(() => import("./pages/admin/portal-administracion/PortalAdministracionPagosEjecutadosPage"));
const AdminCFDIsEmitidos        = lazyRetry(() => import("./pages/admin/portal-administracion/PortalAdministracionCFDIsEmitidosPage"));
const AdminConciliacionSTP      = lazyRetry(() => import("./pages/admin/portal-administracion/PortalAdministracionConciliacionSTPPage"));

// Portal Condominio Administración
const CondominioDashboard    = lazyRetry(() => import("./pages/admin/portal-condominio/Dashboard"));
const CondominioDepartamentos = lazyRetry(() => import("./pages/admin/portal-condominio/Departamentos"));
const CondominioUnidadDetalle = lazyRetry(() => import("./pages/admin/portal-condominio/UnidadDetalle"));
const CondominioCargos        = lazyRetry(() => import("./pages/admin/portal-condominio/Cargos"));
const CondominioPagos         = lazyRetry(() => import("./pages/admin/portal-condominio/Pagos"));
const CondominioCobranza      = lazyRetry(() => import("./pages/admin/portal-condominio/Cobranza"));
const CondominioTesoreria     = lazyRetry(() => import("./pages/admin/portal-condominio/Tesoreria"));
const CondominioAmenidades    = lazyRetry(() => import("./pages/admin/portal-condominio/Amenidades"));
const CondominioAuditoria     = lazyRetry(() => import("./pages/admin/portal-condominio/Auditoria"));
const CondominioConfiguracion = lazyRetry(() => import("./pages/admin/portal-condominio/Configuracion"));
const CondominioTitularidad       = lazyRetry(() => import("./features/titularidad/BandejaTitularidad"));
const CondominioTitularidadDetalle = lazyRetry(() => import("./features/titularidad/DetalleTitularidad"));
const CondominioPresupuesto        = lazyRetry(() => import("./features/presupuesto/PresupuestoPage"));

// Portal Embajadores
const GestionEmbajadores       = lazyRetry(() => import("./pages/admin/embajadores/GestionEmbajadores"));
const EmbajadorInicio          = lazyRetry(() => import("./pages/admin/portal-embajador/index").then(m => ({ default: m.EmbajadorInicio })));
const EmbajadorMisReferidos    = lazyRetry(() => import("./pages/admin/portal-embajador/index").then(m => ({ default: m.EmbajadorMisReferidos })));
const EmbajadorRegistrarReferido = lazyRetry(() => import("./pages/admin/portal-embajador/index").then(m => ({ default: m.EmbajadorRegistrarReferido })));
const EmbajadorComisiones      = lazyRetry(() => import("./pages/admin/portal-embajador/index").then(m => ({ default: m.EmbajadorComisiones })));
const EmbajadorPerfil          = lazyRetry(() => import("./pages/admin/portal-embajador/index").then(m => ({ default: m.EmbajadorPerfil })));

// Portal Legal Flow
const LegalFlowDashboard       = lazyRetry(() => import("./pages/admin/legal-flow/LegalFlowDashboard"));
const LegalFlowRequests        = lazyRetry(() => import("./pages/admin/legal-flow/RequestsList"));
const LegalFlowNewRequest      = lazyRetry(() => import("./pages/admin/legal-flow/NewRequest"));
const LegalFlowCaseDetail      = lazyRetry(() => import("./pages/admin/legal-flow/CaseDetail"));
const LegalFlowTemplateCatalog = lazyRetry(() => import("./pages/admin/legal-flow/TemplateCatalog"));
const LegalFlowTemplateStudio  = lazyRetry(() => import("./pages/admin/legal-flow/TemplateStudio"));
const LegalFlowArchived        = lazyRetry(() => import("./pages/admin/legal-flow/ArchivedRequests"));
const LegalFlowNotifications   = lazyRetry(() => import("./pages/admin/legal-flow/Notifications"));
const LegalFlowSettings        = lazyRetry(() => import("./pages/admin/legal-flow/Settings"));
const LegalFlowEscExpedientes  = lazyRetry(() => import("./pages/admin/legal-flow/EscrituracionExpedientes"));

// Portal CRM Sozu
const CrmDashboard         = lazyRetry(() => import("./pages/admin/portal-crm/index").then(m => ({ default: m.CrmDashboard })));
const CrmAlertas           = lazyRetry(() => import("./pages/admin/portal-crm/index").then(m => ({ default: m.CrmAlertas })));
const CrmTrackingHealth    = lazyRetry(() => import("./pages/admin/portal-crm/index").then(m => ({ default: m.CrmTrackingHealth })));
const CrmConversionEvents  = lazyRetry(() => import("./pages/admin/portal-crm/index").then(m => ({ default: m.CrmConversionEvents })));
const CrmExecutiveDashboard    = lazyRetry(() => import("./pages/admin/portal-crm/executive").then(m => ({ default: m.CrmExecutiveDashboard })));
const CrmExecutiveDecisionQueue = lazyRetry(() => import("./pages/admin/portal-crm/executive").then(m => ({ default: m.CrmExecutiveDecisionQueue })));
const CrmExecutiveWeeklyDigest  = lazyRetry(() => import("./pages/admin/portal-crm/executive").then(m => ({ default: m.CrmExecutiveWeeklyDigest })));

// Portal CRM Sozu · módulo CRM
const CrmContacts          = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmContacts })));
const CrmContactDetail     = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmContactDetail })));
const CrmDeals             = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmDeals })));
const CrmAppointments      = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmAppointments })));
const CrmTasks             = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmTasks })));
const CrmSequences         = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmSequences })));
const CrmRouting           = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmRouting })));
const CrmAutomationRules   = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmAutomationRules })));
const CrmEscalations       = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmEscalations })));
const CrmLeadIntelligence  = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmLeadIntelligence })));
const CrmAgentPerformance  = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmAgentPerformance })));
const CrmSalesOperations   = lazyRetry(() => import("./pages/admin/portal-crm/crm").then(m => ({ default: m.CrmSalesOperations })));

// Portal CRM Sozu — Inteligencia de marketing
const CrmCampaigns              = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmCampaigns })));
const CrmAudiences              = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmAudiences })));
const CrmAttribution            = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmAttribution })));
const CrmCreatives              = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmCreatives })));
const CrmUtms                   = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmUtms })));
const CrmMarketingAbTests       = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmMarketingAbTests })));
const CrmLandingPages           = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmLandingPages })));
const CrmForms                  = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmForms })));
const CrmAdIntegrations         = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmAdIntegrations })));
const CrmBudget                 = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmBudget })));
const CrmMarketingPerformance   = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmMarketingPerformance })));
const CrmMetaAds                = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmMetaAds })));
const CrmGoogleAds              = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmGoogleAds })));
const CrmMarketingDevelopments  = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmMarketingDevelopments })));
const CrmMarketingFunnel        = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmMarketingFunnel })));
const CrmMarketingCampaignMapping = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmMarketingCampaignMapping })));
const CrmMarketingSyncJobs      = lazyRetry(() => import("./pages/admin/portal-crm/marketing").then(m => ({ default: m.CrmMarketingSyncJobs })));

// Portal CRM Sozu — Inteligencia de ingresos
const CrmExecutiveKpis     = lazyRetry(() => import("./pages/admin/portal-crm/revenue").then(m => ({ default: m.CrmExecutiveKpis })));
const CrmForecast          = lazyRetry(() => import("./pages/admin/portal-crm/revenue").then(m => ({ default: m.CrmForecast })));
const CrmPipelineReview    = lazyRetry(() => import("./pages/admin/portal-crm/revenue").then(m => ({ default: m.CrmPipelineReview })));
const CrmRevenueOps        = lazyRetry(() => import("./pages/admin/portal-crm/revenue").then(m => ({ default: m.CrmRevenueOps })));
const CrmCohorts           = lazyRetry(() => import("./pages/admin/portal-crm/revenue").then(m => ({ default: m.CrmCohorts })));
const CrmChurn             = lazyRetry(() => import("./pages/admin/portal-crm/revenue").then(m => ({ default: m.CrmChurn })));
const CrmReporting         = lazyRetry(() => import("./pages/admin/portal-crm/revenue").then(m => ({ default: m.CrmReporting })));
const CrmRevenueAttribution = lazyRetry(() => import("./pages/admin/portal-crm/revenue").then(m => ({ default: m.CrmRevenueAttribution })));
const CrmRevenueVelocity   = lazyRetry(() => import("./pages/admin/portal-crm/revenue").then(m => ({ default: m.CrmRevenueVelocity })));
const CrmRevenueGoals      = lazyRetry(() => import("./pages/admin/portal-crm/revenue").then(m => ({ default: m.CrmRevenueGoals })));

// Portal CRM Sozu — Operación
const CrmUnifiedInbox          = lazyRetry(() => import("./pages/admin/portal-crm/operations").then(m => ({ default: m.CrmUnifiedInbox })));
const CrmQueues                = lazyRetry(() => import("./pages/admin/portal-crm/operations").then(m => ({ default: m.CrmQueues })));
const CrmSlaMonitor            = lazyRetry(() => import("./pages/admin/portal-crm/operations").then(m => ({ default: m.CrmSlaMonitor })));
const CrmCampaignBuilder       = lazyRetry(() => import("./pages/admin/portal-crm/operations").then(m => ({ default: m.CrmCampaignBuilder })));
const CrmAiCopilot             = lazyRetry(() => import("./pages/admin/portal-crm/operations").then(m => ({ default: m.CrmAiCopilot })));
const CrmOperationsDevelopments = lazyRetry(() => import("./pages/admin/portal-crm/operations").then(m => ({ default: m.CrmOperationsDevelopments })));

// Portal CRM Sozu — Configuración
const CrmSettingsUsers                = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsUsers })));
const CrmSettingsRoles                = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsRoles })));
const CrmSettingsPipelineStages       = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsPipelineStages })));
const CrmSettingsCustomFields         = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsCustomFields })));
const CrmSettingsWebhooks             = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsWebhooks })));
const CrmSettingsGoogleCallback       = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsGoogleCallback })));
const CrmSettingsMetaCallback         = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsMetaCallback })));
const CrmSettingsAuditLog             = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsAuditLog })));
const CrmSettingsConnections          = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsConnections })));
const CrmSettingsDeploymentReadiness  = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsDeploymentReadiness })));
const CrmSettingsApiLogs              = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsApiLogs })));
const CrmSettingsIntegrationChecklist = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsIntegrationChecklist })));
const CrmSettingsOrganization         = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsOrganization })));
const CrmSettingsDevelopments         = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsDevelopments })));
const CrmSettingsPipelines            = lazyRetry(() => import("./pages/admin/portal-crm/settings").then(m => ({ default: m.CrmSettingsPipelines })));

// Portal Bancos
const BancosBandeja  = lazyRetry(() => import("./pages/admin/portal-bancos/index").then(m => ({ default: m.BancosBandeja })));
const BancosPipeline = lazyRetry(() => import("./pages/admin/portal-bancos/index").then(m => ({ default: m.BancosPipeline })));
const BancosTablero  = lazyRetry(() => import("./pages/admin/portal-bancos/index").then(m => ({ default: m.BancosTablero })));
const BancosEquipo   = lazyRetry(() => import("./pages/admin/portal-bancos/index").then(m => ({ default: m.BancosEquipo })));
const BancosBancos   = lazyRetry(() => import("./pages/admin/portal-bancos/index").then(m => ({ default: m.BancosBancos })));

const Registro = lazyRetry(() => import("./pages/public/Registro"));
const RegistroInmobiliaria = lazyRetry(() => import("./pages/public/RegistroInmobiliaria"));
const RegistroEmbajador = lazyRetry(() => import("./pages/public/RegistroEmbajador"));
const AgentesLanding = lazyRetry(() => import("./pages/public/AgentesLanding"));
const OfferPage = lazyRetry(() => import("./pages/public/OfferPage"));
const CapturaDatosPage = lazyRetry(() => import("./pages/public/CapturaDatosPage"));
const VerificarEmailPage = lazyRetry(() => import("./pages/public/VerificarEmailPage"));
const VerificacionCallbackPage = lazyRetry(() => import("./pages/public/VerificacionCallbackPage"));
const TipoCompradorPage = lazyRetry(() => import("./pages/public/TipoCompradorPage"));
const HoldTarjetaPage = lazyRetry(() => import("./pages/public/HoldTarjetaPage"));
const ConfirmacionPage = lazyRetry(() => import("./pages/public/ConfirmacionPage"));

// ── Oferta: nuevas páginas del flujo completo ──────────────────────────────
const ApartadoProvisionalDashboardPage = lazyRetry(() => import("./pages/public/ApartadoProvisionalDashboardPage"));
const ApartadoProvisionalActivadoPage  = lazyRetry(() => import("./pages/public/ApartadoProvisionalActivadoPage"));
const ApartadoLiberadoPage             = lazyRetry(() => import("./pages/public/ApartadoLiberadoPage"));
const CompletarApartadoPage            = lazyRetry(() => import("./pages/public/CompletarApartadoPage"));
const PagoApartadoFinalPage            = lazyRetry(() => import("./pages/public/PagoApartadoFinalPage"));
const FormalReservationSuccessPage     = lazyRetry(() => import("./pages/public/FormalReservationSuccessPage"));
const ApartarDirectoCapturePage        = lazyRetry(() => import("./pages/public/ApartarDirectoCapturePage"));
const ApartarDirectoContinuarPage      = lazyRetry(() => import("./pages/public/ApartarDirectoContinuarPage"));
const ReservarPage                     = lazyRetry(() => import("./pages/public/ReservarPage"));
const EmailVerificationOfferPage      = lazyRetry(() => import("./pages/public/EmailVerificationPage"));
const VerificationCallbackOfferPage   = lazyRetry(() => import("./pages/public/VerificationCallbackPageOffers"));
const CapturaDatosReservaPage         = lazyRetry(() => import("./pages/public/CapturaDatosReservaPage"));
const HoldApartadoPage                = lazyRetry(() => import("./pages/public/HoldApartadoPage"));
const ConfirmacionApartadoPage        = lazyRetry(() => import("./pages/public/ConfirmacionApartadoPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000, // 5 minutos
      retry: 1,
    },
  },
});

const hostname = window.location.hostname;
// Match both production (portal.sozu.com) and dev (portal-dev.sozu.com) subdomains
const matchPortal = (portal: string) =>
  hostname === `${portal}.sozu.com` || hostname === `${portal}-dev.sozu.com`;
const isRegistroSubdomain = matchPortal('registro');
const isInmobiliariasSubdomain = matchPortal('inmobiliarias');
const isAgentesSubdomain = matchPortal('agentes');
const isClientesSubdomain = matchPortal('clientes');
const isEmbajadoresSubdomain = matchPortal('embajadores');
const isCrmSubdomain = matchPortal('crm');

// Determine portal context from subdomain for login page branding
const getPortalContext = (): 'agentes' | 'inmobiliarias' | 'clientes' | 'embajadores' | null => {
  if (isAgentesSubdomain) return 'agentes';
  if (isInmobiliariasSubdomain) return 'inmobiliarias';
  if (isClientesSubdomain) return 'clientes';
  if (isEmbajadoresSubdomain) return 'embajadores';
  return null;
};
const portalContext = getPortalContext();

// Solo el panel admin principal soporta dark/light/system. Cualquier sub-portal
// (/admin/portal-*, /admin/agent, /admin/legal-flow) y todo lo público se fuerza
// a tema claro siempre, sin importar el sistema ni la preferencia guardada.
const SPECIALIZED_PORTAL_RE = /^\/admin\/(portal-|agent|legal-flow)/;

const ThemedShell = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const isAdminPanel = pathname.startsWith("/admin") && !SPECIALIZED_PORTAL_RE.test(pathname);
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      forcedTheme={isAdminPanel ? undefined : "light"}
      disableTransitionOnChange={false}
    >
      {children}
    </ThemeProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemedShell>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" />
          <DevelopmentBanner />
          <AuthProvider>
            <AgentImpersonationProvider>
            <ClienteImpersonationProvider>
            <InmobiliariaImpersonationProvider>
            <CobranzaImpersonationProvider>
            <EmbajadorImpersonationProvider>
            <CrmImpersonationProvider>
           <AmbassadorsProvider>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              {isAgentesSubdomain ? (
                <Routes>
                  <Route path="/login" element={<Login portalContext="agentes" />} />
                  <Route path="/auth/login" element={<Login portalContext="agentes" />} />
                  <Route path="/registro" element={<Registro />} />
                  <Route path="/auth/change-password" element={<ChangePassword />} />
                  <Route path="/auth/confirmacion-email" element={<ConfirmacionEmail />} />
                  <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                  <Route path="/admin/*" element={
                    <ProtectedRoute>
                      <PermissionRoute>
                        <AdminLayout />
                      </PermissionRoute>
                    </ProtectedRoute>
                  }>
                    <Route index element={<Navigate to="/admin/agent/inicio" replace />} />
                    <Route path="agent/inicio" element={<AgentInicio />} />
                    <Route path="agent/inventario" element={<AgentInventario />} />
                    <Route path="agent/pipeline" element={<AgentPipeline />} />
                    <Route path="agent/comisiones" element={<AgentComisiones />} />
                    <Route path="agent/prospectos" element={<AgentProspectos />} />
                    <Route path="agent/prospectos/:id" element={<AgentProspectoDetalle />} />
                    <Route path="agent/perfil" element={<AgentPerfil />} />
                    <Route path="agent/inventario/unidades" element={<AgentUnidadesProyecto />} />
                    <Route path="agent/proyecto/:id" element={<AgentProyectoDetalle />} />
                    <Route path="agent/inventario/proyecto/:id" element={<AgentProyectoDetalle />} />
                    <Route path="*" element={<Navigate to="/admin/agent/inicio" replace />} />
                  </Route>
                  <Route path="/" element={<AgentesLanding />} />
                  <Route path="*" element={<AgentesLanding />} />
                </Routes>
              ) : isInmobiliariasSubdomain ? (
                <Routes>
                  <Route path="/registro" element={<RegistroInmobiliaria />} />
                  <Route path="/login" element={<Login portalContext="inmobiliarias" />} />
                  <Route path="/auth/login" element={<Login portalContext="inmobiliarias" />} />
                  <Route path="/auth/change-password" element={<ChangePassword />} />
                  <Route path="/auth/confirmacion-email" element={<ConfirmacionEmail />} />
                  <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/admin" element={
                    <ProtectedRoute>
                      <PermissionRoute>
                        <AdminLayout />
                      </PermissionRoute>
                    </ProtectedRoute>
                  }>
                    <Route index element={<Navigate to="/admin/portal-inmobiliaria/dashboard" replace />} />
                    <Route path="portal-inmobiliaria/dashboard" element={<InmobDashboard />} />
                    <Route path="portal-inmobiliaria/agentes" element={<InmobAgentes />} />
                    <Route path="portal-inmobiliaria/agentes/:email" element={<InmobAgentProfile />} />
                    <Route path="portal-inmobiliaria/pipeline" element={<InmobPipeline />} />
                    <Route path="portal-inmobiliaria/prospectos" element={<InmobProspectos />} />
                    <Route path="portal-inmobiliaria/citas" element={<InmobCitas />} />
                    <Route path="portal-inmobiliaria/comisiones" element={<InmobComisiones />} />
                    <Route path="portal-inmobiliaria/reportes" element={<InmobReportes />} />
                    <Route path="portal-inmobiliaria/configuracion" element={<InmobConfiguracion />} />
                    <Route path="*" element={<Navigate to="/admin/portal-inmobiliaria/dashboard" replace />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              ) : isEmbajadoresSubdomain ? (
                <Routes>
                  <Route path="/registro" element={<RegistroEmbajador />} />
                  <Route path="/login" element={<Login portalContext="embajadores" />} />
                  <Route path="/auth/login" element={<Login portalContext="embajadores" />} />
                  <Route path="/auth/change-password" element={<ChangePassword />} />
                  <Route path="/auth/confirmacion-email" element={<ConfirmacionEmail />} />
                  <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/admin" element={
                    <ProtectedRoute>
                      <PermissionRoute>
                        <AdminLayout />
                      </PermissionRoute>
                    </ProtectedRoute>
                  }>
                    <Route index element={<Navigate to="/admin/portal-embajador/inicio" replace />} />
                    <Route path="portal-embajador/inicio" element={<EmbajadorInicio />} />
                    <Route path="portal-embajador/mis-referidos" element={<EmbajadorMisReferidos />} />
                    <Route path="portal-embajador/registrar-referido" element={<EmbajadorRegistrarReferido />} />
                    <Route path="portal-embajador/comisiones" element={<EmbajadorComisiones />} />
                    <Route path="portal-embajador/perfil" element={<EmbajadorPerfil />} />
                    <Route path="*" element={<Navigate to="/admin/portal-embajador/inicio" replace />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              ) : isClientesSubdomain ? (
                <Routes>
                  <Route path="/login" element={<Login portalContext="clientes" />} />
                  <Route path="/auth/login" element={<Login portalContext="clientes" />} />
                  <Route path="/auth/change-password" element={<ChangePassword />} />
                  <Route path="/auth/confirmacion-email" element={<ConfirmacionEmail />} />
                  <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                  <Route path="/oferta/:offerId" element={<OfferPage />} />
                  <Route path="/oferta/:offerId/:reservationId" element={<OfferPage />} />
                  <Route path="/oferta/:offerId/datos" element={<CapturaDatosPage />} />
                  <Route path="/oferta/:offerId/verificar-email" element={<VerificarEmailPage />} />
                  <Route path="/oferta/:offerId/verificacion-ok" element={<VerificacionCallbackPage />} />
                  <Route path="/oferta/:offerId/tipo-comprador" element={<TipoCompradorPage />} />
                  <Route path="/oferta/:offerId/hold" element={<HoldTarjetaPage />} />
                  <Route path="/oferta/:offerId/confirmacion" element={<ConfirmacionPage />} />
                  {/* Nuevas páginas flujo oferta completo */}
                  <Route path="/reservar/:offerToken/datos" element={<ApartarDirectoCapturePage />} />
                  <Route path="/reservar/:offerToken/continuar" element={<ApartarDirectoContinuarPage />} />
                  <Route path="/reservar/:formalReservationId/provisional-activado" element={<ApartadoProvisionalActivadoPage />} />
                  <Route path="/apartado-provisional/:formalReservationId" element={<ApartadoProvisionalDashboardPage />} />
                  <Route path="/apartado-liberado/:formalReservationId" element={<ApartadoLiberadoPage />} />
                  <Route path="/apartar/:formalReservationId/completar" element={<CompletarApartadoPage />} />
                  <Route path="/apartar/:formalReservationId/pago-final" element={<PagoApartadoFinalPage />} />
                  <Route path="/apartar/:formalReservationId/exito" element={<FormalReservationSuccessPage />} />
                  {/* Verificación email del flujo oferta */}
                  <Route path="/verificar-email/:prospectId" element={<EmailVerificationOfferPage />} />
                  <Route path="/verificar/:prospectId" element={<VerificationCallbackOfferPage />} />
                  <Route path="/verificacion/:prospectId" element={<VerificationCallbackOfferPage />} />
                  {/* Wizard de reserva */}
                  <Route path="/reservar/:formalReservationId/wizard" element={<ReservarPage />} />
                  {/* Apartado provisional (DB-backed) */}
                  <Route path="/reservar/:apartadoId" element={<CapturaDatosReservaPage />} />
                  <Route path="/reservar/:apartadoId/hold" element={<HoldApartadoPage />} />
                  <Route path="/reservar/:apartadoId/confirmacion" element={<ConfirmacionApartadoPage />} />
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/admin" element={
                    <ProtectedRoute>
                      <PermissionRoute>
                        <AdminLayout />
                      </PermissionRoute>
                    </ProtectedRoute>
                  }>
                    <Route index element={<Navigate to="/admin/portal-cliente/inicio" replace />} />
                    <Route path="portal-cliente/inicio" element={<ClienteInicio />} />
                    <Route path="portal-cliente/historial-pagos" element={<ClienteHistorialPagos />} />
                    <Route path="portal-cliente/pagos" element={<ClienteHistorialPagos />} />
                    <Route path="portal-cliente/estado-de-cuenta" element={<ClienteEstadoCuenta />} />
                    <Route path="portal-cliente/propiedades" element={<ClientePropiedades />} />
                    <Route path="portal-cliente/en-adquisicion" element={<ClienteEnAdquisicion />} />
                    <Route path="portal-cliente/en-adquisicion/propiedad/:cuentaId" element={<ClientePropiedadDetalle />} />
                    <Route path="portal-cliente/patrimonio" element={<ClientePatrimonio />} />
                    <Route path="portal-cliente/patrimonio/propiedad/:cuentaId" element={<ClientePropiedadDetalle />} />
                    <Route path="portal-cliente/propiedad/:cuentaId" element={<ClientePropiedadDetalle />} />
                    <Route path="portal-cliente/propiedad/:cuentaId/detalles-tecnicos" element={<ClienteDetallesTecnicos />} />
                    <Route path="portal-cliente/perfil" element={<ClientePerfil />} />
                    <Route path="portal-cliente/mantenimiento-pago/:cuentaId" element={<ClienteMantenimientoPago />} />
                    <Route path="portal-cliente/propiedad-pago/:cuentaId" element={<ClientePropiedadPago />} />
                    <Route path="portal-cliente/productos" element={<ClienteProductos />} />
                    <Route path="portal-cliente/documentos" element={<ClienteDocumentos />} />
                    <Route path="portal-cliente/notificaciones" element={<ClienteNotificaciones />} />
                    <Route path="*" element={<Navigate to="/admin/portal-cliente/inicio" replace />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              ) : (
              <Routes>
                <Route path="/" element={isRegistroSubdomain ? <Registro /> : <Navigate to="/admin" replace />} />
                <Route path="/welcome" element={<Index />} />
                
                {/* Auth Routes */}
                <Route path="/auth/login" element={<Login portalContext={portalContext} />} />
                <Route path="/auth/change-password" element={<ChangePassword />} />
                <Route path="/auth/confirmacion-email" element={<ConfirmacionEmail />} />
                <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                
                {/* Public Routes */}
                <Route path="/registro" element={<Registro />} />
                <Route path="/registro-inmobiliaria" element={<RegistroInmobiliaria />} />
                <Route path="/agentes" element={<AgentesLanding />} />
                <Route path="/app-notaria/login" element={<AppNotariaLogin />} />
                <Route path="/oferta/:offerId" element={<OfferPage />} />
                <Route path="/oferta/:offerId/:reservationId" element={<OfferPage />} />
                <Route path="/oferta/:offerId/datos" element={<CapturaDatosPage />} />
                <Route path="/oferta/:offerId/verificar-email" element={<VerificarEmailPage />} />
                <Route path="/oferta/:offerId/verificacion-ok" element={<VerificacionCallbackPage />} />
                <Route path="/oferta/:offerId/tipo-comprador" element={<TipoCompradorPage />} />
                <Route path="/oferta/:offerId/hold" element={<HoldTarjetaPage />} />
                <Route path="/oferta/:offerId/confirmacion" element={<ConfirmacionPage />} />
                {/* Flujo oferta completo */}
                <Route path="/reservar/:offerToken/datos" element={<ApartarDirectoCapturePage />} />
                <Route path="/reservar/:offerToken/continuar" element={<ApartarDirectoContinuarPage />} />
                <Route path="/reservar/:formalReservationId/provisional-activado" element={<ApartadoProvisionalActivadoPage />} />
                <Route path="/apartado-provisional/:formalReservationId" element={<ApartadoProvisionalDashboardPage />} />
                <Route path="/apartado-liberado/:formalReservationId" element={<ApartadoLiberadoPage />} />
                <Route path="/apartar/:formalReservationId/completar" element={<CompletarApartadoPage />} />
                <Route path="/apartar/:formalReservationId/pago-final" element={<PagoApartadoFinalPage />} />
                <Route path="/apartar/:formalReservationId/exito" element={<FormalReservationSuccessPage />} />
                <Route path="/verificar-email/:prospectId" element={<EmailVerificationOfferPage />} />
                <Route path="/verificar/:prospectId" element={<VerificationCallbackOfferPage />} />
                <Route path="/verificacion/:prospectId" element={<VerificationCallbackOfferPage />} />
                <Route path="/reservar/:formalReservationId/wizard" element={<ReservarPage />} />
                {/* Apartado provisional (DB-backed) */}
                <Route path="/reservar/:apartadoId" element={<CapturaDatosReservaPage />} />
                <Route path="/reservar/:apartadoId/hold" element={<HoldApartadoPage />} />
                <Route path="/reservar/:apartadoId/confirmacion" element={<ConfirmacionApartadoPage />} />

                {/* Admin Routes - Protected by Auth and Permissions */}
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <PermissionRoute>
                      <AdminLayout />
                    </PermissionRoute>
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="access-denied" element={<AccessDenied />} />
                  <Route path="proyectos" element={<Proyectos />} />
                  <Route path="propiedades" element={<Propiedades />} />
                  <Route path="activos-comerciales" element={<ActivosComerciales />} />
                  <Route path="activos-comerciales/nuevo" element={<ActivosComercialesNuevo />} />
                 <Route path="activos-comerciales/:id/editar" element={<ActivosComercialesNuevo />} />
                <Route path="activos-comerciales/:id" element={<ActivosComercialesDetalle />} />
                  <Route path="usuarios" element={<Usuarios />} />
                  <Route path="usuarios/nuevo" element={<NuevoUsuario />} />
                  <Route path="usuarios-directivos" element={<UsuariosDirectivos />} />
                  <Route path="usuarios-clientes" element={<UsuariosClientes />} />
                  <Route path="roles-permisos" element={<RolesPermisos />} />
                  <Route path="entidades-legales" element={<EntidadesLegales />} />
                  <Route path="desarrolladores" element={<Desarrolladores />} />
                  <Route path="inmobiliarias" element={<Inmobiliarias />} />
                  <Route path="administradoras" element={<Administradoras />} />
                  <Route path="notarias" element={<Notarias />} />
                  <Route path="bancos" element={<Bancos />} />
                  <Route path="cuentas-sozu" element={<CuentasSozu />} />
                  <Route path="prospectos" element={<Prospectos />} />
                  <Route path="compradores" element={<Compradores />} />
                  <Route path="vendedores" element={<Vendedores />} />
                  <Route path="duenos" element={<Duenos />} />
                  <Route path="residentes" element={<Residentes />} />
                  <Route path="agentes" element={<Agentes />} />
                  <Route path="administradores-personas" element={<AdministradoresPersonas />} />
                  <Route path="representantes-legales" element={<RepresentantesLegales />} />
                  <Route path="representantes-comerciales" element={<RepresentantesComerciales />} />
                  <Route path="productos" element={<Productos />} />
                  <Route path="servicios" element={<Servicios />} />
                  <Route path="categorias-productos" element={<CategoriasProductos />} />
                  <Route path="amenidades" element={<ComingSoon title="Amenidades" />} />
                  <Route path="caracteristicas" element={<ComingSoon title="Características" />} />
                  <Route path="modelos" element={<Modelos />} />
                  <Route path="vistas" element={<Vistas />} />
                  <Route path="estacionamientos" element={<Estacionamientos />} />
                  <Route path="bodegas" element={<Bodegas />} />
                  <Route path="cuentas-cobranza" element={<Pagos />} />
                  <Route path="cuentas-mantenimiento" element={<CuentasMantenimiento />} />
                  <Route path="cuentas-mantenimiento/:id/detalle" element={<DetalleCuentaMantenimiento />} />
                  <Route path="cuentas-cobranza/:id/detalle" element={<DetalleCuentaCobranza />} />
                  <Route path="comisiones" element={<Comisiones />} />
                  <Route path="aprobacion-comisiones" element={<AprobacionComisiones />} />
                  <Route path="comisiones-externas" element={<ComisionesExternas />} />
                  <Route path="pagar-comisiones" element={<PagarComisiones />} />
                  <Route path="pago-proveedores" element={<PagoProveedores />} />
                  <Route path="pagos" element={<ComingSoon title="Pagos" />} />
                  <Route path="cuentas-bancarias" element={<ComingSoon title="Cuentas Bancarias" />} />
                  <Route path="documentos" element={<ComingSoon title="Documentos" />} />
                  <Route path="notarios/revision-documentacion" element={<RevisionDocumentacion />} />
                  <Route path="consultas-ia" element={<ConsultasIA />} />
                  <Route path="reservas" element={<Reservas />} />
                  <Route path="legal/contratos" element={<Contratos />} />
                  <Route path="legal/carta-acuerdos" element={<CartaAcuerdos />} />
                  <Route path="reportes/discrepancias" element={<ReporteDiscrepancias />} />
                  <Route path="logs-actividad" element={<LogsActividad />} />
                  <Route path="rastreo-clabes-stp" element={<RastreoClabeSTP />} />
                  <Route path="rastreo-pagos-stp" element={<RastreoPagosSTP />} />
                  <Route path="configuracion-reportes" element={<ConfiguracionReportes />} />
                 <Route path="version-produccion" element={<VersionProduccion />} />
                  <Route path="reportes/inventarios" element={<ReportesInventarios />} />
                  <Route path="reportes/finanzas" element={<ReportesFinanzas />} />
                  <Route path="validacion-contratos" element={<ValidacionContratosPDF />} />
                  <Route path="validacion-pagos" element={<ValidacionPagos />} />
                  <Route path="estados-cuenta" element={<EstadosCuenta />} />
                  <Route path="informacion-financiera" element={<InformacionFinanciera />} />
                  <Route path="reportes/ver/:id" element={<ReporteViewer />} />
                  <Route element={<InmobiliariasThemeWrapper />}>
                    <Route path="inmobiliarias/mi-informacion" element={<MiInformacion />} />
                    <Route path="inmobiliarias/mis-agentes" element={<MisAgentes />} />
                    <Route path="inmobiliarias/mis-propiedades" element={<Navigate to="/admin/inmobiliarias/inventario" replace />} />
                    <Route path="inmobiliarias/mis-ventas" element={<MisVentas />} />
                    <Route path="inmobiliarias/proyectos" element={<MisProyectos />} />
                    <Route path="inmobiliarias/proyectos/:id" element={<MiProyectoDetalle />} />
                    <Route path="inmobiliarias/proyectos/:id/inventario" element={<MiProyectoInventario />} />
                    <Route path="inmobiliarias/mis-proyectos" element={<Navigate to="/admin/inmobiliarias/proyectos" replace />} />
                    <Route path="inmobiliarias/mis-proyectos/:id" element={<Navigate to="/admin/inmobiliarias/proyectos" replace />} />
                    <Route path="inmobiliarias/inventario" element={<InventarioGlobal />} />
                  </Route>
                  <Route path="administrar-menus" element={<AdministrarMenus />} />
                  <Route path="comunicacion/administrar-avisos" element={<AdministrarAvisos />} />
                  <Route path="comunicacion/enviar-avisos" element={<EnviarAvisos />} />
                  <Route path="comunicacion/ejecuciones" element={<EjecucionesAvisos />} />
                  <Route path="comunicacion/configuracion-citas" element={<ConfiguracionCitas />} />
                  <Route path="comunicacion/todas-las-citas" element={<TodasLasCitas />} />
                  <Route path="crm/workflow-offers" element={<WorkflowOffers />} />
                  <Route path="crm/dashboard-ejecutivo" element={<DashboardEjecutivo />} />
                  <Route path="mediciones-cta" element={<MedicionesCTA />} />
                  <Route path="ab-tests" element={<ABTests />} />
                  <Route path="notificaciones-config" element={<NotificacionesConfig />} />
                  <Route path="notificaciones-log" element={<NotificacionesLog />} />
                  {/* Portal Inmobiliaria Routes */}
                  <Route path="portal-inmobiliaria/dashboard" element={<InmobDashboard />} />
                  <Route path="portal-inmobiliaria/agentes" element={<InmobAgentes />} />
                  <Route path="portal-inmobiliaria/agentes/:email" element={<InmobAgentProfile />} />
                  <Route path="portal-inmobiliaria/pipeline" element={<InmobPipeline />} />
                  <Route path="portal-inmobiliaria/prospectos" element={<InmobProspectos />} />
                  <Route path="portal-inmobiliaria/citas" element={<InmobCitas />} />
                  <Route path="portal-inmobiliaria/comisiones" element={<InmobComisiones />} />
                  <Route path="portal-inmobiliaria/reportes" element={<InmobReportes />} />
                  <Route path="portal-inmobiliaria/configuracion" element={<InmobConfiguracion />} />
                  {/* Agent Portal Routes */}
                  <Route path="agent/inicio" element={<AgentInicio />} />
                  <Route path="agent/inventario" element={<AgentInventario />} />
                  <Route path="agent/pipeline" element={<AgentPipeline />} />
                  <Route path="agent/comisiones" element={<AgentComisiones />} />
                  <Route path="agent/prospectos" element={<AgentProspectos />} />
                  <Route path="agent/prospectos/:id" element={<AgentProspectoDetalle />} />
                  <Route path="agent/perfil" element={<AgentPerfil />} />
                  <Route path="agent/inventario/unidades" element={<AgentUnidadesProyecto />} />
                  <Route path="agent/proyecto/:id" element={<AgentProyectoDetalle />} />
                  <Route path="agent/inventario/proyecto/:id" element={<AgentProyectoDetalle />} />
                  {/* Portal Cliente Routes */}
                  <Route path="portal-cliente/inicio" element={<ClienteInicio />} />
                  <Route path="portal-cliente/historial-pagos" element={<ClienteHistorialPagos />} />
                  <Route path="portal-cliente/pagos" element={<ClienteHistorialPagos />} />
                  <Route path="portal-cliente/estado-de-cuenta" element={<ClienteEstadoCuenta />} />
                  <Route path="portal-cliente/propiedades" element={<ClientePropiedades />} />
                  <Route path="portal-cliente/en-adquisicion" element={<ClienteEnAdquisicion />} />
                  <Route path="portal-cliente/en-adquisicion/propiedad/:cuentaId" element={<ClientePropiedadDetalle />} />
                  <Route path="portal-cliente/patrimonio" element={<ClientePatrimonio />} />
                  <Route path="portal-cliente/patrimonio/propiedad/:cuentaId" element={<ClientePropiedadDetalle />} />
                  <Route path="portal-cliente/propiedad/:cuentaId" element={<ClientePropiedadDetalle />} />
                  <Route path="portal-cliente/propiedad/:cuentaId/detalles-tecnicos" element={<ClienteDetallesTecnicos />} />
                  <Route path="portal-cliente/perfil" element={<ClientePerfil />} />
                  <Route path="portal-cliente/mantenimiento-pago/:cuentaId" element={<ClienteMantenimientoPago />} />
                  <Route path="portal-cliente/propiedad-pago/:cuentaId" element={<ClientePropiedadPago />} />
                  <Route path="portal-cliente/productos" element={<ClienteProductos />} />
                  <Route path="portal-cliente/documentos" element={<ClienteDocumentos />} />
                  <Route path="portal-cliente/notificaciones" element={<ClienteNotificaciones />} />
                  {/* Portal Cobranza Routes */}
                  <Route path="portal-cobranza/inmuebles" element={<CollectionDashboard />} />
                  <Route path="portal-cobranza/cuentas-cobranza" element={<CollectionInbox />} />
                  <Route path="portal-cobranza/atencion-clientes" element={<CobranzaAtencion />} />
                  <Route path="portal-cobranza/relacion-pagos" element={<CollectionPayments />} />
                  <Route path="portal-cobranza/complementos" element={<CollectionProductsMaintenance />} />
                  {/* CEPs Pendientes fusionado en Relación de Pagos → redirige con filtro Sin CEP */}
                  <Route path="portal-cobranza/ceps-pendientes" element={<Navigate to="/admin/portal-cobranza/relacion-pagos?cep=sin" replace />} />
                  <Route path="portal-cobranza/conciliaciones" element={<CobranzaConciliaciones />} />
                  <Route path="portal-cobranza/promesas-pago" element={<CobranzaPromesas />} />
                  <Route path="portal-cobranza/comunicacion/avisos" element={<CobranzaAdminAvisos />} />
                  <Route path="portal-cobranza/comunicacion/enviar" element={<CobranzaEnviarAvisos />} />
                  <Route path="portal-cobranza/comunicacion/ejecuciones" element={<CobranzaEjecuciones />} />
                  <Route path="portal-cobranza/comunicacion/plantillas" element={<CobranzaPlantillas />} />
                  <Route path="portal-cobranza/reportes" element={<CobranzaReportes />} />
                  <Route path="portal-cobranza/reportes/ver/:id" element={<ReporteViewer />} />
                  <Route path="portal-cobranza/cuentas-cobranza/:id/detalle" element={<CobranzaCuentaDetalle />} />
                  {/* Portal Estructura de Comisiones */}
                  <Route path="portal-estructura-comisiones" element={<Navigate to="/admin/portal-estructura-comisiones/projects" replace />} />
                  <Route path="portal-estructura-comisiones/dashboard" element={<Navigate to="/admin/portal-estructura-comisiones/projects" replace />} />
                  <Route path="portal-estructura-comisiones/dashboard" element={<PECDashboard />} />
                  <Route path="portal-estructura-comisiones/executive" element={<PECExecutiveDashboard onTabChange={() => {}} />} />
                  <Route path="portal-estructura-comisiones/projects" element={<PECProjects />} />
                  <Route path="portal-estructura-comisiones/channels" element={<PECChannels />} />
                  <Route path="portal-estructura-comisiones/org-chart" element={<PECOrgChart />} />
                  <Route path="portal-estructura-comisiones/structure" element={<PECStructure />} />
                  <Route path="portal-estructura-comisiones/directorio" element={<PECDirectorio />} />
                  <Route path="portal-estructura-comisiones/commissions" element={<PECCommissions />} />
                  <Route path="portal-estructura-comisiones/payment-policies" element={<PECPaymentPolicies />} />
                  <Route path="portal-estructura-comisiones/unit-commission" element={<PECUnitCommission />} />
                  <Route path="portal-estructura-comisiones/broker-incentives" element={<PECBrokerIncentives />} />
                  <Route path="portal-estructura-comisiones/scenarios" element={<PECScenarios />} />
                  <Route path="portal-estructura-comisiones/comm-simulator" element={<PECCommSimulator />} />
                  <Route path="portal-estructura-comisiones/dist-simulator" element={<PECDistSimulator />} />
                  <Route path="portal-estructura-comisiones/broker-calc" element={<PECBrokerCalc />} />
                  <Route path="portal-estructura-comisiones/broker-calculator" element={<PECBrokerCalculator />} />
                  <Route path="portal-estructura-comisiones/financial-simulator" element={<PECFinancialSimulator />} />
                  <Route path="portal-estructura-comisiones/monthly-flow" element={<PECMonthlyFlow />} />
                  <Route path="portal-estructura-comisiones/results" element={<PECResults />} />
                  <Route path="portal-estructura-comisiones/compensation" element={<PECCompensation />} />
                  <Route path="portal-estructura-comisiones/competitividad" element={<PECCompetitividad />} />
                  <Route path="portal-estructura-comisiones/benchmark" element={<PECBenchmark />} />
                  <Route path="portal-estructura-comisiones/competitors-benchmark" element={<PECCompetitorsBenchmark />} />
                  <Route path="portal-estructura-comisiones/inventory-advanced" element={<PECInventoryAdvanced />} />
                  <Route path="portal-estructura-comisiones/agent-portal" element={<PECAgentPortal />} />
                  <Route path="portal-estructura-comisiones/ambassadors-admin" element={<PECAmbassadorsAdmin />} />
                  <Route path="portal-estructura-comisiones/ambassadors-portal" element={<PECAmbassadorsPortal />} />
                  {/* Portal de Productos */}
                  <Route path="portal-productos" element={<Navigate to="/admin/portal-productos/resumen" replace />} />
                  <Route path="portal-productos/resumen" element={<PPResumenPage />} />
                  <Route path="portal-productos/cartera" element={<PPCarteraPage />} />
                  <Route path="portal-productos/cartera/:cuentaId" element={<PPDetalleCuentaPage />} />
                  <Route path="portal-productos/analisis" element={<PPAnalisisPage />} />
                  <Route path="portal-productos/historico" element={<PPHistoricoPage />} />
                  <Route path="portal-escrituracion/dashboard" element={<EscDashboard />} />
                  <Route path="portal-escrituracion/relacion-pagos" element={<EscRelacionPagos />} />
                  <Route path="portal-escrituracion/expedientes" element={<EscExpedientes />} />
                  <Route path="portal-escrituracion/unidades-listas-escriturar" element={<EscUnidadesListasEscriturar />} />
                  <Route path="portal-escrituracion/unidades" element={<EscUnidades />} />
                  <Route path="portal-escrituracion/credito" element={<EscCredito />} />
                  <Route path="portal-escrituracion/pipeline" element={<EscPipeline />} />
                  <Route path="portal-escrituracion/notarias" element={<EscNotarias />} />
                  <Route path="portal-escrituracion/notarios" element={<EscNotarios />} />
                  <Route path="portal-escrituracion/avaluos" element={<EscAvaluos />} />
                  <Route path="portal-escrituracion/pld" element={<EscPLD />} />
                  <Route path="portal-escrituracion/borradores" element={<EscBorradores />} />
                  <Route path="portal-escrituracion/plantillas" element={<EscPlantillas />} />
                  <Route path="portal-escrituracion/firmas" element={<EscFirmas />} />
                  <Route path="portal-escrituracion/citas" element={<EscCitas />} />
                  <Route path="portal-escrituracion/entregas" element={<EscEntregas />} />
                  <Route path="portal-escrituracion/entregas/:id" element={<EscEntregaDetalle />} />
                  <Route path="portal-escrituracion/checklist-configuracion" element={<EscChecklistConfig />} />
                  <Route path="portal-escrituracion/rpp" element={<EscRPP />} />
                  <Route path="portal-escrituracion/reportes" element={<EscReportesPage />} />
                  <Route path="portal-escrituracion/auditoria" element={<EscAuditoria />} />
                  <Route path="portal-escrituracion/configuracion" element={<EscConfiguracion />} />
                  <Route path="portal-escrituracion/demandas" element={<EscDemandas />} />
                  <Route path="portal-escrituracion/postventa" element={<EscPostventa />} />
                  <Route path="portal-escrituracion/postventa/:id" element={<EscPostventaDetalle />} />
                  <Route path="portal-escrituracion/workflow" element={<EscWorkflow />} />
                  <Route path="portal-escrituracion/app-notaria" element={<EscAppNotaria />} />
                  <Route path="portal-escrituracion/notarias/usuarios" element={<EscAppNotariaUsuarios />} />
                  <Route path="portal-escrituracion/app-juridico" element={<EscAppJuridico />} />
                  <Route path="portal-escrituracion/validacion-contratos" element={<ValidacionContratosPDF />} />
                  {/* Portal Notaría — independiente del Portal Escrituración */}
                  <Route path="portal-notaria/inicio" element={<EscAppNotaria />} />
                  {/* Portal Jurídico — independiente del Portal Escrituración */}
                  <Route path="portal-juridico/inicio" element={<EscAppJuridico />} />
                  {/* Administrar Notarios — menú admin principal */}
                  <Route path="notarios/administrar" element={<EscNotarios />} />
                  {/* Administrar Jurídico — menú admin principal */}
                  <Route path="juridico/administrar" element={<JuridicoAdministrar />} />

                  {/* Portal CRM Sozu — Resumen */}
                  <Route path="portal-crm/dashboard" element={<CrmDashboard />} />
                  <Route path="portal-crm/alertas" element={<CrmAlertas />} />
                  <Route path="portal-crm/salud-tracking" element={<CrmTrackingHealth />} />
                  <Route path="portal-crm/eventos-conversion" element={<CrmConversionEvents />} />

                  {/* Portal CRM Sozu — Dirección */}
                  <Route path="portal-crm/direccion/dashboard"     element={<CrmExecutiveDashboard />} />
                  <Route path="portal-crm/direccion/cola-decisiones" element={<CrmExecutiveDecisionQueue />} />
                  <Route path="portal-crm/direccion/resumen-semanal"  element={<CrmExecutiveWeeklyDigest />} />

                  {/* Portal CRM Sozu — CRM */}
                  <Route path="portal-crm/ventas/contactos" element={<CrmContacts />} />
                  <Route path="portal-crm/ventas/contactos/:contactId" element={<CrmContactDetail />} />
                  <Route path="portal-crm/ventas/negocios" element={<CrmDeals />} />
                  <Route path="portal-crm/ventas/tareas" element={<CrmTasks />} />
                  <Route path="portal-crm/ventas/citas" element={<CrmAppointments />} />
                  <Route path="portal-crm/ventas/rendimiento-asesores" element={<CrmAgentPerformance />} />
                  <Route path="portal-crm/ventas/inteligencia-prospectos" element={<CrmLeadIntelligence />} />
                  <Route path="portal-crm/ventas/asignacion" element={<CrmRouting />} />
                  <Route path="portal-crm/ventas/operacion-comercial" element={<CrmSalesOperations />} />
                  <Route path="portal-crm/ventas/reglas-automatizacion" element={<CrmAutomationRules />} />
                  <Route path="portal-crm/ventas/secuencias" element={<CrmSequences />} />
                  <Route path="portal-crm/ventas/escalamientos" element={<CrmEscalations />} />

                  {/* Portal CRM Sozu — Inteligencia de marketing */}
                  <Route path="portal-crm/marketing/rendimiento"      element={<CrmMarketingPerformance />} />
                  <Route path="portal-crm/marketing/atribucion"      element={<CrmAttribution />} />
                  <Route path="portal-crm/marketing/campanas"        element={<CrmCampaigns />} />
                  <Route path="portal-crm/marketing/creativos"        element={<CrmCreatives />} />
                  <Route path="portal-crm/marketing/meta"             element={<CrmMetaAds />} />
                  <Route path="portal-crm/marketing/google"           element={<CrmGoogleAds />} />
                  <Route path="portal-crm/marketing/desarrollos"     element={<CrmMarketingDevelopments />} />
                  <Route path="portal-crm/marketing/embudo"           element={<CrmMarketingFunnel />} />
                  <Route path="portal-crm/marketing/mapeo-campanas" element={<CrmMarketingCampaignMapping />} />
                  <Route path="portal-crm/marketing/sincronizaciones"        element={<CrmMarketingSyncJobs />} />
                  {/* rutas antiguas (conservadas) */}
                  <Route path="portal-crm/marketing/audiencias"     element={<CrmAudiences />} />
                  <Route path="portal-crm/marketing/utms"          element={<CrmUtms />} />
                  <Route path="portal-crm/marketing/pruebas-ab"      element={<CrmMarketingAbTests />} />
                  <Route path="portal-crm/marketing/paginas-aterrizaje" element={<CrmLandingPages />} />
                  <Route path="portal-crm/marketing/formularios"         element={<CrmForms />} />
                  <Route path="portal-crm/marketing/integraciones"  element={<CrmAdIntegrations />} />
                  <Route path="portal-crm/marketing/presupuesto"        element={<CrmBudget />} />

                  {/* Portal CRM Sozu — Inteligencia de ingresos */}
                  <Route path="portal-crm/ingresos/pronostico"     element={<CrmForecast />} />
                  <Route path="portal-crm/ingresos/atribucion"  element={<CrmRevenueAttribution />} />
                  <Route path="portal-crm/ingresos/velocidad"     element={<CrmRevenueVelocity />} />
                  <Route path="portal-crm/ingresos/metas"        element={<CrmRevenueGoals />} />
                  {/* rutas antiguas (conservadas) */}
                  <Route path="portal-crm/ingresos/kpis-ejecutivos"  element={<CrmExecutiveKpis />} />
                  <Route path="portal-crm/ingresos/revision-pipeline" element={<CrmPipelineReview />} />
                  <Route path="portal-crm/ingresos/operaciones"     element={<CrmRevenueOps />} />
                  <Route path="portal-crm/ingresos/cohortes"         element={<CrmCohorts />} />
                  <Route path="portal-crm/ingresos/desercion"           element={<CrmChurn />} />
                  <Route path="portal-crm/ingresos/reportes"       element={<CrmReporting />} />

                  {/* Portal CRM Sozu — Operación */}
                  <Route path="portal-crm/operacion/constructor"     element={<CrmCampaignBuilder />} />
                  <Route path="portal-crm/operacion/copiloto"     element={<CrmAiCopilot />} />
                  <Route path="portal-crm/operacion/desarrollos" element={<CrmOperationsDevelopments />} />
                  {/* rutas antiguas (conservadas) */}
                  <Route path="portal-crm/operacion/bandeja"   element={<CrmUnifiedInbox />} />
                  <Route path="portal-crm/operacion/colas"  element={<CrmQueues />} />
                  <Route path="portal-crm/operacion/sla"     element={<CrmSlaMonitor />} />

                  {/* Portal CRM Sozu — Configuración */}
                  <Route path="portal-crm/configuracion/conexiones"           element={<CrmSettingsConnections />} />
                  <Route path="portal-crm/configuracion/preparacion-despliegue"  element={<CrmSettingsDeploymentReadiness />} />
                  <Route path="portal-crm/configuracion/registros-api"              element={<CrmSettingsApiLogs />} />
                  <Route path="portal-crm/configuracion/checklist-integracion" element={<CrmSettingsIntegrationChecklist />} />
                  <Route path="portal-crm/configuracion/organizacion"          element={<CrmSettingsOrganization />} />
                  <Route path="portal-crm/configuracion/usuarios"                 element={<CrmSettingsUsers />} />
                  <Route path="portal-crm/configuracion/desarrollos"          element={<CrmSettingsDevelopments />} />
                  <Route path="portal-crm/configuracion/pipelines"             element={<CrmSettingsPipelines />} />
                  {/* rutas antiguas (conservadas) */}
                  <Route path="portal-crm/configuracion/roles"                       element={<CrmSettingsRoles />} />
                  <Route path="portal-crm/configuracion/etapas-pipeline"             element={<CrmSettingsPipelineStages />} />
                  <Route path="portal-crm/configuracion/campos-personalizados"               element={<CrmSettingsCustomFields />} />
                  <Route path="portal-crm/configuracion/webhooks"                    element={<CrmSettingsWebhooks />} />
                  <Route path="portal-crm/configuracion/conexiones/google/callback" element={<CrmSettingsGoogleCallback />} />
                  <Route path="portal-crm/configuracion/conexiones/meta/callback"   element={<CrmSettingsMetaCallback />} />
                  <Route path="portal-crm/configuracion/auditoria"                   element={<CrmSettingsAuditLog />} />

                  {/* Portal Bancos */}
                  <Route path="portal-bancos/bandeja"  element={<BancosBandeja />} />
                  <Route path="portal-bancos/pipeline" element={<BancosPipeline />} />
                  <Route path="portal-bancos/tablero"  element={<BancosTablero />} />
                  <Route path="portal-bancos/equipo"   element={<BancosEquipo />} />
                  <Route path="portal-bancos/bancos"   element={<BancosBancos />} />

                  <Route path="portal-alta-direccion/dashboard" element={<AltaDireccionDashboard />} />
                  <Route path="portal-alta-direccion/citas" element={<AltaDireccionCitas />} />
                  <Route path="portal-alta-direccion/prospectos" element={<AltaDireccionProspectos />} />
                  <Route path="portal-alta-direccion/pipeline" element={<AltaDireccionPipeline />} />
                  <Route path="portal-alta-direccion/offers" element={<AltaDireccionOffers />} />
                  <Route path="portal-alta-direccion/cobranza" element={<AltaDireccionCobranza />} />
                  <Route path="portal-alta-direccion/contratos" element={<AltaDireccionContratos />} />
                  <Route path="portal-alta-direccion/facturas" element={<AltaDireccionFacturas />} />
                  <Route path="portal-alta-direccion/comisiones" element={<AltaDireccionComisiones />} />
                  <Route path="portal-alta-direccion/red-comercial" element={<AltaDireccionRedComercial />} />
                  <Route path="portal-alta-direccion/reportes" element={<AltaDireccionReportes />} />
                  <Route path="portal-alta-direccion/auditoria" element={<AltaDireccionAuditoria />} />
                  <Route path="portal-alta-direccion/configuracion" element={<AltaDireccionConfiguracion />} />
                  <Route path="portal-alta-direccion/notificaciones" element={<AltaDireccionNotificaciones />} />
                  <Route path="portal-alta-direccion/bandeja" element={<AltaDireccionBandejaValidaciones />} />
                  <Route path="portal-alta-direccion/ciclo-venta" element={<AltaDireccionCicloVenta />} />
                  <Route path="portal-alta-direccion/facturas-por-cobrar" element={<AltaDireccionFacturasPorCobrar />} />
                  <Route path="portal-alta-direccion/facturas-por-pagar" element={<AltaDireccionFacturasPorPagar />} />
                  <Route path="portal-alta-direccion/comisiones-externas" element={<AltaDireccionComisionesExternas />} />
                  <Route path="portal-alta-direccion/comisiones-internas" element={<AltaDireccionComisionesInternas />} />
                  <Route path="portal-alta-direccion/historico-comercial" element={<AltaDireccionHistoricoComercial />} />
                  <Route path="portal-alta-direccion/analisis-cobranza" element={<AltaDireccionAnalisisCobranza />} />
                  <Route path="portal-alta-direccion/ingresos-egresos" element={<AltaDireccionIngresosEgresos />} />
                  <Route path="portal-alta-direccion/forecast-ingresos" element={<AltaDireccionForecastIngresos />} />
                  <Route path="portal-alta-direccion/estructura-comisiones" element={<AltaDireccionEstructuraComisiones />} />
                  <Route path="portal-alta-direccion/mediciones/portales" element={<MedicionesPortales />} />
                  <Route path="portal-alta-direccion/mediciones/menus" element={<MedicionesMenus />} />
                  <Route path="portal-alta-direccion/mediciones/ctas" element={<MedicionesCtas />} />

                  {/* Portal Socio Bancario */}
                  <Route path="portal-socio-bancario/historico-comercial" element={<SocioBancarioHistoricoComercial />} />
                  <Route path="portal-socio-bancario/analisis-cobranza" element={<SocioBancarioAnalisisCobranza />} />
                  <Route path="portal-socio-bancario/ingresos-egresos" element={<SocioBancarioIngresosEgresos />} />
                  <Route path="portal-socio-bancario/forecast-ingresos" element={<SocioBancarioForecastIngresos />} />
                  <Route path="portal-socio-bancario/expedientes" element={<SocioBancarioExpedientes />} />
                  <Route path="portal-socio-bancario/avance-obra" element={<SocioBancarioAvanceObra />} />

                 {/* Portal de Administración (clon de Alta Dirección) */}
                 <Route path="portal-administracion/dashboard" element={<AdminDashboard />} />
                 <Route path="portal-administracion/citas" element={<AdminCitas />} />
                 <Route path="portal-administracion/prospectos" element={<AdminProspectos />} />
                 <Route path="portal-administracion/pipeline" element={<AdminPipeline />} />
                 <Route path="portal-administracion/offers" element={<AdminOffers />} />
                 <Route path="portal-administracion/cobranza" element={<AdminCobranza />} />
                 <Route path="portal-administracion/contratos" element={<AdminContratos />} />
                 <Route path="portal-administracion/facturas" element={<AdminFacturas />} />
                 <Route path="portal-administracion/comisiones" element={<AdminComisiones />} />
                 <Route path="portal-administracion/red-comercial" element={<AdminRedComercial />} />
                 <Route path="portal-administracion/reportes" element={<AdminReportes />} />
                 <Route path="portal-administracion/auditoria" element={<AdminAuditoria />} />
                 <Route path="portal-administracion/configuracion" element={<AdminConfiguracion />} />
                 <Route path="portal-administracion/notificaciones" element={<AdminNotificaciones />} />
                 <Route path="portal-administracion/bandeja" element={<AdminBandejaValidaciones />} />
                 <Route path="portal-administracion/ciclo-venta" element={<AdminCicloVenta />} />
                 <Route path="portal-administracion/facturas-por-cobrar" element={<AdminFacturasPorCobrar />} />
                 <Route path="portal-administracion/facturas-por-pagar" element={<AdminFacturasPorPagar />} />
                 <Route path="portal-administracion/comisiones-externas" element={<AdminComisionesExternas />} />
                 <Route path="portal-administracion/comisiones-internas" element={<AdminComisionesInternas />} />
                 {/* Portal de Administración — secciones propias (no derivadas de Alta Dirección) */}
                 <Route path="portal-administracion/bandeja-ejecucion" element={<AdminBandejaEjecucion />} />
                 <Route path="portal-administracion/pagos-ejecutados" element={<AdminPagosEjecutados />} />
                 <Route path="portal-administracion/cfdis-emitidos" element={<AdminCFDIsEmitidos />} />
                 <Route path="portal-administracion/conciliacion-stp" element={<AdminConciliacionSTP />} />

                 {/* Portal Condominio Administración */}
                 <Route path="portal-condominio/dashboard"        element={<CondominioDashboard />} />
                 <Route path="portal-condominio/departamentos"    element={<CondominioDepartamentos />} />
                 <Route path="portal-condominio/departamentos/:numero" element={<CondominioUnidadDetalle />} />
                 <Route path="portal-condominio/cargos"           element={<CondominioCargos />} />
                 <Route path="portal-condominio/pagos"            element={<CondominioPagos />} />
                 <Route path="portal-condominio/cobranza"         element={<CondominioCobranza />} />
                 <Route path="portal-condominio/titularidad"      element={<CondominioTitularidad />} />
                 <Route path="portal-condominio/titularidad/:id"  element={<CondominioTitularidadDetalle />} />
                 <Route path="portal-condominio/tesoreria"        element={<CondominioTesoreria />} />
                 <Route path="portal-condominio/presupuesto"      element={<CondominioPresupuesto />} />
                 <Route path="portal-condominio/amenidades"       element={<CondominioAmenidades />} />
                 <Route path="portal-condominio/auditoria"        element={<CondominioAuditoria />} />
                 <Route path="portal-condominio/configuracion"    element={<CondominioConfiguracion />} />

                 {/* Portal Embajadores */}
                 <Route path="embajadores/gestion" element={<GestionEmbajadores />} />
                 <Route path="portal-embajador/inicio"             element={<EmbajadorInicio />} />
                 <Route path="portal-embajador/mis-referidos"      element={<EmbajadorMisReferidos />} />
                 <Route path="portal-embajador/registrar-referido" element={<EmbajadorRegistrarReferido />} />
                 <Route path="portal-embajador/comisiones"         element={<EmbajadorComisiones />} />
                 <Route path="portal-embajador/perfil"             element={<EmbajadorPerfil />} />

                 {/* Portal Legal Flow */}
                 <Route path="legal-flow"                       element={<LegalFlowDashboard />} />
                 <Route path="legal-flow/requests"              element={<LegalFlowRequests />} />
                 <Route path="legal-flow/requests/new"          element={<LegalFlowNewRequest />} />
                 <Route path="legal-flow/cases/:id"             element={<LegalFlowCaseDetail />} />
                 <Route path="legal-flow/templates"             element={<LegalFlowTemplateCatalog />} />
                 <Route path="legal-flow/templates/:id"         element={<LegalFlowTemplateStudio />} />
                 <Route path="legal-flow/archived"              element={<LegalFlowArchived />} />
                 <Route path="legal-flow/notifications"         element={<LegalFlowNotifications />} />
                 <Route path="legal-flow/settings"              element={<LegalFlowSettings />} />
                 <Route path="legal-flow/escrituracion/expedientes" element={<LegalFlowEscExpedientes />} />
                 <Route path="legal-flow/validacion-contratos" element={<ValidacionContratosPDF />} />
                </Route>
                
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              )}
            </Suspense>
            </AmbassadorsProvider>
            </CrmImpersonationProvider>
            </EmbajadorImpersonationProvider>
            </CobranzaImpersonationProvider>
            </InmobiliariaImpersonationProvider>
            </ClienteImpersonationProvider>
            </AgentImpersonationProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemedShell>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
