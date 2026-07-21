import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { AddProspectoFloatingDialog } from "@/components/admin/AddProspectoFloatingDialog";
import { AgendarCitaShowroomDialog } from "@/components/admin/AgendarCitaShowroomDialog";
import SectionCard from "@/components/offer/SectionCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NoteEditor } from "@/components/admin/agent-portal/NoteEditor";
import { Loader2, ArrowLeft, Pencil, CalendarPlus, Check, FileText, MessageSquare, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TimelineItem {
  key: string;
  kind: "nota" | "cita" | "oferta";
  title: string;
  detail: string;
  date: Date;
  by?: string;
  notaId?: number;
  html?: string;
  long?: boolean;
}

const AgentProspectoDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id || "0");
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { impersonatedAgentPersonaId, isImpersonating } = useAgentImpersonation();
  const agentPersonaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const { mask } = useAgentPresentation();
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [citaOpen, setCitaOpen] = useState(false);
  const [nota, setNota] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  // Nota abierta en modal: ver detalle o editar.
  const [notaModal, setNotaModal] = useState<{ id: number; contenido: string; mode: "view" | "edit" } | null>(null);
  // Archivo/imagen adjunto abierto en el visor in-app (sin salir de la plataforma).
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);

  // Intercepta clics sobre imágenes/enlaces adjuntos dentro del HTML de una nota
  // para abrir el visor interno en vez de navegar fuera de la app.
  const handleNoteContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (anchor && anchor.getAttribute("href")) {
      e.preventDefault();
      const href = anchor.getAttribute("href")!;
      const name = (anchor.textContent || "archivo").replace(/^📎\s*/, "").trim() || "archivo";
      setPreviewFile({ url: href, name });
      return;
    }
    if (target.tagName === "IMG") {
      e.preventDefault();
      setPreviewFile({ url: (target as HTMLImageElement).src, name: "Imagen" });
    }
  };

  const previewExt = previewFile ? (previewFile.url.split("?")[0].split(".").pop() || "").toLowerCase() : "";
  const previewIsImage = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"].includes(previewExt);
  const previewIsPdf = previewExt === "pdf";

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

  // Notas (crm_notas) por entidad. Nota interna: solo las ve el agente que las creó.
  const { data: notas = [] } = useQuery({
    queryKey: ["prospecto-notas", entidadIds, user?.id],
    queryFn: async () => {
      if (entidadIds.length === 0 || !user?.id) return [];
      const { data } = await (supabase as any)
        .from("crm_notas")
        .select("id, contenido, fecha_creacion, id_usuario")
        .in("id_entidad_relacionada", entidadIds)
        .eq("activo", true)
        .eq("id_usuario", user.id)
        .order("fecha_creacion", { ascending: false });
      return (data || []) as any[];
    },
    enabled: entidadIds.length > 0 && !!user?.id,
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
    notas.forEach((n) => {
      const html = n.contenido || "";
      const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      items.push({
        key: `n${n.id}`, kind: "nota", title: "Nota", detail: plain,
        html, notaId: n.id, long: plain.length > 140 || /<img/i.test(html),
        date: new Date(n.fecha_creacion), by: autores.get(n.id_usuario) || undefined,
      });
    });
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
      setComposerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["prospecto-notas"] });
      toast.success("Nota guardada");
    },
    onError: (e: any) => toast.error(e.message || "No se pudo guardar la nota"),
  });

  const updateNota = useMutation({
    mutationFn: async ({ id, contenido }: { id: number; contenido: string }) => {
      const { error } = await (supabase as any).from("crm_notas").update({ contenido }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["prospecto-notas"] }); toast.success("Nota actualizada"); setNotaModal(null); },
    onError: (e: any) => toast.error(e.message || "No se pudo actualizar"),
  });

  const deleteNota = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any).from("crm_notas").update({ activo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["prospecto-notas"] }); toast.success("Nota eliminada"); setNotaModal(null); },
    onError: (e: any) => toast.error(e.message || "No se pudo eliminar"),
  });

  if (loadingPersona) {
    return <div className="pb-24"><AgentPortalHeader /><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#9AA3AD]" /></div></div>;
  }
  if (!persona) {
    return <div className="pb-24"><AgentPortalHeader /><div className="py-16 text-center text-sm text-muted-foreground">Prospecto no encontrado</div></div>;
  }

  const initials = (persona.nombre_legal || persona.email || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w.charAt(0).toUpperCase()).join("") || "?";
  const tel = persona.telefono ? `${persona.clave_pais_telefono === "MX" ? "+52 " : ""}${persona.telefono}` : "Sin datos";
  const tipoLabel = persona.tipo_persona === "pm" ? "Persona Moral" : "Persona Física";
  const infoRows: [string, string][] = [
    ["Email", persona.email || "Sin datos"],
    ["Teléfono", tel],
    ["RFC", persona.rfc || "Sin datos"],
    ["CURP", persona.curp || "Sin datos"],
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
                    <span className={cn(
                      "truncate text-right text-[12px] tabular-nums",
                      value === "Sin datos" ? "font-medium text-[#B7BEC5]" : "font-bold text-[#171A1D]"
                    )}>{value === "Sin datos" ? value : mask(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCitaOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5" /> Agendar visita
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs border border-primary bg-white text-primary hover:bg-primary/[0.06]"
              onClick={() => navigate("/admin/agent/inventario")}
            >
              <FileText className="h-3.5 w-3.5" /> Generar oferta
            </Button>
          </div>

          {/* Desarrollos de interés — solo lectura. Se editan desde el botón "Editar". */}
          <div className="mt-4 border-t border-[#F2F4F5] pt-4">
            <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.5px] text-[#9AA3AD]">Desarrollos de interés</p>
            <div className="flex flex-wrap gap-2">
              {entidades.map((e) => (
                <span
                  key={e.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(158_64%_38%)] bg-white px-3 py-[6px] text-[11px] font-semibold text-[hsl(158_64%_38%)]"
                >
                  <Check className="h-3.5 w-3.5" /> {e.proyectos?.nombre || `Proyecto ${e.id_proyecto}`}
                </span>
              ))}
              {entidades.length === 0 && (
                <span className="text-[11px] text-[#9AA3AD]">Sin desarrollos · edítalos desde “Editar”.</span>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Actividad */}
        <SectionCard icon={MessageSquare} title="Actividad" bodyClassName="p-5 md:p-6">
          {/* Composer — solo se muestra al crear una nota */}
          <div className="mb-5">
            {!composerOpen ? (
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                disabled={entidadIds.length === 0}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-left text-[12.5px] text-[#9AA3AD] transition-colors hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Agregar nota o comentario…
              </button>
            ) : (
              <div>
                <NoteEditor value={nota} onChange={setNota} storagePrefix={`crm-notas/${personaId}`} autoFocus />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[10.5px] text-[#B7BEC5]">Nota interna · solo visible para ti.</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setComposerOpen(false); setNota(""); }}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      disabled={addNota.isPending || entidadIds.length === 0 || (!nota.replace(/<[^>]+>/g, "").trim() && !/<img/i.test(nota))}
                      onClick={() => addNota.mutate(nota)}
                      className="text-xs border border-primary bg-white text-primary hover:bg-primary/[0.06]"
                    >
                      {addNota.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Guardar nota
                    </Button>
                  </div>
                </div>
              </div>
            )}
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
                        {it.kind === "nota" && it.notaId ? (
                          <button
                            type="button"
                            onClick={() => setNotaModal({ id: it.notaId!, contenido: it.html || "", mode: "edit" })}
                            title="Editar nota"
                            className={`h-[26px] w-[26px] shrink-0 rounded-full border-2 ${ring} transition hover:ring-2 hover:ring-[#C79A2E]/40`}
                          />
                        ) : (
                          <span className={`h-[26px] w-[26px] shrink-0 rounded-full border-2 ${ring}`} />
                        )}
                        {!last && <span className="min-h-3 w-0.5 flex-1 bg-[#F2F4F5]" />}
                      </div>
                      <div className="min-w-0 flex-1 pb-5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-[12.5px] font-bold text-[#171A1D]">{it.title}</span>
                            <span className="text-[10.5px] tabular-nums text-[#9AA3AD]">
                              {it.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })} · {it.date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {it.kind === "nota" && it.notaId && (
                            <div className="flex shrink-0 items-center gap-3.5">
                              {it.long && (
                                <button
                                  type="button"
                                  onClick={() => setNotaModal({ id: it.notaId!, contenido: it.html || "", mode: "view" })}
                                  className="text-[12.5px] font-semibold text-[hsl(158_64%_38%)] transition-colors hover:underline"
                                >
                                  Ver detalle
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setNotaModal({ id: it.notaId!, contenido: it.html || "", mode: "edit" })}
                                className="text-[12.5px] font-semibold text-[#C79A2E] transition-colors hover:underline"
                              >
                                Editar
                              </button>
                            </div>
                          )}
                        </div>
                        {it.kind === "nota" ? (
                          it.html && (
                            <div
                              onClick={handleNoteContentClick}
                              className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-[#4B5563] [&_img]:mt-1 [&_img]:inline-block [&_img]:h-auto [&_img]:max-h-20 [&_img]:w-auto [&_img]:max-w-[120px] [&_img]:cursor-pointer [&_img]:rounded [&_img]:border [&_img]:border-gray-100 [&_p]:my-0.5 [&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4 [&_a]:cursor-pointer [&_a]:font-medium [&_a]:text-[hsl(158_64%_38%)] [&_a]:underline"
                              dangerouslySetInnerHTML={{ __html: it.html }}
                            />
                          )
                        ) : (
                          it.detail && <p className="mt-0.5 text-[12px] leading-snug text-[#4B5563]">{it.detail}</p>
                        )}
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

      {/* Nota interna: ver detalle / editar / eliminar */}
      <Dialog open={!!notaModal} onOpenChange={(o) => !o && setNotaModal(null)}>
        <DialogContent
          className="max-w-[560px] gap-0 overflow-hidden rounded-md p-0"
          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
        >
          <DialogHeader className="space-y-1 border-b border-[#ECEEF0] px-[22px] py-5 text-left">
            <DialogTitle className="text-[18px] font-bold text-[#171A1D]">
              {notaModal?.mode === "edit" ? "Editar nota" : "Nota interna"}
            </DialogTitle>
            <p className="text-[12px] font-normal text-[#6B7280]">Solo visible para ti</p>
          </DialogHeader>

          <div className="max-h-[calc(90vh-9rem)] overflow-y-auto px-[22px] py-[22px]">
            {notaModal?.mode === "edit" ? (
              <NoteEditor
                value={notaModal.contenido}
                onChange={(html) => setNotaModal((m) => (m ? { ...m, contenido: html } : m))}
                storagePrefix={`crm-notas/${personaId}`}
                autoFocus
              />
            ) : (
              <div
                onClick={handleNoteContentClick}
                className="prose prose-sm max-w-none rounded-md border border-[#ECEEF0] bg-[#FCFCFD] p-4 text-[13px] leading-relaxed text-[#3F464E] [&_img]:mx-auto [&_img]:my-2 [&_img]:block [&_img]:h-auto [&_img]:max-h-72 [&_img]:w-auto [&_img]:max-w-full [&_img]:cursor-pointer [&_img]:rounded-lg [&_img]:border [&_img]:border-gray-100 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:cursor-pointer [&_a]:font-medium [&_a]:text-[hsl(158_64%_38%)] [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: notaModal?.contenido || "" }}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-2.5 border-t border-[#ECEEF0] px-[22px] py-4">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-[13px] font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={deleteNota.isPending}
              onClick={() => notaModal && deleteNota.mutate(notaModal.id)}
            >
              {deleteNota.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Eliminar
            </button>
            {notaModal?.mode === "view" ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(158_64%_38%)] bg-white px-5 py-2.5 text-[13px] font-semibold text-[hsl(158_64%_38%)] transition-colors hover:bg-[hsl(158_64%_38%)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setNotaModal((m) => (m ? { ...m, mode: "edit" } : m))}
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(158_64%_38%)] bg-white px-5 py-2.5 text-[13px] font-semibold text-[hsl(158_64%_38%)] transition-colors hover:bg-[hsl(158_64%_38%)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={updateNota.isPending || !notaModal || (!notaModal.contenido.replace(/<[^>]+>/g, "").trim() && !/<img/i.test(notaModal.contenido))}
                onClick={() => notaModal && updateNota.mutate({ id: notaModal.id, contenido: notaModal.contenido })}
              >
                {updateNota.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Guardar
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Visor in-app de adjuntos: imagen / PDF sin salir de la plataforma. */}
      <Dialog open={!!previewFile} onOpenChange={(o) => !o && setPreviewFile(null)}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
          <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-[#F0F2F4] px-5 py-4 text-left">
            <DialogTitle className="truncate pr-8 text-[15px] font-bold tracking-[-0.2px] text-[#171A1D]">
              {previewFile?.name || "Adjunto"}
            </DialogTitle>
          </DialogHeader>

          <div className="bg-[#F6F7F8] p-4">
            {previewIsImage ? (
              <img
                src={previewFile?.url}
                alt={previewFile?.name || "Adjunto"}
                className="mx-auto max-h-[70vh] w-auto max-w-full rounded-md border border-gray-200 bg-white object-contain"
              />
            ) : previewIsPdf ? (
              <iframe
                src={previewFile?.url}
                title={previewFile?.name || "Documento"}
                className="h-[70vh] w-full rounded-md border border-gray-200 bg-white"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                <FileText className="h-10 w-10 text-[#9AA3AD]" />
                <p className="text-[13px] font-medium text-[#4B5563]">Este tipo de archivo no se puede previsualizar aquí.</p>
                <p className="text-[11px] text-[#9AA3AD]">Descárgalo para abrirlo.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#F0F2F4] bg-[#FAFBFC] px-5 py-3.5">
            <a
              href={previewFile?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#ECEEF0] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir en pestaña
            </a>
            <a
              href={previewFile?.url}
              download={previewFile?.name}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(158_64%_38%)] bg-white px-4 py-2 text-[12.5px] font-semibold text-[hsl(158_64%_38%)] transition-colors hover:bg-[hsl(158_64%_38%)] hover:text-white"
            >
              <Download className="h-3.5 w-3.5" /> Descargar
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentProspectoDetalle;
