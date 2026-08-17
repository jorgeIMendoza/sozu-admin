import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { EyeOff, Info, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePortal } from "@/lib/portal-personal/portal-store";
import {
  canalReferidoDirecto,
  canalesDeParticipacion,
  fechaDePago,
  hitosDePago,
  lineaDeCobro,
  montoPorCanal,
  mxn,
  pctTexto,
  precioTotalUnidad,
  selectores,
} from "@/lib/portal-personal/selectores";
import { REGLAS } from "@/lib/portal-personal/mock";
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

type Busqueda = { unidad?: string; desarrollo?: string };


const CLAVE_COMPARATIVO = "sozu-comparativo-personal";

export default function SimuladorPage() {
  const [searchParams] = useSearchParams();
  const unidadParam = searchParams.get("unidad") ?? undefined;
  const devParam = searchParams.get("desarrollo") ?? undefined;
  const modo = usePortal((s) => s.modo_presentacion);
  const escenarios = usePortal((s) => s.escenarios);
  const guardarEscenario = usePortal((s) => s.guardarEscenario);
  const deprecarEscenario = usePortal((s) => s.deprecarEscenario);

  const desarrollos = selectores.desarrollos();
  const inicial =
    (devParam ? desarrollos.find((d) => d.slug === devParam) : undefined) ?? desarrollos[0]!;

  const [modoSim, setModoSim] = useState<"unidad" | "general">("unidad");
  const [devId, setDevId] = useState(inicial.id);
  const [unidadId, setUnidadId] = useState(
    unidadParam ?? selectores.unidadesDe(inicial.id)[0]?.id ?? "",
  );
  const [cantidad, setCantidad] = useState(3);
  const [comparativo, setComparativo] = useState("");

  // SWAP POINT: supabase.vw_mi_comision_por_canal (vista derivada, filtrada por auth.uid())
  const directo = canalReferidoDirecto();
  const canales = canalesDeParticipacion();
  const [canalSel, setCanalSel] = useState(directo?.canal_id ?? canales[0]?.canal_id ?? "");

  useEffect(() => {
    // Comparativo personal: SOLO localStorage. Nunca se envía a Supabase.
    const guardado = window.localStorage.getItem(CLAVE_COMPARATIVO);
    if (guardado) setComparativo(guardado);
  }, []);

  const desarrollo = selectores.desarrolloPorId(devId) ?? inicial;
  const unidades = selectores.unidadesDe(devId);
  const unidad = selectores.unidadPorId(unidadId) ?? unidades[0];
  const promedio = selectores.precioPromedio(devId);

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

  const precioBase =
    modoSim === "unidad" && unidad ? precioTotalUnidad(unidad) : promedio;
  const unidadesSim = modoSim === "unidad" ? 1 : cantidad;

  const canalActivo =
    [...(directo ? [directo] : []), ...canales].find((c) => c.canal_id === canalSel) ?? directo;
  const pct = canalActivo?.mi_porcentaje ?? 0;

  const detalle =
    modoSim === "unidad" && unidad
      ? [
          {
            etiqueta: `Depto. ${unidad.numero} · ${desarrollo.nombre}`,
            monto: montoPorCanal(precioBase, pct),
          },
        ]
      : Array.from({ length: cantidad }).map((_, i) => ({
          etiqueta: `Unidad tipo ${i + 1} · ${desarrollo.nombre}`,
          monto: montoPorCanal(promedio, pct),
        }));

  const total = detalle.reduce((a, d) => a + d.monto, 0);
  // INVARIANTE — UNA SOLA FECHA: encabezado y último nodo leen el mismo selector.
  const fechaPago = fechaDePago(desarrollo);
  const hitos = hitosDePago(desarrollo);

  const guardar = () => {
    guardarEscenario({
      id: `esc-${Date.now()}`,
      nombre:
        modoSim === "unidad" && unidad
          ? `Depto. ${unidad.numero} · ${desarrollo.nombre}`
          : `${cantidad} unidades · ${desarrollo.nombre}`,
      desarrollo_id: devId,
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {import.meta.env.DEV && (
        <p className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-gris">
          Datos simulados
        </p>
      )}

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
              ["unidad", "Una unidad específica"],
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

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="font-bold">Desarrollo</Label>
            <Select
              value={devId}
              onValueChange={(v) => {
                setDevId(v);
                setUnidadId(selectores.unidadesDe(v)[0]?.id ?? "");
              }}
            >
              <SelectTrigger className="mt-2 w-full">
                <SelectValue placeholder="Selecciona un desarrollo">
                  {desarrollo.nombre}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {desarrollos.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {modoSim === "unidad" && (
            <div>
              <Label className="font-bold">Unidad</Label>
              <Select value={unidad?.id ?? ""} onValueChange={setUnidadId}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue placeholder="Selecciona una unidad">
                    {unidad ? `Depto. ${unidad.numero} · ${unidad.modelo}` : ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      Depto. {u.numero} · {u.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {modoSim === "unidad" && unidad && (
          <div className="mt-5 flex items-center gap-4 rounded-xl border border-border p-4">
            <img
              src={unidad.imagenes[0]}
              alt={`Unidad ${unidad.numero}`}
              loading="lazy"
              width={1024}
              height={640}
              className="size-16 rounded-lg object-cover"
            />
            <div>
              <p className="text-sm font-bold uppercase text-negro">{unidad.modelo}</p>
              <p className="text-sm text-gris">
                {desarrollo.nombre} · Nivel {unidad.nivel}
              </p>
              <p className="num text-sm font-bold text-verde">
                {mxn(precioTotalUnidad(unidad))}
              </p>
            </div>
          </div>
        )}

        {modoSim === "general" && (
          <div className="mt-5">
            <Label className="font-bold">
              ¿Cuántas unidades crees que puedes referir en 12 meses?
            </Label>
            <Slider
              className="mt-4"
              min={1}
              max={12}
              step={1}
              value={[cantidad]}
              onValueChange={(v) => setCantidad(v[0] ?? 1)}
            />
            <p className="num mt-2 text-sm text-gris">{cantidad} unidades</p>
            <div className="mt-4 rounded-xl border border-border p-4">
              <p className="text-sm font-bold text-negro">Unidad tipo</p>
              <p className="num text-sm text-gris">
                Precio promedio de {desarrollo.nombre}:{" "}
                <b className="text-verde">{mxn(promedio)}</b>
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Paso 2 — canal de venta */}
      <section className="card-sozu p-5">
        <p className="eyebrow text-gris">Paso 2</p>
        <h3 className="mt-1 text-lg font-bold text-negro">¿Por qué canal entra la venta?</h3>
        <p className="mt-1 text-sm text-gris">
          Tu porcentaje cambia según el canal por el que llega el comprador. Aquí ves lo que te
          corresponde en cada uno.
        </p>

        {/* Bloque A */}
        <div className="mt-6">
          <p className="eyebrow text-verde">Por referir directamente</p>
          <p className="mt-1 text-sm text-gris">
            Cuando tú traes al comprador con tu link o lo registras a tu nombre.
          </p>
          {directo && (
            <TarjetaCanal
              nombre={directo.canal_nombre}
              monto={montoPorCanal(precioBase, directo.mi_porcentaje) * unidadesSim}
              pct={directo.mi_porcentaje}
              activa={canalSel === directo.canal_id}
              onClick={() => setCanalSel(directo.canal_id)}
            />
          )}
        </div>

        {/* Bloque B */}
        <div className="mt-7 border-t border-border pt-6">
          <p className="eyebrow text-gris">Participación por canal</p>
          <p className="mt-1 text-sm text-gris">
            Cuando la venta entra por un canal en el que tu puesto participa, aunque el comprador
            no sea tu referido.
          </p>
          {canales.length === 0 ? (
            <div className="mt-4 rounded-xl border border-border bg-secondary p-5">
              <p className="text-sm text-gris">
                Tu puesto no participa en la dispersión por canal. Ganas únicamente por los
                referidos que traes directamente.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {canales.map((c) => (
                <TarjetaCanal
                  key={c.canal_id}
                  nombre={c.canal_nombre}
                  monto={montoPorCanal(precioBase, c.mi_porcentaje) * unidadesSim}
                  pct={c.mi_porcentaje}
                  activa={canalSel === c.canal_id}
                  onClick={() => setCanalSel(c.canal_id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Paso 3 — resultado */}
      <section className="rounded-xl border border-verde/30 bg-verde-claro p-6">
        <p className="eyebrow text-gris">Ganancia estimada total</p>
        <p className="num mt-1 text-4xl font-bold text-verde lg:text-5xl">{mxn(total)}</p>
        <p className="num mt-1 text-sm text-gris">Cobrable a partir de {fechaPago}</p>

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
            nodos={lineaDeCobro(desarrollo, 1, hitos)}
            nota={`Estimado con base en el avance de obra de ${desarrollo.nombre} (${desarrollo.avance_obra}%). Las fechas se ajustan conforme avanza el proyecto.`}
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
        <Button variant="outline" onClick={guardar}>
          <Save className="size-4" />
          Guardar escenario
        </Button>
        <Button
          variant="ghost"
          className="text-gris"
          onClick={() => {
            setModoSim("unidad");
            setCantidad(3);
            setUnidadId(unidades[0]?.id ?? "");
            setCanalSel(directo?.canal_id ?? "");
          }}
        >
          Nuevo escenario
        </Button>
        <Link to={`/admin/portal-personal/inventario/${desarrollo.slug}`}
          className="text-sm font-semibold text-verde"
        >
          Ver unidades de este desarrollo
        </Link>
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
                      setDevId(e.desarrollo_id);
                      setModoSim(e.unidades > 1 ? "general" : "unidad");
                      setCantidad(Math.max(e.unidades, 1));
                      toast.success("Escenario cargado");
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

/**
 * INVARIANTE — JERARQUÍA: el monto en pesos domina; el porcentaje es secundario.
 * Nunca se muestra la comisión total del canal, la externa, la dispersada
 * agregada, el remanente de SOZU ni el renglón de otro colaborador.
 */
function TarjetaCanal({
  nombre,
  monto,
  pct,
  activa,
  onClick,
}: {
  nombre: string;
  monto: number;
  pct: number;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mt-4 block w-full rounded-xl border p-4 text-left transition-colors",
        activa ? "border-verde bg-verde-claro" : "border-border hover:border-verde/40",
      )}
    >
      <p className="text-sm font-bold text-negro">{nombre}</p>
      <p className="num mt-1 text-2xl font-bold text-verde">{mxn(monto)}</p>
      <p className="num mt-0.5 text-xs text-gris">
        equivale a {pctTexto(pct)} sobre el precio de venta
      </p>
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
