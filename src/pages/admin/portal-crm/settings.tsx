import { useMemo, useState } from "react";
import {
  Users as UsersIcon, ShieldCheck, GitBranch, FormInput, Webhook,
  Plug, FileClock, CheckCircle2, AlertTriangle, Plus, Search, Copy,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, MockBadge, Panel } from "@/components/admin/portal-crm/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { relTime } from "@/data/portal-crm/mockData";

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

// ===================================================================
// 1) Usuarios CRM
// ===================================================================
interface CrmUser {
  id: string; name: string; email: string; role: string;
  team: string; status: "active" | "invited" | "disabled"; last_seen: string;
}
const USERS: CrmUser[] = [
  { id: "u1", name: "Miguel Castro",  email: "miguel@sozu.com",  role: "Admin CRM", team: "Comercial MX", status: "active",   last_seen: minsAgo(5)   },
  { id: "u2", name: "Karla Ríos",     email: "karla@sozu.com",   role: "Manager",   team: "Comercial MX", status: "active",   last_seen: minsAgo(38)  },
  { id: "u3", name: "Paola Téllez",   email: "paola@sozu.com",   role: "Agente",    team: "Closers",      status: "active",   last_seen: hoursAgo(2)  },
  { id: "u4", name: "Diego Ortiz",    email: "diego@sozu.com",   role: "Agente",    team: "Comercial MX", status: "invited",  last_seen: daysAgo(1)   },
  { id: "u5", name: "Andrea Robles",  email: "andrea@sozu.com",  role: "Marketing", team: "Growth",       status: "active",   last_seen: hoursAgo(6)  },
  { id: "u6", name: "Luis Romero",    email: "luis@sozu.com",    role: "Agente",    team: "Closers",      status: "disabled", last_seen: daysAgo(22)  },
];

const statusTone = (s: CrmUser["status"]) =>
  s === "active"   ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  : s === "invited"? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
  :                  "bg-muted text-muted-foreground";

