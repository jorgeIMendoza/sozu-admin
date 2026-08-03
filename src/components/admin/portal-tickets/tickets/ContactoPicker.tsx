// Selector de contacto real del CRM para vincular un ticket a una persona
// (dueño / prospecto / comprador / residente). Busca por nombre O correo en `personas`,
// filtra a entidades_relacionadas tipos 2=Comprador/Lead, 7=Prospecto. Devuelve la
// entidad_relacionada seleccionada { id, nombre, email }, que el ticket guarda en
// id_entidad_relacionada (+ el nombre como texto de respaldo en `solicitante`).
import { useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const sb = supabase as any;

export type ContactoRef = { id: string; nombre: string; email?: string };

export function ContactoPicker({
  value,
  onChange,
  label = "Solicitante (contacto)",
  disabled = false,
}: {
  value: ContactoRef | null;
  onChange: (c: ContactoRef | null) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["tickets-contacto-search", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const term = search.trim();
      // Busca por nombre legal, nombre comercial O correo.
      const { data: personas } = await sb
        .from("personas")
        .select("id, nombre_legal, nombre_comercial, email")
        .or(
          `nombre_legal.ilike.%${term}%,nombre_comercial.ilike.%${term}%,email.ilike.%${term}%`,
        )
        .eq("activo", true)
        .limit(20);
      const pIds = (personas ?? []).map((p: any) => p.id);
      if (!pIds.length) return [] as ContactoRef[];
      const { data: ents } = await sb
        .from("entidades_relacionadas")
        .select("id, id_persona")
        .in("id_persona", pIds)
        .in("id_tipo_entidad", [2, 7])
        .eq("activo", true)
        .limit(20);
      const pInfo: Record<number, { nombre: string; email: string }> = Object.fromEntries(
        (personas ?? []).map((p: any) => [
          p.id,
          {
            nombre: (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim(),
            email: p.email ?? "",
          },
        ]),
      );
      return (ents ?? []).map((e: any) => ({
        id: String(e.id),
        nombre: pInfo[e.id_persona]?.nombre ?? "Sin nombre",
        email: pInfo[e.id_persona]?.email ?? "",
      })) as ContactoRef[];
    },
  });

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
          <div className="min-w-0">
            <span className="block truncate font-medium">{value.nombre}</span>
            {value.email && (
              <span className="block truncate text-xs text-muted-foreground">{value.email}</span>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
              aria-label="Quitar contacto"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              disabled={disabled}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busca por nombre o correo (2+ letras)…"
              className="pl-8"
            />
          </div>
          {search.trim().length >= 2 && (
            <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-popover shadow-sm">
              {isFetching ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Buscando…
                </div>
              ) : results.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Sin resultados.</div>
              ) : (
                results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setSearch("");
                    }}
                    className="block w-full px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span className="block truncate text-sm">{c.nombre}</span>
                    {c.email && (
                      <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
