import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  CalendarCheck,
  UserSearch,
  FileText,
  KeyRound,
  ShoppingCart,
  Wallet,
  ArrowUpFromLine,
  Building2,
  Users,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { PageHeader, Panel, Kpi } from "@/components/admin/portal-alta-direccion/ui";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { useResumenComercial } from "@/hooks/usePortalAltaDireccion/useResumenComercial";
import { useResumenOfertasAprobadas } from "@/hooks/usePortalAltaDireccion/useOfertasPipeline";
import { useResumenFinanzas } from "@/hooks/usePortalAltaDireccion/useResumenFinanzas";
import { useResumenMediciones } from "@/hooks/usePortalAltaDireccion/useResumenMediciones";

/* ──────────────────────────────────────────────────────────
   Helpers de presentación
   ────────────────────────────────────────────────────────── */

function SeccionLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

/** Lista "por proyecto": nombre a la izquierda, valor a la derecha. */
function PorProyecto({
  rows,
  formato = "numero",
}: {
  rows: Array<{ proyecto: string; valor: number; monto?: number }>;
  formato?: "numero" | "moneda";
}) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-muted-foreground py-2">Sin datos este mes.</p>;
  }
  return (
    <ul className="divide-y divide-border/50">
      {rows.map((r) => (
        <li key={r.proyecto} className="flex items-center justify-between py-2 text-[13px]">
          <span className="flex items-center gap-2 text-foreground/80 min-w-0">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <span className="truncate">{r.proyecto}</span>
          </span>
          <span className="tabular-nums font-medium text-foreground whitespace-nowrap">
            {formato === "moneda" ? fmtMxn(r.valor) : r.valor}
            {r.monto != null && (
              <span className="text-muted-foreground font-normal"> · {fmtMxn(r.monto)}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

const minutosLabel = (min: number) => {
  if (min <= 0) return "—";
  if (min < 60) return `${min.toFixed(min < 10 ? 1 : 0)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
};

/* ──────────────────────────────────────────────────────────
   Página — Dashboard General
   ────────────────────────────────────────────────────────── */

export default function AltaDireccionDashboardPage() {
  const navigate = useNavigate();
  const comercialQ = useResumenComercial();
  const ofertasQ = useResumenOfertasAprobadas();
  const finanzasQ = useResumenFinanzas();
  const medicionesQ = useResumenMediciones();

  const c = comercialQ.data;
  const ofertas = ofertasQ.data;
  const f = finanzasQ.data;
  const m = medicionesQ.data;

  const mesLabel = c?.mesLabel ?? new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  // Rango del mes en curso (YYYY-MM-DD) para los CTA que llevan a las
  // pantallas de detalle con el filtro de fechas preaplicado.
  const { desdeMes, hastaMes } = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const mo = d.getMonth();
    const fmt = (dt: Date) => {
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${dt.getFullYear()}-${mm}-${dd}`;
    };
    return {
      desdeMes: fmt(new Date(y, mo, 1)),
      hastaMes: fmt(new Date(y, mo + 1, 0)),
    };
  }, []);

  const irAProspectos = () =>
    navigate(`/admin/portal-alta-direccion/prospectos?desde=${desdeMes}&hasta=${hastaMes}`);

  // CTA "Citas comerciales" → menú Citas Comerciales con las citas generadas
  // (fecha de creación) en el mes en curso.
  const irACitas = () =>
    navigate(`/admin/portal-alta-direccion/citas?desde=${desdeMes}&hasta=${hastaMes}`);

  // CTA "Nuevas ofertas" → Pipeline con tipo Propiedad + mes en curso
  // (todos los agentes / todos los proyectos por defecto).
  const irAPipeline = () =>
    navigate(`/admin/portal-alta-direccion/pipeline?tipo=propiedad&mes=${ofertas.mesKey}`);

  // CTA "Apartados (al momento)" → Histórico Comercial, que ya muestra el
  // KPI "Apartados al momento" (propiedades en estatus Apartado).
  const irAHistorico = () =>
    navigate(`/admin/portal-alta-direccion/historico-comercial`);

  // CTA "Ventas" → Histórico Comercial abriendo el detalle (drill-down) de
  // las ventas del mes en curso, con el caso de cada cuenta.
  const irAVentas = () =>
    navigate(`/admin/portal-alta-direccion/historico-comercial?drill=ventas&mes=${desdeMes}`);

  // CTA "Ingresos del mes" → Ingresos y Egresos en base CAJA (flujo de caja
  // real), mes en curso, todos los proyectos/tipos, vista de ingresos.
  const irAIngresos = () =>
    navigate(
      `/admin/portal-alta-direccion/ingresos-egresos?base=caja&periodo=este_mes&proyecto=todos&tipo=todos&mov=ingresos`,
    );

  // CTA "Egresos externos / internos" → Ingresos y Egresos en base CAJA, mes
  // en curso, vista de egresos, enfocando la Composición de egresos.
  const irAEgresos = () =>
    navigate(
      `/admin/portal-alta-direccion/ingresos-egresos?base=caja&periodo=este_mes&proyecto=todos&tipo=todos&mov=egresos&focus=egresos`,
    );

  return (
    <div>
      <PageHeader
        title="Dashboard General"
        description={`Resumen ejecutivo del portal · ${mesLabel}`}
      />

      {/* ─── Resumen Comercial ─── */}
      <Panel
        title="Resumen Comercial"
        description="Actividad comercial del mes en curso (Apartados al momento)"
        className="mb-6"
      >
        {comercialQ.isLoading ? (
          <SeccionLoader label="Cargando resumen comercial…" />
        ) : comercialQ.error || !c ? (
          <p className="text-sm text-red-600 py-4">No se pudo cargar el resumen comercial.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
              <Kpi
                label="Citas comerciales"
                value={c.citas.total}
                hint="Ver listado del mes →"
                icon={CalendarCheck}
                tone="info"
                onClick={irACitas}
              />
              <Kpi
                label="Prospectos"
                value={c.prospectos.total}
                hint="Ver listado del mes →"
                icon={UserSearch}
                tone="primary"
                onClick={irAProspectos}
              />
              <Kpi
                label="Nuevas ofertas"
                value={ofertasQ.isLoading ? "…" : ofertas.total}
                hint="Aprobadas · ver Pipeline →"
                icon={FileText}
                tone="default"
                onClick={irAPipeline}
              />
              <Kpi
                label="Apartados (al momento)"
                value={c.apartados.total}
                hint="Ver Histórico Comercial →"
                icon={KeyRound}
                tone="warning"
                onClick={irAHistorico}
              />
              <Kpi
                label="Ventas"
                value={c.ventas.total}
                hint={`${fmtMxn(c.ventas.monto)} · ver detalle →`}
                icon={ShoppingCart}
                tone="success"
                onClick={irAVentas}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-4">
              <DesglosePanel titulo="Citas por proyecto"><PorProyecto rows={c.citas.porProyecto} /></DesglosePanel>
              <DesglosePanel titulo="Prospectos por proyecto"><PorProyecto rows={c.prospectos.porProyecto} /></DesglosePanel>
              <DesglosePanel titulo="Ofertas aprobadas por proyecto"><PorProyecto rows={ofertas.porProyecto} /></DesglosePanel>
              <DesglosePanel titulo="Apartados por proyecto"><PorProyecto rows={c.apartados.porProyecto} /></DesglosePanel>
              <DesglosePanel titulo="Ventas por proyecto (núm · monto)"><PorProyecto rows={c.ventas.porProyecto} /></DesglosePanel>
            </div>
          </>
        )}
      </Panel>

      {/* ─── Resumen de Ingresos ─── */}
      <Panel
        title="Resumen de Ingresos"
        description="Comisión SOZU en flujo de caja · mes en curso"
        className="mb-6"
      >
        {finanzasQ.isLoading ? (
          <SeccionLoader label="Cargando ingresos…" />
        ) : finanzasQ.error || !f ? (
          <p className="text-sm text-red-600 py-4">No se pudieron cargar los ingresos.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-4 items-start">
            <div className="lg:col-span-1">
              <Kpi
                label="Ingresos del mes"
                value={fmtMxn(f.ingresos.total)}
                hint="Flujo de caja · ver detalle →"
                icon={Wallet}
                tone="success"
                onClick={irAIngresos}
              />
            </div>
            <div className="lg:col-span-2">
              <DesglosePanel titulo="Ingresos por proyecto">
                <PorProyecto rows={f.ingresos.porProyecto} formato="moneda" />
              </DesglosePanel>
            </div>
          </div>
        )}
      </Panel>

      {/* ─── Resumen de Egresos ─── */}
      <Panel
        title="Resumen de Egresos"
        description="Composición de egresos por comisiones · mes en curso"
        className="mb-6"
      >
        {finanzasQ.isLoading ? (
          <SeccionLoader label="Cargando egresos…" />
        ) : finanzasQ.error || !f ? (
          <p className="text-sm text-red-600 py-4">No se pudieron cargar los egresos.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
            <div>
              <Kpi
                label="Egresos externos"
                value={fmtMxn(f.egresosExternos.total)}
                hint="Composición · ver detalle →"
                icon={ArrowUpFromLine}
                tone="destructive"
                onClick={irAEgresos}
              />
              <div className="mt-4">
                <DesglosePanel titulo="Externos por proyecto">
                  <PorProyecto rows={f.egresosExternos.porProyecto} formato="moneda" />
                </DesglosePanel>
              </div>
            </div>
            <div>
              <Kpi
                label="Egresos internos"
                value={fmtMxn(f.egresosInternos.total)}
                hint="Composición · ver detalle →"
                icon={ArrowUpFromLine}
                tone="warning"
                onClick={irAEgresos}
              />
              <div className="mt-4">
                <DesglosePanel titulo="Internos por proyecto">
                  <PorProyecto rows={f.egresosInternos.porProyecto} formato="moneda" />
                </DesglosePanel>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* ─── Resumen de Mediciones ─── */}
      <Panel
        title="Resumen de Mediciones"
        description="Uso de portales en el mes en curso"
        className="mb-2"
      >
        {medicionesQ.isLoading ? (
          <SeccionLoader label="Cargando mediciones…" />
        ) : !m ? (
          <p className="text-sm text-red-600 py-4">No se pudieron cargar las mediciones.</p>
        ) : !m.disponible ? (
          <p className="text-[13px] text-muted-foreground py-4">
            Las mediciones de uso aún no están disponibles (falta la función de
            base de datos `visitas_historicas_por_portal`).
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <SegmentoMediciones titulo="Clientes" icon={Users} seg={m.clientes} />
            <SegmentoMediciones titulo="Agentes" icon={Users} seg={m.agentes} />
          </div>
        )}
      </Panel>
    </div>
  );
}

/* Sub-bloque visual para un desglose por proyecto. */
function DesglosePanel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-1">
        {titulo}
      </p>
      {children}
    </div>
  );
}

/* Dos KPIs por segmento de medición (usuarios + duración promedio). */
function SegmentoMediciones({
  titulo,
  icon,
  seg,
}: {
  titulo: string;
  icon: LucideIcon;
  seg: { usuarios: number; sesiones: number; duracionPromedioMin: number };
}) {
  return (
    <>
      <Kpi
        label={`${titulo} conectados`}
        value={seg.usuarios}
        hint={`${seg.sesiones} ${seg.sesiones === 1 ? "sesión" : "sesiones"} este mes`}
        icon={icon}
        tone="info"
      />
      <Kpi
        label={`${titulo} · duración prom.`}
        value={minutosLabel(seg.duracionPromedioMin)}
        hint="por sesión"
        icon={Timer}
        tone="default"
      />
    </>
  );
}
