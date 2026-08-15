import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  ArrowUpDown, ArrowUp, ArrowDown, Power, PowerOff, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import ChannelDetailDrawer from '../shared/ChannelDetailDrawer';
import type { Channel } from '@/lib/portal-estructura-comisiones/types/simulator';
import {
  useCanalesConfigProyecto, useGuardarCanalDeProyecto, useGuardarCanalesDeProyecto,
  useProyectosSozuCanales,
  resolverCanalesDeProyecto, type CanalDeProyecto,
} from '@/hooks/usePortalEstructuraComisiones/useCanalesPorProyecto';
import {
  guardarCanalConfigProyecto, type CanalConfigProyecto,
} from '@/hooks/usePortalEstructuraComisiones/useMotorComisionesSync';
import {
  useComisionesPropuestas, useValidacionesCanal,
} from '@/hooks/usePortalEstructuraComisiones/useComisionesValidacion';

const CATEGORIES = [
  'Externo', 'Interno', 'Referido', 'Institucional', 'Patrimonial', 'Internacional',
  'Corporativo', 'Embajadores', 'Influencer', 'Otros',
];

/**
 * Por qué el rango mín–máx de un canal no acota nada, o `null` si está bien.
 *
 * El motor de comisiones usa la comisión base; el rango solo sirve como guarda.
 * Si la base cae fuera, la guarda es falsa y más vale decirlo donde se captura.
 */
function rangoInvalido(c: Channel): string | null {
  const base = c.baseCommissionPct ?? c.externalCommissionPct;
  const min = c.minCommissionPct;
  const max = c.maxCommissionPct;
  if (min > max) return `El mínimo (${min}%) supera al máximo (${max}%).`;
  if (base < min || base > max) {
    return `La comisión base (${base}%) queda fuera del rango ${min}%–${max}%, así que el rango no acota nada.`;
  }
  return null;
}

/**
 * Flecha de ordenamiento. La columna activa muestra la dirección real; las
 * demás, el par neutro. Antes las tres se veían igual y no había forma de
 * saber por cuál estaba ordenada la tabla.
 */
function IconoOrden({ activa, dir }: { activa: boolean; dir: 'asc' | 'desc' }) {
  if (!activa) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 text-primary" />
    : <ArrowDown className="h-3 w-3 text-primary" />;
}

