import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  FileClock,
  HandCoins,
  MoreHorizontal,
  Scale,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useMotorStore } from "@/features/precios/stores/motorStore";
import { useOfertasStore } from "@/features/precios/stores/ofertasStore";
import {
  exportarCSVAuditado,
  registrarEvento,
} from "@/features/precios/services/auditoria";
import {
  formatoFechaCorta,
  formatoMoneda,
  tiempoRestante,
} from "@/features/precios/lib/formato";
import { usePreciosProyecto } from "@/features/precios/hooks/usePreciosProyecto";
import { PROPIEDADES_POR_ID } from "@/features/precios/mocks/inventario";
import type { OfertaVigente } from "@/features/precios/types/dominio";

  component: Ofertas,
});

type Pestana = "vigentes" | "por_vencer" | "historial";

const COLOR_ESTADO: Record<OfertaVigente["estado"], string> = {
  vigente: "bg-emerald-50 text-emerald-700",
  vencida: "bg-muted text-muted-foreground",
  cancelada: "bg-red-50 text-red-700",
  convertida: "bg-sky-50 text-sky-700",
};

const ETIQUETA_ESTADO: Record<OfertaVigente["estado"], string> = {
  vigente: "Vigente",
  vencida: "Vencida",
  cancelada: "Cancelada",
  convertida: "Convertida",
};

function diasParaVencer(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
}

