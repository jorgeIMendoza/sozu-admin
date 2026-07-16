import { useState } from "react";
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
import { SimulatorProvider, useSimulator } from "@/lib/portal-estructura-comisiones/stores/SimulatorContext";
import { MotorComisionesReadOnly } from "@/components/admin/portal-alta-direccion/MotorComisionesReadOnly";
import {
  useComisionesPropuestas,
  useValidarPropuesta,
  useValidacionesHistorial,
  type ComisionPropuesta,
  type EstadoPropuesta,
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
          <TabsTrigger value="validacion">Validación por proyecto</TabsTrigger>
        </TabsList>
        <TabsContent value="motor" className="mt-5">
          <SimulatorProvider>
            <MotorConsulta />
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

  const snapshot: MotorSnapshot = {
    totalCommissionPct: motorConfig.totalCommissionPct,
    channels: channels.map((c) => ({ id: c.id, name: c.name, externalCommissionPct: c.externalCommissionPct, active: c.active })),
    roles: roles.map((r) => ({ id: r.id, name: r.name, belongsTo: r.belongsTo })),
    roleAssignments: roleAssignments.map((a) => ({ roleId: a.roleId, baseSalary: a.baseSalary })),
    commissionRules: commissionRules.map((r) => ({ channelId: r.channelId, roleId: r.roleId, percentage: r.percentage, pool: r.pool })),
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
        <MotorComisionesReadOnly snapshot={snapshot} />
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
  const validar = useValidarPropuesta();
  const { data: historial = [] } = useValidacionesHistorial(propuesta?.id_proyecto);
  const [notas, setNotas] = useState("");

  const decidir = (estado: "validada" | "rechazada") => {
    if (!propuesta) return;
    if (estado === "rechazada" && !notas.trim()) {
      toast.error("Indica el motivo del rechazo en las notas.");
      return;
    }
    validar.mutate(
      {
        propuestaId: propuesta.id,
        id_proyecto: propuesta.id_proyecto,
        snapshot: propuesta.snapshot,
        estado,
        notas: estado === "rechazada" ? notas.trim() : null,
        validado_por: validadoPor,
      },
      {
        onSuccess: () => {
          toast.success(estado === "validada" ? "Estructura validada" : "Estructura rechazada");
          setNotas("");
          onClose();
        },
        onError: (e: any) => toast.error(e?.message || "No se pudo registrar la decisión."),
      },
    );
  };

  return (
    <Sheet open={!!propuesta} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {propuesta && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {propuesta.proyecto_nombre}
                <Badge variant="secondary" className={cn("text-[10px]", ESTADO_BADGE[propuesta.estado].cls)}>
                  {ESTADO_BADGE[propuesta.estado].label}
                </Badge>
              </SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-5">
              <MotorComisionesReadOnly snapshot={propuesta.snapshot} />

              <div className="rounded-xl border bg-card p-4">
                <p className="mb-2 text-sm font-semibold">Validación</p>
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  placeholder="Notas (requeridas si rechazas)…"
                  className="mb-3 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50" disabled={validar.isPending} onClick={() => decidir("rechazada")}>
                    <XCircle className="h-4 w-4" /> Rechazar
                  </Button>
                  <Button className="gap-1.5" disabled={validar.isPending} onClick={() => decidir("validada")}>
                    {validar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Validar
                  </Button>
                </div>
              </div>

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
