import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Inbox, Mail, MessageSquare, Phone, Users, Clock, AlertTriangle,
  CheckCircle2, Filter, ListChecks, Timer, Search,
  Plus, Sparkles, Bot, RefreshCw, Send, Building2, Layers, Copy,
  PlayCircle, ChevronRight, Wand2, Edit2, Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCrmOrgId } from "@/hooks/useCrmOrgId";
import { PageHeader, MockBadge, Panel, ComingSoon } from "@/components/admin/portal-crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtNum, fmtPct, relTime } from "@/data/portal-crm/mockData";
import { BUILDER_OBJECTIVES, DRAFT_STATUS_TONE, DRAFT_STATUSES, computeReadiness } from "@/lib/crm-builder";
import { SEQUENCES, generateMessage, type MessageKind } from "@/lib/crm-sales-ops";

const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

// ===================================================================
// Mock data — Fase 5 (Operación)
// ===================================================================

type Channel = "email" | "whatsapp" | "call" | "form";
const CHANNEL_META: Record<Channel, { label: string; icon: typeof Mail; tone: string }> = {
  email:    { label: "Email",    icon: Mail,          tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  call:     { label: "Llamada",  icon: Phone,         tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  form:     { label: "Web form", icon: Inbox,         tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
};

interface InboxItem {
  id: string;
  channel: Channel;
  contact: string;
  subject: string;
  preview: string;
  owner: string | null;
  status: "unassigned" | "open" | "pending" | "resolved";
  priority: "low" | "medium" | "high";
  received_at: string;
  unread: boolean;
}

const INBOX: InboxItem[] = [
  { id: "in1", channel: "whatsapp", contact: "Andrea Robles",  subject: "Disponibilidad modelo Vivenza B", preview: "Hola, sigue disponible el dpto del piso 8?",        owner: null,               status: "unassigned", priority: "high",   received_at: minsAgo(4),    unread: true },
  { id: "in2", channel: "email",    contact: "Bruno Sánchez",  subject: "Plan de pagos · Reserva 360",     preview: "Adjunto comprobante de ingresos, agradezco revisión.",owner: "Miguel Castro",    status: "open",       priority: "medium", received_at: minsAgo(22),   unread: true },
  { id: "in3", channel: "call",     contact: "Carla Méndez",   subject: "Llamada perdida",                 preview: "Llamada de 1m 12s · sin contestar",                   owner: "Karla Ríos",       status: "pending",    priority: "high",   received_at: minsAgo(48),   unread: false },
  { id: "in4", channel: "form",     contact: "Diego Ortiz",    subject: "Formulario landing Altea",        preview: "Quiero recibir información sobre departamentos.",     owner: null,               status: "unassigned", priority: "low",    received_at: minsAgo(95),   unread: true },
  { id: "in5", channel: "whatsapp", contact: "Elena Vargas",   subject: "Confirmación visita sábado",      preview: "Confirmado para el sábado 10am, gracias!",            owner: "Paola Téllez",     status: "open",       priority: "medium", received_at: minsAgo(180),  unread: false },
  { id: "in6", channel: "email",    contact: "Fernanda Soto",  subject: "Comparativo de modelos",          preview: "Pueden enviarme un comparativo entre modelos A y B?", owner: "Karla Ríos",       status: "resolved",   priority: "low",    received_at: minsAgo(360),  unread: false },
  { id: "in7", channel: "whatsapp", contact: "Luis Romero",    subject: "Cita en obra",                    preview: "Me confirman dirección y hora?",                      owner: null,               status: "unassigned", priority: "high",   received_at: minsAgo(12),   unread: true },
];

interface Queue {
  id: string;
  name: string;
  description: string;
  channel: Channel | "mixto";
  team: string;
  open: number;
  pending: number;
  resolved_today: number;
  sla_breach: number;
  avg_first_response_min: number;
  active: boolean;
}

const QUEUES: Queue[] = [
  { id: "q1", name: "Leads Meta Ads",       description: "Bandeja de leads nuevos provenientes de Meta",   channel: "form",     team: "Comercial · MX",  open: 48, pending: 12, resolved_today: 26, sla_breach: 3, avg_first_response_min: 18, active: true },
  { id: "q2", name: "WhatsApp comercial",   description: "Conversaciones entrantes de WhatsApp",            channel: "whatsapp", team: "Comercial · MX",  open: 31, pending:  8, resolved_today: 42, sla_breach: 5, avg_first_response_min:  9, active: true },
  { id: "q3", name: "Email general",        description: "Buzón ventas@sozu.com",                           channel: "email",    team: "Comercial · MX",  open: 22, pending:  4, resolved_today: 14, sla_breach: 1, avg_first_response_min: 38, active: true },
  { id: "q4", name: "Llamadas de cierre",   description: "Cola para llamadas de propuesta y negociación",   channel: "call",     team: "Closers",         open: 12, pending:  6, resolved_today:  9, sla_breach: 2, avg_first_response_min: 22, active: true },
  { id: "q5", name: "Postventa · soporte",  description: "Atención a clientes post-firma",                  channel: "mixto",    team: "CX",              open:  8, pending:  3, resolved_today:  6, sla_breach: 0, avg_first_response_min: 47, active: true },
  { id: "q6", name: "Win-back 90d",         description: "Reactivación de leads fríos",                     channel: "email",    team: "Marketing",       open: 14, pending:  0, resolved_today:  2, sla_breach: 0, avg_first_response_min: 0,  active: false },
];

interface SlaPolicy {
  id: string;
  name: string;
  channel: Channel | "mixto";
  priority: "low" | "medium" | "high";
  first_response_min: number;
  resolution_min: number;
  compliance: number; // 0..1
  breaches_24h: number;
  at_risk: number;
}

const SLA_POLICIES: SlaPolicy[] = [
  { id: "s1", name: "Lead Meta · alta prioridad",     channel: "form",     priority: "high",   first_response_min: 15,  resolution_min:  240, compliance: 0.91, breaches_24h: 3, at_risk: 5 },
  { id: "s2", name: "WhatsApp · respuesta inmediata", channel: "whatsapp", priority: "high",   first_response_min: 10,  resolution_min:  120, compliance: 0.87, breaches_24h: 5, at_risk: 7 },
  { id: "s3", name: "Email general",                  channel: "email",    priority: "medium", first_response_min: 60,  resolution_min:  720, compliance: 0.96, breaches_24h: 1, at_risk: 2 },
  { id: "s4", name: "Llamada cierre",                 channel: "call",     priority: "high",   first_response_min: 30,  resolution_min:  240, compliance: 0.82, breaches_24h: 2, at_risk: 4 },
  { id: "s5", name: "Postventa estándar",             channel: "mixto",    priority: "medium", first_response_min: 120, resolution_min: 1440, compliance: 0.94, breaches_24h: 0, at_risk: 1 },
  { id: "s6", name: "Win-back · baja prioridad",      channel: "email",    priority: "low",    first_response_min: 480, resolution_min: 4320, compliance: 0.99, breaches_24h: 0, at_risk: 0 },
];

interface SlaBreach {
  id: string;
  policy: string;
  contact: string;
  channel: Channel;
  owner: string | null;
  age_min: number;
  status: "at_risk" | "breached";
  queue: string;
}

const SLA_BREACHES: SlaBreach[] = [
  { id: "b1", policy: "WhatsApp · respuesta inmediata", contact: "Andrea Robles", channel: "whatsapp", owner: null,             age_min: 22, status: "breached", queue: "WhatsApp comercial" },
  { id: "b2", policy: "WhatsApp · respuesta inmediata", contact: "Luis Romero",   channel: "whatsapp", owner: null,             age_min: 14, status: "breached", queue: "WhatsApp comercial" },
  { id: "b3", policy: "Lead Meta · alta prioridad",     contact: "Diego Ortiz",   channel: "form",     owner: null,             age_min: 18, status: "breached", queue: "Leads Meta Ads" },
  { id: "b4", policy: "Llamada cierre",                 contact: "Carla Méndez",  channel: "call",     owner: "Karla Ríos",     age_min: 12, status: "at_risk",  queue: "Llamadas de cierre" },
  { id: "b5", policy: "Email general",                  contact: "Bruno Sánchez", channel: "email",    owner: "Miguel Castro",  age_min: 41, status: "at_risk",  queue: "Email general" },
];

// ===================================================================
// Helpers UI
// ===================================================================

const PriorityBadge = ({ p }: { p: "low" | "medium" | "high" }) => {
  const tone =
    p === "high"   ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
    : p === "medium" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    : "bg-slate-500/15 text-slate-700 dark:text-slate-300";
  const label = p === "high" ? "Alta" : p === "medium" ? "Media" : "Baja";
  return <Badge variant="outline" className={`border-transparent ${tone}`}>{label}</Badge>;
};

const StatusBadge = ({ s }: { s: InboxItem["status"] }) => {
  const map = {
    unassigned: { tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300", label: "Sin asignar" },
    open:       { tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300", label: "Abierto" },
    pending:    { tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", label: "Pendiente" },
    resolved:   { tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", label: "Resuelto" },
  };
  const c = map[s];
  return <Badge variant="outline" className={`border-transparent ${c.tone}`}>{c.label}</Badge>;
};

const ChannelChip = ({ c }: { c: Channel }) => {
  const meta = CHANNEL_META[c];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${meta.tone}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
};

// ===================================================================
// Vistas
// ===================================================================

export function CrmUnifiedInbox() {
  const [tab, setTab] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<string>("todos");

  const filtered = useMemo(() => {
    return INBOX.filter((i) => {
      if (tab === "no_leidos" && !i.unread) return false;
      if (tab === "sin_asignar" && i.status !== "unassigned") return false;
      if (tab === "mios" && i.owner !== "Karla Ríos") return false;
      if (channel !== "todos" && i.channel !== channel) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!i.contact.toLowerCase().includes(s) && !i.subject.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [tab, search, channel]);

  const counts = {
    total: INBOX.length,
    unread: INBOX.filter((i) => i.unread).length,
    unassigned: INBOX.filter((i) => i.status === "unassigned").length,
    sla: INBOX.filter((i) => i.priority === "high" && i.status === "unassigned").length,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bandeja unificada"
        description="Mensajes entrantes de todos los canales en un solo lugar."
        actions={<MockBadge />}
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Mensajes</p>
          <p className="mt-1 text-2xl font-semibold">{counts.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">No leídos</p>
          <p className="mt-1 text-2xl font-semibold">{counts.unread}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Sin asignar</p>
          <p className="mt-1 text-2xl font-semibold">{counts.unassigned}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Alta prioridad sin asignar</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600 dark:text-rose-400">{counts.sla}</p>
        </CardContent></Card>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="no_leidos">No leídos</TabsTrigger>
              <TabsTrigger value="sin_asignar">Sin asignar</TabsTrigger>
              <TabsTrigger value="mios">Míos</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los canales</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="call">Llamada</SelectItem>
                <SelectItem value="form">Web form</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar contacto o asunto"
                className="h-9 w-[240px] pl-7"
              />
            </div>
          </div>
        </div>

        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay mensajes con los filtros actuales.</div>
          )}
          {filtered.map((i) => (
            <button
              key={i.id}
              onClick={() => toast.info(`Abrir conversación · ${i.contact} (mock)`)}
              className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="mt-0.5">
                <span className={`inline-block h-2 w-2 rounded-full ${i.unread ? "bg-primary" : "bg-transparent"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm ${i.unread ? "font-semibold" : "font-medium"}`}>{i.contact}</span>
                  <ChannelChip c={i.channel} />
                  <StatusBadge s={i.status} />
                  <PriorityBadge p={i.priority} />
                  <span className="ml-auto text-[11px] text-muted-foreground">{relTime(i.received_at)}</span>
                </div>
                <p className={`mt-0.5 text-sm ${i.unread ? "text-foreground" : "text-muted-foreground"}`}>{i.subject}</p>
                <p className="text-xs text-muted-foreground truncate">{i.preview}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {i.owner ? <>Asignado a <span className="font-medium">{i.owner}</span></> : <span className="text-rose-600 dark:text-rose-400">Sin asignar</span>}
                </p>
              </div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function CrmQueues() {
  const [showInactive, setShowInactive] = useState(false);
  const list = QUEUES.filter((q) => showInactive || q.active);

  const totals = QUEUES.reduce(
    (acc, q) => ({
      open: acc.open + q.open,
      pending: acc.pending + q.pending,
      resolved: acc.resolved + q.resolved_today,
      breach: acc.breach + q.sla_breach,
    }),
    { open: 0, pending: 0, resolved: 0, breach: 0 },
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Colas"
        description="Distribución de trabajo por equipo y canal."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline"
              onClick={() => setShowInactive((v) => !v)}
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              {showInactive ? "Ocultar inactivas" : "Mostrar inactivas"}
            </Button>
            <MockBadge />
          </div>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Abiertos</p>
          <p className="mt-1 text-2xl font-semibold">{fmtNum(totals.open)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pendientes</p>
          <p className="mt-1 text-2xl font-semibold">{fmtNum(totals.pending)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Resueltos hoy</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{fmtNum(totals.resolved)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">SLA incumplidos</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600 dark:text-rose-400">{fmtNum(totals.breach)}</p>
        </CardContent></Card>
      </div>

      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cola</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Equipo</TableHead>
              <TableHead className="text-right">Abiertos</TableHead>
              <TableHead className="text-right">Pendientes</TableHead>
              <TableHead className="text-right">Resueltos hoy</TableHead>
              <TableHead className="text-right">SLA breach</TableHead>
              <TableHead className="text-right">1ra resp.</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((q) => (
              <TableRow key={q.id}>
                <TableCell>
                  <p className="font-medium">{q.name}</p>
                  <p className="text-xs text-muted-foreground">{q.description}</p>
                </TableCell>
                <TableCell>
                  {q.channel === "mixto"
                    ? <Badge variant="outline">Mixto</Badge>
                    : <ChannelChip c={q.channel as Channel} />}
                </TableCell>
                <TableCell className="text-muted-foreground">{q.team}</TableCell>
                <TableCell className="text-right">{q.open}</TableCell>
                <TableCell className="text-right">{q.pending}</TableCell>
                <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{q.resolved_today}</TableCell>
                <TableCell className={`text-right ${q.sla_breach > 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>{q.sla_breach}</TableCell>
                <TableCell className="text-right">{q.avg_first_response_min} min</TableCell>
                <TableCell>
                  {q.active
                    ? <Badge variant="outline" className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Activa</Badge>
                    : <Badge variant="outline" className="border-transparent bg-slate-500/15 text-slate-700 dark:text-slate-300">Inactiva</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

export function CrmSlaMonitor() {
  const totalBreaches = SLA_POLICIES.reduce((s, p) => s + p.breaches_24h, 0);
  const totalRisk     = SLA_POLICIES.reduce((s, p) => s + p.at_risk, 0);
  const avgCompliance = SLA_POLICIES.reduce((s, p) => s + p.compliance, 0) / SLA_POLICIES.length;

  const complianceTone = (c: number) =>
    c >= 0.95 ? "text-emerald-600 dark:text-emerald-400"
    : c >= 0.85 ? "text-amber-600 dark:text-amber-400"
    : "text-rose-600 dark:text-rose-400";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Monitor de SLA"
        description="Cumplimiento de tiempos de respuesta y resolución por política."
        actions={<MockBadge />}
      />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Cumplimiento global</p>
          <p className={`mt-1 text-2xl font-semibold ${complianceTone(avgCompliance)}`}>{fmtPct(avgCompliance)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Promedio últimas 24h</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Incumplimientos (24h)</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600 dark:text-rose-400">{totalBreaches}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">En riesgo</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">{totalRisk}</p>
        </CardContent></Card>
      </div>

      <Panel title="Políticas de SLA">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Política</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead className="text-right">1ra resp.</TableHead>
              <TableHead className="text-right">Resolución</TableHead>
              <TableHead>Cumplimiento</TableHead>
              <TableHead className="text-right">Breach 24h</TableHead>
              <TableHead className="text-right">En riesgo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SLA_POLICIES.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  {p.channel === "mixto"
                    ? <Badge variant="outline">Mixto</Badge>
                    : <ChannelChip c={p.channel as Channel} />}
                </TableCell>
                <TableCell><PriorityBadge p={p.priority} /></TableCell>
                <TableCell className="text-right">{p.first_response_min} min</TableCell>
                <TableCell className="text-right">{p.resolution_min} min</TableCell>
                <TableCell className="w-[180px]">
                  <div className="flex items-center gap-2">
                    <Progress value={p.compliance * 100} />
                    <span className={`text-xs font-medium ${complianceTone(p.compliance)}`}>{fmtPct(p.compliance, 0)}</span>
                  </div>
                </TableCell>
                <TableCell className={`text-right ${p.breaches_24h > 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>{p.breaches_24h}</TableCell>
                <TableCell className={`text-right ${p.at_risk > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{p.at_risk}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      <Panel title="Casos incumplidos y en riesgo" description="Acciones inmediatas para evitar mayor deterioro.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contacto</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Cola</TableHead>
              <TableHead>Política</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Edad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SLA_BREACHES.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.contact}</TableCell>
                <TableCell><ChannelChip c={b.channel} /></TableCell>
                <TableCell className="text-muted-foreground">{b.queue}</TableCell>
                <TableCell className="text-muted-foreground">{b.policy}</TableCell>
                <TableCell className="text-muted-foreground">{b.owner ?? "Sin asignar"}</TableCell>
                <TableCell className="text-right">{b.age_min} min</TableCell>
                <TableCell>
                  {b.status === "breached"
                    ? <Badge variant="outline" className="border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300"><AlertTriangle className="h-3 w-3 mr-1" />Breach</Badge>
                    : <Badge variant="outline" className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300"><Clock className="h-3 w-3 mr-1" />En riesgo</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => toast.info(`Escalado · ${b.contact} (mock)`)}>
                    Escalar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

// ===================================================================
// CrmCampaignBuilder
// ===================================================================
type DraftCampaign = {
  id: string; name: string; objective: string; status: string;
  audience_segment: string; sequence_id: string; total_steps: number;
  enrolled_contacts: number; created_at: string;
};

const DRAFT_MOCK: DraftCampaign[] = [
  { id: "d1", name: "Nurturing Altea · Leads tibios", objective: "nurturing", status: "active", audience_segment: "Warm · Altea", sequence_id: "seq_nurturing", total_steps: 5, enrolled_contacts: 38, created_at: new Date(Date.now() - 10 * 86400_000).toISOString() },
  { id: "d2", name: "Re-engagement Q2 2025", objective: "reengagement", status: "paused", audience_segment: "Cold · 90d+", sequence_id: "seq_reengagement", total_steps: 4, enrolled_contacts: 64, created_at: new Date(Date.now() - 25 * 86400_000).toISOString() },
  { id: "d3", name: "Cierre · Hot leads", objective: "closing", status: "draft", audience_segment: "Hot · pipeline", sequence_id: "seq_closing", total_steps: 6, enrolled_contacts: 0, created_at: new Date(Date.now() - 2 * 86400_000).toISOString() },
];

const OBJ_LABEL: Record<string, string> = {
  nurturing: "Nurturing", reengagement: "Re-engagement", closing: "Cierre",
  onboarding: "Onboarding", upsell: "Upsell",
};

export function CrmCampaignBuilder() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();
  const [tab, setTab] = useState("campaigns");
  const [openCreate, setOpenCreate] = useState(false);
  const [selSeq, setSelSeq] = useState(SEQUENCES[0].id);
  const [form, setForm] = useState({ name: "", objective: "nurturing", audience_segment: "", sequence_id: SEQUENCES[0].id });

  const { data: dbDrafts = [], isLoading } = useQuery({
    queryKey: ["crm-campaign-drafts", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_campaign_drafts").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const campaigns: DraftCampaign[] = dbDrafts.length > 0 ? dbDrafts : DRAFT_MOCK;

  const saveCampaign = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      const seq = SEQUENCES.find(s => s.id === form.sequence_id);
      await (supabase as any).from("crm_campaign_drafts").insert({
        organization_id: orgId, name: form.name, objective: form.objective,
        audience_segment: form.audience_segment, sequence_id: form.sequence_id,
        total_steps: seq?.steps.length ?? 0, enrolled_contacts: 0, status: "draft",
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-campaign-drafts", orgId] }); setOpenCreate(false); toast.success("Campaña creada"); },
  });

  const activeSeq = SEQUENCES.find(s => s.id === selSeq) ?? SEQUENCES[0];

  return (
    <div className="space-y-4">
      <PageHeader title="Constructor de campañas" subtitle="Secuencias de nurturing y plantillas de campaña">
        <MockBadge />
        <Button size="sm" onClick={() => setOpenCreate(true)}><Plus className="w-4 h-4 mr-1" />Nueva campaña</Button>
      </PageHeader>

      {dbDrafts.length === 0 && (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />Mostrando campañas de ejemplo. Crea campañas reales desde el botón de arriba.
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="campaigns">Campañas activas</TabsTrigger>
          <TabsTrigger value="sequences">Secuencias disponibles</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="pt-3">
          {isLoading ? <Skeleton className="h-32 w-full" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {campaigns.map(c => {
                const statusTone = c.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : c.status === "paused" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-muted text-muted-foreground";
                return (
                  <Card key={c.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-semibold leading-tight">{c.name}</p>
                      <Badge className={`text-[10px] shrink-0 ml-2 ${statusTone}`}>{c.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{OBJ_LABEL[c.objective] ?? c.objective}</Badge>
                      <Badge variant="outline" className="text-[10px]">{c.audience_segment}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{c.total_steps} pasos</span>
                      <span>{c.enrolled_contacts} contactos</span>
                    </div>
                    <div className="flex gap-1 pt-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toast.info(`Editar ${c.name} (mock)`)}>
                        <Edit2 className="w-3 h-3 mr-1" />Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toast.info(`Activar/pausar ${c.name} (mock)`)}>
                        <PlayCircle className="w-3 h-3 mr-1" />
                        {c.status === "active" ? "Pausar" : "Activar"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sequences" className="pt-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1 border-r pr-3">
              {SEQUENCES.map(s => (
                <button key={s.id} onClick={() => setSelSeq(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selSeq === s.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
                  {s.name}
                </button>
              ))}
            </div>
            <div className="md:col-span-2 space-y-3">
              <p className="text-sm font-semibold">{activeSeq.name}</p>
              <p className="text-xs text-muted-foreground">{activeSeq.objective}</p>
              <div className="space-y-2">
                {activeSeq.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                    <span className="text-xs font-bold text-muted-foreground mt-0.5 w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{step.channel.replace("_mock", "")}</Badge>
                        <span className="text-[10px] text-muted-foreground">{step.timing}</span>
                      </div>
                      <p className="text-xs mt-1">{step.copy}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{step.objective}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => { navigator.clipboard.writeText(step.copy); toast.success("Copiado"); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva campaña</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Nurturing Meta Leads" /></div>
            <div><Label>Objetivo</Label>
              <Select value={form.objective} onValueChange={v => setForm(f => ({...f, objective: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BUILDER_OBJECTIVES.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Secuencia</Label>
              <Select value={form.sequence_id} onValueChange={v => setForm(f => ({...f, sequence_id: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEQUENCES.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Segmento de audiencia</Label><Input value={form.audience_segment} onChange={e => setForm(f => ({...f, audience_segment: e.target.value}))} placeholder="Warm · desarrollo X" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button onClick={() => saveCampaign.mutate()} disabled={saveCampaign.isPending || !form.name}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===================================================================
// CrmAiCopilot
// ===================================================================
type ChatMsg = { role: "user" | "assistant"; text: string };

const QUICK_ACTIONS: { label: string; kind: MessageKind; icon: typeof Sparkles }[] = [
  { label: "Re-engagement", kind: "reactivation", icon: RefreshCw },
  { label: "Follow-up", kind: "email_followup", icon: Send },
  { label: "Intro apertura", kind: "whatsapp_new_lead", icon: Sparkles },
  { label: "Confirmación cita", kind: "appointment_reminder", icon: CheckCircle2 },
];

const MOCK_CONTACT = {
  full_name: "Andrea Robles", email: "andrea@example.com", phone: "5512345678",
  source_platform: "meta_ads", buying_intent: "high", budget_range: "medium",
  development_id: "altea-norte", last_contacted_at: new Date(Date.now() - 5 * 86400_000).toISOString(),
};

export function CrmAiCopilot() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", text: "Hola! Soy tu copiloto de ventas. Selecciona una acción rápida o escribe una instrucción para generar un mensaje." },
  ]);
  const [input, setInput] = useState("");
  const [contact, setContact] = useState(MOCK_CONTACT.full_name);
  const [generating, setGenerating] = useState(false);

  const generate = (kind: MessageKind) => {
    setGenerating(true);
    const msg = generateMessage(kind, { contact_name: MOCK_CONTACT.full_name });
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: "user", text: `Generar mensaje: ${kind}` },
        { role: "assistant", text: msg.subject ? `${msg.subject}\n\n${msg.body}` : msg.body },
      ]);
      setGenerating(false);
    }, 600);
  };

  const sendCustom = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setGenerating(true);
    setTimeout(() => {
      const reply = generateMessage("email_followup", { contact_name: MOCK_CONTACT.full_name });
      setMessages(prev => [...prev, { role: "assistant", text: `[Basado en tu instrucción: "${userMsg}"]\n\n${reply.subject ? reply.subject + "\n\n" : ""}${reply.body}` }]);
      setGenerating(false);
    }, 800);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Copiloto IA" subtitle="Asistente para redacción de mensajes y sugerencias de acción">
        <MockBadge />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3 min-h-[360px] max-h-[480px] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && <Bot className="w-5 h-5 mt-1 text-primary shrink-0" />}
                <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                  {m.text}
                  {m.role === "assistant" && (
                    <button className="block mt-1 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => { navigator.clipboard.writeText(m.text); toast.success("Copiado"); }}>
                      <Copy className="w-3 h-3 inline mr-0.5" />Copiar
                    </button>
                  )}
                </div>
              </div>
            ))}
            {generating && (
              <div className="flex gap-2">
                <Bot className="w-5 h-5 mt-1 text-primary shrink-0" />
                <div className="bg-background border rounded-lg px-3 py-2 text-sm text-muted-foreground">Generando...</div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe una instrucción para el copiloto..."
              onKeyDown={e => e.key === "Enter" && sendCustom()} />
            <Button onClick={sendCustom} disabled={!input.trim() || generating}><Send className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Acciones rápidas</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map(a => {
                const Icon = a.icon;
                return (
                  <Button key={a.kind} size="sm" variant="outline" className="h-auto py-2 flex-col gap-1"
                    onClick={() => generate(a.kind)} disabled={generating}>
                    <Icon className="w-4 h-4" />
                    <span className="text-xs">{a.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-2">Sugerencias para próxima acción</p>
            <div className="space-y-1.5">
              {[
                { action: "Llamar a Andrea Robles", reason: "5 días sin contacto · alta intención", icon: Phone },
                { action: "Enviar brochure Altea", reason: "Solicitó info · no respondió", icon: Send },
                { action: "Agendar visita a obra", reason: "Cita pendiente hace 3 días", icon: ListChecks },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-md border bg-muted/30">
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-medium">{s.action}</p>
                      <p className="text-[10px] text-muted-foreground">{s.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-2">Contacto activo (mock)</p>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p><span className="font-medium text-foreground">{MOCK_CONTACT.full_name}</span></p>
              <p>Intención: <span className="font-medium text-amber-600 dark:text-amber-400">{MOCK_CONTACT.buying_intent}</span></p>
              <p>Fuente: {MOCK_CONTACT.source_platform}</p>
              <p>Último contacto: 5 días</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// CrmOperationsDevelopments
// ===================================================================
type DevOps = {
  id: string; name: string; location: string; status: "available" | "limited" | "sold_out";
  units_available: number; units_total: number; price_from: number; price_to: number;
  active_deals: number; last_deal_at: string | null;
};

const DEV_OPS_MOCK: DevOps[] = [
  { id: "dev1", name: "Altea Norte", location: "Monterrey, NL", status: "available", units_available: 24, units_total: 60, price_from: 1_800_000, price_to: 3_200_000, active_deals: 7, last_deal_at: new Date(Date.now() - 2 * 86400_000).toISOString() },
  { id: "dev2", name: "Vivenza", location: "San Pedro Garza García, NL", status: "limited", units_available: 4, units_total: 48, price_from: 2_400_000, price_to: 4_100_000, active_deals: 12, last_deal_at: new Date(Date.now() - 1 * 86400_000).toISOString() },
  { id: "dev3", name: "Meridian Tower", location: "CDMX, CDMX", status: "sold_out", units_available: 0, units_total: 36, price_from: 3_100_000, price_to: 5_800_000, active_deals: 0, last_deal_at: new Date(Date.now() - 14 * 86400_000).toISOString() },
  { id: "dev4", name: "Paseo Colinas", location: "Guadalajara, JAL", status: "available", units_available: 18, units_total: 40, price_from: 1_600_000, price_to: 2_800_000, active_deals: 4, last_deal_at: new Date(Date.now() - 3 * 86400_000).toISOString() },
];

const DEV_STATUS_TONE: Record<DevOps["status"], string> = {
  available: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  limited: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  sold_out: "bg-muted text-muted-foreground",
};
const DEV_STATUS_LABEL: Record<DevOps["status"], string> = {
  available: "Disponible", limited: "Limitado", sold_out: "Agotado",
};

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

export function CrmOperationsDevelopments() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const filtered = useMemo(() => DEV_OPS_MOCK.filter(d => {
    if (statusFilter !== "todos" && d.status !== statusFilter) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.location.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [search, statusFilter]);

  return (
    <div className="space-y-4">
      <PageHeader title="Desarrollos" subtitle="Vista de desarrollos disponibles para asignar a deals">
        <MockBadge />
      </PageHeader>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar desarrollo..." className="h-9 pl-7" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="available">Disponible</SelectItem>
            <SelectItem value="limited">Limitado</SelectItem>
            <SelectItem value="sold_out">Agotado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {filtered.map(d => {
          const pct = d.units_total > 0 ? (d.units_total - d.units_available) / d.units_total : 1;
          return (
            <Card key={d.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold leading-tight">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.location}</p>
                </div>
                <Badge className={`text-[10px] shrink-0 ${DEV_STATUS_TONE[d.status]}`}>{DEV_STATUS_LABEL[d.status]}</Badge>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Disponibles</span>
                  <span className="font-medium">{d.units_available} / {d.units_total}</span>
                </div>
                <Progress value={pct * 100} className="h-1.5" />
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Precio desde</span><span className="font-medium text-foreground">{fmtMXN(d.price_from)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Precio hasta</span><span className="font-medium text-foreground">{fmtMXN(d.price_to)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deals activos</span><span className="font-medium text-foreground">{d.active_deals}</span>
                </div>
                {d.last_deal_at && (
                  <div className="flex justify-between">
                    <span>Último deal</span><span>{relTime(d.last_deal_at)}</span>
                  </div>
                )}
              </div>

              <Button size="sm" variant="outline" className="w-full h-8 text-xs"
                disabled={d.status === "sold_out"}
                onClick={() => toast.info(`Asignar deal · ${d.name} (mock)`)}>
                <Layers className="w-3 h-3 mr-1.5" />
                {d.status === "sold_out" ? "Sin disponibilidad" : "Asignar a deal"}
              </Button>
            </Card>
          );
        })}
      </div>

      <Panel title="Resumen por desarrollo">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Desarrollo</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Disponibles</TableHead>
            <TableHead className="text-right">Deals activos</TableHead>
            <TableHead className="text-right">Último deal</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {DEV_OPS_MOCK.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{d.location}</TableCell>
                <TableCell><Badge className={`text-[10px] ${DEV_STATUS_TONE[d.status]}`}>{DEV_STATUS_LABEL[d.status]}</Badge></TableCell>
                <TableCell className="text-right">{d.units_available}/{d.units_total}</TableCell>
                <TableCell className="text-right">{d.active_deals}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{d.last_deal_at ? relTime(d.last_deal_at) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}