import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePortalProductosImpersonation,
  type ProjectAdminUser,
} from "@/contexts/PortalProductosImpersonationContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selector "Ver como" para el Portal de Productos.
 * Visible solo para Super Admin (rol 1). Lista usuarios con rol Administrador
 * de Proyecto (rol_id = 2).
 */
export function PortalProductosImpersonationSelector() {
  const { profile } = useAuth();
  const { impersonatedUser, setImpersonatedUser, clearImpersonation, isImpersonating } =
    usePortalProductosImpersonation();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<ProjectAdminUser[]>([]);
  const [loading, setLoading] = useState(false);

  const canImpersonate = profile?.puede_impersonar === true;

  useEffect(() => {
    if (!canImpersonate) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("usuarios")
        .select("id, nombre, email, rol_id")
        .eq("rol_id", 2)
        .eq("activo", true)
        .order("nombre");
      if (data) {
        setUsers(
          data.map((u: any) => ({
            id: String(u.id),
            nombre: u.nombre || u.email,
            email: u.email,
            rol_nombre: "Administrador de Proyecto",
          })),
        );
      }
      setLoading(false);
    })();
  }, [canImpersonate]);

  if (!canImpersonate) return null;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-[300px] justify-between h-8 text-xs">
            <span className="truncate">
              {impersonatedUser
                ? `Ver como: ${impersonatedUser.nombre}`
                : "Vista por defecto (Super Admin)"}
            </span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="end">
          <Command>
            <CommandInput placeholder="Buscar Administrador de Proyecto..." />
            <CommandList>
              <CommandEmpty>{loading ? "Cargando..." : "Sin usuarios."}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__default__"
                  onSelect={() => { clearImpersonation(); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !isImpersonating ? "opacity-100" : "opacity-0")} />
                  <span className="font-medium">Vista por defecto (Super Admin)</span>
                </CommandItem>
                {users.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={`${u.nombre} ${u.email}`}
                    onSelect={() => { setImpersonatedUser(u); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", impersonatedUser?.id === u.id ? "opacity-100" : "opacity-0")} />
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
      {isImpersonating && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={clearImpersonation}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}