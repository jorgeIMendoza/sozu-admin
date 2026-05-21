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
} from "lucide-react";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DrawerActionFooter } from "../DrawerActionFooter";
import { Section, KV, Timeline, TimelineItem } from "./_shared";
import type { VentaContext, VentaParaFacturarEntity } from "../types";
import { useExpedienteVentaDetalle } from "@/hooks/useExpedienteVentaDetalle";

export function VentaParaFacturarContent({
  entity,
  onClose,
}: {
  entity: VentaParaFacturarEntity;
  ventaContext: VentaContext;
  onClose: () => void;
}) {
  const { data: detalle, isLoading, error } = useExpedienteVentaDetalle(entity.folio_cuenta);

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
  const externos = detalle.comisionistas.filter((c) => c.es_externo);

  return (
    <div className="space-y-6">
      {/* ─── Resumen de la decisión ─── */}
      <Section
        title="Por qué requiere tu validación"
        body={
          <p className="text-sm text-foreground leading-relaxed">
            Esta venta fue reconocida hace{" "}
            <span className="font-semibold">{detalle.dias_desde_compra} días</span>.
            Como Receptor de la factura el desarrollador (
            <span className="font-semibold">{detalle.propietario}</span>) debe pagar a SOZU
            la comisión por intermediación. Requiere tu autorización para proceder con el cobro.
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
            <KV
              icon={User}
              label="Nombre"
              value={comprador?.nombre || "—"}
            />
            <KV
              icon={Receipt}
              label="RFC"
              value={detalle.rfc_comprador || "—"}
              mono
            />
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

      {/* ─── Vendedor / Inmobiliaria ─── */}
      {externos.length > 0 && (
        <Section title="Vendedor / Inmobiliaria">
          <ul className="space-y-1">
            {externos.map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-sm border border-border rounded-md px-3 py-2 bg-card"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{c.nombre}</p>
                  <p className="text-xs text-muted-foreground">{c.rol}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {c.porcentaje.toFixed(2)}%
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{fmtMxn(c.monto)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

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

      {/* ─── Documentos clave ─── */}
      <Section title="Documentos">
        <div className="space-y-2">
          <DocRow
            label="Contrato firmado completamente"
            url={detalle.url_contrato_firmado}
            estadoBadge={detalle.url_contrato_firmado ? "Disponible" : "Pendiente"}
          />
          <DocRow
            label="Factura SOZU al desarrollador"
            url={detalle.url_factura_sozu}
            estadoBadge={
              detalle.factura_sozu_estado === "timbrada"
                ? "Timbrada"
                : detalle.factura_sozu_estado === "draft"
                  ? "Draft"
                  : "Sin generar"
            }
            extraUrl={detalle.url_factura_xml_sozu}
            extraLabel="XML"
          />
        </div>
      </Section>

      {/* ─── Impacto financiero ─── */}
      <Section
        title="Impacto de la decisión"
        body={
          <p className="text-sm text-foreground leading-relaxed">
            Al <strong>autorizar el pago</strong>, SOZU confirma el cobro de{" "}
            <span className="font-semibold tabular-nums">
              {fmtMxn(detalle.comision_total_sozu)}
            </span>{" "}
            al desarrollador. Esto habilita los pagos a comisionistas externos (
            <span className="font-semibold tabular-nums">{fmtMxn(detalle.comision_externa)}</span>
            ) e internos (
            <span className="font-semibold tabular-nums">{fmtMxn(detalle.comision_a_dispersar)}</span>
            ) asociados a esta venta.
          </p>
        }
      />

      {/* ─── Actividad reciente (timeline abreviado del expediente) ─── */}
      <Section title="Actividad reciente">
        <Timeline>
          {detalle.timeline
            .filter(
              (s) =>
                s.estado === "completado" &&
                s.fecha &&
                [4, 9, 10, 11, 12].includes(s.paso),
            )
            .slice(-5)
            .reverse()
            .map((s) => (
              <TimelineItem
                key={s.paso}
                label={s.nombre}
                meta={`${s.fecha}${s.responsable ? ` · ${s.responsable}` : ""}`}
                tone={s.es_hito ? "success" : undefined}
              />
            ))}
        </Timeline>
      </Section>

      <DrawerActionFooter
        onCancel={onClose}
        notePlaceholder="Notas (requeridas si rechazas el pago)…"
        actions={[
          {
            label: "Rechazar pago",
            variant: "destructive",
            requiresNote: true,
            onClick: () => {},
          },
          {
            label: "Autorizar pago",
            variant: "primary",
            onClick: () => {},
          },
        ]}
      />
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
  estadoBadge,
  extraUrl,
  extraLabel,
}: {
  label: string;
  url: string | null;
  estadoBadge: string;
  extraUrl?: string | null;
  extraLabel?: string;
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
          {estadoBadge}
        </Badge>
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
            title="Descargar XML"
            onClick={() => window.open(extraUrl, "_blank")}
          >
            {extraLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
