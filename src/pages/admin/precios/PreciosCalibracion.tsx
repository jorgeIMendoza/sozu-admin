import { registrarEvento } from "@/features/precios/services/auditoria";
import { Fragment, useMemo, useState } from "react";

import {
  DatabaseZap,
  Info,
  Lock,
  Play,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePreciosProyecto } from "@/features/precios/hooks/usePreciosProyecto";
import {
  MODELOS_POR_ID,
  PROYECTOS,
  TORRES_POR_ID,
} from "@/features/precios/mocks/inventario";
import { useMotorStore } from "@/features/precios/stores/motorStore";
import {
  CLASIFICACIONES_ATIPICO,
  useCalibracionStore,
  type CorridaCalibracion,
} from "@/features/precios/stores/calibracionStore";
import {
  aplicarPropuesta,
  calibrar,
  construirFilasCoeficientes,
  CONFIG_CALIBRACION_INICIAL,
  type ConfigCalibracion,
  type FilaCoeficiente,
  type ObservacionCalibracion,
  type ResultadoCalibracion,
} from "@/features/precios/engine/calibracion";
import { calcularLote } from "@/features/precios/engine/pricing";
import {
  formatoFecha,
  formatoM2,
  formatoMoneda,
  formatoMultiplicador,
  formatoPorcentaje,
} from "@/features/precios/lib/formato";
import { GraficoDispersion } from "@/features/precios/components/GraficoDispersion";
import {
  PanelDetallePrecio,
  type FilaPrecio,
} from "@/features/precios/components/PanelDetallePrecio";

const OBJETIVO_R2 = 0.92;

function Indicador({
  valor,
  etiqueta,
  nota,
  alerta,
}: {
  valor: string;
  etiqueta: string;
  nota: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p
        className={cn(
          "text-[28px] font-bold leading-none tabular-nums",
          alerta ? "text-amber-600" : "text-foreground",
        )}
      >
        {valor}
      </p>
      <p className="mt-2 text-[13px] font-medium text-muted-foreground">{etiqueta}</p>
      <p className="mt-1 text-xs text-muted-foreground">{nota}</p>
    </div>
  );
}

function formatoValor(valor: number, formato: FilaCoeficiente["formato"]): string {
  if (formato === "moneda") return formatoMoneda(valor);
  if (formato === "multiplicador") return formatoMultiplicador(valor);
  return valor.toFixed(4);
}

