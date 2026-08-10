// Módulo Meta Ads (CRM portal) — Fase 1.
// Un solo screen con pestañas: Vistas (Campañas, Atribución) + Configuración
// (Eventos de conversión gestionable, Conexión). Montado en /marketing/meta.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lifecycleLabel } from "@/lib/crm-lib";
import { toast } from "sonner";
import { AlertTriangle, Plus, Pencil, Plug, Database, Zap, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/admin/portal-crm/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CrmMetaAds } from "./marketing";
import { type MetaCampaign } from "@/lib/meta-ads-client";

const LIFECYCLE_ORDER = ["lead", "mql", "sql", "opportunity", "customer", "evangelist"];

// ============================================================
// Panel: Eventos de conversión (gestionable)
// ============================================================
type StageRow = { id?: number; etapa_ciclo_vida: string; meta_event_name: string; activo: boolean; orden: number };

// Fallback cuando la tabla crm_meta_conversion_stages aún no existe (pre-migración).
const DEFAULT_STAGES: StageRow[] = [
  { etapa_ciclo_vida: "lead", meta_event_name: "lead", activo: false, orden: 10 },
  { etapa_ciclo_vida: "mql", meta_event_name: "mql", activo: true, orden: 20 },
  { etapa_ciclo_vida: "sql", meta_event_name: "sql", activo: false, orden: 30 },
  { etapa_ciclo_vida: "opportunity", meta_event_name: "opportunity", activo: false, orden: 40 },
  { etapa_ciclo_vida: "customer", meta_event_name: "purchase", activo: false, orden: 50 },
];

