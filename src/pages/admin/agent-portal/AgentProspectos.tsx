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
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Search, UserPlus, ChevronRight, EyeOff, Mail, Phone, Plus } from "lucide-react";

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
    <div >
      <AgentPortalHeader />

      <div className="mx-auto max-w-[1040px] pt-1 space-y-4">
        {/* Modo presentación */}
        {presentationMode && (
          <div className="flex items-center gap-2.5 rounded-md border border-amber-300 bg-orange-100 px-4 py-2.5">
            <EyeOff className="h-4 w-4 shrink-0 text-orange-700" />
            <span className="text-xs font-semibold text-orange-700">
              Modo presentación · datos de prospectos ocultos. Desactívalo arriba para verlos.
            </span>
          </div>
        )}

        {/* Toolbar: búsqueda + nuevo */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              placeholder="Buscar por nombre, correo o desarrollo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 rounded-md border-gray-200 bg-card pl-9 text-sm shadow-none focus-visible:ring-primary/25"
            />
          </div>
          {perms.canCreate && (
            <ActionButton
              icon={Plus}
              shortLabel="Nuevo"
              className="shrink-0"
              onClick={() => { track({ page: 'agent_prospectos', elementId: 'btn_nuevo_prospecto' }); setEditPersonaId(null); setAddProspectoOpen(true); }}
            >
              Nuevo prospecto
            </ActionButton>
          )}
        </div>

        {/* Conteo */}
        {!isLoading && filtered.length > 0 && (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            {filtered.length} {filtered.length === 1 ? "prospecto" : "prospectos"}
          </p>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-gray-200 bg-card py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-6 w-6 text-primary" />
            </span>
            <p className="text-sm text-muted-foreground">{search ? "No se encontraron prospectos" : "Aún no tienes prospectos"}</p>
            {!search && perms.canCreate && (
              <ActionButton icon={Plus} size="sm" onClick={() => { setEditPersonaId(null); setAddProspectoOpen(true); }}>
                Crear tu primer prospecto
              </ActionButton>
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
                  className="group flex items-start gap-3 rounded-md border border-border bg-card p-4 text-left shadow-[0_1px_3px_rgba(20,30,25,0.04)] hover:border-border"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{mask(p.nombre_legal || p.email)}</p>
                    <div className="mt-1 space-y-0.5">
                      {p.telefono && (
                        <p className="flex items-center gap-1.5 truncate text-xs font-medium tabular-nums text-muted-foreground/70">
                          <Phone className="h-3 w-3 shrink-0" /> {mask(p.telefono)}
                        </p>
                      )}
                      {p.email && (
                        <p className="flex items-center gap-1.5 truncate text-xs font-medium text-muted-foreground/70">
                          <Mail className="h-3 w-3 shrink-0" /> {mask(p.email)}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.proyectos.map(pr => (
                        <Badge key={pr.id} variant="secondary" className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-muted">
                          {pr.nombre}
                        </Badge>
                      ))}
                      {p.proyectos.length === 0 && (
                        <span className="text-xs text-muted-foreground/70">Sin desarrollos asignados</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-primary" />
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
