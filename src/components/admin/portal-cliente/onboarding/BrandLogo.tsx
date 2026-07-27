import sozuLogo from "@/assets/sozu-logo-black.png";
import sozuLogoLight from "@/assets/sozu-logo-white.png";

interface Props {
  className?: string;
  showTagline?: boolean;
  variant?: "dark" | "light";
}

export function BrandLogo({ className = "", showTagline = true, variant = "dark" }: Props) {
  const src = variant === "light" ? sozuLogoLight : sozuLogo;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={src}
        alt="SOZU"
        className="h-6 w-auto select-none"
        draggable={false}
      />
      {showTagline && (
        <span className="border-l border-border pl-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Portal del Cliente
        </span>
      )}
    </div>
  );
}
