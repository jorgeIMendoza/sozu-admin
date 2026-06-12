import sozuLogo from "@/assets/sozu-logo.png";
import type { Agent } from "@/lib/offers/agent-data";
import {
  Building2, CreditCard, HardHat, Home, Images,
  LayoutTemplate, Leaf, MapPin, Menu, Phone,
  ScanEye, Sparkles, Star, User, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import AgentBadge from "./AgentBadge";

interface NavSection {
  id: string;
  label: string;
}

interface PublicShellProps {
  children: React.ReactNode;
  agent?: Agent;
  contactPhone?: string;
  developmentLogoUrl?: string;
  developmentName?: string;
  navSections?: NavSection[];
  onNavClick?: (id: string) => void;
  activeSectionId?: string;
  noFooter?: boolean;
}

const SECTION_ICONS: Record<string, LucideIcon> = {
  gallery:          Images,
  agent:            User,
  details:          Home,
  "floor-plan":     LayoutTemplate,
  "tour-360":       ScanEye,
  "payment-plans":  CreditCard,
  highlights:       Star,
  construction:     HardHat,
  amenities:        Leaf,
  location:         MapPin,
  development:      Building2,
};

const PublicShell = ({
  children,
  agent,
  contactPhone = "+52 33 3306 6660",
  developmentLogoUrl,
  developmentName,
  navSections,
  onNavClick,
  activeSectionId,
  noFooter,
}: PublicShellProps) => {
  const telHref = `tel:${contactPhone.replace(/\s+/g, "")}`;
  const [mobileNavMounted, setMobileNavMounted] = useState(false);
  const [mobileNavVisible, setMobileNavVisible] = useState(false);
  const DURATION = 300;

  const openNav = () => {
    setMobileNavMounted(true);
    // Next frame: trigger transition from initial (off) to visible
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setMobileNavVisible(true))
    );
  };

  const closeNav = () => {
    setMobileNavVisible(false);
    setTimeout(() => setMobileNavMounted(false), DURATION);
  };

  useEffect(() => {
    document.body.style.overflow = mobileNavMounted ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileNavMounted]);

  useEffect(() => {
    if (!mobileNavMounted) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeNav(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileNavMounted]);

  const handleNavClick = (id: string) => {
    closeNav();
    setTimeout(() => onNavClick?.(id), DURATION + 20);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">

          {/* SOZU logo */}
          <div className="shrink-0 self-center h-7 flex items-center max-w-[90px]">
            <img
              src={sozuLogo}
              alt="SOZU"
              className="h-full w-auto object-contain dark:invert block"
            />
          </div>

          {/* Center: dev logo or name */}
          <div className="flex-1 flex items-center justify-center min-w-0 overflow-hidden self-center">
            {developmentLogoUrl ? (
              <div className="h-7 flex items-center justify-center max-w-[130px] overflow-hidden">
                <img
                  src={developmentLogoUrl}
                  alt={developmentName ?? "Desarrollo"}
                  className="h-full w-auto max-w-full object-contain block"
                />
              </div>
            ) : developmentName ? (
              <span className="text-[11px] font-bold text-foreground/60 uppercase tracking-[0.2em] truncate">
                {developmentName}
              </span>
            ) : null}
          </div>

          {/* Right */}
          <div className="shrink-0 self-center flex items-center gap-2">
            {/* Mobile hamburger */}
            {navSections && navSections.length > 0 && (
              <button
                type="button"
                aria-label={mobileNavMounted ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={mobileNavMounted}
                onClick={() => mobileNavMounted ? closeNav() : openNav()}
                className="lg:hidden h-11 w-11 flex items-center justify-center rounded-md hover:bg-muted/60 transition-colors text-foreground"
              >
                {mobileNavMounted ? <X className="w-full h-full" /> : <Menu className="w-full h-full" />}
              </button>
            )}
            {/* Desktop */}
            <div className="hidden lg:flex items-center">
              {agent ? (
                <AgentBadge agent={agent} />
              ) : (
                <a
                  href={telHref}
                  className="inline-flex items-center gap-2 px-3 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{contactPhone}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── MOBILE NAV — drawer lateral derecha ── */}
      {mobileNavMounted && navSections && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 top-14 z-50 transition-opacity duration-300 ease-in-out"
            style={{ background: "rgba(0,0,0,0.4)", opacity: mobileNavVisible ? 1 : 0 }}
            onClick={closeNav}
          />

          {/* Drawer */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="lg:hidden fixed top-14 right-0 bottom-0 z-50 bg-card border-l border-border shadow-2xl flex flex-col w-[min(280px,82vw)] transition-transform duration-300 ease-in-out"
            style={{ transform: mobileNavVisible ? "translateX(0)" : "translateX(100%)" }}
          >

            {/* Secciones */}
            <nav className="flex-1 overflow-y-auto pt-3 px-2 pb-2 space-y-1">
              {navSections.map((s) => {
                const Icon = SECTION_ICONS[s.id] ?? Sparkles;
                const isActive = activeSectionId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleNavClick(s.id)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-150 group ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/60 hover:text-foreground text-muted-foreground"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                    <span className={`text-[14px] leading-tight transition-colors ${isActive ? "font-semibold" : "font-medium"}`}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Asesor al pie */}
            {agent && (
              <div className="shrink-0 border-t border-border p-3">
                <div className="flex items-center gap-3 px-2 py-2">
                  {agent.photoUrl ? (
                    <img
                      src={agent.photoUrl}
                      alt={agent.firstName}
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-border"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground/60 leading-none mb-0.5">Tu asesor</p>
                    <p className="text-[13px] font-semibold text-foreground truncate">
                      {agent.fullName}
                    </p>
                  </div>
                  {agent.phone && (
                    <a
                      href={`tel:${agent.phone.replace(/\s+/g, "")}`}
                      className="shrink-0 h-11 w-11 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <main className="flex-1">{children}</main>

      {!noFooter && (
      <footer className="border-t border-border bg-card/40 mb-20 lg:mb-0">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-5">
          <p className="text-[11px] leading-relaxed text-muted-foreground text-center">
            SOZU © 2026 · Esta oferta es informativa y no constituye contrato de compraventa.
            Sujeta a disponibilidad y validez vigente. Precios en MXN.
          </p>
        </div>
      </footer>
      )}
    </div>
  );
};

export default PublicShell;
