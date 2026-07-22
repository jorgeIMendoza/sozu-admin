// Portal CRM Sozu · módulo CRM — Cluster "avanzado" (sub-sistema con esquema en inglés)
// Extraído de crm.tsx: CrmSequences, CrmRouting, CrmAutomationRules, CrmEscalations,
// CrmLeadIntelligence, CrmAgentPerformance, CrmSalesOperations.
// Usa tablas crm_contacts / crm_tasks / crm_automation_rules / crm_escalations / lead_assignment_history.

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Phone, MessageSquare, Mail, ClipboardList, Copy, UserPlus,
  Zap, TriangleAlert, PlayCircle, ShieldAlert, Bell, CheckCircle2, X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCrmOrgId } from "@/hooks/useCrmOrgId";
import { PageHeader } from "@/components/admin/portal-crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { leadStatusLabel, relTime } from "@/lib/crm-lib";
import {
  computeLeadIntelligence, LEAD_LABEL_TONE, type AdvisorLoad, recommendOwner,
} from "@/lib/crm-lead-scoring";
import { aggregateAgentPerf, fmtNum, fmtPct } from "@/lib/crm-analytics";
import { type DateRange, RANGE_LABEL, rangeToSince } from "@/lib/crm-marketing";
import {
  calculateSlaStatus, getFollowUpPriority, SLA_TONE,
  generateMessage, SEQUENCES, DEFAULT_AUTOMATION_RULES,
} from "@/lib/crm-sales-ops";

// ─── CrmSequences ─────────────────────────────────────────────────────────────