function EventosPanel() {
  const qc = useQueryClient();
  const [missing, setMissing] = useState(false);
  const [edit, setEdit] = useState<StageRow | null>(null);
  const [editVal, setEditVal] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newStage, setNewStage] = useState("lead");
  const [newEvent, setNewEvent] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["crm-meta-conversion-stages"],
    queryFn: async (): Promise<StageRow[]> => {
      const { data, error } = await (supabase as any)
        .from("crm_meta_conversion_stages")
        .select("id, etapa_ciclo_vida, meta_event_name, activo, orden")
        .order("orden");
      if (error) { setMissing(true); return DEFAULT_STAGES; }
      setMissing(false);
      return (data ?? []) as StageRow[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-meta-conversion-stages"] });
  const needMigration = () => toast.info("Corre la migración crm_meta_conversion_stages para guardar cambios");

  const toggle = async (r: StageRow) => {
    if (missing || !r.id) return needMigration();
    const { error } = await (supabase as any).from("crm_meta_conversion_stages")
      .update({ activo: !r.activo }).eq("id", r.id);
    if (error) toast.error(error.message); else { toast.success("Actualizado"); refresh(); }
  };
  const saveEdit = async () => {
    if (!edit) return;
    if (missing || !edit.id) { setEdit(null); return needMigration(); }
    const { error } = await (supabase as any).from("crm_meta_conversion_stages")
      .update({ meta_event_name: editVal.trim() }).eq("id", edit.id);
    if (error) toast.error(error.message); else { toast.success("Guardado"); setEdit(null); refresh(); }
  };
  const addStage = async () => {
    if (missing) { setAddOpen(false); return needMigration(); }
    const orden = Math.max(0, ...rows.map((r) => r.orden)) + 10;
    const { error } = await (supabase as any).from("crm_meta_conversion_stages")
      .insert({ etapa_ciclo_vida: newStage, meta_event_name: newEvent.trim() || newStage, activo: true, orden });
    if (error) toast.error(error.message);
    else { toast.success("Etapa agregada"); setAddOpen(false); setNewEvent(""); refresh(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300/60">
            Configuración · gestionable
          </Badge>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Qué etapa del CRM le avisa a Meta (Conversions API). El asesor mueve la etapa del lead → se manda el evento.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" />Agregar etapa</Button>
      </div>

      {missing && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-amber-800 dark:text-amber-400">
            Mostrando configuración por defecto. Corre la migración <code>crm_meta_conversion_stages</code> para poder editar y guardar.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Etapa del CRM</TableHead>
            <TableHead />
            <TableHead>Evento en Meta</TableHead>
            <TableHead className="text-center">Envía</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
              ))
            ) : rows.map((r) => (
              <TableRow key={r.id ?? r.etapa_ciclo_vida} className={r.etapa_ciclo_vida === "mql" ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}>
                <TableCell className="font-medium">
                  {lifecycleLabel[r.etapa_ciclo_vida] ?? r.etapa_ciclo_vida}
                  {r.etapa_ciclo_vida === "mql" && (
                    <Badge className="ml-2 text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent uppercase">Prioridad</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-center w-8">→</TableCell>
                <TableCell className="font-mono text-xs text-primary">{r.meta_event_name}</TableCell>
                <TableCell className="text-center">
                  <Switch checked={r.activo} onCheckedChange={() => toggle(r)} />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setEditVal(r.meta_event_name); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar evento de Meta</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Etapa: <b>{edit && (lifecycleLabel[edit.etapa_ciclo_vida] ?? edit.etapa_ciclo_vida)}</b></p>
            <Input value={editVal} onChange={(e) => setEditVal(e.target.value)} placeholder="event_name (ej. mql)" />
            <p className="text-xs text-muted-foreground">Debe coincidir EXACTO con el evento configurado en Events Manager de Meta.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar etapa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Etapa del CRM</p>
              <Select value={newStage} onValueChange={setNewStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_ORDER.map((s) => <SelectItem key={s} value={s}>{lifecycleLabel[s] ?? s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Evento en Meta</p>
              <Input value={newEvent} onChange={(e) => setNewEvent(e.target.value)} placeholder={newStage} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addStage}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Panel: Atribución / embudo + ROI
// Cruza el GASTO real de Meta (Edge Function meta-ads-insights) con los
// LEADS que ya entraron al CRM (crm_leads_atribucion), por campaña.
// ============================================================
type InsightsResp = {
  configured: boolean;
  campaigns: MetaCampaign[];
  account: { name: string; currency: string; id: string } | null;
  error?: string;
};
type CrmAtrRow = { meta_campaign_id: string | null; etapa_ciclo_vida: string };

const MQL_IDX = LIFECYCLE_ORDER.indexOf("mql");
const FUNNEL_STAGES = LIFECYCLE_ORDER.filter((s) => s !== "evangelist");
const mxn0 = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const int = (n: number) => n.toLocaleString("es-MX");

function AtribucionPanel() {
  // Gasto de campañas (mismo queryKey/queryFn que la pestaña Campañas → comparte caché, no re-llama al edge).
  const { data: insights, isLoading: loadingSpend, error: spendError } = useQuery<InsightsResp, { message: string }>({
    queryKey: ["meta-ads-insights"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).functions.invoke("meta-ads-insights", { body: {} });
      if (error) throw { message: error.message };
      if (data?.error) throw { message: data.error };
      return data;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // Leads de Meta que ya entraron al CRM (etapa actual del ciclo de vida).
  const { data: crm, isLoading: loadingCrm } = useQuery({
    queryKey: ["crm-meta-atribucion"],
    queryFn: async (): Promise<{ rows: CrmAtrRow[]; missing: boolean }> => {
      const { data, error } = await (supabase as any)
        .from("crm_leads_atribucion")
        .select("meta_campaign_id, etapa_ciclo_vida")
        .not("meta_leadgen_id", "is", null)
        .eq("activo", true);
      if (error) return { rows: [], missing: true };
      return { rows: (data ?? []) as CrmAtrRow[], missing: false };
    },
  });

  const isLoading = loadingSpend || loadingCrm;
  const crmRows = crm?.rows ?? [];
  const campaigns = insights?.campaigns ?? [];

  const { rows, totals, funnel } = useMemo(() => {
    // Agregar CRM por campaña + embudo acumulado (un lead en etapa i cuenta en todas las etapas <= i).
    const byCampaign = new Map<string, { leadsCrm: number; mql: number }>();
    const funnelCounts: Record<string, number> = {};
    for (const r of crmRows) {
      const key = r.meta_campaign_id ?? "__none__";
      const idx = Math.max(0, LIFECYCLE_ORDER.indexOf(r.etapa_ciclo_vida));
      const agg = byCampaign.get(key) ?? { leadsCrm: 0, mql: 0 };
      agg.leadsCrm += 1;
      if (idx >= MQL_IDX) agg.mql += 1;
      byCampaign.set(key, agg);
      for (let j = 0; j <= idx; j++) funnelCounts[LIFECYCLE_ORDER[j]] = (funnelCounts[LIFECYCLE_ORDER[j]] ?? 0) + 1;
    }

    const campMap = new Map(campaigns.map((c) => [c.id, c]));
    const ids = new Set<string>([...campMap.keys(), ...[...byCampaign.keys()].filter((k) => k !== "__none__")]);

    const out = [...ids].map((id) => {
      const c = campMap.get(id);
      const agg = byCampaign.get(id) ?? { leadsCrm: 0, mql: 0 };
      const spend = c ? c.spend : null;
      const metaLeads = c ? c.leads : null;
      return {
        id,
        name: c?.name ?? id,
        spend,
        metaLeads,
        leadsCrm: agg.leadsCrm,
        mql: agg.mql,
        cpl: spend != null && metaLeads ? spend / metaLeads : null,
        costPerMql: spend != null && agg.mql > 0 ? spend / agg.mql : null,
      };
    });

    const none = byCampaign.get("__none__");
    if (none && none.leadsCrm > 0) {
      out.push({ id: "__none__", name: "Sin campaña / orgánico", spend: null, metaLeads: null, leadsCrm: none.leadsCrm, mql: none.mql, cpl: null, costPerMql: null });
    }
    out.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0) || b.leadsCrm - a.leadsCrm);

    const tSpend = out.reduce((s, r) => s + (r.spend ?? 0), 0);
    const tMetaLeads = out.reduce((s, r) => s + (r.metaLeads ?? 0), 0);
    const tLeadsCrm = out.reduce((s, r) => s + r.leadsCrm, 0);
    const tMql = out.reduce((s, r) => s + r.mql, 0);
    const totals = {
      spend: tSpend, metaLeads: tMetaLeads, leadsCrm: tLeadsCrm, mql: tMql,
      cpl: tMetaLeads ? tSpend / tMetaLeads : null,
      costPerMql: tMql ? tSpend / tMql : null,
    };

    const top = funnelCounts[LIFECYCLE_ORDER[0]] ?? 0;
    const funnelOut = FUNNEL_STAGES.map((s) => {
      const count = funnelCounts[s] ?? 0;
      return { stage: s, count, pct: top ? (count / top) * 100 : 0 };
    });

    return { rows: out, totals, funnel: funnelOut };
  }, [crmRows, campaigns]);

  const spendUnavailable = !!spendError || insights?.configured === false;
  const nothing = !isLoading && rows.length === 0;

  return (
    <div className="space-y-4">
      <Badge variant="outline" className="text-primary border-primary/40">ROI · gasto de Meta × etapas del CRM</Badge>

      {spendUnavailable && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-amber-800 dark:text-amber-400">
            Aún sin conexión al gasto de Meta (columnas de gasto en "—"). El embudo del CRM sí se muestra.
          </p>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : nothing ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
          Aún no hay campañas ni leads de Meta que mostrar. En cuanto haya gasto en campañas y entren leads por el webhook, aquí verás el ROI por campaña y el embudo.
        </CardContent></Card>
      ) : (
        <>
          <div className="rounded-md border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Campaña</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Leads (Meta)</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead className="text-right">En CRM</TableHead>
                <TableHead className="text-right">MQL</TableHead>
                <TableHead className="text-right">Costo/MQL</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium max-w-[240px] truncate" title={r.name}>{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.spend != null ? mxn0(r.spend) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.metaLeads != null ? int(r.metaLeads) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.cpl != null ? mxn0(r.cpl) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{int(r.leadsCrm)}</TableCell>
                    <TableCell className="text-right tabular-nums">{int(r.mql)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-primary">{r.costPerMql != null ? mxn0(r.costPerMql) : "—"}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold bg-muted/30">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{mxn0(totals.spend)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(totals.metaLeads)}</TableCell>
                  <TableCell className="text-right tabular-nums">{totals.cpl != null ? mxn0(totals.cpl) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(totals.leadsCrm)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(totals.mql)}</TableCell>
                  <TableCell className="text-right tabular-nums text-primary">{totals.costPerMql != null ? mxn0(totals.costPerMql) : "—"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Embudo · leads de Meta en el CRM</h4>
            <div className="space-y-2">
              {funnel.map((f) => (
                <div key={f.stage}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{lifecycleLabel[f.stage] ?? f.stage}</span>
                    <span className="text-muted-foreground">{int(f.count)} · {Math.round(f.pct)}%</span>
                  </div>
                  <Progress value={f.pct} className="h-2" />
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <b>Gasto</b>, <b>Leads (Meta)</b> y <b>CPL</b> = reportado por Meta (últimos 30 días). <b>En CRM</b>, <b>MQL</b> y <b>Costo/MQL</b> = leads de Meta que ya entraron al CRM; se llenan conforme lleguen los leads reales.
          </p>
        </>
      )}
    </div>
  );
}

// ============================================================
// Panel: Conexión / Salud (estado real de la integración)
// Entrada (Meta→CRM, webhook) + Salida (CRM→Meta, CAPI), con datos vivos.
// ============================================================
function ConexionPanel() {
  // Cuenta publicitaria (reusa el queryKey de insights → comparte caché con Campañas/Atribución).
  const { data: insights } = useQuery<InsightsResp, { message: string }>({
    queryKey: ["meta-ads-insights"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).functions.invoke("meta-ads-insights", { body: {} });
      if (error) throw { message: error.message };
      if (data?.error) throw { message: data.error };
      return data;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // Salud de la sincronización (entrada) y de la señal CAPI (salida).
  const { data: health, isLoading } = useQuery({
    queryKey: ["crm-meta-conexion-salud"],
    queryFn: async () => {
      const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
      const leadBase = () => (supabase as any)
        .from("crm_leads_atribucion")
        .select("id", { count: "exact", head: true })
        .not("meta_leadgen_id", "is", null)
        .eq("activo", true);
      const [totalLeads, leads7, lastLead, capiSent7, capiErr7, lastSent] = await Promise.all([
        leadBase(),
        leadBase().gte("fecha_creacion", since7),
        (supabase as any).from("crm_leads_atribucion")
          .select("fecha_creacion").not("meta_leadgen_id", "is", null).eq("activo", true)
          .order("fecha_creacion", { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from("crm_meta_capi_eventos")
          .select("id", { count: "exact", head: true }).eq("status", "sent").gte("fecha_creacion", since7),
        (supabase as any).from("crm_meta_capi_eventos")
          .select("id", { count: "exact", head: true }).eq("status", "error").gte("fecha_creacion", since7),
        (supabase as any).from("crm_meta_capi_eventos")
          .select("fecha_creacion").eq("status", "sent")
          .order("fecha_creacion", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return {
        totalLeads: totalLeads.count ?? 0,
        leads7: leads7.count ?? 0,
        lastLead: lastLead.data?.fecha_creacion ?? null,
        capiSent7: capiSent7.count ?? 0,
        capiErr7: capiErr7.count ?? 0,
        lastSent: lastSent.data?.fecha_creacion ?? null,
      };
    },
  });

  const account = insights?.account ?? null;
  const datasetOk = !!health?.lastSent;

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  };

  const Cell = ({ icon: Icon, label, value, hint }: any) => (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs"><Icon className="w-4 h-4" />{label}</div>
      <div className="text-base font-semibold mt-1">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">{hint}</div>}
    </CardContent></Card>
  );
  const Stat = ({ value, label, small }: any) => (
    <div className="rounded-md bg-muted/50 p-3">
      <div className={small ? "text-sm font-bold" : "text-lg font-bold"}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300/60">Configuración · estado de la conexión</Badge>

      <div className="grid gap-3 md:grid-cols-3">
        <Cell icon={Plug} label="Cuenta publicitaria"
          value={account ? account.name : "Sin conexión"}
          hint={account ? `${account.id}${account.currency ? " · " + account.currency : ""}` : "revisa META_AD_ACCOUNT_ID"} />
        <Cell icon={Database} label="Dataset / CAPI"
          value={datasetOk ? "Conectado" : "Sin envíos aún"}
          hint={datasetOk ? `último envío ${fmtDate(health?.lastSent ?? null)}` : "aún no manda eventos"} />
        <Cell icon={Zap} label="Token" value="Server-side" hint="nunca sale al navegador" />
      </div>

      <Card><CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Entrada · leads de Meta → CRM</span>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent">Webhook activo</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Stat value={isLoading ? "…" : int(health?.totalLeads ?? 0)} label="leads sincronizados" />
          <Stat value={isLoading ? "…" : int(health?.leads7 ?? 0)} label="últimos 7 días" />
          <Stat value={isLoading ? "…" : fmtDate(health?.lastLead ?? null)} label="último lead" small />
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Salida · señal CRM → Meta (Conversions API)</span>
          {health?.capiErr7 ? (
            <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-transparent">{int(health.capiErr7)} error(es) 7d</Badge>
          ) : (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent">Sin errores 7d</Badge>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Stat value={isLoading ? "…" : int(health?.capiSent7 ?? 0)} label="enviados (7 días)" />
          <Stat value={isLoading ? "…" : int(health?.capiErr7 ?? 0)} label="errores (7 días)" />
          <Stat value={isLoading ? "…" : fmtDate(health?.lastSent ?? null)} label="último envío" small />
        </div>
        <p className="text-xs text-muted-foreground mt-3">Detalle evento por evento en la pestaña <b>Registro de envíos</b>.</p>
      </CardContent></Card>
    </div>
  );
}

// ============================================================
// Panel: Registro de envíos (log CAPI — trazabilidad, pedido por Rodrigo #10)
// ============================================================
type CapiEvento = {
  id: number;
  id_entidad_relacionada: number | null;
  event_name: string;
  event_id: string;
  status: string;
  events_received: number | null;
  fbtrace_id: string | null;
  intentos: number;
  match_keys: string | null;
  test_event_code: string | null;
  error: string | null;
  fecha_creacion: string;
};

function CapiStatusBadge({ status }: { status: string }) {
  if (status === "sent")
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent">Enviado</Badge>;
  if (status === "error")
    return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-transparent">Error</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Omitido</Badge>;
}

function RegistroPanel() {
  const qc = useQueryClient();
  const [missing, setMissing] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["crm-meta-capi-eventos"],
    queryFn: async (): Promise<CapiEvento[]> => {
      const { data, error } = await (supabase as any)
        .from("crm_meta_capi_eventos")
        .select("id, id_entidad_relacionada, event_name, event_id, status, events_received, fbtrace_id, intentos, match_keys, test_event_code, error, fecha_creacion")
        .order("fecha_creacion", { ascending: false })
        .limit(100);
      if (error) { setMissing(true); return []; }
      setMissing(false);
      return (data ?? []) as CapiEvento[];
    },
  });

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge variant="outline" className="text-primary border-primary/40">Log · trazabilidad CAPI</Badge>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Cada evento que el CRM manda a Meta (Conversions API) queda registrado aquí: estado, recepción de Meta, reintentos y rastreo (fbtrace_id).
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["crm-meta-capi-eventos"] })}>
          <RefreshCw className="w-4 h-4 mr-1" />Actualizar
        </Button>
      </div>

      {missing && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-amber-800 dark:text-amber-400">
            Falta la tabla <code>crm_meta_capi_eventos</code> (corre la migración) para ver el registro.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead className="text-center">Estado</TableHead>
            <TableHead className="text-center">Recibidos</TableHead>
            <TableHead className="text-center">Intentos</TableHead>
            <TableHead>Datos de match</TableHead>
            <TableHead>fbtrace_id / error</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground text-sm">
                Aún no se han enviado eventos a Meta. Cuando un lead avance de etapa (ej. a MQL), aparecerá aquí.
              </TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-sm">{fmt(r.fecha_creacion)}</TableCell>
                <TableCell className="font-medium">
                  {r.event_name}
                  {r.test_event_code && <Badge variant="outline" className="ml-2 text-[10px]">prueba</Badge>}
                </TableCell>
                <TableCell>
                  {r.id_entidad_relacionada ? (
                    <Link to={`/admin/portal-crm/ventas/contactos/${r.id_entidad_relacionada}`} className="text-primary hover:underline text-sm">
                      #{r.id_entidad_relacionada}
                    </Link>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-center"><CapiStatusBadge status={r.status} /></TableCell>
                <TableCell className="text-center tabular-nums">{r.events_received ?? "—"}</TableCell>
                <TableCell className="text-center tabular-nums">{r.intentos}</TableCell>
                <TableCell>
                  {r.match_keys ? (
                    <div className="flex flex-wrap gap-1">
                      {r.match_keys.split(",").map((k) => (
                        <Badge key={k} variant="secondary" className="text-[10px] font-mono">{k}</Badge>
                      ))}
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate" title={r.status === "error" ? (r.error ?? "") : (r.fbtrace_id ?? "")}>
                  {r.status === "error" ? (r.error ?? "—") : (r.fbtrace_id ?? "—")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ============================================================
// Módulo (pestañas)
// ============================================================
export function MetaAdsModule() {
  return (
    <div className="space-y-4">
      <PageHeader title="Meta Ads" subtitle="Campañas, atribución y configuración — Facebook / Instagram" />
      <Tabs defaultValue="campanas">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="campanas">Campañas + métricas</TabsTrigger>
          <TabsTrigger value="atribucion">Atribución / embudo</TabsTrigger>
          <TabsTrigger value="eventos">Eventos de conversión</TabsTrigger>
          <TabsTrigger value="registro">Registro de envíos</TabsTrigger>
          <TabsTrigger value="conexion">Conexión</TabsTrigger>
        </TabsList>
        <TabsContent value="campanas" className="mt-4"><CrmMetaAds /></TabsContent>
        <TabsContent value="atribucion" className="mt-4"><AtribucionPanel /></TabsContent>
        <TabsContent value="eventos" className="mt-4"><EventosPanel /></TabsContent>
        <TabsContent value="registro" className="mt-4"><RegistroPanel /></TabsContent>
        <TabsContent value="conexion" className="mt-4"><ConexionPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
