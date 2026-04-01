import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileImage } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PropertyFloorPlanButtonProps {
  propertyId: number;
}

export function PropertyFloorPlanButton({ propertyId }: PropertyFloorPlanButtonProps) {
  const [open, setOpen] = useState(false);

  const { data: planUrl, isLoading } = useQuery({
    queryKey: ["property-floor-plan", propertyId],
    queryFn: async () => {
      const { data: prop } = await (supabase as any)
        .from("propiedades")
        .select("id_edificio_modelo, numero_piso")
        .eq("id", propertyId)
        .single();

      if (!prop?.id_edificio_modelo) return null;

      const { data: planoModelo } = await (supabase as any)
        .from("modelos_planos_arquitectonicos")
        .select("url_imagen")
        .eq("id_edificio_modelo", prop.id_edificio_modelo)
        .eq("activo", true)
        .limit(1)
        .maybeSingle();

      if (planoModelo?.url_imagen) return planoModelo.url_imagen;

      const { data: em } = await (supabase as any)
        .from("edificios_modelos")
        .select("id_edificio")
        .eq("id", prop.id_edificio_modelo)
        .single();

      if (!em?.id_edificio) return null;

      const { data: planoEdificio } = await (supabase as any)
        .from("edificios_niveles_planos")
        .select("url_imagen")
        .eq("id_edificio", em.id_edificio)
        .eq("nivel", prop.numero_piso || "1")
        .eq("activo", true)
        .limit(1)
        .maybeSingle();

      return planoEdificio?.url_imagen || null;
    },
    enabled: propertyId > 0,
    staleTime: 300_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!planUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 py-3 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
      >
        <FileImage className="h-4 w-4 text-muted-foreground" />
        Planta
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-base">Plano de Planta</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            <img src={planUrl} alt="Plano de planta" className="w-full object-contain rounded-lg" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
