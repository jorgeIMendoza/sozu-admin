import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmbajadorImpersonation } from "@/contexts/EmbajadorImpersonationContext";
import { useAmbassadors } from "@/store/AmbassadorsContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check, UserSearch, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmbajadorImpersonationSelector() {
  const { profile } = useAuth();
  const {
    impersonatedEmbajadorId,
    impersonatedEmbajadorName,
    setImpersonatedEmbajador,
    clearImpersonation,
    isImpersonating,
  } = useEmbajadorImpersonation();
  const { ambassadors } = useAmbassadors();
  const [open, setOpen] = useState(false);

  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  if (!isSuperAdmin) return null;

  const embajadores = ambassadors.filter(e => e.status !== "inactivo");

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
              <span className="truncate">{impersonatedEmbajadorName}</span>
            ) : (
              <span className="text-muted-foreground">Seleccionar embajador...</span>
            )}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full sm:w-[260px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar embajador..." />
            <CommandList>
              <CommandEmpty>No se encontró el embajador.</CommandEmpty>
              <CommandGroup>
                {embajadores.map((emb) => (
                  <CommandItem
                    key={emb.id}
                    value={`${emb.fullName} ${emb.code}`}
                    onSelect={() => {
                      setImpersonatedEmbajador(emb.id, emb.fullName, emb.code);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        impersonatedEmbajadorId === emb.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1">
                      <span className="text-sm">{emb.fullName}</span>
                      <span className="text-xs text-muted-foreground">{emb.code}</span>
                    </div>
                    {emb.status === "pendiente" && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                        Pendiente
                      </span>
                    )}
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
