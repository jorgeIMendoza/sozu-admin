import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePortalPersonalImpersonation,
  type PersonalUser,
} from "@/contexts/PortalPersonalImpersonationContext";
import { fetchPersonalConCuenta } from "@/lib/portal-personal/personal-usuarios";
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
import { cn } from "@/lib/utils";

/**
 * Selector "Ver como" del Portal del Personal.
 *
 * Sólo lista personal de la organización con cuenta del sistema ligada
 * (`personal_organizacional.email_usuario` → `usuarios.email`).
 */
export function PortalPersonalImpersonationSelector() {
  const { profile } = useAuth();
  const { impersonatedUser, setImpersonatedUser, clearImpersonation, isImpersonating } =
    usePortalPersonalImpersonation();
  const [open, setOpen] = useState(false);

  const canImpersonate = profile?.puede_impersonar === true;

  const { data: personal = [], isLoading } = useQuery({
    queryKey: ["portal-personal-suplantables"],
    queryFn: fetchPersonalConCuenta,
    enabled: canImpersonate,
    staleTime: 5 * 60_000,
  });

  const users: PersonalUser[] = personal.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    email: p.email,
    rol_nombre: p.rolNombre,
    tipo_personal: p.tipoPersonal,
  }));

  if (!canImpersonate) return null;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="h-8 w-[300px] justify-between text-xs">
            <span className="truncate">
              {impersonatedUser ? `Ver como: ${impersonatedUser.nombre}` : "Vista por defecto (Super Admin)"}
            </span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="end">
          <Command>
            <CommandInput placeholder="Buscar personal con cuenta del sistema..." />
            <CommandList>
              <CommandEmpty>{isLoading ? "Cargando..." : "Sin personal con cuenta ligada."}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__default__"
                  onSelect={() => {
                    clearImpersonation();
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !isImpersonating ? "opacity-100" : "opacity-0")} />
                  <span className="font-medium">Vista por defecto (Super Admin)</span>
                </CommandItem>
                {users.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={`${u.nombre} ${u.email}`}
                    onSelect={() => {
                      setImpersonatedUser(u);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        impersonatedUser?.id === u.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{u.nombre}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {u.email} · {u.rol_nombre}
                      </span>
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
