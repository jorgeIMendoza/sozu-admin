import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Info, Plus, TriangleAlert, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TarjetaEsquema } from "@/features/precios/components/TarjetaEsquema";
import { ModalEsquema } from "@/features/precios/components/ModalEsquema";
import { useEsquemasVPN } from "@/features/precios/hooks/useEsquemasVPN";
import { esInejecutable } from "@/features/precios/engine/npv";
import { useEsquemasStore } from "@/features/precios/stores/esquemasStore";
import { soportaCamposDeMotor } from "@/features/precios/services/esquemasReales";
import { registrarEvento } from "@/features/precios/services/auditoria";
import type {
  EsquemaFinanciamiento,
  TipoEsquema,
} from "@/features/precios/types/dominio";
import { pct2 } from "@/features/precios/lib/formatoVpn";

function PantallaEsquemas() {
  const {
    idProyecto,
    esquemas,
    esquemaBase,
    resultados,
    horizonteMinimo,
    horizonteMaximo,
    horizontesPorTorre,
    porTorre,
    multiTorre,
    tasaAnual,
    tasaMes,
  } = useEsquemasVPN();

  const errorEscritura = useEsquemasStore((s) => s.errorEscritura);

  /*
   * Si el DDL de los campos del motor no se ha aplicado, el regimen, el mes de
   * inicio y la marca de esquema base no tienen donde guardarse. Se avisa en vez
   * de dejar que se capturen y desaparezcan al recargar.
   */
  const [camposCompletos, setCamposCompletos] = useState(true);
  useEffect(() => {
    let vigente = true;
    void soportaCamposDeMotor().then((ok) => {
      if (vigente) setCamposCompletos(ok);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const crearEsquema = useEsquemasStore((s) => s.crearEsquema);
  const reemplazarEsquema = useEsquemasStore((s) => s.reemplazarEsquema);
  const marcarComoBase = useEsquemasStore((s) => s.marcarComoBase);
  const duplicarEsquema = useEsquemasStore((s) => s.duplicarEsquema);
  const desactivarEsquema = useEsquemasStore((s) => s.desactivarEsquema);
  const reactivarEsquema = useEsquemasStore((s) => s.reactivarEsquema);

  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<EsquemaFinanciamiento | null>(null);
  const [infoVisible, setInfoVisible] = useState(true);
  const [infoAbierta, setInfoAbierta] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<TipoEsquema | "todos">("todos");

  const conteo = {
    todos: esquemas.length,
    preventa: esquemas.filter((e) => e.tipo_esquema !== "post_entrega").length,
    post_entrega: esquemas.filter((e) => e.tipo_esquema === "post_entrega").length,
  };
  const visibles = esquemas.filter((e) =>
    filtroTipo === "todos"
      ? true
      : filtroTipo === "post_entrega"
        ? e.tipo_esquema === "post_entrega"
        : e.tipo_esquema !== "post_entrega",
  );

  /**
   * Un esquema de preventa deja de poder venderse cuando ya no cabe su calendario
   * antes de la entrega de la torre. La fecha de caducidad es la entrega menos el
   * largo del plan. Ordenado por fecha: lo primero que vence, primero.
   */
  const caducidades = useMemo(() => {
    const filas: Array<{
      esquema: EsquemaFinanciamiento;
      torre: string;
      fecha: Date;
      meses: number;
    }> = [];
    for (const e of esquemas) {
      if (!e.activo || e.tipo_esquema === "post_entrega" || e.es_contado) continue;
      const plan =
        e.meses_enganche + e.mes_inicio_mensualidades + e.num_mensualidades;
      for (const h of horizontesPorTorre) {
        const entrega = new Date(h.torre.fecha_entrega_estimada);
        const fecha = new Date(entrega);
        fecha.setMonth(fecha.getMonth() - plan);
        filas.push({ esquema: e, torre: h.torre.nombre, fecha, meses: plan });
      }
    }
    return filas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }, [esquemas, horizontesPorTorre]);

  const hoy = new Date();

  return (
    <div className="space-y-5">
      {errorEscritura ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>No se guardo el cambio</AlertTitle>
          <AlertDescription>
            {errorEscritura} Los esquemas que ves siguen siendo los de la base, asi que lo
            que intentaste no quedo a medias.
          </AlertDescription>
        </Alert>
      ) : null}

      {camposCompletos ? null : (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <Info className="size-4 text-amber-600" />
          <AlertTitle className="text-foreground">
            Faltan columnas en la base para guardar todo
          </AlertTitle>
          <AlertDescription className="text-foreground">
            El nombre, los porcentajes, el numero de mensualidades, el ajuste y los tramos
            si se guardan. El <strong>regimen</strong> (preventa o post-entrega), el
            <strong> mes de inicio de mensualidades</strong>, el
            <strong> modo de escalonamiento</strong>, el
            <strong> factor de crecimiento</strong> y la marca de
            <strong> esquema base</strong> no: esas columnas todavia no existen, se derivan
            al leer y se pierden al recargar. Aplica{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              Ejecuciones_manuales/20260821_esquemas_pago_campos_motor_precios.md
            </code>{" "}
            y empiezan a persistirse sin tocar el codigo.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground tabular-nums">
            Tasa de descuento: {(tasaAnual * 100).toFixed(2)}% anual ·{" "}
            {(tasaMes * 100).toFixed(4)}% mensual
          </p>
          <p className="text-xs text-muted-foreground">
            Configurable en{" "}
            <Link to="/admin/inventario/precios/motor" className="underline">
              Configuración del Motor
            </Link>
            .
          </p>
          <p
            className="mt-1 text-xs text-muted-foreground tabular-nums"
            title={horizontesPorTorre
              .map((h) => `${h.torre.nombre}: ${h.meses} meses`)
              .join(" · ")}
          >
            Horizonte:{" "}
            {horizonteMinimo === horizonteMaximo
              ? `${horizonteMinimo} meses`
              : `${horizonteMinimo} a ${horizonteMaximo} meses según torre`}
            .
          </p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setModal(true);
          }}
        >
          <Plus className="size-4" />
          Nuevo Esquema
        </Button>
      </div>

      {caducidades.length > 0 ? (
        <div className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-semibold text-foreground">
              Caducidad de esquemas
            </h3>
            <p className="text-xs text-muted-foreground">
              Último día en que el calendario todavía cabe antes de la entrega de cada
              torre. Después de esa fecha el esquema ya no es vendible en esa torre.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Esquema</th>
                  <th className="px-4 py-2 text-left font-medium">Torre</th>
                  <th className="px-4 py-2 text-left font-medium">Largo del plan</th>
                  <th className="px-4 py-2 text-left font-medium">Caduca</th>
                </tr>
              </thead>
              <tbody>
                {caducidades.map((c, i) => {
                  const vencido = c.fecha.getTime() < hoy.getTime();
                  return (
                    <tr
                      key={`${c.esquema.id_esquema}-${c.torre}-${i}`}
                      className="border-t border-border"
                    >
                      <td className="px-4 py-1.5 font-medium text-foreground">
                        {c.esquema.nombre}
                      </td>
                      <td className="px-4 py-1.5 text-muted-foreground">{c.torre}</td>
                      <td className="px-4 py-1.5 tabular-nums text-muted-foreground">
                        {c.meses} meses
                      </td>
                      <td
                        className={
                          vencido
                            ? "px-4 py-1.5 tabular-nums text-destructive"
                            : "px-4 py-1.5 tabular-nums text-foreground"
                        }
                      >
                        {c.fecha.toLocaleDateString("es-MX", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })}
                        {vencido ? " · ya vencido" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {infoVisible ? (
        <Alert>
          <Info className="size-4" />
          <AlertTitle className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex items-center gap-1"
              onClick={() => setInfoAbierta((v) => !v)}
            >
              Qué hace el valor presente aquí
              <ChevronDown className={infoAbierta ? "size-4 rotate-180" : "size-4"} />
            </button>
            <button
              type="button"
              aria-label="Descartar"
              onClick={() => setInfoVisible(false)}
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          </AlertTitle>
          {infoAbierta ? (
            <AlertDescription>
              Dos esquemas con el mismo precio de lista no valen lo mismo para el
              desarrollador: el dinero que entra en el mes 0 vale más que el que entra en
              el mes {horizonteMinimo}. El factor de VPN mide cuánto vale realmente cada
              peso de precio bajo cada esquema, descontado al costo de capital del
              proyecto. A partir de ese número se deriva cuánto descuento puede otorgarse
              sin destruir valor.
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      {/* SWAP POINT: la tasa debe provenir del contrato de crédito puente del proyecto. */}
      <Alert className="border-amber-200 bg-amber-50 text-amber-900">
        <TriangleAlert className="size-4" />
        <AlertTitle>La tasa de descuento es un supuesto, no un dato.</AlertTitle>
        <AlertDescription className="text-amber-900/90">
          El 14% anual es un valor de referencia anclado al costo típico de crédito puente
          en México. Todo descuento autorizable que salga de este módulo hereda ese
          supuesto. Sustitúyelo por el costo de capital real del proyecto antes de usar
          estos números para autorizar condiciones comerciales.
        </AlertDescription>
      </Alert>

      <div className="inline-flex gap-1 rounded-md border border-border p-1">
        {(
          [
            ["todos", `Todos (${conteo.todos})`],
            ["preventa", `Preventa (${conteo.preventa})`],
            ["post_entrega", `Post-entrega (${conteo.post_entrega})`],
          ] as Array<[TipoEsquema | "todos", string]>
        ).map(([v, t]) => (
          <button
            key={v}
            type="button"
            onClick={() => setFiltroTipo(v)}
            className={
              filtroTipo === v
                ? "rounded bg-muted px-3 py-1 text-[13px] font-medium"
                : "rounded px-3 py-1 text-[13px] text-muted-foreground"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {visibles.map((e) => {
          const vpn = resultados[e.id_esquema];
          if (!vpn) return null;
          const bloque = porTorre[e.id_esquema];
          const detalle = multiTorre
            ? horizontesPorTorre.map((h) => {
                const r = bloque?.porTorre[h.torre.id_torre];
                return {
                  id_torre: h.torre.id_torre,
                  nombre: h.torre.nombre,
                  horizonte: h.meses,
                  factor: r?.factor_vpn ?? 0,
                  ejecutable: !esInejecutable(r),
                };
              })
            : undefined;
          return (
            <TarjetaEsquema
              key={e.id_esquema}
              esquema={e}
              vpn={vpn}
              detalleTorres={detalle}
              factorPonderadoProyecto={bloque?.ponderado}
              ponderadoParcial={bloque?.parcial}
              onEditar={() => {
                setEditando(e);
                setModal(true);
              }}
              onMarcarBase={() => {
                marcarComoBase(e.id_esquema);
                registrarEvento({
                  id_proyecto: idProyecto,
                  tipo: "esquema.marcado_base",
                  entidad: { tipo: "esquema", id: e.id_esquema, etiqueta: e.nombre },
                  antes: { es_base: e.es_base },
                  despues: { es_base: true },
                });
              }}
              onDuplicar={() => duplicarEsquema(e.id_esquema)}
              onAlternarActivo={() => {
                if (e.activo) desactivarEsquema(e.id_esquema);
                else reactivarEsquema(e.id_esquema);
                registrarEvento({
                  id_proyecto: idProyecto,
                  tipo: e.activo ? "esquema.desactivado" : "esquema.actualizado",
                  entidad: { tipo: "esquema", id: e.id_esquema, etiqueta: e.nombre },
                  antes: { activo: e.activo },
                  despues: { activo: !e.activo },
                });
              }}
            />
          );
        })}
        {visibles.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Este proyecto no tiene esquemas de financiamiento. Crea el primero con “Nuevo
            Esquema”.
          </Card>
        ) : null}
      </div>

      <Card className="p-4 text-sm text-muted-foreground">
        El motor no sobrescribe tu política comercial. El ajuste que aplicas a cada
        esquema es una decisión de negocio y se respeta tal cual. El módulo calcula por
        separado cuál sería el ajuste que preserva el valor presente y te muestra la
        diferencia. Cerrar esa brecha, mantenerla por razones competitivas, o ampliarla
        deliberadamente, es una decisión tuya, no del sistema.
      </Card>

      <p className="text-xs text-muted-foreground tabular-nums">
        Suma de composición requerida por esquema: {pct2(1)} · Libro: Comercial
      </p>

      <ModalEsquema
        abierto={modal}
        onOpenChange={setModal}
        esquema={editando}
        horizonte={horizonteMinimo}
        tasaAnual={tasaAnual}
        esquemaBase={esquemaBase}
        onGuardar={(datos) => {
          if (editando) {
            reemplazarEsquema(editando.id_esquema, datos);
            registrarEvento({
              id_proyecto: idProyecto,
              tipo: "esquema.actualizado",
              entidad: {
                tipo: "esquema",
                id: editando.id_esquema,
                etiqueta: datos.nombre,
              },
              antes: editando,
              despues: datos,
            });
          } else {
            crearEsquema(idProyecto, datos);
            registrarEvento({
              id_proyecto: idProyecto,
              tipo: "esquema.creado",
              entidad: { tipo: "esquema", id: "nuevo", etiqueta: datos.nombre },
              antes: null,
              despues: datos,
            });
          }
        }}
      />
    </div>
  );
}

export default PantallaEsquemas;
