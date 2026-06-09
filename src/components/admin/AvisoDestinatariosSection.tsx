import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Plus, Loader2, Users, Mail, ChevronDown, ChevronUp, Search, CheckSquare, Square, Building2, Layers, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Destinatario {
  nombre: string;
  email: string;
  telefono?: string;
}

interface PoolItem {
  nombre: string;
  email: string;
  rolIds: number[];
  proyectos?: string[]; // project names for Cliente users
  telefono?: string;
}

// Una "finca" = una propiedad del cliente con su proyecto, modelo y piso.
interface ClienteFinca {
  proyecto: string;
  modelo: string;
  piso: string;
}

interface Rol {
  id: number;
  nombre: string;
}

const CLIENTE_ROL_ID = 23;

interface Props {
  roles: Rol[];
  selectedRoles: number[];
  onToggleRole: (rolId: number) => void;
  destinatarios: Destinatario[];
  onDestinatariosChange: (destinatarios: Destinatario[]) => void;
  selectedProyectos?: string[];
  onSelectedProyectosChange?: (proyectos: string[]) => void;
  availableProjectOptions?: string[];
  selectedModelos?: string[];
  onSelectedModelosChange?: (modelos: string[]) => void;
  selectedPisos?: string[];
  onSelectedPisosChange?: (pisos: string[]) => void;
}

