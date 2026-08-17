import { useMemo, useState } from "react";

import {
  Car,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Columns3,
  Download,
  FileClock,
  Info,
  Lock,
  PanelRightOpen,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePreciosProyecto } from "@/features/precios/hooks/usePreciosProyecto";
import { useVersionesStore } from "@/features/precios/stores/versionesStore";
import { useOfertasStore } from "@/features/precios/stores/ofertasStore";
import type { VersionLista } from "@/features/precios/types/dominio";
import {
  useIndicesActivos,
  useProyectoActivo,
} from "@/features/precios/hooks/useInventarioActivo";
import { useMotorStore } from "@/features/precios/stores/motorStore";
import {
  COLUMNAS_DISPONIBLES,
  useListaStore,
} from "@/features/precios/stores/listaStore";
import { useDemoStore } from "@/features/precios/stores/demoStore";
import {
  formatoFechaCorta,
  formatoM2,
  formatoMoneda,
  formatoMultiplicador,
  formatoPorcentaje,
} from "@/features/precios/lib/formato";
import { exportarCSVAuditado } from "@/features/precios/services/auditoria";
import { DialogoPublicacion } from "@/features/precios/components/DialogoPublicacion";
import {
  PanelDetallePrecio,
  type FilaPrecio,
} from "@/features/precios/components/PanelDetallePrecio";
import { PanelDemoPrecios } from "@/features/precios/components/PanelDemoPrecios";
import { ModalOverrideMasivo } from "@/features/precios/components/ModalOverrideMasivo";
import { PlanoTorre } from "@/features/precios/components/PlanoTorre";
import type { AlertaCalidad } from "@/features/precios/types/dominio";

const COLUMNAS_ORDENABLES = new Set([
  "nivel",
  "area_int",
  "precio_calculado",
  "precio_actual",
  "delta",
]);

/** Referencia estable: un arreglo nuevo por render rompe useSyncExternalStore. */
const SIN_VERSIONES: VersionLista[] = [];

