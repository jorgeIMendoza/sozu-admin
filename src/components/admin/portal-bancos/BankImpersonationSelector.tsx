import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBancoScope, useCurrentBanco } from "@/contexts/BankImpersonationContext";
import { useBancosConvenio } from "@/hooks/usePortalBancos/useBancosConvenio";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selector "Ver como banco" del Portal Bancos. Permite a Super Admin (rol 1 ó 2)
 * elegir qué banco con convenio (real) ver en las pantallas operativas.
 */
export function BankImpersonationSelector() {
  const { profile } = useAuth();
  const { setSelectedBancoId } = useBancoScope();
  const current = useCurrentBanco();
  const { data: convenios = [] } = useBancosConvenio();
  const [open, setOpen] = useState(false);

  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  if (!isSuperAdmin) return null;
  if (convenios.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
      <Building2 className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Ver como banco:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full sm:w-[340px] justify-between h-8 text-sm">
            <span className="truncate">{current ? current.nombre : "Selecciona un banco"}</span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full sm:w-[340px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar banco..." />
            <CommandList>
              <CommandEmpty>Sin bancos con convenio.</CommandEmpty>
              <CommandGroup>
                {convenios.map((b) => (
                  <CommandItem
                    key={b.id}
                    value={b.nombre}
                    onSelect={() => { setSelectedBancoId(b.id_banco); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", current?.id_banco === b.id_banco ? "opacity-100" : "opacity-0")} />
                    <span className="text-sm truncate">{b.nombre}</span>
                    {!b.activo && (
                      <Badge variant="outline" className="ml-auto text-[10px] shrink-0">Inactivo</Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
