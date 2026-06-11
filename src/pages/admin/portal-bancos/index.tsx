import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useBankStore } from "@/lib/portal-bancos/bank-store";
import { useBankAgentsStore, type Agent } from "@/lib/portal-bancos/agents-store";
import {
  BANKS, STATUS_DESCRIPTORS, VALID_TRANSITIONS, REJECTION_REASONS, DESIST_REASONS,
  HEALTH_DESCRIPTOR, deriveHealth, closedDescriptor, fmtMXN, fmtDate,
  type BankLead, type LeadStatus, type BankId,
} from "@/lib/portal-bancos/bank-leads";
import {
  useBankImpersonation, useCurrentBankAgent, visibleLeads,
} from "@/contexts/BankImpersonationContext";
import {
  computeFunnel, computeWinRate, STAGE_PROBABILITY,
} from "@/lib/portal-bancos/metrics";
import { PIPELINE_ORDER } from "@/lib/portal-bancos/bank-leads";
import { Building2, Inbox, ArrowRight, CheckCircle2, XCircle, Activity } from "lucide-react";

// ------------------------------ Helpers UI ------------------------------
function toneClass(t: "neutral" | "info" | "warning" | "success" | "destructive") {
  return {
    neutral: "bg-muted text-muted-foreground",
    info: "bg-blue-100 text-blue-700",
    warning: "bg-amber-100 text-amber-700",
    success: "bg-emerald-100 text-emerald-700",
    destructive: "bg-red-100 text-red-700",
  }[t];
}

function useBankScopedLeads(): BankLead[] {
  const agent = useCurrentBankAgent();
  const leads = useBankStore((s) => s.leads);
  if (!agent) return [];
  const sameBank = leads.filter((l) => l.bankId === agent.bankId);
  return visibleLeads(agent, sameBank);
}

