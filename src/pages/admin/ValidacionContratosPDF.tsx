import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertCircle, Car, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  ChevronUp, Clock, Eye, FileSearch, FileText, Home,
  Info, Loader2, Package, XCircle,
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
  estado_validacion: "coincide" | "no_coincide" | "error" | null;
  monto_real: number | null;
  motivo: string | null;
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
                Abrir en pestana -&gt;
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

      // Step 1: cuenta de cobranza
      const { data: cc } = await supabase
        .from("cuentas_cobranza")
        .select("id, precio_final, fecha_compra, clabe_stp, valor_uma, id_oferta")
        .eq("id", cuentaId)
        .eq("activo", true)
        .single();

      if (!cc) return { detalle: null, acuerdos: [], productos: [], compradores: [] };

      // Step 2: oferta -> propiedad id
      const { data: oferta } = await supabase
        .from("ofertas")
        .select("id, id_propiedad")
        .eq("id", cc.id_oferta)
        .single();

      if (!oferta) return { detalle: null, acuerdos: [], productos: [], compradores: [] };
      const propId = oferta.id_propiedad;

      // Step 3: parallel — propiedad + acuerdos + compradores + pagos efectivo + ofertas de la propiedad
      const [propRes, acuerdosRaw, compRaw, pagosRes, ofertasPropRes] = await Promise.all([
        supabase.from("propiedades")
          .select("id, numero_propiedad, m2_interiores, m2_exteriores, id_edificio_modelo, id_entidad_relacionada_dueno")
          .eq("id", propId).single(),
        supabase.from("acuerdos_pago")
          .select("id, monto, pago_completado, id_concepto")
          .eq("id_cuenta_cobranza", cuentaId).eq("activo", true).order("id"),
        supabase.from("compradores")
          .select("id_persona, porcentaje_copropiedad")
          .eq("id_cuenta_cobranza", cuentaId).eq("activo", true)
          .order("porcentaje_copropiedad", { ascending: false }),
        supabase.from("pagos")
          .select("monto")
          .eq("id_cuenta_cobranza", cuentaId).eq("activo", true).eq("id_metodos_pago", 1),
        (supabase as any).from("ofertas")
          .select("id, id_producto")
          .eq("id_propiedad", propId).eq("activo", true),
      ]);

      const prop = propRes.data;
      const acuerdosData = acuerdosRaw.data ?? [];
      const compData = compRaw.data ?? [];
      const efectivo_pagado = (pagosRes.data ?? []).reduce((s: number, pg: any) => s + safeNum(pg.monto), 0);
      const ofertasProp: any[] = ofertasPropRes.data ?? [];

      // Step 4: parallel — em + aplicaciones_pago + conceptos + personas (compradores) + cuentas prop + bodegas + estacs + er dueño
      const acuerdoIds = acuerdosData.map((a: any) => a.id);
      const conceptoIds = [...new Set(acuerdosData.map((a: any) => a.id_concepto).filter(Boolean))] as number[];
      const compPersonaIds = [...new Set(compData.map((c: any) => c.id_persona).filter(Boolean))] as number[];
      const ofertaPropIds = ofertasProp.map((o: any) => o.id);
      const productoIds = ofertasProp.filter((o: any) => o.id_producto != null).map((o: any) => o.id_producto);

      const [emRes, apRes, conceptosRes, personasRes, cuentasPropRes, bodRes, estacRes, erDuenoRes] = await Promise.all([
        prop?.id_edificio_modelo
          ? supabase.from("edificios_modelos").select("id, id_edificio, id_modelo").eq("id", prop.id_edificio_modelo).single()
          : Promise.resolve({ data: null }),
        acuerdoIds.length
          ? supabase.from("aplicaciones_pago").select("monto").in("id_acuerdo_pago", acuerdoIds).eq("activo", true).eq("es_multa", false)
          : Promise.resolve({ data: [] }),
        conceptoIds.length
          ? supabase.from("conceptos_pago").select("id, nombre").in("id", conceptoIds)
          : Promise.resolve({ data: [] }),
        compPersonaIds.length
          ? supabase.from("personas").select("id, nombre_legal, email, telefono").in("id", compPersonaIds)
          : Promise.resolve({ data: [] }),
        ofertaPropIds.length
          ? supabase.from("cuentas_cobranza").select("id, precio_final, id_oferta").in("id_oferta", ofertaPropIds).eq("activo", true)
          : Promise.resolve({ data: [] }),
        productoIds.length
          ? (supabase as any).from("bodegas").select("id_producto, nombre").in("id_producto", productoIds).eq("id_propiedad", propId)
          : Promise.resolve({ data: [] }),
        productoIds.length
          ? (supabase as any).from("estacionamientos").select("id_producto, nombre").in("id_producto", productoIds).eq("id_propiedad", propId)
          : Promise.resolve({ data: [] }),
        prop?.id_entidad_relacionada_dueno
          ? supabase.from("entidades_relacionadas").select("id, id_persona").eq("id", prop.id_entidad_relacionada_dueno).eq("activo", true).single()
          : Promise.resolve({ data: null }),
      ]);

      const em = emRes.data;
      const total_pagado = (apRes.data ?? []).reduce((s: number, ap: any) => s + safeNum(ap.monto), 0);
      const conceptoMap = new Map<number, string>((conceptosRes.data ?? []).map((c: any) => [c.id, c.nombre]));
      const personaMap = new Map<number, { nombre_legal: string; email: string | null; telefono: string | null }>(
        (personasRes.data ?? []).map((p: any) => [p.id, { nombre_legal: p.nombre_legal, email: p.email ?? null, telefono: p.telefono ?? null }])
      );
      const bodegaMap = new Map<number, string>((bodRes.data ?? []).map((b: any) => [b.id_producto, b.nombre ?? "Bodega"]));
      const estacMap = new Map<number, string>((estacRes.data ?? []).map((e: any) => [e.id_producto, e.nombre ?? "Cajon de estacionamiento"]));
      const erDueno = erDuenoRes.data;

      // Step 5: parallel — edificio + modelo + dueño persona
      const [edifRes, modeloRes, duenoPersonaRes] = await Promise.all([
        em?.id_edificio
          ? supabase.from("edificios").select("id, nombre, id_proyecto").eq("id", em.id_edificio).single()
          : Promise.resolve({ data: null }),
        em?.id_modelo
          ? supabase.from("modelos").select("id, nombre").eq("id", em.id_modelo).single()
          : Promise.resolve({ data: null }),
        erDueno?.id_persona
          ? supabase.from("personas").select("nombre_legal").eq("id", erDueno.id_persona).single()
          : Promise.resolve({ data: null }),
      ]);

      const edif = edifRes.data;
      const duenoNombre = duenoPersonaRes.data?.nombre_legal ?? null;

      // Step 6: proyecto
      const { data: proyectoData } = edif?.id_proyecto
        ? await supabase.from("proyectos").select("id, nombre").eq("id", edif.id_proyecto).single()
        : { data: null };

      // Build detalle
      const m2_interiores = prop?.m2_interiores ?? null;
      const m2_exteriores = prop?.m2_exteriores ?? null;
      const m2_total = m2_interiores != null || m2_exteriores != null
        ? (m2_interiores ?? 0) + (m2_exteriores ?? 0)
        : null;

      const detalleObj: CuentaDetalle = {
        id: cc.id,
        propiedad_id: propId,
        precio_final: safeNum(cc.precio_final),
        fecha_compra: cc.fecha_compra ?? null,
        clabe_stp: cc.clabe_stp ?? null,
        valor_uma: cc.valor_uma != null ? safeNum(cc.valor_uma) : null,
        numero_propiedad: prop?.numero_propiedad ?? null,
        m2_total,
        m2_interiores,
        edificio: edif?.nombre ?? null,
        modelo: modeloRes.data?.nombre ?? null,
        proyecto: proyectoData?.nombre ?? "-",
        dueno: duenoNombre,
        total_pagado,
        efectivo_pagado,
      };

      // Build acuerdos
      const acuerdos: AcuerdoRow[] = acuerdosData.map((a: any) => {
        const concepto = conceptoMap.get(a.id_concepto) ?? "-";
        return {
          id: Number(a.id),
          monto: safeNum(a.monto),
          pago_completado: Boolean(a.pago_completado),
          concepto,
          tipo: concepto.toLowerCase().includes("contra entrega") ? "entrega" : "obra",
        };
      });

      // Build compradores
      const compradores: CompradoresRow[] = compData.map((c: any) => {
        const persona = personaMap.get(c.id_persona);
        return {
          id_persona: Number(c.id_persona),
          nombre_legal: persona?.nombre_legal ?? "Sin nombre",
          email: persona?.email ?? null,
          telefono: persona?.telefono ?? null,
          porcentaje_copropiedad: safeNum(c.porcentaje_copropiedad),
        };
      });

      // Build productos
      const ofertaProductoMap = new Map<number, number | null>(ofertasProp.map((o: any) => [o.id, o.id_producto ?? null]));
      const productosData: ProductoRow[] = (cuentasPropRes.data ?? []).map((c: any) => {
        const idProducto = ofertaProductoMap.get(c.id_oferta);
        if (idProducto == null) return { cuenta_id: Number(c.id), precio_final: safeNum(c.precio_final), tipo: "Departamento", categoria: "depto" as const };
        if (bodegaMap.has(idProducto)) return { cuenta_id: Number(c.id), precio_final: safeNum(c.precio_final), tipo: bodegaMap.get(idProducto)!, categoria: "bodega" as const };
        if (estacMap.has(idProducto)) return { cuenta_id: Number(c.id), precio_final: safeNum(c.precio_final), tipo: estacMap.get(idProducto)!, categoria: "estacionamiento" as const };
        return null;
      }).filter(Boolean) as ProductoRow[];

      productosData.sort((a, b) => {
        if (a.categoria === "depto" && b.categoria !== "depto") return -1;
        if (b.categoria === "depto" && a.categoria !== "depto") return 1;
        return b.precio_final - a.precio_final;
      });

      return { detalle: detalleObj, acuerdos, productos: productosData, compradores };
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

        {/* Header */}
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
          <p className="text-[13px] text-destructive px-5 py-6">No se pudo cargar la informacion de esta cuenta.</p>
        ) : (
          <div className="px-5 pb-6 pt-4 space-y-5">

            {/* Financiero */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 mb-2">
                Financiero - Departamento
              </p>

              <div className="grid grid-cols-3 rounded-xl border border-border bg-muted/20 divide-x divide-border overflow-hidden">
                <StatCell label="Precio Final"    value={fmtCurrency(detalle.precio_final)} />
                <StatCell label="Total Pagado"    value={fmtCurrency(detalle.total_pagado)}  valueClass="text-emerald-600" />
                <StatCell label="Saldo"           value={fmtCurrency(saldoPendiente)}
                  valueClass={saldoPendiente > 0 ? "text-red-600" : "text-emerald-600"} />
              </div>

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
                        <span className="ml-1.5 normal-case font-bold">- Limite excedido</span>
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
                      <p className="text-[10px] text-muted-foreground mb-0.5">Limite (UMA x 8,025)</p>
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
                        {Math.min(999.9, (detalle.efectivo_pagado / limiteEfectivo) * 100).toFixed(1)}% del limite
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Escrituracion */}
            {productos.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 mb-2">
                    Escrituracion
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
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Total escrituracion
                        </span>
                        <span className="text-[15px] font-bold tabular-nums">{fmtCurrency(totalEscrituracion)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
                    <Info className="size-3 shrink-0" />
                    Validacion PDF aplica solo al precio del departamento vs contrato firmado.
                  </p>
                </div>
              </>
            )}

            {/* Compradores */}
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

            {/* Datos generales */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 mb-3">
                Datos generales
              </p>
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[11px] text-muted-foreground shrink-0 pt-0.5">Cliente / Dueno</p>
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

            {/* Acuerdos de pago (colapsable) */}
            {acuerdos.length > 0 && (
              <>
                <Separator />
                <div>
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

// ── Pagina principal ───────────────────────────────────────────────────────────

export default function ValidacionContratosPDF() {
  const [searchUnidad,   setSearchUnidad]   = useState("");
  const [searchCliente,  setSearchCliente]  = useState("");
  const [filtroProyecto, setFiltroProyecto] = useState("todos");
  const [filtroEstado,   setFiltroEstado]   = useState("todos");
  const [currentPage,    setCurrentPage]    = useState(1);
  const [modalCuentaId,  setModalCuentaId]  = useState<number | null>(null);
  const [contratoUrl,    setContratoUrl]    = useState<string | null>(null);

  const resetPage = () => setCurrentPage(1);

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["validacion-contratos-pdf"],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<ContratoRow[]> => {
      // Step 1: proyectos SOZU
      const { data: erSozu } = await supabase
        .from("entidades_relacionadas")
        .select("id_proyecto")
        .eq("id_tipo_entidad", 5)
        .eq("activo", true);

      const proyectoIds = [...new Set((erSozu ?? []).map(r => r.id_proyecto).filter(Boolean))] as number[];
      if (!proyectoIds.length) return [];

      // Step 2: proyectos publicados
      const { data: proyectosData } = await supabase
        .from("proyectos")
        .select("id, nombre")
        .in("id", proyectoIds)
        .eq("publicar", true)
        .eq("activo", true);

      const proyMap = new Map<number, string>((proyectosData ?? []).map(p => [p.id, p.nombre]));
      const validProjIds = (proyectosData ?? []).map(p => p.id);
      if (!validProjIds.length) return [];

      // Step 3: edificios
      const { data: edificiosData } = await supabase
        .from("edificios")
        .select("id, nombre, id_proyecto")
        .in("id_proyecto", validProjIds)
        .eq("activo", true);

      const edifMap = new Map<number, { nombre: string; id_proyecto: number }>(
        (edificiosData ?? []).map(e => [e.id, { nombre: e.nombre, id_proyecto: e.id_proyecto }])
      );
      const edificioIds = (edificiosData ?? []).map(e => e.id);
      if (!edificioIds.length) return [];

      // Step 4: edificios_modelos
      const { data: emData } = await supabase
        .from("edificios_modelos")
        .select("id, id_edificio, id_modelo")
        .in("id_edificio", edificioIds);

      const emMap = new Map<number, { id_edificio: number; id_modelo: number | null }>(
        (emData ?? []).map(em => [em.id, { id_edificio: em.id_edificio, id_modelo: em.id_modelo ?? null }])
      );
      const emIds = (emData ?? []).map(em => em.id);
      if (!emIds.length) return [];

      // Step 5: parallel — propiedades + modelos
      const modeloIds = [...new Set((emData ?? []).map(em => em.id_modelo).filter(Boolean))] as number[];

      const [propiedadesRes, modelosRes] = await Promise.all([
        supabase.from("propiedades")
          .select("id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno")
          .in("id_edificio_modelo", emIds)
          .eq("activo", true),
        modeloIds.length
          ? supabase.from("modelos").select("id, nombre").in("id", modeloIds)
          : Promise.resolve({ data: [] }),
      ]);

      const modeloMap = new Map<number, string>((modelosRes.data ?? []).map((m: any) => [m.id, m.nombre]));
      const propiedadesData = propiedadesRes.data ?? [];
      const propMap = new Map<number, (typeof propiedadesData)[0]>(propiedadesData.map(p => [p.id, p]));
      const propIds = propiedadesData.map(p => p.id);
      if (!propIds.length) return [];

      // Step 6: ofertas (departamento principal — id_producto IS NULL)
      const { data: ofertasData } = await (supabase as any)
        .from("ofertas")
        .select("id, id_propiedad")
        .in("id_propiedad", propIds)
        .is("id_producto", null)
        .eq("activo", true);

      const ofertaMap = new Map<number, number>((ofertasData ?? []).map((o: any) => [o.id, o.id_propiedad]));
      const ofertaIds = (ofertasData ?? []).map((o: any) => o.id);
      if (!ofertaIds.length) return [];

      // Step 7: cuentas_cobranza
      const { data: cuentasData } = await supabase
        .from("cuentas_cobranza")
        .select("id, precio_final, fecha_compra, id_oferta")
        .in("id_oferta", ofertaIds)
        .eq("activo", true);

      const cuentaIds = (cuentasData ?? []).map(c => c.id);
      if (!cuentaIds.length) return [];

      // Step 8: parallel — documentos + entidades_relacionadas dueños
      const erDuenoIds = [...new Set(propiedadesData.map(p => p.id_entidad_relacionada_dueno).filter(Boolean))] as number[];

      const [docsRes, erDuenoRes] = await Promise.all([
        supabase.from("documentos")
          .select("id, id_cuenta_cobranza, url")
          .in("id_cuenta_cobranza", cuentaIds)
          .in("id_tipo_documento", [18, 42])
          .eq("activo", true)
          .order("id", { ascending: false }),
        erDuenoIds.length
          ? supabase.from("entidades_relacionadas").select("id, id_persona").in("id", erDuenoIds).eq("activo", true)
          : Promise.resolve({ data: [] }),
      ]);

      // Most recent doc per cuenta (already ordered desc)
      const docByCuenta = new Map<number, { id: number; url: string | null }>();
      for (const d of docsRes.data ?? []) {
        if (!docByCuenta.has(d.id_cuenta_cobranza)) {
          docByCuenta.set(d.id_cuenta_cobranza, { id: d.id, url: d.url ?? null });
        }
      }
      const docIds = [...docByCuenta.values()].map(d => d.id);

      // Step 9: parallel — contrato_validaciones + personas dueños
      const erPersonaIds = [...new Set((erDuenoRes.data ?? []).map((er: any) => er.id_persona).filter(Boolean))] as number[];

      const [valRes, personasDuenoRes] = await Promise.all([
        docIds.length
          ? (supabase as any).from("contrato_validaciones")
              .select("id_documento, estado, monto_real, motivo, fecha_creacion")
              .in("id_documento", docIds)
              .order("fecha_creacion", { ascending: false })
          : Promise.resolve({ data: [] }),
        erPersonaIds.length
          ? supabase.from("personas").select("id, nombre_legal").in("id", erPersonaIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Most recent validation per doc
      const valByDoc = new Map<number, { estado: string; monto_real: number | null; motivo: string | null }>();
      for (const v of valRes.data ?? []) {
        if (!valByDoc.has(v.id_documento)) {
          valByDoc.set(v.id_documento, { estado: v.estado, monto_real: v.monto_real ?? null, motivo: v.motivo ?? null });
        }
      }

      // Build dueño lookup: er.id -> nombre_legal
      const personaNombreMap = new Map<number, string>((personasDuenoRes.data ?? []).map((p: any) => [p.id, p.nombre_legal]));
      const personaByEr = new Map<number, string>(
        (erDuenoRes.data ?? []).map((er: any) => [er.id, personaNombreMap.get(er.id_persona) ?? "Sin propietario"])
      );

      // Step 10: merge
      const result: ContratoRow[] = [];
      for (const cuenta of cuentasData ?? []) {
        const ofertaPropId = ofertaMap.get(cuenta.id_oferta);
        if (ofertaPropId == null) continue;
        const prop = propMap.get(ofertaPropId);
        if (!prop) continue;
        const em = emMap.get(prop.id_edificio_modelo);
        if (!em) continue;
        const edif = edifMap.get(em.id_edificio);
        if (!edif) continue;

        const proyNombre   = proyMap.get(edif.id_proyecto) ?? "-";
        const edifNombre   = edif.nombre ?? null;
        const modeloNombre = em.id_modelo ? (modeloMap.get(em.id_modelo) ?? null) : null;
        const dueno        = prop.id_entidad_relacionada_dueno
          ? (personaByEr.get(prop.id_entidad_relacionada_dueno) ?? "Sin propietario")
          : "Sin propietario";
        const docInfo  = docByCuenta.get(cuenta.id) ?? null;
        const valInfo  = docInfo ? (valByDoc.get(docInfo.id) ?? null) : null;

        result.push({
          cuenta_id:         cuenta.id,
          proyecto:          proyNombre,
          edificio:          edifNombre,
          modelo:            modeloNombre,
          numero_propiedad:  prop.numero_propiedad ?? null,
          dueno,
          precio_final:      safeNum(cuenta.precio_final),
          fecha_compra:      cuenta.fecha_compra ?? null,
          contrato_url:      docInfo?.url ?? null,
          estado_validacion: (valInfo?.estado ?? null) as ContratoRow["estado_validacion"],
          monto_real:        valInfo?.monto_real != null ? safeNum(valInfo.monto_real) : null,
          motivo:            valInfo?.motivo ?? null,
        });
      }

      result.sort((a, b) => {
        if (a.proyecto < b.proyecto) return -1;
        if (a.proyecto > b.proyecto) return 1;
        return (a.numero_propiedad ?? "").localeCompare(b.numero_propiedad ?? "", "es");
      });

      return result;
    },
  });

  const proyectos = useMemo(() => Array.from(new Set(rows.map((r) => r.proyecto))).sort(), [rows]);

  const filtered = useMemo(() => rows.filter((c) => {
    if (filtroProyecto !== "todos" && c.proyecto !== filtroProyecto) return false;
    if (filtroEstado !== "todos") {
      if (filtroEstado === "sin_registro" && c.estado_validacion !== null) return false;
      if (filtroEstado !== "sin_registro" && c.estado_validacion !== filtroEstado) return false;
    }
    if (searchUnidad  && !c.numero_propiedad?.toLowerCase().includes(searchUnidad.toLowerCase()))  return false;
    if (searchCliente && !c.dueno?.toLowerCase().includes(searchCliente.toLowerCase()))            return false;
    return true;
  }), [rows, filtroProyecto, filtroEstado, searchUnidad, searchCliente]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const stats = useMemo(() => ({
    total:        rows.length,
    coincide:     rows.filter(r => r.estado_validacion === "coincide").length,
    no_coincide:  rows.filter(r => r.estado_validacion === "no_coincide").length,
    error:        rows.filter(r => r.estado_validacion === "error").length,
    sin_registro: rows.filter(r => r.estado_validacion === null).length,
  }), [rows]);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Validacion Contratos PDF</h1>
        <p className="text-muted-foreground mt-1">
          Contratos de propiedades SOZU - verificacion precio PDF vs precio DB (departamento)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileSearch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{isLoading ? "-" : stats.total}</div>
          </CardContent>
        </Card>
        <Card className={cn(!isLoading && stats.coincide > 0 ? "border-emerald-200 bg-emerald-50/40" : "")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", !isLoading && stats.coincide > 0 ? "text-emerald-700" : "text-muted-foreground")}>Coinciden</CardTitle>
            <CheckCircle2 className={cn("h-4 w-4", !isLoading && stats.coincide > 0 ? "text-emerald-600" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold tabular-nums", !isLoading && stats.coincide > 0 ? "text-emerald-700" : "text-muted-foreground")}>
              {isLoading ? "-" : stats.coincide}
            </div>
          </CardContent>
        </Card>
        <Card className={cn(!isLoading && stats.no_coincide > 0 ? "border-red-200 bg-red-50/40" : "")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", !isLoading && stats.no_coincide > 0 ? "text-red-700" : "text-muted-foreground")}>No coinciden</CardTitle>
            <XCircle className={cn("h-4 w-4", !isLoading && stats.no_coincide > 0 ? "text-red-600" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold tabular-nums", !isLoading && stats.no_coincide > 0 ? "text-red-700" : "text-muted-foreground")}>
              {isLoading ? "-" : stats.no_coincide}
            </div>
          </CardContent>
        </Card>
        <Card className={cn(!isLoading && stats.error > 0 ? "border-amber-200 bg-amber-50/40" : "")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", !isLoading && stats.error > 0 ? "text-amber-700" : "text-muted-foreground")}>
              {!isLoading && stats.error === 0 ? "Sin validar" : "Error lectura"}
            </CardTitle>
            {!isLoading && stats.error > 0
              ? <AlertCircle className="h-4 w-4 text-amber-600" />
              : <Clock className="h-4 w-4 text-muted-foreground" />
            }
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold tabular-nums", !isLoading && stats.error > 0 ? "text-amber-700" : "text-muted-foreground")}>
              {isLoading ? "-" : stats.error > 0 ? stats.error : stats.sin_registro}
            </div>
            {!isLoading && stats.error > 0 && stats.sin_registro > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{stats.sin_registro} sin validar</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Unidad (No. propiedad)"
          value={searchUnidad}
          onChange={(e) => { setSearchUnidad(e.target.value); resetPage(); }}
          className="h-9 text-sm w-[160px] sm:w-[180px]"
        />
        <Input
          placeholder="Cliente / Dueno"
          value={searchCliente}
          onChange={(e) => { setSearchCliente(e.target.value); resetPage(); }}
          className="h-9 text-sm w-[160px] sm:w-[200px]"
        />
        <Select value={filtroProyecto} onValueChange={(v) => { setFiltroProyecto(v); resetPage(); }}>
          <SelectTrigger className="h-9 w-[160px] sm:w-[180px] text-sm">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los proyectos</SelectItem>
            {proyectos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={(v) => { setFiltroEstado(v); resetPage(); }}>
          <SelectTrigger className="h-9 w-[150px] text-sm">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="coincide">Coincide</SelectItem>
            <SelectItem value="no_coincide">No coincide</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="sin_registro">Sin registro</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground tabular-nums ml-auto hidden sm:block">
          {isLoading ? "Cargando..." : `${filtered.length} de ${stats.total} - Pag. ${currentPage}/${totalPages}`}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[110px]">Cuenta</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proyecto</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Unidad</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Cliente / Dueno</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right hidden xl:table-cell">
                  Precio Final
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center hidden sm:table-cell">
                  Estado PDF
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[80px]">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      <span className="text-sm">Cargando contratos...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-destructive">
                    Error al cargar datos.
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    Sin resultados para los filtros actuales
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((c) => (
                    <TableRow key={c.cuenta_id} className="hover:bg-muted/30 text-sm">
                      <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatCuentaCobranzaId(c.cuenta_id)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{c.proyecto}</div>
                        {(c.edificio || c.modelo) && (
                          <div className="text-[11px] text-muted-foreground">
                            {[c.edificio, c.modelo].filter(Boolean).join(" - ")}
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
                      <TableCell className="hidden sm:table-cell text-center">
                        {c.estado_validacion === "coincide" ? (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] gap-1 px-2 py-0.5">
                            <CheckCircle2 className="size-3" />Coincide
                          </Badge>
                        ) : c.estado_validacion === "no_coincide" ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[11px] gap-1 px-2 py-0.5">
                              <XCircle className="size-3" />No coincide
                            </Badge>
                            {c.monto_real !== null && (
                              <span className="text-[10px] tabular-nums text-red-600 font-medium">
                                {fmtCurrency(c.monto_real - c.precio_final)}
                              </span>
                            )}
                          </div>
                        ) : c.estado_validacion === "error" ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[11px] gap-1 px-2 py-0.5">
                              <AlertCircle className="size-3" />Error
                            </Badge>
                            {c.motivo && (
                              <span className="text-[10px] text-amber-600 max-w-[120px] truncate" title={c.motivo}>
                                {c.motivo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="border-border text-muted-foreground text-[11px] px-2 py-0.5">
                            Sin registro
                          </Badge>
                        )}
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
          <p className="text-sm text-muted-foreground tabular-nums shrink-0">
            {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 p-0">
              <ChevronLeft className="size-4" />
            </Button>
            {pageNumbers.map((p, idx) =>
              p === "..." ? (
                <span key={`e${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
              ) : (
                <Button key={p} variant={p === currentPage ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(p as number)} className="h-8 w-8 p-0 text-sm">
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