function Ofertas() {
  const idProyecto = useMotorStore((s) => s.idProyectoActivo);
  const ofertas = useOfertasStore((s) => s.ofertas);
  const cancelar = useOfertasStore((s) => s.cancelar);
  const marcarConvertida = useOfertasStore((s) => s.marcarConvertida);
  // Corre recalcularVencimientos() de forma idempotente al montar el módulo.
  usePreciosProyecto();

  const [pestana, setPestana] = useState<Pestana>("vigentes");
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const delProyecto = useMemo(
    () => ofertas.filter((o) => o.id_proyecto === idProyecto),
    [ofertas, idProyecto],
  );

  const vigentes = delProyecto.filter(
    (o) => o.estado === "vigente" && new Date(o.vence_en).getTime() >= Date.now(),
  );
  const porVencer = vigentes.filter((o) => diasParaVencer(o.vence_en) <= 3);
  const vencidas = delProyecto.filter((o) => o.estado === "vencida");
  const convertidas = delProyecto.filter((o) => o.estado === "convertida");
  const canceladas = delProyecto.filter((o) => o.estado === "cancelada");
  const historial = [...vencidas, ...convertidas, ...canceladas];

  const pendientesInventario = convertidas.filter((o) => {
    const p = PROPIEDADES_POR_ID[o.id_propiedad];
    return p && p.estatus !== "Apartada" && p.estatus !== "Vendida";
  });

  const listaBase =
    pestana === "vigentes" ? vigentes : pestana === "por_vencer" ? porVencer : historial;

  const lista = useMemo(
    () => listaBase.slice().sort((a, b) => (a.emitida_en < b.emitida_en ? 1 : -1)),
    [listaBase],
  );

  const oferta = ofertas.find((o) => o.id_oferta === cancelando) ?? null;

  const confirmarCancelacion = () => {
    if (!oferta) return;
    if (!cancelar(oferta.id_oferta, motivo)) return;
    registrarEvento({
      id_proyecto: oferta.id_proyecto,
      tipo: "oferta.cancelada",
      entidad: {
        tipo: "oferta",
        id: oferta.id_oferta,
        etiqueta: `Unidad ${PROPIEDADES_POR_ID[oferta.id_propiedad]?.numero ?? oferta.id_propiedad}`,
      },
      antes: { estado: "vigente" },
      despues: { estado: "cancelada" },
      motivo: { causa: "Cancelación de oferta", descripcion: motivo.trim() },
    });
    setCancelando(null);
    setMotivo("");
  };

  const convertir = (o: OfertaVigente) => {
    marcarConvertida(o.id_oferta);
    registrarEvento({
      id_proyecto: o.id_proyecto,
      tipo: "oferta.registrada",
      entidad: {
        tipo: "oferta",
        id: o.id_oferta,
        etiqueta: `Unidad ${PROPIEDADES_POR_ID[o.id_propiedad]?.numero ?? o.id_propiedad}`,
      },
      antes: { estado: "vigente" },
      despues: { estado: "convertida" },
      motivo: { causa: "Conversión de oferta", descripcion: "Oferta marcada como convertida a operación." },
    });
  };

  const exportar = () => {
    exportarCSVAuditado(
      { id_proyecto: idProyecto, origen: "Ofertas vigentes", filtros: { vista: pestana } },
      "ofertas-vigentes.csv",
      [
        "Unidad",
        "Precio ofertado",
        "Esquema",
        "Descuento adicional %",
        "Emitida",
        "Vence",
        "Estado",
        "Emitida por",
        "Referencia",
        "Notas",
      ],
      lista.map((o) => [
        PROPIEDADES_POR_ID[o.id_propiedad]?.numero ?? o.id_propiedad,
        o.precio_ofertado,
        o.nombre_esquema,
        o.descuento_adicional,
        formatoFechaCorta(o.emitida_en),
        formatoFechaCorta(o.vence_en),
        o.estado,
        o.emitida_por.nombre,
        o.referencia_cliente,
        o.notas,
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ofertas vigentes</h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {vigentes.length} unidad{vigentes.length === 1 ? "" : "es"} con precio bloqueado
            para reprecio.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} disabled={lista.length === 0}>
          <Download className="size-4" />
          Exportar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-2.5 text-sm">
        <Indicador etiqueta="Vigentes" valor={vigentes.length} />
        <div className="h-4 w-px bg-border" />
        <Indicador etiqueta="Por vencer en 3 días" valor={porVencer.length} />
        <div className="h-4 w-px bg-border" />
        <Indicador etiqueta="Vencidas" valor={vencidas.length} />
        <div className="h-4 w-px bg-border" />
        <Indicador etiqueta="Convertidas" valor={convertidas.length} />
        {pendientesInventario.length > 0 ? (
          <>
            <div className="h-4 w-px bg-border" />
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 tabular-nums">
              Pendientes de inventario: {pendientesInventario.length}
            </span>
          </>
        ) : null}
      </div>

      <Alert>
        <Scale className="size-4" />
        <AlertDescription>
          De acuerdo con el artículo 7 de la Ley Federal de Protección al Consumidor, todo
          precio ofrecido u ofertado a un consumidor debe ser respetado por el proveedor. La
          NOM-247-SE-2021 exige que los precios de vivienda de interés social y media se
          presenten de forma clara, veraz y comprobable. Una vez registrada una oferta
          vigente, el precio de la unidad queda bloqueado para reprecio hasta su
          vencimiento, cancelación documentada o conversión a una operación en firme.
        </AlertDescription>
      </Alert>

      <Tabs value={pestana} onValueChange={(v) => setPestana(v as Pestana)}>
        <TabsList>
          <TabsTrigger value="vigentes">Vigentes ({vigentes.length})</TabsTrigger>
          <TabsTrigger value="por_vencer">Por vencer ({porVencer.length})</TabsTrigger>
          <TabsTrigger value="historial">Historial ({historial.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {lista.length === 0 ? (
        <Card className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-10 text-center">
          <HandCoins className="size-12 text-muted-foreground/40" strokeWidth={1.5} />
          <h3 className="text-xl font-semibold text-foreground">Sin ofertas registradas</h3>
          <p className="max-w-lg text-sm text-muted-foreground">
            Registra una oferta desde el Cotizador cuando entregues una cotización formal a
            un cliente. La unidad quedará bloqueada para reprecio durante la vigencia.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/inventario/precios/escenarios/cotizador">Ir al Cotizador</Link>
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full border-collapse">
            <thead className="border-b border-border bg-muted">
              <tr>
                {[
                  "Unidad",
                  "Modelo",
                  "Precio ofertado",
                  "Esquema",
                  "Descuento",
                  "Emitida",
                  "Vence",
                  "Referencia",
                  "Emitida por",
                  "Estado",
                  "",
                ].map((t, i) => (
                  <th
                    key={`${t}-${i}`}
                    className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((o) => {
                const propiedad = PROPIEDADES_POR_ID[o.id_propiedad];
                const dias = diasParaVencer(o.vence_en);
                const proximaAVencer = o.estado === "vigente" && dias <= 3;
                const pendiente =
                  o.estado === "convertida" &&
                  propiedad &&
                  propiedad.estatus !== "Apartada" &&
                  propiedad.estatus !== "Vendida";
                return (
                  <tr
                    key={o.id_oferta}
                    className={cn(
                      "border-b border-border last:border-0",
                      proximaAVencer && "border-l-[3px] border-l-amber-500",
                    )}
                  >
                    <td className="px-3 py-2 text-sm tabular-nums">
                      <Link
                        to="/admin/inventario/precios/tabla"
                        className="font-bold text-foreground hover:underline"
                      >
                        {propiedad?.numero ?? o.id_propiedad}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {propiedad?.id_modelo ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-foreground tabular-nums">
                      {formatoMoneda(o.precio_ofertado)}
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">
                      {o.nombre_esquema}
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground tabular-nums">
                      {o.descuento_adicional.toFixed(2)}%
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground tabular-nums">
                      {formatoFechaCorta(o.emitida_en)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm tabular-nums">
                      <span className="text-foreground">{formatoFechaCorta(o.vence_en)}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        ({tiempoRestante(o.vence_en)})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">
                      {o.referencia_cliente || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                      {o.emitida_por.nombre}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            COLOR_ESTADO[o.estado],
                          )}
                        >
                          {ETIQUETA_ESTADO[o.estado]}
                        </span>
                        {pendiente ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <TriangleAlert className="size-4 text-amber-600" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Oferta convertida, inventario sin actualizar.
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/admin/inventario/precios/tabla">Ver unidad</Link>
                          </DropdownMenuItem>
                          {o.estado === "vigente" ? (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setCancelando(o.id_oferta);
                                  setMotivo("");
                                }}
                              >
                                Cancelar oferta
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => convertir(o)}>
                                Marcar como convertida
                              </DropdownMenuItem>
                            </>
                          ) : null}
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

      <Dialog open={cancelando !== null} onOpenChange={(v) => !v && setCancelando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar oferta</DialogTitle>
            <DialogDescription>
              Cancelar libera la unidad para reprecio. La cancelación queda asentada en la
              bitácora con el motivo que escribas.
            </DialogDescription>
          </DialogHeader>
          {oferta ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <FileClock className="mt-0.5 size-4 shrink-0" />
              <span>
                Unidad{" "}
                <span className="font-semibold tabular-nums">
                  {PROPIEDADES_POR_ID[oferta.id_propiedad]?.numero ?? oferta.id_propiedad}
                </span>{" "}
                · oferta de{" "}
                <span className="tabular-nums">{formatoMoneda(oferta.precio_ofertado)}</span>.
                Al cancelar, la unidad queda liberada para reprecio de inmediato.
              </span>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="motivo-cancelacion">Motivo (mínimo 20 caracteres)</Label>
            <Textarea
              id="motivo-cancelacion"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              {motivo.trim().length} / 20
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelando(null)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={motivo.trim().length < 20}
              onClick={confirmarCancelacion}
            >
              Cancelar oferta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Indicador({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <span className="text-muted-foreground">
      {etiqueta}:{" "}
      <span className="font-semibold text-foreground tabular-nums">{valor}</span>
    </span>
  );
}
