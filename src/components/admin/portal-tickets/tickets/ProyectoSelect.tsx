// Selector de proyecto para el ticket. Lista solo proyectos SOZU (mismo criterio que el CRM:
// entidades_relacionadas id_tipo_entidad=5, publicados y activos). Guarda el NOMBRE del
// proyecto en el campo `inmueble` del ticket (texto). Si más adelante se quiere filtrar por
// proyecto de forma estructurada, se agrega una columna id_proyecto vía migración.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const sb = supabase as any;
const SIN = "__sin__";

async function fetchProyectosSozu(): Promise<{ id: string; nombre: string }[]> {
  const { data: rels } = await sb
    .from("entidades_relacionadas")
    .select("id_proyecto")
    .eq("id_tipo_entidad", 5)
    .eq("activo", true)
    .not("id_proyecto", "is", null);
  const ids = Array.from(new Set((rels ?? []).map((r: any) => r.id_proyecto)));
  if (!ids.length) return [];
  const { data } = await sb
    .from("proyectos")
    .select("id, nombre")
    .in("id", ids)
    .eq("activo", true)
    .eq("publicar", true)
    .order("nombre");
  return (data ?? []).map((p: any) => ({ id: String(p.id), nombre: p.nombre }));
}

export function ProyectoSelect({
  value,
  onChange,
  label = "Proyecto",
  disabled = false,
}: {
  value: string; // nombre del proyecto ("" = sin proyecto)
  onChange: (nombre: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const { data: proyectos = [] } = useQuery({
    queryKey: ["tickets-proyectos-sozu"],
    queryFn: fetchProyectosSozu,
  });

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value || SIN}
        disabled={disabled}
        onValueChange={(v) => onChange(v === SIN ? "" : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecciona un proyecto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN}>Sin proyecto</SelectItem>
          {proyectos.map((p) => (
            <SelectItem key={p.id} value={p.nombre}>
              {p.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
