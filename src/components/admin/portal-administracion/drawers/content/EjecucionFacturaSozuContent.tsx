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
  useTimbrarFacturaComisionSozu,
} from "@/hooks/useFacturasComisionSozuPorGenerar";
import { useExpedienteVentaDetalle } from "@/hooks/useExpedienteVentaDetalle";

// Emisor del CFDI (lo configura del lado de la edge function; se replica aquí
// solo para mostrarlo en "Datos fiscales — Emisor").
const SOZU_EMISOR = {
  razon_social: "SOZU REAL ESTATE VENTURES S.A. de C.V.",
  rfc: "SRE241001ABC",
} as const;

type PendingAction = null | "generar" | "regenerar" | "timbrar";

export function EjecucionFacturaSozuContent({
  entity,
  onClose,
}: {
  entity: FacturaComisionSozuPorGenerar;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const generar = useGenerarFacturaComisionSozu();
  const timbrar = useTimbrarFacturaComisionSozu();
  const { data: detalle, isLoading: detalleLoading } = useExpedienteVentaDetalle(
    entity.folio_cuenta,
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [notas, setNotas] = useState("");

  const isDraft = entity.estado_factura === "draft";
  const isWorking = generar.isPending || timbrar.isPending;

  // Cálculo de comisión — consistente con Admin Panel Comisiones.tsx (subtotal + IVA si aplica).
  const subtotal = (entity.precio_final * entity.porcentaje_comision_venta) / 100;
  const iva = entity.iva_incluido ? subtotal * 0.16 : 0;
  const total = subtotal + iva;

  const handleConfirm = async () => {
    const action = pendingAction;
    if (!action) return;
    try {
      if (action === "timbrar") {
        await timbrar.mutateAsync(entity.id_cuenta_cobranza);
        toast({
          title: "Factura timbrada",
          description: `${entity.folio_cuenta} timbrada exitosamente.`,
        });
      } else {
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
            title: action === "regenerar" ? "Draft regenerado" : "Draft generado",
            description: `Factura draft ${
              action === "regenerar" ? "regenerada" : "generada"
            } para ${entity.folio_cuenta}. Valida los datos antes de timbrar.`,
          });
        }
      }
      setPendingAction(null);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Error desconocido al ${action === "timbrar" ? "timbrar" : "generar"} CFDI`;
      toast({
        title: action === "timbrar" ? "Error al timbrar" : "Error al generar",
        description: message,
        variant: "destructive",
      });
      setPendingAction(null);
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
      {/* ─── Estado actual del CFDI ─── */}
      <div
        className={cn(
          "rounded-md border px-3 py-2 flex items-center justify-between",
          isDraft
            ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50"
            : "border-teal-300 bg-teal-50 dark:bg-teal-950/30 dark:border-teal-900/50",
        )}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Estado del CFDI
          </p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {isDraft ? "Draft generado · pendiente de validar y timbrar" : "Por generar"}
          </p>
        </div>
        {isDraft && entity.url_factura_comision && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 border-amber-400 text-amber-700 dark:text-amber-200"
            onClick={() => window.open(entity.url_factura_comision!, "_blank")}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Ver factura draft
          </Button>
        )}
      </div>

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
          <KV icon={Building2} label="Razón social" value={entity.entidad_duena || "—"} />
          <KV
            icon={Receipt}
            label="RFC receptor"
            value="Resuelto por edge function al timbrar"
          />
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

      {/* ─── Footer · acciones contextuales ─── */}
      <div className="border-t pt-3 flex items-center justify-end gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isWorking}>
          Cancelar
        </Button>
        {isDraft ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingAction("regenerar")}
              disabled={isWorking}
            >
              {generar.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Regenerando…
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Regenerar draft
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => setPendingAction("timbrar")}
              disabled={isWorking}
            >
              {timbrar.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Timbrando…
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Timbrar CFDI
                </>
              )}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => setPendingAction("generar")}
            disabled={isWorking}
          >
            {generar.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Generando CFDI…
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Generar CFDI
              </>
            )}
          </Button>
        )}
      </div>

      {/* ─── Modal de confirmación ─── */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === "timbrar"
                ? "Confirmar timbrado del CFDI"
                : pendingAction === "regenerar"
                  ? "Confirmar regeneración del draft"
                  : "Confirmar generación del CFDI"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === "timbrar" ? (
                <>
                  Esta acción <strong className="text-foreground">timbrará</strong> el draft actual
                  por{" "}
                  <strong className="text-foreground">{fmtMxn(total)}</strong> a{" "}
                  <strong className="text-foreground">
                    {entity.entidad_duena || "la entidad dueña"}
                  </strong>
                  . Es <strong>irreversible</strong> ante el SAT.
                </>
              ) : (
                <>
                  Esta acción {pendingAction === "regenerar" ? "regenerará el draft" : "generará un draft"}{" "}
                  por{" "}
                  <strong className="text-foreground">{fmtMxn(total)}</strong> a{" "}
                  <strong className="text-foreground">
                    {entity.entidad_duena || "la entidad dueña"}
                  </strong>
                  . El CFDI quedará en estado borrador para validar antes de timbrar.
                </>
              )}
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                Folio cuenta: {entity.folio_cuenta} · {proyecto}
                {numeroDepto !== "—" ? ` · Depto ${numeroDepto}` : ""}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              disabled={isWorking}
            >
              {isWorking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {pendingAction === "timbrar" ? "Timbrando…" : "Generando…"}
                </>
              ) : pendingAction === "timbrar" ? (
                "Sí, timbrar"
              ) : pendingAction === "regenerar" ? (
                "Sí, regenerar"
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
