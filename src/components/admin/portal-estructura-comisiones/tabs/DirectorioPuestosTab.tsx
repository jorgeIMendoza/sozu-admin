import { useState } from 'react';
import { Users, Check, ChevronsUpDown, Trash2, Plus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/portal-estructura-comisiones/utils/calculations';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import type { Role } from '@/lib/portal-estructura-comisiones/types/simulator';
import {
  usePuestosOrganizacionales, useCrearPuesto, useActualizarPuesto, useEliminarPuesto,
  useProyectosActivosDirectorio, useBuscarUsuarios,
  type PuestoOrganizacional,
} from '@/hooks/usePortalEstructuraComisiones/useDirectorioPuestos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

export default function DirectorioPuestosTab() {
  // El catálogo de roles (qué puestos existen) viene de "Puestos y Sueldos"
  // — ya no se administra por separado aquí. Este tab solo asigna personas
  // reales (con sueldo real) a esos roles.
  const { roles } = useSimulator();
  const { data: puestos = [] } = usePuestosOrganizacionales();
  const { data: proyectos = [] } = useProyectosActivosDirectorio();

  const monthlyCost = (p: PuestoOrganizacional) => p.sueldo_base * (1 + p.prestaciones_pct / 100) + p.bono_fijo;
  const totalMonthlyCost = puestos.reduce((s, p) => s + monthlyCost(p), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold">Directorio de Personal</h2>
        <p className="text-sm text-muted-foreground">
          Qué usuario real ocupa cada puesto del catálogo de <strong>Puestos y Sueldos</strong> — independiente del catálogo de roles y permisos del sistema.
          Costo fijo mensual total: <span className="font-semibold text-foreground">{formatCurrency(totalMonthlyCost)}</span>
        </p>
      </div>

      {/* Roles list — de solo lectura, se administran en Puestos y Sueldos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Roles del Catálogo</h3>
          <Link
            to="/admin/portal-estructura-comisiones/structure"
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            Administrar en Puestos y Sueldos <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin roles definidos aún en Puestos y Sueldos.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {roles.map(role => (
              <div key={role.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{role.name}</span>
                <Badge variant={role.belongsTo === 'sozu_central' ? 'default' : 'secondary'} className="text-[10px]">
                  {role.belongsTo === 'sozu_central' ? 'SOZU' : 'Proyecto'}
                </Badge>
                {role.participatesInCommission && (
                  <Badge variant="outline" className="text-[10px] border-accent text-accent">Comisión</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SOZU Central */}
      <PuestosSection
        title="SOZU Central"
        idProyecto={null}
        puestos={puestos.filter(p => p.id_proyecto === null)}
        availableRoles={roles.filter(r => r.belongsTo === 'sozu_central')}
      />

      {/* Per-project */}
      {proyectos.map(proyecto => (
        <PuestosSection
          key={proyecto.id}
          title={proyecto.nombre}
          idProyecto={proyecto.id}
          puestos={puestos.filter(p => p.id_proyecto === proyecto.id)}
          availableRoles={roles.filter(r => r.belongsTo === 'project')}
        />
      ))}
    </div>
  );
}

function PuestosSection({ title, idProyecto, puestos, availableRoles }: {
  title: string;
  idProyecto: number | null;
  puestos: PuestoOrganizacional[];
  availableRoles: Role[];
}) {
  const crearPuesto = useCrearPuesto();
  const actualizarPuesto = useActualizarPuesto();
  const eliminarPuesto = useEliminarPuesto();

  const monthlyCost = (p: PuestoOrganizacional) => p.sueldo_base * (1 + p.prestaciones_pct / 100) + p.bono_fijo;
  const sectionCost = puestos.reduce((s, p) => s + monthlyCost(p), 0);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">Costo mensual: {formatCurrency(sectionCost)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={availableRoles.length === 0}
          onClick={() => {
            if (availableRoles.length === 0) return;
            crearPuesto.mutate({
              id_rol: availableRoles[0].id,
              id_proyecto: idProyecto,
              email_usuario: null,
              nombre_ocupante: null,
              sueldo_base: 20000,
              bono_fijo: 0,
              prestaciones_pct: 30,
              fecha_inicio: null,
            });
          }}
        >
          <Plus className="h-3 w-3 mr-1" /> Agregar
        </Button>
      </div>
      {puestos.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Sin puestos asignados</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Rol</th>
              <th>Usuario</th>
              <th>Sueldo Base</th>
              <th>Bono Fijo</th>
              <th>Prestaciones %</th>
              <th>Costo Total/mes</th>
              <th>Desde</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {puestos.map(p => (
              <tr key={p.id}>
                <td>
                  <select
                    value={p.id_rol}
                    onChange={e => actualizarPuesto.mutate({ id: p.id, id_rol: e.target.value })}
                    className="rounded border bg-transparent px-2 py-1 text-sm"
                  >
                    {availableRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td>
                  <UsuarioPicker
                    email={p.email_usuario}
                    nombreLibre={p.nombre_ocupante}
                    onSelectUsuario={(email, nombre) => actualizarPuesto.mutate({ id: p.id, email_usuario: email, nombre_ocupante: nombre })}
                    onSetNombreLibre={(nombre) => actualizarPuesto.mutate({ id: p.id, email_usuario: null, nombre_ocupante: nombre })}
                  />
                </td>
                <td>
                  <Input type="number" className="w-28 h-8 text-sm" value={p.sueldo_base}
                    onChange={e => actualizarPuesto.mutate({ id: p.id, sueldo_base: +e.target.value })} />
                </td>
                <td>
                  <Input type="number" className="w-24 h-8 text-sm" value={p.bono_fijo}
                    onChange={e => actualizarPuesto.mutate({ id: p.id, bono_fijo: +e.target.value })} />
                </td>
                <td>
                  <Input type="number" className="w-20 h-8 text-sm" value={p.prestaciones_pct}
                    onChange={e => actualizarPuesto.mutate({ id: p.id, prestaciones_pct: +e.target.value })} />
                </td>
                <td className="font-semibold font-mono text-sm">{formatCurrency(monthlyCost(p))}</td>
                <td>
                  <Input type="date" className="w-36 h-8 text-sm" value={p.fecha_inicio ?? ''}
                    onChange={e => actualizarPuesto.mutate({ id: p.id, fecha_inicio: e.target.value || null })} />
                </td>
                <td>
                  <button onClick={() => eliminarPuesto.mutate(p.id)} className="rounded p-1 hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Buscador de usuario real (nombre/email) con fallback a nombre libre si aún no tiene cuenta. */
function UsuarioPicker({ email, nombreLibre, onSelectUsuario, onSetNombreLibre }: {
  email: string | null;
  nombreLibre: string | null;
  onSelectUsuario: (email: string, nombre: string) => void;
  onSetNombreLibre: (nombre: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: resultados = [], isLoading } = useBuscarUsuarios(search);

  const displayLabel = email ? `${nombreLibre || email} · ${email}` : (nombreLibre || 'Sin asignar');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-56 h-8 justify-between text-xs font-normal">
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nombre o email..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'Buscando...' : search.trim().length < 2 ? 'Escribe al menos 2 caracteres' : (
                <button
                  className="w-full px-2 py-1.5 text-left text-sm hover:bg-muted rounded"
                  onClick={() => { onSetNombreLibre(search.trim()); setOpen(false); setSearch(''); }}
                >
                  Usar "{search.trim()}" como nombre libre (sin cuenta)
                </button>
              )}
            </CommandEmpty>
            <CommandGroup>
              {resultados.map(u => (
                <CommandItem
                  key={u.email}
                  value={`${u.nombre} ${u.email}`}
                  onSelect={() => { onSelectUsuario(u.email, u.nombre); setOpen(false); setSearch(''); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', email === u.email ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{u.nombre}</span>
                    <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
