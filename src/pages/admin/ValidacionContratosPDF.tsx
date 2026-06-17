import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Car, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  ChevronUp, Clock, Eye, FileSearch, FileText, Home,
  Info, Loader2, Package,
} from "lucide-react";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 25;

interface ContratoRow {
  cuenta_id: number;
  proyecto: string;
  edificio: string | null;
  modelo: string | null;
  numero_propiedad: string | null;
  dueno: string;
  precio_final: number;
  fecha_compra: string | null;
  contrato_url: string | null;
}

interface CuentaDetalle {
  id: number;
  propiedad_id: number;
  precio_final: number;
  fecha_compra: string | null;
  clabe_stp: string | null;
  valor_uma: number | null;
  numero_propiedad: string | null;
  m2_total: number | null;
  m2_interiores: number | null;
  edificio: string | null;
  modelo: string | null;
  proyecto: string;
  dueno: string | null;
  total_pagado: number;
  efectivo_pagado: number;
}

interface AcuerdoRow {
  id: number;
  monto: number;
  pago_completado: boolean;
  concepto: string;
  tipo: "obra" | "entrega";
}

interface ProductoRow {
  cuenta_id: number;
  precio_final: number;
  tipo: string;
  categoria: "depto" | "bodega" | "estacionamiento";
}

interface CompradoresRow {
  id_persona: number;
  nombre_legal: string;
  email: string | null;
  telefono: string | null;
  porcentaje_copropiedad: number;
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

function fmtCurrency(n: number | null) {
  if (n === null || isNaN(n) || !isFinite(n)) return "-";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Modal: visor PDF del contrato ──────────────────────────────────────────────

function ContratoViewerModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);

  const handleOpenChange = (o: boolean) => { if (!o) { setLoaded(false); onClose(); } };

