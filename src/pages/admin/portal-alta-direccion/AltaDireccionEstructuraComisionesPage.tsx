import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, SlidersHorizontal, Loader2, History, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProyectosFiltro } from "@/hooks/usePortalAltaDireccion/useProyectosFiltro";
import { useProyectosMotorComisiones } from "@/hooks/usePortalEstructuraComisiones/useProyectosMotorComisiones";
import { useProyectosSozuReales } from "@/hooks/usePortalEstructuraComisiones/useProyectosTallwoodReales";
import { useEstructuraRealRaw, comisionistasDisponibles } from "@/hooks/usePortalEstructuraComisiones/useEstructuraRealSimulador";
import { SimulatorProvider, useSimulator } from "@/lib/portal-estructura-comisiones/stores/SimulatorContext";
import { MotorComisionesReadOnly } from "@/components/admin/portal-alta-direccion/MotorComisionesReadOnly";
import BrokerIncentivesTab from "@/components/admin/portal-estructura-comisiones/tabs/BrokerIncentivesTab";
import {
  useComisionesPropuestas,
  useValidacionesHistorial,
  useValidacionesCanal,
  useValidarCanalComision,
  useActualizarEstadoPropuesta,
  type ComisionPropuesta,
  type EstadoPropuesta,
  type EstadoValidacionCanal,
  type MotorSnapshot,
} from "@/hooks/usePortalEstructuraComisiones/useComisionesValidacion";

const ALL = "all";

