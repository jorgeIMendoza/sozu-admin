import { useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useInventory } from '@/lib/portal-estructura-comisiones/stores/InventoryContext';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import type { InventoryUnit, UnitStatus, AuthorizedChannel } from '@/lib/portal-estructura-comisiones/types/inventory';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_LABEL: Record<UnitStatus, string> = {
  available: 'Disponible', sold: 'Vendida', blocked: 'Bloqueada',
  aportante: 'Aportante', apartado: 'Apartada', reserved_internal: 'Reserva interna',
};
const STATUS_COLOR: Record<UnitStatus, string> = {
  available: 'bg-success/10 text-success border-success/20',
  sold: 'bg-muted text-muted-foreground border-border',
  blocked: 'bg-destructive/10 text-destructive border-destructive/20',
  aportante: 'bg-info/10 text-info border-info/20',
  apartado: 'bg-warning/10 text-warning border-warning/20',
  reserved_internal: 'bg-secondary text-secondary-foreground border-border',
};

const CHANNEL_LABEL: Record<AuthorizedChannel, string> = {
  internal: 'Interno', brokers: 'Brokers', both: 'Ambos', committee: 'Comité', invitation: 'Invitación',
};

// Parse one CSV line honoring double quotes
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') inQ = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// Normalize header: lowercase, strip accents, collapse non-alnum
function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Parse a numeric/currency cell ("$22,115,622.40" → 22115622.4)
function parseNum(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.\-]/g, '');
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

const STATUS_MAP: Record<string, UnitStatus> = {
  disponible: 'available', available: 'available',
  vendida: 'sold', vendido: 'sold', sold: 'sold',
  bloqueada: 'blocked', bloqueado: 'blocked', blocked: 'blocked',
  aportante: 'aportante',
  apartada: 'apartado', apartado: 'apartado',
  reserva_interna: 'reserved_internal', reserved_internal: 'reserved_internal',
};

const CHANNEL_MAP: Record<string, AuthorizedChannel> = {
  interno: 'internal', internal: 'internal',
  brokers: 'brokers', broker: 'brokers', externo: 'brokers',
  ambos: 'both', both: 'both',
  comite: 'committee', committee: 'committee',
  invitacion: 'invitation', invitation: 'invitation',
};

function parseCsv(text: string, projectId: string): InventoryUnit[] {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(normKey);
  const idx = (...keys: string[]) => {
    for (const k of keys) {
      const i = headers.indexOf(k);
      if (i >= 0) return i;
    }
    return -1;
  };
  const colUnit   = idx('unit_id', 'no_propiedad', 'depto', 'dept_number', 'no');
  const colTower  = idx('tower', 'edificio', 'torre');
  const colLevel  = idx('level', 'piso', 'nivel');
  const colModel  = idx('model', 'modelo', 'tipologia');
  const colInt    = idx('sqm_interior', 'm2_interiores', 'interiores');
  const colExt    = idx('sqm_terrace', 'm2_exteriores', 'exteriores', 'terraza');
  const colReal   = idx('sqm_sellable', 'sqm', 'm2_reales', 'm2_vendibles', 'm2');
  const colBeds   = idx('bedrooms', 'recamaras', 'reamaras', 'habitaciones');
  const colBaths  = idx('bathrooms', 'banos_completos', 'banos');
  const colHalf   = idx('half_bathrooms', 'medio_bano', 'mediobano');
  const colPark   = idx('parking', 'estacionamientos', 'cajones');
  const colStor   = idx('storage', 'bodegas', 'bodega');
  const colView   = idx('view', 'vista');
  const colOri    = idx('orientation', 'orientacion');
  const colPrice  = idx('list_price', 'price', 'precio_lista', 'precio');
  const colPpm    = idx('price_per_sqm', 'precio_m2');
  const colStatus = idx('status', 'disponibilidad', 'estatus', 'estado');
  const colChan   = idx('authorized_channel', 'canal', 'canal_autorizado');
  const colDisc   = idx('max_discount_pct', 'descuento_max', 'descuento_maximo');
  const colCom    = idx('comments', 'comentarios', 'notas');

  const now = new Date().toISOString();
  const cell = (cells: string[], i: number) => (i >= 0 && i < cells.length ? cells[i] : '');

  return lines.slice(1).filter(Boolean).map((line, i) => {
    const c = splitCsvLine(line);
    const sqmInt   = parseNum(cell(c, colInt));
    const sqmExt   = parseNum(cell(c, colExt));
    const sqmReal  = parseNum(cell(c, colReal)) || (sqmInt + sqmExt);
    const listPrice = parseNum(cell(c, colPrice));
    const baths = parseNum(cell(c, colBaths));
    const half  = parseNum(cell(c, colHalf));
    const rawStatus = normKey(cell(c, colStatus));
    const rawChan   = normKey(cell(c, colChan));
    return {
      id: crypto.randomUUID(),
      projectId,
      unitId: cell(c, colUnit) || `U-${i + 1}`,
      tower: cell(c, colTower) || undefined,
      level: cell(c, colLevel) || '1',
      model: cell(c, colModel) || 'Tipo A',
      sqm: sqmReal,
      listPrice,
      currentPrice: listPrice,
      status: STATUS_MAP[rawStatus] || 'available',
      createdAt: now,
      updatedAt: now,
      deptNumber: cell(c, colUnit) || undefined,
      sqmInterior: sqmInt || undefined,
      sqmTerrace: sqmExt || undefined,
      sqmSellable: sqmReal || undefined,
      bedrooms: parseNum(cell(c, colBeds)) || undefined,
      bathrooms: baths ? baths + half * 0.5 : undefined,
      parking: parseNum(cell(c, colPark)) || undefined,
      storage: parseNum(cell(c, colStor)) || undefined,
      orientation: cell(c, colOri) || undefined,
      view: cell(c, colView) || undefined,
      pricePerSqm: parseNum(cell(c, colPpm)) || (sqmReal ? Math.round(listPrice / sqmReal) : undefined),
      authorizedChannel: (CHANNEL_MAP[rawChan] as AuthorizedChannel) || undefined,
      maxDiscountPct: parseNum(cell(c, colDisc)) || undefined,
      comments: cell(c, colCom) || undefined,
    } as InventoryUnit;
  });
}

