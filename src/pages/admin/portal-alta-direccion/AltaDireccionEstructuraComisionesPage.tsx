import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, SlidersHorizontal, Loader2, History, Building2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProyectosFiltro } from "@/hooks/usePortalAltaDireccion/useProyectosFiltro";
import { useProyectosMotorComisiones } from "@/hooks/usePortalEstructuraComisiones/useProyectosMotorComisiones";
import { useProyectosSozuReales } from "@/hooks/usePortalEstructuraComisiones/useProyectosTallwoodReales";
import { useEstructuraRealRaw, comisionistasDisponibles, useComisionistasPorId, type ComisionistaReal } from "@/hooks/usePortalEstructuraComisiones/useEstructuraRealSimulador";
import { SimulatorProvider, useSimulator } from "@/lib/portal-estructura-comisiones/stores/SimulatorContext";
import { MotorComisionesReadOnly } from "@/components/admin/portal-alta-direccion/MotorComisionesReadOnly";
import BrokerIncentivesTab from "@/components/admin/portal-estructura-comisiones/tabs/BrokerIncentivesTab";
import {
  useComisionesPropuestas,
  useValidacionesHistorial,
  useValidacionesCanal,
  useValidarCanalComision,
  useActualizarEstadoPropuesta,
  fingerprintCanal,
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

/** Normaliza nombres para casar comisionista por nombre (sin acentos, minúsculas). */
const normNombre = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

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

/** Claves react-query de los datos que alimentan la Estructura de Comisiones. */
const CLAVES_ESTRUCTURA = [
  ["estructura-real-simulador"],      // personal, roles y comisionistas (Roles y Sueldos)
  ["proyectos-motor-comisiones"],     // proyectos con motor
  ["proyectos-sozu-reales"],          // precio de referencia por proyecto
  ["comisiones-propuestas"],          // validaciones — propuestas
  ["comisiones-validaciones"],        // validaciones — historial
  ["comisiones-validaciones-canal"],  // validaciones — por canal
];

/* ─── Consulta del motor (real, por proyecto, solo lectura) ─── */
function MotorConsulta() {
  const { channels, roles, roleAssignments, commissionRules, motorConfig, motorProjectId, setMotorProjectId, reloadMotor } = useSimulator();
  const { data: proyectosMotor = [], isLoading: isLoadingProyectos } = useProyectosMotorComisiones();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Actualiza todo lo que el sistema alimenta a esta pantalla: relee del
  // servidor los canales + la matriz del proyecto (datos imperativos) e invalida
  // la caché de personal/comisionistas/proyectos/validaciones para que react-query
  // los vuelva a pedir. Cubre los cambios hechos en "Personal / Roles y Sueldos".
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        reloadMotor(),
        ...CLAVES_ESTRUCTURA.map((queryKey) => qc.invalidateQueries({ queryKey })),
      ]);
      toast.success("Información actualizada");
    } catch {
      toast.error("No se pudo actualizar la información. Intenta de nuevo.");
    } finally {
      setRefreshing(false);
    }
  };

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
    // El rol y el pool se resuelven contra el DIRECTORIO actual (Roles y Sueldos),
    // no contra lo que quedó grabado en la regla: si a la persona le cambiaron el
    // rol después de crearse la regla, `comisiones_reglas.id_rol` queda obsoleto
    // (ej. Alma Castellón salía como "Data & IA / SOZU" siendo ya "Administración
    // y Contabilidad"). Se conserva el rol de la regla solo si la persona aún lo
    // ejerce; si no, se cae a su rol base vigente y el pool sigue a su `belongsTo`.
    commissionRules: commissionRules.map((r) => {
      const c = r.personalId ? comisionistaPorId.get(r.personalId) : null;
      const rolVigente =
        c?.roles.find((x) => x.roleId === r.roleId) ??
        c?.roles.find((x) => x.origen === "base") ??
        c?.roles[0] ??
        null;
      return {
        channelId: r.channelId,
        roleId: rolVigente?.roleId ?? r.roleId,
        rolNombre: rolVigente?.rolNombre ?? null,
        percentage: r.percentage,
        pool: rolVigente ? (rolVigente.belongsTo === "sozu_central" ? "sozu" : "project") : r.pool,
        perfil: c?.tipoPersonal ?? null,
        comisionista: c?.nombre ?? null,
      };
    }),
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

        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-9 gap-1.5"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Vuelve a leer del sistema canales, comisiones, comisionistas y validaciones"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          {refreshing ? "Actualizando…" : "Actualizar"}
        </Button>
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

  // El snapshot de la propuesta está congelado y puede traer roles obsoletos
  // (ej. Alma Castellón como "Data & IA"). Se corrige contra el Directorio
  // vigente por NOMBRE de comisionista (el snapshot no guarda id de persona), y
  // se agrega el Perfil (Empleado SOZU / Colaborador Investimento) para la columna.
  const comisionistasPorId = useComisionistasPorId(propuesta?.id_proyecto);
  const comisionistaPorNombre = useMemo(() => {
    const m = new Map<string, ComisionistaReal>();
    comisionistasPorId.forEach((c) => m.set(normNombre(c.nombre), c));
    return m;
  }, [comisionistasPorId]);
  const snapshotCorregido = useMemo<MotorSnapshot | null>(() => {
    if (!propuesta) return null;
    const s = propuesta.snapshot;
    return {
      ...s,
      commissionRules: s.commissionRules.map((r) => {
        const c = r.comisionista ? comisionistaPorNombre.get(normNombre(r.comisionista)) : null;
        if (!c) return r;
        const rolVigente =
          c.roles.find((x) => x.roleId === r.roleId) ??
          c.roles.find((x) => x.origen === "base") ??
          c.roles[0] ??
          null;
        return {
          ...r,
          roleId: rolVigente?.roleId ?? r.roleId,
          rolNombre: rolVigente?.rolNombre ?? null,
          pool: rolVigente ? (rolVigente.belongsTo === "sozu_central" ? "sozu" : "project") : r.pool,
          perfil: c.tipoPersonal ?? null,
        };
      }),
    };
  }, [propuesta, comisionistaPorNombre]);

  const canales = propuesta?.snapshot?.channels ?? [];

  // Decisión VIGENTE por canal: se conserva mientras la HUELLA del canal no
  // cambie, aunque la propuesta se haya reenviado por cambios en OTROS canales.
  // Solo si ESTE canal se modificó (huella distinta) vuelve a quedar pendiente y
  // se rehabilita su validación. Las filas viejas sin `canal_hash` caen al
  // criterio anterior (por fecha de la propuesta). Se conserva quién y cuándo validó.
  const decisionPorCanal = useMemo(() => {
    const m = new Map<string, { estado: EstadoValidacionCanal; fecha_validacion: string; validado_por: string | null }>();
    if (!propuesta) return m;
    for (const v of validacionesCanal) {
      const vigente = v.canal_hash != null
        ? v.canal_hash === fingerprintCanal(propuesta.snapshot, v.id_canal)
        : v.snapshot_fecha === propuesta.fecha_actualizacion;
      if (vigente && !m.has(v.id_canal)) {
        m.set(v.id_canal, { estado: v.estado, fecha_validacion: v.fecha_validacion, validado_por: v.validado_por });
      }
    }
    return m;
  }, [validacionesCanal, propuesta]);

  const estadoPorCanal = useMemo(
    () => new Map<string, EstadoValidacionCanal>([...decisionPorCanal].map(([k, v]) => [k, v.estado])),
    [decisionPorCanal],
  );

  const resumen = useMemo(() => {
    let validados = 0, rechazados = 0;
    for (const ch of canales) {
      const e = estadoPorCanal.get(ch.id);
      if (e === "validada") validados++;
      else if (e === "rechazada") rechazados++;
    }
    return {
      total: canales.length,
      validados,
      rechazados,
      pendientes: canales.length - validados - rechazados,
    };
  }, [canales, estadoPorCanal]);

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
        canal_hash: fingerprintCanal(propuesta.snapshot, canal.id),
      },
      {
        onSuccess: () => {
          // Recalcular el estado agregado y reflejarlo en la propuesta.
          const next = new Map(estadoPorCanal);
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
        const d = decisionPorCanal.get(canal.id);
        const e = d?.estado;
        return (
          <div className="flex flex-col items-end gap-1">
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
            {/* Día, hora y usuario que dejó vigente la decisión de ESTE canal. */}
            {d && (
              <span className="text-[10px] text-muted-foreground">
                {e === "validada" ? "Validado" : "Rechazado"} por {d.validado_por || "—"} · {fmtFecha(d.fecha_validacion)}
              </span>
            )}
          </div>
        );
      };

  const estadoActual = derivarEstado(estadoPorCanal);

  return (
    <Sheet open={!!propuesta} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {propuesta && (
          <>
            <SheetHeader className="shrink-0 space-y-1 border-b border-border px-6 py-5 text-left">
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {propuesta.proyecto_nombre}
                <Badge variant="secondary" className={cn("text-[10px]", ESTADO_BADGE[estadoActual].cls)}>
                  {ESTADO_BADGE[estadoActual].label}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                Valida cada Canal de Venta. El proyecto queda Validado cuando todos sus canales lo están.
                {propuesta.propuesta_por ? ` · Propuesto por ${propuesta.propuesta_por}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {(
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Validación por canal</p>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {resumen.validados + resumen.rechazados} / {resumen.total} decididos
                    </span>
                  </div>
                  {/* Barra de progreso: validados (verde) + rechazados (rojo) sobre el total. */}
                  <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="bg-emerald-500 transition-all" style={{ width: `${resumen.total ? (resumen.validados / resumen.total) * 100 : 0}%` }} />
                    <div className="bg-red-500 transition-all" style={{ width: `${resumen.total ? (resumen.rechazados / resumen.total) * 100 : 0}%` }} />
                  </div>
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
                snapshot={snapshotCorregido ?? propuesta.snapshot}
                precioReferenciaInicial={precioReferencia || undefined}
                renderChannelAction={renderChannelAction}
                channelStatus={(id) => estadoPorCanal.get(id) ?? "pendiente"}
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
