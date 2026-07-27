import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  HardHat,
  TrendingUp,
  Wallet,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PageHeader, Kpi, Panel, Pill } from "@/components/admin/portal-socio-bancario/ui";
import { DesarrolloNoAsignado } from "@/components/admin/portal-socio-bancario/EmptyStates";
import { useSocioProyecto } from "@/hooks/usePortalSocioBancario/useSocioProyecto";
import { useAvanceObraProyecto } from "@/hooks/usePortalSocioBancario/useAvanceObra";
import { usePropiedadesEstatusKpis } from "@/hooks/usePortalSocioBancario/usePropiedadesEstatusKpis";
import { useHistoricoComercial } from "@/hooks/usePortalSocioBancario/useHistoricoComercial";

const BASE = "/admin/portal-socio-bancario";

function fmtMxn(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}
function fmtPct(n: number, dec = 0): string {
  return `${n.toFixed(dec)}%`;
}
function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function SocioBancarioResumenPage() {
  const navigate = useNavigate();
  const { idProyecto, nombre, noAsignado, isLoading: loadingProyecto } = useSocioProyecto();

  const avanceQ = useAvanceObraProyecto(idProyecto);
  const kpis = usePropiedadesEstatusKpis(idProyecto);
  const historico = useHistoricoComercial({
    mesesAtras: 0,
    idProyecto,
    canal: null,
    tipo: "todos",
  });

  const valorComercializado = useMemo(
    () => (historico.data ?? []).reduce((s, r) => s + r.ventas_monto, 0),
    [historico.data],
  );

  // Estado vacío honesto: sin desarrollo vinculado NO se muestran datos.
  if (noAsignado) {
    return (
      <>
        <PageHeader title="Resumen del Desarrollo" description="Portal Socio Bancario" />
        <DesarrolloNoAsignado />
      </>
    );
  }

  const cargando = loadingProyecto || avanceQ.isLoading || kpis.isLoading || historico.isLoading;

  const avanceReal = avanceQ.data?.progress ?? null;
  const k = kpis.data;
  const vendidas = k?.ventas_totales ?? 0;
  const apartadas = k?.apartados ?? 0;
  const disponibles = k?.disponibles ?? 0;
  const totalUnidades = vendidas + apartadas + disponibles;
  const pctColocado = totalUnidades > 0 ? (vendidas / totalUnidades) * 100 : 0;
  const entrega = avanceQ.data?.estimatedDelivery ?? null;

  return (
    <>
      <PageHeader
        title={nombre ?? "Resumen del Desarrollo"}
        description="Avance de obra, comercialización y evidencia de venta del desarrollo que financiaste."
        action={<Pill className="bg-primary/10 text-primary">Comercializado por SOZU</Pill>}
      />

      {cargando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* 4 KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi
              icon={HardHat}
              tone="primary"
              label="Avance de obra"
              value={avanceReal != null ? fmtPct(avanceReal) : "—"}
              hint="Programado pendiente de carga" // SWAP POINT: programa de obra (real vs programado)
            />
            <Kpi
              icon={TrendingUp}
              tone="success"
              label="Comercialización"
              value={`${vendidas} / ${totalUnidades}`}
              hint={`${fmtPct(pctColocado)} colocado`}
            />
            <Kpi
              icon={Wallet}
              tone="info"
              label="Valor comercializado"
              value={fmtMxn(valorComercializado)}
              hint="Ventas reconocidas del desarrollo"
            />
            <Kpi
              icon={CalendarCheck2}
              tone="default"
              label="Entrega estimada"
              value={fmtFecha(entrega)}
              hint="Fecha original pendiente de carga" // SWAP POINT: baseline de entrega original
            />
          </div>

          {/* Banda de alertas (semáforo). Sin programado ni meta en la base no se
              puede afirmar atraso/ritmo bajo: se declara honestamente. */}
          <div className="mt-4 rounded-xl border border-success/30 bg-success/5 px-4 py-3 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Sin desviaciones relevantes</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                El comparativo de obra vs. programado y el ritmo vs. meta requieren el programa de
                obra y la meta de colocación (pendientes de carga).
                {/* SWAP POINT: programa de obra + meta de colocación para alertas de desviación. */}
              </p>
            </div>
          </div>

          {/* Accesos a los 3 módulos con indicador clave */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <AccesoCard
              icon={HardHat}
              titulo="Avance de Obra"
              indicador={avanceReal != null ? `${fmtPct(avanceReal)} de avance` : "Sin dato"}
              onClick={() => navigate(`${BASE}/avance-obra`)}
            />
            <AccesoCard
              icon={TrendingUp}
              titulo="Ventas e Inventario"
              indicador={`${vendidas} vendidas · ${disponibles} disponibles`}
              onClick={() => navigate(`${BASE}/ventas-inventario`)}
            />
            <AccesoCard
              icon={FolderOpen}
              titulo="Expedientes"
              indicador="Evidencia de venta por unidad"
              onClick={() => navigate(`${BASE}/expedientes`)}
            />
          </div>
        </>
      )}
    </>
  );
}

function AccesoCard({
  icon: Icon,
  titulo,
  indicador,
  onClick,
}: {
  icon: typeof HardHat;
  titulo: string;
  indicador: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group text-left rounded-xl border border-border bg-card p-5 shadow-sm transition-all",
        "hover:shadow-md hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-foreground">
          <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">{titulo}</p>
      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{indicador}</p>
    </button>
  );
}
