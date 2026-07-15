import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Download,
  FileCode,
  Receipt,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import JSZip from "jszip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFacturasDocumentos } from "@/lib/portal-cliente/use-facturas-documentos";
import { useFacturasMantenimiento } from "@/lib/portal-cliente/use-facturas-mantenimiento";
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

// ─── Download helpers ─────────────────────────────────────────────────────────

function triggerAnchorDownload(href: string, fileName?: string) {
  const a = document.createElement("a");
  a.href = href;
  if (fileName) a.download = fileName;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function downloadFactura(url: string, fileName: string) {
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (driveMatch) {
    triggerAnchorDownload(`https://drive.google.com/uc?export=download&id=${driveMatch[1]}`);
    return;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    triggerAnchorDownload(objUrl, fileName);
    setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
  } catch {
    triggerAnchorDownload(url);
  }
}

async function downloadFacturaZip(
  pdf: string | undefined,
  xml: string | undefined,
  cuentaId: string,
) {
  if (!pdf && !xml) return;
  if (!pdf) {
    downloadFactura(xml!, `factura-${cuentaId}.xml`);
    return;
  }
  if (!xml) {
    downloadFactura(pdf!, `factura-${cuentaId}.pdf`);
    return;
  }
  try {
    const zip = new JSZip();
    const [pdfRes, xmlRes] = await Promise.all([
      fetch(pdf).catch(() => null),
      fetch(xml).catch(() => null),
    ]);
    if (pdfRes?.ok) zip.file(`factura-${cuentaId}.pdf`, await pdfRes.blob());
    if (xmlRes?.ok) zip.file(`factura-${cuentaId}.xml`, await xmlRes.blob());
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const objUrl = URL.createObjectURL(zipBlob);
    triggerAnchorDownload(objUrl, `facturas-${cuentaId}.zip`);
    setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
  } catch {
    downloadFactura(pdf, `factura-${cuentaId}.pdf`);
    setTimeout(() => downloadFactura(xml, `factura-${cuentaId}.xml`), 400);
  }
}

// ─── Facturas CFDI ────────────────────────────────────────────────────────────

type FacturaEntry = {
  id: string;
  title: string;
  subtitle: string;
  fileBase: string;
  pdf?: string;
  xml?: string;
};

const FacturasSection = ({
  title,
  facturas,
  onSelect,
}: {
  title: string;
  facturas: FacturaEntry[];
  onSelect: (id: string) => void;
}) => (
  <section className="px-5 md:px-0 py-1.5">
    <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 px-1">
      {title}
    </p>
    <div className="rounded-md border border-border overflow-hidden">
      <div className="divide-y divide-border/40">
        {facturas.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-card hover:bg-muted/20 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{f.title}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {f.subtitle}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {f.pdf && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 border border-red-200 text-red-600 font-semibold">
                  PDF
                </span>
              )}
              {f.xml && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 border border-blue-200 text-blue-600 font-semibold">
                  XML
                </span>
              )}
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  </section>
);

const FacturaModalContent = ({
  factura,
  onClose,
  isMobile,
}: {
  factura: FacturaEntry;
  onClose: () => void;
  isMobile: boolean;
}) => (
  <>
    <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
      <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Receipt className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-base text-foreground">{factura.title}</h2>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {factura.subtitle}
        </p>
      </div>
    </div>

    <div className="px-5 py-4 flex-1 overflow-y-auto">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-3">
        Archivos disponibles
      </p>
      <div className={isMobile ? "space-y-2" : "grid grid-cols-2 gap-3"}>
        {factura.pdf && (
          <button
            onClick={() => downloadFactura(factura.pdf!, `factura-${factura.fileBase}.pdf`)}
            className="w-full flex items-center gap-3 p-3.5 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors text-left group"
          >
            <div className="w-9 h-9 rounded-md bg-red-100 flex items-center justify-center shrink-0 group-hover:bg-red-200 transition-colors">
              <FileText className="w-4 h-4 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">PDF</p>
              <p className="text-[11px] text-muted-foreground">Factura imprimible</p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
          </button>
        )}
        {factura.xml && (
          <button
            onClick={() => downloadFactura(factura.xml!, `factura-${factura.fileBase}.xml`)}
            className="w-full flex items-center gap-3 p-3.5 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors text-left group"
          >
            <div className="w-9 h-9 rounded-md bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
              <FileCode className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">XML</p>
              <p className="text-[11px] text-muted-foreground">Archivo fiscal SAT</p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
          </button>
        )}
      </div>
    </div>

    <div
      className={`px-5 ${isMobile ? "pb-8" : "pb-5"} pt-3 border-t border-border/50 flex gap-2 shrink-0`}
    >
      {factura.pdf && factura.xml && (
        <button
          onClick={() => downloadFacturaZip(factura.pdf, factura.xml, factura.fileBase)}
          className="flex-1 h-10 flex items-center justify-center gap-2 text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/15 rounded-md transition-colors"
        >
          <Download className="w-4 h-4" />
          Descargar ZIP
        </button>
      )}
      <button
        onClick={onClose}
        className={`h-10 text-sm font-medium text-muted-foreground hover:bg-muted/60 rounded-md transition-colors px-4 ${
          !(factura.pdf && factura.xml) ? "flex-1" : ""
        }`}
      >
        Cerrar
      </button>
    </div>
  </>
);

