import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
import {
  STATUS_DESCRIPTORS, VALID_TRANSITIONS, REJECTION_REASONS, DESIST_REASONS,
  HEALTH_DESCRIPTOR, deriveHealth, closedDescriptor, fmtMXN, fmtDate,
  type BankLead, type LeadStatus,
} from "@/lib/portal-bancos/bank-leads";
import {
  useSolicitudesBanco, useActualizarSolicitud, usePagosCuentaBanco,
} from "@/hooks/usePortalBancos/useSolicitudesBanco";
import { PIPELINE_ORDER } from "@/lib/portal-bancos/bank-leads";
import { useCurrentBanco } from "@/contexts/BankImpersonationContext";
import {
  useBancosConvenio, useBancosCatalogo, useAgregarBancoConvenio,
  useActualizarBancoConvenio, useToggleBancoConvenioActivo,
} from "@/hooks/usePortalBancos/useBancosConvenio";
import {
  useBancosAgentes, useCrearAgente, useActualizarAgente, useSetActivoAgente,
  useCurrentBancoAgente,
  type BancoAgente, type AgenteRol,
} from "@/hooks/usePortalBancos/useBancosAgentes";
import {
  computeFunnel, computeWinRate, STAGE_PROBABILITY,
} from "@/lib/portal-bancos/metrics";
import {
  Building2, Inbox, ArrowRight, CheckCircle2, XCircle, Activity, Landmark,
  Plus, Save, Power, ShieldAlert, Users, Loader2,
} from "lucide-react";
import { CompradorDetalleSheet } from "@/components/admin/legal-flow/CompradorDetalleSheet";

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

/**
 * Acceso a una ruta administrativa del Portal Bancos (Equipo / Bancos) según
 * los permisos reales del rol (`submenus_permisos` · 'leer'). Super Admin
 * siempre tiene acceso. Reemplaza el gate hardcodeado a rol_id=1, que ocultaba
 * estas secciones a roles con permiso explícito (ej. Supervisor Bancos).
 */
function useBancosPathAllowed(path: string) {
  const { isPathAllowed, isLoading } = useAllowedMenus();
  return { allowed: isPathAllowed(path), isLoading };
}

function useBankScopedLeads(): BankLead[] {
  const banco = useCurrentBanco();
  // Fuente real: bancos_solicitudes del banco seleccionado (lo que el cliente
  // envía desde Pago Final). Reemplaza el store mock.
  const { data = [] } = useSolicitudesBanco(banco?.id_banco);
  // Alcance por rol de equipo: un ejecutivo con rol 'agente' solo ve las
  // solicitudes asignadas a su usuario; 'admin' (y quien no sea del equipo,
  // p.ej. Super Admin) ve todas.
  const agente = useCurrentBancoAgente(banco?.id_banco);
  if (agente && agente.rol === "agente") {
    return data.filter((l) => l.assignedAgentId === String(agente.id));
  }
  return data;
}

function LeadCard({ lead, onOpen }: { lead: BankLead; onOpen: (id: string) => void }) {
  const desc = STATUS_DESCRIPTORS[lead.status];
  const closed = closedDescriptor(lead.status);
  const health = deriveHealth(lead);
  const hd = HEALTH_DESCRIPTOR[health];
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
      <div className="mt-3 flex items-center justify-end text-[11px] text-muted-foreground">
        <span>Escr. {fmtDate(lead.property.fechaEscrituracion)}</span>
      </div>
    </button>
  );
}

// Estados donde el banco ya emitió una respuesta/propuesta → sella
// fecha_respuesta_banco la primera vez que se alcanza uno de ellos.
const ESTADOS_CON_RESPUESTA: LeadStatus[] = [
  "pre_aprobado", "oferta_vinculante", "en_coordinacion", "formalizado", "rechazado",
];

