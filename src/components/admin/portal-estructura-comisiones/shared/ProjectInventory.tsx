import { useState, useMemo, useRef } from 'react';
import { useInventory } from '@/store/InventoryContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import type { InventoryUnit, UnitStatus } from '@/types/inventory';
import { Upload, Search, Filter, Package, DollarSign, Home, AlertCircle, Trash2, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

const STATUS_LABELS: Record<UnitStatus, string> = {
  available: 'Disponible',
  sold: 'Vendido',
  blocked: 'Bloqueado',
  aportante: 'Aportante',
  apartado: 'Apartado',
  reserved_internal: 'Reserva interna',
};

const STATUS_COLORS: Record<UnitStatus, string> = {
  available: 'bg-primary text-primary-foreground',
  sold: 'bg-muted text-muted-foreground',
  blocked: 'bg-destructive text-destructive-foreground',
  aportante: 'bg-info/15 text-info',
  apartado: 'bg-warning/15 text-warning',
  reserved_internal: 'bg-secondary text-secondary-foreground',
};

interface Props {
  projectId: string;
}

export default function ProjectInventory({ projectId }: Props) {
  const { getProjectUnits, importUnits, updateUnit, deleteUnit, getProjectLogs } = useInventory();
  const units = getProjectUnits(projectId);
  const logs = getProjectLogs(projectId);
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [filterModel, setFilterModel] = useState('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTower, setFilterTower] = useState('all');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<InventoryUnit[]>([]);
  const [previewFileName, setPreviewFileName] = useState('');

  const models = useMemo(() => [...new Set(units.map(u => u.model))].sort(), [units]);
  const towers = useMemo(() => [...new Set(units.filter(u => u.tower).map(u => u.tower!))].sort(), [units]);

  const filtered = useMemo(() => {
    return units.filter(u => {
      if (filterModel !== 'all' && u.model !== filterModel) return false;
      if (filterStatus !== 'all' && u.status !== filterStatus) return false;
      if (filterTower !== 'all' && u.tower !== filterTower) return false;
      if (search) {
        const q = search.toLowerCase();
        return u.unitId.toLowerCase().includes(q) || u.model.toLowerCase().includes(q) || (u.tower || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [units, filterModel, filterStatus, filterTower, search]);

  // KPIs
  const kpis = useMemo(() => {
    const available = units.filter(u => u.status === 'available');
    const sold = units.filter(u => u.status === 'sold');
    const blocked = units.filter(u => u.status === 'blocked');
    const totalValue = units.reduce((s, u) => s + u.currentPrice, 0);
    const avgPrice = units.length ? totalValue / units.length : 0;
    return {
      totalValue, avgPrice,
      available: available.length,
      sold: sold.length,
      blocked: blocked.length,
      total: units.length,
    };
  }, [units]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error('Solo se permiten archivos CSV');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseCSV(text, projectId);
        setPreviewData(parsed);
        setPreviewFileName(file.name);
        setPreviewOpen(true);
      } catch (err) {
        toast.error('Error al procesar el archivo CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    importUnits(projectId, previewData, previewFileName);
    setPreviewOpen(false);
    setPreviewData([]);
    toast.success(`${previewData.length} unidades importadas correctamente`);
  };

  const handleStatusChange = (unit: InventoryUnit, status: UnitStatus) => {
    updateUnit({ ...unit, status });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">Inventario de Unidades</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>El inventario cargado se utiliza para simular escenarios con mayor precisión, reemplazando los promedios generales.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
          <Button size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Cargar Inventario (CSV)
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {units.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard icon={<DollarSign className="h-4 w-4 text-primary" />} label="Valor Total" value={formatCurrency(kpis.totalValue)} />
          <KPICard icon={<DollarSign className="h-4 w-4 text-primary" />} label="Precio Promedio" value={formatCurrency(kpis.avgPrice)} />
          <KPICard icon={<Home className="h-4 w-4 text-primary" />} label="Disponibles" value={formatNumber(kpis.available)} />
          <KPICard icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />} label="Vendidas" value={formatNumber(kpis.sold)} />
          <KPICard icon={<AlertCircle className="h-4 w-4 text-destructive" />} label="Bloqueadas" value={formatNumber(kpis.blocked)} />
          <KPICard icon={<Package className="h-4 w-4 text-foreground" />} label="Total Unidades" value={formatNumber(kpis.total)} />
        </div>
      )}

      {/* Filters */}
      {units.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar unidad…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterModel} onValueChange={setFilterModel}>
            <SelectTrigger className="w-[160px]"><Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Modelo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los modelos</SelectItem>
              {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          {towers.length > 0 && (
            <Select value={filterTower} onValueChange={setFilterTower}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Torre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las torres</SelectItem>
                {towers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estatus" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="available">Disponible</SelectItem>
              <SelectItem value="sold">Vendido</SelectItem>
              <SelectItem value="blocked">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Table */}
      {units.length > 0 ? (
        <div className="border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">ID Unidad</TableHead>
                {towers.length > 0 && <TableHead className="text-xs uppercase tracking-wider">Torre</TableHead>}
                <TableHead className="text-xs uppercase tracking-wider">Nivel</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Modelo</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">m²</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Precio Lista</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Precio Actual</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Estatus</TableHead>
                <TableHead className="text-xs uppercase tracking-wider w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(unit => (
                <TableRow key={unit.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{unit.unitId}</TableCell>
                  {towers.length > 0 && <TableCell>{unit.tower || '—'}</TableCell>}
                  <TableCell>{unit.level}</TableCell>
                  <TableCell>{unit.model}</TableCell>
                  <TableCell className="text-right tabular-nums">{unit.sqm}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(unit.listPrice)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(unit.currentPrice)}</TableCell>
                  <TableCell>
                    <Select value={unit.status} onValueChange={(v) => handleStatusChange(unit, v as UnitStatus)}>
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[unit.status]}`}>
                          {STATUS_LABELS[unit.status]}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Disponible</SelectItem>
                        <SelectItem value="sold">Vendido</SelectItem>
                        <SelectItem value="blocked">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <button onClick={() => deleteUnit(unit.id)} className="rounded-md p-1 hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 py-2 border-t text-xs text-muted-foreground">
            Mostrando {filtered.length} de {units.length} unidades
          </div>
        </div>
      ) : (
        <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Sin inventario cargado</p>
          <p className="text-xs mt-1">Sube un archivo CSV para cargar el inventario de este proyecto</p>
        </div>
      )}

      {/* Upload Logs */}
      {logs.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Historial de cargas:</p>
          {logs.slice(-3).reverse().map(l => (
            <p key={l.id}>📄 {l.fileName} — {l.unitsCount} unidades — {new Date(l.uploadedAt).toLocaleDateString('es-MX')}</p>
          ))}
        </div>
      )}

      {/* CSV Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Preview de importación — {previewFileName}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">{previewData.length} unidades detectadas. Revisa los datos antes de importar.</p>
          <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ID</TableHead>
                  <TableHead className="text-xs">Torre</TableHead>
                  <TableHead className="text-xs">Nivel</TableHead>
                  <TableHead className="text-xs">Modelo</TableHead>
                  <TableHead className="text-xs text-right">m²</TableHead>
                  <TableHead className="text-xs text-right">Precio</TableHead>
                  <TableHead className="text-xs">Estatus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.slice(0, 20).map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="text-xs">{u.unitId}</TableCell>
                    <TableCell className="text-xs">{u.tower || '—'}</TableCell>
                    <TableCell className="text-xs">{u.level}</TableCell>
                    <TableCell className="text-xs">{u.model}</TableCell>
                    <TableCell className="text-xs text-right">{u.sqm}</TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(u.currentPrice)}</TableCell>
                    <TableCell className="text-xs">{STATUS_LABELS[u.status] || u.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {previewData.length > 20 && (
              <p className="text-xs text-center text-muted-foreground py-2">…y {previewData.length - 20} unidades más</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancelar</Button>
            <Button onClick={confirmImport}>Importar {previewData.length} unidades</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPICard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="flex items-center gap-1.5 mb-1">{icon}</div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

// CSV Parser
function parseCSV(text: string, projectId: string): InventoryUnit[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV vacío');

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));

  // Find column indices (flexible mapping)
  const find = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));
  const iId = find(['id unidad', 'id_unidad', 'unidad', 'unit_id', 'unit']);
  const iTower = find(['torre', 'tower']);
  const iLevel = find(['nivel', 'level', 'piso', 'floor']);
  const iModel = find(['modelo', 'model', 'tipolog', 'tipo']);
  const iSqm = find(['m2', 'metros', 'sqm', 'superficie', 'area']);
  const iListPrice = find(['precio lista', 'precio_lista', 'list_price', 'precio original']);
  const iCurrentPrice = find(['precio actual', 'precio_actual', 'current_price', 'precio']);
  const iStatus = find(['estatus', 'status', 'estado']);
  const iDelivery = find(['fecha entrega', 'entrega', 'delivery']);

  if (iId === -1 || iModel === -1) throw new Error('Columnas obligatorias no encontradas (ID Unidad, Modelo)');

  const now = new Date().toISOString();
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    const price = parseFloat(cols[iCurrentPrice] || cols[iListPrice] || '0') || 0;
    const statusRaw = (cols[iStatus] || 'disponible').toLowerCase();
    let status: UnitStatus = 'available';
    if (statusRaw.includes('vend')) status = 'sold';
    else if (statusRaw.includes('bloq')) status = 'blocked';

    return {
      id: crypto.randomUUID(),
      projectId,
      unitId: cols[iId] || '',
      tower: iTower >= 0 ? cols[iTower] : undefined,
      level: iLevel >= 0 ? cols[iLevel] || '' : '',
      model: cols[iModel] || '',
      sqm: parseFloat(cols[iSqm] || '0') || 0,
      listPrice: parseFloat(cols[iListPrice] || '0') || price,
      currentPrice: price,
      status,
      estimatedDelivery: iDelivery >= 0 ? cols[iDelivery] : undefined,
      createdAt: now,
      updatedAt: now,
    };
  }).filter(u => u.unitId);
}
