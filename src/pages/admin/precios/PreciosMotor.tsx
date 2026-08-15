import { useState } from "react";

import { Info, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraficoCurva } from "@/features/precios/components/GraficoCurva";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";
import { useMotorStore } from "@/features/precios/stores/motorStore";
import { useMotorAuditado } from "@/features/precios/hooks/useMotorAuditado";
import { usePreciosProyecto } from "@/features/precios/hooks/usePreciosProyecto";
import { TablaFactores } from "@/features/precios/components/TablaFactores";
import {
  calcularFactorNivel,
  calcularFactorTamano,
} from "@/features/precios/engine/pricing";
import {
  formatoFecha,
  formatoMoneda,
  formatoMultiplicador,
  formatoPorcentaje,
} from "@/features/precios/lib/formato";
import type { TipoFactor } from "@/features/precios/types/dominio";

/**
 * Campo numérico que muestra pesos formateados en reposo y number crudo al editar.
 * Un campo de dinero que dice 69500 obliga a contar ceros; $69,500.00 no.
 */
function CampoNumero({
  etiqueta,
  ayuda,
  valor,
  onChange,
  step = 1,
  min,
  max,
  nota,
  moneda = false,
}: {
  etiqueta: string;
  ayuda: string;
  valor: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  nota?: string;
  moneda?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const mostrarTexto = moneda && !editando;
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-muted-foreground">{etiqueta}</Label>
      <Input
        type={mostrarTexto ? "text" : "number"}
        step={step}
        min={min}
        max={max}
        value={mostrarTexto ? formatoMoneda(valor) : valor}
        onFocus={() => moneda && setEditando(true)}
        onBlur={() => setEditando(false)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tabular-nums"
      />
      <p className="text-xs text-muted-foreground">{ayuda}</p>
      {nota ? <p className="text-[11px] text-muted-foreground">{nota}</p> : null}
    </div>
  );
}

const SUB_PESTANAS: Array<{ valor: TipoFactor; titulo: string }> = [
  { valor: "torre", titulo: "Torre" },
  { valor: "vista", titulo: "Vista" },
  { valor: "orientacion", titulo: "Orientación" },
  { valor: "extras", titulo: "Extras" },
];

function PantallaMotor() {
  const {
    actualizarParametro,
    actualizarConfigNivel,
    actualizarConfigTamano,
    actualizarBaseModelo,
    declararCalibradoManualmente,
    restablecer,
  } = useMotorAuditado();
  const errorMigracion = useMotorStore((s) => s.errorMigracion);
  const { motor, propiedades, totales } = usePreciosProyecto();
  const [confirmar, setConfirmar] = useState(false);
  const [dialogoCalibrado, setDialogoCalibrado] = useState(false);
  const [justificacion, setJustificacion] = useState("");

  const bases = motor.bases_modelo ?? [];
  const m2RefPreview =
    bases.length > 0
      ? bases.reduce((a, b) => a + b.m2_referencia, 0) / bases.length
      : 80;
  const unidadesPorModelo = new Map<string, number>();
  for (const p of propiedades) {
    unidadesPorModelo.set(p.id_modelo, (unidadesPorModelo.get(p.id_modelo) ?? 0) + 1);
  }

  const nivelesPreview = [1, 3, 5, 8, 10, 14, 18];

  const puntosNivel = Array.from({ length: 20 }, (_, i) => ({
    x: i + 1,
    y: calcularFactorNivel(i + 1, motor.nivel, motor.ancla.nivel),
  }));

  /** Referencia SOZU: 0.50% por piso, lineal, desde el nivel ancla. */
  const puntosNivelReferencia = Array.from({ length: 20 }, (_, i) => ({
    x: i + 1,
    y: 1 + 0.005 * (i + 1 - motor.ancla.nivel),
  }));

  const puntosTamano = Array.from({ length: 21 }, (_, i) => {
    const area = m2RefPreview * (0.6 + i * 0.05);
    return {
      x: Math.round(area * 100) / 100,
      y: calcularFactorTamano(area, m2RefPreview, motor.tamano.theta),
    };
  });

  const recalcular = () => {
    toast.success(
      `Se recalcularon ${totales.unidades} propiedades. ${totales.desviadas} con desviación mayor a 5%.`,
    );
  };

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-xs text-muted-foreground tabular-nums">
          Última actualización: {formatoFecha(motor.actualizado_en)}
        </span>
        <Button variant="outline" onClick={() => setConfirmar(true)}>
          <RotateCcw className="size-4" />
          Restablecer valores
        </Button>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs",
            motor.estado_calibracion === "calibrado_manualmente"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-border text-muted-foreground",
          )}
        >
          {motor.estado_calibracion === "calibrado"
            ? `Calibrado${motor.fecha_calibracion ? ` · ${formatoFecha(motor.fecha_calibracion)}` : ""}`
            : motor.estado_calibracion === "calibrado_manualmente"
              ? `Calibrado manualmente${motor.fecha_calibracion ? ` · ${formatoFecha(motor.fecha_calibracion)}` : ""}`
              : motor.estado_calibracion === "desactualizado"
                ? "Calibración desactualizada"
                : "Sin calibrar"}
        </span>
        <Button variant="outline" onClick={() => setDialogoCalibrado(true)}>
          Marcar como calibrado
        </Button>
        <Button onClick={recalcular}>
          <RefreshCw className="size-4" />
          Recalcular inventario
        </Button>
      </div>

      {errorMigracion ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>
            No se pudo migrar el motor guardado al anclaje por modelo: {errorMigracion}. Se
            está usando la configuración semilla. Revisa los datos antes de publicar.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Unidad Ancla</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground">{motor.ancla.descripcion}</p>
          <p className="text-xs text-muted-foreground">
            Es la combinación de condiciones de menor valor del proyecto. Todos los factores
            multiplicativos valen exactamente 1.0000 en esta combinación, y el precio base de
            cada modelo es el precio por m² que tendría ese modelo aquí.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Precio Base por Modelo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Modelo
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Precio base por m² (ancla)
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    M² de referencia
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Unidades
                  </th>
                </tr>
              </thead>
              <tbody>
                {bases.map((b) => (
                  <tr key={b.id_modelo} className="border-t border-border">
                    <td className="px-3 py-1.5 font-medium text-foreground">
                      {b.nombre_modelo}
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        type="number"
                        step={100}
                        value={b.precio_base_m2}
                        onChange={(e) =>
                          actualizarBaseModelo(
                            b.id_modelo,
                            "precio_base_m2",
                            Number(e.target.value),
                          )
                        }
                        className="w-44 tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        type="number"
                        step={0.01}
                        value={b.m2_referencia}
                        onChange={(e) =>
                          actualizarBaseModelo(
                            b.id_modelo,
                            "m2_referencia",
                            Number(e.target.value),
                          )
                        }
                        className="w-32 tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                      {unidadesPorModelo.get(b.id_modelo) ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            El precio del modelo ya no se expresa como un multiplicador. Se captura
            directamente el precio por m² de la unidad ancla de cada modelo, que es como SOZU
            define precios en la realidad.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Parámetros Base</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <CampoNumero
            etiqueta="Factor de Área Exterior (k_ext)"
            ayuda="Cuánto vale un m² de balcón o terraza respecto a un m² interior. Recomendado: 0.350."
            valor={motor.k_ext}
            step={0.001}
            min={0}
            max={1}
            onChange={(v) => actualizarParametro("k_ext", v)}
          />
          <CampoNumero
            etiqueta="Factor de Área Loft (k_loft)"
            ayuda="Cuánto vale un m² de loft respecto a un m² interior. Recomendado: 0.650."
            valor={motor.k_loft}
            step={0.001}
            min={0}
            max={1}
            onChange={(v) => actualizarParametro("k_loft", v)}
          />
          <CampoNumero
            etiqueta="Tasa de Descuento Anual"
            ayuda="Costo de capital del proyecto. Se usa para valuar esquemas de financiamiento. Recomendado: 14.00%."
            nota="Este parámetro se activa en el módulo de Escenarios."
            valor={motor.tasa_descuento_anual}
            step={0.0001}
            onChange={(v) => actualizarParametro("tasa_descuento_anual", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Curva de Nivel</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cómo crece el precio conforme sube el piso
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-muted-foreground">
                Pendiente por piso (a)
              </Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[motor.nivel.coef_a]}
                  min={0}
                  max={0.025}
                  step={0.0005}
                  onValueChange={([v]) => actualizarConfigNivel(v ?? 0, motor.nivel.coef_b)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  step={0.0005}
                  value={motor.nivel.coef_a}
                  onChange={(e) =>
                    actualizarConfigNivel(Number(e.target.value), motor.nivel.coef_b)
                  }
                  className="w-28 tabular-nums"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Incremento porcentual por cada piso. La evidencia de mercado sitúa el rango
                entre 0.5% y 2.2% por piso.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-muted-foreground">
                Amortiguamiento (b)
              </Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[motor.nivel.coef_b]}
                  min={0}
                  max={0.0005}
                  step={0.00001}
                  onValueChange={([v]) => actualizarConfigNivel(motor.nivel.coef_a, v ?? 0)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  step={0.00001}
                  value={motor.nivel.coef_b}
                  onChange={(e) =>
                    actualizarConfigNivel(motor.nivel.coef_a, Number(e.target.value))
                  }
                  className="w-28 tabular-nums"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Reduce el incremento en pisos altos para reflejar rendimiento decreciente. Un
                valor de 0 hace la curva perfectamente lineal.
              </p>
            </div>
          </div>

          <GraficoCurva
            puntos={puntosNivel}
            etiquetaX="Nivel"
            etiquetaY="Multiplicador de nivel"
            referencia={puntosNivelReferencia}
            etiquetaReferencia="referencia SOZU, 0.50% por piso lineal"
          />

          <div className="max-w-sm overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Nivel
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Multiplicador
                  </th>
                </tr>
              </thead>
              <tbody>
                {nivelesPreview.map((n) => {
                  const f = calcularFactorNivel(n, motor.nivel);
                  return (
                    <tr key={n} className="border-t border-border">
                      <td className="px-3 py-1.5 tabular-nums">{n}</td>
                      <td className="px-3 py-1.5 tabular-nums">
                        {formatoMultiplicador(f)}{" "}
                        <span className="text-muted-foreground">
                          ({formatoPorcentaje((f - 1) * 100, 2)})
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Configuración actual de SOZU en Daiku: aproximadamente 0.50% por piso, lineal.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Curva de Tamaño</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-muted-foreground">Theta (θ)</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[motor.tamano.theta]}
                  min={0}
                  max={0.15}
                  step={0.005}
                  onValueChange={([v]) => actualizarConfigTamano(v ?? 0)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  step={0.005}
                  value={motor.tamano.theta}
                  onChange={(e) => actualizarConfigTamano(Number(e.target.value))}
                  className="w-28 tabular-nums"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Controla qué tan rápido baja el precio por m² conforme crece la unidad. Con θ =
                0 el precio por m² es constante.
              </p>
            </div>
          </div>

          <GraficoCurva
            puntos={puntosTamano}
            etiquetaX="Área ponderada (m²)"
            etiquetaY="Multiplicador de tamaño"
          />

          <div className="max-w-md overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Área ponderada
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Multiplicador
                  </th>
                </tr>
              </thead>
              <tbody>
                {[0.7, 1.0, 1.6].map((k) => {
                  const area = m2RefPreview * k;
                  return (
                    <tr key={k} className="border-t border-border">
                      <td className="px-3 py-1.5 tabular-nums">{area.toFixed(2)} m²</td>
                      <td className="px-3 py-1.5 tabular-nums">
                        {formatoMultiplicador(calcularFactorTamano(area, m2RefPreview, motor.tamano.theta))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Accesorios</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <CampoNumero
            etiqueta="Precio por Cajón Independiente"
            moneda
            ayuda="Monto absoluto por cajón. Forma parte del componente gravado."
            valor={motor.precio_cajon}
            step={1000}
            onChange={(v) => actualizarParametro("precio_cajon", v)}
          />
          <CampoNumero
            etiqueta="Factor Cajón en Tándem"
            ayuda="Valor de un cajón en tándem respecto a uno independiente."
            valor={motor.factor_cajon_tandem}
            step={0.001}
            min={0}
            max={1}
            onChange={(v) => actualizarParametro("factor_cajon_tandem", v)}
          />
          <CampoNumero
            etiqueta="Precio por M² de Bodega"
            moneda
            ayuda="Monto por metro cuadrado de bodega. Forma parte del componente gravado."
            valor={motor.precio_m2_bodega}
            step={500}
            onChange={(v) => actualizarParametro("precio_m2_bodega", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Política de Ofertas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Una oferta registrada bloquea el reprecio de la unidad hasta su vencimiento.
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <CampoNumero
            etiqueta="Vigencia de oferta (días)"
            ayuda="Días que una cotización entregada permanece vigente."
            nota="Debe coincidir con lo que establezca el contrato de adhesión registrado ante PROFECO."
            valor={motor.vigencia_oferta_dias}
            step={1}
            min={1}
            max={90}
            onChange={(v) => actualizarParametro("vigencia_oferta_dias", Math.min(90, Math.max(1, v)))}
          />
        </CardContent>
      </Card>

      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Tratamiento fiscal diferenciado. El componente de casa habitación se registra como
          exento. Cajones y bodegas se registran como componente gravado. El motor mantiene
          ambos separados en todo momento. Valida la desagregación con el área contable antes
          de publicar cualquier precio.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Factores Multiplicativos</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="torre">
            <TabsList>
              {SUB_PESTANAS.map((s) => (
                <TabsTrigger key={s.valor} value={s.valor} className="text-xs">
                  {s.titulo}
                </TabsTrigger>
              ))}
            </TabsList>
            {SUB_PESTANAS.map((s) => (
              <TabsContent key={s.valor} value={s.valor} className="mt-4">
                <TablaFactores
                  tipo={s.valor}
                  factores={motor.factores.filter((f) => f.tipo_factor === s.valor)}
                  propiedades={propiedades}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <span className="tabular-nums">
            <span className="text-muted-foreground">Unidades: </span>
            {totales.unidades}
          </span>
          <span className="tabular-nums">
            <span className="text-muted-foreground">Valor total calculado: </span>
            {formatoMoneda(totales.totalCalculado)}{" "}
            <span className="text-xs text-muted-foreground">Libro: Comercial</span>
          </span>
          <span className="tabular-nums">
            <span className="text-muted-foreground">Valor total actual: </span>
            {formatoMoneda(totales.totalActual)}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs tabular-nums",
              totales.delta >= 0
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {formatoPorcentaje(totales.deltaPct)} · {formatoMoneda(totales.delta)}
          </span>
          <span className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
            <TriangleAlert className="size-4" />
            Alertas: {totales.conAlertas}
          </span>
        </div>
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restablecer valores del motor</AlertDialogTitle>
            <AlertDialogDescription>
              Se devolverán todos los parámetros y factores a la configuración semilla. Esta
              acción no elimina información de inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                restablecer();
                toast.success("Configuración restablecida a los valores semilla.");
              }}
            >
              Restablecer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialogoCalibrado} onOpenChange={setDialogoCalibrado}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Declarar el motor como calibrado</AlertDialogTitle>
            <AlertDialogDescription>
              No se corrió una regresión. Estás afirmando que el motor reproduce la lista
              vigente. Esta declaración queda registrada en la bitácora con tu nombre y no se
              puede borrar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">
              Justificación (mínimo 40 caracteres)
            </Label>
            <Input
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              placeholder="Por qué el motor puede considerarse calibrado sin regresión"
            />
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {justificacion.trim().length} / 40
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={justificacion.trim().length < 40}
              onClick={() => {
                declararCalibradoManualmente(justificacion.trim());
                setJustificacion("");
                setDialogoCalibrado(false);
                toast.success("Calibración declarada manualmente y registrada en bitácora.");
              }}
            >
              Declarar calibrado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PantallaMotor;