export function CrmSettingsUsers() {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => USERS.filter(u => (u.name + u.email + u.role).toLowerCase().includes(q.toLowerCase())),
    [q]
  );
  return (
    <div>
      <PageHeader
        title="Usuarios CRM"
        description="Personas con acceso al portal CRM Sozu."
        actions={
          <>
            <MockBadge />
            <Button size="sm" onClick={() => toast.info("Invitar usuario (mock)")}>
              <Plus className="h-4 w-4 mr-1" /> Invitar
            </Button>
          </>
        }
      />
      <Panel>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuario…" className="pl-8 h-9" />
          </div>
          <Badge variant="secondary">{filtered.length} usuarios</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Equipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Última actividad</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell className="text-muted-foreground">{u.team}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={"border-transparent " + statusTone(u.status)}>
                    {u.status === "active" ? "Activo" : u.status === "invited" ? "Invitado" : "Desactivado"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{relTime(u.last_seen)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => toast.info(`Editar ${u.name} (mock)`)}>Editar</Button>
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
// 2) Roles y permisos CRM
// ===================================================================
const PERMS = [
  "Ver contactos", "Editar contactos", "Eliminar contactos",
  "Ver pipeline", "Mover deals", "Cerrar deals",
  "Ver reportes", "Configurar CRM", "Administrar usuarios",
];
const ROLES = [
  { name: "Admin CRM", users: 2, perms: PERMS },
  { name: "Manager",   users: 4, perms: PERMS.filter((_, i) => i !== 8) },
  { name: "Agente",    users: 18, perms: ["Ver contactos","Editar contactos","Ver pipeline","Mover deals","Cerrar deals"] },
  { name: "Marketing", users: 5, perms: ["Ver contactos","Ver pipeline","Ver reportes"] },
  { name: "Solo lectura", users: 3, perms: ["Ver contactos","Ver pipeline","Ver reportes"] },
];

export function CrmSettingsRoles() {
  return (
    <div>
      <PageHeader
        title="Roles y permisos CRM"
        description="Define qué puede hacer cada rol dentro del portal CRM."
        actions={<><MockBadge /><Button size="sm" onClick={() => toast.info("Nuevo rol (mock)")}><Plus className="h-4 w-4 mr-1" /> Nuevo rol</Button></>}
      />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rol</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead>Permisos otorgados</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROLES.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="secondary">{r.users}</Badge></TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.perms.slice(0, 5).map((p) => (
                      <Badge key={p} variant="outline" className="font-normal">{p}</Badge>
                    ))}
                    {r.perms.length > 5 && (
                      <Badge variant="outline" className="font-normal">+{r.perms.length - 5}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => toast.info(`Editar rol ${r.name} (mock)`)}>Editar</Button>
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
// 3) Etapas del pipeline
// ===================================================================
const STAGES = [
  { id: "s1", name: "Nuevo lead",        prob: 5,  color: "bg-slate-400",   deals: 124 },
  { id: "s2", name: "Contactado",        prob: 15, color: "bg-blue-400",    deals: 86  },
  { id: "s3", name: "Calificado",        prob: 30, color: "bg-cyan-400",    deals: 52  },
  { id: "s4", name: "Cita agendada",     prob: 45, color: "bg-violet-400",  deals: 38  },
  { id: "s5", name: "Propuesta",         prob: 60, color: "bg-amber-400",   deals: 21  },
  { id: "s6", name: "Negociación",       prob: 75, color: "bg-orange-400",  deals: 14  },
  { id: "s7", name: "Apartado",          prob: 90, color: "bg-emerald-400", deals: 9   },
  { id: "s8", name: "Cerrado ganado",    prob: 100,color: "bg-emerald-600", deals: 47  },
  { id: "s9", name: "Cerrado perdido",   prob: 0,  color: "bg-rose-400",    deals: 63  },
];

export function CrmSettingsPipelineStages() {
  return (
    <div>
      <PageHeader
        title="Etapas del pipeline"
        description="Configura las etapas del funnel comercial y su probabilidad de cierre."
        actions={<><MockBadge /><Button size="sm" onClick={() => toast.info("Nueva etapa (mock)")}><Plus className="h-4 w-4 mr-1" /> Nueva etapa</Button></>}
      />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Probabilidad</TableHead>
              <TableHead>Deals activos</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STAGES.map((s, i) => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={"h-2.5 w-2.5 rounded-full " + s.color} />
                    <span className="font-medium">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell>{s.prob}%</TableCell>
                <TableCell><Badge variant="secondary">{s.deals}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => toast.info(`Editar ${s.name} (mock)`)}>Editar</Button>
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
// 4) Campos personalizados
// ===================================================================
const FIELDS = [
  { id: "f1", entity: "Contacto", label: "Presupuesto aprobado", key: "presupuesto_aprobado", type: "currency", required: true,  active: true },
  { id: "f2", entity: "Contacto", label: "Fuente original",      key: "fuente_original",      type: "select",   required: false, active: true },
  { id: "f3", entity: "Deal",     label: "Modelo de interés",    key: "modelo_interes",       type: "text",     required: false, active: true },
  { id: "f4", entity: "Deal",     label: "Plazo (meses)",        key: "plazo_meses",          type: "number",   required: false, active: true },
  { id: "f5", entity: "Cita",     label: "Tipo de visita",       key: "tipo_visita",          type: "select",   required: true,  active: true },
  { id: "f6", entity: "Contacto", label: "Score IA",             key: "score_ia",             type: "number",   required: false, active: false },
];

export function CrmSettingsCustomFields() {
  return (
    <div>
      <PageHeader
        title="Campos personalizados"
        description="Extiende el modelo de datos del CRM con campos a la medida."
        actions={<><MockBadge /><Button size="sm" onClick={() => toast.info("Nuevo campo (mock)")}><Plus className="h-4 w-4 mr-1" /> Nuevo campo</Button></>}
      />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entidad</TableHead>
              <TableHead>Etiqueta</TableHead>
              <TableHead>Clave</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Requerido</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FIELDS.map((f) => (
              <TableRow key={f.id}>
                <TableCell><Badge variant="outline">{f.entity}</Badge></TableCell>
                <TableCell className="font-medium">{f.label}</TableCell>
                <TableCell><code className="text-xs text-muted-foreground">{f.key}</code></TableCell>
                <TableCell className="text-muted-foreground">{f.type}</TableCell>
                <TableCell>{f.required ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell><Switch checked={f.active} onCheckedChange={() => toast.info(`Toggle ${f.key} (mock)`)} /></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => toast.info(`Editar ${f.key} (mock)`)}>Editar</Button>
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
// 5) Webhooks
// ===================================================================
const HOOKS = [
  { id: "h1", name: "Sync N8N · nuevos leads",      url: "https://n8n.sozu.com/webhook/lead-created",     events: ["lead.created"],                            status: "ok",   last: minsAgo(7)  },
  { id: "h2", name: "Slack · alertas SLA",          url: "https://hooks.slack.com/services/T0/B0/XXXX",   events: ["sla.breached"],                            status: "ok",   last: minsAgo(42) },
  { id: "h3", name: "Postventa · ticket creado",    url: "https://n8n.sozu.com/webhook/ticket-created",   events: ["ticket.created","ticket.updated"],         status: "fail", last: hoursAgo(3) },
  { id: "h4", name: "BI · deals cerrados",          url: "https://bi.sozu.com/ingest/deals",              events: ["deal.won","deal.lost"],                    status: "ok",   last: hoursAgo(1) },
];

export function CrmSettingsWebhooks() {
  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Notifica eventos del CRM a sistemas externos."
        actions={<><MockBadge /><Button size="sm" onClick={() => toast.info("Nuevo webhook (mock)")}><Plus className="h-4 w-4 mr-1" /> Nuevo webhook</Button></>}
      />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Eventos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último envío</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {HOOKS.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">{h.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 max-w-[320px]">
                    <code className="text-xs text-muted-foreground truncate">{h.url}</code>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { navigator.clipboard?.writeText(h.url); toast.success("URL copiada"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {h.events.map((e) => <Badge key={e} variant="outline" className="font-mono text-[10px]">{e}</Badge>)}
                  </div>
                </TableCell>
                <TableCell>
                  {h.status === "ok"
                    ? <Badge variant="outline" className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>
                    : <Badge variant="outline" className="border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300"><AlertTriangle className="h-3 w-3 mr-1" />Falla</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{relTime(h.last)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => toast.info(`Probar ${h.name} (mock)`)}>Probar</Button>
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
// 6 & 7) OAuth callbacks (placeholder pages)
// ===================================================================
function OAuthCallback({ provider }: { provider: "Google" | "Meta" }) {
  return (
    <div>
      <PageHeader
        title={`Callback OAuth · ${provider}`}
        description={`Endpoint de retorno para la autorización OAuth de ${provider}.`}
        actions={<MockBadge />}
      />
      <Panel>
        <div className="flex flex-col items-center text-center py-10 gap-3">
          <div className="h-12 w-12 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
            <Plug className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Conexión con {provider} establecida</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Esta vista se invoca al completar el flujo OAuth de {provider}.
            En esta versión mock no se procesa ningún token: el endpoint queda registrado
            para que las integraciones reales puedan redirigir aquí.
          </p>
          <Button size="sm" variant="outline" onClick={() => toast.info("Cerrar ventana (mock)")}>
            Volver al CRM
          </Button>
        </div>
      </Panel>
    </div>
  );
}
export function CrmSettingsGoogleCallback() { return <OAuthCallback provider="Google" />; }
export function CrmSettingsMetaCallback()   { return <OAuthCallback provider="Meta" />; }

// ===================================================================
// 8) Log de auditoría
// ===================================================================
const AUDIT = [
  { id: "a1", at: minsAgo(3),   actor: "miguel@sozu.com", action: "user.invited",      target: "diego@sozu.com",       ip: "189.203.10.4"  },
  { id: "a2", at: minsAgo(28),  actor: "karla@sozu.com",  action: "deal.stage.moved",  target: "Deal #4821 → Cerrado", ip: "189.203.10.78" },
  { id: "a3", at: hoursAgo(1),  actor: "system",          action: "webhook.delivered", target: "Sync N8N · nuevos leads", ip: "—"          },
  { id: "a4", at: hoursAgo(3),  actor: "miguel@sozu.com", action: "role.updated",      target: "Agente",                ip: "189.203.10.4" },
  { id: "a5", at: hoursAgo(6),  actor: "andrea@sozu.com", action: "custom_field.created", target: "score_ia",           ip: "201.144.7.22" },
  { id: "a6", at: daysAgo(1),   actor: "system",          action: "webhook.failed",    target: "Postventa · ticket",    ip: "—"            },
  { id: "a7", at: daysAgo(2),   actor: "miguel@sozu.com", action: "user.disabled",     target: "luis@sozu.com",         ip: "189.203.10.4" },
];

const actionTone = (a: string) =>
  a.includes("failed") || a.includes("disabled") ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
  : a.includes("delivered") || a.includes("moved") || a.includes("created") ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  : "bg-blue-500/15 text-blue-700 dark:text-blue-300";

export function CrmSettingsAuditLog() {
  const [filter, setFilter] = useState<string>("all");
  const filtered = useMemo(
    () => filter === "all" ? AUDIT : AUDIT.filter(a => a.action.startsWith(filter)),
    [filter]
  );
  return (
    <div>
      <PageHeader
        title="Log de auditoría"
        description="Trazabilidad de acciones críticas dentro del CRM."
        actions={<MockBadge />}
      />
      <Panel>
        <div className="flex items-center gap-2 mb-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Filtrar acción" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              <SelectItem value="user">user.*</SelectItem>
              <SelectItem value="deal">deal.*</SelectItem>
              <SelectItem value="webhook">webhook.*</SelectItem>
              <SelectItem value="role">role.*</SelectItem>
              <SelectItem value="custom_field">custom_field.*</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{filtered.length} eventos</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuándo</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-muted-foreground">{relTime(a.at)}</TableCell>
                <TableCell className="font-medium">{a.actor}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={"border-transparent font-mono text-[10px] " + actionTone(a.action)}>
                    {a.action}
                  </Badge>
                </TableCell>
                <TableCell>{a.target}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{a.ip}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}