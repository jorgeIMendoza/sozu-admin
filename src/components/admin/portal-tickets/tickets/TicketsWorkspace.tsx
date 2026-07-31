import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Download, LayoutGrid, List, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const [vista, setVista] = useState<"tabla" | "kanban">(vistaInicial);
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const [propietario, setPropietario] = useState("todos");
  const [prioridad, setPrioridad] = useState("todas");
  const [categoria, setCategoria] = useState("todas");
  const [etapaFiltro, setEtapaFiltro] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<{ campo: OrdenCampo; dir: "asc" | "desc" }>({
    campo: "fechaCreacion",
    dir: "desc",
  });
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [detalle, setDetalle] = useState<Ticket | null>(null);
  const [crear, setCrear] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = tickets.filter((t) => {
      if (t.pipelineId !== pipelineId) return false;
      if (scope === "mios" && t.propietarioId !== propietarioActualId) return false;
      if (scope === "sin-asignar" && t.propietarioId !== null) return false;
      if (propietario !== "todos") {
        if (propietario === "sin" ? t.propietarioId !== null : t.propietarioId !== propietario)
          return false;
      }
      if (prioridad !== "todas" && t.prioridad !== prioridad) return false;
      if (categoria !== "todas" && t.categoriaId !== categoria) return false;
      if (etapaFiltro !== "todas" && t.etapaId !== etapaFiltro) return false;
      if (q) {
        const texto = `${t.nombre} ${t.solicitante} ${t.inmueble} ${t.descripcion}`.toLowerCase();
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
      sinAsignar: filtrados.filter((t) => t.propietarioId === null).length,
      altaPrioridad: abiertos.filter((t) => t.prioridad === "alta").length,
    };
  }, [filtrados, etapas]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  const cambiarOrden = (campo: OrdenCampo) =>
    setOrden((o) => ({ campo, dir: o.campo === campo && o.dir === "desc" ? "asc" : "desc" }));

  const exportar = () => {
    const filas = filtrados.map((t) =>
      [
        t.nombre,
        pipelines.find((p) => p.id === t.pipelineId)?.nombre,
        etapas.find((e) => e.id === t.etapaId)?.nombre,
        t.prioridad,
        agentes.find((a) => a.id === t.propietarioId)?.nombre ?? "Sin asignar",
        new Date(t.fechaCreacion).toLocaleDateString("es-MX"),
      ].join(","),
    );
    const csv = ["Nombre,Pipeline,Etapa,Prioridad,Propietario,Fecha creación", ...filas].join("\n");
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
        <Button onClick={() => setCrear(true)}>
          <Plus className="size-4" /> Crear ticket
        </Button>
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
        <div className="flex overflow-hidden rounded-md border">
          <button
            onClick={() => setVista("tabla")}
            aria-label="Vista de tabla"
            className={cn(
              "px-2.5 py-2",
              vista === "tabla" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
            )}
          >
            <List className="size-4" />
          </button>
          <button
            onClick={() => setVista("kanban")}
            aria-label="Vista kanban"
            className={cn(
              "px-2.5 py-2",
              vista === "kanban" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
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
            setPagina(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
              .filter((e) => e.pipelineId === pipelineId)
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
            {categorias.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative ml-auto min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar tickets"
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

      {vista === "tabla" ? (
        <>
          <TicketsTable
            tickets={visibles}
            seleccion={seleccion}
            onSeleccion={setSeleccion}
            onAbrir={setDetalle}
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
        <TicketsKanban tickets={filtrados} pipelineId={pipelineId} onAbrir={setDetalle} />
      )}

      <TicketDetailSheet ticket={detalle} onOpenChange={(o) => !o && setDetalle(null)} />
      <CreateTicketDialog open={crear} onOpenChange={setCrear} />
    </div>
  );
}

export const TICKETS_BASE = BASE;