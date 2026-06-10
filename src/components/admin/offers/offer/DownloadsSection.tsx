/** @deprecated 18.11.E — Eliminado del JSX de OfferLandingPage por retro comercial. Conservado por reversibilidad. */
import { useState } from "react";
import { Download, FileText, Map, Layers, Mail, ArrowRight, Check } from "lucide-react";
import type { DownloadableAsset, DownloadableAssetType } from "@/lib/offers/offer-data";

interface DownloadsSectionProps {
  assets: DownloadableAsset[];
  offerCode: string;
}

const ASSET_ICONS: Record<DownloadableAssetType, typeof FileText> = {
  brochure: FileText,
  floor_plan_hires: Map,
  materials_spec: Layers,
  legal_doc: FileText,
};

const DownloadsSection = ({ assets, offerCode }: DownloadsSectionProps) => {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  if (!assets || assets.length === 0) return null;

  const handleDownload = (asset: DownloadableAsset) => {
    window.open(asset.fileUrl, "_blank", "noopener,noreferrer");
  };

  const handleSendEmail = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setSendingEmail(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSendingEmail(false);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 4000);
  };

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Download className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Lleva esta oferta contigo</h3>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed pl-9">
          Descarga lo que necesites para revisar con tu familia, abogado o asesor financiero.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {assets.map((asset) => {
            const Icon = ASSET_ICONS[asset.type] ?? FileText;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => handleDownload(asset)}
                className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/20 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground mb-1">{asset.label}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed mb-3 min-h-[28px]">{asset.description}</p>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
                    {asset.fileFormat ?? "PDF"}{asset.fileSizeMb ? ` · ${asset.fileSizeMb} MB` : ""}
                  </p>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                    Descargar
                    <Download className="w-3 h-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl bg-primary/[0.04] border border-primary/15 p-4">
          <div className="flex items-start gap-3 mb-3">
            <Mail className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground mb-0.5">¿Prefieres recibirla por email?</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Te enviamos la oferta completa <strong className="font-mono text-foreground">{offerCode}</strong> al correo que indiques, con los archivos adjuntos.
              </p>
            </div>
          </div>

          {!emailSent ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                disabled={sendingEmail}
                className="flex-1 h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none transition-colors disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={!email || sendingEmail}
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {sendingEmail ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Enviar oferta
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Check className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <p className="text-xs text-foreground">
                <strong>Enviado.</strong> Revisa tu bandeja de entrada (y la carpeta de spam por si acaso).
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DownloadsSection;
