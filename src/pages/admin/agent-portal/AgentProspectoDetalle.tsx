import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { AddProspectoFloatingDialog } from "@/components/admin/AddProspectoFloatingDialog";
import { AgendarCitaShowroomDialog } from "@/components/admin/AgendarCitaShowroomDialog";
import SectionCard from "@/components/offer/SectionCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Pencil, CalendarPlus, Check, Plus, FileText, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface TimelineItem {
  key: string;
  kind: "nota" | "cita" | "oferta";
  title: string;
  detail: string;
  date: Date;
  by?: string;
}

const AgentProspectoDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id || "0");
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { impersonatedAgentPersonaId, isImpersonating } = useAgentImpersonation();
  const agentPersonaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const { accessibleProjectIds } = useProjectAccess();
  const { mask } = useAgentPresentation();
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [citaOpen, setCitaOpen] = useState(false);
  const [nota, setNota] = useState("");

  useEffect(() => {
    registrarVista(`/admin/agent/prospectos/${personaId}`, { persona_id: personaId });
    track({ page: 'agent_prospecto_detalle', elementId: 'page_view', elementType: 'page', metadata: { persona_id: personaId } });
  }, [personaId]);

  // Persona
  const { data: persona, isLoading: loadingPersona } = useQuery({
    queryKey: ["prospecto-persona", personaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("personas")
        .select("id, nombre_legal, email, telefono, clave_pais_telefono, tipo_persona, rfc, curp")
        .eq("id", personaId)
        .maybeSingle();
      return data as any;
    },
    enabled: personaId > 0,
  });

  // Entidades del prospecto (proyectos asignados) - del agente
  const { data: entidades = [] } = useQuery({
    queryKey: ["prospecto-entidades", personaId, agentPersonaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("entidades_relacionadas")
        .select("id, id_proyecto, proyectos!entidades_relacionadas_id_proyecto_fkey(id, nombre)")
        .eq("id_persona", personaId)
        .eq("id_tipo_entidad", 7)
        .eq("activo", true)
        .eq("id_persona_duena_lead", agentPersonaId!);
      return (data || []) as any[];
    },
    enabled: personaId > 0 && !!agentPersonaId,
  });

  const entidadIds = useMemo(() => entidades.map((e) => e.id), [entidades]);
  const assignedProjectIds = useMemo(() => new Set(entidades.map((e) => e.id_proyecto).filter(Boolean)), [entidades]);

  // Proyectos disponibles (para agregar interés) - SOLO los asignados al agente,
  // nunca el catálogo completo (ni super admin / super admin fake).
  const { data: proyectos = [] } = useQuery({
    queryKey: ["prospecto-proyectos-disp", accessibleProjectIds],
    queryFn: async () => {
      if (accessibleProjectIds.length === 0) return [];
      const { data } = await supabase
        .from("proyectos")
        .select("id, nombre")
        .eq("activo", true)
        .in("id", accessibleProjectIds)
        .order("nombre");
      return (data || []) as { id: number; nombre: string }[];
    },
  });

  // Notas (crm_notas) por entidad
  const { data: notas = [] } = useQuery({
    queryKey: ["prospecto-notas", entidadIds],
    queryFn: async () => {
      if (entidadIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("crm_notas")
        .select("id, contenido, fecha_creacion, id_usuario")
        .in("id_entidad_relacionada", entidadIds)
        .eq("activo", true)
        .order("fecha_creacion", { ascending: false });
      return (data || []) as any[];
    },
    enabled: entidadIds.length > 0,
  });

  // Citas (visitas)
  const { data: citas = [] } = useQuery({
    queryKey: ["prospecto-citas", personaId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("reservas_citas")
        .select("id, fecha, hora_inicio, estatus, proyectos(nombre), tipos_cita(nombre)")
        .eq("id_persona_prospecto", personaId)
        .eq("activo", true);
      return (data || []) as any[];
    },
    enabled: personaId > 0,
  });

  // Ofertas
  const { data: ofertas = [] } = useQuery({
    queryKey: ["prospecto-ofertas", personaId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ofertas")
        .select("id, fecha_generacion")
        .eq("id_persona_lead", personaId)
        .eq("activo", true)
        .order("fecha_generacion", { ascending: false });
      return (data || []) as any[];
    },
    enabled: personaId > 0,
  });

  // Autores de notas
  const autorIds = useMemo(() => [...new Set(notas.map((n) => n.id_usuario).filter(Boolean))], [notas]);
  const { data: autores = new Map<string, string>() } = useQuery({
    queryKey: ["prospecto-notas-autores", autorIds],
    queryFn: async () => {
      const m = new Map<string, string>();
      if (autorIds.length === 0) return m;
      const { data } = await (supabase as any).from("usuarios").select("id, nombre").in("id", autorIds);
      (data || []).forEach((u: any) => m.set(u.id, u.nombre));
      return m;
    },
    enabled: autorIds.length > 0,
  });

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    notas.forEach((n) => items.push({
      key: `n${n.id}`, kind: "nota", title: "Nota", detail: n.contenido || "",
      date: new Date(n.fecha_creacion), by: autores.get(n.id_usuario) || undefined,
    }));
    citas.forEach((c) => {
      const t = c.hora_inicio ? ` · ${c.hora_inicio.slice(0, 5)}` : "";
      items.push({
        key: `c${c.id}`, kind: "cita",
        title: c.tipos_cita?.nombre || "Cita",
        detail: [c.proyectos?.nombre, c.estatus].filter(Boolean).join(" · "),
        date: new Date(`${c.fecha}T${(c.hora_inicio || "00:00:00")}`), by: undefined,
      });
    });
    ofertas.forEach((o) => items.push({
      key: `o${o.id}`, kind: "oferta", title: "Oferta generada",
      detail: `Oferta #${o.id}`, date: new Date(o.fecha_generacion),
    }));
    return items.filter((i) => !isNaN(i.date.getTime())).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [notas, citas, ofertas, autores]);

  const addNota = useMutation({
    mutationFn: async (contenido: string) => {
      if (entidadIds.length === 0) throw new Error("El prospecto no tiene desarrollos asignados");
      const { error } = await (supabase as any).from("crm_notas").insert({
        id_entidad_relacionada: entidadIds[0],
        id_usuario: user?.id,
        contenido,
        fecha_actividad: new Date().toISOString().slice(0, 10),
        activo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNota("");
      queryClient.invalidateQueries({ queryKey: ["prospecto-notas"] });
      toast.success("Nota guardada");
    },
    onError: (e: any) => toast.error(e.message || "No se pudo guardar la nota"),
  });

  const addProyecto = useMutation({
    mutationFn: async (proyectoId: number) => {
      const { error } = await supabase.rpc("agent_claim_or_reactivate_prospect_project", {
        _persona_id: personaId, _proyecto_id: proyectoId, _owner_persona_id: agentPersonaId ?? undefined,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["prospecto-entidades"] }); toast.success("Desarrollo agregado"); },
    onError: (e: any) => toast.error(e.message || "No se pudo agregar"),
  });

  const removeProyecto = useMutation({
    mutationFn: async (entidadId: number) => {
      const { error } = await supabase.from("entidades_relacionadas").update({ activo: false }).eq("id", entidadId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["prospecto-entidades"] }); toast.success("Desarrollo removido"); },
    onError: (e: any) => toast.error(e.message || "No se pudo remover"),
  });

  if (loadingPersona) {
    return <div className="pb-24"><AgentPortalHeader /><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#9AA3AD]" /></div></div>;
  }
  if (!persona) {
    return <div className="pb-24"><AgentPortalHeader /><div className="py-16 text-center text-sm text-muted-foreground">Prospecto no encontrado</div></div>;
  }

  const initials = (persona.nombre_legal || persona.email || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w.charAt(0).toUpperCase()).join("") || "?";
  const tel = persona.telefono ? `${persona.clave_pais_telefono === "MX" ? "+52 " : ""}${persona.telefono}` : "-";
  const tipoLabel = persona.tipo_persona === "pm" ? "Persona Moral" : "Persona Física";
  const infoRows: [string, string][] = [
    ["Email", persona.email || "-"],
    ["Teléfono", tel],
    ["RFC", persona.rfc || "-"],
    ["CURP", persona.curp || "-"],
  ];

  return (
    <div className="pb-24">
      <AgentPortalHeader />

      <div className="mx-auto max-w-[1040px] pt-1 space-y-4">
        <button
          onClick={() => navigate("/admin/agent/prospectos")}
          title="Prospectos"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Ficha del prospecto */}
        <SectionCard bodyClassName="p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[19px] font-bold tracking-[-0.3px] text-[#171A1D]">{mask(persona.nombre_legal || persona.email)}</span>
                <Badge className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/10">
                  {entidades.length} {entidades.length === 1 ? "desarrollo" : "desarrollos"}
                </Badge>
                <Badge variant="secondary" className="rounded-full bg-[#F2F4F5] px-2.5 py-0.5 text-[10px] font-semibold text-[#6B7280] hover:bg-[#F2F4F5]">{tipoLabel}</Badge>
              </div>
              <div className="mt-3.5 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {infoRows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 border-b border-[#F2F4F5] py-1.5">
                    <span className="text-[11.5px] font-medium text-[#9AA3AD]">{label}</span>
                    <span className="truncate text-right text-[12px] font-bold tabular-nums text-[#171A1D]">{mask(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCitaOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5" /> Agendar visita
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate("/admin/agent/inventario")}
            >
              <FileText className="h-3.5 w-3.5" /> Generar oferta
            </Button>
          </div>

          {/* Desarrollos de interés */}
          <div className="mt-4 border-t border-[#F2F4F5] pt-4">
            <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.5px] text-[#9AA3AD]">Desarrollos de interés</p>
            <div className="flex flex-wrap gap-2">
              {entidades.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => removeProyecto.mutate(e.id)}
                  disabled={removeProyecto.isPending}
                  title="Quitar desarrollo"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(158_64%_38%)] bg-[hsl(158_64%_38%)] px-3 py-[7px] text-[12px] font-semibold text-white"
                >
                  <Check className="h-3.5 w-3.5" /> {e.proyectos?.nombre || `Proyecto ${e.id_proyecto}`}
                </button>
              ))}
              {proyectos.filter((p) => !assignedProjectIds.has(p.id)).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProyecto.mutate(p.id)}
                  disabled={addProyecto.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7EA] bg-white px-3 py-[7px] text-[12px] font-semibold text-[#4B5563] hover:border-[hsl(158_64%_38%)] hover:text-[hsl(158_64%_38%)]"
                >
                  <Plus className="h-3.5 w-3.5" /> {p.nombre}
                </button>
              ))}
              {entidades.length === 0 && proyectos.length === 0 && (
                <span className="text-[11px] text-[#9AA3AD]">Sin desarrollos disponibles</span>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Actividad */}
        <SectionCard icon={MessageSquare} title="Actividad" bodyClassName="p-5 md:p-6">
          {/* Composer */}
          <div className="mb-5 flex gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary text-[11px] font-bold text-primary-foreground">
                {(profile?.nombre || "Yo").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "Y"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Agregar nota o comentario…"
                rows={2}
                className="resize-none rounded-md border-gray-200 text-[12.5px] focus-visible:ring-primary/25"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  disabled={!nota.trim() || addNota.isPending || entidadIds.length === 0}
                  onClick={() => addNota.mutate(nota.trim())}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {addNota.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Guardar nota
                </Button>
              </div>
            </div>
          </div>

          {/* Timeline - máx ~6 filas, luego scroll */}
          {timeline.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#9AA3AD]">Aún no hay actividad registrada</p>
          ) : (
            <div className="max-h-[440px] overflow-y-auto pr-1">
              <div className="flex flex-col">
                {timeline.map((it, i) => {
                  const last = i === timeline.length - 1;
                  const ring = it.kind === "cita" ? "border-[#2A6FDB] bg-[#EAF2FB]" : it.kind === "nota" ? "border-[#C79A2E] bg-[#FBF3DC]" : "border-primary bg-primary/10";
                  return (
                    <div key={it.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`h-[26px] w-[26px] shrink-0 rounded-full border-2 ${ring}`} />
                        {!last && <span className="min-h-3 w-0.5 flex-1 bg-[#F2F4F5]" />}
                      </div>
                      <div className="min-w-0 flex-1 pb-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12.5px] font-bold text-[#171A1D]">{it.title}</span>
                          <span className="text-[10.5px] tabular-nums text-[#9AA3AD]">
                            {it.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })} · {it.date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {it.detail && <p className="mt-0.5 text-[12px] leading-snug text-[#4B5563]">{it.detail}</p>}
                        {it.by && <p className="mt-1 text-[10.5px] text-[#B7BEC5]">{it.by}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <AddProspectoFloatingDialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) {
            queryClient.invalidateQueries({ queryKey: ["prospecto-persona"] });
            queryClient.invalidateQueries({ queryKey: ["prospecto-entidades"] });
          }
        }}
        preSelectedPersonaId={personaId}
      />
      <AgendarCitaShowroomDialog open={citaOpen} onOpenChange={setCitaOpen} />
    </div>
  );
};

export default AgentProspectoDetalle;
