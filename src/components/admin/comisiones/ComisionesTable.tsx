import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Eye, Users } from "lucide-react";

/**
 * Tabla de comisiones: define las columnas y celdas sobre el esqueleto genérico
 * `DataTable` (ui/data-table). El orden y la paginación los maneja DataTable.
 * Presentacional: la subida de factura se inyecta con `renderFacturaUpload`.
 */

export type ComisionCliente = { nombre: string; email?: string; porcentaje: number };

export type ComisionRow = {
  id_cuenta_cobranza: number;
  cuenta_cobranza_label: string;
  proyecto?: string;
  propiedad?: string | number | null;
  productoNombre?: string | null;
  clientes: ComisionCliente[];
  precio_final: number;
  monto_comision: number;
  detailed_status: string; // 'pagada' | resto → "Pendiente"
  fecha_pago: string | null;
  url_evidencia_pago?: string | null;
  factura_url?: string | null;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const fmtFecha = (f: string | null) => {
  if (!f) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f);
  if (m) return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`; // "24 jul 2026"
  const d = new Date(f);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
};

// Estatus mostrado (deriva de `detailed_status`). 4 buckets.
export type ComisionEstatus = "pagada" | "aprobado" | "en_revision" | "pendiente";
export const COMISION_ESTATUS_LABEL: Record<ComisionEstatus, string> = {
  pagada: "Pagada",
  aprobado: "Aprobado",
  en_revision: "En revisión",
  pendiente: "Pendiente",
};
export function comisionEstatus(detailed: string): ComisionEstatus {
  if (detailed === "pagada") return "pagada";
  if (detailed === "programada" || detailed === "factura_requerida" || detailed === "aprobada") return "aprobado";
  if (detailed === "en_revision") return "en_revision";
  return "pendiente";
}
const ESTATUS_CLS: Record<ComisionEstatus, string> = {
  pagada: "bg-emerald-100 text-emerald-700 border-emerald-200",
  aprobado: "bg-sky-100 text-sky-700 border-sky-200",
  en_revision: "bg-amber-100 text-amber-700 border-amber-200",
  pendiente: "border-border text-muted-foreground",
};
function EstatusBadge({ status }: { status: string }) {
  const e = comisionEstatus(status);
  return (
    <Badge variant="outline" className={cn("font-medium whitespace-nowrap", ESTATUS_CLS[e])}>
      {COMISION_ESTATUS_LABEL[e]}
    </Badge>
  );
}

// Cliente: 1 → nombre + correo; varios → "N compradores" (clic abre modal).
function ClienteCell({ clientes }: { clientes: ComisionCliente[] }) {
  const [open, setOpen] = useState(false);
  if (!clientes || clientes.length === 0) return <span className="text-xs text-muted-foreground/60">Sin cliente</span>;
  if (clientes.length === 1) {
    const c = clientes[0];
    return (
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" title={c.nombre}>{c.nombre || "Sin nombre"}</p>
        {c.email && <p className="text-xs text-muted-foreground truncate" title={c.email}>{c.email}</p>}
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Users className="size-3.5 shrink-0" />
        {clientes.length} compradores
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Compradores de la operación</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {clientes.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.nombre || "Sin nombre"}</p>
                  {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{c.porcentaje}%</Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ComisionesTableProps {
  /** Filas YA filtradas (orden + paginación los maneja DataTable). */
  rows: ComisionRow[];
  pageSize?: number;
  /** Enmascara montos en modo presentación. */
  mask?: (s: string) => string;
  /** Abre el visor de PDF (comprobante / factura). */
  onView: (url: string, title: string) => void;
  /** Slot para el botón de subir factura (lo decide la página según permisos/estatus). */
  renderFacturaUpload?: (row: ComisionRow) => ReactNode;
  emptyLabel?: string;
  /** Clave de fila. Por defecto la cuenta de cobranza; el portal de embajadores la
   *  sobrescribe porque sus comisiones de referido no tienen cuenta (id 0). */
  rowKey?: (row: ComisionRow, index: number) => string | number;
  /** Segunda línea bajo la cuenta: dueño de la comisión (vista global del admin). */
  ownerLabel?: (row: ComisionRow) => string | null | undefined;
}

export function ComisionesTable({ rows, pageSize = 15, mask = (s) => s, onView, renderFacturaUpload, emptyLabel = "Sin comisiones", rowKey, ownerLabel }: ComisionesTableProps) {
  const columns: DataTableColumn<ComisionRow>[] = [
    {
      id: "account",
      header: "Cuenta",
      widthClass: "w-[150px]",
      sortable: true,
      sortAccessor: (r) => r.id_cuenta_cobranza || 0,
      headerClassName: "pl-3",
      cellClassName: "pl-3 pr-2",
      cell: (r, ctx) => {
        const owner = ownerLabel?.(r);
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full text-xs font-bold tabular-nums leading-none select-none bg-muted text-muted-foreground/70 ring-1 ring-border/60 shrink-0">{ctx.rowNumber}</span>
            <div className="min-w-0">
              <p className="text-xs font-mono font-semibold tabular-nums truncate" title={r.cuenta_cobranza_label}>{r.cuenta_cobranza_label}</p>
              {owner && <p className="text-xs text-muted-foreground truncate" title={owner}>{owner}</p>}
            </div>
          </div>
        );
      },
    },
    {
      id: "project",
      header: "Proyecto",
      widthClass: "w-[170px]",
      sortable: true,
      sortAccessor: (r) => (r.proyecto || "").toLowerCase(),
      cell: (r) => {
        const unidad = (r.propiedad ? String(r.propiedad) : "") || r.productoNombre || "";
        return (
          <>
            <p className="text-xs font-medium truncate" title={r.proyecto}>{r.proyecto || "Sin proyecto"}</p>
            {unidad && <p className="text-xs text-muted-foreground truncate" title={unidad}>{unidad}</p>}
          </>
        );
      },
    },
    {
      id: "client",
      header: "Cliente",
      widthClass: "w-[200px]",
      sortable: true,
      sortAccessor: (r) => (r.clientes?.[0]?.nombre || "").toLowerCase(),
      cell: (r) => <ClienteCell clientes={r.clientes} />,
    },
    {
      id: "price",
      header: "Venta",
      align: "center",
      widthClass: "w-[130px]",
      sortable: true,
      sortAccessor: (r) => r.precio_final || 0,
      cellClassName: "tabular-nums text-xs",
      cell: (r) => mask(fmtMoney(r.precio_final)),
    },
    {
      id: "commission",
      header: "Comisión +IVA",
      align: "center",
      widthClass: "w-[150px]",
      sortable: true,
      sortAccessor: (r) => r.monto_comision || 0,
      cellClassName: "tabular-nums text-xs font-semibold text-emerald-600",
      cell: (r) => mask(fmtMoney(r.monto_comision)),
    },
    {
      id: "status",
      header: "Estatus",
      align: "center",
      widthClass: "w-[120px]",
      cell: (r) => <div className="flex justify-center"><EstatusBadge status={r.detailed_status} /></div>,
    },
    {
      id: "date",
      header: "F. Pago",
      align: "center",
      widthClass: "w-[140px]",
      sortable: true,
      sortAccessor: (r) => (r.fecha_pago ? new Date(r.fecha_pago).getTime() : 0),
      cellClassName: "text-xs whitespace-nowrap truncate",
      cell: (r) => fmtFecha(r.fecha_pago),
    },
    {
      id: "comprobante",
      header: "Comprobante",
      align: "center",
      widthClass: "w-[110px]",
      // Solo lectura: el agente NUNCA sube aquí; ve la evidencia de pago que cargó la empresa.
      cell: (r) => {
        const tiene = !!r.url_evidencia_pago;
        return (
          <IconButton
            icon={Eye}
            disabled={!tiene}
            tooltip={tiene ? "Ver evidencia de pago" : "Sin evidencia de pago"}
            onClick={tiene ? () => onView(r.url_evidencia_pago!, `Evidencia de pago · ${r.cuenta_cobranza_label}`) : undefined}
          />
        );
      },
    },
    {
      id: "factura",
      header: "Factura",
      align: "center",
      widthClass: "w-[110px]",
      cell: (r) =>
        r.factura_url ? (
          <IconButton icon={Eye} tooltip="Ver factura" onClick={() => onView(r.factura_url!, `Factura · ${r.cuenta_cobranza_label}`)} />
        ) : (
          renderFacturaUpload?.(r) ?? (
            <IconButton icon={Eye} disabled tooltip="Podrás subir tu factura cuando la comisión sea aprobada" />
          )
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={rowKey ?? ((r) => r.id_cuenta_cobranza)}
      pageSize={pageSize}
      minWidthClass="min-w-[1200px]"
      emptyLabel={emptyLabel}
      countLabel={(from, to, total) => `${from.toLocaleString("es-MX")} a ${to.toLocaleString("es-MX")} de ${total.toLocaleString("es-MX")} comisiones`}
    />
  );
}
