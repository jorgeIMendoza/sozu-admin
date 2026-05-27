import { useState } from "react";
import {
  Calendar,
  Clock,
  DollarSign,
  Home,
  Ruler,
  User,
  Users,
  Receipt,
  Building2,
  Landmark,
  FileText,
  Loader2,
  Banknote,
  XCircle,
  Mail,
} from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Section, KV } from "./_shared";
import type { CobroPorGestionar } from "@/hooks/useCobrosPorGestionar";
import { useExpedienteVentaDetalle } from "@/hooks/useExpedienteVentaDetalle";

// Mismo emisor que el drawer de Factura SOZU — se replica aquí sólo para mostrarlo.
const SOZU_EMISOR = {
  razon_social: "SOZU REAL ESTATE VENTURES S.A. de C.V.",
  rfc: "SRE241001ABC",
} as const;

const ESTATUS_TONE: Record<CobroPorGestionar["estatus"], string> = {
  "Por Autorizar":
    "border-amber-300 text-amber-700 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/40",
  Autorizado:
    "border-emerald-300 text-emerald-700 bg-emerald-50 dark:text-emerald-200 dark:bg-emerald-950/40",
  Declinado:
    "border-red-300 text-red-700 bg-red-50 dark:text-red-200 dark:bg-red-950/40",
};

