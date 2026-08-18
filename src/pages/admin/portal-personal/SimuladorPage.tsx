import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Clock, EyeOff, Info, Loader2, Save, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { usePortal } from "@/lib/portal-personal/portal-store";
import {
  fechaDePago,
  hitosDePago,
  lineaDeCobro,
  mxn,
} from "@/lib/portal-personal/selectores";
import { REGLAS } from "@/lib/portal-personal/mock";
import {
  useDepartamentosDisponibles,
  useProyectosComercializados,
} from "@/hooks/usePortalPersonalCatalogo";
import {
  montoComision,
  pctComision,
  useComisionesDelPersonal,
  type CanalComisionPersonal,
  type EstadoValidacionCanalPersonal,
} from "@/hooks/usePortalPersonalComisiones";
import { LineaCobro } from "@/components/admin/portal-personal/comunes/LineaCobro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CLAVE_COMPARATIVO = "sozu-comparativo-personal";

/**
 * Simulador de ganancia del Portal del Personal.
 *
 * Todo lo que decide el monto es REAL:
 *   - Proyecto y Departamento → proyectos comercializados por SOZU y su
 *     inventario disponible a la venta (`usePortalPersonalCatalogo`).
 *   - Canales y porcentajes → la matriz de comisiones del Motor, filtrada al
 *     renglón de ESTA persona, con el estado de validación de Alta Dirección
 *     (`usePortalPersonalComisiones`).
 *   - Precio promedio ponderado → el mismo número que muestra Alta Dirección.
 *
 * Sigue siendo ilustrativo lo que no depende del dato: los hitos de pago y los
 * escenarios guardados (marcados con `SWAP POINT`).
 */
