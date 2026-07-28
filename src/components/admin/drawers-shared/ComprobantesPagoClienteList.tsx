import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PagoCliente } from "@/hooks/useExpedienteVentaDetalle";

/**
 * Lista de comprobantes de pago del cliente por concepto (Apartado / Enganche),
 * mostrando TODOS los pagos con que se liquidó cada concepto y el total del
 * concepto cuando hubo más de un pago.
 *
 * Se comparte entre los drawers de expediente del Portal Administración
 * (Bandeja de Ejecución) y del Portal Alta Dirección (Bandeja de Validaciones)
 * para mantener el mismo comportamiento en ambos.
 */

const fmtMxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

function PagoRow({
  etiqueta,
  fecha,
  monto,
  urlRecibo,
  esTotal = false,
}: {
  etiqueta: string;
  fecha: string;
  monto: number;
  urlRecibo: string | null;
  esTotal?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm border rounded-md px-3 py-2",
        esTotal
          ? "border-border/60 bg-muted/40"
          : "border-border bg-card",
      )}
    >
      <div className="min-w-0">
        <p className={cn("text-foreground", esTotal ? "font-semibold" : "font-medium")}>
          {etiqueta}
        </p>
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

function ConceptoBlock({ etiqueta, pagos }: { etiqueta: string; pagos: PagoCliente[] }) {
  if (!pagos.length) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin pago de {etiqueta.toLowerCase()} registrado
      </p>
    );
  }
  const total = pagos.reduce((s, p) => s + p.monto, 0);
  const varios = pagos.length > 1;
  return (
    <>
      {pagos.map((p, i) => (
        <PagoRow
          key={`${etiqueta}-${i}`}
          etiqueta={varios ? `${etiqueta} · pago ${i + 1} de ${pagos.length}` : etiqueta}
          fecha={p.fecha}
          monto={p.monto}
          urlRecibo={p.url_recibo}
        />
      ))}
      {varios && (
        <PagoRow
          etiqueta={`Total ${etiqueta}`}
          fecha={`${pagos.length} pagos`}
          monto={total}
          urlRecibo={null}
          esTotal
        />
      )}
    </>
  );
}

export function ComprobantesPagoClienteList({
  pagosApartado = [],
  pagosEnganche = [],
}: {
  pagosApartado?: PagoCliente[];
  pagosEnganche?: PagoCliente[];
}) {
  return (
    <div className="space-y-2">
      <ConceptoBlock etiqueta="Apartado" pagos={pagosApartado} />
      <ConceptoBlock etiqueta="Enganche" pagos={pagosEnganche} />
    </div>
  );
}
