import { useEffect, useMemo, useState } from "react";

import { Archive, Copy, Download, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { GraficoAbsorcion } from "@/features/precios/components/GraficoAbsorcion";
import { useEsquemasVPN } from "@/features/precios/hooks/useEsquemasVPN";
import { usePreciosProyecto } from "@/features/precios/hooks/usePreciosProyecto";
import { esInejecutable } from "@/features/precios/engine/npv";
import { conAuditoria } from "@/features/precios/services/auditoria";
import type { TipoEsquema } from "@/features/precios/types/dominio";
import {
  curvaAbsorcion,
  useEscenariosProyectoStore,
  type EscenarioProyecto,
  type FormaAbsorcion,
} from "@/features/precios/stores/escenariosProyectoStore";
import { descargarCSV } from "@/features/precios/lib/csv";
import { formatoMoneda } from "@/features/precios/lib/formato";
import { pct2 } from "@/features/precios/lib/formatoVpn";

  component: EscenariosProyecto,
});

const ESTATUS_BLOQUEADOS = ["Apartada", "Vendida"];
const SIN_ESCENARIOS: EscenarioProyecto[] = [];

const FORMAS: Array<[FormaAbsorcion, string]> = [
  ["lineal", "Lineal"],
  ["acelerada", "Acelerada al inicio"],
  ["lenta", "Lenta al inicio"],
];

