import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PagoCliente } from "@/hooks/useExpedienteVentaDetalle";

/**
 * Lista de comprobantes de pago del cliente por concepto (Apartado / Enganche /
 * pagos adicionales), mostrando TODOS los pagos con que se liquidó cada concepto,
 * el total por concepto cuando hubo más de un pago, y un "Total pagado al momento"
 * con la suma de todo lo abonado por el cliente (útil cuando pagó por encima del
 * enganche).
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
  grand = false,
}: {
  etiqueta: string;
  fecha: string;
  monto: number;
  urlRecibo: string | null;
  esTotal?: boolean;
  grand?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm border rounded-md px-3 py-2",
        grand
          ? "border-primary/40 bg-primary/5"
          : esTotal
            ? "border-border/60 bg-muted/40"
            : "border-border bg-card",
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            "text-foreground",
            grand ? "font-bold" : esTotal ? "font-semibold" : "font-medium",
          )}
        >
          {etiqueta}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">{fecha}</p>
      </div>
      <div className="flex items-center gap-2">
        <p className={cn("text-sm font-semibold tabular-nums", grand && "text-base")}>
          {fmtMxn(monto)}
        </p>
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

/** Bloque de un concepto: sus pagos + total del concepto cuando hay más de uno. */
function ConceptoBlock({
  etiqueta,
  pagos,
  emptyText,
}: {
  etiqueta: string;
  pagos: PagoCliente[];
  /** Texto cuando no hay pagos; si se omite, no renderiza nada al estar vacío. */
  emptyText?: string;
}) {
  if (!pagos.length) {
    return emptyText ? <p className="text-xs text-muted-foreground">{emptyText}</p> : null;
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
  pagosAdicionales = [],
}: {
  pagosApartado?: PagoCliente[];
  pagosEnganche?: PagoCliente[];
  pagosAdicionales?: PagoCliente[];
}) {
  const totalPagos =
    pagosApartado.length + pagosEnganche.length + pagosAdicionales.length;
  const totalPagado = [...pagosApartado, ...pagosEnganche, ...pagosAdicionales].reduce(
    (s, p) => s + p.monto,
    0,
  );

  return (
    <div className="space-y-2">
      <ConceptoBlock
        etiqueta="Apartado"
        pagos={pagosApartado}
        emptyText="Sin pago de apartado registrado"
      />
      <ConceptoBlock
        etiqueta="Enganche"
        pagos={pagosEnganche}
        emptyText="Sin pago de enganche registrado"
      />

      {/* Pagos adicionales al enganche (a la entrega / parcialidades) — solo si existen */}
      {pagosAdicionales.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground pt-1">
            Pagos adicionales al enganche
          </p>
          <ConceptoBlock etiqueta="Pago adicional" pagos={pagosAdicionales} />
        </>
      )}

      {/* Total pagado al momento — suma de todo lo abonado por el cliente */}
      {totalPagos > 0 && (
        <PagoRow
          etiqueta="Total pagado al momento"
          fecha={`${totalPagos} ${totalPagos === 1 ? "pago" : "pagos"} en total`}
          monto={totalPagado}
          urlRecibo={null}
          grand
        />
      )}
    </div>
  );
}
