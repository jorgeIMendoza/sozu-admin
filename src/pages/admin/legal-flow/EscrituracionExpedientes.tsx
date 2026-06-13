import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Eye, FileCheck2, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

type Person = { id: number; nombre_legal: string | null; rfc: string | null };
type Option = { id: string; label: string };

type RelatedAccount = {
  id: number;
  label: string;
  tipo: string;
  precioFinal: number;
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
  estacionamientos: string[];
  bodegas: string[];
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
  if (!row) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <DetailItem label="Estacionamientos" value={joinNames(row.estacionamientos)} />
              <DetailItem label="Bodegas" value={joinNames(row.bodegas)} />
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
  );
}

export default function LegalFlowEscrituracionExpedientes() {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState(ALL_VALUE);
  const [bodegaFilter, setBodegaFilter] = useState(ALL_VALUE);
  const [modelFilter, setModelFilter] = useState(ALL_VALUE);
  const [floorFilter, setFloorFilter] = useState(ALL_VALUE);
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
    return { projects, models, floors };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (projectFilter !== ALL_VALUE && String(row.proyectoId) !== projectFilter) return false;
      if (modelFilter !== ALL_VALUE && String(row.modeloId) !== modelFilter) return false;
      if (floorFilter !== ALL_VALUE && row.piso !== floorFilter) return false;
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
  }, [rows, search, projectFilter, modelFilter, floorFilter, bodegaFilter]);

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
                  <td className="table-cell text-[13px] text-muted-foreground">{joinNames(row.estacionamientos)}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{joinNames(row.bodegas)}</td>
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

