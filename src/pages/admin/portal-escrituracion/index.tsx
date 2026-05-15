import { useMemo, useState } from "react";
import {
  FileText, Building2, Landmark, ScrollText, Stamp, UserCog, CheckCircle2,
  FileSignature, FileStack, CalendarDays, PackageCheck, BookCheck, BarChart3,
  History, Settings, Banknote, AlertTriangle, Clock, Search,
} from "lucide-react";
import { Kpi, Panel, PageHeader, Pill } from "@/components/admin/portal-escrituracion/ui";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  EXPEDIENTES, STAGES, HEALTH_META, NOTARIAS, NOTARIOS, AVALUOS, DOCS_PLD,
  BORRADORES, PLANTILLAS, CITAS_FIRMA, ENTREGAS, INSCRIPCIONES, CREDITOS,
  fmtMxn,
} from "@/data/escrituracion/mockData";
import { DashboardEscrituracion } from "./DashboardEscrituracion";
import { RelacionPagos } from "./RelacionPagos";

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
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("all");

  const filtered = useMemo(
    () =>
      EXPEDIENTES.filter((e) => {
        if (stage !== "all" && e.stage !== stage) return false;
        if (q && !`${e.id} ${e.unit} ${e.client}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [q, stage]
  );

  return (
    <>
      <PageHeader title="Expedientes" description="Pipeline completo de escrituración" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por expediente, unidad o cliente…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
        >
          <option value="all">Todas las etapas</option>
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      <Panel title="Lista de expedientes" description={`${filtered.length} resultado(s)`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expediente</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Notaría</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Firma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.id}</TableCell>
                  <TableCell>{e.unit} <span className="text-muted-foreground text-xs">· {e.project}</span></TableCell>
                  <TableCell>{e.client}</TableCell>
                  <TableCell>{e.notary}</TableCell>
                  <TableCell className="tabular-nums">{fmtMxn(e.amount)}</TableCell>
                  <TableCell><Pill>{STAGES.find((s) => s.key === e.stage)?.label}</Pill></TableCell>
                  <TableCell className="min-w-[120px]">
                    <Progress value={e.progress} className="h-2" />
                    <span className="text-[11px] text-muted-foreground">{e.progress}%</span>
                  </TableCell>
                  <TableCell><Pill className={HEALTH_META[e.health].className}>{HEALTH_META[e.health].label}</Pill></TableCell>
                  <TableCell className="text-muted-foreground">{e.signDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </>
  );
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
  const totalAutorizado = CREDITOS.reduce((s, c) => s + c.montoAutorizado, 0);
  const totalSolicitado = CREDITOS.reduce((s, c) => s + c.montoSolicitado, 0);
  return (
    <>
      <PageHeader title="Crédito Hipotecario" description="Pipeline bancario" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="Solicitudes activas" value={CREDITOS.length} icon={Landmark} />
        <Kpi label="Monto solicitado" value={fmtMxn(totalSolicitado)} icon={Banknote} tone="info" />
        <Kpi label="Monto autorizado" value={fmtMxn(totalAutorizado)} icon={CheckCircle2} tone="success" />
      </div>
      <Panel title="Operaciones" description="Por banco e institución" className="mt-6">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Crédito</TableHead><TableHead>Cliente</TableHead><TableHead>Banco</TableHead><TableHead>Solicitado</TableHead><TableHead>Autorizado</TableHead><TableHead>Tasa</TableHead><TableHead>Plazo</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {CREDITOS.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>{c.cliente}</TableCell>
                <TableCell>{c.banco}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(c.montoSolicitado)}</TableCell>
                <TableCell className="tabular-nums">{c.montoAutorizado ? fmtMxn(c.montoAutorizado) : "—"}</TableCell>
                <TableCell className="tabular-nums">{c.tasa ? `${c.tasa.toFixed(2)}%` : "—"}</TableCell>
                <TableCell>{c.plazoMeses} m</TableCell>
                <TableCell><Pill>{c.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ Notarías ============================
export function EscNotarias() {
  return (
    <>
      <PageHeader title="Notarías" description="Directorio operativo" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {NOTARIAS.map((n) => (
          <Panel key={n.id} title={`Notaría ${n.num}`} description={n.zona}>
            <p className="text-sm font-medium">{n.titular}</p>
            <p className="text-xs text-muted-foreground">{n.email} · {n.telefono}</p>
            <div className="mt-3 flex items-center gap-2">
              <Pill>Carga: {n.cargaActiva}</Pill>
              <Pill>SLA: {n.slaPromedioDias} d</Pill>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
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
  return (
    <>
      <PageHeader title="Expedientes / PLD" description="Checklist de documentación y prevención de lavado" />
      <Panel title="Documentos">
        <Table>
          <TableHeader>
            <TableRow><TableHead>ID</TableHead><TableHead>Expediente</TableHead><TableHead>Cliente</TableHead><TableHead>Documento</TableHead><TableHead>Responsable</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {DOCS_PLD.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.id}</TableCell>
                <TableCell>{d.expedienteId}</TableCell>
                <TableCell>{d.cliente}</TableCell>
                <TableCell>{d.documento}</TableCell>
                <TableCell>{d.responsable}</TableCell>
                <TableCell><Pill>{d.estado.replace("_", " ")}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
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
  return (
    <>
      <PageHeader title="Entregas Físicas" description="Checklist por unidad" />
      <Panel title="Listado">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Expediente</TableHead><TableHead>Cliente</TableHead><TableHead>Unidad</TableHead><TableHead>Fecha</TableHead><TableHead>Llaves</TableHead><TableHead>Manuales</TableHead><TableHead>Acceso</TableHead><TableHead>Tarjetón</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {ENTREGAS.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.id}</TableCell>
                <TableCell>{e.expedienteId}</TableCell>
                <TableCell>{e.cliente}</TableCell>
                <TableCell>{e.unidad}</TableCell>
                <TableCell>{e.fechaProgramada}</TableCell>
                <TableCell>{e.checklist.llaves ? "✓" : "—"}</TableCell>
                <TableCell>{e.checklist.manuales ? "✓" : "—"}</TableCell>
                <TableCell>{e.checklist.controlAcceso ? "✓" : "—"}</TableCell>
                <TableCell>{e.checklist.tarjeton ? "✓" : "—"}</TableCell>
                <TableCell><Pill>{e.estado.replace("_", " ")}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
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