import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCondominioImpersonation } from "@/contexts/CondominioImpersonationContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check, UserCog, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CONDOMINIO_MENU_ID = 30;

/**
 * "Ver como" del Portal Condominio. Solo para roles con puede_impersonar.
 * Lista usuarios de los roles que tienen permiso sobre los submenús del Portal
 * Condominio (incluye Supervisor Condominio / Operador Condomino). Al elegir uno,
 * el portal se ve como ese usuario (sus menús por rol y sus condominios).
 */
export function CondominioImpersonationSelector() {
  const { profile } = useAuth();
  const {
    impersonatedEmail,
    impersonatedName,
    setImpersonated,
    clearImpersonation,
    isImpersonating,
  } = useCondominioImpersonation();
  const [open, setOpen] = useState(false);

  const canImpersonate = profile?.puede_impersonar === true;

  // Roles con permiso sobre los submenús del Portal Condominio (menú 30).
  const { data: allowedRoles = [] } = useQuery({
    queryKey: ["condominio-allowed-roles"],
    queryFn: async () => {
      const { data: subData } = await (supabase as any)
        .from("submenus")
        .select("id")
        .eq("menu_id", CONDOMINIO_MENU_ID)
        .eq("activo", true);
      const subIds = (subData ?? []).map((s: any) => s.id);
      if (subIds.length === 0) return [] as number[];
      const { data: permData } = await (supabase as any)
        .from("submenus_permisos")
        .select("rol_id")
        .in("submenu_id", subIds)
        .eq("activo", true);
      return [...new Set((permData ?? []).map((r: any) => r.rol_id))] as number[];
    },
    enabled: canImpersonate,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["condominio-impersonation-users", allowedRoles],
    queryFn: async () => {
      if (allowedRoles.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("usuarios")
        .select("email, nombre, rol_id, id_persona, personas:personas!usuarios_id_persona_fkey(id, nombre_legal, nombre_comercial), roles:roles!inner(nombre)")
        .eq("activo", true)
        .in("rol_id", allowedRoles)
        .order("email");
      if (error) throw error;
      return (data || [])
        .map((u: any) => ({
          email: u.email,
          personaId: u.personas?.id ?? u.id_persona ?? null,
          nombre: u.personas?.nombre_comercial || u.personas?.nombre_legal || u.nombre || u.email,
          rolId: u.rol_id,
          rol: u.roles?.nombre || "Sin rol",
        }))
        .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
    },
    enabled: canImpersonate && allowedRoles.length > 0,
  });

  if (!canImpersonate) return null;

  return (
    <div className="flex items-center gap-2">
      <UserCog className="h-4 w-4 text-muted-foreground shrink-0" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-8 justify-between text-xs gap-1 min-w-[180px] max-w-[280px]",
              isImpersonating && "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20",
            )}
          >
            <span className="truncate">
              {isImpersonating ? `👁 ${impersonatedName}` : "Ver como usuario..."}
            </span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="end">
          <Command>
            <CommandInput placeholder="Buscar usuario..." className="h-9" />
            <CommandList>
              <CommandEmpty>No se encontró usuario.</CommandEmpty>
              <CommandGroup>
                {usuarios.map((u: any) => (
                  <CommandItem
                    key={u.email}
                    value={`${u.nombre} ${u.email}`}
                    onSelect={() => {
                      setImpersonated(u.email, u.nombre, u.personaId ?? null, u.rolId ?? null);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-3 w-3", impersonatedEmail === u.email ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm truncate">{u.nombre}</span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">{u.rol}</Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate">{u.email}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {isImpersonating && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearImpersonation}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
