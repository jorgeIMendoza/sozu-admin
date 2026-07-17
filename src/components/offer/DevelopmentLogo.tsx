import type { DevelopmentInfo } from "@/lib/offers/offer-data";

interface Props {
  development?: DevelopmentInfo;
  developmentName: string;
  variant: "overlay" | "section" | "footer";
  className?: string;
}

const DevelopmentLogo = ({ development, developmentName, variant, className = "" }: Props) => {
  if (!development?.logoUrl && !development?.logoUrlInverse) return null;

  if (variant === "overlay") {
    const logoSrc = development.logoUrlInverse ?? development.logoUrl;
    if (!logoSrc) return null;
    const needsInvert = !development.logoUrlInverse;
    return (
      <div
        className={`inline-flex items-center px-3.5 py-2.5 rounded-md bg-black/45 backdrop-blur-md border border-white/10 shadow-lg ${className}`}
      >
        <img
          src={logoSrc}
          alt={`Logo ${developmentName}`}
          className={`h-8 md:h-10 w-auto object-contain ${needsInvert ? "invert" : ""}`}
        />
      </div>
    );
  }

  if (variant === "section") {
    const logoSrc = development.logoUrl ?? development.logoUrlInverse;
    if (!logoSrc) return null;
    const needsDarkInvert = !!development.logoUrl;
    return (
      <img
        src={logoSrc}
        alt={`Logo ${developmentName}`}
        className={`h-8 md:h-10 w-auto object-contain ${needsDarkInvert ? "dark:invert" : ""} ${className}`}
      />
    );
  }

  if (variant === "footer") {
    const logoSrc = development.logoUrl ?? development.logoUrlInverse;
    if (!logoSrc) return null;
    const needsDarkInvert = !!development.logoUrl;
    return (
      <img
        src={logoSrc}
        alt={`Logo ${developmentName}`}
        className={`h-7 md:h-9 w-auto object-contain ${needsDarkInvert ? "dark:invert" : ""} ${className}`}
      />
    );
  }

  return null;
};

export default DevelopmentLogo;