function LeadCard({ lead, onOpen }: { lead: BankLead; onOpen: (id: string) => void }) {
  const desc = STATUS_DESCRIPTORS[lead.status];
  const closed = closedDescriptor(lead.status);
  const health = deriveHealth(lead);
  const hd = HEALTH_DESCRIPTOR[health];
  const agentName = useBankAgentsStore((s) => s.agentName(lead.assignedAgentId));
  return (
    <button
      onClick={() => onOpen(lead.id)}
      className="w-full text-left rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/40 transition"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{lead.client.fullName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {lead.property.project} · {lead.property.unit} · {fmtMXN(lead.credit.montoFinanciar)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge className={toneClass(desc.tone)} variant="secondary">{desc.label}</Badge>
          {closed ? null : <Badge className={toneClass(hd.tone)} variant="outline">{hd.label}</Badge>}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Score: <strong className="text-foreground">{lead.sozu.score}</strong></span>
        <span>{agentName}</span>
        <span>Escr. {fmtDate(lead.property.fechaEscrituracion)}</span>
      </div>
    </button>
  );
}

function SolicitudDetailSheet({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const lead = useBankStore((s) => (leadId ? s.getLead(leadId) : undefined));
  const updateStatus = useBankStore((s) => s.updateStatus);
  const addNote = useBankStore((s) => s.addNote);
  const assignLead = useBankStore((s) => s.assignLead);
  const agent = useCurrentBankAgent();
  const agents = useBankAgentsStore((s) => (agent ? s.agentsByBank(agent.bankId, { onlyActive: true }) : []));
  const [note, setNote] = useState("");
  const [closeReason, setCloseReason] = useState<string>("");

  if (!lead || !agent) return null;
  const desc = STATUS_DESCRIPTORS[lead.status];
  const transitions = VALID_TRANSITIONS[lead.status] || [];

  const doTransition = (to: LeadStatus) => {
    let reason: string | undefined;
    if (to === "rechazado" || to === "desistido") {
      reason = closeReason || (to === "rechazado" ? REJECTION_REASONS[0] : DESIST_REASONS[0]);
    }
    updateStatus(lead.id, to, agent.name, reason);
    toast({ title: "Estado actualizado", description: `${desc.label} → ${STATUS_DESCRIPTORS[to].label}` });
  };

  return (
    <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lead.client.fullName}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <div className="rounded-lg border border-border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Solicitud {lead.sozu.leadId}</p>
            <p className="font-medium">{lead.property.project} · {lead.property.unit}</p>
            <p className="text-xs text-muted-foreground">{lead.property.address}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className={toneClass(desc.tone)} variant="secondary">{desc.label}</Badge>
              <Badge variant="outline">Score {lead.sozu.score}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Monto a financiar" value={fmtMXN(lead.credit.montoFinanciar)} />
            <Stat label="Plazo" value={`${lead.credit.plazoAnios} años`} />
            <Stat label="Mensualidad est." value={`${fmtMXN(lead.credit.estMonthlyMin)} – ${fmtMXN(lead.credit.estMonthlyMax)}`} />
            <Stat label="Tasa est." value={`${lead.credit.estRateMin}% – ${lead.credit.estRateMax}%`} />
            <Stat label="Avance obra" value={`${lead.property.avanceObra}% · ${lead.property.etapa}`} />
            <Stat label="Fecha escrituración" value={fmtDate(lead.property.fechaEscrituracion)} />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Asignación</p>
            <Select value={lead.assignedAgentId ?? ""} onValueChange={(v) => assignLead(lead.id, v, agent.name)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Asignar ejecutivo" /></SelectTrigger>
              <SelectContent>
                {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {transitions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Cambiar estado</p>
              <div className="flex flex-wrap gap-2">
                {transitions.map((to) => (
                  <Button key={to} size="sm" variant="outline" onClick={() => doTransition(to)}>
                    {STATUS_DESCRIPTORS[to].label}
                  </Button>
                ))}
              </div>
              {(transitions.includes("rechazado") || transitions.includes("desistido")) && (
                <Select value={closeReason} onValueChange={setCloseReason}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Motivo de cierre (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {[...REJECTION_REASONS, ...DESIST_REASONS].map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Agregar nota</p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Resumen del contacto, próximos pasos..." />
            <Button size="sm" disabled={!note.trim()} onClick={() => { addNote(lead.id, agent.name, note.trim()); setNote(""); toast({ title: "Nota agregada" }); }}>
              Guardar nota
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Bitácora</p>
            <div className="space-y-2">
              {lead.activity.map((a) => (
                <div key={a.id} className="rounded-md border border-border p-2 text-xs">
                  <div className="flex justify-between"><span className="font-medium">{a.author}</span><span className="text-muted-foreground">{fmtDate(a.ts)}</span></div>
                  <p className="text-muted-foreground">
                    {a.type === "status_change"
                      ? `${a.from ? STATUS_DESCRIPTORS[a.from].label : "—"} → ${a.to ? STATUS_DESCRIPTORS[a.to].label : "—"}${a.note ? ` · ${a.note}` : ""}`
                      : a.note || a.type}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <Icon className="h-8 w-8 mx-auto text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ============================== BANDEJA ==============================
export function BancosBandeja() {
  const leads = useBankScopedLeads();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"abiertas" | "mias" | "cerradas">("abiertas");
  const [q, setQ] = useState("");
  const agent = useCurrentBankAgent();

  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return leads.filter((l) => {
      const desc = STATUS_DESCRIPTORS[l.status];
      if (tab === "abiertas" && desc.isTerminal) return false;
      if (tab === "cerradas" && !desc.isTerminal) return false;
      if (tab === "mias" && (desc.isTerminal || l.assignedAgentId !== agent?.id)) return false;
      if (!norm) return true;
      return (
        l.client.fullName.toLowerCase().includes(norm) ||
        l.property.project.toLowerCase().includes(norm) ||
        l.property.unit.toLowerCase().includes(norm) ||
        l.sozu.leadId.toLowerCase().includes(norm)
      );
    });
  }, [leads, tab, q, agent?.id]);

  return (
    <div className="space-y-4">
      <Header title="Bandeja de solicitudes" subtitle={agent ? `${BANKS[agent.bankId].name} · ${agent.name}` : ""} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList>
            <TabsTrigger value="abiertas">Abiertas</TabsTrigger>
            <TabsTrigger value="mias">Mías</TabsTrigger>
            <TabsTrigger value="cerradas">Cerradas</TabsTrigger>
          </TabsList>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, proyecto, folio..." className="sm:w-80" />
        </div>
        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <EmptyState icon={Inbox} title="Sin solicitudes" hint="Ajusta los filtros o el segmento." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((l) => <LeadCard key={l.id} lead={l} onOpen={setOpenId} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <SolicitudDetailSheet leadId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

// ============================== PIPELINE ==============================
export function BancosPipeline() {
  const leads = useBankScopedLeads();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Header title="Pipeline" subtitle="Tablero por etapa del proceso hipotecario" />
      <div className="flex gap-3 overflow-x-auto pb-3">
        {PIPELINE_ORDER.map((status) => {
          const items = leads.filter((l) => l.status === status);
          const desc = STATUS_DESCRIPTORS[status];
          return (
            <div key={status} className="min-w-[280px] w-[280px] shrink-0 rounded-xl bg-muted/30 p-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{desc.label}</p>
                  <p className="text-[11px] text-muted-foreground">{desc.shortDesc}</p>
                </div>
                <Badge variant="outline">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Vacío</p>
                ) : items.map((l) => <LeadCard key={l.id} lead={l} onOpen={setOpenId} />)}
              </div>
            </div>
          );
        })}
      </div>
      <SolicitudDetailSheet leadId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

// ============================== TABLERO ==============================
export function BancosTablero() {
  const leads = useBankScopedLeads();
  const agent = useCurrentBankAgent();
  const funnel = computeFunnel(leads);
  const wr = computeWinRate(leads);
  const totalMonto = leads.reduce((s, l) => s + l.credit.montoFinanciar, 0);
  const pipelineLeads = leads.filter((l) => !STATUS_DESCRIPTORS[l.status].isTerminal);
  const expectedRevenue = pipelineLeads.reduce(
    (s, l) => s + l.credit.montoFinanciar * STAGE_PROBABILITY[l.status],
    0,
  );

  return (
    <div className="space-y-4">
      <Header title="Tablero" subtitle={agent ? `${BANKS[agent.bankId].name}` : ""} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Inbox} label="Solicitudes" value={leads.length.toString()} />
        <Kpi icon={Activity} label="Monto solicitado" value={fmtMXN(totalMonto)} />
        <Kpi icon={CheckCircle2} label="Win rate" value={`${wr.rate}%`} hint={`${wr.won} de ${wr.closed} cerradas`} />
        <Kpi icon={ArrowRight} label="Pipeline ponderado" value={fmtMXN(expectedRevenue)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Funnel del proceso</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {funnel.map((f) => {
            const max = Math.max(1, funnel[0].count);
            const pct = Math.round((f.count / max) * 100);
            return (
              <div key={f.status}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{f.label}</span>
                  <span className="text-muted-foreground">{f.count}{f.conversionFromPrev !== null && ` · ${f.conversionFromPrev}%`}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Cierres</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-600" />
              <p className="text-2xl font-bold text-emerald-700 mt-1">{wr.won}</p>
              <p className="text-xs text-emerald-700">Formalizados</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <XCircle className="h-6 w-6 mx-auto text-red-600" />
              <p className="text-2xl font-bold text-red-700 mt-1">{wr.lost}</p>
              <p className="text-xs text-red-700">Rechazados / desistidos</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold text-foreground mt-2">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

// ============================== EQUIPO ==============================
export function BancosEquipo() {
  const agent = useCurrentBankAgent();
  const agentsForBank = useBankAgentsStore((s) => (agent ? s.agentsByBank(agent.bankId) : []));
  const createAgent = useBankAgentsStore((s) => s.createAgent);
  const updateAgent = useBankAgentsStore((s) => s.updateAgent);
  const deactivateAgent = useBankAgentsStore((s) => s.deactivateAgent);
  const reactivateAgent = useBankAgentsStore((s) => s.reactivateAgent);

  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "agente" as "agente" | "admin" });

  if (!agent) return null;
  if (agent.role !== "admin") {
    return (
      <div className="space-y-4">
        <Header title="Equipo" />
        <EmptyState icon={Building2} title="Solo administradores" hint="Pide a un administrador del banco que gestione el equipo." />
      </div>
    );
  }

  const submit = () => {
    if (!form.name || !form.email) return;
    createAgent({ name: form.name, email: form.email, phone: form.phone, role: form.role, bankId: agent.bankId });
    setForm({ name: "", email: "", phone: "", role: "agente" });
    toast({ title: "Ejecutivo agregado" });
  };

  return (
    <div className="space-y-4">
      <Header title="Equipo" subtitle={BANKS[agent.bankId].name} />
      <Card>
        <CardHeader><CardTitle className="text-base">Nuevo ejecutivo</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="flex gap-2">
            <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agente">Agente</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={submit}>Agregar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Equipo actual</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {agentsForBank.map((a) => (
            <AgentRow key={a.id} a={a} onToggleActive={() => (a.active ? deactivateAgent(a.id) : reactivateAgent(a.id))} onChangeRole={(r) => updateAgent(a.id, { role: r })} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentRow({ a, onToggleActive, onChangeRole }: { a: Agent; onToggleActive: () => void; onChangeRole: (r: "agente" | "admin") => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <Avatar2 name={a.name} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{a.name}</p>
        <p className="text-xs text-muted-foreground truncate">{a.email} · {a.phone}</p>
      </div>
      <Select value={a.role} onValueChange={(v: any) => onChangeRole(v)}>
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="agente">Agente</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" variant={a.active ? "outline" : "default"} onClick={onToggleActive}>
        {a.active ? "Desactivar" : "Reactivar"}
      </Button>
    </div>
  );
}

function Avatar2({ name }: { name: string }) {
  const ini = name.split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
  return <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{ini}</div>;
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}