import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  STATUS_DESCRIPTORS, VALID_TRANSITIONS, REJECTION_REASONS, DESIST_REASONS,
  fmtMXN, fmtDate,
  type BankLead, type LeadStatus,
} from "@/lib/portal-bancos/bank-leads";
import {
  useSolicitudesBanco, useActualizarSolicitud, usePagosCuentaBanco, useAsignarEjecutivo,
} from "@/hooks/usePortalBancos/useSolicitudesBanco";
import { PIPELINE_ORDER } from "@/lib/portal-bancos/bank-leads";
import { useCurrentBanco, useSolicitudScope, useBancoResolvedScope } from "@/contexts/BankImpersonationContext";
import {
  useBancosConvenio, useBancosCatalogo, useAgregarBancoConvenio,
  useActualizarBancoConvenio, useToggleBancoConvenioActivo,
} from "@/hooks/usePortalBancos/useBancosConvenio";
import {
  useBancoEquipo, useCrearEjecutivoBanco, useSetActivoEjecutivo,
  useCambiarRolEjecutivo, useEditarEjecutivo, useBancoRoles,
  type EjecutivoBanco, type RolBancoPortal,
} from "@/hooks/usePortalBancos/useBancoEquipo";
import {
  useBancoSolicitudNotas, useCrearNota, useEditarNota, useEliminarNota,
  type BancoSolicitudNota,
} from "@/hooks/usePortalBancos/useBancoSolicitudNotas";
import { useAuth } from "@/contexts/AuthContext";
import {
  computeFunnel, computeWinRate, STAGE_PROBABILITY,
} from "@/lib/portal-bancos/metrics";
import {
  Building2, Inbox, ArrowRight, CheckCircle2, XCircle, Activity, Landmark,
  Plus, Save, Power, ShieldAlert, Users, Loader2, Pencil, Trash2, X, Image as ImageIcon,
} from "lucide-react";
import { CompradorDetalleSheet } from "@/components/admin/legal-flow/CompradorDetalleSheet";
import { PropiedadDetalleSheet } from "@/components/admin/portal-bancos/PropiedadDetalleSheet";

export { BancosNotarias } from "./BancosNotarias";

// ------------------------------ Helpers UI ------------------------------
/** Fecha + hora local (es-MX) para la Bitácora, p. ej. "16 jul 2026, 14:03". */
function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  // Scope: un banco o "all" (Super Administrador ve todos los bancos).
  const scope = useSolicitudScope();
  const { data = [] } = useSolicitudesBanco(scope);
  // Alcance por rol del usuario logueado (usuarios del sistema):
  //   - Operador Banco (Agente) → solo las solicitudes asignadas a su email.
  //   - Supervisor Banco (Admin) / Super Admin / otros → todas.
  const { profile } = useAuth();
  const { data: roles } = useBancoRoles();
  const email = (profile?.email ?? "").trim().toLowerCase();
  const esOperador =
    roles?.operadorRolId != null && profile?.rol_id === roles.operadorRolId;
  if (esOperador && email) {
    return data.filter(
      (l) => (l.assignedAgentId ?? "").trim().toLowerCase() === email,
    );
  }
  return data;
}

