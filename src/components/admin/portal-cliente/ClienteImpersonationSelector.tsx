import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check, UserSearch, X, Building2, Home, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClienteImpersonationSelector() {
  const { profile } = useAuth();
  const { impersonatedClienteEmail, impersonatedClienteName, setImpersonatedCliente, clearImpersonation, isImpersonating } = useClienteImpersonation();
  const [open, setOpen] = useState(false);
  const [proyectoOpen, setProyectoOpen] = useState(false);
  const [proyectoId, setProyectoId] = useState<number | null>(null);
  const [proyectoNombre, setProyectoNombre] = useState<string>("");
  const [numeroPropiedad, setNumeroPropiedad] = useState("");

  // Homologado con el resto de portales: el selector "Ver como" se muestra
  // solo a roles con el permiso Impersonar usuarios (roles.puede_impersonar).
  const canAccessClientPortal = profile?.puede_impersonar === true;

  const { data: clients = [] } = useQuery({
    queryKey: ["all-clients-for-impersonation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("email, rol_id, personas!inner(id, nombre_legal)")
        .eq("rol_id", 23)
        .eq("activo", true)
        .order("email");

      if (error) throw error;
      return (data || []).map((u: any) => ({
        email: u.email,
        personaId: u.personas?.id,
        nombre: u.personas?.nombre_legal || u.email,
      })).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
    },
    enabled: canAccessClientPortal,
  });

  // Proyectos administrados por SOZU (id_tipo_entidad = 5). Waterfall explícito.
  const { data: proyectos = [] } = useQuery({
    queryKey: ["sozu-proyectos-impersonation"],
    queryFn: async () => {
      const { data: rels, error: relsErr } = await supabase
        .from("entidades_relacionadas")
        .select("id_proyecto")
        .eq("id_tipo_entidad", 5)
        .eq("activo", true);
      if (relsErr) throw relsErr;
      const ids = [...new Set((rels || []).map((r: any) => r.id_proyecto).filter(Boolean))];
      if (!ids.length) return [];
      const { data: proys, error: proysErr } = await supabase
        .from("proyectos")
        .select("id, nombre")
        .in("id", ids)
        .eq("publicar", true)
        .eq("activo", true)
        .order("nombre");
      if (proysErr) throw proysErr;
      return (proys || []) as { id: number; nombre: string }[];
    },
    enabled: canAccessClientPortal,
  });

  // Resuelve el cliente dueño a partir de proyecto + número de propiedad.
  // Reproduce el MISMO vínculo de propiedad→cliente que usa el portal
  // (ver use-portfolio.ts): oferta principal (id_producto NULL) →
  // cuenta_cobranza aprobada → id_persona_lead. Aplica tanto a unidades en
  // adquisición como en patrimonio (la categoría se deriva de la etapa, no del vínculo).
  // Waterfall: proyecto → edificios → edificios_modelos → propiedades →
  // cuentas_cobranza → ofertas → usuarios (cliente rol 23).
  const numTrim = numeroPropiedad.trim();
  const { data: resolved } = useQuery({
    queryKey: ["resolve-cliente-by-propiedad", proyectoId, numTrim],
    queryFn: async () => {
      const { data: eds } = await supabase
        .from("edificios").select("id").eq("id_proyecto", proyectoId).eq("activo", true);
      const edIds = (eds || []).map((e: any) => e.id);
      if (!edIds.length) return null;

      const { data: mods } = await supabase
        .from("edificios_modelos").select("id").in("id_edificio", edIds);
      const modIds = (mods || []).map((m: any) => m.id);
      if (!modIds.length) return null;

      const { data: props } = await supabase
        .from("propiedades")
        .select("id")
        .in("id_edificio_modelo", modIds)
        .eq("numero_propiedad", numTrim)
        .eq("activo", true)
        .limit(1);
      const propId = props?.[0]?.id;
      if (!propId) return null;

      const { data: cuentas } = await supabase
        .from("cuentas_cobranza")
        .select("id_oferta")
        .eq("id_propiedad", propId)
        .eq("activo", true)
        .eq("es_aprobado", true);
      const ofertaIds = [...new Set((cuentas || []).map((c: any) => c.id_oferta).filter(Boolean))];
      if (!ofertaIds.length) return null;

      const { data: ofs } = await supabase
        .from("ofertas")
        .select("id_persona_lead")
        .in("id", ofertaIds)
        .eq("activo", true)
        .is("id_producto", null)
        .limit(1);
      const personaId = ofs?.[0]?.id_persona_lead;
      if (!personaId) return null;

      const { data: us } = await supabase
        .from("usuarios")
        .select("email, personas!inner(id, nombre_legal)")
        .eq("id_persona", personaId)
        .eq("rol_id", 23)
        .eq("activo", true)
        .limit(1);
      const u: any = us?.[0];
      if (!u) return null;
      return { email: u.email, personaId: u.personas?.id, nombre: u.personas?.nombre_legal || u.email };
    },
    enabled: canAccessClientPortal && proyectoId !== null && numTrim.length > 0,
  });

  // Autoselecciona el cliente dueño cuando proyecto + propiedad resuelven a uno.
  useEffect(() => {
    if (resolved?.email) {
      setImpersonatedCliente(resolved.email, resolved.personaId ?? null, resolved.nombre);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved?.email]);

  // Early return DESPUÉS de todos los hooks (Rules of Hooks): canAccessClientPortal
  // arranca en false mientras profile carga y luego puede pasar a true, así que
  // retornar antes de los useQuery cambiaba el número de hooks entre renders.
  if (!canAccessClientPortal) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-border-soft bg-muted/30 pl-2.5 pr-1.5 h-9 min-w-0">
      <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="hidden xl:inline text-[11px] font-medium uppercase tracking-wide text-muted-foreground shrink-0">
        Ver como
      </span>

      {/* 1. Proyecto (SOZU) */}
      <Popover open={proyectoOpen} onOpenChange={setProyectoOpen}>
        <PopoverTrigger asChild>
          <button
            role="combobox"
            className="group flex items-center gap-1.5 h-7 px-2 rounded-md hover:bg-background/70 transition-colors min-w-0 max-w-[170px]"
          >
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className={cn("truncate text-sm", proyectoId === null && "text-muted-foreground")}>
              {proyectoId !== null ? proyectoNombre : "Proyecto"}
            </span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar proyecto..." />
            <CommandList>
              <CommandEmpty>No se encontró el proyecto.</CommandEmpty>
              <CommandGroup>
                {proyectos.map((proy) => (
                  <CommandItem
                    key={proy.id}
                    value={proy.nombre}
                    onSelect={() => {
                      setProyectoId(proy.id);
                      setProyectoNombre(proy.nombre);
                      setProyectoOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", proyectoId === proy.id ? "opacity-100" : "opacity-0")} />
                    <span className="text-sm">{proy.nombre}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="h-5 w-px bg-border shrink-0" />

      {/* 2. Número de propiedad (texto) */}
      <div className="flex items-center gap-1.5 px-2 shrink-0">
        <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          value={numeroPropiedad}
          onChange={(e) => setNumeroPropiedad(e.target.value)}
          placeholder="No. prop"
          className="w-[72px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="h-5 w-px bg-border shrink-0" />

      {/* 3. Cliente */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            role="combobox"
            className="group flex items-center gap-1.5 h-7 px-2 rounded-md hover:bg-background/70 transition-colors min-w-0 max-w-[200px]"
          >
            <UserSearch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className={cn("truncate text-sm", !isImpersonating && "text-muted-foreground")}>
              {isImpersonating ? impersonatedClienteName : "Cliente"}
            </span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar cliente..." />
            <CommandList>
              <CommandEmpty>No se encontró el cliente.</CommandEmpty>
              <CommandGroup>
                {clients.map((client: any) => (
                  <CommandItem
                    key={client.email}
                    value={`${client.nombre} ${client.email}`}
                    onSelect={() => {
                      setImpersonatedCliente(client.email, client.personaId, client.nombre);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", impersonatedClienteEmail === client.email ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col">
                      <span className="text-sm">{client.nombre}</span>
                      <span className="text-xs text-muted-foreground">{client.email}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {isImpersonating && (
        <button
          onClick={clearImpersonation}
          aria-label="Limpiar cliente"
          className="flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
