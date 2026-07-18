import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Plus, Search, UserPlus, ChevronRight, EyeOff, Mail, Phone } from "lucide-react";

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
  const navigate = useNavigate();

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
            existing.proyectos.push({ id: er.id_proyecto, nombre: er.proyectos.nombre, entidad_relacionada_id: er.id });
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

  const openDetalle = (id: number) => {
    track({ page: 'agent_prospectos', elementId: 'btn_ver_prospecto', metadata: { persona_id: id } });
    navigate(`/admin/agent/prospectos/${id}`);
  };

  return (
    <div className="pb-24">
      <AgentPortalHeader />

      <div className="mx-auto max-w-[1040px] pt-1 space-y-4">
        {/* Modo presentación */}
        {presentationMode && (
          <div className="flex items-center gap-2.5 rounded-md border border-[#EBC089] bg-[#FBE3CE] px-4 py-2.5">
            <EyeOff className="h-4 w-4 shrink-0 text-[#B5601C]" />
            <span className="text-[12px] font-semibold text-[#B5601C]">
              Modo presentación · datos de prospectos ocultos. Desactívalo arriba para verlos.
            </span>
          </div>
        )}

        {/* Toolbar: búsqueda + nuevo */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA3AD]" />
            <Input
              placeholder="Buscar por nombre, correo o desarrollo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 rounded-md border-gray-200 bg-white pl-9 text-[13px] shadow-none focus-visible:ring-primary/25"
            />
          </div>
          {perms.canCreate && (
            <Button
              onClick={() => { track({ page: 'agent_prospectos', elementId: 'btn_nuevo_prospecto' }); setEditPersonaId(null); setAddProspectoOpen(true); }}
              className="h-10 shrink-0 gap-1.5 text-xs rounded-md border border-primary bg-white text-primary hover:bg-primary/[0.06]"
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo prospecto</span><span className="sm:hidden">Nuevo</span>
            </Button>
          )}
        </div>

        {/* Conteo */}
        {!isLoading && filtered.length > 0 && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A929B]">
            {filtered.length} {filtered.length === 1 ? "prospecto" : "prospectos"}
          </p>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#9AA3AD]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-gray-200 bg-white py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-6 w-6 text-primary" />
            </span>
            <p className="text-sm text-[#6B7280]">{search ? "No se encontraron prospectos" : "Aún no tienes prospectos"}</p>
            {!search && perms.canCreate && (
              <Button variant="outline" size="sm" onClick={() => { setEditPersonaId(null); setAddProspectoOpen(true); }} className="gap-1.5">
                <Plus className="h-4 w-4 text-primary" /> Crear tu primer prospecto
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map(p => {
              const initials = (p.nombre_legal || p.email || "?")
                .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join("") || "?";
              return (
                <button
                  key={p.id_persona}
                  type="button"
                  onClick={() => openDetalle(p.id_persona)}
                  className="group flex items-start gap-3 rounded-md border border-[#E7E9EC] bg-white p-4 text-left shadow-[0_1px_3px_rgba(20,30,25,0.04)] hover:border-[#CBD2D9]"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-[13px] font-bold text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-[#171A1D]">{mask(p.nombre_legal || p.email)}</p>
                    <div className="mt-1 space-y-0.5">
                      {p.telefono && (
                        <p className="flex items-center gap-1.5 truncate text-[11.5px] font-medium tabular-nums text-[#8A929B]">
                          <Phone className="h-3 w-3 shrink-0" /> {mask(p.telefono)}
                        </p>
                      )}
                      {p.email && (
                        <p className="flex items-center gap-1.5 truncate text-[11.5px] font-medium text-[#8A929B]">
                          <Mail className="h-3 w-3 shrink-0" /> {mask(p.email)}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.proyectos.map(pr => (
                        <Badge key={pr.id} variant="secondary" className="rounded-md bg-[#F2F4F5] px-2 py-0.5 text-[10px] font-semibold text-[#6B7280] hover:bg-[#F2F4F5]">
                          {pr.nombre}
                        </Badge>
                      ))}
                      {p.proyectos.length === 0 && (
                        <span className="text-[10px] text-[#9AA3AD]">Sin desarrollos asignados</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#C7CDD4] transition-colors group-hover:text-primary" />
                </button>
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
