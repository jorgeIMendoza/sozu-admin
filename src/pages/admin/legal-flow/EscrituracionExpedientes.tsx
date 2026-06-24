import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Eye, FileCheck2, Loader2, Search, Warehouse, ExternalLink, Car, Sofa, StickyNote, Plus, MessageSquare, AlertTriangle, Handshake, Bell, Wallet, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows, fetchInBatches, fetchInBatchesPaged } from '@/utils/supabasePagination';
import { useToast } from '@/hooks/use-toast';
import { useBitacoraCuentaCobranza, useAppendBitacoraEntry } from '@/hooks/useBitacoraCuentaCobranza';
import { useExportToExcel } from '@/hooks/useExportToExcel';
import { CompradorDetalleSheet } from '@/components/admin/legal-flow/CompradorDetalleSheet';
import { ExpedienteDocumentos } from '@/components/admin/legal-flow/ExpedienteDocumentos';
import { useExpedienteVentaDetalle } from '@/hooks/useExpedienteVentaDetalle';
import { cn } from '@/lib/utils';

type Person = { id: number; nombre_legal: string | null; rfc: string | null };
type Option = { id: string; label: string };

type RelatedAccount = {
  id: number;
  label: string;
  tipo: string;
  precioFinal: number;
};

/** Detalle de una bodega vinculada a su cuenta de cobranza (producto). */
type BodegaDetalle = {
  id: number;
  nombre: string;
  m2: number;
  precioM2: number | null;
  precioFinal: number;
  totalPagado: number;
  saldoPendiente: number;
  ubicacion: string | null;
  fechaCompra: string | null;
  cuentaId: number | null;
  cuentaLabel: string | null;
  tieneCuenta: boolean;
};

/** Detalle de un estacionamiento vinculado a su cuenta de cobranza (producto). */
type EstacionamientoDetalle = {
  id: number;
  nombre: string;
  tipo: string;
  m2: number;
  precioM2: number | null;
  precioFinal: number;
  ubicacion: string | null;
  esIncluido: boolean;
  fechaCompra: string | null;
  cuentaId: number | null;
  cuentaLabel: string | null;
  tieneCuenta: boolean;
};

/** Detalle de un paquete amueblado vinculado a su cuenta de cobranza (producto). */
type PaqueteDetalle = {
  id: number;
  nombre: string;
  precioFinal: number;
  totalPagado: number;
  saldoPendiente: number;
  compradores: Person[];
  fechaCompra: string | null;
  cuentaId: number;
  cuentaLabel: string;
};

/** Detalle de una condensadora vinculada a su cuenta de cobranza (producto). */
type CondensadoraDetalle = {
  id: number;
  nombre: string;
  precioFinal: number;
  totalPagado: number;
  saldoPendiente: number;
  compradores: Person[];
  fechaCompra: string | null;
  cuentaId: number;
  cuentaLabel: string;
};

type ExpedienteRow = {
  cuentaId: number;
  cuentaLabel: string;
  propiedadId: number | null;
  compradores: Person[];
  propietario: string;
  propietarioRfc: string | null;
  tipo: string;
  estatusId: number | null;
  estatus: string;
  unidad: string;
  piso: string;
  proyectoId: number | null;
  proyecto: string;
  edificio: string;
  modeloId: number | null;
  modelo: string;
  estacionamientos: EstacionamientoDetalle[];
  bodegas: BodegaDetalle[];
  paquetes: PaqueteDetalle[];
  condensadoras: CondensadoraDetalle[];
  productos: string[];
  tieneCondensadora: boolean;
  fechaVenta: string | null;
  precioFinal: number;
  m2Interiores: number;
  m2Exteriores: number;
  precioM2: number | null;
  contratoFirmado: boolean;
  contratoUrl: string | null;
  ofertaId: number | null;
  documentosCount: number;
  relatedAccounts: RelatedAccount[];
};

const ALL_VALUE = 'all';

const fmtMxn = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value || 0);

const fmtMxn2 = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);

const fmtM2 = (value: number) => `${(value || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })} m²`;

