import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, Bell, Briefcase, CheckCircle2, ListTodo,
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
  const orgId = useCrmOrgId();

  const { data, isLoading } = useQuery({
    queryKey: ["crm-dashboard", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const [insights, contacts, deals, alerts] = await Promise.all([
        (supabase as any).from("campaign_insights_daily").select("spend, leads, qualified_leads, appointments, reservations, platform").eq("organization_id", orgId!).gte("date", since),
        (supabase as any).from("contacts").select("id, lifecycle_stage").eq("organization_id", orgId!),
        (supabase as any).from("deals").select("id, deal_stage, value").eq("organization_id", orgId!),
        (supabase as any).from("alerts").select("id, severity, title, alert_type").eq("organization_id", orgId!).eq("status", "open").order("created_at", { ascending: false }),
      ]);
      const rows = insights.data ?? [];
      const totalSpend = rows.reduce((s: number, r: any) => s + Number(r.spend ?? 0), 0);
      const totalLeads = rows.reduce((s: number, r: any) => s + (r.leads ?? 0), 0);
      const totalQL = rows.reduce((s: number, r: any) => s + (r.qualified_leads ?? 0), 0);
      const totalAppts = rows.reduce((s: number, r: any) => s + (r.appointments ?? 0), 0);
      const totalRes = rows.reduce((s: number, r: any) => s + (r.reservations ?? 0), 0);
      const spendMeta = rows.filter((r: any) => r.platform === "meta_ads").reduce((s: number, r: any) => s + Number(r.spend ?? 0), 0);
      const spendGoogle = rows.filter((r: any) => r.platform === "google_ads").reduce((s: number, r: any) => s + Number(r.spend ?? 0), 0);
      const pipelineValue = (deals.data ?? []).filter((d: any) => !["won", "lost"].includes(d.deal_stage)).reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);
      const wonValue = (deals.data ?? []).filter((d: any) => d.deal_stage === "won").reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);
      return {
        totalSpend, totalLeads, totalQL, totalAppts, totalRes, spendMeta, spendGoogle,
        contactsCount: contacts.data?.length ?? 0,
        dealsCount: deals.data?.length ?? 0,
        pipelineValue, wonValue,
        cpl: totalLeads ? totalSpend / totalLeads : 0,
        cpql: totalQL ? totalSpend / totalQL : 0,
        alerts: alerts.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard ejecutivo"
        description="Últimos 30 días · Meta + Google Ads + CRM"
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Spend total" value={isLoading ? "…" : fmtMXN(data?.totalSpend ?? 0)} icon={TrendingUp} hint={isLoading ? "" : `Meta ${fmtMXN(data?.spendMeta ?? 0)} · Google ${fmtMXN(data?.spendGoogle ?? 0)}`} />
        <KpiCard label="Leads" value={isLoading ? "…" : String(data?.totalLeads ?? 0)} icon={Users} hint={isLoading ? "" : `CPL ${fmtMXN(data?.cpl ?? 0)}`} />
        <KpiCard label="Qualified leads" value={isLoading ? "…" : String(data?.totalQL ?? 0)} icon={Users} hint={isLoading ? "" : `CPQL ${fmtMXN(data?.cpql ?? 0)}`} />
        <KpiCard label="Citas · Reservas" value={isLoading ? "…" : `${data?.totalAppts ?? 0} · ${data?.totalRes ?? 0}`} icon={Briefcase} hint="Atribución de campañas" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">CRM</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-24" /> : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <Stat label="Contactos" value={data?.contactsCount ?? 0} />
                <Stat label="Deals" value={data?.dealsCount ?? 0} />
                <Stat label="Pipeline activo" value={fmtMXN(data?.pipelineValue ?? 0)} />
                <Stat label="Ganado" value={fmtMXN(data?.wonValue ?? 0)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Alertas abiertas</CardTitle>
            <Badge variant="secondary">{data?.alerts.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <Skeleton className="h-20" />}
            {!isLoading && (data?.alerts ?? []).slice(0, 5).map((a: any) => (
              <div key={a.id} className="flex items-start gap-2 text-sm border-l-2 pl-2 py-1"
                style={{ borderColor: a.severity === "critical" ? "var(--destructive)" : a.severity === "warning" ? "var(--chart-4)" : "var(--muted-foreground)" }}>
                <div className="flex-1">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">{a.severity} · {a.alert_type}</div>
                </div>
              </div>
            ))}
            {!isLoading && !data?.alerts.length && (
              <p className="text-sm text-muted-foreground">Sin alertas abiertas.</p>
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
                    {a.related_contact_id && <Link to={`/admin/portal-crm/crm/contacts/${a.related_contact_id}`} className="hover:text-foreground underline">Ver contacto →</Link>}
                    {a.related_campaign_id && <Link to="/admin/portal-crm/marketing/campaigns" className="hover:text-foreground underline">Ver campaña →</Link>}
                    {a.alert_type === "conversion_event" && <Link to="/admin/portal-crm/conversion-events" className="hover:text-foreground underline">Ver eventos →</Link>}
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
  const orgId = useCrmOrgId();
  const [tab, setTab] = useState("no_utm");

  const { data, isLoading } = useQuery({
    queryKey: ["crm-tracking-health", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [contacts, attribution, ce, campaigns, insights] = await Promise.all([
        (supabase as any).from("contacts").select("id, full_name, email, phone, normalized_email, normalized_phone, source_platform, source_name, created_at").eq("organization_id", orgId!).limit(1000),
        (supabase as any).from("contact_attribution").select("*"),
        (supabase as any).from("conversion_events").select("id, event_name, event_time, meta_status, google_status, contact_id, last_error").eq("organization_id", orgId!).limit(500),
        (supabase as any).from("campaigns").select("id, campaign_name, platform, development_id").eq("organization_id", orgId!),
        (supabase as any).from("campaign_insights_daily").select("spend, leads, campaign_id, platform").eq("organization_id", orgId!).gte("date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
      ]);
      return {
        contacts: contacts.data ?? [],
        attribution: attribution.data ?? [],
        ce: ce.data ?? [],
        campaigns: campaigns.data ?? [],
        insights: insights.data ?? [],
      };
    },
  });

  const EMPTY_TRACKING = { contacts: [], attribution: [], ce: [], campaigns: [], insights: [] };
  const effectiveData = data ?? (isLoading ? null : EMPTY_TRACKING);

  const stats = useMemo(() => {
    if (!effectiveData) return null;
    const data = effectiveData;
    const byContact = new Map(data.attribution.map((a: any) => [a.contact_id, a]));
    const total = data.contacts.length;
    const withUtm = data.contacts.filter((c: any) => {
      const a = byContact.get(c.id) as any;
      return a && a.first_touch_source && a.first_touch_medium && a.first_touch_campaign;
    }).length;
    const noUtm = data.contacts.filter((c: any) => {
      const a = byContact.get(c.id) as any;
      return !a || !(a.first_touch_source && a.first_touch_medium && a.first_touch_campaign);
    });
    const withFb = data.contacts.filter((c: any) => (byContact.get(c.id) as any)?.fbclid).length;
    const withGc = data.contacts.filter((c: any) => (byContact.get(c.id) as any)?.gclid).length;
    const noSource = data.contacts.filter((c: any) => !c.source_platform);
    const noCampaign = data.contacts.filter((c: any) => !c.source_name);

    const byEmail = new Map<string, any[]>();
    const byPhone = new Map<string, any[]>();
    data.contacts.forEach((c: any) => {
      if (c.normalized_email) { const k = c.normalized_email; (byEmail.get(k) ?? byEmail.set(k, []).get(k))!.push(c); }
      if (c.normalized_phone) { const k = c.normalized_phone; (byPhone.get(k) ?? byPhone.set(k, []).get(k))!.push(c); }
    });
    const dupes = [
      ...Array.from(byEmail.values()).filter((g) => g.length > 1).flatMap((g) => g.map((c) => ({ ...c, dup_by: "email" }))),
      ...Array.from(byPhone.values()).filter((g) => g.length > 1).flatMap((g) => g.map((c) => ({ ...c, dup_by: "teléfono" }))),
    ];

    const cePending = data.ce.filter((e: any) => e.meta_status === "pending" || e.google_status === "pending");
    const ceSimulated = data.ce.filter((e: any) => e.meta_status === "simulated" || e.google_status === "simulated");
    const ceFailed = data.ce.filter((e: any) => e.meta_status === "failed" || e.google_status === "failed");

    const campLeads = new Map<string, number>();
    data.insights.forEach((r: any) => campLeads.set(r.campaign_id, (campLeads.get(r.campaign_id) ?? 0) + (r.leads ?? 0)));
    const campSpend = new Map<string, number>();
    data.insights.forEach((r: any) => campSpend.set(r.campaign_id, (campSpend.get(r.campaign_id) ?? 0) + Number(r.spend ?? 0)));
    const crmLeadsByCampName = new Map<string, number>();
    data.contacts.forEach((c: any) => { if (c.source_name) crmLeadsByCampName.set(c.source_name, (crmLeadsByCampName.get(c.source_name) ?? 0) + 1); });
    const spendNoCrm = data.campaigns
      .map((c: any) => ({ camp: c, spend: campSpend.get(c.id) ?? 0, platformLeads: campLeads.get(c.id) ?? 0, crmLeads: crmLeadsByCampName.get(c.campaign_name) ?? 0 }))
      .filter((r: any) => r.spend > 0 && r.crmLeads === 0);
    const crmNoAttr = data.campaigns
      .map((c: any) => ({ camp: c, crmLeads: crmLeadsByCampName.get(c.campaign_name) ?? 0, platformLeads: campLeads.get(c.id) ?? 0 }))
      .filter((r: any) => r.crmLeads > 0 && r.platformLeads === 0);

    return { total, withUtm, noUtm, withFb, withGc, noSource, noCampaign, dupes, cePending, ceSimulated, ceFailed, spendNoCrm, crmNoAttr };
  }, [effectiveData]);

  if (isLoading || !stats) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-96" /></div>;

  const pctUtm = stats.total ? stats.withUtm / stats.total : 0;
  const pctNoUtm = stats.total ? stats.noUtm.length / stats.total : 0;
  const pctFb = stats.total ? stats.withFb / stats.total : 0;
  const pctGc = stats.total ? stats.withGc / stats.total : 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Salud de tracking" description="Cobertura de atribución, duplicados y discrepancias" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Total leads</div><div className="text-2xl font-semibold">{fmtNum(stats.total)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">% con UTM completo</div><div className="text-2xl font-semibold">{fmtPct(pctUtm, 0)}</div><div className="text-[11px] text-muted-foreground">{stats.withUtm} / {stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">% sin UTM</div><div className="text-2xl font-semibold text-amber-600">{fmtPct(pctNoUtm, 0)}</div><div className="text-[11px] text-muted-foreground">{stats.noUtm.length} leads</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Duplicados potenciales</div><div className="text-2xl font-semibold text-amber-600">{stats.dupes.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">% con fbclid</div><div className="text-2xl font-semibold">{fmtPct(pctFb, 0)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">% con gclid</div><div className="text-2xl font-semibold">{fmtPct(pctGc, 0)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Conv events simulados</div><div className="text-2xl font-semibold text-amber-600">{stats.ceSimulated.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[11px] uppercase text-muted-foreground">Conv events fallidos / pendientes</div><div className="text-2xl font-semibold text-destructive">{stats.ceFailed.length + stats.cePending.length}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="no_utm">Sin UTM ({stats.noUtm.length})</TabsTrigger>
          <TabsTrigger value="no_click">Sin fbclid/gclid ({stats.total - stats.withFb - stats.withGc})</TabsTrigger>
          <TabsTrigger value="no_campaign">Sin campaña ({stats.noCampaign.length})</TabsTrigger>
          <TabsTrigger value="dupes">Duplicados ({stats.dupes.length})</TabsTrigger>
          <TabsTrigger value="ce">Conv events pend/fail ({stats.cePending.length + stats.ceFailed.length})</TabsTrigger>
          <TabsTrigger value="spend_no_crm">Gasto sin leads CRM ({stats.spendNoCrm.length})</TabsTrigger>
          <TabsTrigger value="crm_no_attr">Leads CRM sin atribución ({stats.crmNoAttr.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="no_utm"><TrackingContactList rows={stats.noUtm} /></TabsContent>
        <TabsContent value="no_click">
          <TrackingContactList rows={(effectiveData?.contacts ?? []).filter((c: any) => {
            const a = (effectiveData?.attribution ?? []).find((x: any) => x.contact_id === c.id) as any;
            return !a?.fbclid && !a?.gclid;
          })} />
        </TabsContent>
        <TabsContent value="no_campaign"><TrackingContactList rows={stats.noCampaign} /></TabsContent>
        <TabsContent value="dupes"><TrackingContactList rows={stats.dupes} extraCol="dup_by" extraLabel="Duplicado por" /></TabsContent>
        <TabsContent value="ce">
          <Card><Table>
            <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>Meta</TableHead><TableHead>Google</TableHead><TableHead>Error</TableHead><TableHead>Cuándo</TableHead></TableRow></TableHeader>
            <TableBody>
              {[...stats.ceFailed, ...stats.cePending].slice(0, 100).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.event_name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{e.meta_status}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{e.google_status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.last_error ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{relTime(e.event_time)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></Card>
        </TabsContent>
        <TabsContent value="spend_no_crm">
          <Card><Table>
            <TableHeader><TableRow><TableHead>Campaña</TableHead><TableHead>Plataforma</TableHead><TableHead className="text-right">Spend</TableHead><TableHead className="text-right">Leads plat.</TableHead><TableHead className="text-right">Leads CRM</TableHead></TableRow></TableHeader>
            <TableBody>
              {stats.spendNoCrm.map((r: any) => (
                <TableRow key={r.camp.id}>
                  <TableCell className="font-medium">{r.camp.campaign_name}</TableCell>
                  <TableCell className="text-xs">{r.camp.platform}</TableCell>
                  <TableCell className="text-right">{fmtMXN(r.spend)}</TableCell>
                  <TableCell className="text-right">{fmtNum(r.platformLeads)}</TableCell>
                  <TableCell className="text-right text-destructive">0</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></Card>
        </TabsContent>
        <TabsContent value="crm_no_attr">
          <Card><Table>
            <TableHeader><TableRow><TableHead>Campaña</TableHead><TableHead>Plataforma</TableHead><TableHead className="text-right">Leads CRM</TableHead><TableHead className="text-right">Leads plat.</TableHead></TableRow></TableHeader>
            <TableBody>
              {stats.crmNoAttr.map((r: any) => (
                <TableRow key={r.camp.id}>
                  <TableCell className="font-medium">{r.camp.campaign_name}</TableCell>
                  <TableCell className="text-xs">{r.camp.platform}</TableCell>
                  <TableCell className="text-right">{fmtNum(r.crmLeads)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">0</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TrackingContactList({ rows, extraCol, extraLabel }: { rows: any[]; extraCol?: string; extraLabel?: string }) {
  if (!rows.length) return <Card className="p-8 text-center text-sm text-muted-foreground">Nada en esta categoría 🎉</Card>;
  return (
    <Card><Table>
      <TableHeader><TableRow>
        <TableHead>Contacto</TableHead><TableHead>Email</TableHead><TableHead>Teléfono</TableHead>
        <TableHead>Fuente</TableHead><TableHead>Campaña</TableHead>
        {extraCol && <TableHead>{extraLabel}</TableHead>}
        <TableHead>Creado</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.slice(0, 100).map((c: any) => (
          <TableRow key={`${c.id}-${c[extraCol ?? "id"] ?? ""}`}>
            <TableCell className="font-medium"><Link to={`/admin/portal-crm/crm/contacts/${c.id}`} className="hover:underline">{c.full_name}</Link></TableCell>
            <TableCell className="text-xs text-muted-foreground">{c.email ?? "—"}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{c.phone ?? "—"}</TableCell>
            <TableCell className="text-xs">{c.source_platform ?? "—"}</TableCell>
            <TableCell className="text-xs truncate max-w-[200px]">{c.source_name ?? "—"}</TableCell>
            {extraCol && <TableCell><Badge variant="outline" className="text-[10px]">{c[extraCol]}</Badge></TableCell>}
            <TableCell className="text-xs text-muted-foreground">{fmtDateTime(c.created_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>{rows.length > 100 && <div className="p-3 text-xs text-muted-foreground">Mostrando 100 de {rows.length}</div>}</Card>
  );
}

// ─── Conversion Events ────────────────────────────────────────────────────────

export function CrmConversionEvents() {
  const orgId = useCrmOrgId();

  const { data: events, isLoading } = useQuery({
    queryKey: ["crm-conversion-events", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("conversion_events")
        .select("*, contact:contacts(id,full_name)")
        .eq("organization_id", orgId!)
        .order("event_time", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const statusBadge = (s: string) => {
    const tone =
      s === "simulated" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
      s === "sent" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
      s === "failed" ? "bg-destructive/15 text-destructive" :
      s === "skipped" ? "bg-muted text-muted-foreground" :
      "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    return <span className={`text-[10px] px-1.5 py-0.5 rounded ${tone}`}>{s}</span>;
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Eventos de conversión"
        description="Eventos generados por el CRM (Meta CAPI / Google Enhanced)" />
      <div className="rounded-md border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : !events?.length ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Sin eventos. Mueve un deal en el pipeline para generarlos.</CardContent></Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Google</TableHead>
                <TableHead>Consent</TableHead>
                <TableHead>Cuándo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.event_name}</TableCell>
                  <TableCell>
                    {e.contact ? (
                      <Link to={`/admin/portal-crm/crm/contacts/${e.contact.id}`} className="hover:underline">{e.contact.full_name}</Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{e.event_value ? fmtMXN(Number(e.event_value)) : "—"}</TableCell>
                  <TableCell>{statusBadge(e.meta_status)}</TableCell>
                  <TableCell>{statusBadge(e.google_status)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{e.consent_status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{fmtDateTime(e.event_time)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

