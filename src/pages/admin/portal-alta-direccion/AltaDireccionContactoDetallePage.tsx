/**
 * Detalle de Contacto — Portal Alta Dirección (ESPEJO DE SOLO LECTURA).
 *
 * Ficha de un contacto del CRM en modo auditoría: reproduce las secciones de
 * `CrmContactDetail` (datos, atribución Meta, actividad, negocios, tickets)
 * SIN edición. Reusa la misma fuente de datos (mismas queries de solo lectura)
 * y el `ActivityPanel` del CRM con `canEdit={false}` (que oculta compositor y
 * botones de crear/editar). Negocios y Tickets se muestran como listas de solo
 * lectura propias (sus tarjetas del CRM no tienen modo `canEdit`).
 */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, Building2, Briefcase, Ticket, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/admin/portal-alta-direccion/ui";
import { fmtDate, fmtMXN, leadStatusLabel, lifecycleLabel } from "@/lib/crm-lib";
import { useLeadStates, fetchCrmOwners, fetchCrmCategorias } from "@/hooks/useCrmCatalogos";
import { fetchNoteAttachments } from "@/pages/admin/portal-crm/crm-adjuntos";
import { ActivityPanel } from "@/pages/admin/portal-crm/crm-actividad";

const BACK = "/admin/portal-alta-direccion/prospectos";

