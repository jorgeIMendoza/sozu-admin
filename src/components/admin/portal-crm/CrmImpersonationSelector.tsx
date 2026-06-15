import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmImpersonation } from "@/contexts/CrmImpersonationContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check, UserSearch, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selector "Ver como" para el Portal CRM. Permite a un Super Admin (rol 1 o 2)
 * impersonar a cualquier usuario con acceso al portal CRM. La lista se calcula
 * a partir de submenus_permisos (cualquier submenu cuya ruta empieza con
 * /admin/portal-crm/...). Si aún no hay submenús cargados en BD para CRM,
 * cae en un fallback que muestra los usuarios con rol Super Admin.
 */
export function CrmImpersonationSelector() {
  const { profile } = useAuth();
  const {
    impersonatedCrmUserEmail,
    impersonatedCrmUserName,
    setImpersonatedCrmUser,
    clearImpersonation,
    isImpersonating,
  } = useCrmImpersonation();
  const [open, setOpen] = useState(false);

  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  if (!isSuperAdmin) return null;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["crm-users-for-impersonation"],
    queryFn: async () => {
      // 1) Roles que tienen al menos un permiso sobre rutas /admin/portal-crm/...
      const { data: subs, error: subsErr } = await supabase
        .from("submenus")
        .select("id, vista_front_end")
        .like("vista_front_end", "/admin/portal-crm/%");
      if (subsErr) throw subsErr;

      let rolIds: number[] = [];
      const submenuIds = (subs || []).map((s: any) => s.id);
      if (submenuIds.length > 0) {
        const { data: perms, error: permsErr } = await supabase
          .from("submenus_permisos")
          .select("rol_id")
          .in("submenu_id", submenuIds)
          .eq("activo", true);
        if (permsErr) throw permsErr;
        rolIds = Array.from(new Set((perms || []).map((p: any) => p.rol_id)));
      }
      // Fallback: si BD aún no tiene submenús/permisos del CRM, mostrar Super Admins.
      if (rolIds.length === 0) rolIds = [1];

      const { data: usuarios, error: usuariosErr } = await supabase
        .from("usuarios")
        .select("id, email, nombre, rol_id, roles(nombre)")
        .in("rol_id", rolIds)
        .eq("activo", true)
        .order("email");
      if (usuariosErr) throw usuariosErr;

      return (usuarios || [])
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          nombre: u.nombre || u.email,
          rolId: u.rol_id,
          rolNombre: u.roles?.nombre || "—",
        }))
        .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
    },
    enabled: isSuperAdmin,
  });

  return (
    <div className="flex items-center gap-2">
      <UserSearch className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        Vista como:
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full sm:w-[320px] justify-between h-8 text-sm"
          >
            {isImpersonating ? (
              <span className="truncate">{impersonatedCrmUserName}</span>
            ) : (
              <span className="text-muted-foreground">Seleccionar usuario...</span>
            )}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(320px,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar usuario CRM..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Cargando..." : "Sin usuarios con acceso al CRM."}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__super_admin__"
                  onSelect={() => {
                    clearImpersonation();
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !isImpersonating ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="font-medium">Super Admin</span>
                </CommandItem>
                {users.map((u: any) => (
                  <CommandItem
                    key={u.email}
                    value={`${u.nombre} ${u.email} ${u.rolNombre}`}
                    onSelect={() => {
                      setImpersonatedCrmUser(u.email, u.id, u.nombre, u.rolId);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        impersonatedCrmUserEmail === u.email ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">{u.nombre}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </span>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
                      {u.rolNombre}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {isImpersonating && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={clearImpersonation}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}