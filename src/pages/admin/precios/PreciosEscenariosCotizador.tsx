import { useMemo, useState } from "react";

import { Download, FileCheck2, Lock, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { GraficoCalendario } from "@/features/precios/components/GraficoCalendario";
import { useEsquemasVPN } from "@/features/precios/hooks/useEsquemasVPN";
import { usePreciosProyecto } from "@/features/precios/hooks/usePreciosProyecto";
import {
  aplicarPrecio,
  construirFlujos,
  esInejecutable,
  horizonteEfectivo,
  motivoCritico,
  precioNominalEquivalente,
} from "@/features/precios/engine/npv";
import { exportarCSVAuditado } from "@/features/precios/services/auditoria";
import { useOfertasStore } from "@/features/precios/stores/ofertasStore";
import { formatoFechaCorta } from "@/features/precios/lib/formato";
import {
  DialogoRegistrarOferta,
  type DatosOfertaPropuesta,
} from "@/features/precios/components/DialogoRegistrarOferta";
import { formatoMoneda } from "@/features/precios/lib/formato";
import { factor4, pct2, pctFirmado } from "@/features/precios/lib/formatoVpn";
import { TORRES_POR_ID } from "@/features/precios/mocks/inventario";

  component: Cotizador,
});

const ESTATUS_BLOQUEADOS = ["Apartada", "Vendida"];

/** Fecha del mes n contado desde hoy, formateada mmm aaaa. */
function mesFecha(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d
    .toLocaleDateString("es-MX", { month: "short", year: "numeric" })
    .replace(".", "");
}

const CONCEPTO: Record<string, string> = {
  enganche: "Enganche",
  mensualidad: "Mensualidad",
  entrega: "Contra entrega",
};

