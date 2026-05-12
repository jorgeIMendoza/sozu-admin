import { ENVIRONMENT } from "@/lib/config";

export function DevelopmentBanner() {
  if (ENVIRONMENT === "preview") {
    return (
      <div className="w-full bg-blue-300 text-blue-900 py-2 px-4 text-center font-bold text-sm">
        🚀 AMBIENTE PREVIEW 🚀
      </div>
    );
  }

  if (ENVIRONMENT === "development") {
    return (
      <div className="w-full bg-yellow-400 text-black py-2 px-4 text-center font-bold text-sm">
        🚧 AMBIENTE DE DESARROLLO 🚧
      </div>
    );
  }

  return null;
}
