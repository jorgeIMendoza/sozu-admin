import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Plus, Building2, Loader2, Landmark, Ban, RotateCcw, Settings2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSociosBancarios, useCrearSocioBancario, useToggleSocioBancario,
  type SocioBancarioListItem,
} from "@/hooks/useSociosBancarios";
import { SocioBancarioDetalle } from "@/components/admin/socios-bancarios/SocioBancarioDetalle";

export default function SociosBancarios() {
  const { profile } = useAuth();
  // Guard cliente (defensa en profundidad). El gate real es PermissionRoute +
  // permiso de submenu solo para rol 1 + RLS server-side (ver Ejecuciones_manuales).
  if (profile && profile.rol_nombre !== "Super Administrador") {
    return <Navigate to="/admin/access-denied" replace />;
  }

  return <SociosBancariosInner />;
}

function SociosBancariosInner() {
  const { items, tablesMissing, isLoading } = useSociosBancarios();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [altaOpen, setAltaOpen] = useState(false);
  const [desactivar, setDesactivar] = useState<SocioBancarioListItem | null>(null);
  const toggle = useToggleSocioBancario();

  if (selectedId != null) {
    return (
      <div className="container mx-auto py-6">
        <SocioBancarioDetalle idSocio={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" /> Socios Bancarios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bancos con crédito puente, sus desarrollos asignados y usuarios de visualización.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setAltaOpen(true)} disabled={tablesMissing}>
          <Plus className="h-4 w-4" /> Dar de alta banco
        </Button>
      </div>

      {tablesMissing && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Módulo pendiente de habilitar en base de datos</p>
            <p className="text-muted-foreground mt-0.5">
              Las tablas del modelo (socios_bancarios, socio_bancario_desarrollos, usuarios_socio_bancario),
              el rol y el RLS aún no existen. Aplicar <code>Ejecuciones_manuales/portal_socio_bancario_admin.md</code>
              (lo ejecuta Jorge) antes de dar de alta un banco real.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left">Banco</th>
              <th className="px-4 py-2.5 text-right">Desarrollos asignados</th>
              <th className="px-4 py-2.5 text-right">Usuarios activos</th>
              <th className="px-4 py-2.5 text-left">Estado</th>
              <th className="px-4 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-14 text-center">
                  <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm font-medium text-foreground">Sin bancos registrados</p>
                  <p className="text-xs text-muted-foreground">Da de alta el primer socio bancario.</p>
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted"><Building2 className="h-4 w-4 text-muted-foreground" /></span>
                      <div>
                        <p className="font-medium text-foreground">{s.nombre}</p>
                        {s.razon_social && <p className="text-[11px] text-muted-foreground">{s.razon_social}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.desarrollosActivos}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.usuariosActivos}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={cn(s.estado === "activo" ? "border-success text-success" : "text-muted-foreground")}>
                      {s.estado === "activo" ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-[12px]" onClick={() => setSelectedId(s.id)}>
                        <Settings2 className="h-3.5 w-3.5" /> Ver / Administrar
                      </Button>
                      {s.estado === "activo" ? (
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-[12px] text-destructive hover:text-destructive" onClick={() => setDesactivar(s)}>
                          <Ban className="h-3.5 w-3.5" /> Desactivar
                        </Button>
                      ) : (
                        <Button
                          size="sm" variant="ghost" className="h-8 gap-1 text-[12px]"
                          onClick={() => toggle.mutate({ id: s.id, activar: true }, {
                            onSuccess: () => toast({ title: "Banco reactivado" }),
                            onError: (e: any) => toast({ title: "No se pudo reactivar", description: e?.message ?? "Error", variant: "destructive" }),
                          })}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reactivar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AltaBancoDialog open={altaOpen} onOpenChange={setAltaOpen} />

      <AlertDialog open={!!desactivar} onOpenChange={(o) => { if (!o) setDesactivar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar banco</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará <strong>{desactivar?.nombre}</strong>. No se elimina (reversible); sus usuarios pierden acceso hasta reactivarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!desactivar) return;
                toggle.mutate({ id: desactivar.id, activar: false }, {
                  onSuccess: () => toast({ title: "Banco desactivado" }),
                  onError: (e: any) => toast({ title: "No se pudo desactivar", description: e?.message ?? "Error", variant: "destructive" }),
                });
                setDesactivar(null);
              }}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AltaBancoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const crear = useCrearSocioBancario();
  const [nombre, setNombre] = useState("");
  const [razon, setRazon] = useState("");
  const [rfc, setRfc] = useState("");

  const guardar = () => {
    if (!nombre.trim()) return;
    crear.mutate(
      { nombre, razon_social: razon, rfc },
      {
        onSuccess: () => { toast({ title: "Banco creado" }); setNombre(""); setRazon(""); setRfc(""); onOpenChange(false); },
        onError: (e: any) => toast({ title: "No se pudo crear", description: e?.message ?? "Error", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar de alta banco</DialogTitle>
          <DialogDescription>Registra el banco. Luego asigna desarrollos SOZU e invita usuarios desde su detalle.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="b-nombre">Nombre</Label>
            <Input id="b-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. BBVA México" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="b-razon">Razón social</Label>
            <Input id="b-razon" value={razon} onChange={(e) => setRazon(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="b-rfc">RFC</Label>
            <Input id="b-rfc" value={rfc} onChange={(e) => setRfc(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={!nombre.trim() || crear.isPending} className="gap-1.5">
            {crear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear banco
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
