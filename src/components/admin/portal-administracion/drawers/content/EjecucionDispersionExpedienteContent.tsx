import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  DollarSign,
  Building2,
  Home,
  Ruler,
  User,
  Users,
  FileText,
  Receipt,
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Section, KV } from "./_shared";
import { useExpedienteVentaDetalle } from "@/hooks/useExpedienteVentaDetalle";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type EstadoComisionista = "aprobado" | "pagada" | "rechazado" | "en_espera";

export interface EjecucionDispersionExpedienteEntity {
  folio_cuenta: string;
  id_cuenta_cobranza: number;
}

const ESTADO_LABEL: Record<EstadoComisionista, string> = {
  aprobado: "Aprobado",
  pagada: "Pagada",
  rechazado: "Rechazado",
  en_espera: "En espera",
};

const ESTADO_TONE: Record<EstadoComisionista, string> = {
  aprobado:
    "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
  pagada:
    "border-blue-400 text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40",
  rechazado:
    "border-red-400 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40",
  en_espera:
    "border-amber-400 text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40",
};

export function EjecucionDispersionExpedienteContent({
  entity,
  onClose,
}: {
  entity: EjecucionDispersionExpedienteEntity;
  onClose: () => void;
}) {
  const { data: detalle, isLoading, error } = useExpedienteVentaDetalle(entity.folio_cuenta);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmando, setConfirmando] = useState<string | null>(null);

  // Detección de rechazos: logs_actividad con workflow=rechazar_dispersion_comision_interna
  // y nuevo_valor.id_cuenta_cobranza = esta cuenta. El email rechazado vive en
  // nuevo_valor.email_usuario.
  const { data: rechazos = [] } = useQuery({
    queryKey: ["dispersion_interna_rechazos", entity.id_cuenta_cobranza],
    queryFn: async () => {
      const { data, error: e } = await (supabase as any)
        .from("logs_actividad")
        .select("nuevo_valor")
        .eq("workflow", "rechazar_dispersion_comision_interna")
        .contains("nuevo_valor", { id_cuenta_cobranza: entity.id_cuenta_cobranza });
      if (e) throw e;
      const emails = new Set<string>();
      ((data ?? []) as Array<{ nuevo_valor: any }>).forEach((r) => {
        const email = r.nuevo_valor?.email_usuario;
        if (typeof email === "string") emails.add(email);
      });
      return Array.from(emails);
    },
    staleTime: 60_000,
  });
  const rechazoSet = useMemo(() => new Set(rechazos), [rechazos]);

  const internos = useMemo(
    () => (detalle?.comisionistas ?? []).filter((c) => !c.es_externo),
    [detalle],
  );
  const externos = useMemo(
    () => (detalle?.comisionistas ?? []).filter((c) => c.es_externo),
    [detalle],
  );

  const estadoDe = (c: { email: string; aprobada: boolean; pagada: boolean }): EstadoComisionista => {
    if (c.pagada) return "pagada";
    if (c.aprobada) return "aprobado";
    if (rechazoSet.has(c.email)) return "rechazado";
    return "en_espera";
  };

  const totalDispersar = useMemo(
    () => internos.reduce((s, c) => s + c.monto, 0),
    [internos],
  );
  const montoAprobadoPendiente = useMemo(
    () =>
      internos
        .filter((c) => estadoDe(c) === "aprobado")
        .reduce((s, c) => s + c.monto, 0),
    [internos, rechazoSet],
  );

  const ejecutarDispersionMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error: e } = await (supabase as any)
        .from("comisionistas")
        .update({
          pagada: true,
          fecha_pago_comision: new Date().toISOString(),
        })
        .eq("id_cuenta_cobranza", entity.id_cuenta_cobranza)
        .eq("activo", true)
        .eq("aprobada", true)
        .eq("email_usuario", email);
      if (e) throw e;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["expediente_venta_detalle", entity.folio_cuenta],
      });
      queryClient.invalidateQueries({ queryKey: ["dispersiones_internas_pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["comisiones_internas_alta_direccion"] });
      toast({
        title: "Dispersión ejecutada",
        description: "Comisionista marcado como pagado.",
      });
      setConfirmando(null);
    },
    onError: (err: unknown) => {
      toast({
        title: "Error al ejecutar dispersión",
        description: err instanceof Error ? err.message : "No se pudo ejecutar.",
        variant: "destructive",
      });
      setConfirmando(null);
    },
  });

  // Bulk: paga a todos los comisionistas internos aprobados y aún no
  // pagados en un solo UPDATE. `eq("aprobada", true).eq("pagada", false)`
  // garantiza que no toquemos en_espera ni rechazados (aprobada=false),
  // ni dupliquemos pagos sobre comisionistas ya pagados.
  const [confirmandoTodos, setConfirmandoTodos] = useState(false);
  const ejecutarTodosMutation = useMutation({
    mutationFn: async () => {
      const { error: e } = await (supabase as any)
        .from("comisionistas")
        .update({
          pagada: true,
          fecha_pago_comision: new Date().toISOString(),
        })
        .eq("id_cuenta_cobranza", entity.id_cuenta_cobranza)
        .eq("activo", true)
        .eq("aprobada", true)
        .eq("pagada", false);
      if (e) throw e;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["expediente_venta_detalle", entity.folio_cuenta],
      });
      queryClient.invalidateQueries({ queryKey: ["dispersiones_internas_pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["comisiones_internas_alta_direccion"] });
      toast({
        title: "Dispersión ejecutada",
        description: "Todos los comisionistas aprobados quedaron marcados como pagados.",
      });
      setConfirmandoTodos(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Error al ejecutar dispersión",
        description: err instanceof Error ? err.message : "No se pudo ejecutar.",
        variant: "destructive",
      });
      setConfirmandoTodos(false);
    },
  });

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando expediente…
      </div>
    );
  }

  if (error || !detalle) {
    return (
      <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
        {error
          ? `Error: ${(error as Error).message}`
          : "No se encontró información de esta cuenta."}
      </div>
    );
  }

  const comprador = detalle.compradores[0];

  return (
    <div className="space-y-6">
      {/* ─── Resumen ─── */}
      <Section
        title="Resumen de la venta"
        body={
          <p className="text-sm text-foreground leading-relaxed">
            Venta cerrada hace{" "}
            <span className="font-semibold">{detalle.dias_desde_compra} días</span>.
            Receptor (desarrollador):{" "}
            <span className="font-semibold">{detalle.propietario || "—"}</span>.
            SOZU debe dispersar{" "}
            <span className="font-semibold tabular-nums">{fmtMxn(totalDispersar)}</span> al equipo
            interno asociado ({fmtMxn(montoAprobadoPendiente)} aprobado pendiente).
          </p>
        }
      >
        <div className="grid grid-cols-2 gap-3 mt-3">
          <KV
            icon={Calendar}
            label="Fecha venta reconocida"
            value={detalle.fecha_compra || "—"}
          />
          <KV
            icon={Clock}
            label="Días esperando"
            value={`${detalle.dias_desde_compra} días`}
          />
          <KV
            icon={DollarSign}
            label="Comisión total SOZU"
            value={fmtMxn(detalle.comision_total_sozu)}
          />
          <KV
            icon={Building2}
            label="Desarrollador (Receptor)"
            value={detalle.propietario || "—"}
          />
        </div>
      </Section>

      {/* ─── Datos de la propiedad ─── */}
      <Section title="Datos de la propiedad">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Home} label="Proyecto" value={detalle.proyecto_nombre || "—"} />
          <KV icon={Home} label="Edificio" value={detalle.edificio_nombre || "—"} />
          <KV icon={Home} label="Modelo" value={detalle.modelo_nombre || "—"} />
          <KV icon={Home} label="No. Depto" value={detalle.numero_departamento || "—"} />
          <KV icon={Home} label="Tipo" value={detalle.tipo} />
          {detalle.tipo !== "Propiedad" && detalle.producto_nombre && (
            <KV icon={Home} label="Producto" value={detalle.producto_nombre} />
          )}
          <KV
            icon={Ruler}
            label="Metraje"
            value={detalle.metraje > 0 ? `${detalle.metraje.toFixed(2)} m²` : "—"}
          />
          <KV
            icon={DollarSign}
            label="Precio / m²"
            value={detalle.precio_m2 > 0 ? fmtMxn(detalle.precio_m2) : "—"}
          />
          <KV
            icon={DollarSign}
            label="Precio final"
            value={fmtMxn(detalle.precio_final)}
          />
        </div>
      </Section>

      {/* ─── Comprador ─── */}
      <Section title="Comprador">
        {detalle.compradores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin compradores registrados</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <KV icon={User} label="Nombre" value={comprador?.nombre || "—"} />
            <KV icon={Receipt} label="RFC" value={detalle.rfc_comprador || "—"} mono />
            {detalle.compradores.length > 1 && (
              <KV
                icon={Users}
                label="Copropietarios"
                value={detalle.compradores
                  .slice(1)
                  .map((c) => c.nombre)
                  .join(", ")}
              />
            )}
          </div>
        )}
      </Section>

      {/* ─── Comprobantes de pago del cliente ─── */}
      <Section title="Comprobantes de pago del cliente">
        <div className="space-y-2">
          {detalle.pago_apartado ? (
            <PagoRow
              etiqueta="Apartado"
              fecha={detalle.pago_apartado.fecha}
              monto={detalle.pago_apartado.monto}
              urlRecibo={detalle.pago_apartado.url_recibo}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Sin pago de apartado registrado</p>
          )}
          {detalle.pago_enganche ? (
            <PagoRow
              etiqueta="Enganche"
              fecha={detalle.pago_enganche.fecha}
              monto={detalle.pago_enganche.monto}
              urlRecibo={detalle.pago_enganche.url_recibo}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Sin pago de enganche registrado</p>
          )}
        </div>
      </Section>

      {/* ─── Documentos ─── */}
      <Section title="Documentos">
        <div className="space-y-2">
          <DocRow
            label="Contrato firmado completamente"
            url={detalle.url_contrato_firmado}
            estado={detalle.url_contrato_firmado ? "Disponible" : "Pendiente"}
          />
          <DocRow
            label="Factura SOZU al desarrollador"
            url={detalle.url_factura_sozu}
            estado={
              detalle.factura_sozu_estado === "timbrada"
                ? "Timbrada"
                : detalle.factura_sozu_estado === "draft"
                  ? "Draft"
                  : "Sin generar"
            }
            extraUrl={detalle.url_factura_xml_sozu}
            extraLabel="XML"
          />
          {externos.length > 0 && (
            <DocRow
              label={`Factura ${
                externos[0].nombre || "Agente externo / Inmobiliaria"
              }`}
              url={detalle.url_factura_externa}
              estado={detalle.url_factura_externa ? "Recibida" : "Pendiente"}
              footer={detalle.numero_factura_externa ?? undefined}
            />
          )}
        </div>
      </Section>

      {/* ─── Comisionistas internos ─── */}
      <Section
        title="Comisionistas internos"
        body={
          internos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay comisionistas internos asignados a esta cuenta.
            </p>
          ) : null
        }
      >
        {internos.length > 0 && (
          <>
            {/* Totales de la dispersión — desglose % total y monto total
                que se va a dispersar al equipo interno, más el monto ya
                pagado (informativo) y el aprobado pendiente (lo accionable). */}
            {(() => {
              const pctTotal = internos.reduce((s, c) => s + c.porcentaje, 0);
              const pagadoTotal = internos
                .filter((c) => estadoDe(c) === "pagada")
                .reduce((s, c) => s + c.monto, 0);
              const aprobadosPendientes = internos.filter(
                (c) => estadoDe(c) === "aprobado",
              );
              const isPendingBulk = ejecutarTodosMutation.isPending;
              return (
                <div className="mb-3 rounded-md border bg-muted/30 px-3 py-2 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Total a dispersar ({internos.length}{" "}
                      {internos.length === 1 ? "comisionista" : "comisionistas"})
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {pctTotal.toFixed(2)}% · {fmtMxn(totalDispersar)}
                    </span>
                  </div>
                  {(montoAprobadoPendiente > 0 || pagadoTotal > 0) && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Aprobado pendiente · Pagado
                      </span>
                      <span className="tabular-nums">
                        <span className="text-amber-700 dark:text-amber-300 font-medium">
                          {fmtMxn(montoAprobadoPendiente)}
                        </span>
                        {" · "}
                        <span className="text-blue-700 dark:text-blue-300 font-medium">
                          {fmtMxn(pagadoTotal)}
                        </span>
                      </span>
                    </div>
                  )}
                  {/* CTA bulk — sólo cuando hay >=2 aprobados pendientes
                      para evitar duplicar el flujo per-fila. La acción
                      paga a todos los aprobados en un solo UPDATE. */}
                  {aprobadosPendientes.length >= 2 && (
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/60">
                      <span className="text-xs text-muted-foreground">
                        {aprobadosPendientes.length} comisionistas aprobados sin
                        dispersar
                      </span>
                      {confirmandoTodos ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            className="h-7 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={isPendingBulk}
                            onClick={() => ejecutarTodosMutation.mutate()}
                          >
                            {isPendingBulk ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Ejecutando…
                              </>
                            ) : (
                              `Sí, dispersar ${fmtMxn(montoAprobadoPendiente)}`
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px] px-2"
                            disabled={isPendingBulk}
                            onClick={() => setConfirmandoTodos(false)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2 border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          onClick={() => setConfirmandoTodos(true)}
                          disabled={
                            ejecutarDispersionMutation.isPending || isPendingBulk
                          }
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Ejecutar dispersión a todos
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <ul className="space-y-2">
              {internos.map((c) => {
              const estado = estadoDe(c);
              const puedeEjecutar = estado === "aprobado";
              const enConfirmacion = confirmando === c.email;
              const isPending =
                ejecutarDispersionMutation.isPending &&
                ejecutarDispersionMutation.variables === c.email;
              return (
                <li
                  key={c.email}
                  className={cn(
                    "border rounded-md p-3 bg-card",
                    estado === "aprobado" && "border-emerald-300",
                    estado === "pagada" && "border-blue-300 bg-blue-50/30 dark:bg-blue-950/15",
                    estado === "rechazado" && "border-red-300 bg-red-50/30 dark:bg-red-950/15",
                    estado === "en_espera" && "border-amber-200",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground">{c.rol}</p>
                      <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                        {c.porcentaje.toFixed(2)}% · {fmtMxn(c.monto)}
                      </p>
                      <div className="mt-2">
                        <Badge variant="outline" className={cn("text-[10px]", ESTADO_TONE[estado])}>
                          {estado === "pagada" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {estado === "rechazado" && <XCircle className="h-3 w-3 mr-1" />}
                          {ESTADO_LABEL[estado]}
                        </Badge>
                      </div>
                    </div>
                    {puedeEjecutar && (
                      <div className="shrink-0">
                        {enConfirmacion ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              className="h-7 text-[10px] px-2"
                              disabled={isPending}
                              onClick={() => ejecutarDispersionMutation.mutate(c.email)}
                            >
                              {isPending ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Ejecutando…
                                </>
                              ) : (
                                "Sí, confirmar"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] px-2"
                              disabled={isPending}
                              onClick={() => setConfirmando(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] px-2 border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={() => setConfirmando(c.email)}
                            disabled={ejecutarTodosMutation.isPending}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Ejecutar dispersión
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            </ul>
          </>
        )}
      </Section>

      {/* ─── Footer ─── */}
      <div className="border-t pt-3 flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}

/* ────────── helpers locales ────────── */

function PagoRow({
  etiqueta,
  fecha,
  monto,
  urlRecibo,
}: {
  etiqueta: string;
  fecha: string;
  monto: number;
  urlRecibo: string | null;
}) {
  return (
    <div className="flex items-center justify-between text-sm border border-border rounded-md px-3 py-2 bg-card">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{etiqueta}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{fecha}</p>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold tabular-nums">{fmtMxn(monto)}</p>
        {urlRecibo && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[10px] px-2"
            title="Ver comprobante"
            onClick={() => window.open(urlRecibo, "_blank")}
          >
            <FileText className="h-3 w-3 mr-1" />
            Recibo
          </Button>
        )}
      </div>
    </div>
  );
}

function DocRow({
  label,
  url,
  estado,
  extraUrl,
  extraLabel,
  footer,
}: {
  label: string;
  url: string | null;
  estado: string;
  extraUrl?: string | null;
  extraLabel?: string;
  footer?: string;
}) {
  const isAvailable = !!url;
  return (
    <div className="flex items-center justify-between text-sm border border-border rounded-md px-3 py-2 bg-card">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] mt-0.5",
            isAvailable
              ? "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
              : "text-muted-foreground",
          )}
        >
          {estado}
        </Badge>
        {footer && (
          <p className="text-[10px] font-mono text-muted-foreground mt-1">{footer}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {url && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[10px] px-2"
            title="Ver documento"
            onClick={() => window.open(url, "_blank")}
          >
            <FileText className="h-3 w-3 mr-1" />
            Ver
          </Button>
        )}
        {extraUrl && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[10px] px-2"
            title="Descargar"
            onClick={() => window.open(extraUrl, "_blank")}
          >
            {extraLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
