import { useState } from "react";
import { ChevronsUpDown, Check, UserSearch, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSocioBancarioImpersonation,
} from "@/contexts/SocioBancarioImpersonationContext";
import { useUsuariosSocioImpersonables } from "@/hooks/useSociosBancarios";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Selector "Ver como" del Portal Socio Bancario.
 *
 * Visible solo para quien puede impersonar (Super Admin / roles.puede_impersonar).
 * Permite ver el portal tal como lo ve un usuario de banco específico (scope de
 * desarrollos del banco de ese usuario), para validar exactamente qué muestra a
 * cada usuario dado de alta. No cambia la sesión real ni los permisos de menú.
 */
export function SocioBancarioVerComoSelector() {
  const { profile } = useAuth();
  const { impersonatedUser, setImpersonatedUser, clearImpersonation, isImpersonating } =
    useSocioBancarioImpersonation();
  const [open, setOpen] = useState(false);

  const canImpersonate =
    profile?.puede_impersonar === true || profile?.rol_nombre === "Super Administrador";

  const { data: usuarios = [], isLoading } = useUsuariosSocioImpersonables(canImpersonate);

  if (!canImpersonate) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <UserSearch className="h-4 w-4 shrink-0 text-primary" />
      <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
        Ver como usuario de banco:
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="h-8 w-full justify-between text-sm sm:w-[380px]">
            <span className="truncate">
              {impersonatedUser
                ? `${impersonatedUser.nombre}${impersonatedUser.bancoNombre ? ` · ${impersonatedUser.bancoNombre}` : ""}`
                : "Vista por defecto (tu usuario)"}
            </span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar usuario, correo o banco..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Cargando..." : "Sin usuarios de banco dados de alta."}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem value="__default__" onSelect={() => { clearImpersonation(); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", !isImpersonating ? "opacity-100" : "opacity-0")} />
                  <span className="font-medium">Vista por defecto (tu usuario)</span>
                </CommandItem>
                {usuarios.map((u) => (
                  <CommandItem
                    key={u.email}
                    value={`${u.nombre} ${u.email} ${u.bancoNombre ?? ""}`}
                    onSelect={() => {
                      setImpersonatedUser({
                        email: u.email,
                        nombre: u.nombre,
                        idSocioBancario: u.idSocioBancario,
                        bancoNombre: u.bancoNombre,
                      });
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        impersonatedUser?.email === u.email ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{u.nombre}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {u.email}{u.bancoNombre ? ` · ${u.bancoNombre}` : ""}
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
        <>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            Vista de validación
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={clearImpersonation} aria-label="Salir de la vista">
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
