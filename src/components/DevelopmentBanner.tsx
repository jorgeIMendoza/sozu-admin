import { ENVIRONMENT } from "@/lib/config";
import { Construction, Eye } from "lucide-react";

export function DevelopmentBanner() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isDevHost = hostname.endsWith("-dev.sozu.com");

  if (ENVIRONMENT === "preview" && !isDevHost) {
    return (
      <div className="w-full bg-blue-100 text-blue-800 py-1.5 px-4 text-center font-medium text-xs tracking-wide flex items-center justify-center gap-2 border-b border-blue-200">
        <Eye className="h-3.5 w-3.5" />
        AMBIENTE DE PREVIEW
      </div>
    );
  }

  if (ENVIRONMENT === "development" || isDevHost) {
    return (
      <div className="w-full bg-yellow-400 text-black py-2 px-4 text-center font-bold text-sm flex items-center justify-center gap-2">
        <Construction className="h-4 w-4" />
        AMBIENTE DE DESARROLLO
      </div>
    );
  }

  return null;
}
