import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle, Building2, ChevronDown, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Eye, FileCheck, FileSearch, FileText, FileUp, Loader2, Pencil, Trash2, Upload, UploadCloud, XCircle, Receipt,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { EliminarPagoDialog } from "@/components/admin/portal-cobranza/EliminarPagoDialog";
import { useEliminarPago, fetchPagoImpacto, type PagoImpacto } from "@/hooks/useEliminarPago";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import { cn } from "@/lib/utils";
import { esSinPermiso, retrySalvoSinPermiso } from "@/lib/rpcErrors";
import { metodoAdmiteCep, metodoEsCepForzado, pathEvidencia, resolveBucketEvidencia } from "@/lib/evidenciaPagoBucket";

const ITEMS_PER_PAGE = 25;
const CHUNK = 1000;

// ── Types ──────────────────────────────────────────────────────────────────────

interface PagoRow {
  pago_id: number;
  cuenta_id: number;
  // Folio canónico (CC-/CCP-/CM-) que ya resuelve la RPC.
  cuenta_folio: string | null;
  proyecto: string;
  numero_propiedad: string | null;
  cliente: string;
  monto: number;
  fecha_pago: string;
  id_metodos_pago: number;
  metodo_nombre: string;
  clave_rastreo: string | null;
  url_cep: string | null;
  url_recibo: string | null;
  descripcion: string | null;
  validacion_documental_efectivo: boolean;
  estado_validacion: "coincide" | "error" | "no_coincide" | "sin_evidencia" | "monto_ilegible" | "monto_ausente_db" | null;
  motivo: string | null;
  monto_esperado: number | null;
  monto_real: number | null;
  // Etiqueta legible (nombre del producto cuando existe).
  tipo_nombre: string;
  // Categoría canónica, la misma que usan CC y RP.
  tipo_categoria: 'Propiedad' | 'Bodega' | 'Estacionamiento' | 'Producto' | 'Mantenimiento' | 'Adicional';
  estado_pago: 'pagado' | 'parcial' | 'sin_aplicar' | null;
  monto_aplicado: number;
  id_estatus_disponibilidad: number | null;
  id_propiedad: number | null;
}

interface AplicacionDetalle {
  id: number;
  monto: number;
  concepto: string;
  es_multa: boolean;
}

interface PagoDetalleData {
  pago_id: number;
  cuenta_id: number;
  monto: number;
  fecha_pago: string;
  metodo_nombre: string;
  id_metodos_pago: number;
  clave_rastreo: string | null;
  url_cep: string | null;
  url_recibo: string | null;
  descripcion: string | null;
  validacion_documental_efectivo: boolean;
  precio_final: number;
  clabe_stp: string | null;
  fecha_compra: string | null;
  proyecto: string;
  numero_propiedad: string | null;
  cliente: string;
  aplicaciones: AplicacionDetalle[];
  tipo_nombre: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null || isNaN(n) || !isFinite(n)) return "-";
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "-";
  const [y, m, d] = s.substring(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// Categorías canónicas de cobranza (idénticas a CC y RP). La subclasificación por
// nombre de producto (condensadoras, paquetes, persianas…) se dejó de usar como filtro:
// hacía que Validación hablara un idioma distinto al de las otras dos pantallas.
const TIPO_CATEGORIAS = ['Propiedad', 'Bodega', 'Estacionamiento', 'Producto', 'Mantenimiento', 'Adicional'] as const;

function tipoBadgeClass(categoria: string): string {
  return ({
    Propiedad:       "border-sky-200 bg-sky-50 text-sky-700",
    Bodega:          "border-amber-200 bg-amber-50 text-amber-700",
    Estacionamiento: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Producto:        "border-violet-200 bg-violet-50 text-violet-700",
    Mantenimiento:   "border-teal-200 bg-teal-50 text-teal-700",
    Adicional:       "border-indigo-200 bg-indigo-50 text-indigo-700",
  } as Record<string, string>)[categoria] ?? "border-border bg-muted/40 text-muted-foreground";
}

function EstadoBadge({ estado }: { estado: PagoRow["estado_validacion"] }) {
  if (estado === "coincide")
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] gap-1 whitespace-nowrap">
        <CheckCircle2 className="size-3" />Coincide
      </Badge>
    );
  if (estado === "error")
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[10px] gap-1 whitespace-nowrap">
        <AlertCircle className="size-3" />Error
      </Badge>
    );
  if (estado === "no_coincide")
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px] gap-1 whitespace-nowrap">
        <XCircle className="size-3" />No coincide
      </Badge>
    );
  if (estado === "sin_evidencia")
    return (
      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 text-[10px] gap-1 whitespace-nowrap">
        <AlertCircle className="size-3" />Sin evidencia
      </Badge>
    );
  if (estado === "monto_ilegible")
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px] gap-1 whitespace-nowrap">
        <XCircle className="size-3" />Monto ilegible
      </Badge>
    );
  if (estado === "monto_ausente_db")
    return (
      <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 text-[10px] gap-1 whitespace-nowrap">
        <XCircle className="size-3" />Monto ausente
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-500 text-[10px] gap-1 whitespace-nowrap">
      <Clock className="size-3" />Sin validar
    </Badge>
  );
}

// ── Comprobante viewer ─────────────────────────────────────────────────────────

