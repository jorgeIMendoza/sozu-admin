import {
  TrendingUp, Percent, Receipt, Clock, Building2, FileText,
  CheckCircle, AlertTriangle, Banknote, Landmark, Users, History,
  CalendarCheck, Briefcase, FileSignature, BarChart3, Settings, UserSearch,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Kpi, Panel, PageHeader, Pill } from "@/components/admin/portal-alta-direccion/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  REVENUE_BY_PROJECT, REVENUE_BY_CHANNEL, MONTHLY_TREND, CHART_COLORS,
  AUDIT_EVENTS, fmtMxn,
} from "@/data/altaDireccion/mockData";

const DemoBadge = () => (
  <Pill className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Datos demo</Pill>
);
const LiveBadge = () => (
  <Pill className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Datos en vivo</Pill>
);

// ============================ Dashboard ============================
export function AltaDireccionDashboard() {
  return (
    <>
      <PageHeader
        title="Dashboard Ejecutivo"
        description="Resumen financiero y comercial de SOZU"
        action={<DemoBadge />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Ingresos Totales" value={fmtMxn(96500000)} icon={TrendingUp} tone="success" hint="+12.3% vs mes anterior" />
        <Kpi label="Comisiones Cobradas" value={fmtMxn(14475000)} icon={Percent} tone="primary" hint="+8.5% vs mes anterior" />
        <Kpi label="Facturas Emitidas" value="87" icon={Receipt} hint={fmtMxn(78200000)} />
        <Kpi label="Facturas Pendientes" value="14" icon={Clock} tone="warning" hint={fmtMxn(12800000)} />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Departamentos Vendidos" value="124" icon={Building2} tone="success" hint="de 200 totales" />
        <Kpi label="Departamentos Apartados" value="18" icon={Building2} tone="primary" hint="en proceso" />
        <Kpi label="Departamentos Disponibles" value="58" icon={Building2} hint="29% inventario" />
        <Kpi label="Ofertas Pendientes" value="7" icon={FileText} tone="warning" hint="requieren aprobación" />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Comisiones Devengadas" value={fmtMxn(5200000)} icon={Percent} tone="primary" />
        <Kpi label="Comisiones Aprobadas" value={fmtMxn(3800000)} icon={CheckCircle} tone="success" />
        <Kpi label="Contratos Pendientes" value="5" icon={FileSignature} tone="warning" />
        <Kpi label="Alertas Críticas" value="3" icon={AlertTriangle} tone="destructive" />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Ingresos por Desarrollo" description="Total acumulado por proyecto">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={REVENUE_BY_PROJECT}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => fmtMxn(v)} />
              <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Ingresos por Canal" description="Distribución por canal de venta">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={REVENUE_BY_CHANNEL} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                {REVENUE_BY_CHANNEL.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtMxn(v)} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Tendencia Mensual" description="Ingresos y comisiones — últimos 6 meses" className="mt-4">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={MONTHLY_TREND}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} />
            <Tooltip formatter={(v: number) => fmtMxn(v)} />
            <Legend />
            <Line type="monotone" dataKey="ingresos" stroke={CHART_COLORS[0]} strokeWidth={2} />
            <Line type="monotone" dataKey="comisiones" stroke={CHART_COLORS[1]} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </>
  );
}

// ============================ Comercial ============================
const CITAS = [
  { id: "CITA-2041", cliente: "María García López", fecha: "2026-05-14", hora: "10:00", desarrollo: "Daiku",   agente: "Carlos Mendoza", estado: "confirmada" },
  { id: "CITA-2042", cliente: "Juan Pérez Silva",   fecha: "2026-05-14", hora: "11:30", desarrollo: "Bottura", agente: "Ana Ruiz",       estado: "pendiente"  },
  { id: "CITA-2043", cliente: "Sofía Rivera",       fecha: "2026-05-15", hora: "09:00", desarrollo: "Monócolo",agente: "Carlos Mendoza", estado: "confirmada" },
];

