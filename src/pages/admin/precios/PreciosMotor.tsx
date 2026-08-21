import { useMemo, useState } from "react";

import { Equal, Info, RefreshCw, RotateCcw, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraficoCurva } from "@/features/precios/components/GraficoCurva";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoPrecioM2 } from "@/features/precios/components/CampoPrecioM2";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  calcularAreaPonderada,
  calcularFactorNivel,
  calcularFactorTamano,
} from "@/features/precios/engine/pricing";
import {
  formatoFecha,
  formatoM2,
  formatoMoneda,
  formatoMultiplicador,
  formatoPorcentaje,
} from "@/features/precios/lib/formato";
import { ESTATUS_A_LA_VENTA } from "@/features/precios/services/inventarioReal";
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

/**
 * Pesos abreviados para el eje del gráfico.
 *
 * El eje mide 520px de ancho total: "$1,850,432.00" se come el área de dibujo
 * y se encima con la curva. "$1.85 M" dice lo mismo en un tercio del espacio,
 * y la cifra exacta está en la tabla de abajo.
 */
function formatoPesosCompacto(valor: number): string {
  if (valor >= 1_000_000) return `${(valor / 1_000_000).toFixed(2)} M`;
  if (valor >= 1_000) return `${(valor / 1_000).toFixed(1)} k`;
  return `${valor.toFixed(0)}`;
}

/**
 * Un filtro del encabezado.
 *
 * Los cuatro se comportan igual: una opción neutra que no filtra, más los
 * valores que el inventario del proyecto realmente usa. No se listan catálogos
 * completos —una vista que ningún departamento tiene solo estorba— y por eso
 * las opciones salen del inventario y no de una constante.
 */
function Cifra({
  etiqueta,
  valor,
  nota,
  tono,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  tono?: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", tono ?? "text-foreground")}>
        {valor}
      </p>
      {nota ? <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p> : null}
    </div>
  );
}

