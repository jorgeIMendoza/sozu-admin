import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBancoScope,
  useBancoResolvedScope,
} from "@/contexts/BankImpersonationContext";
import { useBancosConvenio } from "@/hooks/usePortalBancos/useBancosConvenio";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check, Building2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selector "Ver como" del Portal Bancos para roles con impersonación
 * (roles.puede_impersonar → Super Admin). Opciones:
 *   - "Super Administrador" → vista global: ve TODO lo de todos los bancos.
 *   - Un item por cada banco con convenio → ver como el Admin de ese banco
 *     (solo las solicitudes/actividad de ese banco).
 */
export function BankImpersonationSelector() {
  const { profile } = useAuth();
  const { setSelection } = useBancoScope();
  const scope = useBancoResolvedScope();
  const { data: convenios = [] } = useBancosConvenio();
  const [open, setOpen] = useState(false);

  const canImpersonate = profile?.puede_impersonar === true;
  if (!canImpersonate) return null;

  const currentLabel =
    scope.kind === "all"
      ? "Super Administrador · Todos los bancos"
      : (convenios.find((c) => c.id_banco === scope.id)?.nombre ?? "Banco");

  const pickAll = () => { setSelection("all"); setOpen(false); };
  const pickBanco = (idBanco: number) => { setSelection(idBanco); setOpen(false); };

  return (
    <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
      <Building2 className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Ver como:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full sm:w-[380px] justify-between h-8 text-sm">
            <span className="truncate">{currentLabel}</span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full sm:w-[380px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar banco..." />
            <CommandList>
              <CommandEmpty>No hay bancos con convenio.</CommandEmpty>

              {/* Vista global */}
              <CommandGroup>
                <CommandItem value="super-administrador ver todo global" onSelect={pickAll}>
                  <Check className={cn("mr-2 h-4 w-4", scope.kind === "all" ? "opacity-100" : "opacity-0")} />
                  <Eye className="mr-2 h-4 w-4 text-primary shrink-0" />
                  <span className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm truncate">Super Administrador</span>
                    <span className="text-xs text-muted-foreground truncate">Ver todo · todos los bancos</span>
                  </span>
                </CommandItem>
              </CommandGroup>

              {/* Ver como el Admin de cada banco con convenio */}
              <CommandGroup heading="Ver como Admin de">
                {convenios.map((c) => {
                  const selected = scope.kind === "banco" && scope.id === c.id_banco;
                  return (
                    <CommandItem
                      key={c.id}
                      value={`banco ${c.nombre}`}
                      onSelect={() => pickBanco(c.id_banco)}
                    >
                      <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm truncate">{c.nombre}</span>
                        <span className="text-xs text-muted-foreground truncate">Admin del banco</span>
                      </span>
                      {!c.activo && (
                        <Badge variant="outline" className="ml-2 text-[10px] shrink-0">Inactivo</Badge>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
