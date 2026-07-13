import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useBancoScope, useCurrentBanco } from "@/contexts/BankImpersonationContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selector "Ver como" del Portal Bancos para roles con impersonación
 * (roles.puede_impersonar). Lista usuarios con rol Supervisor Banco u
 * Operador Banco vinculados a un banco (usuarios.id_banco); al elegir uno,
 * el portal hace scope al banco de ese usuario.
 */

const BANCO_ROLE_NAMES = ["Supervisor Banco", "Operador Banco"];
const SELECTED_USER_KEY = "sozu-portal-bancos-selected-user";

interface BancoUser {
  email: string;
  nombre: string;
  id_banco: number;
  rol_nombre: string;
  banco_nombre: string;
}

function rolTag(rolNombre: string): { label: string; cls: string } {
  return rolNombre === "Supervisor Banco"
    ? { label: "Supervisor", cls: "bg-purple-500/10 text-purple-600 border-purple-500/20" }
    : { label: "Operador", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
}

export function BankImpersonationSelector() {
  const { profile } = useAuth();
  const { setSelectedBancoId } = useBancoScope();
  const current = useCurrentBanco();
  const [open, setOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(SELECTED_USER_KEY);
  });

  const canImpersonate = profile?.puede_impersonar === true;

  const { data: bancoUsers = [] } = useQuery({
    queryKey: ["portal-bancos-usuarios-banco"],
    enabled: canImpersonate,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data: users } = await (supabase as any)
        .from("usuarios")
        .select("email, nombre, id_banco, roles!inner(nombre)")
        .in("roles.nombre", BANCO_ROLE_NAMES)
        .eq("activo", true)
        .not("id_banco", "is", null);

      const list = (users ?? []) as { email: string; nombre: string | null; id_banco: number; roles: { nombre: string } | null }[];
      if (!list.length) return [];

      const bancoIds = [...new Set(list.map(u => u.id_banco))];
      const { data: bancos } = await supabase
        .from("bancos")
        .select("id, nombre")
        .in("id", bancoIds);
      const bancoMap: Record<number, string> = {};
      for (const b of bancos ?? []) bancoMap[b.id] = b.nombre;

      return list
        .map(u => ({
          email: u.email,
          nombre: u.nombre || u.email,
          id_banco: u.id_banco,
          rol_nombre: u.roles?.nombre ?? "",
          banco_nombre: bancoMap[u.id_banco] ?? `Banco #${u.id_banco}`,
        }))
        .sort((a, b) => a.banco_nombre.localeCompare(b.banco_nombre) || a.nombre.localeCompare(b.nombre)) as BancoUser[];
    },
  });

  if (!canImpersonate) return null;

  const selectedUser = selectedEmail
    ? bancoUsers.find(u => u.email === selectedEmail) ?? null
    : null;

  const pick = (u: BancoUser) => {
    setSelectedEmail(u.email);
    try { window.localStorage.setItem(SELECTED_USER_KEY, u.email); } catch { /* noop */ }
    setSelectedBancoId(u.id_banco);
    setOpen(false);
  };

  const triggerLabel = selectedUser
    ? `${selectedUser.nombre} · ${selectedUser.banco_nombre}`
    : current
      ? current.nombre
      : "Selecciona un usuario de banco";

  return (
    <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
      <Building2 className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Ver como:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full sm:w-[380px] justify-between h-8 text-sm">
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full sm:w-[380px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar usuario, banco o correo..." />
            <CommandList>
              <CommandEmpty>No hay usuarios Supervisor u Operador Banco con banco asignado.</CommandEmpty>
              <CommandGroup>
                {bancoUsers.map((u) => {
                  const tag = rolTag(u.rol_nombre);
                  return (
                    <CommandItem
                      key={u.email}
                      value={`${u.nombre} ${u.banco_nombre} ${u.email} ${u.rol_nombre}`}
                      onSelect={() => pick(u)}
                    >
                      <Check className={cn("mr-2 h-4 w-4", selectedUser?.email === u.email ? "opacity-100" : "opacity-0")} />
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm truncate">{u.nombre}</span>
                        <span className="text-xs text-muted-foreground truncate">{u.banco_nombre} · {u.email}</span>
                      </span>
                      <Badge variant="outline" className={cn("ml-2 text-[10px] shrink-0", tag.cls)}>
                        {tag.label}
                      </Badge>
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
