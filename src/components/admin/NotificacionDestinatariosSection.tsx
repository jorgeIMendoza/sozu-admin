import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Users, Mail, ChevronDown, ChevronUp, Search, CheckSquare, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface DestinatarioManual {
  nombre: string;
  email: string;
  telefono?: string;
}

interface Rol {
  id: number;
  nombre: string;
}

interface PoolItem {
  nombre: string;
  email: string;
  rolIds: number[];
  telefono?: string;
  manual?: boolean;
}

interface Props {
  roles: Rol[];
  selectedRoles: number[];
  onToggleRole: (rolId: number) => void;
  /** Correos manuales (se suman a los usuarios por rol). */
  manuales: DestinatarioManual[];
  onManualesChange: (list: DestinatarioManual[]) => void;
  /** Correos de usuarios por rol que se excluyen del envío. */
  excluidos: string[];
  onExcluidosChange: (list: string[]) => void;
  /** Evento de contrato: muestra el toggle "incluir vendedor externo". */
  mostrarVendedorExterno?: boolean;
  incluirVendedorExterno?: boolean;
  onIncluirVendedorExternoChange?: (v: boolean) => void;
}

/**
 * Selector de destinatarios para notificaciones.
 * Modelo DINÁMICO: al enviar se resuelven todos los usuarios activos de los roles
 * seleccionados, menos los excluidos, más los correos manuales. Esta UI sólo guarda
 * roles + exclusiones + manuales; la resolución final ocurre en la edge function.
 */
