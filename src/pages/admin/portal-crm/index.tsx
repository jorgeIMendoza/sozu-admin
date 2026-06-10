import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Bot,
  Briefcase,
  CheckCircle2,
  ListTodo,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, MockBadge } from "@/components/admin/portal-crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CRM_ORG_NAME,
  MOCK_ALERTS,
  MOCK_CAMPAIGNS,
  MOCK_CONTACT_ATTRIBUTION,
  MOCK_CONTACTS,
  MOCK_CONVERSION_EVENTS,
  MOCK_DEALS,
  MOCK_INSIGHTS_30D,
  fmtDateTime,
  fmtMXN,
  fmtNum,
  fmtPct,
  relTime,
  type CrmAlert,
} from "@/data/portal-crm/mockData";

// =================================================================
// Panel principal
// =================================================================
export function CrmDashboard() {
  const data = useMemo(() => {
    const rows = MOCK_INSIGHTS_30D;
    const sum = (k: keyof (typeof rows)[number]) =>
      rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
    const totalSpend = sum("spend");
    const totalLeads = sum("leads");
    const totalQL = sum("qualified_leads");
    const totalAppts = sum("appointments");
    const totalRes = sum("reservations");
    const spendMeta = rows
      .filter((r) => r.platform === "meta_ads")
      .reduce((s, r) => s + Number(r.spend), 0);
    const spendGoogle = rows
      .filter((r) => r.platform === "google_ads")
      .reduce((s, r) => s + Number(r.spend), 0);
    const pipelineValue = MOCK_DEALS
      .filter((d) => !["won", "lost"].includes(d.deal_stage))
      .reduce((s, d) => s + d.value, 0);
    const wonValue = MOCK_DEALS
      .filter((d) => d.deal_stage === "won")
      .reduce((s, d) => s + d.value, 0);
    return {
      totalSpend,
      totalLeads,
      totalQL,
      totalAppts,
      totalRes,
      spendMeta,
      spendGoogle,
      contactsCount: MOCK_CONTACTS.length,
      dealsCount: MOCK_DEALS.length,
      pipelineValue,
      wonValue,
      cpl: totalLeads ? totalSpend / totalLeads : 0,
      cpql: totalQL ? totalSpend / totalQL : 0,
      alerts: MOCK_ALERTS.filter((a) => a.status === "open"),
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel principal"
        description="Últimos 30 días · Meta + Google Ads + CRM"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{CRM_ORG_NAME}</Badge>
            <MockBadge />
          </div>
        }
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Kpi label="Spend total" value={fmtMXN(data.totalSpend)} icon={TrendingUp}
          hint={`Meta ${fmtMXN(data.spendMeta)} · Google ${fmtMXN(data.spendGoogle)}`} />
        <Kpi label="Leads" value={String(data.totalLeads)} icon={Users}
          hint={`CPL ${fmtMXN(data.cpl)}`} />
        <Kpi label="Qualified leads" value={String(data.totalQL)} icon={Users}
          hint={`CPQL ${fmtMXN(data.cpql)}`} />
        <Kpi label="Citas · Reservas" value={`${data.totalAppts} · ${data.totalRes}`}
          icon={Briefcase} hint="Atribución de campañas" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">CRM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <Stat label="Contactos" value={data.contactsCount} />
              <Stat label="Deals" value={data.dealsCount} />
              <Stat label="Pipeline activo" value={fmtMXN(data.pipelineValue)} />
              <Stat label="Ganado" value={fmtMXN(data.wonValue)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" /> Alertas abiertas
            </CardTitle>
            <Badge variant="secondary">{data.alerts.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.alerts.slice(0, 5).map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-2 text-sm border-l-2 pl-2 py-1"
                style={{
                  borderColor:
                    a.severity === "critical"
                      ? "hsl(var(--destructive))"
                      : a.severity === "warning"
                      ? "hsl(43 95% 52%)"
                      : "hsl(var(--muted-foreground))",
                }}
              >
                <div className="flex-1">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {a.severity} · {a.alert_type}
                  </div>
                </div>
              </div>
            ))}
            {!data.alerts.length && (
              <p className="text-sm text-muted-foreground">Sin alertas abiertas.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: any;
  hint?: string;
}) {
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

// =================================================================
// Alertas
// =================================================================
const SEVERITY_TONE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

const TYPE_CATEGORY: Record<string, "marketing" | "crm" | "tracking" | "conversion"> = {
  cpl_spike: "marketing",
  cpql_spike: "marketing",
  budget_pacing: "marketing",
  spend_no_leads: "marketing",
  no_appointments: "marketing",
  campaign_no_mapping: "marketing",
  no_crm_progress: "marketing",
  discrepancy: "tracking",
  tracking_gap: "tracking",
  duplicates: "tracking",
  conv_no_clickid: "tracking",
  deal_no_source: "tracking",
  no_followup: "crm",
  no_outcome: "crm",
  qualified_no_appointment: "crm",
  deal_no_next_task: "crm",
  conversion_event: "conversion",
};
const categoryFor = (t: string) => TYPE_CATEGORY[t] ?? "marketing";

export function CrmAlertas() {
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState<"all" | "marketing" | "crm" | "tracking" | "conversion">("all");
  const [status, setStatus] = useState<"open" | "reviewed" | "all">("open");
  const [alerts, setAlerts] = useState<CrmAlert[]>(MOCK_ALERTS);
  const [recalculating, setRecalculating] = useState(false);

  const recalc = () => {
    setRecalculating(true);
    setTimeout(() => {
      setRecalculating(false);
      toast.success("Sin nuevas alertas (mock)");
    }, 600);
  };

  const filtered = useMemo(() => {
    let rows = alerts;
    if (status !== "all") rows = rows.filter((a) => a.status === status);
    if (severity !== "all") rows = rows.filter((a) => a.severity === severity);
    if (category !== "all") rows = rows.filter((a) => categoryFor(a.alert_type) === category);
    return rows;
  }, [alerts, status, severity, category]);

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 } as Record<string, number>;
    alerts.forEach((a) => { c[a.severity] = (c[a.severity] ?? 0) + 1; });
    return c;
  }, [alerts]);

  const markReviewed = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: "reviewed" } : a)));
    toast.success("Alerta marcada como revisada");
  };
  const createTask = (a: CrmAlert) => toast.success(`Tarea creada desde alerta: ${a.title}`);
  const analyzeWithCopilot = (a: CrmAlert) => toast.info(`Copiloto: ${a.title}`);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Alertas"
        description="Anomalías, gaps de tracking y discrepancias entre Meta/Google y CRM"
        actions={<MockBadge />}
      />

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={recalc} disabled={recalculating}>
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${recalculating ? "animate-spin" : ""}`} />
          {recalculating ? "Recalculando…" : "Recalcular alertas"}
        </Button>
      </div>

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

      {!filtered.length ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Sin alertas en este filtro.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
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
                    {a.metric_name && (
                      <span>· {a.metric_name}: {a.current_value} {a.previous_value ? `(prev ${a.previous_value})` : ""}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => analyzeWithCopilot(a)}><Bot className="h-3.5 w-3.5 mr-1" />Analizar</Button>
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
      <p className="text-xs text-muted-foreground">{filtered.length} alertas · reglas evaluadas sobre datos simulados</p>
    </div>
  );
}

// =================================================================
// Salud de tracking
// =================================================================
export function CrmTrackingHealth() {
  const [tab, setTab] = useState("no_utm");

  const stats = useMemo(() => {
    const byContact = new Map(MOCK_CONTACT_ATTRIBUTION.map((a) => [a.contact_id, a]));
    const total = MOCK_CONTACTS.length;
    const withUtm = MOCK_CONTACTS.filter((c) => {
      const a = byContact.get(c.id);
      return a && a.first_touch_source && a.first_touch_medium && a.first_touch_campaign;
    }).length;
    const noUtm = MOCK_CONTACTS.filter((c) => {
      const a = byContact.get(c.id);
      return !a || !(a.first_touch_source && a.first_touch_medium && a.first_touch_campaign);
    });
    const withFb = MOCK_CONTACTS.filter((c) => byContact.get(c.id)?.fbclid).length;
    const withGc = MOCK_CONTACTS.filter((c) => byContact.get(c.id)?.gclid).length;
    const noSource = MOCK_CONTACTS.filter((c) => !c.source_platform);
    const noCampaign = MOCK_CONTACTS.filter((c) => !c.source_name);

    const byEmail = new Map<string, any[]>();
    const byPhone = new Map<string, any[]>();
    MOCK_CONTACTS.forEach((c) => {
      if (c.normalized_email) {
        const k = c.normalized_email;
        if (!byEmail.has(k)) byEmail.set(k, []);
        byEmail.get(k)!.push(c);
      }
      if (c.normalized_phone) {
        const k = c.normalized_phone;
        if (!byPhone.has(k)) byPhone.set(k, []);
        byPhone.get(k)!.push(c);
      }
    });
    const dupes = [
      ...Array.from(byEmail.values()).filter((g) => g.length > 1).flatMap((g) => g.map((c) => ({ ...c, dup_by: "email" }))),
      ...Array.from(byPhone.values()).filter((g) => g.length > 1).flatMap((g) => g.map((c) => ({ ...c, dup_by: "teléfono" }))),
    ];

    const cePending = MOCK_CONVERSION_EVENTS.filter((e) => e.meta_status === "pending" || e.google_status === "pending");
    const ceSimulated = MOCK_CONVERSION_EVENTS.filter((e) => e.meta_status === "simulated" || e.google_status === "simulated");
    const ceFailed = MOCK_CONVERSION_EVENTS.filter((e) => e.meta_status === "failed" || e.google_status === "failed");

    const campLeads = new Map<string, number>();
    MOCK_INSIGHTS_30D.forEach((r) => campLeads.set(r.campaign_id, (campLeads.get(r.campaign_id) ?? 0) + r.leads));
    const campSpend = new Map<string, number>();
    MOCK_INSIGHTS_30D.forEach((r) => campSpend.set(r.campaign_id, (campSpend.get(r.campaign_id) ?? 0) + r.spend));
    const crmLeadsByCampName = new Map<string, number>();
    MOCK_CONTACTS.forEach((c) => { if (c.source_name) crmLeadsByCampName.set(c.source_name, (crmLeadsByCampName.get(c.source_name) ?? 0) + 1); });
    const spendNoCrm = MOCK_CAMPAIGNS
      .map((c) => ({ camp: c, spend: campSpend.get(c.id) ?? 0, platformLeads: campLeads.get(c.id) ?? 0, crmLeads: crmLeadsByCampName.get(c.campaign_name) ?? 0 }))
      .filter((r) => r.spend > 0 && r.crmLeads === 0);
    const crmNoAttr = MOCK_CAMPAIGNS
      .map((c) => ({ camp: c, crmLeads: crmLeadsByCampName.get(c.campaign_name) ?? 0, platformLeads: campLeads.get(c.id) ?? 0 }))
      .filter((r) => r.crmLeads > 0 && r.platformLeads === 0);

    return { total, withUtm, noUtm, withFb, withGc, noSource, noCampaign, dupes, cePending, ceSimulated, ceFailed, spendNoCrm, crmNoAttr };
  }, []);

  const pctUtm = stats.total ? stats.withUtm / stats.total : 0;
  const pctNoUtm = stats.total ? stats.noUtm.length / stats.total : 0;
  const pctFb = stats.total ? stats.withFb / stats.total : 0;
  const pctGc = stats.total ? stats.withGc / stats.total : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Salud de tracking"
        description="Cobertura de atribución, duplicados y discrepancias"
        actions={<MockBadge />}
      />

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
          <TabsTrigger value="no_campaign">Sin campaña ({stats.noCampaign.length})</TabsTrigger>
          <TabsTrigger value="dupes">Duplicados ({stats.dupes.length})</TabsTrigger>
          <TabsTrigger value="ce">Conv events pend/fail ({stats.cePending.length + stats.ceFailed.length})</TabsTrigger>
          <TabsTrigger value="spend_no_crm">Gasto sin leads CRM ({stats.spendNoCrm.length})</TabsTrigger>
          <TabsTrigger value="crm_no_attr">Leads CRM sin atribución ({stats.crmNoAttr.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="no_utm"><ContactList rows={stats.noUtm} /></TabsContent>
        <TabsContent value="no_campaign"><ContactList rows={stats.noCampaign} /></TabsContent>
        <TabsContent value="dupes"><ContactList rows={stats.dupes} extraCol="dup_by" extraLabel="Duplicado por" /></TabsContent>
        <TabsContent value="ce">
          <Card><Table>
            <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>Meta</TableHead><TableHead>Google</TableHead><TableHead>Error</TableHead><TableHead>Cuándo</TableHead></TableRow></TableHeader>
            <TableBody>
              {[...stats.ceFailed, ...stats.cePending].map((e) => (
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
              {stats.spendNoCrm.map((r) => (
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
              {stats.crmNoAttr.map((r) => (
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

function ContactList({
  rows,
  extraCol,
  extraLabel,
}: {
  rows: any[];
  extraCol?: string;
  extraLabel?: string;
}) {
  if (!rows.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">Nada en esta categoría 🎉</Card>
    );
  }
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contacto</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Fuente</TableHead>
            <TableHead>Campaña</TableHead>
            {extraCol && <TableHead>{extraLabel}</TableHead>}
            <TableHead>Creado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={`${c.id}-${c[extraCol ?? "id"] ?? ""}`}>
              <TableCell className="font-medium">{c.full_name}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{c.email ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{c.phone ?? "—"}</TableCell>
              <TableCell className="text-xs">{c.source_platform ?? "—"}</TableCell>
              <TableCell className="text-xs truncate max-w-[200px]">{c.source_name ?? "—"}</TableCell>
              {extraCol && <TableCell><Badge variant="outline" className="text-[10px]">{c[extraCol]}</Badge></TableCell>}
              <TableCell className="text-xs text-muted-foreground">{fmtDateTime(c.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// =================================================================
// Conversion events
// =================================================================
export function CrmConversionEvents() {
  const events = MOCK_CONVERSION_EVENTS;

  const statusBadge = (s: string) => {
    const tone =
      s === "simulated" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
      s === "sent"      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
      s === "failed"    ? "bg-destructive/15 text-destructive" :
      s === "skipped"   ? "bg-muted text-muted-foreground" :
      "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    return <span className={`text-[10px] px-1.5 py-0.5 rounded ${tone}`}>{s}</span>;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Eventos de conversión"
        description="Eventos generados por el CRM (Meta CAPI / Google Enhanced) · todos en modo simulated hasta conectar credenciales reales"
        actions={<MockBadge />}
      />
      <div className="rounded-md border bg-card">
        {!events.length ? (
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
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.event_name}</TableCell>
                  <TableCell>{e.contact ? e.contact.full_name : "—"}</TableCell>
                  <TableCell>{e.event_value ? fmtMXN(e.event_value) : "—"}</TableCell>
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
