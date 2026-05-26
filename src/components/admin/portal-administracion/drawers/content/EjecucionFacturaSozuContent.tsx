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
import {
  type FacturaComisionSozuPorGenerar,
  useGenerarFacturaComisionSozu,
} from "@/hooks/useFacturasComisionSozuPorGenerar";
import { useExpedienteVentaDetalle } from "@/hooks/useExpedienteVentaDetalle";

export function EjecucionFacturaSozuContent({
  entity,
  onClose,
}: {
  entity: FacturaComisionSozuPorGenerar;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const generar = useGenerarFacturaComisionSozu();
  const { data: detalle, isLoading: detalleLoading } = useExpedienteVentaDetalle(
    entity.folio_cuenta,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notas, setNotas] = useState("");

  // Cálculo de comisión — consistente con Admin Panel Comisiones.tsx (subtotal + IVA si aplica).
  const subtotal = (entity.precio_final * entity.porcentaje_comision_venta) / 100;
  const iva = entity.iva_incluido ? subtotal * 0.16 : 0;
  const total = subtotal + iva;

  const handleConfirm = async () => {
    try {
      const data = await generar.mutateAsync(entity.id_cuenta_cobranza);
      if (data?.not_applicable) {
        toast({
          title: "No aplica",
          description: data.message || "La cuenta no requiere factura SOZU.",
        });
      } else if (data?.already_exists) {
        toast({
          title: "Ya existe",
          description: data.message || "La factura ya fue generada previamente.",
        });
      } else {
        toast({
          title: "CFDI generado",
          description: `Factura draft generada para ${entity.folio_cuenta}.`,
        });
      }
      setConfirmOpen(false);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido al generar CFDI";
      toast({
        title: "Error al generar",
        description: message,
        variant: "destructive",
      });
      setConfirmOpen(false);
    }
  };

  // Datos derivados — preferir el expediente real, fallback al entity de la tabla.
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
  const compradorPrincipal = detalle?.compradores?.[0]?.nombre || entity.cliente_nombre || "—";
  const rfcComprador = detalle?.rfc_comprador || entity.cliente_rfc || "—";
  const copropietarios = (detalle?.compradores ?? [])
    .slice(1)
    .map((c) => c.nombre)
    .join(", ");

  return (
    <div className="space-y-6">
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

      {/* ─── Datos fiscales ─── */}
      <Section title="Datos fiscales">
        <div className="grid grid-cols-2 gap-3">
          <KV
            icon={Receipt}
            label="RFC receptor"
            value="Resuelto por edge function al timbrar"
          />
          <KV icon={Building2} label="Razón social" value={entity.entidad_duena || "—"} />
          <KV icon={FileText} label="Uso de CFDI" value="G03 · Gastos en general" />
          <KV icon={FileText} label="Forma de pago" value="03 · Transferencia electrónica" />
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
        <Label htmlFor="notas-cfdi" className="sr-only">
          Notas
        </Label>
        <Textarea
          id="notas-cfdi"
          placeholder="Observaciones internas sobre esta generación…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </Section>

      {/* ─── Footer ─── */}
      <div className="border-t pt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={generar.isPending}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={generar.isPending}>
          {generar.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Generando CFDI…
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {entity.es_regenerar ? "Regenerar CFDI" : "Generar CFDI"}
            </>
          )}
        </Button>
      </div>

      {/* ─── Modal de confirmación ─── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar generación de CFDI</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirmas la generación del CFDI por{" "}
              <strong className="text-foreground">{fmtMxn(total)}</strong> a{" "}
              <strong className="text-foreground">{entity.entidad_duena || "la entidad dueña"}</strong>?
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                Folio cuenta: {entity.folio_cuenta} · {proyecto}
                {numeroDepto !== "—" ? ` · Depto ${numeroDepto}` : ""}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              disabled={generar.isPending}
            >
              {generar.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Generando…
                </>
              ) : (
                "Sí, generar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Helpers locales (mismos shapes que ComisionInternaContent).
   ────────────────────────────────────────────────────────── */

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