export function AvisoDestinatariosSection({
  roles,
  selectedRoles,
  onToggleRole,
  destinatarios,
  onDestinatariosChange,
  selectedProyectos = [],
  onSelectedProyectosChange,
  availableProjectOptions = [],
  selectedModelos = [],
  onSelectedModelosChange,
  selectedPisos = [],
  onSelectedPisosChange,
}: Props) {
  const { toast } = useToast();
  const [loadingRolId, setLoadingRolId] = useState<number | null>(null);
  const [manualNombre, setManualNombre] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualTelefono, setManualTelefono] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "selected" | "unselected">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [roleSearchTerm, setRoleSearchTerm] = useState("");

  const [pool, setPool] = useState<PoolItem[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [clienteProyectoMap, setClienteProyectoMap] = useState<Map<string, string[]>>(new Map());
  // email -> lista de propiedades (proyecto/modelo/piso) del cliente
  const [clienteFincasMap, setClienteFincasMap] = useState<Map<string, ClienteFinca[]>>(new Map());

  const isClienteSelected = selectedRoles.includes(CLIENTE_ROL_ID);

  // Fetch projects for all clients
  const fetchClienteProyectos = useCallback(async () => {
    // Query: usuarios (Cliente) -> personas -> ofertas -> cuentas_cobranza -> propiedades -> edificios_modelos -> edificios -> proyectos
    const { data } = await supabase
      .from("usuarios")
      .select("email, id_persona")
      .eq("rol_id", CLIENTE_ROL_ID)
      .eq("activo", true)
      .not("email", "is", null);

    if (!data || data.length === 0) return;

    const personaIds = data.filter(u => u.id_persona).map(u => u.id_persona!);
    const emailByPersona = new Map(data.filter(u => u.id_persona).map(u => [u.id_persona!, u.email!]));

    // Get all cuentas_cobranza for these personas via ofertas
    const { data: ofertas } = await supabase
      .from("ofertas")
      .select("id, id_persona_lead")
      .in("id_persona_lead", personaIds);

    if (!ofertas || ofertas.length === 0) return;

    const ofertaIds = ofertas.map(o => o.id);
    const personaByOferta = new Map(ofertas.map(o => [o.id, o.id_persona_lead!]));

    const { data: cuentas } = await supabase
      .from("cuentas_cobranza")
      .select("id_oferta, id_propiedad")
      .in("id_oferta", ofertaIds)
      .eq("activo", true);

    if (!cuentas || cuentas.length === 0) return;

    const propiedadIds = [...new Set(cuentas.filter(c => c.id_propiedad).map(c => c.id_propiedad!))];

    const { data: propiedades } = await supabase
      .from("propiedades")
      .select("id, id_edificio_modelo, numero_piso")
      .in("id", propiedadIds);

    if (!propiedades) return;

    const emIds = [...new Set(propiedades.filter(p => p.id_edificio_modelo).map(p => p.id_edificio_modelo!))];

    const { data: edModelos } = await supabase
      .from("edificios_modelos")
      .select("id, id_edificio, id_modelo")
      .in("id", emIds);

    if (!edModelos) return;

    const edIds = [...new Set(edModelos.map(em => em.id_edificio))];
    const modeloIds = [...new Set(edModelos.filter(em => em.id_modelo).map(em => em.id_modelo!))];

    const [{ data: edificios }, { data: modelos }] = await Promise.all([
      supabase.from("edificios").select("id, id_proyecto").in("id", edIds),
      modeloIds.length > 0
        ? supabase.from("modelos").select("id, nombre").in("id", modeloIds)
        : Promise.resolve({ data: [] as { id: number; nombre: string }[] }),
    ]);

    if (!edificios) return;

    const proyIds = [...new Set(edificios.map(e => e.id_proyecto))];

    const { data: proyectos } = await supabase
      .from("proyectos")
      .select("id, nombre")
      .in("id", proyIds);

    if (!proyectos) return;

    // Maps para reconstruir proyecto/modelo/piso por propiedad
    const proyNombreById = new Map(proyectos.map(p => [p.id, p.nombre]));
    const modeloNombreById = new Map((modelos || []).map(m => [m.id, m.nombre]));
    const edProyById = new Map(edificios.map(e => [e.id, e.id_proyecto]));
    const emEdById = new Map(edModelos.map(em => [em.id, em.id_edificio]));
    const emModeloById = new Map(edModelos.map(em => [em.id, em.id_modelo]));
    const propEmById = new Map(propiedades.map(p => [p.id, p.id_edificio_modelo]));
    const propPisoById = new Map(propiedades.map(p => [p.id, (p.numero_piso ?? "").toString().trim()]));

    const emailProyectos = new Map<string, Set<string>>();
    // dedup de fincas por email con clave proyecto|modelo|piso
    const emailFincas = new Map<string, Map<string, ClienteFinca>>();

    for (const cuenta of cuentas) {
      if (!cuenta.id_oferta || !cuenta.id_propiedad) continue;
      const personaId = personaByOferta.get(cuenta.id_oferta);
      if (!personaId) continue;
      const email = emailByPersona.get(personaId);
      if (!email) continue;

      const emId = propEmById.get(cuenta.id_propiedad);
      if (!emId) continue;
      const edId = emEdById.get(emId);
      if (!edId) continue;
      const proyId = edProyById.get(edId);
      if (!proyId) continue;
      const proyNombre = proyNombreById.get(proyId);
      if (!proyNombre) continue;

      const modeloId = emModeloById.get(emId);
      const modeloNombre = (modeloId ? modeloNombreById.get(modeloId) : "") || "";
      const piso = propPisoById.get(cuenta.id_propiedad) || "";

      if (!emailProyectos.has(email)) emailProyectos.set(email, new Set());
      emailProyectos.get(email)!.add(proyNombre);

      if (!emailFincas.has(email)) emailFincas.set(email, new Map());
      const fincaKey = `${proyNombre}|${modeloNombre}|${piso}`;
      emailFincas.get(email)!.set(fincaKey, { proyecto: proyNombre, modelo: modeloNombre, piso });
    }

    const map = new Map<string, string[]>();
    for (const [email, proysSet] of emailProyectos) {
      map.set(email, [...proysSet]);
    }
    setClienteProyectoMap(map);

    const fincasMap = new Map<string, ClienteFinca[]>();
    for (const [email, fincas] of emailFincas) {
      fincasMap.set(email, [...fincas.values()]);
    }
    setClienteFincasMap(fincasMap);
  }, []);

  // Sync from parent on mount
  useEffect(() => {
    const initPool = async () => {
      const dbEmails = new Set(destinatarios.map(d => d.email));
      const merged: PoolItem[] = [];

      for (const d of destinatarios) {
        merged.push({ nombre: d.nombre, email: d.email, telefono: (d as any).telefono || "", rolIds: [] });
      }

      if (selectedRoles.length > 0) {
        const { data: usuarios } = await supabase
          .from("usuarios")
          .select("nombre, email, rol_id")
          .in("rol_id", selectedRoles)
          .eq("activo", true)
          .not("email", "is", null);

        if (usuarios) {
          for (const u of usuarios) {
            if (!u.email) continue;
            const existing = merged.find(p => p.email === u.email);
            if (existing) {
              if (u.rol_id && !existing.rolIds.includes(u.rol_id)) {
                existing.rolIds.push(u.rol_id);
              }
            } else {
              merged.push({ nombre: u.nombre || u.email, email: u.email, rolIds: u.rol_id ? [u.rol_id] : [] });
            }
          }
        }
      }

      setPool(merged);
      setSelectedEmails(dbEmails);
    };

    initPool();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch client projects when Cliente role is selected
  useEffect(() => {
    if (isClienteSelected) {
      fetchClienteProyectos();
    }
  }, [isClienteSelected, fetchClienteProyectos]);

  // Fincas que pertenecen a los proyectos seleccionados (si no hay proyectos
  // seleccionados, se consideran todas). Universo para opciones de modelo/piso.
  const fincasEnProyectos = useMemo(() => {
    const out: ClienteFinca[] = [];
    for (const fincas of clienteFincasMap.values()) {
      for (const f of fincas) {
        if (selectedProyectos.length === 0 || selectedProyectos.includes(f.proyecto)) {
          out.push(f);
        }
      }
    }
    return out;
  }, [clienteFincasMap, selectedProyectos]);

  // Opciones de Modelo dependientes del/los proyecto(s) seleccionado(s).
  const availableModeloOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of fincasEnProyectos) if (f.modelo) set.add(f.modelo);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [fincasEnProyectos]);

  // Opciones de Piso dependientes del/los proyecto(s) seleccionado(s). Orden numérico.
  const availablePisoOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of fincasEnProyectos) if (f.piso) set.add(f.piso);
    return [...set].sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b, "es");
    });
  }, [fincasEnProyectos]);

  // ¿El cliente tiene alguna propiedad que cumpla proyecto + modelo + piso seleccionados?
  const clientMatchesFilters = useCallback((email: string): boolean => {
    const fincas = clienteFincasMap.get(email) || [];
    if (fincas.length === 0) return false;
    return fincas.some((f) =>
      (selectedProyectos.length === 0 || selectedProyectos.includes(f.proyecto)) &&
      (selectedModelos.length === 0 || selectedModelos.includes(f.modelo)) &&
      (selectedPisos.length === 0 || selectedPisos.includes(f.piso))
    );
  }, [clienteFincasMap, selectedProyectos, selectedModelos, selectedPisos]);

  // Al cambiar el proyecto, podar modelos/pisos seleccionados que ya no existan en las
  // opciones disponibles (evita filtros "fantasma" que no corresponden al desarrollo).
  useEffect(() => {
    if (!isClienteSelected || clienteFincasMap.size === 0) return;
    const prunedModelos = selectedModelos.filter((m) => availableModeloOptions.includes(m));
    if (prunedModelos.length !== selectedModelos.length) onSelectedModelosChange?.(prunedModelos);
    const prunedPisos = selectedPisos.filter((p) => availablePisoOptions.includes(p));
    if (prunedPisos.length !== selectedPisos.length) onSelectedPisosChange?.(prunedPisos);
  }, [availableModeloOptions, availablePisoOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const notifyParent = useCallback((newSelected: Set<string>, currentPool: PoolItem[]) => {
    const selected = currentPool
      .filter(d => newSelected.has(d.email))
      .map(d => ({ nombre: d.nombre, email: d.email, telefono: d.telefono || "" }));
    onDestinatariosChange(selected);
  }, [onDestinatariosChange]);

  const handleToggleRole = async (rolId: number) => {
    const wasSelected = selectedRoles.includes(rolId);
    onToggleRole(rolId);

    if (!wasSelected) {
      setLoadingRolId(rolId);
      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("nombre, email")
        .eq("rol_id", rolId)
        .eq("activo", true)
        .not("email", "is", null);

      if (usuarios && usuarios.length > 0) {
        let addedCount = 0;
        const updatedPool = [...pool];

        for (const u of usuarios) {
          if (!u.email) continue;
          const existing = updatedPool.find(p => p.email === u.email);
          if (existing) {
            if (!existing.rolIds.includes(rolId)) existing.rolIds.push(rolId);
          } else {
            updatedPool.push({ nombre: u.nombre || u.email, email: u.email, rolIds: [rolId] });
            addedCount++;
          }
        }

        setPool(updatedPool);

        const newSelected = new Set(selectedEmails);
        for (const u of usuarios) {
          if (u.email) newSelected.add(u.email);
        }
        setSelectedEmails(newSelected);
        notifyParent(newSelected, updatedPool);

        if (addedCount > 0) {
          toast({
            title: `${addedCount} destinatarios agregados`,
            description: `Se cargaron los usuarios activos del rol seleccionado`,
          });
        }
      }
      setLoadingRolId(null);
    }
  };

  // Cuando cambian los filtros (proyecto/modelo/piso), reajusta la selección de clientes:
  // selecciona los que cumplen el filtro y deselecciona los que no (si son SOLO clientes).
  useEffect(() => {
    if (!isClienteSelected || clienteFincasMap.size === 0) return;
    const sinFiltro = selectedProyectos.length === 0 && selectedModelos.length === 0 && selectedPisos.length === 0;
    if (sinFiltro) return;

    const newSelected = new Set(selectedEmails);
    let changed = false;

    for (const item of pool) {
      if (!item.rolIds.includes(CLIENTE_ROL_ID)) continue;
      const matches = clientMatchesFilters(item.email);

      if (!matches && newSelected.has(item.email)) {
        // Solo deselecciona si el usuario es ÚNICAMENTE Cliente (no también otro rol)
        const hasOtherRoles = item.rolIds.some(r => r !== CLIENTE_ROL_ID);
        if (!hasOtherRoles) {
          newSelected.delete(item.email);
          changed = true;
        }
      } else if (matches && !newSelected.has(item.email)) {
        newSelected.add(item.email);
        changed = true;
      }
    }

    if (changed) {
      setSelectedEmails(newSelected);
      notifyParent(newSelected, pool);
    }
  }, [selectedProyectos, selectedModelos, selectedPisos, clienteFincasMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleEmail = (email: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(email)) newSelected.delete(email);
    else newSelected.add(email);
    setSelectedEmails(newSelected);
    notifyParent(newSelected, pool);
  };

  const selectAll = () => {
    const filtered = getFilteredPool();
    const all = new Set(selectedEmails);
    filtered.forEach(d => all.add(d.email));
    setSelectedEmails(all);
    notifyParent(all, pool);
  };

  const deselectAll = () => {
    setSelectedEmails(new Set());
    onDestinatariosChange([]);
  };

  const addManual = () => {
    if (!manualEmail.trim()) {
      toast({ title: "Error", description: "El email es requerido", variant: "destructive" });
      return;
    }
    if (pool.some((d) => d.email === manualEmail.trim())) {
      toast({ title: "Error", description: "Este email ya está en la lista", variant: "destructive" });
      return;
    }
    const newItem: PoolItem = {
      nombre: manualNombre.trim() || manualEmail.trim(),
      email: manualEmail.trim(),
      telefono: manualTelefono.trim(),
      rolIds: [],
    };
    const updatedPool = [...pool, newItem];
    setPool(updatedPool);
    const newSelected = new Set(selectedEmails);
    newSelected.add(newItem.email);
    setSelectedEmails(newSelected);
    notifyParent(newSelected, updatedPool);
    setManualNombre("");
    setManualEmail("");
    setManualTelefono("");
  };

  const rolesInPool = roles.filter(r => pool.some(p => p.rolIds.includes(r.id)));
  const hasManualItems = pool.some(p => p.rolIds.length === 0);

  const getFilteredPool = () => {
    const hayFiltro = selectedProyectos.length > 0 || selectedModelos.length > 0 || selectedPisos.length > 0;
    return pool.filter(d => {
      // Con filtros activos, oculta clientes que no tengan ninguna propiedad que cumpla
      // proyecto + modelo + piso. Solo aplica a quienes son únicamente Cliente.
      if (isClienteSelected && hayFiltro && d.rolIds.includes(CLIENTE_ROL_ID)) {
        const matches = clientMatchesFilters(d.email);
        const hasOtherRoles = d.rolIds.some(r => r !== CLIENTE_ROL_ID);
        if (!matches && !hasOtherRoles) return false;
      }

      const matchesSearch = d.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "selected" && selectedEmails.has(d.email)) ||
        (statusFilter === "unselected" && !selectedEmails.has(d.email));
      const matchesRole = roleFilter === "all" ||
        (roleFilter === "manual" && d.rolIds.length === 0) ||
        d.rolIds.includes(Number(roleFilter));
      return matchesSearch && matchesStatus && matchesRole;
    });
  };

  const VISIBLE_COUNT = 10;
  const filteredPool = getFilteredPool();
  const visibleItems = showAll ? filteredPool : filteredPool.slice(0, VISIBLE_COUNT);
  const hasMore = filteredPool.length > VISIBLE_COUNT;
  const selectedCount = selectedEmails.size;

  return (
    <div className="space-y-4">
      {/* Aviso whitelist semantics */}
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80 leading-relaxed">
        <strong className="text-foreground">¿Cómo funciona la lista de destinatarios?</strong>
        <br />
        Si el aviso es <strong>de evento</strong> (ej. recordatorio de pago), la lista cargada
        funciona como una <strong>whitelist</strong> sobre el email del cliente real del acuerdo:
        solo se notifica a los clientes cuyo correo aparece en la lista. Si la dejas{" "}
        <strong>vacía</strong>, se notifica automáticamente a <strong>todos</strong> los clientes
        que cumplan la condición del trigger.
      </div>

      {/* Roles selection */}
      <div>
        <Label>Roles Destinatarios</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Al seleccionar un rol, se precargan sus usuarios activos como destinatarios.
        </p>
        <div className="relative mb-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar rol..."
            value={roleSearchTerm}
            onChange={(e) => setRoleSearchTerm(e.target.value)}
            className="text-sm pl-8 h-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto border rounded p-2">
          {roles
            .filter(r => r.nombre.toLowerCase().includes(roleSearchTerm.toLowerCase()))
            .map((rol) => (
            <label
              key={rol.id}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-1 rounded"
            >
              <input
                type="checkbox"
                checked={selectedRoles.includes(rol.id)}
                onChange={() => handleToggleRole(rol.id)}
                className="rounded"
              />
              {rol.nombre}
              {loadingRolId === rol.id && <Loader2 className="h-3 w-3 animate-spin" />}
            </label>
          ))}
        </div>
      </div>

      {/* Project filter */}
      {availableProjectOptions.length > 0 && (
        <div>
          <Label className="flex items-center gap-1.5 mb-1.5">
            <Building2 className="h-4 w-4" />
            Desarrollos habilitados para este aviso
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            Selecciona los desarrollos publicados por Sozu donde este aviso estará activo. Por default todos quedan habilitados.
          </p>
          <MultiSelectFilter
            values={selectedProyectos}
            onValuesChange={(vals) => onSelectedProyectosChange?.(vals)}
            options={availableProjectOptions}
            placeholder="Todos los desarrollos publicados"
            searchPlaceholder="Buscar desarrollo..."
            icon={<Building2 className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Modelo / Piso filters — dependen del/los desarrollo(s) seleccionado(s) y solo
          aplican a destinatarios Cliente. */}
      {isClienteSelected && (availableModeloOptions.length > 0 || availablePisoOptions.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availableModeloOptions.length > 0 && (
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Layers className="h-4 w-4" />
                Modelo
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Filtra clientes por el modelo de su propiedad. Vacío = todos los modelos.
              </p>
              <MultiSelectFilter
                values={selectedModelos}
                onValuesChange={(vals) => onSelectedModelosChange?.(vals)}
                options={availableModeloOptions}
                placeholder="Todos los modelos"
                searchPlaceholder="Buscar modelo..."
                icon={<Layers className="h-4 w-4" />}
              />
            </div>
          )}
          {availablePisoOptions.length > 0 && (
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Home className="h-4 w-4" />
                Piso
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Filtra clientes por el piso de su propiedad. Vacío = todos los pisos.
              </p>
              <MultiSelectFilter
                values={selectedPisos}
                onValuesChange={(vals) => onSelectedPisosChange?.(vals)}
                options={availablePisoOptions}
                placeholder="Todos los pisos"
                searchPlaceholder="Buscar piso..."
                icon={<Home className="h-4 w-4" />}
              />
            </div>
          )}
        </div>
      )}

      {/* Manual add */}
      <div>
        <Label>Agregar destinatario manual</Label>
        <p className="text-xs text-muted-foreground mb-1">
          El teléfono es opcional y solo se usa si el aviso envía por WhatsApp. Acepta formato libre
          (ej. <code>+5217221514185</code> o <code>7221514185</code>); se normaliza automáticamente.
        </p>
        <div className="flex gap-2 mt-1">
          <Input placeholder="Nombre" value={manualNombre} onChange={(e) => setManualNombre(e.target.value)} className="flex-1" />
          <Input placeholder="Email *" type="email" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addManual())} />
          <Input placeholder="Teléfono (opc.)" value={manualTelefono} onChange={(e) => setManualTelefono(e.target.value)} className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addManual())} />
          <Button type="button" size="icon" variant="outline" onClick={addManual}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Destinatarios list */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Label>Destinatarios</Label>
          <Badge variant="secondary" className="text-xs">
            <Mail className="h-3 w-3 mr-1" />
            {selectedCount} de {filteredPool.length} seleccionado{selectedCount !== 1 ? "s" : ""}
          </Badge>
          {pool.length > 0 && (
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAll}>
                <CheckSquare className="h-3 w-3 mr-1" /> Todos
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive" onClick={deselectAll}>
                <Square className="h-3 w-3 mr-1" /> Ninguno
              </Button>
            </div>
          )}
        </div>
        {pool.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowAll(false); }}
                className="text-sm pl-8 h-8"
              />
            </div>
            {(rolesInPool.length > 0 || hasManualItems) && (
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setShowAll(false); }}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue placeholder="Filtrar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  {rolesInPool.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.nombre}</SelectItem>
                  ))}
                  {hasManualItems && <SelectItem value="manual">Manual</SelectItem>}
                </SelectContent>
              </Select>
            )}
            <div className="flex border rounded-md overflow-hidden shrink-0">
              {([
                { value: "all" as const, label: "Todos" },
                { value: "selected" as const, label: "✓" },
                { value: "unselected" as const, label: "✗" },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setStatusFilter(opt.value); setShowAll(false); }}
                  className={`px-2 h-8 text-xs transition-colors ${
                    statusFilter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="border rounded p-2 max-h-72 overflow-y-auto space-y-0.5">
          {pool.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Selecciona roles o agrega destinatarios manualmente
            </p>
          ) : filteredPool.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              No se encontraron resultados
            </p>
          ) : (
            <>
              {visibleItems.map((d) => {
                const isSelected = selectedEmails.has(d.email);
                const rolNames = d.rolIds.length > 0
                  ? d.rolIds.map(rid => roles.find(r => r.id === rid)?.nombre).filter(Boolean).join(", ")
                  : "Manual";
                const clientProjects = clienteProyectoMap.get(d.email);
                return (
                  <label
                    key={d.email}
                    className={`flex items-center gap-2 text-sm rounded px-2 py-1.5 cursor-pointer transition-colors ${
                      isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleEmail(d.email)} className="shrink-0" />
                    <span className="truncate flex-1">
                      <span className="font-medium">{d.nombre}</span>
                      <span className="text-muted-foreground ml-1 text-xs">({d.email})</span>
                      {d.telefono && (
                        <span className="text-muted-foreground ml-1 text-[10px]">📱 {d.telefono}</span>
                      )}
                      {clientProjects && clientProjects.length > 0 && (
                        <span className="text-muted-foreground ml-1 text-[10px]">
                          — {clientProjects.join(", ")}
                        </span>
                      )}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0 h-5">{rolNames}</Badge>
                  </label>
                );
              })}
              {hasMore && (
                <Button type="button" variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setShowAll(!showAll)}>
                  {showAll ? (
                    <><ChevronUp className="h-3 w-3 mr-1" /> Mostrar menos</>
                  ) : (
                    <><ChevronDown className="h-3 w-3 mr-1" /> Ver {filteredPool.length - VISIBLE_COUNT} más</>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
