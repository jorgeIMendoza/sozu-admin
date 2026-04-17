import { useEffect, useMemo, useState } from "react";

/**
 * Generic client-side pagination hook.
 * Resets to page 1 whenever the source array reference or its length changes.
 */
export function usePagination<T>(items: T[], pageSize = 50) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Clamp current page if data shrinks
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const from = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, items.length);

  return {
    page,
    setPage,
    totalPages,
    pageSize,
    paginated,
    total: items.length,
    from,
    to,
  };
}
