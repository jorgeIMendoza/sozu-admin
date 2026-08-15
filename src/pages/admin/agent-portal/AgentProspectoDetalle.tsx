import { AddProspectoFloatingDialog } from "@/components/admin/AddProspectoFloatingDialog";
import { AgendarCitaShowroomDialog } from "@/components/admin/AgendarCitaShowroomDialog";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { NoteEditor } from "@/components/admin/agent-portal/NoteEditor";
import SectionCard from "@/components/offer/SectionCard";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MODAL_BODY_CLS, MODAL_FOOTER_CLS, ModalFormHeader } from "@/components/ui/modal-form";
import { ModalViewer } from "@/components/ui/modal-viewer";
import { useEffectiveAgent } from "@/hooks/useEffectiveAgent";
import { useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Check, ExternalLink, FileText, Loader2, MessageSquare, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { buildOfferUrl } from "@/lib/offers/offer-links";

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
  // Lecturas con la identidad efectiva (al impersonar, la del agente); las escrituras
  // siguen firmadas por el usuario real (`realAuthUserId`).
  const {
    personaId: agentPersonaId,
    authUserId: effectiveAuthUserId,
    realAuthUserId,
  } = useEffectiveAgent();
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

  // Entidades del prospecto (proyectos asignados) del agente.
  // Se unen los DOS modelos de propiedad del lead: id_persona_duena_lead (portal) y
  // crm_leads_atribucion.id_propietario (CRM). Sin la unión, un lead que entró por el CRM
  // aparecía en la lista pero al abrirlo salía vacío: sin proyectos, notas, citas ni ofertas.
  const { data: entidades = [] } = useQuery({
    queryKey: ["prospecto-entidades", personaId, agentPersonaId, effectiveAuthUserId],
    queryFn: async () => {
      const sel = "id, id_proyecto, proyectos!entidades_relacionadas_id_proyecto_fkey(id, nombre)";
      const base = () => supabase
        .from("entidades_relacionadas")
        .select(sel)
        .eq("id_persona", personaId)
        .eq("id_tipo_entidad", 7)
        .eq("activo", true);

      const porDueno = agentPersonaId
        ? await base().eq("id_persona_duena_lead", agentPersonaId)
        : { data: [] as any[] };

      let porAtribucion: any[] = [];
      if (effectiveAuthUserId) {
        const { data: atr } = await (supabase as any)
          .from("crm_leads_atribucion")
          .select("id_entidad_relacionada")
          .eq("id_propietario", effectiveAuthUserId)
          .eq("activo", true);
        const ids = (atr ?? []).map((a: any) => a.id_entidad_relacionada).filter(Boolean);
        if (ids.length > 0) {
          const { data } = await base().in("id", ids);
          porAtribucion = data ?? [];
        }
      }

      const unicas = new Map<number, any>();
      [...((porDueno as any).data ?? []), ...porAtribucion].forEach((e: any) => unicas.set(e.id, e));
      return [...unicas.values()];
    },
    enabled: personaId > 0 && (!!agentPersonaId || !!effectiveAuthUserId),
  });

  const entidadIds = useMemo(() => entidades.map((e) => e.id), [entidades]);

  // Notas (crm_notas) por entidad. Nota interna: solo las ve el agente que las creó.
  const { data: notas = [] } = useQuery({
    queryKey: ["prospecto-notas", entidadIds, effectiveAuthUserId],
    queryFn: async () => {
      if (entidadIds.length === 0 || !effectiveAuthUserId) return [];
      const { data } = await (supabase as any)
        .from("crm_notas")
        .select("id, contenido, fecha_creacion, id_usuario")
        .in("id_entidad_relacionada", entidadIds)
        .eq("activo", true)
        .eq("id_usuario", effectiveAuthUserId)
        .order("fecha_creacion", { ascending: false });
      return (data || []) as any[];
    },
    enabled: entidadIds.length > 0 && !!effectiveAuthUserId,
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

  // Ofertas del prospecto, con el token del link y si ya tienen cuenta de cobranza
  // (en ese caso la unidad ya no está disponible y el link no lleva al pago).
  const { data: ofertas = [] } = useQuery({
    queryKey: ["prospecto-ofertas", personaId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ofertas")
        .select("id, fecha_generacion, id_propiedad, id_producto")
        .eq("id_persona_lead", personaId)
        .eq("activo", true)
        .order("fecha_generacion", { ascending: false });

      const rows = (data || []) as any[];
      if (rows.length === 0) return rows;

      const ofertaIds = rows.map((o) => o.id);
      const propIds = [...new Set(rows.map((o) => o.id_propiedad).filter(Boolean))];

      const [reservasRes, cuentasRes, propsRes] = await Promise.all([
        (supabase as any).from("reservaciones")
          .select("id_oferta, token").in("id_oferta", ofertaIds).eq("activo", true)
          .order("id", { ascending: false }),
        (supabase as any).from("cuentas_cobranza")
          .select("id, id_oferta").in("id_oferta", ofertaIds).eq("activo", true),
        propIds.length > 0
          ? (supabase as any).from("propiedades").select("id, numero_propiedad").in("id", propIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const tokenPorOferta = new Map<number, string>();
      for (const r of (reservasRes.data || [])) {
        if (!tokenPorOferta.has(r.id_oferta)) tokenPorOferta.set(r.id_oferta, r.token);
      }
      const conCuenta = new Set((cuentasRes.data || []).map((c: any) => c.id_oferta));
      const propMap = new Map<number, string>(
        (propsRes.data || []).map((p: any) => [p.id, p.numero_propiedad])
      );

      return rows.map((o) => ({
        ...o,
        token: tokenPorOferta.get(o.id) || null,
        tiene_cuenta: conCuenta.has(o.id),
        propiedad_nombre: propMap.get(o.id_propiedad) || "",
      }));
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
        id_usuario: realAuthUserId,   // la nota la firma quien realmente escribe, no el impersonado
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
    return <div ><AgentPortalHeader /><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" /></div></div>;
  }
  if (!persona) {
    return <div ><AgentPortalHeader /><div className="py-16 text-center text-sm text-muted-foreground">Prospecto no encontrado</div></div>;
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
    <div >
      <AgentPortalHeader />

      <div className="mx-auto max-w-[1040px] space-y-4">
        <button
          onClick={() => navigate("/admin/agent/prospectos")}
          title="Prospectos"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-card transition-colors hover:bg-gray-50"
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
                <span className="text-xl font-bold tracking-[-0.3px] text-foreground">{mask(persona.nombre_legal || persona.email)}</span>
                <Badge className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary hover:bg-primary/10">
                  {entidades.length} {entidades.length === 1 ? "desarrollo" : "desarrollos"}
                </Badge>
                <Badge variant="secondary" className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-muted">{tipoLabel}</Badge>
              </div>
              <div className="mt-3.5 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {infoRows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 border-b border-border py-1.5">
                    <span className="text-xs font-medium text-muted-foreground/70">{label}</span>
                    <span className={cn(
                      "truncate text-right text-xs tabular-nums",
                      value === "Sin datos" ? "font-medium text-muted-foreground/70" : "font-bold text-foreground"
                    )}>{value === "Sin datos" ? value : mask(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <ActionButton icon={Pencil} variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Editar
            </ActionButton>
            <ActionButton icon={CalendarPlus} variant="outline" size="sm" onClick={() => setCitaOpen(true)}>
              Agendar visita
            </ActionButton>
            <ActionButton icon={FileText} size="sm" onClick={() => navigate("/admin/agent/inventario")}>
              Generar oferta
            </ActionButton>
          </div>

          {/* Desarrollos de interés — solo lectura. Se editan desde el botón "Editar". */}
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground/70">Desarrollos de interés</p>
            <div className="flex flex-wrap gap-2">
              {entidades.map((e) => (
                <span
                  key={e.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-card px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  <Check className="h-3.5 w-3.5" /> {e.proyectos?.nombre || `Proyecto ${e.id_proyecto}`}
                </span>
              ))}
              {entidades.length === 0 && (
                <span className="text-xs text-muted-foreground/70">Sin desarrollos · edítalos desde “Editar”.</span>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Ofertas digitales del prospecto */}
        {ofertas.length > 0 && (
          <SectionCard icon={FileText} title="Ofertas digitales" bodyClassName="p-5 md:p-6">
            <div className="space-y-2.5">
              {ofertas.map((o: any) => {
                const base = buildOfferUrl(o.id);
                const link = buildOfferUrl(o.id, o.token);
                return (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {o.propiedad_nombre ? `Unidad ${o.propiedad_nombre}` : `Oferta #${o.id}`}
                        {o.id_producto ? " · producto" : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {o.fecha_generacion
                          ? new Date(o.fecha_generacion).toLocaleDateString("es-MX", {
                              day: "2-digit", month: "short", year: "numeric",
                            })
                          : ""}
                        {o.tiene_cuenta && " · Ya no está disponible para venta"}
                        {!o.tiene_cuenta && !o.token && " · Sin link de cliente"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => window.open(link, "_blank", "noopener")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver oferta
                    </Button>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Actividad */}
        <SectionCard icon={MessageSquare} title="Actividad" bodyClassName="p-5 md:p-6">
          {/* Composer — solo se muestra al crear una nota */}
          <div className="mb-5">
            {!composerOpen ? (
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                disabled={entidadIds.length === 0}
                className="w-full rounded-md border border-gray-200 bg-card px-3 py-2.5 text-left text-xs text-muted-foreground/70 transition-colors hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Agregar nota o comentario…
              </button>
            ) : (
              <div>
                <NoteEditor value={nota} onChange={setNota} storagePrefix={`crm-notas/${personaId}`} autoFocus />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground/70">Nota interna · solo visible para ti.</p>
                  <div className="flex gap-2">
                    <Button variant="cancel" size="sm" onClick={() => { setComposerOpen(false); setNota(""); }}>
                      Cancelar
                    </Button>
                    <Button
                      variant="primary-outline"
                      size="sm"
                      disabled={addNota.isPending || entidadIds.length === 0 || (!nota.replace(/<[^>]+>/g, "").trim() && !/<img/i.test(nota))}
                      onClick={() => addNota.mutate(nota)}
                    >
                      {addNota.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar nota
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Timeline - máx ~6 filas, luego scroll */}
          {timeline.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground/70">Aún no hay actividad registrada</p>
          ) : (
            <div className="max-h-[440px] overflow-y-auto pr-1">
              <div className="flex flex-col">
                {timeline.map((it, i) => {
                  const last = i === timeline.length - 1;
                  const ring = it.kind === "cita" ? "border-blue-600 bg-blue-50" : it.kind === "nota" ? "border-amber-600 bg-amber-100" : "border-primary bg-primary/10";
                  return (
                    <div key={it.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        {it.kind === "nota" && it.notaId ? (
                          <button
                            type="button"
                            onClick={() => setNotaModal({ id: it.notaId!, contenido: it.html || "", mode: "edit" })}
                            title="Editar nota"
                            className={`h-[26px] w-[26px] shrink-0 rounded-full border-2 ${ring} transition hover:ring-2 hover:ring-amber-600/40`}
                          />
                        ) : (
                          <span className={`h-[26px] w-[26px] shrink-0 rounded-full border-2 ${ring}`} />
                        )}
                        {!last && <span className="min-h-3 w-0.5 flex-1 bg-muted" />}
                      </div>
                      <div className="min-w-0 flex-1 pb-5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-foreground">{it.title}</span>
                            <span className="text-xs tabular-nums text-muted-foreground/70">
                              {it.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })} · {it.date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {it.kind === "nota" && it.notaId && (
                            <div className="flex shrink-0 items-center gap-3.5">
                              {it.long && (
                                <button
                                  type="button"
                                  onClick={() => setNotaModal({ id: it.notaId!, contenido: it.html || "", mode: "view" })}
                                  className="text-xs font-semibold text-primary transition-colors hover:underline"
                                >
                                  Ver detalle
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setNotaModal({ id: it.notaId!, contenido: it.html || "", mode: "edit" })}
                                className="text-xs font-semibold text-amber-600 transition-colors hover:underline"
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
                              className="mt-0.5 line-clamp-3 text-xs leading-snug text-muted-foreground [&_img]:mt-1 [&_img]:inline-block [&_img]:h-auto [&_img]:max-h-20 [&_img]:w-auto [&_img]:max-w-[120px] [&_img]:cursor-pointer [&_img]:rounded [&_img]:border [&_img]:border-gray-100 [&_p]:my-0.5 [&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4 [&_a]:cursor-pointer [&_a]:font-medium [&_a]:text-primary [&_a]:underline"
                              dangerouslySetInnerHTML={{ __html: it.html }}
                            />
                          )
                        ) : (
                          it.detail && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{it.detail}</p>
                        )}
                        {it.by && <p className="mt-1 text-xs text-muted-foreground/70">{it.by}</p>}
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
          <ModalFormHeader
            title={notaModal?.mode === "edit" ? "Editar nota" : "Nota interna"}
            subtitle="Solo visible para ti"
          />

          <div className={cn(MODAL_BODY_CLS, "max-h-[calc(90vh-9rem)]")}>
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
                className="prose prose-sm max-w-none rounded-md border border-border bg-muted p-4 text-sm leading-relaxed text-foreground [&_img]:mx-auto [&_img]:my-2 [&_img]:block [&_img]:h-auto [&_img]:max-h-72 [&_img]:w-auto [&_img]:max-w-full [&_img]:cursor-pointer [&_img]:rounded-lg [&_img]:border [&_img]:border-gray-100 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:cursor-pointer [&_a]:font-medium [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: notaModal?.contenido || "" }}
              />
            )}
          </div>

          {/* Footer estándar: acciones a la derecha. En edición solo se guarda. */}
          <div className={MODAL_FOOTER_CLS}>
            {notaModal?.mode === "view" ? (
              <>
                <Button
                  type="button"
                  variant="cancel"
                  disabled={deleteNota.isPending}
                  onClick={() => notaModal && deleteNota.mutate(notaModal.id)}
                >
                  {deleteNota.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Eliminar
                </Button>
                <Button
                  type="button"
                  variant="primary-outline"
                  onClick={() => setNotaModal((m) => (m ? { ...m, mode: "edit" } : m))}
                >
                  Editar
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="primary-outline"
                disabled={updateNota.isPending || !notaModal || (!notaModal.contenido.replace(/<[^>]+>/g, "").trim() && !/<img/i.test(notaModal.contenido))}
                onClick={() => notaModal && updateNota.mutate({ id: notaModal.id, contenido: notaModal.contenido })}
              >
                {updateNota.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Visor in-app de adjuntos (imagen / PDF): estándar ui/modal-viewer */}
      <ModalViewer
        open={!!previewFile}
        onOpenChange={(o) => !o && setPreviewFile(null)}
        url={previewFile?.url || ""}
        title={previewFile?.name || "Adjunto"}
      />
    </div>
  );
};

export default AgentProspectoDetalle;
