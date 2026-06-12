import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCrmOrgId } from "@/hooks/useCrmOrgId";
import {
  Megaphone, Users2, GitBranch, Image as ImageIcon, Link2, FlaskConical,
  LayoutTemplate, FileInput, Plug, Wallet, TrendingUp, TrendingDown,
  CheckCircle2, AlertTriangle, Eye, Copy, Play, Pause, Plus, ExternalLink,
  Search, RefreshCw, X as XIcon, Database, BarChart2, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, MockBadge, Panel, ComingSoon } from "@/components/admin/portal-crm/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtMXN, fmtNum, fmtPct, fmtDateTime, relTime } from "@/data/portal-crm/mockData";
import { type DateRange, RANGE_LABEL, rangeToSince } from "@/lib/crm-marketing";

const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

// ===================================================================
// Mock data — Fase 3 (Inteligencia de marketing)
// ===================================================================
const PLATFORMS = [
  { id: "meta_ads",   label: "Meta Ads",   tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { id: "google_ads", label: "Google Ads", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { id: "tiktok_ads", label: "TikTok Ads", tone: "bg-pink-500/15 text-pink-700 dark:text-pink-300" },
  { id: "linkedin",   label: "LinkedIn",   tone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
];
const platformTone = (p: string) =>
  PLATFORMS.find((x) => x.id === p)?.tone ?? "bg-muted text-muted-foreground";
const platformLabel = (p: string) =>
  PLATFORMS.find((x) => x.id === p)?.label ?? p;

interface Campaign {
  id: string; name: string; platform: string; status: "active" | "paused" | "ended";
  development: string; objective: string; budget: number; spend: number;
  leads: number; ql: number; appts: number; reservations: number;
  start: string; end: string | null;
}
const CAMPAIGNS: Campaign[] = [
  { id: "cmp1", name: "MX · Vivenza · Awareness",   platform: "meta_ads",   status: "active", development: "Vivenza · CDMX",     objective: "Awareness",  budget: 45000, spend: 32100, leads: 38, ql: 14, appts: 6, reservations: 1, start: daysAgo(28), end: null },
  { id: "cmp2", name: "MX · Vivenza · Conversion",  platform: "meta_ads",   status: "active", development: "Vivenza · CDMX",     objective: "Conversion", budget: 60000, spend: 51800, leads: 45, ql: 19, appts: 9, reservations: 3, start: daysAgo(28), end: null },
  { id: "cmp3", name: "GDL · Reserva 360 · Search", platform: "google_ads", status: "active", development: "Reserva 360 · GDL",  objective: "Leads",      budget: 40000, spend: 28400, leads: 27, ql: 11, appts: 4, reservations: 1, start: daysAgo(28), end: null },
  { id: "cmp4", name: "QRO · Altea · Display",      platform: "google_ads", status: "paused", development: "Altea · QRO",        objective: "Awareness",  budget: 25000, spend: 18900, leads:  6, ql:  1, appts: 0, reservations: 0, start: daysAgo(28), end: null },
  { id: "cmp5", name: "MX · Vivenza · TikTok",      platform: "tiktok_ads", status: "active", development: "Vivenza · CDMX",     objective: "Awareness",  budget: 20000, spend:  9200, leads: 12, ql:  3, appts: 1, reservations: 0, start: daysAgo(14), end: null },
  { id: "cmp6", name: "Director sector · LinkedIn", platform: "linkedin",   status: "ended",  development: "Reserva 360 · GDL",  objective: "Leads",      budget: 30000, spend: 30000, leads:  9, ql:  4, appts: 2, reservations: 1, start: daysAgo(60), end: daysAgo(7) },
];

interface Audience {
  id: string; name: string; platform: string; type: string; size: number;
  refresh: string; status: "ready" | "syncing" | "stale";
}
const AUDIENCES: Audience[] = [
  { id: "au1", name: "Compradores ganados · 12m",       platform: "meta_ads",   type: "Custom (clientes)",   size: 1240, refresh: daysAgo(0.5), status: "ready" },
  { id: "au2", name: "Lookalike compradores 1% MX",     platform: "meta_ads",   type: "Lookalike 1%",        size: 1900000, refresh: daysAgo(1), status: "ready" },
  { id: "au3", name: "Visitantes web 30d",              platform: "meta_ads",   type: "Website pixel",       size: 24800, refresh: daysAgo(0.2), status: "ready" },
  { id: "au4", name: "Leads no calificados 90d · retarget", platform: "google_ads", type: "Customer match",  size:  860, refresh: daysAgo(3), status: "stale" },
  { id: "au5", name: "Visitantes página de precios",    platform: "google_ads", type: "Remarketing list",    size: 6200, refresh: daysAgo(0.1), status: "syncing" },
  { id: "au6", name: "Engaged TikTok últimos 14d",      platform: "tiktok_ads", type: "Engagement",          size: 18500, refresh: daysAgo(1), status: "ready" },
];

const ATTRIBUTION_MODELS = [
  { id: "first_touch", label: "Primer touch" },
  { id: "last_touch",  label: "Último touch" },
  { id: "linear",      label: "Lineal" },
  { id: "time_decay",  label: "Time decay" },
  { id: "u_shaped",    label: "U-shaped" },
];
const ATTRIBUTION_ROWS = [
  { source: "Meta Ads",   first: 38, last: 32, linear: 35, decay: 30, ushape: 36, conversions: 4 },
  { source: "Google Ads", first: 22, last: 28, linear: 26, decay: 29, ushape: 27, conversions: 5 },
  { source: "Orgánico",   first: 14, last: 11, linear: 13, decay: 12, ushape: 12, conversions: 2 },
  { source: "Referido",   first:  6, last:  9, linear:  8, decay:  9, ushape:  7, conversions: 1 },
  { source: "Directo",    first:  4, last:  4, linear:  4, decay:  4, ushape:  4, conversions: 1 },
];

interface Creative {
  id: string; name: string; platform: string; format: "image" | "video" | "carousel";
  campaign: string; impressions: number; clicks: number; ctr: number;
  spend: number; leads: number; status: "active" | "paused";
}
const CREATIVES: Creative[] = [
  { id: "cr1", name: "Vivenza · Vista terraza",      platform: "meta_ads",   format: "image",    campaign: "MX · Vivenza · Awareness",   impressions: 412000, clicks: 5800, ctr: 0.0141, spend: 14200, leads: 18, status: "active" },
  { id: "cr2", name: "Vivenza · Tour 30s",           platform: "meta_ads",   format: "video",    campaign: "MX · Vivenza · Conversion",  impressions: 289000, clicks: 7100, ctr: 0.0246, spend: 22500, leads: 27, status: "active" },
  { id: "cr3", name: "Reserva 360 · 5 modelos",      platform: "google_ads", format: "carousel", campaign: "GDL · Reserva 360 · Search", impressions: 198000, clicks: 4200, ctr: 0.0212, spend: 12800, leads: 19, status: "active" },
  { id: "cr4", name: "Altea · Display banner azul",  platform: "google_ads", format: "image",    campaign: "QRO · Altea · Display",      impressions: 540000, clicks: 1900, ctr: 0.0035, spend: 11400, leads:  4, status: "paused" },
  { id: "cr5", name: "Vivenza · Reel showroom",      platform: "tiktok_ads", format: "video",    campaign: "MX · Vivenza · TikTok",      impressions: 132000, clicks: 3400, ctr: 0.0258, spend:  6800, leads:  9, status: "active" },
];

interface UtmRow {
  id: string; source: string; medium: string; campaign: string;
  content: string | null; term: string | null; sessions: number; leads: number; conversions: number;
  health: "ok" | "warning" | "error";
}
const UTMS: UtmRow[] = [
  { id: "u1", source: "meta",   medium: "cpc", campaign: "vivenza_awareness",  content: "img_terraza",   term: null,           sessions: 5800, leads: 38, conversions: 1, health: "ok" },
  { id: "u2", source: "meta",   medium: "cpc", campaign: "vivenza_conversion", content: "video_tour",    term: null,           sessions: 7100, leads: 45, conversions: 3, health: "ok" },
  { id: "u3", source: "google", medium: "cpc", campaign: "reserva360_search",  content: "ad_grupo_1",    term: "depto gdl",    sessions: 4200, leads: 27, conversions: 1, health: "ok" },
  { id: "u4", source: "google", medium: "cpc", campaign: "altea_display",      content: null,            term: null,           sessions: 1900, leads:  6, conversions: 0, health: "warning" },
  { id: "u5", source: "(none)", medium: "(none)", campaign: "(none)",          content: null,            term: null,           sessions:  920, leads: 11, conversions: 0, health: "error" },
  { id: "u6", source: "tiktok", medium: "cpc", campaign: "vivenza_tiktok",     content: "reel_showroom", term: null,           sessions: 3400, leads: 12, conversions: 0, health: "ok" },
];

interface AbTest {
  id: string; name: string; hypothesis: string; status: "running" | "complete" | "draft";
  variants: { name: string; visitors: number; conversions: number }[];
  start: string; winner?: string | null; uplift?: number | null;
}
const AB_TESTS: AbTest[] = [
  { id: "ab1", name: "Hero Vivenza · CTA",  hypothesis: "Cambiar CTA a 'Agendar visita' aumenta conversión", status: "running",  variants: [{ name: "A · Original", visitors: 4200, conversions: 138 }, { name: "B · CTA visita", visitors: 4180, conversions: 184 }], start: daysAgo(9), winner: null, uplift: 0.21 },
  { id: "ab2", name: "Form Reserva 360 · campos", hypothesis: "Reducir de 6 a 4 campos aumenta envío",        status: "complete", variants: [{ name: "A · 6 campos", visitors: 2200, conversions: 198 }, { name: "B · 4 campos", visitors: 2240, conversions: 312 }], start: daysAgo(28), winner: "B · 4 campos", uplift: 0.39 },
  { id: "ab3", name: "Email Subject · Altea",     hypothesis: "Subject con precio vs. beneficio",             status: "draft",    variants: [{ name: "A · Precio", visitors: 0, conversions: 0 }, { name: "B · Beneficio", visitors: 0, conversions: 0 }], start: daysAgo(1) },
];

interface Landing {
  id: string; name: string; url: string; published: boolean;
  visits: number; conversions: number; cvr: number; last_edit: string;
}
const LANDINGS: Landing[] = [
  { id: "lp1", name: "Vivenza · Lanzamiento",       url: "vivenza.sozu.com/lanzamiento",   published: true,  visits: 12400, conversions: 412, cvr: 0.033, last_edit: daysAgo(2) },
  { id: "lp2", name: "Reserva 360 · Modelos",       url: "reserva360.sozu.com/modelos",    published: true,  visits:  8600, conversions: 268, cvr: 0.031, last_edit: daysAgo(6) },
  { id: "lp3", name: "Altea · Showroom virtual",    url: "altea.sozu.com/showroom",        published: true,  visits:  3200, conversions:  64, cvr: 0.020, last_edit: daysAgo(11) },
  { id: "lp4", name: "Vivenza · Black Friday",      url: "vivenza.sozu.com/bf2026",        published: false, visits:     0, conversions:   0, cvr: 0,     last_edit: daysAgo(1) },
];

interface FormRow {
  id: string; name: string; type: "landing" | "popup" | "inline"; submits: number;
  cvr: number; spam_rate: number; mapped: boolean; landing: string;
}
const FORMS: FormRow[] = [
  { id: "f1", name: "Lead Vivenza",        type: "landing", submits: 412, cvr: 0.033, spam_rate: 0.02, mapped: true,  landing: "vivenza.sozu.com/lanzamiento" },
  { id: "f2", name: "Pop-up newsletter",   type: "popup",   submits:  98, cvr: 0.012, spam_rate: 0.09, mapped: true,  landing: "vivenza.sozu.com" },
  { id: "f3", name: "Form Reserva 360",    type: "landing", submits: 312, cvr: 0.036, spam_rate: 0.03, mapped: true,  landing: "reserva360.sozu.com/modelos" },
  { id: "f4", name: "Form Altea inline",   type: "inline",  submits:  44, cvr: 0.018, spam_rate: 0.05, mapped: false, landing: "altea.sozu.com/showroom" },
];

interface Integration {
  id: string; name: string; platform: string; status: "connected" | "error" | "disconnected";
  account: string; last_sync: string; events_30d: number;
}
const INTEGRATIONS: Integration[] = [
  { id: "in1", name: "Meta Ads · BM Sozu",      platform: "meta_ads",   status: "connected",   account: "act_988234",      last_sync: daysAgo(0.05), events_30d: 1280 },
  { id: "in2", name: "Meta CAPI · Pixel CDMX",  platform: "meta_ads",   status: "error",       account: "pixel_1284",      last_sync: daysAgo(0.2),  events_30d: 0 },
  { id: "in3", name: "Google Ads · MCC",        platform: "google_ads", status: "connected",   account: "123-456-7890",    last_sync: daysAgo(0.05), events_30d: 940 },
  { id: "in4", name: "Google Analytics 4",      platform: "google_ads", status: "connected",   account: "G-XXXX1234",      last_sync: daysAgo(0.05), events_30d: 24800 },
  { id: "in5", name: "TikTok Ads · Sozu",       platform: "tiktok_ads", status: "connected",   account: "tt_8821",         last_sync: daysAgo(0.1),  events_30d: 412 },
  { id: "in6", name: "LinkedIn Campaign Mgr",   platform: "linkedin",   status: "disconnected",account: "—",               last_sync: daysAgo(40),   events_30d: 0 },
];

const BUDGET_ROWS = [
  { development: "Vivenza · CDMX",     budget: 200000, spend: 142100, leads: 95, reservations: 4 },
  { development: "Reserva 360 · GDL",  budget: 120000, spend:  88400, leads: 40, reservations: 2 },
  { development: "Altea · QRO",        budget:  60000, spend:  18900, leads:  6, reservations: 0 },
];

// ===================================================================
// Utilidades visuales
// ===================================================================
function StatusDot({ tone }: { tone: "ok" | "warning" | "error" | "ready" | "syncing" | "stale" | "active" | "paused" | "ended" | "connected" | "disconnected" | "running" | "complete" | "draft" }) {
  const map: Record<string, string> = {
    ok: "bg-emerald-500", ready: "bg-emerald-500", active: "bg-emerald-500", connected: "bg-emerald-500", running: "bg-emerald-500", complete: "bg-emerald-500",
    warning: "bg-amber-500", syncing: "bg-amber-500", paused: "bg-amber-500",
    error: "bg-rose-500", stale: "bg-rose-500", ended: "bg-muted-foreground", disconnected: "bg-rose-500", draft: "bg-muted-foreground",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${map[tone] ?? "bg-muted-foreground"}`} />;
}

function Kpi({ label, value, hint, trend }: { label: string; value: string; hint?: string; trend?: "up" | "down" | null }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>{label}</span>
          {trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-600" />}
          {trend === "down" && <TrendingDown className="h-4 w-4 text-rose-600" />}
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

// ===================================================================
// 1. Campañas
// ===================================================================
export function CrmCampaigns() {
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "paused" | "ended">("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    let r = CAMPAIGNS;
    if (platform !== "all") r = r.filter((c) => c.platform === platform);
    if (status !== "all") r = r.filter((c) => c.status === status);
    if (search) r = r.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
    return r;
  }, [platform, status, search]);

  const totals = useMemo(() => ({
    spend: rows.reduce((s, r) => s + r.spend, 0),
    leads: rows.reduce((s, r) => s + r.leads, 0),
    ql: rows.reduce((s, r) => s + r.ql, 0),
    res: rows.reduce((s, r) => s + r.reservations, 0),
  }), [rows]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Campañas"
        description="Meta, Google, TikTok y LinkedIn unificados con CRM"
        actions={
          <div className="flex items-center gap-2">
            <MockBadge />
            <Button data-cta="crm.marketing.nueva-campana" size="sm" onClick={() => toast.success("Campaña creada (mock)")}>
              <Plus className="h-4 w-4 mr-1" />Nueva campaña
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Spend" value={fmtMXN(totals.spend)} trend="up" />
        <Kpi label="Leads" value={fmtNum(totals.leads)} hint={`CPL ${fmtMXN(totals.leads ? totals.spend / totals.leads : 0)}`} />
        <Kpi label="Calificados" value={fmtNum(totals.ql)} hint={`CPQL ${fmtMXN(totals.ql ? totals.spend / totals.ql : 0)}`} />
        <Kpi label="Reservas" value={fmtNum(totals.res)} hint="Conversiones cerradas" trend="up" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar campaña…" className="max-w-xs" />
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Plataforma: todas</SelectItem>
            {PLATFORMS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="active">Activas</TabsTrigger>
            <TabsTrigger value="paused">Pausadas</TabsTrigger>
            <TabsTrigger value="ended">Finalizadas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaña</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead>Desarrollo</TableHead>
              <TableHead className="text-right">Presupuesto</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">QL</TableHead>
              <TableHead className="text-right">Citas</TableHead>
              <TableHead className="text-right">Reservas</TableHead>
              <TableHead className="text-right">CPL</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="outline" className={platformTone(c.platform)}>{platformLabel(c.platform)}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{c.development}</TableCell>
                <TableCell className="text-right">{fmtMXN(c.budget)}</TableCell>
                <TableCell className="text-right">{fmtMXN(c.spend)}</TableCell>
                <TableCell className="text-right">{c.leads}</TableCell>
                <TableCell className="text-right">{c.ql}</TableCell>
                <TableCell className="text-right">{c.appts}</TableCell>
                <TableCell className="text-right">{c.reservations}</TableCell>
                <TableCell className="text-right">{fmtMXN(c.leads ? c.spend / c.leads : 0)}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1.5 text-xs capitalize"><StatusDot tone={c.status} />{c.status}</span></TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => toast.info(`Ver ${c.name}`)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{rows.length} campañas · datos simulados</p>
    </div>
  );
}

// ===================================================================
// 2. Audiencias
// ===================================================================
export function CrmAudiences() {
  const [platform, setPlatform] = useState("all");
  const rows = useMemo(() => platform === "all" ? AUDIENCES : AUDIENCES.filter((a) => a.platform === platform), [platform]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audiencias"
        description="Custom, Lookalike y remarketing sincronizadas con cada plataforma"
        actions={
          <div className="flex items-center gap-2">
            <MockBadge />
            <Button size="sm" onClick={() => toast.success("Audiencia creada (mock)")}>
              <Plus className="h-4 w-4 mr-1" />Nueva audiencia
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Audiencias activas" value={String(AUDIENCES.filter((a) => a.status === "ready").length)} />
        <Kpi label="Tamaño total" value={fmtNum(AUDIENCES.reduce((s, a) => s + a.size, 0))} />
        <Kpi label="Plataformas" value={String(new Set(AUDIENCES.map((a) => a.platform)).size)} />
        <Kpi label="Stale" value={String(AUDIENCES.filter((a) => a.status === "stale").length)} hint="Requieren refresh" />
      </div>

      <div className="flex items-center gap-2">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-[200px] h-9 text-sm"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Plataforma: todas</SelectItem>
            {PLATFORMS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.type}</div>
                </div>
                <Badge variant="outline" className={platformTone(a.platform)}>{platformLabel(a.platform)}</Badge>
              </div>
              <div className="text-2xl font-semibold">{fmtNum(a.size)}</div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><StatusDot tone={a.status} />{a.status}</span>
                <span>refresh {relTime(a.refresh)}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => toast.success(`Sincronizando ${a.name}`)}>Sincronizar</Button>
                <Button size="sm" variant="ghost" onClick={() => toast.info(a.name)}><Eye className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// 3. Atribución
// ===================================================================
export function CrmAttribution() {
  const [model, setModel] = useState("first_touch");
  const colKey = model === "first_touch" ? "first"
    : model === "last_touch" ? "last"
    : model === "linear" ? "linear"
    : model === "time_decay" ? "decay" : "ushape";

  const total = ATTRIBUTION_ROWS.reduce((s, r) => s + (r as any)[colKey], 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Atribución"
        description="Comparativa entre modelos · fuente, medio y campaña"
        actions={<MockBadge />}
      />

      <div className="flex items-center gap-2">
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="w-[220px] h-9 text-sm"><SelectValue placeholder="Modelo" /></SelectTrigger>
          <SelectContent>
            {ATTRIBUTION_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">Total atribuido: <b className="text-foreground">{total}</b> conversiones</span>
      </div>

      <Panel title="Comparativa por modelo" description="Atribución de conversiones por fuente">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fuente</TableHead>
                <TableHead className="text-right">First touch</TableHead>
                <TableHead className="text-right">Last touch</TableHead>
                <TableHead className="text-right">Lineal</TableHead>
                <TableHead className="text-right">Time decay</TableHead>
                <TableHead className="text-right">U-shaped</TableHead>
                <TableHead className="text-right">Reservas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ATTRIBUTION_ROWS.map((r) => (
                <TableRow key={r.source}>
                  <TableCell className="font-medium">{r.source}</TableCell>
                  <TableCell className="text-right">{r.first}</TableCell>
                  <TableCell className="text-right">{r.last}</TableCell>
                  <TableCell className="text-right">{r.linear}</TableCell>
                  <TableCell className="text-right">{r.decay}</TableCell>
                  <TableCell className="text-right">{r.ushape}</TableCell>
                  <TableCell className="text-right font-semibold">{r.conversions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <Panel title={`Distribución actual · ${ATTRIBUTION_MODELS.find((m) => m.id === model)?.label}`}>
        <div className="space-y-2">
          {ATTRIBUTION_ROWS.map((r) => {
            const v = (r as any)[colKey] as number;
            const pct = total ? v / total : 0;
            return (
              <div key={r.source}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{r.source}</span>
                  <span className="text-muted-foreground">{v} · {fmtPct(pct)}</span>
                </div>
                <Progress value={pct * 100} className="h-2" />
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ===================================================================
// 4. Creatividades
// ===================================================================
export function CrmCreatives() {
  const [platform, setPlatform] = useState("all");
  const rows = useMemo(() => platform === "all" ? CREATIVES : CREATIVES.filter((c) => c.platform === platform), [platform]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Creatividades"
        description="Performance por pieza · imagen, video y carrusel"
        actions={<MockBadge />}
      />

      <div className="flex items-center gap-2">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-[200px] h-9 text-sm"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Plataforma: todas</SelectItem>
            {PLATFORMS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-3">
              <div className="aspect-video rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
              <div>
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.campaign}</div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <Badge variant="outline" className={platformTone(c.platform)}>{platformLabel(c.platform)}</Badge>
                <Badge variant="outline" className="capitalize">{c.format}</Badge>
                <span className="inline-flex items-center gap-1.5 capitalize"><StatusDot tone={c.status} />{c.status}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1 border-t">
                <div><div className="text-muted-foreground">Impr.</div><div className="font-semibold">{fmtNum(c.impressions)}</div></div>
                <div><div className="text-muted-foreground">CTR</div><div className="font-semibold">{fmtPct(c.ctr, 2)}</div></div>
                <div><div className="text-muted-foreground">Spend</div><div className="font-semibold">{fmtMXN(c.spend)}</div></div>
                <div><div className="text-muted-foreground">Leads</div><div className="font-semibold">{c.leads}</div></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// 5. UTMs
// ===================================================================
export function CrmUtms() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="UTMs"
        description="Tráfico, leads y conversiones agrupados por parámetros UTM"
        actions={
          <div className="flex items-center gap-2">
            <MockBadge />
            <Button size="sm" variant="outline" onClick={() => toast.success("Builder abierto (mock)")}>
              <Link2 className="h-4 w-4 mr-1" />UTM builder
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="UTMs trackeadas" value={String(UTMS.length)} />
        <Kpi label="Sin UTM (problema)" value={String(UTMS.filter((u) => u.health === "error").length)} hint="Tráfico sin atribución" />
        <Kpi label="Sesiones" value={fmtNum(UTMS.reduce((s, u) => s + u.sessions, 0))} />
        <Kpi label="Conversiones" value={fmtNum(UTMS.reduce((s, u) => s + u.conversions, 0))} />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Medium</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Term</TableHead>
              <TableHead className="text-right">Sesiones</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Conv.</TableHead>
              <TableHead>Salud</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {UTMS.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.source}</TableCell>
                <TableCell className="font-mono text-xs">{u.medium}</TableCell>
                <TableCell className="font-mono text-xs">{u.campaign}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{u.content ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{u.term ?? "—"}</TableCell>
                <TableCell className="text-right">{fmtNum(u.sessions)}</TableCell>
                <TableCell className="text-right">{u.leads}</TableCell>
                <TableCell className="text-right">{u.conversions}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1.5 text-xs capitalize"><StatusDot tone={u.health} />{u.health}</span></TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(`utm_source=${u.source}&utm_medium=${u.medium}&utm_campaign=${u.campaign}`); toast.success("UTM copiada"); }}>
                    <Copy className="h-3.5 w-3.5" />
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

// ===================================================================
// 6. A/B Tests
// ===================================================================
export function CrmMarketingAbTests() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="A/B Tests"
        description="Experimentos en landings, formularios y creatividades"
        actions={
          <div className="flex items-center gap-2">
            <MockBadge />
            <Button size="sm" onClick={() => toast.success("Nuevo test (mock)")}>
              <Plus className="h-4 w-4 mr-1" />Nuevo test
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        {AB_TESTS.map((t) => {
          const totalConv = t.variants.reduce((s, v) => s + v.conversions, 0);
          const totalVis = t.variants.reduce((s, v) => s + v.visitors, 0);
          return (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{t.name}</h3>
                      <Badge variant="outline" className="capitalize"><StatusDot tone={t.status} /> <span className="ml-1">{t.status}</span></Badge>
                      {t.winner && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Ganador: {t.winner}</Badge>}
                      {t.uplift != null && t.status !== "draft" && (
                        <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300">+{fmtPct(t.uplift)}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.hypothesis}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">Inició {relTime(t.start)}</div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {t.variants.map((v) => {
                    const cvr = v.visitors ? v.conversions / v.visitors : 0;
                    return (
                      <div key={v.name} className="rounded border p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{v.name}</span>
                          <span className="text-muted-foreground">{fmtNum(v.visitors)} visitas</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-2xl font-semibold">{fmtPct(cvr, 2)}</span>
                          <span className="text-xs text-muted-foreground">{v.conversions} conv.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-muted-foreground">Total: {fmtNum(totalVis)} visitas · {totalConv} conv.</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ===================================================================
// 7. Landing pages
// ===================================================================
export function CrmLandingPages() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Landing pages"
        description="Páginas publicadas conectadas a campañas y formularios"
        actions={
          <div className="flex items-center gap-2">
            <MockBadge />
            <Button size="sm" onClick={() => toast.success("Landing creada (mock)")}>
              <Plus className="h-4 w-4 mr-1" />Nueva landing
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {LANDINGS.map((l) => (
          <Card key={l.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.name}</div>
                  <a href={`https://${l.url}`} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 truncate">
                    {l.url} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <Badge variant={l.published ? "default" : "outline"} className="capitalize">
                  {l.published ? "Publicada" : "Borrador"}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t">
                <div><div className="text-muted-foreground">Visitas</div><div className="font-semibold">{fmtNum(l.visits)}</div></div>
                <div><div className="text-muted-foreground">Conv.</div><div className="font-semibold">{fmtNum(l.conversions)}</div></div>
                <div><div className="text-muted-foreground">CVR</div><div className="font-semibold">{fmtPct(l.cvr, 2)}</div></div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>Última edición {relTime(l.last_edit)}</span>
                <Button size="sm" variant="ghost" onClick={() => toast.info(`Editor de ${l.name}`)}>Editar</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// 8. Formularios
// ===================================================================
export function CrmForms() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Formularios"
        description="Submits, CVR y mapeo a campos del CRM"
        actions={
          <div className="flex items-center gap-2">
            <MockBadge />
            <Button size="sm" onClick={() => toast.success("Formulario creado (mock)")}>
              <Plus className="h-4 w-4 mr-1" />Nuevo formulario
            </Button>
          </div>
        }
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Formulario</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Landing</TableHead>
              <TableHead className="text-right">Submits</TableHead>
              <TableHead className="text-right">CVR</TableHead>
              <TableHead className="text-right">Spam</TableHead>
              <TableHead>Mapeo CRM</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {FORMS.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{f.type}</Badge></TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{f.landing}</TableCell>
                <TableCell className="text-right">{fmtNum(f.submits)}</TableCell>
                <TableCell className="text-right">{fmtPct(f.cvr, 2)}</TableCell>
                <TableCell className="text-right">{fmtPct(f.spam_rate, 1)}</TableCell>
                <TableCell>
                  {f.mapped
                    ? <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs"><CheckCircle2 className="h-3.5 w-3.5" />Mapeado</span>
                    : <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 text-xs"><AlertTriangle className="h-3.5 w-3.5" />Sin mapear</span>}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => toast.info(f.name)}><Eye className="h-3.5 w-3.5" /></Button>
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
// 9. Integraciones de ads
// ===================================================================
export function CrmAdIntegrations() {
  const [items, setItems] = useState(INTEGRATIONS);
  const toggle = (id: string) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: i.status === "connected" ? "disconnected" : "connected" } : i));
    toast.success("Estado actualizado");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Integraciones de ads"
        description="OAuth y CAPI con cada plataforma · sincronización en vivo"
        actions={<MockBadge />}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((i) => (
          <Card key={i.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Plug className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{i.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Cuenta: <span className="font-mono">{i.account}</span></div>
                </div>
                <Badge variant="outline" className={platformTone(i.platform)}>{platformLabel(i.platform)}</Badge>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-xs">
                  <div className="inline-flex items-center gap-1.5 capitalize"><StatusDot tone={i.status} />{i.status}</div>
                  <div className="text-muted-foreground mt-0.5">Última sync {relTime(i.last_sync)} · {fmtNum(i.events_30d)} eventos 30d</div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={i.status === "connected"} onCheckedChange={() => toggle(i.id)} />
                  <Button size="sm" variant="outline" onClick={() => toast.success("Reautenticando…")}>Reconectar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// 10. Costos y presupuesto
// ===================================================================
export function CrmBudget() {
  const totals = useMemo(() => ({
    budget: BUDGET_ROWS.reduce((s, r) => s + r.budget, 0),
    spend: BUDGET_ROWS.reduce((s, r) => s + r.spend, 0),
    leads: BUDGET_ROWS.reduce((s, r) => s + r.leads, 0),
    res: BUDGET_ROWS.reduce((s, r) => s + r.reservations, 0),
  }), []);
  const pacing = totals.budget ? totals.spend / totals.budget : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Costos y presupuesto"
        description="Pacing por desarrollo · CPL, CPQL y costo por reserva"
        actions={<MockBadge />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Presupuesto total" value={fmtMXN(totals.budget)} />
        <Kpi label="Gasto acumulado" value={fmtMXN(totals.spend)} hint={`Pacing ${fmtPct(pacing)}`} trend={pacing > 0.9 ? "up" : null} />
        <Kpi label="CPL global" value={fmtMXN(totals.leads ? totals.spend / totals.leads : 0)} />
        <Kpi label="Costo por reserva" value={fmtMXN(totals.res ? totals.spend / totals.res : 0)} />
      </div>

      <Panel title="Pacing por desarrollo">
        <div className="space-y-4">
          {BUDGET_ROWS.map((r) => {
            const p = r.budget ? r.spend / r.budget : 0;
            return (
              <div key={r.development}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{r.development}</span>
                  <span className="text-muted-foreground">{fmtMXN(r.spend)} / {fmtMXN(r.budget)} · {fmtPct(p)}</span>
                </div>
                <Progress value={p * 100} className="h-2" />
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                  <span>CPL {fmtMXN(r.leads ? r.spend / r.leads : 0)}</span>
                  <span>Leads {r.leads}</span>
                  <span>Reservas {r.reservations}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Detalle">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Desarrollo</TableHead>
                <TableHead className="text-right">Presupuesto</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Pacing</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead className="text-right">Reservas</TableHead>
                <TableHead className="text-right">Costo / reserva</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BUDGET_ROWS.map((r) => (
                <TableRow key={r.development}>
                  <TableCell className="font-medium">{r.development}</TableCell>
                  <TableCell className="text-right">{fmtMXN(r.budget)}</TableCell>
                  <TableCell className="text-right">{fmtMXN(r.spend)}</TableCell>
                  <TableCell className="text-right">{fmtPct(r.budget ? r.spend / r.budget : 0)}</TableCell>
                  <TableCell className="text-right">{r.leads}</TableCell>
                  <TableCell className="text-right">{fmtMXN(r.leads ? r.spend / r.leads : 0)}</TableCell>
                  <TableCell className="text-right">{r.reservations}</TableCell>
                  <TableCell className="text-right">{r.reservations ? fmtMXN(r.spend / r.reservations) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}

// ===================================================================
// CrmMarketingPerformance
// ===================================================================
export function CrmMarketingPerformance() {
  const [range, setRange] = useState<DateRange>("30d");

  const totals = useMemo(() => {
    const active = CAMPAIGNS.filter(c => c.status !== "ended");
    const totalSpend = CAMPAIGNS.reduce((s, c) => s + c.spend, 0);
    const totalLeads = CAMPAIGNS.reduce((s, c) => s + c.leads, 0);
    const totalQL = CAMPAIGNS.reduce((s, c) => s + c.ql, 0);
    const totalAppts = CAMPAIGNS.reduce((s, c) => s + c.appts, 0);
    const totalRes = CAMPAIGNS.reduce((s, c) => s + c.reservations, 0);
    return {
      active: active.length,
      totalSpend, totalLeads, totalQL, totalAppts, totalRes,
      cpl: totalLeads ? totalSpend / totalLeads : 0,
      cpql: totalQL ? totalSpend / totalQL : 0,
      cpAppt: totalAppts ? totalSpend / totalAppts : 0,
      cpRes: totalRes ? totalSpend / totalRes : 0,
      qlRate: totalLeads ? totalQL / totalLeads : 0,
      apptRate: totalQL ? totalAppts / totalQL : 0,
      resRate: totalAppts ? totalRes / totalAppts : 0,
    };
  }, []);

  const KPIS = [
    { label: "Gasto total", value: fmtMXN(totals.totalSpend) },
    { label: "Campañas activas", value: fmtNum(totals.active) },
    { label: "Leads", value: fmtNum(totals.totalLeads) },
    { label: "Leads calificados", value: fmtNum(totals.totalQL) },
    { label: "Citas", value: fmtNum(totals.totalAppts) },
    { label: "Apartados", value: fmtNum(totals.totalRes) },
    { label: "CPL", value: fmtMXN(totals.cpl) },
    { label: "CPQL", value: fmtMXN(totals.cpql) },
    { label: "Costo/Cita", value: fmtMXN(totals.cpAppt) },
    { label: "Costo/Apartado", value: totals.totalRes ? fmtMXN(totals.cpRes) : "—" },
    { label: "Tasa calificación", value: fmtPct(totals.qlRate) },
    { label: "Lead→Cita", value: fmtPct(totals.apptRate) },
  ];

  const ranked = [...CAMPAIGNS].sort((a, b) => {
    const scoreFn = (c: Campaign) => c.leads ? (c.reservations * 3 + c.appts * 1.5 + c.ql * 0.5) / (c.spend / 1000) : 0;
    return scoreFn(b) - scoreFn(a);
  });
  const top3 = ranked.slice(0, 3);
  const bot3 = [...ranked].reverse().slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader title="Resumen de desempeño" subtitle="KPIs consolidados de marketing">
        <MockBadge />
        <Select value={range} onValueChange={v => setRange(v as DateRange)}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.entries(RANGE_LABEL) as [DateRange,string][]).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPIS.map(k => (
          <Card key={k.label} className="p-3">
            <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
            <p className="text-lg font-bold mt-0.5">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><TrendingUp className="w-4 h-4 text-emerald-500" />Top 3 campañas</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {top3.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">{i+1}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <Badge className={`text-[10px] ${platformTone(c.platform)}`}>{platformLabel(c.platform)}</Badge>
                  <span className="text-xs text-muted-foreground">{c.reservations} apart.</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><TrendingDown className="w-4 h-4 text-red-500" />Bottom 3 campañas</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bot3.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-red-500/15 text-red-700 dark:text-red-400 flex items-center justify-center text-xs font-bold">{i+1}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <Badge className={`text-[10px] ${platformTone(c.platform)}`}>{platformLabel(c.platform)}</Badge>
                  <span className="text-xs text-muted-foreground">{fmtMXN(c.leads ? c.spend/c.leads : 0)} CPL</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===================================================================
// CrmMetaAds
// ===================================================================
export function CrmMetaAds() {
  const metaCampaigns = CAMPAIGNS.filter(c => c.platform === "meta_ads");

  return (
    <div className="space-y-4">
      <PageHeader title="Meta Ads" subtitle="Campañas activas en Facebook / Instagram">
        <MockBadge />
        <Button size="sm" variant="outline" onClick={() => toast.info("Sync Meta Ads (mock)")}>
          <RefreshCw className="w-4 h-4 mr-1" />Sincronizar
        </Button>
      </PageHeader>

      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2 text-sm">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-400">Conexión en modo mock</p>
          <p className="text-amber-700 dark:text-amber-500 text-xs mt-0.5">Para conectar Meta Ads en vivo, configura las credenciales en <strong>Ajustes → Conexiones</strong>.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Campañas activas", value: metaCampaigns.filter(c=>c.status==="active").length },
          { label: "Gasto total", value: fmtMXN(metaCampaigns.reduce((s,c)=>s+c.spend,0)) },
          { label: "Leads", value: metaCampaigns.reduce((s,c)=>s+c.leads,0) },
        ].map(k => (
          <Card key={k.label} className="p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-xl font-bold mt-0.5">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Campaña</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead className="text-right">Presupuesto</TableHead>
            <TableHead className="text-right">Gasto</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">QL</TableHead>
            <TableHead className="text-right">CPL</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {metaCampaigns.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-sm truncate max-w-[200px]">{c.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{c.status}</Badge></TableCell>
                <TableCell className="text-right text-sm">{fmtMXN(c.budget)}</TableCell>
                <TableCell className="text-right text-sm">{fmtMXN(c.spend)}</TableCell>
                <TableCell className="text-right text-sm">{c.leads}</TableCell>
                <TableCell className="text-right text-sm">{c.ql}</TableCell>
                <TableCell className="text-right text-sm">{c.leads ? fmtMXN(c.spend/c.leads) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ===================================================================
// CrmGoogleAds
// ===================================================================
export function CrmGoogleAds() {
  const googleCampaigns = CAMPAIGNS.filter(c => c.platform === "google_ads");

  return (
    <div className="space-y-4">
      <PageHeader title="Google Ads" subtitle="Campañas activas en Google Search / Display">
        <MockBadge />
        <Button size="sm" variant="outline" onClick={() => toast.info("Sync Google Ads (mock)")}>
          <RefreshCw className="w-4 h-4 mr-1" />Sincronizar
        </Button>
      </PageHeader>

      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2 text-sm">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-400">Conexión en modo mock</p>
          <p className="text-amber-700 dark:text-amber-500 text-xs mt-0.5">Para conectar Google Ads en vivo, configura las credenciales en <strong>Ajustes → Conexiones</strong>.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Campañas activas", value: googleCampaigns.filter(c=>c.status==="active").length },
          { label: "Gasto total", value: fmtMXN(googleCampaigns.reduce((s,c)=>s+c.spend,0)) },
          { label: "Leads", value: googleCampaigns.reduce((s,c)=>s+c.leads,0) },
        ].map(k => (
          <Card key={k.label} className="p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-xl font-bold mt-0.5">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Campaña</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead className="text-right">Presupuesto</TableHead>
            <TableHead className="text-right">Gasto</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">QL</TableHead>
            <TableHead className="text-right">CPL</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {googleCampaigns.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-sm truncate max-w-[200px]">{c.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{c.status}</Badge></TableCell>
                <TableCell className="text-right text-sm">{fmtMXN(c.budget)}</TableCell>
                <TableCell className="text-right text-sm">{fmtMXN(c.spend)}</TableCell>
                <TableCell className="text-right text-sm">{c.leads}</TableCell>
                <TableCell className="text-right text-sm">{c.ql}</TableCell>
                <TableCell className="text-right text-sm">{c.leads ? fmtMXN(c.spend/c.leads) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ===================================================================
// CrmMarketingDevelopments
// ===================================================================
export function CrmMarketingDevelopments() {
  const byDev = useMemo(() => {
    const map: Record<string, { dev: string; campaigns: Campaign[] }> = {};
    for (const c of CAMPAIGNS) {
      if (!map[c.development]) map[c.development] = { dev: c.development, campaigns: [] };
      map[c.development].campaigns.push(c);
    }
    return Object.values(map).map(({ dev, campaigns }) => {
      const spend = campaigns.reduce((s,c)=>s+c.spend,0);
      const leads = campaigns.reduce((s,c)=>s+c.leads,0);
      const ql = campaigns.reduce((s,c)=>s+c.ql,0);
      const appts = campaigns.reduce((s,c)=>s+c.appts,0);
      const res = campaigns.reduce((s,c)=>s+c.reservations,0);
      return { dev, spend, leads, ql, appts, res, cpl: leads?spend/leads:0, cpql: ql?spend/ql:0 };
    });
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Por desarrollo" subtitle="Performance de marketing segmentado por proyecto">
        <MockBadge />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {byDev.map(d => (
          <Card key={d.dev} className="p-4">
            <p className="text-sm font-semibold truncate mb-3">{d.dev}</p>
            <div className="space-y-2">
              {[
                { label: "Gasto", value: fmtMXN(d.spend), bar: null },
                { label: "Leads", value: fmtNum(d.leads), bar: d.leads },
                { label: "QL", value: fmtNum(d.ql), bar: d.ql },
                { label: "Citas", value: fmtNum(d.appts), bar: d.appts },
                { label: "Apartados", value: fmtNum(d.res), bar: d.res },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">{row.label}</span>
                  {row.bar != null && <Progress value={Math.min(100, (row.bar / Math.max(1, d.leads)) * 100)} className="flex-1 h-1.5" />}
                  <span className="text-xs font-medium ml-auto">{row.value}</span>
                </div>
              ))}
            </div>
            <Separator className="my-2" />
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>CPL: <strong className="text-foreground">{fmtMXN(d.cpl)}</strong></span>
              <span>CPQL: <strong className="text-foreground">{fmtMXN(d.cpql)}</strong></span>
            </div>
          </Card>
        ))}
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Desarrollo</TableHead>
            <TableHead className="text-right">Gasto</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">QL</TableHead>
            <TableHead className="text-right">Citas</TableHead>
            <TableHead className="text-right">Apartados</TableHead>
            <TableHead className="text-right">CPL</TableHead>
            <TableHead className="text-right">CPQL</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {byDev.map(d => (
              <TableRow key={d.dev}>
                <TableCell className="font-medium text-sm">{d.dev}</TableCell>
                <TableCell className="text-right text-sm">{fmtMXN(d.spend)}</TableCell>
                <TableCell className="text-right text-sm">{d.leads}</TableCell>
                <TableCell className="text-right text-sm">{d.ql}</TableCell>
                <TableCell className="text-right text-sm">{d.appts}</TableCell>
                <TableCell className="text-right text-sm">{d.res}</TableCell>
                <TableCell className="text-right text-sm">{fmtMXN(d.cpl)}</TableCell>
                <TableCell className="text-right text-sm">{d.ql ? fmtMXN(d.cpql) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ===================================================================
// CrmMarketingFunnel
// ===================================================================
export function CrmMarketingFunnel() {
  const [platform, setPlatform] = useState<string>("all");
  const [development, setDevelopment] = useState<string>("all");

  const filtered = useMemo(() => CAMPAIGNS.filter(c =>
    (platform === "all" || c.platform === platform) &&
    (development === "all" || c.development === development)
  ), [platform, development]);

  const totals = useMemo(() => ({
    leads: filtered.reduce((s,c)=>s+c.leads,0),
    ql: filtered.reduce((s,c)=>s+c.ql,0),
    appts: filtered.reduce((s,c)=>s+c.appts,0),
    res: filtered.reduce((s,c)=>s+c.reservations,0),
  }), [filtered]);

  const devOptions = [...new Set(CAMPAIGNS.map(c => c.development))];

  const STAGES = [
    { label: "Leads captados", value: totals.leads, color: "bg-blue-500" },
    { label: "Leads calificados", value: totals.ql, color: "bg-violet-500" },
    { label: "Citas realizadas", value: totals.appts, color: "bg-amber-500" },
    { label: "Apartados", value: totals.res, color: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Embudo Mkt → CRM" subtitle="Conversión por etapa desde campaña hasta apartado">
        <MockBadge />
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las plataformas</SelectItem>
            {PLATFORMS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={development} onValueChange={setDevelopment}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Desarrollo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los desarrollos</SelectItem>
            {devOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {STAGES.map((stage, i) => {
          const pct = i === 0 ? 100 : totals.leads ? (stage.value / totals.leads) * 100 : 0;
          const prevStage = i > 0 ? STAGES[i-1] : null;
          const stepConv = prevStage && prevStage.value ? (stage.value / prevStage.value * 100) : null;
          return (
            <div key={stage.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{stage.label}</span>
                <div className="flex items-center gap-3">
                  {stepConv != null && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />{fmtPct(stepConv/100)} desde etapa anterior
                    </span>
                  )}
                  <span className="font-bold">{fmtNum(stage.value)}</span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
                <div className={`h-full ${stage.color} rounded-full flex items-center justify-end pr-2 transition-all`} style={{ width: `${Math.max(2, pct)}%` }}>
                  <span className="text-[10px] text-white font-medium">{fmtPct(pct/100)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {[
          { label: "Calificación", value: totals.leads ? fmtPct(totals.ql/totals.leads) : "—" },
          { label: "Lead→Cita", value: totals.ql ? fmtPct(totals.appts/totals.ql) : "—" },
          { label: "Cita→Apartado", value: totals.appts ? fmtPct(totals.res/totals.appts) : "—" },
          { label: "Lead→Apartado", value: totals.leads ? fmtPct(totals.res/totals.leads) : "—" },
        ].map(k => (
          <Card key={k.label} className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-xl font-bold mt-0.5">{k.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// CrmMarketingCampaignMapping
// ===================================================================
export function CrmMarketingCampaignMapping() {
  const orgId = useCrmOrgId();
  const [search, setSearch] = useState("");

  const { data: dbCampaigns = [], isLoading } = useQuery({
    queryKey: ["crm-campaigns-mapping", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_campaigns")
        .select("id,name,platform,status,external_campaign_id,utm_source,utm_medium,utm_campaign,created_at").eq("organization_id", orgId).limit(100);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const display = dbCampaigns.length ? dbCampaigns : CAMPAIGNS.map(c => ({
    id: c.id, name: c.name, platform: c.platform, status: c.status,
    external_campaign_id: `ext_${c.id}`, utm_source: c.platform.replace("_ads",""),
    utm_medium: "cpc", utm_campaign: c.name.toLowerCase().replace(/\s+/g,"-"),
    created_at: c.start, isMock: true,
  }));

  const filtered = display.filter((c: any) => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.utm_campaign?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader title="Mapeo de campañas" subtitle="Mapeo de IDs externos y UTMs por campaña">
        <MockBadge />
      </PageHeader>

      {dbCampaigns.length === 0 && (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />Mostrando datos mock. Tabla <code>crm_campaigns</code> no encontrada o vacía.
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar campaña…" className="w-full h-8 pl-8 pr-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Campaña</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>ID externo</TableHead>
            <TableHead>utm_source</TableHead>
            <TableHead>utm_medium</TableHead>
            <TableHead>utm_campaign</TableHead>
            <TableHead>Estatus</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({length:5}).map((_,i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin campañas</TableCell></TableRow>
            ) : filtered.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-sm max-w-[180px] truncate">{c.name}</TableCell>
                <TableCell><Badge className={`text-[10px] ${platformTone(c.platform)}`}>{platformLabel(c.platform)}</Badge></TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{c.external_campaign_id ?? "—"}</TableCell>
                <TableCell className="text-xs">{c.utm_source ?? "—"}</TableCell>
                <TableCell className="text-xs">{c.utm_medium ?? "—"}</TableCell>
                <TableCell className="text-xs max-w-[140px] truncate">{c.utm_campaign ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{c.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ===================================================================
// CrmMarketingSyncJobs
// ===================================================================
export function CrmMarketingSyncJobs() {
  const orgId = useCrmOrgId();
  const [detailJob, setDetailJob] = useState<any>(null);

  const { data: jobs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["crm-sync-jobs", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_sync_jobs")
        .select("id,connector_key,status,started_at,finished_at,rows_synced,error_message,payload").eq("organization_id", orgId)
        .order("started_at", { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const MOCK_JOBS = [
    { id: "j1", connector_key: "meta_ads", status: "success", started_at: new Date(Date.now()-2*3600000).toISOString(), finished_at: new Date(Date.now()-2*3600000+45000).toISOString(), rows_synced: 142, error_message: null, payload: { campaigns_fetched: 5, leads_fetched: 142 } },
    { id: "j2", connector_key: "google_ads", status: "success", started_at: new Date(Date.now()-3*3600000).toISOString(), finished_at: new Date(Date.now()-3*3600000+30000).toISOString(), rows_synced: 87, error_message: null, payload: { campaigns_fetched: 3, conversions_fetched: 87 } },
    { id: "j3", connector_key: "meta_ads", status: "error", started_at: new Date(Date.now()-26*3600000).toISOString(), finished_at: new Date(Date.now()-26*3600000+2000).toISOString(), rows_synced: 0, error_message: "Token expired: OAuthException code 190", payload: null },
  ];

  const display = jobs.length ? jobs : MOCK_JOBS;

  const STATUS_TONE: Record<string, string> = {
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    error: "bg-red-500/15 text-red-700 dark:text-red-400",
    running: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    pending: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Sincronizaciones" subtitle="Historial de jobs de sincronización con plataformas">
        <MockBadge />
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />Refrescar
        </Button>
        <Button size="sm" onClick={() => toast.info("Re-sync manual (mock)")}>
          <Play className="w-4 h-4 mr-1" />Forzar sync
        </Button>
      </PageHeader>

      {jobs.length === 0 && (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground flex items-center gap-2">
          <Database className="w-4 h-4 shrink-0" />Mostrando datos mock. Tabla <code>crm_sync_jobs</code> no encontrada o vacía.
        </div>
      )}

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Conector</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead className="text-right">Filas</TableHead>
            <TableHead>Error</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({length:3}).map((_,i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
            ) : display.map((j: any) => {
              const durSec = j.started_at && j.finished_at ? Math.round((new Date(j.finished_at).getTime() - new Date(j.started_at).getTime()) / 1000) : null;
              return (
                <TableRow key={j.id}>
                  <TableCell className="font-medium text-sm">{j.connector_key}</TableCell>
                  <TableCell><Badge className={`text-xs ${STATUS_TONE[j.status ?? "pending"]}`}>{j.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDateTime(j.started_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{durSec != null ? `${durSec}s` : "—"}</TableCell>
                  <TableCell className="text-right text-sm">{j.rows_synced ?? "—"}</TableCell>
                  <TableCell className="text-xs text-red-500 max-w-[200px] truncate">{j.error_message ?? "—"}</TableCell>
                  <TableCell>
                    {j.payload && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDetailJob(j)}>
                        <BarChart2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detailJob} onOpenChange={() => setDetailJob(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle del job — {detailJob?.connector_key}</DialogTitle></DialogHeader>
          <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-64 whitespace-pre-wrap">
            {JSON.stringify(detailJob?.payload, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}