export function AltaDireccionCitas() {
  return (
    <>
      <PageHeader title="Citas Comerciales" description="Visitas y showrooms agendados" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Citas esta semana" value="2 citas" icon={CalendarCheck} tone="primary" />
        <Kpi label="Confirmadas" value="2 citas" icon={CheckCircle} tone="success" />
        <Kpi label="Pendientes" value="1 cita" icon={Clock} tone="warning" />
      </div>
      <Panel title="Próximas citas">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Fecha</TableHead>
              <TableHead>Hora</TableHead><TableHead>Desarrollo</TableHead><TableHead>Agente</TableHead><TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CITAS.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>{c.cliente}</TableCell>
                <TableCell>{c.fecha}</TableCell>
                <TableCell>{c.hora}</TableCell>
                <TableCell>{c.desarrollo}</TableCell>
                <TableCell>{c.agente}</TableCell>
                <TableCell><Pill>{c.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

const PROSPECTOS = [
  { id: "LEAD-9001", nombre: "Roberto Gómez", canal: "Inmobiliaria", desarrollo: "Daiku",   etapa: "Nuevo",    score: 78 },
  { id: "LEAD-9002", nombre: "Patricia Luna", canal: "Broker",       desarrollo: "Bottura", etapa: "Calificado", score: 91 },
  { id: "LEAD-9003", nombre: "Diego Soto",    canal: "Embajador",    desarrollo: "Monócolo",etapa: "Visita",    score: 65 },
  { id: "LEAD-9004", nombre: "Lucía Hernández", canal: "Referido",   desarrollo: "Daiku",   etapa: "Negociación", score: 88 },
];

export function AltaDireccionProspectos() {
  return (
    <>
      <PageHeader title="Prospectos" description="Leads activos por canal y desarrollo" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Kpi label="Leads activos" value={PROSPECTOS.length} icon={UserSearch} tone="primary" />
        <Kpi label="Score promedio" value="80.5" icon={TrendingUp} tone="success" />
        <Kpi label="En negociación" value="1" icon={Briefcase} tone="info" />
        <Kpi label="Sin contacto >7d" value="0" icon={AlertTriangle} />
      </div>
      <Panel title="Listado">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead><TableHead>Nombre</TableHead><TableHead>Canal</TableHead>
              <TableHead>Desarrollo</TableHead><TableHead>Etapa</TableHead><TableHead>Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PROSPECTOS.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.id}</TableCell>
                <TableCell>{p.nombre}</TableCell>
                <TableCell>{p.canal}</TableCell>
                <TableCell>{p.desarrollo}</TableCell>
                <TableCell><Pill>{p.etapa}</Pill></TableCell>
                <TableCell className="tabular-nums">{p.score}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

const PIPELINE_STAGES = [
  { key: "nuevo",     label: "Nuevo",       count: 14, value: 18000000 },
  { key: "calificado",label: "Calificado",  count:  9, value: 22500000 },
  { key: "visita",    label: "Visita",      count:  6, value: 19800000 },
  { key: "oferta",    label: "Oferta",      count:  4, value: 17600000 },
  { key: "negocia",   label: "Negociación", count:  3, value: 14400000 },
  { key: "ganado",    label: "Ganado",      count:  7, value: 28500000 },
];

export function AltaDireccionPipeline() {
  return (
    <>
      <PageHeader title="Pipeline" description="Oportunidades por etapa" action={<DemoBadge />} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {PIPELINE_STAGES.map((s, i) => (
          <div key={s.key} className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Etapa {i + 1}</p>
            <p className="mt-1 text-sm font-medium">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{s.count}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">{fmtMxn(s.value)}</p>
          </div>
        ))}
      </div>
      <Panel title="Conversión esperada" description="Por etapa" className="mt-4">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={PIPELINE_STAGES}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </>
  );
}

const OFERTAS = [
  { id: "OFR-3001", cliente: "María García",  unidad: "Daiku A-201",    monto: 4500000, estado: "aprobada"  },
  { id: "OFR-3002", cliente: "Juan Pérez",    unidad: "Bottura PH-3",   monto: 7200000, estado: "pendiente" },
  { id: "OFR-3003", cliente: "Sofía Rivera",  unidad: "Monócolo B-105", monto: 3100000, estado: "rechazada" },
  { id: "OFR-3004", cliente: "Lucía H.",      unidad: "Daiku C-402",    monto: 5800000, estado: "pendiente" },
];

export function AltaDireccionOfertas() {
  const total = OFERTAS.reduce((s, o) => s + o.monto, 0);
  const pend = OFERTAS.filter((o) => o.estado === "pendiente").length;
  return (
    <>
      <PageHeader title="Ofertas" description="Aprobaciones y revisión ejecutiva" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Ofertas activas" value={OFERTAS.length} icon={FileText} tone="primary" />
        <Kpi label="Por aprobar" value={pend} icon={Clock} tone="warning" />
        <Kpi label="Monto total" value={fmtMxn(total)} icon={Banknote} tone="success" />
      </div>
      <Panel title="Lista">
        <Table>
          <TableHeader>
            <TableRow><TableHead>ID</TableHead><TableHead>Cliente</TableHead><TableHead>Unidad</TableHead><TableHead>Monto</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {OFERTAS.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.id}</TableCell>
                <TableCell>{o.cliente}</TableCell>
                <TableCell>{o.unidad}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(o.monto)}</TableCell>
                <TableCell><Pill>{o.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ Operación ============================
const COBRANZA = [
  { id: "COB-001", cliente: "María García",  unidad: "Daiku A-201",  saldo: 0,        total: 4500000, estado: "pagada"   },
  { id: "COB-002", cliente: "Juan Pérez",    unidad: "Bottura PH-3", saldo: 5400000,  total: 7200000, estado: "al_dia"   },
  { id: "COB-003", cliente: "Sofía Rivera",  unidad: "Monócolo B-1", saldo: 1800000,  total: 3100000, estado: "vencida"  },
];

export function AltaDireccionCobranza() {
  const cobrado = COBRANZA.reduce((s, c) => s + (c.total - c.saldo), 0);
  const por_cobrar = COBRANZA.reduce((s, c) => s + c.saldo, 0);
  return (
    <>
      <PageHeader title="Cobranza" description="Resumen ejecutivo de cuentas" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Kpi label="Cuentas activas" value={COBRANZA.length} icon={Landmark} tone="primary" />
        <Kpi label="Cobrado" value={fmtMxn(cobrado)} icon={CheckCircle} tone="success" />
        <Kpi label="Por cobrar" value={fmtMxn(por_cobrar)} icon={Clock} tone="warning" />
        <Kpi label="Vencidas" value={COBRANZA.filter((c) => c.estado === "vencida").length} icon={AlertTriangle} tone="destructive" />
      </div>
      <Panel title="Cuentas">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Unidad</TableHead><TableHead>Total</TableHead><TableHead>Saldo</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {COBRANZA.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>{c.cliente}</TableCell>
                <TableCell>{c.unidad}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(c.total)}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(c.saldo)}</TableCell>
                <TableCell><Pill>{c.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

const CONTRATOS = [
  { id: "CTR-201", cliente: "María García", unidad: "Daiku A-201",  fecha: "2026-04-12", estado: "firmado"  },
  { id: "CTR-202", cliente: "Juan Pérez",   unidad: "Bottura PH-3", fecha: "2026-05-02", estado: "pendiente" },
  { id: "CTR-203", cliente: "Sofía Rivera", unidad: "Monócolo B-1", fecha: "2026-05-09", estado: "firmado"  },
];

export function AltaDireccionContratos() {
  return (
    <>
      <PageHeader title="Contratos" description="Estatus de contratos firmados y pendientes" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Total" value={CONTRATOS.length} icon={FileSignature} tone="primary" />
        <Kpi label="Firmados" value={CONTRATOS.filter((c) => c.estado === "firmado").length} icon={CheckCircle} tone="success" />
        <Kpi label="Pendientes" value={CONTRATOS.filter((c) => c.estado === "pendiente").length} icon={Clock} tone="warning" />
      </div>
      <Panel title="Listado">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Unidad</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {CONTRATOS.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>{c.cliente}</TableCell>
                <TableCell>{c.unidad}</TableCell>
                <TableCell>{c.fecha}</TableCell>
                <TableCell><Pill>{c.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

const FACTURAS = [
  { id: "F-A4501", cliente: "María García", concepto: "Enganche Daiku A-201", monto: 450000,  fecha: "2026-04-15", estado: "timbrada" },
  { id: "F-A4502", cliente: "Juan Pérez",   concepto: "Apartado Bottura",     monto: 100000,  fecha: "2026-05-02", estado: "timbrada" },
  { id: "F-A4503", cliente: "Sofía Rivera", concepto: "Liquidación",          monto: 1800000, fecha: "2026-05-09", estado: "pendiente" },
];

export function AltaDireccionFacturas() {
  const total = FACTURAS.reduce((s, f) => s + f.monto, 0);
  return (
    <>
      <PageHeader title="Facturas" description="CFDIs emitidos y pendientes" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Facturas" value={FACTURAS.length} icon={Receipt} tone="primary" />
        <Kpi label="Monto facturado" value={fmtMxn(total)} icon={Banknote} tone="success" />
        <Kpi label="Pendientes" value={FACTURAS.filter((f) => f.estado === "pendiente").length} icon={Clock} tone="warning" />
      </div>
      <Panel title="CFDIs">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Concepto</TableHead><TableHead>Monto</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {FACTURAS.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.id}</TableCell>
                <TableCell>{f.cliente}</TableCell>
                <TableCell>{f.concepto}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(f.monto)}</TableCell>
                <TableCell>{f.fecha}</TableCell>
                <TableCell><Pill>{f.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

const COMISIONES = [
  { id: "COM-118", agente: "Carlos Mendoza", canal: "Inmobiliaria", monto: 90000,  estado: "pagada"   },
  { id: "COM-119", agente: "Ana Ruiz",       canal: "Broker",       monto: 144000, estado: "aprobada" },
  { id: "COM-120", agente: "Diego Soto",     canal: "Embajador",    monto: 62000,  estado: "devengada"},
];

export function AltaDireccionComisiones() {
  const dev = COMISIONES.filter((c) => c.estado === "devengada").reduce((s, c) => s + c.monto, 0);
  const apr = COMISIONES.filter((c) => c.estado === "aprobada").reduce((s, c) => s + c.monto, 0);
  const pag = COMISIONES.filter((c) => c.estado === "pagada").reduce((s, c) => s + c.monto, 0);
  return (
    <>
      <PageHeader title="Comisiones" description="Devengadas, aprobadas y pagadas" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Devengadas" value={fmtMxn(dev)} icon={Percent} tone="primary" />
        <Kpi label="Aprobadas" value={fmtMxn(apr)} icon={CheckCircle} tone="success" />
        <Kpi label="Pagadas" value={fmtMxn(pag)} icon={Banknote} />
      </div>
      <Panel title="Detalle">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Agente</TableHead><TableHead>Canal</TableHead><TableHead>Monto</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {COMISIONES.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>{c.agente}</TableCell>
                <TableCell>{c.canal}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(c.monto)}</TableCell>
                <TableCell><Pill>{c.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ Administración ============================
const PERSONAS = [
  { id: "P-1", nombre: "Carlos Mendoza", rol: "Agente Sozu",        canal: "Interno",      ventas: 8, comision: 720000 },
  { id: "P-2", nombre: "Ana Ruiz",       rol: "Broker",             canal: "Broker",       ventas: 5, comision: 540000 },
  { id: "P-3", nombre: "Diego Soto",     rol: "Embajador",          canal: "Embajador",    ventas: 3, comision: 186000 },
  { id: "P-4", nombre: "Inmobiliaria X", rol: "Agencia",            canal: "Inmobiliaria", ventas: 12, comision: 1080000 },
];

export function AltaDireccionRedComercial() {
  return (
    <>
      <PageHeader title="Red Comercial" description="Agentes, brokers, embajadores e inmobiliarias" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Personas activas" value={PERSONAS.length} icon={Users} tone="primary" />
        <Kpi label="Ventas totales" value={PERSONAS.reduce((s, p) => s + p.ventas, 0)} icon={Briefcase} tone="success" />
        <Kpi label="Comisión devengada" value={fmtMxn(PERSONAS.reduce((s, p) => s + p.comision, 0))} icon={Percent} />
      </div>
      <Panel title="Top performers">
        <Table>
          <TableHeader>
            <TableRow><TableHead>ID</TableHead><TableHead>Nombre</TableHead><TableHead>Rol</TableHead><TableHead>Canal</TableHead><TableHead>Ventas</TableHead><TableHead>Comisión</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {PERSONAS.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.id}</TableCell>
                <TableCell>{p.nombre}</TableCell>
                <TableCell><Pill>{p.rol}</Pill></TableCell>
                <TableCell>{p.canal}</TableCell>
                <TableCell className="tabular-nums">{p.ventas}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(p.comision)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

export function AltaDireccionReportes() {
  const reportes = [
    { id: "R-1", nombre: "Cierres del mes",     desc: "Ventas escrituradas y apartados" },
    { id: "R-2", nombre: "Pipeline por canal",  desc: "Distribución y conversión" },
    { id: "R-3", nombre: "Cobranza vencida",    desc: "Cuentas con > 30 días" },
    { id: "R-4", nombre: "Comisiones a pagar",  desc: "Devengadas y aprobadas" },
    { id: "R-5", nombre: "Inventario por desarrollo", desc: "Disponible / vendido / apartado" },
    { id: "R-6", nombre: "Facturación CFDI",    desc: "Resumen mensual" },
  ];
  return (
    <>
      <PageHeader title="Reportes" description="Indicadores y descargas ejecutivas" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reportes.map((r) => (
          <Panel key={r.id} title={r.nombre} description={r.desc}>
            <p className="text-xs text-muted-foreground">Disponible próximamente — descarga ejecutiva en CSV/Excel.</p>
          </Panel>
        ))}
      </div>
    </>
  );
}

export function AltaDireccionAuditoria() {
  return (
    <>
      <PageHeader title="Auditoría" description="Bitácora ejecutiva de eventos del sistema" action={<DemoBadge />} />
      <Panel title="Eventos recientes">
        <ul className="space-y-3 text-sm">
          {AUDIT_EVENTS.map((e) => (
            <li key={e.id} className="flex items-start gap-2 border-b last:border-0 border-border pb-3 last:pb-0">
              <History className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-foreground">{e.text}</p>
                <p className="text-xs text-muted-foreground">{e.at}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

export function AltaDireccionConfiguracion() {
  return (
    <>
      <PageHeader title="Configuración" description="Parámetros del Portal Alta Dirección" action={<DemoBadge />} />
      <Panel title="Preferencias" description="Configuración general del portal">
        <p className="text-sm text-muted-foreground">
          Aquí vivirán: umbrales de KPIs, alertas críticas, integraciones con BI y reglas de visibilidad por desarrollo.
          Estado actual: demo.
        </p>
      </Panel>
    </>
  );
}