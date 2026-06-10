import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Bot, Check, ChevronRight, Filter as FilterIcon, ListTodo, Mail,
  Phone, Plus, Search, Sparkles, Star, Workflow, Zap, Calendar, AlertTriangle,
  TrendingUp, Activity, Users, Briefcase, Clock,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, MockBadge, Panel } from "@/components/admin/portal-crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  MOCK_CONTACTS_FULL, MOCK_DEALS, MOCK_APPOINTMENTS, MOCK_TASKS,
  MOCK_SEQUENCES, MOCK_ROUTING_RULES, MOCK_AUTOMATION_RULES, MOCK_ESCALATIONS,
  MOCK_LEAD_INTEL, MOCK_AGENT_PERF, MOCK_SALES_OPS, MOCK_CONTACT_ATTRIBUTION,
  DEAL_STAGES, DEVELOPMENTS, CRM_OWNERS, LEAD_STATUS_LABEL, LIFECYCLE_LABEL,
  APPT_STATUS_LABEL, APPT_TYPE_LABEL,
  contactById, ownerName, developmentName, leadScoreColor,
  fmtDateTime, fmtMXN, fmtNum, relTime,
  type CrmContactFull, type CrmDeal, type CrmTask,
} from "@/data/portal-crm/mockData";

// ============================================================
// 1. Contactos · lista
// ============================================================
export function CrmContacts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "mine" | "unassigned" | "no_followup">("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterDev, setFilterDev] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStage, setFilterStage] = useState("all");

  const rows = useMemo(() => {
    let r: CrmContactFull[] = MOCK_CONTACTS_FULL;
    if (view === "mine") r = r.filter((c) => c.contact_owner === "u1");
    if (view === "unassigned") r = r.filter((c) => !c.contact_owner);
    if (view === "no_followup") r = r.filter((c) => !c.next_task_at);
    if (filterOwner !== "all") r = r.filter((c) => (filterOwner === "none" ? !c.contact_owner : c.contact_owner === filterOwner));
    if (filterDev !== "all") r = r.filter((c) => c.development_id === filterDev);
    if (filterStatus !== "all") r = r.filter((c) => c.lead_status === filterStatus);
    if (filterStage !== "all") r = r.filter((c) => c.lifecycle_stage === filterStage);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((c) =>
        c.full_name.toLowerCase().includes(s) ||
        (c.email ?? "").toLowerCase().includes(s) ||
        (c.phone ?? "").includes(s)
      );
    }
    return r;
  }, [view, search, filterOwner, filterDev, filterStatus, filterStage]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contactos"
        description="CRM tipo HubSpot · filtros, vistas y segmentación"
        actions={
          <div className="flex items-center gap-2">
            <MockBadge />
            <Button size="sm" onClick={() => toast.success("Contacto creado (mock)")}>
              <Plus className="h-4 w-4 mr-1" />Nuevo contacto
            </Button>
          </div>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="mine">Mis contactos</TabsTrigger>
          <TabsTrigger value="unassigned">Sin asignar</TabsTrigger>
          <TabsTrigger value="no_followup">Sin seguimiento</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre, email o teléfono…" className="pl-8" />
        </div>
        <FilterIcon className="h-4 w-4 text-muted-foreground hidden md:block" />
        <FilterSel value={filterOwner} onChange={setFilterOwner} placeholder="Propietario"
          opts={[{ v: "all", l: "Propietario: todos" }, { v: "none", l: "Sin asignar" }, ...CRM_OWNERS.map((o) => ({ v: o.id, l: o.name }))]} />
        <FilterSel value={filterDev} onChange={setFilterDev} placeholder="Desarrollo"
          opts={[{ v: "all", l: "Desarrollo: todos" }, ...DEVELOPMENTS.map((d) => ({ v: d.id, l: d.name }))]} />
        <FilterSel value={filterStatus} onChange={setFilterStatus} placeholder="Estado"
          opts={[{ v: "all", l: "Estado: todos" }, ...Object.entries(LEAD_STATUS_LABEL).map(([v, l]) => ({ v, l }))]} />
        <FilterSel value={filterStage} onChange={setFilterStage} placeholder="Lifecycle"
          opts={[{ v: "all", l: "Lifecycle: todos" }, ...Object.entries(LIFECYCLE_LABEL).map(([v, l]) => ({ v, l }))]} />
      </div>

      <div className="rounded-md border bg-card">
        {!rows.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Sin contactos en este filtro.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Desarrollo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Lifecycle</TableHead>
                <TableHead className="hidden xl:table-cell">Fuente</TableHead>
                <TableHead className="hidden lg:table-cell">Propietario</TableHead>
                <TableHead className="hidden md:table-cell">Última actividad</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/admin/portal-crm/crm/contacts/${c.id}`)}
                >
                  <TableCell className="font-medium text-primary">{c.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{developmentName(c.development_id)}</TableCell>
                  <TableCell><Badge variant="outline">{LEAD_STATUS_LABEL[c.lead_status] ?? c.lead_status}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell">{LIFECYCLE_LABEL[c.lifecycle_stage] ?? c.lifecycle_stage}</TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground">{c.source_platform ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{ownerName(c.contact_owner)}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{relTime(c.last_activity_at ?? c.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${leadScoreColor(c.lead_score)}`}>{c.lead_score}</span>
                  </TableCell>
                  <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{rows.length} contactos · datos simulados</p>
    </div>
  );
}

