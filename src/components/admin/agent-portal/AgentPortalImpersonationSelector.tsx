import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check, UserSearch, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Roles impersonables desde el Portal Agente. Hardcode a propósito: aún no
// usamos una columna en BD. Incluye los roles con acceso real al portal
// (1 Super Admin, 2 Admin Proyecto, 3 Agente Inmob., 9 Agente Interno) + el
// rol 30 (Super Admin "fake" que existe en prod pero no en dev; se quiere ver).
const AGENT_PORTAL_ROLE_IDS = [1, 2, 3, 9, 30];

// Etiqueta corta por rol para el badge del selector.
const ROLE_BADGE: Record<number, string> = {
  1: "Super Admin",
  2: "Admin Proy.",
  3: "Agente Inmob.",
  9: "Interno",
  30: "Super Admin",
};

export function AgentPortalImpersonationSelector() {
  const { profile } = useAuth();
  const {
    impersonatedAgentEmail,
    impersonatedAgentName,
    setImpersonatedAgent,
    clearImpersonation,
    isImpersonating,
  } = useAgentImpersonation();
  const [open, setOpen] = useState(false);

  const canImpersonate = profile?.puede_impersonar === true;

  const roleIds = AGENT_PORTAL_ROLE_IDS;

  const { data: agents = [] } = useQuery({
    queryKey: ["all-agents-for-portal-impersonation", roleIds],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("usuarios")
        .select("email, rol_id, personas(id, nombre_legal)")
        .in("rol_id", roleIds)
        .eq("activo", true)
        .order("email");

      if (error) throw error;
      return (data || [])
        .map((u: any) => ({
          email: u.email,
          rolId: u.rol_id,
          personaId: u.personas?.id ?? null,
          nombre: u.personas?.nombre_legal || u.email,
        }))
        .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
    },
    enabled: canImpersonate,
  });

  if (!canImpersonate) return null;

  return (
    <div className="flex items-center gap-2">
      <UserSearch className="h-4 w-4 text-muted-foreground shrink-0" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full sm:w-[260px] justify-between h-8 text-sm"
          >
            {isImpersonating ? (
              <span className="truncate">{impersonatedAgentName}</span>
            ) : (
              <span className="text-muted-foreground">Seleccionar usuario...</span>
            )}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(260px,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar usuario..." />
            <CommandList>
              <CommandEmpty>No se encontró el usuario.</CommandEmpty>
              <CommandGroup>
                {agents.map((agent: any) => (
                  <CommandItem
                    key={agent.email}
                    value={`${agent.nombre} ${agent.email}`}
                    onSelect={() => {
                      setImpersonatedAgent(agent.email, agent.personaId, agent.nombre);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        impersonatedAgentEmail === agent.email ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm truncate">{agent.nombre}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                          {ROLE_BADGE[agent.rolId] ?? `Rol ${agent.rolId}`}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">{agent.email}</span>
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
