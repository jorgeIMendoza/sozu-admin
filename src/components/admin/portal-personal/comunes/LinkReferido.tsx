import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { selectores } from "@/lib/portal-personal/selectores";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LinkReferido({
  variante = "destacada",
  metrica,
}: {
  variante?: "destacada" | "barra";
  metrica?: string;
}) {
  const usuario = usePortal((s) => s.usuario);
  const link = selectores.linkReferido(usuario);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`https://${link}`);
      toast.success("Link copiado");
    } catch {
      toast.error("No pudimos copiar el link");
    }
  };

  const compartir = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "SOZU", url: `https://${link}` });
        return;
      } catch {
        /* cancelado por el usuario */
      }
    }
    void copiar();
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        variante === "destacada"
          ? "border-verde/30 bg-verde-claro"
          : "border-border bg-background",
      )}
    >
      {variante === "destacada" && (
        <>
          <p className="eyebrow text-verde-oscuro">Tu link de referido</p>
          <p className="mt-1 text-xl font-bold text-negro">Comparte y gana.</p>
        </>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          readOnly
          value={link}
          aria-label="Tu link de referido"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-negro"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={copiar} className="bg-background">
            <Copy className="size-4" />
            Copiar
          </Button>
          <Button onClick={compartir}>
            <Share2 className="size-4" />
            Compartir
          </Button>
        </div>
      </div>

      {variante === "destacada" && (
        <p className="mt-3 text-sm text-gris">
          Quien entre por tu link queda registrado a tu nombre automáticamente.
        </p>
      )}
      {metrica && <p className="num mt-2 text-xs text-gris">{metrica}</p>}
    </div>
  );
}
