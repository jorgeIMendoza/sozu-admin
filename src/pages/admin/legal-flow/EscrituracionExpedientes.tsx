import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Eye, FileCheck2, Loader2, Search, Warehouse, ExternalLink, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows, fetchInBatches } from '@/utils/supabasePagination';

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
  cuentaId: number | null;
  cuentaLabel: string | null;
  tieneCuenta: boolean;
};

type ExpedienteRow = {
  cuentaId: number;
  cuentaLabel: string;
  compradores: Person[];
  propietario: string;
  propietarioRfc: string | null;
  tipo: string;
  unidad: string;
  piso: string;
  proyectoId: number | null;
  proyecto: string;
  edificio: string;
  modeloId: number | null;
  modelo: string;
  estacionamientos: EstacionamientoDetalle[];
  bodegas: BodegaDetalle[];
  productos: string[];
  fechaVenta: string | null;
  precioFinal: number;
  m2Interiores: number;
  m2Exteriores: number;
  precioM2: number | null;
  contratoFirmado: boolean;
  documentosCount: number;
  relatedAccounts: RelatedAccount[];
};

const ELIGIBLE_STATUS = [5, 7, 8, 9];
const ALL_VALUE = 'all';

const fmtMxn = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value || 0);

const fmtMxn2 = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);

const fmtM2 = (value: number) => `${(value || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })} m²`;

const fmtDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ccLabel = (id: number) => `CC-${String(id).padStart(6, '0')}`;

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
  if (!row) return null;
  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setShowBodegas(false); setShowEstac(false); } onOpenChange(o); }}>
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
              <DetailItem label="Precio final" value={fmtMxn(row.precioFinal)} />
              <DetailItem label="Contrato firmado completamente" value={row.contratoFirmado ? 'Validado' : 'Pendiente'} />
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
              <DetailItem label="Precio / m²" value={row.precioM2 ? fmtMxn(row.precioM2) : '—'} />
            </div>
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
                      <td className="px-4 py-2">{buyer.nombre_legal || '—'}</td>
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
          </section>
        </div>
      </DialogContent>
    </Dialog>

    <BodegasModal row={row} open={showBodegas} onOpenChange={setShowBodegas} />
    <EstacionamientosModal row={row} open={showEstac} onOpenChange={setShowEstac} />
    </>
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
                  <td className="px-4 py-2 text-muted-foreground">{bodega.ubicacion || 'N/A'}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">Sin bodegas ligadas</td></tr>
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
  const [modelFilter, setModelFilter] = useState(ALL_VALUE);
  const [floorFilter, setFloorFilter] = useState(ALL_VALUE);
  const [ownerFilter, setOwnerFilter] = useState(ALL_VALUE);
  const [selected, setSelected] = useState<ExpedienteRow | null>(null);

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
  }, [rows, search, projectFilter, modelFilter, floorFilter, ownerFilter, bodegaFilter]);

  return (
    <div className="max-w-[1600px] space-y-6 px-10 py-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-primary">SOZU Legal Flow</p>
          <h1 className="text-[24px] font-bold tracking-tight">Escrituración · Expedientes</h1>
          <p className="text-[13px] text-muted-foreground">
            Cuentas de cobranza de propiedades vendidas o en proceso de escrituración, con bodegas, estacionamientos y productos ligados.
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
        <Select value={modelFilter} onValueChange={setModelFilter}>
          <SelectTrigger className="h-[38px] w-[190px] rounded-lg bg-card text-[13px]"><SelectValue placeholder="Modelo" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_VALUE}>Todos los modelos</SelectItem>{options.models.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={floorFilter} onValueChange={setFloorFilter}>
          <SelectTrigger className="h-[38px] w-[150px] rounded-lg bg-card text-[13px]"><SelectValue placeholder="Piso" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_VALUE}>Todos los pisos</SelectItem>{options.floors.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
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
                <th className="table-head">Unidad</th>
                <th className="table-head">Proyecto</th>
                <th className="table-head">Modelo</th>
                <th className="table-head">Estacionamientos</th>
                <th className="table-head">Bodegas</th>
                <th className="table-head text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="px-5 py-20 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando expedientes...</td></tr>
              ) : error ? (
                <tr><td colSpan={10} className="px-5 py-20 text-center text-sm text-destructive">No se pudieron cargar los expedientes: {(error as Error).message}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-5 py-20 text-center text-sm text-muted-foreground">Sin expedientes que coincidan con los filtros.</td></tr>
              ) : filtered.map((row) => (
                <tr key={row.cuentaId} className="border-t border-border/50 table-row-hover">
                  <td className="table-cell font-mono text-[12px] text-muted-foreground">{row.cuentaLabel}</td>
                  <td className="table-cell text-[13px]">{row.compradores.map((b) => b.nombre_legal).filter(Boolean).join(', ') || '—'}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{row.propietario}</td>
                  <td className="table-cell text-[13px]">{row.tipo}</td>
                  <td className="table-cell text-[13px] font-medium">{row.unidad}</td>
                  <td className="table-cell text-[13px]">{row.proyecto}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{row.modelo}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{row.estacionamientos.length ? row.estacionamientos.map((e) => e.nombre).join(', ') : '—'}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{row.bodegas.length ? row.bodegas.map((b) => b.nombre).join(', ') : '—'}</td>
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
    (supabase as any).from('ofertas').select('id, id_producto').in('id', batch as number[]),
  );
  const offerById = new Map<number, any>(ofertas.map((o: any) => [o.id, o]));
  const ofertaProductIds = [...new Set(ofertas.map((o: any) => o.id_producto).filter(Boolean))] as number[];

  // 3) Propiedades referenciadas por las cuentas, filtradas a estatus elegibles.
  const propIds = [...new Set(cuentas.map((c) => c.id_propiedad).filter(Boolean))] as number[];
  const propiedades = await fetchInBatches<any>(propIds, (batch) =>
    (supabase as any)
      .from('propiedades')
      .select('id, numero_propiedad, id_tipo_propiedad, numero_piso, m2_interiores, m2_exteriores, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad')
      .eq('activo', true)
      .in('id', batch as number[]),
  );
  const eligibleProps = propiedades.filter((p: any) => ELIGIBLE_STATUS.includes(p.id_estatus_disponibilidad));
  if (!eligibleProps.length) return [];
  const eligiblePropIds = new Set<number>(eligibleProps.map((p: any) => p.id));

  // Solo cuentas cuya propiedad es elegible.
  const relevantCuentas = cuentas.filter((c) => c.id_propiedad && eligiblePropIds.has(c.id_propiedad));

  // 4) Dimensiones de la propiedad (edificio → proyecto), dueño y tipo.
  const modelLinkIds = [...new Set(eligibleProps.map((p: any) => p.id_edificio_modelo).filter(Boolean))] as number[];
  const ownerEntityIds = [...new Set(eligibleProps.map((p: any) => p.id_entidad_relacionada_dueno).filter(Boolean))] as number[];
  const tipoIds = [...new Set(eligibleProps.map((p: any) => p.id_tipo_propiedad).filter(Boolean))] as number[];

  const [edificiosModelos, owners, tipos, bodegas, estacionamientos] = await Promise.all([
    fetchInBatches<any>(modelLinkIds, (b) => (supabase as any).from('edificios_modelos').select('id, id_edificio, id_modelo').in('id', b as number[])),
    fetchInBatches<any>(ownerEntityIds, (b) => (supabase as any).from('entidades_relacionadas').select('id, id_persona').in('id', b as number[])),
    fetchInBatches<any>(tipoIds, (b) => (supabase as any).from('tipos_propiedad').select('id, nombre').in('id', b as number[])),
    fetchInBatches<any>([...eligiblePropIds], (b) => (supabase as any).from('bodegas').select('id, id_propiedad, id_producto, nombre, m2, ubicacion').eq('activo', true).in('id_propiedad', b as number[])),
    fetchInBatches<any>([...eligiblePropIds], (b) => (supabase as any).from('estacionamientos').select('id, id_propiedad, id_producto, nombre, id_tipo, m2, ubicacion, es_incluido').eq('activo', true).in('id_propiedad', b as number[])),
  ]);

  // Catálogo de tipos de estacionamiento (Normal, Tandem, Doble, Carlift).
  const estacTipoIds = [...new Set(estacionamientos.map((e: any) => e.id_tipo).filter(Boolean))] as number[];
  const tiposEstac = await fetchInBatches<any>(estacTipoIds, (b) => (supabase as any).from('tipos_estacionamiento').select('id, nombre').in('id', b as number[]));
  const tipoEstacById = new Map<number, string>(tiposEstac.map((t: any) => [t.id, t.nombre as string]));

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

  // 6) Agrupar cuentas por propiedad y clasificar.
  const cuentasByProp = groupByProp(relevantCuentas);
  const mainByProp = new Map<number, any>();        // cuenta de la unidad (venta principal)
  const bodegaCuentasByProp = new Map<number, any[]>();
  const estacCuentasByProp = new Map<number, any[]>();
  const productCuentasByProp = new Map<number, any[]>(); // hermanas con producto (incl. bodegas/estac)
  for (const [propId, list] of cuentasByProp) {
    for (const c of list) {
      if (esCuentaUnidad(c)) {
        const prev = mainByProp.get(propId);
        if (!prev || (c.fecha_compra || c.fecha_creacion || '') > (prev.fecha_compra || prev.fecha_creacion || '')) {
          mainByProp.set(propId, c);
        }
      }
      if (productoDeCuenta(c) != null) {
        productCuentasByProp.set(propId, [...(productCuentasByProp.get(propId) || []), c]);
        if (esCuentaBodega(c)) {
          bodegaCuentasByProp.set(propId, [...(bodegaCuentasByProp.get(propId) || []), c]);
        } else if (esCuentaEstacionamiento(c)) {
          estacCuentasByProp.set(propId, [...(estacCuentasByProp.get(propId) || []), c]);
        }
      }
    }
  }

  // 7) Compradores, documentos (de la cuenta de la unidad) y pagos (de bodegas).
  const mainAccountIds = [...mainByProp.values()].map((c) => c.id as number);
  const bodegaCuentaIds = [...new Set([...bodegaCuentasByProp.values()].flat().map((c: any) => c.id))] as number[];

  const [compradores, docs, acuerdos] = await Promise.all([
    fetchInBatches<any>(mainAccountIds, (b) => (supabase as any).from('compradores').select('id_cuenta_cobranza, id_persona').eq('activo', true).in('id_cuenta_cobranza', b as number[])),
    fetchInBatches<any>(mainAccountIds, (b) => (supabase as any).from('documentos').select('id, id_cuenta_cobranza, id_tipo_documento, id_estatus_verificacion').eq('activo', true).in('id_cuenta_cobranza', b as number[])),
    fetchInBatches<any>(bodegaCuentaIds, (b) => (supabase as any).from('acuerdos_pago').select('id, id_cuenta_cobranza').eq('activo', true).in('id_cuenta_cobranza', b as number[])),
  ]);

  // Total pagado por cuenta de bodega — Σ aplicaciones_pago.monto (es_multa=false)
  // vía acuerdos_pago (fuente de verdad, CLAUDE.md).
  const acuerdoIds = [...new Set(acuerdos.map((a: any) => a.id).filter(Boolean))] as number[];
  const aplicaciones = await fetchInBatches<any>(acuerdoIds, (b) =>
    (supabase as any).from('aplicaciones_pago').select('id_acuerdo_pago, monto, es_multa').eq('activo', true).in('id_acuerdo_pago', b as number[]),
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
      const account = mainByProp.get(property.id);
      if (!account) return null; // sin venta de unidad → no es expediente de escrituración
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
          cuentaId: cuenta?.id ?? null,
          cuentaLabel: cuenta ? ccLabel(cuenta.id) : null,
          tieneCuenta: !!cuenta,
        });
      }

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
        compradores: buyersByAccount.get(account.id) || [],
        propietario: owner?.nombre_legal || '—',
        propietarioRfc: owner?.rfc || null,
        tipo: (property.id_tipo_propiedad && tipoById.get(property.id_tipo_propiedad)) || 'Propiedad',
        unidad: property.numero_propiedad || '—',
        piso: property.numero_piso || '',
        proyectoId: project?.id ?? null,
        proyecto: project?.nombre || '—',
        edificio: building?.nombre || '—',
        modeloId: model?.id ?? null,
        modelo: model?.nombre || '—',
        estacionamientos: estacionamientosDetalle,
        bodegas: bodegasDetalle,
        productos: Array.from(productNames),
        fechaVenta: account.fecha_compra,
        precioFinal: Number(account.precio_final || 0),
        m2Interiores,
        m2Exteriores,
        precioM2: m2Interiores > 0 ? Number(account.precio_final || 0) / m2Interiores : null,
        contratoFirmado: docsForAccount.some((doc: any) => doc.id_tipo_documento === 18 && doc.id_estatus_verificacion === 2),
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
