import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { Panel, PageHeader, Pill } from "@/components/admin/portal-escrituracion/ui";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  EXPEDIENTES, STAGES, HEALTH_META, NOTARIAS, NOTARIOS, AVALUOS,
  BORRADORES, PLANTILLAS, CITAS_FIRMA, ENTREGAS, INSCRIPCIONES,
  fmtMxn,
} from "@/data/escrituracion/mockData";
import { DashboardEscrituracion } from "./DashboardEscrituracion";
import { RelacionPagos } from "./RelacionPagos";
import { ExpedientesDashboard } from "./ExpedientesDashboard";
import { NotariasDashboard } from "./NotariasDashboard";
import { PldDashboard } from "./PldDashboard";
import { CreditosHipotecariosDashboard } from "./CreditosHipotecariosDashboard";
import { ProgramarCitasDashboard } from "./ProgramarCitasDashboard";
import { DemandasDashboard } from "./DemandasDashboard";
import { EntregasDashboard } from "./EntregasDashboard";
import { EntregaDetalle } from "./EntregaDetalle";
import { PostventaDashboard } from "./PostventaDashboard";
import { PostventaDetalle } from "./PostventaTicketDetalle";
import { WorkflowDashboard } from "./WorkflowDashboard";
import { AppNotariaDashboard } from "./AppNotariaDashboard";
import { AppNotariaUsuarios } from "./AppNotariaUsuarios";
import { AppJuridicoDashboard } from "./AppJuridicoDashboard";

// ============================ Dashboard ============================
export function EscDashboard() {
  return <DashboardEscrituracion />;
}

// ============================ Relación de Pagos ============================
export function EscRelacionPagos() {
  return <RelacionPagos />;
}

// ============================ Expedientes ============================
export function EscExpedientes() {
  return <ExpedientesDashboard />;
}