function FilterSel({ value, onChange, placeholder, opts }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  opts: { v: string; l: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{opts.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

// ============================================================
// 2. Contacto · detalle
// ============================================================
export function CrmContactDetail() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const c = contactId ? contactById(contactId) : undefined;
  const attrib = MOCK_CONTACT_ATTRIBUTION.find((a) => a.contact_id === contactId);
  const deals = MOCK_DEALS.filter((d) => d.contact_id === contactId);
  const appts = MOCK_APPOINTMENTS.filter((a) => a.contact_id === contactId);
  const tasks = MOCK_TASKS.filter((t) => t.contact_id === contactId);

  if (!c) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Volver</Button>
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Contacto no encontrado.</CardContent></Card>
      </div>
    );
  }

  const initials = c.full_name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/portal-crm/crm/contacts")}>
        <ArrowLeft className="h-4 w-4 mr-1" />Volver a contactos
      </Button>

      <Card>
        <CardContent className="p-4 flex items-start gap-4 flex-wrap">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{c.full_name}</h2>
              <Badge variant="outline">{LEAD_STATUS_LABEL[c.lead_status]}</Badge>
              <Badge variant="outline">{LIFECYCLE_LABEL[c.lifecycle_stage]}</Badge>
              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${leadScoreColor(c.lead_score)}`}>Score {c.lead_score}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-4 flex-wrap">
              <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{c.email ?? "—"}</span>
              <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{c.phone ?? "—"}</span>
              <span>· {developmentName(c.development_id)}</span>
              <span>· {ownerName(c.contact_owner)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toast.success("Llamada registrada")}><Phone className="h-3.5 w-3.5 mr-1" />Llamar</Button>
            <Button size="sm" variant="outline" onClick={() => toast.success("Email enviado")}><Mail className="h-3.5 w-3.5 mr-1" />Email</Button>
            <Button size="sm" onClick={() => toast.success("Tarea creada")}><ListTodo className="h-3.5 w-3.5 mr-1" />Tarea</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Atribución" description="First-touch">
          <dl className="text-sm space-y-1.5">
            <Row k="Fuente" v={attrib?.first_touch_source ?? "—"} />
            <Row k="Medio" v={attrib?.first_touch_medium ?? "—"} />
            <Row k="Campaña" v={attrib?.first_touch_campaign ?? "—"} />
            <Row k="fbclid" v={attrib?.fbclid ?? "—"} />
            <Row k="gclid" v={attrib?.gclid ?? "—"} />
          </dl>
        </Panel>
        <Panel title="Deals" description={`${deals.length} relacionados`}>
          {deals.length ? (
            <ul className="text-sm space-y-2">
              {deals.map((d) => (
                <li key={d.id} className="flex items-center justify-between">
                  <span className="truncate">{DEAL_STAGES.find((s) => s.id === d.deal_stage)?.label}</span>
                  <span className="font-medium">{fmtMXN(d.value)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Sin deals.</p>}
        </Panel>
        <Panel title="Citas" description={`${appts.length} programadas`}>
          {appts.length ? (
            <ul className="text-sm space-y-2">
              {appts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{APPT_TYPE_LABEL[a.appointment_type]}</span>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(a.scheduled_at)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Sin citas.</p>}
        </Panel>
      </div>

      <Panel title="Tareas pendientes">
        {tasks.length ? (
          <ul className="text-sm divide-y">
            {tasks.map((t) => (
              <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                <span>{t.title}</span>
                <Badge variant={t.status === "overdue" ? "destructive" : "outline"}>{t.status}</Badge>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Sin tareas.</p>}
      </Panel>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="font-mono text-xs truncate max-w-[180px]" title={v}>{v}</dd>
    </div>
  );
}

// ============================================================
// 3. Pipeline Kanban
// ============================================================
export function CrmDeals() {
  const [devFilter, setDevFilter] = useState("all");

  const filtered = useMemo(() =>
    devFilter === "all" ? MOCK_DEALS : MOCK_DEALS.filter((d) => d.development_id === devFilter)
  , [devFilter]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline Kanban"
        description="Deals por etapa · arrastrar (mock) dispara conversion_event"
        actions={
          <div className="flex items-center gap-2">
            <MockBadge />
            <Select value={devFilter} onValueChange={setDevFilter}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Desarrollo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los desarrollos</SelectItem>
                {DEVELOPMENTS.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {DEAL_STAGES.map((s) => {
          const ds = filtered.filter((d) => d.deal_stage === s.id);
          const total = ds.reduce((x, d) => x + d.value, 0);
          return (
            <div key={s.id} className="w-72 shrink-0 rounded-md border bg-muted/30 p-2">
              <div className="flex items-center justify-between px-1 pb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.tone}`}>{s.label}</span>
                  <span className="text-xs text-muted-foreground">{ds.length}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{fmtMXN(total)}</span>
              </div>
              <div className="space-y-2 min-h-[80px]">
                {ds.map((d) => <DealCard key={d.id} deal={d} />)}
                {!ds.length && <div className="text-[11px] text-muted-foreground p-3 text-center">Sin deals</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: CrmDeal }) {
  const c = contactById(deal.contact_id);
  return (
    <Card className="p-2.5 cursor-grab">
      <div className="text-sm font-medium truncate">{c?.full_name ?? "Sin contacto"}</div>
      <div className="flex items-center justify-between mt-1.5">
        <Badge variant="outline" className="text-[10px] truncate max-w-[120px]">{developmentName(deal.development_id)}</Badge>
        <span className="text-xs font-medium">{fmtMXN(deal.value)}</span>
      </div>
    </Card>
  );
}