/** Opción del selector de modelo que no acota: la curva se ve con todos juntos. */
const SIN_FILTRO = "__todos__";

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
    actualizarPrecioBaseProyecto,
    actualizarBaseModelo,
    definirNivelModelo,
    ponerEnPuntoBase,
    declararCalibradoManualmente,
    restablecer,
  } = useMotorAuditado();
  const errorMigracion = useMotorStore((s) => s.errorMigracion);
  const { motor, propiedades, desgloses, totales } = usePreciosProyecto();
  const [confirmar, setConfirmar] = useState(false);
  const [confirmarPuntoBase, setConfirmarPuntoBase] = useState(false);
  const [confirmarTamano, setConfirmarTamano] = useState(false);
  const [dialogoCalibrado, setDialogoCalibrado] = useState(false);
  /**
   * Modelo que se inspecciona en la curva de nivel, aparte del filtro global.
   *
   * Aquí sí conviene un control propio: se recorre modelo por modelo para ver
   * cómo responde cada uno a la pendiente, y hacerlo desde el filtro de arriba
   * obligaría a reacomodar toda la pantalla en cada paso.
   */
  const [justificacion, setJustificacion] = useState("");
  const [modeloCurva, setModeloCurva] = useState("");


  /*
   * Precio comercial de hoy: los promedios ponderados de lo que TODAVÍA se
   * puede vender.
   *
   * Se acota a `ESTATUS_A_LA_VENTA` porque una unidad vendida hace meses no
   * dice a cuánto se vende hoy, y en proyectos maduros el saldo vendido pesa
   * mucho más que el remanente: Margot tiene 293 entregadas contra 5
   * disponibles, así que el promedio de todo el inventario describiría el
   * pasado, no el precio vigente.
   *
   * Si hay un filtro de Estatus puesto a mano, se respeta ese y no se le
   * encima este: filtrar por Vendido para ver ese promedio es una intención
   * legítima, y cruzarla con "a la venta" daría cero unidades sin explicación.
   *
   * Salen de los desgloses vigentes, así que cualquier variable que se toque
   * en esta pantalla los mueve.
   */
  const aLaVenta = useMemo(() => {
    const porId = new Map(desgloses.map((d) => [d.id_propiedad, d]));
    let precio = 0;
    let area = 0;
    let areaInterior = 0;
    let lista = 0;
    let unidades = 0;
    for (const p of propiedades) {
      if (!ESTATUS_A_LA_VENTA.has(p.estatus)) continue;
      const d = porId.get(p.id_propiedad);
      if (!d || d.area_ponderada <= 0) continue;
      precio += d.precio_calculado;
      area += d.area_ponderada;
      areaInterior += p.m2_interiores;
      lista += p.precio_lista_actual;
      unidades++;
    }
    return {
      unidades,
      area,
      areaInterior,
      calculado: precio,
      lista,
      delta: precio - lista,
      deltaPct: lista > 0 ? ((precio - lista) / lista) * 100 : 0,
      porM2: area > 0 ? precio / area : 0,
      porUnidad: unidades > 0 ? precio / unidades : 0,
    };
  }, [propiedades, desgloses]);

  const brechaBase =
    motor.precio_base_m2_proyecto > 0 && aLaVenta.porM2 > 0
      ? ((aLaVenta.porM2 - motor.precio_base_m2_proyecto) /
          motor.precio_base_m2_proyecto) *
        100
      : 0;


  // Memoizado porque ahora es dependencia de otros memos: el `?? []`
  // devolveria un arreglo nuevo en cada render y los invalidaria siempre.
  const bases = useMemo(() => motor.bases_modelo ?? [], [motor.bases_modelo]);

  /*
   * Lo que el motor calcula HOY para las unidades de cada modelo.
   *
   * Las tres primeras columnas de la tabla son configuración: el factor del
   * modelo y su precio por m² son dos vistas del mismo dato capturado, y no se
   * mueven solos. Pero el precio real de una unidad lleva encima su torre, su
   * vista, su nivel, su tamaño y sus extras, así que tocar cualquier factor
   * multiplicativo cambia lo que valen los modelos aunque su base no cambie.
   * Sin estas dos columnas la tabla se quedaba quieta mientras el inventario
   * se movía, que es justo lo que no debe pasar en una pantalla de simulación.
   */
  const porModelo = useMemo(() => {
    const porId = new Map(desgloses.map((d) => [d.id_propiedad, d]));
    const acum = new Map<
      string,
      {
        unidades: number;
        conDesglose: number;
        area: number;
        precio: number;
        ventaUnidades: number;
        ventaValor: number;
      }
    >();
    for (const p of propiedades) {
      const a = acum.get(p.id_modelo) ?? {
        unidades: 0,
        conDesglose: 0,
        area: 0,
        precio: 0,
        ventaUnidades: 0,
        ventaValor: 0,
      };
      a.unidades++;
      const d = porId.get(p.id_propiedad);
      if (d && d.area_ponderada > 0) {
        a.conDesglose++;
        a.area += d.area_ponderada;
        a.precio += d.precio_calculado;
        // El valor vendible del modelo: los promedios no distinguen entre un
        // modelo agotado y otro con la mitad del inventario vivo.
        if (ESTATUS_A_LA_VENTA.has(p.estatus)) {
          a.ventaUnidades++;
          a.ventaValor += d.precio_calculado;
        }
      }
      acum.set(p.id_modelo, a);
    }
    return acum;
  }, [propiedades, desgloses]);

  const unidadesPorModelo = useMemo(
    () => new Map([...porModelo].map(([id, v]) => [id, v.unidades])),
    [porModelo],
  );


  /*
   * De mayor a menor inventario. Los modelos llegan en el orden del catálogo,
   * que no dice nada: el modelo con 145 unidades y el que tiene 2 pesan igual
   * en la lista y muy distinto en el desarrollo. Ordenar por unidades pone
   * arriba las decisiones que mueven más dinero. Empate: por nombre, para que
   * la tabla no baile entre renders.
   */
  const basesOrdenadas = [...bases].sort((a, b) => {
    const ua = unidadesPorModelo.get(a.id_modelo) ?? 0;
    const ub = unidadesPorModelo.get(b.id_modelo) ?? 0;
    return ub - ua || a.nombre_modelo.localeCompare(b.nombre_modelo, "es");
  });

  /** Área pivote de la curva de tamaño: la de los modelos que están a la vista. */
  const m2RefPreview =
    basesOrdenadas.length > 0
      ? basesOrdenadas.reduce((a, b) => a + b.m2_referencia, 0) / basesOrdenadas.length
      : 80;


  /*
   * La curva de nivel vista sobre el inventario real, nivel por nivel.
   *
   * El multiplicador de arriba dice cuánto sube el factor; esto dice cuánto
   * sube el precio, que es la pregunta real al mover la pendiente. Se agrega
   * con la misma ponderación que la tabla de modelos: el precio por m² es
   * `Σ precio / Σ área` del nivel, y el del departamento ese precio por el m²
   * promedio del nivel. Los dos cuadran entre sí por construcción.
   *
   * Se usa `precio_calculado` y no `precio_lista`: un override manual es
   * justo lo que no responde a la curva, y dejarlo dentro aplanaría el efecto
   * que se está tratando de ver.
   */
  /*
   * El modelo elegido a mano manda, pero solo mientras siga existiendo en lo
   * filtrado: si arriba se filtra por otra torre, el que estaba seleccionado
   * puede quedarse sin unidades y la sección se veria vacía sin decir por qué.
   * En ese caso cae al del filtro global, y si no hay, al de más inventario.
   */
  const modeloCurvaVigente = useMemo(() => {
    const presentes = basesOrdenadas.map((b) => b.id_modelo);
    if (modeloCurva === SIN_FILTRO) return SIN_FILTRO;
    if (modeloCurva && presentes.includes(modeloCurva)) return modeloCurva;
    return presentes[0] ?? SIN_FILTRO;
  }, [modeloCurva, basesOrdenadas]);

  /*
   * La curva que de verdad se le aplica al modelo elegido.
   *
   * Si el modelo tiene una propia, es esa; si no, la del proyecto. Los campos
   * muestran siempre valores reales, así que al editarlos partiendo de la
   * general no hay que teclear desde cero: se toma lo que ya estaba y se ajusta.
   */
  const baseModeloCurva = useMemo(
    () =>
      (motor.bases_modelo ?? []).find((b) => b.id_modelo === modeloCurvaVigente) ?? null,
    [motor.bases_modelo, modeloCurvaVigente],
  );
  const tieneNivelPropio = !!baseModeloCurva?.nivel;
  const nivelDelModelo = baseModeloCurva?.nivel ?? motor.nivel;

  const nivelesDelModelo = useMemo(() => {
    const desglosePorId = new Map(desgloses.map((d) => [d.id_propiedad, d]));
    const acum = new Map<number, { unidades: number; area: number; precio: number }>();

    for (const p of propiedades) {
      if (modeloCurvaVigente !== SIN_FILTRO && p.id_modelo !== modeloCurvaVigente) continue;
      const d = desglosePorId.get(p.id_propiedad);
      if (!d || d.area_ponderada <= 0) continue;
      const a = acum.get(p.nivel) ?? { unidades: 0, area: 0, precio: 0 };
      a.unidades += 1;
      a.area += d.area_ponderada;
      a.precio += d.precio_calculado;
      acum.set(p.nivel, a);
    }

    const filas = [...acum.entries()]
      .map(([nivel, a]) => ({
        nivel,
        unidades: a.unidades,
        m2: a.area / a.unidades,
        precio_m2: a.precio / a.area,
        precio_depto: a.precio / a.unidades,
      }))
      .sort((a, b) => a.nivel - b.nivel);

    // Variación contra el nivel más bajo del modelo: es lo que se busca al
    // mover la pendiente, y en pesos absolutos no se alcanza a ver.
    const piso = filas[0];
    return filas.map((f) => ({
      ...f,
      varPct: piso && piso.precio_depto > 0
        ? ((f.precio_depto - piso.precio_depto) / piso.precio_depto) * 100
        : 0,
      varMonto: piso ? f.precio_depto - piso.precio_depto : 0,
    }));
  }, [propiedades, desgloses, modeloCurvaVigente]);

  /*
   * Las áreas que el proyecto tiene de verdad, modelo por modelo.
   *
   * La tabla de esta sección mostraba tres áreas inventadas —el m² de
   * referencia por 0.7, 1.0 y 1.6—, que sirven para entender la forma de la
   * curva pero no para decidir nada: no dicen a qué modelo del desarrollo le
   * pega ni cuánto.
   */
  const areasPorModelo = useMemo(() => {
    const porId = new Map(desgloses.map((d) => [d.id_propiedad, d]));
    const acum = new Map<
      string,
      { unidades: number; min: number; max: number; suma: number; exento: number }
    >();
    for (const p of propiedades) {
      const area = calcularAreaPonderada(p, motor);
      if (area <= 0) continue;
      const a = acum.get(p.id_modelo) ?? {
        unidades: 0,
        min: Number.POSITIVE_INFINITY,
        max: 0,
        suma: 0,
        exento: 0,
      };
      a.unidades++;
      a.min = Math.min(a.min, area);
      a.max = Math.max(a.max, area);
      a.suma += area;
      // El exento es la parte del precio que escala con el factor del modelo;
      // cajones y bodegas van por fuera y no entran en este reparto.
      a.exento += porId.get(p.id_propiedad)?.componente_exento ?? 0;
      acum.set(p.id_modelo, a);
    }
    return acum;
  }, [propiedades, desgloses, motor]);

  /**
   * Área donde la curva de tamaño vale 1.0000.
   *
   * No es el promedio simple de las áreas. Con el promedio, aplicar la curva
   * arrastra el valor del proyecto hacia abajo —medido sobre Monócolo, hasta
   * -1.08% con θ = 0.15— porque los modelos grandes pesan más en el valor que
   * en el conteo y son justo los que reciben factor menor que 1. Un botón que
   * dice "reparte" y de paso recorta un punto porcentual del desarrollo es una
   * trampa.
   *
   * Así que el pivote se despeja de la condición de neutralidad: se busca la P
   * tal que `Σ (P/aₘ)^θ · Wₘ = Σ fₘ · Wₘ`, donde `Wₘ` es lo que cada modelo
   * aporta por área. Como `Eₘ = base · fₘ · Wₘ`, la P se despeja en forma
   * cerrada:
   *
   *     P = [ Σ Eₘ / Σ (Eₘ · aₘ^(−θ) / fₘ) ] ^ (1/θ)
   *
   * Con θ = 0 la ecuación no tiene solución útil —todos los factores quedan en
   * 1 valga lo que valga P— y ahí sí se devuelve el promedio simple: el pivote
   * no influye, y aplanar los modelos es lo que θ = 0 significa.
   */
  const areaPivote = useMemo(() => {
    const theta = motor.tamano.theta;
    const bases_ = motor.bases_modelo ?? [];

    let sumaArea = 0;
    let unidades = 0;
    let numerador = 0;
    let denominador = 0;
    for (const [idModelo, v] of areasPorModelo) {
      sumaArea += v.suma;
      unidades += v.unidades;
      const area = v.suma / v.unidades;
      const factor = bases_.find((b) => b.id_modelo === idModelo)?.factor_modelo ?? 1;
      if (area <= 0 || factor <= 0 || v.exento <= 0) continue;
      numerador += v.exento;
      denominador += (v.exento * Math.pow(area, -theta)) / factor;
    }

    const promedio = unidades > 0 ? sumaArea / unidades : m2RefPreview;
    if (theta <= 1e-9 || numerador <= 0 || denominador <= 0) return promedio;
    const p = Math.pow(numerador / denominador, 1 / theta);
    return Number.isFinite(p) && p > 0 ? p : promedio;
  }, [areasPorModelo, motor.tamano.theta, motor.bases_modelo, m2RefPreview]);

  /**
   * Los modelos ordenados por área promedio, de mayor a menor.
   *
   * El resto de la pantalla ordena por número de unidades, que es lo que pesa
   * al decidir precios. Aquí no: la variable de esta sección es el área, y
   * ordenada se lee como una progresión —el multiplicador sube monótonamente
   * conforme baja el metraje— en vez de como una lista de números sueltos.
   * Los modelos sin unidades en lo filtrado se van al final.
   */
  const basesPorArea = useMemo(() => {
    const areaDe = (idModelo: string) => {
      const a = areasPorModelo.get(idModelo);
      return a && a.unidades > 0 ? a.suma / a.unidades : -1;
    };
    return [...bases].sort(
      (a, b) =>
        areaDe(b.id_modelo) - areaDe(a.id_modelo) ||
        a.nombre_modelo.localeCompare(b.nombre_modelo, "es"),
    );
  }, [bases, areasPorModelo]);

  /** Factor que la curva de tamaño le asignaría a un modelo por su área. */
  const factorDeTamanoDelModelo = (idModelo: string) => {
    const a = areasPorModelo.get(idModelo);
    if (!a || a.unidades === 0) return 1;
    return calcularFactorTamano(a.suma / a.unidades, areaPivote, motor.tamano.theta);
  };

  /*
   * Escribe en los factores de modelo lo que dice la curva.
   *
   * No es automático a propósito. El factor de un modelo puede venir de precios
   * de mercado capturados, y que moverse un slider lo pisara sin aviso sería
   * perder ese trabajo sin manera de recuperarlo. Con el botón queda además una
   * entrada por modelo en la bitácora.
   */
  const aplicarCurvaTamanoAModelos = () => {
    for (const b of bases) {
      actualizarBaseModelo(
        b.id_modelo,
        "factor_modelo",
        +factorDeTamanoDelModelo(b.id_modelo).toFixed(6),
      );
    }
    toast.success("Los factores de modelo quedaron alineados con la curva de tamaño.");
  };

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

  /** La curva se dibuja sobre el rango de áreas que el proyecto realmente tiene. */
  const puntosTamano = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (const v of areasPorModelo.values()) {
      min = Math.min(min, v.min);
      max = Math.max(max, v.max);
    }
    if (!Number.isFinite(min) || max <= min) {
      min = m2RefPreview * 0.6;
      max = m2RefPreview * 1.6;
    }
    const salto = (max - min) / 20;
    return Array.from({ length: 21 }, (_, i) => {
      const area = min + salto * i;
      return {
        x: Math.round(area * 100) / 100,
        y: calcularFactorTamano(area, areaPivote, motor.tamano.theta),
      };
    });
  }, [areasPorModelo, areaPivote, motor.tamano.theta, m2RefPreview]);

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
        <Button variant="outline" onClick={() => setConfirmarPuntoBase(true)}>
          <Equal className="size-4" />
          Llevar a punto base
        </Button>
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
          <CardTitle className="text-xl font-semibold">
            Inventario disponible a la venta
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Lo que queda por vender, valuado con el motor tal como está en este momento.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {aLaVenta.unidades === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este proyecto no tiene ninguna unidad en estatus Disponible. Si esperabas ver
              inventario aquí, revisa si está capturado como Inventario: ese estatus no
              cuenta como a la venta, igual que en el Forecast de Ingresos.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Cifra
                  etiqueta="Unidades"
                  valor={String(aLaVenta.unidades)}
                  nota={`de ${totales.unidades} en el proyecto`}
                />
                <Cifra
                  etiqueta="Área ponderada"
                  valor={formatoM2(aLaVenta.area)}
                  nota={`${formatoM2(aLaVenta.areaInterior)} de interior`}
                />
                <Cifra
                  etiqueta="Valor calculado"
                  valor={formatoMoneda(aLaVenta.calculado)}
                  nota="Con el motor vigente"
                />
                <Cifra
                  etiqueta="Valor en lista actual"
                  valor={formatoMoneda(aLaVenta.lista)}
                  nota="Lo capturado en inventario"
                />
                <Cifra
                  etiqueta="Diferencia"
                  valor={formatoPorcentaje(aLaVenta.deltaPct, 2)}
                  nota={formatoMoneda(aLaVenta.delta)}
                  tono={
                    Math.abs(aLaVenta.deltaPct) < 0.005
                      ? "text-muted-foreground"
                      : aLaVenta.deltaPct > 0
                        ? "text-primary"
                        : "text-destructive"
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Todo se recalcula al mover cualquier variable del motor, así que sirve para
                ver en el acto qué le hace cada cambio al valor de lo que queda por vender.
                La <strong>diferencia</strong> compara el valor que calcula el motor contra
                el precio de lista ya capturado en inventario. Sobre el inventario completo
                un motor recién sembrado cuadra por construcción, pero sobre el remanente no
                tiene por qué: las unidades ya vendidas se listaron antes y más baratas, y
                jalan el promedio del que nace el motor. Una diferencia negativa grande suele
                querer decir que lo que queda está listado por encima de lo que el motor
                sostiene, no que el motor esté mal.
              </p>
              <p className="text-xs text-muted-foreground">
                Cuenta solo las unidades en estatus Disponible, el mismo criterio que el
                Forecast de Ingresos de Alta Dirección, para que las dos pantallas den la
                misma cifra.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Precio por m² base del proyecto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="precio-base-proyecto" className="text-sm">
                Precio por m² base
              </Label>
              <CampoPrecioM2
                id="precio-base-proyecto"
                valor={motor.precio_base_m2_proyecto}
                onChange={actualizarPrecioBaseProyecto}
                className="w-60 text-lg"
              />
            </div>
            <p className="pb-2 text-sm text-muted-foreground">
              Todo el desarrollo parte de aquí. Al moverlo, el precio de cada modelo se
              recalcula con su factor y el inventario completo se reprecia.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Precio promedio ponderado por m²
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {aLaVenta.unidades === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <>
                    {formatoMoneda(aLaVenta.porM2)}
                    <span className="text-xs font-normal text-muted-foreground"> /m²</span>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {aLaVenta.unidades === 0
                  ? "Sin unidades a la venta."
                  : Math.abs(brechaBase) < 0.005
                    ? "Coincide con el precio base."
                    : `${formatoPorcentaje(brechaBase, 2)} respecto al precio base.`}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Precio promedio ponderado de todo el proyecto
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {aLaVenta.unidades === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  formatoMoneda(aLaVenta.porUnidad)
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {`Por unidad, sobre ${aLaVenta.unidades} de ${totales.unidades} unidades: las que siguen a la venta.`}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Las dos cifras salen del cálculo vigente del motor, así que cualquier variable
            que muevas en esta pantalla —factores, curvas, precio base o el factor de un
            modelo— las mueve. Son el precio comercial de hoy: cuentan solo las unidades en
            estatus <strong>Disponible</strong>, el mismo criterio que el Forecast de
            Ingresos. Una unidad vendida hace meses no dice a cuánto se vende hoy.
          </p>
          <p className="text-xs text-muted-foreground">
            Por eso no tienen por qué coincidir con el precio base ni recién sembrado el
            motor: el base se calcula con todo el inventario que tiene precio, vendido
            incluido, y estas dos solo con el remanente.
          </p>
          <p className="text-xs text-muted-foreground">
            El precio por m² de una unidad nunca es el base a secas: es base × factor de su
            modelo × nivel × torre × vista × orientación × extras × tamaño.
          </p>
        </CardContent>
      </Card>

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
                0 el precio por m² es constante y todos los modelos valen igual por m².
              </p>
            </div>
          </div>

          <GraficoCurva
            puntos={puntosTamano}
            etiquetaX="Área ponderada (m²)"
            etiquetaY="Multiplicador de tamaño"
          />

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Modelo
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Unidades
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Área promedio ↓
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Rango de áreas
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Multiplicador de tamaño
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Factor s/ base actual
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Precio promedio calculado por m²
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Precio promedio calculado por unidad
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Inventario a la venta
                  </th>
                </tr>
              </thead>
              <tbody>
                {basesPorArea.map((b) => {
                  const a = areasPorModelo.get(b.id_modelo);
                  const calc = porModelo.get(b.id_modelo);
                  const propuesto = factorDeTamanoDelModelo(b.id_modelo);
                  const igual = Math.abs(propuesto - (b.factor_modelo ?? 1)) < 5e-5;
                  return (
                    <tr key={b.id_modelo} className="border-t border-border">
                      <td className="px-3 py-1.5 font-medium text-foreground">
                        {b.nombre_modelo}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                        {a?.unidades ?? 0}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums">
                        {a ? formatoM2(a.suma / a.unidades) : "—"}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                        {a ? `${a.min.toFixed(2)} – ${a.max.toFixed(2)} m²` : "—"}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums font-medium text-foreground">
                        {formatoMultiplicador(propuesto)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-1.5 tabular-nums",
                          igual ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400",
                        )}
                      >
                        {formatoMultiplicador(b.factor_modelo ?? 1)}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-foreground">
                        {calc && calc.area > 0 ? (
                          <>
                            {formatoMoneda(calc.precio / calc.area)}
                            <span className="text-xs text-muted-foreground"> /m²</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums font-medium text-foreground">
                        {calc && calc.conDesglose > 0 ? (
                          formatoMoneda(calc.precio / calc.conDesglose)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setConfirmarTamano(true)}>
              <Equal className="size-4" />
              Aplicar a los factores de modelo
            </Button>
            <p className="text-xs text-muted-foreground">
              Escribe el multiplicador de cada modelo en su <strong>Factor s/ base</strong>,
              en la sección de abajo. Sobrescribe lo que haya capturado ahí.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            El multiplicador sale del área promedio de cada modelo contra el área pivote del
            desarrollo ({formatoM2(areaPivote)}), que es donde la curva vale 1.0000. Los
            modelos más chicos que el pivote quedan por encima de 1 y los más grandes por
            debajo. El pivote no es el promedio simple: se despeja para que aplicar la curva
            reparta sin mover el valor total del desarrollo, porque los modelos grandes pesan
            más en el valor que en el conteo y con el promedio simple el total se iría hacia
            abajo.
          </p>
          <p className="text-xs text-muted-foreground">
            Las dos últimas columnas son el precio que el motor calcula hoy para las
            unidades de cada modelo, con todo encima: no solo el tamaño, también su torre,
            vista, nivel y extras. Sirven para ver si el reparto por tamaño deja precios
            que tienen sentido, no solo multiplicadores ordenados.
          </p>
          <p className="text-xs text-muted-foreground">
            El <strong>factor s/ base actual</strong> se marca en ámbar cuando no coincide
            con lo que dice la curva. Que difiera no es un error: ese factor puede venir de
            precios de mercado capturados, que saben cosas que el tamaño solo no explica.
            Por eso el botón es explícito y no se aplica al mover θ.
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
                    Unidades
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Factor s/ base
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Precio por m² resultante
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    M² de referencia
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Precio promedio calculado por m²
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Precio promedio calculado por unidad
                  </th>
                </tr>
              </thead>
              <tbody>
                {basesOrdenadas.map((b) => {
                  const calc = porModelo.get(b.id_modelo);
                  const porM2 = calc && calc.area > 0 ? calc.precio / calc.area : 0;
                  const porUnidad =
                    calc && calc.conDesglose > 0 ? calc.precio / calc.conDesglose : 0;
                  return (
                  <tr key={b.id_modelo} className="border-t border-border">
                    <td className="px-3 py-1.5 font-medium text-foreground">
                      {b.nombre_modelo}
                      {/* Una curva propia es una excepción a la política del
                          desarrollo: si no se marca aquí, solo se descubre
                          entrando a la sección de Curva de Nivel. */}
                      {b.nivel ? (
                        <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-normal text-amber-700 dark:text-amber-400">
                          curva propia
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                      {unidadesPorModelo.get(b.id_modelo) ?? 0}
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        type="number"
                        step={0.001}
                        value={b.factor_modelo}
                        onChange={(e) =>
                          actualizarBaseModelo(
                            b.id_modelo,
                            "factor_modelo",
                            Number(e.target.value),
                          )
                        }
                        className="w-28 tabular-nums"
                      />
                    </td>
                    {/* Precio y factor son la misma cifra vista de dos formas:
                        capturar cualquiera de los dos actualiza el otro. */}
                    <td className="px-3 py-1.5">
                      <CampoPrecioM2
                        aria-label={`Precio por m² resultante de ${b.nombre_modelo}`}
                        valor={b.precio_base_m2}
                        onChange={(v) =>
                          actualizarBaseModelo(b.id_modelo, "precio_base_m2", v)
                        }
                        className="w-52"
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
                    {/* Estas dos salen del cálculo vigente, no de la captura:
                        por eso se mueven al tocar cualquier factor. */}
                    <td className="px-3 py-1.5 tabular-nums text-foreground">
                      {porM2 > 0 ? (
                        <>
                          {formatoMoneda(porM2)}
                          <span className="text-xs text-muted-foreground"> /m²</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums font-medium text-foreground">
                      {porUnidad > 0 ? (
                        formatoMoneda(porUnidad)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-foreground">
                      {calc && calc.ventaUnidades > 0 ? (
                        <>
                          {formatoMoneda(calc.ventaValor)}
                          <span className="text-xs text-muted-foreground">
                            {" · "}
                            {calc.ventaUnidades} u.
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            El modelo es una variable más sobre el precio base del proyecto: su factor dice
            cuánto se separa de él. Puedes capturar el factor o el precio por m² resultante —
            son la misma cifra vista de dos formas y el otro se recalcula solo.
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Inventario a la venta</strong> es la suma del precio de venta de las
            unidades del modelo que siguen en estatus Disponible, valuadas con el motor de
            este momento. Un modelo puede tener el promedio por unidad más alto del
            desarrollo y casi nada que vender; la suma lo distingue y el promedio no.
          </p>
          <p className="text-xs text-muted-foreground">
            Las tres primeras columnas se capturan; las dos siguientes las calcula el motor
            sobre las unidades reales del modelo, ya con su torre, vista, nivel, tamaño y
            extras encima. Por eso se mueven al tocar cualquier factor multiplicativo
            aunque el precio base del modelo no cambie: desde el punto base, subir el
            factor de una torre sube el promedio de los modelos que tienen unidades ahí, y
            deja igual a los que no.
          </p>
          <p className="text-xs text-muted-foreground">
            Los modelos van de mayor a menor número de unidades. El <strong>m² de
            referencia</strong> es el promedio de las unidades del modelo, no el metraje de
            una sola: dentro de un mismo modelo el área varía.
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

          <div className="space-y-4 border-t border-border pt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Efecto sobre el inventario
                </h3>
                <p className="text-xs text-muted-foreground">
                  Cómo cambia el precio de las unidades del modelo piso por piso. Cada modelo
                  puede llevar su propia pendiente y amortiguamiento, porque no todos ganan
                  lo mismo por subir de piso.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="modelo-curva"
                  className="text-[13px] font-medium text-muted-foreground"
                >
                  Modelo
                </Label>
                <Select value={modeloCurvaVigente} onValueChange={setModeloCurva}>
                  <SelectTrigger id="modelo-curva" className="w-60">
                    <SelectValue placeholder="Elige un modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_FILTRO}>Todos los modelos</SelectItem>
                    {basesOrdenadas.map((b) => (
                      <SelectItem key={b.id_modelo} value={b.id_modelo}>
                        {b.nombre_modelo} · {unidadesPorModelo.get(b.id_modelo) ?? 0} u.
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {baseModeloCurva ? (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">
                    Curva propia de {baseModeloCurva.nombre_modelo}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        tieneNivelPropio
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {tieneNivelPropio ? "Curva propia" : "Usa la general"}
                    </span>
                    {tieneNivelPropio ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => definirNivelModelo(baseModeloCurva.id_modelo, null)}
                      >
                        <X className="size-4" />
                        Volver a la general
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium text-muted-foreground">
                      Pendiente por piso (a)
                    </Label>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[nivelDelModelo.coef_a]}
                        min={0}
                        max={0.025}
                        step={0.0005}
                        onValueChange={([v]) =>
                          definirNivelModelo(baseModeloCurva.id_modelo, {
                            coef_a: v ?? 0,
                            coef_b: nivelDelModelo.coef_b,
                          })
                        }
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        step={0.0005}
                        value={nivelDelModelo.coef_a}
                        onChange={(e) =>
                          definirNivelModelo(baseModeloCurva.id_modelo, {
                            coef_a: Number(e.target.value),
                            coef_b: nivelDelModelo.coef_b,
                          })
                        }
                        className="w-28 tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium text-muted-foreground">
                      Amortiguamiento (b)
                    </Label>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[nivelDelModelo.coef_b]}
                        min={0}
                        max={0.0005}
                        step={0.00001}
                        onValueChange={([v]) =>
                          definirNivelModelo(baseModeloCurva.id_modelo, {
                            coef_a: nivelDelModelo.coef_a,
                            coef_b: v ?? 0,
                          })
                        }
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        step={0.00001}
                        value={nivelDelModelo.coef_b}
                        onChange={(e) =>
                          definirNivelModelo(baseModeloCurva.id_modelo, {
                            coef_a: nivelDelModelo.coef_a,
                            coef_b: Number(e.target.value),
                          })
                        }
                        className="w-28 tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {tieneNivelPropio
                    ? "Este modelo ya no sigue la curva del proyecto: mover la pendiente general no lo mueve. La gráfica y la tabla de multiplicadores de arriba siguen mostrando la general; los precios de abajo usan esta."
                    : "Tocar cualquiera de los dos le crea una curva propia a este modelo, partiendo de los valores de la general. Los demás modelos no se enteran."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  El nivel donde la curva vale 1.0000 sigue siendo el del proyecto, igual para
                  todos los modelos: si cada uno arrancara en un piso distinto, sus curvas no
                  serían comparables.
                </p>
              </div>
            ) : null}

            {nivelesDelModelo.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este modelo todavía no tiene unidades con precio calculado.
              </p>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Precio por metro cuadrado
                    </p>
                    <GraficoCurva
                      puntos={nivelesDelModelo.map((n) => ({ x: n.nivel, y: n.precio_m2 }))}
                      etiquetaX="Nivel"
                      etiquetaY="Precio por m²"
                      formatoValor={formatoPesosCompacto}
                      lineaBase={null}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Precio final de venta
                    </p>
                    <GraficoCurva
                      puntos={nivelesDelModelo.map((n) => ({ x: n.nivel, y: n.precio_depto }))}
                      etiquetaX="Nivel"
                      etiquetaY="Precio final de venta"
                      formatoValor={formatoPesosCompacto}
                      lineaBase={null}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Nivel
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Unidades
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          M² promedio
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Precio por metro cuadrado
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Precio final de venta
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Variación vs. nivel {nivelesDelModelo[0]?.nivel ?? "—"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {nivelesDelModelo.map((n) => (
                        <tr key={n.nivel} className="border-t border-border">
                          <td className="px-3 py-1.5 tabular-nums">{n.nivel}</td>
                          <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                            {n.unidades}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums">{formatoM2(n.m2)}</td>
                          <td className="px-3 py-1.5 tabular-nums">
                            {formatoMoneda(n.precio_m2)}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums font-medium text-foreground">
                            {formatoMoneda(n.precio_depto)}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-1.5 tabular-nums",
                              Math.abs(n.varPct) < 0.005
                                ? "text-muted-foreground"
                                : n.varPct > 0
                                  ? "text-primary"
                                  : "text-destructive",
                            )}
                          >
                            {formatoPorcentaje(n.varPct, 2)}
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              {formatoMoneda(n.varMonto)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-muted-foreground">
                  Cada renglón promedia las unidades de ese nivel: el precio por m² es la suma
                  de precios entre la suma de m², y el precio final de venta es ese precio por
                  el m² promedio del nivel. La <strong>variación</strong> compara contra el
                  nivel más bajo del modelo, que es donde la curva vale 1.0000. Dos niveles
                  pueden diferir aunque la curva esté plana, porque el metraje no es idéntico
                  piso por piso.
                </p>
                <p className="text-xs text-muted-foreground">
                  Se grafica el precio que calcula el motor, no el de lista: un precio forzado
                  a mano no responde a la curva y taparía justo lo que se quiere ver.
                  {modeloCurvaVigente === SIN_FILTRO ? (
                    <>
                      {" "}
                      Con todos los modelos juntos, un brinco entre niveles puede venir de que
                      arriba haya modelos distintos y no de los coeficientes: elige un modelo
                      para aislarlo.
                    </>
                  ) : null}
                </p>
              </>
            )}
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

      <AlertDialog open={confirmarTamano} onOpenChange={setConfirmarTamano}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar la curva de tamaño a los modelos</AlertDialogTitle>
            <AlertDialogDescription>
              El factor s/ base de cada modelo pasa a ser el multiplicador que le toca por su
              área. Los {bases.length} modelos del proyecto se reescriben, incluidos los que
              tengan un factor capturado a mano. Con θ mayor que cero el valor total del
              desarrollo no cambia: se reparte entre modelos. Con θ = 0 todos quedan en
              1.0000, que sí mueve el total si venían de otro lado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            Los precios de las unidades cambian en consecuencia. Cada modelo queda como una
            entrada aparte en la bitácora, así que se puede ver después qué tenía antes.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aplicarCurvaTamanoAModelos}>
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarPuntoBase} onOpenChange={setConfirmarPuntoBase}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Llevar el motor a su punto base</AlertDialogTitle>
            <AlertDialogDescription>
              El motor queda plano: cada unidad pasa a valer el precio por m² base del
              proyecto por su área interior, sin ninguna diferenciación. Es el punto de
              partida para mover una variable a la vez y ver qué tanto mueve el precio.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Factores de torre, vista y orientación a <strong>1.0000</strong>, y los extras
              a <strong>0</strong>: los extras suman en vez de multiplicar, y ahí el neutro
              es cero.
            </li>
            <li>
              Factor sobre base de cada modelo a <strong>1.0000</strong>: todos los modelos
              pasan a valer lo mismo por m².
            </li>
            <li>
              k_ext y k_loft a <strong>0</strong>: el área exterior y la de loft dejan de
              sumar al precio. Las unidades con balcón, terraza o loft son las que más
              bajan.
            </li>
            <li>
              Curva de nivel y curva de tamaño a <strong>0</strong>: el piso y el metraje
              dejan de mover el precio por m².
            </li>
            <li>
              Accesorios a <strong>0</strong>: cajones y bodegas dejan de sumar.
            </li>
            <li>Tasa de descuento anual a <strong>0</strong>.</li>
          </ul>

          <p className="text-sm text-foreground">
            Los precios van a cambiar, y bastante. No se toca el precio por m² base del
            proyecto, ni el inventario, ni los precios de lista ya capturados, y la lista
            sigue en borrador. El motor queda marcado como <strong>sin calibrar</strong>,
            porque plano no es calibrado.
          </p>
          <p className="text-sm text-muted-foreground">
            No hay deshacer. Lo que había queda registrado en la bitácora, y
            <strong> Restablecer valores</strong> vuelve a sembrar desde el inventario.
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                ponerEnPuntoBase();
                toast.success(
                  "El motor quedó en su punto base. Mueve una variable a la vez para ver su efecto.",
                );
              }}
            >
              Llevar a punto base
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