// ============================ Pipeline visual ============================
export function EscPipeline() {
  const counts = STAGES.map((s) => ({ s, c: EXPEDIENTES.filter((e) => e.stage === s.key).length }));
  return (
    <>
      <PageHeader title="Pipeline Notarial" description="Distribución del workflow de escrituración" />
      <div className="flex flex-wrap gap-3">
        {counts.map(({ s, c }, i) => (
          <div key={s.key} className="flex-1 min-w-[180px] rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Paso {i + 1}</p>
            <p className="mt-1 text-sm font-medium">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{c}</p>
          </div>
        ))}
      </div>

      <Panel title="Expedientes por etapa" description="Vista detallada" className="mt-6">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Expediente</TableHead><TableHead>Cliente</TableHead><TableHead>Etapa</TableHead><TableHead>Días en etapa</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {EXPEDIENTES.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.id}</TableCell>
                <TableCell>{e.client}</TableCell>
                <TableCell><Pill>{STAGES.find((s) => s.key === e.stage)?.label}</Pill></TableCell>
                <TableCell className="tabular-nums">{e.daysInStage} d</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ Unidades en Escrituración ============================
export function EscUnidades() {
  return (
    <>
      <PageHeader title="Unidades en Escrituración" description="Departamentos con expediente activo" />
      <Panel title="Listado" description={`${EXPEDIENTES.length} unidades`}>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Unidad</TableHead><TableHead>Desarrollo</TableHead><TableHead>Cliente</TableHead><TableHead>Monto</TableHead><TableHead>Forma de pago</TableHead><TableHead>Notaría</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {EXPEDIENTES.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.unit}</TableCell>
                <TableCell>{e.project}</TableCell>
                <TableCell>{e.client}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(e.amount)}</TableCell>
                <TableCell><Pill>{e.payment}{e.bank ? ` · ${e.bank}` : ""}</Pill></TableCell>
                <TableCell>{e.notary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ Crédito Hipotecario ============================
export function EscCredito() {
  return <CreditosHipotecariosDashboard />;
}

// ============================ Programar Citas ============================
export function EscCitas() {
  return <ProgramarCitasDashboard />;
}

// ============================ Dashboard de Demandas ============================
export function EscDemandas() {
  return <DemandasDashboard />;
}

// ============================ Notarías ============================
export function EscNotarias() {
  return <NotariasDashboard />;
}

// ============================ Notarios ============================
export function EscNotarios() {
  return (
    <>
      <PageHeader title="Notarios" description="Titulares y asociados" />
      <Panel title="Listado">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nombre</TableHead><TableHead>Notaría</TableHead><TableHead>Cédula</TableHead><TableHead>Especialidad</TableHead><TableHead>Email</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {NOTARIOS.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="font-medium">{n.nombre}</TableCell>
                <TableCell>{NOTARIAS.find((x) => x.id === n.notariaId)?.num ? `Notaría ${NOTARIAS.find((x) => x.id === n.notariaId)?.num}` : "—"}</TableCell>
                <TableCell>{n.cedula}</TableCell>
                <TableCell>{n.especialidad}</TableCell>
                <TableCell className="text-muted-foreground">{n.email}</TableCell>
                <TableCell><Pill className={n.activo ? HEALTH_META.on_track.className : HEALTH_META.delayed.className}>{n.activo ? "Activo" : "Inactivo"}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ Avalúos ============================
export function EscAvaluos() {
  return (
    <>
      <PageHeader title="Avalúos" description="Solicitudes y resultados bancarios" />
      <Panel title="Operaciones">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Unidad</TableHead><TableHead>Cliente</TableHead><TableHead>Banco</TableHead><TableHead>Perito</TableHead><TableHead>Monto</TableHead><TableHead>Solicitud</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {AVALUOS.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.id}</TableCell>
                <TableCell>{a.unit} · {a.project}</TableCell>
                <TableCell>{a.client}</TableCell>
                <TableCell>{a.banco}</TableCell>
                <TableCell>{a.perito}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(a.monto)}</TableCell>
                <TableCell>{a.fechaSolicitud}</TableCell>
                <TableCell><Pill>{a.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ PLD ============================
export function EscPLD() {
  return <PldDashboard />;
}

// ============================ Borradores ============================
export function EscBorradores() {
  return (
    <>
      <PageHeader title="Borradores" description="Versiones de escritura en revisión" />
      <Panel title="Lista">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Expediente</TableHead><TableHead>Versión</TableHead><TableHead>Autor</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {BORRADORES.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.id}</TableCell>
                <TableCell>{b.expedienteId}</TableCell>
                <TableCell>v{b.version}</TableCell>
                <TableCell>{b.autor}</TableCell>
                <TableCell>{b.fecha}</TableCell>
                <TableCell><Pill>{b.estado.replace("_", " ")}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ Plantillas ============================
export function EscPlantillas() {
  return (
    <>
      <PageHeader title="Plantillas de Escritura" description="Catálogo de plantillas vigentes" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {PLANTILLAS.map((p) => (
          <Panel key={p.id} title={p.nombre} description={p.tipo}>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{p.version}</Badge>
              <span className="text-xs text-muted-foreground">Actualizada {p.actualizada}</span>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

// ============================ Firmas ============================
export function EscFirmas() {
  return (
    <>
      <PageHeader title="Programación de Firmas" description="Citas notariales agendadas" />
      <Panel title="Próximas firmas">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Expediente</TableHead><TableHead>Cliente</TableHead><TableHead>Notaría</TableHead><TableHead>Fecha</TableHead><TableHead>Hora</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {CITAS_FIRMA.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>{c.expedienteId}</TableCell>
                <TableCell>{c.cliente}</TableCell>
                <TableCell>{c.notary}</TableCell>
                <TableCell>{c.fecha}</TableCell>
                <TableCell>{c.hora}</TableCell>
                <TableCell><Pill>{c.estado.replace("_", " ")}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ Entregas físicas ============================
export function EscEntregas() {
  return <EntregasDashboard />;
}

export function EscEntregaDetalle() {
  return <EntregaDetalle />;
}

// ============================ Postventa ============================
export function EscPostventa() {
  return <PostventaDashboard />;
}

export function EscPostventaDetalle() {
  return <PostventaDetalle />;
}

// ============================ Workflow ============================
export function EscWorkflow() {
  return <WorkflowDashboard />;
}

// ============================ App Notaría ============================
export function EscAppNotaria() {
  return <AppNotariaDashboard />;
}

// ============================ Usuarios Notaría ============================
export function EscAppNotariaUsuarios() {
  return <AppNotariaUsuarios />;
}

// ============================ App Jurídico ============================
export function EscAppJuridico() {
  return <AppJuridicoDashboard />;
}

// ============================ Inscripción RPP ============================
export function EscRPP() {
  return (
    <>
      <PageHeader title="Inscripción RPP" description="Registro Público de la Propiedad" />
      <Panel title="Trámites">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Expediente</TableHead><TableHead>Unidad</TableHead><TableHead>Ingreso</TableHead><TableHead>Salida</TableHead><TableHead>Folio Real</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {INSCRIPCIONES.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.id}</TableCell>
                <TableCell>{r.expedienteId}</TableCell>
                <TableCell>{r.unidad}</TableCell>
                <TableCell>{r.fechaIngreso}</TableCell>
                <TableCell>{r.fechaSalida ?? "—"}</TableCell>
                <TableCell>{r.folioReal ?? "—"}</TableCell>
                <TableCell><Pill>{r.estado.replace("_", " ")}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ Reportes / Auditoría / Configuración ============================
export function EscReportes() {
  return (
    <>
      <PageHeader title="Reportes" description="Indicadores y descargas" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Panel title="Cierres del mes" description="Escrituras firmadas"><p className="text-3xl font-semibold tabular-nums">{EXPEDIENTES.filter((e) => e.health === "done").length}</p></Panel>
        <Panel title="Pipeline MXN" description="Por cerrar"><p className="text-3xl font-semibold tabular-nums">{fmtMxn(EXPEDIENTES.filter((e) => e.health !== "done").reduce((s, e) => s + e.amount, 0))}</p></Panel>
        <Panel title="Notarías activas" description="Con expedientes en curso"><p className="text-3xl font-semibold tabular-nums">{new Set(EXPEDIENTES.map((e) => e.notary)).size}</p></Panel>
      </div>
    </>
  );
}

export function EscAuditoria() {
  return (
    <>
      <PageHeader title="Auditoría" description="Bitácora de cambios" />
      <Panel title="Eventos recientes (demo)">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2"><Clock className="size-3.5 text-muted-foreground" /> ESC-2041 — Borrador v3 aprobado · Notaría 51 · hace 2 h</li>
          <li className="flex items-center gap-2"><Clock className="size-3.5 text-muted-foreground" /> ESC-2043 — Avalúo aceptado · BBVA · hace 5 h</li>
          <li className="flex items-center gap-2"><Clock className="size-3.5 text-muted-foreground" /> ESC-2048 — Escritura inscrita en RPP · ayer</li>
          <li className="flex items-center gap-2"><Clock className="size-3.5 text-muted-foreground" /> ESC-2045 — Cambio de notaría asignada · ayer</li>
        </ul>
      </Panel>
    </>
  );
}

export function EscConfiguracion() {
  return (
    <>
      <PageHeader title="Configuración" description="Parámetros del Portal Escrituración" />
      <Panel title="Preferencias" description="Configuración general">
        <p className="text-sm text-muted-foreground">
          Aquí vivirán: SLAs por notaría, plantillas predeterminadas por banco, integraciones con Mifiel y reglas de asignación automática. Estado actual: demo.
        </p>
      </Panel>
    </>
  );
}