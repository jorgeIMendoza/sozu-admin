import {
  Building2,
  Calendar,
  Clock,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Home,
  Ruler,
  User,
  FileText,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DrawerActionFooter, type DrawerAction } from "../DrawerActionFooter";
import { Section, KV, Timeline, TimelineItem, StatusCard } from "./_shared";
import type { PagoExternoEntity, VentaContext } from "../types";
import { useExpedienteVentaDetalle } from "@/hooks/useExpedienteVentaDetalle";
import { OfertaPdfEdgeFunctionService } from "@/services/offerPdfEdgeFunctionService";
import { supabase } from "@/integrations/supabase/client";

const TIPO_LABEL: Record<PagoExternoEntity["beneficiario_tipo"], string> = {
  inmobiliaria: "Inmobiliaria",
  broker: "Broker",
  aliado_comercial: "Aliado comercial",
  agente_externo: "Agente externo",
};

export function PagoExternoContent({
  entity,
  onClose,
  readOnly = false,
  ctaButton,
}: {
  entity: PagoExternoEntity;
  ventaContext: VentaContext;
  onClose: () => void;
  /** Cuando true, oculta acciones Bloquear/Autorizar y muestra solo info + opcional CTA. */
  readOnly?: boolean;
  /** Botón CTA al final del drawer (solo se renderiza si readOnly). */
  ctaButton?: { label: string; onClick: () => void };
}) {
  const cobroConfirmado = entity.ya_se_cobro_al_desarrollador;
  const queryClient = useQueryClient();
  const { data: detalle, isLoading, error } = useExpedienteVentaDetalle(
    entity.folio_cuenta || entity.folio_cfdi,
  );
  const [generandoOferta, setGenerandoOferta] = useState(false);

  const autorizarMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("cuentas_cobranza")
        .update({
          estatus_autorizacion_comision_externa: "Autorizado",
          email_autoriza_comision_externa: user?.email ?? null,
          fecha_autorizacion_comision_externa: new Date().toISOString(),
        })
        .eq("id", entity.id_cuenta_cobranza!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bandeja-comisionistas-pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["comisiones-externas"] });
      toast.success("Pago autorizado correctamente.");
      onClose();
    },
    onError: (err: Error) => {
      toast.error(`Error al autorizar: ${err.message}`);
    },
  });

  const bloquearMutation = useMutation({
    mutationFn: async (note: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("cuentas_cobranza")
        .update({
          estatus_autorizacion_comision_externa: "Rechazado",
          notas_rechazo_comision_externa: note,
          email_autoriza_comision_externa: user?.email ?? null,
          fecha_autorizacion_comision_externa: new Date().toISOString(),
        })
        .eq("id", entity.id_cuenta_cobranza!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bandeja-comisionistas-pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["comisiones-externas"] });
      toast.success("Pago bloqueado. La nota fue guardada.");
      onClose();
    },
    onError: (err: Error) => {
      toast.error(`Error al bloquear: ${err.message}`);
    },
  });

  const handleGenerarOferta = async (idOferta: number) => {
    setGenerandoOferta(true);
    try {
      const service = new OfertaPdfEdgeFunctionService();
      await service.generateOfertaPdf({ offerId: idOferta });
    } finally {
      setGenerandoOferta(false);
    }
  };

  const isPending = autorizarMutation.isPending || bloquearMutation.isPending;

  // Actions condicionadas según flag de cobro previo
  const actions: DrawerAction[] = cobroConfirmado
    ? [
        {
          label: "Bloquear pago",
          variant: "destructive",
          requiresNote: true,
          disabled: isPending,
          skipDemoConfirmation: true,
          onClick: (note) => bloquearMutation.mutate(note),
        },
        {
          label: "Autorizar pago",
          variant: "primary",
          disabled: isPending,
          skipDemoConfirmation: true,
          onClick: () => autorizarMutation.mutate(),
        },
      ]
    : [
        {
          label: "Bloquear pago",
          variant: "destructive",
          disabled: isPending,
          skipDemoConfirmation: true,
          onClick: (note) => bloquearMutation.mutate(note),
        },
        {
          label: "Autorizar pago",
          variant: "primary",
          disabled: true,
          disabledReason: "Requiere confirmar cobro al desarrollador primero",
          onClick: () => {},
        },
      ];

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando expediente…
      </div>
    );
  }

  const comprador = detalle?.compradores[0];

  return (
    <div className="space-y-6">
      {/* ─── Resumen de la venta ─── */}
      {detalle && (
        <Section
          title="Resumen de la venta"
          body={
            <p className="text-sm text-foreground leading-relaxed">
              Venta cerrada hace{" "}
              <span className="font-semibold">{detalle.dias_desde_compra} días</span>.
              Comisión total SOZU{" "}
              <span className="font-semibold tabular-nums">
                {fmtMxn(detalle.comision_total_sozu)}
              </span>{" "}
              al desarrollador{" "}
              <span className="font-semibold">{detalle.propietario || "—"}</span>.
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
      )}

      {/* ─── Datos de la propiedad ─── */}
      {detalle && (
        <Section title="Datos de la propiedad">
          <div className="grid grid-cols-2 gap-3">
            <KV icon={Home} label="Proyecto" value={detalle.proyecto_nombre || "—"} />
            <KV icon={Home} label="Edificio" value={detalle.edificio_nombre || "—"} />
            <KV icon={Home} label="Modelo" value={detalle.modelo_nombre || "—"} />
            <KV icon={Home} label="No. Depto" value={detalle.numero_departamento || "—"} />
            <KV icon={Home} label="Tipo" value={detalle.tipo} />
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
      )}

      {/* ─── Oferta comercial ─── */}
      {detalle && (
        <Section title="Oferta comercial">
          <div className="grid grid-cols-2 gap-3">
            <KV
              icon={DollarSign}
              label="Precio final"
              value={fmtMxn(detalle.oferta_comercial.precio_final)}
            />
            <KV
              icon={DollarSign}
              label="Ahorro"
              value={
                detalle.oferta_comercial.ahorro > 0
                  ? fmtMxn(detalle.oferta_comercial.ahorro)
                  : "—"
              }
            />
            <KV
              icon={DollarSign}
              label="Enganche"
              value={
                detalle.oferta_comercial.enganche > 0
                  ? fmtMxn(detalle.oferta_comercial.enganche)
                  : "—"
              }
            />
            <KV
              icon={DollarSign}
              label="Mensualidades"
              value={
                detalle.oferta_comercial.parcialidades_total > 0
                  ? `${fmtMxn(detalle.oferta_comercial.parcialidades_total)} (${
                      detalle.oferta_comercial.parcialidades_count
                    } pagos)`
                  : "—"
              }
            />
            <KV
              icon={DollarSign}
              label="A la entrega"
              value={
                detalle.oferta_comercial.a_la_entrega > 0
                  ? fmtMxn(detalle.oferta_comercial.a_la_entrega)
                  : "—"
              }
            />
            <KV
              icon={DollarSign}
              label="Apartado"
              value={
                detalle.oferta_comercial.apartado > 0
                  ? fmtMxn(detalle.oferta_comercial.apartado)
                  : "—"
              }
            />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Documento oferta
              </p>
              <p className="text-sm font-mono text-foreground">
                {detalle.oferta_comercial.folio_oferta || "Sin folio"}
              </p>
            </div>
            {detalle.oferta_comercial.id_oferta ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={generandoOferta}
                onClick={async () => {
                  if (detalle.oferta_comercial.url_oferta) {
                    window.open(detalle.oferta_comercial.url_oferta, "_blank");
                  } else {
                    await handleGenerarOferta(detalle.oferta_comercial.id_oferta!);
                  }
                }}
              >
                {generandoOferta ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Generando…
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Ver oferta
                  </>
                )}
              </Button>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                Sin oferta vinculada
              </span>
            )}
          </div>
        </Section>
      )}

      {/* ─── Comprador ─── */}
      {detalle && detalle.compradores.length > 0 && (
        <Section title="Comprador">
          <div className="grid grid-cols-2 gap-3">
            <KV icon={User} label="Nombre" value={comprador?.nombre || "—"} />
            <KV
              icon={Receipt}
              label="RFC"
              value={detalle.rfc_comprador || "—"}
              mono
            />
          </div>
        </Section>
      )}

      {/* ─── Documentos ─── */}
      {detalle && (
        <Section title="Documentos">
          <div className="flex items-center justify-between text-sm border border-border rounded-md px-3 py-2 bg-card">
            <div className="min-w-0">
              <p className="font-medium text-foreground">Contrato firmado completamente</p>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] mt-0.5",
                  detalle.url_contrato_firmado
                    ? "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
                    : "text-muted-foreground",
                )}
              >
                {detalle.url_contrato_firmado ? "Disponible" : "Pendiente"}
              </Badge>
            </div>
            {detalle.url_contrato_firmado && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px] px-2"
                onClick={() => window.open(detalle.url_contrato_firmado!, "_blank")}
              >
                <FileText className="h-3 w-3 mr-1" />
                Ver
              </Button>
            )}
          </div>
        </Section>
      )}

      {/* ─── Datos de la factura recibida ─── */}
      <Section title="Datos de la factura recibida">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Receipt} label="Folio CFDI" value={entity.folio_cfdi} mono />
          <KV icon={Building2} label="Beneficiario" value={entity.beneficiario_nombre} />
          <KV
            icon={Receipt}
            label="Tipo"
            value={TIPO_LABEL[entity.beneficiario_tipo]}
          />
          <KV
            icon={Receipt}
            label="RFC"
            value={entity.beneficiario_rfc || "—"}
            mono
          />
          <KV icon={Calendar} label="Emisión" value={entity.fecha_emision} />
          <KV
            icon={Clock}
            label="Antigüedad"
            value={`${entity.dias_desde_emision} días`}
          />
        </div>
        <div className="mt-3 rounded-md border border-border bg-card p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Monto a pagar
          </span>
          <span className="text-xl font-bold tabular-nums">{fmtMxn(entity.monto)}</span>
        </div>
        {/* Visualización del PDF de la factura recibida */}
        <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Visualización de la factura
            </p>
            <p className="text-sm text-foreground">
              PDF cargado por {entity.beneficiario_nombre}
            </p>
          </div>
          {entity.url_factura_externa ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => window.open(entity.url_factura_externa!, "_blank")}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Ver factura
            </Button>
          ) : (
            <span className="text-[10px] text-muted-foreground">PDF no disponible</span>
          )}
        </div>
      </Section>

      {/* ─── Estado de cobro previo ─── */}
      <Section title="Estado de cobro previo">
        {cobroConfirmado ? (
          <StatusCard
            tone="success"
            icon={CheckCircle2}
            title="Cobro al desarrollador confirmado"
            body={
              <>
                {entity.factura_cobrar_referencia ? (
                  <>
                    Factura{" "}
                    <span className="font-mono">{entity.factura_cobrar_referencia}</span>{" "}
                    cobrada.
                  </>
                ) : (
                  "Cobro reconocido."
                )}{" "}
                Pago a este externo está habilitado.
              </>
            }
          />
        ) : (
          <StatusCard
            tone="warning"
            icon={AlertTriangle}
            title="Cobro al desarrollador aún pendiente"
            body={
              <>
                {entity.factura_cobrar_referencia ? (
                  <>
                    {entity.factura_cobrar_referencia} emitida hace{" "}
                    {entity.factura_cobrar_emitida_dias ?? "—"} días.{" "}
                  </>
                ) : null}
                SOZU no debe pagar a este externo hasta confirmar cobro — riesgo de
                financiamiento involuntario.
              </>
            }
          />
        )}
      </Section>

      {/* ─── Actividad reciente ─── */}
      <Section title="Actividad reciente">
        <Timeline>
          <TimelineItem
            label={cobroConfirmado ? "Pago habilitado" : "Esperando cobro al desarrollador"}
            meta={
              cobroConfirmado
                ? "Factura del desarrollador liquidada"
                : "Capa B sin ejecutar · bloqueo automático"
            }
            tone={cobroConfirmado ? "success" : "warning"}
          />
          <TimelineItem
            label="Factura recibida del externo"
            meta={`${entity.fecha_emision} · ${entity.folio_cfdi} · ${fmtMxn(entity.monto)}`}
          />
          {detalle && (
            <TimelineItem
              label="Comisión externa devengada"
              meta={`${detalle.folio} · ${detalle.propiedad_label || detalle.proyecto_nombre}`}
              tone="success"
            />
          )}
        </Timeline>
      </Section>

      {error && (
        <div className="text-xs text-amber-700 dark:text-amber-300">
          No se pudo cargar el detalle del expediente: {(error as Error).message}
        </div>
      )}

      {/* ─── Estatus de pago al externo ─── */}
      {entity.estatus_pago && (
        <Section title="Estatus de pago">
          <EstatusPagoExternoBanner
            estatus={entity.estatus_pago}
            fechaPago={entity.fecha_pago ?? null}
          />
        </Section>
      )}

      {/* Acciones de Bandeja (Bloquear/Autorizar) sólo si no es readonly y el pago está en proceso */}
      {!readOnly &&
        (!entity.estatus_pago ||
          entity.estatus_pago === "espera_autorizacion" ||
          entity.estatus_pago === "autorizada") && (
          <DrawerActionFooter
            onCancel={onClose}
            notePlaceholder="Notas sobre el pago (requeridas si se bloquea con cobro confirmado)…"
            actions={actions}
          />
        )}

      {/* CTA en modo readOnly (ej. Ir a Bandeja de Validaciones) */}
      {readOnly && ctaButton && (
        <div className="border-t border-border pt-4 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          <Button size="sm" onClick={ctaButton.onClick}>
            {ctaButton.label}
          </Button>
        </div>
      )}
    </div>
  );
}

function EstatusPagoExternoBanner({
  estatus,
  fechaPago,
}: {
  estatus: "espera_autorizacion" | "autorizada" | "pagada" | "rechazada";
  fechaPago: string | null;
}) {
  const cfg = {
    espera_autorizacion: {
      label: "Espera Autorización",
      tone: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-200",
      text: "El pago al externo está pendiente de autorización del Director.",
    },
    autorizada: {
      label: "Autorizada",
      tone: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900/40 text-violet-800 dark:text-violet-200",
      text: "Autorizada por Dirección — pago al externo en proceso.",
    },
    pagada: {
      label: "Pagada",
      tone: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-200",
      text: fechaPago
        ? `Pago al externo realizado el ${fechaPago}. No requiere acción adicional.`
        : "Pago al externo realizado. No requiere acción adicional.",
    },
    rechazada: {
      label: "Rechazada",
      tone: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-200",
      text: "Pago al externo rechazado. Revisar motivo en la actividad reciente.",
    },
  }[estatus];

  return (
    <div className={`rounded-md border px-3 py-2.5 ${cfg.tone}`}>
      <p className="text-sm font-semibold">{cfg.label}</p>
      <p className="text-xs mt-0.5">{cfg.text}</p>
    </div>
  );
}
