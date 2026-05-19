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
  demandasActivo: number;
  setDemandasActivo: (count: number) => void;
  entregasActivo: number;
  setEntregasActivo: (count: number) => void;
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
  const [demandasActivo, setDemandasActivo] = useState(0);
  const [entregasActivo, setEntregasActivo] = useState(0);
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
        demandasActivo,
        setDemandasActivo,
        entregasActivo,
        setEntregasActivo,
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