const ESTADO_BADGE: Record<EstadoPropuesta, { label: string; cls: string }> = {
  propuesta: { label: "Por validar", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  validada: { label: "Validada", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rechazada: { label: "Rechazada", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AltaDireccionEstructuraComisionesPage() {
  return (
    <div className="max-w-[1400px] space-y-6 px-6 py-6 lg:px-10 lg:py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <SlidersHorizontal className="h-5 w-5 text-primary" /> Estructura de Comisiones
        </h1>
        <p className="text-sm text-muted-foreground">
          Consulta el Motor de Comisiones (roles y resumen por canal) y valídalo por proyecto.
        </p>
      </div>

      <Tabs defaultValue="motor">
        <TabsList>
          <TabsTrigger value="motor">Motor de Comisiones</TabsTrigger>
          <TabsTrigger value="incentivos">Incentivos Dinámicos</TabsTrigger>
          <TabsTrigger value="validacion">Validación por proyecto</TabsTrigger>
        </TabsList>
        <TabsContent value="motor" className="mt-5">
          <SimulatorProvider>
            <MotorConsulta />
          </SimulatorProvider>
        </TabsContent>
        <TabsContent value="incentivos" className="mt-5">
          {/* Vista de solo lectura de los Incentivos Dinámicos del Portal
              Estructura de comisiones: escenarios por "Ventas del mes", por
              canal y por proyecto, sin poder editar los escalones. */}
          <SimulatorProvider>
            <BrokerIncentivesTab readOnly />
          </SimulatorProvider>
        </TabsContent>
        <TabsContent value="validacion" className="mt-5">
          <ValidacionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Consulta del motor (real, por proyecto, solo lectura) ─── */
function MotorConsulta() {
  const { channels, roles, roleAssignments, commissionRules, motorConfig, motorProjectId, setMotorProjectId } = useSimulator();
  const { data: proyectosMotor = [], isLoading: isLoadingProyectos } = useProyectosMotorComisiones();

  // Precio de venta de referencia = precio promedio PONDERADO de la oferta
  // disponible (id_estatus_disponibilidad = 2) del proyecto. Misma fuente que
  // usa el Portal Estructura de comisiones (CommissionsTab) para estimar pagos.
  const { proyectos: proyectosSozu } = useProyectosSozuReales();
  const precioReferencia = useMemo(
    () => proyectosSozu.find((p) => p.id === motorProjectId)?.precioPromedioUnidad ?? 0,
    [proyectosSozu, motorProjectId],
  );

  // Resolución del nombre del comisionista desde `personalId` (el snapshot del
  // motor guarda solo el id de persona). Sin esto, la columna "Comisionista"
  // caía a "—".
  const { data: estructuraRaw } = useEstructuraRealRaw();
  const comisionistaPorId = useMemo(
    () =>
      new Map(
        comisionistasDisponibles(estructuraRaw, roles, motorProjectId).map((c) => [c.personalId, c]),
      ),
    [estructuraRaw, roles, motorProjectId],
  );

  const snapshot: MotorSnapshot = {
    // La comisión total viaja por canal: cada Canal de Venta define la suya.
    channels: channels.map((c) => ({
      id: c.id,
      name: c.name,
      externalCommissionPct: c.externalCommissionPct,
      active: c.active,
      totalCommissionPct: motorConfig.channelTotals[c.id] ?? 0,
    })),
    roles: roles.map((r) => ({ id: r.id, name: r.name, belongsTo: r.belongsTo })),
    roleAssignments: roleAssignments.map((a) => ({ roleId: a.roleId, baseSalary: a.baseSalary })),
    commissionRules: commissionRules.map((r) => ({
      channelId: r.channelId,
      roleId: r.roleId,
      percentage: r.percentage,
      pool: r.pool,
      comisionista: r.personalId ? comisionistaPorId.get(r.personalId)?.nombre ?? null : null,
    })),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Select
          value={motorProjectId != null ? String(motorProjectId) : undefined}
          onValueChange={(v) => setMotorProjectId(Number(v))}
        >
          <SelectTrigger className="h-9 w-[260px] text-sm">
            <SelectValue placeholder={isLoadingProyectos ? "Cargando proyectos…" : "Selecciona un proyecto"} />
          </SelectTrigger>
          <SelectContent>
            {proyectosMotor.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {motorProjectId == null ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Selecciona un proyecto</p>
          <p className="text-xs text-muted-foreground">Elige un desarrollo arriba para ver su Motor de Comisiones.</p>
        </div>
      ) : (
        <MotorComisionesReadOnly snapshot={snapshot} precioReferenciaInicial={precioReferencia || undefined} />
      )}
    </div>
  );
}

/* ─── Validación por proyecto (propuestas enviadas desde Estructura) ─── */
function ValidacionPanel() {
  const { profile, user } = useAuth();
  const { data: proyectos = [] } = useProyectosFiltro();
  const [proyectoFilter, setProyectoFilter] = useState<string>(ALL);
  const idProyecto = proyectoFilter === ALL ? null : Number(proyectoFilter);
  const { data: propuestas = [], isLoading } = useComisionesPropuestas(idProyecto);
  const [selected, setSelected] = useState<ComisionPropuesta | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={proyectoFilter} onValueChange={setProyectoFilter}>
          <SelectTrigger className="h-9 w-[260px] text-sm"><SelectValue placeholder="Proyecto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los proyectos</SelectItem>
            {proyectos.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Cargando propuestas…
        </div>
      ) : propuestas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <SlidersHorizontal className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Sin propuestas por validar</p>
          <p className="text-xs text-muted-foreground">
            El Portal Estructura de comisiones aún no ha enviado el motor a validar para este proyecto.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {propuestas.map((p) => {
            const badge = ESTADO_BADGE[p.estado];
            return (
              <Card key={p.id} className="cursor-pointer transition hover:border-primary/40 hover:shadow-md" onClick={() => setSelected(p)}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.proyecto_nombre}</p>
                    </div>
                    <Badge variant="secondary" className={cn("shrink-0 text-[10px]", badge.cls)}>{badge.label}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Actualizado {fmtFecha(p.fecha_actualizacion)}{p.propuesta_por ? ` · ${p.propuesta_por}` : ""}
                  </p>
                  <Button variant="outline" size="sm" className="h-8 w-full text-xs">Ver y validar</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ValidacionSheet
        propuesta={selected}
        onClose={() => setSelected(null)}
        validadoPor={profile?.email || user?.email || null}
      />
    </div>
  );
}

function ValidacionSheet({
  propuesta,
  onClose,
  validadoPor,
}: {
  propuesta: ComisionPropuesta | null;
  onClose: () => void;
  validadoPor: string | null;
}) {
  const validarCanal = useValidarCanalComision();
  const actualizarEstado = useActualizarEstadoPropuesta();
  const { data: validacionesCanal = [] } = useValidacionesCanal(propuesta?.id_proyecto);
  const { data: historial = [] } = useValidacionesHistorial(propuesta?.id_proyecto);
  const { proyectos: proyectosSozu } = useProyectosSozuReales();
  const precioReferencia = useMemo(
    () => proyectosSozu.find((p) => p.id === propuesta?.id_proyecto)?.precioPromedioUnidad ?? 0,
    [proyectosSozu, propuesta?.id_proyecto],
  );
  const [notas, setNotas] = useState("");

  const canales = propuesta?.snapshot?.channels ?? [];

  // Decisiones vigentes: solo las que coinciden con la versión (fecha) de la
  // propuesta actual; si se reenvió a validar, las viejas quedan descartadas.
  const decisionPorCanal = useMemo(() => {
    const m = new Map<string, EstadoValidacionCanal>();
    if (!propuesta) return m;
    for (const v of validacionesCanal) {
      if (v.snapshot_fecha === propuesta.fecha_actualizacion) m.set(v.id_canal, v.estado);
    }
    return m;
  }, [validacionesCanal, propuesta]);

  const resumen = useMemo(() => {
    let validados = 0, rechazados = 0;
    for (const ch of canales) {
      const e = decisionPorCanal.get(ch.id);
      if (e === "validada") validados++;
      else if (e === "rechazada") rechazados++;
    }
    return {
      total: canales.length,
      validados,
      rechazados,
      pendientes: canales.length - validados - rechazados,
    };
  }, [canales, decisionPorCanal]);

  /** Estado agregado del proyecto derivado de sus canales. */
  const derivarEstado = (m: Map<string, EstadoValidacionCanal>): EstadoPropuesta => {
    if (canales.length === 0) return "propuesta";
    if (canales.some((ch) => m.get(ch.id) === "rechazada")) return "rechazada";
    if (canales.every((ch) => m.get(ch.id) === "validada")) return "validada";
    return "propuesta";
  };

  // ── Validación de UN canal
  const decidirCanal = (canal: { id: string; name: string }, estado: EstadoValidacionCanal) => {
    if (!propuesta) return;
    if (estado === "rechazada" && !notas.trim()) {
      toast.error("Indica el motivo del rechazo en las notas antes de rechazar el canal.");
      return;
    }
    validarCanal.mutate(
      {
        id_proyecto: propuesta.id_proyecto,
        id_canal: canal.id,
        nombre_canal: canal.name,
        estado,
        notas: estado === "rechazada" ? notas.trim() : null,
        validado_por: validadoPor,
        snapshot_fecha: propuesta.fecha_actualizacion,
      },
      {
        onSuccess: () => {
          // Recalcular el estado agregado y reflejarlo en la propuesta.
          const next = new Map(decisionPorCanal);
          next.set(canal.id, estado);
          const agg = derivarEstado(next);
          if (agg !== propuesta.estado) {
            actualizarEstado.mutate({ propuestaId: propuesta.id, estado: agg });
          }
          toast.success(
            estado === "validada" ? `Canal “${canal.name}” validado` : `Canal “${canal.name}” rechazado`,
          );
          if (estado === "rechazada") setNotas("");
        },
        onError: (e: any) => toast.error(e?.message || "No se pudo registrar la decisión del canal."),
      },
    );
  };

  const renderChannelAction = (canal: { id: string; name: string }) => {
        const e = decisionPorCanal.get(canal.id);
        return (
          <div className="flex items-center gap-1.5">
            {e === "validada" && (
              <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Validado
              </Badge>
            )}
            {e === "rechazada" && (
              <Badge className="border-0 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                Rechazado
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              disabled={validarCanal.isPending || e === "validada"}
              onClick={() => decidirCanal(canal, "validada")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Validar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-red-300 px-2 text-[11px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              disabled={validarCanal.isPending || e === "rechazada"}
              onClick={() => decidirCanal(canal, "rechazada")}
            >
              <XCircle className="h-3.5 w-3.5" /> Rechazar
            </Button>
          </div>
        );
      };

  const estadoActual = derivarEstado(decisionPorCanal);

  return (
    <Sheet open={!!propuesta} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {propuesta && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {propuesta.proyecto_nombre}
                <Badge variant="secondary" className={cn("text-[10px]", ESTADO_BADGE[estadoActual].cls)}>
                  {ESTADO_BADGE[estadoActual].label}
                </Badge>
              </SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-5">
              {(
                <div className="rounded-xl border bg-card p-4">
                  <p className="mb-2 text-sm font-semibold">Validación por canal</p>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {resumen.validados} validados
                    </Badge>
                    <Badge className="border-0 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      {resumen.rechazados} rechazados
                    </Badge>
                    <Badge variant="outline">{resumen.pendientes} pendientes</Badge>
                    <span className="text-muted-foreground">de {resumen.total} canales</span>
                  </div>
                  <Textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={2}
                    placeholder="Notas (requeridas para rechazar un canal)…"
                    className="mb-2 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Usa los botones <span className="font-medium">Validar</span> /{" "}
                    <span className="font-medium">Rechazar</span> en el encabezado de cada canal. El
                    proyecto queda <span className="font-medium">Validada</span> cuando todos los
                    canales están validados, y <span className="font-medium">Rechazada</span> si
                    alguno se rechaza.
                  </p>
                </div>
              )}

              <MotorComisionesReadOnly
                snapshot={propuesta.snapshot}
                precioReferenciaInicial={precioReferencia || undefined}
                renderChannelAction={renderChannelAction}
                channelStatus={(id) => decisionPorCanal.get(id) ?? "pendiente"}
              />

              <div className="rounded-xl border bg-card p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4" /> Historial de validaciones</p>
                {historial.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">Sin validaciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {historial.map((h) => (
                      <div key={h.id} className="rounded-lg border px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            {h.estado === "validada"
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              : <XCircle className="h-3.5 w-3.5 text-red-600" />}
                            {h.estado === "validada" ? "Validada" : "Rechazada"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" /> {fmtFecha(h.fecha_validacion)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-muted-foreground">
                          {h.validado_por || "—"}{h.notas ? ` · ${h.notas}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
