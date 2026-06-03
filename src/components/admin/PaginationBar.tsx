import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ADMIN_PAGE_SIZE = 50;

/**
 * Paginación compartida para todas las tablas del Portal de Administración.
 * El consumidor controla `page` (0-based) y recibe `totalPages` calculado
 * a partir de `totalCount` y `pageSize` (default 50).
 */
export function PaginationBar({
  page,
  totalPages,
  totalCount,
  pageSize = ADMIN_PAGE_SIZE,
  onPageChange,
  loading,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize?: number;
  onPageChange: (p: number) => void;
  loading?: boolean;
}) {
  if (totalCount === 0) return null;
  const from = page * pageSize + 1;
  const to = Math.min(totalCount, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-end gap-2 mt-3 text-xs">
      <span className="tabular-nums text-muted-foreground mr-2">
        {from}–{to} de {totalCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2"
        disabled={page === 0 || loading}
        onClick={() => onPageChange(Math.max(0, page - 1))}
      >
        <ChevronLeft className="h-3.5 w-3.5 mr-1" />
        Anterior
      </Button>
      <span className="tabular-nums text-muted-foreground">
        Página <span className="font-semibold text-foreground">{page + 1}</span> de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2"
        disabled={page >= totalPages - 1 || loading}
        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
      >
        Siguiente
        <ChevronRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    </div>
  );
}
