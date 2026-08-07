import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ModalFormHeader,
  FIELD_LABEL_CLS,
  Req,
  SECTION_CLS,
  SEG_TRACK_CLS,
  segBtnCls,
  MODAL_BODY_CLS,
  MODAL_FOOTER_CLS,
} from "@/components/ui/modal-form";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useCtaTracker } from "@/hooks/useCtaTracker";

interface AddProspectoFloatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedPersonaId?: number | null;
}

interface ProspectoRelacion {
  entidad_relacionada_id: number;
  id_proyecto: number;
  proyecto_nombre: string;
}

/** Lada del teléfono. Lista corta → el selector la pinta sin buscador. */
const CLAVE_PAIS_OPTIONS: SearchableOption[] = [
  { value: "MX", label: "MX" },
  { value: "US", label: "US" },
  { value: "CO", label: "CO" },
];

export function AddProspectoFloatingDialog({ open, onOpenChange, preSelectedPersonaId }: AddProspectoFloatingDialogProps) {
  const { profile } = useAuth();
  const { impersonatedAgentPersonaId, isImpersonating } = useAgentImpersonation();
  const effectivePersonaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const queryClient = useQueryClient();
  const { accessibleProjectIds, hasUnrestrictedAccess, isLoading: isLoadingAccess } = useProjectAccess();
  const { track } = useCtaTracker();
  const hasTrackedFieldFill = useRef(false);

  const [selectedProspectoId, setSelectedProspectoId] = useState<number | null>(null);
  const [selectedProyectoIds, setSelectedProyectoIds] = useState<number[]>([]);
  const [tipoPersona, setTipoPersona] = useState("pf");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clavePais, setClavePais] = useState("MX");
  const [telefono, setTelefono] = useState("");
  const [rfc, setRfc] = useState("");
  const [curp, setCurp] = useState("");
  // Projects assigned to the selected prospect in edit mode
  const [editProyectos, setEditProyectos] = useState<ProspectoRelacion[]>([]);
  const hasAppliedPreselect = useRef(false);
  // When an existing persona is found by email (not in agent's prospects)
  const [existingPersonaId, setExistingPersonaId] = useState<number | null>(null);
  const emailLookupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch agent's existing prospects (grouped by persona)
  const { data: misProspectos = [] } = useQuery({
    queryKey: ["mis-prospectos-floating", profile?.id_persona],
    queryFn: async () => {
      if (!profile?.id_persona) return [];
      const { data, error } = await supabase
        .from("entidades_relacionadas")
        .select(`
          id,
          id_persona,
          id_proyecto,
          personas!entidades_relacionadas_id_persona_fkey (
            id, nombre_legal, email, telefono, clave_pais_telefono, tipo_persona, rfc, curp
          ),
          proyectos!entidades_relacionadas_id_proyecto_fkey (
            id, nombre
          )
        `)
        .eq("id_tipo_entidad", 7)
        .eq("activo", true)
        .eq("id_persona_duena_lead", effectivePersonaId!);

      if (error) throw error;
      return (data || [])
        .filter((er: any) => er.personas)
        .map((er: any) => ({
          entidad_relacionada_id: er.id,
          id_persona: er.personas.id,
          nombre_legal: er.personas.nombre_legal || "",
          email: er.personas.email || "",
          telefono: er.personas.telefono || "",
          clave_pais_telefono: er.personas.clave_pais_telefono || "MX",
          tipo_persona: er.personas.tipo_persona || "pf",
          rfc: er.personas.rfc || "",
          curp: er.personas.curp || "",
          id_proyecto: er.id_proyecto,
          proyecto_nombre: er.proyectos?.nombre || "",
        }));
    },
    enabled: open && !!effectivePersonaId,
  });

  // Fetch project names for assigned projects
  const assignedProjectIds = useMemo(() => {
    return [...new Set(misProspectos.map((p) => p.id_proyecto).filter(Boolean))] as number[];
  }, [misProspectos]);

  const { data: projectNamesMap = new Map<number, string>() } = useQuery({
    queryKey: ["project-names-floating", assignedProjectIds],
    queryFn: async () => {
      if (assignedProjectIds.length === 0) return new Map<number, string>();
      const { data } = await supabase
        .from("proyectos")
        .select("id, nombre")
        .in("id", assignedProjectIds);
      const m = new Map<number, string>();
      (data || []).forEach((p: any) => m.set(p.id, p.nombre));
      return m;
    },
    enabled: assignedProjectIds.length > 0,
  });

  const prospectoOptions = useMemo(() => {
    const seen = new Set<number>();
    return misProspectos
      .filter((p) => { if (seen.has(p.id_persona)) return false; seen.add(p.id_persona); return true; })
      .map((p) => ({ value: p.id_persona.toString(), label: p.nombre_legal || p.email }));
  }, [misProspectos]);

  const handleSelectProspecto = (value: string) => {
    if (!value) {
      setSelectedProspectoId(null);
      setEditProyectos([]);
      return;
    }
    const id = parseInt(value);
    // Get all relations for this persona
    const relations = misProspectos.filter((p) => p.id_persona === id);
    const firstRelation = relations[0];
    if (firstRelation) {
      setSelectedProspectoId(id);
      setNombre(firstRelation.nombre_legal);
      setEmail(firstRelation.email);
      setTelefono(firstRelation.telefono);
      setClavePais(firstRelation.clave_pais_telefono);
      setTipoPersona(firstRelation.tipo_persona);
      setRfc(firstRelation.rfc);
      setCurp(firstRelation.curp);

      // Collect all assigned projects
      const proyectos: ProspectoRelacion[] = relations
        .filter((r) => r.id_proyecto)
        .map((r: any) => ({
          entidad_relacionada_id: r.entidad_relacionada_id,
          id_proyecto: r.id_proyecto,
          proyecto_nombre: r.proyecto_nombre || projectNamesMap.get(r.id_proyecto) || `Proyecto ${r.id_proyecto}`,
        }))
        // Deduplicate
        .filter((p, idx, arr) => arr.findIndex((x) => x.id_proyecto === p.id_proyecto) === idx);

      setEditProyectos(proyectos);
      setSelectedProyectoIds([]); // Clear new-mode selections
    }
  };

  const isEditMode = selectedProspectoId !== null;

  // Auto-select prospect when preSelectedPersonaId is provided
  useEffect(() => {
    if (open && preSelectedPersonaId && misProspectos.length > 0 && !hasAppliedPreselect.current) {
      hasAppliedPreselect.current = true;
      handleSelectProspecto(preSelectedPersonaId.toString());
    }
    if (!open) {
      hasAppliedPreselect.current = false;
    }
  }, [open, preSelectedPersonaId, misProspectos]);

  // Un agente solo ve los desarrollos ASIGNADOS a él (un prospecto solo puede
  // interesarse en lo que el agente maneja). Excepción: usuarios con acceso
  // irrestricto (Super Admin / Admin de Proyecto / ver_todos_proyectos) ven el
  // catálogo completo de proyectos activos, porque administran todo.
  const { data: proyectos = [] } = useQuery({
    queryKey: ["desarrollos-activos-floating", hasUnrestrictedAccess, accessibleProjectIds],
    queryFn: async () => {
      if (!hasUnrestrictedAccess && accessibleProjectIds.length === 0) return [];
      let query = supabase
        .from("proyectos")
        .select("id, nombre")
        .eq("activo", true);
      if (!hasUnrestrictedAccess) {
        query = query.in("id", accessibleProjectIds);
      }
      const { data, error } = await query.order("nombre");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !isLoadingAccess,
  });

  // Fetch project assignments for a persona found via email lookup (may not be in agent's prospects)
  const { data: existingPersonaProjectIds = new Set<number>() } = useQuery({
    queryKey: ["existing-persona-projects", existingPersonaId],
    queryFn: async () => {
      if (!existingPersonaId) return new Set<number>();
      const { data, error } = await supabase
        .from("entidades_relacionadas")
        .select("id_proyecto")
        .eq("id_persona", existingPersonaId)
        .eq("id_tipo_entidad", 7)
        .eq("activo", true);
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.id_proyecto).filter(Boolean) as number[]);
    },
    enabled: open && !!existingPersonaId,
  });

  // Add project to existing prospect
  const addProjectToProspectMutation = useMutation({
    mutationFn: async ({ personaId, proyectoId: projId }: { personaId: number; proyectoId: number }) => {
      // Use SECURITY DEFINER RPC to bypass RLS restrictions when the row
      // is owned by another agent or hidden by RLS policies
      const { data, error } = await supabase.rpc("agent_claim_or_reactivate_prospect_project", {
        _persona_id: personaId,
        _proyecto_id: projId,
        _owner_persona_id: effectivePersonaId ?? undefined,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mis-prospectos-floating"] });
      queryClient.invalidateQueries({ queryKey: ["prospecto-active-projects-floating"] });
      queryClient.invalidateQueries({ queryKey: ["prospectos"] });
      queryClient.invalidateQueries({ queryKey: ["inmob-prospectos"] });
      queryClient.invalidateQueries({ queryKey: ["mis-prospectos-showroom"] });
      queryClient.invalidateQueries({ queryKey: ["agent-prospectos"] });
      toast.success("Proyecto agregado al prospecto");
      // Optimistically add to local state
      const proj = proyectos.find(p => p.id === variables.proyectoId);
      if (proj) {
        setEditProyectos(prev => prev.some((p) => p.id_proyecto === proj.id) ? prev : [...prev, {
          entidad_relacionada_id: Date.now(), // temporary ID until refetch
          id_proyecto: proj.id,
          proyecto_nombre: proj.nombre,
        }]);
      }
    },
    onError: (error: any) => {
      if (error.message?.includes("uq_entrel_persona_tipo_proy")) {
        toast.error("Este proyecto ya está asignado al prospecto.");
      } else {
        toast.error("Error al agregar proyecto: " + error.message);
      }
    },
  });

  // Remove project from prospect
  const removeProjectFromProspectMutation = useMutation({
    mutationFn: async (entidadRelacionadaId: number) => {
      const { error } = await supabase
        .from("entidades_relacionadas")
        .update({ activo: false })
        .eq("id", entidadRelacionadaId);
      if (error) throw error;
    },
    onSuccess: (_data, removedId) => {
      queryClient.invalidateQueries({ queryKey: ["mis-prospectos-floating"] });
      queryClient.invalidateQueries({ queryKey: ["prospecto-active-projects-floating"] });
      queryClient.invalidateQueries({ queryKey: ["prospectos"] });
      queryClient.invalidateQueries({ queryKey: ["inmob-prospectos"] });
      queryClient.invalidateQueries({ queryKey: ["mis-prospectos-showroom"] });
      queryClient.invalidateQueries({ queryKey: ["agent-prospectos"] });
      toast.success("Proyecto removido del prospecto");
    },
    onError: (error: any) => {
      toast.error("Error al remover proyecto: " + error.message);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!nombre || !email || !telefono) {
        throw new Error("Completa los campos obligatorios");
      }
      if (!/^\d{10}$/.test(telefono)) {
        throw new Error("El teléfono debe tener exactamente 10 dígitos numéricos");
      }

      if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
        throw new Error("El RFC no tiene un formato válido. Debe ser de 12 caracteres para persona moral o 13 para persona física (Ej: ABC123456DEF o ABCD123456EF1)");
      }

      if (curp && !/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(curp)) {
        throw new Error("La CURP no tiene un formato válido. Debe tener 18 caracteres alfanuméricos (Ej: ABCD123456HMNEFD01)");
      }

      // El prospecto debe quedar ligado a un agente dueño. Sin persona de agente
      // (ej. Super Admin sin id_persona) se crearía huérfano/invisible → error explícito.
      if (!isEditMode && !effectivePersonaId) {
        throw new Error("Tu usuario no tiene un perfil de agente asociado, no puedes crear prospectos.");
      }

      if (isEditMode && selectedProspectoId) {
        // Update existing persona
        const { error: updateError } = await supabase
          .from("personas")
          .update({
            tipo_persona: tipoPersona,
            nombre_legal: nombre,
            email,
            telefono,
            clave_pais_telefono: clavePais,
            rfc: rfc || null,
            curp: curp || null,
          })
          .eq("id", selectedProspectoId);

        if (updateError) throw updateError;
      } else {
        // Validate projects for new prospect
        if (selectedProyectoIds.length === 0) {
          throw new Error("Selecciona al menos un desarrollo de interés");
        }

        let personaId: number;

        if (existingPersonaId) {
          // Reuse existing persona – update their info
          personaId = existingPersonaId;
          await supabase
            .from("personas")
            .update({
              tipo_persona: tipoPersona,
              nombre_legal: nombre,
              telefono,
              clave_pais_telefono: clavePais,
              rfc: rfc || null,
              curp: curp || null,
            })
            .eq("id", personaId);
        } else {
          // Create new persona
          const { data: persona, error: personaError } = await supabase
            .from("personas")
            .insert([{
              tipo_persona: tipoPersona,
              nombre_legal: nombre,
              email,
              telefono,
              clave_pais_telefono: clavePais,
              rfc: rfc || null,
              curp: curp || null,
              activo: true,
            }])
            .select()
            .single();

          if (personaError) throw personaError;
          personaId = persona.id;
        }

        // Una entidad_relacionada por desarrollo. Se usa el RPC de la base, que **reclama o
        // reactiva** en vez de insertar a ciegas: si el prospecto ya tuvo interés en ese
        // desarrollo (aunque esté inactivo) lo reactiva y le pone dueño, en lugar de crear un
        // segundo registro. Así el prospecto queda registrado UNA sola vez por desarrollo.
        // La fila de crm_leads_atribucion (dueño + estado) la crea el trigger de la base.
        for (const projId of selectedProyectoIds) {
          const rpc = await (supabase as any).rpc("agent_claim_or_reactivate_prospect_project", {
            _persona_id: personaId,
            _proyecto_id: projId,
            _owner_persona_id: effectivePersonaId ?? undefined,
          } as any);
          if (!rpc.error) continue;

          // Respaldo: si el RPC no existe o rechaza el tercer argumento, se inserta directo.
          const { error: entidadError } = await supabase
            .from("entidades_relacionadas")
            .insert([{
              id_persona: personaId,
              id_tipo_entidad: 7,
              id_proyecto: projId,
              id_persona_duena_lead: effectivePersonaId || null,
              activo: true,
            }]);
          if (entidadError) throw entidadError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospectos"] });
      queryClient.invalidateQueries({ queryKey: ["mis-prospectos-floating"] });
      queryClient.invalidateQueries({ queryKey: ["inmob-prospectos"] });
      queryClient.invalidateQueries({ queryKey: ["agent-prospectos"] });
      toast.success(isEditMode ? "Prospecto actualizado exitosamente" : "Prospecto creado exitosamente");
      handleClose();
    },
    onError: (error: any) => {
      const msg = error.message || "Ocurrió un error inesperado";
      if (msg.includes("uq_entrel_persona_tipo_proy") || (error.code === "23505" && msg.includes("entrel"))) {
        toast.error("Este prospecto ya tiene interés registrado en uno o más de los desarrollos seleccionados. Revisa los desarrollos e intenta de nuevo.");
      } else if (msg.includes("personas_rfc_key") || msg.includes("duplicate") && msg.includes("rfc")) {
        toast.error("El RFC ingresado ya está registrado en el sistema. Por favor, verifica e ingresa un RFC diferente.");
      } else if (msg.includes("personas_curp_key") || msg.includes("duplicate") && msg.includes("curp")) {
        toast.error("La CURP ingresada ya está registrada en el sistema. Por favor, verifica e ingresa una CURP diferente.");
      } else if (msg.includes("personas_email_key") || msg.includes("duplicate") && msg.includes("email")) {
        toast.error("El email ingresado ya está registrado en el sistema. Por favor, verifica e ingresa un email diferente.");
      } else if (msg.includes("RFC") || msg.includes("CURP") || msg.includes("teléfono") || msg.includes("obligatorios") || msg.includes("agente")) {
        toast.error(msg);
      } else {
        toast.error("No se pudo guardar el prospecto. Verifica los datos e intenta de nuevo.");
      }
    },
  });

  const trackFieldFill = () => {
    if (!hasTrackedFieldFill.current) {
      hasTrackedFieldFill.current = true;
      track({ page: "modal_prospecto", elementId: "modal_prospecto_campo_llenado" });
    }
  };

  // Lookup persona by email when not in edit mode
  const handleEmailChange = (newEmail: string) => {
    setEmail(newEmail);
    trackFieldFill();
    setExistingPersonaId(null);

    if (emailLookupTimeout.current) clearTimeout(emailLookupTimeout.current);
    if (!newEmail || isEditMode) return;

    emailLookupTimeout.current = setTimeout(async () => {
      const trimmed = newEmail.trim().toLowerCase();
      if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) return;

      const { data } = await supabase
        .from("personas")
        .select("id, nombre_legal, email, telefono, clave_pais_telefono, tipo_persona, rfc, curp")
        .eq("email", trimmed)
        .eq("activo", true)
        .limit(1)
        .single();

      if (data) {
        setExistingPersonaId(data.id);
        setNombre(data.nombre_legal || "");
        setTelefono(data.telefono || "");
        setClavePais(data.clave_pais_telefono || "MX");
        setTipoPersona(data.tipo_persona || "pf");
        setRfc(data.rfc || "");
        setCurp(data.curp || "");
        toast.info("Esta persona ya existe en el sistema. Se vincularán sus datos al nuevo prospecto.");
      }
    }, 600);
  };

  const handleClose = () => {
    setSelectedProspectoId(null);
    setSelectedProyectoIds([]);
    setTipoPersona("pf");
    setNombre("");
    setEmail("");
    setClavePais("MX");
    setTelefono("");
    setRfc("");
    setCurp("");
    setEditProyectos([]);
    setExistingPersonaId(null);
    hasTrackedFieldFill.current = false;
    onOpenChange(false);
  };

  // Estilos del estándar: viven en ui/modal-form (fuente única del portal).
  const labelCls = FIELD_LABEL_CLS;
  const labelBoldCls = cn(FIELD_LABEL_CLS, "mb-2");
  const rfcInvalid = !!rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc);
  const curpInvalid = !!curp && !/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(curp);

  const selectedProyectosList: { id: number; nombre: string; relId: number | null }[] = isEditMode
    ? editProyectos.map((e) => ({ id: e.id_proyecto, nombre: e.proyecto_nombre, relId: e.entidad_relacionada_id }))
    : selectedProyectoIds.map((id) => ({ id, nombre: proyectos.find((p) => p.id === id)?.nombre || `Proyecto ${id}`, relId: null }));

  /**
   * Opciones del selector de desarrollos: se excluyen los ya elegidos (viven como
   * pastillas arriba) y, en alta, los que la persona ya tiene registrados salen
   * deshabilitados con la nota "Ya registrado" — igual que antes, para que se
   * entienda por qué no se pueden volver a agregar.
   */
  const proyectoPickerOptions = useMemo<SearchableOption[]>(() => {
    const selectedIds = new Set(isEditMode ? editProyectos.map((e) => e.id_proyecto) : selectedProyectoIds);
    return proyectos
      .filter((p) => !selectedIds.has(p.id))
      .map((p) => {
        const already = !isEditMode && existingPersonaProjectIds.has(p.id);
        return {
          value: p.id.toString(),
          label: p.nombre || `Proyecto ${p.id}`,
          hint: already ? "Ya registrado" : undefined,
          disabled: already,
        };
      });
  }, [proyectos, isEditMode, editProyectos, selectedProyectoIds, existingPersonaProjectIds]);

  /** Agrega un desarrollo: en edición persiste de inmediato; en alta acumula local. */
  const addProyectoInteres = (proyectoId: number) => {
    if (isEditMode) {
      if (selectedProspectoId) addProjectToProspectMutation.mutate({ personaId: selectedProspectoId, proyectoId });
      return;
    }
    setSelectedProyectoIds((prev) => (prev.includes(proyectoId) ? prev : [...prev, proyectoId]));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[540px] gap-0 overflow-hidden rounded-md p-0"
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
      >
        <ModalFormHeader title={isEditMode ? "Editar Prospecto" : "Nuevo Prospecto"} />

        <div className={cn(MODAL_BODY_CLS, "max-h-[calc(90vh-9rem)]")}>
          {/* Search / pick existing prospect */}
          <div>
            <div className={labelBoldCls}>¿Ya lo tienes registrado? Búscalo para no duplicar</div>
            {/* Un solo componente: con pocos prospectos se comporta como select,
                con muchos saca el buscador. */}
            <SearchableSelect
              value={selectedProspectoId?.toString() || ""}
              onValueChange={handleSelectProspecto}
              options={prospectoOptions}
              placeholder="Buscar por nombre…"
              searchPlaceholder="Escribir nombre del prospecto…"
              itemsLabel="prospectos"
            />
          </div>

          {/* Desarrollos de interés - búsqueda + lista */}
          <div>
            <div className={labelBoldCls}>
              Desarrollos de Interés {!isEditMode && <Req />}
            </div>

            {/* Seleccionados */}
            {selectedProyectosList.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedProyectosList.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    {s.nombre}
                    {(!isEditMode || editProyectos.length > 1) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditMode) {
                            if (s.relId != null) {
                              setEditProyectos((prev) => prev.filter((x) => x.entidad_relacionada_id !== s.relId));
                              removeProjectFromProspectMutation.mutate(s.relId);
                            }
                          } else {
                            setSelectedProyectoIds((prev) => prev.filter((id) => id !== s.id));
                          }
                        }}
                        className="rounded p-0.5 text-primary/70 hover:bg-primary/10 hover:text-primary"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Selector de desarrollos: se agregan de uno en uno y se quitan desde
                las pastillas de arriba, así que el disparador siempre queda vacío
                (`value=""`) y actúa como "agregar". */}
            <SearchableSelect
              value=""
              onValueChange={(id) => addProyectoInteres(Number(id))}
              options={proyectoPickerOptions}
              placeholder="Buscar desarrollo…"
              searchPlaceholder="Buscar desarrollo…"
              itemsLabel="desarrollos"
              disabled={isEditMode && addProjectToProspectMutation.isPending}
              aria-label="Desarrollos de interés"
            />
          </div>

          {/* Datos de la persona (separador, sin título: los campos se explican solos) */}
          <div className={SECTION_CLS}>
            <div className="flex flex-col gap-3">
              {/* Tipo de persona - segmented */}
              <div>
                <div className={labelCls}>Tipo de Persona <Req /></div>
                <div className={cn(SEG_TRACK_CLS, "max-w-60")}>
                  {[{ v: "pf", l: "Física" }, { v: "pm", l: "Moral" }].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setTipoPersona(o.v)}
                      className={segBtnCls(tipoPersona === o.v)}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre */}
              <div>
                <div className={labelCls}>Nombre Completo <Req /></div>
                <Input
                  placeholder="Juan Pérez García"
                  value={nombre}
                  onChange={(e) => { setNombre(e.target.value); trackFieldFill(); }}
                />
              </div>

              {/* Email + Teléfono */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className={labelCls}>Email <Req /></div>
                  <Input
                    type="email"
                    placeholder="juan.perez@correo.com"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    disabled={isEditMode && !!selectedProspectoId}
                  />
                  {existingPersonaId && !isEditMode && (
                    <p className="mt-1 text-xs font-medium text-blue-600">✓ Persona existente - se vinculará al prospecto</p>
                  )}
                </div>
                <div>
                  <div className={labelCls}>Teléfono <Req /> (+52)</div>
                  <div className="flex gap-2">
                    <SearchableSelect
                      value={clavePais}
                      onValueChange={setClavePais}
                      options={CLAVE_PAIS_OPTIONS}
                      className="w-20 shrink-0"
                      contentClassName="min-w-[120px]"
                      aria-label="Clave de país"
                    />
                    <Input
                      className="tabular-nums"
                      inputMode="numeric"
                      placeholder="5512345678"
                      value={telefono}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 10); setTelefono(v); trackFieldFill(); }}
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              {/* RFC + CURP */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className={labelCls}>RFC</div>
                  <Input
                    className={cn("uppercase", rfcInvalid && "border-red-400 focus-visible:border-red-400 focus-visible:ring-red-400/15")}
                    placeholder="PEGJ850101H2A"
                    value={rfc}
                    onChange={(e) => setRfc(e.target.value.toUpperCase())}
                    maxLength={13}
                  />
                  {rfcInvalid && <p className="mt-1 text-xs text-red-500">Formato inválido (12-13 caracteres)</p>}
                </div>
                <div>
                  <div className={labelCls}>CURP</div>
                  <Input
                    className={cn("uppercase", curpInvalid && "border-red-400 focus-visible:border-red-400 focus-visible:ring-red-400/15")}
                    placeholder="PEGJ850101HDFRRN09"
                    value={curp}
                    onChange={(e) => setCurp(e.target.value.toUpperCase())}
                    maxLength={18}
                  />
                  {curpInvalid && <p className="mt-1 text-xs text-red-500">Formato inválido (18 caracteres)</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={MODAL_FOOTER_CLS}>
          <Button type="button" variant="cancel" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary-outline"
            onClick={() => { track({ page: "modal_prospecto", elementId: "modal_prospecto_guardar" }); createMutation.mutate(); }}
            disabled={createMutation.isPending || (!isEditMode && selectedProyectoIds.length === 0) || !nombre || !email || !telefono}
          > {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : isEditMode ? "Actualizar" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