function ComprobanteViewerModal({
  url, title, onClose,
}: { url: string | null; title: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const handleOpenChange = (o: boolean) => { if (!o) { setLoaded(false); onClose(); } };
  return (
    <Dialog open={url !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-[14px]">
              <Receipt className="size-4 text-muted-foreground" />{title}
            </DialogTitle>
            {url && (
              <a href={url} target="_blank" rel="noreferrer"
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors mr-7">
                Abrir en pestaña →
              </a>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/20 relative">
          {!loaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-muted/20">
              <Loader2 className="size-7 animate-spin text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">Cargando comprobante...</p>
            </div>
          )}
          {url && (
            <iframe key={url} src={url} className="w-full h-full border-0"
              title={title} onLoad={() => setLoaded(true)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Detalle del pago ───────────────────────────────────────────────────────────

function PagoDetalleModal({ pagoId, pagoRow, onClose }: {
  pagoId: number | null;
  pagoRow: PagoRow | null;
  onClose: () => void;
}) {
  const [aplicacionesOpen, setAplicacionesOpen] = useState(false);
  const [cepLoaded, setCepLoaded] = useState(false);
  useEffect(() => { setCepLoaded(false); setAplicacionesOpen(false); }, [pagoId]);

  const { data, isLoading } = useQuery({
    queryKey: ["pago-detalle-modal", pagoId],
    enabled: pagoId !== null,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<PagoDetalleData | null> => {
      if (!pagoId || !pagoRow) return null;
      const [ccRes, aplicRes] = await Promise.all([
        supabase.from("cuentas_cobranza")
          .select("precio_final, clabe_stp, fecha_compra")
          .eq("id", pagoRow.cuenta_id).eq("activo", true).single(),
        supabase.from("aplicaciones_pago")
          .select("id, id_acuerdo_pago, monto, es_multa")
          .eq("id_pago", pagoId).eq("activo", true),
      ]);
      const cc = ccRes.data;
      const aplicData = aplicRes.data ?? [];
      const acuerdoIds = aplicData.map((a: any) => a.id_acuerdo_pago).filter(Boolean) as number[];
      let aplicaciones: AplicacionDetalle[] = [];
      if (acuerdoIds.length) {
        const { data: acuerdosData } = await supabase
          .from("acuerdos_pago").select("id, id_concepto").in("id", acuerdoIds);
        const conceptoIds = [...new Set((acuerdosData ?? []).map((a: any) => a.id_concepto).filter(Boolean))] as number[];
        const { data: conceptosData } = conceptoIds.length
          ? await supabase.from("conceptos_pago").select("id, nombre").in("id", conceptoIds)
          : { data: [] };
        const acuerdoConceptoMap = new Map<number, number>((acuerdosData ?? []).map((a: any) => [a.id, a.id_concepto]));
        const conceptoMap = new Map<number, string>((conceptosData ?? []).map((c: any) => [c.id, c.nombre]));
        aplicaciones = aplicData.map((a: any) => {
          const conceptoId = acuerdoConceptoMap.get(a.id_acuerdo_pago) ?? null;
          return {
            id: a.id, monto: safeNum(a.monto),
            concepto: conceptoId ? (conceptoMap.get(conceptoId) ?? "Sin concepto") : "Sin concepto",
            es_multa: a.es_multa ?? false,
          };
        });
      }
      return {
        pago_id: pagoId, cuenta_id: pagoRow.cuenta_id, monto: pagoRow.monto, fecha_pago: pagoRow.fecha_pago,
        metodo_nombre: pagoRow.metodo_nombre, id_metodos_pago: pagoRow.id_metodos_pago,
        clave_rastreo: pagoRow.clave_rastreo, url_cep: pagoRow.url_cep, url_recibo: pagoRow.url_recibo,
        descripcion: pagoRow.descripcion, validacion_documental_efectivo: pagoRow.validacion_documental_efectivo,
        precio_final: safeNum(cc?.precio_final), clabe_stp: cc?.clabe_stp ?? null,
        fecha_compra: cc?.fecha_compra ?? null, proyecto: pagoRow.proyecto,
        numero_propiedad: pagoRow.numero_propiedad, cliente: pagoRow.cliente, aplicaciones,
        tipo_nombre: pagoRow.tipo_nombre,
      };
    },
  });

  const primaryUrl = data?.url_cep ?? data?.url_recibo ?? null;
  const primaryIsRecibo = !data?.url_cep && !!data?.url_recibo;

  return (
    <Dialog open={pagoId !== null} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-6xl w-[98vw] h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <Receipt className="size-4 text-muted-foreground" />Detalle de pago
            {pagoRow && <span className="text-muted-foreground font-normal ml-1">— {pagoRow.cuenta_folio ?? formatCuentaCobranzaId(pagoRow.cuenta_id)}</span>}
            {pagoRow && (
              <Badge variant="outline" className={cn("text-[10px] ml-1", tipoBadgeClass(pagoRow.tipo_categoria))}>
                {pagoRow.tipo_nombre}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          <div className="md:w-[55%] shrink-0 border-b md:border-b-0 md:border-r bg-muted/10 relative flex flex-col h-48 md:h-auto">
            {primaryUrl ? (
              <>
                {!cepLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-muted/10">
                    <Loader2 className="size-7 animate-spin text-muted-foreground" />
                    <p className="text-[12px] text-muted-foreground">Cargando comprobante...</p>
                  </div>
                )}
                <iframe key={primaryUrl} src={primaryUrl} className="w-full h-full border-0 flex-1"
                  title="Comprobante" onLoad={() => setCepLoaded(true)} />
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  {primaryIsRecibo && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                      Recibo (sin CEP)
                    </span>
                  )}
                  <a href={primaryUrl} target="_blank" rel="noreferrer"
                    className="text-[10px] text-muted-foreground hover:text-foreground bg-background/80 px-2 py-1 rounded border">
                    Abrir en pestaña →
                  </a>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/40">
                <Receipt className="size-12" />
                <p className="text-[12px]">Sin comprobante</p>
              </div>
            )}
          </div>
          <div className="md:flex-1 overflow-y-auto p-5 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : data ? (
              <>
                <div className="rounded-xl border bg-card p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Monto del pago</p>
                  <p className="text-[28px] font-bold tabular-nums">{fmtCurrency(data.monto)}</p>
                  <EstadoBadge estado={pagoRow?.estado_validacion ?? null} />
                </div>
                {(pagoRow?.monto_esperado != null || pagoRow?.monto_real != null) && (
                  <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Validación automática</p>
                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                      <div><p className="text-muted-foreground text-[10px]">Esperado</p><p className="font-mono tabular-nums font-medium">{fmtCurrency(pagoRow!.monto_esperado)}</p></div>
                      <div><p className="text-muted-foreground text-[10px]">Real</p><p className="font-mono tabular-nums font-medium">{fmtCurrency(pagoRow!.monto_real)}</p></div>
                    </div>
                    {pagoRow!.monto_esperado != null && pagoRow!.monto_real != null && (
                      <div className="text-[11px] border-t pt-1.5 flex items-center justify-between">
                        <p className="text-muted-foreground">Diferencia</p>
                        <p className={cn("font-mono tabular-nums font-semibold",
                          Math.abs(pagoRow!.monto_real - pagoRow!.monto_esperado) < 0.01 ? "text-emerald-600" : "text-red-600"
                        )}>{fmtCurrency(pagoRow!.monto_real - pagoRow!.monto_esperado)}</p>
                      </div>
                    )}
                    {pagoRow?.motivo && <p className="text-[11px] text-muted-foreground border-t pt-1.5">{pagoRow.motivo}</p>}
                  </div>
                )}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Pago</p>
                  <div className="space-y-1.5 text-[12px]">
                    {([
                      ["Fecha", fmtDate(data.fecha_pago)],
                      ["Método", data.metodo_nombre],
                      ["Clave rastreo", data.clave_rastreo ?? "-"],
                      ["Descripción", data.descripcion ?? "-"],
                    ] as [string, string][]).map(([label, val]) => (
                      <div key={label} className="flex items-center justify-between gap-4">
                        <p className="text-muted-foreground shrink-0">{label}</p>
                        <p className="tabular-nums text-right break-all">{val}</p>
                      </div>
                    ))}
                    {data.id_metodos_pago === 1 && (
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-muted-foreground shrink-0">Doc. efectivo</p>
                        <Badge variant="outline" className={cn("text-[10px]",
                          data.validacion_documental_efectivo
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        )}>{data.validacion_documental_efectivo ? "Verificado" : "Sin verificar"}</Badge>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Evidencia</p>
                  <div className="space-y-1.5 text-[12px]">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-muted-foreground shrink-0">CEP</p>
                      {data.url_cep
                        ? <a href={data.url_cep} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[11px]">Ver CEP →</a>
                        : <span className="text-muted-foreground/50 text-[11px]">Sin CEP</span>
                      }
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-muted-foreground shrink-0">Recibo</p>
                      {data.url_recibo
                        ? <a href={data.url_recibo} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[11px]">Ver recibo →</a>
                        : <span className="text-muted-foreground/50 text-[11px]">Sin recibo</span>
                      }
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Cuenta de cobranza</p>
                  <div className="space-y-1.5 text-[12px]">
                    {([
                      ["Cuenta", formatCuentaCobranzaId(data.cuenta_id)],
                      ["Tipo", data.tipo_nombre],
                      ["Proyecto", data.proyecto],
                      ["Unidad", data.numero_propiedad ?? "-"],
                      ["Cliente", data.cliente],
                      ["Precio final", fmtCurrency(data.precio_final)],
                      ["CLABE STP", data.clabe_stp ?? "-"],
                      ["Fecha compra", fmtDate(data.fecha_compra)],
                    ] as [string, string][]).map(([label, val]) => (
                      <div key={label} className="flex items-center justify-between gap-4">
                        <p className="text-muted-foreground shrink-0">{label}</p>
                        <p className="tabular-nums text-right">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {data.aplicaciones.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <button onClick={() => setAplicacionesOpen(o => !o)}
                        className="w-full flex items-center justify-between py-1 group">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">Aplicaciones</p>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {data.aplicaciones.length} concepto{data.aplicaciones.length !== 1 ? "s" : ""}
                        </span>
                      </button>
                      {aplicacionesOpen && (
                        <div className="mt-2 rounded-xl border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead className="text-[10px]">Concepto</TableHead>
                                <TableHead className="text-[10px] text-right">Monto</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.aplicaciones.map(a => (
                                <TableRow key={a.id} className="text-[12px]">
                                  <TableCell className="py-1.5">
                                    {a.concepto}
                                    {a.es_multa && <Badge variant="outline" className="ml-2 text-[9px] border-red-200 bg-red-50 text-red-700">Multa</Badge>}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right tabular-nums">{fmtCurrency(a.monto)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-[12px] text-muted-foreground text-center py-8">No se pudo cargar el detalle.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Editar validación ──────────────────────────────────────────────────────────

function EditPagoValidacionModal({ row, onClose }: {
  row: PagoRow | null;
  onClose: () => void;
}) {
  const [estado, setEstado] = useState<NonNullable<PagoRow["estado_validacion"]>>("error");
  const [motivo, setMotivo] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!row) return;
    setEstado((row.estado_validacion as NonNullable<PagoRow["estado_validacion"]>) ?? "error");
    setMotivo(row.motivo ?? "");
  }, [row?.pago_id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!row) throw new Error("No hay pago seleccionado");
      const { error } = await (supabase as any).from("pago_validaciones")
        .upsert(
          { id_pago: row.pago_id, estado, motivo: motivo.trim() || null },
          { onConflict: "id_pago" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(["validacion-pagos-all-v2"], (old: { rows: PagoRow[]; readiness: Map<number, boolean> } | undefined) => {
        if (!old || !row) return old;
        return {
          ...old,
          rows: old.rows.map(r =>
            r.pago_id === row.pago_id
              ? { ...r, estado_validacion: estado as PagoRow["estado_validacion"], motivo: motivo.trim() || null }
              : r
          ),
        };
      });
      if (row) queryClient.invalidateQueries({ queryKey: ["pago-detalle-modal", row.pago_id] });
      toast({ title: "Validación guardada" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => { if (!mutation.isPending) onClose(); };

  return (
    <Dialog open={row !== null} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md w-[95vw] p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-5 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <Pencil className="size-4 text-muted-foreground" />Editar validación
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-xl border bg-muted/20 p-3 space-y-0.5">
            <p className="text-[11px] text-muted-foreground">Cuenta: <span className="font-medium text-foreground">{row ? (row.cuenta_folio ?? formatCuentaCobranzaId(row.cuenta_id)) : "-"}</span></p>
            <p className="text-[11px] text-muted-foreground">Monto: <span className="font-medium text-foreground tabular-nums">{row ? fmtCurrency(row.monto) : "-"}</span></p>
            <p className="text-[11px] text-muted-foreground">Fecha: <span className="font-medium text-foreground">{row ? fmtDate(row.fecha_pago) : "-"}</span></p>
          </div>
          {(row?.monto_esperado != null || row?.monto_real != null) && (
            <div className="rounded-xl border bg-muted/20 p-3 space-y-1.5">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Comparación automática</p>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div><p className="text-muted-foreground text-[10px]">Esperado</p><p className="font-mono tabular-nums font-medium">{fmtCurrency(row!.monto_esperado)}</p></div>
                <div><p className="text-muted-foreground text-[10px]">Real</p><p className="font-mono tabular-nums font-medium">{fmtCurrency(row!.monto_real)}</p></div>
              </div>
              {row!.monto_esperado != null && row!.monto_real != null && (
                <div className="text-[11px] border-t pt-1.5 flex items-center justify-between">
                  <p className="text-muted-foreground">Diferencia</p>
                  <p className={cn("font-mono tabular-nums font-semibold",
                    Math.abs(row!.monto_real - row!.monto_esperado) < 0.01 ? "text-emerald-600" : "text-red-600"
                  )}>{fmtCurrency(row!.monto_real - row!.monto_esperado)}</p>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[12px]">Estado de validación</Label>
            <Select value={estado} onValueChange={v => setEstado(v as typeof estado)}>
              <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="coincide" className="text-[12px]">
                  <span className="flex items-center gap-2"><CheckCircle2 className="size-3 text-emerald-600" />Coincide</span>
                </SelectItem>
                <SelectItem value="error" className="text-[12px]">
                  <span className="flex items-center gap-2"><AlertCircle className="size-3 text-red-600" />Error</span>
                </SelectItem>
                <SelectItem value="no_coincide" className="text-[12px]">
                  <span className="flex items-center gap-2"><XCircle className="size-3 text-amber-600" />No coincide</span>
                </SelectItem>
                <SelectItem value="sin_evidencia" className="text-[12px]">
                  <span className="flex items-center gap-2"><AlertCircle className="size-3 text-slate-500" />Sin evidencia</span>
                </SelectItem>
                <SelectItem value="monto_ilegible" className="text-[12px]">
                  <span className="flex items-center gap-2"><XCircle className="size-3 text-amber-600" />Monto ilegible</span>
                </SelectItem>
                <SelectItem value="monto_ausente_db" className="text-[12px]">
                  <span className="flex items-center gap-2"><XCircle className="size-3 text-orange-600" />Monto ausente</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Observaciones <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea placeholder="Notas, discrepancias, motivo..." value={motivo}
              onChange={e => setMotivo(e.target.value)} className="text-[12px] resize-none h-24" />
          </div>
        </div>
        <div className="px-5 py-4 border-t flex-shrink-0 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={mutation.isPending} className="text-[12px] h-8">Cancelar</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="text-[12px] h-8">
            {mutation.isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Cargar evidencia / CEP ───────────────────────────────────────────────────
// Bucket por MÉTODO de pago (resolveBucketEvidencia); columna por check "Validado".
//   validado                  → url_cep  ; no validado → url_recibo
//   STP / STP-manual          → bucket 'ceps_stp' (su evidencia es un CEP por definición)
//   transferencia bancaria    → 'ceps_stp' si es CEP, si no 'evidencias_efectivo'
//   efectivo / cheque / demás → 'evidencias_efectivo'

function CargarEvidenciaModal({ row, onClose }: {
  row: PagoRow | null;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [esValido, setEsValido] = useState(false);
  const [esCep, setEsCep] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // STP y STP-manual siempre van a ceps_stp; solo transferencia bancaria decide con el check.
  const cepForzado = metodoEsCepForzado(row?.id_metodos_pago, row?.metodo_nombre);
  const cepOpcional = !cepForzado && metodoAdmiteCep(row?.id_metodos_pago, row?.metodo_nombre);

  useEffect(() => {
    setFile(null); setDragging(false); setEsValido(false); setEsCep(cepForzado);
  }, [row?.pago_id, cepForzado]);

  const bucket = resolveBucketEvidencia({
    idMetodoPago: row?.id_metodos_pago,
    nombreMetodo: row?.metodo_nombre,
    esCep,
  });
  const columna: "url_cep" | "url_recibo" = esValido ? "url_cep" : "url_recibo";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecciona un archivo");
      if (!row) throw new Error("No hay pago seleccionado");
      const path = pathEvidencia(row.cuenta_id, row.pago_id, file.name);
      const { error: se } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (se) throw se;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const { error: ue } = await (supabase as any).from("pagos")
        .update({ [columna]: pub.publicUrl }).eq("id", row.pago_id);
      if (ue) throw ue;
      return pub.publicUrl as string;
    },
    onSuccess: (url) => {
      queryClient.setQueryData(["validacion-pagos-all-v2"], (old: { rows: PagoRow[]; readiness: Map<number, boolean> } | undefined) => {
        if (!old || !row) return old;
        return {
          ...old,
          rows: old.rows.map(r =>
            r.pago_id === row.pago_id ? { ...r, [columna]: url } : r
          ),
        };
      });
      if (row) queryClient.invalidateQueries({ queryKey: ["pago-detalle-modal", row.pago_id] });
      toast({ title: "Evidencia cargada" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error al subir evidencia", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => { if (!mutation.isPending) onClose(); };

  return (
    <Dialog open={row !== null} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md w-[95vw] p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <Upload className="size-4 text-muted-foreground" />Cargar evidencia de pago
          </DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 space-y-4">
          {row && (
            <div className="rounded-xl border bg-muted/20 p-3 space-y-0.5">
              <p className="text-[11px] text-muted-foreground">Cuenta: <span className="font-medium text-foreground">{row.cuenta_folio ?? formatCuentaCobranzaId(row.cuenta_id)}</span></p>
              <p className="text-[11px] text-muted-foreground">Monto: <span className="font-medium text-foreground tabular-nums">{fmtCurrency(row.monto)}</span></p>
              <p className="text-[11px] text-muted-foreground">Fecha: <span className="font-medium text-foreground">{fmtDate(row.fecha_pago)}</span></p>
            </div>
          )}

          {/* Dropzone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
            className={cn("relative rounded-lg border-2 border-dashed transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30")}
          >
            <input
              type="file" accept=".pdf,.jpg,.jpeg,.png,.xml"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center gap-1.5 py-7 px-4 text-center pointer-events-none">
              {file ? (
                <>
                  <FileCheck className="size-7 text-primary" />
                  <p className="text-[13px] font-medium text-foreground break-all">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · clic para cambiar</p>
                </>
              ) : (
                <>
                  <UploadCloud className="size-7 text-muted-foreground" />
                  <p className="text-[13px] font-medium text-foreground">Arrastra el archivo aquí</p>
                  <p className="text-[11px] text-muted-foreground">o haz clic para seleccionar · PDF, imagen o XML</p>
                </>
              )}
            </div>
          </div>

          {/* Checks */}
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer rounded-md border border-border px-3 py-2.5 hover:bg-muted/50 transition-colors">
              <input type="checkbox" checked={esValido} onChange={e => setEsValido(e.target.checked)} className="size-4 accent-primary" />
              <span className="text-[13px] font-medium text-foreground">Pago validado</span>
            </label>
            {/* Solo transferencia bancaria decide: STP/STP-manual siempre es CEP y los demás
                métodos nunca lo son. */}
            {cepOpcional && (
              <label className="flex items-center gap-2.5 cursor-pointer rounded-md border border-border px-3 py-2.5 hover:bg-muted/50 transition-colors">
                <input type="checkbox" checked={esCep} onChange={e => setEsCep(e.target.checked)} className="size-4 accent-primary" />
                <span className="text-[13px] font-medium text-foreground">Es CEP</span>
              </label>
            )}
            <p className="text-[11px] text-muted-foreground px-1">
              Se guardará en <span className="font-mono font-medium">{bucket}</span>
              {cepForzado && " (los pagos STP siempre van al bucket de CEPs)"}
            </p>
          </div>
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={mutation.isPending} className="text-[12px] h-8">Cancelar</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !file} className="text-[12px] h-8">
            {mutation.isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}Cargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

// Filtros persistidos en localStorage (sobreviven navegación, F5 y nueva sesión).
const FILTROS_KEY = "validacion-pagos-filtros";
function loadFiltros(): any {
  try { return JSON.parse(localStorage.getItem(FILTROS_KEY) || "{}"); } catch { return {}; }
}

export default function ValidacionPagos() {
  const { canUpdate, canDelete } = usePagePermissions("/admin/validacion-pagos");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { eliminarPago, isDeleting } = useEliminarPago();
  const PF = useMemo(loadFiltros, []);
  const [searchCuenta, setSearchCuenta] = useState<string>(PF.searchCuenta ?? "");
  const [searchCliente, setSearchCliente] = useState<string>(PF.searchCliente ?? "");
  const [searchDepto, setSearchDepto] = useState<string>(PF.searchDepto ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState<string>((PF.searchCuenta ?? "").trim());
  const [debouncedCliente, setDebouncedCliente] = useState<string>((PF.searchCliente ?? "").trim());
  const [debouncedDepto, setDebouncedDepto] = useState<string>((PF.searchDepto ?? "").trim());
  const [filtroProyecto, setFiltroProyecto] = useState<string>(PF.filtroProyecto ?? "todos");
  const [filtroEstados, setFiltroEstados] = useState<Set<string>>(new Set(PF.filtroEstados ?? []));
  const [filtroMetodos, setFiltroMetodos] = useState<Set<number>>(new Set(PF.filtroMetodos ?? []));
  const [searchProyecto, setSearchProyecto] = useState("");
  const [searchMetodo, setSearchMetodo] = useState("");
  const [searchComprobante, setSearchComprobante] = useState("");
  const [filtroTipos, setFiltroTipos] = useState<Set<string>>(new Set(PF.filtroTipos ?? []));
  const [filtroComprobante, setFiltroComprobante] = useState<string>(PF.filtroComprobante ?? "todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [detallePagoId, setDetallePagoId] = useState<number | null>(null);
  const [detallePagoRow, setDetallePagoRow] = useState<PagoRow | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("Comprobante de pago");
  const [editRow, setEditRow] = useState<PagoRow | null>(null);
  const [cargarRow, setCargarRow] = useState<PagoRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<PagoRow | null>(null);
  const [deleteImpacto, setDeleteImpacto] = useState<PagoImpacto | null>(null);

  // Abrir confirmación de borrado + precargar el impacto (qué más se eliminará).
  const openDelete = (row: PagoRow) => {
    setDeleteRow(row);
    setDeleteImpacto(null);
    fetchPagoImpacto(row.pago_id).then(setDeleteImpacto).catch(() => setDeleteImpacto(null));
  };

  const handleConfirmDelete = async (motivo: string) => {
    if (!deleteRow) return;
    try {
      await eliminarPago(deleteRow.pago_id, motivo);
      toast({ title: "Pago eliminado", description: "El pago se marcó como eliminado y dejó de contar en los saldos." });
      setDeleteRow(null);
      setDeleteImpacto(null);
      queryClient.invalidateQueries({ queryKey: ["validacion-pagos-all-v2"] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "No se pudo eliminar", description: err?.message ?? "Error al eliminar el pago." });
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchCuenta.trim()); setCurrentPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchCuenta]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedCliente(searchCliente.trim()); setCurrentPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchCliente]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedDepto(searchDepto.trim()); setCurrentPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchDepto]);

  // Persistir filtros seleccionados (localStorage).
  useEffect(() => {
    localStorage.setItem(FILTROS_KEY, JSON.stringify({
      searchCuenta, searchCliente, searchDepto, filtroProyecto,
      filtroEstados: [...filtroEstados], filtroMetodos: [...filtroMetodos],
      filtroTipos: [...filtroTipos], filtroComprobante,
    }));
  }, [searchCuenta, searchCliente, searchDepto, filtroProyecto, filtroEstados, filtroMetodos, filtroTipos, filtroComprobante]);

  // ── Main query ────────────────────────────────────────────────────────────────

  // La RPC valida permisos por dentro (ERRCODE 42501 → HTTP 403): un 403 no se reintenta
  // y se muestra como "sin permiso". Sin gate previo con usePermissions: su `canView` es
  // asíncrono (devuelve Promise) y muta estado en cada llamada, así que en el render
  // rompía la pantalla y encadenaba re-renders.
  const { data: queryData, isLoading, isError, error: queryError } = useQuery({
    queryKey: ["validacion-pagos-all-v2"],
    retry: retrySalvoSinPermiso,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<{ rows: PagoRow[]; readiness: Map<number, boolean> }> => {
      // RPC propia de esta pantalla: `get_pcobranza_validacion_pagos`. Devuelve el pago
      // con su contexto ya resuelto (misma regla que CC y RP, ver
      // Ejecuciones_manuales/portal-cobranza/90_contrato_canonico_pagos.md).
      //
      // Paginado por keyset sobre `pago_id` (llave única): sin duplicados ni huecos y sin
      // depender de un count. El esquema anterior (count:'exact' + N `.range()` en paralelo
      // ordenados por `fecha_pago`, que no es única) perdía filas en los empates de fecha y
      // truncaba todo a 1000 pagos si el count fallaba.
      const fetchAllPagos = async (): Promise<any[]> => {
        const out: any[] = [];
        let afterId: number | null = null;
        for (;;) {
          const { data, error } = await (supabase as any).rpc('get_pcobranza_validacion_pagos', {
            p_after_id: afterId,
            p_limit: CHUNK,
          });
          if (error) throw error;
          const page: any[] = (data?.pagos ?? []) as any[];
          if (page.length === 0) return out;
          out.push(...page);
          afterId = page[page.length - 1].pago_id as number;
        }
      };

      const pagosRaw = await fetchAllPagos();
      if (!pagosRaw.length) return { rows: [], readiness: new Map<number, boolean>() };

      pagosRaw.sort((a, b) =>
        String(b.fecha_pago ?? "").localeCompare(String(a.fecha_pago ?? "")) || (b.pago_id - a.pago_id));

      const rows: PagoRow[] = pagosRaw.map(p => ({
        pago_id: p.pago_id as number,
        cuenta_id: p.cuenta_id as number,
        cuenta_folio: (p.cuenta_folio as string) ?? null,
        proyecto: (p.proyecto as string) ?? "-",
        numero_propiedad: (p.numero_propiedad as string) ?? null,
        cliente: (p.cliente_nombre as string) ?? "Sin comprador",
        monto: safeNum(p.monto),
        fecha_pago: p.fecha_pago as string,
        id_metodos_pago: p.id_metodos_pago as number,
        metodo_nombre: (p.metodo_pago as string) ?? "-",
        clave_rastreo: (p.clave_rastreo as string) ?? null,
        url_cep: (p.url_cep as string) ?? null,
        url_recibo: (p.url_recibo as string) ?? null,
        descripcion: (p.descripcion as string) ?? null,
        validacion_documental_efectivo: !!p.validacion_documental_efectivo,
        estado_validacion: (p.estado_validacion ?? null) as PagoRow["estado_validacion"],
        motivo: (p.validacion_motivo as string) ?? null,
        monto_esperado: p.monto_esperado != null ? safeNum(p.monto_esperado) : null,
        monto_real: p.monto_real != null ? safeNum(p.monto_real) : null,
        // Categoría canónica (la misma de CC y RP). `tipo_nombre` queda como etiqueta
        // legible: nombre del producto cuando existe.
        tipo_categoria: (p.tipo_categoria as PagoRow["tipo_categoria"]) ?? "Propiedad",
        tipo_nombre: (p.producto_nombre as string) ?? (p.tipo_categoria as string) ?? "Propiedad",
        id_estatus_disponibilidad: (p.id_estatus_disponibilidad as number) ?? null,
        id_propiedad: (p.propiedad_id as number) ?? null,
        estado_pago: (p.estado_pago as PagoRow["estado_pago"]) ?? null,
        monto_aplicado: p.monto_aplicado != null ? safeNum(p.monto_aplicado) : 0,
      }));

      // ── Readiness "lista para escriturar" por unidad (propiedad) ─────────────
      // Una unidad está lista si TODAS sus cuentas (propiedad + bodega/estac/producto)
      // están liquidadas Y todos sus pagos están validados en "coincide"; o como
      // fallback si la propiedad ya tiene estatus escrituración (7).
      // `liquidada` viene de la RPC de Cuentas de Cobranza, así que incluye cuentas SIN
      // pagos (p.ej. bodega no abonada → unidad no lista).
      const VENDIDAS = new Set([5, 7, 8, 9]);
      const propEstatus = new Map<number, number>();
      for (const r of rows) {
        if (r.id_propiedad != null && r.id_estatus_disponibilidad != null) {
          propEstatus.set(r.id_propiedad, r.id_estatus_disponibilidad);
        }
      }
      const vendidasPropIds = [...propEstatus.entries()]
        .filter(([, est]) => VENDIDAS.has(est))
        .map(([pid]) => pid);

      const readiness = new Map<number, boolean>();
      if (vendidasPropIds.length) {
        // "liquidada" sale de la MISMA RPC que alimenta Cuentas de Cobranza, así que el
        // número es idéntico al que ve cobranza. Incluye cuentas sin pagos (p.ej. bodega
        // no abonada → la unidad no está lista).
        // `p_incluir_totales: false` a propósito: esta pantalla solo necesita las filas
        // (propiedad_id + liquidada); pedir totales dispararía el barrido de KPIs del
        // universo, que aquí no se usa.
        const { data: ccData, error: ccError } = await (supabase as any)
          .rpc('get_pcobranza_cuentas_cobranza', {
            p_limit: 5000, p_offset: 0, p_incluir_totales: false,
          });
        // Sin permiso en Cuentas de Cobranza (403) se pierde solo el cálculo de "listas
        // para escriturar"; los pagos que el usuario SÍ puede ver se siguen mostrando.
        if (ccError) {
          if (esSinPermiso(ccError)) return { rows, readiness: new Map<number, boolean>() };
          throw ccError;
        }
        const vendidasSet = new Set(vendidasPropIds);
        // "Lista para escriturar" exige que la unidad NO deba nada, así que se pide
        // `liquidada` Y `saldo_pendiente <= 0.01`. Solo con `liquidada` entrarían las 418
        // cuentas con `precio_final = 0` (mantenimiento en su mayoría), que salen
        // liquidada=true aunque tengan saldo por cobrar.
        const cuentas = ((ccData?.cuentas ?? []) as any[])
          .filter(c => c.propiedad_id != null && vendidasSet.has(Number(c.propiedad_id)))
          .map(c => ({
            cuenta_id: Number(c.cuenta_id),
            propiedad_id: Number(c.propiedad_id),
            liquidada: c.liquidada === true && Number(c.saldo_pendiente ?? 0) <= 0.01,
          }));

        const cuentasByProp = new Map<number, any[]>();
        for (const c of cuentas) {
          const pid = c.propiedad_id as number;
          const arr = cuentasByProp.get(pid);
          if (arr) arr.push(c); else cuentasByProp.set(pid, [c]);
        }

        const valByProp = new Map<number, { total: number; coincide: number }>();
        for (const r of rows) {
          if (r.id_propiedad == null) continue;
          const acc = valByProp.get(r.id_propiedad) ?? { total: 0, coincide: 0 };
          acc.total += 1;
          if (r.estado_validacion === "coincide") acc.coincide += 1;
          valByProp.set(r.id_propiedad, acc);
        }

        for (const pid of vendidasPropIds) {
          // Fallback: estatus escrituración (7) ya marcado en BD
          if (propEstatus.get(pid) === 7) { readiness.set(pid, true); continue; }

          const cuentasProp = cuentasByProp.get(pid) ?? [];
          const liquidada = cuentasProp.length > 0 && cuentasProp.every((c: any) => c.liquidada === true);
          const val = valByProp.get(pid);
          const todosCoincide = !!val && val.total > 0 && val.coincide === val.total;

          readiness.set(pid, liquidada && todosCoincide);
        }
      }

      return { rows, readiness };
    },
  });

  // 403 de la RPC: se distingue de una falla de carga para no mandar a reintentar.
  const sinPermisoValidacion = esSinPermiso(queryError);

  const allRows = queryData?.rows ?? [];
  const readiness = queryData?.readiness ?? new Map<number, boolean>();

  // ── Derived state ─────────────────────────────────────────────────────────────

  // Rows filtered by everything EXCEPT estado — base para las cards y para filteredRows.
  // Las cards reflejan proyecto/cliente/depto/método/tipo/comprobante, pero siguen mostrando
  // el desglose por estado (no se auto-filtran por el filtro de estado seleccionado).
  const rowsExceptEstado = useMemo(() => {
    let rows = allRows;
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      rows = rows.filter(r =>
        String(r.pago_id).includes(s) ||
        String(r.cuenta_id).includes(s) ||
        (r.clave_rastreo ?? "").toLowerCase().includes(s)
      );
    }
    if (debouncedCliente) {
      const s = debouncedCliente.toLowerCase();
      rows = rows.filter(r => r.cliente.toLowerCase().includes(s));
    }
    if (debouncedDepto) {
      const s = debouncedDepto.trim().toLowerCase();
      rows = rows.filter(r => (r.numero_propiedad ?? "").toLowerCase() === s);
    }
    if (filtroProyecto !== "todos") rows = rows.filter(r => r.proyecto === filtroProyecto);
    if (filtroMetodos.size > 0) rows = rows.filter(r => filtroMetodos.has(r.id_metodos_pago));
    if (filtroTipos.size > 0) rows = rows.filter(r => filtroTipos.has(r.tipo_categoria));
    if (filtroComprobante === "con_cep") rows = rows.filter(r => r.url_cep !== null);
    if (filtroComprobante === "sin_cep") rows = rows.filter(r => r.url_cep === null);
    if (filtroComprobante === "sin_cep_con_recibo") rows = rows.filter(r => r.url_cep === null && r.url_recibo !== null);
    return rows;
  }, [allRows, debouncedSearch, debouncedCliente, debouncedDepto, filtroProyecto, filtroMetodos, filtroTipos, filtroComprobante]);

  const stats = useMemo(() => ({
    total: rowsExceptEstado.length,
    coincide: rowsExceptEstado.filter(r => r.estado_validacion === "coincide").length,
    error: rowsExceptEstado.filter(r => r.estado_validacion === "error").length,
    noCoincide: rowsExceptEstado.filter(r => r.estado_validacion === "no_coincide").length,
    sinEvidencia: rowsExceptEstado.filter(r => r.estado_validacion === "sin_evidencia").length,
    montoIlegible: rowsExceptEstado.filter(r => r.estado_validacion === "monto_ilegible").length,
    montoAusente: rowsExceptEstado.filter(r => r.estado_validacion === "monto_ausente_db").length,
    sinValidar: rowsExceptEstado.filter(r => r.estado_validacion === null).length,
  }), [rowsExceptEstado]);

  const proyectosOptions = useMemo(() =>
    [...new Set(allRows.map(r => r.proyecto).filter(p => p !== "-"))].sort(),
    [allRows]
  );

  const metodosOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of allRows) map.set(r.id_metodos_pago, r.metodo_nombre);
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([id, nombre]) => ({ id, nombre }));
  }, [allRows]);

  // Categories derived from product names — project filter narrows which appear
  // Solo las categorías presentes, en el orden canónico de TIPO_CATEGORIAS.
  const tiposOptions = useMemo(() => {
    const presentes = new Set(allRows.map(r => r.tipo_categoria));
    return TIPO_CATEGORIAS.filter(c => presentes.has(c)) as unknown as string[];
  }, [allRows]);

  const filteredRows = useMemo(() => {
    if (filtroEstados.size === 0) return rowsExceptEstado;
    return rowsExceptEstado.filter(r => filtroEstados.has(r.estado_validacion ?? "sin_validar"));
  }, [rowsExceptEstado, filtroEstados]);

  // Clave de unidad: proyecto + número de propiedad; filas sin unidad caen a su cuenta.
  const unidadKey = (r: PagoRow) =>
    r.id_propiedad != null ? `p:${r.id_propiedad}`
      : r.numero_propiedad ? `${r.proyecto}||${r.numero_propiedad}`
      : `cc:${r.cuenta_id}`;
  const countUnidades = (rows: PagoRow[], pred: (r: PagoRow) => boolean) => {
    const set = new Set<string>();
    for (const r of rows) if (pred(r)) set.add(unidadKey(r));
    return set.size;
  };

  // "A revisar", "vendidas" y "listas para escriturar" solo dependen del filtro de proyecto.
  const ESTATUS_VENDIDAS = new Set([5, 7, 8, 9]); // Vendido, Escrituración, Entregada, Pagada
  const rowsByProyecto = useMemo(
    () => filtroProyecto === "todos" ? allRows : allRows.filter(r => r.proyecto === filtroProyecto),
    [allRows, filtroProyecto]
  );
  const vendidasTotal = useMemo(
    () => countUnidades(rowsByProyecto, r => r.id_estatus_disponibilidad != null && ESTATUS_VENDIDAS.has(r.id_estatus_disponibilidad)),
    [rowsByProyecto]
  );
  // Listas = unidades vendidas cuya readiness (todas las cuentas liquidadas + todos los
  // pagos "coincide", o fallback estatus 7) es true. A revisar = vendidas que aún no lo están.
  const listasEscriturar = useMemo(
    () => countUnidades(rowsByProyecto, r => r.id_propiedad != null && readiness.get(r.id_propiedad) === true),
    [rowsByProyecto, readiness]
  );
  const unidadesARevisar = Math.max(0, vendidasTotal - listasEscriturar);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRows, page]);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Validación de Pagos</h1>
        <p className="text-muted-foreground mt-1">Revisión y validación documental de todos los pagos registrados.</p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        <Card className="grow basis-[calc(25%-0.75rem)] min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileSearch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : stats.total.toLocaleString("es-MX")}
            </div>
          </CardContent>
        </Card>
        <Card className={cn("grow basis-[calc(25%-0.75rem)] min-w-[200px]", !isLoading && stats.coincide > 0 && "border-emerald-200 bg-emerald-50/40")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", !isLoading && stats.coincide > 0 ? "text-emerald-700" : "text-muted-foreground")}>Coincide</CardTitle>
            <CheckCircle2 className={cn("h-4 w-4", !isLoading && stats.coincide > 0 ? "text-emerald-600" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold tabular-nums", !isLoading && stats.coincide > 0 ? "text-emerald-700" : "text-muted-foreground")}>
              {isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : stats.coincide.toLocaleString("es-MX")}
            </div>
          </CardContent>
        </Card>
        <Card className={cn("grow basis-[calc(25%-0.75rem)] min-w-[200px]", !isLoading && stats.error > 0 && "border-red-200 bg-red-50/40")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", !isLoading && stats.error > 0 ? "text-red-700" : "text-muted-foreground")}>Error</CardTitle>
            <AlertCircle className={cn("h-4 w-4", !isLoading && stats.error > 0 ? "text-red-600" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold tabular-nums", !isLoading && stats.error > 0 ? "text-red-700" : "text-muted-foreground")}>
              {isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : stats.error.toLocaleString("es-MX")}
            </div>
          </CardContent>
        </Card>
        <Card className={cn("grow basis-[calc(25%-0.75rem)] min-w-[200px]", !isLoading && stats.noCoincide > 0 && "border-amber-200 bg-amber-50/40")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", !isLoading && stats.noCoincide > 0 ? "text-amber-700" : "text-muted-foreground")}>No coincide</CardTitle>
            <XCircle className={cn("h-4 w-4", !isLoading && stats.noCoincide > 0 ? "text-amber-600" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold tabular-nums", !isLoading && stats.noCoincide > 0 ? "text-amber-700" : "text-muted-foreground")}>
              {isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : stats.noCoincide.toLocaleString("es-MX")}
            </div>
          </CardContent>
        </Card>
        <Card className={cn("grow basis-[calc(25%-0.75rem)] min-w-[200px]", !isLoading && stats.sinEvidencia > 0 && "border-slate-200 bg-slate-50/60")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", !isLoading && stats.sinEvidencia > 0 ? "text-slate-700" : "text-muted-foreground")}>Sin evidencia</CardTitle>
            <AlertCircle className={cn("h-4 w-4", !isLoading && stats.sinEvidencia > 0 ? "text-slate-600" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold tabular-nums", !isLoading && stats.sinEvidencia > 0 ? "text-slate-700" : "text-muted-foreground")}>
              {isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : stats.sinEvidencia.toLocaleString("es-MX")}
            </div>
          </CardContent>
        </Card>
        <Card className={cn("grow basis-[calc(25%-0.75rem)] min-w-[200px]", !isLoading && stats.montoIlegible > 0 && "border-amber-200 bg-amber-50/40")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", !isLoading && stats.montoIlegible > 0 ? "text-amber-700" : "text-muted-foreground")}>Monto ilegible</CardTitle>
            <XCircle className={cn("h-4 w-4", !isLoading && stats.montoIlegible > 0 ? "text-amber-600" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold tabular-nums", !isLoading && stats.montoIlegible > 0 ? "text-amber-700" : "text-muted-foreground")}>
              {isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : stats.montoIlegible.toLocaleString("es-MX")}
            </div>
          </CardContent>
        </Card>
        <Card className={cn("grow basis-[calc(25%-0.75rem)] min-w-[200px]", !isLoading && stats.montoAusente > 0 && "border-orange-200 bg-orange-50/40")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", !isLoading && stats.montoAusente > 0 ? "text-orange-700" : "text-muted-foreground")}>Monto ausente</CardTitle>
            <XCircle className={cn("h-4 w-4", !isLoading && stats.montoAusente > 0 ? "text-orange-600" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold tabular-nums", !isLoading && stats.montoAusente > 0 ? "text-orange-700" : "text-muted-foreground")}>
              {isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : stats.montoAusente.toLocaleString("es-MX")}
            </div>
          </CardContent>
        </Card>
        <Card className="grow basis-[calc(25%-0.75rem)] min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sin validar</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-muted-foreground">
              {isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : stats.sinValidar.toLocaleString("es-MX")}
            </div>
          </CardContent>
        </Card>
        <Card className="grow basis-[calc(25%-0.75rem)] min-w-[200px] border-sky-200 bg-sky-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-sky-700">A revisar</CardTitle>
            <Building2 className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-sky-700">
              {isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : (
                <>{unidadesARevisar.toLocaleString("es-MX")}<span className="text-base font-medium text-sky-700/50">/{vendidasTotal.toLocaleString("es-MX")}</span></>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">por revisar / vendidas</p>
          </CardContent>
        </Card>
        <Card className="grow basis-[calc(25%-0.75rem)] min-w-[200px] border-indigo-200 bg-indigo-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-700">Listas escriturar</CardTitle>
            <FileText className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-indigo-700">
              {isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : (
                <>{listasEscriturar.toLocaleString("es-MX")}<span className="text-base font-medium text-indigo-700/50">/{vendidasTotal.toLocaleString("es-MX")}</span></>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">escrituración / vendidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-x-4 gap-y-4 items-end">

        {/* Buscar por pago */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Buscar por pago</span>
          <Input
            placeholder="CC-123456 o clave rastreo"
            value={searchCuenta}
            onChange={e => setSearchCuenta(e.target.value)}
            className="h-9 text-sm w-[210px] sm:w-[230px]"
          />
        </div>

        {/* Cliente */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Cliente</span>
          <Input
            placeholder="María García"
            value={searchCliente}
            onChange={e => setSearchCliente(e.target.value)}
            className="h-9 text-sm w-[160px] sm:w-[180px]"
          />
        </div>

        {/* Departamento */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Departamento</span>
          <Input
            placeholder="101"
            value={searchDepto}
            onChange={e => setSearchDepto(e.target.value)}
            className="h-9 text-sm w-[110px] sm:w-[120px]"
          />
        </div>

        <div className="w-px h-9 bg-border hidden sm:block self-end" />

        {/* Proyecto — searchable popover */}
        {(() => {
          const filtrados = proyectosOptions.filter(p =>
            p.toLowerCase().includes(searchProyecto.toLowerCase())
          );
          const label = filtroProyecto === "todos" ? "Todos" : filtroProyecto;
          const isActive = filtroProyecto !== "todos";
          return (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground px-0.5">Proyecto</span>
              <Popover onOpenChange={open => { if (!open) setSearchProyecto(""); }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-9 text-sm gap-1.5 font-normal w-[180px] justify-between", isActive && "border-primary/40 bg-primary/5")}
                  >
                    <span className="truncate">{label}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[180px] p-2" align="start">
                  <Input
                    placeholder="Buscar proyecto..."
                    value={searchProyecto}
                    onChange={e => setSearchProyecto(e.target.value)}
                    className="h-8 text-sm mb-2 w-full"
                  />
                  <div className="max-h-[168px] overflow-y-auto overflow-x-hidden"><div className="flex flex-col gap-0.5">
                    <button
                      className={cn("text-left rounded px-2 py-1.5 text-sm hover:bg-muted w-full", filtroProyecto === "todos" && "bg-muted font-medium")}
                      onClick={() => { setFiltroProyecto("todos"); setCurrentPage(1); }}
                    >
                      Todos los proyectos
                    </button>
                    {filtrados.map(p => (
                      <button
                        key={p}
                        className={cn("text-left rounded px-2 py-1.5 text-sm hover:bg-muted w-full truncate", filtroProyecto === p && "bg-muted font-medium")}
                        onClick={() => { setFiltroProyecto(p); setCurrentPage(1); }}
                      >
                        {p}
                      </button>
                    ))}
                    {filtrados.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-2">Sin resultados</p>
                    )}
                  </div></div>
                </PopoverContent>
              </Popover>
            </div>
          );
        })()}

        {/* Tipo de unidad — multi-select (sin cambios) */}
        {(() => {
          const noneSelected = filtroTipos.size === 0;
          const label = noneSelected
            ? "Todos"
            : filtroTipos.size === 1
              ? [...filtroTipos][0]
              : `${filtroTipos.size} tipos`;
          const toggle = (key: string) => {
            setFiltroTipos(prev => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key); else next.add(key);
              return next;
            });
            setCurrentPage(1);
          };
          return (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground px-0.5">Tipo de unidad</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-9 text-sm gap-1.5 font-normal w-[140px] justify-between", !noneSelected && "border-primary/40 bg-primary/5")}
                  >
                    <span className="truncate">{label}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">Tipo de unidad</p>
                  <div className="max-h-[168px] overflow-y-auto overflow-x-hidden"><div className="flex flex-col gap-0.5">
                    {tiposOptions.map(t => (
                      <label key={t} className="flex items-center gap-2 rounded px-1.5 py-1.5 hover:bg-muted cursor-pointer select-none">
                        <Checkbox checked={filtroTipos.has(t)} onCheckedChange={() => toggle(t)} className="size-4" />
                        <span className="text-sm">{t}</span>
                      </label>
                    ))}
                  </div></div>
                  {!noneSelected && (
                    <button
                      className="mt-1.5 w-full text-[11px] text-muted-foreground hover:text-foreground text-left px-1.5 py-0.5"
                      onClick={() => { setFiltroTipos(new Set()); setCurrentPage(1); }}
                    >
                      Limpiar filtro
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          );
        })()}

        {/* Estado de validación — multi-select (sin cambios) */}
        {(() => {
          const ESTADOS = [
            { key: "coincide",         label: "Coincide",      cls: "text-emerald-700" },
            { key: "error",            label: "Error",         cls: "text-red-700" },
            { key: "no_coincide",      label: "No coincide",   cls: "text-amber-700" },
            { key: "sin_evidencia",    label: "Sin evidencia", cls: "text-slate-600" },
            { key: "monto_ilegible",   label: "Monto ilegible", cls: "text-amber-700" },
            { key: "monto_ausente_db", label: "Monto ausente", cls: "text-orange-700" },
            { key: "sin_validar",      label: "Sin validar",   cls: "text-muted-foreground" },
          ];
          const noneSelected = filtroEstados.size === 0;
          const label = noneSelected
            ? "Todos"
            : filtroEstados.size === 1
              ? ESTADOS.find(e => filtroEstados.has(e.key))?.label ?? "Estado"
              : `${filtroEstados.size} estados`;
          const toggle = (key: string) => {
            setFiltroEstados(prev => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key); else next.add(key);
              return next;
            });
            setCurrentPage(1);
          };
          return (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground px-0.5">Estado</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-9 text-sm gap-1.5 font-normal w-[140px] justify-between", !noneSelected && "border-primary/40 bg-primary/5")}
                  >
                    <span className="truncate">{label}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">Estado validacion</p>
                  {ESTADOS.map(e => (
                    <label key={e.key} className="flex items-center gap-2 rounded px-1.5 py-1.5 hover:bg-muted cursor-pointer select-none">
                      <Checkbox checked={filtroEstados.has(e.key)} onCheckedChange={() => toggle(e.key)} className="size-4" />
                      <span className={cn("text-sm", e.cls)}>{e.label}</span>
                    </label>
                  ))}
                  {!noneSelected && (
                    <button
                      className="mt-1.5 w-full text-[11px] text-muted-foreground hover:text-foreground text-left px-1.5 py-0.5"
                      onClick={() => { setFiltroEstados(new Set()); setCurrentPage(1); }}
                    >
                      Limpiar filtro
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          );
        })()}

        {/* Método de pago — multi-select con búsqueda */}
        {(() => {
          const filtrados = metodosOptions.filter(m =>
            m.nombre.toLowerCase().includes(searchMetodo.toLowerCase())
          );
          const noneSelected = filtroMetodos.size === 0;
          const label = noneSelected
            ? "Todos"
            : filtroMetodos.size === 1
              ? metodosOptions.find(m => filtroMetodos.has(m.id))?.nombre ?? "Método"
              : `${filtroMetodos.size} métodos`;
          const toggle = (id: number) => {
            setFiltroMetodos(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
            setCurrentPage(1);
          };
          return (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground px-0.5">Metodo de pago</span>
              <Popover onOpenChange={open => { if (!open) setSearchMetodo(""); }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-9 text-sm gap-1.5 font-normal w-[180px] justify-between", !noneSelected && "border-primary/40 bg-primary/5")}
                  >
                    <span className="truncate">{label}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[180px] p-2" align="start">
                  <Input
                    placeholder="Buscar metodo..."
                    value={searchMetodo}
                    onChange={e => setSearchMetodo(e.target.value)}
                    className="h-8 text-sm mb-2 w-full"
                  />
                  <div className="max-h-[168px] overflow-y-auto overflow-x-hidden"><div className="flex flex-col gap-0.5">
                    {filtrados.map(m => (
                      <label key={m.id} className="flex items-center gap-2 rounded px-1.5 py-1.5 hover:bg-muted cursor-pointer select-none">
                        <Checkbox checked={filtroMetodos.has(m.id)} onCheckedChange={() => toggle(m.id)} className="size-4" />
                        <span className="text-sm truncate">{m.nombre}</span>
                      </label>
                    ))}
                    {filtrados.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-2">Sin resultados</p>
                    )}
                  </div></div>
                  {!noneSelected && (
                    <button
                      className="mt-1.5 w-full text-[11px] text-muted-foreground hover:text-foreground text-left px-1.5 py-0.5"
                      onClick={() => { setFiltroMetodos(new Set()); setCurrentPage(1); }}
                    >
                      Limpiar filtro
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          );
        })()}

        {/* Comprobante — searchable popover */}
        {(() => {
          const comprobanteOpts = [
            { value: "con_cep", label: "Con CEP" },
            { value: "sin_cep", label: "Sin CEP" },
            { value: "sin_cep_con_recibo", label: "Sin CEP + con recibo" },
          ];
          const filtrados = comprobanteOpts.filter(o =>
            o.label.toLowerCase().includes(searchComprobante.toLowerCase())
          );
          const activo = comprobanteOpts.find(o => o.value === filtroComprobante);
          const label = activo ? activo.label : "Todos";
          const isActive = filtroComprobante !== "todos";
          return (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground px-0.5">Comprobante</span>
              <Popover onOpenChange={open => { if (!open) setSearchComprobante(""); }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-9 text-sm gap-1.5 font-normal w-[180px] justify-between", isActive && "border-primary/40 bg-primary/5")}
                  >
                    <span className="truncate">{label}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[180px] p-2" align="start">
                  <Input
                    placeholder="Buscar..."
                    value={searchComprobante}
                    onChange={e => setSearchComprobante(e.target.value)}
                    className="h-8 text-sm mb-2 w-full"
                  />
                  <div className="max-h-[168px] overflow-y-auto overflow-x-hidden"><div className="flex flex-col gap-0.5">
                    <button
                      className={cn("text-left rounded px-2 py-1.5 text-sm hover:bg-muted w-full", filtroComprobante === "todos" && "bg-muted font-medium")}
                      onClick={() => { setFiltroComprobante("todos"); setCurrentPage(1); }}
                    >
                      Todos
                    </button>
                    {filtrados.map(o => (
                      <button
                        key={o.value}
                        className={cn("text-left rounded px-2 py-1.5 text-sm hover:bg-muted w-full truncate", filtroComprobante === o.value && "bg-muted font-medium")}
                        onClick={() => { setFiltroComprobante(o.value); setCurrentPage(1); }}
                      >
                        {o.label}
                      </button>
                    ))}
                    {filtrados.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-2">Sin resultados</p>
                    )}
                  </div></div>
                </PopoverContent>
              </Popover>
            </div>
          );
        })()}

        {/* Limpiar filtros */}
        {(() => {
          const hayFiltros =
            searchCuenta !== "" || searchCliente !== "" || searchDepto !== "" ||
            filtroProyecto !== "todos" || filtroMetodos.size > 0 || filtroComprobante !== "todos" ||
            filtroEstados.size > 0 || filtroTipos.size > 0;
          return (
            <div className="flex flex-col gap-1.5 self-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchCuenta(""); setSearchCliente(""); setSearchDepto("");
                  setFiltroProyecto("todos"); setFiltroMetodos(new Set()); setFiltroComprobante("todos");
                  setFiltroEstados(new Set()); setFiltroTipos(new Set());
                  setCurrentPage(1);
                }}
                className={cn(
                  "h-9 text-sm px-3 transition-colors",
                  hayFiltros
                    ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400"
                    : "border-border text-muted-foreground/40 pointer-events-none"
                )}
              >
                Limpiar filtros
              </Button>
            </div>
          );
        })()}

      </div>

      {/* Counter */}
      <p className="text-sm text-muted-foreground tabular-nums">
        {isLoading
          ? "Cargando pagos..."
          : filteredRows.length !== stats.total
            ? `${filteredRows.length.toLocaleString("es-MX")} de ${stats.total.toLocaleString("es-MX")} pagos - Pag. ${page}/${totalPages}`
            : `${stats.total.toLocaleString("es-MX")} pagos - Pag. ${page}/${totalPages}`
        }
      </p>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[110px]">Cuenta</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proyecto</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Tipo</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Método</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Unidad</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Cliente</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Clave rastreo</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell whitespace-nowrap">Fecha pago</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right hidden sm:table-cell">Monto</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center hidden sm:table-cell">Estado</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[140px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="size-5 animate-spin" />
                      <span className="text-sm">Cargando pagos y validaciones...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sinPermisoValidacion ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-sm text-muted-foreground">
                    No tienes permiso para ver la validación de pagos. Si lo necesitas, pídelo
                    al administrador del sistema.
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-sm text-destructive">Error al cargar datos.</TableCell>
                </TableRow>
              ) : paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-sm text-muted-foreground">
                    {allRows.length === 0 ? "No hay pagos registrados." : "Sin resultados con los filtros actuales."}
                  </TableCell>
                </TableRow>
              ) : paginatedRows.map(row => {
                const hasCep = row.url_cep !== null;
                const hasRecibo = row.url_recibo !== null;
                return (
                  <TableRow key={row.pago_id} className="hover:bg-muted/30 text-sm">
                    <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {row.cuenta_folio ?? formatCuentaCobranzaId(row.cuenta_id)}
                    </TableCell>
                    <TableCell><div className="font-medium text-foreground">{row.proyecto}</div></TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn("text-[10px] whitespace-nowrap", tipoBadgeClass(row.tipo_categoria))}>
                        {row.tipo_nombre}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell whitespace-nowrap text-muted-foreground text-[12px]">
                      {row.metodo_nombre}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground whitespace-nowrap">{row.numero_propiedad ?? "-"}</TableCell>
                    <TableCell className="hidden xl:table-cell max-w-[180px] truncate text-foreground">{row.cliente}</TableCell>
                    <TableCell className="hidden xl:table-cell max-w-[140px] truncate font-mono text-[10px] text-muted-foreground" title={row.clave_rastreo ?? undefined}>
                      {row.clave_rastreo ?? <span className="text-muted-foreground/30 not-italic text-[10px]">Sin datos</span>}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
                      {row.fecha_pago ? new Date(row.fecha_pago).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums text-[12px] font-medium whitespace-nowrap">
                      {fmtCurrency(row.monto)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-center">
                      <EstadoBadge estado={row.estado_validacion} />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {hasCep ? (
                          <button
                            onClick={() => { setViewerUrl(row.url_cep); setViewerTitle("CEP — Comprobante electrónico de pago"); }}
                            title="Ver CEP"
                            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <FileText className="size-4" />
                          </button>
                        ) : hasRecibo ? (
                          <button
                            onClick={() => { setViewerUrl(row.url_recibo); setViewerTitle("Recibo de pago"); }}
                            title="Ver recibo (sin CEP)"
                            className="inline-flex items-center justify-center size-8 rounded-md text-amber-500 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                          >
                            <FileUp className="size-4" />
                          </button>
                        ) : (
                          <span title="Sin comprobante" className="inline-flex items-center justify-center size-8 text-muted-foreground/25 cursor-default">
                            <FileText className="size-4" />
                          </span>
                        )}
                        <button onClick={() => { setDetallePagoId(row.pago_id); setDetallePagoRow(row); }} title="Ver detalle"
                          className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                          <Eye className="size-4" />
                        </button>
                        {canUpdate && (
                          <button onClick={() => setCargarRow(row)} title="Cargar evidencia / CEP"
                            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <Upload className="size-4" />
                          </button>
                        )}
                        {canUpdate && (
                          <button onClick={() => setEditRow(row)} title="Editar validación"
                            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <Pencil className="size-4" />
                          </button>
                        )}
                        {canDelete && (
                          row.metodo_nombre === "STP" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground/25 cursor-not-allowed">
                                  <Trash2 className="size-4" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Pago STP: no se puede eliminar</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button onClick={() => openDelete(row)}
                                  className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                                  <Trash2 className="size-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Eliminar pago</TooltipContent>
                            </Tooltip>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground tabular-nums shrink-0">
            {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, filteredRows.length)} de {filteredRows.length.toLocaleString("es-MX")}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0">
              <ChevronLeft className="size-4" />
            </Button>
            {pageNumbers.map((p, idx) =>
              p === "..." ? (
                <span key={`e${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
              ) : (
                <Button key={p} variant={p === page ? "default" : "outline"} size="sm"
                  onClick={() => setCurrentPage(p as number)} className="h-8 w-8 p-0 text-sm">
                  {p}
                </Button>
              )
            )}
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 w-8 p-0">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <ComprobanteViewerModal url={viewerUrl} title={viewerTitle} onClose={() => setViewerUrl(null)} />
      <PagoDetalleModal
        pagoId={detallePagoId}
        pagoRow={detallePagoRow}
        onClose={() => { setDetallePagoId(null); setDetallePagoRow(null); }}
      />
      <EditPagoValidacionModal row={editRow} onClose={() => setEditRow(null)} />
      <CargarEvidenciaModal row={cargarRow} onClose={() => setCargarRow(null)} />
      <EliminarPagoDialog
        open={!!deleteRow}
        onOpenChange={(open) => { if (!open) { setDeleteRow(null); setDeleteImpacto(null); } }}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        impacto={deleteImpacto}
        encabezado={deleteRow
          ? `pago de ${fmtCurrency(deleteRow.monto)} de ${deleteRow.cliente} (${deleteRow.cuenta_folio ?? formatCuentaCobranzaId(deleteRow.cuenta_id)})`
          : undefined}
      />
    </div>
  );
}