function SolicitudDetailSheet({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const banco = useCurrentBanco();
  const { data: leads = [] } = useSolicitudesBanco(banco?.id_banco);
  const lead = leadId ? leads.find((l) => l.id === leadId) : undefined;
  const { data: agents = [] } = useBancosAgentes(banco?.id_banco);
  const actualizar = useActualizarSolicitud();
  const [note, setNote] = useState("");
  const [closeReason, setCloseReason] = useState<string>("");
  const [verCliente, setVerCliente] = useState(false);
  const [verPagos, setVerPagos] = useState(false);

  if (!lead || !banco) return null;
  const idNum = Number(lead.id);
  const idBanco = banco.id_banco;
  const desc = STATUS_DESCRIPTORS[lead.status];
  const transitions = VALID_TRANSITIONS[lead.status] || [];

  const doTransition = (to: LeadStatus) => {
    let reason: string | null = null;
    if (to === "rechazado" || to === "desistido") {
      reason = closeReason || (to === "rechazado" ? REJECTION_REASONS[0] : DESIST_REASONS[0]);
    }
    actualizar.mutate(
      {
        id: idNum,
        idBanco,
        patch: {
          estatus: to,
          motivo_cierre: reason,
          fecha_respuesta_banco: ESTADOS_CON_RESPUESTA.includes(to)
            ? new Date().toISOString()
            : undefined,
        },
      },
      {
        onSuccess: () =>
          toast({ title: "Estado actualizado", description: `${desc.label} → ${STATUS_DESCRIPTORS[to].label}` }),
        onError: (e: any) =>
          toast({ title: "No se pudo actualizar", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  const assignLead = (agentId: string) =>
    actualizar.mutate(
      { id: idNum, idBanco, patch: { id_agente: agentId ? Number(agentId) : null } },
      {
        onSuccess: () => toast({ title: "Ejecutivo asignado" }),
        onError: (e: any) =>
          toast({ title: "No se pudo asignar", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );

  const saveNote = () =>
    actualizar.mutate(
      { id: idNum, idBanco, patch: { notas_banco: note.trim() } },
      {
        onSuccess: () => {
          setNote("");
          toast({ title: "Nota guardada" });
        },
        onError: (e: any) =>
          toast({ title: "No se pudo guardar la nota", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );

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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Monto a financiar" value={fmtMXN(lead.credit.montoFinanciar)} />
            <Stat label="Plazo" value={`${lead.credit.plazoAnios} años`} />
            <Stat
              label="Fecha de venta"
              value={lead.sale?.fechaVenta ? fmtDate(lead.sale.fechaVenta) : "—"}
            />
            <Stat
              label="Valor de escrituración"
              value={lead.sale ? fmtMXN(lead.sale.valorEscrituracion) : "—"}
            />
            <Stat
              label="Total pagado"
              value={lead.sale ? fmtMXN(lead.sale.totalPagado) : "—"}
              onClick={
                lead.sale && lead.idCuentaCobranza != null
                  ? () => setVerPagos(true)
                  : undefined
              }
              linkLabel="Ver pagos realizados"
            />
            <Stat
              label="Saldo pendiente"
              value={lead.sale ? fmtMXN(lead.sale.saldoPendiente) : "—"}
            />
          </div>

          {lead.sale && lead.sale.compradores.length > 1 && (
            <div className="rounded-md border border-border p-3 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Compradores
              </p>
              {lead.sale.compradores.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.nombre}</span>
                  {c.porcentaje > 0 && (
                    <span className="tabular-nums text-muted-foreground">{c.porcentaje}%</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {lead.idCuentaCobranza != null && (lead.clientes?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                {(lead.clientes?.length ?? 0) > 1 ? "Datos de los clientes" : "Datos del cliente"}
              </p>
              <Button
                data-cta="bancos.solicitud.ver-datos-cliente"
                variant="outline"
                className="w-full justify-start h-9"
                onClick={() => setVerCliente(true)}
              >
                <Users className="h-4 w-4 mr-2" />
                {(lead.clientes?.length ?? 0) > 1
                  ? `Ver datos de los ${lead.clientes!.length} clientes`
                  : "Ver datos personales, dirección, fiscal y documentos"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Información validada, solo lectura.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Asignación</p>
            <Select value={lead.assignedAgentId ?? ""} onValueChange={(v) => assignLead(v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Asignar ejecutivo" /></SelectTrigger>
              <SelectContent>
                {agents.filter((a) => a.activo).map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.nombre}</SelectItem>
                ))}
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
            <Button size="sm" disabled={!note.trim() || actualizar.isPending} onClick={saveNote}>
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

      {lead.idCuentaCobranza != null && (lead.clientes?.length ?? 0) > 0 && (
        <CompradorDetalleSheet
          open={verCliente}
          onOpenChange={setVerCliente}
          idCuentaCobranza={lead.idCuentaCobranza}
          compradores={lead.clientes!}
          readOnly
        />
      )}

      {lead.idCuentaCobranza != null && (
        <PagosRealizadosSheet
          open={verPagos}
          onOpenChange={setVerPagos}
          idCuentaCobranza={lead.idCuentaCobranza}
          total={lead.sale?.totalPagado ?? 0}
        />
      )}
    </Sheet>
  );
}

/**
 * Panel lateral (solo lectura) con el desglose de pagos que componen el
 * "Total pagado" de la solicitud — para que el banco revise montos y formas
 * de pago. Se apila sobre el detalle: al cerrarlo se regresa a la solicitud.
 */
function PagosRealizadosSheet({
  open,
  onOpenChange,
  idCuentaCobranza,
  total,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idCuentaCobranza: number;
  total: number;
}) {
  const { data: pagos = [], isLoading } = usePagosCuentaBanco(open ? idCuentaCobranza : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pagos realizados</SheetTitle>
          <SheetDescription>
            Aplicaciones de pago que componen el total pagado de la cuenta.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando pagos…
            </div>
          ) : pagos.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Sin pagos registrados para esta cuenta.
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {pagos.length} {pagos.length === 1 ? "pago" : "pagos"}
                </span>
                <span>
                  Total: <strong className="text-foreground tabular-nums">{fmtMXN(total)}</strong>
                </span>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Fecha pago</TableHead>
                      <TableHead className="text-xs">Método</TableHead>
                      <TableHead className="text-xs text-right">Monto aplicado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagos.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {p.fechaPago ? fmtDate(p.fechaPago) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.metodo}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-medium whitespace-nowrap">
                          {fmtMXN(p.montoAplicado)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="text-sm font-semibold" colSpan={2}>
                        Total pagado
                      </TableCell>
                      <TableCell className="text-sm text-right font-bold tabular-nums whitespace-nowrap">
                        {fmtMXN(total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({
  label,
  value,
  onClick,
  linkLabel,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  linkLabel?: string;
}) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          {linkLabel ?? "Ver detalle"}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
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

function AccessDenied() {
  return (
    <div className="space-y-4">
      <Header title="Acceso restringido" />
      <EmptyState
        icon={ShieldAlert}
        title="Solo Super Administrador"
        hint="Esta sección la administra el rol Super Administrador."
      />
    </div>
  );
}

// ============================== BANDEJA ==============================
export function BancosBandeja() {
  const leads = useBankScopedLeads();
  const banco = useCurrentBanco();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"abiertas" | "cerradas">("abiertas");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return leads.filter((l) => {
      const desc = STATUS_DESCRIPTORS[l.status];
      if (tab === "abiertas" && desc.isTerminal) return false;
      if (tab === "cerradas" && !desc.isTerminal) return false;
      if (!norm) return true;
      return (
        l.client.fullName.toLowerCase().includes(norm) ||
        l.property.project.toLowerCase().includes(norm) ||
        l.property.unit.toLowerCase().includes(norm) ||
        l.sozu.leadId.toLowerCase().includes(norm)
      );
    });
  }, [leads, tab, q]);

  return (
    <div className="space-y-4">
      <Header title="Bandeja de solicitudes" subtitle={banco?.nombre} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList>
            <TabsTrigger value="abiertas">Abiertas</TabsTrigger>
            <TabsTrigger value="cerradas">Cerradas</TabsTrigger>
          </TabsList>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, proyecto, folio..." className="sm:w-80" />
        </div>
        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <EmptyState icon={Inbox} title="Sin solicitudes reales aún" hint="Las solicitudes hipotecarias se mostrarán aquí cuando estén disponibles." />
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
  const banco = useCurrentBanco();
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
      <Header title="Tablero" subtitle={banco?.nombre} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Inbox} label="Solicitudes" value={leads.length.toString()} />
        <Kpi icon={Activity} label="Monto solicitado" value={fmtMXN(totalMonto)} />
        <Kpi icon={CheckCircle2} label="Win rate" value={`${wr.rate}%`} hint={`${wr.won} de ${wr.closed} cerradas`} />
        <Kpi icon={ArrowRight} label="Pipeline ponderado" value={fmtMXN(expectedRevenue)} />
      </div>

      {leads.length === 0 ? (
        <EmptyState icon={Activity} title="Sin datos reales aún" hint="Los indicadores se calcularán cuando existan solicitudes reales." />
      ) : (
        <>
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
        </>
      )}
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

// ============================== EQUIPO (Agentes por banco — real) ==============================
export function BancosEquipo() {
  const { allowed, isLoading: cargandoPermisos } = useBancosPathAllowed("/admin/portal-bancos/equipo");
  const { data: convenios = [], isLoading: cargandoBancos } = useBancosConvenio();
  const crear = useCrearAgente();
  const actualizar = useActualizarAgente();
  const setActivo = useSetActivoAgente();

  // Banco vinculado seleccionado (default: primer convenio activo).
  const [bancoSel, setBancoSel] = useState<number | null>(null);
  const selectedId = bancoSel ?? convenios.find((c) => c.activo)?.id_banco ?? convenios[0]?.id_banco ?? null;
  const banco = convenios.find((c) => c.id_banco === selectedId) ?? null;

  const { data: agents = [], isLoading } = useBancosAgentes(selectedId);
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", rol: "agente" as AgenteRol });

  if (cargandoPermisos) return null;
  if (!allowed) return <AccessDenied />;

  if (!cargandoBancos && convenios.length === 0) {
    return (
      <div className="space-y-4">
        <Header title="Equipo" subtitle="Agentes por banco" />
        <EmptyState
          icon={Building2}
          title="Aún no hay bancos con convenio"
          hint="Agrega bancos en la sección «Bancos». Si es la primera vez, aplica la migración de Ejecuciones_manuales/portal_bancos_administrador.md."
        />
      </div>
    );
  }

  const submit = () => {
    if (!form.nombre.trim() || selectedId == null) return;
    crear.mutate(
      { id_banco: selectedId, nombre: form.nombre.trim(), email: form.email.trim() || null, telefono: form.telefono.trim() || null, rol: form.rol },
      {
        onSuccess: () => { setForm({ nombre: "", email: "", telefono: "", rol: "agente" }); toast({ title: "Ejecutivo agregado", description: banco ? `Vinculado a ${banco.nombre}` : undefined }); },
        onError: (e: any) => toast({ title: "No se pudo agregar", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Header title="Equipo" subtitle="Da de alta agentes y vincúlalos a un banco aliado" />

      {/* Selector de banco vinculado */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Banco:</span>
        <Select value={selectedId != null ? String(selectedId) : ""} onValueChange={(v) => setBancoSel(Number(v))}>
          <SelectTrigger className="w-full sm:w-[280px] h-9"><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
          <SelectContent>
            {convenios.map((c) => (
              <SelectItem key={c.id} value={String(c.id_banco)}>
                {c.nombre}{!c.activo ? " (inactivo)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo ejecutivo</CardTitle>
          {banco && <p className="text-xs text-muted-foreground">Se vinculará a <span className="font-medium text-foreground">{banco.nombre}</span></p>}
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <div className="flex gap-2">
            <Select value={form.rol} onValueChange={(v: any) => setForm({ ...form, rol: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agente">Agente</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={submit} disabled={crear.isPending || !form.nombre.trim() || selectedId == null}>Agregar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Equipo actual{banco ? ` · ${banco.nombre}` : ""}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : agents.length === 0 ? (
            <EmptyState icon={Building2} title="Sin ejecutivos" hint="Agrega el primer ejecutivo de este banco." />
          ) : (
            agents.map((a) => (
              <AgentRow
                key={a.id}
                a={a}
                onToggleActive={() => setActivo.mutate({ id: a.id, activo: !a.activo })}
                onChangeRole={(rol) => actualizar.mutate({ id: a.id, patch: { rol } })}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentRow({ a, onToggleActive, onChangeRole }: { a: BancoAgente; onToggleActive: () => void; onChangeRole: (r: AgenteRol) => void }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border border-border p-3 ${a.activo ? "" : "opacity-60"}`}>
      <Avatar2 name={a.nombre} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{a.nombre}</p>
        <p className="text-xs text-muted-foreground truncate">{[a.email, a.telefono].filter(Boolean).join(" · ") || "—"}</p>
      </div>
      <Select value={a.rol} onValueChange={(v: any) => onChangeRole(v)}>
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="agente">Agente</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" variant={a.activo ? "outline" : "default"} onClick={onToggleActive}>
        {a.activo ? "Desactivar" : "Reactivar"}
      </Button>
    </div>
  );
}

function Avatar2({ name }: { name: string }) {
  const ini = name.split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
  return <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{ini}</div>;
}

// ============================== BANCOS (convenio — real) ==============================
export function BancosBancos() {
  const { allowed, isLoading: cargandoPermisos } = useBancosPathAllowed("/admin/portal-bancos/bancos");
  const { data: convenios = [], isLoading } = useBancosConvenio();
  const { data: catalogo = [] } = useBancosCatalogo();
  const agregar = useAgregarBancoConvenio();
  const toggle = useToggleBancoConvenioActivo();

  const [nuevo, setNuevo] = useState({ id_banco: "", producto_nombre: "", tasa_desde: "", color_marca: "", orden: "" });

  if (cargandoPermisos) return null;
  if (!allowed) return <AccessDenied />;

  const disponibles = catalogo.filter((c) => !convenios.some((cv) => cv.id_banco === c.id));

  const submitNuevo = () => {
    const idBanco = Number(nuevo.id_banco);
    if (!idBanco) return;
    agregar.mutate(
      {
        id_banco: idBanco,
        producto_nombre: nuevo.producto_nombre.trim() || null,
        tasa_desde: nuevo.tasa_desde ? Number(nuevo.tasa_desde) : null,
        color_marca: nuevo.color_marca.trim() || null,
        orden: nuevo.orden ? Number(nuevo.orden) : 100,
      },
      {
        onSuccess: () => { setNuevo({ id_banco: "", producto_nombre: "", tasa_desde: "", color_marca: "", orden: "" }); toast({ title: "Banco agregado al convenio" }); },
        onError: (e: any) => toast({ title: "No se pudo agregar", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Header title="Bancos con convenio" subtitle="Bancos con los que SOZU tiene convenio activo" />

      <Card>
        <CardHeader><CardTitle className="text-base">Agregar banco a convenio</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <Select value={nuevo.id_banco} onValueChange={(v) => setNuevo({ ...nuevo, id_banco: v })}>
            <SelectTrigger><SelectValue placeholder="Banco" /></SelectTrigger>
            <SelectContent>
              {disponibles.length === 0 ? (
                <SelectItem value="__none" disabled>Sin bancos disponibles</SelectItem>
              ) : (
                disponibles.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.nombre}</SelectItem>)
              )}
            </SelectContent>
          </Select>
          <Input placeholder="Producto (ej. Hipoteca Fija)" value={nuevo.producto_nombre} onChange={(e) => setNuevo({ ...nuevo, producto_nombre: e.target.value })} />
          <Input placeholder="Tasa desde %" type="number" step="0.01" value={nuevo.tasa_desde} onChange={(e) => setNuevo({ ...nuevo, tasa_desde: e.target.value })} />
          <Input placeholder="Color (#hex)" value={nuevo.color_marca} onChange={(e) => setNuevo({ ...nuevo, color_marca: e.target.value })} />
          <div className="flex gap-2">
            <Input placeholder="Orden" type="number" value={nuevo.orden} onChange={(e) => setNuevo({ ...nuevo, orden: e.target.value })} />
            <Button onClick={submitNuevo} disabled={agregar.isPending || !nuevo.id_banco}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Convenios actuales</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : convenios.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="Sin bancos con convenio"
              hint={disponibles.length > 0
                ? "Agrega el primer banco con convenio usando el formulario de arriba."
                : "Aplica primero la migración de Ejecuciones_manuales/portal_bancos_administrador.md para habilitar las tablas."}
            />
          ) : (
            convenios.map((c) => <ConvenioRow key={c.id} c={c} onToggle={() => toggle.mutate({ id: c.id, activo: !c.activo })} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConvenioRow({
  c,
  onToggle,
}: {
  c: { id: number; nombre: string; color_marca: string | null; producto_nombre: string | null; tasa_desde: number | null; orden: number; activo: boolean };
  onToggle: () => void;
}) {
  const actualizar = useActualizarBancoConvenio();
  const [edit, setEdit] = useState({
    producto_nombre: c.producto_nombre ?? "",
    tasa_desde: c.tasa_desde != null ? String(c.tasa_desde) : "",
    color_marca: c.color_marca ?? "",
    orden: String(c.orden),
  });

  const guardar = () => {
    actualizar.mutate(
      {
        id: c.id,
        patch: {
          producto_nombre: edit.producto_nombre.trim() || null,
          tasa_desde: edit.tasa_desde ? Number(edit.tasa_desde) : null,
          color_marca: edit.color_marca.trim() || null,
          orden: edit.orden ? Number(edit.orden) : 100,
        },
      },
      {
        onSuccess: () => toast({ title: "Convenio actualizado" }),
        onError: (e: any) => toast({ title: "No se pudo actualizar", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  return (
    <div className={`rounded-lg border border-border p-3 space-y-2 ${c.activo ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        <span className="h-8 w-8 rounded-md shrink-0 border" style={{ backgroundColor: c.color_marca ?? "#e5e7eb" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{c.nombre}</p>
          {!c.activo && <Badge variant="outline" className="text-[10px]">Inactivo</Badge>}
        </div>
        <Button size="sm" variant={c.activo ? "outline" : "default"} onClick={onToggle}>
          <Power className="h-3.5 w-3.5 mr-1" /> {c.activo ? "Desactivar" : "Activar"}
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <Input placeholder="Producto" value={edit.producto_nombre} onChange={(e) => setEdit({ ...edit, producto_nombre: e.target.value })} />
        <Input placeholder="Tasa desde %" type="number" step="0.01" value={edit.tasa_desde} onChange={(e) => setEdit({ ...edit, tasa_desde: e.target.value })} />
        <Input placeholder="Color (#hex)" value={edit.color_marca} onChange={(e) => setEdit({ ...edit, color_marca: e.target.value })} />
        <Input placeholder="Orden" type="number" value={edit.orden} onChange={(e) => setEdit({ ...edit, orden: e.target.value })} />
        <Button variant="outline" onClick={guardar} disabled={actualizar.isPending}>
          <Save className="h-4 w-4 mr-1" /> Guardar
        </Button>
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
