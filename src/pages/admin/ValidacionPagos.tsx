import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Eye, FileText, Loader2, Pencil, XCircle, Receipt,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 25;

// ── Types ──────────────────────────────────────────────────────────────────────

interface PagoRow {
  pago_id: number;
  cuenta_id: number;
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
  estado_validacion: "validado" | "pendiente" | "con_observaciones" | null;
  motivo: string | null;
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
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

function fmtCurrency(n: number | null) {
  if (n === null || isNaN(n) || !isFinite(n)) return "-";
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

function EstadoBadge({ estado }: { estado: PagoRow["estado_validacion"] }) {
  if (estado === "validado")
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] gap-1 whitespace-nowrap">
        <CheckCircle2 className="size-3" />Validado
      </Badge>
    );
  if (estado === "pendiente")
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px] gap-1 whitespace-nowrap">
        <Clock className="size-3" />Pendiente
      </Badge>
    );
  if (estado === "con_observaciones")
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[10px] gap-1 whitespace-nowrap">
        <AlertCircle className="size-3" />Con obs.
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-500 text-[10px] gap-1 whitespace-nowrap">
      <Clock className="size-3" />Sin validar
    </Badge>
  );
}

function StatCell({ label, value, valueClass, note }: {
  label: string; value: string; valueClass?: string; note?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-center px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p className={cn("text-[18px] font-bold tabular-nums leading-tight", valueClass)}>{value}</p>
      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );
}

// ── Modal: visor CEP / recibo ──────────────────────────────────────────────────

function CepViewerModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const handleOpenChange = (o: boolean) => { if (!o) { setLoaded(false); onClose(); } };

  return (
    <Dialog open={url !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-[14px]">
              <Receipt className="size-4 text-muted-foreground" />
              Comprobante de pago
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
              title="Comprobante de pago" onLoad={() => setLoaded(true)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal: detalle del pago ────────────────────────────────────────────────────

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

      // Step 1: cuenta cobranza
      const { data: cc } = await supabase
        .from("cuentas_cobranza")
        .select("id, precio_final, clabe_stp, fecha_compra, id_oferta")
        .eq("id", pagoRow.cuenta_id)
        .eq("activo", true)
        .single();
      if (!cc) return null;

      // Step 2: parallel — oferta + compradores + aplicaciones del pago
      const [ofertaRes, compRes, aplicRes] = await Promise.all([
        supabase.from("ofertas").select("id, id_propiedad").eq("id", cc.id_oferta).single(),
        supabase.from("compradores")
          .select("id_persona, porcentaje_copropiedad")
          .eq("id_cuenta_cobranza", pagoRow.cuenta_id)
          .eq("activo", true)
          .order("porcentaje_copropiedad", { ascending: false }),
        supabase.from("aplicaciones_pago")
          .select("id, id_acuerdo_pago, monto, es_multa")
          .eq("id_pago", pagoId)
          .eq("activo", true),
      ]);

      if (!ofertaRes.data) return null;
      const propId = ofertaRes.data.id_propiedad;
      const compData = compRes.data ?? [];
      const aplicData = aplicRes.data ?? [];

      // Step 3: parallel — propiedad + persona del comprador principal + acuerdos del pago
      const primerPersonaId = compData[0]?.id_persona ?? null;
      const acuerdoIds = aplicData.map(a => a.id_acuerdo_pago).filter(Boolean) as number[];

      const [propRes, personaRes, acuerdosRes] = await Promise.all([
        supabase.from("propiedades")
          .select("id, numero_propiedad, id_edificio_modelo")
          .eq("id", propId).single(),
        primerPersonaId
          ? supabase.from("personas").select("nombre_legal").eq("id", primerPersonaId).single()
          : Promise.resolve({ data: null }),
        acuerdoIds.length
          ? supabase.from("acuerdos_pago").select("id, id_concepto").in("id", acuerdoIds)
          : Promise.resolve({ data: [] }),
      ]);

      const prop = propRes.data;
      const clienteNombre = personaRes.data?.nombre_legal ?? "Sin comprador";
      const acuerdoConceptoMap = new Map<number, number>(
        (acuerdosRes.data ?? []).map((a: any) => [a.id, a.id_concepto])
      );

      // Step 4: parallel — edificio_modelo + conceptos
      const conceptoIds = [...new Set([...acuerdoConceptoMap.values()].filter(Boolean))] as number[];
      const [emRes, conceptosRes] = await Promise.all([
        prop?.id_edificio_modelo
          ? supabase.from("edificios_modelos").select("id, id_edificio").eq("id", prop.id_edificio_modelo).single()
          : Promise.resolve({ data: null }),
        conceptoIds.length
          ? supabase.from("conceptos_pago").select("id, nombre").in("id", conceptoIds)
          : Promise.resolve({ data: [] }),
      ]);

      const conceptoMap = new Map<number, string>(
        (conceptosRes.data ?? []).map((c: any) => [c.id, c.nombre])
      );
      const em = emRes.data;

      // Step 5: edificio → proyecto
      const { data: edif } = em?.id_edificio
        ? await supabase.from("edificios").select("id, id_proyecto").eq("id", em.id_edificio).single()
        : { data: null };

      const { data: proy } = edif?.id_proyecto
        ? await supabase.from("proyectos").select("nombre").eq("id", edif.id_proyecto).single()
        : { data: null };

      const aplicaciones: AplicacionDetalle[] = aplicData.map(a => {
        const conceptoId = acuerdoConceptoMap.get(a.id_acuerdo_pago) ?? null;
        return {
          id: a.id,
          monto: safeNum(a.monto),
          concepto: conceptoId ? (conceptoMap.get(conceptoId) ?? "Sin concepto") : "Sin concepto",
          es_multa: a.es_multa ?? false,
        };
      });

      return {
        pago_id: pagoId,
        cuenta_id: pagoRow.cuenta_id,
        monto: pagoRow.monto,
        fecha_pago: pagoRow.fecha_pago,
        metodo_nombre: pagoRow.metodo_nombre,
        id_metodos_pago: pagoRow.id_metodos_pago,
        clave_rastreo: pagoRow.clave_rastreo,
        url_cep: pagoRow.url_cep,
        url_recibo: pagoRow.url_recibo,
        descripcion: pagoRow.descripcion,
        validacion_documental_efectivo: pagoRow.validacion_documental_efectivo,
        precio_final: safeNum(cc.precio_final),
        clabe_stp: cc.clabe_stp ?? null,
        fecha_compra: cc.fecha_compra ?? null,
        proyecto: proy?.nombre ?? pagoRow.proyecto,
        numero_propiedad: prop?.numero_propiedad ?? pagoRow.numero_propiedad,
        cliente: clienteNombre,
        aplicaciones,
      };
    },
  });

  const cepUrl = data?.url_cep ?? data?.url_recibo ?? null;
  const hasCep = !!cepUrl;

  return (
    <Dialog open={pagoId !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-6xl w-[98vw] h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <Receipt className="size-4 text-muted-foreground" />
            Detalle de pago
            {pagoRow && (
              <span className="text-muted-foreground font-normal ml-1">
                — {formatCuentaCobranzaId(pagoRow.cuenta_id)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left: comprobante viewer */}
          <div className="md:w-[55%] shrink-0 border-b md:border-b-0 md:border-r bg-muted/10 relative flex flex-col h-48 md:h-auto">
            {hasCep ? (
              <>
                {!cepLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-muted/10">
                    <Loader2 className="size-7 animate-spin text-muted-foreground" />
                    <p className="text-[12px] text-muted-foreground">Cargando comprobante...</p>
                  </div>
                )}
                <iframe key={cepUrl} src={cepUrl!} className="w-full h-full border-0 flex-1"
                  title="Comprobante de pago" onLoad={() => setCepLoaded(true)} />
                <div className="absolute bottom-3 right-3">
                  <a href={cepUrl!} target="_blank" rel="noreferrer"
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors bg-background/80 px-2 py-1 rounded border">
                    Abrir en pestaña →
                  </a>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/40">
                <Receipt className="size-12" />
                <p className="text-[12px]">Sin comprobante (CEP / recibo)</p>
              </div>
            )}
          </div>

          {/* Right: payment details */}
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

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Pago</p>
                  <div className="space-y-1.5 text-[12px]">
                    {[
                      ["Fecha", fmtDate(data.fecha_pago)],
                      ["Método", data.metodo_nombre],
                      ["Clave rastreo", data.clave_rastreo ?? "-"],
                      ["Descripción", data.descripcion ?? "-"],
                    ].map(([label, val]) => (
                      <div key={label} className="flex items-center justify-between gap-4">
                        <p className="text-muted-foreground shrink-0">{label}</p>
                        <p className="tabular-nums text-right break-all">{val}</p>
                      </div>
                    ))}
                    {data.id_metodos_pago === 1 && (
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-muted-foreground shrink-0">Doc. efectivo</p>
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          data.validacion_documental_efectivo
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        )}>
                          {data.validacion_documental_efectivo ? "Verificado" : "Sin verificar"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Cuenta de cobranza</p>
                  <div className="space-y-1.5 text-[12px]">
                    {[
                      ["Cuenta", formatCuentaCobranzaId(data.cuenta_id)],
                      ["Proyecto", data.proyecto],
                      ["Unidad", data.numero_propiedad ?? "-"],
                      ["Cliente", data.cliente],
                      ["Precio final", fmtCurrency(data.precio_final)],
                      ["CLABE STP", data.clabe_stp ?? "-"],
                      ["Fecha compra", fmtDate(data.fecha_compra)],
                    ].map(([label, val]) => (
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
                      <button
                        onClick={() => setAplicacionesOpen(o => !o)}
                        className="w-full flex items-center justify-between py-1 group"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                          Aplicaciones
                        </p>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {data.aplicaciones.length} concepto{data.aplicaciones.length !== 1 ? "s" : ""}
                        </span>
                      </button>
                      {aplicacionesOpen && (
                        <div className="mt-2 rounded-xl border border-border overflow-hidden">
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
                                    {a.es_multa && (
                                      <Badge variant="outline" className="ml-2 text-[9px] border-red-200 bg-red-50 text-red-700">Multa</Badge>
                                    )}
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

                {pagoRow?.motivo && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Observaciones</p>
                      <p className="text-[12px] text-muted-foreground">{pagoRow.motivo}</p>
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

// ── Modal: editar validación ───────────────────────────────────────────────────

function EditPagoValidacionModal({ row, onClose, hasPagoValidaciones }: {
  row: PagoRow | null;
  onClose: () => void;
  hasPagoValidaciones: boolean;
}) {
  const [estado, setEstado] = useState<"validado" | "pendiente" | "con_observaciones">("pendiente");
  const [motivo, setMotivo] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!row) return;
    setEstado(row.estado_validacion ?? "pendiente");
    setMotivo(row.motivo ?? "");
  }, [row?.pago_id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!row) throw new Error("No hay pago seleccionado");
      const { error } = await (supabase as any)
        .from("pago_validaciones")
        .insert({ id_pago: row.pago_id, estado, motivo: motivo.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["validacion-pagos"] });
      toast({ title: "Validación guardada" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => { if (!mutation.isPending) onClose(); };

  return (
    <Dialog open={row !== null} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md w-[95vw] p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-5 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <Pencil className="size-4 text-muted-foreground" />
            Editar validación
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!hasPagoValidaciones ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
              <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-amber-800">Tabla DDL pendiente</p>
                <p className="text-[11px] text-amber-700">
                  La tabla <code className="font-mono">pago_validaciones</code> no existe.
                  Ejecuta el DDL en <strong>Ejecuciones_manuales/20260622_validacion_pagos.md</strong>.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-muted/20 p-3 space-y-0.5">
                <p className="text-[11px] text-muted-foreground">Cuenta: <span className="font-medium text-foreground">{row ? formatCuentaCobranzaId(row.cuenta_id) : "-"}</span></p>
                <p className="text-[11px] text-muted-foreground">Monto: <span className="font-medium text-foreground tabular-nums">{row ? fmtCurrency(row.monto) : "-"}</span></p>
                <p className="text-[11px] text-muted-foreground">Fecha: <span className="font-medium text-foreground">{row ? fmtDate(row.fecha_pago) : "-"}</span></p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px]">Estado de validación</Label>
                <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)}>
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="validado" className="text-[12px]">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="size-3 text-emerald-600" />Validado
                      </span>
                    </SelectItem>
                    <SelectItem value="pendiente" className="text-[12px]">
                      <span className="flex items-center gap-2">
                        <Clock className="size-3 text-amber-600" />Pendiente
                      </span>
                    </SelectItem>
                    <SelectItem value="con_observaciones" className="text-[12px]">
                      <span className="flex items-center gap-2">
                        <AlertCircle className="size-3 text-red-600" />Con observaciones
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px]">Observaciones <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Textarea
                  placeholder="Notas, discrepancias, motivo de observación..."
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  className="text-[12px] resize-none h-24"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t flex-shrink-0 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={mutation.isPending}
            className="text-[12px] h-8">
            Cancelar
          </Button>
          {hasPagoValidaciones && (
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}
              className="text-[12px] h-8">
              {mutation.isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Guardar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function ValidacionPagos() {
  const { isSuperAdmin } = useAllowedMenus();
  const [searchCuenta, setSearchCuenta] = useState("");
  const [searchCliente, setSearchCliente] = useState("");
  const [filtroProyecto, setFiltroProyecto] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroMetodo, setFiltroMetodo] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [detallePagoId, setDetallePagoId] = useState<number | null>(null);
  const [detallePagoRow, setDetallePagoRow] = useState<PagoRow | null>(null);
  const [cepUrl, setCepUrl] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<PagoRow | null>(null);

  const resetPage = () => setCurrentPage(1);

  const { data: _qd, isLoading, isError } = useQuery({
    queryKey: ["validacion-pagos"],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<{ rows: PagoRow[]; hasPagoValidaciones: boolean }> => {
      // DDL probe
      const probe = await (supabase as any).from("pago_validaciones").select("id").limit(0);
      const hasPagoValidaciones = !probe.error;

      // Step 1: todos los pagos activos
      const { data: pagosData } = await supabase
        .from("pagos")
        .select("id, id_cuenta_cobranza, id_metodos_pago, clave_rastreo, monto, fecha_pago, url_recibo, url_cep, descripcion, validacion_documental_efectivo")
        .eq("activo", true)
        .order("fecha_pago", { ascending: false });

      if (!pagosData?.length) return { rows: [], hasPagoValidaciones };

      const pagoIds = pagosData.map(p => p.id);
      const cuentaIdsSet = [...new Set(pagosData.map(p => p.id_cuenta_cobranza))] as number[];

      // Step 2: parallel — metodos_pago + cuentas_cobranza
      const [metodosRes, cuentasRes] = await Promise.all([
        supabase.from("metodos_pago").select("id, nombre"),
        supabase.from("cuentas_cobranza")
          .select("id, id_oferta")
          .in("id", cuentaIdsSet)
          .eq("activo", true),
      ]);

      const metodosMap = new Map<number, string>((metodosRes.data ?? []).map(m => [m.id, m.nombre]));
      const cuentasData = cuentasRes.data ?? [];
      const cuentaOfertaMap = new Map<number, number>(cuentasData.map(c => [c.id, c.id_oferta]));
      const ofertaIds = [...new Set(cuentasData.map(c => c.id_oferta).filter(Boolean))] as number[];
      const cuentaIds = cuentasData.map(c => c.id);

      // Step 3: parallel — ofertas + compradores (para nombre cliente)
      const [ofertasRes, compradoresRes] = await Promise.all([
        ofertaIds.length
          ? (supabase as any).from("ofertas").select("id, id_propiedad").in("id", ofertaIds).eq("activo", true)
          : Promise.resolve({ data: [] }),
        cuentaIds.length
          ? supabase.from("compradores")
              .select("id_cuenta_cobranza, id_persona, porcentaje_copropiedad")
              .in("id_cuenta_cobranza", cuentaIds)
              .eq("activo", true)
              .order("porcentaje_copropiedad", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      const ofertasData = ofertasRes.data ?? [];
      const ofertaPropMap = new Map<number, number>(ofertasData.map((o: any) => [o.id, o.id_propiedad]));
      const propIds = [...new Set(ofertasData.map((o: any) => o.id_propiedad).filter(Boolean))] as number[];

      // Primer comprador por cuenta (mayor % copropiedad)
      const cuentaPrimerComprador = new Map<number, number>();
      for (const c of (compradoresRes.data ?? [])) {
        if (!cuentaPrimerComprador.has(c.id_cuenta_cobranza)) {
          cuentaPrimerComprador.set(c.id_cuenta_cobranza, c.id_persona);
        }
      }
      const personaIds = [...new Set([...cuentaPrimerComprador.values()])] as number[];

      // Step 4: parallel — propiedades + personas compradores
      const [propiedadesRes, personasRes] = await Promise.all([
        propIds.length
          ? supabase.from("propiedades").select("id, numero_propiedad, id_edificio_modelo").in("id", propIds).eq("activo", true)
          : Promise.resolve({ data: [] }),
        personaIds.length
          ? supabase.from("personas").select("id, nombre_legal").in("id", personaIds)
          : Promise.resolve({ data: [] }),
      ]);

      const propMap = new Map<number, { numero_propiedad: string | null; id_edificio_modelo: number }>(
        (propiedadesRes.data ?? []).map((p: any) => [p.id, { numero_propiedad: p.numero_propiedad, id_edificio_modelo: p.id_edificio_modelo }])
      );
      const personaNombreMap = new Map<number, string>((personasRes.data ?? []).map((p: any) => [p.id, p.nombre_legal]));

      // cuentaId → nombre cliente
      const cuentaClienteMap = new Map<number, string>();
      for (const [cuentaId, personaId] of cuentaPrimerComprador) {
        cuentaClienteMap.set(cuentaId, personaNombreMap.get(personaId) ?? "Sin comprador");
      }

      const emIds = [...new Set((propiedadesRes.data ?? []).map((p: any) => p.id_edificio_modelo).filter(Boolean))] as number[];

      // Step 5: edificios_modelos
      const { data: emData } = emIds.length
        ? await supabase.from("edificios_modelos").select("id, id_edificio").in("id", emIds)
        : { data: [] };

      const emEdifMap = new Map<number, number>((emData ?? []).map((em: any) => [em.id, em.id_edificio]));
      const edificioIds = [...new Set((emData ?? []).map((em: any) => em.id_edificio).filter(Boolean))] as number[];

      // Step 6: edificios
      const { data: edificiosData } = edificioIds.length
        ? await supabase.from("edificios").select("id, id_proyecto").in("id", edificioIds)
        : { data: [] };

      const edifProjMap = new Map<number, number>((edificiosData ?? []).map((e: any) => [e.id, e.id_proyecto]));
      const proyIds = [...new Set((edificiosData ?? []).map((e: any) => e.id_proyecto).filter(Boolean))] as number[];

      // Step 7: proyectos
      const { data: proyectosData } = proyIds.length
        ? await supabase.from("proyectos").select("id, nombre").in("id", proyIds)
        : { data: [] };

      const proyMap = new Map<number, string>((proyectosData ?? []).map((p: any) => [p.id, p.nombre]));

      // Step 8: pago_validaciones (si existe tabla)
      const { data: valData } = hasPagoValidaciones && pagoIds.length
        ? await (supabase as any).from("pago_validaciones")
            .select("id_pago, estado, motivo, fecha_creacion")
            .in("id_pago", pagoIds)
            .order("fecha_creacion", { ascending: false })
        : { data: [] };

      const valByPago = new Map<number, { estado: string; motivo: string | null }>();
      for (const v of valData ?? []) {
        if (!valByPago.has(v.id_pago)) {
          valByPago.set(v.id_pago, { estado: v.estado, motivo: v.motivo ?? null });
        }
      }

      // Build rows
      const rows: PagoRow[] = [];
      for (const pago of pagosData) {
        const ofertaId = cuentaOfertaMap.get(pago.id_cuenta_cobranza);
        const propId = ofertaId != null ? ofertaPropMap.get(ofertaId) : undefined;
        const prop = propId != null ? propMap.get(propId) : undefined;
        const emEdifId = prop ? emEdifMap.get(prop.id_edificio_modelo) : undefined;
        const proyId = emEdifId != null ? edifProjMap.get(emEdifId) : undefined;
        const proyNombre = proyId != null ? (proyMap.get(proyId) ?? "-") : "-";
        const cliente = cuentaClienteMap.get(pago.id_cuenta_cobranza) ?? "Sin comprador";
        const val = valByPago.get(pago.id);

        rows.push({
          pago_id: pago.id,
          cuenta_id: pago.id_cuenta_cobranza,
          proyecto: proyNombre,
          numero_propiedad: prop?.numero_propiedad ?? null,
          cliente,
          monto: safeNum(pago.monto),
          fecha_pago: pago.fecha_pago,
          id_metodos_pago: pago.id_metodos_pago,
          metodo_nombre: metodosMap.get(pago.id_metodos_pago) ?? "-",
          clave_rastreo: pago.clave_rastreo ?? null,
          url_cep: pago.url_cep ?? null,
          url_recibo: pago.url_recibo ?? null,
          descripcion: pago.descripcion ?? null,
          validacion_documental_efectivo: pago.validacion_documental_efectivo ?? false,
          estado_validacion: val ? (val.estado as PagoRow["estado_validacion"]) : null,
          motivo: val?.motivo ?? null,
        });
      }

      return { rows, hasPagoValidaciones };
    },
  });

  const rows = _qd?.rows ?? [];
  const hasPagoValidaciones = _qd?.hasPagoValidaciones ?? false;

  const proyectosUnicos = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.proyecto !== "-") set.add(r.proyecto);
    return [...set].sort();
  }, [rows]);

  const metodosUnicos = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) map.set(r.id_metodos_pago, r.metodo_nombre);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);

  const stats = useMemo(() => ({
    total: rows.length,
    validados: rows.filter(r => r.estado_validacion === "validado").length,
    pendientes: rows.filter(r => r.estado_validacion === "pendiente").length,
    conObservaciones: rows.filter(r => r.estado_validacion === "con_observaciones").length,
    sinValidar: rows.filter(r => r.estado_validacion === null).length,
  }), [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    const sc = searchCuenta.trim().toLowerCase();
    const scl = searchCliente.trim().toLowerCase();
    if (sc) out = out.filter(r =>
      String(r.pago_id).includes(sc) ||
      String(r.cuenta_id).includes(sc) ||
      (r.clave_rastreo?.toLowerCase().includes(sc) ?? false)
    );
    if (scl) out = out.filter(r => r.cliente.toLowerCase().includes(scl));
    if (filtroProyecto !== "todos") out = out.filter(r => r.proyecto === filtroProyecto);
    if (filtroEstado !== "todos") {
      if (filtroEstado === "sin_validar") out = out.filter(r => r.estado_validacion === null);
      else out = out.filter(r => r.estado_validacion === filtroEstado);
    }
    if (filtroMetodo !== "todos") out = out.filter(r => String(r.id_metodos_pago) === filtroMetodo);
    return out;
  }, [rows, searchCuenta, searchCliente, filtroProyecto, filtroEstado, filtroMetodo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-[20px] font-semibold">Validación de Pagos</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Revisión y validación documental de todos los pagos registrados.
        </p>
      </div>

      {!hasPagoValidaciones && !isLoading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[12px] font-medium text-amber-800">Tabla de validaciones pendiente</p>
            <p className="text-[11px] text-amber-700">
              Ejecuta el DDL en <strong>Ejecuciones_manuales/20260622_validacion_pagos.md</strong> para habilitar la edición de estados.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-wrap divide-x">
            <StatCell label="Total pagos" value={String(stats.total)} />
            <StatCell label="Validados" value={String(stats.validados)} valueClass="text-emerald-600" />
            <StatCell label="Pendientes" value={String(stats.pendientes)} valueClass="text-amber-600" />
            <StatCell label="Con obs." value={String(stats.conObservaciones)} valueClass="text-red-600" />
            <StatCell label="Sin validar" value={String(stats.sinValidar)} valueClass="text-zinc-500" />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="ID pago / cuenta / clave rastreo..."
          value={searchCuenta}
          onChange={e => { setSearchCuenta(e.target.value); resetPage(); }}
          className="h-8 text-[12px] w-56"
        />
        <Input
          placeholder="Buscar por cliente..."
          value={searchCliente}
          onChange={e => { setSearchCliente(e.target.value); resetPage(); }}
          className="h-8 text-[12px] w-48"
        />
        <Select value={filtroProyecto} onValueChange={v => { setFiltroProyecto(v); resetPage(); }}>
          <SelectTrigger className="h-8 text-[12px] w-44">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" className="text-[12px]">Todos los proyectos</SelectItem>
            {proyectosUnicos.map(p => (
              <SelectItem key={p} value={p} className="text-[12px]">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={v => { setFiltroEstado(v); resetPage(); }}>
          <SelectTrigger className="h-8 text-[12px] w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" className="text-[12px]">Todos los estados</SelectItem>
            <SelectItem value="validado" className="text-[12px]">Validado</SelectItem>
            <SelectItem value="pendiente" className="text-[12px]">Pendiente</SelectItem>
            <SelectItem value="con_observaciones" className="text-[12px]">Con observaciones</SelectItem>
            <SelectItem value="sin_validar" className="text-[12px]">Sin validar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroMetodo} onValueChange={v => { setFiltroMetodo(v); resetPage(); }}>
          <SelectTrigger className="h-8 text-[12px] w-44">
            <SelectValue placeholder="Método de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" className="text-[12px]">Todos los métodos</SelectItem>
            {metodosUnicos.map(([id, nombre]) => (
              <SelectItem key={id} value={String(id)} className="text-[12px]">{nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-[13px]">Cargando pagos...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 gap-3 text-red-600">
            <XCircle className="size-5" />
            <span className="text-[13px]">Error al cargar los datos.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] whitespace-nowrap">Cuenta</TableHead>
                  <TableHead className="text-[11px] whitespace-nowrap">Proyecto</TableHead>
                  <TableHead className="text-[11px] whitespace-nowrap">Unidad</TableHead>
                  <TableHead className="text-[11px] whitespace-nowrap">Cliente</TableHead>
                  <TableHead className="text-[11px] whitespace-nowrap text-right">Monto</TableHead>
                  <TableHead className="text-[11px] whitespace-nowrap">Fecha</TableHead>
                  <TableHead className="text-[11px] whitespace-nowrap">Método</TableHead>
                  <TableHead className="text-[11px] whitespace-nowrap">Clave rastreo</TableHead>
                  <TableHead className="text-[11px] whitespace-nowrap text-center">Estado</TableHead>
                  <TableHead className="text-[11px] whitespace-nowrap text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-[13px] text-muted-foreground">
                      {filtered.length === 0 && rows.length > 0
                        ? "No hay pagos que coincidan con los filtros."
                        : "No se encontraron pagos."}
                    </TableCell>
                  </TableRow>
                ) : paginated.map(row => (
                  <TableRow key={row.pago_id} className="text-[12px]">
                    <TableCell className="py-2 font-mono text-[11px] whitespace-nowrap">
                      {formatCuentaCobranzaId(row.cuenta_id)}
                    </TableCell>
                    <TableCell className="py-2 max-w-[140px] truncate" title={row.proyecto}>
                      {row.proyecto}
                    </TableCell>
                    <TableCell className="py-2 whitespace-nowrap">
                      {row.numero_propiedad ?? "-"}
                    </TableCell>
                    <TableCell className="py-2 max-w-[160px] truncate" title={row.cliente}>
                      {row.cliente}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums whitespace-nowrap font-medium">
                      {fmtCurrency(row.monto)}
                    </TableCell>
                    <TableCell className="py-2 whitespace-nowrap">
                      {fmtDate(row.fecha_pago)}
                    </TableCell>
                    <TableCell className="py-2 whitespace-nowrap">
                      {row.metodo_nombre}
                    </TableCell>
                    <TableCell className="py-2 max-w-[140px] truncate font-mono text-[10px]" title={row.clave_rastreo ?? undefined}>
                      {row.clave_rastreo ?? <span className="text-muted-foreground/40">-</span>}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <EstadoBadge estado={row.estado_validacion} />
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1 justify-end">
                        {row.url_cep || row.url_recibo ? (
                          <button
                            onClick={() => setCepUrl(row.url_cep ?? row.url_recibo)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Ver comprobante (CEP / recibo)"
                          >
                            <FileText className="size-3.5" />
                          </button>
                        ) : (
                          <span className="p-1 text-muted-foreground/20" title="Sin comprobante">
                            <FileText className="size-3.5" />
                          </span>
                        )}
                        <button
                          onClick={() => { setDetallePagoId(row.pago_id); setDetallePagoRow(row); }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => setEditRow(row)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Editar validación"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <span>
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} · página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <CepViewerModal url={cepUrl} onClose={() => setCepUrl(null)} />
      <PagoDetalleModal
        pagoId={detallePagoId}
        pagoRow={detallePagoRow}
        onClose={() => { setDetallePagoId(null); setDetallePagoRow(null); }}
      />
      <EditPagoValidacionModal
        row={editRow}
        onClose={() => setEditRow(null)}
        hasPagoValidaciones={hasPagoValidaciones}
      />
    </div>
  );
}