const FacturaDetailModal = ({
  factura,
  open,
  onClose,
}: {
  factura: FacturaEntry;
  open: boolean;
  onClose: () => void;
}) => {
  const isMobile = useIsMobile();
  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="p-0 max-w-md flex flex-col gap-0 overflow-hidden [&>button:last-child]:hidden">
          <FacturaModalContent factura={factura} onClose={onClose} isMobile={false} />
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[65dvh] p-0 flex flex-col overflow-hidden [&>button:last-child]:hidden"
      >
        <FacturaModalContent factura={factura} onClose={onClose} isMobile={true} />
      </SheetContent>
    </Sheet>
  );
};

// ─── Document groups ──────────────────────────────────────────────────────────

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
      headerLabel = inv
        ? `${inv.property.projectName} · U-${inv.property.unitNumber}`
        : `Propiedad ${groupKey}`;
    }
  } else {
    headerLabel = getStatusInfo(groupKey as DocumentStatus).label;
  }

  return (
    <section className="px-5 md:px-0 py-1.5">
      <div className="rounded-md border border-border overflow-hidden">
        <button
          onClick={onToggle}
          className={`w-full flex items-center justify-between px-4 py-3 bg-muted/25 hover:bg-muted/35 transition-colors ${!collapsed ? "border-b border-border/50" : ""}`}
        >
          <span className="font-semibold text-sm text-foreground text-left truncate pr-2">
            {headerLabel}
          </span>
          <div className="flex items-center gap-2 text-muted-foreground shrink-0">
            <span className="text-[11px] tabular-nums">
              {docs.length} doc{docs.length !== 1 ? "s" : ""}
            </span>
            {collapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </div>
        </button>
        {!collapsed && (
          <div className="divide-y divide-border/40">
            {docs.map((doc) => (
              <div key={doc.id} data-cta="cliente.documentos.abrir">
                <DocumentListItem document={doc} onClick={() => onSelectDoc(doc.id)} />
              </div>
            ))}
          </div>
        )}
      </div>
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
  <div className="px-5 md:px-0 py-16 text-center">
    <div className="w-14 h-14 rounded-md bg-muted/50 flex items-center justify-center mx-auto mb-4">
      <FileText className="w-6 h-6 text-muted-foreground/60" />
    </div>
    <p className="font-semibold text-base text-foreground">
      {hasFilters ? "Sin resultados" : "Sin documentos aún"}
    </p>
    <p className="text-sm text-muted-foreground mt-1.5 max-w-[260px] mx-auto leading-relaxed">
      {hasFilters
        ? "Ajusta o limpia los filtros para ver más documentos."
        : "Tus documentos aparecerán aquí conforme avance tu proceso."}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const ClienteDocumentos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedFacturaId, setSelectedFacturaId] = useState<string | null>(null);
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

  const { data: facturasRaw = [] } = useFacturasDocumentos();
  const facturas = useMemo(
    (): FacturaEntry[] =>
      facturasRaw.map((f) => {
        const inv = portfolio.find((p) => p.property.id === f.cuentaId);
        return {
          id: `prop-${f.cuentaId}`,
          title: "Factura CFDI",
          subtitle: inv
            ? `${inv.property.projectName} · U-${inv.property.unitNumber}`
            : `Cuenta ${f.cuentaId}`,
          fileBase: inv ? inv.property.unitNumber : f.cuentaId,
          pdf: f.pdf,
          xml: f.xml,
        };
      }),
    [facturasRaw, portfolio],
  );

  const { data: facturasMantRaw = [] } = useFacturasMantenimiento();
  const facturasMantenimiento = useMemo(
    (): FacturaEntry[] =>
      facturasMantRaw.map((f) => {
        const fecha = f.fechaPago
          ? new Date(f.fechaPago).toLocaleDateString("es-MX", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : null;
        return {
          id: `mant-${f.pagoId}`,
          title: "Factura mantenimiento",
          subtitle: `Pago #${f.pagoId}${fecha ? ` · ${fecha}` : ""}`,
          fileBase: `mantenimiento-${f.pagoId}`,
          pdf: f.pdf,
          xml: f.xml,
        };
      }),
    [facturasMantRaw],
  );

  const selectedFactura =
    selectedFacturaId != null
      ? ([...facturas, ...facturasMantenimiento].find(
          (f) => f.id === selectedFacturaId,
        ) ?? null)
      : null;

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
      const order: DocumentStatus[] = [
        "rechazado",
        "pendiente",
        "recibido",
        "validado",
        "firmado",
      ];
      return order.filter((k) => groupedDocs[k]?.length);
    }
    return Object.keys(groupedDocs);
  }, [groupedDocs, groupBy]);

  const selectedDoc = selectedDocId ? allDocs.find((d) => d.id === selectedDocId) : null;
  const hasActiveFilters = !!(filterStatus || filterProperty || filterType);

  // Facturas respetan filtros de propiedad y tipo ("cfdi"); no tienen estatus
  const filteredFacturas = useMemo(() => {
    if (filterStatus !== null) return [];
    if (filterType !== null && filterType !== "cfdi") return [];
    return facturas.filter((f) => {
      if (filterProperty && f.id !== `prop-${filterProperty}`) return false;
      return true;
    });
  }, [facturas, filterType, filterProperty, filterStatus]);

  // Facturas de mantenimiento: sin asociación a una propiedad del portafolio,
  // por eso se ocultan cuando hay filtro de propiedad activo.
  const filteredFacturasMantenimiento = useMemo(() => {
    if (filterStatus !== null) return [];
    if (filterType !== null && filterType !== "cfdi") return [];
    if (filterProperty) return [];
    return facturasMantenimiento;
  }, [facturasMantenimiento, filterType, filterProperty, filterStatus]);

  const showEmptyState =
    !isLoading &&
    filteredDocs.length === 0 &&
    filteredFacturas.length === 0 &&
    filteredFacturasMantenimiento.length === 0;

  return (
    <div className="animate-fade-in">
      <header className="px-5 md:px-0 pt-6 pb-5">
        <h1 className="font-bold text-[22px] md:text-[26px] tracking-tight text-foreground">
          Documentos
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          {!isLoading && allDocs.length > 0
            ? `${stats.validado + stats.firmado} de ${stats.total} documentos verificados`
            : "Todos tus documentos en un solo lugar."}
        </p>
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

      <div className="pb-8 pt-3">
        {isLoading ? (
          <div className="px-5 md:px-0 py-2 space-y-1.5">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-md border border-border overflow-hidden">
                <div className="h-11 bg-muted/40 animate-pulse" />
                <div className="divide-y divide-border/40">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-[58px] bg-card animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : showEmptyState ? (
          <EmptyState
            onClearFilters={() => setSearchParams({}, { replace: true })}
            hasFilters={hasActiveFilters}
          />
        ) : (
          <>
            {orderedGroupKeys.map((groupKey) => (
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
            ))}
            {filteredFacturas.length > 0 && (
              <FacturasSection
                title="Facturas · Propiedad"
                facturas={filteredFacturas}
                onSelect={setSelectedFacturaId}
              />
            )}
            {filteredFacturasMantenimiento.length > 0 && (
              <FacturasSection
                title="Facturas · Mantenimiento"
                facturas={filteredFacturasMantenimiento}
                onSelect={setSelectedFacturaId}
              />
            )}
          </>
        )}
      </div>

      {selectedDoc && (
        <DocumentDetailSheet
          document={selectedDoc}
          open={!!selectedDoc}
          onClose={() => setSelectedDocId(null)}
        />
      )}

      {selectedFactura && (
        <FacturaDetailModal
          factura={selectedFactura}
          open={!!selectedFactura}
          onClose={() => setSelectedFacturaId(null)}
        />
      )}
    </div>
  );
};

export default ClienteDocumentos;
