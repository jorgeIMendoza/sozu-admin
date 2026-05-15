import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  UserCheck,
  Shield,
  ShieldAlert,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Filter,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────
   Tipo de datos consumido por los widgets
   ────────────────────────────────────────────────────────── */

export type SaludFinancieraData = {
  dinero_por_cobrar: {
    empty: boolean;
    monto: number;
    facturas_count: number;
    antiguedad_promedio_dias: number;
    facturas_vencidas: { count: number; monto: number };
  };
  deuda_colaboradores: {
    empty: boolean;
    monto_total: number;
    listas_para_pagar: { count: number; monto: number };
    bloqueadas: { count: number; monto: number };
  };
  comisiones_internas_pendientes: {
    empty: boolean;
    empty_reason?: string;
    monto: number;
    comisionistas_count: number;
    antiguedad_promedio_dias: number;
    mas_antigua_dias: number;
    mas_antigua_persona: string;
    mas_antigua_venta: string;
  };
  financiamiento_involuntario: {
    empty: boolean;
    casos: number;
    monto: number;
  };
};

/* ──────────────────────────────────────────────────────────
   Estructura de Widget reusable
   ────────────────────────────────────────────────────────── */

function WidgetShell({
  label,
  icon: Icon,
  iconBgClass,
  borderClass,
  heroNode,
  description,
  subInfo,
  ctaLabel,
  ctaHref,
  ctaDisabled,
}: {
  label: string;
  icon: LucideIcon;
  iconBgClass: string;
  borderClass: string;
  heroNode: React.ReactNode;
  description: string;
  subInfo: React.ReactNode;
  ctaLabel: string;
  ctaHref?: string;
  ctaDisabled?: boolean;
}) {
  return (
    <Card className={cn("h-full", borderClass)}>
      <CardContent className="p-6 flex flex-col h-full min-h-[280px]">
        <div className="flex items-center gap-3 mb-4">
          <span className={cn("grid h-10 w-10 place-items-center rounded-full shrink-0", iconBgClass)}>
            <Icon className="h-5 w-5" />
          </span>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </p>
        </div>

        <div className="mb-3">{heroNode}</div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>

        <div className="space-y-1.5 text-sm leading-relaxed">{subInfo}</div>

        <div className="mt-auto pt-4">
          {ctaDisabled || !ctaHref ? (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground/70 cursor-default">
              {ctaLabel}
            </span>
          ) : (
            <Link
              to={ctaHref}
              className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 hover:underline font-medium transition-colors"
            >
              {ctaLabel}
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyContent({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-2 text-center">
      <Filter className="h-5 w-5 text-muted-foreground mb-2" aria-hidden />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Widget A — Dinero por cobrar
   ────────────────────────────────────────────────────────── */

function WidgetCobrar({ d }: { d: SaludFinancieraData["dinero_por_cobrar"] }) {
  if (d.empty) {
    return (
      <WidgetShell
        label="Dinero por cobrar"
        icon={ArrowDownLeft}
        iconBgClass="bg-muted text-muted-foreground"
        borderClass="border-border"
        heroNode={<p className="text-2xl font-bold text-muted-foreground">—</p>}
        description="Facturado a desarrolladores, pendiente de cobro"
        subInfo={<EmptyContent message="Sin datos para los filtros aplicados" />}
        ctaLabel="Ver Facturas por Cobrar"
        ctaHref="/admin/portal-alta-direccion/facturas-por-cobrar"
      />
    );
  }
  return (
    <WidgetShell
      label="Dinero por cobrar"
      icon={ArrowDownLeft}
      iconBgClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
      borderClass="border-emerald-200/60 dark:border-emerald-900/40"
      heroNode={
        <p className="text-3xl font-bold text-foreground tabular-nums">{fmtMxn(d.monto)}</p>
      }
      description="Facturado a desarrolladores, pendiente de cobro"
      subInfo={
        <>
          <p className="text-muted-foreground">
            {d.facturas_count} {d.facturas_count === 1 ? "factura" : "facturas"} en cartera · antigüedad promedio: {d.antiguedad_promedio_dias} días
          </p>
          {d.facturas_vencidas.count > 0 && (
            <p className="text-red-600 dark:text-red-400 font-semibold inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {d.facturas_vencidas.count} vencidas (&gt;30 días): {fmtMxn(d.facturas_vencidas.monto)}
            </p>
          )}
        </>
      }
      ctaLabel="Ver Facturas por Cobrar"
      ctaHref="/admin/portal-alta-direccion/facturas-por-cobrar"
    />
  );
}

/* ──────────────────────────────────────────────────────────
   Widget B — Deuda con colaboradores
   ────────────────────────────────────────────────────────── */

function WidgetDeuda({ d }: { d: SaludFinancieraData["deuda_colaboradores"] }) {
  if (d.empty) {
    return (
      <WidgetShell
        label="Deuda con colaboradores"
        icon={ArrowUpRight}
        iconBgClass="bg-muted text-muted-foreground"
        borderClass="border-border"
        heroNode={<p className="text-2xl font-bold text-muted-foreground">—</p>}
        description="Pagos pendientes a externos"
        subInfo={<EmptyContent message="Sin datos para los filtros aplicados" />}
        ctaLabel="Ver Facturas por Pagar"
        ctaHref="/admin/portal-alta-direccion/facturas-por-pagar"
      />
    );
  }
  return (
    <WidgetShell
      label="Deuda con colaboradores"
      icon={ArrowUpRight}
      iconBgClass="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
      borderClass="border-amber-200/60 dark:border-amber-900/40"
      heroNode={
        <p className="text-3xl font-bold text-foreground tabular-nums">{fmtMxn(d.monto_total)}</p>
      }
      description="Pagos pendientes a externos"
      subInfo={
        <>
          <div className="flex items-start gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" aria-hidden />
            <p className="text-foreground">
              <span className="font-medium">Listas para pagar:</span>{" "}
              <span className="font-semibold tabular-nums">{fmtMxn(d.listas_para_pagar.monto)}</span>
              {" — "}
              {d.listas_para_pagar.count} {d.listas_para_pagar.count === 1 ? "factura" : "facturas"}
              <span className="text-xs text-muted-foreground"> (ya cobramos al desarrollador)</span>
            </p>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-amber-800 dark:text-amber-300">
              <span className="font-medium">Bloqueadas:</span>{" "}
              <span className="font-semibold tabular-nums">{fmtMxn(d.bloqueadas.monto)}</span>
              {" — "}
              {d.bloqueadas.count} {d.bloqueadas.count === 1 ? "factura" : "facturas"}
              <span className="text-xs"> (sin cobro previo)</span>
            </p>
          </div>
        </>
      }
      ctaLabel="Ver Facturas por Pagar"
      ctaHref="/admin/portal-alta-direccion/facturas-por-pagar"
    />
  );
}

/* ──────────────────────────────────────────────────────────
   Widget C — Comisiones internas por autorizar
   ────────────────────────────────────────────────────────── */

function WidgetComisiones({
  d,
}: {
  d: SaludFinancieraData["comisiones_internas_pendientes"];
}) {
  if (d.empty) {
    return (
      <WidgetShell
        label="Comisiones internas"
        icon={UserCheck}
        iconBgClass="bg-muted text-muted-foreground"
        borderClass="border-border"
        heroNode={<p className="text-2xl font-bold text-muted-foreground">—</p>}
        description="Pendientes de tu autorización"
        subInfo={
          <EmptyContent
            message={d.empty_reason || "Sin datos para los filtros aplicados"}
          />
        }
        ctaLabel="Revisar en Bandeja"
        ctaHref="/admin/portal-alta-direccion/bandeja"
      />
    );
  }
  return (
    <WidgetShell
      label="Comisiones internas"
      icon={UserCheck}
      iconBgClass="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
      borderClass="border-blue-200/60 dark:border-blue-900/40"
      heroNode={
        <p className="text-3xl font-bold text-foreground tabular-nums">{fmtMxn(d.monto)}</p>
      }
      description="Pendientes de tu autorización"
      subInfo={
        <>
          <p className="text-muted-foreground">
            {d.comisionistas_count} {d.comisionistas_count === 1 ? "comisionista" : "comisionistas"} afectados · antigüedad promedio: {d.antiguedad_promedio_dias} días
          </p>
          <p className="text-foreground">
            Más antigua:{" "}
            <span className="font-semibold tabular-nums">{d.mas_antigua_dias} días</span>
            {" — "}
            {d.mas_antigua_persona}{" "}
            <span className="text-xs text-muted-foreground">({d.mas_antigua_venta})</span>
          </p>
        </>
      }
      ctaLabel="Revisar en Bandeja"
      ctaHref="/admin/portal-alta-direccion/bandeja"
    />
  );
}

/* ──────────────────────────────────────────────────────────
   Widget D — Financiamiento involuntario (KPI estratégico)
   ────────────────────────────────────────────────────────── */

function WidgetFinanciamiento({
  d,
}: {
  d: SaludFinancieraData["financiamiento_involuntario"];
}) {
  if (d.empty) {
    return (
      <WidgetShell
        label="Financiamiento involuntario"
        icon={Shield}
        iconBgClass="bg-muted text-muted-foreground"
        borderClass="border-border"
        heroNode={<p className="text-2xl font-bold text-muted-foreground">—</p>}
        description="Pagos a externos antes de cobrar al desarrollador"
        subInfo={<EmptyContent message="Sin datos para los filtros aplicados" />}
        ctaLabel="Sin casos activos"
        ctaDisabled
      />
    );
  }
  const sano = d.casos === 0;
  return (
    <WidgetShell
      label="Financiamiento involuntario"
      icon={sano ? Shield : ShieldAlert}
      iconBgClass={
        sano
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
      }
      borderClass={
        sano
          ? "border-emerald-200/60 dark:border-emerald-900/40"
          : "border-red-300 dark:border-red-900/60 ring-1 ring-red-300/40 dark:ring-red-900/40"
      }
      heroNode={
        sano ? (
          <p className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            0 casos
          </p>
        ) : (
          <p className="text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">
            {fmtMxn(d.monto)}{" "}
            <span className="text-base font-medium">
              / {d.casos} {d.casos === 1 ? "caso" : "casos"}
            </span>
          </p>
        )
      }
      description="Pagos a externos antes de cobrar al desarrollador"
      subInfo={
        sano ? (
          <>
            <p className="text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Política operativa se cumple
            </p>
            <p className="text-muted-foreground">Ningún caso detectado en el período</p>
          </>
        ) : (
          <>
            <p className="text-red-600 dark:text-red-400 font-medium">
              Capa C ejecutada antes de Capa B en {d.casos} ventas
            </p>
            <p className="text-foreground">
              Riesgo activo:{" "}
              <span className="font-semibold tabular-nums">{fmtMxn(d.monto)}</span>
            </p>
          </>
        )
      }
      ctaLabel={sano ? "Sin casos activos" : "Ver casos"}
      ctaHref={sano ? undefined : "/admin/portal-alta-direccion/bandeja"}
      ctaDisabled={sano}
    />
  );
}

/* ──────────────────────────────────────────────────────────
   Bloque principal
   ────────────────────────────────────────────────────────── */

export function SaludFinancieraWidgets({ data }: { data: SaludFinancieraData }) {
  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Salud Financiera del Ciclo de Venta
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Estado actual del flujo de dinero del negocio
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <WidgetCobrar d={data.dinero_por_cobrar} />
        <WidgetDeuda d={data.deuda_colaboradores} />
        <WidgetComisiones d={data.comisiones_internas_pendientes} />
        <WidgetFinanciamiento d={data.financiamiento_involuntario} />
      </div>
    </section>
  );
}