function ChipRapido({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        activo
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TablaPrecios() {
  const {
    motor,
    propiedades,
    torresProyecto,
    desgloses,
    alertasAgregadas,
    alertasPorUnidad,
  } = usePreciosProyecto();
  const idProyectoActivo = useMotorStore((s) => s.idProyectoActivo);
  const nombreProyecto = useProyectoActivo()?.nombre ?? "";
  const { modelosPorId, torresPorId } = useIndicesActivos();

  const filtros = useListaStore((s) => s.filtros);
  const setFiltro = useListaStore((s) => s.setFiltro);
  const limpiarFiltros = useListaStore((s) => s.limpiarFiltros);
  const columnasVisibles = useListaStore((s) => s.columnasVisibles);
  const toggleColumna = useListaStore((s) => s.toggleColumna);
  const orden = useListaStore((s) => s.orden);
  const setOrden = useListaStore((s) => s.setOrden);
  const pagina = useListaStore((s) => s.pagina);
  const setPagina = useListaStore((s) => s.setPagina);
  const tamanoPagina = useListaStore((s) => s.tamanoPagina);
  const setTamanoPagina = useListaStore((s) => s.setTamanoPagina);
  const overrides = useListaStore((s) => s.overrides);
  const seleccion = useListaStore((s) => s.seleccion);
  const toggleSeleccion = useListaStore((s) => s.toggleSeleccion);
  const setSeleccion = useListaStore((s) => s.setSeleccion);
  const limpiarSeleccion = useListaStore((s) => s.limpiarSeleccion);
  const franjaExpandida = useListaStore((s) => s.franjaExpandida);
  const setFranjaExpandida = useListaStore((s) => s.setFranjaExpandida);
  const vistaInventario = useListaStore((s) => s.vistaInventario);
  const setVistaInventario = useListaStore((s) => s.setVistaInventario);
  const metricaPlano = useListaStore((s) => s.metricaPlano);
  const setMetricaPlano = useListaStore((s) => s.setMetricaPlano);
  const torrePlano = useListaStore((s) => s.torrePlano);
  const setTorrePlano = useListaStore((s) => s.setTorrePlano);
  const modoVersion = useListaStore((s) => s.modoVersion);
  const setModoVersion = useListaStore((s) => s.setModoVersion);

  const versionesPorProyecto = useVersionesStore((s) => s.versionesPorProyecto);
  const versionesProyecto = versionesPorProyecto[idProyectoActivo] ?? SIN_VERSIONES;
  const publicada = useMemo(() => {
    const publicadas = versionesProyecto.filter((v) => v.estado === "publicada");
    return publicadas.length > 0
      ? publicadas.reduce((a, b) => (b.numero > a.numero ? b : a))
      : null;
  }, [versionesProyecto]);
  const enPublicada = modoVersion === "publicada" && publicada !== null;
  const preciosPublicados = publicada?.precios ?? {};
  const excluidosPublicada = useMemo(
    () => new Set((publicada?.unidades_excluidas ?? []).map((u) => u.id_propiedad)),
    [publicada],
  );

  const ofertas = useOfertasStore((s) => s.ofertas);

  const criticasForzadas = useDemoStore((s) => s.criticasForzadas);
  const semillaDemo = useDemoStore((s) => s.semilla);

  const [pestana, setPestana] = useState<"activos" | "draft" | "eliminados">("activos");
  const [detalle, setDetalle] = useState<FilaPrecio | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [masivoAbierto, setMasivoAbierto] = useState(false);
  const [publicando, setPublicando] = useState(false);

  const visible = (c: string) => columnasVisibles.includes(c);

  const filas: FilaPrecio[] = useMemo(() => {
    void semillaDemo;
    const porId = new Map(desgloses.map((d) => [d.id_propiedad, d]));
    return propiedades.map((p) => {
      const d = porId.get(p.id_propiedad)!;
      const base = alertasPorUnidad[p.id_propiedad] ?? d.alertas;
      const alertas: AlertaCalidad[] = criticasForzadas.includes(p.id_propiedad)
        ? [
            ...base,
            {
              codigo: "REVISION_CRITICA",
              severidad: "critica" as const,
              mensaje:
                "Unidad marcada como crítica desde las herramientas de demostración.",
            },
          ]
        : base;
      return {
        propiedad: p,
        desglose: d,
        modelo: modelosPorId[p.id_modelo],
        torre: torresPorId[p.id_torre],
        alertas,
        productoFactores:
          d.f_torre * d.f_nivel * d.f_vista * d.f_orientacion * d.f_extras * d.f_tamano,
      };
    });
  }, [propiedades, desgloses, criticasForzadas, semillaDemo, alertasPorUnidad, modelosPorId, torresPorId]);

  // El inventario real solo entrega unidades activas: las dadas de baja no
  // viajan en la consulta, así que el conteo de eliminadas es 0 por definición.
  const conteos = useMemo(
    () => ({
      activos: propiedades.filter((p) => p.estatus !== "Borrador").length,
      draft: propiedades.filter((p) => p.estatus === "Borrador").length,
      eliminados: 0,
    }),
    [propiedades],
  );

  const modelosProyecto = useMemo(
    () =>
      Array.from(new Set(propiedades.map((p) => modelosPorId[p.id_modelo]?.nombre ?? ""))).filter(
        Boolean,
      ),
    [propiedades, modelosPorId],
  );
  const vistasProyecto = useMemo(
    () => Array.from(new Set(propiedades.map((p) => p.vista))),
    [propiedades],
  );

  const filtradas = useMemo(() => {
    if (pestana !== "activos") return [];
    const q = filtros.busqueda.trim().toLowerCase();
    let out = filas.filter((f) => {
      const modelo = f.modelo?.nombre ?? "";
      const torre = f.torre?.nombre ?? "";
      if (
        q &&
        !`${f.propiedad.numero} ${modelo} ${torre}`.toLowerCase().includes(q)
      )
        return false;
      if (filtros.torre !== "todos" && torre !== filtros.torre) return false;
      if (filtros.modelo !== "todos" && modelo !== filtros.modelo) return false;
      if (filtros.vista !== "todos" && f.propiedad.vista !== filtros.vista) return false;
      if (filtros.estatus !== "todos" && f.propiedad.estatus !== filtros.estatus)
        return false;
      if (
        filtros.soloConAlertas &&
        !f.alertas.some((a) => a.severidad !== "informativa")
      )
        return false;
      if (filtros.soloConOverride && !overrides[f.propiedad.id_propiedad]) return false;
      if (
        filtros.deltaMayorA5 &&
        !(f.propiedad.precio_lista_actual > 0 && Math.abs(f.desglose.delta_pct) > 5)
      )
        return false;
      if (filtros.soloDisponibles && f.propiedad.estatus !== "Disponible") return false;
      if (filtros.soloRepreciables && f.desglose.bloqueada_para_reprecio) return false;
      return true;
    });

    if (orden) {
      const valor = (f: FilaPrecio) => {
        switch (orden.columna) {
          case "nivel":
            return f.propiedad.nivel;
          case "area_int":
            return f.propiedad.m2_interiores;
          case "precio_calculado":
            return f.desglose.precio_lista;
          case "precio_actual":
            return f.propiedad.precio_lista_actual;
          case "delta":
            return f.desglose.delta_pct;
          default:
            return 0;
        }
      };
      out = [...out].sort((a, b) =>
        orden.direccion === "asc" ? valor(a) - valor(b) : valor(b) - valor(a),
      );
    }
    return out;
  }, [filas, filtros, orden, overrides, pestana]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / tamanoPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice(
    (paginaActual - 1) * tamanoPagina,
    paginaActual * tamanoPagina,
  );

  const totales = useMemo(
    () =>
      filtradas.reduce(
        (acc, f) => ({
          areaPond: acc.areaPond + f.desglose.area_ponderada,
          exento: acc.exento + f.desglose.componente_exento,
          gravado: acc.gravado + f.desglose.componente_gravado,
          calculado: acc.calculado + f.desglose.precio_lista,
          actual: acc.actual + f.propiedad.precio_lista_actual,
        }),
        { areaPond: 0, exento: 0, gravado: 0, calculado: 0, actual: 0 },
      ),
    [filtradas],
  );
  const deltaTotalPct =
    totales.actual > 0 ? ((totales.calculado - totales.actual) / totales.actual) * 100 : 0;

  const exportar = () => {
    const cols = COLUMNAS_DISPONIBLES.filter((c) => visible(c.clave));
    const dato = (f: FilaPrecio, clave: string): string | number => {
      switch (clave) {
        case "torre":
          return f.torre?.nombre ?? "";
        case "modelo":
          return f.modelo?.nombre ?? "";
        case "numero":
          return f.propiedad.numero;
        case "nivel":
          return f.propiedad.nivel;
        case "vista":
          return f.propiedad.vista;
        case "area_int":
          return f.propiedad.m2_interiores.toFixed(2);
        case "area_pond":
          return f.desglose.area_ponderada.toFixed(2);
        case "cajones":
          return `${f.propiedad.num_cajones} ${f.propiedad.tipo_cajon === "tandem" ? "tándem" : "independiente"}`;
        case "factores":
          return f.productoFactores.toFixed(4);
        case "exento":
          return f.desglose.componente_exento.toFixed(2);
        case "gravado":
          return f.desglose.componente_gravado.toFixed(2);
        case "precio_calculado":
          return f.desglose.precio_lista.toFixed(2);
        case "precio_m2_calc":
          return f.desglose.area_ponderada > 0
            ? (f.desglose.precio_lista / f.desglose.area_ponderada).toFixed(2)
            : "";
        case "precio_m2_actual":
          return f.propiedad.precio_lista_actual > 0 && f.desglose.area_ponderada > 0
            ? (f.propiedad.precio_lista_actual / f.desglose.area_ponderada).toFixed(2)
            : "";
        case "delta_m2":
          return f.propiedad.precio_lista_actual > 0 && f.desglose.area_ponderada > 0
            ? (
                (f.desglose.precio_lista - f.propiedad.precio_lista_actual) /
                f.desglose.area_ponderada
              ).toFixed(2)
            : "";
        case "precio_actual":
          return f.propiedad.precio_lista_actual.toFixed(2);
        case "delta":
          return f.propiedad.precio_lista_actual > 0
            ? f.desglose.delta_pct.toFixed(1)
            : "";
        case "estatus":
          return f.propiedad.estatus;
        case "alertas":
          return f.alertas.map((a) => a.codigo).join(" | ");
        default:
          return "";
      }
    };
    exportarCSVAuditado(
      {
        id_proyecto: motor.id_proyecto,
        origen: "Tabla maestra de precios",
        filtros: { columnas: cols.map((c) => c.clave), filas: filtradas.length },
      },
      `precios-${nombreProyecto.toLowerCase()}.csv`,
      cols.map((c) => c.titulo),
      filtradas.map((f) => cols.map((c) => dato(f, c.clave))),
    );
  };

  const Encabezado = ({ clave, titulo, alineado }: { clave: string; titulo: string; alineado?: "right" }) => {
    if (!visible(clave)) return null;
    const ordenable = COLUMNAS_ORDENABLES.has(clave);
    const activo = orden?.columna === clave;
    return (
      <th
        className={cn(
          "whitespace-nowrap px-3 py-2 text-xs font-medium text-muted-foreground",
          alineado === "right" ? "text-right" : "text-left",
          ordenable && "cursor-pointer select-none hover:text-foreground",
        )}
        onClick={ordenable ? () => setOrden(clave) : undefined}
      >
        <span className={cn("inline-flex items-center gap-1", alineado === "right" && "justify-end")}>
          {titulo}
          {activo &&
            (orden?.direccion === "asc" ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            ))}
        </span>
      </th>
    );
  };

  const Celda = ({
    clave,
    children,
    className,
  }: {
    clave: string;
    children: React.ReactNode;
    className?: string;
  }) =>
    visible(clave) ? (
      <td className={cn("whitespace-nowrap px-3 py-2 text-sm", className)}>{children}</td>
    ) : null;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {(["borrador", "publicada"] as const).map((m) => {
            const deshabilitado = m === "publicada" && !publicada;
            const boton = (
              <button
                key={m}
                type="button"
                disabled={deshabilitado}
                onClick={() => setModoVersion(m)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  deshabilitado
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : modoVersion === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "borrador" ? "Borrador" : "Publicada"}
              </button>
            );
            return deshabilitado ? (
              <Tooltip key={m}>
                <TooltipTrigger asChild>
                  <span>{boton}</span>
                </TooltipTrigger>
                <TooltipContent>Aún no hay ninguna versión publicada.</TooltipContent>
              </Tooltip>
            ) : (
              boton
            );
          })}
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {(["lista", "plano"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVistaInventario(v)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition",
                vistaInventario === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "lista" ? (
                <List className="size-4" />
              ) : (
                <LayoutGrid className="size-4" />
              )}
              {v === "lista" ? "Lista" : "Plano de torre"}
            </button>
          ))}
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={exportar}>
          <Download className="size-4" />
          Exportar CSV
        </Button>
        <Button onClick={() => setPublicando(true)} disabled={enPublicada}>
          <Upload className="size-4" />
          Publicar versión
        </Button>
        </div>
      </div>

      {enPublicada && publicada && (
        <Alert className="border-amber-500/40 bg-amber-500/5 py-2">
          <Info className="size-4 text-amber-600" />
          <AlertDescription className="text-foreground">
            Estás viendo la lista publicada v{publicada.numero} del{" "}
            {formatoFechaCorta(publicada.publicada_en ?? publicada.creada_en)}. Es un
            registro histórico y no puede modificarse.
          </AlertDescription>
        </Alert>
      )}

      {motor.estado_calibracion !== "calibrado" &&
        motor.estado_calibracion !== "calibrado_manualmente" && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-foreground">
            {motor.estado_calibracion === "sin_calibrar"
              ? "El motor todavía no se calibra contra la lista vigente. Las desviaciones respecto al precio actual son esperadas y no se reportan como alerta hasta que marques el motor como calibrado."
              : "Los parámetros del motor cambiaron después de la última calibración. Vuelve a calibrar antes de publicar precios."}
          </p>
        </div>
        )}

      {motor.estado_calibracion === "calibrado_manualmente" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-sm text-foreground">
            El motor se declaró calibrado manualmente: nadie corrió una regresión contra la
            lista vigente. Las alertas de desviación están activas, pero la calidad del ajuste
            no está medida.
          </p>
        </div>
      )}

      {alertasAgregadas.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left"
            onClick={() => setFranjaExpandida(!franjaExpandida)}
          >
            <TriangleAlert className="size-4 shrink-0 text-amber-600" />
            <span className="flex-1 text-sm font-medium text-foreground">
              Calidad de datos del proyecto · {alertasAgregadas.length} hallazgo
              {alertasAgregadas.length === 1 ? "" : "s"} a nivel inventario
            </span>
            {franjaExpandida ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
          {franjaExpandida && (
            <ul className="mt-2 space-y-2">
              {alertasAgregadas.map((a) => (
                <li key={a.codigo} className="text-sm text-foreground">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {a.codigo}
                  </span>{" "}
                  {a.mensaje}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 pr-9"
          placeholder="Buscar por número de unidad, modelo o torre..."
          value={filtros.busqueda}
          onChange={(e) => setFiltro("busqueda", e.target.value)}
        />
        {filtros.busqueda && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setFiltro("busqueda", "")}
            aria-label="Limpiar búsqueda"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <Card className="gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filtros</span>
          </div>
          <button
            type="button"
            onClick={limpiarFiltros}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <X className="size-3.5" />
            Limpiar
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { campo: "torre" as const, titulo: "Torre", opciones: torresProyecto.map((t) => t.nombre) },
            { campo: "modelo" as const, titulo: "Modelo", opciones: modelosProyecto },
            { campo: "vista" as const, titulo: "Vista", opciones: vistasProyecto },
            {
              campo: "estatus" as const,
              titulo: "Estatus",
              opciones: ["Disponible", "Apartada", "Vendida"],
            },
          ].map(({ campo, titulo, opciones }) => (
            <div key={campo} className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">{titulo}</Label>
              <Select
                value={filtros[campo]}
                onValueChange={(v) => setFiltro(campo, v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {opciones.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <ChipRapido
          activo={filtros.soloConAlertas}
          onClick={() => setFiltro("soloConAlertas", !filtros.soloConAlertas)}
        >
          Solo con alertas
        </ChipRapido>
        <ChipRapido
          activo={filtros.soloConOverride}
          onClick={() => setFiltro("soloConOverride", !filtros.soloConOverride)}
        >
          Solo con override
        </ChipRapido>
        <ChipRapido
          activo={filtros.deltaMayorA5}
          onClick={() => setFiltro("deltaMayorA5", !filtros.deltaMayorA5)}
        >
          Delta mayor a 5%
        </ChipRapido>
        <ChipRapido
          activo={filtros.soloRepreciables}
          onClick={() => setFiltro("soloRepreciables", !filtros.soloRepreciables)}
        >
          Solo repreciables
        </ChipRapido>
        <ChipRapido
          activo={filtros.soloDisponibles}
          onClick={() => setFiltro("soloDisponibles", !filtros.soloDisponibles)}
        >
          Solo disponibles
        </ChipRapido>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ["activos", `Activos (${conteos.activos})`],
              ["draft", `Draft (${conteos.draft})`],
              ["eliminados", `Eliminados (${conteos.eliminados})`],
            ] as const
          ).map(([clave, titulo]) => (
            <button
              key={clave}
              type="button"
              onClick={() => setPestana(clave)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm tabular-nums transition-colors",
                pestana === clave
                  ? "border border-border bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {titulo}
            </button>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 className="size-4" />
              Columnas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
            <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNAS_DISPONIBLES.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.clave}
                checked={visible(c.clave)}
                onCheckedChange={() => toggleColumna(c.clave)}
                onSelect={(e) => e.preventDefault()}
              >
                {c.titulo}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-sm text-muted-foreground tabular-nums">
        {vistaInventario === "lista"
          ? `Mostrando ${visibles.length} de ${filtradas.length} propiedades`
          : `Mostrando ${filtradas.length} propiedades en el plano`}
      </p>

      {seleccion.length > 0 && !enPublicada && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <span className="text-sm font-medium text-foreground tabular-nums">
            {seleccion.length} unidades seleccionadas
          </span>
          <Button size="sm" onClick={() => setMasivoAbierto(true)}>
            Override masivo
          </Button>
          <Button variant="ghost" size="sm" onClick={limpiarSeleccion}>
            Limpiar selección
          </Button>
        </div>
      )}

      {vistaInventario === "lista" ? (
      <>
      <Card className="overflow-hidden p-0">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20 border-b border-border bg-muted">
              <tr>
                <th className="w-1" />
                <th className="sticky left-0 z-10 bg-muted px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary align-middle"
                    aria-label="Seleccionar todas las unidades visibles"
                    disabled={enPublicada}
                    checked={
                      visibles.length > 0 &&
                      visibles.every((f) => seleccion.includes(f.propiedad.id_propiedad))
                    }
                    onChange={(e) =>
                      setSeleccion(
                        e.target.checked
                          ? visibles.map((f) => f.propiedad.id_propiedad)
                          : [],
                      )
                    }
                  />
                </th>
                <Encabezado clave="torre" titulo="Torre" />
                <Encabezado clave="modelo" titulo="Modelo" />
                <Encabezado clave="numero" titulo="No." />
                <Encabezado clave="nivel" titulo="Nivel" alineado="right" />
                <Encabezado clave="vista" titulo="Vista" />
                <Encabezado clave="area_int" titulo="Área Int." alineado="right" />
                <Encabezado clave="area_pond" titulo="Área Pond." alineado="right" />
                <Encabezado clave="cajones" titulo="Cajones" />
                <Encabezado clave="factores" titulo="Factores" alineado="right" />
                <Encabezado clave="exento" titulo="Exento" alineado="right" />
                <Encabezado clave="gravado" titulo="Gravado" alineado="right" />
                <Encabezado clave="precio_calculado" titulo="Precio Calculado" alineado="right" />
                <Encabezado clave="precio_m2_calc" titulo="$/m² Calc." alineado="right" />
                <Encabezado clave="precio_actual" titulo="Precio Actual" alineado="right" />
                <Encabezado clave="precio_m2_actual" titulo="$/m² Actual" alineado="right" />
                {modoVersion === "borrador" && publicada && (
                  <>
                    <Encabezado clave="precio_publicado" titulo="Precio publicado" alineado="right" />
                    <Encabezado clave="delta_vs_publicado" titulo="Δ vs. publicado" alineado="right" />
                  </>
                )}
                <Encabezado clave="delta" titulo="Delta" alineado="right" />
                <Encabezado clave="delta_m2" titulo="Δ $/m²" alineado="right" />
                <Encabezado clave="estatus" titulo="Estatus" />
                <Encabezado clave="alertas" titulo="Alertas" />
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={24} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No hay propiedades que coincidan con los filtros aplicados.
                  </td>
                </tr>
              )}
              {visibles.map((f) => {
                const conOverride = !!overrides[f.propiedad.id_propiedad];
                const critica = f.alertas.some((a) => a.severidad === "critica");
                const advertencias = f.alertas.filter((a) => a.severidad !== "informativa");
                const d = f.desglose;
                const sinActual = f.propiedad.precio_lista_actual === 0;
                return (
                  <tr
                    key={f.propiedad.id_propiedad}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="p-0">
                      <div
                        className={cn(
                          "h-9 w-[3px]",
                          critica
                            ? "bg-destructive"
                            : conOverride
                              ? "bg-primary"
                              : "bg-transparent",
                        )}
                      />
                    </td>
                    <td className="sticky left-0 z-10 bg-background px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary align-middle"
                        aria-label={`Seleccionar unidad ${f.propiedad.numero}`}
                        disabled={enPublicada}
                        checked={seleccion.includes(f.propiedad.id_propiedad)}
                        onChange={() => toggleSeleccion(f.propiedad.id_propiedad)}
                      />
                    </td>
                    <Celda clave="torre" className="text-foreground">
                      {f.torre?.nombre ?? "—"}
                    </Celda>
                    <Celda clave="modelo">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {f.modelo?.nombre ?? "—"}
                      </span>
                    </Celda>
                    <Celda clave="numero" className="font-semibold text-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        {(d.motivo_bloqueo === "oferta_vigente" ||
                          d.motivo_bloqueo === "conversion_pendiente") &&
                          (() => {
                            const oferta = ofertas.find(
                              (o) =>
                                o.id_propiedad === f.propiedad.id_propiedad &&
                                (d.motivo_bloqueo === "oferta_vigente"
                                  ? o.estado === "vigente"
                                  : o.estado === "convertida"),
                            );
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <FileClock className="size-3.5 text-amber-600" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs tabular-nums">
                                  {oferta ? (
                                    <>
                                      Precio ofertado: {formatoMoneda(oferta.precio_ofertado)}
                                      <br />
                                      Vence: {formatoFechaCorta(oferta.vence_en)}
                                    </>
                                  ) : (
                                    "Unidad con oferta relacionada."
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()}
                        {f.propiedad.numero}
                        {d.bloqueada_para_reprecio && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Lock className="size-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              Unidad {f.propiedad.estatus.toLowerCase()}: su precio no
                              puede modificarse.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                    </Celda>
                    <Celda clave="nivel" className="text-right text-foreground tabular-nums">
                      {f.propiedad.nivel}
                    </Celda>
                    <Celda clave="vista" className="text-foreground">
                      {f.propiedad.vista}
                    </Celda>
                    <Celda clave="area_int" className="text-right text-foreground tabular-nums">
                      {formatoM2(f.propiedad.m2_interiores)}
                    </Celda>
                    <Celda clave="area_pond" className="text-right text-foreground tabular-nums">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="underline decoration-dotted underline-offset-4">
                            {formatoM2(d.area_ponderada)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="tabular-nums">
                          <div>Interior: {formatoM2(f.propiedad.m2_interiores)}</div>
                          <div>
                            Exterior ponderado: {formatoM2(f.propiedad.m2_exteriores * motor.k_ext)}
                          </div>
                          <div>
                            Loft ponderado: {formatoM2(f.propiedad.m2_loft * motor.k_loft)}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Celda>
                    <Celda clave="cajones">
                      <span className="inline-flex items-center gap-1.5 text-foreground tabular-nums">
                        <Car className="size-3.5 text-muted-foreground" />
                        {f.propiedad.num_cajones}
                        {f.propiedad.tipo_cajon === "tandem" && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            Tándem
                          </span>
                        )}
                      </span>
                    </Celda>
                    <Celda clave="factores" className="text-right text-foreground tabular-nums">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="underline decoration-dotted underline-offset-4">
                            {formatoMultiplicador(f.productoFactores)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="tabular-nums">
                          <div>Torre: {formatoMultiplicador(d.f_torre)}</div>
                          <div>Nivel: {formatoMultiplicador(d.f_nivel)}</div>
                          <div>Vista: {formatoMultiplicador(d.f_vista)}</div>
                          <div>Orientación: {formatoMultiplicador(d.f_orientacion)}</div>
                          <div>Extras: {formatoMultiplicador(d.f_extras)}</div>
                          <div>Tamaño: {formatoMultiplicador(d.f_tamano)}</div>
                        </TooltipContent>
                      </Tooltip>
                    </Celda>
                    <Celda clave="exento" className="text-right text-foreground tabular-nums">
                      {enPublicada
                        ? excluidosPublicada.has(f.propiedad.id_propiedad)
                          ? "—"
                          : formatoMoneda(
                              preciosPublicados[f.propiedad.id_propiedad]?.componente_exento ?? 0,
                            )
                        : formatoMoneda(d.componente_exento)}
                    </Celda>
                    <Celda clave="gravado" className="text-right tabular-nums">
                      {(() => {
                        const gravado = enPublicada
                          ? (preciosPublicados[f.propiedad.id_propiedad]?.componente_gravado ?? 0)
                          : d.componente_gravado;
                        return enPublicada && excluidosPublicada.has(f.propiedad.id_propiedad) ? (
                          <span className="text-muted-foreground">—</span>
                        ) : gravado === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="text-foreground">{formatoMoneda(gravado)}</span>
                        );
                      })()}
                    </Celda>
                    <Celda
                      clave="precio_calculado"
                      className="text-right font-semibold text-foreground tabular-nums"
                    >
                      {enPublicada && excluidosPublicada.has(f.propiedad.id_propiedad) ? (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-normal text-amber-700">
                          No incluida en esta versión
                        </span>
                      ) : enPublicada ? (
                        formatoMoneda(preciosPublicados[f.propiedad.id_propiedad]?.precio_lista ?? 0)
                      ) : (
                        formatoMoneda(d.precio_lista)
                      )}
                    </Celda>
                    <Celda clave="precio_m2_calc" className="text-right text-foreground tabular-nums">
                      {(() => {
                        const precioBase = enPublicada
                          ? preciosPublicados[f.propiedad.id_propiedad]?.precio_lista
                          : d.precio_lista;
                        if (enPublicada && excluidosPublicada.has(f.propiedad.id_propiedad)) return "—";
                        return d.area_ponderada > 0 && precioBase != null
                          ? formatoMoneda(precioBase / d.area_ponderada)
                          : "—";
                      })()}
                    </Celda>
                    <Celda clave="precio_actual" className="text-right text-muted-foreground tabular-nums">
                      {sinActual ? "—" : formatoMoneda(f.propiedad.precio_lista_actual)}
                    </Celda>
                    <Celda clave="precio_m2_actual" className="text-right text-muted-foreground tabular-nums">
                      {sinActual || d.area_ponderada <= 0
                        ? "—"
                        : formatoMoneda(f.propiedad.precio_lista_actual / d.area_ponderada)}
                    </Celda>
                    {modoVersion === "borrador" && publicada && (() => {
                      const excluidaPub = excluidosPublicada.has(f.propiedad.id_propiedad);
                      const pv = preciosPublicados[f.propiedad.id_propiedad];
                      const precioPub = pv?.precio_lista ?? null;
                      const deltaPub =
                        precioPub != null ? d.precio_lista - precioPub : null;
                      const deltaPubPct =
                        precioPub && precioPub > 0 ? (deltaPub! / precioPub) * 100 : null;
                      return (
                        <>
                          <Celda clave="precio_publicado" className="text-right text-foreground tabular-nums">
                            {excluidaPub || precioPub == null ? "—" : formatoMoneda(precioPub)}
                          </Celda>
                          <Celda clave="delta_vs_publicado" className="text-right tabular-nums">
                            {d.motivo_bloqueo === "oferta_vigente" ? (
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">
                                Oferta vigente
                              </span>
                            ) : d.motivo_bloqueo === "conversion_pendiente" ? (
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">
                                Conversión pendiente
                              </span>
                            ) : excluidaPub || precioPub == null || deltaPub == null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs",
                                  Math.abs(deltaPub) < 0.5
                                    ? "bg-muted text-muted-foreground"
                                    : deltaPub > 0
                                      ? "bg-primary/10 text-primary"
                                      : "bg-destructive/10 text-destructive",
                                )}
                              >
                                {formatoMoneda(deltaPub)}
                                {deltaPubPct != null && ` (${formatoPorcentaje(deltaPubPct)})`}
                              </span>
                            )}
                          </Celda>
                        </>
                      );
                    })()}
                    <Celda clave="delta" className="text-right tabular-nums">
                      {sinActual ? (
                        <span className="text-muted-foreground">—</span>
                      ) : Math.abs(d.delta_pct) < 0.1 ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Sin cambio
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            d.delta_pct > 0
                              ? "bg-primary/10 text-primary"
                              : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {formatoPorcentaje(d.delta_pct)}
                        </span>
                      )}
                    </Celda>
                    <Celda clave="delta_m2" className="text-right tabular-nums">
                      {sinActual || d.area_ponderada <= 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="text-foreground">
                          {formatoMoneda(d.delta_vs_actual / d.area_ponderada)}
                        </span>
                      )}
                    </Celda>
                    <Celda clave="estatus">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          f.propiedad.estatus === "Disponible"
                            ? "border-primary/40 text-primary"
                            : f.propiedad.estatus === "Apartada"
                              ? "border-amber-500/50 text-amber-600"
                              : "border-border text-muted-foreground",
                        )}
                      >
                        {f.propiedad.estatus}
                      </span>
                    </Celda>
                    <Celda clave="alertas">
                      {advertencias.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="relative inline-flex">
                              {critica ? (
                                <CircleAlert className="size-4 text-destructive" />
                              ) : (
                                <TriangleAlert className="size-4 text-amber-600" />
                              )}
                              <span className="absolute -right-2 -top-1.5 rounded-full bg-muted px-1 text-[10px] text-muted-foreground tabular-nums">
                                {advertencias.length}
                              </span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm space-y-1">
                            {advertencias.map((a, i) => (
                              <div key={`${a.codigo}-${i}`}>
                                <span className="font-mono text-[11px]">{a.codigo}</span> —{" "}
                                {a.mensaje}
                              </div>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </Celda>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Abrir detalle de la unidad ${f.propiedad.numero}`}
                        disabled={enPublicada}
                        onClick={() => {
                          setDetalle(f);
                          setAbierto(true);
                        }}
                      >
                        <PanelRightOpen className="size-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border bg-muted/40 font-semibold">
              <tr>
                <td className="p-0" />
                <td />
                <td className="whitespace-nowrap px-3 py-2 text-sm text-foreground" colSpan={1}>
                  Totales{" "}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    Libro: Comercial
                  </span>
                </td>
                {visible("modelo") && <td />}
                {visible("numero") && <td />}
                {visible("nivel") && <td />}
                {visible("vista") && <td />}
                {visible("area_int") && <td />}
                {visible("area_pond") && (
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">
                    {formatoM2(totales.areaPond)}
                  </td>
                )}
                {visible("cajones") && <td />}
                {visible("factores") && <td />}
                {visible("exento") && (
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">
                    {formatoMoneda(totales.exento)}
                  </td>
                )}
                {visible("gravado") && (
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">
                    {formatoMoneda(totales.gravado)}
                  </td>
                )}
                {visible("precio_calculado") && (
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">
                    {formatoMoneda(totales.calculado)}
                  </td>
                )}
                {visible("precio_m2_calc") && <td />}
                {visible("precio_actual") && (
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">
                    {totales.actual > 0 ? formatoMoneda(totales.actual) : "—"}
                  </td>
                )}
                {visible("precio_m2_actual") && <td />}
                {visible("delta") && (
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">
                    {totales.actual > 0 ? formatoPorcentaje(deltaTotalPct) : "—"}
                  </td>
                )}
                {visible("delta_m2") && <td />}
                {visible("estatus") && <td />}
                {visible("alertas") && <td />}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filas por página</span>
          <Select
            value={String(tamanoPagina)}
            onValueChange={(v) => setTamanoPagina(Number(v) as 25 | 50 | 100)}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={paginaActual === 1}
            onClick={() => setPagina(paginaActual - 1)}
          >
            Anterior
          </Button>
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
            <Button
              key={n}
              variant={n === paginaActual ? "default" : "ghost"}
              size="sm"
              className="tabular-nums"
              onClick={() => setPagina(n)}
            >
              {n}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={paginaActual === totalPaginas}
            onClick={() => setPagina(paginaActual + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
      </>
      ) : (
        <Card className="p-4">
          <PlanoTorre
            filas={filtradas}
            metrica={metricaPlano}
            onMetrica={setMetricaPlano}
            torre={torrePlano}
            onTorre={setTorrePlano}
            torres={torresProyecto.map((t) => ({ id: t.id_torre, nombre: t.nombre }))}
            onSeleccionar={(f) => {
              setDetalle(f);
              setAbierto(true);
            }}
          />
        </Card>
      )}

      <PanelDetallePrecio
        fila={detalle}
        motor={motor}
        proyecto={nombreProyecto}
        abierto={abierto}
        onOpenChange={setAbierto}
      />

      <ModalOverrideMasivo
        abierto={masivoAbierto}
        onOpenChange={setMasivoAbierto}
        unidades={filtradas
          .filter((f) => seleccion.includes(f.propiedad.id_propiedad))
          .map((f) => ({ propiedad: f.propiedad, desglose: f.desglose }))}
        onAplicado={limpiarSeleccion}
      />

      <DialogoPublicacion abierto={publicando} onOpenChange={setPublicando} />

      {import.meta.env.DEV && <PanelDemoPrecios />}
    </div>
    </TooltipProvider>
  );
}

export default TablaPrecios;
