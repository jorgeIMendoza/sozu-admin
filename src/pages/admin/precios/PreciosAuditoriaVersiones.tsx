import { useMemo, useState } from "react";

import {
  ArrowDownRight,
  ArrowUpRight,
  Archive,
  Download,
  FileClock,
  FilePlus2,
  History,
  MoreHorizontal,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useMotorStore } from "@/features/precios/stores/motorStore";
import { useListaStore } from "@/features/precios/stores/listaStore";
import { useVersionesStore } from "@/features/precios/stores/versionesStore";
import { compararVersiones, construirDatosVersion, calcularRestauracionBorrador } from "@/features/precios/lib/versiones";
import { usePreciosProyecto } from "@/features/precios/hooks/usePreciosProyecto";
import { DialogoPublicacion } from "@/features/precios/components/DialogoPublicacion";
import { registrarEvento, exportarCSVAuditado } from "@/features/precios/services/auditoria";
import { formatoFechaHora, formatoFechaCorta, formatoMoneda } from "@/features/precios/lib/formato";
import { PROPIEDADES_POR_ID } from "@/features/precios/mocks/inventario";
import type { VersionLista } from "@/features/precios/types/dominio";

function Versiones() {
  const idProyecto = useMotorStore((s) => s.idProyectoActivo);
  const versionesPorProyecto = useVersionesStore((s) => s.versionesPorProyecto);
  const crearBorrador = useVersionesStore((s) => s.crearBorrador);
  const archivar = useVersionesStore((s) => s.archivar);
  const aplicarOverride = useListaStore((s) => s.aplicarOverride);
  const aplicarMotorCalibrado = useMotorStore((s) => s.aplicarMotorCalibrado);
  const { motor, propiedades, desgloses } = usePreciosProyecto();

  const [publicando, setPublicando] = useState(false);
  const [detalle, setDetalle] = useState<VersionLista | null>(null);
  const [restaurando, setRestaurando] = useState<VersionLista | null>(null);
  const [vista, setVista] = useState<"lista" | "comparar">("lista");

  const versiones = useMemo(
    () => [...(versionesPorProyecto[idProyecto] ?? [])].sort((a, b) => b.numero - a.numero),
    [versionesPorProyecto, idProyecto],
  );
  const publicadaActual = versiones.find((v) => v.estado === "publicada") ?? null;
  const todas = versiones;
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [filtroDelta, setFiltroDelta] = useState<"todas" | "con_cambio" | "aumentos" | "disminuciones">("todas");

  const a = todas.find((v) => v.id_version === idA) ?? null;
  const b = todas.find((v) => v.id_version === idB) ?? null;
  const comparacion = useMemo(() => (a && b ? compararVersiones(a, b) : null), [a, b]);

  const unidadesComparacion = useMemo(() => {
    if (!comparacion) return [];
    let out = [...comparacion.unidades];
    if (filtroDelta === "con_cambio") out = out.filter((u) => Math.abs(u.delta) > 0.01);
    if (filtroDelta === "aumentos") out = out.filter((u) => u.delta > 0.01);
    if (filtroDelta === "disminuciones") out = out.filter((u) => u.delta < -0.01);
    return out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  }, [comparacion, filtroDelta]);

  const crear = () => {
    const porId = new Map(desgloses.map((d) => [d.id_propiedad, d]));
    const entradas = propiedades
      .map((p) => ({ propiedad: p, desglose: porId.get(p.id_propiedad)! }))
      .filter((e) => e.desglose);
    const datos = construirDatosVersion({ idProyecto, nombre: "", motor, entradas });
    const version = crearBorrador({ ...datos, nombre: `Borrador · ${formatoFechaCorta(new Date().toISOString())}` });
    registrarEvento({
      id_proyecto: idProyecto,
      tipo: "version.creada",
      entidad: { tipo: "version", id: version.id_version, etiqueta: `v${version.numero} · ${version.nombre}` },
      antes: null,
      despues: { unidades: version.unidades_incluidas.length, valor_total: version.valor_total },
    });
  };

  const archivarVersion = (v: VersionLista) => {
    archivar(idProyecto, v.id_version);
    registrarEvento({
      id_proyecto: idProyecto,
      tipo: "version.archivada",
      entidad: { tipo: "version", id: v.id_version, etiqueta: `v${v.numero} · ${v.nombre}` },
      antes: { estado: v.estado },
      despues: { estado: "archivada" },
    });
  };

  const confirmarRestauracion = () => {
    if (!restaurando) return;
    const { overrides, motor: snapshot } = calcularRestauracionBorrador(restaurando);
    aplicarMotorCalibrado(snapshot);
    for (const o of overrides) {
      aplicarOverride(o.id_propiedad, o.precio, o.causa, o.descripcion, o.precio_motor_al_aplicar);
    }
    registrarEvento({
      id_proyecto: idProyecto,
      tipo: "precio.override_masivo",
      entidad: { tipo: "version", id: restaurando.id_version, etiqueta: `Restaurar desde v${restaurando.numero}` },
      antes: null,
      despues: { unidades_afectadas: overrides.length, version_origen: `v${restaurando.numero}` },
      motivo: {
        causa: "Restauración de precios al borrador",
        descripcion: `Se copiaron precios y parámetros del motor de la versión v${restaurando.numero} al borrador de trabajo, sin alterar versiones publicadas.`,
      },
    });
    setRestaurando(null);
  };

  const exportarComparacion = () => {
    if (!a || !b || !comparacion) return;
    exportarCSVAuditado(
      { id_proyecto: idProyecto, origen: `Comparación v${a.numero} vs v${b.numero}` },
      `comparacion-v${a.numero}-v${b.numero}.csv`,
      ["Unidad", `v${a.numero}`, `v${b.numero}`, "Delta", "Delta %"],
      unidadesComparacion.map((u) => [
        PROPIEDADES_POR_ID[u.id_propiedad]?.numero ?? u.id_propiedad,
        u.precioA ?? "",
        u.precioB ?? "",
        u.delta.toFixed(2),
        u.deltaPct.toFixed(2),
      ]),
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Versiones de lista</h2>
          <p className="text-sm text-muted-foreground">
            Cada publicación congela los precios del proyecto. Las versiones publicadas son
            inmutables.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {publicadaActual
              ? `Versión publicada actual: v${publicadaActual.numero} · ${formatoFechaCorta(publicadaActual.publicada_en ?? publicadaActual.creada_en)}`
              : "Sin versión publicada"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={crear}>
            <FilePlus2 className="size-4" />
            Crear borrador
          </Button>
          <Button onClick={() => setPublicando(true)}>
            <Upload className="size-4" />
            Publicar versión
          </Button>
        </div>
      </div>

      {versiones.length === 0 ? (
        <Card className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-10 text-center">
          <FileClock className="size-12 text-muted-foreground/40" strokeWidth={1.5} />
          <h3 className="text-xl font-semibold text-foreground">Ninguna versión publicada</h3>
          <p className="max-w-lg text-sm text-muted-foreground">
            Los precios que ves en la tabla son un borrador de trabajo. Publica una versión
            para congelarlos como la lista vigente del proyecto.
          </p>
        </Card>
      ) : detalle ? (
        <Card className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                v{detalle.numero} · {detalle.nombre}
              </h3>
              <p className="text-sm text-muted-foreground">
                Creada {formatoFechaHora(detalle.creada_en)} por {detalle.creada_por.nombre}
                {detalle.publicada_en &&
                  ` · Publicada ${formatoFechaHora(detalle.publicada_en)} por ${detalle.publicada_por?.nombre}`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setDetalle(null)}>
              Cerrar
            </Button>
          </div>
          {detalle.estado === "publicada" && (
            <Alert>
              <AlertDescription>
                Versión publicada el {formatoFechaHora(detalle.publicada_en!)} por{" "}
                {detalle.publicada_por?.nombre}. Su contenido es inmutable.
              </AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-foreground">{detalle.notas || "Sin notas."}</p>
          <div className="max-h-96 overflow-auto rounded-md border border-border">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {["Unidad", "Precio de lista"].map((t) => (
                    <th key={t} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(detalle.precios).map(([id, p]) => (
                  <tr key={id} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 text-sm text-foreground tabular-nums">
                      {PROPIEDADES_POR_ID[id]?.numero ?? id}
                    </td>
                    <td className="px-3 py-1.5 text-sm text-foreground tabular-nums">
                      {formatoMoneda(p.precio_lista)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detalle.unidades_excluidas.length > 0 && (
            <div>
              <h4 className="mb-1 text-sm font-semibold text-foreground">Unidades excluidas</h4>
              <ul className="text-sm text-muted-foreground">
                {detalle.unidades_excluidas.map((e) => (
                  <li key={e.id_propiedad}>
                    {PROPIEDADES_POR_ID[e.id_propiedad]?.numero ?? e.id_propiedad} — {e.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full border-collapse">
            <thead className="border-b border-border bg-muted">
              <tr>
                {["Versión", "Nombre", "Estado", "Creada", "Publicada", "Unidades", "Valor total", "Δ vs. anterior", ""].map((t) => (
                  <th key={t} className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {versiones.map((v, i) => {
                const esActualPublicada = v.estado === "publicada" && v.id_version === publicadaActual?.id_version;
                const anterior = versiones.slice(i + 1).find((x) => x.estado !== "archivada");
                const deltaVsAnterior = anterior ? v.valor_total - anterior.valor_total : null;
                return (
                  <tr
                    key={v.id_version}
                    className={cn(
                      "border-b border-border last:border-0",
                      esActualPublicada && "border-l-[3px] border-l-emerald-500",
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-sm font-bold text-foreground tabular-nums">
                      v{v.numero}
                    </td>
                    <td className="px-3 py-2 text-sm text-foreground">{v.nombre}</td>
                    <td className="px-3 py-2 text-sm">
                      <Badge
                        variant="outline"
                        className={cn(
                          v.estado === "publicada"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : v.estado === "borrador"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {v.estado}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground tabular-nums">
                      {formatoFechaHora(v.creada_en)} · {v.creada_por.nombre}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground tabular-nums">
                      {v.publicada_en ? formatoFechaHora(v.publicada_en) : "—"}
                    </td>
                    <td className="px-3 py-2 text-sm text-foreground tabular-nums">
                      {v.unidades_incluidas.length}
                      {v.unidades_excluidas.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
                              {v.unidades_excluidas.length} excluidas
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {v.unidades_excluidas.map((e) => e.motivo).join("; ")}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-foreground tabular-nums">
                      {formatoMoneda(v.valor_total)}
                      {esActualPublicada && (
                        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          Libro: Comercial
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm tabular-nums">
                      {deltaVsAnterior === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                            deltaVsAnterior >= 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {deltaVsAnterior >= 0 ? (
                            <ArrowUpRight className="size-3" />
                          ) : (
                            <ArrowDownRight className="size-3" />
                          )}
                          {formatoMoneda(Math.abs(deltaVsAnterior))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetalle(v)}>Ver detalle</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setVista("comparar");
                              setIdA(v.id_version);
                            }}
                          >
                            Comparar con...
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setRestaurando(v)}>
                            Restaurar precios al borrador
                          </DropdownMenuItem>
                          {v.estado === "borrador" && (
                            <DropdownMenuItem onClick={() => setPublicando(true)}>Publicar</DropdownMenuItem>
                          )}
                          {v.estado !== "archivada" && (
                            <DropdownMenuItem onClick={() => archivarVersion(v)}>
                              <Archive className="size-4" /> Archivar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {todas.length >= 2 && (
        <Card className="gap-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <History className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Comparar con...</span>
            <Select value={idA} onValueChange={setIdA}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Versión A" />
              </SelectTrigger>
              <SelectContent>
                {todas.map((v) => (
                  <SelectItem key={v.id_version} value={v.id_version}>
                    v{v.numero} · {v.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={idB} onValueChange={setIdB}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Versión B" />
              </SelectTrigger>
              <SelectContent>
                {todas.map((v) => (
                  <SelectItem key={v.id_version} value={v.id_version}>
                    v{v.numero} · {v.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {comparacion && (
              <div className="ml-auto flex items-center gap-2">
                <div className="inline-flex rounded-md border border-border p-0.5">
                  {(["todas", "con_cambio", "aumentos", "disminuciones"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFiltroDelta(f)}
                      className={cn(
                        "rounded px-2 py-1 text-xs",
                        filtroDelta === f ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {f === "todas"
                        ? "Todas"
                        : f === "con_cambio"
                          ? "Solo con cambio"
                          : f === "aumentos"
                            ? "Solo aumentos"
                            : "Solo disminuciones"}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={exportarComparacion}>
                  <Download className="size-4" />
                  Exportar
                </Button>
              </div>
            )}
          </div>

          {comparacion && a && b && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Unidades con cambio", String(comparacion.conCambio)],
                  ["Impacto total", formatoMoneda(comparacion.impacto)],
                  ["Impacto %", `${comparacion.impactoPct.toFixed(2)}%`],
                  ["Unidades comparadas", String(comparacion.unidades.length)],
                ].map(([t, v]) => (
                  <div key={t} className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">{t}</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums">{v}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="mb-1 text-sm font-semibold text-foreground">Parámetros del motor</h4>
                {comparacion.parametros.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin diferencias.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {comparacion.parametros.map((p) => (
                      <li key={p.parametro} className="flex justify-between gap-3 rounded bg-muted/40 px-2 py-1">
                        <span className="text-muted-foreground">{p.parametro}</span>
                        <span className="tabular-nums text-foreground">{p.a} → {p.b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="mb-1 text-sm font-semibold text-foreground">Factores</h4>
                {comparacion.factores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin diferencias.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {comparacion.factores.map((f) => (
                      <li key={`${f.tipo}-${f.clave}`} className="flex justify-between gap-3 rounded bg-muted/40 px-2 py-1">
                        <span className="text-muted-foreground">{f.tipo} · {f.clave}</span>
                        <span className="tabular-nums text-foreground">{f.a} → {f.b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="max-h-72 overflow-auto rounded-md border border-border">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      {["Unidad", `v${a.numero}`, `v${b.numero}`, "Delta", "Delta %"].map((t) => (
                        <th key={t} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unidadesComparacion.map((u) => (
                      <tr key={u.id_propiedad} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5 text-sm text-foreground tabular-nums">
                          {PROPIEDADES_POR_ID[u.id_propiedad]?.numero ?? u.id_propiedad}
                        </td>
                        <td className="px-3 py-1.5 text-sm text-muted-foreground tabular-nums">
                          {u.precioA === null ? "—" : formatoMoneda(u.precioA)}
                        </td>
                        <td className="px-3 py-1.5 text-sm text-muted-foreground tabular-nums">
                          {u.precioB === null ? "—" : formatoMoneda(u.precioB)}
                        </td>
                        <td className={cn("px-3 py-1.5 text-sm tabular-nums", u.delta >= 0 ? "text-emerald-700" : "text-red-700")}>
                          {formatoMoneda(u.delta)}
                        </td>
                        <td className="px-3 py-1.5 text-sm text-muted-foreground tabular-nums">{u.deltaPct.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      <DialogoPublicacion abierto={publicando} onOpenChange={setPublicando} />

      <AlertDialog open={!!restaurando} onOpenChange={(v) => !v && setRestaurando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar precios al borrador</AlertDialogTitle>
            <AlertDialogDescription>
              Esto copiará los precios y los parámetros del motor de{" "}
              {restaurando && `v${restaurando.numero} · ${restaurando.nombre}`} al borrador de
              trabajo. Las versiones publicadas no se modifican; esta acción solo afecta la
              lista de trabajo actual y queda registrada en la bitácora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarRestauracion}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}

export default Versiones;
