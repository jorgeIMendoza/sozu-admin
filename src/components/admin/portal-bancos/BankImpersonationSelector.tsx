import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBankImpersonation } from "@/contexts/BankImpersonationContext";
import { useBankAgentsStore, DEFAULT_BANK_AGENT_ID } from "@/lib/portal-bancos/agents-store";
import { BANKS } from "@/lib/portal-bancos/bank-leads";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check, UserSearch, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selector "Ver como" para el Portal Bancos. Permite a Super Admin (rol 1 ó 2)
 * impersonar a un agente bancario (mock store). El usuario por defecto es el
 * admin del agents-store (DEFAULT_BANK_AGENT_ID).
 */
export function BankImpersonationSelector() {
  const { profile } = useAuth();
  const { impersonatedAgentId, setImpersonatedAgentId, clearImpersonation, isImpersonating } =
    useBankImpersonation();
  const agents = useBankAgentsStore((s) => s.agents);
  const [open, setOpen] = useState(false);

  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  if (!isSuperAdmin) return null;

  const current = agents.find((a) => a.id === impersonatedAgentId);
  const defaultAgent = agents.find((a) => a.id === DEFAULT_BANK_AGENT_ID);

  return (
    <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
      <UserSearch className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Ver como:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full sm:w-[340px] justify-between h-8 text-sm">
            <span className="truncate">
              {current ? `${current.name} · ${BANKS[current.bankId].name}` : "Vista por defecto"}
            </span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full sm:w-[340px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar agente bancario..." />
            <CommandList>
              <CommandEmpty>Sin agentes.</CommandEmpty>
              <CommandGroup>
                {defaultAgent && (
                  <CommandItem
                    value={`__default__ ${defaultAgent.name}`}
                    onSelect={() => { clearImpersonation(); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", !isImpersonating ? "opacity-100" : "opacity-0")} />
                    <span className="font-medium">Vista por defecto ({defaultAgent.name})</span>
                  </CommandItem>
                )}
                {agents.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`${a.name} ${a.email} ${BANKS[a.bankId].name}`}
                    onSelect={() => { setImpersonatedAgentId(a.id); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", impersonatedAgentId === a.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">{a.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{a.email}</span>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
                      {BANKS[a.bankId].name} · {a.role}
                    </Badge>
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