// ============================================================
// 4. Citas
// ============================================================
export function CrmAppointments() {
  const [view, setView] = useState<"upcoming" | "today" | "past" | "all">("upcoming");
  const rows = useMemo(() => {
    const now = Date.now();
    return MOCK_APPOINTMENTS.filter((a) => {
      const t = new Date(a.scheduled_at).getTime();
      if (view === "upcoming") return t >= now;
      if (view === "past") return t < now;
      if (view === "today") {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        return t >= d.getTime() && t < d.getTime() + 86400_000;
      }
      return true;
    });
  }, [view]);

  return (
    <div className="space-y-4">
      <PageHeader title="Citas" description="Agenda comercial · cambios disparan conversion_events" actions={<><MockBadge /><Button size="sm" onClick={() => toast.success("Cita creada (mock)")}><Plus className="h-4 w-4 mr-1" />Nueva cita</Button></>} />
      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="upcoming">Próximas</TabsTrigger>
          <TabsTrigger value="today">Hoy</TabsTrigger>
          <TabsTrigger value="past">Pasadas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>
      {!rows.length ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Sin citas en esta vista.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => {
            const c = contactById(a.contact_id);
            return (
              <Card key={a.id}>
                <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm font-medium">{APPT_TYPE_LABEL[a.appointment_type]}</div>
                    <div className="text-xs text-muted-foreground flex gap-2 flex-wrap mt-0.5">
                      <span><Calendar className="h-3 w-3 inline mr-1" />{fmtDateTime(a.scheduled_at)}</span>
                      {c && <Link to={`/admin/portal-crm/crm/contacts/${c.id}`} className="hover:underline text-primary">{c.full_name}</Link>}
                      <span>· {developmentName(a.development_id)}</span>
                      <span>· {ownerName(a.assigned_to)}</span>
                    </div>
                  </div>
                  <Badge variant="outline">{APPT_STATUS_LABEL[a.status]}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 5. Tareas
// ============================================================
export function CrmTasks() {
  const [tab, setTab] = useState<"open" | "overdue" | "done" | "all">("open");
  const [tasks, setTasks] = useState<CrmTask[]>(MOCK_TASKS);
  const rows = tab === "all" ? tasks : tasks.filter((t) => t.status === tab);

  const toggle = (id: string) => {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, status: t.status === "done" ? "open" : "done" } : t));
    toast.success("Tarea actualizada");
  };

  const priorityTone = (p: string) => p === "high" ? "text-destructive" : p === "medium" ? "text-amber-600" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <PageHeader title="Tareas" description="Pendientes asignadas a propietarios de contactos y deals" actions={<><MockBadge /><Button size="sm" onClick={() => toast.success("Tarea creada")}><Plus className="h-4 w-4 mr-1" />Nueva tarea</Button></>} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="open">Abiertas</TabsTrigger>
          <TabsTrigger value="overdue">Vencidas</TabsTrigger>
          <TabsTrigger value="done">Completadas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Tarea</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const c = t.contact_id ? contactById(t.contact_id) : null;
              return (
                <TableRow key={t.id}>
                  <TableCell><button onClick={() => toggle(t.id)} className={`h-5 w-5 border rounded flex items-center justify-center ${t.status === "done" ? "bg-primary border-primary text-primary-foreground" : ""}`}>{t.status === "done" && <Check className="h-3 w-3" />}</button></TableCell>
                  <TableCell className={`font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</TableCell>
                  <TableCell>{c?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{relTime(t.due_at)}</TableCell>
                  <TableCell className={priorityTone(t.priority)}>{t.priority}</TableCell>
                  <TableCell>{ownerName(t.owner_id)}</TableCell>
                  <TableCell><Badge variant={t.status === "overdue" ? "destructive" : t.status === "done" ? "secondary" : "outline"}>{t.status}</Badge></TableCell>
                </TableRow>
              );
            })}
            {!rows.length && (<TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sin tareas en esta vista.</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ============================================================
// 6. Secuencias
// ============================================================
export function CrmSequences() {
  const [seqs, setSeqs] = useState(MOCK_SEQUENCES);
  const toggle = (id: string) => {
    setSeqs((p) => p.map((s) => s.id === id ? { ...s, active: !s.active } : s));
    toast.success("Secuencia actualizada");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Secuencias" description="Cadencias email/WhatsApp para nurturing y enganche" actions={<><MockBadge /><Button size="sm" onClick={() => toast.success("Secuencia creada")}><Plus className="h-4 w-4 mr-1" />Nueva secuencia</Button></>} />
      <div className="grid gap-3 md:grid-cols-2">
        {seqs.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-primary" /><h3 className="font-semibold">{s.name}</h3></div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.steps} pasos · canal {s.channel}</div>
                </div>
                <Switch checked={s.active} onCheckedChange={() => toggle(s.id)} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-xs text-muted-foreground">Inscritos</div><div className="font-semibold">{fmtNum(s.enrolled)}</div></div>
                <div><div className="text-xs text-muted-foreground">Tasa respuesta</div><div className="font-semibold">{(s.reply_rate * 100).toFixed(1)}%</div></div>
                <div><div className="text-xs text-muted-foreground">Estado</div><div><Badge variant={s.active ? "default" : "secondary"}>{s.active ? "Activa" : "Pausada"}</Badge></div></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 7. Routing
// ============================================================
export function CrmRouting() {
  const [rules, setRules] = useState(MOCK_ROUTING_RULES);
  return (
    <div className="space-y-4">
      <PageHeader title="Routing de leads" description="Reglas de asignación automática por fuente, score y desarrollo" actions={<><MockBadge /><Button size="sm" onClick={() => toast.success("Regla creada")}><Plus className="h-4 w-4 mr-1" />Nueva regla</Button></>} />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prioridad</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Criterio</TableHead>
              <TableHead>Asignar a</TableHead>
              <TableHead className="text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.sort((a, b) => a.priority - b.priority).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.priority}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{r.criteria}</TableCell>
                <TableCell>{r.assign_to}</TableCell>
                <TableCell className="text-right">
                  <Switch checked={r.active} onCheckedChange={() => {
                    setRules((p) => p.map((x) => x.id === r.id ? { ...x, active: !x.active } : x));
                    toast.success("Regla actualizada");
                  }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ============================================================
// 8. Reglas de automatización
// ============================================================
export function CrmAutomationRules() {
  const [rules, setRules] = useState(MOCK_AUTOMATION_RULES);
  return (
    <div className="space-y-4">
      <PageHeader title="Reglas de automatización" description="If-this-then-that del CRM: enrolar secuencias, crear tareas, notificar." actions={<><MockBadge /><Button size="sm" onClick={() => toast.success("Regla creada")}><Plus className="h-4 w-4 mr-1" />Nueva regla</Button></>} />
      <div className="grid gap-3 md:grid-cols-2">
        {rules.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /><h3 className="font-semibold">{r.name}</h3></div>
                <Switch checked={r.active} onCheckedChange={() => {
                  setRules((p) => p.map((x) => x.id === r.id ? { ...x, active: !x.active } : x));
                  toast.success("Regla actualizada");
                }} />
              </div>
              <dl className="text-sm space-y-1">
                <div className="flex gap-2"><dt className="text-muted-foreground w-16 shrink-0">Trigger</dt><dd>{r.trigger}</dd></div>
                <div className="flex gap-2"><dt className="text-muted-foreground w-16 shrink-0">Acción</dt><dd>{r.action}</dd></div>
              </dl>
              <div className="text-xs text-muted-foreground border-t pt-2">{fmtNum(r.runs_30d)} ejecuciones últimos 30d</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 9. Escalaciones
// ============================================================
export function CrmEscalations() {
  const [tab, setTab] = useState<"open" | "resolved" | "all">("open");
  const rows = tab === "all" ? MOCK_ESCALATIONS : MOCK_ESCALATIONS.filter((e) => e.status === tab);

  return (
    <div className="space-y-4">
      <PageHeader title="Escalaciones" description="Casos donde el SLA o las reglas dispararon una alerta de gestión" actions={<MockBadge />} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="open">Abiertas</TabsTrigger>
          <TabsTrigger value="resolved">Resueltas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>
      {!rows.length ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Sin escalaciones.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => {
            const c = contactById(e.contact_id);
            return (
              <Card key={e.id}>
                <CardContent className="p-3 flex items-start gap-3 flex-wrap">
                  <div className={`mt-0.5 rounded p-1.5 ${e.severity === "critical" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{e.reason}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{e.severity}</Badge>
                      <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {c ? <Link to={`/admin/portal-crm/crm/contacts/${c.id}`} className="text-primary hover:underline">{c.full_name}</Link> : "—"} · {ownerName(e.assigned_to)} · {e.age_hours}h abierta · {relTime(e.created_at)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toast.success("Escalación reasignada")}>Reasignar</Button>
                    {e.status === "open" && <Button size="sm" onClick={() => toast.success("Marcada resuelta")}><Check className="h-3.5 w-3.5 mr-1" />Resolver</Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 10. Lead Intelligence
// ============================================================
export function CrmLeadIntelligence() {
  return (
    <div className="space-y-4">
      <PageHeader title="Lead Intelligence" description="Scoring + señales + acción recomendada por copiloto" actions={<MockBadge />} />
      <div className="space-y-2">
        {MOCK_LEAD_INTEL.map((l) => (
          <Card key={l.contact_id}>
            <CardContent className="p-4 flex flex-wrap gap-4 items-start">
              <div className="flex items-center gap-3 min-w-[200px]">
                <Avatar className="h-10 w-10"><AvatarFallback>{l.full_name.split(" ").slice(0, 2).map((p) => p[0]).join("")}</AvatarFallback></Avatar>
                <div>
                  <Link to={`/admin/portal-crm/crm/contacts/${l.contact_id}`} className="font-medium text-primary hover:underline">{l.full_name}</Link>
                  <div className="text-xs flex items-center gap-1 mt-0.5">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${leadScoreColor(l.lead_score)}`}>Score {l.lead_score}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">Intent {l.intent}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-[280px]">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Señales</div>
                <div className="flex flex-wrap gap-1.5">
                  {l.signals.map((s, i) => <Badge key={i} variant="secondary" className="text-[10px]"><Sparkles className="h-3 w-3 mr-1" />{s}</Badge>)}
                </div>
                <div className="text-sm mt-2"><span className="text-muted-foreground">Acción recomendada:</span> {l.recommended_action}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => toast.info("Copiloto: analizando…")}><Bot className="h-3.5 w-3.5 mr-1" />Analizar</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 11. Agent performance
// ============================================================
export function CrmAgentPerformance() {
  const total = MOCK_AGENT_PERF.reduce((acc, a) => ({
    contacts: acc.contacts + a.contacts,
    deals_won: acc.deals_won + a.deals_won,
    pipeline: acc.pipeline + a.pipeline,
    revenue: acc.revenue + a.revenue_won,
  }), { contacts: 0, deals_won: 0, pipeline: 0, revenue: 0 });

  return (
    <div className="space-y-4">
      <PageHeader title="Performance de agentes" description="Métricas por propietario · contacto, citas, deals, revenue" actions={<MockBadge />} />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Kpi label="Contactos totales" value={fmtNum(total.contacts)} icon={Users} />
        <Kpi label="Deals ganados" value={String(total.deals_won)} icon={Briefcase} />
        <Kpi label="Pipeline" value={fmtMXN(total.pipeline)} icon={TrendingUp} />
        <Kpi label="Revenue ganado" value={fmtMXN(total.revenue)} icon={Star} />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agente</TableHead>
              <TableHead className="text-right">Contactos</TableHead>
              <TableHead className="text-right">Citas</TableHead>
              <TableHead className="text-right">Deals abiertos</TableHead>
              <TableHead className="text-right">Ganados</TableHead>
              <TableHead className="text-right">Pipeline</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Resp. (min)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_AGENT_PERF.map((a) => (
              <TableRow key={a.owner_id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="text-right">{a.contacts}</TableCell>
                <TableCell className="text-right">{a.appointments}</TableCell>
                <TableCell className="text-right">{a.deals_open}</TableCell>
                <TableCell className="text-right">{a.deals_won}</TableCell>
                <TableCell className="text-right">{fmtMXN(a.pipeline)}</TableCell>
                <TableCell className="text-right">{fmtMXN(a.revenue_won)}</TableCell>
                <TableCell className="text-right"><Badge variant={a.response_min < 15 ? "default" : a.response_min < 30 ? "secondary" : "destructive"}><Clock className="h-3 w-3 mr-1" />{a.response_min}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, hint }: { label: string; value: string; icon: any; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>{label}</span><Icon className="h-4 w-4" />
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// 12. Sales operations
// ============================================================
export function CrmSalesOperations() {
  const maxFunnel = Math.max(...MOCK_SALES_OPS.conversionFunnel.map((s) => s.value));
  return (
    <div className="space-y-4">
      <PageHeader title="Operaciones de ventas" description="KPIs, pipeline por etapa y funnel de conversión" actions={<MockBadge />} />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {MOCK_SALES_OPS.kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="text-2xl font-semibold mt-1">{k.value}</div>
              {k.hint && <div className="text-[11px] text-muted-foreground mt-1">{k.hint}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Pipeline por etapa">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Deals</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_SALES_OPS.pipelineByStage.map((s) => (
                <TableRow key={s.stage}>
                  <TableCell>{s.stage}</TableCell>
                  <TableCell className="text-right">{s.count}</TableCell>
                  <TableCell className="text-right font-medium">{fmtMXN(s.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel title="Funnel de conversión" description="Últimos 30 días">
          <ul className="space-y-2">
            {MOCK_SALES_OPS.conversionFunnel.map((s) => {
              const pct = (s.value / maxFunnel) * 100;
              return (
                <li key={s.step}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{s.step}</span>
                    <span className="font-medium">{fmtNum(s.value)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded">
                    <div className="h-2 bg-primary rounded" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Actividad reciente</CardTitle></CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2">
            <li className="flex justify-between"><span>Karla Ríos cerró deal en Vivenza</span><span className="text-muted-foreground">hace 2 h</span></li>
            <li className="flex justify-between"><span>Nueva regla de routing activada (score ≥ 80)</span><span className="text-muted-foreground">hace 5 h</span></li>
            <li className="flex justify-between"><span>Paola Téllez agendó 3 visitas en Reserva 360</span><span className="text-muted-foreground">hace 1 d</span></li>
            <li className="flex justify-between"><span>Secuencia "Re-enganche frío" alcanzó 34% reply</span><span className="text-muted-foreground">hace 2 d</span></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}