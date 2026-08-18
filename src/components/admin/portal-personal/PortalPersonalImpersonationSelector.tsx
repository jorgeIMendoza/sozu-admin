import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePortalPersonalImpersonation,
  type PersonalUser,
} from "@/contexts/PortalPersonalImpersonationContext";
import {
  fetchPersonalConCuenta,
  fetchUsuariosSistema,
  type PersonalConCuenta,
} from "@/lib/portal-personal/personal-usuarios";
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

/** Con ~1.9k usuarios activos no se traen todos: se pide una página por búsqueda. */
const LIMITE = 50;
const DEBOUNCE_MS = 300;

const aPersonalUser = (p: PersonalConCuenta): PersonalUser => ({
  id: p.id,
  nombre: p.nombre,
  email: p.email,
  rol_nombre: p.rolNombre,
  rol_id: p.rolId,
  id_persona: p.personaId,
  auth_user_id: p.authUserId,
  tipo_personal: p.tipoPersonal,
});

/**
 * Selector "Ver como" del Portal del Personal.
 *
 *   - Super Administrador: ve y busca a CUALQUIER usuario del sistema, para
 *     comprobar cómo se vería el portal para cada uno. La búsqueda es contra el
 *     servidor (son demasiados para filtrar en el cliente).
 *   - Otros roles con `puede_impersonar`: sólo personal de la organización con
 *     cuenta del sistema ligada, filtrado en el cliente como hasta ahora.
 *
 * Seleccionar a alguien sólo cambia de quién se habla; para ver el portal CON
 * SUS MENÚS hay que activar "Vista del usuario" (ImpersonationViewModeToggle).
 */
export function PortalPersonalImpersonationSelector() {
  const { profile } = useAuth();
  const { impersonatedUser, setImpersonatedUser, clearImpersonation, isImpersonating } =
    usePortalPersonalImpersonation();
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [terminoDiferido, setTerminoDiferido] = useState("");

  const canImpersonate = profile?.puede_impersonar === true;
  const esSuperAdmin = profile?.rol_nombre === "Super Administrador";

  // Cada tecla no dispara una consulta: se espera a que el usuario pare de escribir.
  useEffect(() => {
    const t = setTimeout(() => setTerminoDiferido(busqueda), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [busqueda]);

  const { data: todos = [], isFetching: cargandoTodos } = useQuery({
    queryKey: ["portal-personal-usuarios-sistema", terminoDiferido],
    queryFn: () => fetchUsuariosSistema(terminoDiferido, LIMITE),
    enabled: canImpersonate && esSuperAdmin && open,
    // Sin esto la lista parpadea a vacía en cada tecleo.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const { data: personal = [], isFetching: cargandoPersonal } = useQuery({
    queryKey: ["portal-personal-suplantables"],
    queryFn: fetchPersonalConCuenta,
    enabled: canImpersonate && !esSuperAdmin,
    staleTime: 5 * 60_000,
  });

  const users: PersonalUser[] = useMemo(() => {
    if (esSuperAdmin) return todos.map(aPersonalUser);
    const t = busqueda.trim().toLowerCase();
    return personal
      .filter((p) => !t || `${p.nombre} ${p.email}`.toLowerCase().includes(t))
      .map(aPersonalUser);
  }, [esSuperAdmin, todos, personal, busqueda]);

  const isLoading = esSuperAdmin ? cargandoTodos : cargandoPersonal;
  const etiquetaDefecto = esSuperAdmin ? "Vista por defecto (Super Admin)" : "Vista por defecto";
  const vacio = esSuperAdmin
    ? "Ningún usuario coincide con la búsqueda."
    : "Sin personal con cuenta ligada.";

  if (!canImpersonate) return null;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="h-8 w-[300px] justify-between text-xs">
            <span className="truncate">
              {impersonatedUser ? `Ver como: ${impersonatedUser.nombre}` : etiquetaDefecto}
            </span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="end">
          {/* `shouldFilter={false}`: para Super Admin filtra el servidor, no cmdk. */}
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={
                esSuperAdmin ? "Buscar usuario del sistema..." : "Buscar personal con cuenta del sistema..."
              }
              value={busqueda}
              onValueChange={setBusqueda}
            />
            <CommandList>
              <CommandEmpty>{isLoading ? "Buscando..." : vacio}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__default__"
                  onSelect={() => {
                    clearImpersonation();
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !isImpersonating ? "opacity-100" : "opacity-0")} />
                  <span className="font-medium">{etiquetaDefecto}</span>
                </CommandItem>
                {users.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={u.id}
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
                        {u.tipo_personal ? ` · ${u.tipo_personal}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {esSuperAdmin && users.length >= LIMITE && (
                <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                  Mostrando los primeros {LIMITE}. Afina la búsqueda para ver más.
                </p>
              )}
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
