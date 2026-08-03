import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePortalTicketsImpersonation,
  type ProjectAdminUser,
} from "@/contexts/PortalTicketsImpersonationContext";
import { fetchAgentes } from "@/lib/portal-tickets/tickets-store";
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
import { ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selector "Ver como" del Portal Tickets de Seguimiento.
 * Visible solo para usuarios con permiso de impersonación (Super Admin).
 * Lista el mismo pool de usuarios asignables del portal (propietarios posibles de ticket),
 * usando auth_user_id como identificador para que "Mis tickets" filtre correctamente.
 */
export function PortalTicketsImpersonationSelector() {
  const { profile } = useAuth();
  const { impersonatedUser, setImpersonatedUser, clearImpersonation, isImpersonating } =
    usePortalTicketsImpersonation();
  const [open, setOpen] = useState(false);

  const canImpersonate = profile?.puede_impersonar === true;

  const { data: agentes = [], isLoading: loading } = useQuery({
    queryKey: ["tickets-agentes"],
    queryFn: fetchAgentes,
    enabled: canImpersonate,
  });

  const users: ProjectAdminUser[] = agentes.map((a) => ({
    id: a.id,
    nombre: a.nombre || a.email,
    email: a.email,
    rol_nombre: a.rol || "Usuario",
  }));

  if (!canImpersonate) return null;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="h-8 w-[300px] justify-between text-xs">
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
            <CommandInput placeholder="Buscar usuario del portal..." />
            <CommandList>
              <CommandEmpty>{loading ? "Cargando..." : "Sin usuarios."}</CommandEmpty>
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
                      <span className="truncate text-xs text-muted-foreground">{u.email}</span>
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