  return (
    <Dialog open={url !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-[14px]">
              <FileText className="size-4 text-muted-foreground" />
              Contrato firmado
            </DialogTitle>
            {url && (
              <a href={url} target="_blank" rel="noreferrer"
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors mr-7">
                Abrir en pestaña ↗
              </a>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/20 relative">
          {!loaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-muted/20">
              <Loader2 className="size-7 animate-spin text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">Cargando contrato PDF...</p>
            </div>
          )}
          {url && (
            <iframe
              key={url}
              src={url}
              className="w-full h-full border-0"
              title="Contrato PDF"
              onLoad={() => setLoaded(true)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── StatCell ── (número grande + etiqueta)
function StatCell({
  label, value, valueClass, note,
}: { label: string; value: string; valueClass?: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 text-center px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p className={cn("text-[18px] font-bold tabular-nums leading-tight", valueClass)}>{value}</p>
      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );
}

// ── Modal: detalle cuenta de cobranza ──────────────────────────────────────────

function CuentaDetalleModal({
  cuentaId,
  onClose,
}: {
  cuentaId: number | null;
  onClose: () => void;
}) {
  const [acuerdosOpen, setAcuerdosOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cuenta-detalle-modal", cuentaId],
    enabled: cuentaId !== null,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<{
      detalle: CuentaDetalle | null;
      acuerdos: AcuerdoRow[];
      productos: ProductoRow[];
      compradores: CompradoresRow[];
    }> => {
      if (!cuentaId) return { detalle: null, acuerdos: [], productos: [], compradores: [] };

      const [detRes, acRes, compRes] = await Promise.all([
        (supabase as any).rpc("execute_safe_query", {
          query_text: `
            SELECT
              cc.id,
              o.id_propiedad    AS propiedad_id,
              cc.precio_final,
              cc.fecha_compra,
              cc.clabe_stp,
              cc.valor_uma,
              p.numero_propiedad,
              COALESCE(p.m2_interiores, 0) + COALESCE(p.m2_exteriores, 0) AS m2_total,
              p.m2_interiores,
              ed.nombre   AS edificio,
              m.nombre    AS modelo,
              proy.nombre AS proyecto,
              pers.nombre_legal AS dueno,
              (SELECT COALESCE(SUM(ap.monto), 0)
               FROM acuerdos_pago ag
               JOIN aplicaciones_pago ap ON ap.id_acuerdo_pago = ag.id AND ap.activo = true
               WHERE ag.id_cuenta_cobranza = cc.id AND ag.activo = true AND ap.es_multa = false
              ) AS total_pagado,
              (SELECT COALESCE(SUM(pg.monto), 0)
               FROM pagos pg
               WHERE pg.id_cuenta_cobranza = cc.id AND pg.activo = true AND pg.id_metodos_pago = 1
              ) AS efectivo_pagado
            FROM cuentas_cobranza cc
            JOIN ofertas o            ON o.id  = cc.id_oferta
            JOIN propiedades p        ON p.id  = o.id_propiedad
            JOIN edificios_modelos em ON em.id = p.id_edificio_modelo
            JOIN edificios ed         ON ed.id = em.id_edificio
            JOIN proyectos proy       ON proy.id = ed.id_proyecto
            LEFT JOIN modelos m       ON m.id  = em.id_modelo
            LEFT JOIN entidades_relacionadas er ON er.id = p.id_entidad_relacionada_dueno AND er.activo = true
            LEFT JOIN personas pers   ON pers.id = er.id_persona
            WHERE cc.id = ${cuentaId}
            LIMIT 1
          `,
        }),
        (supabase as any).rpc("execute_safe_query", {
          query_text: `
            SELECT
              ag.id,
              ag.monto,
              ag.pago_completado,
              cp.nombre AS concepto,
              CASE WHEN LOWER(cp.nombre) LIKE '%contra entrega%' THEN 'entrega' ELSE 'obra' END AS tipo
            FROM acuerdos_pago ag
            JOIN conceptos_pago cp ON cp.id = ag.id_concepto
            WHERE ag.id_cuenta_cobranza = ${cuentaId} AND ag.activo = true
            ORDER BY ag.id
          `,
        }),
        (supabase as any).rpc("execute_safe_query", {
          query_text: `
            SELECT
              c.id_persona,
              c.porcentaje_copropiedad,
              p.nombre_legal,
              p.email,
              p.telefono
            FROM compradores c
            JOIN personas p ON p.id = c.id_persona
            WHERE c.id_cuenta_cobranza = ${cuentaId} AND c.activo = true
            ORDER BY c.porcentaje_copropiedad DESC
          `,
        }),
      ]);

      const raw = detRes.data?.[0];
      const detalleObj: CuentaDetalle | null = raw ? {
        id:               safeNum(raw.id),
        propiedad_id:     safeNum(raw.propiedad_id),
        precio_final:     safeNum(raw.precio_final),
        fecha_compra:     raw.fecha_compra  ?? null,
        clabe_stp:        raw.clabe_stp     ?? null,
        valor_uma:        raw.valor_uma  != null ? safeNum(raw.valor_uma)  : null,
        numero_propiedad: raw.numero_propiedad ?? null,
        m2_total:         raw.m2_total    != null ? safeNum(raw.m2_total)    : null,
        m2_interiores:    raw.m2_interiores != null ? safeNum(raw.m2_interiores) : null,
        edificio:         raw.edificio      ?? null,
        modelo:           raw.modelo        ?? null,
        proyecto:         raw.proyecto      ?? "-",
        dueno:            raw.dueno         ?? null,
        total_pagado:    safeNum(raw.total_pagado),
        efectivo_pagado: safeNum(raw.efectivo_pagado),
      } : null;

      // Productos de escrituración: depto + bodegas + estacionamientos de esta propiedad
      let productosData: ProductoRow[] = [];
      if (detalleObj?.propiedad_id) {
        const propId = detalleObj.propiedad_id;
        const prodRes = await (supabase as any).rpc("execute_safe_query", {
          query_text: `
            SELECT
              cc.id   AS cuenta_id,
              cc.precio_final,
              CASE
                WHEN o.id_producto IS NULL  THEN 'Departamento'
                WHEN b.id IS NOT NULL       THEN COALESCE(b.nombre, 'Bodega')
                WHEN e.id IS NOT NULL       THEN COALESCE(e.nombre, 'Cajón de estacionamiento')
              END AS tipo,
              CASE
                WHEN o.id_producto IS NULL  THEN 'depto'
                WHEN b.id IS NOT NULL       THEN 'bodega'
                WHEN e.id IS NOT NULL       THEN 'estacionamiento'
              END AS categoria
            FROM cuentas_cobranza cc
            JOIN ofertas o ON o.id = cc.id_oferta
                          AND o.id_propiedad = ${propId}
                          AND o.activo = true
            LEFT JOIN bodegas b
              ON b.id_producto = o.id_producto AND b.id_propiedad = ${propId}
            LEFT JOIN estacionamientos e
              ON e.id_producto = o.id_producto AND e.id_propiedad = ${propId}
            WHERE cc.activo = true
              AND (
                o.id_producto IS NULL
                OR b.id IS NOT NULL
                OR e.id IS NOT NULL
              )
            ORDER BY (o.id_producto IS NULL) DESC, cc.precio_final DESC
          `,
        });
        productosData = (prodRes.data ?? []).map((r: any) => ({
          cuenta_id:    Number(r.cuenta_id),
          precio_final: Number(r.precio_final),
          tipo:         r.tipo as string,
          categoria:    r.categoria as "depto" | "bodega" | "estacionamiento",
        }));
      }

      return {
        detalle: detalleObj,
        acuerdos: (acRes.data ?? []).map((a: any) => ({
          id:              Number(a.id),
          monto:           Number(a.monto),
          pago_completado: Boolean(a.pago_completado),
          concepto:        a.concepto ?? "-",
          tipo:            a.tipo as "obra" | "entrega",
        })),
        productos: productosData,
        compradores: (compRes.data ?? []).map((c: any) => ({
          id_persona:             Number(c.id_persona),
          nombre_legal:           c.nombre_legal ?? "Sin nombre",
          email:                  c.email    ?? null,
          telefono:               c.telefono ?? null,
          porcentaje_copropiedad: safeNum(c.porcentaje_copropiedad),
        })),
      };
    },
  });

  const detalle    = data?.detalle    ?? null;
  const acuerdos   = data?.acuerdos   ?? [];
  const productos  = data?.productos  ?? [];
  const compradores = data?.compradores ?? [];

  const saldoPendiente   = detalle ? Math.max(0, detalle.precio_final - detalle.total_pagado) : 0;
  const progresoPercent  = detalle ? Math.min(100, (detalle.total_pagado / detalle.precio_final) * 100) : 0;
  const limiteEfectivo   = detalle?.valor_uma ? detalle.valor_uma * 8025 : null;
  const pendienteObra    = acuerdos.filter(a => a.tipo === "obra"    && !a.pago_completado).reduce((s, a) => s + a.monto, 0);
  const pendienteEntrega = acuerdos.filter(a => a.tipo === "entrega" && !a.pago_completado).reduce((s, a) => s + a.monto, 0);
  const totalEscrituracion = productos.reduce((s, p) => s + p.precio_final, 0);
  const acuerdosPagados  = acuerdos.filter(a => a.pago_completado).length;

  const categoriaIcon = (cat: ProductoRow["categoria"]) => {
    if (cat === "depto")          return <Home className="size-3 text-primary shrink-0" />;
    if (cat === "bodega")         return <Package className="size-3 text-muted-foreground shrink-0" />;
    if (cat === "estacionamiento") return <Car className="size-3 text-muted-foreground shrink-0" />;
  };

  return (
    <Dialog open={cuentaId !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-xl max-h-[92vh] overflow-y-auto p-0 gap-0">

        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-5 pb-0 shrink-0">
          <DialogTitle className="text-[15px] font-semibold">
            {isLoading || !detalle ? (
              <span className="text-muted-foreground">Cargando...</span>
            ) : (
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[13px] text-muted-foreground font-normal">
                    {formatCuentaCobranzaId(detalle.id)}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{detalle.proyecto}</span>
                </div>
                {/* Subtitle: unidad + edificio + modelo */}
                <p className="text-[12px] font-normal text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                  {detalle.numero_propiedad && <span>Unidad {detalle.numero_propiedad}</span>}
                  {detalle.edificio  && <><span className="text-muted-foreground/30">·</span><span>{detalle.edificio}</span></>}
                  {detalle.modelo    && <><span className="text-muted-foreground/30">·</span><span>{detalle.modelo}</span></>}
                  {detalle.m2_total  && <><span className="text-muted-foreground/30">·</span><span>{detalle.m2_total} m²</span></>}
                </p>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-52">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !detalle ? (
          <p className="text-[13px] text-destructive px-5 py-6">No se pudo cargar la información de esta cuenta.</p>
        ) : (
          <div className="px-5 pb-6 pt-4 space-y-5">

            {/* ── Financiero — stat cards ── */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 mb-2">
                Financiero · Departamento
              </p>

              {/* 3 stat cells */}
              <div className="grid grid-cols-3 rounded-xl border border-border bg-muted/20 divide-x divide-border overflow-hidden">
                <StatCell label="Precio Final"    value={fmtCurrency(detalle.precio_final)} />
                <StatCell label="Total Pagado"    value={fmtCurrency(detalle.total_pagado)}  valueClass="text-emerald-600" />
                <StatCell label="Saldo"           value={fmtCurrency(saldoPendiente)}
                  valueClass={saldoPendiente > 0 ? "text-red-600" : "text-emerald-600"} />
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>Avance de pago</span>
                  <span className="font-semibold tabular-nums text-foreground">{progresoPercent.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", progresoPercent >= 100 ? "bg-emerald-500" : "bg-primary")}
                    style={{ width: `${progresoPercent}%` }}
                  />
                </div>
              </div>

              {/* Pendientes sub-row */}
              {(pendienteObra > 0 || pendienteEntrega > 0) && (
                <div className="mt-2.5 grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                    <p className="text-[10px] text-amber-600/70 mb-0.5">Pendiente durante obra</p>
                    <p className="font-semibold tabular-nums text-amber-700">{fmtCurrency(pendienteObra)}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                    <p className="text-[10px] text-amber-600/70 mb-0.5">Pendiente a la entrega</p>
                    <p className="font-semibold tabular-nums text-amber-700">{fmtCurrency(pendienteEntrega)}</p>
                  </div>
                </div>
              )}

              {/* Límite efectivo UMA */}
              {limiteEfectivo != null && (
                <div className={cn(
                  "mt-2.5 rounded-lg border px-3 py-2.5",
                  detalle.efectivo_pagado > limiteEfectivo
                    ? "border-red-200 bg-red-50"
                    : "border-border bg-muted/20"
                )}>
                  <div className="flex items-center justify-between gap-4 mb-1.5">
                    <p className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      detalle.efectivo_pagado > limiteEfectivo ? "text-red-600" : "text-muted-foreground/60"
                    )}>
                      Pagos en efectivo
                      {detalle.efectivo_pagado > limiteEfectivo && (
                        <span className="ml-1.5 normal-case font-bold">⚠ Límite excedido</span>
                      )}
                    </p>
                    <span className={cn(
                      "text-[10px] font-medium",
                      detalle.efectivo_pagado > limiteEfectivo ? "text-red-600" : "text-emerald-600"
                    )}>
                      {detalle.efectivo_pagado > limiteEfectivo ? "EXCEDIDO" : "OK"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 text-[12px]">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Pagado en efectivo</p>
                      <p className={cn("font-semibold tabular-nums", detalle.efectivo_pagado > limiteEfectivo ? "text-red-700" : "text-foreground")}>
                        {fmtCurrency(detalle.efectivo_pagado)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Límite (UMA × 8,025)</p>
                      <p className="font-semibold tabular-nums text-foreground">{fmtCurrency(limiteEfectivo)}</p>
                    </div>
                  </div>
                  {detalle.efectivo_pagado > 0 && limiteEfectivo > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", detalle.efectivo_pagado > limiteEfectivo ? "bg-red-500" : "bg-emerald-500")}
                          style={{ width: `${Math.min(100, (detalle.efectivo_pagado / limiteEfectivo) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 text-right tabular-nums">
                        {Math.min(999.9, (detalle.efectivo_pagado / limiteEfectivo) * 100).toFixed(1)}% del límite
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Escrituración ── */}
            {productos.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 mb-2">
                    Escrituración
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    {productos.map((prod, i) => (
                      <div
                        key={prod.cuenta_id}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 text-[13px]",
                          i > 0 && "border-t border-border/60",
                          prod.cuenta_id === cuentaId && "bg-primary/5",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {categoriaIcon(prod.categoria)}
                          <span className={cn(prod.categoria === "depto" && "font-medium")}>{prod.tipo}</span>
                          {prod.cuenta_id === cuentaId && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/30 text-primary h-4 leading-none">
                              esta
                            </Badge>
                          )}
                        </div>
                        <span className="tabular-nums font-medium">{fmtCurrency(prod.precio_final)}</span>
                      </div>
                    ))}
                    {productos.length > 1 && (
                      <div className="flex items-center justify-between px-3 py-2.5 border-t border-border bg-muted/40">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Total escrituración
                        </span>
                        <span className="text-[15px] font-bold tabular-nums">{fmtCurrency(totalEscrituracion)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
                    <Info className="size-3 shrink-0" />
                    Validación PDF aplica solo al precio del departamento vs contrato firmado.
                  </p>
                </div>
              </>
            )}

            {/* ── Compradores ── */}
            {compradores.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 mb-2">
                    {compradores.length === 1 ? "Comprador" : `Compradores (${compradores.length})`}
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
                    {compradores.map((c) => (
                      <div key={c.id_persona} className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[13px] font-medium leading-snug">{c.nombre_legal}</p>
                          {compradores.length > 1 && (
                            <span className="text-[11px] tabular-nums text-muted-foreground shrink-0 pt-0.5">
                              {c.porcentaje_copropiedad.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                          {c.email && (
                            <p className="text-[11px] text-muted-foreground">{c.email}</p>
                          )}
                          {c.telefono && (
                            <p className="text-[11px] text-muted-foreground">{c.telefono}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* ── Datos generales ── */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 mb-3">
                Datos generales
              </p>
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[11px] text-muted-foreground shrink-0 pt-0.5">Cliente / Dueño</p>
                  <p className="text-[13px] font-medium text-right">{detalle.dueno ?? "Sin propietario"}</p>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[11px] text-muted-foreground shrink-0">Fecha de compra</p>
                  <p className="text-[13px] tabular-nums">{fmtDate(detalle.fecha_compra)}</p>
                </div>
                {detalle.clabe_stp && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[11px] text-muted-foreground shrink-0">CLABE STP</p>
                    <p className="text-[11px] font-mono">{detalle.clabe_stp}</p>
                  </div>
                )}
                {detalle.m2_interiores && detalle.m2_interiores > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[11px] text-muted-foreground shrink-0">Precio / m²</p>
                    <p className="text-[13px] tabular-nums">{fmtCurrency(detalle.precio_final / detalle.m2_interiores)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Acuerdos de pago (colapsable) ── */}
            {acuerdos.length > 0 && (
              <>
                <Separator />
                <div>
                  {/* Toggle header */}
                  <button
                    onClick={() => setAcuerdosOpen((o) => !o)}
                    className="w-full flex items-center justify-between py-1 group"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                      Acuerdos de pago
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {acuerdosPagados}/{acuerdos.length} pagados
                      </span>
                      {acuerdosOpen
                        ? <ChevronUp  className="size-3.5 text-muted-foreground" />
                        : <ChevronDown className="size-3.5 text-muted-foreground" />
                      }
                    </div>
                  </button>

                  {acuerdosOpen && (
                    <div className="mt-2 rounded-xl border border-border overflow-hidden overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableHead className="text-[10px]">Concepto</TableHead>
                            <TableHead className="text-[10px] text-right">Monto</TableHead>
                            <TableHead className="text-[10px] text-center">Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {acuerdos.map((a) => (
                            <TableRow key={a.id} className="text-[12px]">
                              <TableCell className="py-1.5">{a.concepto}</TableCell>
                              <TableCell className="py-1.5 text-right tabular-nums">{fmtCurrency(a.monto)}</TableCell>
                              <TableCell className="py-1.5 text-center">
                                {a.pago_completado ? (
                                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] gap-1">
                                    <CheckCircle2 className="size-3" />Pagado
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px] gap-1">
                                    <Clock className="size-3" />Pendiente
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function ValidacionContratosPDF() {
  const [searchUnidad,   setSearchUnidad]   = useState("");
  const [searchCliente,  setSearchCliente]  = useState("");
  const [filtroProyecto, setFiltroProyecto] = useState("todos");
  const [currentPage,    setCurrentPage]    = useState(1);
  const [modalCuentaId,  setModalCuentaId]  = useState<number | null>(null);
  const [contratoUrl,    setContratoUrl]    = useState<string | null>(null);

  const resetPage = () => setCurrentPage(1);

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["validacion-contratos-pdf"],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<ContratoRow[]> => {
      const { data, error } = await (supabase as any).rpc("execute_safe_query", {
        query_text: `
          SELECT DISTINCT
            cc.id                 AS cuenta_id,
            cc.precio_final,
            cc.fecha_compra,
            p.numero_propiedad,
            ed.nombre             AS edificio,
            m.nombre              AS modelo,
            proy.nombre           AS proyecto,
            pers.nombre_legal     AS dueno,
            doc_ctto.url          AS contrato_url
          FROM cuentas_cobranza cc
          JOIN ofertas o                ON o.id  = cc.id_oferta          AND o.activo = true
                                        AND o.id_producto IS NULL
          JOIN propiedades p            ON p.id  = o.id_propiedad         AND p.activo = true
          JOIN edificios_modelos em     ON em.id = p.id_edificio_modelo
          JOIN edificios ed             ON ed.id = em.id_edificio          AND ed.activo = true
          JOIN proyectos proy           ON proy.id = ed.id_proyecto
                                        AND proy.activo   = true
                                        AND proy.publicar = true
          JOIN entidades_relacionadas er_sozu
                                        ON er_sozu.id_proyecto     = proy.id
                                       AND er_sozu.id_tipo_entidad  = 5
                                       AND er_sozu.activo           = true
          LEFT JOIN modelos m           ON m.id  = em.id_modelo
          LEFT JOIN entidades_relacionadas er_dueno
                                        ON er_dueno.id = p.id_entidad_relacionada_dueno
                                       AND er_dueno.activo = true
          LEFT JOIN personas pers       ON pers.id = er_dueno.id_persona
          LEFT JOIN LATERAL (
            SELECT d.url
            FROM documentos d
            WHERE d.id_cuenta_cobranza = cc.id
              AND d.id_tipo_documento  = 18
              AND d.activo = true
            ORDER BY d.id DESC
            LIMIT 1
          ) doc_ctto ON true
          WHERE cc.activo = true
          ORDER BY proy.nombre, p.numero_propiedad
          LIMIT 1000
        `,
      });
      if (error) throw error;
      return (data as any[]).map((row): ContratoRow => ({
        cuenta_id:        Number(row.cuenta_id),
        proyecto:         row.proyecto         ?? "-",
        edificio:         row.edificio         ?? null,
        modelo:           row.modelo           ?? null,
        numero_propiedad: row.numero_propiedad ?? null,
        dueno:            row.dueno            ?? "Sin propietario",
        precio_final:     Number(row.precio_final),
        fecha_compra:     row.fecha_compra     ?? null,
        contrato_url:     row.contrato_url     ?? null,
      }));
    },
  });

  const proyectos = useMemo(() => Array.from(new Set(rows.map((r) => r.proyecto))).sort(), [rows]);

  const filtered = useMemo(() => rows.filter((c) => {
    if (filtroProyecto !== "todos" && c.proyecto !== filtroProyecto) return false;
    if (searchUnidad  && !c.numero_propiedad?.toLowerCase().includes(searchUnidad.toLowerCase()))  return false;
    if (searchCliente && !c.dueno?.toLowerCase().includes(searchCliente.toLowerCase()))            return false;
    return true;
  }), [rows, filtroProyecto, searchUnidad, searchCliente]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const stats = useMemo(() => ({
    total: rows.length,
  }), [rows]);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-[18px] font-semibold text-foreground tracking-tight flex items-center gap-2">
          <FileSearch className="size-5 text-muted-foreground" />
          Validación Contratos PDF
        </h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Contratos de propiedades SOZU — verificación precio PDF vs precio DB (departamento)
        </p>
      </div>

      {/* Stats */}
      <div className="flex">
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-6">
              <p className="text-[12px] text-muted-foreground font-medium">Total departamentos</p>
              <FileSearch className="size-4 text-foreground" />
            </div>
            <p className="text-2xl font-bold mt-1 tabular-nums">
              {isLoading ? "-" : stats.total}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Unidad (No. propiedad)"
          value={searchUnidad}
          onChange={(e) => { setSearchUnidad(e.target.value); resetPage(); }}
          className="h-9 text-[13px] w-[160px] sm:w-[180px]"
        />
        <Input
          placeholder="Cliente / Dueño"
          value={searchCliente}
          onChange={(e) => { setSearchCliente(e.target.value); resetPage(); }}
          className="h-9 text-[13px] w-[160px] sm:w-[200px]"
        />
        <Select value={filtroProyecto} onValueChange={(v) => { setFiltroProyecto(v); resetPage(); }}>
          <SelectTrigger className="h-9 w-[160px] sm:w-[180px] text-[13px]">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los proyectos</SelectItem>
            {proyectos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[12px] text-muted-foreground tabular-nums ml-auto hidden sm:block">
          {isLoading ? "Cargando..." : `${filtered.length} de ${stats.total} · Pág. ${currentPage}/${totalPages}`}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[110px]">Cuenta</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Proyecto</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Unidad</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Cliente / Dueño</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right hidden xl:table-cell">
                  Precio Final
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center w-[80px]">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      <span className="text-[13px]">Cargando contratos...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-[13px] text-destructive">
                    Error al cargar datos.
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-[13px] text-muted-foreground">
                    Sin resultados para los filtros actuales
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((c) => (
                    <TableRow key={c.cuenta_id} className="hover:bg-muted/30 text-[13px]">
                      <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatCuentaCobranzaId(c.cuenta_id)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{c.proyecto}</div>
                        {(c.edificio || c.modelo) && (
                          <div className="text-[11px] text-muted-foreground">
                            {[c.edificio, c.modelo].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground whitespace-nowrap">
                        {c.numero_propiedad ?? "-"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[180px] truncate text-foreground">
                        {c.dueno}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-right tabular-nums font-medium whitespace-nowrap">
                        {fmtCurrency(c.precio_final)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {c.contrato_url ? (
                            <button
                              onClick={() => setContratoUrl(c.contrato_url!)}
                              title="Ver contrato firmado"
                              className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <FileText className="size-4" />
                            </button>
                          ) : (
                            <span
                              title="Sin contrato registrado"
                              className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground/25 cursor-default"
                            >
                              <FileText className="size-4" />
                            </span>
                          )}
                          <button
                            onClick={() => setModalCuentaId(c.cuenta_id)}
                            title="Ver detalles de la cuenta"
                            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <Eye className="size-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && filtered.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-[12px] text-muted-foreground tabular-nums shrink-0">
            {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 p-0">
              <ChevronLeft className="size-4" />
            </Button>
            {pageNumbers.map((p, idx) =>
              p === "…" ? (
                <span key={`e${idx}`} className="px-1 text-[13px] text-muted-foreground">…</span>
              ) : (
                <Button key={p} variant={p === currentPage ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(p as number)} className="h-8 w-8 p-0 text-[13px]">
                  {p}
                </Button>
              )
            )}
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 p-0">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modales */}
      <CuentaDetalleModal
        cuentaId={modalCuentaId}
        onClose={() => setModalCuentaId(null)}
      />
      <ContratoViewerModal
        url={contratoUrl}
        onClose={() => setContratoUrl(null)}
      />
    </div>
  );
}
