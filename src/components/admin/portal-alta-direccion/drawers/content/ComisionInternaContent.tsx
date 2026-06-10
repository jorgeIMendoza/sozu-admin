import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Check,
  X,
} from "lucide-react";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Section, KV } from "./_shared";
import type { VentaContext } from "../types";
import { useExpedienteVentaDetalle } from "@/hooks/useExpedienteVentaDetalle";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useAuth } from "@/contexts/AuthContext";

type Decision = "pendiente" | "aprobado" | "rechazado";

export interface ComisionInternaDrawerEntity {
  folio_cuenta: string;
}

export function ComisionInternaContent({
  entity,
  onClose,
  readOnly = false,
  ctaButton,
}: {
  entity: ComisionInternaDrawerEntity;
  ventaContext: VentaContext;
  onClose: () => void;
  /** Cuando true, oculta los controles Aprobar/Rechazar individuales y el Guardar global. */
  readOnly?: boolean;
  /** Botón CTA al final del drawer cuando readOnly. */
  ctaButton?: { label: string; onClick: () => void };
}) {
  const { data: detalle, isLoading, error } = useExpedienteVentaDetalle(entity.folio_cuenta);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { registrarActualizacion } = useActivityLogger();
  const { user } = useAuth();

  // Decisión individual por comisionista (email como key)
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [editandoNota, setEditandoNota] = useState<string | null>(null);

  const internos = useMemo(
    () => (detalle?.comisionistas ?? []).filter((c) => !c.es_externo),
    [detalle],
  );
  const externos = useMemo(
    () => (detalle?.comisionistas ?? []).filter((c) => c.es_externo),
    [detalle],
  );

  const totalDispersar = useMemo(
    () => internos.reduce((s, c) => s + c.monto, 0),
    [internos],
  );

  const setDecision = (email: string, d: Decision) =>
    setDecisiones((prev) => ({ ...prev, [email]: d }));

  const aprobarTodos = () => {
    const nuevas: Record<string, Decision> = {};
    internos.forEach((c) => (nuevas[c.email] = "aprobado"));
    setDecisiones((prev) => ({ ...prev, ...nuevas }));
  };

  const rechazarTodos = () => {
    const nuevas: Record<string, Decision> = {};
    internos.forEach((c) => (nuevas[c.email] = "rechazado"));
    setDecisiones((prev) => ({ ...prev, ...nuevas }));
  };

  const limpiarDecisiones = () => {
    setDecisiones({});
    setNotas({});
    setEditandoNota(null);
  };

  const resumen = useMemo(() => {
    let aprobados = 0;
    let rechazados = 0;
    let pendientes = 0;
    internos.forEach((c) => {
      const d = decisiones[c.email] ?? "pendiente";
      if (d === "aprobado") aprobados++;
      else if (d === "rechazado") rechazados++;
      else pendientes++;
    });
    return { aprobados, rechazados, pendientes };
  }, [internos, decisiones]);

  const puedeGuardar =
    internos.length > 0 &&
    resumen.pendientes === 0 &&
    internos.every((c) => {
      const d = decisiones[c.email];
      if (d !== "rechazado") return true;
      return !!notas[c.email]?.trim();
    });

  const cuentaId = detalle?.id_cuenta_cobranza ?? null;
  const guardarMutation = useMutation({
    mutationFn: async () => {
      if (cuentaId == null) throw new Error("Cuenta no resuelta");
      const aprobados = internos.filter((c) => decisiones[c.email] === "aprobado");
      const rechazados = internos.filter((c) => decisiones[c.email] === "rechazado");

      // 1) Aprobados → marcar SOLO aprobada=true. La dispersión efectiva
      //    (pagada=true + fecha_pago_comision) la ejecuta el Portal de
      //    Administración en la bandeja "Dispersiones internas pendientes",
      //    permitiendo separar la autorización (Alta Dirección) del pago
      //    operativo (Admin).
      if (aprobados.length > 0) {
        const emails = aprobados.map((c) => c.email);
        const { error: errAp } = await (supabase as any)
          .from("comisionistas")
          .update({ aprobada: true })
          .eq("id_cuenta_cobranza", cuentaId)
          .eq("activo", true)
          .in("email_usuario", emails);
        if (errAp) throw errAp;
      }

      // 2) Rechazados → quitar aprobada=false y registrar razón en logs_actividad
      for (const c of rechazados) {
        const { error: errRj } = await (supabase as any)
          .from("comisionistas")
          .update({ aprobada: false })
          .eq("id_cuenta_cobranza", cuentaId)
          .eq("activo", true)
          .eq("email_usuario", c.email);
        if (errRj) throw errRj;

        await registrarActualizacion(
          "comisionistas",
          { id_cuenta_cobranza: cuentaId, email_usuario: c.email, aprobada: true },
          {
            id_cuenta_cobranza: cuentaId,
            email_usuario: c.email,
            aprobada: false,
            razon_rechazo: notas[c.email] || "",
          },
          "rechazar_dispersion_comision_interna",
        );
      }

      // 3) Persistir la decisión a nivel cuenta para que la Bandeja de
      //    Validaciones sepa si la fila debe seguir visible:
      //    - "Autorizado": todos los comisionistas internos aprobados →
      //      la fila debe DESAPARECER del listado de Alta Dirección.
      //    - "Rechazado": al menos un comisionista rechazado (parcial o
      //      total) → la fila PERMANECE visible con el badge actualizado.
      //    El DDL puede no estar aplicado todavía (ver
      //    Ejecuciones_manuales/autorizacion_comision_sozu.md); en ese caso
      //    PostgREST devuelve 42703 y silenciamos para no bloquear el flujo
      //    de aprobación, que sigue siendo válido en BD via `comisionistas`.
      const nuevoEstatus: "Autorizado" | "Rechazado" =
        rechazados.length === 0 ? "Autorizado" : "Rechazado";
      const notasRechazo = rechazados.length
        ? rechazados
            .map((c) => `${c.email}: ${notas[c.email] || "(sin nota)"}`)
            .join(" | ")
        : null;

      // Intentamos UPDATE escalonado: primero con todas las columnas auxiliares;
      // si alguna no existe (42703 — DDL parcial), reintentamos sólo con la
      // columna core `estatus_autorizacion_comision_interna`. Si esa tampoco
      // existe, silenciamos: el flujo en `comisionistas` ya quedó persistido.
      const updateCuenta = async (payload: Record<string, unknown>) =>
        await (supabase as any)
          .from("cuentas_cobranza")
          .update(payload)
          .eq("id", cuentaId);

      const payloadCompleto: Record<string, unknown> = {
        estatus_autorizacion_comision_interna: nuevoEstatus,
        fecha_autorizacion_comision_interna: new Date().toISOString(),
        email_autoriza_comision_interna: user?.email ?? null,
      };
      if (notasRechazo != null) {
        payloadCompleto.notas_rechazo_comision_interna = notasRechazo;
      }

      let respAuth = await updateCuenta(payloadCompleto);
      if (respAuth.error && respAuth.error.code === "42703") {
        // Reintento minimalista — sólo la columna core.
        respAuth = await updateCuenta({
          estatus_autorizacion_comision_interna: nuevoEstatus,
        });
      }
      if (respAuth.error && respAuth.error.code !== "42703") {
        throw respAuth.error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bandeja-comisionistas-pendientes"] });
      queryClient.invalidateQueries({
        queryKey: ["expediente_venta_detalle", entity.folio_cuenta],
      });
      queryClient.invalidateQueries({ queryKey: ["comisiones_internas_alta_direccion"] });
      // Tras aprobar, la cuenta debe aparecer en la bandeja "Dispersiones
      // internas pendientes" del Portal de Administración.
      queryClient.invalidateQueries({ queryKey: ["dispersiones_internas_pendientes"] });
      toast({
        title: "Decisiones guardadas",
        description: `${resumen.aprobados} aprobados · ${resumen.rechazados} rechazados.`,
      });
      onClose();
    },
    onError: (err: unknown) => {
      toast({
        title: "Error al guardar",
        description: pgErrorMessage(err) ?? "No se pudo guardar las decisiones.",
        variant: "destructive",
      });
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
            interno asociado.
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

      {/* ─── Comisionistas internos con acciones ─── */}
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
            {!readOnly && (
              <div className="flex items-center gap-2 mb-3">
                <Button size="sm" variant="outline" className="h-8" onClick={aprobarTodos}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Aprobar todos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={rechazarTodos}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Rechazar todos
                </Button>
                {(resumen.aprobados > 0 || resumen.rechazados > 0) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={limpiarDecisiones}
                  >
                    Limpiar selección
                  </Button>
                )}
              </div>
            )}

            {/* Totales de la dispersión (sumatoria de % y monto) — útiles
                para que Alta Dirección vea de un vistazo cuánto se va a
                dispersar al equipo interno y qué fracción del precio
                representa. */}
            <div className="mb-3 rounded-md border bg-muted/30 px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Total a dispersar ({internos.length}{" "}
                {internos.length === 1 ? "comisionista" : "comisionistas"})
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {internos.reduce((s, c) => s + c.porcentaje, 0).toFixed(2)}% ·{" "}
                {fmtMxn(totalDispersar)}
              </span>
            </div>

            <ul className="space-y-2">
              {internos.map((c) => {
                const decision: Decision = decisiones[c.email] ?? "pendiente";
                const editing = editandoNota === c.email;
                const requiereNota = decision === "rechazado";
                return (
                  <li
                    key={c.email}
                    className={cn(
                      "border rounded-md p-3 bg-card",
                      decision === "aprobado" &&
                        "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20",
                      decision === "rechazado" &&
                        "border-red-300 bg-red-50/40 dark:bg-red-950/20",
                      decision === "pendiente" && "border-border",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {c.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.rol}</p>
                        <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                          {c.porcentaje.toFixed(2)}% · {fmtMxn(c.monto)}
                        </p>
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant={decision === "aprobado" ? "default" : "outline"}
                            className={cn(
                              "h-7 text-[10px] px-2",
                              decision === "aprobado" &&
                                "bg-emerald-600 hover:bg-emerald-700 text-white",
                            )}
                            onClick={() => setDecision(c.email, "aprobado")}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant={decision === "rechazado" ? "default" : "outline"}
                            className={cn(
                              "h-7 text-[10px] px-2",
                              decision === "rechazado"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "border-red-300 text-red-700 hover:bg-red-50",
                            )}
                            onClick={() => {
                              setDecision(c.email, "rechazado");
                              setEditandoNota(c.email);
                            }}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Rechazar
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Nota requerida para rechazo */}
                    {!readOnly && requiereNota && (
                      <div className="mt-2">
                        {editing || !notas[c.email] ? (
                          <Input
                            placeholder="Razón del rechazo (requerida)…"
                            value={notas[c.email] || ""}
                            onChange={(e) =>
                              setNotas((prev) => ({ ...prev, [c.email]: e.target.value }))
                            }
                            onBlur={() => setEditandoNota(null)}
                            autoFocus={editing}
                            className="h-8 text-xs"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditandoNota(c.email)}
                            className="text-xs text-left text-muted-foreground underline-offset-2 hover:underline w-full"
                          >
                            Razón: {notas[c.email]}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Estado actual sistema */}
                    <div className="mt-2 flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          c.pagada
                            ? "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
                            : c.aprobada
                              ? "border-violet-400 text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/40"
                              : "text-muted-foreground",
                        )}
                      >
                        {c.pagada ? "Pagada" : c.aprobada ? "Aprobada" : "Devengada"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Resumen + acción global (sólo cuando NO es readOnly) */}
            {!readOnly && (
              <div className="mt-4 border-t pt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {resumen.aprobados} aprobados · {resumen.rechazados} rechazados ·{" "}
                  {resumen.pendientes} pendientes
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    disabled={guardarMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    disabled={!puedeGuardar || guardarMutation.isPending}
                    onClick={() => guardarMutation.mutate()}
                  >
                    {guardarMutation.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        Guardando…
                      </>
                    ) : (
                      "Guardar decisiones"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      {/* CTA opcional cuando readOnly (ej. Ir a Bandeja de Validaciones) */}
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

/**
 * Extrae el mensaje real del error. supabase-js devuelve PostgrestError
 * como objeto plano (`{ message, details, hint, code }`) — `err instanceof
 * Error` falla y el mensaje se pierde. Este helper cubre los shapes comunes
 * (Error, PostgrestError, AuthError, string).
 */
function pgErrorMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code]
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (parts.length > 0) return parts.join(" — ");
  }
  return null;
}
