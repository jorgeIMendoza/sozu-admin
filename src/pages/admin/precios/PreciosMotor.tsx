import { useMemo, useState } from "react";

import { Info, RefreshCw, RotateCcw, TriangleAlert, X } from "lucide-react";
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
  calcularFactorNivel,
  calcularFactorTamano,
} from "@/features/precios/engine/pricing";
import { valorFactor } from "@/features/precios/engine/anclaje";
import {
  formatoFecha,
  formatoM2,
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
function FiltroInventario({
  etiqueta,
  etiquetaTodos,
  valor,
  onChange,
  opciones,
  todos,
}: {
  etiqueta: string;
  etiquetaTodos: string;
  valor: string;
  onChange: (v: string) => void;
  opciones: Array<{ id: string; nombre: string; unidades: number }>;
  todos: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-muted-foreground">{etiqueta}</Label>
      {/* Con una sola opción no hay nada que discriminar: elegirla devuelve el
          mismo universo. Pasa de verdad —hay proyectos sin vista capturada, donde
          las 320 unidades caen en "Sin vista"— y dejarlo activo invita a un clic
          que no cambia nada. */}
      <Select value={valor} onValueChange={onChange} disabled={opciones.length <= 1}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={todos}>{etiquetaTodos}</SelectItem>
          {opciones.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nombre} · {o.unidades} u.
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Un eje del ancla. Sin opción neutra: el ancla es siempre una combinación concreta. */
function CampoAncla({
  etiqueta,
  valor,
  onChange,
  opciones,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  opciones: Array<{ id: string; nombre: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-muted-foreground">{etiqueta}</Label>
      <Select value={valor} onValueChange={onChange} disabled={opciones.length === 0}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Opción neutra de los filtros: no acota nada. */
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
    reanclar,
    declararCalibradoManualmente,
    restablecer,
  } = useMotorAuditado();
  const errorMigracion = useMotorStore((s) => s.errorMigracion);
  const { motor, propiedades, desgloses, totales, indices, alertasPorUnidad } =
    usePreciosProyecto();
  const [confirmar, setConfirmar] = useState(false);
  const [dialogoCalibrado, setDialogoCalibrado] = useState(false);
  const [filtros, setFiltros] = useState({
    torre: SIN_FILTRO,
    modelo: SIN_FILTRO,
    vista: SIN_FILTRO,
    estatus: SIN_FILTRO,
  });
  const [justificacion, setJustificacion] = useState("");

  /*
   * Opciones de los filtros: solo lo que el inventario del proyecto usa, con
   * su conteo. Se calculan sobre el inventario COMPLETO y no en cascada: si
   * las opciones de Modelo dependieran de la Torre elegida, cambiar de torre
   * dejaría un modelo seleccionado que ya no existe en la lista y el filtro
   * se quedaría mostrando cero unidades sin decir por qué.
   */
  const opcionesFiltro = useMemo(() => {
    const cuenta = <T,>(clave: (p: (typeof propiedades)[number]) => T | null) => {
      const m = new Map<T, number>();
      for (const p of propiedades) {
        const k = clave(p);
        if (k === null || k === "") continue;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return m;
    };
    const listar = (m: Map<string, number>, nombre: (id: string) => string) =>
      [...m.entries()]
        .map(([id, unidades]) => ({ id, nombre: nombre(id), unidades }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return {
      torres: listar(cuenta((p) => p.id_torre), (id) =>
        indices?.torresPorId[id]?.nombre ?? id,
      ),
      modelos: listar(cuenta((p) => p.id_modelo), (id) =>
        indices?.modelosPorId[id]?.nombre ?? id,
      ),
      vistas: listar(cuenta((p) => p.vista), (id) => id),
      estatus: listar(cuenta((p) => p.estatus), (id) => id),
      orientaciones: listar(cuenta((p) => p.orientacion), (id) => id),
      // El nivel ordena por número, no alfabéticamente: 10 no va antes que 2.
      niveles: [...cuenta((p) => String(p.nivel)).entries()]
        .map(([id, unidades]) => ({ id, nombre: id, unidades }))
        .sort((a, b) => Number(a.id) - Number(b.id)),
    };
  }, [propiedades, indices]);

  const hayFiltro = Object.values(filtros).some((v) => v !== SIN_FILTRO);

  const propiedadesFiltradas = useMemo(
    () =>
      !hayFiltro
        ? propiedades
        : propiedades.filter(
            (p) =>
              (filtros.torre === SIN_FILTRO || p.id_torre === filtros.torre) &&
              (filtros.modelo === SIN_FILTRO || p.id_modelo === filtros.modelo) &&
              (filtros.vista === SIN_FILTRO || p.vista === filtros.vista) &&
              (filtros.estatus === SIN_FILTRO || p.estatus === filtros.estatus),
          ),
    [propiedades, filtros, hayFiltro],
  );

  const desglosesFiltrados = useMemo(() => {
    if (!hayFiltro) return desgloses;
    const ids = new Set(propiedadesFiltradas.map((p) => p.id_propiedad));
    return desgloses.filter((d) => ids.has(d.id_propiedad));
  }, [desgloses, propiedadesFiltradas, hayFiltro]);

  /*
   * Totales del subconjunto. Se recalculan aquí en vez de pedírselos al hook
   * porque el filtro es de esta pantalla: el resto del módulo sigue viendo el
   * proyecto completo, y mover ese cálculo al hook cambiaría lo que ven la
   * Tabla de Precios y la Calibración.
   */
  const totalesFiltrados = useMemo(() => {
    if (!hayFiltro) return totales;
    const totalCalculado = desglosesFiltrados.reduce((a, d) => a + d.precio_lista, 0);
    const totalActual = propiedadesFiltradas.reduce((a, p) => a + p.precio_lista_actual, 0);
    return {
      unidades: propiedadesFiltradas.length,
      totalCalculado,
      totalActual,
      delta: totalCalculado - totalActual,
      deltaPct: totalActual > 0 ? ((totalCalculado - totalActual) / totalActual) * 100 : 0,
      conAlertas: desglosesFiltrados.filter((d) =>
        (alertasPorUnidad[d.id_propiedad] ?? []).some((a) => a.severidad !== "informativa"),
      ).length,
      desviadas: desglosesFiltrados.filter((d) =>
        d.alertas.some((a) => a.codigo === "DELTA_ALTO"),
      ).length,
      bloqueadas: desglosesFiltrados.filter((d) => d.bloqueada_para_reprecio).length,
    };
  }, [hayFiltro, totales, desglosesFiltrados, propiedadesFiltradas, alertasPorUnidad]);

  const limpiarFiltros = () =>
    setFiltros({
      torre: SIN_FILTRO,
      modelo: SIN_FILTRO,
      vista: SIN_FILTRO,
      estatus: SIN_FILTRO,
    });

  /*
   * Promedios ponderados de lo que el motor calcula hoy.
   *
   * Al sembrar, el precio por m² base ES el promedio ponderado: la semilla lo
   * define como `Σ precio / Σ área` y reparte la diferencia de cada modelo en
   * su factor, cuyo promedio ponderado da exactamente 1. Pero el base es el
   * valor en el ancla, no el promedio: en cuanto se calibra —curvas, factores
   * de torre o vista— el promedio se separa del base por el efecto acumulado
   * de todos esos multiplicadores. Por eso se muestran los dos y su distancia,
   * en vez de dar por hecho que coinciden.
   *
   * Salen de los desgloses vigentes, así que cualquier variable que se toque
   * en esta pantalla los mueve.
   */
  const promediosProyecto = useMemo(() => {
    let precio = 0;
    let area = 0;
    let unidades = 0;
    for (const d of desglosesFiltrados) {
      if (d.area_ponderada <= 0) continue;
      precio += d.precio_calculado;
      area += d.area_ponderada;
      unidades++;
    }
    return {
      unidades,
      porM2: area > 0 ? precio / area : 0,
      porUnidad: unidades > 0 ? precio / unidades : 0,
    };
  }, [desglosesFiltrados]);

  const brechaBase =
    motor.precio_base_m2_proyecto > 0 && promediosProyecto.porM2 > 0
      ? ((promediosProyecto.porM2 - motor.precio_base_m2_proyecto) /
          motor.precio_base_m2_proyecto) *
        100
      : 0;

  /*
   * Qué valen HOY las categorías del ancla.
   *
   * El ancla se fija cuando se siembra o se reancla, y en ese momento sus
   * familias quedan normalizadas a 1.0000. Los factores son editables, así que
   * nada garantiza que sigan valiendo 1: hay que leerlos, no suponerlos.
   */
  const factoresDelAncla = useMemo(() => {
    const nombreTorre = indices?.torresPorId[motor.ancla.id_torre]?.nombre ?? "";
    return [
      { etiqueta: "Torre", clave: nombreTorre, valor: valorFactor(motor, "torre", nombreTorre) },
      {
        etiqueta: "Vista",
        clave: motor.ancla.clave_vista,
        valor: valorFactor(motor, "vista", motor.ancla.clave_vista),
      },
      {
        etiqueta: "Orientación",
        clave: motor.ancla.clave_orientacion,
        valor: valorFactor(motor, "orientacion", motor.ancla.clave_orientacion),
      },
    ];
  }, [motor, indices]);

  const anclaDesviada = factoresDelAncla.some((x) => Math.abs(x.valor - 1) > 1e-6);

  /*
   * Lo que el motor calcula hoy para las unidades que SÍ están en la
   * combinación ancla. Sirve para contrastar contra el precio base, que es lo
   * que esa combinación debería valer.
   *
   * No tiene por qué coincidir: cada unidad de ahí sigue aplicando el factor
   * de su modelo y el de tamaño. Sobre el inventario completo, no el
   * filtrado: el ancla es del proyecto.
   */
  const observadoEnAncla = useMemo(() => {
    const nombreTorre = indices?.torresPorId[motor.ancla.id_torre]?.nombre ?? "";
    const porId = new Map(desgloses.map((d) => [d.id_propiedad, d]));
    let precio = 0;
    let area = 0;
    let unidades = 0;
    for (const p of propiedades) {
      if (indices?.torresPorId[p.id_torre]?.nombre !== nombreTorre) continue;
      if (p.vista !== motor.ancla.clave_vista) continue;
      if (p.nivel !== motor.ancla.nivel) continue;
      const d = porId.get(p.id_propiedad);
      if (!d || d.area_ponderada <= 0) continue;
      precio += d.precio_calculado;
      area += d.area_ponderada;
      unidades++;
    }
    return { unidades, porM2: area > 0 ? precio / area : 0 };
  }, [propiedades, desgloses, motor.ancla, indices]);

  /** Reancla cambiando un solo eje y conservando los otros tres. */
  const cambiarAncla = (parcial: {
    id_torre?: string;
    nivel?: number;
    clave_vista?: string;
    clave_orientacion?: string;
  }) => {
    reanclar({
      id_torre: motor.ancla.id_torre,
      nivel: motor.ancla.nivel,
      clave_vista: motor.ancla.clave_vista,
      clave_orientacion: motor.ancla.clave_orientacion,
      ...parcial,
    });
    toast.success(
      "Ancla actualizada. Ningún precio cambió: el precio base pasa a expresarse en esa combinación.",
    );
  };

  const bases = motor.bases_modelo ?? [];
  const unidadesPorModelo = new Map<string, number>();
  for (const p of propiedadesFiltradas) {
    unidadesPorModelo.set(p.id_modelo, (unidadesPorModelo.get(p.id_modelo) ?? 0) + 1);
  }

  /*
   * Con un filtro puesto, los modelos que no aparecen en el subconjunto se
   * ocultan: dejarlos en 0 unidades haría creer que el filtro no funcionó.
   * Sin filtro se muestran todos, incluidos los que aún no tienen inventario.
   */
  const basesVisibles = hayFiltro
    ? bases.filter((b) => (unidadesPorModelo.get(b.id_modelo) ?? 0) > 0)
    : bases;

  /*
   * De mayor a menor inventario. Los modelos llegan en el orden del catálogo,
   * que no dice nada: el modelo con 145 unidades y el que tiene 2 pesan igual
   * en la lista y muy distinto en el desarrollo. Ordenar por unidades pone
   * arriba las decisiones que mueven más dinero. Empate: por nombre, para que
   * la tabla no baile entre renders.
   */
  const basesOrdenadas = [...basesVisibles].sort((a, b) => {
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
  const nivelesDelModelo = useMemo(() => {
    const desglosePorId = new Map(desglosesFiltrados.map((d) => [d.id_propiedad, d]));
    const acum = new Map<number, { unidades: number; area: number; precio: number }>();

    for (const p of propiedadesFiltradas) {
      const d = desglosePorId.get(p.id_propiedad);
      if (!d || d.area_ponderada <= 0) continue;
      const a = acum.get(p.nivel) ?? { unidades: 0, area: 0, precio: 0 };
      a.unidades += 1;
      a.area += d.area_ponderada;
      a.precio += d.precio_calculado;
      acum.set(p.nivel, a);
    }

    return [...acum.entries()]
      .map(([nivel, a]) => ({
        nivel,
        unidades: a.unidades,
        m2: a.area / a.unidades,
        precio_m2: a.precio / a.area,
        precio_depto: a.precio / a.unidades,
      }))
      .sort((a, b) => a.nivel - b.nivel);
  }, [propiedadesFiltradas, desglosesFiltrados]);

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
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <FiltroInventario
              etiqueta="Torre"
              etiquetaTodos="Todas las torres"
              valor={filtros.torre}
              onChange={(v) => setFiltros((x) => ({ ...x, torre: v }))}
              opciones={opcionesFiltro.torres}
              todos={SIN_FILTRO}
            />
            <FiltroInventario
              etiqueta="Modelo"
              etiquetaTodos="Todos los modelos"
              valor={filtros.modelo}
              onChange={(v) => setFiltros((x) => ({ ...x, modelo: v }))}
              opciones={opcionesFiltro.modelos}
              todos={SIN_FILTRO}
            />
            <FiltroInventario
              etiqueta="Vista"
              etiquetaTodos="Todas las vistas"
              valor={filtros.vista}
              onChange={(v) => setFiltros((x) => ({ ...x, vista: v }))}
              opciones={opcionesFiltro.vistas}
              todos={SIN_FILTRO}
            />
            <FiltroInventario
              etiqueta="Estatus"
              etiquetaTodos="Todos los estatus"
              valor={filtros.estatus}
              onChange={(v) => setFiltros((x) => ({ ...x, estatus: v }))}
              opciones={opcionesFiltro.estatus}
              todos={SIN_FILTRO}
            />
            {hayFiltro ? (
              <Button variant="ghost" onClick={limpiarFiltros} className="mb-0.5">
                <X className="size-4" />
                Limpiar filtros
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {hayFiltro
              ? `${totalesFiltrados.unidades} de ${totales.unidades} unidades.`
              : `${totales.unidades} unidades en el proyecto.`}{" "}
            Los filtros cambian lo que se ve —conteos, promedios por modelo, curvas y
            totales—, no lo que se guarda: cualquier valor que captures aquí sigue
            aplicando a todo el desarrollo.
          </p>
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
                {formatoMoneda(promediosProyecto.porM2)}
                <span className="text-xs font-normal text-muted-foreground"> /m²</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {Math.abs(brechaBase) < 0.005
                  ? "Coincide con el precio base."
                  : `${formatoPorcentaje(brechaBase, 2)} respecto al precio base.`}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Precio promedio ponderado {hayFiltro ? "del subconjunto" : "de todo el proyecto"}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {formatoMoneda(promediosProyecto.porUnidad)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Por unidad, sobre {promediosProyecto.unidades} unidades.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Las dos cifras salen del cálculo vigente del motor, así que cualquier variable
            que muevas en esta pantalla —factores, curvas, precio base o el factor de un
            modelo— las mueve. Al sembrar el motor, el precio por m² base y el promedio
            ponderado por m² son el mismo número; se separan conforme se calibra, porque el
            base es el valor en el ancla y el promedio ya trae encima el efecto de todos los
            multiplicadores.
          </p>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-foreground">Ancla del proyecto</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <CampoAncla
                etiqueta="Torre"
                valor={motor.ancla.id_torre}
                onChange={(v) => cambiarAncla({ id_torre: v })}
                opciones={opcionesFiltro.torres}
              />
              <CampoAncla
                etiqueta="Nivel"
                valor={String(motor.ancla.nivel)}
                onChange={(v) => cambiarAncla({ nivel: Number(v) })}
                opciones={opcionesFiltro.niveles}
              />
              <CampoAncla
                etiqueta="Vista"
                valor={motor.ancla.clave_vista}
                onChange={(v) => cambiarAncla({ clave_vista: v })}
                opciones={opcionesFiltro.vistas}
              />
              <CampoAncla
                etiqueta="Orientación"
                valor={motor.ancla.clave_orientacion}
                onChange={(v) => cambiarAncla({ clave_orientacion: v })}
                opciones={opcionesFiltro.orientaciones}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Cambiar el ancla no mueve ningún precio: las familias se renormalizan y los
              precios base se compensan. Lo que cambia es qué significa el precio base, que
              pasa a ser el precio por m² en la combinación elegida.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              El nivel del ancla es lo único que el cálculo usa como referencia: ahí la curva
              de nivel vale exactamente 1.0000 y desde ahí sube o baja. Torre, vista y
              orientación del ancla no entran en el cálculo de ninguna unidad; son las
              categorías contra las que se normalizaron sus familias la última vez que se
              ancló, y hoy valen:
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {factoresDelAncla.map((x) => (
                <li key={x.etiqueta} className="text-xs tabular-nums text-muted-foreground">
                  {x.etiqueta} {x.clave || "—"}:{" "}
                  <span
                    className={cn(
                      "font-medium",
                      Math.abs(x.valor - 1) > 1e-6 ? "text-amber-700 dark:text-amber-400" : "text-foreground",
                    )}
                  >
                    {formatoMultiplicador(x.valor)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {anclaDesviada
                ? "Alguna de esas categorías ya no vale 1.0000, así que el precio base dejó de ser el precio de esa combinación. No es un error —los factores son editables—, pero el base ya no se lee como \"lo que cuesta la unidad más barata\"."
                : "Mientras valgan 1.0000, el precio base es el precio por m² de una unidad en esa combinación, antes de aplicar el factor de su modelo."}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {observadoEnAncla.unidades === 0
                ? "El inventario no tiene ninguna unidad en esa combinación exacta. El ancla sigue siendo válida como referencia de escala, pero no hay contra qué contrastarla."
                : `El motor calcula ${formatoMoneda(observadoEnAncla.porM2)} /m² para las ${observadoEnAncla.unidades} unidades que sí están en esa combinación. No tiene por qué coincidir con el base: cada una aplica además el factor de su modelo y el de tamaño.`}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              El precio por m² de una unidad nunca es este base a secas: es base × factor de
              su modelo × nivel × torre × vista × orientación × extras × tamaño. Incluso en
              la combinación ancla, el modelo aplica su propio factor.
            </p>
          </div>
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
                  propiedades={propiedadesFiltradas}
                />
              </TabsContent>
            ))}
          </Tabs>
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
                    Precio promedio ponderado
                  </th>
                </tr>
              </thead>
              <tbody>
                {basesOrdenadas.map((b) => (
                  <tr key={b.id_modelo} className="border-t border-border">
                    <td className="px-3 py-1.5 font-medium text-foreground">
                      {b.nombre_modelo}
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
                    {/* Precio de una unidad de referencia del modelo. Es
                        derivado —precio por m² x m² de referencia— y se mueve
                        al capturar cualquiera de los dos. */}
                    <td className="px-3 py-1.5 tabular-nums font-medium text-foreground">
                      {formatoMoneda(b.precio_base_m2 * b.m2_referencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            El modelo es una variable más sobre el precio base del proyecto: su factor dice
            cuánto se separa de él. Puedes capturar el factor o el precio por m² resultante —
            son la misma cifra vista de dos formas y el otro se recalcula solo.
          </p>
          <p className="text-xs text-muted-foreground">
            Los modelos van de mayor a menor número de unidades. El <strong>m² de
            referencia</strong> es el promedio de las unidades del modelo, no el metraje de
            una sola: dentro de un mismo modelo el área varía. El <strong>precio promedio
            ponderado</strong> es lo que cuesta esa unidad de referencia —precio por m² × m²
            de referencia— y al sembrar reproduce el precio promedio real del modelo.
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
                  Precios reales por nivel de lo que esté filtrado arriba. Mueve la
                  pendiente o el amortiguamiento y las cuatro columnas se recalculan.
                </p>
              </div>
            </div>

            {nivelesDelModelo.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este modelo todavía no tiene unidades con precio calculado.
              </p>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Precio promedio ponderado por m²
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
                      Precio promedio ponderado del departamento
                    </p>
                    <GraficoCurva
                      puntos={nivelesDelModelo.map((n) => ({ x: n.nivel, y: n.precio_depto }))}
                      etiquetaX="Nivel"
                      etiquetaY="Precio del departamento"
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
                          Precio promedio por m²
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Precio promedio del departamento
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-muted-foreground">
                  Cada renglón promedia las unidades de ese nivel: el precio por m² es la suma
                  de precios entre la suma de m², y el del departamento es ese precio por el m²
                  promedio del nivel. Dos niveles pueden diferir aunque la curva sea plana,
                  porque el metraje no es idéntico piso por piso. Se grafica el precio que
                  calcula el motor, no el de lista: un precio forzado a mano no responde a la
                  curva y taparía justo lo que se quiere ver.
                  {filtros.modelo === SIN_FILTRO ? (
                    <>
                      {" "}
                      Con todos los modelos juntos, un brinco entre niveles puede venir de que
                      arriba haya modelos distintos y no de los coeficientes: filtra por Modelo
                      para aislar uno.
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <span className="tabular-nums">
            <span className="text-muted-foreground">Unidades: </span>
            {hayFiltro ? `${totalesFiltrados.unidades} de ${totales.unidades}` : totales.unidades}
          </span>
          <span className="tabular-nums">
            <span className="text-muted-foreground">Valor total calculado: </span>
            {formatoMoneda(totalesFiltrados.totalCalculado)}{" "}
            <span className="text-xs text-muted-foreground">Libro: Comercial</span>
          </span>
          <span className="tabular-nums">
            <span className="text-muted-foreground">Valor total actual: </span>
            {formatoMoneda(totalesFiltrados.totalActual)}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs tabular-nums",
              totalesFiltrados.delta >= 0
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {formatoPorcentaje(totalesFiltrados.deltaPct)} · {formatoMoneda(totalesFiltrados.delta)}
          </span>
          <span className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
            <TriangleAlert className="size-4" />
            Alertas: {totalesFiltrados.conAlertas}
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
