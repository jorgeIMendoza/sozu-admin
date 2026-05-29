import { createContext, useContext, useState, ReactNode } from 'react';

export interface ProyectoActivo {
  id: number;
  nombre: string;
}

interface EscrituracionDashboardState {
  proyectoActivo: ProyectoActivo | null;
  setProyectoActivo: (p: ProyectoActivo | null) => void;
  inventarioActivo: number;
  setInventarioActivo: (count: number) => void;
  escrituradosActivo: number;
  setEscrituradosActivo: (count: number) => void;
  expedientesDocumentosActivo: number;
  setExpedientesDocumentosActivo: (count: number) => void;
  relacionPagosActivo: number;
  setRelacionPagosActivo: (count: number) => void;
  alertasPldActivo: number;
  setAlertasPldActivo: (count: number) => void;
  enProcesoActivo: number;
  setEnProcesoActivo: (count: number) => void;
  recursosPropiosActivo: number;
  setRecursosPropiosActivo: (count: number) => void;
  creditoHipotecarioActivo: number;
  setCreditoHipotecarioActivo: (count: number) => void;
  citasActivo: number;
  setCitasActivo: (count: number) => void;
  demandasActivo: number;
  setDemandasActivo: (count: number) => void;
  entregasActivo: number;
  setEntregasActivo: (count: number) => void;
  postventaActivo: number;
  setPostventaActivo: (count: number) => void;
  expedienteSeleccionado: string | null;
  setExpedienteSeleccionado: (id: string | null) => void;
  filtroEtapa: string;
  setFiltroEtapa: (e: string) => void;
  filtroSla: string;
  setFiltroSla: (s: string) => void;
  filtroPago: string;
  setFiltroPago: (p: string) => void;
  filtroNotaria: string;
  setFiltroNotaria: (n: string) => void;
  busqueda: string;
  setBusqueda: (b: string) => void;
}

const EscrituracionDashboardContext = createContext<EscrituracionDashboardState | undefined>(undefined);

export function EscrituracionDashboardProvider({ children }: { children: ReactNode }) {
  const [proyectoActivo, setProyectoActivo] = useState<ProyectoActivo | null>(null);
  const [inventarioActivo, setInventarioActivo] = useState(0);
  const [escrituradosActivo, setEscrituradosActivo] = useState(0);
  const [expedientesDocumentosActivo, setExpedientesDocumentosActivo] = useState(0);
  const [relacionPagosActivo, setRelacionPagosActivo] = useState(0);
  const [alertasPldActivo, setAlertasPldActivo] = useState(0);
  const [enProcesoActivo, setEnProcesoActivo] = useState(0);
  const [recursosPropiosActivo, setRecursosPropiosActivo] = useState(0);
  const [creditoHipotecarioActivo, setCreditoHipotecarioActivo] = useState(0);
  const [citasActivo, setCitasActivo] = useState(0);
  const [demandasActivo, setDemandasActivo] = useState(0);
  const [entregasActivo, setEntregasActivo] = useState(0);
  const [postventaActivo, setPostventaActivo] = useState(0);
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<string | null>(null);
  const [filtroEtapa, setFiltroEtapa] = useState('Todas');
  const [filtroSla, setFiltroSla] = useState('Todas');
  const [filtroPago, setFiltroPago] = useState('Todos');
  const [filtroNotaria, setFiltroNotaria] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');

  return (
    <EscrituracionDashboardContext.Provider
      value={{
        proyectoActivo,
        setProyectoActivo,
        inventarioActivo,
        setInventarioActivo,
        escrituradosActivo,
        setEscrituradosActivo,
        expedientesDocumentosActivo,
        setExpedientesDocumentosActivo,
        relacionPagosActivo,
        setRelacionPagosActivo,
        alertasPldActivo,
        setAlertasPldActivo,
        enProcesoActivo,
        setEnProcesoActivo,
        recursosPropiosActivo,
        setRecursosPropiosActivo,
        creditoHipotecarioActivo,
        setCreditoHipotecarioActivo,
        citasActivo,
        setCitasActivo,
        demandasActivo,
        setDemandasActivo,
        entregasActivo,
        setEntregasActivo,
        postventaActivo,
        setPostventaActivo,
        expedienteSeleccionado,
        setExpedienteSeleccionado,
        filtroEtapa,
        setFiltroEtapa,
        filtroSla,
        setFiltroSla,
        filtroPago,
        setFiltroPago,
        filtroNotaria,
        setFiltroNotaria,
        busqueda,
        setBusqueda,
      }}
    >
      {children}
    </EscrituracionDashboardContext.Provider>
  );
}

export function useEscrituracionDashboard() {
  const context = useContext(EscrituracionDashboardContext);
  if (context === undefined) {
    throw new Error('useEscrituracionDashboard must be used within an EscrituracionDashboardProvider');
  }
  return context;
}