export function NotificacionDestinatariosSection({
  roles,
  selectedRoles,
  onToggleRole,
  manuales,
  onManualesChange,
  excluidos,
  onExcluidosChange,
  mostrarVendedorExterno = false,
  incluirVendedorExterno = false,
  onIncluirVendedorExternoChange,
}: Props) {
  const { toast } = useToast();
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [rolePool, setRolePool] = useState<PoolItem[]>([]);
  const [manualNombre, setManualNombre] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualTelefono, setManualTelefono] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "selected" | "unselected">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [roleSearchTerm, setRoleSearchTerm] = useState("");

  const selectedRolesKey = selectedRoles.join(",");

  // Carga (o recarga) los usuarios activos de los roles seleccionados.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (selectedRoles.length === 0) {
        setRolePool([]);
        return;
      }
      setLoadingRoles(true);
      const { data } = await supabase
        .from("usuarios")
        .select("nombre, email, telefono, rol_id")
        .in("rol_id", selectedRoles)
        .eq("activo", true)
        .not("email", "is", null);
      if (cancelled) return;
      const map = new Map<string, PoolItem>();
      for (const u of data || []) {
        if (!u.email) continue;
        const key = u.email.toLowerCase();
        const ex = map.get(key);
        if (ex) {
          if (u.rol_id && !ex.rolIds.includes(u.rol_id)) ex.rolIds.push(u.rol_id);
        } else {
          map.set(key, {
            nombre: u.nombre || u.email,
            email: u.email,
            telefono: u.telefono || "",
            rolIds: u.rol_id ? [u.rol_id] : [],
          });
        }
      }
      setRolePool([...map.values()]);
      setLoadingRoles(false);
    };
    run();
    return () => { cancelled = true; };
  }, [selectedRolesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const excluidosSet = useMemo(
    () => new Set(excluidos.map(e => e.toLowerCase())),
    [excluidos]
  );
  const manualEmailsSet = useMemo(
    () => new Set(manuales.map(m => m.email.toLowerCase())),
    [manuales]
  );

  // Pool combinado: usuarios por rol (sin los que ya están como manual) + manuales.
  const pool: PoolItem[] = useMemo(() => {
    const out: PoolItem[] = [];
    for (const r of rolePool) {
      if (manualEmailsSet.has(r.email.toLowerCase())) continue;
      out.push(r);
    }
    for (const m of manuales) {
      out.push({
        nombre: m.nombre || m.email,
        email: m.email,
        telefono: m.telefono || "",
        rolIds: [],
        manual: true,
      });
    }
    return out;
  }, [rolePool, manuales, manualEmailsSet]);

  const isSelected = (item: PoolItem) =>
    item.manual ? true : !excluidosSet.has(item.email.toLowerCase());

  const toggle = (item: PoolItem) => {
    if (item.manual) {
      // Desmarcar un manual lo elimina de la lista.
      onManualesChange(manuales.filter(m => m.email.toLowerCase() !== item.email.toLowerCase()));
      return;
    }
    const key = item.email.toLowerCase();
    if (excluidosSet.has(key)) {
      onExcluidosChange(excluidos.filter(e => e.toLowerCase() !== key));
    } else {
      onExcluidosChange([...excluidos, item.email]);
    }
  };

  const addManual = () => {
    const email = manualEmail.trim();
    if (!email || !email.includes("@")) {
      toast({ title: "Error", description: "El email es requerido y debe ser válido", variant: "destructive" });
      return;
    }
    const key = email.toLowerCase();
    if (manualEmailsSet.has(key)) {
      toast({ title: "Error", description: "Este email ya está en la lista", variant: "destructive" });
      return;
    }
    // Si ya es un usuario por rol, simplemente lo reactiva (quita exclusión).
    if (rolePool.some(r => r.email.toLowerCase() === key)) {
      if (excluidosSet.has(key)) onExcluidosChange(excluidos.filter(e => e.toLowerCase() !== key));
      toast({ title: "Reactivado", description: "Ese correo ya estaba por rol; se reactivó." });
      setManualNombre(""); setManualEmail(""); setManualTelefono("");
      return;
    }
    onManualesChange([...manuales, {
      nombre: manualNombre.trim() || email,
      email,
      telefono: manualTelefono.trim(),
    }]);
    setManualNombre(""); setManualEmail(""); setManualTelefono("");
  };

  const rolesInPool = roles.filter(r => rolePool.some(p => p.rolIds.includes(r.id)));
  const hasManual = manuales.length > 0;

  const filteredPool = pool.filter(d => {
    const matchesSearch =
      d.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.email.toLowerCase().includes(searchTerm.toLowerCase());
    const sel = isSelected(d);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "selected" && sel) ||
      (statusFilter === "unselected" && !sel);
    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "manual" && d.manual) ||
      d.rolIds.includes(Number(roleFilter));
    return matchesSearch && matchesStatus && matchesRole;
  });

  const selectAllVisible = () => {
    const visRoleEmails = new Set(
      filteredPool.filter(p => !p.manual).map(p => p.email.toLowerCase())
    );
    onExcluidosChange(excluidos.filter(e => !visRoleEmails.has(e.toLowerCase())));
  };

  const deselectAllVisible = () => {
    const set = new Set(excluidos.map(e => e.toLowerCase()));
    const merged = [...excluidos];
    for (const p of filteredPool) {
      if (p.manual) continue;
      if (!set.has(p.email.toLowerCase())) merged.push(p.email);
    }
    onExcluidosChange(merged);
  };

  const VISIBLE_COUNT = 10;
  const visibleItems = showAll ? filteredPool : filteredPool.slice(0, VISIBLE_COUNT);
  const hasMore = filteredPool.length > VISIBLE_COUNT;
  const selectedCount = pool.filter(isSelected).length;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80 leading-relaxed">
        <strong className="text-foreground">¿Cómo se eligen los destinatarios?</strong>
        <br />
        Al enviar, se resuelven <strong>todos los usuarios activos</strong> de los roles
        seleccionados, <strong>menos</strong> los que desmarques abajo, <strong>más</strong> los
        correos manuales que agregues. Si no agregas correos manuales, solo se notifica por rol.
      </div>

      {/* Roles */}
      <div>
        <Label>Roles destinatarios</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Al seleccionar un rol se incluyen todos sus usuarios activos.
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
                  onChange={() => onToggleRole(rol.id)}
                  className="rounded"
                />
                {rol.nombre}
              </label>
            ))}
        </div>
        {loadingRoles && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando usuarios del rol...
          </p>
        )}
      </div>

      {/* Vendedor externo (solo evento de contrato) */}
      {mostrarVendedorExterno && (
        <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
          <Checkbox
            id="incluir_vendedor_externo"
            checked={incluirVendedorExterno}
            onCheckedChange={(checked) => onIncluirVendedorExternoChange?.(!!checked)}
            className="mt-0.5"
          />
          <Label htmlFor="incluir_vendedor_externo" className="text-xs cursor-pointer">
            Incluir al <strong>vendedor externo</strong> (quien generó la oferta) cuando la venta
            sea de inmobiliaria/agente externo. Su correo se resuelve automáticamente.
          </Label>
        </div>
      )}

      {/* Agregar manual */}
      <div>
        <Label>Agregar destinatario manual</Label>
        <p className="text-xs text-muted-foreground mb-1">
          El teléfono es opcional y solo se usa si la notificación envía por WhatsApp.
        </p>
        <div className="flex gap-2 mt-1">
          <Input placeholder="Nombre" value={manualNombre} onChange={(e) => setManualNombre(e.target.value)} className="flex-1" />
          <Input
            placeholder="Email *"
            type="email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addManual())}
          />
          <Input
            placeholder="Teléfono (opc.)"
            value={manualTelefono}
            onChange={(e) => setManualTelefono(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addManual())}
          />
          <Button type="button" size="icon" variant="outline" onClick={addManual}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Lista de destinatarios */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Label>Destinatarios</Label>
          <Badge variant="secondary" className="text-xs">
            <Mail className="h-3 w-3 mr-1" />
            {selectedCount} de {pool.length} seleccionado{selectedCount !== 1 ? "s" : ""}
          </Badge>
          {pool.length > 0 && (
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAllVisible}>
                <CheckSquare className="h-3 w-3 mr-1" /> Todos
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive" onClick={deselectAllVisible}>
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
            {(rolesInPool.length > 0 || hasManual) && (
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setShowAll(false); }}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue placeholder="Filtrar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  {rolesInPool.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.nombre}</SelectItem>
                  ))}
                  {hasManual && <SelectItem value="manual">Manual</SelectItem>}
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
                const sel = isSelected(d);
                const rolNames = d.manual
                  ? "Manual"
                  : d.rolIds.map(rid => roles.find(r => r.id === rid)?.nombre).filter(Boolean).join(", ") || "—";
                return (
                  <label
                    key={d.email}
                    className={`flex items-center gap-2 text-sm rounded px-2 py-1.5 cursor-pointer transition-colors ${
                      sel ? "bg-primary/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox checked={sel} onCheckedChange={() => toggle(d)} className="shrink-0" />
                    <span className="truncate flex-1">
                      <span className="font-medium">{d.nombre}</span>
                      <span className="text-muted-foreground ml-1 text-xs">({d.email})</span>
                      {d.telefono && (
                        <span className="text-muted-foreground ml-1 text-[10px]">📱 {d.telefono}</span>
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
