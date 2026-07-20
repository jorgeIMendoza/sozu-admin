import { useMemo, useState } from "react";
import {
  ArrowLeft, Plus, X, Loader2, Mail, UserPlus, Ban, RotateCcw, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useSocioBancarioDetalle, useDesarrollosAsignados, useProyectosSozuOpciones,
  useUsuariosSocioBancario, useAsignarDesarrollo, useQuitarDesarrollo,
  useInvitarUsuario, useReenviarInvitacion, useToggleUsuarioSocio,
  type EstadoUsuarioSocio,
} from "@/hooks/useSociosBancarios";

const ESTADO_USUARIO: Record<EstadoUsuarioSocio, { label: string; cls: string }> = {
  invitado: { label: "Invitado", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  activo: { label: "Activo", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  inactivo: { label: "Inactivo", cls: "bg-muted text-muted-foreground" },
};

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export function SocioBancarioDetalle({ idSocio, onBack }: { idSocio: number; onBack: () => void }) {
  const { data: banco } = useSocioBancarioDetalle(idSocio);
  const { data: asignados = [], isLoading: loadingAsig } = useDesarrollosAsignados(idSocio);
  const { data: opciones = [] } = useProyectosSozuOpciones();
  const { data: usuarios = [], isLoading: loadingUsers } = useUsuariosSocioBancario(idSocio);
  const asignar = useAsignarDesarrollo();
  const quitar = useQuitarDesarrollo();
  const toggleUsuario = useToggleUsuarioSocio();
  const reenviar = useReenviarInvitacion();

  const [nuevoDesarrollo, setNuevoDesarrollo] = useState<string>("");
  const [altaOpen, setAltaOpen] = useState(false);

  // Solo SOZU y no ya asignados.
  const disponibles = useMemo(() => {
    const yaId = new Set(asignados.map((a) => a.id_desarrollo));
    return opciones.filter((o) => !yaId.has(o.id_desarrollo));
  }, [opciones, asignados]);

  const agregar = () => {
    const idDesarrollo = Number(nuevoDesarrollo);
    if (!idDesarrollo) return;
    asignar.mutate(
      { idSocio, idDesarrollo },
      {
        onSuccess: () => { setNuevoDesarrollo(""); toast({ title: "Desarrollo asignado" }); },
        onError: (e: any) => toast({ title: "No se pudo asignar", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-foreground leading-tight">{banco?.nombre ?? "Banco"}</h2>
            <p className="text-xs text-muted-foreground">
              {banco?.razon_social || "—"}{banco?.rfc ? ` · ${banco.rfc}` : ""}
            </p>
          </div>
          {banco && (
            <Badge variant="outline" className={cn("ml-2", banco.estado === "activo" ? "border-success text-success" : "text-muted-foreground")}>
              {banco.estado === "activo" ? "Activo" : "Inactivo"}
            </Badge>
          )}
        </div>
      </div>

      {/* Desarrollos asignados */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-1">Desarrollos asignados</h3>
        <p className="text-xs text-muted-foreground mb-3">Solo desarrollos comercializados por SOZU.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {loadingAsig ? (
            <span className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</span>
          ) : asignados.length === 0 ? (
            <span className="text-sm text-muted-foreground">Sin desarrollos asignados.</span>
          ) : (
            asignados.map((d) => (
              <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[13px]">
                {d.nombre ?? `Desarrollo #${d.id_desarrollo}`}
                <button
                  className="text-muted-foreground hover:text-destructive"
                  title="Quitar (desactiva la asignación)"
                  onClick={() =>
                    quitar.mutate({ id: d.id }, {
                      onSuccess: () => toast({ title: "Desarrollo removido" }),
                      onError: (e: any) => toast({ title: "No se pudo quitar", description: e?.message ?? "Error", variant: "destructive" }),
                    })
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={nuevoDesarrollo} onValueChange={setNuevoDesarrollo}>
            <SelectTrigger className="h-9 w-[300px]"><SelectValue placeholder="Agregar desarrollo (solo SOZU)" /></SelectTrigger>
            <SelectContent>
              {disponibles.length === 0 ? (
                <SelectItem value="__none" disabled>Sin desarrollos SOZU disponibles</SelectItem>
              ) : (
                disponibles.map((o) => (
                  <SelectItem key={o.id_desarrollo} value={String(o.id_desarrollo)}>
                    {o.nombre ?? `Desarrollo #${o.id_desarrollo}`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={agregar} disabled={!nuevoDesarrollo || asignar.isPending} className="gap-1.5">
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </div>
      </section>

      {/* Usuarios del banco */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Usuarios de visualización</h3>
          <Button size="sm" className="gap-1.5" onClick={() => setAltaOpen(true)}>
            <UserPlus className="h-4 w-4" /> Agregar usuario
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Correo</th>
                <th className="px-3 py-2 text-left">Teléfono</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Último acceso</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loadingUsers ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Cargando…</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Sin usuarios. Agrega el primero con una invitación.</td></tr>
              ) : (
                usuarios.map((u) => {
                  const meta = ESTADO_USUARIO[u.estado];
                  return (
                    <tr key={u.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{u.nombre ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{u.correo}</td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{u.telefono ?? "—"}</td>
                      <td className="px-3 py-2"><span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium", meta.cls)}>{meta.label}</span></td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{fmtFecha(u.ultimo_acceso)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1.5">
                          {u.estado === "invitado" && (
                            <Button
                              size="sm" variant="ghost" className="h-8 gap-1 text-[12px]"
                              disabled={reenviar.isPending}
                              onClick={() => reenviar.mutate({ idUsuario: u.id, correo: u.correo }, {
                                onSuccess: () => toast({ title: "Invitación reenviada" }),
                                onError: (e: any) => toast({ title: "No se pudo reenviar", description: e?.message ?? "Error", variant: "destructive" }),
                              })}
                            >
                              <Mail className="h-3.5 w-3.5" /> Reenviar
                            </Button>
                          )}
                          {u.estado === "inactivo" ? (
                            <Button
                              size="sm" variant="outline" className="h-8 gap-1 text-[12px]"
                              onClick={() => toggleUsuario.mutate({ id: u.id, activar: true }, {
                                onSuccess: () => toast({ title: "Usuario reactivado" }),
                                onError: (e: any) => toast({ title: "No se pudo reactivar", description: e?.message ?? "Error", variant: "destructive" }),
                              })}
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Reactivar
                            </Button>
                          ) : (
                            <Button
                              size="sm" variant="ghost" className="h-8 gap-1 text-[12px] text-destructive hover:text-destructive"
                              onClick={() => toggleUsuario.mutate({ id: u.id, activar: false }, {
                                onSuccess: () => toast({ title: "Acceso desactivado", description: "Se revocó el acceso del usuario." }),
                                onError: (e: any) => toast({ title: "No se pudo desactivar", description: e?.message ?? "Error", variant: "destructive" }),
                              })}
                            >
                              <Ban className="h-3.5 w-3.5" /> Desactivar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AltaUsuarioDialog idSocio={idSocio} open={altaOpen} onOpenChange={setAltaOpen} />
    </div>
  );
}

function AltaUsuarioDialog({
  idSocio, open, onOpenChange,
}: {
  idSocio: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const invitar = useInvitarUsuario();
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const valido = nombre.trim() && /\S+@\S+\.\S+/.test(correo);

  const enviar = () => {
    if (!valido) return;
    invitar.mutate(
      { idSocio, nombre, correo, telefono },
      {
        onSuccess: () => {
          toast({ title: "Invitación enviada", description: "El usuario recibirá un enlace para definir su acceso." });
          setNombre(""); setCorreo(""); setTelefono("");
          onOpenChange(false);
        },
        onError: (e: any) => toast({ title: "No se pudo enviar la invitación", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar usuario</DialogTitle>
          <DialogDescription>
            Se enviará una invitación por correo (magic link). La contraseña la define el usuario en Supabase; la app nunca la captura.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="u-nombre">Nombre</Label>
            <Input id="u-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del usuario" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="u-correo">Correo</Label>
            <Input id="u-correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="usuario@banco.com" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="u-tel">Teléfono</Label>
            <Input id="u-tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={enviar} disabled={!valido || invitar.isPending} className="gap-1.5">
            {invitar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Enviar invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