function CalibracionPagina() {
  const { motor, propiedades, desgloses } = usePreciosProyecto();
  const idProyectoActivo = useMotorStore((s) => s.idProyectoActivo);
  const motoresPorProyecto = useMotorStore((s) => s.motoresPorProyecto);
  const aplicarMotorCalibrado = useMotorStore((s) => s.aplicarMotorCalibrado);
  const copiarCoeficientesDesde = useMotorStore((s) => s.copiarCoeficientesDesde);

  const corridas = useCalibracionStore((s) => s.corridas);
  const guardarCorrida = useCalibracionStore((s) => s.guardarCorrida);
  const descartarCorrida = useCalibracionStore((s) => s.descartarCorrida);
  const clasificacionAtipicos = useCalibracionStore((s) => s.clasificacionAtipicos);
  const clasificarAtipico = useCalibracionStore((s) => s.clasificarAtipico);
  const baselines = useCalibracionStore((s) => s.baselines);
  const congelarBaseline = useCalibracionStore((s) => s.congelarBaseline);

  const nombreProyecto =
    PROYECTOS.find((p) => p.id_proyecto === idProyectoActivo)?.nombre ?? "";

  const [config, setConfig] = useState<ConfigCalibracion>(CONFIG_CALIBRACION_INICIAL);
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCalibracion | null>(null);
  const [excluidas, setExcluidas] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const [nombreBaseline, setNombreBaseline] = useState("");
  const [confirmarBaseline, setConfirmarBaseline] = useState(false);
  const [origenCopia, setOrigenCopia] = useState("");
  const [detalle, setDetalle] = useState<FilaPrecio | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);

  const desglosePorId = useMemo(
    () => new Map(desgloses.map((d) => [d.id_propiedad, d])),
    [desgloses],
  );

  const observaciones: ObservacionCalibracion[] = useMemo(
    () =>
      propiedades.map((p) => {
        const d = desglosePorId.get(p.id_propiedad);
        return {
          id_propiedad: p.id_propiedad,
          numero: p.numero,
          nivel: p.nivel,
          vista: p.vista,
          orientacion: p.orientacion,
          torre: TORRES_POR_ID[p.id_torre]?.nombre ?? p.id_torre,
          modelo: MODELOS_POR_ID[p.id_modelo]?.nombre ?? p.id_modelo,
          area_ponderada: d?.area_ponderada ?? 0,
          precio_actual: p.precio_lista_actual,
          componente_gravado: d?.componente_gravado ?? 0,
        };
      }),
    [propiedades, desglosePorId],
  );

  const conPrecio = observaciones.filter((o) => o.precio_actual > 0);
  const catalogos = useMemo(
    () => ({ modelos: MODELOS_POR_ID, torres: TORRES_POR_ID }),
    [],
  );

  const totalActualMotor = useMemo(
    () =>
      calcularLote(propiedades, catalogos, motor).reduce(
        (a, d) => a + d.precio_calculado,
        0,
      ),
    [propiedades, catalogos, motor],
  );

  /** Filas de coeficientes con su impacto en pesos sobre el valor del proyecto. */
  const filasCoeficientes = useMemo(() => {
    if (!resultado) return [];
    return construirFilasCoeficientes(motor, resultado.propuesta).map((f) => {
      const motorSolo = aplicarPropuesta(motor, resultado.propuesta, {
        parametro: f.parametro,
      });
      const total = calcularLote(propiedades, catalogos, motorSolo).reduce(
        (a, d) => a + d.precio_calculado,
        0,
      );
      return { ...f, impacto: total - totalActualMotor };
    });
  }, [resultado, motor, propiedades, catalogos, totalActualMotor]);

  const impactoTotal = useMemo(() => {
    if (!resultado) return 0;
    const motorCompleto = aplicarPropuesta(motor, resultado.propuesta);
    const total = calcularLote(propiedades, catalogos, motorCompleto).reduce(
      (a, d) => a + d.precio_calculado,
      0,
    );
    return total - totalActualMotor;
  }, [resultado, motor, propiedades, catalogos, totalActualMotor]);

  const ejecutar = (idsExcluidos: string[] = []) => {
    setCorriendo(true);
    setError(null);
    // El cálculo es síncrono; el diferido sólo permite pintar el estado de carga.
    setTimeout(() => {
      const salida = calibrar(conPrecio, config, motor, idsExcluidos);
      if (!salida.ok) {
        setError(salida.mensaje);
        setResultado(null);
      } else {
        setResultado(salida);
        const corrida: CorridaCalibracion = {
          ejecutada_en: salida.ejecutada_en,
          config: salida.config,
          estadisticos: salida.estadisticos,
          coeficientes: construirFilasCoeficientes(motor, salida.propuesta).map((f) => ({
            parametro: f.parametro,
            actual: f.actual,
            propuesto: f.propuesto,
            impacto: 0,
          })),
          referenciasOmitidas: salida.referenciasOmitidas,
          residuales: salida.residuales,
          excluidas: idsExcluidos,
        };
        guardarCorrida(idProyectoActivo, corrida);
        registrarEvento({
          id_proyecto: idProyectoActivo,
          tipo: "calibracion.ejecutada",
          entidad: {
            tipo: "motor",
            id: motor.id_motor,
            etiqueta: `Calibración · ${nombreProyecto}`,
          },
          antes: null,
          despues: {
            estadisticos: salida.estadisticos,
            config: salida.config,
            excluidas: idsExcluidos.length,
          },
        });
      }
      setCorriendo(false);
    }, 30);
  };

  const aplicar = () => {
    if (!resultado) return;
    const nuevo = aplicarPropuesta(motor, resultado.propuesta);
    aplicarMotorCalibrado(nuevo);
    registrarEvento({
      id_proyecto: idProyectoActivo,
      tipo: "calibracion.coeficientes_aplicados",
      entidad: {
        tipo: "motor",
        id: motor.id_motor,
        etiqueta: `Motor · ${nombreProyecto}`,
      },
      antes: motor,
      despues: nuevo,
      impacto_pesos: impactoTotal,
    });
    setConfirmar(false);
    toast.success("Motor calibrado", {
      description: `Se aplicaron los coeficientes a ${nombreProyecto}. Impacto sobre el valor total: ${formatoMoneda(impactoTotal)}.`,
    });
  };

  const abrirDetalle = (idPropiedad: string) => {
    const p = propiedades.find((x) => x.id_propiedad === idPropiedad);
    const d = desglosePorId.get(idPropiedad);
    if (!p || !d) return;
    setDetalle({
      propiedad: p,
      desglose: d,
      modelo: MODELOS_POR_ID[p.id_modelo],
      torre: TORRES_POR_ID[p.id_torre],
      alertas: d.alertas,
      productoFactores:
        d.f_torre * d.f_nivel * d.f_vista * d.f_orientacion * d.f_extras * d.f_tamano,
    });
    setDetalleAbierto(true);
  };

  const atipicos = useMemo(() => {
    if (!resultado) return [];
    return resultado.residuales
      .filter((r) => Math.abs(r.sigmas) > config.umbralSigma)
      .sort((a, b) => Math.abs(b.sigmas) - Math.abs(a.sigmas));
  }, [resultado, config.umbralSigma]);

  const baseline = baselines[idProyectoActivo];

  const avisoMock = (
    // SWAP POINT: retirar este aviso cuando preciosService lea de Supabase.
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <TriangleAlert className="size-4 text-amber-600" />
      <AlertDescription className="text-foreground">
        Estás calibrando contra datos simulados. El inventario cargado es un conjunto
        generado para probar el módulo, no el inventario real de SOZU. Los coeficientes
        que resulten de esta corrida no deben usarse para decidir precios. Sustituye los
        datos por el inventario real antes de tomar cualquier decisión.
      </AlertDescription>
    </Alert>
  );

  // ---------- Proyecto sin precios capturados ----------
  if (conPrecio.length === 0) {
    const candidatos = Object.values(motoresPorProyecto).filter(
      (m) =>
        m.id_proyecto !== idProyectoActivo && m.estado_calibracion === "calibrado",
    );
    return (
      <div className="space-y-4">
        {avisoMock}
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <DatabaseZap className="size-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">
            No hay precios para calibrar
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {nombreProyecto} no tiene precios de lista capturados, por lo que no existe
            una base contra la cual estimar los parámetros. Hay dos caminos: capturar
            precios de referencia para al menos 30 unidades representativas, o partir de
            los coeficientes calibrados de un proyecto comparable y ajustarlos
            manualmente.
          </p>
          <div className="flex items-center gap-2">
            <Select value={origenCopia} onValueChange={setOrigenCopia}>
              <SelectTrigger className="w-64">
                <SelectValue
                  placeholder={
                    candidatos.length
                      ? "Proyecto de origen"
                      : "No hay proyectos calibrados"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {candidatos.map((m) => (
                  <SelectItem key={m.id_proyecto} value={m.id_proyecto}>
                    {PROYECTOS.find((p) => p.id_proyecto === m.id_proyecto)?.nombre ??
                      m.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!origenCopia}
              onClick={() => {
                if (copiarCoeficientesDesde(origenCopia)) {
                  toast.success("Coeficientes copiados", {
                    description:
                      "Se copiaron las curvas de nivel y tamaño y los factores de vista y orientación. El precio base por m² no se copia porque es específico del proyecto. El motor queda sin calibrar.",
                  });
                }
              }}
            >
              Copiar coeficientes desde otro proyecto
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const est = resultado?.estadisticos;
  const bajoObjetivo = !!est && est.r2Ajustado < OBJETIVO_R2;

  return (
    <div className="space-y-4">
      {avisoMock}

      {/* Tarjeta 1 — Estado y control */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span
              className={cn(
                "inline-flex rounded-full px-3 py-1 text-sm font-medium",
                motor.estado_calibracion === "calibrado"
                  ? "bg-primary/10 text-primary"
                  : motor.estado_calibracion === "desactualizado"
                    ? "bg-amber-500/10 text-amber-700"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {motor.estado_calibracion === "calibrado"
                ? `Motor calibrado · ${formatoFecha(motor.fecha_calibracion ?? motor.actualizado_en).slice(0, 10)}`
                : motor.estado_calibracion === "desactualizado"
                  ? "Motor desactualizado"
                  : "Motor sin calibrar"}
            </span>
            <p className="mt-2 text-sm text-muted-foreground tabular-nums">
              {propiedades.length} propiedades en el proyecto · {conPrecio.length} con
              precio capturado · {propiedades.length - conPrecio.length} excluidas
            </p>
          </div>
          <Button onClick={() => ejecutar(excluidas)} disabled={corriendo}>
            {corriendo ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {corriendo ? "Calculando..." : "Ejecutar calibración"}
          </Button>
        </div>

        <Alert>
          <Info className="size-4" />
          <AlertDescription className="text-foreground">
            <span className="font-medium">Cómo funciona.</span> La calibración estima los
            parámetros que mejor reproducen los precios que el proyecto ya tiene
            asignados. Se corre sobre el componente exento del precio, restando cajones y
            bodegas, porque esos montos son aditivos y de valor conocido. Las unidades
            apartadas y vendidas sí participan: están bloqueadas para reprecio pero son
            precios revelados y son el mejor dato disponible.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Card>

      {/* Tarjeta 2 — Configuración de la corrida */}
      <Card className="space-y-4 p-5">
        <h2 className="text-xl font-semibold text-foreground">
          Configuración de la corrida
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Switch
              checked={config.cuadratico}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, cuadratico: v }))}
              id="cuadratico"
            />
            <div>
              <Label htmlFor="cuadratico">Incluir término cuadrático de nivel</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Permite que el incremento por piso crezca a tasa decreciente. Apágalo
                para forzar una curva lineal.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Switch
              checked={config.porModelo}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, porModelo: v }))}
              id="por-modelo"
            />
            <div>
              <Label htmlFor="por-modelo">Incluir factores por modelo</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Estima un factor de plano por cada modelo del proyecto.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Switch
              checked={config.excluirAtipicos}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, excluirAtipicos: v }))}
              id="atipicos"
            />
            <div>
              <Label htmlFor="atipicos">Excluir valores atípicos automáticamente</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Corre la estimación dos veces: la primera identifica residuales mayores a
                2 desviaciones estándar, la segunda los excluye.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="umbral">Umbral de valor atípico (σ)</Label>
            <Input
              id="umbral"
              type="number"
              min={1.5}
              max={3.5}
              step={0.1}
              className="mt-1 w-32 tabular-nums"
              value={config.umbralSigma}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  umbralSigma: Math.min(3.5, Math.max(1.5, Number(e.target.value) || 2)),
                }))
              }
            />
          </div>
        </div>
      </Card>

      {resultado && est && (
        <>
          {/* Tarjeta 3 — Resultados */}
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-foreground">
                Resultados de la calibración
              </h2>
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground tabular-nums">
                {formatoFecha(resultado.ejecutada_en)}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Indicador
                valor={est.r2Ajustado.toFixed(4)}
                etiqueta="R² ajustado"
                nota={
                  bajoObjetivo
                    ? "Por debajo del objetivo de 0.92. Faltan variables explicativas."
                    : "Objetivo: 0.92 o superior."
                }
                alerta={bajoObjetivo}
              />
              <Indicador
                valor={formatoMoneda(est.rmse)}
                etiqueta="RMSE"
                nota="Error típico en pesos por unidad."
              />
              <Indicador
                valor={`${est.mape.toFixed(2)}%`}
                etiqueta="MAPE"
                nota="Error porcentual promedio."
              />
              <Indicador
                valor={String(est.n)}
                etiqueta="Observaciones"
                nota={`De ${conPrecio.length} disponibles.`}
              />
            </div>

            {bajoObjetivo && (
              <Alert className="border-amber-500/40 bg-amber-500/5">
                <TriangleAlert className="size-4 text-amber-600" />
                <AlertDescription className="text-foreground">
                  El ajuste es insuficiente para publicar precios. Con este nivel de
                  ajuste, el motor no está reproduciendo la lógica de precios existente.
                  Probablemente faltan variables que sí influyen en el precio y no están
                  capturadas en el inventario, o hay precios asignados sin criterio
                  consistente. Revisa los valores atípicos antes de aplicar los
                  coeficientes.
                </AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-muted-foreground">
              Categorías de referencia omitidas:{" "}
              {Object.entries(resultado.referenciasOmitidas)
                .map(([g, c]) => `${g}: ${c}`)
                .join(" · ")}
              . σ residual (escala logarítmica): {est.sigmaResidual.toFixed(4)}.
            </p>
          </Card>

          {/* Tarjeta 4 — Coeficientes propuestos */}
          <Card className="space-y-3 p-5">
            <h2 className="text-xl font-semibold text-foreground">
              Coeficientes propuestos
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Parámetro</th>
                    <th className="px-3 py-2 text-right font-medium">Valor actual</th>
                    <th className="px-3 py-2 text-right font-medium">Valor propuesto</th>
                    <th className="px-3 py-2 text-right font-medium">Cambio</th>
                    <th className="px-3 py-2 text-right font-medium">Impacto</th>
                  </tr>
                </thead>
                <tbody>
                  {filasCoeficientes.map((f, i) => {
                    const nuevoBloque = filasCoeficientes[i - 1]?.bloque !== f.bloque;
                    const cambioPct =
                      f.actual !== 0 ? ((f.propuesto - f.actual) / f.actual) * 100 : 0;
                    const sinCambio = Math.abs(f.propuesto - f.actual) < 1e-9;
                    const thetaNegativo = f.parametro === "theta" && f.propuesto < 0;
                    return (
                      <Fragment key={f.parametro}>
                        {nuevoBloque && (
                          <tr className="bg-muted/50">
                            <td
                              colSpan={5}
                              className="px-3 py-1.5 text-xs font-medium text-muted-foreground"
                            >
                              {f.bloque}
                            </td>
                          </tr>
                        )}
                        <tr className="border-b border-border">
                          <td className="px-3 py-2 text-foreground">
                            {f.etiqueta}
                            {f.referencia && (
                              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                Referencia
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {formatoValor(f.actual, f.formato)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
                            {formatoValor(f.propuesto, f.formato)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {sinCambio ? (
                              <span className="text-xs text-muted-foreground">
                                Sin cambio
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs tabular-nums",
                                  cambioPct >= 0
                                    ? "bg-primary/10 text-primary"
                                    : "bg-destructive/10 text-destructive",
                                )}
                              >
                                {formatoPorcentaje(cambioPct)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">
                            {formatoMoneda(f.impacto)}
                          </td>
                        </tr>
                        {thetaNegativo && (
                          <tr className="border-b border-border">
                            <td colSpan={5} className="px-3 pb-2 text-xs text-amber-700">
                              El precio por metro cuadrado crece con el tamaño de la
                              unidad en este inventario, en lugar de decrecer. Es lo
                              contrario a lo que suele observarse en vivienda vertical.
                              Puede indicar que las unidades grandes concentran otros
                              atributos de valor no capturados, o que los precios grandes
                              se fijaron con otro criterio.
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td colSpan={4} className="px-3 py-2 text-sm font-medium text-foreground">
                      Impacto total de adoptar todos los coeficientes · Libro: Comercial
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatoMoneda(impactoTotal)} ·{" "}
                      {formatoPorcentaje(
                        totalActualMotor > 0 ? (impactoTotal / totalActualMotor) * 100 : 0,
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setResultado(null);
                  descartarCorrida(idProyectoActivo);
                }}
              >
                Descartar resultados
              </Button>
              <Button onClick={() => setConfirmar(true)}>
                Aplicar coeficientes propuestos
              </Button>
            </div>
          </Card>

          {/* Tarjeta 5 — Valores atípicos */}
          <Card className="space-y-3 p-5">
            <h2 className="text-xl font-semibold text-foreground">Valores atípicos</h2>
            <Alert>
              <Info className="size-4" />
              <AlertDescription className="text-foreground">
                Los valores atípicos no se borran. Son unidades cuyo precio no sigue la
                lógica del resto del inventario. Clasifícalas para dejar constancia del
                motivo. Excluirlas de la calibración mejora el ajuste del modelo pero no
                cambia su precio: siguen siendo parte del inventario.
              </AlertDescription>
            </Alert>

            <div className="max-h-[420px] overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-xs text-muted-foreground">
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2 text-left font-medium">No.</th>
                    <th className="px-3 py-2 text-left font-medium">Modelo</th>
                    <th className="px-3 py-2 text-right font-medium">Nivel</th>
                    <th className="px-3 py-2 text-left font-medium">Vista</th>
                    <th className="px-3 py-2 text-right font-medium">Área Pond.</th>
                    <th className="px-3 py-2 text-right font-medium">Precio actual</th>
                    <th className="px-3 py-2 text-right font-medium">Precio predicho</th>
                    <th className="px-3 py-2 text-right font-medium">Residual</th>
                    <th className="px-3 py-2 text-right font-medium">Desviaciones (σ)</th>
                    <th className="px-3 py-2 text-left font-medium">Clasificación</th>
                  </tr>
                </thead>
                <tbody>
                  {atipicos.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-3 py-8 text-center text-sm text-muted-foreground"
                      >
                        Ninguna unidad supera el umbral de {config.umbralSigma.toFixed(1)}{" "}
                        desviaciones estándar.
                      </td>
                    </tr>
                  )}
                  {atipicos.map((r) => {
                    const o = observaciones.find(
                      (x) => x.id_propiedad === r.id_propiedad,
                    )!;
                    return (
                      <tr key={r.id_propiedad} className="border-b border-border">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary align-middle"
                            aria-label={`Excluir unidad ${o.numero}`}
                            checked={excluidas.includes(r.id_propiedad)}
                            onChange={() =>
                              setExcluidas((s) =>
                                s.includes(r.id_propiedad)
                                  ? s.filter((x) => x !== r.id_propiedad)
                                  : [...s, r.id_propiedad],
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 font-semibold text-foreground tabular-nums">
                          {o.numero}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {o.modelo}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{o.nivel}</td>
                        <td className="px-3 py-2">{o.vista}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatoM2(o.area_ponderada)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatoMoneda(r.observado)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatoMoneda(r.predicho)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs tabular-nums",
                              r.residual >= 0
                                ? "bg-primary/10 text-primary"
                                : "bg-destructive/10 text-destructive",
                            )}
                          >
                            {formatoPorcentaje(r.residualPct)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.sigmas.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={
                              clasificacionAtipicos[r.id_propiedad] ?? "Sin clasificar"
                            }
                            onValueChange={(v) => {
                              clasificarAtipico(r.id_propiedad, v);
                              registrarEvento({
                                id_proyecto: idProyectoActivo,
                                tipo: "calibracion.atipico_clasificado",
                                entidad: {
                                  tipo: "propiedad",
                                  id: r.id_propiedad,
                                  etiqueta: `Atípico ${r.id_propiedad}`,
                                },
                                antes: {
                                  clasificacion:
                                    clasificacionAtipicos[r.id_propiedad] ??
                                    "Sin clasificar",
                                },
                                despues: { clasificacion: v },
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 w-56">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CLASIFICACIONES_ATIPICO.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                disabled={excluidas.length === 0 || corriendo}
                onClick={() => ejecutar(excluidas)}
              >
                Recalibrar excluyendo seleccionadas
              </Button>
            </div>
          </Card>

          {/* Tarjeta 6 — Gráfico de ajuste */}
          <Card className="space-y-3 p-5">
            <h2 className="text-xl font-semibold text-foreground">Gráfico de ajuste</h2>
            <GraficoDispersion
              umbralSigma={config.umbralSigma}
              onSeleccionar={abrirDetalle}
              puntos={resultado.residuales.map((r) => ({
                id_propiedad: r.id_propiedad,
                numero:
                  observaciones.find((o) => o.id_propiedad === r.id_propiedad)?.numero ??
                  "",
                observado: r.observado,
                predicho: r.predicho,
                sigmas: r.sigmas,
              }))}
            />
          </Card>
        </>
      )}

      {/* Tarjeta 7 — Congelar baseline */}
      {motor.estado_calibracion === "calibrado" && (
        <Card className="space-y-3 p-5">
          <h2 className="text-xl font-semibold text-foreground">Congelar baseline</h2>
          {baseline ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium text-foreground">{baseline.nombre}</p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  Congelado el {formatoFecha(baseline.congelado_en)} · Valor total{" "}
                  {formatoMoneda(baseline.valor_total)} · Libro: Comercial
                </p>
              </div>
              <Button variant="outline" onClick={() => setConfirmarBaseline(true)}>
                Reemplazar baseline
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Congelar el baseline guarda una fotografía de los parámetros actuales y
                de los precios que producen. A partir de ese punto, cada cambio se muestra
                como diferencia contra esa referencia, no contra el precio capturado a
                mano.
              </p>
              <div className="max-w-md">
                <Label htmlFor="baseline">Nombre del baseline</Label>
                <Input
                  id="baseline"
                  className="mt-1"
                  value={
                    nombreBaseline ||
                    `Baseline v0 · ${nombreProyecto} · ${formatoFecha(new Date().toISOString()).slice(0, 10)}`
                  }
                  onChange={(e) => setNombreBaseline(e.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  const precios = Object.fromEntries(
                    desgloses.map((d) => [d.id_propiedad, d.precio_lista]),
                  );
                  congelarBaseline(idProyectoActivo, {
                    nombre:
                      nombreBaseline ||
                      `Baseline v0 · ${nombreProyecto} · ${formatoFecha(new Date().toISOString()).slice(0, 10)}`,
                    congelado_en: new Date().toISOString(),
                    parametros: structuredClone(motor),
                    valor_total: desgloses.reduce((a, d) => a + d.precio_lista, 0),
                    precios,
                  });
                  registrarEvento({
                    id_proyecto: idProyectoActivo,
                    tipo: "calibracion.baseline_congelado",
                    entidad: {
                      tipo: "baseline",
                      id: idProyectoActivo,
                      etiqueta: nombreBaseline || `Baseline · ${nombreProyecto}`,
                    },
                    antes: null,
                    despues: {
                      valor_total: desgloses.reduce((a, d) => a + d.precio_lista, 0),
                      unidades: desgloses.length,
                    },
                  });
                  toast.success("Baseline congelado", {
                    description:
                      "La columna Δ vs. baseline ya está disponible en el selector de columnas de la Tabla de Precios.",
                  });
                }}
              >
                <Lock className="size-4" />
                Congelar baseline
              </Button>
            </>
          )}
        </Card>
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar coeficientes al motor</AlertDialogTitle>
            <AlertDialogDescription>
              Esto sobrescribe los parámetros actuales del motor de {nombreProyecto} con
              los valores estimados y marca el motor como calibrado. El inventario se
              recalculará por completo. Los overrides manuales existentes no se modifican,
              pero pueden quedar desactualizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Separator />
          <p className="text-sm text-foreground tabular-nums">
            Impacto sobre el valor total del proyecto: {formatoMoneda(impactoTotal)} (
            {formatoPorcentaje(
              totalActualMotor > 0 ? (impactoTotal / totalActualMotor) * 100 : 0,
            )}
            )
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aplicar}>Aplicar coeficientes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarBaseline} onOpenChange={setConfirmarBaseline}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reemplazar baseline</AlertDialogTitle>
            <AlertDialogDescription>
              El baseline vigente se sustituye por una fotografía de los parámetros y
              precios actuales. Las diferencias contra la referencia anterior se pierden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                congelarBaseline(idProyectoActivo, {
                  nombre: `Baseline · ${nombreProyecto} · ${formatoFecha(new Date().toISOString()).slice(0, 10)}`,
                  congelado_en: new Date().toISOString(),
                  parametros: structuredClone(motor),
                  valor_total: desgloses.reduce((a, d) => a + d.precio_lista, 0),
                  precios: Object.fromEntries(
                    desgloses.map((d) => [d.id_propiedad, d.precio_lista]),
                  ),
                });
                registrarEvento({
                  id_proyecto: idProyectoActivo,
                  tipo: "calibracion.baseline_congelado",
                  entidad: {
                    tipo: "baseline",
                    id: idProyectoActivo,
                    etiqueta: `Baseline · ${nombreProyecto}`,
                  },
                  antes: null,
                  despues: {
                    valor_total: desgloses.reduce((a, d) => a + d.precio_lista, 0),
                    unidades: desgloses.length,
                  },
                });
                setConfirmarBaseline(false);
                toast.success("Baseline reemplazado");
              }}
            >
              Reemplazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PanelDetallePrecio
        fila={detalle}
        motor={motor}
        proyecto={nombreProyecto}
        abierto={detalleAbierto}
        onOpenChange={setDetalleAbierto}
      />
    </div>
  );
}

export default CalibracionPagina;