export default function SimuladorPage() {
  const [searchParams] = useSearchParams();
  const proyectoParam = searchParams.get("proyecto") ?? "";
  const departamentoParam = searchParams.get("departamento") ?? "";
  const modo = usePortal((s) => s.modo_presentacion);
  const escenarios = usePortal((s) => s.escenarios);
  const guardarEscenario = usePortal((s) => s.guardarEscenario);
  const deprecarEscenario = usePortal((s) => s.deprecarEscenario);

  const { proyectos, isLoading: cargandoProyectos } = useProyectosComercializados();

  const [modoSim, setModoSim] = useState<"departamento" | "general">("departamento");
  const [proyectoId, setProyectoId] = useState(proyectoParam);
  const [departamentoId, setDepartamentoId] = useState(departamentoParam);
  const [canalSel, setCanalSel] = useState("");
  const [cantidad, setCantidad] = useState(3);
  const [comparativo, setComparativo] = useState("");

  // Mientras el catálogo carga no hay proyecto; en cuanto llega manda el primero
  // hasta que el usuario elija otro.
  const proyecto = useMemo(
    () => proyectos.find((p) => p.id === proyectoId) ?? proyectos[0],
    [proyectos, proyectoId],
  );

  const { departamentos, isLoading: cargandoDepartamentos } = useDepartamentosDisponibles(
    proyecto?.idNumerico,
  );

  const departamento = useMemo(
    () => departamentos.find((d) => d.id === departamentoId) ?? departamentos[0],
    [departamentos, departamentoId],
  );

  const {
    personal,
    canales,
    validados,
    porValidar,
    sinVinculo,
    isLoading: cargandoComisiones,
  } = useComisionesDelPersonal(proyecto?.idNumerico);

  const canalActivo = useMemo(
    () => canales.find((c) => c.idCanal === canalSel) ?? canales[0] ?? null,
    [canales, canalSel],
  );

  useEffect(() => {
    // Comparativo personal: SOLO localStorage. Nunca se envía a Supabase.
    const guardado = window.localStorage.getItem(CLAVE_COMPARATIVO);
    if (guardado) setComparativo(guardado);
  }, []);

  if (modo) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card-sozu flex flex-col items-center gap-3 p-10 text-center">
          <EyeOff className="size-6 text-gris" />
          <p className="text-lg font-bold text-negro">El simulador está oculto</p>
          <p className="text-sm text-gris">
            El Modo Presentación oculta montos y porcentajes de ganancia personal.
          </p>
        </div>
      </div>
    );
  }

  const promedioPonderado = proyecto?.precioPromedioPonderado ?? 0;
  const precioBase =
    modoSim === "departamento" && departamento ? departamento.precioTotal : promedioPonderado;
  const baseTexto =
    modoSim === "departamento" && departamento
      ? `Depto. ${departamento.numero} · ${mxn(departamento.precioTotal)}`
      : `Precio promedio ponderado de ${proyecto?.nombre ?? ""} · ${mxn(promedioPonderado)}`;
  const unidadesSim = modoSim === "departamento" ? 1 : cantidad;
  const pct = canalActivo?.miPorcentaje ?? 0;

  const detalle =
    modoSim === "departamento" && departamento
      ? [
          {
            etiqueta: `Depto. ${departamento.numero} · ${proyecto?.nombre ?? ""}`,
            monto: montoComision(precioBase, pct),
          },
        ]
      : Array.from({ length: cantidad }).map((_, i) => ({
          etiqueta: `Departamento tipo ${i + 1} · ${proyecto?.nombre ?? ""}`,
          monto: montoComision(promedioPonderado, pct),
        }));

  const total = detalle.reduce((a, d) => a + d.monto, 0);
  // INVARIANTE — UNA SOLA FECHA: encabezado y último nodo leen el mismo selector.
  // La fecha de entrega viene del proyecto real (`proyectos.fecha_entrega`).
  const entrega = { entrega_estimada: proyecto?.entregaEstimada ?? "Por definir" };
  const fechaPago = fechaDePago(entrega);
  const hitos = hitosDePago(entrega);

  const guardar = () => {
    if (!proyecto) return;
    guardarEscenario({
      id: `esc-${Date.now()}`,
      nombre:
        modoSim === "departamento" && departamento
          ? `Depto. ${departamento.numero} · ${proyecto.nombre}`
          : `${cantidad} departamentos · ${proyecto.nombre}`,
      desarrollo_id: proyecto.id,
      unidades: unidadesSim,
      monto_total: total,
      cobro_estimado: fechaPago,
      creado_en: new Date().toLocaleDateString("es-MX"),
      auditoria: {
        creado_en: new Date().toISOString(),
        creado_por: "usuario",
        actualizado_en: new Date().toISOString(),
        actualizado_por: "usuario",
        deprecado_en: null,
        deprecado_por: null,
        motivo: null,
      },
    });
    toast.success("Escenario guardado");
  };

  const visibles = escenarios.filter((e) => !e.auditoria.deprecado_en);
  const sinDepartamentos = !cargandoDepartamentos && departamentos.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Banner permanente de honestidad */}
      <div className="flex gap-3 rounded-xl border border-ambar-borde bg-ambar-claro p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-ambar" />
        <p className="text-sm text-negro">
          Estimación ilustrativa para tu planeación. No constituye una promesa de pago ni una
          prestación garantizada. Sujeta a las Reglas del Programa vigentes (v{REGLAS.version}) y
          a la escrituración con pago confirmado del cliente.{" "}
          <Link to="/admin/portal-personal/reglas" className="font-semibold text-verde-oscuro underline">
            Ver reglas
          </Link>
        </p>
      </div>

      {/* Paso 1 */}
      <section className="card-sozu p-5">
        <p className="eyebrow text-gris">Paso 1</p>
        <h3 className="mt-1 text-lg font-bold text-negro">¿Qué quieres vender?</h3>

        <div className="mt-4 inline-flex rounded-lg bg-secondary p-1">
          {(
            [
              ["departamento", "Un departamento específico"],
              ["general", "Un escenario general"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setModoSim(v)}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors",
                modoSim === v ? "bg-verde text-white" : "text-gris",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {cargandoProyectos ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-gris">
            <Loader2 className="size-4 animate-spin" />
            Cargando proyectos...
          </div>
        ) : !proyecto ? (
          <div className="mt-5 rounded-xl border border-border bg-secondary p-5 text-sm text-gris">
            No hay proyectos comercializados por SOZU disponibles para tu usuario.
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="font-bold">Proyecto</Label>
                <Select
                  value={proyecto.id}
                  onValueChange={(v) => {
                    setProyectoId(v);
                    // Departamento y canal pertenecen al proyecto: al cambiarlo
                    // se vuelven a elegir los del proyecto nuevo.
                    setDepartamentoId("");
                    setCanalSel("");
                  }}
                >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue placeholder="Selecciona un proyecto">{proyecto.nombre}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {proyectos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {modoSim === "departamento" && (
                <div>
                  <Label className="font-bold">Departamento</Label>
                  <Select
                    value={departamento?.id ?? ""}
                    onValueChange={setDepartamentoId}
                    disabled={cargandoDepartamentos || departamentos.length === 0}
                  >
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue
                        placeholder={
                          cargandoDepartamentos ? "Cargando..." : "Sin departamentos disponibles"
                        }
                      >
                        {departamento ? `Depto. ${departamento.numero} · ${departamento.modelo}` : ""}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {departamentos.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          Depto. {d.numero} · {d.modelo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {sinDepartamentos && (
                    <p className="mt-2 text-xs text-gris">
                      {proyecto.nombre} no tiene departamentos disponibles a la venta.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Referencia del proyecto — mismo número que Alta Dirección */}
            <div className="mt-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
              <Dato
                etiqueta="Precio promedio ponderado"
                valor={promedioPonderado > 0 ? mxn(promedioPonderado) : "—"}
                nota="Inventario disponible a venta"
              />
              <Dato
                etiqueta="Unidades disponibles"
                valor={String(proyecto.unidadesDisponibles)}
                nota="Con estatus Disponible"
              />
              <Dato
                etiqueta="Avance de obra"
                valor={`${proyecto.avanceObra}%`}
                nota={`Entrega ${proyecto.entregaEstimada}`}
              />
            </div>

            {modoSim === "departamento" && departamento && (
              <div className="mt-5 flex items-center gap-4 rounded-xl border border-border p-4">
                {departamento.imagen ? (
                  <img
                    src={departamento.imagen}
                    alt={`Departamento ${departamento.numero}`}
                    loading="lazy"
                    width={1024}
                    height={640}
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Building2 className="size-6 text-gris" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold uppercase text-negro">{departamento.modelo}</p>
                  <p className="text-sm text-gris">
                    {proyecto.nombre}
                    {departamento.nivel ? ` · Nivel ${departamento.nivel}` : ""}
                    {departamento.m2 > 0 ? ` · ${departamento.m2} m²` : ""}
                  </p>
                  <p className="num text-sm font-bold text-verde">
                    {mxn(departamento.precioTotal)}
                  </p>
                </div>
              </div>
            )}

            {modoSim === "general" && (
              <div className="mt-5">
                <Label className="font-bold">
                  ¿Cuántos departamentos crees que puedes referir en 12 meses?
                </Label>
                <Slider
                  className="mt-4"
                  min={1}
                  max={12}
                  step={1}
                  value={[cantidad]}
                  onValueChange={(v) => setCantidad(v[0] ?? 1)}
                />
                <p className="num mt-2 text-sm text-gris">{cantidad} departamentos</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Paso 2 — canales de venta reales de la persona */}
      <section className="card-sozu p-5">
        <p className="eyebrow text-gris">Paso 2</p>
        <h3 className="mt-1 text-lg font-bold text-negro">¿Por qué canal entra la venta?</h3>
        <p className="mt-1 text-sm text-gris">
          {personal
            ? `Canales de venta de ${proyecto?.nombre ?? "este proyecto"} en los que ${personal.nombre}` +
              `${personal.rolBase ? ` (${personal.rolBase})` : ""} tiene comisión asignada.`
            : "Canales de venta en los que tienes comisión asignada."}
        </p>
        {canales.length > 0 && (
          <p className="num mt-2 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-gris">
            Base de cálculo: {baseTexto}
          </p>
        )}

        {cargandoComisiones ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-gris">
            <Loader2 className="size-4 animate-spin" />
            Cargando tus canales...
          </div>
        ) : sinVinculo ? (
          <div className="mt-6 rounded-xl border border-border bg-secondary p-5 text-sm text-gris">
            Tu cuenta todavía no está ligada al Directorio de Personal, así que no podemos resolver
            tus canales. Pide que te den de alta en{" "}
            <b className="text-negro">Estructura de comisiones → Roles y sueldos</b> con este correo.
          </div>
        ) : canales.length === 0 ? (
          <div className="mt-6 rounded-xl border border-border bg-secondary p-5 text-sm text-gris">
            No tienes comisión asignada en ningún canal de {proyecto?.nombre ?? "este proyecto"}.
            Prueba con otro proyecto: la matriz de comisiones se captura por desarrollo.
          </div>
        ) : (
          <>
            {validados.length > 0 && (
              <div className="mt-6">
                <p className="eyebrow text-verde">Canales validados</p>
                <p className="mt-1 text-sm text-gris">
                  Estructura de comisión aprobada por Alta Dirección.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {validados.map((c) => (
                    <TarjetaCanal
                      key={c.idCanal}
                      canal={c}
                      monto={montoComision(precioBase, c.miPorcentaje) * unidadesSim}
                      activa={canalActivo?.idCanal === c.idCanal}
                      onClick={() => setCanalSel(c.idCanal)}
                    />
                  ))}
                </div>
              </div>
            )}

            {porValidar.length > 0 && (
              <div className={cn(validados.length > 0 && "mt-7 border-t border-border pt-6", validados.length === 0 && "mt-6")}>
                <p className="eyebrow text-gris">Pendientes de validación</p>
                <p className="mt-1 text-sm text-gris">
                  Ya están capturados en el Motor de Comisiones, pero Alta Dirección aún no los
                  valida: el monto es informativo y puede cambiar.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {porValidar.map((c) => (
                    <TarjetaCanal
                      key={c.idCanal}
                      canal={c}
                      monto={montoComision(precioBase, c.miPorcentaje) * unidadesSim}
                      activa={canalActivo?.idCanal === c.idCanal}
                      onClick={() => setCanalSel(c.idCanal)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Paso 3 — resultado */}
      <section className="rounded-xl border border-verde/30 bg-verde-claro p-6">
        <p className="eyebrow text-gris">Ganancia estimada total</p>
        <p className="num mt-1 text-4xl font-bold text-verde lg:text-5xl">{mxn(total)}</p>
        <p className="num mt-1 text-sm text-gris">
          {canalActivo
            ? `Por ${canalActivo.canal} · ${pctComision(canalActivo.miPorcentaje)} sobre el precio de venta · cobrable a partir de ${fechaPago}`
            : `Cobrable a partir de ${fechaPago}`}
        </p>

        <div className="mt-5 space-y-2 rounded-xl bg-background p-4">
          {detalle.map((d, i) => (
            <div
              key={`${d.etiqueta}-${i}`}
              className="num flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="text-negro">{d.etiqueta}</span>
              <span className="text-gris">
                <b className="text-verde">{mxn(d.monto)}</b> — cobrable ~{fechaPago}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl bg-background p-5">
          <LineaCobro
            nodos={lineaDeCobro(entrega, 1, hitos)}
            nota={
              proyecto
                ? `Estimado con base en el avance de obra de ${proyecto.nombre} (${proyecto.avanceObra}%). Las fechas se ajustan conforme avanza el proyecto.`
                : "Las fechas se ajustan conforme avanza el proyecto."
            }
          />
        </div>
      </section>

      {/* Comparativo personal, solo localStorage */}
      <section className="card-sozu p-5">
        <Label className="font-bold">¿Con qué quieres compararlo?</Label>
        <Input
          className="mt-2"
          inputMode="numeric"
          placeholder="Ej. 120000"
          value={comparativo}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, "");
            setComparativo(v);
            // INVARIANTE: este dato jamás sale del dispositivo.
            window.localStorage.setItem(CLAVE_COMPARATIVO, v);
          }}
        />
        <p className="mt-2 text-xs text-gris">
          Este dato se guarda solo en tu dispositivo. No se envía ni se almacena en el sistema.
        </p>

        {comparativo && Number(comparativo) > 0 && (
          <div className="mt-4 space-y-2">
            <Barra
              etiqueta="Tu referencia"
              valor={Number(comparativo)}
              max={Math.max(total, Number(comparativo))}
              tono="gris"
            />
            <Barra
              etiqueta="Ganancia estimada"
              valor={total}
              max={Math.max(total, Number(comparativo))}
              tono="verde"
            />
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {/* SWAP POINT: supabase.escenarios_guardados */}
        <Button variant="outline" onClick={guardar} disabled={!proyecto}>
          <Save className="size-4" />
          Guardar escenario
        </Button>
        <Button
          variant="ghost"
          className="text-gris"
          onClick={() => {
            setModoSim("departamento");
            setCantidad(3);
            setDepartamentoId("");
            setCanalSel("");
          }}
        >
          Nuevo escenario
        </Button>
        {proyecto && (
          <Link
            to={`/admin/portal-personal/inventario/unidades?proyecto=${proyecto.idNumerico}`}
            className="text-sm font-semibold text-verde"
          >
            Ver departamentos de este proyecto
          </Link>
        )}
      </div>

      {visibles.length > 0 && (
        <section>
          <p className="eyebrow text-gris">Escenarios guardados</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {visibles.map((e) => (
              <div key={e.id} className="card-sozu flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-bold text-negro">{e.nombre}</p>
                  <p className="num text-sm text-verde">{mxn(e.monto_total)}</p>
                  <p className="num text-xs text-gris">
                    Cobrable ~{e.cobro_estimado} · Creado {e.creado_en}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Un escenario viejo puede apuntar a un proyecto que ya no
                      // está en el catálogo: se carga lo demás y se avisa.
                      const sigueEnCatalogo = proyectos.some((p) => p.id === e.desarrollo_id);
                      if (sigueEnCatalogo) {
                        setProyectoId(e.desarrollo_id);
                        setDepartamentoId("");
                        setCanalSel("");
                      }
                      setModoSim(e.unidades > 1 ? "general" : "departamento");
                      setCantidad(Math.max(e.unidades, 1));
                      toast.success(
                        sigueEnCatalogo
                          ? "Escenario cargado"
                          : "Escenario cargado — su proyecto ya no está en el catálogo",
                      );
                    }}
                  >
                    Ver
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar escenario"
                    onClick={() => deprecarEscenario(e.id, "eliminado_por_el_colaborador")}
                  >
                    <Trash2 className="size-4 text-gris" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota: string }) {
  return (
    <div>
      <p className="eyebrow text-gris">{etiqueta}</p>
      <p className="num mt-0.5 text-base font-bold text-negro">{valor}</p>
      <p className="mt-0.5 text-xs text-gris">{nota}</p>
    </div>
  );
}

const SELLO: Record<
  EstadoValidacionCanalPersonal,
  { texto: string; icono: typeof CheckCircle2; cls: string }
> = {
  validada: { texto: "Validado", icono: CheckCircle2, cls: "text-verde" },
  pendiente: { texto: "Por validar", icono: Clock, cls: "text-ambar" },
  rechazada: { texto: "Rechazado", icono: XCircle, cls: "text-destructive" },
};

/**
 * INVARIANTE — JERARQUÍA: el monto en pesos domina; el porcentaje es secundario.
 * Nunca se muestra la comisión total del canal dispersada al equipo, la externa,
 * el remanente de SOZU ni el renglón de otro colaborador.
 */
function TarjetaCanal({
  canal,
  monto,
  activa,
  onClick,
}: {
  canal: CanalComisionPersonal;
  monto: number;
  activa: boolean;
  onClick: () => void;
}) {
  const sello = SELLO[canal.estadoValidacion];
  const Icono = sello.icono;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block w-full rounded-xl border p-4 text-left transition-colors",
        activa ? "border-verde bg-verde-claro" : "border-border hover:border-verde/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-negro">{canal.canal}</p>
        <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-semibold", sello.cls)}>
          <Icono className="size-3.5" />
          {sello.texto}
        </span>
      </div>
      <p className="num mt-1 text-2xl font-bold text-verde">{mxn(monto)}</p>
      <p className="num mt-0.5 text-xs text-gris">
        equivale a {pctComision(canal.miPorcentaje)} sobre el precio de venta
      </p>
      {canal.rolNombre && (
        <p className="mt-1 truncate text-xs text-gris">Como {canal.rolNombre}</p>
      )}
    </button>
  );
}

function Barra({
  etiqueta,
  valor,
  max,
  tono,
}: {
  etiqueta: string;
  valor: number;
  max: number;
  tono: "gris" | "verde";
}) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div>
      <div className="num flex items-center justify-between text-xs">
        <span className="text-gris">{etiqueta}</span>
        <span className={tono === "verde" ? "font-bold text-verde" : "text-negro"}>
          {mxn(valor)}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", tono === "verde" ? "bg-verde" : "bg-gris")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