async function fetchExpedientes(): Promise<ExpedienteRow[]> {
  const { data: props, error: propError } = await (supabase as any)
    .from('propiedades')
    .select('id, numero_propiedad, id_tipo_propiedad, numero_piso, m2_interiores, m2_exteriores, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad')
    .eq('activo', true)
    .in('id_estatus_disponibilidad', ELIGIBLE_STATUS)
    .order('numero_propiedad');
  if (propError) throw propError;
  const propertyRows = (props || []) as any[];
  if (!propertyRows.length) return [];

  const propIds = propertyRows.map((p) => p.id as number);
  const modelLinkIds = [...new Set(propertyRows.map((p) => p.id_edificio_modelo).filter(Boolean))] as number[];
  const ownerEntityIds = [...new Set(propertyRows.map((p) => p.id_entidad_relacionada_dueno).filter(Boolean))] as number[];
  const tipoIds = [...new Set(propertyRows.map((p) => p.id_tipo_propiedad).filter(Boolean))] as number[];

  const [{ data: cuentas }, { data: edificiosModelos }, { data: owners }, { data: bodegas }, { data: estacionamientos }, { data: tipos }] = await Promise.all([
    (supabase as any).from('cuentas_cobranza').select('id, id_propiedad, id_oferta, id_cuenta_cobranza_padre, precio_final, fecha_compra, fecha_creacion').eq('activo', true).in('id_propiedad', propIds),
    modelLinkIds.length ? (supabase as any).from('edificios_modelos').select('id, id_edificio, id_modelo').in('id', modelLinkIds) : Promise.resolve({ data: [] }),
    ownerEntityIds.length ? (supabase as any).from('entidades_relacionadas').select('id, id_persona').in('id', ownerEntityIds) : Promise.resolve({ data: [] }),
    (supabase as any).from('bodegas').select('id, id_propiedad, id_producto, nombre').eq('activo', true).in('id_propiedad', propIds),
    (supabase as any).from('estacionamientos').select('id, id_propiedad, id_producto, nombre').eq('activo', true).in('id_propiedad', propIds),
    tipoIds.length ? (supabase as any).from('tipos_propiedad').select('id, nombre').in('id', tipoIds) : Promise.resolve({ data: [] }),
  ]);

  const linkRows = (edificiosModelos || []) as any[];
  const buildingIds = [...new Set(linkRows.map((m) => m.id_edificio).filter(Boolean))] as number[];
  const modelIds = [...new Set(linkRows.map((m) => m.id_modelo).filter(Boolean))] as number[];
  const ownerPersonIds = [...new Set((owners || []).map((o: any) => o.id_persona).filter(Boolean))] as number[];

  const [{ data: edificios }, { data: modelos }, { data: ownerPeople }] = await Promise.all([
    buildingIds.length ? (supabase as any).from('edificios').select('id, nombre, id_proyecto').in('id', buildingIds) : Promise.resolve({ data: [] }),
    modelIds.length ? (supabase as any).from('modelos').select('id, nombre').in('id', modelIds) : Promise.resolve({ data: [] }),
    ownerPersonIds.length ? (supabase as any).from('personas').select('id, nombre_legal, rfc').in('id', ownerPersonIds) : Promise.resolve({ data: [] }),
  ]);

  const projectIds = [...new Set((edificios || []).map((e: any) => e.id_proyecto).filter(Boolean))] as number[];
  const { data: proyectos } = projectIds.length
    ? await (supabase as any).from('proyectos').select('id, nombre').in('id', projectIds)
    : { data: [] };

  const mainAccounts = ((cuentas || []) as any[]).filter((c) => !c.id_cuenta_cobranza_padre);
  const mainAccountIds = mainAccounts.map((c) => c.id as number);
  const [{ data: childAccounts }, { data: compradores }, { data: docs }] = await Promise.all([
    mainAccountIds.length ? (supabase as any).from('cuentas_cobranza').select('id, id_propiedad, id_oferta, id_cuenta_cobranza_padre, precio_final').eq('activo', true).in('id_cuenta_cobranza_padre', mainAccountIds) : Promise.resolve({ data: [] }),
    mainAccountIds.length ? (supabase as any).from('compradores').select('id_cuenta_cobranza, id_persona').eq('activo', true).in('id_cuenta_cobranza', mainAccountIds) : Promise.resolve({ data: [] }),
    mainAccountIds.length ? (supabase as any).from('documentos').select('id, id_cuenta_cobranza, id_persona, id_tipo_documento, id_estatus_verificacion').eq('activo', true).in('id_cuenta_cobranza', mainAccountIds) : Promise.resolve({ data: [] }),
  ]);

  const ofertaIds = [...new Set([
    ...(cuentas || []).map((c: any) => c.id_oferta).filter(Boolean),
    ...(childAccounts || []).map((c: any) => c.id_oferta).filter(Boolean),
  ])] as number[];
  const { data: ofertas } = ofertaIds.length
    ? await (supabase as any).from('ofertas').select('id, id_producto').in('id', ofertaIds)
    : { data: [] };

  const buyerPersonIds = [...new Set((compradores || []).map((c: any) => c.id_persona).filter(Boolean))] as number[];
  const productIds = [...new Set([
    ...(ofertas || []).map((o: any) => o.id_producto).filter(Boolean),
    ...(bodegas || []).map((b: any) => b.id_producto).filter(Boolean),
    ...(estacionamientos || []).map((e: any) => e.id_producto).filter(Boolean),
  ])] as number[];

  const [{ data: buyerPeople }, { data: productos }] = await Promise.all([
    buyerPersonIds.length ? (supabase as any).from('personas').select('id, nombre_legal, rfc').in('id', buyerPersonIds) : Promise.resolve({ data: [] }),
    productIds.length ? (supabase as any).from('productos_servicios').select('id, nombre').in('id', productIds) : Promise.resolve({ data: [] }),
  ]);

  const linkById = new Map<number, any>(linkRows.map((row) => [row.id, row]));
  const buildingById = new Map<number, any>((edificios || []).map((row: any) => [row.id, row]));
  const modelById = new Map<number, any>((modelos || []).map((row: any) => [row.id, row]));
  const projectById = new Map<number, any>((proyectos || []).map((row: any) => [row.id, row]));
  const ownerEntityToPerson = new Map<number, number>((owners || []).map((row: any) => [row.id, row.id_persona]));
  const personById = new Map<number, Person>([...(ownerPeople || []), ...(buyerPeople || [])].map((row: any) => [row.id, row as Person]));
  const offerById = new Map<number, any>((ofertas || []).map((row: any) => [row.id, row]));
  const productById = new Map<number, string>((productos || []).map((row: any) => [row.id, row.nombre as string]));
  const tipoById = new Map<number, string>((tipos || []).map((row: any) => [row.id, row.nombre as string]));

  const mainByProp = new Map<number, any>();
  for (const account of mainAccounts) {
    if (!account.id_propiedad) continue;
    const previous = mainByProp.get(account.id_propiedad);
    if (!previous || (account.fecha_compra || account.fecha_creacion || '') > (previous.fecha_compra || previous.fecha_creacion || '')) {
      mainByProp.set(account.id_propiedad, account);
    }
  }

  const buyersByAccount = new Map<number, Person[]>();
  for (const buyer of compradores || []) {
    const person = personById.get(buyer.id_persona) || { id: buyer.id_persona, nombre_legal: '—', rfc: null };
    buyersByAccount.set(buyer.id_cuenta_cobranza, [...(buyersByAccount.get(buyer.id_cuenta_cobranza) || []), person]);
  }

  const childByParent = new Map<number, any[]>();
  for (const account of childAccounts || []) {
    childByParent.set(account.id_cuenta_cobranza_padre, [...(childByParent.get(account.id_cuenta_cobranza_padre) || []), account]);
  }

  const bodegasByProp = groupByProp(bodegas || []);
  const estacionamientosByProp = groupByProp(estacionamientos || []);
  const docsByAccount = new Map<number, any[]>();
  for (const doc of docs || []) {
    if (!doc.id_cuenta_cobranza) continue;
    docsByAccount.set(doc.id_cuenta_cobranza, [...(docsByAccount.get(doc.id_cuenta_cobranza) || []), doc]);
  }

  return propertyRows
    .map((property) => {
      const account = mainByProp.get(property.id);
      if (!account) return null;
      const link = linkById.get(property.id_edificio_modelo);
      const building = link ? buildingById.get(link.id_edificio) : null;
      const model = link ? modelById.get(link.id_modelo) : null;
      const project = building ? projectById.get(building.id_proyecto) : null;
      const ownerPersonId = ownerEntityToPerson.get(property.id_entidad_relacionada_dueno);
      const owner = ownerPersonId ? personById.get(ownerPersonId) : null;
      const propertyBodegas = bodegasByProp.get(property.id) || [];
      const propertyEstacionamientos = estacionamientosByProp.get(property.id) || [];
      const children = childByParent.get(account.id) || [];
      const docsForAccount = docsByAccount.get(account.id) || [];
      const productNames = new Set<string>();
      for (const item of [...propertyBodegas, ...propertyEstacionamientos]) {
        const name = item.id_producto ? productById.get(item.id_producto) : null;
        if (name) productNames.add(name);
      }
      for (const child of children) {
        const offer = child.id_oferta ? offerById.get(child.id_oferta) : null;
        const name = offer?.id_producto ? productById.get(offer.id_producto) : null;
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
        estacionamientos: propertyEstacionamientos.map((item: any) => item.nombre).filter(Boolean),
        bodegas: propertyBodegas.map((item: any) => item.nombre).filter(Boolean),
        productos: Array.from(productNames),
        fechaVenta: account.fecha_compra,
        precioFinal: Number(account.precio_final || 0),
        m2Interiores,
        m2Exteriores,
        precioM2: m2Interiores > 0 ? Number(account.precio_final || 0) / m2Interiores : null,
        contratoFirmado: docsForAccount.some((doc: any) => doc.id_tipo_documento === 18 && doc.id_estatus_verificacion === 2),
        documentosCount: docsForAccount.length,
        relatedAccounts: children.map((child: any) => {
          const offer = child.id_oferta ? offerById.get(child.id_oferta) : null;
          const product = offer?.id_producto ? productById.get(offer.id_producto) : null;
          return { id: child.id, label: ccLabel(child.id), tipo: product || 'Producto / servicio', precioFinal: Number(child.precio_final || 0) };
        }),
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
