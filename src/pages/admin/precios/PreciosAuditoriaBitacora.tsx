import { Fragment, useEffect, useMemo, useState } from "react";

import {
  ChevronDown,
  ChevronUp,
  Columns3,
  Copy,
  Download,
  History,
  Link2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  TriangleAlert,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useBitacoraStore } from "@/features/precios/stores/bitacoraStore";
import { useMotorStore } from "@/features/precios/stores/motorStore";
import {
  CATEGORIAS,
  ETIQUETA_EVENTO,
  TIPOS_EVENTO,
  categoriaDe,
  exportarCSVAuditado,
  ACTOR_DEMO,
  type CategoriaEvento,
} from "@/features/precios/services/auditoria";
import { DialogoDiagnosticoCaptura } from "@/features/precios/components/DialogoDiagnosticoCaptura";
import { serializarDeterminista } from "@/features/precios/engine/bitacora";
import type { ResultadoVerificacion } from "@/features/precios/engine/bitacora";
import type { EventoAuditoria } from "@/features/precios/types/dominio";
import { formatoFechaHora, formatoMoneda } from "@/features/precios/lib/formato";

  validateSearch: (s: Record<string, unknown>): { unidad?: string } =>
    typeof s["unidad"] === "string" ? { unidad: s["unidad"] as string } : {},

const COLUMNAS = [
  { clave: "secuencia", titulo: "#" },
  { clave: "fecha", titulo: "Fecha y hora" },
  { clave: "actor", titulo: "Actor" },
  { clave: "tipo", titulo: "Tipo" },
  { clave: "entidad", titulo: "Entidad" },
  { clave: "cambio", titulo: "Cambio" },
  { clave: "impacto", titulo: "Impacto" },
  { clave: "cadena", titulo: "Cadena" },
] as const;

const COLOR_CATEGORIA: Record<CategoriaEvento, string> = {
  Motor: "bg-slate-100 text-slate-700",
  Calibración: "bg-sky-50 text-sky-700",
  Precios: "bg-emerald-50 text-emerald-700",
  Esquemas: "bg-violet-50 text-violet-700",
  Escenarios: "bg-indigo-50 text-indigo-700",
  Ofertas: "bg-amber-50 text-amber-700",
  Versiones: "bg-teal-50 text-teal-700",
  Exportaciones: "bg-zinc-100 text-zinc-700",
};

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function comoTexto(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("es-MX", { maximumFractionDigits: 6 });
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "string") return v;
  return serializarDeterminista(v);
}

/** Resumen de una línea del cambio del evento. */
function resumenCambio(ev: EventoAuditoria): string {
  const a = ev.antes;
  const d = ev.despues;
  if (typeof a === "number" && typeof d === "number") {
    return `${comoTexto(a)} → ${comoTexto(d)}`;
  }
  if (esObjetoPlano(a) && esObjetoPlano(d)) {
    const cambiadas = Object.keys({ ...a, ...d }).filter(
      (k) => serializarDeterminista(a[k]) !== serializarDeterminista(d[k]),
    );
    if (cambiadas.length === 0) return "—";
    const k = cambiadas[0]!;
    const base = `${k}: ${comoTexto(a[k])} → ${comoTexto(d[k])}`;
    return cambiadas.length > 1 ? `${base} (+${cambiadas.length - 1})` : base;
  }
  if (a === null && esObjetoPlano(d)) {
    const claves = Object.keys(d).slice(0, 2);
    return claves.map((k) => `${k}: ${comoTexto(d[k])}`).join(" · ") || "—";
  }
  if (d === null && a !== null) return `${comoTexto(a)} → —`;
  return "—";
}

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