export function AltaDireccionContactoDetalle() {
  const { contactId } = useParams<{ contactId: string }>();

  const { data: leadStates = [] } = useLeadStates();
  const { data: owners = [] } = useQuery({ queryKey: ["crm-owners"], queryFn: fetchCrmOwners });

  const { data: contact, isLoading } = useQuery({
    queryKey: ["altadir-contacto", contactId],
    enabled: !!contactId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const erId = Number(contactId);
      const { data: er } = await (supabase as any).from("entidades_relacionadas")
        .select("id, id_persona, id_proyecto, id_tipo_entidad, fecha_creacion, fecha_actualizacion")
        .eq("id", erId).maybeSingle();
      if (!er) return null;
      const { data: p } = await (supabase as any).from("personas")
        .select("id, nombre_legal, nombre_comercial, email, telefono").eq("id", er.id_persona).maybeSingle();
      if (!p) return null;
      let a: any = null;
      const atrRes = await (supabase as any).from("crm_leads_atribucion")
        .select("*").eq("id_entidad_relacionada", erId).eq("activo", true).maybeSingle();
      if (!atrRes.error) a = atrRes.data;
      // Proyecto (por id, sin filtro activo → pasa RLS).
      let development_name: string | null = null;
      if (er.id_proyecto) {
        const { data: proy } = await (supabase as any).from("proyectos").select("nombre").eq("id", er.id_proyecto).maybeSingle();
        development_name = proy?.nombre ?? null;
      }
      // Propietario.
      let owner_name: string | null = null;
      if (a?.id_propietario) {
        const { data: us } = await (supabase as any).from("usuarios").select("nombre").eq("auth_user_id", a.id_propietario).maybeSingle();
        owner_name = us?.nombre ?? null;
      }
      return {
        id: String(er.id),
        id_persona: er.id_persona,
        full_name: (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim(),
        email: p.email ?? null,
        phone: p.telefono ?? null,
        development_name,
        lead_status: a?.estatus_lead ?? "nuevo",
        lifecycle_stage: a?.etapa_ciclo_vida ?? (er.id_tipo_entidad === 2 ? "customer" : "lead"),
        contact_owner: a?.id_propietario ?? null,
        owner_name,
        created_at: er.fecha_creacion ?? null,
        last_activity_at: er.fecha_actualizacion ?? null,
        origen: a?.origen ?? null,
        meta_form_name: a?.meta_form_name ?? null,
        meta_campaign_id: a?.meta_campaign_id ?? null,
        meta_ad_id: a?.meta_ad_id ?? null,
        meta_platform: a?.meta_platform ?? null,
        meta_created_time: a?.meta_created_time ?? null,
        meta_field_data: a?.meta_field_data ?? null,
      };
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["altadir-contacto-categorias", contactId],
    enabled: !!contactId,
    queryFn: async (): Promise<string[]> => {
      const { data: rels } = await (supabase as any).from("entidades_relacionadas_categorias")
        .select("id_categoria").eq("id_entidad_relacionada", Number(contactId)).eq("activo", true);
      const ids = (rels ?? []).map((r: any) => r.id_categoria);
      if (!ids.length) return [];
      const catalog = await fetchCrmCategorias();
      const nameById = Object.fromEntries(catalog.map((c) => [c.id, c.nombre]));
      return ids.map((id: number) => nameById[id]).filter(Boolean);
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["altadir-contacto-notes", contactId],
    enabled: !!contactId,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_notas")
        .select("id, contenido, fecha_creacion, id_usuario, anclado")
        .eq("id_entidad_relacionada", Number(contactId)).eq("activo", true)
        .order("anclado", { ascending: false }).order("fecha_creacion", { ascending: false });
      if (res.error) return [];
      const rows = res.data ?? [];
      const authorIds = Array.from(new Set(rows.map((n: any) => n.id_usuario).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (authorIds.length) {
        const { data: us } = await (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", authorIds);
        nameMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
      }
      const attByNote = await fetchNoteAttachments(rows.map((n: any) => n.id));
      return rows.map((n: any) => ({ id: n.id, content: n.contenido, created_at: n.fecha_creacion, author: n.id_usuario ? (nameMap[n.id_usuario] ?? null) : null, anclado: n.anclado ?? false, attachments: attByNote[n.id] ?? [] }));
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["altadir-contacto-tasks", contactId],
    enabled: !!contactId,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_tareas")
        .select("id, titulo, tipo, prioridad, estatus, descripcion, fecha_vencimiento, fecha_creacion")
        .eq("id_entidad_relacionada", Number(contactId)).eq("activo", true)
        .order("fecha_vencimiento", { ascending: true });
      if (res.error) return [];
      return (res.data ?? []).map((t: any) => ({
        id: t.id, title: t.titulo, status: t.estatus, priority: t.prioridad,
        due_date: t.fecha_vencimiento, created_at: t.fecha_creacion,
        descripcion: t.descripcion ?? null,
      }));
    },
  });

  const { data: citas = [] } = useQuery({
    queryKey: ["altadir-contacto-citas", contactId],
    enabled: !!contactId,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_citas")
        .select("id, titulo, tipo, estatus, fecha_inicio, fecha_fin, ubicacion, enlace_reunion, resultado, descripcion, fecha_creacion")
        .eq("id_entidad_relacionada", Number(contactId)).eq("activo", true)
        .order("fecha_inicio", { ascending: false });
      if (res.error) return [];
      return (res.data ?? []).map((c: any) => ({
        id: c.id, title: c.titulo, tipo: c.tipo, status: c.estatus,
        start_at: c.fecha_inicio, end_at: c.fecha_fin,
        ubicacion: c.ubicacion ?? null, enlace: c.enlace_reunion ?? null,
        resultado: c.resultado ?? null, descripcion: c.descripcion ?? null, created_at: c.fecha_creacion,
      }));
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["altadir-contacto-deals", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data: negocios, error } = await (supabase as any).from("crm_negocios")
        .select("id, nombre, valor, moneda, id_pipeline, id_etapa, prioridad")
        .eq("id_entidad_relacionada", Number(contactId)).eq("activo", true)
        .order("fecha_creacion", { ascending: false });
      if (error || !negocios?.length) return [];
      const etapaIds = Array.from(new Set(negocios.map((n: any) => n.id_etapa).filter(Boolean)));
      const pipeIds = Array.from(new Set(negocios.map((n: any) => n.id_pipeline).filter(Boolean)));
      const [etRes, pRes] = await Promise.all([
        etapaIds.length ? (supabase as any).from("crm_pipeline_etapas").select("id, nombre").in("id", etapaIds) : Promise.resolve({ data: [] }),
        pipeIds.length ? (supabase as any).from("crm_pipelines").select("id, nombre").in("id", pipeIds) : Promise.resolve({ data: [] }),
      ]);
      const etapaMap = Object.fromEntries((etRes.data ?? []).map((e: any) => [e.id, e.nombre]));
      const pipeMap = Object.fromEntries((pRes.data ?? []).map((p: any) => [p.id, p.nombre]));
      return negocios.map((n: any) => ({
        ...n, etapa_nombre: etapaMap[n.id_etapa] ?? "—",
        pipeline_nombre: n.id_pipeline ? (pipeMap[n.id_pipeline] ?? null) : null,
      }));
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["altadir-contacto-tickets", contactId, contact?.id_persona],
    enabled: !!contactId,
    queryFn: async () => {
      // Persona → todas sus entidades → tickets ligados a cualquiera de ellas.
      let entIds: number[] = [Number(contactId)];
      if (contact?.id_persona) {
        const { data: ents } = await (supabase as any).from("entidades_relacionadas")
          .select("id").eq("id_persona", contact.id_persona).eq("activo", true);
        if (ents?.length) entIds = ents.map((e: any) => e.id);
      }
      const { data: tk, error } = await (supabase as any).from("tickets")
        .select("id, numero, nombre, prioridad, id_etapa").in("id_entidad_relacionada", entIds);
      if (error || !tk?.length) return [];
      const etapaIds = Array.from(new Set(tk.map((t: any) => t.id_etapa).filter(Boolean)));
      let etapaMap: Record<number, string> = {};
      if (etapaIds.length) {
        const { data: et } = await (supabase as any).from("tickets_etapas").select("id, nombre").in("id", etapaIds);
        etapaMap = Object.fromEntries((et ?? []).map((e: any) => [e.id, e.nombre]));
      }
      return tk.map((t: any) => ({ ...t, etapa_nombre: t.id_etapa ? (etapaMap[t.id_etapa] ?? "—") : "—" }));
    },
  });

  const leadState = leadStates.find((s) => s.value === contact?.lead_status);
  const leadLabel = leadState?.label ?? (contact ? leadStatusLabel[contact.lead_status] ?? contact.lead_status : "—");
  const leadStyle = leadState?.color
    ? { backgroundColor: `${leadState.color}1a`, color: leadState.color, borderColor: `${leadState.color}55` }
    : undefined;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!contact) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Contacto no encontrado.</p>
        <Link to={BACK} className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver a Contactos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={BACK} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Contactos
        </Link>
        <Pill className="bg-muted text-muted-foreground">Solo lectura · auditoría</Pill>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Columna izquierda — datos del contacto */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary ring-1 ring-primary/15">
                {contact.full_name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-foreground">{contact.full_name}</h1>
                <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium" style={leadStyle}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> {leadLabel}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{contact.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span className="tabular-nums">{contact.phone || "—"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acerca de este contacto</p>
            <dl className="space-y-2.5 text-sm">
              <Field label="Categoría">
                {categorias.length ? (
                  <span className="flex flex-wrap gap-1">
                    {categorias.map((c) => (
                      <span key={c} className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{c}</span>
                    ))}
                  </span>
                ) : "—"}
              </Field>
              <Field label="Proyecto">
                {contact.development_name ? (
                  <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{contact.development_name}</span>
                ) : "Sin proyecto"}
              </Field>
              <Field label="Etapa ciclo de vida">
                <span className="inline-flex items-center rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {lifecycleLabel[contact.lifecycle_stage] ?? contact.lifecycle_stage}
                </span>
              </Field>
              <Field label="Propietario">{contact.owner_name ?? "Sin asignar"}</Field>
              <Field label="Fecha de creación">{contact.created_at ? fmtDate(contact.created_at) : "—"}</Field>
              <Field label="Última actualización">{contact.last_activity_at ? fmtDate(contact.last_activity_at) : "—"}</Field>
            </dl>
          </div>
        </aside>

        {/* Columna central — actividad + información avanzada */}
        <section className="lg:col-span-8 xl:col-span-6">
          <div className="rounded-xl border bg-card p-4">
            <Tabs defaultValue="actividad">
              <TabsList>
                <TabsTrigger value="actividad">Actividades</TabsTrigger>
                <TabsTrigger value="avanzada">Información avanzada</TabsTrigger>
              </TabsList>
              <TabsContent value="actividad" className="mt-4">
                <ActivityPanel
                  contactId={contact.id}
                  userId={null}
                  owners={owners}
                  contact={contact}
                  notes={notes}
                  tasks={tasks}
                  citas={citas}
                  includeSystem
                  canEdit={false}
                  onSaved={() => {}}
                />
              </TabsContent>
              <TabsContent value="avanzada" className="mt-4">
                <dl className="space-y-2.5 text-sm">
                  <Field label="Fuente del registro">{contact.origen || (contact.meta_platform ? "Meta" : "Manual")}</Field>
                  <Field label="Formulario (Meta)">{contact.meta_form_name || "—"}</Field>
                  <Field label="Campaña (Meta)"><span className="font-mono text-xs">{contact.meta_campaign_id || "—"}</span></Field>
                  <Field label="Anuncio (Meta)"><span className="font-mono text-xs">{contact.meta_ad_id || "—"}</span></Field>
                  <Field label="Plataforma (Meta)">{contact.meta_platform || "—"}</Field>
                  <Field label="Fecha lead (Meta)">{contact.meta_created_time ? fmtDate(contact.meta_created_time) : "—"}</Field>
                  <Field label="Respuestas del formulario">
                    {Array.isArray(contact.meta_field_data) && contact.meta_field_data.length
                      ? `${contact.meta_field_data.length} ${contact.meta_field_data.length === 1 ? "respuesta" : "respuestas"}`
                      : "—"}
                  </Field>
                </dl>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* Columna derecha — negocios + tickets (solo lectura) */}
        <aside className="lg:col-span-12 xl:col-span-3 space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Briefcase className="h-4 w-4 text-muted-foreground" /> Negocios
              <span className="text-xs font-normal text-muted-foreground">{deals.length}</span>
            </p>
            {!deals.length ? (
              <p className="text-xs text-muted-foreground">Sin negocios asociados</p>
            ) : (
              <ul className="space-y-2">
                {deals.map((d: any) => (
                  <li key={d.id} className="rounded-lg border border-border p-2.5">
                    <p className="text-sm font-medium">{d.nombre || "Negocio"}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{d.pipeline_nombre ? `${d.pipeline_nombre} · ` : ""}{d.etapa_nombre}</span>
                      <span className="font-semibold tabular-nums text-foreground">{d.valor != null ? fmtMXN(Number(d.valor)) : "—"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Ticket className="h-4 w-4 text-muted-foreground" /> Tickets
              <span className="text-xs font-normal text-muted-foreground">{tickets.length}</span>
            </p>
            {!tickets.length ? (
              <p className="text-xs text-muted-foreground">Sin tickets asociados</p>
            ) : (
              <ul className="space-y-2">
                {tickets.map((t: any) => (
                  <li key={t.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium">{t.nombre || `Ticket ${t.numero ?? t.id}`}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{t.numero ? `#${t.numero}` : ""}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t.etapa_nombre}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default AltaDireccionContactoDetalle;
