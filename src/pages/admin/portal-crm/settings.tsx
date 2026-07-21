import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users as UsersIcon, ShieldCheck, GitBranch, FormInput, Webhook,
  Plug, FileClock, CheckCircle2, AlertTriangle, Plus, Search, Copy,
  RefreshCw, ExternalLink, Building2, Layers, Settings2, Globe, Clock,
  BarChart2, Key, Zap, Wifi, WifiOff, Edit2, Trash2, X, ChevronUp, ChevronDown,
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
import { Switch } from "@/components/ui/switch";
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
import {
  ConnectorStatus, ConnectorMode, STATUS_LABEL, STATUS_TONE, CATEGORY_LABEL,
  type Connector, redactSecret,
} from "@/lib/crm-integrations";
import { computeReadiness, validateDraft, type DraftPayload, DRAFT_STATUS_TONE } from "@/lib/crm-builder";

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

export function CrmSettingsPipelineStages() {
  const { data: pipelines } = usePipelinesList();
  const [sel, setSel] = useState<string>("");
  const selId = sel ? Number(sel) : (pipelines?.[0]?.id ?? null);
  return (
    <div>
      <PageHeader
        title="Etapas del pipeline"
        description="Cada pipeline tiene su propio embudo. Elige un pipeline para configurar sus etapas."
      />
      <div className="max-w-xs mb-4">
        <Select value={selId ? String(selId) : ""} onValueChange={setSel}>
          <SelectTrigger><SelectValue placeholder="Selecciona un pipeline" /></SelectTrigger>
          <SelectContent>{(pipelines ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <PipelineStagesEditor pipelineId={selId} />
      </div>
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

// ===================================================================
// CrmSettingsConnections
// ===================================================================
const MOCK_CONNECTORS: Connector[] = [
  { id: "c1", organization_id: "org1", connector_key: "meta_ads", display_name: "Meta Ads", category: "ads", status: "connected_live", mode: "live", required_credentials: ["access_token","pixel_id"], checklist: ["OAuth completado","Pixel instalado","Conversions API activo"], non_secret_config: { ad_account_id: "act_123456789" }, last_test_at: new Date(Date.now() - 3600_000).toISOString(), last_error: null, encryption_status: "encrypted" },
  { id: "c2", organization_id: "org1", connector_key: "google_ads", display_name: "Google Ads", category: "ads", status: "connected_test", mode: "test", required_credentials: ["refresh_token","client_id","client_secret"], checklist: ["OAuth completado","Tag instalado"], non_secret_config: { customer_id: "123-456-7890" }, last_test_at: new Date(Date.now() - 7200_000).toISOString(), last_error: null, encryption_status: "encrypted" },
  { id: "c3", organization_id: "org1", connector_key: "whatsapp", display_name: "WhatsApp Business", category: "conversions", status: "secrets_configured", mode: "sandbox", required_credentials: ["api_key","phone_number_id"], checklist: ["API key configurada","Número verificado"], non_secret_config: { business_account_id: "biz_789" }, last_test_at: null, last_error: null, encryption_status: "encrypted" },
  { id: "c4", organization_id: "org1", connector_key: "postmark", display_name: "Postmark", category: "conversions", status: "connected_live", mode: "live", required_credentials: ["server_token"], checklist: ["Token configurado","Dominio verificado"], non_secret_config: { from_email: "crm@sozu.com" }, last_test_at: new Date(Date.now() - 1800_000).toISOString(), last_error: null, encryption_status: "encrypted" },
  { id: "c5", organization_id: "org1", connector_key: "evolution_api", display_name: "Evolution API (WA)", category: "webhooks", status: "error", mode: "live", required_credentials: ["api_key","base_url"], checklist: ["URL accesible","API key válida"], non_secret_config: { instance_name: "sozu-prod" }, last_test_at: new Date(Date.now() - 3600_000 * 5).toISOString(), last_error: "Connection timeout after 5s", encryption_status: "encrypted" },
  { id: "c6", organization_id: "org1", connector_key: "openai", display_name: "OpenAI", category: "ai", status: "connected_test", mode: "test", required_credentials: ["api_key"], checklist: ["API key configurada"], non_secret_config: { model: "gpt-4o-mini" }, last_test_at: new Date(Date.now() - 86400_000).toISOString(), last_error: null, encryption_status: "encrypted" },
  { id: "c7", organization_id: "org1", connector_key: "stripe", display_name: "Stripe", category: "other", status: "disconnected", mode: "mock", required_credentials: ["secret_key","publishable_key"], checklist: ["Keys configuradas","Webhook endpoint registrado"], non_secret_config: {}, last_test_at: null, last_error: null, encryption_status: "not_applicable" },
];

export function CrmSettingsConnections() {
  const [testing, setTesting] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const out: Record<string, Connector[]> = {};
    for (const c of MOCK_CONNECTORS) {
      (out[c.category] ??= []).push(c);
    }
    return out;
  }, []);

  const runTest = (c: Connector) => {
    setTesting(c.id);
    setTimeout(() => { setTesting(null); toast.success(`Test ${c.display_name}: OK (mock)`); }, 1200);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Conexiones e integraciones" subtitle="Estado de autenticación OAuth y tokens por plataforma">
        <MockBadge />
      </PageHeader>

      {Object.entries(grouped).map(([cat, connectors]) => (
        <div key={cat} className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">{CATEGORY_LABEL[cat] ?? cat}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {connectors.map(c => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold">{c.display_name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{c.connector_key}</p>
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</Badge>
                </div>

                {c.last_error && (
                  <div className="rounded-md bg-rose-500/10 border border-rose-500/30 px-2 py-1.5 mb-2 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{c.last_error}
                  </div>
                )}

                <div className="space-y-1 mb-3">
                  {c.checklist.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{item}
                    </div>
                  ))}
                </div>

                {c.last_test_at && (
                  <p className="text-[10px] text-muted-foreground mb-2">Último test: {relTime(c.last_test_at)}</p>
                )}

                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                    onClick={() => runTest(c)} disabled={testing === c.id}>
                    <RefreshCw className={`w-3 h-3 mr-1 ${testing === c.id ? "animate-spin" : ""}`} />
                    {testing === c.id ? "Probando..." : "Probar"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => toast.info(`Configurar ${c.display_name} (mock)`)}>
                    <Settings2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===================================================================
// CrmSettingsDeploymentReadiness
// ===================================================================
const READINESS_DRAFT: DraftPayload = {
  development_id: "dev1",
  development_name: "Torre Sozu I",
  objective: "reservations",
  platform: "meta_ads",
  budget_type: "daily",
  budget: 500,
  start_date: "2026-07-01",
  end_date: "2026-07-31",
  audience: {
    persona: "Compradores primera vivienda, 28-45 años",
    location: "CDMX, GDL, MTY",
    interests: "Bienes raíces, inversión inmobiliaria",
    intent: "high",
    purchase_type: "first_home",
  },
  offer: {
    hook: "Departamentos desde $1.8M con solo 5% de enganche",
    differentiator: "Entrega inmediata · escrituración en 60 días",
    cta: "Agendar visita",
    landing_url: "https://sozu.com/torre-sozu-i",
  },
  utms: {
    source: "meta",
    medium: "cpc",
    campaign: "torre-sozu-i-cierre-q2",
    content: "carousel_01",
    term: "",
  },
};

type ReadinessItem = { label: string; ok: boolean; detail?: string };

const EXTRA_ITEMS: ReadinessItem[] = [
  { label: "Datos de organización configurados", ok: true },
  { label: "Al menos un pipeline activo", ok: true },
  { label: "SLA policy definida para leads de alta prioridad", ok: true },
  { label: "Webhook de entrega de leads conectado", ok: false, detail: "Evolution API con error" },
  { label: "Entrenamiento del equipo completado (5+ usuarios activos)", ok: false, detail: "Solo 4 usuarios activos registrados" },
];

export function CrmSettingsDeploymentReadiness() {
  const readiness = useMemo(() => {
    const issues = validateDraft(READINESS_DRAFT, "meta");
    return computeReadiness(READINESS_DRAFT, issues);
  }, []);

  const weightItems: ReadinessItem[] = Object.entries(readiness.weights).map(([key, val]) => ({
    label: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    ok: val.passed,
    detail: val.passed ? undefined : `Peso: ${val.weight}pts`,
  }));

  const allItems = [...weightItems, ...EXTRA_ITEMS];
  const okCount = allItems.filter(i => i.ok).length;
  const pct = allItems.length > 0 ? okCount / allItems.length : 0;
  const statusColor = readiness.score >= 90 ? "text-emerald-600 dark:text-emerald-400"
    : readiness.score >= 50 ? "text-amber-600 dark:text-amber-400"
    : "text-rose-600 dark:text-rose-400";

  const statusLabel = readiness.status === "ready_for_review" ? "Listo para revisión"
    : readiness.status === "incomplete" ? "Incompleto — requiere configuración"
    : "Borrador en progreso";

  const recommendation = readiness.errors > 0
    ? `Corregir ${readiness.errors} error(es) bloqueante(s) antes del go-live.`
    : readiness.warnings > 0
    ? `${readiness.warnings} advertencia(s) opcionales sin resolver.`
    : readiness.score >= 90
    ? "Configuración lista. Puedes solicitar revisión final."
    : "Completa los ítems pendientes para avanzar al siguiente paso.";

  const blockers = allItems.filter(i => !i.ok).map(i => i.label);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Preparación para despliegue"
        description="Checklist de configuración requerida antes del go-live"
        actions={<MockBadge />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 sm:col-span-1">
          <p className="text-xs text-muted-foreground">Puntuación global</p>
          <p className={`text-3xl font-bold mt-1 ${statusColor}`}>{readiness.score}%</p>
          <Progress value={readiness.score} className="mt-2 h-2" />
          <p className="text-xs text-muted-foreground mt-1">{okCount} de {allItems.length} ítems completados</p>
          <Badge variant="outline" className={`mt-2 text-[10px] ${DRAFT_STATUS_TONE[readiness.status]}`}>
            {readiness.status.replace(/_/g, " ")}
          </Badge>
        </Card>
        <Card className="p-4 sm:col-span-2">
          <p className="text-sm font-semibold mb-1">{statusLabel}</p>
          <p className="text-xs text-muted-foreground">{recommendation}</p>
          {blockers.length > 0 && (
            <div className="mt-2 space-y-1">
              {blockers.slice(0, 5).map((b, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{b}
                </div>
              ))}
              {blockers.length > 5 && (
                <p className="text-xs text-muted-foreground">… y {blockers.length - 5} más</p>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="rounded-md border overflow-hidden">
        {allItems.map((item, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
            {item.ok
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />}
            <span className={item.ok ? "" : "font-medium"}>{item.label}</span>
            {item.detail && <span className="text-xs text-muted-foreground ml-auto">{item.detail}</span>}
            {item.ok && !item.detail && <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-400">Completado</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// CrmSettingsApiLogs
// ===================================================================
type ApiLog = {
  id: string; at: string; method: "GET" | "POST" | "PUT" | "DELETE";
  integration: string; endpoint: string; status: number; duration_ms: number; error: string | null;
};

const API_LOGS_MOCK: ApiLog[] = [
  { id: "l1", at: new Date(Date.now() - 2 * 60_000).toISOString(),   method: "POST", integration: "Meta Ads",        endpoint: "/v18.0/act_123/leads",            status: 200, duration_ms: 318, error: null },
  { id: "l2", at: new Date(Date.now() - 5 * 60_000).toISOString(),   method: "POST", integration: "Postmark",        endpoint: "/email",                          status: 200, duration_ms: 204, error: null },
  { id: "l3", at: new Date(Date.now() - 12 * 60_000).toISOString(),  method: "POST", integration: "Evolution API",   endpoint: "/message/sendText/sozu-prod",     status: 504, duration_ms: 5012, error: "Connection timeout" },
  { id: "l4", at: new Date(Date.now() - 18 * 60_000).toISOString(),  method: "GET",  integration: "Google Ads",      endpoint: "/customers/123/campaigns",        status: 200, duration_ms: 441, error: null },
  { id: "l5", at: new Date(Date.now() - 35 * 60_000).toISOString(),  method: "POST", integration: "OpenAI",          endpoint: "/chat/completions",               status: 200, duration_ms: 1882, error: null },
  { id: "l6", at: new Date(Date.now() - 58 * 60_000).toISOString(),  method: "POST", integration: "Meta Ads",        endpoint: "/v18.0/act_123/events",           status: 400, duration_ms: 290, error: "Invalid pixel_id" },
  { id: "l7", at: new Date(Date.now() - 90 * 60_000).toISOString(),  method: "GET",  integration: "Meta Ads",        endpoint: "/v18.0/act_123/adsets",           status: 200, duration_ms: 512, error: null },
  { id: "l8", at: new Date(Date.now() - 120 * 60_000).toISOString(), method: "POST", integration: "Postmark",        endpoint: "/email/withTemplate",             status: 200, duration_ms: 188, error: null },
  { id: "l9", at: new Date(Date.now() - 180 * 60_000).toISOString(), method: "POST", integration: "Evolution API",   endpoint: "/message/sendText/sozu-prod",     status: 504, duration_ms: 5001, error: "Connection timeout" },
];

const METHOD_TONE: Record<string, string> = {
  GET: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  POST: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  PUT: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  DELETE: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

export function CrmSettingsApiLogs() {
  const [integFilter, setIntegFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => API_LOGS_MOCK.filter(l => {
    if (integFilter !== "all" && l.integration !== integFilter) return false;
    if (statusFilter === "ok" && l.status >= 400) return false;
    if (statusFilter === "error" && l.status < 400) return false;
    return true;
  }), [integFilter, statusFilter]);

  const integrations = [...new Set(API_LOGS_MOCK.map(l => l.integration))];
  const errorPct = API_LOGS_MOCK.filter(l => l.status >= 400).length / API_LOGS_MOCK.length;

  return (
    <div className="space-y-4">
      <PageHeader title="Registros de API" subtitle="Historial de llamadas a APIs externas con errores y tiempos">
        <MockBadge />
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Llamadas (último hora)", value: fmtNum(API_LOGS_MOCK.length) },
          { label: "Tasa de error", value: fmtPct(errorPct), red: errorPct > 0.1 },
          { label: "P95 latencia", value: "1,882 ms" },
          { label: "Integraciones activas", value: fmtNum(integrations.length) },
        ].map(k => (
          <Card key={k.label} className="p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${k.red ? "text-rose-500" : ""}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={integFilter} onValueChange={setIntegFilter}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las integraciones</SelectItem>
            {integrations.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ok">Solo OK</SelectItem>
            <SelectItem value="error">Solo errores</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filtered.length} registros</Badge>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Cuándo</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Integración</TableHead>
            <TableHead>Endpoint</TableHead>
            <TableHead className="text-right">Status</TableHead>
            <TableHead className="text-right">Duración</TableHead>
            <TableHead>Error</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{relTime(l.at)}</TableCell>
                <TableCell><Badge className={`text-[10px] ${METHOD_TONE[l.method]}`}>{l.method}</Badge></TableCell>
                <TableCell className="text-sm">{l.integration}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground max-w-[220px] truncate">{l.endpoint}</TableCell>
                <TableCell className="text-right">
                  <span className={`text-sm font-medium ${l.status >= 400 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>{l.status}</span>
                </TableCell>
                <TableCell className={`text-right text-sm ${l.duration_ms > 3000 ? "text-amber-600 dark:text-amber-400" : ""}`}>{l.duration_ms} ms</TableCell>
                <TableCell className="text-xs text-rose-600 dark:text-rose-400">{l.error ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ===================================================================
// CrmSettingsIntegrationChecklist
// ===================================================================
type ChecklistItem = { id: string; label: string; detail: string; completed: boolean; required: boolean };
type Integration = { id: string; name: string; category: string; items: ChecklistItem[] };

const INTEGRATION_CHECKLISTS: Integration[] = [
  {
    id: "meta", name: "Meta Ads", category: "ads",
    items: [
      { id: "m1", label: "Crear app en Meta for Developers", detail: "meta.com/developers → Crear nueva app", completed: true, required: true },
      { id: "m2", label: "Configurar OAuth permissions", detail: "Permisos: ads_read, ads_management, leads_retrieval", completed: true, required: true },
      { id: "m3", label: "Obtener access_token de larga duración", detail: "Intercambiar short-lived token con /oauth/access_token", completed: true, required: true },
      { id: "m4", label: "Instalar Pixel en landing pages", detail: "Insertar <script> del Pixel en todas las landings", completed: true, required: true },
      { id: "m5", label: "Configurar Conversions API (CAPI)", detail: "Enviar eventos de conversión server-side para mejor tracking", completed: false, required: false },
      { id: "m6", label: "Probar flujo Lead Form → CRM", detail: "Crear lead de prueba y verificar llegada al CRM", completed: false, required: true },
    ],
  },
  {
    id: "google", name: "Google Ads", category: "ads",
    items: [
      { id: "g1", label: "Crear proyecto en Google Cloud Console", detail: "Habilitar Google Ads API", completed: true, required: true },
      { id: "g2", label: "Configurar OAuth 2.0 credentials", detail: "Crear OAuth client ID y secret", completed: true, required: true },
      { id: "g3", label: "Obtener Developer Token", detail: "Solicitar en Google Ads → API Center", completed: true, required: true },
      { id: "g4", label: "Configurar Enhanced Conversions", detail: "Habilitar conversiones mejoradas para leads", completed: false, required: false },
      { id: "g5", label: "Probar importación de campañas", detail: "Verificar lista de campañas en CRM", completed: false, required: true },
    ],
  },
  {
    id: "whatsapp", name: "WhatsApp Business API", category: "conversions",
    items: [
      { id: "w1", label: "Configurar instancia Evolution API", detail: "Deploy en VPS con docker-compose", completed: true, required: true },
      { id: "w2", label: "Verificar número de teléfono", detail: "Registro del número en WhatsApp Business", completed: true, required: true },
      { id: "w3", label: "Configurar webhook de mensajes entrantes", detail: "Apuntar webhook al endpoint del CRM", completed: false, required: true },
      { id: "w4", label: "Probar envío de mensaje saliente", detail: "Enviar mensaje de prueba desde CRM", completed: false, required: true },
    ],
  },
];

export function CrmSettingsIntegrationChecklist() {
  const [states, setStates] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    INTEGRATION_CHECKLISTS.forEach(i => i.items.forEach(item => { init[item.id] = item.completed; }));
    return init;
  });
  const [selInteg, setSelInteg] = useState(INTEGRATION_CHECKLISTS[0].id);
  const active = INTEGRATION_CHECKLISTS.find(i => i.id === selInteg) ?? INTEGRATION_CHECKLISTS[0];
  const completedCount = active.items.filter(i => states[i.id]).length;
  const pct = active.items.length > 0 ? completedCount / active.items.length : 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Checklist de integración" subtitle="Pasos para configurar cada integración paso a paso">
        <MockBadge />
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          {INTEGRATION_CHECKLISTS.map(i => {
            const done = i.items.filter(item => states[item.id]).length;
            const total = i.items.length;
            return (
              <button key={i.id} onClick={() => setSelInteg(i.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${selInteg === i.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
                <span>{i.name}</span>
                <span className={`text-xs ${done === total ? "text-emerald-500" : "text-muted-foreground"}`}>{done}/{total}</span>
              </button>
            );
          })}
        </div>

        <div className="md:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{active.name}</p>
            <div className="flex items-center gap-2">
              <Progress value={pct * 100} className="w-24 h-1.5" />
              <span className="text-xs text-muted-foreground">{Math.round(pct * 100)}%</span>
            </div>
          </div>

          <div className="space-y-2">
            {active.items.map(item => (
              <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border ${states[item.id] ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/20"}`}>
                <Switch checked={states[item.id]} onCheckedChange={v => { setStates(s => ({...s, [item.id]: v})); toast.success(`${v ? "Completado" : "Desmarcado"}: ${item.label} (mock)`); }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm ${states[item.id] ? "line-through text-muted-foreground" : "font-medium"}`}>{item.label}</span>
                    {item.required && <Badge variant="outline" className="text-[10px]">Requerido</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                </div>
                {states[item.id] && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// CrmSettingsOrganization
// ===================================================================
type OrgForm = { name: string; timezone: string; currency: string; email: string; phone: string; website: string };

const TIMEZONES = ["America/Mexico_City","America/Monterrey","America/New_York","America/Los_Angeles","America/Chicago"];
const CURRENCIES = ["MXN","USD","CAD","EUR"];

export function CrmSettingsOrganization() {
  const orgId = useCrmOrgId();
  const [form, setForm] = useState<OrgForm>({
    name: "SOZU Inmobiliaria", timezone: "America/Mexico_City", currency: "MXN",
    email: "crm@sozu.com", phone: "+52 81 1234 5678", website: "https://sozu.com",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    toast.success("Configuración guardada (mock)");
  };

  const f = (key: keyof OrgForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({...prev, [key]: e.target.value}));

  return (
    <div className="space-y-6">
      <PageHeader title="Organización" subtitle="Configuración general de la organización CRM">
        <MockBadge />
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
        <div className="space-y-4">
          <p className="text-sm font-semibold">Datos generales</p>
          <div><Label>Nombre de la organización</Label><Input value={form.name} onChange={f("name")} /></div>
          <div><Label>Email de contacto</Label><Input type="email" value={form.email} onChange={f("email")} /></div>
          <div><Label>Teléfono</Label><Input value={form.phone} onChange={f("phone")} /></div>
          <div><Label>Sitio web</Label><Input value={form.website} onChange={f("website")} /></div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold">Configuración regional</p>
          <div>
            <Label>Zona horaria</Label>
            <Select value={form.timezone} onValueChange={v => setForm(p => ({...p, timezone: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIMEZONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Moneda</Label>
            <Select value={form.currency} onValueChange={v => setForm(p => ({...p, currency: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <Separator />
          <p className="text-sm font-semibold">ID de organización</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{orgId ?? "Sin org ID"}</code>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { if (orgId) { navigator.clipboard.writeText(orgId); toast.success("Copiado"); } }}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// CrmSettingsDevelopments
// ===================================================================
type CrmDev = {
  id: string; name: string; location: string; active: boolean;
  units: number; units_available: number; price_from: number; price_to: number;
  assigned_advisors: string[]; sync_status: "synced" | "pending" | "error";
};

const CRM_DEVS_MOCK: CrmDev[] = [
  { id: "d1", name: "Altea Norte", location: "Monterrey, NL", active: true, units: 60, units_available: 24, price_from: 1_800_000, price_to: 3_200_000, assigned_advisors: ["Ana García","Carlos López"], sync_status: "synced" },
  { id: "d2", name: "Vivenza", location: "San Pedro, NL", active: true, units: 48, units_available: 4, price_from: 2_400_000, price_to: 4_100_000, assigned_advisors: ["Carlos López","María Torres"], sync_status: "synced" },
  { id: "d3", name: "Meridian Tower", location: "CDMX", active: true, units: 36, units_available: 0, price_from: 3_100_000, price_to: 5_800_000, assigned_advisors: ["Ana García"], sync_status: "pending" },
  { id: "d4", name: "Paseo Colinas", location: "Guadalajara, JAL", active: false, units: 40, units_available: 18, price_from: 1_600_000, price_to: 2_800_000, assigned_advisors: [], sync_status: "error" },
];

const SYNC_TONE: Record<string, string> = {
  synced: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  error: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

export function CrmSettingsDevelopments() {
  const [devs, setDevs] = useState(CRM_DEVS_MOCK);

  const toggleActive = (id: string) => {
    setDevs(prev => prev.map(d => d.id === id ? {...d, active: !d.active} : d));
    toast.success("Estado actualizado (mock)");
  };

  const sync = (id: string) => {
    setDevs(prev => prev.map(d => d.id === id ? {...d, sync_status: "synced"} : d));
    toast.success("Sincronizado con inventario SOZU (mock)");
  };

  const fmtMXNs = (n: number) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(n);

  return (
    <div className="space-y-4">
      <PageHeader title="Desarrollos en CRM" subtitle="Proyectos inmobiliarios disponibles para asignar a deals">
        <MockBadge />
        <Button size="sm" onClick={() => toast.info("Agregar desarrollo (mock)")}><Plus className="w-4 h-4 mr-1" />Agregar</Button>
      </PageHeader>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Desarrollo</TableHead>
            <TableHead>Disponibles</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Asesores</TableHead>
            <TableHead>Sync</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {devs.map(d => (
              <TableRow key={d.id}>
                <TableCell>
                  <p className="font-medium text-sm">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.location}</p>
                </TableCell>
                <TableCell className="text-sm">{d.units_available}/{d.units}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtMXNs(d.price_from)} – {fmtMXNs(d.price_to)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {d.assigned_advisors.length > 0
                      ? d.assigned_advisors.map(a => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)
                      : <span className="text-xs text-muted-foreground">Sin asesores</span>}
                  </div>
                </TableCell>
                <TableCell><Badge className={`text-[10px] ${SYNC_TONE[d.sync_status]}`}>{d.sync_status}</Badge></TableCell>
                <TableCell><Switch checked={d.active} onCheckedChange={() => toggleActive(d.id)} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => sync(d.id)}>
                      <RefreshCw className="w-3 h-3 mr-1" />Sync
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toast.info(`Editar ${d.name} (mock)`)}>
                      <Edit2 className="w-3 h-3" />
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

// ===================================================================
// CrmSettingsPipelines
// ===================================================================

// Catálogo de pipelines activos (crm_pipelines). Compartido por ambas pantallas.
function usePipelinesList() {
  return useQuery({
    queryKey: ["cfg-pipelines"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_pipelines")
        .select("id, nombre, orden, activo").eq("activo", true).order("orden");
      return (data ?? []) as { id: number; nombre: string; orden: number; activo: boolean }[];
    },
  });
}

// Alta/edición de una etapa (crm_pipeline_etapas).
function StageDialog({ pipelineId, stage, nextOrden, onClose, onSaved }: { pipelineId: number; stage: any | null; nextOrden: number; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!stage;
  const [form, setForm] = useState({ nombre: stage?.nombre ?? "", probabilidad: String(stage?.probabilidad ?? "0"), es_ganado: !!stage?.es_ganado, es_perdido: !!stage?.es_perdido });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const payload = { nombre: form.nombre.trim(), probabilidad: Number(form.probabilidad) || 0, es_ganado: form.es_ganado, es_perdido: form.es_perdido };
    const res = isEdit
      ? await (supabase as any).from("crm_pipeline_etapas").update(payload).eq("id", stage.id)
      : await (supabase as any).from("crm_pipeline_etapas").insert({ ...payload, id_pipeline: pipelineId, orden: nextOrden, activo: true });
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(isEdit ? "Etapa actualizada" : "Etapa creada"); onSaved();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Editar etapa" : "Nueva etapa"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus /></div>
          <div className="grid gap-1.5"><Label>Probabilidad de cierre (%)</Label><Input type="number" min="0" max="100" value={form.probabilidad} onChange={(e) => setForm({ ...form, probabilidad: e.target.value })} /></div>
          <div className="flex items-center justify-between rounded-md border p-2.5">
            <Label className="text-sm font-normal">Etapa de cierre ganado</Label>
            <Switch checked={form.es_ganado} onCheckedChange={(v) => setForm({ ...form, es_ganado: v, es_perdido: v ? false : form.es_perdido })} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-2.5">
            <Label className="text-sm font-normal">Etapa de cierre perdido</Label>
            <Switch checked={form.es_perdido} onCheckedChange={(v) => setForm({ ...form, es_perdido: v, es_ganado: v ? false : form.es_ganado })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.nombre.trim()}>{isEdit ? "Guardar" : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Editor de etapas de un pipeline (lista + reordenar + CRUD). Reutilizado en ambas pantallas.
function PipelineStagesEditor({ pipelineId }: { pipelineId: number | null }) {
  const qc = useQueryClient();
  const [dlg, setDlg] = useState<{ open: boolean; stage: any | null }>({ open: false, stage: null });
  const { data: stages, isLoading } = useQuery({
    queryKey: ["cfg-etapas", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_pipeline_etapas")
        .select("id, nombre, orden, probabilidad, es_ganado, es_perdido")
        .eq("id_pipeline", pipelineId).eq("activo", true).order("orden");
      return (data ?? []) as any[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cfg-etapas", pipelineId] });
  const list = stages ?? [];
  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[idx], b = list[j];
    await (supabase as any).from("crm_pipeline_etapas").update({ orden: b.orden }).eq("id", a.id);
    await (supabase as any).from("crm_pipeline_etapas").update({ orden: a.orden }).eq("id", b.id);
    invalidate();
  };
  const remove = async (id: number) => {
    const res = await (supabase as any).from("crm_pipeline_etapas").update({ activo: false }).eq("id", id);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Etapa eliminada"); invalidate();
  };
  if (!pipelineId) return <p className="text-sm text-muted-foreground py-2">Selecciona un pipeline para ver sus etapas.</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{list.length} etapa(s)</p>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDlg({ open: true, stage: null })}><Plus className="w-3 h-3 mr-1" />Agregar etapa</Button>
      </div>
      {isLoading ? <Skeleton className="h-24 w-full" /> : list.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Sin etapas. Agrega la primera.</p>
      ) : list.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/20">
          <div className="flex flex-col -my-1">
            <button disabled={i === 0} onClick={() => move(i, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
            <button disabled={i === list.length - 1} onClick={() => move(i, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
          </div>
          <span className="text-sm flex-1 truncate">{s.nombre}</span>
          {s.es_ganado && <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Ganado</Badge>}
          {s.es_perdido && <Badge className="text-[10px] bg-red-500/15 text-red-600 dark:text-red-400">Perdido</Badge>}
          <span className="text-xs text-muted-foreground w-12 text-right shrink-0">{Number(s.probabilidad)}%</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-60 hover:opacity-100" onClick={() => setDlg({ open: true, stage: s })}><Edit2 className="w-3 h-3" /></Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive opacity-60 hover:opacity-100" onClick={() => remove(s.id)}><Trash2 className="w-3 h-3" /></Button>
        </div>
      ))}
      {dlg.open && (
        <StageDialog pipelineId={pipelineId} stage={dlg.stage}
          nextOrden={list.reduce((m, s) => Math.max(m, s.orden ?? 0), 0) + 10}
          onClose={() => setDlg({ open: false, stage: null })}
          onSaved={() => { invalidate(); setDlg({ open: false, stage: null }); }} />
      )}
    </div>
  );
}

// Alta/edición de un pipeline (crm_pipelines). Solo pide el nombre.
function PipelineDialog({ pipeline, onClose, onSaved }: { pipeline: any | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!pipeline;
  const [nombre, setNombre] = useState(pipeline?.nombre ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    let res;
    if (isEdit) {
      res = await (supabase as any).from("crm_pipelines").update({ nombre: nombre.trim() }).eq("id", pipeline.id);
    } else {
      const { data: maxRow } = await (supabase as any).from("crm_pipelines").select("orden").order("orden", { ascending: false }).limit(1).maybeSingle();
      const nextOrden = ((maxRow?.orden ?? 0) as number) + 10;
      res = await (supabase as any).from("crm_pipelines").insert({ nombre: nombre.trim(), orden: nextOrden, activo: true });
    }
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(isEdit ? "Pipeline actualizado" : "Pipeline creado"); onSaved();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Editar pipeline" : "Nuevo pipeline"}</DialogTitle></DialogHeader>
        <div className="grid gap-1.5">
          <Label>Nombre del pipeline</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="Ej. Daiku Ventas" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !nombre.trim()}>{isEdit ? "Guardar" : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CrmSettingsPipelines() {
  const qc = useQueryClient();
  const { data: pipelines, isLoading } = usePipelinesList();
  const [sel, setSel] = useState<number | null>(null);
  const [dlg, setDlg] = useState<{ open: boolean; pipeline: any | null }>({ open: false, pipeline: null });
  const list = pipelines ?? [];
  const selId = sel ?? (list[0]?.id ?? null);
  const active = list.find((p) => p.id === selId) ?? null;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cfg-pipelines"] });
  const removePipeline = async (id: number) => {
    const res = await (supabase as any).from("crm_pipelines").update({ activo: false }).eq("id", id);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Pipeline eliminado"); if (selId === id) setSel(null); invalidate();
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Administración de pipelines"
        description="Crea y edita los pipelines de negocio. Cada pipeline tiene su propio embudo de etapas."
        actions={<Button size="sm" onClick={() => setDlg({ open: true, pipeline: null })}><Plus className="w-4 h-4 mr-1" />Nuevo pipeline</Button>} />
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            {list.length === 0 && <p className="text-xs text-muted-foreground px-1">Sin pipelines. Crea el primero.</p>}
            {list.map((p) => (
              <button key={p.id} onClick={() => setSel(p.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selId === p.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
                {p.nombre}
              </button>
            ))}
          </div>
          <div className="md:col-span-3 space-y-4">
            {!active ? <p className="text-sm text-muted-foreground">Selecciona o crea un pipeline.</p> : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{active.nombre}</p>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDlg({ open: true, pipeline: active })}><Edit2 className="w-3 h-3 mr-1" />Editar</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => removePipeline(active.id)}><Trash2 className="w-3 h-3 mr-1" />Eliminar</Button>
                  </div>
                </div>
                <PipelineStagesEditor pipelineId={active.id} />
              </>
            )}
          </div>
        </div>
      )}
      {dlg.open && <PipelineDialog pipeline={dlg.pipeline} onClose={() => setDlg({ open: false, pipeline: null })} onSaved={() => { invalidate(); setDlg({ open: false, pipeline: null }); }} />}
    </div>
  );
}

// ===================================================================
// Estados de lead (crm_estados_lead) — CRUD configurable
// ===================================================================
const LEAD_STATE_COLORS = [
  "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#9333ea", "#0891b2",
  "#14b8a6", "#10b981", "#22c55e", "#f59e0b", "#f97316", "#ea580c",
  "#ef4444", "#dc2626", "#f43f5e", "#64748b",
];

type LeadStateRow = { id: number; clave: string; nombre: string; color: string; orden: number; activo: boolean };

function useLeadStatesList() {
  return useQuery({
    queryKey: ["cfg-estados-lead"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_estados_lead")
        .select("id, clave, nombre, color, orden, activo").eq("activo", true).order("orden");
      return (data ?? []) as LeadStateRow[];
    },
  });
}

// Genera una clave estable (slug) a partir del nombre para guardar en estatus_lead.
const slugifyLeadState = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "estado";

// Alta/edición de un estado de lead. La `clave` se fija al crear y no cambia al editar
// (para que los contactos existentes que la referencian sigan resolviendo su etiqueta).
function LeadStateDialog({ estado, nextOrden, onClose, onSaved }: { estado: LeadStateRow | null; nextOrden: number; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!estado;
  const [nombre, setNombre] = useState(estado?.nombre ?? "");
  const [color, setColor] = useState(estado?.color ?? "#64748b");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    let res;
    if (isEdit && estado) {
      res = await (supabase as any).from("crm_estados_lead").update({ nombre: nombre.trim(), color }).eq("id", estado.id);
    } else {
      let clave = slugifyLeadState(nombre);
      const { data: dup } = await (supabase as any).from("crm_estados_lead").select("id").eq("clave", clave).maybeSingle();
      if (dup) clave = `${clave}_${nextOrden}`;
      res = await (supabase as any).from("crm_estados_lead").insert({ clave, nombre: nombre.trim(), color, orden: nextOrden, activo: true });
    }
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(isEdit ? "Estado actualizado" : "Estado creado"); onSaved();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Editar estado" : "Nuevo estado de lead"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Nombre</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="Ej. Programó cita" /></div>
          <div className="grid gap-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {LEAD_STATE_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition ${color.toLowerCase() === c.toLowerCase() ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }} title={c} />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-6 w-8 rounded border bg-transparent p-0" title="Color personalizado" />
            </div>
            <div className="mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                style={{ backgroundColor: `${color}1a`, color, borderColor: `${color}55` }}>
                {nombre.trim() || "Vista previa"}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !nombre.trim()}>{isEdit ? "Guardar" : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CrmSettingsLeadStates() {
  const qc = useQueryClient();
  const { data: estados, isLoading } = useLeadStatesList();
  const [dlg, setDlg] = useState<{ open: boolean; estado: LeadStateRow | null }>({ open: false, estado: null });
  const list = estados ?? [];
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cfg-estados-lead"] });
    qc.invalidateQueries({ queryKey: ["crm-estados-lead"] }); // el que consumen los selects de Contactos
  };
  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[idx], b = list[j];
    await (supabase as any).from("crm_estados_lead").update({ orden: b.orden }).eq("id", a.id);
    await (supabase as any).from("crm_estados_lead").update({ orden: a.orden }).eq("id", b.id);
    invalidate();
  };
  const remove = async (id: number) => {
    const res = await (supabase as any).from("crm_estados_lead").update({ activo: false }).eq("id", id);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Estado eliminado"); invalidate();
  };
  const nextOrden = list.reduce((m, s) => Math.max(m, s.orden ?? 0), 0) + 10;
  return (
    <div className="space-y-4">
      <PageHeader title="Estados de lead"
        description="Configura los estados por los que pasa un lead. El color se usa en el badge de la lista de contactos."
        actions={<Button size="sm" onClick={() => setDlg({ open: true, estado: null })}><Plus className="w-4 h-4 mr-1" />Nuevo estado</Button>} />
      <div className="rounded-xl border bg-card p-4">
        {isLoading ? <Skeleton className="h-48 w-full" /> : list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Sin estados. Crea el primero.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{list.length} estado(s)</p>
            {list.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/20">
                <div className="flex flex-col -my-1">
                  <button disabled={i === 0} onClick={() => move(i, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button disabled={i === list.length - 1} onClick={() => move(i, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0"
                  style={{ backgroundColor: `${s.color}1a`, color: s.color, borderColor: `${s.color}55` }}>{s.nombre}</span>
                <span className="text-xs text-muted-foreground flex-1 truncate">{s.clave}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-60 hover:opacity-100" onClick={() => setDlg({ open: true, estado: s })}><Edit2 className="w-3 h-3" /></Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive opacity-60 hover:opacity-100" onClick={() => remove(s.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
      {dlg.open && <LeadStateDialog estado={dlg.estado} nextOrden={nextOrden} onClose={() => setDlg({ open: false, estado: null })} onSaved={() => { invalidate(); setDlg({ open: false, estado: null }); }} />}
    </div>
  );
}