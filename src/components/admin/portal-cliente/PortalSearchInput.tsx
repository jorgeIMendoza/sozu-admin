import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";

interface PortalSearchInputProps {
  className?: string;
  inputHeight?: string;
}

export function PortalSearchInput({ className, inputHeight = "h-8" }: PortalSearchInputProps) {
  const navigate = useNavigate();
  const { data: portfolio } = usePortfolioCliente();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setQuery("");
        setDebouncedQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDropdown = debouncedQuery.length >= 2;
  const q = debouncedQuery.toLowerCase();

  const propertyResults = showDropdown
    ? (portfolio ?? [])
        .filter(
          (inv) =>
            inv.property.projectName.toLowerCase().includes(q) ||
            inv.property.unitNumber.toLowerCase().includes(q),
        )
        .slice(0, 4)
    : [];

  const showDocumentos = showDropdown && (q.includes("doc") || q.includes("exped"));
  const showPagos = showDropdown && (q.includes("pago") || q.includes("historial"));
  const hasResults = propertyResults.length > 0 || showDocumentos || showPagos;

  const clearSearch = () => {
    setQuery("");
    setDebouncedQuery("");
  };

  return (
    <div className={className} ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar propiedades, documentos, pagos…"
          className={`w-full pl-9 pr-3 rounded-md bg-muted/60 border border-transparent text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:bg-muted/80 transition-colors ${inputHeight}`}
        />
        {showDropdown && hasResults && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            {propertyResults.map((inv) => (
              <button
                key={inv.property.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  navigate(`/admin/portal-cliente/propiedad/${inv.property.id}`);
                  clearSearch();
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[13px] hover:bg-muted/60 transition-colors"
              >
                <span className="font-medium text-foreground truncate">{inv.property.projectName}</span>
                <span className="text-muted-foreground shrink-0">· {inv.property.unitNumber}</span>
              </button>
            ))}
            {showDocumentos && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  navigate("/admin/portal-cliente/documentos");
                  clearSearch();
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[13px] hover:bg-muted/60 transition-colors"
              >
                <span className="font-medium text-foreground">Mi expediente</span>
              </button>
            )}
            {showPagos && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  navigate("/admin/portal-cliente/pagos");
                  clearSearch();
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[13px] hover:bg-muted/60 transition-colors"
              >
                <span className="font-medium text-foreground">Historial de pagos</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
