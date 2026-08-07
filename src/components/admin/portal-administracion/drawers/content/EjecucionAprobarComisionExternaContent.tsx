import { useState } from "react";
import {
  Calendar,
  Clock,
  DollarSign,
  Home,
  User,
  Users,
  Receipt,
  Building2,
  FileText,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { ComprobantesPagoClienteList } from "@/components/admin/drawers-shared/ComprobantesPagoClienteList";
import { CuentaBancariaAgenteSection } from "./CuentaBancariaAgenteSection";
import { useExpedienteVentaDetalle } from "@/hooks/useExpedienteVentaDetalle";
import { useAprobarComisionExterna } from "@/hooks/useAprobarComisionExterna";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import type { ComisionExterna, TipoBeneficiarioComExt } from "@/hooks/useComisionesExternas";

const TIPO_BENEFICIARIO_LABEL: Record<TipoBeneficiarioComExt, string> = {
  inmobiliaria: "Inmobiliaria",
  broker: "Broker",
  aliado_comercial: "Aliado comercial",
  agente_externo: "Agente externo",
};

// Receptor de la factura que emite el comisionista externo → SOZU.
const SOZU_RECEPTOR = {
  razon_social: "SOZU REAL ESTATE VENTURES S.A. de C.V.",
  rfc: "SRE241001ABC",
} as const;

function RowKV({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span
        className={
          emphasis ? "text-sm font-semibold text-foreground" : "text-sm text-muted-foreground"
        }
      >
        {label}
      </span>
      <span
        className={
          emphasis
            ? "text-sm font-semibold tabular-nums text-foreground"
            : "text-sm tabular-nums text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

function DocRow({ label, url, estado }: { label: string; url: string | null; estado: string }) {
  return (
    <div className="flex items-center justify-between text-sm border border-border rounded-md px-3 py-2 bg-card">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        <Badge
          variant="outline"
          className={
            url
              ? "text-[10px] mt-0.5 border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
              : "text-[10px] mt-0.5 text-muted-foreground"
          }
        >
          {estado}
        </Badge>
      </div>
      {url && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[10px] px-2"
          onClick={() => window.open(url, "_blank")}
        >
          <FileText className="h-3 w-3 mr-1" />
          Ver
        </Button>
      )}
    </div>
  );
}

export function EjecucionAprobarComisionExternaContent({
  entity,
  onClose,
}: {
  entity: ComisionExterna;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const aprobar = useAprobarComisionExterna();
  const [notas, setNotas] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const folio = formatCuentaCobranzaId(entity.id_cuenta_cobranza, entity.tipo);
  const { data: detalle, isLoading: detalleLoading } = useExpedienteVentaDetalle(folio);

  // Cálculo de comisión del externo — subtotal + IVA (la comisión externa es "+ IVA").
  const subtotal = entity.monto_comision;
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  const proyecto = detalle?.proyecto_nombre || entity.proyecto_nombre || "—";
  const edificio = detalle?.edificio_nombre || "—";
  const modelo = detalle?.modelo_nombre || entity.modelo_nombre || "—";
  const numeroDepto = detalle?.numero_departamento || entity.numero_departamento || "—";
  const productoNombre = detalle?.producto_nombre || entity.producto_nombre || "";
  const precioFinal = detalle?.precio_final ?? entity.precio_final;
  const metraje = detalle?.metraje ?? 0;
  const precioM2 = detalle?.precio_m2 ?? 0;
  const fechaCompra = detalle?.fecha_compra || "—";
  const diasEsperando = detalle?.dias_desde_compra ?? entity.dias_desde_devengo;

  const compradorPrincipal = detalle?.compradores?.[0]?.nombre || "—";
  const rfcComprador = detalle?.rfc_comprador || "—";
  const copropietarios =
    (detalle?.compradores?.length ?? 0) > 1
      ? detalle!.compradores
          .slice(1)
          .map((c) => c.nombre)
          .join(", ")
      : null;

  const handleAprobar = async () => {
    try {
      await aprobar.mutateAsync({
        email: entity.email_usuario,
        idCuenta: entity.id_cuenta_cobranza,
        montoComision: entity.monto_comision,
        nombreComisionista: entity.beneficiario_nombre,
        proyectoNombre: entity.proyecto_nombre,
        numeroDepartamento: entity.numero_departamento,
      });
      toast({
        title: "Comisión externa aprobada",
        description: `${entity.beneficiario_nombre} — se habilitó la carga de factura y se notificó al externo.`,
      });
      setConfirmOpen(false);
      onClose();
    } catch (e: any) {
      toast({
        title: "No se pudo aprobar",
        description: e?.message ?? "Error al aprobar la comisión externa.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Resumen de la venta ─── */}
      <Section
        title="Resumen de la venta"
        body={
          <p className="text-sm text-foreground leading-relaxed">
            Comisión de <span className="font-semibold">{entity.beneficiario_nombre}</span> (
            {TIPO_BENEFICIARIO_LABEL[entity.beneficiario_tipo]}) por la venta cerrada hace{" "}
            <span className="font-semibold">{diasEsperando} días</span>. Al aprobar se habilita la
            carga de su factura en plataforma.
          </p>
        }
      >
        <div className="grid grid-cols-2 gap-3 mt-3">
          <KV icon={Calendar} label="Fecha venta reconocida" value={fechaCompra} />
          <KV icon={Clock} label="Días desde la venta" value={`${diasEsperando} días`} />
        </div>
      </Section>

      {/* ─── Datos de la propiedad ─── */}
      <Section title="Datos de la propiedad">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Home} label="Proyecto" value={proyecto} />
          <KV icon={Home} label="Edificio" value={edificio} />
          <KV icon={Home} label="Modelo" value={modelo} />
          <KV icon={Home} label="No. Depto" value={numeroDepto} />
          <KV icon={Home} label="Tipo" value={<Badge variant="outline">{entity.tipo}</Badge>} />
          {entity.tipo !== "Propiedad" && productoNombre && (
            <KV icon={Home} label="Producto" value={productoNombre} />
          )}
          <KV
            icon={Building2}
            label="Metraje"
            value={metraje > 0 ? `${metraje.toFixed(2)} m²` : "—"}
          />
          <KV icon={DollarSign} label="Precio / m²" value={precioM2 > 0 ? fmtMxn(precioM2) : "—"} />
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
            {copropietarios && <KV icon={Users} label="Copropietarios" value={copropietarios} />}
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
          <ComprobantesPagoClienteList
            pagosApartado={detalle?.pagos_apartado ?? []}
            pagosEnganche={detalle?.pagos_enganche ?? []}
            pagosAdicionales={detalle?.pagos_adicionales ?? []}
          />
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
          <RowKV label="Precio final" value={fmtMxn(precioFinal)} />
          <RowKV label="% Comisión externo" value={`${entity.porcentaje_comision.toFixed(2)}%`} />
          <RowKV label="Subtotal comisión" value={fmtMxn(subtotal)} />
          <RowKV label="IVA (16%)" value={fmtMxn(iva)} />
          <RowKV label="Total (IVA incluido)" value={fmtMxn(total)} emphasis />
        </div>
      </Section>

      {/* ─── Datos fiscales · Emisor (comisionista externo) ─── */}
      <Section title="Datos fiscales · Emisor">
        <div className="grid grid-cols-2 gap-3">
          <KV
            icon={Building2}
            label="Razón social / Nombre"
            value={entity.beneficiario_nombre || "—"}
          />
          <KV
            icon={Receipt}
            label="RFC"
            value={entity.beneficiario_rfc || "Sin RFC registrado"}
            mono
          />
          <KV
            icon={User}
            label="Tipo"
            value={<Badge variant="outline">{TIPO_BENEFICIARIO_LABEL[entity.beneficiario_tipo]}</Badge>}
          />
          <KV icon={Receipt} label="Email" value={entity.email_usuario || "—"} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 px-1">
          El comisionista externo emite el CFDI de su comisión a SOZU.
        </p>
      </Section>

      {/* ─── Datos fiscales · Receptor (SOZU) ─── */}
      <Section title="Datos fiscales · Receptor">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Building2} label="Razón social" value={SOZU_RECEPTOR.razon_social} />
          <KV icon={Receipt} label="RFC" value={SOZU_RECEPTOR.rfc} mono />
        </div>
      </Section>

      {/* ─── Cuenta bancaria del agente ─── */}
      <CuentaBancariaAgenteSection email={entity.email_usuario} />

      {/* ─── Notas (opcional) ─── */}
      <Section title="Notas (opcional)">
        <Label htmlFor="notas-aprobar-externo" className="sr-only">
          Notas
        </Label>
        <Textarea
          id="notas-aprobar-externo"
          placeholder="Observaciones internas sobre esta aprobación…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </Section>

      {/* ─── Footer · acción ─── */}
      <div className="border-t pt-3 flex items-center justify-end gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={aprobar.isPending}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={aprobar.isPending}>
          {aprobar.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Aprobando…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Aprobar
            </>
          )}
        </Button>
      </div>

      {/* ─── Confirmación ─── */}
      <AlertDialog open={confirmOpen} onOpenChange={(open) => !open && setConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar aprobación de comisión externa</AlertDialogTitle>
            <AlertDialogDescription>
              Al aprobar la comisión de{" "}
              <strong className="text-foreground">{entity.beneficiario_nombre}</strong> por{" "}
              <strong className="text-foreground">{fmtMxn(total)}</strong> (IVA incluido) se
              habilitará que el externo suba su factura en plataforma y se le enviará una
              notificación por correo. El pago se ejecutará después, una vez que SOZU cobre su
              comisión al desarrollador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aprobar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAprobar} disabled={aprobar.isPending}>
              {aprobar.isPending ? "Aprobando…" : "Aprobar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
