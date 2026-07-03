import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { AddProspectoFloatingDialog } from "@/components/admin/AddProspectoFloatingDialog";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, UserPlus, Pencil, EyeOff } from "lucide-react";

interface ProspectoAgrupado {
  id_persona: number;
  nombre_legal: string;
  email: string;
  telefono: string;
  clave_pais_telefono: string;
  tipo_persona: string;
  proyectos: { id: number; nombre: string; entidad_relacionada_id: number }[];
}

const AgentProspectos = () => {
  const { profile } = useAuth();
  const { impersonatedAgentPersonaId, isImpersonating } = useAgentImpersonation();
  const effectivePersonaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const queryClient = useQueryClient();
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();
  const { permissions } = useAgentPortalPermissions();
  const perms = permissions['/admin/agent/prospectos'] || permissions['/admin/agent/inicio'] || { canRead: true, canCreate: true };
  const { presentationMode, mask } = useAgentPresentation();
  const [addProspectoOpen, setAddProspectoOpen] = useState(false);
  const [editPersonaId, setEditPersonaId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    registrarVista('/admin/agent/prospectos');
    track({ page: 'agent_prospectos', elementId: 'page_view', elementType: 'page' });
  }, []);

  const { data: prospectos = [], isLoading } = useQuery({
    queryKey: ["agent-prospectos", effectivePersonaId],
    queryFn: async (): Promise<ProspectoAgrupado[]> => {
      if (!effectivePersonaId) return [];

      const { data, error } = await supabase
        .from("entidades_relacionadas")
        .select(`
          id,
          id_persona,
          id_proyecto,
          personas!entidades_relacionadas_id_persona_fkey (
            id, nombre_legal, email, telefono, clave_pais_telefono, tipo_persona
          ),
          proyectos!entidades_relacionadas_id_proyecto_fkey (
            id, nombre
          )
        `)
        .eq("id_tipo_entidad", 7)
        .eq("activo", true)
        .eq("id_persona_duena_lead", effectivePersonaId);

      if (error) throw error;

      // Group by persona
      const map = new Map<number, ProspectoAgrupado>();
      (data || []).forEach((er: any) => {
        if (!er.personas) return;
        const pid = er.personas.id;
        if (!map.has(pid)) {
          map.set(pid, {
            id_persona: pid,
            nombre_legal: er.personas.nombre_legal || "",
            email: er.personas.email || "",
            telefono: er.personas.telefono || "",
            clave_pais_telefono: er.personas.clave_pais_telefono || "MX",
            tipo_persona: er.personas.tipo_persona || "pf",
            proyectos: [],
          });
        }
        if (er.id_proyecto && er.proyectos) {
          const existing = map.get(pid)!;
          if (!existing.proyectos.some(p => p.id === er.id_proyecto)) {
            existing.proyectos.push({
              id: er.id_proyecto,
              nombre: er.proyectos.nombre,
              entidad_relacionada_id: er.id,
            });
          }
        }
      });

      return Array.from(map.values()).sort((a, b) => a.nombre_legal.localeCompare(b.nombre_legal));
    },
    enabled: !!effectivePersonaId,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return prospectos;
    const s = search.toLowerCase();
    return prospectos.filter(p =>
      p.nombre_legal.toLowerCase().includes(s) ||
      p.email.toLowerCase().includes(s) ||
      p.proyectos.some(pr => pr.nombre.toLowerCase().includes(s))
    );
  }, [prospectos, search]);

  return (
    <div className="pb-24">
      <AgentPortalHeader>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <h1 className="text-[26px] font-extrabold tracking-[-0.5px] text-[#171A1D]">Mis Prospectos</h1>
          {perms.canCreate && (
            <button
              onClick={() => {
                track({ page: 'agent_prospectos', elementId: 'btn_nuevo_prospecto' });
                setAddProspectoOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-[10px] bg-[#16A45E] px-4 py-2.5 text-[13px] font-bold text-white transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Nuevo
            </button>
          )}
        </div>
      </AgentPortalHeader>

      <div className="mx-auto max-w-[920px] p-4 pt-2">
        {/* Banner modo presentación */}
        {presentationMode && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-[#EBC089] bg-[#FBE3CE] px-4 py-2.5">
            <EyeOff className="h-4 w-4 shrink-0 text-[#B5601C]" />
            <span className="text-[12px] font-semibold text-[#B5601C]">
              Modo presentación · datos de prospectos ocultos. Desactívalo arriba para verlos.
            </span>
          </div>
        )}

        {/* Search */}
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[#9AA3AD]" />
          <Input
            placeholder="Buscar prospecto…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-11 rounded-[10px] border-[#ECEEF0] bg-white pl-9 text-[13px] shadow-none focus-visible:ring-[#16A45E]/30"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#9AA3AD]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="space-y-2 py-16 text-center">
            <UserPlus className="mx-auto h-10 w-10 text-[#9AA3AD]/40" />
            <p className="text-sm text-[#6B7280]">
              {search ? "No se encontraron prospectos" : "Aún no tienes prospectos"}
            </p>
            {!search && perms.canCreate && (
              <button
                onClick={() => setAddProspectoOpen(true)}
                className="text-sm font-bold text-[#0E7A45] hover:underline"
              >
                + Crear tu primer prospecto
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            {filtered.map(p => {
              const initials = (p.nombre_legal || p.email || "?")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(w => w.charAt(0).toUpperCase())
                .join("") || "?";
              const contacto = [p.telefono, p.email].filter(Boolean).join("  ·  ");
              return (
                <div
                  key={p.id_persona}
                  onClick={() => {
                    setEditPersonaId(p.id_persona);
                    setAddProspectoOpen(true);
                  }}
                  className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ECEEF0] bg-white p-4 shadow-[0_1px_3px_rgba(20,30,25,0.04)] transition-shadow hover:shadow-[0_6px_18px_rgba(20,30,25,0.08)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF6F0] text-[13px] font-bold text-[#0E7A45]">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-[#171A1D]">
                      {mask(p.nombre_legal || p.email)}
                    </p>
                    {contacto && (
                      <p className="mt-0.5 truncate text-[11px] font-medium tabular-nums text-[#9AA3AD]">
                        {mask(contacto)}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.proyectos.map(pr => (
                        <span
                          key={pr.id}
                          className="rounded-full bg-[#F2F4F5] px-2 py-[3px] text-[9.5px] font-semibold text-[#6B7280]"
                        >
                          {pr.nombre}
                        </span>
                      ))}
                      {p.proyectos.length === 0 && (
                        <span className="text-[10px] text-[#9AA3AD]">Sin proyectos asignados</span>
                      )}
                    </div>
                  </div>
                  <Pencil className="h-4 w-4 shrink-0 text-[#9AA3AD] opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddProspectoFloatingDialog
        open={addProspectoOpen}
        onOpenChange={(v) => {
          setAddProspectoOpen(v);
          if (!v) {
            setEditPersonaId(null);
            queryClient.invalidateQueries({ queryKey: ["agent-prospectos"] });
          }
        }}
        preSelectedPersonaId={editPersonaId}
      />
    </div>
  );
};

export default AgentProspectos;
