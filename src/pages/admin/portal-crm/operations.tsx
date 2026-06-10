import { useMemo, useState } from "react";
import {
  Inbox, Mail, MessageSquare, Phone, Users, Clock, AlertTriangle,
  CheckCircle2, Filter, ListChecks, Timer, Search,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, MockBadge, Panel } from "@/components/admin/portal-crm/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtNum, fmtPct, relTime } from "@/data/portal-crm/mockData";

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