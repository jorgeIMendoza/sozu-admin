import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import {
  getDocumentStats,
  getStatusInfo,
  type DocumentRecord,
  type DocumentStatus,
  type DocumentType,
} from "@/lib/portal-cliente/document-data";
import { useClienteDocuments } from "@/lib/portal-cliente/use-documents";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import DocumentListItem from "@/components/admin/portal-cliente/documents/DocumentListItem";
import DocumentDetailSheet from "@/components/admin/portal-cliente/documents/DocumentDetailSheet";
import DocumentStatsBar from "@/components/admin/portal-cliente/documents/DocumentStatsBar";
import DocumentFilters from "@/components/admin/portal-cliente/documents/DocumentFilters";

const statusPriority: Record<DocumentStatus, number> = {
  rechazado: 0,
  pendiente: 1,
  recibido: 2,
  validado: 3,
  firmado: 4,
};

function sortByActionPriority(a: DocumentRecord, b: DocumentRecord): number {
  return statusPriority[a.status] - statusPriority[b.status];
}

const GroupSection = ({
  groupKey,
  groupBy,
  docs,
  portfolio,
  onSelectDoc,
  collapsed,
  onToggle,
}: {
  groupKey: string;
  groupBy: "property" | "status";
  docs: DocumentRecord[];
  portfolio: InvestmentProperty[];
  onSelectDoc: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) => {
  let headerLabel = "";
  if (groupBy === "property") {
    if (groupKey === "persona") {
      headerLabel = "Documentos personales";
    } else {
      const inv = portfolio.find((p) => p.property.id === groupKey);
      headerLabel = inv ? `${inv.property.projectName} · U-${inv.property.unitNumber}` : `Propiedad ${groupKey}`;
    }
  } else {
    headerLabel = getStatusInfo(groupKey as DocumentStatus).label;
  }
  const headerSubLabel = `${docs.length} documento${docs.length !== 1 ? "s" : ""}`;

  return (
    <section className="px-5 md:px-0 py-3">
      <button
        onClick={onToggle}
        className="flex items-baseline justify-between w-full mb-2 group"
      >
        <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{headerLabel}</h3>
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {headerSubLabel}
          {collapsed
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronUp className="w-3.5 h-3.5" />
          }
        </span>
      </button>
      {!collapsed && (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} data-cta="cliente.documentos.abrir">
              <DocumentListItem document={doc} onClick={() => onSelectDoc(doc.id)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const EmptyState = ({
  onClearFilters,
  hasFilters,
}: {
  onClearFilters: () => void;
  hasFilters: boolean;
}) => (
  <div className="px-5 md:px-0 py-12 text-center">
    <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
      <FileText className="w-6 h-6 text-muted-foreground" />
    </div>
    <p className="font-semibold text-base text-foreground">
      {hasFilters ? "Sin resultados con esos filtros" : "Aún no tienes documentos"}
    </p>
    <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
      {hasFilters
        ? "Prueba ajustar los filtros o limpiarlos para ver todos los documentos."
        : "Tus documentos aparecerán acá conforme avancen tus procesos."}
    </p>
    {hasFilters && (
      <button
        data-cta="cliente.documentos.limpiar-filtros"
        onClick={onClearFilters}
        className="mt-4 text-sm text-primary font-semibold hover:underline"
      >
        Limpiar filtros
      </button>
    )}
  </div>
);

const ClienteDocumentos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const filterStatus = (searchParams.get("estado") as DocumentStatus | null) ?? null;
  const filterProperty = searchParams.get("propiedad");
  const filterType = (searchParams.get("tipo") as DocumentType | null) ?? null;
  const groupBy = (searchParams.get("agrupar") as "property" | "status" | null) ?? "property";

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value === null || value === "todos") params.delete(key);
    else params.set(key, value);
    setSearchParams(params, { replace: true });
  };

  const { data: allDocs = [], isLoading } = useClienteDocuments();
  const { data: portfolio = [] } = usePortfolioCliente();
  const stats = getDocumentStats(allDocs);

  const filteredDocs = useMemo(() => {
    return allDocs.filter((doc) => {
      if (filterStatus && doc.status !== filterStatus) return false;
      if (filterProperty && doc.propertyId !== filterProperty) return false;
      if (filterType && doc.type !== filterType) return false;
      return true;
    });
  }, [allDocs, filterStatus, filterProperty, filterType]);

  const groupedDocs = useMemo(() => {
    const groups: Record<string, DocumentRecord[]> = {};
    if (groupBy === "property") {
      filteredDocs.forEach((doc) => {
        (groups[doc.propertyId] ||= []).push(doc);
      });
      Object.values(groups).forEach((arr) => arr.sort(sortByActionPriority));
    } else {
      filteredDocs.forEach((doc) => {
        (groups[doc.status] ||= []).push(doc);
      });
    }
    return groups;
  }, [filteredDocs, groupBy]);

  const orderedGroupKeys = useMemo(() => {
    if (groupBy === "status") {
      const order: DocumentStatus[] = ["rechazado", "pendiente", "recibido", "validado", "firmado"];
      return order.filter((k) => groupedDocs[k]?.length);
    }
    return Object.keys(groupedDocs);
  }, [groupedDocs, groupBy]);

  const selectedDoc = selectedDocId ? allDocs.find((d) => d.id === selectedDocId) : null;
  const hasActiveFilters = !!(filterStatus || filterProperty || filterType);

  return (
    <div className="animate-fade-in">
      <header className="px-5 md:px-0 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
              Documentos
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              Todos los documentos de tus propiedades en un solo lugar.
            </p>
          </div>
        </div>
      </header>

      <DocumentStatsBar
        stats={stats}
        activeStatus={filterStatus}
        onSelectStatus={(s) => updateFilter("estado", s)}
      />
      <DocumentFilters
        portfolio={portfolio}
        filterProperty={filterProperty}
        filterType={filterType}
        groupBy={groupBy}
        onChangeProperty={(v) => updateFilter("propiedad", v)}
        onChangeType={(v) => updateFilter("tipo", v)}
        onChangeGroupBy={(v) => updateFilter("agrupar", v)}
        hasActiveFilters={hasActiveFilters}
        onClearAll={() => setSearchParams({}, { replace: true })}
      />

      <div className="pb-6">
        {isLoading ? (
          <div className="px-5 md:px-0 py-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <EmptyState
            onClearFilters={() => setSearchParams({}, { replace: true })}
            hasFilters={hasActiveFilters}
          />
        ) : (
          orderedGroupKeys.map((groupKey) => (
            <GroupSection
              key={groupKey}
              groupKey={groupKey}
              groupBy={groupBy}
              docs={groupedDocs[groupKey]}
              portfolio={portfolio}
              onSelectDoc={setSelectedDocId}
              collapsed={collapsedGroups.has(groupKey)}
              onToggle={() => toggleGroup(groupKey)}
            />
          ))
        )}
      </div>

      {selectedDoc && (
        <DocumentDetailSheet
          document={selectedDoc}
          open={!!selectedDoc}
          onClose={() => setSelectedDocId(null)}
        />
      )}
    </div>
  );
};

export default ClienteDocumentos;
