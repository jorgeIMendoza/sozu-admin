import { ENVIRONMENT } from "@/lib/config";
import { Construction, Eye } from "lucide-react";

export function DevelopmentBanner() {
  if (ENVIRONMENT === "development") {
    return (
      <div className="w-full bg-yellow-400 text-black py-2 px-4 text-center font-bold text-sm flex items-center justify-center gap-2">
        <Construction className="h-4 w-4" />
        AMBIENTE DE DESARROLLO
      </div>
    );
  }

  if (ENVIRONMENT === "preview") {
    return (
      <div className="w-full bg-blue-500 text-white py-2 px-4 text-center font-bold text-sm flex items-center justify-center gap-2">
        <Eye className="h-4 w-4" />
        AMBIENTE DE PREVIEW
      </div>
    );
  }

  return null;
}
