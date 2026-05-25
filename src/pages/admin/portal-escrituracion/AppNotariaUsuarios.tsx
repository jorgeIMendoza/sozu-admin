import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Plus, Search, Loader2, AlertTriangle, User, Landmark,
  CheckCircle2, XCircle, RefreshCw, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotariaUsuario {
  email:          string;
  nombre:         string;
  id_notario:     number | null;
  notaria_nombre: string | null;
  rol_id:         number;
  rol_nombre:     string;
  activo:         boolean | null;
}

interface RolOption {
  id:     number;
  nombre: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AppNotariaUsuarios() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const isAdmin = (profile?.rol_id ?? 99) <= 2;

  const [search,       setSearch]       = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [formNombre,   setFormNombre]   = useState('');
  const [formEmail,    setFormEmail]    = useState('');
  const [formTel,      setFormTel]      = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formNotario,  setFormNotario]  = useState('');
  const [formRol,      setFormRol]      = useState('');
  const [formLoading,  setFormLoading]  = useState(false);

  // ── DDL probe: does usuarios.id_notario exist? ────────────────────────────
  const { data: hasIdNotarioCol, isLoading: probingDDL } = useQuery({
    queryKey: ['notaria-ddl-probe'],
    enabled: isAdmin,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const { error } = await (supabase as any)
        .from('usuarios')
        .select('id_notario')
        .limit(0);
      if (error?.message?.includes('id_notario')) return false;
      return true;
    },
  });

  const ddlPending = hasIdNotarioCol === false;

  // ── Roles for notaría (dynamic, queried from DB) ──────────────────────────
  const { data: rolesNotaria = [] } = useQuery({
    queryKey: ['notaria-roles'],
    enabled: isAdmin,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('roles')
        .select('id, nombre')
        .eq('activo', true)
        .ilike('nombre', '%notari%')
        .order('nombre');
      return (data ?? []) as RolOption[];
    },
  });

  // Default formRol to first role from DB once loaded
  useEffect(() => {
    if (rolesNotaria.length > 0 && !formRol) {
      setFormRol(String(rolesNotaria[0].id));
    }
  }, [rolesNotaria, formRol]);

  // ── Notarios list ──────────────────────────────────────────────────────────
  const { data: notariosList = [] } = useQuery({
    queryKey: ['notaria-usuarios-notarios'],
    enabled: isAdmin,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('notarios')
        .select('id, nombre, notaria')
        .eq('activo', true)
        .order('notaria');
      return (data ?? []) as { id: number; nombre: string; notaria: string }[];
    },
  });

  // ── Usuarios notaría list ──────────────────────────────────────────────────
  // Only runs once DDL probe confirms the column exists
  const { data: usuarios = [], isLoading, refetch } = useQuery({
    queryKey: ['notaria-usuarios-list'],
    enabled: isAdmin && hasIdNotarioCol === true,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('usuarios')
        .select('nombre, email, id_notario, rol_id, activo, roles(nombre)')
        .not('id_notario', 'is', null)
        .order('nombre');

      if (error) throw new Error(error.message);

      return (data ?? []).map((u: any) => ({
        email:          u.email,
        nombre:         u.nombre,
        id_notario:     u.id_notario,
        notaria_nombre: u.id_notario
          ? (notariosList.find((n) => n.id === u.id_notario)?.notaria ?? null)
          : null,
        rol_id:         u.rol_id,
        rol_nombre:     u.roles?.nombre ?? `Rol ${u.rol_id}`,
        activo:         u.activo,
      })) as NotariaUsuario[];
    },
  });

  // ── Toggle activo ─────────────────────────────────────────────────────────
  // Uses email (PK of usuarios) — usuarios has NO id column
  const { mutate: toggleActivo } = useMutation({
    mutationFn: async ({ email, activo }: { email: string; activo: boolean }) => {
      const { error } = await (supabase as any)
        .from('usuarios')
        .update({ activo })
        .eq('email', email);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, { activo }) => {
      toast.success(activo ? 'Usuario activado' : 'Usuario desactivado');
      qc.invalidateQueries({ queryKey: ['notaria-usuarios-list'] });
    },
    onError: (e: any) => toast.error('Error', { description: e.message }),
  });

  // ── Create user ────────────────────────────────────────────────────────────
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim() || !formEmail.trim() || !formPassword || !formNotario || !formRol) {
      toast.error('Completa todos los campos requeridos');
      return;
    }

    const cleanEmail = formEmail.trim().toLowerCase();

    setFormLoading(true);
    try {
      // 1. Prevent duplicate email
      const { data: existing } = await (supabase as any)
        .from('usuarios')
        .select('email')
        .eq('email', cleanEmail)
        .maybeSingle();
      if (existing) throw new Error(`Ya existe un usuario con el email ${cleanEmail}`);

      // 2. Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: formPassword,
        options: { data: { nombre: formNombre.trim() } },
      });
      if (authError) throw new Error(`Auth: ${authError.message}`);

      // 3. Insert into usuarios
      const { error: insertError } = await (supabase as any)
        .from('usuarios')
        .insert({
          nombre:                formNombre.trim(),
          email:                 cleanEmail,
          telefono:              formTel.trim() || null,
          rol_id:                Number(formRol),
          id_notario:            Number(formNotario),
          activo:                true,
          auth_user_id:          authData.user?.id ?? null,
          debe_cambiar_password: false,
        });

      if (insertError) throw new Error(insertError.message);

      toast.success('Usuario creado correctamente', {
        description: `${cleanEmail} recibirá un correo de confirmación.`,
      });

      setShowForm(false);
      setFormNombre('');
      setFormEmail('');
      setFormTel('');
      setFormPassword('');
      setFormNotario('');
      setFormRol(rolesNotaria.length > 0 ? String(rolesNotaria[0].id) : '');
      qc.invalidateQueries({ queryKey: ['notaria-usuarios-list'] });

    } catch (err: any) {
      toast.error('Error al crear usuario', { description: err.message });
    } finally {
      setFormLoading(false);
    }
  };

  // ── Access guard ──────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Shield className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm font-medium">Solo administradores</p>
        <p className="text-sm text-muted-foreground">Esta sección es exclusiva para administradores SOZU.</p>
      </div>
    );
  }

  const formDisabled = ddlPending || formLoading;

  const filtered = search.trim()
    ? usuarios.filter(u =>
        u.nombre.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.notaria_nombre ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : usuarios;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            Usuarios Notaría
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona los usuarios vinculados a notarías para acceso a App Notaría.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={ddlPending}
            onClick={() => setShowForm(v => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            {showForm ? 'Cancelar' : 'Nuevo usuario'}
          </Button>
        </div>
      </div>

      {/* DDL pending banner — only shown when column is missing */}
      {!probingDDL && ddlPending && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800">DDL requerido — columna faltante</p>
            <p className="text-xs text-amber-700 mt-0.5">
              La columna <span className="font-mono">usuarios.id_notario</span> no existe en la base de datos.
              El registro de usuarios y el listado están deshabilitados hasta que ejecutes el DDL en{' '}
              <span className="font-mono">Ejecuciones_manuales/app_notaria_login_ddl_pendiente.md</span>.
            </p>
          </div>
        </div>
      )}

      {/* Roles not configured warning */}
      {!probingDDL && !ddlPending && rolesNotaria.length === 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800">Roles notaría no configurados</p>
            <p className="text-xs text-amber-700 mt-0.5">
              No se encontraron roles con "notari" en la tabla <span className="font-mono">roles</span>.
              Ejecuta el PASO 3 del DDL para crear los roles "Notario" y "Colaborador notaría".
            </p>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && !ddlPending && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-bold mb-4">Registrar nuevo usuario notaría</h2>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre completo *</label>
              <input
                required value={formNombre}
                onChange={e => setFormNombre(e.target.value)}
                placeholder="Lic. Juan García"
                disabled={formDisabled}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email *</label>
              <input
                required type="email" value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                placeholder="notario@ejemplo.com"
                disabled={formDisabled}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
              <input
                value={formTel}
                onChange={e => setFormTel(e.target.value)}
                placeholder="+52 55 0000 0000"
                disabled={formDisabled}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Contraseña temporal *</label>
              <input
                required type="password" value={formPassword} minLength={8}
                onChange={e => setFormPassword(e.target.value)}
                placeholder="Mín. 8 caracteres"
                disabled={formDisabled}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notaría asignada *</label>
              <Select value={formNotario} onValueChange={setFormNotario} disabled={formDisabled}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar notaría" />
                </SelectTrigger>
                <SelectContent>
                  {notariosList.map(n => (
                    <SelectItem key={n.id} value={String(n.id)}>
                      {n.notaria} — {n.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Rol *</label>
              <Select
                value={formRol}
                onValueChange={setFormRol}
                disabled={formDisabled || rolesNotaria.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={rolesNotaria.length === 0 ? 'Sin roles configurados' : 'Seleccionar rol'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {rolesNotaria.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={formDisabled || !formNotario || !formRol || rolesNotaria.length === 0}
              >
                {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear usuario'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o notaría..."
          className="w-full rounded-lg border border-border pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Usuario</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Notaría</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Rol</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Estatus</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">

            {(isLoading || probingDDL) &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-muted/60 animate-pulse" style={{ width: `${50 + j * 15}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            }

            {!isLoading && !probingDDL && ddlPending && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                  Columna <span className="font-mono">id_notario</span> no encontrada en la base de datos.
                  <p className="text-xs mt-1">Ejecuta el DDL pendiente y recarga la página.</p>
                </td>
              </tr>
            )}

            {!isLoading && !probingDDL && !ddlPending && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  {search ? 'Sin resultados para la búsqueda.' : 'No hay usuarios notaría registrados.'}
                  {!search && (
                    <p className="text-xs mt-1">Crea el primer usuario con el botón "Nuevo usuario".</p>
                  )}
                </td>
              </tr>
            )}

            {!isLoading && !probingDDL && !ddlPending && filtered.map(u => (
              <tr key={u.email} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-sm">{u.nombre}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-3 text-sm">
                  {u.notaria_nombre ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium',
                    u.rol_nombre.toLowerCase().includes('notario')
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200',
                  )}>
                    {u.rol_nombre}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.activo
                    ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Activo</span>
                    : <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="h-3.5 w-3.5" /> Inactivo</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActivo({ email: u.email, activo: !u.activo })}
                    className={cn(
                      'text-xs rounded-lg px-3 py-1.5 border transition-colors',
                      u.activo
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
                    )}
                  >
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Verification tip */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <strong className="font-medium">Verificación:</strong>{' '}
        Para confirmar que los usuarios existen en BD, ejecuta en Supabase SQL Editor:
        <br />
        <code className="mt-1 block font-mono text-[11px]">
          SELECT email, nombre, id_notario, rol_id, activo FROM usuarios WHERE id_notario IS NOT NULL;
        </code>
      </div>
    </div>
  );
}
