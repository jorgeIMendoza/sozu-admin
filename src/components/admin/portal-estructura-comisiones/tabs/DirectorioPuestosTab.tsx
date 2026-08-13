import { Fragment, useMemo, useState } from 'react';
import {
  Plus, Trash2, Users, Check, ChevronsUpDown, ChevronRight, Search, Pencil, UserMinus,
  UserCheck, AlertTriangle, Building2, Info, X,
} from 'lucide-react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/portal-estructura-comisiones/utils/calculations';
import {
  useRolesOrganizacionales, useCrearRolOrganizacional, useActualizarRolOrganizacional,
  useDesactivarRolOrganizacional, useReactivarRolOrganizacional,
  usePersonal, useCrearPersona, useActualizarPersona, useDarBajaPersona, useReactivarPersona,
  useAsignacionesProyecto, useVincularProyecto, useDesvincularProyecto, useActualizarAsignacion,
  useProyectosActivosDirectorio, useBuscarUsuarios, useDirectorioSchemaReady, costoTotal,
  useCuentaSistema, rolesEnLaEmpresa, useRolesAdicionales, useGuardarRolesAdicionales,
  type RolOrganizacional, type PersonalOrganizacional, type AsignacionProyecto,
  type ProyectoActivo, type RoleType, type RoleBelongsTo, type NuevaPersonaInput,
  type NuevoRolInput, type TipoPersonal, type PersonaVinculada,
  esCostoDeSozu, ETIQUETA_TIPO_PERSONAL,
} from '@/hooks/usePortalEstructuraComisiones/useDirectorioPuestos';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

/**
 * Directorio de Personal — administración de recurso humano en tres pasos:
 *   1. Alta / baja / modificación de la persona.
 *   2. Vinculación de la persona con un rol de la empresa.
 *   3. Vinculación de la persona con los proyectos a los que da servicio.
 *
 * El costo fijo mensual es atributo de la persona; el costo por proyecto se deriva
 * del % de asignación de cada vinculación (ver sección "Costo por proyecto").
 */

const hoy = () => new Date().toISOString().slice(0, 10);
const notifyError = (e: unknown) =>
  toast.error(e instanceof Error ? e.message : 'No se pudo guardar el cambio');

