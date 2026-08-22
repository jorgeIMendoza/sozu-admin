import { useState } from "react";
import {
  CalendarDays,
  CircleAlert,
  Clock,
  EllipsisVertical,
  Info,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { EsquemaFinanciamiento, ResultadoVPN } from "../types/dominio";
import { claseBrecha, factor4, pct2, pctFirmado, puntos } from "../lib/formatoVpn";
import { formatoMoneda } from "../lib/formato";
import { GraficoCalendario } from "./GraficoCalendario";
import { esInejecutable } from "../engine/npv";

const ICONO = {
  informativa: Info,
  advertencia: TriangleAlert,
  critica: CircleAlert,
} as const;

export interface DetalleTorre {
  id_torre: string;
  nombre: string;
  horizonte: number;
  factor: number;
  ejecutable: boolean;
}

const COLOR = {
  informativa: "text-muted-foreground",
  advertencia: "text-amber-600",
  critica: "text-red-600",
} as const;

export function TarjetaEsquema({
  esquema,
  vpn,
  onMarcarBase,
  onDuplicar,
  onAlternarActivo,
  onEditar,
  detalleTorres,
  factorPonderadoProyecto,
  ponderadoParcial,
  referencia,
}: {
  esquema: EsquemaFinanciamiento;
  vpn: ResultadoVPN;
  /** Solo se envía en proyectos con más de una torre. */
  detalleTorres?: DetalleTorre[] | undefined;
  factorPonderadoProyecto?: number | undefined;
  ponderadoParcial?: boolean | undefined;
  /**
   * Precio contra el que traducir el esquema a pesos.
   *
   * Sin esto la tarjeta habla en porcentajes y factores, que sirven para comparar
   * esquemas entre sí pero no para saber qué se le va a cobrar a alguien. Es
   * opcional porque el proyecto puede no tener inventario disponible con precio.
   */
  referencia?: { etiqueta: string; precio: number; unidades: number } | undefined;
  onMarcarBase: () => void;
  onDuplicar: () => void;
  onAlternarActivo: () => void;
  onEditar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const suma = esquema.pct_enganche + esquema.pct_mensualidades + esquema.pct_entrega;
  const sumaOk = Math.abs(suma - 1) <= 0.0001;
  const maxDesc = Math.max(0, vpn.descuento_max_autorizable);
  const inejecutable = esInejecutable(vpn);
  const multi = (detalleTorres?.length ?? 0) > 1;

  return (
    <Card
      className={cn(
        "p-5",
        inejecutable && "border-red-500",
        esquema.es_base && !inejecutable && "border-l-[3px] border-l-emerald-600",
        !esquema.activo && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{esquema.nombre}</h3>
          {esquema.es_base ? <Chip clase="bg-emerald-50 text-emerald-700 border-emerald-200">Base</Chip> : null}
          {esquema.es_contado ? <Chip>Contado</Chip> : null}
          <Chip>
            {esquema.tipo_esquema === "post_entrega" ? "Post-entrega" : "Preventa"}
          </Chip>
          {inejecutable ? (
            <Chip clase="border-red-200 bg-red-50 text-red-700">No ejecutable</Chip>
          ) : null}
        </div>
        {/* El activo/inactivo estaba enterrado en el menú de tres puntos, que es
            donde va lo que se usa poco. Es lo contrario: es la decisión de si el
            esquema se ofrece o no, y se toma seguido. Va a la vista. */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs",
              esquema.activo ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {esquema.activo ? "Se ofrece" : "No se ofrece"}
          </span>
          <Switch
            checked={esquema.activo}
            onCheckedChange={onAlternarActivo}
            aria-label={`${esquema.activo ? "Dejar de ofrecer" : "Volver a ofrecer"} ${esquema.nombre}`}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Acciones del esquema">
              <EllipsisVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEditar}>Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={onMarcarBase} disabled={esquema.es_base || !esquema.activo}>
              Marcar como base
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicar}>Duplicar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {referencia && referencia.precio > 0 ? (
        <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Con {referencia.etiqueta} · {formatoMoneda(referencia.precio)}
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cifra
              titulo="Precio final"
              valor={formatoMoneda(referencia.precio * (1 + esquema.pct_ajuste_manual))}
              nota={
                esquema.pct_ajuste_manual === 0
                  ? "igual al de lista"
                  : `${pct2(esquema.pct_ajuste_manual)} sobre lista`
              }
            />
            <Cifra
              titulo="Enganche"
              valor={formatoMoneda(
                referencia.precio * (1 + esquema.pct_ajuste_manual) * esquema.pct_enganche,
              )}
              nota={`${pct2(esquema.pct_enganche)} en ${esquema.meses_enganche} exhibición${esquema.meses_enganche === 1 ? "" : "es"}`}
            />
            <Cifra
              titulo="Mensualidad"
              valor={
                esquema.num_mensualidades > 0
                  ? formatoMoneda(
                      (referencia.precio *
                        (1 + esquema.pct_ajuste_manual) *
                        esquema.pct_mensualidades) /
                        esquema.num_mensualidades,
                    )
                  : "—"
              }
              nota={
                esquema.num_mensualidades > 0
                  ? `${esquema.num_mensualidades} meses${esquema.escalonadas ? " · escalonadas" : ""}`
                  : "sin mensualidades"
              }
            />
            <Cifra
              titulo="Pago a entrega"
              valor={formatoMoneda(
                referencia.precio * (1 + esquema.pct_ajuste_manual) * esquema.pct_entrega,
              )}
              nota={`${pct2(esquema.pct_entrega)} al escriturar`}
            />
          </div>
          {esquema.escalonadas && esquema.num_mensualidades > 0 ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              La mensualidad mostrada es el promedio: al ser escalonadas, las primeras son
              menores y las últimas mayores.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted-foreground">Composición</p>
          <dl className="space-y-1 text-sm tabular-nums">
            <Linea
              etiqueta="Enganche"
              valor={pct2(esquema.pct_enganche)}
              nota={`en ${esquema.meses_enganche} ${esquema.meses_enganche === 1 ? "exhibición" : "exhibiciones"}`}
            />
            <Linea
              etiqueta="Mensualidades"
              valor={pct2(esquema.pct_mensualidades)}
              nota={`en ${esquema.num_mensualidades} meses`}
            />
            <Linea
              etiqueta="Entrega"
              valor={pct2(esquema.pct_entrega)}
              nota={`mes ${vpn.horizonte_meses}`}
            />
            <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold">
              <span>Total</span>
              <span className={cn(!sumaOk && "text-red-600")}>{pct2(suma)}</span>
            </div>
          </dl>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-muted-foreground">Valor presente</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {factor4(multi ? (factorPonderadoProyecto ?? vpn.factor_vpn) : vpn.factor_vpn)}
          </p>
          <p className="text-xs text-muted-foreground">
            {multi ? "Factor de VPN ponderado" : "Factor de VPN"}
          </p>
          {multi ? (
            <>
              <table className="mt-2 w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="font-medium">Torre</th>
                    <th className="text-right font-medium">Horizonte</th>
                    <th className="text-right font-medium">Factor</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleTorres!.map((t) => (
                    <tr key={t.id_torre} className="border-t border-border/60">
                      <td className="py-1 pr-2">
                        {t.nombre}
                        {!t.ejecutable ? (
                          <span className="ml-1 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                            No ejecutable
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1 pr-2 text-right">{t.horizonte} m</td>
                      <td className="py-1 text-right">{factor4(t.factor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ponderadoParcial ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Ponderado sobre las torres donde el esquema es ejecutable.
                </p>
              ) : null}
            </>
          ) : null}
          <dl className="mt-3 space-y-1 text-sm tabular-nums">
            <Linea
              etiqueta="Plazo promedio ponderado"
              valor={`${vpn.plazo_promedio_ponderado.toFixed(1)} meses`}
            />
            <Linea
              etiqueta="VPN con ajuste aplicado"
              valor={factor4(vpn.factor_vpn_con_ajuste)}
            />
          </dl>
        </div>

        <div className={cn(inejecutable && "opacity-40")}>
          <p className="mb-2 text-[13px] font-medium text-muted-foreground">Política comercial</p>
          <dl className="space-y-1 text-sm tabular-nums">
            <Linea etiqueta="Ajuste aplicado hoy" valor={pctFirmado(esquema.pct_ajuste_manual)} />
            <Linea
              etiqueta="Ajuste que justifica el VPN"
              valor={esquema.es_base || inejecutable ? "—" : pctFirmado(vpn.ajuste_equivalente)}
            />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Brecha</span>
              {esquema.es_base || inejecutable ? (
                <span>—</span>
              ) : (
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs tabular-nums",
                    claseBrecha(vpn.brecha_politica),
                  )}
                >
                  {puntos(vpn.brecha_politica)}
                </span>
              )}
            </div>
            <Linea
              etiqueta="Descuento máx. autorizable"
              valor={inejecutable ? "—" : pct2(maxDesc)}
            />
          </dl>
          {!inejecutable && vpn.descuento_max_autorizable < 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Este esquema no admite descuento: requiere sobreprecio de{" "}
              {pct2(-vpn.descuento_max_autorizable)} para igualar el objetivo.
            </p>
          ) : null}
        </div>
      </div>

      {vpn.advertencias.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          {vpn.advertencias.map((a) => {
            const Icono = a.codigo === "PLAZO_POR_VENCER" ? Clock : ICONO[a.severidad];
            return (
              <div key={a.codigo} className="flex items-start gap-2 text-sm">
                <Icono className={cn("mt-0.5 size-4 shrink-0", COLOR[a.severidad])} />
                <p className="flex-1 text-foreground">{a.mensaje}</p>
                <span className="font-mono text-[11px] text-muted-foreground">{a.codigo}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setAbierto((v) => !v)}>
          <CalendarDays className="size-4" />
          {abierto ? "Ocultar calendario" : "Ver calendario"}
        </Button>
      </div>

      {abierto ? (
        <div className="mt-4 grid gap-6 border-t border-border pt-4 lg:grid-cols-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Mes</th>
                  <th className="py-1.5 pr-2 font-medium">Concepto</th>
                  <th className="py-1.5 pr-2 text-right font-medium">% del precio</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Factor</th>
                  <th className="py-1.5 text-right font-medium">Valor presente</th>
                </tr>
              </thead>
              <tbody>
                {vpn.flujos
                  .filter((f) => Math.abs(f.pct) > 1e-9)
                  .map((f, i) => (
                    <tr key={`${f.mes}-${i}`} className="border-b border-border/60">
                      <td className="py-1.5 pr-2">{f.mes}</td>
                      <td className="py-1.5 pr-2 capitalize">{f.concepto}</td>
                      <td className="py-1.5 pr-2 text-right">{pct2(f.pct)}</td>
                      <td className="py-1.5 pr-2 text-right">
                        {(f.factor_descuento ?? 0).toFixed(6)}
                      </td>
                      <td className="py-1.5 text-right">
                        {(f.valor_presente ?? 0).toFixed(6)}
                      </td>
                    </tr>
                  ))}
                <tr className="bg-muted/50 font-semibold">
                  <td className="py-1.5 pr-2" colSpan={2}>
                    Total
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {pct2(vpn.flujos.reduce((a, f) => a + f.pct, 0))}
                  </td>
                  <td />
                  <td className="py-1.5 text-right">{vpn.factor_vpn.toFixed(6)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <GraficoCalendario flujos={vpn.flujos} horizonte={vpn.horizonte_meses} />
        </div>
      ) : null}
    </Card>
  );
}

function Chip({ children, clase }: { children: React.ReactNode; clase?: string }) {
  return (
    <span
      className={cn(
        "rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground",
        clase,
      )}
    >
      {children}
    </span>
  );
}

/** Un dato del bloque en pesos: monto grande, contexto abajo. */
function Cifra({
  titulo,
  valor,
  nota,
}: {
  titulo: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{titulo}</p>
      <p className="text-base font-semibold tabular-nums text-foreground">{valor}</p>
      {nota ? <p className="text-[11px] text-muted-foreground">{nota}</p> : null}
    </div>
  );
}

function Linea({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="flex items-baseline gap-2">
        <span className="font-medium text-foreground">{valor}</span>
        {nota ? <span className="text-xs text-muted-foreground">{nota}</span> : null}
      </span>
    </div>
  );
}
