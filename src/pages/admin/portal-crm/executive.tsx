import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, TrendingUp, Sparkles, Bot, Copy } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCrmOrgId } from "@/hooks/useCrmOrgId";
import { PageHeader, MockDataDisclaimer, DataSourceBadge } from "@/components/admin/portal-crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  calculateBusinessHealthScore, buildDecisionQueue, detectTopRisks, detectTopOpportunities,
  generateWeeklyDigestMock, buildExecutiveSummary,
  HEALTH_TONE, CATEGORY_TONE,
  type DecisionCategory,
} from "@/lib/crm-decision-intelligence";
import { fmtMoney } from "@/lib/crm-forecasting";

// ---------------------------------------------------------------------------
// Shared data loader
// ---------------------------------------------------------------------------

const EMPTY_DASHBOARD_DATA = {
  contacts: [], deals: [], appointments: [], tasks: [],
  campaigns: [], insights: [], drafts: [], alerts: [],
};

async function loadDashboardInputs(orgId: string) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [contacts, deals, appts, tasks, camps, ins, drafts, alerts] = await Promise.all([
    (supabase as any).from("contacts").select("*").eq("organization_id", orgId).limit(2000),
    (supabase as any).from("deals").select("*").eq("organization_id", orgId).limit(2000),
    (supabase as any).from("appointments").select("*").eq("organization_id", orgId).limit(2000),
    (supabase as any).from("tasks").select("id,status,due_date,assigned_to").eq("organization_id", orgId).limit(2000),
    (supabase as any).from("campaigns").select("id,campaign_name,platform,status").eq("organization_id", orgId),
    (supabase as any).from("campaign_insights_daily").select("campaign_id,spend,leads,qualified_leads,appointments").eq("organization_id", orgId).gte("date", since),
    (supabase as any).from("campaign_drafts").select("id,campaign_name,status,budget").eq("organization_id", orgId),
    (supabase as any).from("alerts").select("*").eq("organization_id", orgId).eq("status", "open").limit(100),
  ]);
  return {
    contacts: contacts.data ?? [], deals: deals.data ?? [], appointments: appts.data ?? [],
    tasks: tasks.data ?? [], campaigns: camps.data ?? [], insights: ins.data ?? [],
    drafts: drafts.data ?? [], alerts: alerts.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Executive Dashboard
// ---------------------------------------------------------------------------

export function CrmExecutiveDashboard() {
  const orgId = useCrmOrgId();

  const { data, isLoading } = useQuery({
    queryKey: ["executive-dashboard", orgId],
    enabled: !!orgId,
    queryFn: () => loadDashboardInputs(orgId!),
  });

  const effectiveData = data ?? (isLoading ? null : EMPTY_DASHBOARD_DATA);

  const summary = useMemo(() => {
    if (!effectiveData) return null;
    const health = calculateBusinessHealthScore(effectiveData);
    const queue = buildDecisionQueue(effectiveData);
    const risks = detectTopRisks(effectiveData);
    const opps = detectTopOpportunities(effectiveData);
    const spend = effectiveData.insights.reduce((s: number, r: any) => s + Number(r.spend ?? 0), 0);
    const leads = effectiveData.insights.reduce((s: number, r: any) => s + (r.leads ?? 0), 0);
    const ql = effectiveData.insights.reduce((s: number, r: any) => s + (r.qualified_leads ?? 0), 0);
    const hot = effectiveData.contacts.filter((c: any) => ["qualified", "engaged"].includes(c.lead_status)).length;
    const overdue = effectiveData.tasks.filter((t: any) => t.status === "pending" && t.due_date && new Date(t.due_date).getTime() < Date.now()).length;
    const drafts_pending = effectiveData.drafts.filter((d: any) => d.status === "review_requested" || d.status === "pending_approval").length;
    return { health, queue, risks, opps, spend, leads, ql, hot, overdue, drafts_pending, raw: effectiveData };
  }, [effectiveData]);

  if (isLoading || !summary) {
    return <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  }

  const { health, queue, risks, opps, spend, leads, ql, hot, overdue, drafts_pending } = summary;

  const northStars = [
    { label: "Weighted forecast", value: fmtMoney(health.metrics.weighted_pipeline), state: health.metrics.weighted_pipeline > 0 ? "healthy" : "watch" as const },
    { label: "Revenue at risk", value: fmtMoney(health.metrics.revenue_at_risk), state: health.metrics.revenue_at_risk > 500000 ? "critical" : health.metrics.revenue_at_risk > 0 ? "watch" : "healthy" as const },
    { label: "Hot leads", value: String(hot), state: hot > 0 ? "watch" : "healthy" as const },
    { label: "SLA compliance", value: `${health.components.sla}%`, state: health.components.sla >= 70 ? "healthy" : health.components.sla >= 50 ? "watch" : "critical" as const },
    { label: "Campaign quality", value: `${health.components.campaign_quality}%`, state: health.components.campaign_quality >= 60 ? "healthy" : "watch" as const },
    { label: "Attribution health", value: `${health.components.attribution}%`, state: "watch" as const },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Executive Dashboard"
        description="Vista unificada de dirección — Marketing, CRM, Sales Ops y Revenue."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/portal-crm/executive/decision-queue">
                <Activity className="h-4 w-4 mr-1" />Decision Queue
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/portal-crm/executive/weekly-digest">
                <Sparkles className="h-4 w-4 mr-1" />Weekly Digest
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/admin/portal-crm/operations/copilot">
                <Bot className="h-4 w-4 mr-1" />Ask Copilot
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2"><DataSourceBadge source="mock" /></div>

      {/* North Star Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {northStars.map(ns => (
          <Card key={ns.label}>
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">{ns.label}</div>
              <div className="text-lg font-semibold mt-1">{ns.value}</div>
              <Badge variant="outline" className={`text-[10px] mt-1 ${HEALTH_TONE[ns.state as keyof typeof HEALTH_TONE]}`}>{ns.state}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Business Health */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Business Health Score</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <div className="text-4xl font-bold">{health.score}<span className="text-base text-muted-foreground">/100</span></div>
              <Badge variant="outline" className={`text-xs mt-1 ${HEALTH_TONE[health.label]}`}>{health.label}</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1 text-xs">
              {Object.entries(health.components).map(([k, v]) => (
                <div key={k}>
                  <div className="text-muted-foreground capitalize">{k.replace("_", " ")}</div>
                  <div className="font-medium">{v}%</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <ExecKpiCard title="Marketing" rows={[
          ["Spend 30d", fmtMoney(spend)],
          ["Leads", String(leads)],
          ["CPL", leads ? fmtMoney(spend / leads) : "-"],
          ["Qualified", String(ql)],
        ]} />
        <ExecKpiCard title="CRM" rows={[
          ["Hot leads", String(hot)],
          ["Total contactos", String(summary.raw.contacts.length)],
          ["Citas activas", String(summary.raw.appointments.filter((a: any) => a.status === "scheduled").length)],
        ]} />
        <ExecKpiCard title="Sales Ops" rows={[
          ["Tareas vencidas", String(overdue)],
          ["SLA compliance", `${health.components.sla}%`],
          ["Hot stale", String(risks.find(r => r.title.includes("calientes"))?.detail.split(" ")[0] ?? "0")],
        ]} />
        <ExecKpiCard title="Builder & Revenue" rows={[
          ["Drafts pendientes", String(drafts_pending)],
          ["Forecast base", fmtMoney(0)],
          ["Decisiones en cola", String(queue.length)],
        ]} />
      </div>

      {/* Top Risks & Opportunities */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />Top riesgos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {risks.length === 0 && <div className="text-xs text-muted-foreground">Sin riesgos detectados.</div>}
            {risks.map((r, i) => (
              <div key={i} className="border rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{r.title}</div>
                  <Badge variant="outline" className={`text-[10px] ${HEALTH_TONE[r.severity]}`}>{r.severity}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{r.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />Top oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {opps.length === 0 && <div className="text-xs text-muted-foreground">Sin oportunidades destacadas.</div>}
            {opps.map((o, i) => (
              <div key={i} className="border rounded p-2">
                <div className="text-sm font-medium">{o.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{o.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Decision Queue preview */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Decision Queue (top 8)</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/portal-crm/executive/decision-queue">Ver todas</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {queue.slice(0, 8).map(d => (
            <div key={d.id} className="flex items-center justify-between gap-3 border rounded p-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${CATEGORY_TONE[d.category]}`}>{d.category}</Badge>
                  <span className="text-sm font-medium truncate">{d.title}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{d.why_it_matters}</div>
              </div>
              <div className="text-xs font-semibold text-muted-foreground">{d.priority_score}</div>
            </div>
          ))}
          {queue.length === 0 && <div className="text-xs text-muted-foreground">Sin decisiones pendientes.</div>}
        </CardContent>
      </Card>

      <MockDataDisclaimer />
    </div>
  );
}

function ExecKpiCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Decision Queue
// ---------------------------------------------------------------------------

export function CrmExecutiveDecisionQueue() {
  const orgId = useCrmOrgId();
  const [filter, setFilter] = useState<DecisionCategory | "all">("all");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["decision-queue", orgId],
    enabled: !!orgId,
    queryFn: () => loadDashboardInputs(orgId!),
  });

  const queue = useMemo(() => data ? buildDecisionQueue(data) : [], [data]);
  const filtered = useMemo(() => queue.filter(d =>
    !dismissed.has(d.id) && !done.has(d.id) && (filter === "all" || d.category === filter)
  ), [queue, filter, dismissed, done]);

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cola de decisiones"
        description="Acciones priorizadas — qué resolver hoy o esta semana."
        actions={
          <Select value={filter} onValueChange={(v) => setFilter(v as DecisionCategory | "all")}>
            <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="crm">CRM</SelectItem>
              <SelectItem value="sales_ops">Sales Ops</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="tracking">Tracking</SelectItem>
              <SelectItem value="builder">Builder</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="flex items-center gap-2"><DataSourceBadge source="mock" /></div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{filtered.length} decisiones activas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {filtered.map(d => (
            <div key={d.id} className="border rounded p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${CATEGORY_TONE[d.category]}`}>{d.category}</Badge>
                  <Badge variant="outline" className="text-[10px]">{d.due_urgency.replace("_", " ")}</Badge>
                  <span className="text-sm font-medium">{d.title}</span>
                </div>
                <div className="text-xs font-semibold text-muted-foreground">prioridad {d.priority_score}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{d.why_it_matters}</div>
              <div className="text-xs mt-1"><span className="font-medium">Recomendación:</span> {d.recommended_action}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{d.impact_estimate}</div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {d.related_contact_id && (
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                    <Link to={`/admin/portal-crm/crm/contacts/${d.related_contact_id}`}>Abrir contacto</Link>
                  </Button>
                )}
                {d.related_campaign_id && (
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                    <Link to="/admin/portal-crm/marketing/campaigns">Abrir campaña</Link>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                  <Link to="/admin/portal-crm/operations/copilot">Analizar con AI</Link>
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDone(new Set([...done, d.id]))}>Marcar done</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDismissed(new Set([...dismissed, d.id]))}>Dismiss</Button>
              </div>
            </div>
          ))}
          {!filtered.length && <div className="text-xs text-muted-foreground">Sin decisiones para este filtro.</div>}
        </CardContent>
      </Card>
      <MockDataDisclaimer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly Digest
// ---------------------------------------------------------------------------

export function CrmExecutiveWeeklyDigest() {
  const orgId = useCrmOrgId();
  const [generated, setGenerated] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-digest", orgId],
    enabled: !!orgId,
    queryFn: () => loadDashboardInputs(orgId!),
  });

  const effectiveDigestData = data ?? (isLoading ? null : EMPTY_DASHBOARD_DATA);
  const digest = useMemo(() => effectiveDigestData ? generateWeeklyDigestMock(effectiveDigestData) : null, [effectiveDigestData]);

  if (isLoading || !digest) return <Skeleton className="h-96" />;

  function copySummary() {
    if (!effectiveDigestData) return;
    const text = buildExecutiveSummary(effectiveDigestData);
    navigator.clipboard.writeText(text);
    setGenerated(text);
    toast.success("Resumen copiado al portapapeles (mock).");
  }

  async function createTasksFromRecommendations() {
    if (!effectiveDigestData || !orgId) return;
    const rows = digest!.top_actions.slice(0, 5).map(a => ({
      organization_id: orgId,
      title: `[${a.category}] ${a.title} — ${a.action}`.slice(0, 250),
      status: "pending" as const,
      priority: a.priority >= 80 ? "high" : "normal",
      due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    }));
    const { error } = await (supabase as any).from("tasks").insert(rows);
    if (error) toast.error(`Error creando tareas: ${error.message}`);
    else toast.success(`${rows.length} tareas internas creadas (mock).`);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resumen ejecutivo semanal"
        description="Resumen mock semanal — no envía emails ni WhatsApps."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copySummary}>
              <Copy className="h-4 w-4 mr-1" />Copy summary
            </Button>
            <Button size="sm" variant="outline" onClick={createTasksFromRecommendations}>
              <Sparkles className="h-4 w-4 mr-1" />Create tasks
            </Button>
            <Button asChild size="sm">
              <Link to="/admin/portal-crm/operations/copilot">
                <Bot className="h-4 w-4 mr-1" />Ask Copilot to rewrite
              </Link>
            </Button>
          </div>
        }
      />
      <div className="flex items-center gap-2"><DataSourceBadge source="mock" /></div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Executive summary</CardTitle></CardHeader>
        <CardContent>
          <div className="text-sm">{digest.summary}</div>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] ${HEALTH_TONE[digest.health.label]}`}>
              Health {digest.health.score}/100 · {digest.health.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Marketing</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            <DigestKV k="Spend" v={fmtMoney(digest.marketing.spend)} />
            <DigestKV k="Leads" v={String(digest.marketing.leads)} />
            <DigestKV k="CPL" v={digest.marketing.cpl ? fmtMoney(digest.marketing.cpl) : "-"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            <DigestKV k="Weighted" v={fmtMoney(digest.revenue.weighted)} />
            <DigestKV k="Base" v={fmtMoney(digest.revenue.base)} />
            <DigestKV k="Won" v={fmtMoney(digest.revenue.won)} />
            <DigestKV k="At risk" v={fmtMoney(digest.revenue.at_risk_value)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Wins</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {digest.wins.length === 0 && <div className="text-muted-foreground">Sin wins destacados.</div>}
            {digest.wins.map((w, i) => (
              <div key={i}>
                <div className="font-medium">{w.title}</div>
                <div className="text-muted-foreground">{w.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Top riesgos</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs">
          {digest.risks.length === 0 && <div className="text-muted-foreground">Sin riesgos detectados.</div>}
          {digest.risks.map((r, i) => (
            <div key={i} className="flex items-start justify-between gap-2 border-b last:border-0 py-1">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-muted-foreground">{r.detail}</div>
              </div>
              <Badge variant="outline" className={`text-[10px] ${HEALTH_TONE[r.severity]}`}>{r.severity}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 acciones para la próxima semana</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs">
          {digest.top_actions.map((a, i) => (
            <div key={i} className="border-b last:border-0 py-1">
              <div className="font-medium">{i + 1}. [{a.category}] {a.title}</div>
              <div className="text-muted-foreground">{a.action}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {generated && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Texto generado</CardTitle></CardHeader>
          <CardContent>
            <Textarea readOnly value={generated} className="min-h-[200px] font-mono text-xs" />
          </CardContent>
        </Card>
      )}

      <MockDataDisclaimer />
    </div>
  );
}

function DigestKV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
