import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Download, HelpCircle, LayoutGrid, List, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTickets } from "@/lib/portal-tickets/tickets-store";
import { PRIORIDADES, type Ticket } from "@/lib/portal-tickets/tickets-data";
import { TicketsTable, type OrdenCampo } from "./TicketsTable";
import { TicketsKanban } from "./TicketsKanban";
import { TicketDetailSheet } from "./TicketDetailSheet";
import { CreateTicketDialog } from "./CreateTicketDialog";
import { TicketsTour } from "./TicketsTour";
import { TicketsCreateTour } from "./TicketsCreateTour";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const BASE = "/admin/portal-tickets";

export function TicketsWorkspace({
  scope,
  titulo,
  descripcion,
  vistaInicial = "tabla",
  vistas = [],
  rutaActiva,
  propietarioActualId = null,
}: {
  scope: "todos" | "mios" | "sin-asignar";
  titulo: string;
  descripcion?: string;
  vistaInicial?: "tabla" | "kanban";
  vistas?: { label: string; path: string }[];
  rutaActiva: string;
  propietarioActualId?: string | null;
}) {
  const { tickets, pipelines, etapas, categorias, agentes, eliminarTickets } = useTickets();

  // Filtros persistidos por scope (sobreviven navegación / recarga) — se leen una sola vez.
  const persistKey = `tickets:filtros:${scope}`;
  const [persist] = useState<Record<string, any>>(() => {
    try {
      return JSON.parse(localStorage.getItem(persistKey) || "{}");
    } catch {
      return {};
    }
  });

  const [vista, setVista] = useState<"tabla" | "kanban">(persist.vista ?? vistaInicial);
  const [pipelineId, setPipelineId] = useState<string>(persist.pipelineId ?? pipelines[0]?.id ?? "");
  const [propietario, setPropietario] = useState<string>(persist.propietario ?? "todos");
  const [prioridad, setPrioridad] = useState<string>(persist.prioridad ?? "todas");
  const [categoria, setCategoria] = useState<string>(persist.categoria ?? "todas");
  const [etapaFiltro, setEtapaFiltro] = useState<string>(persist.etapaFiltro ?? "todas");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<{ campo: OrdenCampo; dir: "asc" | "desc" }>(
    persist.orden ?? { campo: "fechaCreacion", dir: "desc" },
  );
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState<number>(persist.porPagina ?? 25);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [crear, setCrear] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [createTour, setCreateTour] = useState(false);

  // Guardar los filtros cada vez que cambian.
  useEffect(() => {
    try {
      localStorage.setItem(
        persistKey,
        JSON.stringify({ vista, pipelineId, propietario, prioridad, categoria, etapaFiltro, porPagina, orden }),
      );
    } catch {
      /* localStorage no disponible: ignorar */
    }
  }, [persistKey, vista, pipelineId, propietario, prioridad, categoria, etapaFiltro, porPagina, orden]);

  // pipelines carga async (React Query): al llegar, fijar el pipeline activo si aún no es válido
  // ("todos" es válido = ver todos los pipelines).
  useEffect(() => {
    if (pipelines.length && pipelineId !== "todos" && !pipelines.some((p) => p.id === pipelineId)) {
      setPipelineId(pipelines[0].id);
      setEtapaFiltro("todas");
    }
  }, [pipelines, pipelineId]);

  // Auto-abrir el tutorial la 1ª vez (por dispositivo). Después, con el botón "Tutorial".
  useEffect(() => {
    try {
      if (!localStorage.getItem("tickets:tutorial-visto")) {
        setTutorial(true);
        localStorage.setItem("tickets:tutorial-visto", "1");
      }
    } catch {
      /* localStorage no disponible: ignorar */
    }
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = tickets.filter((t) => {
      if (pipelineId !== "todos" && t.pipelineId !== pipelineId) return false;
      // "Mis tickets" = donde soy propietario O donde yo di de alta el ticket.
      if (
        scope === "mios" &&
        !(t.propietarios.includes(propietarioActualId ?? "") || t.creadoPorId === propietarioActualId)
      )
        return false;
      if (scope === "sin-asignar" && t.propietarios.length > 0) return false;
      if (propietario !== "todos") {
        if (propietario === "sin" ? t.propietarios.length > 0 : !t.propietarios.includes(propietario))
          return false;
      }
      if (prioridad !== "todas" && t.prioridad !== prioridad) return false;
      if (categoria !== "todas" && t.categoriaId !== categoria) return false;
      if (etapaFiltro !== "todas" && t.etapaId !== etapaFiltro) return false;
      if (q) {
        // Buscar también por CADA solicitante (nombre + correo + teléfono), no solo el principal,
        // para encontrar el ticket por el cliente/prospecto aunque no se sepa el folio (#1026).
        const solis = (t.solicitantes ?? [])
          .map((s) => `${s.nombre} ${s.email ?? ""} ${s.telefono ?? ""}`)
          .join(" ");
        const texto =
          `#${t.numero} ${t.nombre} ${t.solicitante} ${solis} ${t.inmueble} ${t.descripcion}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });

    const dir = orden.dir === "asc" ? 1 : -1;
    const peso = { alta: 3, media: 2, baja: 1, sin: 0 } as const;
    return [...lista].sort((a, b) => {
      switch (orden.campo) {
        case "nombre":
          return a.nombre.localeCompare(b.nombre) * dir;
        case "prioridad":
          return (peso[a.prioridad] - peso[b.prioridad]) * dir;
        case "etapa":
          return (
            ((etapas.find((e) => e.id === a.etapaId)?.orden ?? 0) -
              (etapas.find((e) => e.id === b.etapaId)?.orden ?? 0)) *
            dir
          );
        default:
          return (new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime()) * dir;
      }
    });
  }, [
    tickets,
    pipelineId,
    scope,
    propietarioActualId,
    propietario,
    prioridad,
    categoria,
    etapaFiltro,
    busqueda,
    orden,
    etapas,
  ]);

  const kpis = useMemo(() => {
    const cerradas = new Set(etapas.filter((e) => e.cerrada).map((e) => e.id));
    const abiertos = filtrados.filter((t) => !cerradas.has(t.etapaId));
    return {
      total: filtrados.length,
      abiertos: abiertos.length,
      sinAsignar: filtrados.filter((t) => t.propietarios.length === 0).length,
      altaPrioridad: abiertos.filter((t) => t.prioridad === "alta").length,
    };
  }, [filtrados, etapas]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);
  // El ticket del panel de detalle se deriva de la lista viva (no de una copia capturada al
  // abrir), para que al editar (propietario, etapa, etc.) el panel refleje el cambio sin F5.
  const detalle = useMemo(() => tickets.find((t) => t.id === detalleId) ?? null, [tickets, detalleId]);
  // El Kanban necesita un pipeline concreto → con "Todos los pipelines" se usa siempre la tabla.
  const vistaEfectiva = pipelineId === "todos" ? "tabla" : vista;

  const cambiarOrden = (campo: OrdenCampo) =>
    setOrden((o) => ({ campo, dir: o.campo === campo && o.dir === "desc" ? "asc" : "desc" }));

  const exportar = () => {
    const filas = filtrados.map((t) =>
      [
        `#${t.numero}`,
        t.nombre,
        pipelines.find((p) => p.id === t.pipelineId)?.nombre,
        etapas.find((e) => e.id === t.etapaId)?.nombre,
        t.prioridad,
        t.propietarios.map((id) => agentes.find((a) => a.id === id)?.nombre).filter(Boolean).join("; ") ||
          "Sin asignar",
        new Date(t.fechaCreacion).toLocaleDateString("es-MX"),
      ].join(","),
    );
    const csv = ["Folio,Nombre,Pipeline,Etapa,Prioridad,Propietario,Fecha creación", ...filas].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tickets.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtrados.length} tickets exportados`);
  };

  const kpiCards = [
    { label: "Tickets", valor: kpis.total },
    { label: "Abiertos", valor: kpis.abiertos },
    { label: "Sin asignar", valor: kpis.sinAsignar },
    { label: "Prioridad alta", valor: kpis.altaPrioridad },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {descripcion ?? `${filtrados.length} registros`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-tour="tutorial" variant="outline">
                <HelpCircle className="size-4" /> Tutorial
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTutorial(true)}>Recorrido rápido</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateTour(true)}>
                Crear un ticket (guiado)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button data-tour="crear" onClick={() => setCrear(true)}>
            <Plus className="size-4" /> Crear ticket
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {k.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{k.valor}</p>
          </div>
        ))}
      </div>

      {vistas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-b">
          {vistas.map((v) => (
            <NavLink
              key={v.path}
              to={v.path}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors",
                rutaActiva === v.path
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </NavLink>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <div data-tour="vista" className="flex overflow-hidden rounded-md border">
          <button
            onClick={() => setVista("tabla")}
            aria-label="Vista de tabla"
            className={cn(
              "px-2.5 py-2",
              vistaEfectiva === "tabla" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
            )}
          >
            <List className="size-4" />
          </button>
          <button
            onClick={() => setVista("kanban")}
            aria-label="Vista kanban"
            disabled={pipelineId === "todos"}
            title={pipelineId === "todos" ? "El Kanban requiere elegir un pipeline" : undefined}
            className={cn(
              "px-2.5 py-2",
              vistaEfectiva === "kanban" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
              pipelineId === "todos" && "cursor-not-allowed opacity-40",
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>

        <Select
          value={pipelineId}
          onValueChange={(v) => {
            setPipelineId(v);
            setEtapaFiltro("todas");
            setCategoria("todas");
            setPagina(1);
            if (v === "todos") setVista("tabla"); // el Kanban necesita un pipeline concreto
          }}
        >
          <SelectTrigger data-tour="pipeline" className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los pipelines</SelectItem>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={propietario} onValueChange={setPropietario}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Propietario del ticket" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los propietarios</SelectItem>
            <SelectItem value="sin">Sin asignar</SelectItem>
            {agentes.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={etapaFiltro} onValueChange={setEtapaFiltro}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las etapas</SelectItem>
            {etapas
              .filter((e) => pipelineId === "todos" || e.pipelineId === pipelineId)
              .map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nombre}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={prioridad} onValueChange={setPrioridad}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las prioridades</SelectItem>
            {PRIORIDADES.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categorias
              .filter((c) => pipelineId === "todos" || c.pipelineId === pipelineId)
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <div className="relative ml-auto min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-tour="buscar"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por nombre, folio o solicitante"
            className="pl-8"
          />
        </div>

        <Button variant="outline" size="sm" onClick={exportar}>
          <Download className="size-4" /> Exportar
        </Button>

        {seleccion.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              eliminarTickets(seleccion);
              toast.success(`${seleccion.length} tickets eliminados`);
              setSeleccion([]);
            }}
          >
            <Trash2 className="size-4" /> Eliminar ({seleccion.length})
          </Button>
        )}
      </div>

      {vistaEfectiva === "tabla" ? (
        <>
          <TicketsTable
            tickets={visibles}
            seleccion={seleccion}
            onSeleccion={setSeleccion}
            onAbrir={(t) => setDetalleId(t.id)}
            orden={orden}
            onOrden={cambiarOrden}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Página {paginaActual} de {totalPaginas} · {filtrados.length} tickets
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={String(porPagina)}
                onValueChange={(v) => {
                  setPorPagina(Number(v));
                  setPagina(1);
                }}
              >
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} por página
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={paginaActual <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={paginaActual >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      ) : (
        <TicketsKanban tickets={filtrados} pipelineId={pipelineId} onAbrir={(t) => setDetalleId(t.id)} />
      )}

      <TicketDetailSheet ticket={detalle} onOpenChange={(o) => !o && setDetalleId(null)} />
      <CreateTicketDialog open={crear} onOpenChange={setCrear} />
      <TicketsTour open={tutorial} onClose={() => setTutorial(false)} />
      <TicketsCreateTour open={createTour} onClose={() => setCreateTour(false)} dialogOpen={crear} />
    </div>
  );
}

export const TICKETS_BASE = BASE;