export function EjecucionCobroExpedienteContent({
  entity,
  onClose,
}: {
  entity: CobroPorGestionar;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: detalle, isLoading: detalleLoading } = useExpedienteVentaDetalle(
    entity.folio_cuenta,
  );
  const [confirmingPay, setConfirmingPay] = useState(false);
  const [notas, setNotas] = useState("");

  const puedePagar = entity.estatus === "Autorizado";

  // Cálculo de comisión consistente con la tabla (precio_final × pct × IVA).
  const subtotal = (entity.precio_final * entity.porcentaje_comision_venta) / 100;
  const iva = entity.iva_incluido ? subtotal * 0.16 : 0;
  const total = subtotal + iva;

  const handleConfirmPay = () => {
    toast({
      title: "Pago registrado",
      description:
        `Cobro de ${fmtMxn(total)} al desarrollador registrado en demo — pendiente de sincronización con base real.`,
    });
    setConfirmingPay(false);
    onClose();
  };

  // Datos derivados — preferir expediente real, fallback al entity.
  const proyecto = detalle?.proyecto_nombre || entity.proyecto_nombre || "—";
  const edificio = detalle?.edificio_nombre || entity.edificio_nombre || "—";
  const modelo = detalle?.modelo_nombre || entity.modelo_nombre || "—";
  const numeroDepto = detalle?.numero_departamento || entity.numero_departamento || "—";
  const tipo = detalle?.tipo || entity.tipo;
  const metraje = detalle?.metraje ?? 0;
  const precioM2 = detalle?.precio_m2 ?? 0;
  const precioFinal = detalle?.precio_final ?? entity.precio_final;
  const fechaCompra = detalle?.fecha_compra || entity.fecha_compra || "—";
  const diasEsperando = detalle?.dias_desde_compra ?? 0;
  const compradorPrincipal = detalle?.compradores?.[0]?.nombre || entity.comprador_nombre || "—";
  const rfcComprador = detalle?.rfc_comprador || entity.cliente_rfc || "—";
  const copropietarios = (detalle?.compradores ?? [])
    .slice(1)
    .map((c) => c.nombre)
    .join(", ");

  return (
    <div className="space-y-6">
      {/* ─── Estatus de autorización ─── */}
      <div
        className={cn(
          "rounded-md border px-3 py-2 flex items-center justify-between",
          ESTATUS_TONE[entity.estatus],
        )}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Estatus
          </p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {entity.estatus === "Por Autorizar"
              ? "Por Autorizar — esperando decisión del Director"
              : entity.estatus === "Autorizado"
                ? "Autorizado — habilitado para registrar el cobro"
                : "Declinado — Dirección rechazó el pago"}
          </p>
        </div>
      </div>

      {/* ─── Motivo de rechazo (solo cuando Declinado) ─── */}
      {entity.estatus === "Declinado" && (
        <Section title="Motivo de rechazo">
          <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-900 dark:text-red-200 leading-relaxed">
                {entity.notas_rechazo?.trim() || "Sin nota de rechazo capturada por Dirección."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-red-200/60 dark:border-red-900/30">
              {entity.email_autoriza && (
                <KV icon={Mail} label="Rechazado por" value={entity.email_autoriza} />
              )}
              {entity.fecha_autorizacion && (
                <KV
                  icon={Calendar}
                  label="Fecha de rechazo"
                  value={new Date(entity.fecha_autorizacion).toLocaleString("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ─── Resumen de la venta ─── */}
      <Section
        title="Resumen de la venta"
        body={
          <p className="text-sm text-foreground leading-relaxed">
            Venta cerrada hace{" "}
            <span className="font-semibold">{diasEsperando} días</span>. Receptor (desarrollador):{" "}
            <span className="font-semibold">{detalle?.propietario || entity.entidad_duena || "—"}</span>.
          </p>
        }
      >
        <div className="grid grid-cols-2 gap-3 mt-3">
          <KV icon={Calendar} label="Fecha venta reconocida" value={fechaCompra} />
          <KV icon={Clock} label="Días esperando" value={`${diasEsperando} días`} />
        </div>
      </Section>

      {/* ─── Datos de la propiedad ─── */}
      <Section title="Datos de la propiedad">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Home} label="Proyecto" value={proyecto} />
          <KV icon={Home} label="Edificio" value={edificio} />
          <KV icon={Home} label="Modelo" value={modelo} />
          <KV icon={Home} label="No. Depto" value={numeroDepto} />
          <KV icon={Home} label="Tipo" value={<Badge variant="outline">{tipo}</Badge>} />
          {tipo !== "Propiedad" && (detalle?.producto_nombre || entity.producto_nombre) && (
            <KV
              icon={Home}
              label="Producto"
              value={detalle?.producto_nombre || entity.producto_nombre || "—"}
            />
          )}
          <KV
            icon={Ruler}
            label="Metraje"
            value={metraje > 0 ? `${metraje.toFixed(2)} m²` : "—"}
          />
          <KV
            icon={DollarSign}
            label="Precio / m²"
            value={precioM2 > 0 ? fmtMxn(precioM2) : "—"}
          />
          <KV icon={DollarSign} label="Precio final" value={fmtMxn(precioFinal)} />
        </div>
      </Section>

      {/* ─── Comprador ─── */}
      <Section title="Comprador">
        {detalleLoading && !detalle ? (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando comprador…
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <KV icon={User} label="Nombre" value={compradorPrincipal} />
            <KV icon={Receipt} label="RFC" value={rfcComprador} mono />
            {copropietarios && (
              <KV icon={Users} label="Copropietarios" value={copropietarios} />
            )}
          </div>
        )}
      </Section>

      {/* ─── Comprobantes de pago del cliente ─── */}
      <Section title="Comprobantes de pago del cliente">
        {detalleLoading && !detalle ? (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando comprobantes…
          </p>
        ) : (
          <div className="space-y-2">
            {detalle?.pago_apartado ? (
              <PagoRow
                etiqueta="Apartado"
                fecha={detalle.pago_apartado.fecha}
                monto={detalle.pago_apartado.monto}
                urlRecibo={detalle.pago_apartado.url_recibo}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Sin pago de apartado registrado</p>
            )}
            {detalle?.pago_enganche ? (
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
        )}
      </Section>

      {/* ─── Documentos ─── */}
      <Section title="Documentos">
        {detalleLoading && !detalle ? (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando documentos…
          </p>
        ) : (
          <DocRow
            label="Contrato firmado completamente"
            url={detalle?.url_contrato_firmado ?? null}
            estado={detalle?.url_contrato_firmado ? "Disponible" : "Pendiente"}
          />
        )}
      </Section>

      {/* ─── Cálculo de comisión ─── */}
      <Section title="Cálculo de comisión">
        <div className="rounded-md border border-border bg-card divide-y">
          <RowKV label="Precio final" value={fmtMxn(entity.precio_final)} />
          <RowKV
            label="% Comisión SOZU"
            value={`${entity.porcentaje_comision_venta.toFixed(2)}%`}
          />
          <RowKV label="Subtotal comisión" value={fmtMxn(subtotal)} />
          {entity.iva_incluido && <RowKV label="IVA (16%)" value={fmtMxn(iva)} />}
          <RowKV
            label={entity.iva_incluido ? "Total a facturar (IVA incluido)" : "Total a facturar"}
            value={fmtMxn(total)}
            emphasis
          />
        </div>
      </Section>

      {/* ─── Datos fiscales · Emisor (SOZU) ─── */}
      <Section title="Datos fiscales · Emisor">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Building2} label="Razón social" value={SOZU_EMISOR.razon_social} />
          <KV icon={Receipt} label="RFC" value={SOZU_EMISOR.rfc} mono />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 px-1">
          SOZU presta servicios profesionales de intermediación; emite el CFDI a la entidad dueña.
        </p>
      </Section>

      {/* ─── Datos fiscales · Receptor (Entidad Dueña) ─── */}
      <Section title="Datos fiscales · Receptor">
        <div className="grid grid-cols-2 gap-3">
          <KV
            icon={Building2}
            label="Razón social"
            value={entity.receptor_razon_social || entity.entidad_duena || "—"}
          />
          <KV
            icon={Receipt}
            label="RFC receptor"
            value={entity.receptor_rfc || "Sin RFC registrado"}
            mono
          />
          <KV
            icon={FileText}
            label="Régimen fiscal"
            value={
              entity.receptor_regimen_codigo
                ? `${entity.receptor_regimen_codigo}${
                    entity.receptor_regimen_nombre ? ` · ${entity.receptor_regimen_nombre}` : ""
                  }`
                : "Sin régimen registrado"
            }
          />
          <KV
            icon={FileText}
            label="Uso de CFDI"
            value={
              entity.receptor_uso_cfdi_codigo
                ? `${entity.receptor_uso_cfdi_codigo}${
                    entity.receptor_uso_cfdi_nombre ? ` · ${entity.receptor_uso_cfdi_nombre}` : ""
                  }`
                : "Sin uso CFDI registrado"
            }
          />
        </div>
      </Section>

      {/* ─── Factura SOZU timbrada ─── */}
      <Section title="Factura SOZU timbrada">
        <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-3">
          <p className="text-xs text-muted-foreground mb-2">
            CFDI emitido por <strong>{SOZU_EMISOR.razon_social}</strong> al receptor{" "}
            <strong>{entity.receptor_razon_social || entity.entidad_duena || "la entidad dueña"}</strong> por{" "}
            <strong>{fmtMxn(total)}</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            {entity.url_factura_pdf ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => window.open(entity.url_factura_pdf!, "_blank")}
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Ver PDF
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">PDF no disponible</span>
            )}
            {entity.url_factura_xml && (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => window.open(entity.url_factura_xml!, "_blank")}
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Ver XML
              </Button>
            )}
          </div>
        </div>
      </Section>

      {/* ─── Cuenta STP de comisión ─── */}
      <Section title="Cuenta STP de comisión">
        <KV
          icon={Landmark}
          label="CLABE destino"
          value={entity.cuenta_stp_comisiones || "Sin CLABE registrada"}
          mono
        />
      </Section>

      {/* ─── Notas (opcional) ─── */}
      <Section title="Notas (opcional)">
        <Label htmlFor="notas-pago" className="sr-only">
          Notas
        </Label>
        <Textarea
          id="notas-pago"
          placeholder="Observaciones internas sobre este cobro…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </Section>

      {/* ─── Footer · acciones ─── */}
      <div className="border-t pt-3 flex items-center justify-end gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={() => setConfirmingPay(true)}
          disabled={!puedePagar}
          title={
            puedePagar
              ? "Registrar el cobro al desarrollador"
              : entity.estatus === "Por Autorizar"
                ? "Esperando autorización de Dirección"
                : "El pago fue declinado por Dirección"
          }
        >
          <Banknote className="h-3.5 w-3.5 mr-1.5" />
          Pagar
        </Button>
      </div>

      {/* ─── Modal de confirmación ─── */}
      <AlertDialog
        open={confirmingPay}
        onOpenChange={(open) => {
          if (!open) setConfirmingPay(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar registro de cobro</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción registra el cobro de{" "}
              <strong className="text-foreground">{fmtMxn(total)}</strong> al desarrollador{" "}
              <strong className="text-foreground">{entity.entidad_duena || "la entidad dueña"}</strong>{" "}
              vía la cuenta STP{" "}
              <strong className="text-foreground font-mono">
                {entity.cuenta_stp_comisiones || "—"}
              </strong>
              .
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                Folio cuenta: {entity.folio_cuenta} · {proyecto}
                {numeroDepto !== "—" ? ` · Depto ${numeroDepto}` : ""}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmPay();
              }}
            >
              Sí, registrar pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ────────────── Helpers locales ────────────── */

function RowKV({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          emphasis
            ? "text-sm font-bold tabular-nums text-foreground"
            : "text-sm tabular-nums text-foreground"
        }
      >
        {value}
      </p>
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
}: {
  label: string;
  url: string | null;
  estado: string;
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
      </div>
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
    </div>
  );
}
