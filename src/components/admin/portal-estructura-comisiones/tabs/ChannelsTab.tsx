import { useMemo, useState } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Info, AlertTriangle, FileText, Plus, Search, MoreHorizontal, Pencil, Copy, Trash2, History,
  ArrowUpDown, Power, PowerOff,
} from 'lucide-react';
import { toast } from 'sonner';
import ChannelDetailDrawer from '../shared/ChannelDetailDrawer';
import type { Channel } from '@/lib/portal-estructura-comisiones/types/simulator';

const CATEGORIES = [
  'Externo', 'Interno', 'Referido', 'Institucional', 'Patrimonial', 'Internacional',
  'Corporativo', 'Embajadores', 'Influencer', 'Otros',
];

type SortKey = 'name' | 'category' | 'baseCommissionPct' | 'createdAt';

const emptyChannel = (): Channel => ({
  id: '',
  name: '',
  externalCommissionPct: 0,
  minCommissionPct: 0,
  maxCommissionPct: 0,
  active: true,
  code: '',
  description: '',
  category: 'Externo',
  baseCommissionPct: 0,
  participatesInScaling: true,
  participatesInBonuses: true,
  participatesInSimulators: true,
  requiresOnboarding: false,
  requiresTraining: false,
  requiresApproval: false,
  leadProtectionDays: 0,
});

