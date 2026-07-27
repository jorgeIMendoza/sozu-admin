import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Fila compartida de "Secciones de tu perfil" (portal agente + portal cliente).
// Un solo estilo/paleta para ambos portales.
export function ProfileSectionRow({ title, description, badge, onClick }: {
  title: string;
  description: string;
  badge?: { label: string; color: string; bg: string } | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md border border-[#ECEEF0] bg-white px-4 py-[15px] text-left hover:border-[#CBD2D9]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[13.5px] font-bold text-[#171A1D]">{title}</span>
          {badge && (
            <span className={cn("rounded-full px-2.5 py-[3px] text-[9.5px] font-bold", badge.bg, badge.color)}>{badge.label}</span>
          )}
        </div>
        <p className="mt-1 text-[11.5px] font-medium text-[#9AA3AD]">{description}</p>
      </div>
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#9AA3AD]" strokeWidth={2} />
    </button>
  );
}
