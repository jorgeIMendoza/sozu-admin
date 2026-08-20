import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, Briefcase, CheckCircle2, ListTodo,
  RefreshCw, TrendingUp, Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmOrgId } from "@/hooks/useCrmOrgId";
import { PageHeader, ComingSoon } from "@/components/admin/portal-crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { relTime, fmtDateTime, fmtMXN } from "@/lib/crm-lib";
import { fmtPct, fmtNum, sumInsights } from "@/lib/crm-marketing";

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function CrmDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["crm-dashboard-real"],
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const now = Date.now();
      const [negocios, etapas, leadsTotal, leadsMeta, citas, capiSent30] = await Promise.all([
        (supabase as any).from("crm_negocios").select("id, valor, id_etapa").eq("activo", true),
        (supabase as any).from("crm_pipeline_etapas").select("id, nombre, orden, es_ganado, es_perdido, color").eq("activo", true),
        (supabase as any).from("crm_leads_atribucion").select("id", { count: "exact", head: true }).eq("activo", true),
        (supabase as any).from("crm_leads_atribucion").select("id", { count: "exact", head: true }).eq("activo", true).not("meta_leadgen_id", "is", null),
        (supabase as any).from("crm_citas").select("id, fecha_inicio").eq("activo", true),
        (supabase as any).from("crm_meta_capi_eventos").select("id", { count: "exact", head: true }).eq("status", "sent").gte("fecha_creacion", since30),
      ]);

      const negRows = negocios.data ?? [];
      const etapaMap = new Map((etapas.data ?? []).map((e: any) => [e.id, e]));
      let pipelineValue = 0, wonValue = 0;
      const byStage = new Map<number, { nombre: string; orden: number; color: string | null; count: number; valor: number }>();
      for (const n of negRows) {
        const et = etapaMap.get(n.id_etapa) as any;
        const val = Number(n.valor ?? 0);
        if (et?.es_ganado) wonValue += val;
        else if (!et?.es_perdido) pipelineValue += val;
        if (et && !et.es_perdido) {
          const cur = byStage.get(n.id_etapa) ?? { nombre: et.nombre, orden: et.orden ?? 999, color: et.color ?? null, count: 0, valor: 0 };
          cur.count += 1; cur.valor += val;
          byStage.set(n.id_etapa, cur);
        }
      }
      const stages = [...byStage.values()].sort((a, b) => a.orden - b.orden);
      const citasRows = citas.data ?? [];
      const citasProximas = citasRows.filter((c: any) => c.fecha_inicio && new Date(c.fecha_inicio).getTime() >= now).length;

      return {
        dealsCount: negRows.length,
        pipelineValue, wonValue, stages,
        leadsTotal: leadsTotal.count ?? 0,
        leadsMeta: leadsMeta.count ?? 0,
        citasCount: citasRows.length,
        citasProximas,
        capiSent30: capiSent30.count ?? 0,
      };
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel principal"
        description="Resumen del CRM · pipeline, leads y actividad"
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Leads" value={isLoading ? "…" : fmtNum(data?.leadsTotal ?? 0)} icon={Users} hint={isLoading ? "" : `de Meta: ${fmtNum(data?.leadsMeta ?? 0)}`} />
        <KpiCard label="Negocios activos" value={isLoading ? "…" : fmtNum(data?.dealsCount ?? 0)} icon={Briefcase} />
        <KpiCard label="Pipeline activo" value={isLoading ? "…" : fmtMXN(data?.pipelineValue ?? 0)} icon={TrendingUp} hint="valor en proceso" />
        <KpiCard label="Ganado" value={isLoading ? "…" : fmtMXN(data?.wonValue ?? 0)} icon={CheckCircle2} hint="valor cerrado ganado" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Pipeline por etapa</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40" /> : !(data?.stages?.length) ? (
              <p className="text-sm text-muted-foreground">Sin negocios activos todavía.</p>
            ) : (
              <div className="space-y-1">
                {data!.stages.map((s) => (
                  <div key={s.nombre} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color ?? "var(--muted-foreground)" }} />
                      {s.nombre}
                    </span>
                    <span className="text-muted-foreground">{fmtNum(s.count)} · {fmtMXN(s.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Actividad</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-24" /> : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Stat label="Citas" value={fmtNum(data?.citasCount ?? 0)} />
                <Stat label="Citas próximas" value={fmtNum(data?.citasProximas ?? 0)} />
                <Stat label="Leads de Meta" value={fmtNum(data?.leadsMeta ?? 0)} />
                <Stat label="Señal a Meta (30d)" value={fmtNum(data?.capiSent30 ?? 0)} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, hint }: { label: string; value: string; icon: any; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>{label}</span>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

// ─── Alertas ─────────────────────────────────────────────────────────────────

const SEVERITY_TONE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

const TYPE_CATEGORY: Record<string, "marketing" | "crm" | "tracking" | "conversion"> = {
  cpl_spike: "marketing", cpql_spike: "marketing", budget_pacing: "marketing",
  spend_no_leads: "marketing", no_appointments: "marketing", campaign_no_mapping: "marketing",
  no_crm_progress: "marketing", discrepancy: "tracking", tracking_gap: "tracking",
  duplicates: "tracking", conv_no_clickid: "tracking", deal_no_source: "tracking",
  no_followup: "crm", no_outcome: "crm", qualified_no_appointment: "crm",
  deal_no_next_task: "crm", conversion_event: "conversion",
};

function categoryFor(t: string) { return TYPE_CATEGORY[t] ?? "marketing"; }

export function CrmAlertas() {
  const orgId = useCrmOrgId();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState<"all" | "marketing" | "crm" | "tracking" | "conversion">("all");
  const [status, setStatus] = useState<"open" | "reviewed" | "all">("open");
  const [recalculating, setRecalculating] = useState(false);

  const recalc = async () => {
    if (!orgId) return;
    setRecalculating(true);
    const { data, error } = await (supabase as any).rpc("run_alerts_evaluation_full", { _org: orgId });
    setRecalculating(false);
    if (error) return toast.error(error.message);
    const created = (data as any)?.created ?? 0;
    toast.success(created ? `${created} alertas nuevas detectadas` : "Sin nuevas alertas");
    qc.invalidateQueries({ queryKey: ["crm-alerts"] });
  };

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["crm-alerts", orgId, severity, status],
    enabled: !!orgId,
    queryFn: async () => {
      let q = (supabase as any).from("alerts").select("*").eq("organization_id", orgId!).order("created_at", { ascending: false }).limit(300);
      if (severity !== "all") q = q.eq("severity", severity);
      if (status !== "all") q = q.eq("status", status);
      return (await q).data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!alerts) return [];
    if (category === "all") return alerts;
    return alerts.filter((a: any) => categoryFor(a.alert_type) === category);
  }, [alerts, category]);

  const markReviewed = async (id: string) => {
    const { error } = await (supabase as any).from("alerts").update({ status: "reviewed", reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Alerta marcada como revisada");
    qc.invalidateQueries({ queryKey: ["crm-alerts"] });
  };

  const createTask = async (a: any) => {
    if (!orgId) return;
    const { error } = await (supabase as any).from("tasks").insert({
      organization_id: orgId,
      contact_id: a.related_contact_id ?? null,
      assigned_to: user?.id ?? null,
      title: `Revisar alerta: ${a.title}`,
      task_type: "follow_up",
      priority: a.severity === "critical" ? "high" : "normal",
      due_date: new Date().toISOString().slice(0, 10),
    });
    if (error) return toast.error(error.message);
    toast.success("Tarea creada desde alerta");
    qc.invalidateQueries({ queryKey: ["crm-tasks"] });
  };

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 };
    (alerts ?? []).forEach((a: any) => { (c as any)[a.severity] = ((c as any)[a.severity] ?? 0) + 1; });
    return c;
  }, [alerts]);

  return (
    <div className="space-y-4">
      <PageHeader title="Alertas" description="Anomalías, gaps de tracking y discrepancias entre Meta/Google y CRM"
        actions={
          <Button size="sm" variant="outline" onClick={recalc} disabled={recalculating || !orgId}>
            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculando…" : "Recalcular alertas"}
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Críticas</div><div className="text-2xl font-semibold text-destructive">{counts.critical}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Advertencias</div><div className="text-2xl font-semibold text-amber-600">{counts.warning}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Informativas</div><div className="text-2xl font-semibold">{counts.info}</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="open">Abiertas</TabsTrigger>
            <TabsTrigger value="reviewed">Revisadas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder="Severidad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Severidad: todas</SelectItem>
            <SelectItem value="critical">Crítica</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => setCategory(v as any)}>
          <SelectTrigger className="w-[200px] h-9 text-sm"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Categoría: todas</SelectItem>
            <SelectItem value="marketing">Marketing</SelectItem>
            <SelectItem value="crm">CRM</SelectItem>
            <SelectItem value="tracking">Tracking</SelectItem>
            <SelectItem value="conversion">Conversion events</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : !filtered.length ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Sin alertas en este filtro.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="p-3 flex items-start gap-3 flex-wrap">
                <div className={`mt-0.5 rounded p-1.5 ${SEVERITY_TONE[a.severity] ?? ""}`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{a.title}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{a.severity}</Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">{categoryFor(a.alert_type)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{a.alert_type}</Badge>
                    {a.status !== "open" && <Badge variant="secondary" className="text-[10px]">{a.status}</Badge>}
                  </div>
                  {a.description && <div className="text-xs text-muted-foreground mt-1">{a.description}</div>}
                  {a.recommendation && <div className="text-xs text-foreground mt-1"><span className="text-muted-foreground">Recomendación:</span> {a.recommendation}</div>}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span>{relTime(a.created_at)}</span>
                    {a.metric_name && <span>· {a.metric_name}: {a.current_value} {a.previous_value ? `(prev ${a.previous_value})` : ""}</span>}
                    {a.related_contact_id && <Link to={`/admin/portal-crm/ventas/contactos/${a.related_contact_id}`} className="hover:text-foreground underline">Ver contacto →</Link>}
                    {a.related_campaign_id && <Link to="/admin/portal-crm/marketing/campanas" className="hover:text-foreground underline">Ver campaña →</Link>}
                    {a.alert_type === "conversion_event" && <Link to="/admin/portal-crm/eventos-conversion" className="hover:text-foreground underline">Ver eventos →</Link>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => createTask(a)}><ListTodo className="h-3.5 w-3.5 mr-1" />Crear tarea</Button>
                  {a.status === "open" && (
                    <Button size="sm" variant="ghost" onClick={() => markReviewed(a.id)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Revisada</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{filtered.length} alertas · reglas evaluadas sobre datos reales</p>
    </div>
  );
}

// ─── Tracking Health ──────────────────────────────────────────────────────────

export function CrmTrackingHealth() {
  const [tab, setTab] = useState("sin_origen");

  const { data, isLoading } = useQuery({
    queryKey: ["crm-tracking-health-real"],
    queryFn: async () => {
      const [leadsRes, capiErrRes] = await Promise.all([
        (supabase as any).from("crm_leads_atribucion")
          .select("id, id_entidad_relacionada, origen, meta_leadgen_id, meta_campaign_id, meta_form_name, meta_platform, hubspot_id, estatus_lead, fecha_creacion")
          .eq("activo", true).order("fecha_creacion", { ascending: false }).limit(2000),
        (supabase as any).from("crm_meta_capi_eventos")
          .select("id, id_entidad_relacionada, event_name, status, error, fecha_creacion")
          .eq("status", "error").order("fecha_creacion", { ascending: false }).limit(300),
      ]);
      return { leads: leadsRes.data ?? [], capiErr: capiErrRes.data ?? [] };
    },
  });

  const leads = data?.leads ?? [];
  const capiErr = data?.capiErr ?? [];

  const stats = useMemo(() => {
    const total = leads.length;
    const meta = leads.filter((l: any) => l.meta_leadgen_id);
    const conCampana = leads.filter((l: any) => l.meta_campaign_id).length;
    const sinOrigen = leads.filter((l: any) => !l.origen);
    const metaSinCampana = meta.filter((l: any) => !l.meta_campaign_id);
    const enHubspot = leads.filter((l: any) => l.hubspot_id);
    return { total, metaCount: meta.length, conCampana, sinOrigen, metaSinCampana, enHubspot };
  }, [leads]);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-96" /></div>;

  const pct = (n: number) => (stats.total ? n / stats.total : 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Salud de tracking" description="Cobertura de atribución de leads y salud de la señal a Meta" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Total leads</div><div className="text-2xl font-semibold">{fmtNum(stats.total)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">% atribuidos a Meta</div><div className="text-2xl font-semibold">{fmtPct(pct(stats.metaCount), 0)}</div><div className="text-[11px] text-muted-foreground">{fmtNum(stats.metaCount)} / {fmtNum(stats.total)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">% con campaña</div><div className="text-2xl font-semibold">{fmtPct(pct(stats.conCampana), 0)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Sin origen</div><div className="text-2xl font-semibold text-amber-600">{fmtNum(stats.sinOrigen.length)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Meta sin campaña</div><div className="text-2xl font-semibold text-amber-600">{fmtNum(stats.metaSinCampana.length)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Aún ligados a HubSpot</div><div className="text-2xl font-semibold">{fmtNum(stats.enHubspot.length)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Errores señal Meta (CAPI)</div><div className="text-2xl font-semibold text-destructive">{fmtNum(capiErr.length)}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="sin_origen">Sin origen ({stats.sinOrigen.length})</TabsTrigger>
          <TabsTrigger value="meta_sin_campana">Meta sin campaña ({stats.metaSinCampana.length})</TabsTrigger>
          <TabsTrigger value="hubspot">Ligados a HubSpot ({stats.enHubspot.length})</TabsTrigger>
          <TabsTrigger value="capi_err">Errores CAPI ({capiErr.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sin_origen"><TrackingLeadList rows={stats.sinOrigen} /></TabsContent>
        <TabsContent value="meta_sin_campana"><TrackingLeadList rows={stats.metaSinCampana} /></TabsContent>
        <TabsContent value="hubspot"><TrackingLeadList rows={stats.enHubspot} showHubspot /></TabsContent>
        <TabsContent value="capi_err">
          <Card><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>Contacto</TableHead><TableHead>Error</TableHead><TableHead>Cuándo</TableHead></TableRow></TableHeader>
            <TableBody>
              {capiErr.slice(0, 100).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.event_name}</TableCell>
                  <TableCell>{e.id_entidad_relacionada ? <Link to={`/admin/portal-crm/ventas/contactos/${e.id_entidad_relacionada}`} className="hover:underline text-primary">#{e.id_entidad_relacionada}</Link> : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate" title={e.error ?? ""}>{e.error ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{relTime(e.fecha_creacion)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div></Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">Atribución sobre <b>crm_leads_atribucion</b> · errores de envío sobre <b>crm_meta_capi_eventos</b>.</p>
    </div>
  );
}

function TrackingLeadList({ rows, showHubspot }: { rows: any[]; showHubspot?: boolean }) {
  if (!rows.length) return <Card className="p-8 text-center text-sm text-muted-foreground">Nada en esta categoría 🎉</Card>;
  return (
    <Card><div className="overflow-x-auto"><Table>
      <TableHeader><TableRow>
        <TableHead>Contacto</TableHead><TableHead>Origen</TableHead><TableHead>Plataforma</TableHead>
        <TableHead>Campaña / Formulario</TableHead>
        {showHubspot && <TableHead>HubSpot ID</TableHead>}
        <TableHead>Creado</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.slice(0, 100).map((l: any) => (
          <TableRow key={l.id}>
            <TableCell className="font-medium">{l.id_entidad_relacionada ? <Link to={`/admin/portal-crm/ventas/contactos/${l.id_entidad_relacionada}`} className="hover:underline text-primary">#{l.id_entidad_relacionada}</Link> : "—"}</TableCell>
            <TableCell className="text-xs">{l.origen ?? "—"}</TableCell>
            <TableCell className="text-xs">{l.meta_platform ?? (l.meta_leadgen_id ? "meta" : "—")}</TableCell>
            <TableCell className="text-xs truncate max-w-[240px]">{l.meta_form_name ?? l.meta_campaign_id ?? "—"}</TableCell>
            {showHubspot && <TableCell className="text-xs font-mono text-muted-foreground">{l.hubspot_id ?? "—"}</TableCell>}
            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(l.fecha_creacion)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table></div>{rows.length > 100 && <div className="p-3 text-xs text-muted-foreground">Mostrando 100 de {rows.length}</div>}</Card>
  );
}

// ─── Conversion Events ────────────────────────────────────────────────────────

export function CrmConversionEvents() {
  const { data: events, isLoading } = useQuery({
    queryKey: ["crm-conversion-events-real"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("crm_meta_capi_eventos")
        .select("id, id_entidad_relacionada, event_name, status, events_received, match_keys, test_event_code, fecha_creacion")
        .order("fecha_creacion", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const statusBadge = (s: string) => {
    const tone =
      s === "sent" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
      s === "error" ? "bg-destructive/15 text-destructive" :
      "bg-muted text-muted-foreground";
    const label = s === "sent" ? "Enviado" : s === "error" ? "Error" : "Omitido";
    return <span className={`text-[10px] px-1.5 py-0.5 rounded ${tone}`}>{label}</span>;
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Eventos de conversión"
        description="Eventos que el CRM envía a Meta (Conversions API)" />
      <div className="rounded-md border bg-card overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : !events?.length ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Sin eventos todavía. Cuando un lead avance de etapa (ej. a MQL) o se cierre un negocio, aparecerá aquí.</CardContent></Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-center">Recibidos</TableHead>
                <TableHead>Datos de match</TableHead>
                <TableHead>Cuándo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    {e.event_name}
                    {e.test_event_code && <Badge variant="outline" className="ml-2 text-[10px]">prueba</Badge>}
                  </TableCell>
                  <TableCell>
                    {e.id_entidad_relacionada ? (
                      <Link to={`/admin/portal-crm/ventas/contactos/${e.id_entidad_relacionada}`} className="hover:underline text-primary">#{e.id_entidad_relacionada}</Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-center">{statusBadge(e.status)}</TableCell>
                  <TableCell className="text-center tabular-nums">{e.events_received ?? "—"}</TableCell>
                  <TableCell>
                    {e.match_keys ? (
                      <div className="flex flex-wrap gap-1">
                        {e.match_keys.split(",").map((k: string) => (
                          <Badge key={k} variant="secondary" className="text-[10px] font-mono">{k}</Badge>
                        ))}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{fmtDateTime(e.fecha_creacion)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