export default function InventoryAdvancedTab() {
  const { units, importUnits, getProjectUnits } = useInventory();
  const { projects } = useSimulator();
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [filterTower, setFilterTower] = useState('all');
  const [filterModel, setFilterModel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const projectUnits = projectId ? getProjectUnits(projectId) : [];

  const towers = useMemo(() => Array.from(new Set(projectUnits.map(u => u.tower).filter(Boolean))) as string[], [projectUnits]);
  const models = useMemo(() => Array.from(new Set(projectUnits.map(u => u.model))), [projectUnits]);
  const levels = useMemo(() => Array.from(new Set(projectUnits.map(u => u.level))).sort((a, b) => Number(a) - Number(b)), [projectUnits]);

  const filtered = projectUnits.filter(u => {
    if (filterTower !== 'all' && u.tower !== filterTower) return false;
    if (filterModel !== 'all' && u.model !== filterModel) return false;
    if (filterStatus !== 'all' && u.status !== filterStatus) return false;
    if (filterChannel !== 'all' && u.authorizedChannel !== filterChannel) return false;
    if (search && !u.unitId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleFile = async (file: File) => {
    if (!projectId) { toast.error('Selecciona un proyecto'); return; }
    const text = await file.text();
    const parsed = parseCsv(text, projectId);
    if (parsed.length === 0) { toast.error('No se pudieron leer unidades del CSV'); return; }
    importUnits(projectId, parsed, file.name);
    toast.success(`${parsed.length} unidades importadas`);
  };

  const downloadSample = async () => {
    try {
      const res = await fetch('/templates/inventario-plantilla.csv');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'inventario-plantilla.sozu.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo descargar la plantilla');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Inventario y Precios — Command Center</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Proyecto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Selecciona proyecto" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={!projectId}>
                <Upload className="h-4 w-4 mr-2" /> Importar CSV
              </Button>
              <Button variant="outline" onClick={downloadSample}>
                <Download className="h-4 w-4 mr-2" /> Plantilla
              </Button>
              <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {projectUnits.length} unidades cargadas
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Input placeholder="Buscar unidad..." value={search} onChange={e => setSearch(e.target.value)} />
            <Select value={filterTower} onValueChange={setFilterTower}>
              <SelectTrigger><SelectValue placeholder="Torre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las torres</SelectItem>
                {towers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterModel} onValueChange={setFilterModel}>
              <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los modelos</SelectItem>
                {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Estatus" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estatus</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los canales</SelectItem>
                {Object.entries(CHANNEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Tabla</TabsTrigger>
          <TabsTrigger value="tower">Por torre</TabsTrigger>
          <TabsTrigger value="matrix">Matriz por nivel</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Torre / Nivel</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">m² vend.</TableHead>
                    <TableHead className="text-right">Precio lista</TableHead>
                    <TableHead className="text-right">$ / m²</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin unidades. Importa un CSV para comenzar.</TableCell></TableRow>
                  )}
                  {filtered.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.unitId}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.tower ?? '—'} / N{u.level}</TableCell>
                      <TableCell>{u.model}</TableCell>
                      <TableCell className="text-right">{u.sqmSellable ?? u.sqm}</TableCell>
                      <TableCell className="text-right">${u.currentPrice.toLocaleString('es-MX')}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{u.pricePerSqm ? `$${u.pricePerSqm.toLocaleString('es-MX')}` : '—'}</TableCell>
                      <TableCell>{u.authorizedChannel ? <Badge variant="outline" className="text-xs">{CHANNEL_LABEL[u.authorizedChannel]}</Badge> : '—'}</TableCell>
                      <TableCell><Badge className={`text-xs border ${STATUS_COLOR[u.status]}`}>{STATUS_LABEL[u.status]}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tower" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(towers.length === 0 ? ['—'] : towers).map(t => {
              const items = filtered.filter(u => (u.tower ?? '—') === t);
              const value = items.reduce((s, u) => s + u.currentPrice, 0);
              const avail = items.filter(u => u.status === 'available').length;
              return (
                <Card key={t}>
                  <CardHeader className="pb-2">
                    <CardTitle>Torre {t}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Unidades</span><span className="font-medium">{items.length}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Disponibles</span><span className="font-medium text-success">{avail}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-medium">${(value / 1_000_000).toFixed(1)}M</span></div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardContent className="p-4 overflow-auto">
              {levels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos.</p>
              ) : (
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-muted-foreground">Nivel</th>
                      {towers.map(t => <th key={t} className="text-left p-2 text-muted-foreground">Torre {t}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {levels.map(lv => (
                      <tr key={lv} className="border-t border-border">
                        <td className="p-2 font-medium">N{lv}</td>
                        {towers.map(t => {
                          const cell = filtered.filter(u => u.level === lv && u.tower === t);
                          return (
                            <td key={t} className="p-2 align-top">
                              <div className="flex flex-wrap gap-1">
                                {cell.map(u => (
                                  <span
                                    key={u.id}
                                    title={`${u.unitId} · $${u.currentPrice.toLocaleString('es-MX')}`}
                                    className={`px-1.5 py-0.5 rounded border text-[10px] ${STATUS_COLOR[u.status]}`}
                                  >
                                    {u.unitId}
                                  </span>
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
