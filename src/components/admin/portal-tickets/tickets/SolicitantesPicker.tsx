// Selector MÚLTIPLE de solicitantes (contactos del CRM que reportan el ticket). Combina el
// buscador async de contactos (personas → entidades_relacionadas tipos 2=Comprador/Lead y
// 7=Prospecto) con una lista de seleccionados que muestra nombre, correo y teléfono. Cada
// contacto se guarda como ContactoRef { id (=entidad_relacionada), nombre, email, telefono }.
import { useState } from "react";
import { Loader2, Mail, Phone, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContactoRef } from "@/lib/portal-tickets/tickets-data";

const sb = supabase as any;

// Teléfono legible: prefija la lada solo si clave_pais_telefono parece número (+52), no ISO ("MX").
function telefonoDisplay(p: { telefono?: string | null; clave_pais_telefono?: string | null }): string | null {
  const tel = String(p.telefono ?? "").trim();
  if (!tel) return null;
  const clave = String(p.clave_pais_telefono ?? "").trim();
  const lada = /^\+?\d+$/.test(clave) ? `+${clave.replace(/^\+/, "")} ` : "";
  return `${lada}${tel}`;
}

// Datos de un contacto (nombre + correo + teléfono como enlaces). Reutilizable en la card del
// Kanban (popover) y en las filas del selector.
export function ContactoDatos({ c }: { c: ContactoRef }) {
  const telHref = c.telefono ? `tel:${c.telefono.replace(/[^\d+]/g, "")}` : null;
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{c.nombre}</p>
      {c.email && (
        <a
          href={`mailto:${c.email}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 truncate text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Mail className="size-3 shrink-0" />
          <span className="truncate">{c.email}</span>
        </a>
      )}
      {c.telefono && telHref && (
        <a
          href={telHref}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Phone className="size-3 shrink-0" />
          <span className="truncate">{c.telefono}</span>
        </a>
      )}
      {!c.email && !c.telefono && (
        <p className="text-xs text-muted-foreground">Sin datos de contacto</p>
      )}
    </div>
  );
}

export function SolicitantesPicker({
  value,
  onChange,
  label = "Solicitante(s) (contacto)",
  disabled = false,
}: {
  value: ContactoRef[];
  onChange: (c: ContactoRef[]) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["tickets-solicitante-search", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const term = search.trim();
      const { data: personas } = await sb
        .from("personas")
        .select("id, nombre_legal, nombre_comercial, email, telefono, clave_pais_telefono")
        .or(`nombre_legal.ilike.%${term}%,nombre_comercial.ilike.%${term}%,email.ilike.%${term}%`)
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
      const pInfo: Record<string, { nombre: string; email: string; telefono: string | null }> = Object.fromEntries(
        (personas ?? []).map((p: any) => [
          String(p.id),
          {
            nombre: (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim(),
            email: p.email ?? "",
            telefono: telefonoDisplay(p),
          },
        ]),
      );
      // Dedupe por PERSONA: una persona puede tener varias entidades ("contactos"); mostramos UNA
      // sola opción por persona (usando su primera entidad como enlace). El ticket es de la persona,
      // y en la ficha del CRM los tickets se muestran a nivel persona (todas sus entidades).
      const vistos = new Set<number>();
      const salida: ContactoRef[] = [];
      for (const e of ents ?? []) {
        if (e.id_persona == null || vistos.has(e.id_persona)) continue;
        vistos.add(e.id_persona);
        const info = pInfo[String(e.id_persona)];
        salida.push({
          id: String(e.id),
          nombre: info?.nombre ?? "Sin nombre",
          email: info?.email ?? "",
          telefono: info?.telefono ?? null,
        });
      }
      return salida;
    },
  });

  const yaElegido = (id: string) => value.some((c) => c.id === id);
  const agregar = (c: ContactoRef) => {
    if (!yaElegido(c.id)) onChange([...value, c]);
    setSearch("");
  };
  const quitar = (id: string) => onChange(value.filter((c) => c.id !== id));

  const nuevos = results.filter((c) => !yaElegido(c.id));

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>

      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <ContactoDatos c={c} />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => quitar(c.id)}
                  aria-label={`Quitar ${c.nombre}`}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Agrega solicitantes: nombre o correo (2+ letras)…"
            className="pl-8"
          />
        </div>
      )}

      {!disabled && search.trim().length >= 2 && (
        <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-popover shadow-sm">
          {isFetching ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Buscando…
            </div>
          ) : nuevos.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">Sin resultados nuevos.</div>
          ) : (
            nuevos.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => agregar(c)}
                className="block w-full px-3 py-2 text-left transition-colors hover:bg-muted"
              >
                <span className="block truncate text-sm">{c.nombre}</span>
                {c.email && <span className="block truncate text-xs text-muted-foreground">{c.email}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