function Cotizador() {
  const {
    motor,
    esquemas,
    esquemaBase,
    porTorre,
    torres,
    horizontesPorTorre,
    horizonteMinimo,
    tasaAnual,
    tasaMes,
  } = useEsquemasVPN();
  const { propiedades, desgloses } = usePreciosProyecto();
  const ofertas = useOfertasStore((s) => s.ofertas);

  const [idUnidad, setIdUnidad] = useState<string>("");
  const [idEsquema, setIdEsquema] = useState<string>("");
  const [ofertando, setOfertando] = useState(false);

  const propiedad =
    propiedades.find((p) => p.id_propiedad === idUnidad) ?? propiedades[0] ?? null;
  const desglose = desgloses.find((d) => d.id_propiedad === propiedad?.id_propiedad);

  const activos = esquemas.filter((e) => e.activo);
  const esquema =
    activos.find((e) => e.id_esquema === idEsquema) ??
    esquemaBase ??
    activos[0] ??
    null;

  const torre = propiedad ? TORRES_POR_ID[propiedad.id_torre] : undefined;
  const horizonteTorre =
    horizontesPorTorre.find((h) => h.torre.id_torre === propiedad?.id_torre)?.meses ??
    horizonteMinimo;

  const cotizacion = useMemo(() => {
    if (!propiedad || !desglose || !esquema) return null;

    const vpnTorre =
      porTorre[esquema.id_esquema]?.porTorre[propiedad.id_torre] ?? null;
    const factor = vpnTorre?.factor_vpn ?? 0;
    const factorBase = esquemaBase
      ? (porTorre[esquemaBase.id_esquema]?.porTorre[propiedad.id_torre]?.factor_vpn ??
        factor)
      : factor;

    const precioLista = desglose.precio_lista;
    const precioNominal = precioLista * (1 + esquema.pct_ajuste_manual);
    const equivalente = precioNominalEquivalente(precioLista, factorBase, factor);

    const horizonte = horizonteEfectivo(esquema, horizonteTorre);
    const flujos = aplicarPrecio(
      construirFlujos(esquema, horizonte),
      precioNominal,
      tasaMes,
    );

    // El gráfico trabaja en proporciones del precio, no en pesos.
    const flujosUnitarios = aplicarPrecio(
      construirFlujos(esquema, horizonte),
      1,
      tasaMes,
    );

    const totalNominal = flujos.reduce((a, f) => a + (f.monto ?? 0), 0);
    const totalVP = flujos.reduce((a, f) => a + (f.valor_presente ?? 0), 0);

    // La proporción exenta/gravada del motor se conserva sobre el precio nominal.
    const propExento =
      precioLista > 0 ? desglose.componente_exento / desglose.precio_calculado : 0;

    return {
      factor,
      factorBase,
      precioLista,
      precioNominal,
      equivalente,
      diferencia: precioNominal - equivalente,
      horizonte,
      flujos,
      flujosUnitarios,
      totalNominal,
      totalVP,
      costoDiferimiento: totalNominal - totalVP,
      exento: precioNominal * propExento,
      gravado: precioNominal * (1 - propExento),
      iva: precioNominal * (1 - propExento) * 0.16,
      totalComprador: precioNominal + precioNominal * (1 - propExento) * 0.16,
      vpnTorre,
    };
  }, [propiedad, desglose, esquema, porTorre, esquemaBase, horizonteTorre, tasaMes]);

  const bloqueada = propiedad ? ESTATUS_BLOQUEADOS.includes(propiedad.estatus) : false;
  const ofertaVigenteUnidad = propiedad
    ? (ofertas.find(
        (o) =>
          o.id_propiedad === propiedad.id_propiedad &&
          o.estado === "vigente" &&
          new Date(o.vence_en).getTime() >= Date.now(),
      ) ?? null)
    : null;
  const inejecutable = esInejecutable(cotizacion?.vpnTorre ?? undefined);

  const exportar = () => {
    if (!cotizacion || !propiedad || !esquema) return;
    exportarCSVAuditado(
      {
        id_proyecto: propiedad.id_proyecto,
        origen: `Cotización unidad ${propiedad.numero}`,
        filtros: { esquema: esquema.nombre },
      },
      `cotizacion-${propiedad.numero}-${esquema.nombre.replace(/\s+/g, "-")}.csv`,
      [
        "Mes",
        "Fecha",
        "Concepto",
        "Porcentaje",
        "Monto",
        "Porcentaje acumulado",
        "Monto acumulado",
        "Factor de descuento",
        "Valor presente",
      ],
      cotizacion.flujos.map((f, i) => [
        f.mes,
        mesFecha(f.mes),
        CONCEPTO[f.concepto] ?? f.concepto,
        (f.pct * 100).toFixed(4),
        (f.monto ?? 0).toFixed(2),
        (
          cotizacion.flujos.slice(0, i + 1).reduce((a, x) => a + x.pct, 0) * 100
        ).toFixed(4),
        cotizacion.flujos
          .slice(0, i + 1)
          .reduce((a, x) => a + (x.monto ?? 0), 0)
          .toFixed(2),
        (f.factor_descuento ?? 0).toFixed(6),
        (f.valor_presente ?? 0).toFixed(2),
      ]),
    );
  };

  if (!propiedad || !esquema || !cotizacion) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay unidades o esquemas activos en el proyecto.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Unidad</Label>
          <Select value={propiedad.id_propiedad} onValueChange={setIdUnidad}>
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {propiedades.map((p) => (
                <SelectItem key={p.id_propiedad} value={p.id_propiedad}>
                  {p.numero} · Nivel {p.nivel} · {p.estatus}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Esquema de pago</Label>
          <Select value={esquema.id_esquema} onValueChange={setIdEsquema}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activos.map((e) => (
                <SelectItem key={e.id_esquema} value={e.id_esquema}>
                  {e.nombre}
                  {e.es_base ? " · base" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          {torre ? `Torre ${torre.nombre} · ` : null}
          Entrega estimada en {horizonteTorre} meses · Tasa {(tasaAnual * 100).toFixed(2)}%
          anual ({(tasaMes * 100).toFixed(4)}% mensual)
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5">Libro: Comercial</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-auto">
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={bloqueada || !!ofertaVigenteUnidad}
                onClick={() => setOfertando(true)}
              >
                <FileCheck2 className="size-4" />
                Registrar oferta vigente
              </Button>
            </span>
          </TooltipTrigger>
          {ofertaVigenteUnidad ? (
            <TooltipContent>
              Esta unidad ya tiene una oferta vigente hasta el{" "}
              {formatoFechaCorta(ofertaVigenteUnidad.vence_en)}.
            </TooltipContent>
          ) : null}
        </Tooltip>
        <Button variant="outline" size="sm" onClick={exportar}>
          <Download className="mr-1.5 size-4" />
          Exportar calendario
        </Button>
      </Card>

      {bloqueada ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>
            La unidad {propiedad.numero} está {propiedad.estatus.toLowerCase()}. Esta
            cotización es solo informativa y no puede usarse para reprecio ni para una
            nueva operación.
          </span>
        </div>
      ) : null}

      {inejecutable ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{motivoCritico(cotizacion.vpnTorre ?? undefined)}</span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Precio de lista" valor={formatoMoneda(cotizacion.precioLista)} />
        <Cifra
          titulo={`Precio del esquema (${pctFirmado(esquema.pct_ajuste_manual)})`}
          valor={formatoMoneda(cotizacion.precioNominal)}
        />
        <Cifra titulo="Factor de VPN" valor={factor4(cotizacion.factor)} />
        <Cifra
          titulo="Valor presente de la operación"
          valor={formatoMoneda(cotizacion.totalVP)}
        />
      </div>

      <Card className="grid gap-4 p-4 md:grid-cols-3">
        <Cifra
          titulo="Precio nominal equivalente al esquema base"
          valor={formatoMoneda(cotizacion.equivalente)}
        />
        <Cifra
          titulo="Diferencia contra el equivalente"
          valor={`${cotizacion.diferencia < 0 ? "−" : "+"}${formatoMoneda(
            Math.abs(cotizacion.diferencia),
          )}`}
          clase={cotizacion.diferencia < 0 ? "text-red-600" : "text-emerald-700"}
        />
        <Cifra
          titulo="Costo del diferimiento"
          valor={formatoMoneda(cotizacion.costoDiferimiento)}
        />
        <p className="text-xs text-muted-foreground md:col-span-3">
          El precio equivalente es el monto nominal que, bajo este calendario, produce el
          mismo valor presente que el esquema base. Una diferencia negativa significa que
          la política vigente cobra menos de lo que el diferimiento cuesta.
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-base font-semibold text-foreground">
          Composición fiscal del precio nominal
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra
            titulo="Componente exento (vivienda)"
            valor={formatoMoneda(cotizacion.exento)}
          />
          <Cifra
            titulo="Componente gravado (estacionamiento y bodega)"
            valor={formatoMoneda(cotizacion.gravado)}
          />
          <Cifra titulo="IVA 16% sobre el gravado" valor={formatoMoneda(cotizacion.iva)} />
          <Cifra
            titulo="Total a pagar por el comprador"
            valor={formatoMoneda(cotizacion.totalComprador)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          La proporción exenta y gravada se conserva del motor de precios; el ajuste del
          esquema se aplica proporcionalmente a ambos componentes. La vivienda no causa IVA;
          el estacionamiento y la bodega sí. El comprador firma por el total con IVA, no por
          el precio de lista.
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-base font-semibold text-foreground">Calendario de pagos</h3>
        <GraficoCalendario
          flujos={cotizacion.flujosUnitarios}
          horizonte={cotizacion.horizonte}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Mes</th>
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                <th className="px-3 py-2 text-left font-medium">Concepto</th>
                <th className="px-3 py-2 text-right font-medium">%</th>
                <th className="px-3 py-2 text-right font-medium">Monto</th>
                <th className="px-3 py-2 text-right font-medium">% acumulado</th>
                <th className="px-3 py-2 text-right font-medium">Monto acumulado</th>
                <th className="px-3 py-2 text-right font-medium">Factor</th>
                <th className="px-3 py-2 text-right font-medium">Valor presente</th>
              </tr>
            </thead>
            <tbody>
              {cotizacion.flujos.map((f, i) => {
                const pctAcum = cotizacion.flujos
                  .slice(0, i + 1)
                  .reduce((a, x) => a + x.pct, 0);
                const montoAcum = cotizacion.flujos
                  .slice(0, i + 1)
                  .reduce((a, x) => a + (x.monto ?? 0), 0);
                return (
                <tr key={`${f.mes}-${f.concepto}-${i}`} className="border-b border-border/60">
                  <td className="px-3 py-1.5">{f.mes}</td>
                  <td className="px-3 py-1.5">{mesFecha(f.mes)}</td>
                  <td className="px-3 py-1.5">{CONCEPTO[f.concepto] ?? f.concepto}</td>
                  <td className="px-3 py-1.5 text-right">{pct2(f.pct)}</td>
                  <td className="px-3 py-1.5 text-right">{formatoMoneda(f.monto ?? 0)}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {pct2(pctAcum)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {formatoMoneda(montoAcum)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {(f.factor_descuento ?? 0).toFixed(6)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {formatoMoneda(f.valor_presente ?? 0)}
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-semibold">
                <td className="px-3 py-2" colSpan={4}>
                  Total
                </td>
                <td className="px-3 py-2 text-right">
                  {formatoMoneda(cotizacion.totalNominal)}
                </td>
                <td />
                <td />
                <td />
                <td className="px-3 py-2 text-right">{formatoMoneda(cotizacion.totalVP)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        {torres.length > 1
          ? "El calendario usa la fecha de entrega de la torre de la unidad seleccionada."
          : "El calendario usa la fecha de entrega estimada del proyecto."}{" "}
        Holgura de entrega configurada: {motor.meses_holgura_entrega ?? 0} meses.
      </p>
      <DialogoRegistrarOferta
        abierto={ofertando}
        onOpenChange={setOfertando}
        propuesta={
          {
            id_proyecto: propiedad.id_proyecto,
            id_propiedad: propiedad.id_propiedad,
            etiqueta_unidad: propiedad.numero,
            precio_ofertado: cotizacion.precioNominal,
            id_esquema: esquema.id_esquema,
            nombre_esquema: esquema.nombre,
            descuento_adicional: esquema.pct_ajuste_manual * 100,
          } satisfies DatosOfertaPropuesta
        }
      />
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
    <div>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn("text-xl font-bold tabular-nums text-foreground", clase)}>
        {valor}
      </p>
    </div>
  );
}