export default function DirectorioPuestosTab() {
  const { data: schemaReady = true, isLoading: schemaLoading } = useDirectorioSchemaReady();
  const [verBajas, setVerBajas] = useState(false);
  const [verRolesInactivos, setVerRolesInactivos] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const { data: roles = [] } = useRolesOrganizacionales(verRolesInactivos);
  const { data: personal = [] } = usePersonal(verBajas);
  const { data: asignaciones = [] } = useAsignacionesProyecto();
  const { data: proyectos = [] } = useProyectosActivosDirectorio();
  const { data: rolesAdicionales } = useRolesAdicionales();
  /** `null` = la tabla aún no existe; no es lo mismo que "nadie tiene roles extra". */
  const rolesAdicionalesPendiente = rolesAdicionales === null;

  const [roleDialog, setRoleDialog] = useState<{ open: boolean; rol: RolOrganizacional | null }>({
    open: false, rol: null,
  });
  const [personaDialog, setPersonaDialog] = useState<{ open: boolean; persona: PersonalOrganizacional | null }>({
    open: false, persona: null,
  });
  const [bajaTarget, setBajaTarget] = useState<PersonalOrganizacional | null>(null);

  const crearRol = useCrearRolOrganizacional();
  const actualizarRol = useActualizarRolOrganizacional();
  const desactivarRol = useDesactivarRolOrganizacional();
  const reactivarRol = useReactivarRolOrganizacional();
  const crearPersona = useCrearPersona();
  const actualizarPersona = useActualizarPersona();
  const darBaja = useDarBajaPersona();
  const reactivar = useReactivarPersona();
  const guardarRolesAdicionales = useGuardarRolesAdicionales();

  const rolesById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles]);
  const proyectosById = useMemo(() => new Map(proyectos.map(p => [p.id, p])), [proyectos]);
  const asignacionesByPersona = useMemo(() => {
    const map = new Map<number, AsignacionProyecto[]>();
    for (const a of asignaciones) {
      const lista = map.get(a.id_personal);
      if (lista) lista.push(a);
      else map.set(a.id_personal, [a]);
    }
    return map;
  }, [asignaciones]);

  const rolesAdicionalesByPersona = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const r of rolesAdicionales ?? []) {
      const lista = map.get(r.id_personal);
      if (lista) lista.push(r.id_rol);
      else map.set(r.id_personal, [r.id_rol]);
    }
    return map;
  }, [rolesAdicionales]);

  /** Solo los roles vigentes pueden asignarse a una persona. */
  const rolesAsignables = useMemo(() => roles.filter(r => r.activo), [roles]);

  const activos = useMemo(() => personal.filter(p => p.activo), [personal]);
  /**
   * Personas por rol contando las dos formas de uso: el rol base y los roles
   * que asumen por proyecto. Se cuentan personas distintas, no asignaciones.
   */
  const personasPorRol = useMemo(() => {
    const porRol = new Map<number, Set<number>>();
    const agregar = (idRol: number, idPersona: number) => {
      const set = porRol.get(idRol);
      if (set) set.add(idPersona);
      else porRol.set(idRol, new Set([idPersona]));
    };
    const activosById = new Map(personal.filter(p => p.activo).map(p => [p.id, p]));
    for (const p of activosById.values()) {
      if (p.id_rol !== null) agregar(p.id_rol, p.id);
    }
    for (const a of asignaciones) {
      if (a.id_rol === null || !activosById.has(a.id_personal)) continue;
      agregar(a.id_rol, a.id_personal);
    }
    return new Map(Array.from(porRol.entries()).map(([idRol, set]) => [idRol, set.size]));
  }, [personal, asignaciones]);
  /**
   * Solo el empleado directo es costo fijo de SOZU. El colaborador de
   * Investimento se registra porque puede comisionar, pero su sueldo lo paga
   * Investimento, así que su costo se reporta aparte y no suma.
   */
  const empleadosSozu = useMemo(() => activos.filter(esCostoDeSozu), [activos]);
  const colaboradores = useMemo(() => activos.filter(p => !esCostoDeSozu(p)), [activos]);
  const costoEmpresa = useMemo(
    () => empleadosSozu.reduce((s, p) => s + Number(p.costo_total), 0),
    [empleadosSozu],
  );
  const costoInvestimento = useMemo(
    () => colaboradores.reduce((s, p) => s + Number(p.costo_total), 0),
    [colaboradores],
  );
  const sinRol = activos.filter(p => p.id_rol === null).length;
  const sinProyecto = activos.filter(p => (asignacionesByPersona.get(p.id)?.length ?? 0) === 0).length;
  const sinNeto = activos.filter(p => p.sueldo_base_recibido === null).length;

  const personalFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return personal;
    return personal.filter(p => {
      const rol = p.id_rol !== null ? rolesById.get(p.id_rol)?.nombre ?? '' : '';
      const proys = (asignacionesByPersona.get(p.id) ?? [])
        .map(a => proyectosById.get(a.id_proyecto)?.nombre ?? '').join(' ');
      return `${p.nombre} ${p.email_usuario ?? ''} ${p.email_contacto ?? ''} ${rol} ${proys}`
        .toLowerCase().includes(q);
    });
  }, [personal, busqueda, rolesById, proyectosById, asignacionesByPersona]);

  /**
   * Costo por proyecto, prorrateado; el remanente no asignado se acumula en
   * SOZU Central. Solo cuenta a los empleados directos: el costo del
   * colaborador de Investimento no lo paga SOZU.
   */
  const costoPorProyecto = useMemo(() => {
    const porProyecto = new Map<number, number>();
    let central = 0;
    for (const p of empleadosSozu) {
      const costo = Number(p.costo_total);
      const lista = asignacionesByPersona.get(p.id) ?? [];
      const pctAsignado = lista.reduce((s, a) => s + Number(a.asignacion_pct), 0);
      for (const a of lista) {
        const parte = costo * Number(a.asignacion_pct) / 100;
        porProyecto.set(a.id_proyecto, (porProyecto.get(a.id_proyecto) ?? 0) + parte);
      }
      central += costo * Math.max(0, 100 - pctAsignado) / 100;
    }
    return { porProyecto, central };
  }, [empleadosSozu, asignacionesByPersona]);

  /**
   * Guarda la ficha y, después, sus roles base adicionales.
   *
   * En ese orden y no en paralelo: en el alta los adicionales necesitan el id que
   * devuelve el insert, y el trigger de BD rechaza guardar como adicional el rol
   * que ya es principal, así que el principal debe estar escrito antes.
   */
  const guardarPersona = (
    input: NuevaPersonaInput & { proyectos?: number[]; rolesAdicionales?: number[] },
    id: number | null,
  ) => {
    const { rolesAdicionales, ...conProyectos } = input;
    const cerrar = () => setPersonaDialog({ open: false, persona: null });

    const persistirRoles = (idPersona: number, aviso: string) => {
      if (!rolesAdicionales) { toast.success(aviso); cerrar(); return; }
      guardarRolesAdicionales.mutate(
        { id_personal: idPersona, roles: rolesAdicionales },
        {
          onSuccess: () => { toast.success(aviso); cerrar(); },
          // La ficha ya quedó guardada: decirlo evita que se reintente todo.
          onError: (e) => {
            toast.error(
              `${aviso}, pero no se pudieron guardar los roles adicionales: ` +
              (e instanceof Error ? e.message : 'error desconocido'),
            );
            cerrar();
          },
        },
      );
    };

    if (id === null) {
      crearPersona.mutate(conProyectos, {
        onSuccess: (nuevoId) => persistirRoles(nuevoId, 'Persona dada de alta'),
        onError: notifyError,
      });
    } else {
      const { proyectos: _ignorado, ...campos } = conProyectos;
      actualizarPersona.mutate({ id, ...campos }, {
        onSuccess: () => persistirRoles(id, 'Ficha actualizada'),
        onError: notifyError,
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Roles y Sueldos</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Estructura organizacional y su costo: se definen los roles de la empresa, se da de alta a
            la persona, se le vincula un rol y por último los proyectos a los que da servicio. De aquí
            se alimenta el simulador (Organigrama, Escenarios, Financieros). Independiente del catálogo
            de roles y permisos del sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!schemaReady}
            onClick={() => setPersonaDialog({ open: true, persona: null })}
          >
            <Plus className="h-3.5 w-3.5" /> Nueva Persona
          </Button>
        </div>
      </div>

      {!schemaReady && !schemaLoading && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium">DDL pendiente de ejecutar en la base de datos</p>
            <p className="text-muted-foreground">
              Las tablas <code>personal_organizacional</code> y <code>personal_proyectos</code> aún no existen.
              Ejecuta <code>Ejecuciones_manuales/20260809_directorio_personal_rrhh.md</code> en Preview para
              habilitar el alta de personal.
            </p>
          </div>
        </div>
      )}

      <EstructuraSimuladorAviso />

      {/* KPIs — el costo de Investimento va aparte porque no lo paga SOZU */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Empleados SOZU"
          value={String(empleadosSozu.length)}
          nota={`de ${activos.length} personas activas`}
        />
        <KpiCard
          label="Costo fijo mensual SOZU"
          value={formatCurrency(costoEmpresa)}
          nota="solo empleados directos"
        />
        <KpiCard
          label="Colaboradores Investimento"
          value={String(colaboradores.length)}
          nota={colaboradores.length > 0
            ? `${formatCurrency(costoInvestimento)} que SOZU no paga`
            : 'ninguno registrado'}
        />
        <KpiCard
          label="Pendientes de capturar"
          value={String(sinRol + sinProyecto + sinNeto)}
          nota={`${sinRol} sin rol · ${sinProyecto} sin proyecto · ${sinNeto} sin neto`}
          tone={sinRol + sinProyecto + sinNeto > 0 ? 'warn' : 'ok'}
        />
      </div>

      {/* Paso 2 — Administración de roles */}
      <RolesSection
        roles={roles}
        personasPorRol={personasPorRol}
        verInactivos={verRolesInactivos}
        onToggleInactivos={setVerRolesInactivos}
        onNuevo={() => setRoleDialog({ open: true, rol: null })}
        onEditar={(rol) => setRoleDialog({ open: true, rol })}
        onBaja={(rol) => desactivarRol.mutate(rol.id, {
          onSuccess: () => toast.success('Rol dado de baja'),
          onError: notifyError,
        })}
        onReactivar={(rol) => reactivarRol.mutate({ id: rol.id, nombre: rol.nombre }, {
          onSuccess: () => toast.success('Rol reactivado'),
          onError: notifyError,
        })}
      />

      {/* Personal */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold">Personal de la organización</h3>
            <p className="text-xs text-muted-foreground">
              {activos.length} activo{activos.length === 1 ? '' : 's'} · Costo total mensual {formatCurrency(costoEmpresa)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar persona, rol o proyecto..."
                className="h-8 w-64 pl-7 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
              <Switch checked={verBajas} onCheckedChange={setVerBajas} />
              Ver bajas
            </label>
          </div>
        </div>

        {personalFiltrado.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {personal.length === 0
              ? 'Aún no hay personal dado de alta. Empieza con "Nueva Persona".'
              : 'Ningún resultado para la búsqueda.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Perfil</th>
                  <th>Rol</th>
                  <th>Proyectos que atiende</th>
                  <th>Costo Nominal</th>
                  <th>Costo Externo</th>
                  <th>Costo Social</th>
                  <th>Costo Total</th>
                  <th>Sueldo base recibido</th>
                  <th>Ingreso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {personalFiltrado.map(p => (
                  <PersonaRow
                    key={p.id}
                    persona={p}
                    rolesAsignables={rolesAsignables}
                    rol={p.id_rol !== null ? rolesById.get(p.id_rol) ?? null : null}
                    proyectos={proyectos}
                    asignaciones={asignacionesByPersona.get(p.id) ?? []}
                    rolesAdicionales={rolesAdicionalesByPersona.get(p.id) ?? []}
                    onEditar={() => setPersonaDialog({ open: true, persona: p })}
                    onBaja={() => setBajaTarget(p)}
                    onReactivar={() => reactivar.mutate(p.id, {
                      onSuccess: () => toast.success('Persona reactivada'),
                      onError: notifyError,
                    })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Costo por proyecto (derivado) */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4">
          <h3 className="font-semibold">Costo fijo por proyecto</h3>
          <p className="text-xs text-muted-foreground">
            Derivado del personal activo y su % de asignación. El porcentaje no asignado a ningún
            proyecto se contabiliza en SOZU Central.
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Proyecto</th><th>Personas</th><th>Costo mensual</th></tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium">SOZU Central / sin asignar</td>
              <td>{sinProyecto}</td>
              <td className="font-semibold font-mono text-sm">{formatCurrency(costoPorProyecto.central)}</td>
            </tr>
            {proyectos.map(proy => {
              const personas = asignaciones.filter(
                a => a.id_proyecto === proy.id && activos.some(p => p.id === a.id_personal),
              ).length;
              return (
                <tr key={proy.id}>
                  <td className="font-medium">{proy.nombre}</td>
                  <td>{personas}</td>
                  <td className="font-semibold font-mono text-sm">
                    {formatCurrency(costoPorProyecto.porProyecto.get(proy.id) ?? 0)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t">
              <td className="font-semibold">Total</td>
              <td>{activos.length}</td>
              <td className="font-bold font-mono text-sm">{formatCurrency(costoEmpresa)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Dialogs */}
      <Dialog
        open={roleDialog.open}
        onOpenChange={(open) => setRoleDialog({ open, rol: open ? roleDialog.rol : null })}
      >
        {/* Alto acotado y cuerpo con scroll: sin esto el formulario largo desborda
            el viewport por arriba y por abajo, y el encabezado queda inalcanzable. */}
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{roleDialog.rol ? `Editar rol: ${roleDialog.rol.nombre}` : 'Nuevo Rol'}</DialogTitle>
            <DialogDescription>
              Rol real de la empresa. Documenta su objetivo y labores para que quede claro
              qué se espera de quien lo ocupe.
            </DialogDescription>
          </DialogHeader>
          <RoleForm
            key={roleDialog.rol?.id ?? 'nuevo'}
            rol={roleDialog.rol}
            onSave={(r) => {
              const cerrar = () => setRoleDialog({ open: false, rol: null });
              if (roleDialog.rol) {
                actualizarRol.mutate({ id: roleDialog.rol.id, ...r }, {
                  onSuccess: () => { toast.success('Rol actualizado'); cerrar(); },
                  onError: notifyError,
                });
              } else {
                crearRol.mutate(r, {
                  onSuccess: () => { toast.success('Rol creado'); cerrar(); },
                  onError: notifyError,
                });
              }
            }}
            onCancel={() => setRoleDialog({ open: false, rol: null })}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={personaDialog.open}
        onOpenChange={(open) => setPersonaDialog({ open, persona: open ? personaDialog.persona : null })}
      >
        <DialogContent className="max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{personaDialog.persona ? 'Editar persona' : 'Alta de persona'}</DialogTitle>
            <DialogDescription>
              {personaDialog.persona
                ? 'Modifica los datos de la ficha. El rol y los proyectos también se editan desde la tabla.'
                : 'Da de alta a la persona; puedes vincular su rol y proyectos ahora o después.'}
            </DialogDescription>
          </DialogHeader>
          <PersonaForm
            key={personaDialog.persona?.id ?? 'nueva'}
            persona={personaDialog.persona}
            roles={rolesAsignables}
            proyectos={proyectos}
            asignaciones={
              personaDialog.persona
                ? asignacionesByPersona.get(personaDialog.persona.id) ?? []
                : []
            }
            rolesAdicionales={
              personaDialog.persona
                ? rolesAdicionalesByPersona.get(personaDialog.persona.id) ?? []
                : []
            }
            rolesAdicionalesPendiente={rolesAdicionalesPendiente}
            onSave={(input) => guardarPersona(input, personaDialog.persona?.id ?? null)}
            onCancel={() => setPersonaDialog({ open: false, persona: null })}
          />
        </DialogContent>
      </Dialog>

      <BajaDialog
        key={bajaTarget?.id ?? 'baja'}
        persona={bajaTarget}
        onClose={() => setBajaTarget(null)}
        onConfirm={(fecha_baja, motivo_baja) => {
          if (!bajaTarget) return;
          darBaja.mutate({ id: bajaTarget.id, fecha_baja, motivo_baja }, {
            onSuccess: () => { toast.success('Baja registrada'); setBajaTarget(null); },
            onError: notifyError,
          });
        }}
      />
    </div>
  );
}

/**
 * El simulador (Organigrama, Escenarios, Financieros) deriva su estructura de
 * esta pantalla, cruzando por nombre con sus catálogos de roles y proyectos.
 * Lo que no cruza se avisa aquí en vez de desaparecer en silencio.
 */
function EstructuraSimuladorAviso() {
  const { estructuraReal } = useSimulator();
  if (!estructuraReal) {
    return (
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-muted-foreground">
          Aún no hay personal activo capturado, así que el simulador sigue usando su estructura
          previa. En cuanto des de alta personal con rol, Organigrama, Escenarios y Financieros
          pasarán a calcularse con estos datos.
        </p>
      </div>
    );
  }

  const { rolesNoMapeados, proyectosNoMapeados } = estructuraReal;
  if (rolesNoMapeados.length === 0 && proyectosNoMapeados.length === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">El simulador no puede incluir parte de esta estructura</p>
        {rolesNoMapeados.length > 0 && (
          <p className="text-muted-foreground">
            Roles sin equivalencia en el catálogo del simulador:{' '}
            <span className="font-medium text-foreground">{rolesNoMapeados.join(', ')}</span>.
            Su costo no entra en Organigrama ni Financieros.
          </p>
        )}
        {proyectosNoMapeados.length > 0 && (
          <p className="text-muted-foreground">
            Proyectos con personal asignado que no existen en el menú <em>Proyectos</em> del portal:{' '}
            <span className="font-medium text-foreground">{proyectosNoMapeados.join(', ')}</span>.
            Dalos de alta ahí con el mismo nombre para que su costo se incluya.
          </p>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, nota, tone = 'ok' }: {
  label: string;
  value: string;
  nota?: string;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold font-mono mt-1', tone === 'warn' && 'text-amber-600')}>{value}</p>
      {nota && <p className="text-[11px] text-muted-foreground mt-0.5">{nota}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Paso 2 — Administración de roles                                    */
/* ------------------------------------------------------------------ */

const TIPO_LABEL: Record<RoleType, string> = {
  strategic: 'Estratégico',
  operative: 'Operativo',
  support: 'Soporte',
};

function RolesSection({ roles, personasPorRol, verInactivos, onToggleInactivos, onNuevo, onEditar, onBaja, onReactivar }: {
  roles: RolOrganizacional[];
  personasPorRol: Map<number, number>;
  verInactivos: boolean;
  onToggleInactivos: (v: boolean) => void;
  onNuevo: () => void;
  onEditar: (rol: RolOrganizacional) => void;
  onBaja: (rol: RolOrganizacional) => void;
  onReactivar: (rol: RolOrganizacional) => void;
}) {
  const [expandido, setExpandido] = useState<number | null>(null);
  const sinDocumentar = roles.filter(r => r.activo && !r.objetivo?.trim() && !r.descripcion_labores?.trim()).length;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold">Roles de la empresa</h3>
          <p className="text-xs text-muted-foreground">
            Define los puestos de la organización y qué se espera de cada uno. Las personas
            se asignan a uno de estos roles.
            {sinDocumentar > 0 && (
              <span className="text-amber-600">
                {' '}· {sinDocumentar} sin objetivo ni labores documentadas
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
            <Switch checked={verInactivos} onCheckedChange={onToggleInactivos} />
            Ver dados de baja
          </label>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onNuevo}>
            <Plus className="h-3.5 w-3.5" /> Nuevo Rol
          </Button>
        </div>
      </div>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Sin roles definidos aún. Crea al menos uno para poder asignarlo al personal.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Rol</th>
                <th>Tipo</th>
                <th>Ámbito</th>
                <th>Comisión</th>
                <th>Personas</th>
                <th>Objetivo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roles.map(rol => {
                const personas = personasPorRol.get(rol.id) ?? 0;
                const abierto = expandido === rol.id;
                const documentado = !!(rol.objetivo?.trim() || rol.descripcion_labores?.trim());
                return (
                  <Fragment key={rol.id}>
                    <tr className={cn(!rol.activo && 'opacity-55')}>
                      <td>
                        <button
                          title={abierto ? 'Ocultar detalle' : 'Ver objetivo y labores'}
                          onClick={() => setExpandido(abierto ? null : rol.id)}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', abierto && 'rotate-90')} />
                        </button>
                      </td>
                      <td>
                        <span className="font-medium flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {rol.nombre}
                          {!rol.activo && <Badge variant="outline" className="text-[10px]">Baja</Badge>}
                        </span>
                      </td>
                      <td className="text-sm">{TIPO_LABEL[rol.tipo]}</td>
                      <td>
                        <Badge variant={rol.pertenece_a === 'sozu_central' ? 'default' : 'secondary'} className="text-[10px]">
                          {rol.pertenece_a === 'sozu_central' ? 'SOZU Central' : 'Proyecto'}
                        </Badge>
                      </td>
                      <td>
                        {rol.participa_comision
                          ? <Badge variant="outline" className="text-[10px] border-accent text-accent">Sí</Badge>
                          : <span className="text-xs text-muted-foreground">No</span>}
                      </td>
                      <td className="text-sm">{personas}</td>
                      <td className="max-w-xs">
                        {documentado ? (
                          <span className="text-xs text-muted-foreground line-clamp-1" title={rol.objetivo ?? ''}>
                            {rol.objetivo?.trim() || 'Solo descripción de labores'}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Sin documentar
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button title="Editar rol" onClick={() => onEditar(rol)} className="rounded p-1 hover:bg-muted">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          {rol.activo ? (
                            <button
                              title={personas > 0
                                ? `Asignado a ${personas} persona(s): reasígnalas antes de darlo de baja`
                                : 'Dar de baja'}
                              onClick={() => onBaja(rol)}
                              className="rounded p-1 hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          ) : (
                            <button title="Reactivar rol" onClick={() => onReactivar(rol)} className="rounded p-1 hover:bg-muted">
                              <UserCheck className="h-3.5 w-3.5 text-accent" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {abierto && (
                      <tr>
                        <td colSpan={8}>
                          <div className="grid md:grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4 text-sm">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Objetivo del rol
                              </p>
                              <p className={cn('whitespace-pre-wrap', !rol.objetivo?.trim() && 'italic text-muted-foreground')}>
                                {rol.objetivo?.trim() || 'Sin capturar'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Descripción de labores
                              </p>
                              <p className={cn('whitespace-pre-wrap', !rol.descripcion_labores?.trim() && 'italic text-muted-foreground')}>
                                {rol.descripcion_labores?.trim() || 'Sin capturar'}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fila de persona — rol y proyectos se vinculan aquí                  */
/* ------------------------------------------------------------------ */

function PersonaRow({ persona, rolesAsignables, rol, proyectos, asignaciones, rolesAdicionales, onEditar, onBaja, onReactivar }: {
  persona: PersonalOrganizacional;
  rolesAsignables: RolOrganizacional[];
  rol: RolOrganizacional | null;
  proyectos: ProyectoActivo[];
  asignaciones: AsignacionProyecto[];
  /** Roles base adicionales al principal. */
  rolesAdicionales: number[];
  onEditar: () => void;
  onBaja: () => void;
  onReactivar: () => void;
}) {
  const actualizar = useActualizarPersona();
  const commit = (campos: Partial<NuevaPersonaInput>) =>
    actualizar.mutate({ id: persona.id, ...campos }, { onError: notifyError });

  // Si el rol asignado fue dado de baja, se sigue mostrando para no perder el dato.
  const opcionesRol = rol && !rol.activo ? [...rolesAsignables, rol] : rolesAsignables;

  /**
   * Roles distintos al principal: los base adicionales y los que asume por
   * proyecto. Se listan juntos porque en la tabla lo que importa es cuántos
   * sombreros trae la persona, no de dónde sale cada uno.
   */
  const otrosRoles = useMemo(() => {
    const nombreDe = (id: number) => rolesAsignables.find(r => r.id === id)?.nombre;
    const nombres = new Set<string>();
    for (const idRol of rolesAdicionales) {
      if (idRol === persona.id_rol) continue;
      const nombre = nombreDe(idRol);
      if (nombre) nombres.add(nombre);
    }
    for (const a of asignaciones) {
      if (a.id_rol === null || a.id_rol === persona.id_rol) continue;
      const nombre = nombreDe(a.id_rol);
      if (nombre) nombres.add(nombre);
    }
    return Array.from(nombres);
  }, [asignaciones, rolesAdicionales, persona.id_rol, rolesAsignables]);

  return (
    <tr className={cn(!persona.activo && 'opacity-55')}>
      <td>
        <div className="flex flex-col min-w-0">
          <span className="font-medium truncate flex items-center gap-2">
            {persona.nombre}
            {!persona.activo && <Badge variant="outline" className="text-[10px]">Baja</Badge>}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {persona.email_usuario ?? persona.email_contacto ?? 'Sin cuenta ligada'}
          </span>
        </div>
      </td>
      <td>
        {/* Solo el empleado directo es costo de SOZU; el colaborador de
            Investimento se registra para poder comisionarle. */}
        <Select
          value={persona.tipo_personal}
          onValueChange={(v) => commit({ tipo_personal: v as TipoPersonal })}
        >
          <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="empleado_sozu">{ETIQUETA_TIPO_PERSONAL.empleado_sozu}</SelectItem>
            <SelectItem value="colaborador_investimento">
              {ETIQUETA_TIPO_PERSONAL.colaborador_investimento}
            </SelectItem>
          </SelectContent>
        </Select>
        {!esCostoDeSozu(persona) && (
          <p className="text-[11px] text-muted-foreground mt-1">Su costo no lo paga SOZU</p>
        )}
      </td>
      <td>
        <Select
          value={persona.id_rol !== null ? String(persona.id_rol) : 'none'}
          onValueChange={(v) => commit({ id_rol: v === 'none' ? null : Number(v) })}
        >
          <SelectTrigger className="h-8 w-52 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin rol asignado</SelectItem>
            {opcionesRol.map(r => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.nombre} · {r.pertenece_a === 'sozu_central' ? 'SOZU' : 'Proyecto'}
                {!r.activo && ' (de baja)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {otrosRoles.length > 0 ? (
          <p className="text-[11px] text-primary mt-1 max-w-52 truncate" title={otrosRoles.join(' · ')}>
            + {otrosRoles.length} rol{otrosRoles.length === 1 ? '' : 'es'} más
          </p>
        ) : rol?.objetivo ? (
          <p className="text-[11px] text-muted-foreground mt-1 max-w-52 truncate" title={rol.objetivo}>
            {rol.objetivo}
          </p>
        ) : null}
      </td>
      <td>
        <ProyectosPicker
          idPersonal={persona.id}
          proyectos={proyectos}
          asignaciones={asignaciones}
          rol={rol}
          rolesAsignables={rolesAsignables}
        />
      </td>
      <td>
        <NumberCell value={persona.costo_nominal} width="w-28" onCommit={(v) => commit({ costo_nominal: v })} />
      </td>
      <td>
        <NumberCell value={persona.costo_externo} width="w-28" onCommit={(v) => commit({ costo_externo: v })} />
      </td>
      <td>
        <NumberCell value={persona.costo_social} width="w-28" onCommit={(v) => commit({ costo_social: v })} />
      </td>
      <td className="font-semibold font-mono text-sm">{formatCurrency(Number(persona.costo_total))}</td>
      <td>
        <NumberCell
          value={persona.sueldo_base_recibido}
          width="w-28"
          nullable
          max={Number(persona.costo_total)}
          maxMessage="El neto recibido no puede exceder el costo total de la persona"
          onCommit={(v) => commit({ sueldo_base_recibido: v })}
        />
      </td>
      <td>
        <Input
          type="date"
          className="w-36 h-8 text-sm"
          value={persona.fecha_ingreso ?? ''}
          onChange={e => commit({ fecha_ingreso: e.target.value || null })}
        />
      </td>
      <td>
        <div className="flex items-center gap-1">
          <button title="Editar" onClick={onEditar} className="rounded p-1 hover:bg-muted">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {persona.activo ? (
            <button title="Dar de baja" onClick={onBaja} className="rounded p-1 hover:bg-destructive/10">
              <UserMinus className="h-3.5 w-3.5 text-destructive" />
            </button>
          ) : (
            <button title="Reactivar" onClick={onReactivar} className="rounded p-1 hover:bg-muted">
              <UserCheck className="h-3.5 w-3.5 text-accent" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Input numérico que confirma en blur/Enter, para no disparar un UPDATE por tecla.
 * Con `nullable`, vaciar el campo guarda `null` ("sin capturar"), distinto de cero.
 */
function NumberCell<T extends number | null>({ value, width, onCommit, nullable, max, maxMessage }: {
  value: T;
  width: string;
  onCommit: (v: T) => void;
  nullable?: boolean;
  max?: number;
  maxMessage?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const actual = draft ?? (value === null ? '' : String(value));

  const commit = () => {
    if (draft === null) return;
    const limpio = draft.trim();
    setDraft(null);

    if (limpio === '') {
      if (!nullable) { toast.error('El valor es obligatorio'); return; }
      if (value !== null) onCommit(null as T);
      return;
    }

    const parsed = Number(limpio);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('El valor debe ser un número mayor o igual a cero');
      return;
    }
    if (max !== undefined && parsed > max) {
      toast.error(maxMessage ?? `El valor no puede exceder ${formatCurrency(max)}`);
      return;
    }
    if (parsed !== Number(value)) onCommit(parsed as T);
  };

  return (
    <Input
      type="number"
      className={cn('h-8 text-sm', width)}
      placeholder={nullable ? 'Sin capturar' : undefined}
      value={actual}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Paso 3 — vinculación con proyectos                                  */
/* ------------------------------------------------------------------ */

function ProyectosPicker({ idPersonal, proyectos, asignaciones, rol, rolesAsignables }: {
  idPersonal: number;
  proyectos: ProyectoActivo[];
  asignaciones: AsignacionProyecto[];
  rol: RolOrganizacional | null;
  rolesAsignables: RolOrganizacional[];
}) {
  const [open, setOpen] = useState(false);
  const vincular = useVincularProyecto();
  const desvincular = useDesvincularProyecto();
  const actualizarPct = useActualizarAsignacion();

  const asignadoPorProyecto = new Map(asignaciones.map(a => [a.id_proyecto, a]));
  const pctTotal = asignaciones.reduce((s, a) => s + Number(a.asignacion_pct), 0);

  const toggle = (idProyecto: number) => {
    const existente = asignadoPorProyecto.get(idProyecto);
    if (existente) {
      desvincular.mutate(existente.id, { onError: notifyError });
    } else {
      vincular.mutate({ id_personal: idPersonal, id_proyecto: idProyecto }, { onError: notifyError });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="min-w-56 max-w-72 h-auto min-h-8 justify-between text-xs font-normal py-1">
          <span className="flex flex-wrap gap-1 items-center text-left">
            {asignaciones.length === 0 ? (
              <span className={cn('text-muted-foreground', rol?.pertenece_a === 'project' && 'text-amber-600')}>
                {rol?.pertenece_a === 'project' ? 'Falta asignar proyecto' : 'Sin proyecto (SOZU Central)'}
              </span>
            ) : (
              asignaciones.map(a => (
                <Badge key={a.id} variant="secondary" className="text-[10px] font-normal">
                  {proyectos.find(p => p.id === a.id_proyecto)?.nombre ?? `#${a.id_proyecto}`}
                  {Number(a.asignacion_pct) !== 100 && ` ${Number(a.asignacion_pct)}%`}
                </Badge>
              ))
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-3" align="start">
        <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          Proyectos a los que da servicio
        </p>
        {proyectos.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Sin proyectos activos publicados.</p>
        ) : (
          <div className="space-y-2">
            {proyectos.map(proy => {
              const asignacion = asignadoPorProyecto.get(proy.id);
              return (
                <div key={proy.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`proy-${idPersonal}-${proy.id}`}
                      checked={!!asignacion}
                      onCheckedChange={() => toggle(proy.id)}
                    />
                    <Label htmlFor={`proy-${idPersonal}-${proy.id}`} className="flex-1 text-xs font-normal cursor-pointer">
                      {proy.nombre}
                    </Label>
                    {asignacion && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          className="h-7 w-16 text-xs"
                          defaultValue={Number(asignacion.asignacion_pct)}
                          onBlur={e => {
                            const pct = Number(e.target.value);
                            if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
                              toast.error('El % de asignación debe estar entre 1 y 100');
                              e.target.value = String(Number(asignacion.asignacion_pct));
                              return;
                            }
                            if (pct !== Number(asignacion.asignacion_pct)) {
                              actualizarPct.mutate({ id: asignacion.id, asignacion_pct: pct }, { onError: notifyError });
                            }
                          }}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    )}
                  </div>
                  {/* Rol que la persona asume en ESTE proyecto. Puede diferir del base. */}
                  {asignacion && (
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-[11px] text-muted-foreground shrink-0">Rol aquí</span>
                      <Select
                        value={asignacion.id_rol !== null ? String(asignacion.id_rol) : 'base'}
                        onValueChange={(v) => actualizarPct.mutate(
                          { id: asignacion.id, id_rol: v === 'base' ? null : Number(v) },
                          { onError: notifyError },
                        )}
                      >
                        <SelectTrigger className="h-7 flex-1 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="base">
                            Mismo que el base{rol ? ` (${rol.nombre})` : ''}
                          </SelectItem>
                          {rolesAsignables.map(r => (
                            <SelectItem key={r.id} value={String(r.id)}>{r.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {pctTotal > 100 && (
          <p className="text-[11px] text-destructive mt-2">
            La suma de asignaciones es {pctTotal}% — excede el 100% de la persona.
          </p>
        )}
        {asignaciones.length > 0 && pctTotal < 100 && (
          <p className="text-[11px] text-muted-foreground mt-2">
            {100 - pctTotal}% restante se contabiliza en SOZU Central.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Paso 1 — alta / modificación de la persona                          */
/* ------------------------------------------------------------------ */

function PersonaForm({
  persona, roles, proyectos, asignaciones, rolesAdicionales, rolesAdicionalesPendiente,
  onSave, onCancel,
}: {
  persona: PersonalOrganizacional | null;
  roles: RolOrganizacional[];
  proyectos: ProyectoActivo[];
  /** Asignaciones de esta persona; vacío en el alta. Sirven para sus roles de empresa. */
  asignaciones: AsignacionProyecto[];
  /** Roles base adicionales al principal. */
  rolesAdicionales: number[];
  /** La tabla de roles adicionales aún no existe en la BD. */
  rolesAdicionalesPendiente: boolean;
  onSave: (input: NuevaPersonaInput & { proyectos?: number[]; rolesAdicionales?: number[] }) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(persona?.nombre ?? '');
  const [tipoPersonal, setTipoPersonal] = useState<TipoPersonal>(persona?.tipo_personal ?? 'empleado_sozu');
  const [emailUsuario, setEmailUsuario] = useState<string | null>(persona?.email_usuario ?? null);
  const [emailContacto, setEmailContacto] = useState(persona?.email_contacto ?? '');
  const [telefono, setTelefono] = useState(persona?.telefono ?? '');
  const [idRol, setIdRol] = useState<number | null>(persona?.id_rol ?? null);
  const [costoNominal, setCostoNominal] = useState(String(persona?.costo_nominal ?? 20000));
  const [costoExterno, setCostoExterno] = useState(String(persona?.costo_externo ?? 0));
  const [costoSocial, setCostoSocial] = useState(String(persona?.costo_social ?? 0));
  const [netoRecibido, setNetoRecibido] = useState(
    persona?.sueldo_base_recibido !== null && persona?.sueldo_base_recibido !== undefined
      ? String(persona.sueldo_base_recibido)
      : '',
  );
  const [fechaIngreso, setFechaIngreso] = useState(persona?.fecha_ingreso ?? '');
  const [proyectosSel, setProyectosSel] = useState<number[]>([]);
  const [adicionales, setAdicionales] = useState<number[]>(rolesAdicionales);

  const esAlta = persona === null;

  /**
   * Se recalcula con el rol elegido en el formulario, no con el guardado: si el
   * usuario acaba de cambiar el rol base, la lista debe reflejar lo que va a
   * quedar, no lo que había.
   */
  const rolesEmpresa = useMemo(
    () => rolesEnLaEmpresa(
      { id_rol: idRol },
      asignaciones,
      roles,
      (id) => proyectos.find(p => p.id === id)?.nombre ?? `Proyecto ${id}`,
      adicionales,
    ),
    [idRol, asignaciones, roles, proyectos, adicionales],
  );

  const costosValidos = [costoNominal, costoExterno, costoSocial]
    .every(v => Number.isFinite(Number(v)) && Number(v) >= 0);
  const total = costoTotal({
    costo_nominal: Number(costoNominal) || 0,
    costo_externo: Number(costoExterno) || 0,
    costo_social: Number(costoSocial) || 0,
  });
  const netoCapturado = netoRecibido.trim() !== '';
  const netoValido = !netoCapturado
    || (Number.isFinite(Number(netoRecibido)) && Number(netoRecibido) >= 0 && Number(netoRecibido) <= total);

  const guardar = () => {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!costosValidos) { toast.error('Los costos deben ser números ≥ 0'); return; }
    if (!netoValido) {
      toast.error('El sueldo base recibido debe estar entre 0 y el costo total');
      return;
    }
    onSave({
      nombre: nombre.trim(),
      tipo_personal: tipoPersonal,
      email_usuario: emailUsuario,
      email_contacto: emailContacto.trim() || null,
      telefono: telefono.trim() || null,
      id_rol: idRol,
      costo_nominal: Number(costoNominal),
      costo_externo: Number(costoExterno),
      costo_social: Number(costoSocial),
      sueldo_base_recibido: netoCapturado ? Number(netoRecibido) : null,
      fecha_ingreso: fechaIngreso || null,
      ...(esAlta ? { proyectos: proyectosSel } : {}),
      // El principal nunca viaja como adicional: la BD lo rechaza (23514).
      ...(rolesAdicionalesPendiente ? {} : { rolesAdicionales: adicionales.filter(id => id !== idRol) }),
    });
  };

  return (
    /* Cuerpo con scroll y pie fijo: el costo total y los botones son lo que se
       consulta al capturar, así que no deben irse con el scroll. */
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nombre completo *</Label>
          <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Ana Martínez" />
        </div>
        <div>
          <Label>Cuenta del sistema (opcional)</Label>
          <UsuarioPicker
            email={emailUsuario}
            onSelect={(email, nombreUsuario) => {
              setEmailUsuario(email);
              if (!nombre.trim() && nombreUsuario) setNombre(nombreUsuario);
            }}
            onClear={() => setEmailUsuario(null)}
          />
        </div>
      </div>

      {emailUsuario && (
        <CuentaSistemaPanel
          email={emailUsuario}
          onCompletar={(datos) => {
            const llenados: string[] = [];
            if (!nombre.trim() && datos.nombre) { setNombre(datos.nombre); llenados.push('nombre'); }
            if (!emailContacto.trim() && datos.email) { setEmailContacto(datos.email); llenados.push('email de contacto'); }
            if (!telefono.trim() && datos.telefono) { setTelefono(datos.telefono); llenados.push('teléfono'); }
            toast[llenados.length ? 'success' : 'info'](
              llenados.length
                ? `Se completó: ${llenados.join(', ')}.`
                : 'No había campos vacíos que completar; nada se sobrescribió.',
            );
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Email de contacto</Label>
          <Input value={emailContacto} onChange={e => setEmailContacto(e.target.value)} placeholder="correo@ejemplo.com" />
        </div>
        <div>
          <Label>Teléfono</Label>
          <Input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="55 0000 0000" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Rol principal en la empresa</Label>
          <Select
            value={idRol !== null ? String(idRol) : 'none'}
            onValueChange={(v) => setIdRol(v === 'none' ? null : Number(v))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin rol asignado</SelectItem>
              {roles.map(r => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.nombre} · {r.pertenece_a === 'sozu_central' ? 'SOZU' : 'Proyecto'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1">
            Rige el costo, la comisión y el organigrama.
          </p>
        </div>
        <div>
          <Label>Fecha de ingreso</Label>
          <Input type="date" value={fechaIngreso} onChange={e => setFechaIngreso(e.target.value)} />
        </div>
      </div>

      {/* Dentro de la empresa una persona puede tener varios roles: el principal,
          otros roles base, y el que asume en cada proyecto donde se le asignó uno
          distinto. Solo el principal reparte dinero. */}
      <div className="rounded-lg border p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Roles en la empresa ({rolesEmpresa.length})
        </p>

        {rolesEmpresa.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {rolesEmpresa.map(r => (
              <Badge
                key={`${r.idRol}-${r.idProyecto ?? 'base'}`}
                variant={r.principal ? 'default' : 'secondary'}
                className="text-[11px] font-normal"
              >
                {r.nombre}
                <span className="opacity-70 ml-1">
                  · {r.principal ? 'principal' : r.idProyecto === null ? 'base' : r.proyecto}
                </span>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic mb-3">Aún sin roles asignados.</p>
        )}

        {rolesAdicionalesPendiente ? (
          <div className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Para asignar más de un rol base falta ejecutar{' '}
              <span className="font-medium text-foreground">
                Ejecuciones_manuales/20260812_roles_base_multiples.md
              </span>{' '}
              en la base de datos. Mientras tanto la persona conserva su rol principal y
              su rol por proyecto, que sí funcionan.
            </p>
          </div>
        ) : (
          <>
            <Label className="text-xs">Otros roles base</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1.5">
              {roles.filter(r => r.id !== idRol).map(r => (
                <label key={r.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={adicionales.includes(r.id)}
                    onCheckedChange={(checked) =>
                      setAdicionales(prev => checked ? [...prev, r.id] : prev.filter(id => id !== r.id))
                    }
                  />
                  {r.nombre}
                </label>
              ))}
            </div>
          </>
        )}

        <p className="text-[11px] text-muted-foreground mt-2">
          El rol principal aplica donde no haya uno específico y es el único que reparte
          costo y comisión; los demás quedan como registro. El rol por proyecto se edita
          desde la columna Proyectos de la tabla.
        </p>
      </div>

      {esAlta && (
        <div>
          <Label>Proyectos a los que dará servicio</Label>
          {proyectos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic mt-1">Sin proyectos activos publicados.</p>
          ) : (
            <div className="flex flex-wrap gap-3 mt-2">
              {proyectos.map(proy => (
                <label key={proy.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={proyectosSel.includes(proy.id)}
                    onCheckedChange={(checked) =>
                      setProyectosSel(prev => checked ? [...prev, proy.id] : prev.filter(id => id !== proy.id))
                    }
                  />
                  {proy.nombre}
                </label>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Se vinculan al 100%; el porcentaje se ajusta después desde la tabla.
          </p>
        </div>
      )}

      <div>
        <Label>Perfil</Label>
        <Select value={tipoPersonal} onValueChange={(v) => setTipoPersonal(v as TipoPersonal)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="empleado_sozu">
              {ETIQUETA_TIPO_PERSONAL.empleado_sozu} — su costo es costo fijo de SOZU
            </SelectItem>
            <SelectItem value="colaborador_investimento">
              {ETIQUETA_TIPO_PERSONAL.colaborador_investimento} — SOZU no paga su sueldo
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground mt-1">
          {tipoPersonal === 'empleado_sozu'
            ? 'Su costo suma al costo fijo mensual y al costo por proyecto.'
            : 'Da servicio y soporte al grupo; su costo se registra como referencia pero no suma al costo de SOZU. Puede comisionar como bono por ese soporte.'}
        </p>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {tipoPersonal === 'empleado_sozu'
            ? 'Costo de la persona para la empresa'
            : 'Costo de referencia (lo paga Investimento)'}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Costo Nominal</Label>
            <Input type="number" value={costoNominal} onChange={e => setCostoNominal(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">Lo que va en nómina formal.</p>
          </div>
          <div>
            <Label>Costo Externo</Label>
            <Input type="number" value={costoExterno} onChange={e => setCostoExterno(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">Fuera de nómina: asimilados, honorarios.</p>
          </div>
          <div>
            <Label>Costo Social</Label>
            <Input type="number" value={costoSocial} onChange={e => setCostoSocial(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">IMSS, INFONAVIT, SAR, ISN.</p>
          </div>
        </div>
      </div>

      <div>
        <Label>Sueldo base recibido</Label>
        <Input
          type="number"
          value={netoRecibido}
          onChange={e => setNetoRecibido(e.target.value)}
          placeholder="Sin capturar"
          className={cn(!netoValido && 'border-destructive')}
        />
        <p className={cn('text-[11px] mt-1', netoValido ? 'text-muted-foreground' : 'text-destructive')}>
          {netoValido
            ? 'Lo que realmente recibe la persona, ya descontados costos e impuestos. Puede dejarse vacío.'
            : `No puede ser negativo ni exceder el costo total (${formatCurrency(total)}).`}
        </p>
      </div>

      </div>

      <div className="shrink-0 border-t pt-3 mt-3 space-y-3">
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
          <span>
            Costo Total mensual:{' '}
            <span className="font-semibold font-mono">{formatCurrency(total)}</span>
            <span className="text-xs text-muted-foreground ml-1">(nominal + externo + social)</span>
          </span>
          {netoCapturado && netoValido && (
            <span className="text-xs text-muted-foreground">
              Recibe {formatCurrency(Number(netoRecibido))} · la empresa absorbe{' '}
              {formatCurrency(total - Number(netoRecibido))}
            </span>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button disabled={!nombre.trim() || !netoValido} onClick={guardar}>
            {esAlta ? 'Dar de alta' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BajaDialog({ persona, onClose, onConfirm }: {
  persona: PersonalOrganizacional | null;
  onClose: () => void;
  onConfirm: (fechaBaja: string, motivo: string | null) => void;
}) {
  const [fecha, setFecha] = useState(hoy());
  const [motivo, setMotivo] = useState('');

  return (
    <AlertDialog open={persona !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dar de baja a {persona?.nombre}</AlertDialogTitle>
          <AlertDialogDescription>
            La ficha se conserva para el histórico de costos y sus vinculaciones a proyectos se cierran.
            Puedes reactivarla después desde el filtro "Ver bajas".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fecha de baja</Label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div>
            <Label>Motivo (opcional)</Label>
            <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: Renuncia voluntaria" />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(fecha, motivo.trim() || null)}>
            Confirmar baja
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const ETIQUETA_TIPO_PERSONA: Record<string, string> = { pf: 'Persona física', pm: 'Persona moral' };
const ETIQUETA_SEXO: Record<string, string> = { m: 'Masculino', f: 'Femenino' };

const fechaLarga = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
};

/** Teléfono con su clave de país cuando existe. */
const telefonoCompleto = (p: PersonaVinculada) =>
  p.telefono ? `${p.clave_pais_telefono ? `+${p.clave_pais_telefono} ` : ''}${p.telefono}` : null;

/**
 * Lo que hay detrás de la cuenta del sistema ligada a la persona.
 *
 * Dos cosas distintas que conviene no confundir: el **rol del sistema**, que es
 * uno solo y define el acceso (`usuarios.rol_id`), y el expediente de
 * `personas`, al que se llega por `usuarios.id_persona = personas.id`.
 *
 * Todo aquí es de solo lectura: `personas` es la tabla central del sistema y su
 * edición vive en el expediente, no en RRHH. Lo único que se ofrece es copiar
 * datos hacia los campos vacíos de esta ficha.
 */
function CuentaSistemaPanel({ email, onCompletar }: {
  email: string;
  onCompletar: (datos: { nombre: string; email: string | null; telefono: string | null }) => void;
}) {
  const { data: cuenta, isLoading } = useCuentaSistema(email);
  /* Abierto de entrada —nada se oculta sin avisar—, plegable para que el
     expediente no empuje el resto del formulario cuando ya se revisó. */
  const [abierto, setAbierto] = useState(true);

  if (isLoading) {
    return (
      <div className="rounded-lg border p-3 text-xs text-muted-foreground">
        Consultando la cuenta {email}…
      </div>
    );
  }

  if (!cuenta) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
        <p className="text-xs text-muted-foreground">
          No se pudo leer la cuenta <span className="font-medium text-foreground">{email}</span>.
          Puede estar dada de baja o fuera de tu alcance de permisos. La persona se puede guardar
          igual; el vínculo queda registrado.
        </p>
      </div>
    );
  }

  const { persona } = cuenta;

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Cuenta del sistema
          </p>
          <p className="text-sm font-medium truncate">{cuenta.nombre}</p>
          <p className="text-xs text-muted-foreground truncate">{cuenta.email}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-muted-foreground">Rol en el sistema</p>
          {cuenta.rol
            ? <Badge variant="outline" className="text-[11px] font-normal">{cuenta.rol.nombre}</Badge>
            : <span className="text-xs text-muted-foreground italic">Sin rol</span>}
          <p className="text-[10px] text-muted-foreground mt-0.5">Uno solo, define su acceso</p>
        </div>
      </div>

      {persona ? (
        <>
          <div className="border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setAbierto(a => !a)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
              >
                <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', abierto && 'rotate-90')} />
                Expediente de la persona · id {persona.id}
              </button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onCompletar({
                  nombre: persona.nombre_legal,
                  email: persona.email,
                  telefono: telefonoCompleto(persona),
                })}
              >
                Completar campos vacíos
              </Button>
            </div>

            {abierto ? (
              <>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 mt-3">
                  <DatoPersona etiqueta="Nombre legal" valor={persona.nombre_legal} />
                  <DatoPersona etiqueta="Nombre comercial" valor={persona.nombre_comercial} />
                  <DatoPersona
                    etiqueta="Tipo"
                    valor={ETIQUETA_TIPO_PERSONA[persona.tipo_persona] ?? persona.tipo_persona}
                  />
                  <DatoPersona etiqueta="RFC" valor={persona.rfc} />
                  <DatoPersona etiqueta="CURP" valor={persona.curp} />
                  <DatoPersona etiqueta="Nacimiento" valor={fechaLarga(persona.fecha_nacimiento)} />
                  <DatoPersona
                    etiqueta="Sexo"
                    valor={persona.sexo ? ETIQUETA_SEXO[persona.sexo.toLowerCase()] ?? persona.sexo : null}
                  />
                  <DatoPersona etiqueta="Email" valor={persona.email} />
                  <DatoPersona etiqueta="Teléfono" valor={telefonoCompleto(persona)} />
                  <DatoPersona etiqueta="Ocupación" valor={persona.ocupacion} />
                  <DatoPersona etiqueta="Régimen fiscal" valor={persona.regimen} />
                </dl>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Estos datos se leen de <span className="font-medium">personas</span> y no se
                  editan aquí. El botón solo llena los campos de la ficha que estén vacíos.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1.5 truncate">
                {persona.nombre_legal}
                {persona.rfc && <span className="ml-2 font-mono">{persona.rfc}</span>}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="border-t pt-3 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            {cuenta.motivoSinPersona === 'sin_vinculo' ? (
              <>
                Esta cuenta no tiene expediente en <span className="font-medium">personas</span>:
                su <code className="text-[10px]">id_persona</code> está vacío. Es lo habitual en
                cuentas internas —dirección, finanzas, cobranza, jurídico—, así que los datos de
                la ficha se capturan a mano.
              </>
            ) : (
              <>
                La cuenta apunta a un expediente que no se pudo leer. Puede estar inactivo o fuera
                de tu alcance de permisos; los datos de la ficha se capturan a mano.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function DatoPersona({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">{etiqueta}</dt>
      <dd className={cn('text-xs truncate', valor ? 'text-foreground' : 'text-muted-foreground italic')}
        title={valor ?? undefined}>
        {valor ?? 'Sin dato'}
      </dd>
    </div>
  );
}

/** Buscador de usuario real del sistema (nombre/email); opcional. */
function UsuarioPicker({ email, onSelect, onClear }: {
  email: string | null;
  onSelect: (email: string, nombre: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: resultados = [], isLoading } = useBuscarUsuarios(search);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="flex-1 justify-between text-xs font-normal">
            <span className="truncate">{email ?? 'Sin cuenta ligada'}</span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar por nombre o email..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>
                {isLoading ? 'Buscando...' : search.trim().length < 2
                  ? 'Escribe al menos 2 caracteres'
                  : 'Sin resultados. La persona puede darse de alta sin cuenta.'}
              </CommandEmpty>
              <CommandGroup>
                {resultados.map(u => (
                  <CommandItem
                    key={u.email}
                    value={`${u.nombre} ${u.email}`}
                    onSelect={() => { onSelect(u.email, u.nombre); setOpen(false); setSearch(''); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', email === u.email ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <span className="text-sm truncate">{u.nombre}</span>
                      <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {u.rol_nombre ?? 'Sin rol'}
                        </Badge>
                        {/* Anticipa el caso vacío: se ve antes de elegir, no después. */}
                        {u.id_persona === null && (
                          <span className="text-[10px] text-muted-foreground">sin expediente</span>
                        )}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {email && (
        <button title="Quitar cuenta ligada" onClick={onClear} className="rounded p-1.5 hover:bg-muted">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

function RoleForm({ rol, onSave, onCancel }: {
  rol: RolOrganizacional | null;
  onSave: (r: NuevoRolInput) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(rol?.nombre ?? '');
  const [tipo, setTipo] = useState<RoleType>(rol?.tipo ?? 'operative');
  const [perteneceA, setPerteneceA] = useState<RoleBelongsTo>(rol?.pertenece_a ?? 'project');
  const [comision, setComision] = useState(rol?.participa_comision ?? true);
  const [objetivo, setObjetivo] = useState(rol?.objetivo ?? '');
  const [labores, setLabores] = useState(rol?.descripcion_labores ?? '');

  const guardar = () => {
    if (!nombre.trim()) { toast.error('El nombre del rol es obligatorio'); return; }
    onSave({
      nombre: nombre.trim(),
      tipo,
      pertenece_a: perteneceA,
      participa_comision: comision,
      objetivo: objetivo.trim() || null,
      descripcion_labores: labores.trim() || null,
    });
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
      <div>
        <Label>Nombre del Rol *</Label>
        <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Gerente de Ventas" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as RoleType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="strategic">Estratégico</SelectItem>
              <SelectItem value="operative">Operativo</SelectItem>
              <SelectItem value="support">Soporte</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Pertenece a</Label>
          <Select value={perteneceA} onValueChange={(v) => setPerteneceA(v as RoleBelongsTo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sozu_central">SOZU Central</SelectItem>
              <SelectItem value="project">Proyecto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={comision} onCheckedChange={setComision} />
        <Label>Participa en comisión</Label>
      </div>

      <div>
        <Label>Objetivo del rol</Label>
        <Textarea
          rows={3}
          value={objetivo}
          onChange={e => setObjetivo(e.target.value)}
          placeholder="Para qué existe el rol: el resultado que debe producir. Ej: Sostener el ritmo de colocación del desarrollo cumpliendo la meta mensual de unidades vendidas."
        />
      </div>

      <div>
        <Label>Descripción de labores</Label>
        <Textarea
          rows={4}
          value={labores}
          onChange={e => setLabores(e.target.value)}
          placeholder="Actividades y responsabilidades concretas. Ej: Atiende prospectos asignados, da seguimiento en CRM, coordina recorridos, arma ofertas y acompaña el cierre."
        />
      </div>

      </div>

      <div className="shrink-0 flex justify-end gap-2 border-t pt-3 mt-3">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button disabled={!nombre.trim()} onClick={guardar}>
          {rol ? 'Guardar cambios' : 'Crear rol'}
        </Button>
      </div>
    </div>
  );
}
