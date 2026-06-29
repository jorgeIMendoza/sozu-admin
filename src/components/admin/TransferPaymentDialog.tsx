import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { AlertTriangle, User, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useActivityLogger } from "@/hooks/useActivityLogger";

interface TransferPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cuentaOrigenId: number;
  ultimoPagoSTP: {
    id: number;
    clave_rastreo: string;
    monto: number;
  } | null;
}

interface PagadorInfo {
  nombre_ordenante: string;
  rfc_curp_ordenante: string;
}

interface CuentaDestino {
  id: number;
  numero_propiedad: string;
  proyecto: string;
  edificio: string;
}

export function TransferPaymentDialog({
  isOpen,
  onClose,
  cuentaOrigenId,
  ultimoPagoSTP
}: TransferPaymentDialogProps) {
  const [pagadorInfo, setPagadorInfo] = useState<PagadorInfo | null>(null);
  const [cuentasDestino, setCuentasDestino] = useState<CuentaDestino[]>([]);
  const [cuentaDestinoSeleccionada, setCuentaDestinoSeleccionada] = useState<string>("");
  const [openCombobox, setOpenCombobox] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { registrarActualizacion } = useActivityLogger();

  useEffect(() => {
    if (isOpen && ultimoPagoSTP?.clave_rastreo) {
      fetchPagadorInfo();
    } else if (!isOpen) {
      // Reset state when dialog closes
      setPagadorInfo(null);
      setCuentasDestino([]);
      setCuentaDestinoSeleccionada("");
      setOpenCombobox(false);
      setLoading(false);
    }
  }, [isOpen, ultimoPagoSTP?.clave_rastreo]);

  const fetchPagadorInfo = async () => {
    if (!ultimoPagoSTP?.clave_rastreo) return;

    try {
      setLoading(true);

      // Obtener info del pagador desde pagos_stp_raw
      const { data: stpData, error: stpError } = await supabase
        .from('pagos_stp_raw')
        .select('nombre_ordenante, rfc_curp_ordenante')
        .eq('claverastreo', ultimoPagoSTP.clave_rastreo)
        .single();

      if (stpError) {
        console.error('Error fetching STP data:', stpError);
        toast({
          title: "Error",
          description: "No se pudo obtener información del pagador",
          variant: "destructive",
        });
        return;
      }

      setPagadorInfo(stpData);

      // Buscar personas con ese RFC/CURP
      const { data: personas, error: personasError } = await supabase
        .from('personas')
        .select('id')
        .or(`rfc.eq.${stpData.rfc_curp_ordenante},curp.eq.${stpData.rfc_curp_ordenante}`)
        .eq('activo', true);

      if (personasError || !personas || personas.length === 0) {
        toast({
          title: "Información",
          description: "No se encontró persona con ese RFC/CURP",
        });
        setCuentasDestino([]);
        return;
      }

      const personaIds = personas.map(p => p.id);

      // Buscar si es comprador en otras cuentas activas
      const { data: compradores, error: compradoresError } = await supabase
        .from('compradores')
        .select(`
          id_cuenta_cobranza
        `)
        .in('id_persona', personaIds)
        .eq('activo', true)
        .neq('id_cuenta_cobranza', cuentaOrigenId);

      if (compradoresError) {
        console.error('Error fetching compradores:', compradoresError);
        toast({
          title: "Error",
          description: "No se pudo buscar cuentas del comprador",
          variant: "destructive",
        });
        return;
      }

      if (!compradores || compradores.length === 0) {
        toast({
          title: "Información",
          description: "No se encontraron otras cuentas de cobranza para este comprador",
        });
        setCuentasDestino([]);
        return;
      }

      // Obtener detalles de las cuentas de cobranza
      const cuentaIds = compradores.map(c => c.id_cuenta_cobranza);
      
      const { data: cuentasDetalles } = await supabase
        .from('cuentas_cobranza')
        .select(`
          id,
          activo,
          id_oferta
        `)
        .in('id', cuentaIds)
        .eq('activo', true);

      if (!cuentasDetalles || cuentasDetalles.length === 0) {
        setCuentasDestino([]);
        return;
      }

      // Obtener detalles de las ofertas y propiedades
      const ofertaIds = cuentasDetalles.map(c => c.id_oferta);
      
      const { data: ofertas } = await supabase
        .from('ofertas')
        .select(`
          id,
          id_propiedad
        `)
        .in('id', ofertaIds);

      if (!ofertas) {
        setCuentasDestino([]);
        return;
      }

      // Obtener detalles de las propiedades
      const propiedadIds = ofertas.map(o => o.id_propiedad);
      
      const { data: propiedades } = await supabase
        .from('propiedades')
        .select(`
          id,
          numero_propiedad,
          id_entidad_relacionada_dueno,
          id_edificio_modelo
        `)
        .in('id', propiedadIds);

      // Obtener proyectos y edificios
      const entidadIds = propiedades?.map(p => p.id_entidad_relacionada_dueno).filter(Boolean) || [];
      const edificioModeloIds = propiedades?.map(p => p.id_edificio_modelo).filter(Boolean) || [];

      const [entidadesResult, edificiosResult] = await Promise.all([
        entidadIds.length > 0 ? supabase
          .from('entidades_relacionadas')
          .select(`
            id,
            id_proyecto,
            proyectos!entidades_relacionadas_id_proyecto_fkey(nombre)
          `)
          .in('id', entidadIds) : { data: [] },
        edificioModeloIds.length > 0 ? supabase
          .from('edificios_modelos')
          .select(`
            id,
            edificios!edificios_modelos_id_edificio_fkey(nombre)
          `)
          .in('id', edificioModeloIds) : { data: [] }
      ]);

      // Procesar y combinar datos
      const cuentasFormateadas: CuentaDestino[] = [];
      
      for (const cuenta of cuentasDetalles) {
        const oferta = ofertas.find(o => o.id === cuenta.id_oferta);
        if (!oferta) continue;
        
        const propiedad = propiedades?.find(p => p.id === oferta.id_propiedad);
        if (!propiedad) continue;
        
        const entidad = entidadesResult.data?.find(e => e.id === propiedad.id_entidad_relacionada_dueno);
        const edificio = edificiosResult.data?.find(e => e.id === propiedad.id_edificio_modelo);
        
        cuentasFormateadas.push({
          id: cuenta.id,
          numero_propiedad: propiedad.numero_propiedad,
          proyecto: entidad?.proyectos?.nombre || 'Sin proyecto',
          edificio: edificio?.edificios?.nombre || 'Sin edificio'
        });
      }

      setCuentasDestino(cuentasFormateadas);

    } catch (error) {
      console.error('Error in fetchPagadorInfo:', error);
      toast({
        title: "Error",
        description: "Error al procesar la información",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransferir = async () => {
    if (!cuentaDestinoSeleccionada) {
      toast({
        title: "Error",
        description: "Seleccione una cuenta destino",
        variant: "destructive",
      });
      return;
    }

    if (!ultimoPagoSTP?.id) {
      toast({
        title: "Error",
        description: "No se encontró el ID del pago",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const cuentaDestinoId = parseInt(cuentaDestinoSeleccionada);
      const montoTotalTransferir = ultimoPagoSTP.monto;

      // 1. Obtener IDs de acuerdos afectados en la cuenta origen ANTES de desactivar
      const { data: aplicacionesOrigen, error: aplicacionesOrigenError } = await supabase
        .from('aplicaciones_pago')
        .select('id_acuerdo_pago')
        .eq('id_pago', ultimoPagoSTP.id)
        .eq('activo', true);

      if (aplicacionesOrigenError) {
        throw new Error('Error al obtener aplicaciones de pago de origen');
      }

      const acuerdosAfectadosIds = aplicacionesOrigen?.map(a => a.id_acuerdo_pago) || [];

      // 2. Desactivar todas las aplicaciones de pago existentes para este pago
      const { error: deactivateError } = await supabase
        .from('aplicaciones_pago')
        .update({ activo: false })
        .eq('id_pago', ultimoPagoSTP.id);

      if (deactivateError) {
        throw new Error('Error al desactivar aplicaciones de pago existentes');
      }

      // 3. Marcar los acuerdos de origen como NO completados
      if (acuerdosAfectadosIds.length > 0) {
        const { error: updateOrigenError } = await supabase
          .from('acuerdos_pago')
          .update({ pago_completado: false })
          .in('id', acuerdosAfectadosIds);

        if (updateOrigenError) {
          console.error('Error al actualizar acuerdos de origen:', updateOrigenError);
        }
      }

      // 4. Obtener acuerdos de pago NO completados de la cuenta destino
      const { data: acuerdosDestino, error: acuerdosDestinoError } = await supabase
        .from('acuerdos_pago')
        .select('id, monto, orden')
        .eq('id_cuenta_cobranza', cuentaDestinoId)
        .eq('pago_completado', false)
        .eq('activo', true)
        .order('orden');

      if (acuerdosDestinoError) {
        throw new Error('Error al obtener acuerdos de pago de cuenta destino');
      }

      const aplicacionesPago = [];
      const acuerdosCompletados = [];

      // 5. Aplicar el monto COMPLETO a la cuenta destino
      let montoRestante = montoTotalTransferir;
      for (const acuerdo of acuerdosDestino || []) {
        if (montoRestante <= 0) break;

        const montoAplicar = Math.min(montoRestante, acuerdo.monto);
        
        aplicacionesPago.push({
          id_pago: ultimoPagoSTP.id,
          id_acuerdo_pago: acuerdo.id,
          monto: montoAplicar,
          es_multa: false,
          activo: true
        });

        // Si el acuerdo se completa totalmente, marcarlo como completado
        if (montoAplicar >= acuerdo.monto) {
          acuerdosCompletados.push({
            id: acuerdo.id,
            pago_completado: true
          });
        }

        montoRestante -= montoAplicar;
      }

      // 6. Insertar nuevas aplicaciones de pago
      if (aplicacionesPago.length > 0) {
        const { error: insertError } = await supabase
          .from('aplicaciones_pago')
          .insert(aplicacionesPago);

        if (insertError) {
          throw new Error('Error al crear nuevas aplicaciones de pago');
        }
      }

      // 7. Actualizar acuerdos completados en la cuenta destino
      for (const acuerdo of acuerdosCompletados) {
        const { error: updateError } = await supabase
          .from('acuerdos_pago')
          .update({ pago_completado: acuerdo.pago_completado })
          .eq('id', acuerdo.id);

        if (updateError) {
          console.error('Error al actualizar acuerdo completado:', updateError);
        }
      }

      // Registrar transferencia en log de actividades
      await registrarActualizacion('pagos',
        { 
          id_pago: ultimoPagoSTP.id,
          id_cuenta_cobranza_origen: cuentaOrigenId,
          monto: montoTotalTransferir
        },
        {
          id_pago: ultimoPagoSTP.id,
          id_cuenta_cobranza_destino: cuentaDestinoId,
          monto: montoTotalTransferir,
          clave_rastreo: ultimoPagoSTP.clave_rastreo
        },
        'transferir_pago_entre_cuentas'
      );

      toast({
        title: "Transferencia realizada",
        description: `Se transfirió el monto completo de $${montoTotalTransferir.toLocaleString()} a la cuenta seleccionada`,
      });

      // Detectar si las cuentas son de mantenimiento
      const { data: cuentaOrigen } = await supabase
        .from('cuentas_cobranza')
        .select('id_cuenta_cobranza_padre')
        .eq('id', cuentaOrigenId)
        .single();

      const { data: cuentaDestino } = await supabase
        .from('cuentas_cobranza')
        .select('id_cuenta_cobranza_padre')
        .eq('id', cuentaDestinoId)
        .single();

      const esMantenimientoOrigen = !!cuentaOrigen?.id_cuenta_cobranza_padre;
      const esMantenimientoDestino = !!cuentaDestino?.id_cuenta_cobranza_padre;

      // Invalidate queries for source account
      if (esMantenimientoOrigen) {
        queryClient.invalidateQueries({ queryKey: ["cuenta_mantenimiento_detalle", cuentaOrigenId] });
        queryClient.invalidateQueries({ queryKey: ["pagos_mantenimiento", cuentaOrigenId] });
        queryClient.invalidateQueries({ queryKey: ["acuerdos_mantenimiento", cuentaOrigenId] });
        queryClient.invalidateQueries({ queryKey: ["multas_mantenimiento", cuentaOrigenId] });
        queryClient.invalidateQueries({ queryKey: ["aplicaciones_por_pago", cuentaOrigenId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["cuenta_detalle", cuentaOrigenId] });
        queryClient.invalidateQueries({ queryKey: ["acuerdos_pago", cuentaOrigenId] });
        queryClient.invalidateQueries({ queryKey: ["pagos_cuenta", cuentaOrigenId] });
        queryClient.invalidateQueries({ queryKey: ["aplicaciones_por_pago", cuentaOrigenId] });
      }

      // Invalidate queries for destination account
      if (esMantenimientoDestino) {
        queryClient.invalidateQueries({ queryKey: ["cuenta_mantenimiento_detalle", cuentaDestinoId] });
        queryClient.invalidateQueries({ queryKey: ["pagos_mantenimiento", cuentaDestinoId] });
        queryClient.invalidateQueries({ queryKey: ["acuerdos_mantenimiento", cuentaDestinoId] });
        queryClient.invalidateQueries({ queryKey: ["multas_mantenimiento", cuentaDestinoId] });
        queryClient.invalidateQueries({ queryKey: ["aplicaciones_por_pago", cuentaDestinoId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["cuenta_detalle", cuentaDestinoId] });
        queryClient.invalidateQueries({ queryKey: ["acuerdos_pago", cuentaDestinoId] });
        queryClient.invalidateQueries({ queryKey: ["pagos_cuenta", cuentaDestinoId] });
        queryClient.invalidateQueries({ queryKey: ["aplicaciones_por_pago", cuentaDestinoId] });
      }

      // Invalidar queries genéricas
      queryClient.invalidateQueries({ queryKey: ["cuentas_cobranza"] });
      queryClient.invalidateQueries({ queryKey: ["cuentas_mantenimiento"] });

      onClose();
      
    } catch (error) {
      console.error('Error in transfer:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al realizar la transferencia",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const fmtMonto = (n: number) =>
    n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg w-[calc(100%-2rem)] p-0 gap-0 overflow-hidden">
        {/* Header — solo título, sin icono */}
        <div className="px-5 pt-5 pb-4 border-b border-border/60">
          <DialogTitle className="text-[15px] font-semibold leading-tight">Transferir entre cuentas</DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground mt-1 leading-snug">
            El monto completo del último pago STP se reasigna a otra cuenta del mismo comprador.
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2.5 text-muted-foreground">
              <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-[13px]">Cargando información del pagador…</span>
            </div>
          ) : (
            <>
              {/* Info pagador */}
              {pagadorInfo && (
                <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
                  <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/40 bg-muted/20">
                    <User className="size-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Último pago STP</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3.5">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide mb-0.5">Ordenante</p>
                      <p className="text-[13px] font-medium leading-snug">{pagadorInfo.nombre_ordenante}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide mb-0.5">RFC / CURP</p>
                      <p className="text-[13px] font-mono leading-snug truncate">{pagadorInfo.rfc_curp_ordenante}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide mb-0.5">Monto</p>
                      <p className="text-[14px] font-semibold text-foreground">{fmtMonto(ultimoPagoSTP?.monto ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide mb-0.5">Clave rastreo</p>
                      <p className="text-[12px] font-mono text-muted-foreground leading-snug truncate">{ultimoPagoSTP?.clave_rastreo}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Selector cuenta destino */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground px-0.5">Cuenta destino *</label>
                {cuentasDestino.length > 0 ? (
                  <>
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCombobox}
                          className="w-full h-9 justify-between text-[13px] font-normal"
                        >
                          <span className="truncate">
                            {cuentaDestinoSeleccionada
                              ? (() => {
                                  const c = cuentasDestino.find(c => c.id.toString() === cuentaDestinoSeleccionada);
                                  return c ? `CC-${String(c.id).padStart(6, '0')} · ${c.numero_propiedad}` : 'Seleccionar cuenta';
                                })()
                              : 'Seleccionar cuenta destino'}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar cuenta..." />
                          <CommandList>
                            <CommandEmpty>No se encontró la cuenta.</CommandEmpty>
                            <CommandGroup>
                              {cuentasDestino.map((cuenta) => (
                                <CommandItem
                                  key={cuenta.id}
                                  value={`${cuenta.numero_propiedad} ${cuenta.proyecto} ${cuenta.edificio} ${cuenta.id}`}
                                  onSelect={() => {
                                    setCuentaDestinoSeleccionada(cuenta.id.toString());
                                    setOpenCombobox(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4 shrink-0", cuentaDestinoSeleccionada === cuenta.id.toString() ? "opacity-100" : "opacity-0")} />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[13px] font-medium">CC-{String(cuenta.id).padStart(6, '0')} · {cuenta.numero_propiedad}</span>
                                    <span className="text-[11px] text-muted-foreground truncate">{cuenta.proyecto} / {cuenta.edificio}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Advertencia */}
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 px-3.5 py-3">
                      <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-200">Se transferirá el monto completo</p>
                        <p className="text-[12px] text-amber-700 dark:text-amber-300 font-medium">{fmtMonto(ultimoPagoSTP?.monto ?? 0)}</p>
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
                          Los acuerdos de la cuenta origen quedarán incompletos y el pago se aplicará a la cuenta destino.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3.5 py-3">
                    <AlertTriangle className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-[13px] text-muted-foreground">No se encontraron otras cuentas activas para este comprador.</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border/60 bg-muted/20">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleTransferir}
            disabled={loading || !cuentaDestinoSeleccionada || cuentasDestino.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Transferir monto completo
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