export default function ChannelsTab() {
  const { channels, addChannel, updateChannel, duplicateChannel, deleteChannel, getChannelDependencies } = useSimulator();

  // UI state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [form, setForm] = useState<Channel>(emptyChannel());

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [depsList, setDepsList] = useState<string[]>([]);

  // History sheet
  const [historyChannelId, setHistoryChannelId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Derived
  const activeCount = channels.filter(c => c.active !== false).length;
  const inactiveCount = channels.length - activeCount;

  const filtered = useMemo(() => {
    let list = [...channels];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.code || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== 'all') list = list.filter(c => (c.category || '') === categoryFilter);
    if (statusFilter !== 'all') list = list.filter(c => (statusFilter === 'active' ? c.active !== false : c.active === false));
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av: any = (a as any)[sortKey] ?? '';
      const bv: any = (b as any)[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return list;
  }, [channels, search, categoryFilter, statusFilter, sortKey, sortDir]);

  // Actions
  const openCreate = () => {
    setEditingChannel(null);
    setForm(emptyChannel());
    setModalOpen(true);
  };

  const openEdit = (c: Channel) => {
    setEditingChannel(c);
    setForm({ ...emptyChannel(), ...c });
    setModalOpen(true);
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'El nombre del canal es obligatorio';
    const nameClash = channels.some(c =>
      c.id !== (editingChannel?.id || '') && c.name.toLowerCase() === form.name.trim().toLowerCase(),
    );
    if (nameClash) return 'Ya existe un canal con ese nombre';
    if (form.code && channels.some(c => c.id !== (editingChannel?.id || '') && (c.code || '').toLowerCase() === form.code!.trim().toLowerCase())) {
      return 'Ya existe un canal con ese código interno';
    }
    if (form.minCommissionPct > form.maxCommissionPct) return 'La comisión mínima no puede ser mayor que la máxima';
    return null;
  };

  const submitForm = () => {
    const err = validateForm();
    if (err) { toast.error(err); return; }
    const clean: Channel = {
      ...form,
      name: form.name.trim(),
      code: form.code?.trim() || undefined,
      // Sincroniza valor usado por el motor de comisiones
      externalCommissionPct: form.baseCommissionPct ?? form.externalCommissionPct,
    };
    if (editingChannel) {
      updateChannel({ ...editingChannel, ...clean, id: editingChannel.id });
      toast.success('Canal actualizado');
    } else {
      addChannel(clean);
      toast.success('Canal creado');
    }
    setModalOpen(false);
  };

  const handleDuplicate = (id: string) => {
    duplicateChannel(id);
    toast.success('Canal duplicado');
  };

  const handleDeleteClick = (id: string) => {
    setDepsList(getChannelDependencies(id));
    setDeleteTarget(id);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteChannel(deleteTarget);
    toast.success('Canal eliminado');
    setDeleteTarget(null);
    setDepsList([]);
  };

  const handleDeactivateInstead = () => {
    if (!deleteTarget) return;
    const ch = channels.find(c => c.id === deleteTarget);
    if (ch) {
      updateChannel({ ...ch, active: false });
      toast.success('Canal desactivado');
    }
    setDeleteTarget(null);
    setDepsList([]);
  };

  const toggleActive = (id: string) => {
    const ch = channels.find(c => c.id === id);
    if (!ch) return;
    updateChannel({ ...ch, active: !ch.active });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const targetChannel = channels.find(c => c.id === deleteTarget);
  const hasDeps = depsList.length > 0;
  const historyChannel = channels.find(c => c.id === historyChannelId);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Canales de Venta</h2>
          <p className="text-sm text-muted-foreground">
            Catálogo maestro dinámico. Los canales creados aquí se integran automáticamente al motor de comisiones, escenarios, simuladores y reportes.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Agregar Canal
        </Button>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Total</div>
          <div className="text-2xl font-bold">{channels.length}</div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Activos</div>
          <div className="text-2xl font-bold text-primary">{activeCount}</div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Inactivos</div>
          <div className="text-2xl font-bold text-muted-foreground">{inactiveCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código, categoría o descripción…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <button className="flex items-center gap-1 hover:text-primary" onClick={() => toggleSort('name')}>
                  Canal <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th>Estado</th>
              <th>
                <button className="flex items-center gap-1 hover:text-primary" onClick={() => toggleSort('baseCommissionPct')}>
                  Comisión Base %
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">Valor base sugerido. Sincroniza con la comisión externa usada por el motor de comisiones.</TooltipContent>
                  </Tooltip>
                </button>
              </th>
              <th>Mín %</th>
              <th>Máx %</th>
              <th>
                <button className="flex items-center gap-1 hover:text-primary" onClick={() => toggleSort('category')}>
                  Categoría <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center text-sm text-muted-foreground py-8">No hay canales que coincidan con los filtros.</td></tr>
            )}
            {filtered.map(ch => (
              <tr key={ch.id} className={ch.active === false ? 'opacity-60' : ''}>
                <td className="font-medium">
                  <div className="flex flex-col">
                    <span>{ch.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {ch.code ? `${ch.code} · ` : ''}{ch.id}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <Switch checked={ch.active !== false} onCheckedChange={() => toggleActive(ch.id)} />
                    <Badge variant={ch.active !== false ? 'default' : 'secondary'} className="text-[10px]">
                      {ch.active !== false ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </td>
                <td>
                  <Input
                    type="number"
                    step="0.1"
                    className="w-24 h-8 text-sm font-mono"
                    value={ch.baseCommissionPct ?? ch.externalCommissionPct}
                    onChange={e => {
                      const v = +e.target.value;
                      updateChannel({ ...ch, baseCommissionPct: v, externalCommissionPct: v });
                    }}
                  />
                </td>
                <td>
                  <Input type="number" step="0.1" className="w-20 h-8 text-sm font-mono"
                    value={ch.minCommissionPct}
                    onChange={e => updateChannel({ ...ch, minCommissionPct: +e.target.value })} />
                </td>
                <td>
                  <Input type="number" step="0.1" className="w-20 h-8 text-sm font-mono"
                    value={ch.maxCommissionPct}
                    onChange={e => updateChannel({ ...ch, maxCommissionPct: +e.target.value })} />
                </td>
                <td>
                  {ch.category ? <Badge variant="outline" className="text-[10px]">{ch.category}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(ch)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDetailId(ch.id)}>
                        <FileText className="h-4 w-4 mr-2" /> Ver ficha completa
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(ch.id)}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(ch.id)}>
                        {ch.active !== false
                          ? <><PowerOff className="h-4 w-4 mr-2" /> Desactivar</>
                          : <><Power className="h-4 w-4 mr-2" /> Activar</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setHistoryChannelId(ch.id)}>
                        <History className="h-4 w-4 mr-2" /> Historial
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteClick(ch.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border bg-muted/50 p-4">
        <h3 className="text-sm font-semibold mb-2">¿Cómo funcionan los canales?</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Catálogo <strong>maestro dinámico</strong>: cualquier canal creado aparece automáticamente en Motor de Comisiones, Escenarios, Distribución, Simuladores e Ingresos por Rol.</li>
          <li>• La <strong>comisión base</strong> sincroniza con la comisión externa que usa el motor — la lógica de cálculo no cambia.</li>
          <li>• El <strong>remanente interno</strong> = comisión total del escenario – comisión externa.</li>
          <li>• Los canales <strong>inactivos</strong> se conservan para históricos pero no se ofrecen en nuevas configuraciones.</li>
        </ul>
      </div>

      {/* CREATE / EDIT MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingChannel ? 'Editar canal' : 'Nuevo canal de venta'}</DialogTitle>
            <DialogDescription>
              Define el canal una vez y estará disponible en todo el ecosistema de comisiones.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* General */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Información general</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Nombre del canal *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej. Embajador Premium" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Código interno</Label>
                  <Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="EMB_PREM" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoría</Label>
                  <Select value={form.category || ''} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Descripción</Label>
                  <Textarea
                    rows={3}
                    value={form.description || ''}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Ej. Usuarios que generan oportunidades comerciales mediante referidos, sin participar en el proceso de venta."
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
                  <Label className="text-sm">{form.active ? 'Activo' : 'Inactivo'}</Label>
                </div>
              </div>
            </section>

            {/* Commercial */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configuración comercial</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Comisión base %</Label>
                  <Input type="number" step="0.1"
                    value={form.baseCommissionPct ?? 0}
                    onChange={e => setForm({ ...form, baseCommissionPct: +e.target.value, externalCommissionPct: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mínima %</Label>
                  <Input type="number" step="0.1"
                    value={form.minCommissionPct}
                    onChange={e => setForm({ ...form, minCommissionPct: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Máxima %</Label>
                  <Input type="number" step="0.1"
                    value={form.maxCommissionPct}
                    onChange={e => setForm({ ...form, maxCommissionPct: +e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!form.participatesInScaling} onCheckedChange={v => setForm({ ...form, participatesInScaling: v })} />
                  Participa en escalonamientos
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!form.participatesInBonuses} onCheckedChange={v => setForm({ ...form, participatesInBonuses: v })} />
                  Participa en bonos
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!form.participatesInSimulators} onCheckedChange={v => setForm({ ...form, participatesInSimulators: v })} />
                  Participa en simuladores
                </label>
              </div>
            </section>

            {/* Operations */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operación</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!form.requiresOnboarding} onCheckedChange={v => setForm({ ...form, requiresOnboarding: v })} />
                  Requiere onboarding
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!form.requiresTraining} onCheckedChange={v => setForm({ ...form, requiresTraining: v })} />
                  Requiere capacitación
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!form.requiresApproval} onCheckedChange={v => setForm({ ...form, requiresApproval: v })} />
                  Requiere aprobación
                </label>
                <div className="space-y-1.5">
                  <Label className="text-xs">Protección de leads (días)</Label>
                  <Input type="number" min={0}
                    value={form.leadProtectionDays ?? 0}
                    onChange={e => setForm({ ...form, leadProtectionDays: +e.target.value })} />
                </div>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={submitForm}>{editingChannel ? 'Guardar cambios' : 'Crear canal'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDepsList([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {hasDeps ? 'No es posible eliminar este canal' : '¿Eliminar canal?'}
            </DialogTitle>
            <DialogDescription>
              {hasDeps ? (
                <>
                  El canal <strong>"{targetChannel?.name}"</strong> no puede eliminarse porque está siendo utilizado en:
                  <ul className="mt-2 list-disc list-inside text-sm">
                    {depsList.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                  <p className="mt-3 text-sm">Puedes <strong>desactivarlo</strong> para conservar los históricos.</p>
                </>
              ) : (
                <>
                  ¿Estás seguro que deseas eliminar <strong>"{targetChannel?.name}"</strong>?
                  <p className="mt-2 text-sm text-destructive">Esta acción no se puede deshacer.</p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDepsList([]); }}>Cancelar</Button>
            {hasDeps
              ? <Button variant="secondary" onClick={handleDeactivateInstead}>Desactivar canal</Button>
              : <Button variant="destructive" onClick={confirmDelete}>Eliminar canal</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HISTORY SHEET */}
      <Sheet open={!!historyChannelId} onOpenChange={(o) => { if (!o) setHistoryChannelId(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Historial · {historyChannel?.name}</SheetTitle>
            <SheetDescription>Trazabilidad de cambios sobre este canal.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {(historyChannel?.history || []).slice().reverse().map(h => (
              <div key={h.id} className="border-l-2 border-primary/50 pl-3 py-1">
                <div className="text-xs text-muted-foreground">{new Date(h.timestamp).toLocaleString()}</div>
                <div className="text-sm">
                  <Badge variant="outline" className="text-[10px] mr-1.5">{h.action}</Badge>
                  <span className="font-medium">{h.user}</span>
                  {h.note && <span className="text-muted-foreground"> — {h.note}</span>}
                </div>
                {(h.previousValue !== undefined || h.newValue !== undefined) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {h.field && <span className="font-mono mr-1">{h.field}:</span>}
                    <span className="line-through">{String(h.previousValue ?? '—')}</span>
                    {' → '}
                    <span>{String(h.newValue ?? '—')}</span>
                  </div>
                )}
              </div>
            ))}
            {(!historyChannel?.history || historyChannel.history.length === 0) && (
              <p className="text-sm text-muted-foreground italic">Sin eventos registrados todavía.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ChannelDetailDrawer channelId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
