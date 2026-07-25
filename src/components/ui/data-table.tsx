import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Tabla genérica reutilizable (esqueleto): orden y paginación client-side,
 * definida por columnas. Toda personalización entra por props; el Tailwind se
 * inyecta con `*ClassName` / `widthClass` / `minWidthClass`, y cada celda se
 * renderiza con `column.cell`. Úsala como base para tablas de la app.
 */

export type DataTableAlign = "left" | "center" | "right";

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  align?: DataTableAlign;
  /** Ancho de columna, p. ej. "w-[150px]". Requerido si `tableFixed`. */
  widthClass?: string;
  sortable?: boolean;
  /** Valor por el que ordenar cuando la columna es sortable. */
  sortAccessor?: (row: T) => string | number;
  cell: (row: T, ctx: { index: number; rowNumber: number }) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  pageSize?: number;
  /** Ancho mínimo de la tabla (activa scroll horizontal), p. ej. "min-w-[1200px]". */
  minWidthClass?: string;
  tableFixed?: boolean;
  rowClassName?: string | ((row: T) => string);
  emptyLabel?: ReactNode;
  /** Texto del footer de conteo. Recibe rango (1-index) y total. */
  countLabel?: (from: number, to: number, total: number) => ReactNode;
  className?: string;
  containerClassName?: string;
}

const alignCls = (a?: DataTableAlign) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  pageSize = 15,
  minWidthClass,
  tableFixed = true,
  rowClassName,
  emptyLabel = "Sin registros",
  countLabel,
  className,
  containerClassName,
}: DataTableProps<T>) {
  const [sortId, setSortId] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const toggleSort = (id: string) => {
    if (sortId === id) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortId(id); setDir("asc"); }
    setPage(1);
  };

  const sortCol = columns.find((c) => c.id === sortId && c.sortable && c.sortAccessor);
  const sorted = sortCol
    ? [...rows].sort((a, b) => {
        const va = sortCol.sortAccessor!(a);
        const vb = sortCol.sortAccessor!(b);
        if (va < vb) return dir === "asc" ? -1 : 1;
        if (va > vb) return dir === "asc" ? 1 : -1;
        return 0;
      })
    : rows;

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | "...")[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  if (total === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className={cn("rounded-md border border-border bg-card overflow-hidden", containerClassName)}>
        <div className="overflow-x-auto">
          <Table className={cn(minWidthClass, tableFixed && "table-fixed")}>
            <TableHeader>
              <TableRow>
                {columns.map((col) => {
                  const active = sortId === col.id;
                  return (
                    <TableHead
                      key={col.id}
                      className={cn("h-9 whitespace-nowrap uppercase tracking-wide text-xs font-semibold text-muted-foreground", alignCls(col.align), col.widthClass, col.headerClassName)}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.id)}
                          className={cn("inline-flex items-center gap-1 uppercase tracking-wide whitespace-nowrap select-none transition-colors",
                            col.align === "right" && "flex-row-reverse",
                            active ? "text-primary" : "hover:text-foreground")}
                        >
                          {col.header}
                          <ArrowUpDown strokeWidth={2.25} className={cn("size-3 shrink-0", active ? "text-primary" : "text-muted-foreground/50")} />
                        </button>
                      ) : (
                        col.header
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row, i) => {
                const rc = typeof rowClassName === "function" ? rowClassName(row) : rowClassName;
                return (
                  <TableRow key={rowKey(row, i)} className={cn("h-[52px]", rc)}>
                    {columns.map((col) => (
                      <TableCell key={col.id} className={cn(alignCls(col.align), col.cellClassName)}>
                        {col.cell(row, { index: i, rowNumber: start + i + 1 })}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {countLabel
            ? countLabel(start + 1, Math.min(start + pageSize, total), total)
            : `${(start + 1).toLocaleString("es-MX")} a ${Math.min(start + pageSize, total).toLocaleString("es-MX")} de ${total.toLocaleString("es-MX")}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`e-${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
              ) : (
                <Button key={p} variant={p === currentPage ? "default" : "outline"} size="icon" className="h-7 w-7 text-xs" onClick={() => setPage(p as number)}>{p}</Button>
              ),
            )}
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