function LeadCard({ lead, onOpen }: { lead: BankLead; onOpen: (id: string) => void }) {
  const desc = STATUS_DESCRIPTORS[lead.status];
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
  // Scope de datos: un banco o "all". El banco concreto de esta solicitud se
  // toma del propio lead (así el detalle y la asignación funcionan también en
  // la vista global de Super Administrador).
  const scope = useSolicitudScope();
  const { data: leads = [] } = useSolicitudesBanco(scope);
  const lead = leadId ? leads.find((l) => l.id === leadId) : undefined;
  const leadBancoId = lead ? Number(lead.bankId) : null;
  const { data: agents = [] } = useBancoEquipo(leadBancoId);
  const actualizar = useActualizarSolicitud();
  const asignar = useAsignarEjecutivo();
  const { profile } = useAuth();
  const { data: bancoRoles } = useBancoRoles();
  // Solo Admin del banco (Supervisor Banco) o Super Admin pueden asignar casos.
  const puedeAsignar =
    profile?.rol_id === 1 ||
    (bancoRoles?.supervisorRolId != null && profile?.rol_id === bancoRoles.supervisorRolId);
  const idSolicitud = lead ? Number(lead.id) : null;
  const { data: notas = [] } = useBancoSolicitudNotas(idSolicitud);
  const crearNota = useCrearNota();
  const [note, setNote] = useState("");
  const [closeReason, setCloseReason] = useState<string>("");
  const [verCliente, setVerCliente] = useState(false);
  const [verPagos, setVerPagos] = useState(false);
  const [verPropiedad, setVerPropiedad] = useState(false);

  if (!lead) return null;
  const idNum = Number(lead.id);
  const idBanco = leadBancoId ?? Number(lead.bankId);
  const desc = STATUS_DESCRIPTORS[lead.status];
  // Una vez asignado un ejecutivo, ya no se puede regresar a "Nuevo".
  const transitions = (VALID_TRANSITIONS[lead.status] || []).filter(
    (to) => !(to === "nuevo" && !!lead.assignedAgentId),
  );

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

  const assignLead = (agentEmail: string) =>
    asignar.mutate(
      {
        id: idNum,
        email: agentEmail || null,
        // Al asignar un caso nuevo, avanza automáticamente a "Asignado" en el
        // Pipeline. Si ya está más avanzado, no se regresa; al des-asignar
        // (email vacío) no se toca el estatus.
        estatus: agentEmail && lead.status === "nuevo" ? "asignado" : undefined,
      },
      {
        onSuccess: () =>
          toast({ title: agentEmail ? "Ejecutivo asignado" : "Asignación removida" }),
        onError: (e: any) =>
          toast({ title: "No se pudo asignar", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );

  const myEmail = (profile?.email ?? "").trim().toLowerCase();
  const saveNote = () => {
    if (!note.trim() || !myEmail) return;
    crearNota.mutate(
      {
        idSolicitud: idNum,
        nota: note.trim(),
        autorEmail: myEmail,
        autorNombre: profile?.nombre || profile?.email || "Usuario",
      },
      {
        onSuccess: () => {
          setNote("");
          toast({ title: "Nota agregada" });
        },
        onError: (e: any) =>
          toast({ title: "No se pudo guardar la nota", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );
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

          {lead.idCuentaCobranza != null && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Propiedad</p>
              <Button
                data-cta="bancos.solicitud.ver-propiedad"
                variant="outline"
                className="w-full justify-start h-9"
                onClick={() => setVerPropiedad(true)}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Ver proyecto, modelo, metraje, estacionamientos, bodegas y planos
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Detalle de la unidad que adquiere el cliente.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Asignación</p>
            {puedeAsignar ? (
              <Select value={lead.assignedAgentId ?? ""} onValueChange={(v) => assignLead(v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Asignar ejecutivo" /></SelectTrigger>
                <SelectContent>
                  {agents.filter((a) => a.activo).map((a) => (
                    <SelectItem key={a.email} value={a.email}>
                      {a.nombre}{a.rolPortal === "admin" ? " · Admin" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              // Los Agentes no asignan: ven (solo lectura) a quién está asignado.
              <div className="h-9 flex items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                {lead.assignedAgentId
                  ? `Asignado a ${
                      agents.find((a) => a.email === lead.assignedAgentId)?.nombre ?? lead.assignedAgentId
                    }`
                  : "Sin asignar"}
              </div>
            )}
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
            <Button size="sm" disabled={!note.trim() || crearNota.isPending} onClick={saveNote}>
              Guardar nota
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Bitácora</p>
            <div className="space-y-2">
              {/* Eventos del sistema (creación / cambios de estado) — solo lectura. */}
              {lead.activity.map((a) => (
                <div key={a.id} className="rounded-md border border-border p-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{a.author}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{fmtDateTime(a.ts)}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {a.type === "status_change"
                      ? `${a.from ? STATUS_DESCRIPTORS[a.from].label : "—"} → ${a.to ? STATUS_DESCRIPTORS[a.to].label : "—"}${a.note ? ` · ${a.note}` : ""}`
                      : a.note || a.type}
                  </p>
                </div>
              ))}
              {/* Notas de usuarios: autor + fecha/hora; editar/borrar solo el autor. */}
              {notas.map((n) => (
                <BitacoraNotaRow
                  key={n.id}
                  nota={n}
                  idSolicitud={idNum}
                  canManage={!n.legacy && !!myEmail && (n.autor_email ?? "").trim().toLowerCase() === myEmail}
                />
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

      {lead.idCuentaCobranza != null && (
        <PropiedadDetalleSheet
          open={verPropiedad}
          onOpenChange={setVerPropiedad}
          idCuentaCobranza={lead.idCuentaCobranza}
        />
      )}
    </Sheet>
  );
}

/**
 * Fila de una nota de la Bitácora: muestra autor, fecha/hora y el texto. Si
 * `canManage` (el usuario logueado es el autor), permite editar/borrar la nota.
 */
function BitacoraNotaRow({ nota, idSolicitud, canManage }: { nota: BancoSolicitudNota; idSolicitud: number; canManage: boolean }) {
  const editar = useEditarNota();
  const eliminar = useEliminarNota();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(nota.nota);
  const editada = nota.fecha_actualizacion && nota.fecha_actualizacion !== nota.fecha_creacion;

  const guardar = () => {
    if (!text.trim()) return;
    editar.mutate(
      { idSolicitud, id: nota.id, nota: text.trim() },
      {
        onSuccess: () => { setEditing(false); toast({ title: "Nota actualizada" }); },
        onError: (e: any) => toast({ title: "No se pudo actualizar", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  const borrar = () => {
    eliminar.mutate(
      { idSolicitud, id: nota.id },
      {
        onSuccess: () => toast({ title: "Nota eliminada" }),
        onError: (e: any) => toast({ title: "No se pudo eliminar", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="rounded-md border border-border p-2 text-xs">
      <div className="flex justify-between gap-2">
        <span className="font-medium">{nota.autor_nombre || nota.autor_email}</span>
        <span className="text-muted-foreground whitespace-nowrap">
          {fmtDateTime(nota.fecha_creacion)}{editada ? " · editada" : ""}
        </span>
      </div>
      {editing ? (
        <div className="mt-1 space-y-1">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="text-xs" />
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditing(false); setText(nota.nota); }}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
            <Button size="sm" className="h-7 px-2" disabled={editar.isPending || !text.trim()} onClick={guardar}>
              <Save className="h-3.5 w-3.5 mr-1" /> Guardar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <p className="text-muted-foreground whitespace-pre-wrap flex-1">{nota.nota}</p>
          {canManage && (
            <div className="flex gap-0.5 shrink-0">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Editar" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" title="Eliminar" disabled={eliminar.isPending} onClick={borrar}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
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
      <Header title="Bandeja de solicitudes" subtitle={banco?.nombre ?? "Todos los bancos"} />
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
      <Header title="Tablero" subtitle={banco?.nombre ?? "Todos los bancos"} />
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

// ============================== EQUIPO (Ejecutivos = usuarios del sistema) ==============================
/**
 * Gestión de ejecutivos del banco = usuarios REALES del sistema (con login),
 * roles Operador Banco (Agente) / Supervisor Banco (Admin), vinculados por
 * `usuarios.id_banco`. SOLO Super Administrador. Alta/baja/cambio de rol/edición
 * se reflejan al instante en Admin Panel → Usuarios del Sistema (misma tabla
 * `usuarios`). Reemplaza el antiguo equipo de contacto (`bancos_agentes`).
 */
export function BancosEquipo() {
  const { profile } = useAuth();
  const scope = useBancoResolvedScope();
  const { data: roles } = useBancoRoles();
  const { data: convenios = [], isLoading: cargandoBancos } = useBancosConvenio();
  const crear = useCrearEjecutivoBanco();

  // Acceso: Super Administrador (ve/gestiona todos los bancos) o Admin de banco
  // (Supervisor Banco), este último SOLO su propio banco.
  const isSuperAdmin = profile?.rol_id === 1;
  const isSupervisorBanco =
    roles?.supervisorRolId != null && profile?.rol_id === roles.supervisorRolId;

  // El banco a administrar sigue al scope de "Ver como": si se está viendo como
  // un banco concreto (o el usuario es Admin de un banco), Equipo queda FIJO a
  // ese banco (aislamiento por banco). Solo en la vista global "Super
  // Administrador" (all) se permite elegir el banco.
  const scopedId = scope.kind === "banco" ? scope.id : null;
  const lockedToScope = scopedId != null;
  const [bancoSelAll, setBancoSelAll] = useState<number | null>(null);
  const selectedId =
    scopedId ?? bancoSelAll ?? convenios.find((c) => c.activo)?.id_banco ?? convenios[0]?.id_banco ?? null;
  const banco = convenios.find((c) => c.id_banco === selectedId) ?? null;

  const { data: equipo = [], isLoading } = useBancoEquipo(selectedId);
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", rol: "agente" as RolBancoPortal });

  if (!isSuperAdmin && !isSupervisorBanco) return <AccessDenied />;

  if (!cargandoBancos && convenios.length === 0) {
    return (
      <div className="space-y-4">
        <Header title="Equipo" subtitle="Ejecutivos por banco" />
        <EmptyState
          icon={Building2}
          title="Aún no hay bancos con convenio"
          hint="Agrega bancos en la sección «Bancos» antes de dar de alta ejecutivos."
        />
      </div>
    );
  }

  const submit = () => {
    if (!form.nombre.trim() || !form.email.trim() || selectedId == null) return;
    crear.mutate(
      { id_banco: selectedId, nombre: form.nombre.trim(), email: form.email.trim(), telefono: form.telefono.trim() || null, rolPortal: form.rol },
      {
        onSuccess: () => {
          setForm({ nombre: "", email: "", telefono: "", rol: "agente" });
          toast({ title: "Ejecutivo dado de alta", description: banco ? `Usuario creado en ${banco.nombre} · contraseña temporal: Temporal123!` : undefined });
        },
        onError: (e: any) => toast({ title: "No se pudo crear", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Header title="Equipo" subtitle="Da de alta y administra ejecutivos (usuarios del sistema) del banco" />

      {/* Banco a administrar. Fijo al banco en scope ("Ver como <Banco>");
          seleccionable solo en la vista global "Super Administrador". */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Banco:</span>
        {lockedToScope ? (
          <div className="h-9 flex items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium">
            {banco?.nombre ?? "—"}
          </div>
        ) : (
          <Select value={selectedId != null ? String(selectedId) : ""} onValueChange={(v) => setBancoSelAll(Number(v))}>
            <SelectTrigger className="w-full sm:w-[280px] h-9"><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
            <SelectContent>
              {convenios.map((c) => (
                <SelectItem key={c.id} value={String(c.id_banco)}>
                  {c.nombre}{!c.activo ? " (inactivo)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo ejecutivo</CardTitle>
          {banco && <p className="text-xs text-muted-foreground">Se creará como usuario del sistema vinculado a <span className="font-medium text-foreground">{banco.nombre}</span> con contraseña temporal.</p>}
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <div className="flex gap-2">
            <Select value={form.rol} onValueChange={(v: any) => setForm({ ...form, rol: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agente">Agente</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={submit} disabled={crear.isPending || !form.nombre.trim() || !form.email.trim() || selectedId == null}>Agregar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Equipo actual{banco ? ` · ${banco.nombre}` : ""}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : equipo.length === 0 ? (
            <EmptyState icon={Building2} title="Sin ejecutivos" hint="Da de alta el primer ejecutivo de este banco." />
          ) : (
            equipo.map((ej) => <EjecutivoRow key={ej.email} e={ej} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EjecutivoRow({ e }: { e: EjecutivoBanco }) {
  const cambiarRol = useCambiarRolEjecutivo();
  const setActivo = useSetActivoEjecutivo();
  const editar = useEditarEjecutivo();
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ nombre: e.nombre, email: e.email, telefono: e.telefono ?? "" });

  const guardar = () => {
    editar.mutate(
      { email: e.email, nombre: edit.nombre.trim(), telefono: edit.telefono.trim() || null, nuevoEmail: edit.email.trim() },
      {
        onSuccess: () => { setEditing(false); toast({ title: "Ejecutivo actualizado" }); },
        onError: (err: any) => toast({ title: "No se pudo actualizar", description: err?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  const onChangeRole = (rol: RolBancoPortal) => {
    if (rol === e.rolPortal) return;
    cambiarRol.mutate(
      { email: e.email, rolPortal: rol },
      {
        onSuccess: () => toast({ title: "Rol actualizado" }),
        onError: (err: any) => toast({ title: "No se pudo cambiar el rol", description: err?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  const onToggleActive = () => {
    setActivo.mutate(
      { email: e.email, activo: !e.activo },
      {
        onSuccess: () => toast({ title: e.activo ? "Ejecutivo desactivado" : "Ejecutivo reactivado", description: e.activo ? undefined : "Contraseña temporal: Temporal123!" }),
        onError: (err: any) => toast({ title: "No se pudo actualizar", description: err?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  return (
    <div className={`rounded-lg border border-border p-3 space-y-2 ${e.activo ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        <Avatar2 name={e.nombre} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {e.nombre}
            {!e.activo && <Badge variant="outline" className="ml-2 text-[10px]">Inactivo</Badge>}
          </p>
          <p className="text-xs text-muted-foreground truncate">{[e.email, e.telefono].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        <Select value={e.rolPortal} onValueChange={(v: any) => onChangeRole(v)}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="agente">Agente</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>{editing ? "Cerrar" : "Editar"}</Button>
        <Button size="sm" variant={e.activo ? "outline" : "default"} onClick={onToggleActive} disabled={setActivo.isPending}>
          {e.activo ? "Desactivar" : "Reactivar"}
        </Button>
      </div>
      {editing && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          <Input placeholder="Nombre" value={edit.nombre} onChange={(ev) => setEdit({ ...edit, nombre: ev.target.value })} />
          <Input placeholder="Email" type="email" value={edit.email} onChange={(ev) => setEdit({ ...edit, email: ev.target.value })} />
          <Input placeholder="Teléfono" value={edit.telefono} onChange={(ev) => setEdit({ ...edit, telefono: ev.target.value })} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={guardar} disabled={editar.isPending || !edit.nombre.trim() || !edit.email.trim()}>
              <Save className="h-4 w-4 mr-1" /> Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar2({ name }: { name: string }) {
  const ini = name.split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
  return <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{ini}</div>;
}

// ============================== BANCOS (convenio — real) ==============================
export function BancosBancos() {
  // Bancos (alta/baja de convenios): SOLO Super Administrador. Coincide con la
  // visibilidad del menú en PortalBancosLayout (canSeeBancos = isSuperAdmin) y
  // cierra el acceso por URL directa para Admin de banco / Agente.
  const { profile } = useAuth();
  const isSuperAdmin = profile?.rol_id === 1;
  const { data: convenios = [], isLoading } = useBancosConvenio();
  const { data: catalogo = [] } = useBancosCatalogo();
  const agregar = useAgregarBancoConvenio();
  const toggle = useToggleBancoConvenioActivo();

  const [nuevo, setNuevo] = useState({ id_banco: "", producto_nombre: "", tasa_desde: "", color_marca: "", orden: "" });

  if (!isSuperAdmin) return <AccessDenied />;

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
  c: { id: number; nombre: string; color_marca: string | null; logo_url: string | null; icono_url: string | null; producto_nombre: string | null; tasa_desde: number | null; orden: number; activo: boolean };
  onToggle: () => void;
}) {
  const actualizar = useActualizarBancoConvenio();
  const [edit, setEdit] = useState({
    producto_nombre: c.producto_nombre ?? "",
    tasa_desde: c.tasa_desde != null ? String(c.tasa_desde) : "",
    color_marca: c.color_marca ?? "",
    orden: String(c.orden),
  });
  const [subiendo, setSubiendo] = useState<null | "logo" | "icono">(null);
  const fileLogo = useRef<HTMLInputElement>(null);
  const fileIcono = useRef<HTMLInputElement>(null);

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

  // Sube la imagen a Storage (bucket `documentos`) y guarda la URL pública en la
  // columna correspondiente del convenio (logo_url / icono_url).
  const subirImagen = async (kind: "logo" | "icono", file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo inválido", description: "Selecciona una imagen (PNG, JPG, SVG…).", variant: "destructive" });
      return;
    }
    setSubiendo(kind);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `bancos-convenio/${c.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(path);
      await actualizar.mutateAsync({
        id: c.id,
        patch: kind === "logo" ? { logo_url: publicUrl } : { icono_url: publicUrl },
      });
      toast({ title: kind === "logo" ? "Logo actualizado" : "Ícono actualizado" });
    } catch (e: any) {
      toast({ title: "No se pudo subir la imagen", description: e?.message ?? "Error", variant: "destructive" });
    } finally {
      setSubiendo(null);
    }
  };

  const quitarImagen = async (kind: "logo" | "icono") => {
    try {
      await actualizar.mutateAsync({
        id: c.id,
        patch: kind === "logo" ? { logo_url: null } : { icono_url: null },
      });
      toast({ title: kind === "logo" ? "Logo removido" : "Ícono removido" });
    } catch (e: any) {
      toast({ title: "No se pudo quitar la imagen", description: e?.message ?? "Error", variant: "destructive" });
    }
  };

  return (
    <div className={`rounded-lg border border-border p-3 space-y-2 ${c.activo ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        {c.icono_url ? (
          <img src={c.icono_url} alt={c.nombre} className="h-8 w-8 rounded-md shrink-0 border object-contain bg-white" />
        ) : (
          <span className="h-8 w-8 rounded-md shrink-0 border" style={{ backgroundColor: c.color_marca ?? "#e5e7eb" }} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{c.nombre}</p>
          {!c.activo && <Badge variant="outline" className="text-[10px]">Inactivo</Badge>}
        </div>
        <Button size="sm" variant={c.activo ? "outline" : "default"} onClick={onToggle}>
          <Power className="h-3.5 w-3.5 mr-1" /> {c.activo ? "Desactivar" : "Activar"}
        </Button>
      </div>

      {/* Branding: ícono (marca cuadrada) + logo (wordmark), subidos a Storage */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground w-10 shrink-0">Ícono</span>
          {c.icono_url ? (
            <img src={c.icono_url} alt="ícono" className="h-9 w-9 rounded-md border object-contain bg-white" />
          ) : (
            <span className="h-9 w-9 rounded-md border bg-muted flex items-center justify-center">
              <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
            </span>
          )}
          <input ref={fileIcono} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagen("icono", f); e.target.value = ""; }} />
          <Button size="sm" variant="outline" onClick={() => fileIcono.current?.click()} disabled={subiendo !== null}>
            {subiendo === "icono" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5 mr-1" />}
            {c.icono_url ? "Cambiar" : "Subir"}
          </Button>
          {c.icono_url && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => quitarImagen("icono")} disabled={subiendo !== null}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground w-10 shrink-0">Logo</span>
          {c.logo_url ? (
            <img src={c.logo_url} alt="logo" className="h-9 max-w-[160px] rounded border object-contain bg-white px-1" />
          ) : (
            <span className="h-9 w-24 rounded border bg-muted flex items-center justify-center">
              <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
            </span>
          )}
          <input ref={fileLogo} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagen("logo", f); e.target.value = ""; }} />
          <Button size="sm" variant="outline" onClick={() => fileLogo.current?.click()} disabled={subiendo !== null}>
            {subiendo === "logo" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5 mr-1" />}
            {c.logo_url ? "Cambiar" : "Subir"}
          </Button>
          {c.logo_url && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => quitarImagen("logo")} disabled={subiendo !== null}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
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
