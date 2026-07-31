import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AGENTES_SEED,
  CATEGORIAS_SEED,
  ETAPAS_SEED,
  PIPELINES_SEED,
  generarTickets,
  type Agente,
  type Categoria,
  type Etapa,
  type Pipeline,
  type Ticket,
} from "./tickets-data";

type NuevoTicket = {
  nombre: string;
  pipelineId: string;
  etapaId: string;
  prioridad: Ticket["prioridad"];
  categoriaId: string;
  propietarioId: string | null;
  solicitante: string;
  inmueble: string;
  descripcion: string;
  fuente?: string;
  fechaCreacion?: string;
};

type Store = {
  tickets: Ticket[];
  pipelines: Pipeline[];
  etapas: Etapa[];
  categorias: Categoria[];
  agentes: Agente[];
  autor: string;
  crearTicket: (t: NuevoTicket) => Ticket;
  actualizarTicket: (id: string, cambios: Partial<Ticket>, nota?: string) => void;
  moverEtapa: (id: string, etapaId: string) => void;
  eliminarTickets: (ids: string[]) => void;
  agregarNota: (id: string, texto: string) => void;
  guardarPipeline: (p: Pipeline) => void;
  eliminarPipeline: (id: string) => void;
  guardarEtapa: (e: Etapa) => void;
  eliminarEtapa: (id: string) => void;
  guardarCategoria: (c: Categoria) => void;
  eliminarCategoria: (id: string) => void;
  guardarAgente: (a: Agente) => void;
  eliminarAgente: (id: string) => void;
};

const TicketsContext = createContext<Store | null>(null);

const uid = () => Math.random().toString(36).slice(2, 10);

export function TicketsProvider({
  children,
  autor = "Sistema",
}: {
  children: ReactNode;
  autor?: string;
}) {
  const [tickets, setTickets] = useState<Ticket[]>(() => generarTickets());
  const [pipelines, setPipelines] = useState<Pipeline[]>(PIPELINES_SEED);
  const [etapas, setEtapas] = useState<Etapa[]>(ETAPAS_SEED);
  const [categorias, setCategorias] = useState<Categoria[]>(CATEGORIAS_SEED);
  const [agentes, setAgentes] = useState<Agente[]>(AGENTES_SEED);

  const registrar = useCallback(
    (t: Ticket, texto: string): Ticket => ({
      ...t,
      actividad: [
        ...t.actividad,
        { id: uid(), fecha: new Date().toISOString(), autor, texto },
      ],
    }),
    [autor],
  );

  const crearTicket = useCallback(
    (data: NuevoTicket) => {
      const numero = Math.floor(2000 + Math.random() * 7000);
      const nuevo: Ticket = {
        ...data,
        id: `t-${uid()}`,
        numero,
        nombre: data.nombre.trim(),
        fechaCreacion: data.fechaCreacion ?? new Date().toISOString(),
        fechaCierre: null,
        fuente: data.fuente ?? "Portal",
        actividad: [
          {
            id: uid(),
            fecha: new Date().toISOString(),
            autor,
            texto: "Ticket creado desde el Portal Tickets de Seguimiento.",
          },
        ],
      };
      setTickets((prev) => [nuevo, ...prev]);
      return nuevo;
    },
    [autor],
  );

  const actualizarTicket = useCallback(
    (id: string, cambios: Partial<Ticket>, nota?: string) => {
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const actualizado = { ...t, ...cambios };
          return nota ? registrar(actualizado, nota) : actualizado;
        }),
      );
    },
    [registrar],
  );

  const moverEtapa = useCallback(
    (id: string, etapaId: string) => {
      const etapa = etapas.find((e) => e.id === etapaId);
      if (!etapa) return;
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id !== id || t.etapaId === etapaId) return t;
          return registrar(
            {
              ...t,
              etapaId,
              pipelineId: etapa.pipelineId,
              fechaCierre: etapa.cerrada ? new Date().toISOString() : null,
            },
            `Etapa actualizada a "${etapa.nombre}".`,
          );
        }),
      );
    },
    [etapas, registrar],
  );

  const eliminarTickets = useCallback((ids: string[]) => {
    setTickets((prev) => prev.filter((t) => !ids.includes(t.id)));
  }, []);

  const agregarNota = useCallback(
    (id: string, texto: string) => {
      setTickets((prev) => prev.map((t) => (t.id === id ? registrar(t, texto) : t)));
    },
    [registrar],
  );

  const value = useMemo<Store>(
    () => ({
      tickets,
      pipelines,
      etapas,
      categorias,
      agentes,
      autor,
      crearTicket,
      actualizarTicket,
      moverEtapa,
      eliminarTickets,
      agregarNota,
      guardarPipeline: (p) =>
        setPipelines((prev) =>
          prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p],
        ),
      eliminarPipeline: (id) => {
        setPipelines((prev) => prev.filter((p) => p.id !== id));
        setEtapas((prev) => prev.filter((e) => e.pipelineId !== id));
      },
      guardarEtapa: (e) =>
        setEtapas((prev) =>
          prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [...prev, e],
        ),
      eliminarEtapa: (id) => setEtapas((prev) => prev.filter((e) => e.id !== id)),
      guardarCategoria: (c) =>
        setCategorias((prev) =>
          prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c],
        ),
      eliminarCategoria: (id) => setCategorias((prev) => prev.filter((c) => c.id !== id)),
      guardarAgente: (a) =>
        setAgentes((prev) =>
          prev.some((x) => x.id === a.id) ? prev.map((x) => (x.id === a.id ? a : x)) : [...prev, a],
        ),
      eliminarAgente: (id) => setAgentes((prev) => prev.filter((a) => a.id !== id)),
    }),
    [
      tickets,
      pipelines,
      etapas,
      categorias,
      agentes,
      autor,
      crearTicket,
      actualizarTicket,
      moverEtapa,
      eliminarTickets,
      agregarNota,
    ],
  );

  return <TicketsContext.Provider value={value}>{children}</TicketsContext.Provider>;
}

export function useTickets() {
  const ctx = useContext(TicketsContext);
  if (!ctx) throw new Error("useTickets debe usarse dentro de TicketsProvider");
  return ctx;
}

export const nuevoId = uid;