const fmtDate = (value: string | null) => {
  if (!value) return '—';
  // Mostrar la fecha tal como viene en BD (YYYY-MM-DD), sin desfase por zona
  // horaria: `new Date('2022-08-26')` se interpreta como UTC y en MX (UTC-6)
  // retrocede un día. Construimos la fecha con los componentes locales.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(value);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtFechaHora = (value: string) =>
  new Date(value).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const ccLabel = (id: number) => `CC-${String(id).padStart(6, '0')}`;

/**
 * Tipos de nota de bitácora (mismas categorías que el composer de Casos).
 * `legal_flow_bitacora.tipo` sólo admite nota/validacion/rechazo/sistema, así
 * que la categoría se persiste como marcador al inicio del título y se parsea
 * al mostrar.
 */
const NOTE_TYPES = [
  { value: 'nota_interna', label: 'Nota interna', icon: StickyNote, color: 'bg-muted text-muted-foreground' },
  { value: 'observacion_legal', label: 'Observación legal', icon: MessageSquare, color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  { value: 'riesgo', label: 'Riesgo', icon: AlertTriangle, color: 'bg-destructive/10 text-destructive' },
  { value: 'acuerdo', label: 'Acuerdo', icon: Handshake, color: 'bg-primary/10 text-primary' },
  { value: 'seguimiento', label: 'Seguimiento', icon: Bell, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
] as const;
type NoteTypeValue = typeof NOTE_TYPES[number]['value'];
const NOTE_TYPE_BY_VALUE = new Map(NOTE_TYPES.map((t) => [t.value, t]));

const CAT_RE = /^«cat:([a-z_]+)»\s?/;
const encodeCategoria = (cat: NoteTypeValue, titulo: string) => `«cat:${cat}» ${titulo}`.trim();
const decodeCategoria = (titulo?: string): { categoria: NoteTypeValue; titulo: string } => {
  if (!titulo) return { categoria: 'nota_interna', titulo: '' };
  const m = titulo.match(CAT_RE);
  if (m && NOTE_TYPE_BY_VALUE.has(m[1] as NoteTypeValue)) {
    return { categoria: m[1] as NoteTypeValue, titulo: titulo.replace(CAT_RE, '') };
  }
  return { categoria: 'nota_interna', titulo };
};

const joinNames = (items: string[]) => items.length ? items.join(', ') : '—';

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-[13px] font-medium text-foreground">{value || '—'}</div>
    </div>
  );
}

function DetailModal({ row, open, onOpenChange }: { row: ExpedienteRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [showBodegas, setShowBodegas] = useState(false);
  const [showEstac, setShowEstac] = useState(false);
  const [showPaquete, setShowPaquete] = useState(false);
  const [showCondensadora, setShowCondensadora] = useState(false);
  const [showPagos, setShowPagos] = useState(false);
  const [compradorSel, setCompradorSel] = useState<number | null>(null);
  if (!row) return null;

  // Adquisiciones con precio final que suman al valor de escrituración.
  // Estacionamiento: cualquiera ligado con precio final > 0, sin importar el
  // flag "incluido con el depa" — un cajón puede venir "incluido" pero tener
  // su propia cuenta con precio (p.ej. tándem cobrado aparte).
  const bodegasAdquiridas = row.bodegas.filter((b) => b.tieneCuenta);
  const estacionamientosAdicionales = row.estacionamientos.filter(
    (e) => e.tieneCuenta && e.precioFinal > 0,
  );
  const totalBodegas = bodegasAdquiridas.reduce((s, b) => s + b.precioFinal, 0);
  const totalEstacionamientos = estacionamientosAdicionales.reduce(
    (s, e) => s + e.precioFinal,
    0,
  );
  const valorEscrituracion = row.precioFinal + totalBodegas + totalEstacionamientos;

  // Fecha de compra por concepto: si los ítems comparten fecha se muestra esa;
  // si hay varias distintas, "Varias"; si no hay, "—".
  const fechaConcepto = (fechas: Array<string | null>) => {
    const dias = [...new Set(fechas.filter(Boolean).map((f) => (f as string).slice(0, 10)))];
    if (dias.length === 0) return '—';
    if (dias.length === 1) return fmtDate(dias[0]);
    return 'Varias';
  };
  const fechaBodegas = fechaConcepto(bodegasAdquiridas.map((b) => b.fechaCompra));
  const fechaEstacionamientos = fechaConcepto(estacionamientosAdicionales.map((e) => e.fechaCompra));

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setShowBodegas(false); setShowEstac(false); setShowPaquete(false); setShowCondensadora(false); setShowPagos(false); setCompradorSel(null); } onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" /> Expediente {row.cuentaLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <section>
            <h3 className="mb-3 text-sm font-semibold">Resumen de la venta</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Fecha venta reconocida" value={fmtDate(row.fechaVenta)} />
              <DetailItem label="Desarrollador (Receptor)" value={row.propietario} />
              <DetailItem
                label="Precio final"
                value={
                  <button
                    type="button"
                    onClick={() => setShowPagos(true)}
                    className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                  >
                    {fmtMxn(row.precioFinal)}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </button>
                }
              />
              <DetailItem
                label="Contrato firmado completamente"
                value={row.contratoUrl ? (
                  <a
                    href={row.contratoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                  >
                    {row.contratoFirmado ? 'Validado · Ver contrato' : 'Ver contrato'}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (row.contratoFirmado ? 'Validado' : 'Pendiente')}
              />
              <DetailItem
                label="Oferta comercial"
                value={row.ofertaId ? (
                  <a
                    href={`/oferta/${row.ofertaId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-primary underline-offset-2 hover:underline"
                  >
                    OF-{String(row.ofertaId).padStart(6, '0')}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : '—'}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Datos de la propiedad</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Proyecto" value={row.proyecto} />
              <DetailItem label="Edificio" value={row.edificio} />
              <DetailItem label="Modelo" value={row.modelo} />
              <DetailItem label="No. Depto" value={row.unidad} />
              <DetailItem label="Tipo" value={row.tipo} />
              <DetailItem label="Estatus de Propiedad" value={<span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[12px] font-medium">{row.estatus}</span>} />
              <DetailItem label="Metraje" value={`${(row.m2Interiores + row.m2Exteriores).toLocaleString('es-MX')} m²`} />
              <DetailItem
                label="Estacionamientos"
                value={row.estacionamientos.length ? (
                  <button
                    type="button"
                    onClick={() => setShowEstac(true)}
                    className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                  >
                    {row.estacionamientos.map((e) => e.nombre).join(', ')}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </button>
                ) : '—'}
              />
              <DetailItem
                label="Bodegas"
                value={row.bodegas.length ? (
                  <button
                    type="button"
                    onClick={() => setShowBodegas(true)}
                    className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                  >
                    {row.bodegas.map((b) => b.nombre).join(', ')}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </button>
                ) : '—'}
              />
              <DetailItem
                label="Paquete amueblado"
                value={row.paquetes.length ? (
                  <button
                    type="button"
                    onClick={() => setShowPaquete(true)}
                    className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                  >
                    {row.paquetes.map((p) => p.nombre).join(', ')}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </button>
                ) : '—'}
              />
              <DetailItem
                label="Condensadora"
                value={row.condensadoras.length ? (
                  <button
                    type="button"
                    onClick={() => setShowCondensadora(true)}
                    className="inline-flex items-center gap-1 font-mono text-primary underline-offset-2 hover:underline"
                  >
                    {row.condensadoras.map((c) => c.cuentaLabel).join(', ')}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </button>
                ) : '—'}
              />
              <DetailItem label="Precio / m²" value={row.precioM2 ? fmtMxn(row.precioM2) : '—'} />
            </div>
          </section>

          {/* ─── Bodegas adquiridas ─── */}
          {bodegasAdquiridas.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Warehouse className="h-4 w-4 text-primary" /> Bodegas adquiridas
              </h3>
              <div className="overflow-hidden rounded-xl border border-border/60">
                <table className="w-full">
                  <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Bodega</th>
                      <th className="px-4 py-2 font-medium">Ubicación</th>
                      <th className="px-4 py-2 font-medium text-right">Metraje</th>
                      <th className="px-4 py-2 font-medium text-right">Precio final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bodegasAdquiridas.map((b) => (
                      <tr key={b.id} className="border-t border-border/60 text-[13px]">
                        <td className="px-4 py-2 font-medium">{b.nombre}</td>
                        <td className="px-4 py-2 text-muted-foreground">{b.ubicacion || '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{b.m2 > 0 ? fmtM2(b.m2) : '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtMxn2(b.precioFinal)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border/60 bg-muted/30 text-[13px] font-semibold">
                      <td className="px-4 py-2" colSpan={3}>Subtotal bodegas</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMxn2(totalBodegas)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ─── Estacionamiento adicional ─── */}
          {estacionamientosAdicionales.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Car className="h-4 w-4 text-primary" /> Estacionamiento adicional
              </h3>
              <div className="overflow-hidden rounded-xl border border-border/60">
                <table className="w-full">
                  <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Estacionamiento</th>
                      <th className="px-4 py-2 font-medium">Tipo</th>
                      <th className="px-4 py-2 font-medium">Ubicación</th>
                      <th className="px-4 py-2 font-medium text-right">Precio final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estacionamientosAdicionales.map((e) => (
                      <tr key={e.id} className="border-t border-border/60 text-[13px]">
                        <td className="px-4 py-2 font-medium">{e.nombre}</td>
                        <td className="px-4 py-2 text-muted-foreground">{e.tipo || '—'}</td>
                        <td className="px-4 py-2 text-muted-foreground">{e.ubicacion || '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtMxn2(e.precioFinal)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border/60 bg-muted/30 text-[13px] font-semibold">
                      <td className="px-4 py-2" colSpan={3}>Subtotal estacionamiento</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMxn2(totalEstacionamientos)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ─── Valor de escrituración (Propiedad + Bodegas + Estacionamiento) ─── */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-primary" /> Valor de escrituración
            </h3>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full">
                <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Concepto</th>
                    <th className="px-4 py-2 font-medium">Fecha de compra</th>
                    <th className="px-4 py-2 font-medium text-right">Precio final</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border/60 text-[13px]">
                    <td className="px-4 py-2">Propiedad · Unidad {row.unidad}</td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{fmtDate(row.fechaVenta)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtMxn2(row.precioFinal)}</td>
                  </tr>
                  <tr className="border-t border-border/60 text-[13px]">
                    <td className="px-4 py-2">
                      Bodegas{bodegasAdquiridas.length > 0 ? ` (${bodegasAdquiridas.length})` : ''}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{fechaBodegas}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtMxn2(totalBodegas)}</td>
                  </tr>
                  <tr className="border-t border-border/60 text-[13px]">
                    <td className="px-4 py-2">
                      Estacionamiento adicional{estacionamientosAdicionales.length > 0 ? ` (${estacionamientosAdicionales.length})` : ''}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{fechaEstacionamientos}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtMxn2(totalEstacionamientos)}</td>
                  </tr>
                  <tr className="border-t-2 border-border bg-primary/5 text-[13px] font-bold">
                    <td className="px-4 py-2.5">Valor de escrituración</td>
                    <td className="px-4 py-2.5 text-muted-foreground">—</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-primary">{fmtMxn2(valorEscrituracion)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Suma del precio final de la propiedad más el de bodegas y estacionamientos adquiridos.
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Compradores</h3>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full">
                <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Nombre</th>
                    <th className="px-4 py-2 font-medium">RFC</th>
                  </tr>
                </thead>
                <tbody>
                  {row.compradores.length ? row.compradores.map((buyer) => (
                    <tr key={buyer.id} className="border-t border-border/60 text-[13px]">
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setCompradorSel(buyer.id)}
                          className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                        >
                          {buyer.nombre_legal || '—'}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </button>
                      </td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">{buyer.rfc || '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-muted-foreground">Sin compradores ligados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Documentos y cuentas ligadas</h3>
            <div className="grid gap-3 lg:grid-cols-3">
              <DetailItem label="Documentos relacionados" value={`${row.documentosCount} documento(s)`} />
              <DetailItem label="Productos / servicios" value={joinNames(row.productos)} />
              <DetailItem label="Cuentas relacionadas" value={`${row.relatedAccounts.length} cuenta(s)`} />
            </div>
            {row.relatedAccounts.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
                <table className="w-full">
                  <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">ID Cuenta</th>
                      <th className="px-4 py-2 font-medium">Tipo</th>
                      <th className="px-4 py-2 font-medium text-right">Precio final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.relatedAccounts.map((account) => (
                      <tr key={account.id} className="border-t border-border/60 text-[13px]">
                        <td className="px-4 py-2 font-mono text-muted-foreground">{account.label}</td>
                        <td className="px-4 py-2">{account.tipo}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmtMxn(account.precioFinal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <ExpedienteDocumentos cuentaId={row.cuentaId} propiedadId={row.propiedadId} />
          </section>

          <BitacoraSection cuentaId={row.cuentaId} />
        </div>
      </DialogContent>
    </Dialog>

    <BodegasModal row={row} open={showBodegas} onOpenChange={setShowBodegas} />
    <EstacionamientosModal row={row} open={showEstac} onOpenChange={setShowEstac} />
    <PaquetesModal row={row} open={showPaquete} onOpenChange={setShowPaquete} />
    <CondensadorasModal row={row} open={showCondensadora} onOpenChange={setShowCondensadora} />
    <PagosDetalleModal folio={row.cuentaLabel} unidad={row.unidad} open={showPagos} onOpenChange={setShowPagos} />
    {compradorSel != null && (
      <CompradorDetalleSheet
        open={compradorSel != null}
        onOpenChange={(o) => { if (!o) setCompradorSel(null); }}
        idCuentaCobranza={row.cuentaId}
        compradores={row.compradores.map((b) => ({ idPersona: b.id, nombre: b.nombre_legal || '—' }))}
        initialPersonaId={compradorSel}
      />
    )}
    </>
  );
}

/**
 * Bitácora del expediente — reutiliza la tabla `legal_flow_bitacora`
 * (keyed por id_cuenta_cobranza). Permite ver notas anteriores y dar de
 * alta una nota nueva.
 */
function BitacoraSection({ cuentaId }: { cuentaId: number }) {
  const { entries, isLoading, columnaFaltante } = useBitacoraCuentaCobranza(cuentaId);
  const { toast } = useToast();
  const [openNota, setOpenNota] = useState(false);

  const ordenadas = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <StickyNote className="h-4 w-4 text-primary" /> Bitácora
        </h3>
        {!columnaFaltante && (
          <Button size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => setOpenNota(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva nota
          </Button>
        )}
      </div>

      {columnaFaltante ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          La bitácora no está habilitada en este ambiente (tabla <code>legal_flow_bitacora</code> pendiente de migración).
        </div>
      ) : isLoading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando bitácora…
        </div>
      ) : ordenadas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
          Sin notas en la bitácora.
        </div>
      ) : (
        <ul className="space-y-2">
          {ordenadas.map((e) => {
            const { categoria, titulo } = decodeCategoria(e.titulo);
            const tipo = NOTE_TYPE_BY_VALUE.get(categoria)!;
            const Icon = tipo.icon;
            return (
              <li key={e.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium', tipo.color)}>
                    <Icon className="h-3 w-3" /> {tipo.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{fmtFechaHora(e.timestamp)}</span>
                </div>
                {titulo && <p className="mt-1.5 text-[13px] font-semibold">{titulo}</p>}
                <p className="mt-0.5 whitespace-pre-wrap text-[13px]">{e.mensaje}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">— {e.autorNombre || e.autorEmail}</p>
              </li>
            );
          })}
        </ul>
      )}

      <NuevaNotaDialog cuentaId={cuentaId} open={openNota} onOpenChange={setOpenNota} onSaved={() => toast({ title: 'Nota agregada', description: 'La nota se guardó en la bitácora.' })} />
    </section>
  );
}

function NuevaNotaDialog({
  cuentaId, open, onOpenChange, onSaved,
}: {
  cuentaId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const append = useAppendBitacoraEntry(cuentaId);
  const { toast } = useToast();
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<NoteTypeValue>('nota_interna');
  const [descripcion, setDescripcion] = useState('');

  const reset = () => { setTitulo(''); setCategoria('nota_interna'); setDescripcion(''); };

  const guardar = () => {
    const desc = descripcion.trim();
    const tit = titulo.trim();
    if (!tit && !desc) return;
    append.mutate(
      { tipo: 'nota', titulo: encodeCategoria(categoria, tit), mensaje: desc },
      {
        onSuccess: () => { reset(); onOpenChange(false); onSaved(); },
        onError: (e) => toast({ title: 'No se pudo guardar la nota', description: (e as Error).message, variant: 'destructive' }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Nueva nota</DialogTitle>
          <DialogDescription className="text-[13px]">Registra una observación o seguimiento.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Documentación pendiente" className="text-[13px]" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {NOTE_TYPES.map((t) => {
                const Icon = t.icon;
                const active = categoria === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setCategoria(t.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
                      active ? 'border-primary text-primary bg-primary/5' : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Descripción</label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Describe la observación…" rows={4} className="text-[13px]" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={append.isPending}>Cancelar</Button>
          <Button size="sm" className="gap-1.5" onClick={guardar} disabled={append.isPending || (!titulo.trim() && !descripcion.trim())}>
            {append.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PagoCard({
  tone, label, value, sub, rows,
}: {
  tone: 'emerald' | 'amber' | 'purple' | 'blue';
  label: string;
  value: string;
  sub: string;
  rows?: Array<{ k: string; v: string }>;
}) {
  const cls = {
    emerald: 'ring-emerald-200 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/20 dark:ring-emerald-900/40 dark:text-emerald-300',
    amber: 'ring-amber-200 bg-amber-50/60 text-amber-700 dark:bg-amber-950/20 dark:ring-amber-900/40 dark:text-amber-300',
    purple: 'ring-purple-200 bg-purple-50/60 text-purple-700 dark:bg-purple-950/20 dark:ring-purple-900/40 dark:text-purple-300',
    blue: 'ring-blue-200 bg-blue-50/60 text-blue-700 dark:bg-blue-950/20 dark:ring-blue-900/40 dark:text-blue-300',
  }[tone];
  return (
    <div className={cn('rounded-xl ring-1 p-4', cls)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-[12px] opacity-80">{sub}</p>
      {rows && rows.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-current/10 pt-2">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="opacity-80">{r.k}</span>
              <span className="tabular-nums font-medium text-foreground">{r.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PagosDetalleModal({ folio, unidad, open, onOpenChange }: { folio: string; unidad: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading, error } = useExpedienteVentaDetalle(open ? folio : null);
  const fb = data?.financial_breakdown;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Detalle de pagos · Propiedad {unidad}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Total pagado, saldo pendiente, efectivo permitido y valor de escrituración.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando detalle de pagos…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-destructive">No se pudo cargar: {(error as Error).message}</div>
        ) : !fb ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Sin información de pagos para esta cuenta.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PagoCard
              tone="emerald"
              label="Total pagado"
              value={fmtMxn2(fb.total_pagado)}
              sub={`${fb.total_pagado_pct.toFixed(1)}% del total`}
            />
            <PagoCard
              tone="amber"
              label="Saldo pendiente"
              value={fmtMxn2(fb.saldo_pendiente)}
              sub={`${fb.saldo_pendiente_pct.toFixed(1)}% del total`}
              rows={[
                { k: 'Durante obra:', v: fmtMxn2(fb.durante_obra_pendiente) },
                { k: 'A la entrega:', v: fmtMxn2(fb.a_la_entrega_pendiente) },
                { k: 'Parcialidades restantes:', v: String(fb.parcialidades_restantes) },
              ]}
            />
            <PagoCard
              tone="purple"
              label="Pago en efectivo"
              value={fmtMxn2(fb.efectivo_aun_permitido)}
              sub="Aún permitido"
              rows={[
                { k: 'Límite:', v: fmtMxn2(fb.efectivo_limite) },
                { k: 'Pagado:', v: fmtMxn2(fb.efectivo_pagado) },
              ]}
            />
            <PagoCard
              tone="blue"
              label="Valor de escrituración"
              value={fmtMxn2(fb.valor_escrituracion)}
              sub="Precio final de la cuenta"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaquetesModal({ row, open, onOpenChange }: { row: ExpedienteRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!row) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sofa className="h-5 w-5 text-primary" /> Paquete amueblado · Propiedad {row.unidad}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border/60">
          <table className="w-full">
            <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Paquete</th>
                <th className="px-4 py-2 font-medium text-right">Precio Final</th>
                <th className="px-4 py-2 font-medium text-right">Total Pagado</th>
                <th className="px-4 py-2 font-medium text-right">Saldo Pendiente</th>
                <th className="px-4 py-2 font-medium">Fecha compra</th>
                <th className="px-4 py-2 font-medium">Compradores</th>
              </tr>
            </thead>
            <tbody>
              {row.paquetes.length ? row.paquetes.map((paq) => (
                <tr key={paq.id} className="border-t border-border/60 text-[13px]">
                  <td className="px-4 py-2 font-medium">
                    {paq.nombre}
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground">{paq.cuentaLabel}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtMxn2(paq.precioFinal)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-600">{fmtMxn2(paq.totalPagado)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-amber-600">{fmtMxn2(paq.saldoPendiente)}</td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{fmtDate(paq.fechaCompra)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{paq.compradores.map((b) => b.nombre_legal).filter(Boolean).join(', ') || '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">Sin paquetes amueblados ligados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CondensadorasModal({ row, open, onOpenChange }: { row: ExpedienteRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!row) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Condensadora · Propiedad {row.unidad}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border/60">
          <table className="w-full">
            <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">ID Cuenta</th>
                <th className="px-4 py-2 font-medium text-right">Precio Final</th>
                <th className="px-4 py-2 font-medium text-right">Total Pagado</th>
                <th className="px-4 py-2 font-medium text-right">Saldo Pendiente</th>
                <th className="px-4 py-2 font-medium">Fecha compra</th>
                <th className="px-4 py-2 font-medium">Compradores</th>
              </tr>
            </thead>
            <tbody>
              {row.condensadoras.length ? row.condensadoras.map((cond) => (
                <tr key={cond.id} className="border-t border-border/60 text-[13px]">
                  <td className="px-4 py-2 font-mono text-muted-foreground">{cond.cuentaLabel}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtMxn2(cond.precioFinal)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-600">{fmtMxn2(cond.totalPagado)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-amber-600">{fmtMxn2(cond.saldoPendiente)}</td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{fmtDate(cond.fechaCompra)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{cond.compradores.map((b) => b.nombre_legal).filter(Boolean).join(', ') || '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">Sin condensadora ligada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EstacionamientosModal({ row, open, onOpenChange }: { row: ExpedienteRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!row) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" /> Estacionamientos · Propiedad {row.unidad}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border/60">
          <table className="w-full">
            <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium text-right">M²</th>
                <th className="px-4 py-2 font-medium text-right">Precio por M²</th>
                <th className="px-4 py-2 font-medium text-right">Precio Final</th>
                <th className="px-4 py-2 font-medium">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {row.estacionamientos.length ? row.estacionamientos.map((est) => (
                <tr key={est.id} className="border-t border-border/60 text-[13px]">
                  <td className="px-4 py-2 font-medium">
                    {est.nombre}
                    {est.cuentaLabel && (
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">{est.cuentaLabel}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">{est.tipo}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtM2(est.m2)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{est.precioM2 != null ? fmtMxn2(est.precioM2) : fmtMxn2(0)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">
                    {fmtMxn2(est.precioFinal)}
                    {est.esIncluido && <span className="ml-2 text-[11px] font-normal italic text-muted-foreground">(incluido con el depa)</span>}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{est.ubicacion || 'N/A'}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">Sin estacionamientos ligados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BodegasModal({ row, open, onOpenChange }: { row: ExpedienteRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!row) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-primary" /> Bodegas · Propiedad {row.unidad}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border/60">
          <table className="w-full">
            <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium text-right">M²</th>
                <th className="px-4 py-2 font-medium text-right">Precio por M²</th>
                <th className="px-4 py-2 font-medium text-right">Precio Final</th>
                <th className="px-4 py-2 font-medium text-right">Total Pagado</th>
                <th className="px-4 py-2 font-medium text-right">Saldo Pendiente</th>
                <th className="px-4 py-2 font-medium">Fecha compra</th>
                <th className="px-4 py-2 font-medium">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {row.bodegas.length ? row.bodegas.map((bodega) => (
                <tr key={bodega.id} className="border-t border-border/60 text-[13px]">
                  <td className="px-4 py-2 font-medium">
                    {bodega.nombre}
                    {bodega.cuentaLabel && (
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">{bodega.cuentaLabel}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtM2(bodega.m2)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{bodega.precioM2 != null ? fmtMxn2(bodega.precioM2) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{bodega.tieneCuenta ? fmtMxn2(bodega.precioFinal) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-600">{bodega.tieneCuenta ? fmtMxn2(bodega.totalPagado) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-amber-600">{bodega.tieneCuenta ? fmtMxn2(bodega.saldoPendiente) : '—'}</td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{fmtDate(bodega.fechaCompra)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{bodega.ubicacion || 'N/A'}</td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">Sin bodegas ligadas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LegalFlowEscrituracionExpedientes() {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState(ALL_VALUE);
  const [bodegaFilter, setBodegaFilter] = useState(ALL_VALUE);
  const [paqueteFilter, setPaqueteFilter] = useState(ALL_VALUE);
  const [condensadoraFilter, setCondensadoraFilter] = useState(ALL_VALUE);
  const [modelFilter, setModelFilter] = useState(ALL_VALUE);
  const [floorFilter, setFloorFilter] = useState(ALL_VALUE);
  const [ownerFilter, setOwnerFilter] = useState(ALL_VALUE);
  const [selected, setSelected] = useState<ExpedienteRow | null>(null);
  const { exportToExcel, isExporting } = useExportToExcel();

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['legal-flow-escrituracion-expedientes'],
    queryFn: fetchExpedientes,
    staleTime: 60_000,
  });

  const options = useMemo(() => {
    const projects = uniqueOptions(rows.map((row) => ({ id: String(row.proyectoId ?? ''), label: row.proyecto })).filter((o) => o.id));
    const models = uniqueOptions(rows.map((row) => ({ id: String(row.modeloId ?? ''), label: row.modelo })).filter((o) => o.id));
    const floors = uniqueOptions(rows.map((row) => ({ id: row.piso || '', label: row.piso || 'Sin piso' })).filter((o) => o.id));
    const owners = uniqueOptions(rows.map((row) => ({ id: row.propietario, label: row.propietario })).filter((o) => o.id));
    return { projects, models, floors, owners };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (projectFilter !== ALL_VALUE && String(row.proyectoId) !== projectFilter) return false;
      if (modelFilter !== ALL_VALUE && String(row.modeloId) !== modelFilter) return false;
      if (floorFilter !== ALL_VALUE && row.piso !== floorFilter) return false;
      if (ownerFilter !== ALL_VALUE && row.propietario !== ownerFilter) return false;
      if (bodegaFilter === 'with' && row.bodegas.length === 0) return false;
      if (bodegaFilter === 'without' && row.bodegas.length > 0) return false;
      if (paqueteFilter === 'with' && row.paquetes.length === 0) return false;
      if (paqueteFilter === 'without' && row.paquetes.length > 0) return false;
      if (condensadoraFilter === 'with' && !row.tieneCondensadora) return false;
      if (condensadoraFilter === 'without' && row.tieneCondensadora) return false;
      if (!q) return true;
      return [
        row.cuentaLabel,
        String(row.cuentaId),
        row.unidad,
        row.proyecto,
        row.modelo,
        row.propietario,
        ...row.productos,
        ...row.compradores.map((buyer) => buyer.nombre_legal || ''),
      ].join(' ').toLowerCase().includes(q);
    });
  }, [rows, search, projectFilter, modelFilter, floorFilter, ownerFilter, bodegaFilter, paqueteFilter, condensadoraFilter]);

  // Exporta a Excel (CSV) los expedientes según los filtros activos.
  const handleExport = () => {
    const exportData = filtered.map((row) => {
      const totalBodegas = row.bodegas.filter((b) => b.tieneCuenta).reduce((s, b) => s + b.precioFinal, 0);
      const totalEstac = row.estacionamientos
        .filter((e) => !e.esIncluido && e.tieneCuenta)
        .reduce((s, e) => s + e.precioFinal, 0);
      const valorEscrituracion = row.precioFinal + totalBodegas + totalEstac;
      return {
        'ID Cuenta': row.cuentaLabel,
        'Compradores': row.compradores.map((b) => b.nombre_legal).filter(Boolean).join(', '),
        'Propietario': row.propietario,
        'Tipo': row.tipo,
        'Estatus': row.estatus,
        'Unidad': row.unidad,
        'Proyecto': row.proyecto,
        'Edificio': row.edificio,
        'Modelo': row.modelo,
        'Fecha venta': fmtDate(row.fechaVenta),
        'Estacionamientos': row.estacionamientos.map((e) => e.nombre).join(', '),
        'Bodegas': row.bodegas.map((b) => b.nombre).join(', '),
        'Muebles': row.paquetes.length ? 'Sí' : 'No',
        'Condensadora': row.tieneCondensadora ? 'Sí' : 'No',
        'Precio final propiedad': row.precioFinal,
        'Valor de escrituración': valorEscrituracion,
      };
    });
    exportToExcel({ data: exportData, filename: 'escrituracion_expedientes' });
  };

  return (
    <div className="max-w-[1600px] space-y-6 px-10 py-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">
            Cuentas de cobranza de propiedades (todos los estatus), con bodegas, estacionamientos y productos ligados.
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card px-4 py-3 text-right shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Expedientes</p>
          <p className="text-2xl font-bold tabular-nums">{filtered.length.toLocaleString('es-MX')}</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por ID Cuenta, No. Departamento, Producto, Compradores..."
            className="h-[38px] rounded-lg bg-card pl-10 text-[13px]"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-[38px] w-[210px] rounded-lg bg-card text-[13px]"><SelectValue placeholder="Proyecto" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_VALUE}>Todos los proyectos</SelectItem>{options.projects.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="h-[38px] w-[200px] rounded-lg bg-card text-[13px]"><SelectValue placeholder="Propietario" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_VALUE}>Todos los propietarios</SelectItem>{options.owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={bodegaFilter} onValueChange={setBodegaFilter}>
          <SelectTrigger className="h-[38px] w-[160px] rounded-lg bg-card text-[13px]"><SelectValue placeholder="Bodega" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_VALUE}>Todas</SelectItem><SelectItem value="with">Con bodega</SelectItem><SelectItem value="without">Sin bodega</SelectItem></SelectContent>
        </Select>
        <Select value={paqueteFilter} onValueChange={setPaqueteFilter}>
          <SelectTrigger className="h-[38px] w-[200px] rounded-lg bg-card text-[13px]"><SelectValue placeholder="Paquete de muebles" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_VALUE}>Todos</SelectItem><SelectItem value="with">Con paquete de muebles</SelectItem><SelectItem value="without">Sin paquete de muebles</SelectItem></SelectContent>
        </Select>
        <Select value={condensadoraFilter} onValueChange={setCondensadoraFilter}>
          <SelectTrigger className="h-[38px] w-[180px] rounded-lg bg-card text-[13px]"><SelectValue placeholder="Condensadora" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_VALUE}>Todas</SelectItem><SelectItem value="with">Con condensadora</SelectItem><SelectItem value="without">Sin condensadora</SelectItem></SelectContent>
        </Select>
        <Select value={modelFilter} onValueChange={setModelFilter}>
          <SelectTrigger className="h-[38px] w-[190px] rounded-lg bg-card text-[13px]"><SelectValue placeholder="Modelo" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_VALUE}>Todos los modelos</SelectItem>{options.models.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={floorFilter} onValueChange={setFloorFilter}>
          <SelectTrigger className="h-[38px] w-[150px] rounded-lg bg-card text-[13px]"><SelectValue placeholder="Piso" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_VALUE}>Todos los pisos</SelectItem>{options.floors.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button
          variant="outline"
          className="ml-auto h-[38px] gap-2 text-[13px]"
          onClick={handleExport}
          disabled={isExporting || filtered.length === 0}
        >
          <FileSpreadsheet className="h-4 w-4" />
          {isExporting ? 'Exportando…' : 'Exportar a Excel'}
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px]">
            <thead>
              <tr className="border-b text-left">
                <th className="table-head">ID Cuenta</th>
                <th className="table-head">Compradores</th>
                <th className="table-head">Propietario</th>
                <th className="table-head">Tipo</th>
                <th className="table-head">Estatus</th>
                <th className="table-head">Unidad</th>
                <th className="table-head">Proyecto</th>
                <th className="table-head">Modelo</th>
                <th className="table-head">Fecha venta</th>
                <th className="table-head">Estacionamientos</th>
                <th className="table-head">Bodegas</th>
                <th className="table-head">Muebles</th>
                <th className="table-head">Condensadora</th>
                <th className="table-head text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={14} className="px-5 py-20 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando expedientes...</td></tr>
              ) : error ? (
                <tr><td colSpan={14} className="px-5 py-20 text-center text-sm text-destructive">No se pudieron cargar los expedientes: {(error as Error).message}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={14} className="px-5 py-20 text-center text-sm text-muted-foreground">Sin expedientes que coincidan con los filtros.</td></tr>
              ) : filtered.map((row) => (
                <tr key={row.cuentaId} className="border-t border-border/50 table-row-hover">
                  <td className="table-cell font-mono text-[12px] text-muted-foreground">{row.cuentaLabel}</td>
                  <td className="table-cell text-[13px]">{row.compradores.map((b) => b.nombre_legal).filter(Boolean).join(', ') || '—'}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{row.propietario}</td>
                  <td className="table-cell text-[13px]">{row.tipo}</td>
                  <td className="table-cell text-[13px]"><span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">{row.estatus}</span></td>
                  <td className="table-cell text-[13px] font-medium">{row.unidad}</td>
                  <td className="table-cell text-[13px]">{row.proyecto}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{row.modelo}</td>
                  <td className="table-cell text-[13px] tabular-nums text-muted-foreground">{fmtDate(row.fechaVenta)}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{row.estacionamientos.length ? row.estacionamientos.map((e) => e.nombre).join(', ') : '—'}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{row.bodegas.length ? row.bodegas.map((b) => b.nombre).join(', ') : '—'}</td>
                  <td className="table-cell text-[13px]">
                    {row.paquetes.length ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Sí</span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="table-cell text-[13px]">
                    {row.tieneCondensadora ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Sí</span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="table-cell text-right">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => setSelected(row)}>
                      <Eye className="h-3.5 w-3.5" /> Ver detalle
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <DetailModal row={selected} open={!!selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}

function uniqueOptions(options: Option[]): Option[] {
  const map = new Map<string, string>();
  for (const option of options) {
    if (!option.id || !option.label || option.label === '—') continue;
    map.set(option.id, option.label);
  }
  return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

const BODEGA_RE = /bodega/i;
const ESTAC_RE = /estacionamiento/i;
const PAQUETE_RE = /amueblad/i;
const CONDENSADORA_RE = /condensador/i;

async function fetchExpedientes(): Promise<ExpedienteRow[]> {
  // 1) TODAS las cuentas de cobranza activas (paginado — PostgREST corta a 1000).
  //    Partimos de cuentas (≈1.7k) en vez de propiedades (>8k): es más acotado y
  //    captura la cuenta de la unidad + las cuentas de producto (bodega, etc.),
  //    que son HERMANAS (id_cuenta_cobranza_padre = null), no hijas.
  const cuentas = await fetchAllRows<any>((from, to) =>
    (supabase as any)
      .from('cuentas_cobranza')
      .select('id, id_propiedad, id_oferta, id_cuenta_cobranza_padre, precio_final, fecha_compra, fecha_creacion')
      .eq('activo', true)
      .range(from, to),
  );

  // 2) Ofertas → productos, para clasificar cada cuenta (unidad vs producto/bodega).
  const ofertaIds = [...new Set(cuentas.map((c) => c.id_oferta).filter(Boolean))] as number[];
  const ofertas = await fetchInBatches<any>(ofertaIds, (batch) =>
    (supabase as any).from('ofertas').select('id, id_producto, id_propiedad').in('id', batch as number[]),
  );
  const offerById = new Map<number, any>(ofertas.map((o: any) => [o.id, o]));
  const ofertaProductIds = [...new Set(ofertas.map((o: any) => o.id_producto).filter(Boolean))] as number[];

  // Propiedad efectiva por cuenta: muchas cuentas de PRODUCTO (condensadora,
  // bodega, estacionamiento, paquete) traen `id_propiedad = null` y sólo
  // referencian la propiedad vía su oferta. Resolvemos el fallback aquí para
  // que se agrupen con la cuenta de la unidad correspondiente.
  for (const c of cuentas) {
    if (!c.id_propiedad && c.id_oferta) {
      c.id_propiedad = offerById.get(c.id_oferta)?.id_propiedad ?? null;
    }
  }

  // 3) Propiedades referenciadas por las cuentas. Se muestran TODAS las cuentas
  //    sin importar el estatus de disponibilidad de la propiedad.
  const propIds = [...new Set(cuentas.map((c) => c.id_propiedad).filter(Boolean))] as number[];
  const propiedades = await fetchInBatches<any>(propIds, (batch) =>
    (supabase as any)
      .from('propiedades')
      .select('id, numero_propiedad, id_tipo_propiedad, numero_piso, m2_interiores, m2_exteriores, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad')
      .eq('activo', true)
      .in('id', batch as number[]),
  );
  const eligibleProps = propiedades;
  if (!eligibleProps.length) return [];
  const eligiblePropIds = new Set<number>(eligibleProps.map((p: any) => p.id));

  // Solo cuentas cuya propiedad fue cargada (activa).
  const relevantCuentas = cuentas.filter((c) => c.id_propiedad && eligiblePropIds.has(c.id_propiedad));

  // 4) Dimensiones de la propiedad (edificio → proyecto), dueño y tipo.
  const modelLinkIds = [...new Set(eligibleProps.map((p: any) => p.id_edificio_modelo).filter(Boolean))] as number[];
  const ownerEntityIds = [...new Set(eligibleProps.map((p: any) => p.id_entidad_relacionada_dueno).filter(Boolean))] as number[];
  const tipoIds = [...new Set(eligibleProps.map((p: any) => p.id_tipo_propiedad).filter(Boolean))] as number[];

  const [edificiosModelos, owners, tipos, bodegas, estacionamientos] = await Promise.all([
    fetchInBatches<any>(modelLinkIds, (b) => (supabase as any).from('edificios_modelos').select('id, id_edificio, id_modelo').in('id', b as number[])),
    fetchInBatches<any>(ownerEntityIds, (b) => (supabase as any).from('entidades_relacionadas').select('id, id_persona').in('id', b as number[])),
    fetchInBatches<any>(tipoIds, (b) => (supabase as any).from('tipos_propiedad').select('id, nombre').in('id', b as number[])),
    fetchInBatchesPaged<any>([...eligiblePropIds], (b, from, to) => (supabase as any).from('bodegas').select('id, id_propiedad, id_producto, nombre, m2, ubicacion').eq('activo', true).in('id_propiedad', b as number[]).order('id').range(from, to)),
    fetchInBatchesPaged<any>([...eligiblePropIds], (b, from, to) => (supabase as any).from('estacionamientos').select('id, id_propiedad, id_producto, nombre, id_tipo, m2, ubicacion, es_incluido').eq('activo', true).in('id_propiedad', b as number[]).order('id').range(from, to)),
  ]);

  // Catálogo de tipos de estacionamiento (Normal, Tandem, Doble, Carlift).
  const estacTipoIds = [...new Set(estacionamientos.map((e: any) => e.id_tipo).filter(Boolean))] as number[];
  const tiposEstac = await fetchInBatches<any>(estacTipoIds, (b) => (supabase as any).from('tipos_estacionamiento').select('id, nombre').in('id', b as number[]));
  const tipoEstacById = new Map<number, string>(tiposEstac.map((t: any) => [t.id, t.nombre as string]));

  // Catálogo de estatus de disponibilidad (Inventario, Disponible, Vendido, etc.).
  const estatusIds = [...new Set(eligibleProps.map((p: any) => p.id_estatus_disponibilidad).filter(Boolean))] as number[];
  const estatusCat = await fetchInBatches<any>(estatusIds, (b) => (supabase as any).from('estatus_disponibilidad').select('id, nombre').in('id', b as number[]));
  const estatusById = new Map<number, string>(estatusCat.map((s: any) => [s.id, s.nombre as string]));

  const linkRows = edificiosModelos;
  const buildingIds = [...new Set(linkRows.map((m: any) => m.id_edificio).filter(Boolean))] as number[];
  const modelIds = [...new Set(linkRows.map((m: any) => m.id_modelo).filter(Boolean))] as number[];
  const ownerPersonIds = [...new Set(owners.map((o: any) => o.id_persona).filter(Boolean))] as number[];

  const [edificios, modelos, ownerPeople] = await Promise.all([
    fetchInBatches<any>(buildingIds, (b) => (supabase as any).from('edificios').select('id, nombre, id_proyecto').in('id', b as number[])),
    fetchInBatches<any>(modelIds, (b) => (supabase as any).from('modelos').select('id, nombre').in('id', b as number[])),
    fetchInBatches<any>(ownerPersonIds, (b) => (supabase as any).from('personas').select('id, nombre_legal, rfc').in('id', b as number[])),
  ]);

  const projectIds = [...new Set(edificios.map((e: any) => e.id_proyecto).filter(Boolean))] as number[];
  const proyectos = await fetchInBatches<any>(projectIds, (b) => (supabase as any).from('proyectos').select('id, nombre').in('id', b as number[]));

  // 5) Productos (nombre) para clasificar cuentas + resolver bodegas/estacionamientos.
  const productIds = [...new Set([
    ...ofertaProductIds,
    ...bodegas.map((b: any) => b.id_producto).filter(Boolean),
    ...estacionamientos.map((e: any) => e.id_producto).filter(Boolean),
  ])] as number[];
  const productos = await fetchInBatches<any>(productIds, (b) => (supabase as any).from('productos_servicios').select('id, nombre').in('id', b as number[]));
  const productById = new Map<number, string>(productos.map((p: any) => [p.id, p.nombre as string]));

  // Nombre del producto asociado a una cuenta (null si es venta de la unidad).
  const productoDeCuenta = (c: any): string | null => {
    if (!c.id_oferta) return null;
    const off = offerById.get(c.id_oferta);
    if (!off?.id_producto) return null;
    return productById.get(off.id_producto) ?? null;
  };
  const esCuentaUnidad = (c: any) => !c.id_cuenta_cobranza_padre && productoDeCuenta(c) == null;
  const esCuentaBodega = (c: any) => { const n = productoDeCuenta(c); return !!n && BODEGA_RE.test(n); };
  const esCuentaEstacionamiento = (c: any) => { const n = productoDeCuenta(c); return !!n && ESTAC_RE.test(n); };
  const esCuentaPaquete = (c: any) => { const n = productoDeCuenta(c); return !!n && PAQUETE_RE.test(n); };
  const esCuentaCondensadora = (c: any) => { const n = productoDeCuenta(c); return !!n && CONDENSADORA_RE.test(n); };

  // 6) Agrupar cuentas por propiedad y clasificar.
  const cuentasByProp = groupByProp(relevantCuentas);
  const fechaDe = (c: any) => c.fecha_compra || c.fecha_creacion || '';
  const mainByProp = new Map<number, any>();        // cuenta de la unidad (venta principal)
  const bestByProp = new Map<number, any>();        // mejor cuenta disponible (fallback)
  const bodegaCuentasByProp = new Map<number, any[]>();
  const estacCuentasByProp = new Map<number, any[]>();
  const paqueteCuentasByProp = new Map<number, any[]>();
  const condensadoraCuentasByProp = new Map<number, any[]>();
  const productCuentasByProp = new Map<number, any[]>(); // hermanas con producto (incl. bodegas/estac/paquetes/condensadoras)
  for (const [propId, list] of cuentasByProp) {
    for (const c of list) {
      if (esCuentaUnidad(c)) {
        const prev = mainByProp.get(propId);
        if (!prev || fechaDe(c) > fechaDe(prev)) mainByProp.set(propId, c);
      }
      // Mejor cuenta de la propiedad (fallback cuando no hay cuenta de unidad):
      // se prefieren las de nivel principal (sin padre) y la más reciente.
      const prevBest = bestByProp.get(propId);
      const score = (x: any) => (x.id_cuenta_cobranza_padre ? 0 : 1);
      if (!prevBest || score(c) > score(prevBest) || (score(c) === score(prevBest) && fechaDe(c) > fechaDe(prevBest))) {
        bestByProp.set(propId, c);
      }
      if (productoDeCuenta(c) != null) {
        productCuentasByProp.set(propId, [...(productCuentasByProp.get(propId) || []), c]);
        if (esCuentaBodega(c)) {
          bodegaCuentasByProp.set(propId, [...(bodegaCuentasByProp.get(propId) || []), c]);
        } else if (esCuentaEstacionamiento(c)) {
          estacCuentasByProp.set(propId, [...(estacCuentasByProp.get(propId) || []), c]);
        } else if (esCuentaPaquete(c)) {
          paqueteCuentasByProp.set(propId, [...(paqueteCuentasByProp.get(propId) || []), c]);
        } else if (esCuentaCondensadora(c)) {
          condensadoraCuentasByProp.set(propId, [...(condensadoraCuentasByProp.get(propId) || []), c]);
        }
      }
    }
  }

  // Cuenta representativa por propiedad: la de la unidad si existe; si no
  // (p.ej. propiedades en Inventario que solo tienen cuenta de producto),
  // la mejor cuenta disponible — así se muestran TODOS los estatus.
  const representativeByProp = new Map<number, any>();
  for (const propId of cuentasByProp.keys()) {
    const rep = mainByProp.get(propId) ?? bestByProp.get(propId);
    if (rep) representativeByProp.set(propId, rep);
  }

  // 7) Compradores, documentos y pagos. Los compradores se piden tanto de la
  //    cuenta de la unidad como de las cuentas de paquete amueblado; los pagos
  //    de bodegas y paquetes (para Total Pagado / Saldo).
  const repAccountIds = [...new Set([...representativeByProp.values()].map((c: any) => c.id as number))];
  const bodegaCuentaIds = [...new Set([...bodegaCuentasByProp.values()].flat().map((c: any) => c.id))] as number[];
  const paqueteCuentaIds = [...new Set([...paqueteCuentasByProp.values()].flat().map((c: any) => c.id))] as number[];
  const condensadoraCuentaIds = [...new Set([...condensadoraCuentasByProp.values()].flat().map((c: any) => c.id))] as number[];
  const compradorCuentaIds = [...new Set([...repAccountIds, ...paqueteCuentaIds, ...condensadoraCuentaIds])];
  const pagoCuentaIds = [...new Set([...bodegaCuentaIds, ...paqueteCuentaIds, ...condensadoraCuentaIds])];

  const [compradores, docs, acuerdos] = await Promise.all([
    // compradores no tiene PK simple; lotes chicos para no superar 1000 filas/lote.
    fetchInBatches<any>(compradorCuentaIds, (b) => (supabase as any).from('compradores').select('id_cuenta_cobranza, id_persona').eq('activo', true).in('id_cuenta_cobranza', b as number[]), { batchSize: 200 }),
    // documentos: muchas filas por cuenta → paginar filas dentro del lote.
    fetchInBatchesPaged<any>(repAccountIds, (b, from, to) => (supabase as any).from('documentos').select('id, id_cuenta_cobranza, id_tipo_documento, id_estatus_verificacion, url').eq('activo', true).in('id_cuenta_cobranza', b as number[]).order('id').range(from, to)),
    // acuerdos_pago: varias parcialidades por cuenta → paginar filas.
    fetchInBatchesPaged<any>(pagoCuentaIds, (b, from, to) => (supabase as any).from('acuerdos_pago').select('id, id_cuenta_cobranza').eq('activo', true).in('id_cuenta_cobranza', b as number[]).order('id').range(from, to)),
  ]);

  // Total pagado por cuenta (bodega/paquete) — Σ aplicaciones_pago.monto
  // (es_multa=false) vía acuerdos_pago (fuente de verdad, CLAUDE.md).
  const acuerdoIds = [...new Set(acuerdos.map((a: any) => a.id).filter(Boolean))] as number[];
  const aplicaciones = await fetchInBatchesPaged<any>(acuerdoIds, (b, from, to) =>
    (supabase as any).from('aplicaciones_pago').select('id, id_acuerdo_pago, monto, es_multa').eq('activo', true).in('id_acuerdo_pago', b as number[]).order('id').range(from, to),
  );
  const acuerdoToCuenta = new Map<number, number>(acuerdos.map((a: any) => [a.id, a.id_cuenta_cobranza]));
  const pagadoPorCuenta = new Map<number, number>();
  for (const ap of aplicaciones) {
    if (ap.es_multa) continue;
    const cuentaId = acuerdoToCuenta.get(ap.id_acuerdo_pago);
    if (cuentaId == null) continue;
    pagadoPorCuenta.set(cuentaId, (pagadoPorCuenta.get(cuentaId) || 0) + Number(ap.monto || 0));
  }

  const buyerPersonIds = [...new Set(compradores.map((c: any) => c.id_persona).filter(Boolean))] as number[];
  const buyerPeople = await fetchInBatches<any>(buyerPersonIds, (b) => (supabase as any).from('personas').select('id, nombre_legal, rfc').in('id', b as number[]));

  // Mapas de apoyo.
  const linkById = new Map<number, any>(linkRows.map((row: any) => [row.id, row]));
  const buildingById = new Map<number, any>(edificios.map((row: any) => [row.id, row]));
  const modelById = new Map<number, any>(modelos.map((row: any) => [row.id, row]));
  const projectById = new Map<number, any>(proyectos.map((row: any) => [row.id, row]));
  const ownerEntityToPerson = new Map<number, number>(owners.map((row: any) => [row.id, row.id_persona]));
  const personById = new Map<number, Person>([...ownerPeople, ...buyerPeople].map((row: any) => [row.id, row as Person]));
  const tipoById = new Map<number, string>(tipos.map((row: any) => [row.id, row.nombre as string]));

  const buyersByAccount = new Map<number, Person[]>();
  for (const buyer of compradores) {
    const person = personById.get(buyer.id_persona) || { id: buyer.id_persona, nombre_legal: '—', rfc: null };
    buyersByAccount.set(buyer.id_cuenta_cobranza, [...(buyersByAccount.get(buyer.id_cuenta_cobranza) || []), person]);
  }

  const bodegasByProp = groupByProp(bodegas);
  const estacionamientosByProp = groupByProp(estacionamientos);
  const docsByAccount = new Map<number, any[]>();
  for (const doc of docs) {
    if (!doc.id_cuenta_cobranza) continue;
    docsByAccount.set(doc.id_cuenta_cobranza, [...(docsByAccount.get(doc.id_cuenta_cobranza) || []), doc]);
  }

  return eligibleProps
    .map((property: any) => {
      const account = representativeByProp.get(property.id);
      if (!account) return null; // propiedad sin ninguna cuenta de cobranza
      const link = linkById.get(property.id_edificio_modelo);
      const building = link ? buildingById.get(link.id_edificio) : null;
      const model = link ? modelById.get(link.id_modelo) : null;
      const project = building ? projectById.get(building.id_proyecto) : null;
      const ownerPersonId = ownerEntityToPerson.get(property.id_entidad_relacionada_dueno);
      const owner = ownerPersonId ? personById.get(ownerPersonId) : null;
      const propertyEstacionamientos = estacionamientosByProp.get(property.id) || [];
      const productCuentas = productCuentasByProp.get(property.id) || [];
      const docsForAccount = docsByAccount.get(account.id) || [];

      // Bodegas: emparejar filas físicas (tabla bodegas) con cuentas de bodega.
      // Las cuentas son la fuente autoritativa de existencia + financieros; la
      // tabla bodegas aporta nombre/m²/ubicación cuando existe.
      const bodegaRows = bodegasByProp.get(property.id) || [];
      const bodegaCuentas = bodegaCuentasByProp.get(property.id) || [];
      const nBodegas = Math.max(bodegaRows.length, bodegaCuentas.length);
      const bodegasDetalle: BodegaDetalle[] = [];
      for (let i = 0; i < nBodegas; i++) {
        const fila = bodegaRows[i];
        const cuenta = bodegaCuentas[i];
        const m2 = Number(fila?.m2 || 0);
        const precioFinal = cuenta ? Number(cuenta.precio_final || 0) : 0;
        const totalPagado = cuenta ? (pagadoPorCuenta.get(cuenta.id) || 0) : 0;
        const nombre = fila?.nombre || (cuenta ? productoDeCuenta(cuenta) : null) || 'Bodega';
        bodegasDetalle.push({
          id: fila?.id ?? cuenta?.id ?? i,
          nombre,
          m2,
          precioM2: cuenta && m2 > 0 ? precioFinal / m2 : null,
          precioFinal,
          totalPagado,
          saldoPendiente: precioFinal - totalPagado,
          ubicacion: fila?.ubicacion || null,
          fechaCompra: cuenta?.fecha_compra ?? null,
          cuentaId: cuenta?.id ?? null,
          cuentaLabel: cuenta ? ccLabel(cuenta.id) : null,
          tieneCuenta: !!cuenta,
        });
      }

      // Estacionamientos: emparejar filas físicas (tabla) con cuentas de estacionamiento.
      const estacCuentas = estacCuentasByProp.get(property.id) || [];
      const nEstac = Math.max(propertyEstacionamientos.length, estacCuentas.length);
      const estacionamientosDetalle: EstacionamientoDetalle[] = [];
      for (let i = 0; i < nEstac; i++) {
        const fila = propertyEstacionamientos[i];
        const cuenta = estacCuentas[i];
        const m2 = Number(fila?.m2 || 0);
        const precioFinal = cuenta ? Number(cuenta.precio_final || 0) : 0;
        const nombre = fila?.nombre || (cuenta ? productoDeCuenta(cuenta) : null) || 'Estacionamiento';
        estacionamientosDetalle.push({
          id: fila?.id ?? cuenta?.id ?? i,
          nombre,
          tipo: (fila?.id_tipo && tipoEstacById.get(fila.id_tipo)) || 'Normal',
          m2,
          precioM2: m2 > 0 && precioFinal > 0 ? precioFinal / m2 : null,
          precioFinal,
          ubicacion: fila?.ubicacion || null,
          esIncluido: !!fila?.es_incluido,
          fechaCompra: cuenta?.fecha_compra ?? null,
          cuentaId: cuenta?.id ?? null,
          cuentaLabel: cuenta ? ccLabel(cuenta.id) : null,
          tieneCuenta: !!cuenta,
        });
      }

      // Paquetes amueblados: cuentas de producto vinculadas a la propiedad.
      const paqueteCuentas = paqueteCuentasByProp.get(property.id) || [];
      const paquetesDetalle: PaqueteDetalle[] = paqueteCuentas.map((c: any) => {
        const precioFinal = Number(c.precio_final || 0);
        const totalPagado = pagadoPorCuenta.get(c.id) || 0;
        return {
          id: c.id,
          nombre: productoDeCuenta(c) || 'Paquete amueblado',
          precioFinal,
          totalPagado,
          saldoPendiente: precioFinal - totalPagado,
          compradores: buyersByAccount.get(c.id) || [],
          fechaCompra: c.fecha_compra ?? null,
          cuentaId: c.id,
          cuentaLabel: ccLabel(c.id),
        };
      });

      const condensadoraCuentas = condensadoraCuentasByProp.get(property.id) || [];
      const condensadorasDetalle: CondensadoraDetalle[] = condensadoraCuentas.map((c: any) => {
        const precioFinal = Number(c.precio_final || 0);
        const totalPagado = pagadoPorCuenta.get(c.id) || 0;
        return {
          id: c.id,
          nombre: productoDeCuenta(c) || 'Condensadora',
          precioFinal,
          totalPagado,
          saldoPendiente: precioFinal - totalPagado,
          compradores: buyersByAccount.get(c.id) || [],
          fechaCompra: c.fecha_compra ?? null,
          cuentaId: c.id,
          cuentaLabel: ccLabel(c.id),
        };
      });

      const productNames = new Set<string>();
      for (const item of propertyEstacionamientos) {
        const name = item.id_producto ? productById.get(item.id_producto) : null;
        if (name) productNames.add(name);
      }
      for (const c of productCuentas) {
        const name = productoDeCuenta(c);
        if (name) productNames.add(name);
      }

      const m2Interiores = Number(property.m2_interiores || 0);
      const m2Exteriores = Number(property.m2_exteriores || 0);
      return {
        cuentaId: account.id,
        cuentaLabel: ccLabel(account.id),
        propiedadId: property.id ?? null,
        compradores: buyersByAccount.get(account.id) || [],
        propietario: owner?.nombre_legal || '—',
        propietarioRfc: owner?.rfc || null,
        tipo: (property.id_tipo_propiedad && tipoById.get(property.id_tipo_propiedad)) || 'Propiedad',
        estatusId: property.id_estatus_disponibilidad ?? null,
        estatus: (property.id_estatus_disponibilidad && estatusById.get(property.id_estatus_disponibilidad)) || '—',
        unidad: property.numero_propiedad || '—',
        piso: property.numero_piso || '',
        proyectoId: project?.id ?? null,
        proyecto: project?.nombre || '—',
        edificio: building?.nombre || '—',
        modeloId: model?.id ?? null,
        modelo: model?.nombre || '—',
        estacionamientos: estacionamientosDetalle,
        bodegas: bodegasDetalle,
        paquetes: paquetesDetalle,
        condensadoras: condensadorasDetalle,
        productos: Array.from(productNames),
        tieneCondensadora: condensadorasDetalle.length > 0 || Array.from(productNames).some((n) => CONDENSADORA_RE.test(n)),
        fechaVenta: account.fecha_compra,
        precioFinal: Number(account.precio_final || 0),
        m2Interiores,
        m2Exteriores,
        precioM2: m2Interiores > 0 ? Number(account.precio_final || 0) / m2Interiores : null,
        contratoFirmado: docsForAccount.some((doc: any) => doc.id_tipo_documento === 18 && doc.id_estatus_verificacion === 2),
        contratoUrl: (
          docsForAccount.find((doc: any) => doc.id_tipo_documento === 18 && doc.id_estatus_verificacion === 2) ||
          docsForAccount.find((doc: any) => doc.id_tipo_documento === 18)
        )?.url ?? null,
        ofertaId: account.id_oferta ?? null,
        documentosCount: docsForAccount.length,
        relatedAccounts: productCuentas.map((c: any) => ({
          id: c.id,
          label: ccLabel(c.id),
          tipo: productoDeCuenta(c) || 'Producto / servicio',
          precioFinal: Number(c.precio_final || 0),
        })),
      } satisfies ExpedienteRow;
    })
    .filter(Boolean) as ExpedienteRow[];
}

function groupByProp(rows: any[]): Map<number, any[]> {
  const result = new Map<number, any[]>();
  for (const row of rows) {
    result.set(row.id_propiedad, [...(result.get(row.id_propiedad) || []), row]);
  }
  return result;
}