function EscenariosProyecto() {
  const {
    idProyecto,
    esquemas,
    esquemaBase,
    basePorRegimen,
    porTorre,
    resultados,
    tasaMes,
  } = useEsquemasVPN();
  const { propiedades, desgloses } = usePreciosProyecto();

  const escenarios = useEscenariosProyectoStore(
    (s) => s.escenariosPorProyecto[idProyecto] ?? SIN_ESCENARIOS,
  );
  const idActivo = useEscenariosProyectoStore(
    (s) => s.idActivoPorProyecto[idProyecto] ?? null,
  );
  const {
    crear: crearBase,
    duplicar,
    actualizar,
    eliminar: eliminarBase,
    seleccionar,
  } = useEscenariosProyectoStore();

  // La auditoría se aplica por envoltura: ninguna acción del store se reescribe.
  const crear = useMemo(
    () =>
      conAuditoria(crearBase, (idProyectoEvento, nombre, mix) => ({
        id_proyecto: idProyectoEvento,
        tipo: "escenario.guardado" as const,
        entidad: { tipo: "escenario", id: nombre, etiqueta: nombre },
        antes: null,
        despues: { nombre, mix },
      })),
    [crearBase],
  );

  const eliminar = useMemo(
    () =>
      conAuditoria(eliminarBase, (idProyectoEvento, idEscenario) => ({
        id_proyecto: idProyectoEvento,
        tipo: "escenario.archivado" as const,
        entidad: { tipo: "escenario", id: idEscenario, etiqueta: idEscenario },
        antes: { estado: "activo" },
        despues: { estado: "archivado" },
      })),
    [eliminarBase],
  );

  const [nombreNuevo, setNombreNuevo] = useState("");

  const ejecutables = useMemo(
    () => esquemas.filter((e) => e.activo && !esInejecutable(resultados[e.id_esquema])),
    [esquemas, resultados],
  );

  // Crea un escenario inicial con el mix repartido en partes iguales.
  useEffect(() => {
    if (escenarios.length === 0 && ejecutables.length > 0) {
      const parte = 1 / ejecutables.length;
      crear(
        idProyecto,
        "Escenario base",
        Object.fromEntries(ejecutables.map((e) => [e.id_esquema, parte])),
      );
    }
  }, [escenarios.length, ejecutables, idProyecto, crear]);

  const escenario =
    escenarios.find((e) => e.id_escenario === idActivo) ?? escenarios[0] ?? null;

  const disponibles = useMemo(() => {
    const bloqueadas = new Set(
      propiedades
        .filter((p) => ESTATUS_BLOQUEADOS.includes(p.estatus))
        .map((p) => p.id_propiedad),
    );
    return desgloses.filter((d) => !bloqueadas.has(d.id_propiedad));
  }, [propiedades, desgloses]);

  const valorLista = disponibles.reduce((a, d) => a + d.precio_lista, 0);
  const unidades = disponibles.length;
  const precioPromedio = unidades > 0 ? valorLista / unidades : 0;

  const mix = escenario?.mix ?? {};
  const sumaMix = ejecutables.reduce((a, e) => a + (mix[e.id_esquema] ?? 0), 0);
  const mixOk = Math.abs(sumaMix - 1) <= 0.0005;

  const factorDe = (id: string) =>
    porTorre[id]?.ponderado ?? resultados[id]?.factor_vpn ?? 0;
  /**
   * El referente sin brecha depende del régimen: un esquema de post-entrega
   * no se mide contra la base de preventa. Antes se usaba una sola base para
   * todo el mix, lo que inflaba la brecha y a veces le cambiaba el signo.
   */
  const factorBaseDe = (tipo: TipoEsquema) => {
    const b = basePorRegimen[tipo];
    return b ? factorDe(b.id_esquema) : esquemaBase ? factorDe(esquemaBase.id_esquema) : 1;
  };

  const proyeccion = useMemo(() => {
    if (!escenario || !mixOk) return null;

    const ventas = curvaAbsorcion(unidades, escenario.meses_absorcion, escenario.forma);

    // Valor presente de una unidad promedio bajo el mix, sin descontar la espera.
    const vpUnidadMix = ejecutables.reduce(
      (a, e) =>
        a +
        (mix[e.id_esquema] ?? 0) *
          precioPromedio *
          (1 + e.pct_ajuste_manual) *
          factorDe(e.id_esquema),
      0,
    );
    const vpUnidadSinBrecha = ejecutables.reduce(
      (a, e) =>
        a + (mix[e.id_esquema] ?? 0) * precioPromedio * factorBaseDe(e.tipo_esquema),
      0,
    );

    let acumulado = 0;
    let acumuladoSinBrecha = 0;
    const meses = ventas.map((u, i) => {
      const desc = 1 / Math.pow(1 + tasaMes, i);
      const vp = u * vpUnidadMix * desc;
      acumulado += vp;
      acumuladoSinBrecha += u * vpUnidadSinBrecha * desc;
      return {
        mes: i,
        unidades: u,
        nominal: u * precioPromedio,
        vp,
        vpAcumulado: acumulado,
      };
    });

    return {
      meses,
      total: acumulado,
      totalSinBrecha: acumuladoSinBrecha,
      totalNominal: valorLista,
      vpUnidadMix,
    };
  }, [
    escenario,
    mixOk,
    unidades,
    ejecutables,
    mix,
    precioPromedio,
    basePorRegimen,
    tasaMes,
    valorLista,
    porTorre,
    resultados,
  ]);

  const exportar = () => {
    if (!proyeccion || !escenario) return;
    descargarCSV(
      `escenario-${escenario.nombre.replace(/\s+/g, "-")}.csv`,
      ["Mes", "Unidades vendidas", "Valor nominal", "Valor presente", "VP acumulado"],
      proyeccion.meses.map((m) => [
        m.mes,
        m.unidades,
        m.nominal.toFixed(2),
        m.vp.toFixed(2),
        m.vpAcumulado.toFixed(2),
      ]),
    );
  };

  if (!escenario) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay esquemas ejecutables con los que construir un escenario de proyecto.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Escenario</Label>
          <Select
            value={escenario.id_escenario}
            onValueChange={(v) => seleccionar(idProyecto, v)}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {escenarios.map((e) => (
                <SelectItem key={e.id_escenario} value={e.id_escenario}>
                  {e.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nombre</Label>
          <Input
            className="w-56"
            value={escenario.nombre}
            onChange={(e) =>
              actualizar(idProyecto, escenario.id_escenario, { nombre: e.target.value })
            }
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => duplicar(idProyecto, escenario.id_escenario)}
        >
          <Copy className="mr-1.5 size-4" />
          Duplicar
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={escenarios.length <= 1}
          onClick={() => eliminar(idProyecto, escenario.id_escenario)}
        >
          <Archive className="mr-1.5 size-4" />
          Archivar
        </Button>
        <div className="ml-auto flex items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nuevo escenario</Label>
            <Input
              className="w-48"
              placeholder="Nombre"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={nombreNuevo.trim().length < 3}
            onClick={() => {
              crear(idProyecto, nombreNuevo.trim(), { ...escenario.mix });
              setNombreNuevo("");
            }}
          >
            <Plus className="mr-1.5 size-4" />
            Crear
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h3 className="text-base font-semibold text-foreground">Mix de esquemas</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ejecutables.map((e) => (
            <div key={e.id_esquema} className="space-y-1.5">
              <Label className="text-xs">{e.nombre}</Label>
              <Input
                className="tabular-nums"
                value={((mix[e.id_esquema] ?? 0) * 100).toFixed(2)}
                onChange={(ev) => {
                  const n = Number.parseFloat(ev.target.value.replace(",", "."));
                  actualizar(idProyecto, escenario.id_escenario, {
                    mix: {
                      ...escenario.mix,
                      [e.id_esquema]: Number.isFinite(n) ? n / 100 : 0,
                    },
                  });
                }}
              />
            </div>
          ))}
        </div>
        <p
          className={cn(
            "text-xs tabular-nums",
            mixOk ? "text-muted-foreground" : "text-red-600",
          )}
        >
          El mix suma {pct2(sumaMix)}
          {mixOk ? "." : ". Debe sumar exactamente 100% para proyectar el escenario."}
        </p>
      </Card>

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Meses de absorción</Label>
          <Input
            type="number"
            min={1}
            max={60}
            className="w-32 tabular-nums"
            value={escenario.meses_absorcion}
            onChange={(e) =>
              actualizar(idProyecto, escenario.id_escenario, {
                meses_absorcion: Math.max(
                  1,
                  Math.min(60, Math.round(Number(e.target.value) || 1)),
                ),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Forma de la curva</Label>
          <Select
            value={escenario.forma}
            onValueChange={(v) =>
              actualizar(idProyecto, escenario.id_escenario, {
                forma: v as FormaAbsorcion,
              })
            }
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAS.map(([v, t]) => (
                <SelectItem key={v} value={v}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          {unidades} unidades disponibles · Precio promedio{" "}
          {formatoMoneda(precioPromedio)}
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5">Libro: Comercial</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={!proyeccion}
          onClick={exportar}
        >
          <Download className="mr-1.5 size-4" />
          Exportar proyección
        </Button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Valor de lista disponible" valor={formatoMoneda(valorLista)} />
        <Cifra
          titulo="Valor presente del escenario"
          valor={proyeccion ? formatoMoneda(proyeccion.total) : "—"}
        />
        <Cifra
          titulo="Valor presente sin brechas de política"
          valor={proyeccion ? formatoMoneda(proyeccion.totalSinBrecha) : "—"}
        />
        <Cifra
          titulo="Brecha del escenario"
          valor={
            proyeccion
              ? formatoMoneda(proyeccion.totalSinBrecha - proyeccion.total)
              : "—"
          }
          clase={
            proyeccion && proyeccion.totalSinBrecha - proyeccion.total > 0
              ? "text-red-600"
              : undefined
          }
        />
      </div>

      {proyeccion ? (
        <>
          <Card className="space-y-3 p-4">
            <h3 className="text-base font-semibold text-foreground">
              Curva de absorción y valor presente acumulado
            </h3>
            <GraficoAbsorcion meses={proyeccion.meses} />
          </Card>

          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Mes</th>
                  <th className="px-3 py-2 text-right font-medium">Unidades</th>
                  <th className="px-3 py-2 text-right font-medium">Valor nominal</th>
                  <th className="px-3 py-2 text-right font-medium">Valor presente</th>
                  <th className="px-3 py-2 text-right font-medium">VP acumulado</th>
                </tr>
              </thead>
              <tbody>
                {proyeccion.meses.map((m) => (
                  <tr key={m.mes} className="border-b border-border/60">
                    <td className="px-3 py-1.5">{m.mes}</td>
                    <td className="px-3 py-1.5 text-right">{m.unidades}</td>
                    <td className="px-3 py-1.5 text-right">{formatoMoneda(m.nominal)}</td>
                    <td className="px-3 py-1.5 text-right">{formatoMoneda(m.vp)}</td>
                    <td className="px-3 py-1.5 text-right">
                      {formatoMoneda(m.vpAcumulado)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">
                    {proyeccion.meses.reduce((a, m) => a + m.unidades, 0)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatoMoneda(proyeccion.totalNominal)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatoMoneda(proyeccion.total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
      ) : null}

      <p className="text-xs text-muted-foreground">
        La proyección descuenta cada cohorte de ventas por el mes en que se firma y por el
        calendario de su esquema. Excluye unidades apartadas y vendidas. No representa
        plusvalía ni rendimiento de inversión: es el valor presente de los ingresos del
        desarrollador bajo la política vigente.
      </p>
    </div>
  );
}

function Cifra({
  titulo,
  valor,
  clase,
}: {
  titulo: string;
  valor: string;
  clase?: string | undefined;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn("text-xl font-bold tabular-nums text-foreground", clase)}>
        {valor}
      </p>
    </Card>
  );
}