function ParesClaveValor({
  objeto,
  cambiadas,
}: {
  objeto: unknown;
  cambiadas: Set<string>;
}) {
  if (objeto === null || objeto === undefined) {
    return <p className="text-sm text-muted-foreground">Sin datos.</p>;
  }
  if (!esObjetoPlano(objeto)) {
    return (
      <p className="text-sm text-foreground tabular-nums">{comoTexto(objeto)}</p>
    );
  }
  const entradas = Object.entries(objeto);
  if (entradas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos.</p>;
  }
  return (
    <dl className="space-y-0.5">
      {entradas.map(([k, v]) => (
        <div
          key={k}
          className={cn(
            "flex items-start justify-between gap-3 rounded px-2 py-1 text-sm",
            cambiadas.has(k) ? "bg-amber-50" : "text-muted-foreground/70",
          )}
        >
          <dt className="shrink-0 text-xs">{k}</dt>
          <dd className="break-all text-right tabular-nums text-foreground">
            {comoTexto(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Bitacora() {
  const search = useSearch({ from: "/admin/inventario/precios/auditoria/bitacora" });
  const eventos = useBitacoraStore((s) => s.eventos);
  const verificar = useBitacoraStore((s) => s.verificar);
  const idProyectoActivo = useMotorStore((s) => s.idProyectoActivo);

  const [avisoInicioOculto, setAvisoInicioOculto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoVerificacion | null>(null);
  const [detalleFallo, setDetalleFallo] = useState(false);
  const [diagnosticoAbierto, setDiagnosticoAbierto] = useState(false);
  const [tiposAbierto, setTiposAbierto] = useState(false);
  const [expandidos, setExpandidos] = useState<string[]>([]);
  const [columnas, setColumnas] = useState<string[]>(COLUMNAS.map((c) => c.clave));
  const [orden, setOrden] = useState<"asc" | "desc">("desc");
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(50);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipos, setTipos] = useState<string[]>([]);
  const [actor, setActor] = useState("todos");
  const [unidad, setUnidad] = useState(search.unidad ?? "");
  const [soloImpacto, setSoloImpacto] = useState(false);
  const [soloPrecios, setSoloPrecios] = useState(false);
  const [soloPublicaciones, setSoloPublicaciones] = useState(false);
  const [soloExportaciones, setSoloExportaciones] = useState(false);

  useEffect(() => {
    if (search.unidad) setUnidad(search.unidad);
  }, [search.unidad]);

  const actores = useMemo(
    () => Array.from(new Set(eventos.map((e) => e.actor.nombre))),
    [eventos],
  );

  const conteoCategoria = useMemo(() => {
    const m = new Map<CategoriaEvento, number>();
    for (const e of eventos) {
      const c = categoriaDe(e.tipo);
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [eventos]);

  const conteoTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of eventos) {
      m.set(e.tipo, (m.get(e.tipo) ?? 0) + 1);
    }
    return m;
  }, [eventos]);

  const filtrados = useMemo(() => {
    const q = unidad.trim().toLowerCase();
    const desdeMs = desde ? new Date(`${desde}T00:00:00`).getTime() : null;
    const hastaMs = hasta ? new Date(`${hasta}T23:59:59`).getTime() : null;
    const out = eventos.filter((e) => {
      const t = new Date(e.ocurrido_en).getTime();
      if (desdeMs !== null && t < desdeMs) return false;
      if (hastaMs !== null && t > hastaMs) return false;
      if (tipos.length > 0 && !tipos.includes(e.tipo)) return false;
      if (actor !== "todos" && e.actor.nombre !== actor) return false;
      if (q && !e.entidad.etiqueta.toLowerCase().includes(q) && !e.entidad.id.toLowerCase().includes(q))
        return false;
      if (soloImpacto && (e.impacto_pesos === null || e.impacto_pesos === 0)) return false;
      if (soloPrecios && categoriaDe(e.tipo) !== "Precios") return false;
      if (soloPublicaciones && e.tipo !== "version.publicada") return false;
      if (soloExportaciones && e.tipo !== "exportacion.csv") return false;
      return true;
    });
    return out.sort((a, b) =>
      orden === "asc" ? a.secuencia - b.secuencia : b.secuencia - a.secuencia,
    );
  }, [
    eventos,
    desde,
    hasta,
    tipos,
    actor,
    unidad,
    soloImpacto,
    soloPrecios,
    soloPublicaciones,
    soloExportaciones,
    orden,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamano));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * tamano, paginaActual * tamano);

  const ultimo = eventos[eventos.length - 1];
  const visible = (c: string) => columnas.includes(c);

  const limpiar = () => {
    setDesde("");
    setHasta("");
    setTipos([]);
    setActor("todos");
    setUnidad("");
    setSoloImpacto(false);
    setSoloPrecios(false);
    setSoloPublicaciones(false);
    setSoloExportaciones(false);
    setPagina(1);
  };

  const rangoRapido = (dias: number | null) => {
    if (dias === null) {
      setDesde("");
      setHasta("");
      return;
    }
    const hoy = new Date();
    const ini = new Date();
    ini.setDate(ini.getDate() - dias);
    const f = (d: Date) => d.toISOString().slice(0, 10);
    setDesde(f(dias === 0 ? hoy : ini));
    setHasta(f(hoy));
  };

  const exportar = () => {
    exportarCSVAuditado(
      {
        id_proyecto: idProyectoActivo,
        origen: "Bitácora de auditoría",
        filtros: { desde, hasta, tipos, actor, unidad },
      },
      "bitacora-precios.csv",
      [
        "Secuencia",
        "Id de evento",
        "Fecha y hora",
        "Actor",
        "Rol",
        "Proyecto",
        "Tipo",
        "Entidad",
        "Cambio",
        "Impacto en pesos",
        "Causa",
        "Descripción",
        "Libro",
        "Hash anterior",
        "Hash",
        "Antes",
        "Después",
      ],
      filtrados.map((e) => [
        e.secuencia,
        e.id_evento,
        formatoFechaHora(e.ocurrido_en),
        e.actor.nombre,
        e.actor.rol,
        e.id_proyecto,
        ETIQUETA_EVENTO[e.tipo],
        e.entidad.etiqueta,
        resumenCambio(e),
        e.impacto_pesos ?? "",
        e.motivo?.causa ?? "",
        e.motivo?.descripcion ?? "",
        e.libro,
        e.hash_anterior,
        e.hash,
        serializarDeterminista(e.antes),
        serializarDeterminista(e.despues),
      ]),
    );
  };

  const eventoFallo =
    resultado?.primerFalloEn != null
      ? (eventos.find((e) => e.secuencia === resultado.primerFalloEn) ?? null)
      : null;

  return (
    <div className="space-y-4">
      {/* SWAP POINT: retirar cuando la bitácora escriba en bitacora_precio vía Edge Function con RLS append-only. */}
      <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 text-amber-900">
        <TriangleAlert className="size-4" />
        <AlertTitle>Esta bitácora es una simulación, no evidencia.</AlertTitle>
        <AlertDescription className="text-amber-900">
          Los eventos se guardan en el navegador de este equipo: pueden borrarse, alterarse
          desde las herramientas de desarrollo y no existen para ningún otro usuario. Una
          bitácora de auditoría real vive en el servidor, es append-only por política de base
          de datos y no puede modificarse desde el cliente. No uses estos registros como
          respaldo probatorio ante una auditoría, ante PROFECO ni ante ninguna contraparte.
        </AlertDescription>
      </Alert>

      {/* SWAP POINT: retirar cuando la bitácora escriba en bitacora_precio vía Edge Function con RLS append-only. */}
      {!avisoInicioOculto && (
        <Alert className="relative">
          <History className="size-4" />
          <AlertTitle>La bitácora comienza aquí.</AlertTitle>
          <AlertDescription>
            Los cambios realizados en el módulo antes de esta entrega no emitieron eventos y
            no pueden reconstruirse. El registro es completo únicamente a partir del primer
            evento listado.
          </AlertDescription>
          <button
            type="button"
            aria-label="Descartar aviso"
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
            onClick={() => setAvisoInicioOculto(true)}
          >
            <X className="size-4" />
          </button>
        </Alert>
      )}

      <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-sm">
        <span className="text-muted-foreground">
          Eventos registrados:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {eventos.length}
          </span>
        </span>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <span className="text-muted-foreground">
          Último evento:{" "}
          <span className="text-foreground tabular-nums">
            {ultimo ? formatoFechaHora(ultimo.ocurrido_en) : "—"}
          </span>
        </span>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <span className="text-muted-foreground">
          Cadena:{" "}
          {resultado === null ? (
            <span className="text-foreground">sin verificar</span>
          ) : resultado.integra ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <ShieldCheck className="size-4" /> íntegra ·{" "}
              <span className="tabular-nums">{resultado.eventosVerificados}</span> eventos
              verificados
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-destructive">
              <ShieldAlert className="size-4" /> rota en el evento #
              <span className="tabular-nums">{resultado.primerFalloEn}</span>
            </span>
          )}
        </span>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <Button
          variant="outline"
          size="sm"
          onClick={async () => setResultado(await verificar())}
        >
          <ShieldCheck className="size-4" />
          Verificar integridad
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDiagnosticoAbierto(true)}>
          <Stethoscope className="size-4" />
          Diagnóstico de captura
        </Button>
        {resultado && !resultado.integra && (
          <Button variant="ghost" size="sm" onClick={() => setDetalleFallo(true)}>
            Ver detalle
          </Button>
        )}
      </Card>

      <Card className="gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filtros</span>
          </div>
          <button
            type="button"
            onClick={limpiar}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <X className="size-3.5" />
            Limpiar
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Actor</Label>
            <Select value={actor} onValueChange={setActor}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {actores.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Unidad</Label>
            <Input
              placeholder="Número de propiedad"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            ["Hoy", 0],
            ["Últimos 7 días", 7],
            ["Últimos 30 días", 30],
            ["Todo", null],
          ].map(([titulo, dias]) => (
            <ChipRapido
              key={titulo as string}
              activo={false}
              onClick={() => rangoRapido(dias as number | null)}
            >
              {titulo as string}
            </ChipRapido>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[13px] text-muted-foreground">Tipo de evento</Label>
          <Popover open={tiposAbierto} onOpenChange={setTiposAbierto}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal">
                {tipos.length === 0
                  ? "Todos los tipos"
                  : `${tipos.length} tipos seleccionados`}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-96 w-full overflow-y-auto p-2">
              {CATEGORIAS.map((cat) => {
                const tiposCat = TIPOS_EVENTO.filter((t) => categoriaDe(t) === cat);
                const todosSeleccionados = tiposCat.every((t) => tipos.includes(t));
                const algunoSeleccionado = tiposCat.some((t) => tipos.includes(t));
                return (
                  <div key={cat} className="mb-1 last:mb-0">
                    <div className="flex items-center gap-2 rounded-sm px-2 py-1.5">
                      <Checkbox
                        checked={
                          todosSeleccionados ? true : algunoSeleccionado ? "indeterminate" : false
                        }
                        onCheckedChange={() =>
                          setTipos((prev) =>
                            todosSeleccionados
                              ? prev.filter((t) => !tiposCat.includes(t as (typeof TIPOS_EVENTO)[number]))
                              : Array.from(new Set([...prev, ...tiposCat])),
                          )
                        }
                        id={`grupo-${cat}`}
                      />
                      <label
                        htmlFor={`grupo-${cat}`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        {cat} ({conteoCategoria.get(cat) ?? 0})
                      </label>
                    </div>
                    {tiposCat.map((t) => (
                      <div
                        key={t}
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 pl-7 hover:bg-accent"
                      >
                        <Checkbox
                          checked={tipos.includes(t)}
                          onCheckedChange={() =>
                            setTipos((prev) =>
                              prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
                            )
                          }
                          id={`tipo-${t}`}
                        />
                        <label htmlFor={`tipo-${t}`} className="flex-1 text-sm">
                          {ETIQUETA_EVENTO[t]} ({conteoTipo.get(t) ?? 0})
                        </label>
                      </div>
                    ))}
                  </div>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <ChipRapido activo={soloImpacto} onClick={() => setSoloImpacto(!soloImpacto)}>
          Solo con impacto económico
        </ChipRapido>
        <ChipRapido activo={soloPrecios} onClick={() => setSoloPrecios(!soloPrecios)}>
          Solo cambios de precio
        </ChipRapido>
        <ChipRapido
          activo={soloPublicaciones}
          onClick={() => setSoloPublicaciones(!soloPublicaciones)}
        >
          Solo publicaciones
        </ChipRapido>
        <ChipRapido
          activo={soloExportaciones}
          onClick={() => setSoloExportaciones(!soloExportaciones)}
        >
          Solo exportaciones
        </ChipRapido>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          Mostrando {visibles.length} de {filtrados.length} eventos
        </p>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="size-4" />
                Columnas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNAS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.clave}
                  checked={visible(c.clave)}
                  onCheckedChange={() =>
                    setColumnas((prev) =>
                      prev.includes(c.clave)
                        ? prev.filter((x) => x !== c.clave)
                        : [...prev, c.clave],
                    )
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.titulo}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="size-4" />
            Exportar bitácora a CSV
          </Button>
        </div>
      </div>

      {eventos.length === 0 ? (
        <Card className="flex min-h-[380px] flex-col items-center justify-center gap-3 p-10 text-center">
          <History className="size-12 text-muted-foreground/40" strokeWidth={1.5} />
          <h2 className="text-xl font-semibold text-foreground">Sin eventos registrados</h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            La bitácora registrará automáticamente cada cambio de parámetro, override,
            calibración, esquema, oferta y publicación. Realiza cualquier cambio en el módulo
            para ver el primer evento.
          </p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 border-b border-border bg-muted">
                  <tr>
                    {visible("secuencia") && (
                      <th
                        className="sticky left-0 z-10 cursor-pointer bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground select-none"
                        onClick={() => setOrden(orden === "asc" ? "desc" : "asc")}
                      >
                        <span className="inline-flex items-center gap-1">
                          #
                          {orden === "asc" ? (
                            <ChevronUp className="size-3" />
                          ) : (
                            <ChevronDown className="size-3" />
                          )}
                        </span>
                      </th>
                    )}
                    {visible("fecha") && (
                      <th className="sticky left-16 z-10 whitespace-nowrap bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Fecha y hora
                      </th>
                    )}
                    {COLUMNAS.slice(2).map(
                      (c) =>
                        visible(c.clave) && (
                          <th
                            key={c.clave}
                            className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                          >
                            {c.titulo}
                          </th>
                        ),
                    )}
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 && (
                    <tr>
                      <td
                        colSpan={COLUMNAS.length + 1}
                        className="px-3 py-10 text-center text-sm text-muted-foreground"
                      >
                        Ningún evento coincide con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                  {visibles.map((e) => {
                    const abierto = expandidos.includes(e.id_evento);
                    const cat = categoriaDe(e.tipo);
                    const cambiadas = new Set<string>(
                      esObjetoPlano(e.antes) || esObjetoPlano(e.despues)
                        ? Object.keys({
                            ...(esObjetoPlano(e.antes) ? e.antes : {}),
                            ...(esObjetoPlano(e.despues) ? e.despues : {}),
                          }).filter(
                            (k) =>
                              serializarDeterminista(
                                esObjetoPlano(e.antes) ? e.antes[k] : null,
                              ) !==
                              serializarDeterminista(
                                esObjetoPlano(e.despues) ? e.despues[k] : null,
                              ),
                          )
                        : [],
                    );
                    return (
                      <Fragment key={e.id_evento}>
                        <tr
                          className="border-b border-border last:border-0 hover:bg-muted/30"
                        >
                          {visible("secuencia") && (
                            <td className="sticky left-0 z-10 bg-background px-3 py-2 font-mono text-sm text-muted-foreground tabular-nums">
                              {e.secuencia}
                            </td>
                          )}
                          {visible("fecha") && (
                            <td className="sticky left-16 z-10 whitespace-nowrap bg-background px-3 py-2 text-sm text-foreground tabular-nums">
                              {formatoFechaHora(e.ocurrido_en)}
                            </td>
                          )}
                          {visible("actor") && (
                            <td className="whitespace-nowrap px-3 py-2 text-sm">
                              <div className="flex items-center gap-1.5 text-foreground">
                                {e.actor.nombre}
                                {e.actor.id_persona === ACTOR_DEMO.id_persona && (
                                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                                    Demo
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {e.actor.rol}
                              </div>
                            </td>
                          )}
                          {visible("tipo") && (
                            <td className="whitespace-nowrap px-3 py-2 text-sm">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs",
                                  COLOR_CATEGORIA[cat],
                                )}
                              >
                                {ETIQUETA_EVENTO[e.tipo]}
                              </span>
                            </td>
                          )}
                          {visible("entidad") && (
                            <td className="whitespace-nowrap px-3 py-2 text-sm text-foreground">
                              {e.entidad.etiqueta}
                            </td>
                          )}
                          {visible("cambio") && (
                            <td className="max-w-xs truncate px-3 py-2 text-sm text-foreground tabular-nums">
                              {resumenCambio(e)}
                            </td>
                          )}
                          {visible("impacto") && (
                            <td className="whitespace-nowrap px-3 py-2 text-sm tabular-nums">
                              {e.impacto_pesos === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-xs",
                                    e.impacto_pesos >= 0
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-red-50 text-red-700",
                                  )}
                                >
                                  {e.impacto_pesos >= 0 ? "+" : "−"}
                                  {formatoMoneda(Math.abs(e.impacto_pesos))}
                                </span>
                              )}
                            </td>
                          )}
                          {visible("cadena") && (
                            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Link2 className="size-3" />
                                <code className="font-mono tabular-nums">
                                  {e.hash.slice(0, 12)}
                                </code>
                              </span>
                            </td>
                          )}
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={`Expandir evento ${e.secuencia}`}
                              onClick={() =>
                                setExpandidos((prev) =>
                                  prev.includes(e.id_evento)
                                    ? prev.filter((x) => x !== e.id_evento)
                                    : [...prev, e.id_evento],
                                )
                              }
                            >
                              {abierto ? (
                                <ChevronUp className="size-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="size-4 text-muted-foreground" />
                              )}
                            </Button>
                          </td>
                        </tr>
                        {abierto && (
                          <tr className="border-b border-border bg-muted/20">
                            <td colSpan={COLUMNAS.length + 1} className="px-4 py-4">
                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold text-foreground">
                                    Identificación
                                  </h4>
                                  <dl className="space-y-1 text-sm">
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-muted-foreground">Id de evento</dt>
                                      <dd className="font-mono text-xs tabular-nums">
                                        {e.id_evento}
                                      </dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-muted-foreground">Secuencia</dt>
                                      <dd className="font-mono tabular-nums">{e.secuencia}</dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-muted-foreground">Proyecto</dt>
                                      <dd>{e.id_proyecto}</dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-muted-foreground">Libro</dt>
                                      <dd>{e.libro}</dd>
                                    </div>
                                  </dl>

                                  <h4 className="pt-2 text-sm font-semibold text-foreground">
                                    Cadena
                                  </h4>
                                  {(
                                    [
                                      ["hash_anterior", e.hash_anterior],
                                      ["hash", e.hash],
                                    ] as const
                                  ).map(([etiqueta, valor]) => (
                                    <div
                                      key={etiqueta}
                                      className="flex items-center justify-between gap-2"
                                    >
                                      <span className="text-xs text-muted-foreground">
                                        {etiqueta}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <code className="break-all font-mono text-[11px] tabular-nums text-foreground">
                                          {valor}
                                        </code>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="size-6"
                                          aria-label={`Copiar ${etiqueta}`}
                                          onClick={() =>
                                            navigator.clipboard?.writeText(valor)
                                          }
                                        >
                                          <Copy className="size-3" />
                                        </Button>
                                      </span>
                                    </div>
                                  ))}

                                  {e.motivo && (
                                    <>
                                      <h4 className="pt-2 text-sm font-semibold text-foreground">
                                        Motivo
                                      </h4>
                                      <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                        {e.motivo.causa}
                                      </span>
                                      <p className="text-sm text-foreground">
                                        {e.motivo.descripcion}
                                      </p>
                                    </>
                                  )}
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                  <div>
                                    <h4 className="mb-1 text-sm font-semibold text-foreground">
                                      Antes
                                    </h4>
                                    <ParesClaveValor objeto={e.antes} cambiadas={cambiadas} />
                                  </div>
                                  <div>
                                    <h4 className="mb-1 text-sm font-semibold text-foreground">
                                      Después
                                    </h4>
                                    <ParesClaveValor
                                      objeto={e.despues}
                                      cambiadas={cambiadas}
                                    />
                                  </div>
                                </div>
                              </div>

                              {e.tipo === "oferta.vencida" && (
                                <div className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                                  Vencimiento detectado de forma diferida. La fecha corresponde
                                  al momento real de expiración.
                                </div>
                              )}

                              {e.tipo === "precio.override_masivo" &&
                                esObjetoPlano(e.despues) &&
                                Array.isArray(e.despues["unidades"]) && (
                                  <div className="mt-4">
                                    <h4 className="mb-1 text-sm font-semibold text-foreground">
                                      Unidades afectadas
                                    </h4>
                                    <div className="flex flex-wrap gap-1.5">
                                      {(e.despues["unidades"] as string[]).map((u) => (
                                        <span
                                          key={u}
                                          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums"
                                        >
                                          {u}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filas por página</span>
              <Select
                value={String(tamano)}
                onValueChange={(v) => {
                  setTamano(Number(v));
                  setPagina(1);
                }}
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
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={paginaActual === 1}
                onClick={() => setPagina(paginaActual - 1)}
              >
                Anterior
              </Button>
              <span className="px-2 text-sm text-muted-foreground tabular-nums">
                {paginaActual} / {totalPaginas}
              </span>
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
      )}

      <DialogoDiagnosticoCaptura open={diagnosticoAbierto} onOpenChange={setDiagnosticoAbierto} />

      <Dialog open={detalleFallo} onOpenChange={setDetalleFallo}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cadena rota en el evento #{resultado?.primerFalloEn}</DialogTitle>
            <DialogDescription>{resultado?.detalle}</DialogDescription>
          </DialogHeader>
          {eventoFallo && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Id de evento</span>
                <code className="font-mono text-xs">{eventoFallo.id_evento}</code>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Tipo</span>
                <span>{ETIQUETA_EVENTO[eventoFallo.tipo]}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Entidad</span>
                <span>{eventoFallo.entidad.etiqueta}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">hash_anterior</span>
                <code className="break-all font-mono text-[11px]">
                  {eventoFallo.hash_anterior}
                </code>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">hash</span>
                <code className="break-all font-mono text-[11px]">{eventoFallo.hash}</code>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Bitacora;
