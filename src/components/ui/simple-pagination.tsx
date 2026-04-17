import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SimplePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  from?: number;
  to?: number;
  className?: string;
  /** Hide when there is only one page (default true). */
  hideWhenSinglePage?: boolean;
}

/**
 * Compact numbered pagination: « 1 2 3 … N » with a "Mostrando X–Y de Z" hint.
 * Designed to be reused across portal-cobranza listings (50 per page).
 */
export function SimplePagination({
  page,
  totalPages,
  onPageChange,
  total,
  from,
  to,
  className,
  hideWhenSinglePage = true,
}: SimplePaginationProps) {
  if (hideWhenSinglePage && totalPages <= 1) return null;

  const pages = buildPageList(page, totalPages);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 border-t border-border",
        className,
      )}
    >
      {total !== undefined && from !== undefined && to !== undefined ? (
        <p className="text-[12px] text-muted-foreground">
          Mostrando {from.toLocaleString()}–{to.toLocaleString()} de {total.toLocaleString()}
        </p>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ell-${i}`} className="px-2 text-[12px] text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "min-w-[28px] h-7 px-2 rounded-md text-[12px] font-medium transition-colors",
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label="Página siguiente"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

/** Build a compact list of pages with ellipses for large totals. */
function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);

  return pages;
}