export function CrmSequences() {
  const [activeSeq, setActiveSeq] = useState(SEQUENCES[0].id);
  const seq = SEQUENCES.find(s => s.id === activeSeq) ?? SEQUENCES[0];

  const CHANNEL_ICON: Record<string, ReactNode> = {
    call: <Phone className="w-3.5 h-3.5 text-blue-500" />,
    whatsapp_mock: <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />,
    email_mock: <Mail className="w-3.5 h-3.5 text-violet-500" />,
    task: <ClipboardList className="w-3.5 h-3.5 text-amber-500" />,
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Secuencias" subtitle="Cadencias de seguimiento por stage del lead" />
      <div className="flex gap-4">
        <div className="w-52 shrink-0 space-y-1">
          {SEQUENCES.map(s => (
            <button key={s.id} onClick={() => setActiveSeq(s.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeSeq === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <div className="font-medium truncate">{s.name}</div>
              <div className="text-[11px] opacity-70 truncate">{s.stage}</div>
            </button>
          ))}
        </div>
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{seq.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{seq.objective}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {seq.steps.map((step, i) => (
                <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-muted/40 border">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background border text-[11px] font-semibold shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {CHANNEL_ICON[step.channel]}
                      <span className="text-xs font-medium capitalize">{step.channel.replace("_mock","").replace("_"," ")}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{step.timing}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.copy}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 italic">Objetivo: {step.objective}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(step.copy); toast.success("Copiado"); }}
                    className="shrink-0 p-1 hover:bg-background rounded transition-colors">
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── CrmRouting ───────────────────────────────────────────────────────────────

export function CrmRouting() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();

  const { data: unassigned = [], isLoading } = useQuery({
    queryKey: ["crm-unassigned", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_contacts")
        .select("id,full_name,lead_status,source_name,created_at").eq("organization_id", orgId)
        .is("contact_owner", null).order("created_at", { ascending: true }).limit(50);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const MOCK_ADVISORS: AdvisorLoad[] = [
    { user_id: "a1", name: "Ana García", active_leads: 12, pending_tasks: 3, lead_to_appt_rate: 0.32, appt_to_reservation_rate: 0.21 },
    { user_id: "a2", name: "Carlos López", active_leads: 8, pending_tasks: 1, lead_to_appt_rate: 0.41, appt_to_reservation_rate: 0.18 },
    { user_id: "a3", name: "María Torres", active_leads: 19, pending_tasks: 7, lead_to_appt_rate: 0.28, appt_to_reservation_rate: 0.25 },
  ];

  const assign = useMutation({
    mutationFn: async ({ contactId, advisorId }: { contactId: string; advisorId: string }) => {
      await (supabase as any).from("crm_contacts").update({ contact_owner: advisorId }).eq("id", contactId);
      await (supabase as any).from("lead_assignment_history").insert({ contact_id: contactId, assigned_to: advisorId, organization_id: orgId, reason: "manual_routing" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-unassigned", orgId] }); toast.success("Lead asignado"); },
  });

  const [overrides, setOverrides] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      <PageHeader title="Routing" subtitle="Asignación de leads no asignados a asesores" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MOCK_ADVISORS.map(a => (
          <Card key={a.user_id} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">{a.name[0]}</div>
              <div><p className="text-sm font-medium">{a.name}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Leads activos</span><span className="text-right font-medium text-foreground">{a.active_leads}</span>
              <span>Lead→Cita</span><span className="text-right font-medium text-foreground">{fmtPct(a.lead_to_appt_rate)}</span>
              <span>Cita→Apart.</span><span className="text-right font-medium text-foreground">{fmtPct(a.appt_to_reservation_rate)}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Contacto</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead>Fuente</TableHead>
            <TableHead>Creado</TableHead>
            <TableHead>Recomendado</TableHead>
            <TableHead>Asignar a</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : unassigned.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin leads sin asignar</TableCell></TableRow>
            ) : unassigned.map((c: any) => {
              const rec = recommendOwner(c, MOCK_ADVISORS);
              const selectedAdvisor = overrides[c.id] ?? rec?.recommended_owner_id ?? "";
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{leadStatusLabel[c.lead_status] ?? c.lead_status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.source_name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{relTime(c.created_at)}</TableCell>
                  <TableCell className="text-xs">{rec ? <span title={rec.reason}>{rec.recommended_owner_name}</span> : "—"}</TableCell>
                  <TableCell>
                    <Select value={selectedAdvisor} onValueChange={v => setOverrides(prev => ({ ...prev, [c.id]: v }))}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Elegir" /></SelectTrigger>
                      <SelectContent>{MOCK_ADVISORS.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => selectedAdvisor && assign.mutate({ contactId: c.id, advisorId: selectedAdvisor })}
                      disabled={!selectedAdvisor || assign.isPending}>
                      <UserPlus className="w-3.5 h-3.5 mr-1" />Asignar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── CrmAutomationRules ───────────────────────────────────────────────────────

export function CrmAutomationRules() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();

  const { data: dbRules = [], isLoading } = useQuery({
    queryKey: ["crm-automation-rules", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_automation_rules")
        .select("*").eq("organization_id", orgId).order("created_at");
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      const rows = DEFAULT_AUTOMATION_RULES.map(r => ({ ...r, organization_id: orgId, is_active: true }));
      await (supabase as any).from("crm_automation_rules").upsert(rows, { onConflict: "organization_id,name" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-automation-rules", orgId] }); toast.success("Reglas base sembradas"); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await (supabase as any).from("crm_automation_rules").update({ is_active }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-automation-rules", orgId] }),
  });

  const PRIORITY_TONE: Record<string, string> = {
    urgent: "bg-red-500/15 text-red-700 dark:text-red-400",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    normal: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  };

  const displayRules = dbRules.length ? dbRules : DEFAULT_AUTOMATION_RULES.map((r, i) => ({ ...r, id: `mock-${i}`, is_active: true, isMock: true }));

  return (
    <div className="space-y-4">
      <PageHeader title="Reglas de automatización" subtitle="Triggers automáticos para acciones del CRM">
        <Button size="sm" variant="outline" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
          <Zap className="w-4 h-4 mr-1" />{seedDefaults.isPending ? "Sembrando…" : "Sembrar defaults"}
        </Button>
      </PageHeader>

      {dbRules.length === 0 && (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0" />
          Mostrando reglas de ejemplo. Presiona "Sembrar defaults" para guardarlas en BD.
        </div>
      )}

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Activa</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
            ) : displayRules.map((rule: any) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium text-sm">{rule.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{rule.trigger_type?.replace(/_/g," ")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{rule.action_type?.replace(/_/g," ")}</TableCell>
                <TableCell><Badge className={`text-xs ${PRIORITY_TONE[rule.priority ?? "normal"]}`}>{rule.priority ?? "normal"}</Badge></TableCell>
                <TableCell>
                  <button onClick={() => !rule.isMock && toggleActive.mutate({ id: rule.id, is_active: !rule.is_active })}
                    className={`w-9 h-5 rounded-full transition-colors ${rule.is_active ? "bg-emerald-500" : "bg-muted"}`} title={rule.isMock ? "Sembrar para activar" : ""}>
                    <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${rule.is_active ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toast.info(`Simulando: ${rule.name}`)}>
                    <PlayCircle className="w-3.5 h-3.5 mr-1" />Simular
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── CrmEscalations ───────────────────────────────────────────────────────────

export function CrmEscalations() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();

  const { data: escalations = [], isLoading } = useQuery({
    queryKey: ["crm-escalations", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_escalations")
        .select("id,title,severity,status,created_at,resolved_at,contacts(full_name)").eq("organization_id", orgId)
        .order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "resolved") patch.resolved_at = new Date().toISOString();
      await (supabase as any).from("crm_escalations").update(patch).eq("id", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-escalations", orgId] }); toast.success("Escalación actualizada"); },
  });

  const SEVERITY_TONE: Record<string, string> = {
    critical: "bg-red-500/15 text-red-700 dark:text-red-400",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    info: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  };
  const STATUS_TONE: Record<string, string> = {
    open: "bg-red-500/15 text-red-700 dark:text-red-400",
    acknowledged: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    dismissed: "bg-muted text-muted-foreground",
  };

  const MOCK_ESC = [
    { id: "m1", title: "Lead hot sin contacto >4h", severity: "critical", status: "open", created_at: new Date(Date.now()-5*3600000).toISOString(), contacts: { full_name: "Jorge M." } },
    { id: "m2", title: "Asesor con +10 tareas vencidas", severity: "warning", status: "acknowledged", created_at: new Date(Date.now()-2*3600000).toISOString(), contacts: null },
    { id: "m3", title: "Deal sin next-task >48h", severity: "high", status: "open", created_at: new Date(Date.now()-26*3600000).toISOString(), contacts: { full_name: "Ana Ruiz" } },
  ];

  const display = escalations.length ? escalations : MOCK_ESC;

  return (
    <div className="space-y-4">
      <PageHeader title="Escalaciones" subtitle="SLA incumplidos y alertas del equipo" />
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Escalación</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Severidad</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead>Creada</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
            ) : display.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium text-sm max-w-[200px] truncate">{e.title}</TableCell>
                <TableCell className="text-sm">{e.contacts?.full_name ?? "—"}</TableCell>
                <TableCell><Badge className={`text-xs ${SEVERITY_TONE[e.severity ?? "info"]}`}><ShieldAlert className="w-3 h-3 mr-1" />{e.severity}</Badge></TableCell>
                <TableCell><Badge className={`text-xs ${STATUS_TONE[e.status ?? "open"]}`}>{e.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{relTime(e.created_at)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {e.status === "open" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: e.id, status: "acknowledged" })}>
                        <Bell className="w-3 h-3 mr-1" />Ack
                      </Button>
                    )}
                    {e.status !== "resolved" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: e.id, status: "resolved" })}>
                        <CheckCircle2 className="w-3 h-3 mr-1" />Resolver
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => updateStatus.mutate({ id: e.id, status: "dismissed" })}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── CrmLeadIntelligence ──────────────────────────────────────────────────────

export function CrmLeadIntelligence() {
  const orgId = useCrmOrgId();
  const [activeTab, setActiveTab] = useState<"hot" | "at_risk" | "tracking" | "sales_ready">("hot");

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["crm-lead-intel-global", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_contacts")
        .select("id,full_name,lead_status,lifecycle_stage,last_contacted_at,last_activity_at,created_at,buying_intent,budget_range,development_id,contact_owner")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const scored = useMemo(() => contacts.map((c: any) => ({ c, intel: computeLeadIntelligence({ contact: c }) })), [contacts]);

  const hot = scored.filter(({ intel }) => intel.label === "Hot" || intel.label === "High intent");
  const atRisk = scored.filter(({ intel }) => intel.label === "At risk");
  const tracking = scored.filter(({ intel }) => intel.label === "Tracking issue");
  const salesReady = scored.filter(({ intel }) => intel.label === "Sales ready");

  const KPIs = [
    { label: "Hot / High intent", value: hot.length, tone: "text-red-600 dark:text-red-400" },
    { label: "En riesgo", value: atRisk.length, tone: "text-rose-600 dark:text-rose-400" },
    { label: "Tracking issue", value: tracking.length, tone: "text-violet-600 dark:text-violet-400" },
    { label: "Sales ready", value: salesReady.length, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Total analizados", value: scored.length, tone: "text-foreground" },
    { label: "Score promedio", value: fmtNum(scored.reduce((s, x) => s + x.intel.final_score, 0) / Math.max(1, scored.length)), tone: "text-foreground" },
  ];

  const BUCKETS: Record<typeof activeTab, typeof scored> = { hot, at_risk: atRisk, tracking, sales_ready: salesReady };
  const bucket = BUCKETS[activeTab];

  return (
    <div className="space-y-6">
      <PageHeader title="Lead Intelligence Global" subtitle="Scoring automatizado de toda la base" />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPIs.map(k => (
          <Card key={k.label} className="p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.tone}`}>{isLoading ? "…" : k.value}</p>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="hot">Hot <span className="ml-1 text-[10px]">({hot.length})</span></TabsTrigger>
          <TabsTrigger value="at_risk">En riesgo <span className="ml-1 text-[10px]">({atRisk.length})</span></TabsTrigger>
          <TabsTrigger value="tracking">Tracking issue <span className="ml-1 text-[10px]">({tracking.length})</span></TabsTrigger>
          <TabsTrigger value="sales_ready">Sales ready <span className="ml-1 text-[10px]">({salesReady.length})</span></TabsTrigger>
        </TabsList>
        {(["hot","at_risk","tracking","sales_ready"] as const).map(t => (
          <TabsContent key={t} value={t}>
            {isLoading ? <Skeleton className="h-40 w-full mt-2" /> : bucket.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Sin leads en esta categoría</p>
            ) : (
              <div className="rounded-md border overflow-auto mt-2">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Fit</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Recomendación</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {bucket.slice(0, 30).map(({ c, intel }) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link to={`/admin/portal-crm/ventas/contactos/${c.id}`} className="font-medium text-sm hover:underline">{c.full_name}</Link>
                        </TableCell>
                        <TableCell><Badge className={`text-xs ${LEAD_LABEL_TONE[intel.label] ?? ""}`}>{intel.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{intel.final_score}</span>
                            <Progress value={intel.final_score} className="w-16 h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{intel.fit.score} · {intel.fit.label}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{intel.engagement.score} · {intel.engagement.label}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">{intel.recommendation}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ─── CrmAgentPerformance ──────────────────────────────────────────────────────

export function CrmAgentPerformance() {
  const orgId = useCrmOrgId();
  const [range, setRange] = useState<DateRange>("30d");

  const since = useMemo(() => rangeToSince(range), [range]);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["crm-agent-perf-contacts", orgId, since],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_contacts")
        .select("id,contact_owner,lead_status,lifecycle_stage,created_at,last_contacted_at,crm_deals(deal_stage,value)")
        .eq("organization_id", orgId).gte("created_at", since).limit(500);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["crm-agent-perf-tasks", orgId, since],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_tasks")
        .select("assigned_to,status,due_date").eq("organization_id", orgId).gte("created_at", since).limit(2000);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const perf = useMemo(() => aggregateAgentPerf(contacts, [], [], tasks, []), [contacts, tasks]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Desempeño de asesores"
        description="Métricas de conversión por asesor"
        actions={
          <Select value={range} onValueChange={v => setRange(v as DateRange)}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.entries(RANGE_LABEL) as [DateRange,string][]).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      {isLoading ? <Skeleton className="h-40 w-full" /> : perf.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Sin datos para el período</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Asesor</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Contactados</TableHead>
              <TableHead className="text-right">Citas</TableHead>
              <TableHead className="text-right">Reservas</TableHead>
              <TableHead className="text-right">Lead→Cita</TableHead>
              <TableHead className="text-right">Cita→Reserva</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Vencidas</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {perf.map(a => (
                <TableRow key={a.user_id}>
                  <TableCell className="font-medium text-sm">{a.name ?? "Sin asesor"}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(a.leads_assigned)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(a.leads_contacted)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(a.appointments_scheduled)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(a.reservations)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtPct(a.lead_to_appt_rate)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtPct(a.appt_to_reservation_rate)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(a.revenue)}</TableCell>
                  <TableCell className="text-right text-sm">
                    <span className={a.overdue_tasks > 3 ? "text-red-500 font-medium" : ""}>{fmtNum(a.overdue_tasks)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── CrmSalesOperations ───────────────────────────────────────────────────────

export function CrmSalesOperations() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgContact, setMsgContact] = useState<any>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["crm-sales-ops-queue", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_contacts")
        .select("id,full_name,lead_status,lifecycle_stage,last_contacted_at,last_activity_at,created_at,buying_intent,development_id,contact_owner,crm_tasks(status,due_date)")
        .eq("organization_id", orgId).neq("lead_status", "lost").order("last_activity_at", { ascending: true }).limit(60);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const queue = useMemo(() => {
    return contacts.map((c: any) => {
      const intel = computeLeadIntelligence({ contact: c, tasks: c.crm_tasks ?? [] });
      const sla = calculateSlaStatus(c, { intelLabel: intel.label });
      const priority = getFollowUpPriority(sla, intel.label);
      return { c, intel, sla, priority };
    }).sort((a, b) => {
      const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });
  }, [contacts]);

  const PRIORITY_TONE: Record<string, string> = {
    P0: "bg-red-500/15 text-red-700 dark:text-red-400 font-bold",
    P1: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    P2: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    P3: "bg-muted text-muted-foreground",
  };

  const createTask = useMutation({
    mutationFn: async (contactId: string) => {
      if (!orgId) return;
      await (supabase as any).from("crm_tasks").insert({ organization_id: orgId, contact_id: contactId, title: "Seguimiento urgente (sales ops)", priority: "high", status: "pending" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-sales-ops-queue", orgId] }); toast.success("Tarea creada"); },
  });

  const selectedMsg = useMemo(() => {
    if (!msgContact) return null;
    const intel = computeLeadIntelligence({ contact: msgContact });
    return generateMessage(intel.label === "Hot" || intel.label === "High intent" ? "whatsapp_hot_lead" : "whatsapp_new_lead", {
      contact_name: msgContact.full_name,
      advisor_name: "tu asesor",
    });
  }, [msgContact]);

  return (
    <div className="space-y-4">
      <PageHeader title="Sales Operations" subtitle="Cola de seguimiento por prioridad SLA" />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Contacto</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Regla SLA</TableHead>
            <TableHead>Recomendación</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
            ) : queue.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin leads en cola</TableCell></TableRow>
            ) : queue.map(({ c, intel, sla, priority }) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link to={`/admin/portal-crm/ventas/contactos/${c.id}`} className="font-medium text-sm hover:underline">{c.full_name}</Link>
                </TableCell>
                <TableCell><Badge className={`text-xs ${LEAD_LABEL_TONE[intel.label] ?? ""}`}>{intel.label}</Badge></TableCell>
                <TableCell><Badge className={`text-xs ${SLA_TONE[sla.status]}`}>{sla.status.replace(/_/g," ")}</Badge></TableCell>
                <TableCell><Badge className={`text-xs ${PRIORITY_TONE[priority]}`}>{priority}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{sla.reason}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{sla.recommendation}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => createTask.mutate(c.id)}>
                      <ClipboardList className="w-3 h-3 mr-1" />Tarea
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setMsgContact(c); setMsgOpen(true); }}>
                      <MessageSquare className="w-3 h-3 mr-1" />Msg
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mensaje generado — {msgContact?.full_name}</DialogTitle></DialogHeader>
          {selectedMsg && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />{selectedMsg.channel.replace("_mock","")}
              </div>
              <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{selectedMsg.body}</div>
              <p className="text-xs text-amber-600 dark:text-amber-400">{selectedMsg.disclaimer}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(selectedMsg?.body ?? ""); toast.success("Copiado"); }}>
              <Copy className="w-4 h-4 mr-1" />Copiar
            </Button>
            <Button onClick={() => setMsgOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