/** Contador de la cabecera; con `onClick` filtra la tabla de abajo. */
function ContadorCanal({ etiqueta, valor, clase, activo, onClick, ayuda }: {
  etiqueta: string;
  valor: number;
  clase?: string;
  activo?: boolean;
  onClick?: () => void;
  ayuda?: string;
}) {
  const cuerpo = (
    <>
      <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        {etiqueta}
        {ayuda && (
          <Tooltip>
            <TooltipTrigger asChild><Info className="h-3 w-3 opacity-60" /></TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{ayuda}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className={cn('text-2xl font-bold', clase)}>{valor}</div>
    </>
  );

  if (!onClick) return <div className="rounded-lg border bg-card px-4 py-3">{cuerpo}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        'rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40',
        activo && 'border-primary bg-primary/5 hover:bg-primary/5',
      )}
    >
      {cuerpo}
    </button>
  );
}

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

  /** Proyecto cuyos canales se están administrando. `null` = catálogo maestro. */
  const [proyectoSel, setProyectoSel] = useState<number | null>(null);
  const { data: proyectosSozu = [], isLoading: cargandoProyectos } = useProyectosSozuCanales();

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

  /**
   * Canales cuyo rango mín–máx no acota nada: o el mínimo supera al máximo, o
   * la comisión base queda fuera. Hoy los seis del catálogo tienen mín y máx en
   * 0 con una base distinta de 0, así que el rango es decorativo y conviene que
   * se vea en lugar de suponer que valida algo.
   */
  const conRangoInvalido = useMemo(
    () => channels.filter(c => rangoInvalido(c) !== null),
    [channels],
  );

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
        <div className="flex items-center gap-2 shrink-0">
          {/* Elegir un proyecto pasa a administrar sus canales; sin proyecto se
              administra el catálogo maestro, como antes. */}
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select
              value={proyectoSel != null ? String(proyectoSel) : 'catalogo'}
              onValueChange={(v) => setProyectoSel(v === 'catalogo' ? null : Number(v))}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder={cargandoProyectos ? 'Cargando proyectos…' : 'Catálogo maestro'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="catalogo">Catálogo maestro (todos)</SelectItem>
                {proyectosSozu.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Agregar Canal
          </Button>
        </div>
      </div>

      {proyectoSel != null && (
        <CanalesDeProyectoPanel
          idProyecto={proyectoSel}
          nombreProyecto={proyectosSozu.find(p => p.id === proyectoSel)?.nombre ?? ''}
          catalogo={channels}
        />
      )}

      {/* Contadores que además filtran: el número y la lista que lo explica
          quedan a un clic, en vez de obligar a repetirlo en el selector. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ContadorCanal
          etiqueta="Total"
          valor={channels.length}
          activo={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <ContadorCanal
          etiqueta="Activos"
          valor={activeCount}
          clase="text-primary"
          activo={statusFilter === 'active'}
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
        />
        <ContadorCanal
          etiqueta="Inactivos"
          valor={inactiveCount}
          clase="text-muted-foreground"
          activo={statusFilter === 'inactive'}
          onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
        />
        <ContadorCanal
          etiqueta="Rango incongruente"
          valor={conRangoInvalido.length}
          clase={conRangoInvalido.length > 0 ? 'text-amber-600' : 'text-muted-foreground'}
          ayuda="La comisión base queda fuera del rango mín–máx, o el mínimo supera al máximo. El motor toma la base, así que el rango deja de acotar nada."
        />
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

      {/* Tabla del catálogo maestro. Con un proyecto elegido arriba conviven dos
          alcances en pantalla, así que se dice cuál es cuál. */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-2">
          <h3 className="font-semibold text-sm">Catálogo maestro</h3>
          <p className="text-xs text-muted-foreground">
            {proyectoSel != null
              ? 'Editar aquí afecta a todos los proyectos, no solo al seleccionado arriba.'
              : `${filtered.length} de ${channels.length} canales`}
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <button className="flex items-center gap-1 hover:text-primary" onClick={() => toggleSort('name')}>
                  Canal <IconoOrden activa={sortKey === 'name'} dir={sortDir} />
                </button>
              </th>
              <th>Estado</th>
              <th>
                <button className="flex items-center gap-1 hover:text-primary" onClick={() => toggleSort('baseCommissionPct')}>
                  Comisión base % <IconoOrden activa={sortKey === 'baseCommissionPct'} dir={sortDir} />
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
                  Categoría <IconoOrden activa={sortKey === 'category'} dir={sortDir} />
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
                {/* El Switch ya comunica el estado; el badge de al lado repetía
                    lo mismo. Queda la etiqueta como texto, que sí hace falta
                    para no depender solo de la posición del interruptor. */}
                <td>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={ch.active !== false} onCheckedChange={() => toggleActive(ch.id)} />
                    <span className={cn('text-xs', ch.active !== false ? 'text-foreground' : 'text-muted-foreground')}>
                      {ch.active !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </label>
                </td>
                <td>
                  <div className="flex items-center gap-1.5">
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
                    {/* La incongruencia se marca donde se captura, no solo en el
                        contador de arriba. */}
                    {rangoInvalido(ch) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">{rangoInvalido(ch)}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </td>
                <td>
                  <Input type="number" step="0.1"
                    className={cn('w-20 h-8 text-sm font-mono', rangoInvalido(ch) && 'border-amber-500/60')}
                    value={ch.minCommissionPct}
                    onChange={e => updateChannel({ ...ch, minCommissionPct: +e.target.value })} />
                </td>
                <td>
                  <Input type="number" step="0.1"
                    className={cn('w-20 h-8 text-sm font-mono', rangoInvalido(ch) && 'border-amber-500/60')}
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

/**
 * Administración de canales **para un proyecto**: qué canales aplican y sus
 * porcentajes propios.
 *
 * Los porcentajes vacíos heredan del catálogo maestro, así que cambiar el
 * maestro sigue propagándose a los proyectos que no capturaron su propio valor.
 * Se muestra con un badge cuál está heredado y cuál es propio del proyecto.
 */
/**
 * Estado de validación de un canal del proyecto ante Alta Dirección.
 *
 * `sin_propuesta`  — nunca se ha enviado la estructura de este proyecto.
 * `pendiente`      — hay propuesta, pero Alta Dirección no ha decidido este canal.
 * `validado`       — decisión favorable sobre la propuesta **vigente**.
 * `desactualizado` — se validó, pero la estructura cambió después: lo validado
 *                    ya no es lo que está capturado.
 * `rechazado`      — decisión desfavorable.
 */
type EstadoValidacionCanalUI =
  | 'sin_propuesta' | 'pendiente' | 'validado' | 'desactualizado' | 'rechazado';

const ESTILO_VALIDACION: Record<EstadoValidacionCanalUI, { texto: string; clase: string }> = {
  sin_propuesta: { texto: 'Sin enviar a validar', clase: 'text-muted-foreground border-border' },
  pendiente: { texto: 'Pendiente de validar', clase: 'text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/10' },
  validado: { texto: 'Validado', clase: 'text-emerald-700 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
  desactualizado: { texto: 'Cambió tras validarse', clase: 'text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/10' },
  rechazado: { texto: 'Rechazado', clase: 'text-destructive border-destructive/40 bg-destructive/10' },
};

const fechaHora = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/**
 * Estatus de validación de un canal, con su fecha y hora cuando la hay.
 *
 * La fecha solo acompaña a una decisión tomada: sin ella el chip diría
 * «Validado» sin decir cuándo, que es justo lo que hace falta para saber si
 * ampara lo que hoy está capturado.
 */
function CeldaValidacion({
  estado, fecha, por, notas, aplica, pendienteDeGuardar, ultimoCambio, ultimoAutor,
}: {
  estado: EstadoValidacionCanalUI;
  fecha: string | null;
  por: string | null;
  notas: string | null;
  aplica: boolean;
  /** Hay cambios en borrador sobre este canal. */
  pendienteDeGuardar?: boolean;
  /** `fecha_actualizacion` / `actualizado_por` de la configuración guardada. */
  ultimoCambio?: string | null;
  ultimoAutor?: string | null;
}) {
  if (!aplica && !pendienteDeGuardar) {
    return <span className="text-[11px] text-muted-foreground italic">No aplica</span>;
  }

  // Con cambios en borrador el estatus guardado ya no describe lo que se ve.
  if (pendienteDeGuardar) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        {estado === 'validado' ? 'Perderá su validación' : 'Cambios sin guardar'}
      </span>
    );
  }

  const estilo = ESTILO_VALIDACION[estado];
  const marca = fechaHora(fecha);
  const decidido = estado === 'validado' || estado === 'desactualizado' || estado === 'rechazado';
  const marcaCambio = fechaHora(ultimoCambio);

  const chip = (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', estilo.clase)}>
      {estado === 'validado' && <Power className="h-3 w-3 shrink-0" />}
      {(estado === 'pendiente' || estado === 'desactualizado') && <AlertTriangle className="h-3 w-3 shrink-0" />}
      {estado === 'rechazado' && <PowerOff className="h-3 w-3 shrink-0" />}
      {estilo.texto}
    </span>
  );

  return (
    <div className="flex flex-col gap-0.5 items-start">
      {notas ? (
        <Tooltip>
          <TooltipTrigger asChild><span>{chip}</span></TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{notas}</TooltipContent>
        </Tooltip>
      ) : chip}

      {decidido && marca ? (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {marca}{por ? ` · ${por}` : ''}
        </span>
      ) : marcaCambio ? (
        /* Sin decisión de Alta Dirección, lo que hay que rendir cuentas de es el
           último cambio: cuándo se guardó y quién lo guardó. */
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          Editado {marcaCambio}{ultimoAutor ? ` · ${ultimoAutor}` : ''}
        </span>
      ) : null}
    </div>
  );
}

function CanalesDeProyectoPanel({ idProyecto, nombreProyecto, catalogo }: {
  idProyecto: number;
  nombreProyecto: string;
  catalogo: Channel[];
}) {
  const { data: config, isLoading } = useCanalesConfigProyecto(idProyecto);
  const guardar = useGuardarCanalDeProyecto(idProyecto);
  const guardarLote = useGuardarCanalesDeProyecto(idProyecto);
  const { profile, user } = useAuth();
  const { addChannel } = useSimulator();
  const { data: proyectosSozu = [] } = useProyectosSozuCanales();
  const qc = useQueryClient();
  const [altaOpen, setAltaOpen] = useState(false);
  const [guardandoAlta, setGuardandoAlta] = useState(false);

  /**
   * Alta de un canal que nace en este proyecto.
   *
   * El canal se registra en el catálogo maestro —sigue siendo el único registro
   * de canales— pero se marca `aplica = false` en los demás proyectos, de modo
   * que solo exista aquí. Hace falta escribirlo explícitamente porque la
   * resolución es permisiva: sin fila, un canal nuevo del catálogo aparecería en
   * todos los desarrollos.
   */
  const altaCanalDelProyecto = async (nuevo: Channel) => {
    setGuardandoAlta(true);
    try {
      await addChannel(nuevo);

      const otros = proyectosSozu.filter(p => p.id !== idProyecto);
      const fallidos: string[] = [];
      for (const p of otros) {
        const res = await guardarCanalConfigProyecto(p.id, {
          idCanal: nuevo.id,
          aplica: false,
          comisionTotalPct: 0,
          comisionExternaPct: null,
          comisionMinPct: null,
          comisionMaxPct: null,
        });
        if (!res.ok) fallidos.push(p.nombre);
      }

      await guardar.mutateAsync({
        idCanal: nuevo.id,
        aplica: true,
        comisionTotalPct: 0,
        comisionExternaPct: nuevo.externalCommissionPct,
        comisionMinPct: null,
        comisionMaxPct: null,
      });

      qc.invalidateQueries({ queryKey: ['canales-config-proyecto'] });
      setAltaOpen(false);

      // Si algún proyecto no se pudo marcar, el canal le aparecería sin querer:
      // se dice cuál, en vez de dar el alta por buena.
      if (fallidos.length > 0) {
        toast.warning(
          `"${nuevo.name}" se creó en ${nombreProyecto}, pero no se pudo excluir de: ${fallidos.join(', ')}. ` +
          'Desactívalo ahí manualmente.',
        );
      } else {
        toast.success(`"${nuevo.name}" quedó activo solo en ${nombreProyecto}. Envíalo a validar desde Comisiones.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear el canal');
    } finally {
      setGuardandoAlta(false);
    }
  };

  // Estatus de validación por canal, contra la propuesta vigente del proyecto.
  const { data: propuestas = [] } = useComisionesPropuestas(idProyecto);
  const propuesta = propuestas.find(p => p.id_proyecto === idProyecto) ?? null;
  const { data: validaciones = [] } = useValidacionesCanal(idProyecto);
  const validacionPorCanal = useMemo(
    () => new Map(validaciones.map(v => [v.id_canal, v])),
    [validaciones],
  );

  /**
   * La validación se compara contra `fecha_actualizacion` de la propuesta: es la
   * versión sobre la que Alta Dirección decidió. Si la estructura se volvió a
   * enviar después, la decisión anterior ya no ampara lo que está capturado.
   */
  const estadoDe = (idCanal: string): { estado: EstadoValidacionCanalUI; fecha: string | null; por: string | null; notas: string | null } => {
    if (!propuesta) return { estado: 'sin_propuesta', fecha: null, por: null, notas: null };
    const v = validacionPorCanal.get(idCanal);
    if (!v) return { estado: 'pendiente', fecha: null, por: null, notas: null };
    const base = { fecha: v.fecha_validacion, por: v.validado_por, notas: v.notas };
    if (v.estado === 'rechazada') return { estado: 'rechazado', ...base };
    const vigente = v.snapshot_fecha === propuesta.fecha_actualizacion;
    return { estado: vigente ? 'validado' : 'desactualizado', ...base };
  };

  const resueltos = useMemo(
    () => resolverCanalesDeProyecto(catalogo.filter(c => c.active !== false), config),
    [catalogo, config],
  );
  const aplican = resueltos.filter(c => c.aplica).length;

  const resumenValidacion = useMemo(() => {
    const conteo: Record<EstadoValidacionCanalUI, number> = {
      sin_propuesta: 0, pendiente: 0, validado: 0, desactualizado: 0, rechazado: 0,
    };
    for (const c of resueltos) {
      if (!c.aplica) continue;
      conteo[estadoDe(c.canal.id).estado]++;
    }
    return conteo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resueltos, propuesta, validacionPorCanal]);

  /** Config guardada de un canal, tal como está en la base. */
  const configDe = (c: CanalDeProyecto): CanalConfigProyecto => ({
    idCanal: c.canal.id,
    aplica: c.aplica,
    comisionTotalPct: c.comisionTotalPct,
    // Solo viaja como override lo que el proyecto capturó; lo heredado
    // sigue siendo null para no congelar el valor del catálogo.
    comisionExternaPct: c.overrides.externa ? c.comisionExternaPct : null,
    comisionMinPct: c.overrides.min ? c.comisionMinPct : null,
    comisionMaxPct: c.overrides.max ? c.comisionMaxPct : null,
  });

  /**
   * Edición en borrador: cada cambio se acumula aquí en vez de guardarse solo.
   *
   * Guardar por tecla hacía imposible revisar una tanda antes de aplicarla, y
   * sobre todo impedía avisar del efecto que tiene sobre la validación: mover
   * tres porcentajes disparaba tres invalidaciones silenciosas.
   */
  const [borrador, setBorrador] = useState<Map<string, CanalConfigProyecto>>(new Map());
  const hayCambios = borrador.size > 0;

  /** Valor vigente en pantalla: el del borrador si se tocó, si no el guardado. */
  const vigente = (c: CanalDeProyecto): CanalConfigProyecto =>
    borrador.get(c.canal.id) ?? configDe(c);

  const editar = (c: CanalDeProyecto, cambios: Partial<CanalConfigProyecto>) => {
    setBorrador(prev => {
      const siguiente = new Map(prev);
      const base = prev.get(c.canal.id) ?? configDe(c);
      const propuesto = { ...base, ...cambios };
      const guardado = configDe(c);
      // Volver al valor original quita el canal del borrador: si nada difiere,
      // no hay nada que guardar y el botón debe apagarse solo.
      const igual = (Object.keys(propuesto) as Array<keyof CanalConfigProyecto>)
        .every(k => propuesto[k] === guardado[k]);
      if (igual) siguiente.delete(c.canal.id);
      else siguiente.set(c.canal.id, propuesto);
      return siguiente;
    });
  };

  /** Canales tocados en el borrador que hoy están validados: perderán el visto bueno. */
  const validadosEnBorrador = [...borrador.keys()]
    .filter(id => estadoDe(id).estado === 'validado').length;

  const guardarCambios = () => {
    const cambios = [...borrador.entries()].map(([idCanal, config]) => ({
      nombre: resueltos.find(r => r.canal.id === idCanal)?.canal.name ?? idCanal,
      config,
    }));
    const validadosAfectados = cambios.filter(
      ({ config }) => estadoDe(config.idCanal).estado === 'validado',
    );

    guardarLote.mutate(
      { cambios, actualizadoPor: profile?.email || user?.email || null },
      {
        onSuccess: () => {
          setBorrador(new Map());
          if (validadosAfectados.length > 0) {
            // El canal validado dejó de estar amparado: se dice en el momento y
            // con la acción a seguir, no se deja que se descubra después.
            toast.warning(
              `${validadosAfectados.length} canal${validadosAfectados.length === 1 ? '' : 'es'} ` +
              `ya validado${validadosAfectados.length === 1 ? '' : 's'} cambió: ` +
              'vuelve a enviar la estructura a validar desde el menú Comisiones.',
              { duration: 8000 },
            );
          } else {
            toast.success(`Cambios guardados en ${nombreProyecto}.`);
          }
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudieron guardar los cambios'),
      },
    );
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold">Canales de {nombreProyecto}</h3>
          <p className="text-xs text-muted-foreground max-w-2xl">
            {aplican} de {resueltos.length} canales aplican a este desarrollo. Los porcentajes
            vacíos heredan del catálogo maestro; al capturarlos el canal se vuelve independiente
            de él en este proyecto.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAltaOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Agregar canal a este proyecto
        </Button>
        <div className="flex flex-wrap items-center gap-1.5 w-full">
          {(['validado', 'desactualizado', 'pendiente', 'rechazado', 'sin_propuesta'] as const)
            .filter(e => resumenValidacion[e] > 0)
            .map(e => (
              <span
                key={e}
                className={cn('rounded-md border px-2 py-1 text-[11px] font-medium', ESTILO_VALIDACION[e].clase)}
              >
                {resumenValidacion[e]} {ESTILO_VALIDACION[e].texto.toLowerCase()}
              </span>
            ))}
        </div>
      </div>

      {/* Barra de guardado. Con cambios pendientes dice cuántos son y advierte
          si alguno de ellos ya estaba validado, ANTES de guardar: enterarse
          después de que la validación se cayó no sirve de nada. */}
      <div className={cn(
        'mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5',
        hayCambios ? 'border-amber-500/40 bg-amber-500/10' : 'bg-muted/40',
      )}>
        {hayCambios ? (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
            <span>
              <strong className="text-foreground">
                {borrador.size} canal{borrador.size === 1 ? '' : 'es'} sin guardar.
              </strong>
              {validadosEnBorrador > 0 && (
                <> Al guardar, {validadosEnBorrador === 1 ? 'un canal ya validado perderá' : `${validadosEnBorrador} canales ya validados perderán`}{' '}
                su validación y habrá que enviarlos de nuevo desde <strong className="text-foreground">Comisiones</strong>.</>
              )}
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <span>
              Los cambios los valida <strong className="text-foreground">Portal Alta Dirección →
              Estructura de Comisiones, Validación por proyecto</strong>. Tras guardar, envía la
              estructura desde <strong className="text-foreground">Comisiones</strong> con «Enviar
              a validar».
            </span>
          </p>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {hayCambios && (
            <Button variant="ghost" size="sm" onClick={() => setBorrador(new Map())} disabled={guardarLote.isPending}>
              Descartar
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!hayCambios || guardarLote.isPending}
            onClick={guardarCambios}
          >
            {guardarLote.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground italic">Cargando configuración…</p>
      ) : resueltos.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No hay canales activos en el catálogo maestro.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Aplica</th>
                <th>Canal</th>
                <th>Validación</th>
                <th className="text-right">Comisión externa %</th>
                <th className="text-right">Mín %</th>
                <th className="text-right">Máx %</th>
                <th className="text-right">Comisión total %</th>
              </tr>
            </thead>
            <tbody>
              {resueltos.map(c => {
                const v = vigente(c);
                const tocado = borrador.has(c.canal.id);
                return (
                <tr
                  key={c.canal.id}
                  className={cn(!v.aplica && 'opacity-55', tocado && 'bg-amber-500/5')}
                >
                  <td>
                    <Switch
                      checked={v.aplica}
                      onCheckedChange={(x) => editar(c, { aplica: x })}
                    />
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium flex items-center gap-1.5">
                        {c.canal.name}
                        {tocado && (
                          <span className="text-[10px] font-normal text-amber-600">sin guardar</span>
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {c.canal.category ?? 'Sin categoría'}
                        {c.sinConfigurar && ' · hereda todo del catálogo'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <CeldaValidacion
                      {...estadoDe(c.canal.id)}
                      aplica={v.aplica}
                      pendienteDeGuardar={tocado}
                      ultimoCambio={c.fechaActualizacion}
                      ultimoAutor={c.actualizadoPor}
                    />
                  </td>
                  <td>
                    <PctPorProyecto
                      valor={v.comisionExternaPct ?? c.canal.externalCommissionPct}
                      esOverride={v.comisionExternaPct != null}
                      heredado={c.canal.externalCommissionPct}
                      disabled={!v.aplica}
                      onCommit={(x) => editar(c, { comisionExternaPct: x })}
                    />
                  </td>
                  <td>
                    <PctPorProyecto
                      valor={v.comisionMinPct ?? c.canal.minCommissionPct}
                      esOverride={v.comisionMinPct != null}
                      heredado={c.canal.minCommissionPct}
                      disabled={!v.aplica}
                      onCommit={(x) => editar(c, { comisionMinPct: x })}
                    />
                  </td>
                  <td>
                    <PctPorProyecto
                      valor={v.comisionMaxPct ?? c.canal.maxCommissionPct}
                      esOverride={v.comisionMaxPct != null}
                      heredado={c.canal.maxCommissionPct}
                      disabled={!v.aplica}
                      onCommit={(x) => editar(c, { comisionMaxPct: x })}
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      disabled={!v.aplica}
                      className="w-24 h-8 text-sm font-mono text-right"
                      // `key` con el valor guardado: al descartar el borrador el
                      // campo debe volver a lo que hay en la base, y un
                      // defaultValue no se reevalúa solo.
                      key={`${c.canal.id}-${c.comisionTotalPct}-${tocado}`}
                      defaultValue={v.comisionTotalPct}
                      onBlur={e => {
                        const x = Number(e.target.value);
                        if (!Number.isFinite(x) || x < 0 || x > 100) {
                          toast.error('La comisión total debe estar entre 0 y 100');
                          e.target.value = String(v.comisionTotalPct);
                          return;
                        }
                        if (x !== v.comisionTotalPct) editar(c, { comisionTotalPct: x });
                      }}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Quitar un canal no borra su configuración: se conserva el porcentaje capturado por si
        se vuelve a habilitar, y las comisiones ya registradas mantienen su contexto.
      </p>

      <AltaCanalProyectoDialog
        open={altaOpen}
        nombreProyecto={nombreProyecto}
        guardando={guardandoAlta}
        onClose={() => setAltaOpen(false)}
        onCrear={altaCanalDelProyecto}
      />
    </div>
  );
}

/** Alta de un canal que nace en un proyecto: lo mínimo para poder operarlo. */
function AltaCanalProyectoDialog({ open, nombreProyecto, guardando, onClose, onCrear }: {
  open: boolean;
  nombreProyecto: string;
  guardando: boolean;
  onClose: () => void;
  onCrear: (c: Channel) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Externo');
  const [externa, setExterna] = useState('0');

  useEffect(() => {
    if (open) { setNombre(''); setCategoria('Externo'); setExterna('0'); }
  }, [open]);

  const pct = Number(externa);
  const valido = nombre.trim().length > 0 && Number.isFinite(pct) && pct >= 0 && pct <= 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar canal a {nombreProyecto}</DialogTitle>
          <DialogDescription>
            El canal se registra en el catálogo maestro —es el único registro de canales— y
            queda activo solo en este proyecto. Después podrás habilitarlo en otros desde su
            propia vista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nombre del canal *</Label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Alianza Banco Regional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoría</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Comisión externa %</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={externa}
                onChange={e => setExterna(e.target.value)}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Lo que se lleva el externo. La comisión total se define en Comisiones.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button
            disabled={!valido || guardando}
            onClick={() => onCrear({
              ...emptyChannel(),
              id: crypto.randomUUID(),
              name: nombre.trim(),
              category: categoria,
              externalCommissionPct: pct,
              baseCommissionPct: pct,
              maxCommissionPct: pct,
            })}
          >
            {guardando ? 'Creando…' : 'Crear canal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Porcentaje que puede ser propio del proyecto o heredado del catálogo.
 * Vaciar el campo devuelve la herencia; escribir un valor crea el override.
 */
function PctPorProyecto({ valor, esOverride, heredado, disabled, onCommit }: {
  valor: number;
  esOverride: boolean;
  heredado: number;
  disabled?: boolean;
  onCommit: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        step="0.01"
        min="0"
        max="100"
        disabled={disabled}
        placeholder={String(heredado)}
        className="w-24 h-8 text-sm font-mono"
        defaultValue={esOverride ? valor : ''}
        onBlur={e => {
          const raw = e.target.value.trim();
          if (raw === '') {
            if (esOverride) onCommit(null);
            return;
          }
          const v = Number(raw);
          if (!Number.isFinite(v) || v < 0 || v > 100) {
            toast.error('El porcentaje debe estar entre 0 y 100');
            e.target.value = esOverride ? String(valor) : '';
            return;
          }
          if (!esOverride || v !== valor) onCommit(v);
        }}
      />
      {!esOverride && (
        <Tooltip>
          <TooltipTrigger>
            {/* Heredar un 0 no es un límite pactado, es un dato sin capturar:
                se distingue para no presentarlo como si fuera una política. */}
            <Badge
              variant="outline"
              className={cn('text-[10px]', heredado === 0 && 'border-amber-500 text-amber-600')}
            >
              {heredado === 0 ? 'sin definir' : 'hereda'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            {heredado === 0
              ? 'El catálogo maestro no tiene este porcentaje capturado (0%). Escribe un valor para fijarlo en este proyecto, o captúralo en el catálogo para que aplique a todos.'
              : `Usa ${heredado}% del catálogo maestro. Escribe un valor para fijarlo solo en este proyecto.`}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
