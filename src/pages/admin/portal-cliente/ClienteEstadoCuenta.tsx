import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Download, ChevronRight, Search, Loader2, X } from "lucide-react";
import AccountStatementView from "@/components/admin/portal-cliente/AccountStatementView";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";
import { getPropertyStatus } from "@/lib/portal-cliente/mock-data";
import { fmtMXN as fmt } from "@/lib/utils";
import { PROD_FUNCTIONS_BASE_URL, PROD_SUPABASE_ANON_KEY } from "@/lib/config";

const statusStyles: Record<string, { bg: string; text: string }> = {
  "Pago Pendiente": { bg: "bg-warning/15", text: "text-warning" },
  "En Preventa": { bg: "bg-primary/15", text: "text-primary" },
  Entregada: { bg: "bg-success/15", text: "text-success" },
  "En Escrituración": { bg: "bg-primary/15", text: "text-primary" },
  "Por Entregar": { bg: "bg-primary/15", text: "text-primary" },
  Completado: { bg: "bg-success/15", text: "text-success" },
};

type PdfModal = { url: string; title: string } | null;

const ClienteEstadoCuenta = () => {
  const { data: portfolio = [], isLoading } = usePortfolioCliente();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfModal, setPdfModal] = useState<PdfModal>(null);

  useEffect(() => {
    if (!pdfModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPdfModal(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pdfModal]);

  async function handleDownloadEstadoCuenta(idCuenta: number, title: string) {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const res = await fetch(`${PROD_FUNCTIONS_BASE_URL}/generar-estado-cuenta`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PROD_SUPABASE_ANON_KEY}`,
          "apikey": PROD_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ id_cuenta: idCuenta }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url_estado_cuenta) {
        console.error("Error generating estado de cuenta:", data);
        return;
      }
      setPdfModal({ url: data.url_estado_cuenta, title });
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function downloadPdf(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objUrl), 10_000);
    } catch {
      window.open(url, "_blank");
    }
  }

  const propertyId = searchParams.get("p");

  const selected = portfolio.find(inv => inv.property.id === propertyId) ?? null;

  const filtered = portfolio.filter(inv =>
    `${inv.property.projectName} ${inv.property.unitNumber} ${inv.property.address}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="px-5 md:px-0 pt-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-lg" />
        <div className="h-4 w-64 bg-muted rounded-md" />
        <div className="h-20 bg-muted rounded-2xl" />
        <div className="h-20 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (selected) {
    return (
      <>
        <div className="animate-fade-in">
          <header className="px-5 md:px-0 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
                  Estado de cuenta
                </h1>
                <p className="text-[12px] text-muted-foreground truncate">
                  {selected.property.projectName} - U-{selected.property.unitNumber}
                </p>
              </div>
              <button
                onClick={() => handleDownloadEstadoCuenta(
                  parseInt(selected.property.id),
                  `${selected.property.projectName} - U${selected.property.unitNumber}`,
                )}
                disabled={generatingPdf}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-[0.97] transition-all shrink-0 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generatingPdf
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{generatingPdf ? "Generando…" : "Descargar PDF"}</span>
                <span className="sm:hidden">{generatingPdf ? "…" : "PDF"}</span>
              </button>
            </div>
          </header>
          <div className="px-5 md:px-0 pb-8">
            <AccountStatementView investment={selected} />
          </div>
        </div>

        {pdfModal && createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center"
            onClick={() => setPdfModal(null)}
          >
            <div
              className="bg-card w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col max-h-[90svh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
                <div>
                  <p className="text-sm font-semibold text-foreground">Estado de Cuenta</p>
                  <p className="text-[11px] text-muted-foreground">{pdfModal.title}</p>
                </div>
                <button
                  onClick={() => setPdfModal(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-destructive/15 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4 text-destructive" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden" style={{ minHeight: "60vh" }}>
                <iframe
                  src={pdfModal.url}
                  className="w-full h-full border-0"
                  title="Estado de Cuenta"
                  style={{ height: "60vh" }}
                />
              </div>
              <div className="px-5 py-4 border-t border-border shrink-0">
                <button
                  onClick={() => downloadPdf(pdfModal.url, `SOZU-EstadoCuenta-${pdfModal.title}.pdf`)}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-xl hover:bg-primary/90 transition-colors active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="animate-fade-in">
      <header className="px-5 md:px-0 pt-6 pb-4">
        <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
          Estado de cuenta
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">Selecciona una propiedad.</p>
      </header>

      <div className="px-5 md:px-0 pb-8 space-y-3">
        {portfolio.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No tienes propiedades activas.</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar propiedad…"
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2 max-h-[min(380px,60svh)] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin resultados</p>
              ) : (
                filtered.map(inv => {
                  const status = getPropertyStatus(inv);
                  const st = statusStyles[status.label] ?? { bg: "bg-muted", text: "text-muted-foreground" };
                  const progress = inv.financials.initialPrice > 0
                    ? Math.round((inv.financials.totalPaid / inv.financials.initialPrice) * 100)
                    : 0;
                  return (
                    <button
                      key={inv.property.id}
                      onClick={() => setSearchParams({ p: inv.property.id })}
                      className="w-full flex items-center gap-3.5 bg-card rounded-2xl border border-border p-4 transition-all active:scale-[0.98] hover:border-primary/30 text-left"
                    >
                      <div className={`w-10 h-10 rounded-xl ${st.bg} flex items-center justify-center shrink-0`}>
                        <span className={`font-display font-bold text-sm ${st.text}`}>{inv.property.unitNumber}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-sm text-foreground truncate">
                          {inv.property.projectName}
                          <span className="font-normal text-muted-foreground"> · U{inv.property.unitNumber}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[11px] font-medium ${st.text}`}>{status.label}</span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {progress}% pagado · {fmt(inv.financials.totalPaid)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClienteEstadoCuenta;
