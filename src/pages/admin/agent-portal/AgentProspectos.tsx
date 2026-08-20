import { Fragment, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffectiveAgent } from "@/hooks/useEffectiveAgent";
import { useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { AddProspectoFloatingDialog } from "@/components/admin/AddProspectoFloatingDialog";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconTip } from "@/components/ui/icon-tip";
import { SimplePagination } from "@/components/ui/simple-pagination";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  fetchAgenteProspectos, fetchAgenteProspectosFacetas, fetchAgentesAsignables, fetchEstatusLead,
  reasignarLead, setLeadEstatus, PROYECTO_SIN_DESARROLLO,
  type ProspectoRow,
} from "@/lib/portal-agente/leads";
import { etapaDef } from "@/lib/portal-agente/negocios";
import {
  Loader2, Search, UserPlus, ChevronRight, ChevronDown, EyeOff, Eye, Plus, Users, ArrowLeftRight,
} from "lucide-react";

/** Prospectos por página. La búsqueda y el corte los resuelve la base, no el navegador. */
const POR_PAGINA = 25;

const fmtCurrency = (v: number | null) =>
  v == null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);

const AgentProspectos = () => {
  // Identidad efectiva: al impersonar se lee con la persona **y el auth_user_id** del
  // agente. Antes solo viajaba la persona, así que la RPC (que filtra por auth.uid())
  // devolvía los prospectos del admin: el Portal Agente enseñaba la cartera del CRM.
  const { personaId: effectivePersonaIdHook, authUserId: effectiveAuthUserId, impersonationIncomplete } = useEffectiveAgent();
  const effectivePersonaId = effectivePersonaIdHook;
  const queryClient = useQueryClient();
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();
  const { permissions } = useAgentPortalPermissions();
  const perms = permissions["/admin/agent/prospectos"] || permissions["/admin/agent/inicio"] || { canRead: true, canCreate: true };
  const { presentationMode, mask } = useAgentPresentation();
  const [addProspectoOpen, setAddProspectoOpen] = useState(false);
  const [editPersonaId, setEditPersonaId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  // Lo que realmente viaja a la base: el tecleo se acumula 350 ms para no lanzar una
  // consulta por letra.
  const [searchAplicado, setSearchAplicado] = useState("");
  const [filtroEstatus, setFiltroEstatus] = useState<string>("all");
  const [filtroProyecto, setFiltroProyecto] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [guardando, setGuardando] = useState<number | null>(null);
  // Traspaso: el agente puede pasar su prospecto a otro y lo pierde.
  const [traspaso, setTraspaso] = useState<{ id_er: number; proyecto: string; persona: string } | null>(null);
  const [destino, setDestino] = useState<string>("");
  const [traspasando, setTraspasando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    registrarVista("/admin/agent/prospectos");
    track({ page: "agent_prospectos", elementId: "page_view", elementType: "page" });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchAplicado(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Cualquier cambio de filtro vuelve a la primera página: la página 8 de la búsqueda
  // anterior no significa nada en la nueva.
  useEffect(() => {
    setPage(1);
  }, [searchAplicado, filtroEstatus, filtroProyecto, effectiveAuthUserId, effectivePersonaId]);

  const { data: catalogoEstatus = [] } = useQuery({
    queryKey: ["estatus-lead"],
    queryFn: fetchEstatusLead,
    staleTime: 5 * 60_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "agent-prospectos", effectivePersonaId, effectiveAuthUserId,
      searchAplicado, filtroEstatus, filtroProyecto, page,
    ],
    queryFn: () => fetchAgenteProspectos({
      authUserId: effectiveAuthUserId,
      personaId: effectivePersonaId ?? null,
      search: searchAplicado || null,
      estatus: filtroEstatus === "all" ? null : Number(filtroEstatus),
      proyecto: filtroProyecto === "all"
        ? null
        : (filtroProyecto === "null" ? PROYECTO_SIN_DESARROLLO : Number(filtroProyecto)),
      limit: POR_PAGINA,
      offset: (page - 1) * POR_PAGINA,
    }),
    enabled: !!effectivePersonaId || !!effectiveAuthUserId,
    // Evita el parpadeo a "sin prospectos" mientras llega la página siguiente.
    placeholderData: keepPreviousData,
  });

  // Desarrollos del agente completos, no los de la página visible: si el filtro se armara
  // con las 25 filas de la página, un desarrollo suyo desaparecería del selector.
  const { data: facetas } = useQuery({
    queryKey: ["agent-prospectos-facetas", effectiveAuthUserId],
    queryFn: () => fetchAgenteProspectosFacetas(effectiveAuthUserId),
    enabled: !!effectiveAuthUserId,
    staleTime: 5 * 60_000,
  });

  const { data: agentes = [] } = useQuery({
    queryKey: ["agentes-asignables"],
    queryFn: fetchAgentesAsignables,
    enabled: !!traspaso,
    staleTime: 5 * 60_000,
  });

  const prospectos: ProspectoRow[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = total === 0 ? 0 : (page - 1) * POR_PAGINA + 1;
  const hasta = total === 0 ? 0 : Math.min(page * POR_PAGINA, total);
  const hayFiltros = !!searchAplicado || filtroEstatus !== "all" || filtroProyecto !== "all";

  // Si un traspaso o un filtro dejó la página fuera de rango, regresar a la última válida.
  useEffect(() => {
    if (!isFetching && page > totalPaginas) setPage(totalPaginas);
  }, [isFetching, page, totalPaginas]);

  const proyectosDisponibles = useMemo(() => {
    if (facetas) {
      return facetas.map((f) => [String(f.id_proyecto ?? "null"), f.proyecto] as [string, string]);
    }
    // Sin la RPC de facetas: los desarrollos de esta página, y sin «Sin desarrollo» —
    // ese filtro viaja como centinela -1 y la versión previa de la RPC no lo entiende.
    const map = new Map<string, string>();
    prospectos.forEach((p) => p.proyectos.forEach((pr) => {
      if (pr.id_proyecto != null) map.set(String(pr.id_proyecto), pr.proyecto);
    }));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [facetas, prospectos]);

  const totalesPagina = useMemo(() => ({
    unidades: prospectos.reduce((n, p) => n + p.total_unidades, 0),
    clientes: prospectos.filter((p) => p.es_cliente).length,
  }), [prospectos]);

  const toggle = (id: number) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const cambiarEstatus = async (idEntidadRelacionada: number, valor: string) => {
    setGuardando(idEntidadRelacionada);
    try {
      const estado = catalogoEstatus.find((e) => String(e.id) === valor);
      await setLeadEstatus(idEntidadRelacionada, Number(valor), estado?.clave);
      track({ page: "agent_prospectos", elementId: "cambio_estatus_lead", metadata: { er: idEntidadRelacionada } });
      toast({ title: "Estado actualizado" });
      queryClient.invalidateQueries({ queryKey: ["agent-prospectos"] });
      queryClient.invalidateQueries({ queryKey: ["agent-prospectos-facetas"] });
    } catch (e: any) {
      toast({ title: "No se pudo actualizar el estado", description: e?.message, variant: "destructive" });
    } finally {
      setGuardando(null);
    }
  };

  const confirmarTraspaso = async () => {
    if (!traspaso || !destino) return;
    setTraspasando(true);
    try {
      await reasignarLead(traspaso.id_er, destino);
      track({ page: "agent_prospectos", elementId: "reasignar_lead", metadata: { er: traspaso.id_er } });
      toast({ title: "Prospecto transferido", description: "Ya no aparece en tu portal." });
      setTraspaso(null);
      setDestino("");
      queryClient.invalidateQueries({ queryKey: ["agent-prospectos"] });
      queryClient.invalidateQueries({ queryKey: ["agent-prospectos-facetas"] });
    } catch (e: any) {
      toast({ title: "No se pudo transferir", description: e?.message, variant: "destructive" });
    } finally {
      setTraspasando(false);
    }
  };

  const openDetalle = (id: number) => {
    track({ page: "agent_prospectos", elementId: "btn_ver_prospecto", metadata: { persona_id: id } });
    navigate(`/admin/agent/prospectos/${id}`);
  };

  return (
    <div>
      <AgentPortalHeader />

      <div className="mx-auto max-w-[1040px] pt-1 space-y-4">
        {presentationMode && (
          <div className="flex items-center gap-2.5 rounded-md border border-amber-300 bg-orange-100 px-4 py-2.5">
            <EyeOff className="h-4 w-4 shrink-0 text-orange-700" />
            <span className="text-xs font-semibold text-orange-700">
              Modo presentación · datos de prospectos ocultos. Desactívalo arriba para verlos.
            </span>
          </div>
        )}

        {impersonationIncomplete && (
          <div className="flex items-center gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5">
            <EyeOff className="h-4 w-4 shrink-0 text-amber-700" />
            <span className="text-xs font-semibold text-amber-800">
              Este usuario no tiene cuenta de acceso, así que no se puede reconstruir su vista de
              prospectos. La lista se muestra vacía a propósito: llenarla con la tuya sería enseñar
              una cartera que no es suya.
            </span>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              placeholder="Buscar por nombre, correo o teléfono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-md border-border bg-card pl-9 text-sm shadow-none focus-visible:ring-primary/25"
            />
          </div>

          <Select value={filtroEstatus} onValueChange={setFiltroEstatus}>
            <SelectTrigger className="h-10 w-[168px] rounded-md border-border bg-card text-sm shadow-none">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {catalogoEstatus.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: e.color ?? "#94a3b8" }} />
                    {e.nombre}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroProyecto} onValueChange={setFiltroProyecto}>
            <SelectTrigger className="h-10 w-[168px] rounded-md border-border bg-card text-sm shadow-none">
              <SelectValue placeholder="Desarrollo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los desarrollos</SelectItem>
              {proyectosDisponibles.map(([id, nombre]) => (
                <SelectItem key={id} value={id}>{nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {perms.canCreate && (
            <ActionButton
              icon={Plus}
              shortLabel="Nuevo"
              className="shrink-0"
              onClick={() => {
                track({ page: "agent_prospectos", elementId: "btn_nuevo_prospecto" });
                setEditPersonaId(null);
                setAddProspectoOpen(true);
              }}
            >
              Nuevo prospecto
            </ActionButton>
          )}
        </div>

        {!isLoading && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            {total.toLocaleString()} {total === 1 ? "prospecto" : "prospectos"}
            {hayFiltros ? " con este filtro" : ""}
            {prospectos.length > 0 && (
              <> · en esta página {totalesPagina.unidades} unidades · {totalesPagina.clientes} con compra</>
            )}
            {isFetching && <Loader2 className="ml-2 inline size-3 animate-spin align-[-1px]" />}
          </p>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
          </div>
        ) : prospectos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-6 w-6 text-primary" />
            </span>
            <p className="text-sm text-muted-foreground">
              {hayFiltros ? "No se encontraron prospectos" : "Aún no tienes prospectos"}
            </p>
            {!search && perms.canCreate && (
              <ActionButton icon={Plus} size="sm" onClick={() => { setEditPersonaId(null); setAddProspectoOpen(true); }}>
                Crear tu primer prospecto
              </ActionButton>
            )}
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] table-fixed text-sm whitespace-nowrap">
                <thead className="sozu-thead [&_th]:uppercase [&_th]:tracking-wide [&_th]:px-3">
                  <tr>
                    <th className="w-[40px]" aria-label="Desplegar" />
                    <th className="w-[220px] text-left">Prospecto</th>
                    <th className="w-[200px] text-left">Contacto</th>
                    <th className="w-[180px] text-left">Desarrollos</th>
                    <th className="w-[92px] text-center">Unidades</th>
                    <th className="w-[168px] text-center">Estado</th>
                    <th className="w-[72px] pr-4" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {prospectos.map((p) => {
                    const abierto = expandidos.has(p.id_persona);
                    const unico = p.proyectos.length === 1 ? p.proyectos[0] : null;
                    const desarrollos = p.proyectos.map((pr) => pr.proyecto).join(" · ");
                    return (
                      <Fragment key={p.id_persona}>
                        <tr
                          className="h-[48px] cursor-pointer border-b border-border/50 transition-colors duration-100 hover:bg-muted/20"
                          onClick={() => toggle(p.id_persona)}
                        >
                          <td className="pl-3 pr-0">
                            {abierto
                              ? <ChevronDown className="size-4 text-muted-foreground" />
                              : <ChevronRight className="size-4 text-muted-foreground" />}
                          </td>
                          <td className="px-3 text-left">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-[13px] font-semibold text-foreground">{mask(p.nombre)}</p>
                              {p.es_cliente && (
                                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                  Cliente
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 text-left">
                            <p className="truncate text-[12px] text-foreground">{mask(p.email ?? "—")}</p>
                            <p className="truncate text-[10px] tabular-nums text-muted-foreground">{mask(p.telefono ?? "—")}</p>
                          </td>
                          <td className="px-3 text-left">
                            <p className="truncate text-[12px] text-muted-foreground">{desarrollos || "Sin desarrollo"}</p>
                          </td>
                          <td className="px-3 text-center">
                            <span className="text-[12px] font-semibold tabular-nums">{p.total_unidades || "—"}</span>
                          </td>
                          <td className="px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {unico ? (
                              <Select
                                value={unico.id_estatus_lead ? String(unico.id_estatus_lead) : undefined}
                                onValueChange={(v) => cambiarEstatus(unico.id_entidad_relacionada, v)}
                                disabled={guardando === unico.id_entidad_relacionada}
                              >
                                <SelectTrigger className="h-8 rounded-md border-border bg-card text-[12px] shadow-none">
                                  <SelectValue placeholder={unico.estatus ?? "Sin estado"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {catalogoEstatus.map((e) => (
                                    <SelectItem key={e.id} value={String(e.id)}>
                                      <span className="inline-flex items-center gap-2">
                                        <span className="size-2 shrink-0 rounded-full" style={{ background: e.color ?? "#94a3b8" }} />
                                        {e.nombre}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/70">{p.proyectos.length} desarrollos</span>
                            )}
                          </td>
                          <td className="px-2 pr-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end">
                              <IconTip label="Ver ficha del prospecto">
                                <button
                                  onClick={() => openDetalle(p.id_persona)}
                                  className="rounded p-1.5 text-foreground transition-colors hover:bg-muted"
                                >
                                  <Eye className="size-4" />
                                </button>
                              </IconTip>
                            </div>
                          </td>
                        </tr>

                        {abierto && (
                          <tr className="border-b border-border/50 bg-muted/20">
                            <td />
                            <td colSpan={6} className="px-3 py-3">
                              <div className="space-y-2.5">
                                {p.proyectos.map((pr) => (
                                  <div key={pr.id_entidad_relacionada} className="rounded-lg border bg-card">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                                      <span className="truncate text-[12px] font-semibold text-foreground">{pr.proyecto}</span>
                                      <div className="flex items-center gap-1.5">
                                        <IconTip label="Transferir este prospecto a otro agente. Dejarás de verlo en tu portal.">
                                          <button
                                            onClick={() => {
                                              setDestino("");
                                              setTraspaso({ id_er: pr.id_entidad_relacionada, proyecto: pr.proyecto, persona: p.nombre });
                                            }}
                                            className="rounded p-1.5 text-foreground transition-colors hover:bg-muted"
                                          >
                                            <ArrowLeftRight className="size-4" />
                                          </button>
                                        </IconTip>
                                        <Select
                                          value={pr.id_estatus_lead ? String(pr.id_estatus_lead) : undefined}
                                          onValueChange={(v) => cambiarEstatus(pr.id_entidad_relacionada, v)}
                                          disabled={guardando === pr.id_entidad_relacionada}
                                        >
                                          <SelectTrigger className="h-8 w-[168px] rounded-md border-border bg-card text-[12px] shadow-none">
                                            <SelectValue placeholder={pr.estatus ?? "Sin estado"} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {catalogoEstatus.map((e) => (
                                              <SelectItem key={e.id} value={String(e.id)}>
                                                <span className="inline-flex items-center gap-2">
                                                  <span className="size-2 shrink-0 rounded-full" style={{ background: e.color ?? "#94a3b8" }} />
                                                  {e.nombre}
                                                </span>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>

                                    {pr.unidades.length === 0 ? (
                                      <p className="px-3 py-2.5 text-[11px] text-muted-foreground">
                                        Sin unidades. Genera una oferta para abrir el negocio.
                                      </p>
                                    ) : (
                                      <table className="w-full table-fixed text-sm whitespace-nowrap">
                                        <tbody>
                                          {pr.unidades.map((u) => {
                                            const def = etapaDef(u.etapa);
                                            return (
                                              <tr key={`${u.id_negocio ?? u.id_oferta}`} className="border-b border-border/40 last:border-0">
                                                <td className="w-[170px] px-3 py-2 text-left">
                                                  <span className="truncate text-[12px] font-semibold text-foreground">{u.unidad}</span>
                                                </td>
                                                <td className="w-[110px] px-3 py-2 text-center">
                                                  <span className={cn(
                                                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                                    u.tipo === "Propiedad"
                                                      ? "bg-muted text-muted-foreground ring-1 ring-border/60"
                                                      : "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
                                                  )}>
                                                    {u.tipo}
                                                  </span>
                                                </td>
                                                <td className="w-[150px] px-3 py-2 text-center">
                                                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", def.chip)}>
                                                    {def.label}
                                                  </span>
                                                </td>
                                                <td className="w-[110px] px-3 py-2 text-center">
                                                  {u.ofertas_count > 1 && (
                                                    <IconTip label={`${u.ofertas_count} ofertas sobre esta unidad (recotizaciones con distinto esquema de pago). Se muestra la más avanzada.`}>
                                                      <span className="inline-flex cursor-default items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border/60">
                                                        {u.ofertas_count} ofertas
                                                      </span>
                                                    </IconTip>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  <span className="text-[12px] font-semibold tabular-nums">{mask(fmtCurrency(u.valor))}</span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <SimplePagination
              page={page}
              totalPages={totalPaginas}
              onPageChange={(p) => {
                setPage(p);
                setExpandidos(new Set());
                track({ page: "agent_prospectos", elementId: "paginacion", metadata: { pagina: p } });
              }}
              total={total}
              from={desde}
              to={hasta}
            />
          </div>
        )}

        {!isLoading && prospectos.length > 0 && data?.viaRpc === false && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <Users className="size-3.5" />
            Leyendo del modelo de transición (dueño por agente + atribución del CRM).
          </p>
        )}
      </div>

      {/* Traspaso de prospecto a otro agente */}
      <Dialog open={!!traspaso} onOpenChange={(v) => { if (!v) { setTraspaso(null); setDestino(""); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Transferir prospecto</DialogTitle>
            <DialogDescription>
              {traspaso && (
                <>
                  <span className="font-medium text-foreground">{traspaso.persona}</span> en{" "}
                  <span className="font-medium text-foreground">{traspaso.proyecto}</span>. Al transferirlo
                  dejarás de verlo en tu portal y queda registro del traspaso.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <Select value={destino} onValueChange={setDestino}>
            <SelectTrigger className="h-10 rounded-md border-border bg-card text-sm shadow-none">
              <SelectValue placeholder="Elige al agente destino" />
            </SelectTrigger>
            <SelectContent className="max-h-[280px]">
              {agentes.map((a) => (
                <SelectItem key={a.auth_user_id} value={a.auth_user_id}>
                  {a.nombre}{a.rol ? ` · ${a.rol}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setTraspaso(null); setDestino(""); }}>Cancelar</Button>
            <Button onClick={confirmarTraspaso} disabled={!destino || traspasando}>
              {traspasando && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddProspectoFloatingDialog
        open={addProspectoOpen}
        onOpenChange={(v) => {
          setAddProspectoOpen(v);
          if (!v) {
            setEditPersonaId(null);
            queryClient.invalidateQueries({ queryKey: ["agent-prospectos"] });
            queryClient.invalidateQueries({ queryKey: ["agent-prospectos-facetas"] });
          }
        }}
        preSelectedPersonaId={editPersonaId}
      />
    </div>
  );
};

export default AgentProspectos;
