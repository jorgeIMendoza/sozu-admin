import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface PropertyFloorPlanProps {
  propertyId: number;
}

export function PropertyFloorPlan({ propertyId }: PropertyFloorPlanProps) {
  const { data: planUrl, isLoading } = useQuery({
    queryKey: ["property-floor-plan", propertyId],
    queryFn: async () => {
      // Get property details: id_edificio_modelo and nivel
      const { data: prop } = await (supabase as any)
        .from("propiedades")
        .select("id_edificio_modelo, numero_piso")
        .eq("id", propertyId)
        .single();

      if (!prop?.id_edificio_modelo) return null;

      // Try modelos_planos_arquitectonicos first
      const { data: planoModelo } = await (supabase as any)
        .from("modelos_planos_arquitectonicos")
        .select("url_imagen")
        .eq("id_edificio_modelo", prop.id_edificio_modelo)
        .eq("activo", true)
        .limit(1)
        .maybeSingle();

      if (planoModelo?.url_imagen) return planoModelo.url_imagen;

      // Fallback: get edificio_id from edificios_modelos then try edificios_niveles_planos
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
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!planUrl) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Planta</p>
      <div className="rounded-xl overflow-hidden border border-gray-100">
        <img src={planUrl} alt="Plano de planta" className="w-full object-contain max-h-64" loading="lazy" />
      </div>
    </div>
  );
}
