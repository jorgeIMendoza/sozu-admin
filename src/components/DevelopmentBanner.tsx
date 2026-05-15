import { ENVIRONMENT } from "@/lib/config";
import { Construction, Eye } from "lucide-react";

export function DevelopmentBanner() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isDevHost = hostname.endsWith("-dev.sozu.com");

  if (ENVIRONMENT === "preview" && !isDevHost) {
    return (
      <div className="w-full bg-blue-300 text-blue-900 py-2 px-4 text-center font-bold text-sm flex items-center justify-center gap-2">
        <Eye className="h-4 w-4" />
        AMBIENTE DE PREVIEW 🚨
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
