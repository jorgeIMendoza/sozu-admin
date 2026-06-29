import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Circle, Clock, AlertTriangle, FileText, CreditCard, Users, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";

interface PropertyProgressTimelineProps {
  cuentaId: number;
  propiedadId: number;
  estatusActual: number;
  restante?: number;
  cuentaDetalle?: {
    numero_escritura?: string | null;
    fecha_escritura?: string | null;
    id_notario?: number | null;
  } | null;
}

interface ConditionItem {
  label: string;
  completed: boolean;
  detail?: string;
}

interface StageData {
  name: string;
  status: 'completed' | 'in-progress' | 'pending';
  conditions: ConditionItem[];
  percentage: number;
}

export function PropertyProgressTimeline({
  cuentaId,
  propiedadId,
  estatusActual,
  restante,
  cuentaDetalle,
}: PropertyProgressTimelineProps) {
  // Fetch payment agreements status
  const { data: acuerdosPago } = useQuery({
    queryKey: ['progress-acuerdos', cuentaId],
    queryFn: async () => {
      const { data } = await supabase
        .from('acuerdos_pago')
        .select('id, id_concepto, pago_completado, monto')
        .eq('id_cuenta_cobranza', cuentaId)
        .eq('activo', true);
      return data || [];
    },
    staleTime: 30000,
  });

  // Fetch active buyers count
  const { data: compradoresCount } = useQuery({
    queryKey: ['progress-compradores-count', cuentaId],
    queryFn: async () => {
      const { count } = await supabase
        .from('compradores')
        .select('*', { count: 'exact', head: true })
        .eq('id_cuenta_cobranza', cuentaId)
        .eq('activo', true);
      return count || 0;
    },
    staleTime: 30000,
  });

  // Define explicit types to avoid Supabase type inference issues
  interface DocumentoRow {
    id: number;
    id_tipo_documento: number;
    id_estatus_verificacion: number | null;
    id_persona: number | null;
  }

  interface TipoDocumentoRow {
    id: number;
    nombre: string;
    id_categoria_documento: number | null;
  }

  // Fetch documents with their types
  const { data: documentosData } = useQuery({
    queryKey: ['progress-documentos', cuentaId],
    queryFn: async (): Promise<Array<{
      id: number;
      id_tipo_documento: number;
      id_estatus_verificacion: number | null;
      id_persona: number | null;
      tipos_documento: TipoDocumentoRow | null;
    }>> => {
      // Cast supabase to any to avoid deep type instantiation errors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;
      
      const { data: rawDocs, error } = await supabaseAny
        .from('documentos')
        .select('id, id_tipo_documento, id_estatus_verificacion, id_persona')
        .eq('id_cuenta_cobranza', cuentaId)
        .eq('activo', true);
      
      const docs = rawDocs as DocumentoRow[] | null;
      if (error || !docs || docs.length === 0) return [];

      // Get unique tipo_documento ids
      const tipoIds = [...new Set(docs.map(d => d.id_tipo_documento))];
      
      // Get tipos_documento info
      const { data: rawTipos } = await supabaseAny
        .from('tipos_documento')
        .select('id, nombre, id_categoria_documento')
        .in('id', tipoIds);
      
      const tipos = rawTipos as TipoDocumentoRow[] | null;
      
      // Create a map for quick lookup
      const tiposMap = new Map<number, TipoDocumentoRow>();
      tipos?.forEach(t => tiposMap.set(t.id, t));
      
      // Merge the data
      return docs.map(d => ({
        id: d.id,
        id_tipo_documento: d.id_tipo_documento,
        id_estatus_verificacion: d.id_estatus_verificacion,
        id_persona: d.id_persona,
        tipos_documento: tiposMap.get(d.id_tipo_documento) || null
      }));
    },
    staleTime: 30000,
  });

  // Calculate stage data
  const calculateStages = (): StageData[] => {
    const stages: StageData[] = [];
    const hasCompradores = (compradoresCount ?? 0) > 0;
    const documentos = documentosData || [];

    // ============ ETAPA 1: PAGOS (antes Vendido) ============
    const pagosConditions: ConditionItem[] = [];
    
    const statusOk = estatusActual >= 4;
    pagosConditions.push({
      label: 'Propiedad apartada',
      completed: statusOk,
      detail: statusOk ? 'Estatus válido' : 'La propiedad debe estar apartada'
    });

    // Show consolidated "Pagos" condition with X/N format
    // Exclude escrituración (9) from this calculation - include contra entrega (7)
    const pagosTodos = acuerdosPago?.filter(a => a.id_concepto !== 9) ?? [];
    if (pagosTodos.length > 0) {
      const pagosCompletados = pagosTodos.filter(p => p.pago_completado).length;
      const todosPagosCompletos = pagosCompletados === pagosTodos.length;
      pagosConditions.push({
        label: 'Pagos',
        completed: todosPagosCompletos,
        detail: `${pagosCompletados}/${pagosTodos.length} completado(s)`
      });
    }

    // New condition: Saldo cubierto (validates real balance)
    const saldoCubierto = (restante ?? 0) <= 0.01;
    pagosConditions.push({
      label: 'Saldo cubierto',
      completed: saldoCubierto,
      detail: saldoCubierto ? 'Sin saldo pendiente' : `Restante: $${(restante ?? 0).toFixed(2)}`
    });

    pagosConditions.push({
      label: 'Compradores registrados',
      completed: hasCompradores,
      detail: hasCompradores ? `${compradoresCount} comprador(es)` : 'Sin compradores'
    });

    // Tipo 18 = "Contrato firmado completamente"
    const contratoFirmado = documentos.some(d => d.id_tipo_documento === 18 && d.id_estatus_verificacion === 2);
    pagosConditions.push({
      label: 'Contrato firmado verificado',
      completed: contratoFirmado,
      detail: contratoFirmado ? 'Verificado' : 'Pendiente de verificación'
    });

    const pagosCompleted = pagosConditions.filter(c => c.completed).length;
    const pagosPercentage = Math.round((pagosCompleted / pagosConditions.length) * 100);
    const allPagosComplete = pagosCompleted === pagosConditions.length;

    stages.push({
      name: 'Pagos',
      status: allPagosComplete ? 'completed' : pagosCompleted > 0 ? 'in-progress' : 'pending',
      conditions: pagosConditions,
      percentage: pagosPercentage,
    });

    // ============ ETAPA 2: ESCRITURACIÓN ============
    const escrituracionConditions: ConditionItem[] = [];

    const estatusValidoEscrituracion = estatusActual === 5 || estatusActual === 9;
    escrituracionConditions.push({
      label: 'Estatus válido (Vendido o Pagada)',
      completed: estatusValidoEscrituracion || estatusActual >= 7,
      detail: estatusActual >= 7 ? 'Ya en escrituración' : estatusValidoEscrituracion ? 'Listo' : 'Debe estar Vendido o Pagada'
    });

    // Use restante prop if available, otherwise use acuerdos-based check
    const pagosPendientes = acuerdosPago?.filter(a => a.id_concepto !== 9 && !a.pago_completado) ?? [];
    const cuentaPagada = restante !== undefined ? (restante <= 0.01) : (pagosPendientes.length === 0);
    escrituracionConditions.push({
      label: 'Cuenta pagada completamente',
      completed: cuentaPagada,
      detail: cuentaPagada ? 'Saldo cubierto' : (restante !== undefined ? `Restante: $${restante.toFixed(2)}` : `${pagosPendientes.length} pago(s) pendiente(s)`)
    });

    escrituracionConditions.push({
      label: 'Compradores registrados',
      completed: hasCompradores,
      detail: hasCompradores ? `${compradoresCount} comprador(es)` : 'Sin compradores'
    });

    const docsCompradoresPendientes = documentos.filter(d => {
      const cat = d.tipos_documento?.id_categoria_documento;
      const isExcludedCategory = cat === 7 || cat === 8;
      return d.id_persona && !isExcludedCategory && d.id_estatus_verificacion !== 2;
    });
    const docsVerificados = docsCompradoresPendientes.length === 0 && hasCompradores;
    escrituracionConditions.push({
      label: 'Documentos de compradores verificados',
      completed: docsVerificados,
      detail: docsVerificados ? 'Todos verificados' : `${docsCompradoresPendientes.length} documento(s) pendiente(s)`
    });

    const escrituracionCompleted = escrituracionConditions.filter(c => c.completed).length;
    const escrituracionPercentage = Math.round((escrituracionCompleted / escrituracionConditions.length) * 100);
    const allEscrituracionComplete = escrituracionCompleted === escrituracionConditions.length;

    stages.push({
      name: 'Escrituración',
      status: allEscrituracionComplete ? 'completed' : (estatusActual >= 5 && escrituracionCompleted > 0) ? 'in-progress' : 'pending',
      conditions: escrituracionConditions,
      percentage: escrituracionPercentage,
    });

    // ============ ETAPA 3: ENTREGA ============
    const entregaConditions: ConditionItem[] = [];

    const enEscrituracion = estatusActual === 7;
    entregaConditions.push({
      label: 'Propiedad en escrituración',
      completed: enEscrituracion || estatusActual === 8,
      detail: estatusActual === 8 ? 'Entregada' : enEscrituracion ? 'En proceso' : 'Debe completar escrituración'
    });

    const datosEscrituraCompletos = !!cuentaDetalle?.numero_escritura;
    entregaConditions.push({
      label: 'Datos de escritura completos',
      completed: datosEscrituraCompletos,
      detail: datosEscrituraCompletos ? 'Número de escritura registrado' : 'Faltan datos de escritura'
    });

    const docsEntrega = documentos.filter(d => d.tipos_documento?.id_categoria_documento === 7);
    const docsEntregaVerificados = docsEntrega.filter(d => d.id_estatus_verificacion === 2);
    const entregaDocsOk = docsEntrega.length > 0 && docsEntregaVerificados.length === docsEntrega.length;
    entregaConditions.push({
      label: 'Documentos de entrega verificados',
      completed: entregaDocsOk,
      detail: docsEntrega.length === 0 ? 'Sin documentos de entrega' : `${docsEntregaVerificados.length}/${docsEntrega.length} verificados`
    });


    const entregaCompleted = entregaConditions.filter(c => c.completed).length;
    const entregaPercentage = Math.round((entregaCompleted / entregaConditions.length) * 100);

    const allEntregaComplete = entregaCompleted === entregaConditions.length;
    stages.push({
      name: 'Entrega',
      status: allEntregaComplete ? 'completed' : entregaCompleted > 0 ? 'in-progress' : 'pending',
      conditions: entregaConditions,
      percentage: entregaPercentage,
    });

    return stages;
  };

  const stages = calculateStages();
  const isEnDemanda = estatusActual === 11;

  return (
    <div className="space-y-3">
      {isEnDemanda && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-50/60 dark:bg-yellow-950/20 px-3 py-2 text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-[12px] font-medium">Propiedad en demanda — proceso judicial activo</span>
        </div>
      )}

      {/* Etapas — siempre expandidas, sin clic */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {stages.map((stage) => (
          <StageCard key={stage.name} stage={stage} />
        ))}
      </div>
    </div>
  );
}

function StageCard({ stage }: { stage: StageData }) {
  const tone = stage.status === 'completed'
    ? { label: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' }
    : stage.status === 'in-progress'
    ? { label: 'text-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-200', bar: 'bg-blue-500' }
    : { label: 'text-muted-foreground', badge: 'bg-muted/50 text-muted-foreground border-border', bar: 'bg-muted-foreground/30' };

  const statusLabel = stage.status === 'completed' ? 'Completado' : stage.status === 'in-progress' ? 'En progreso' : 'Pendiente';

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <p className={cn('text-[13px] font-semibold leading-tight', tone.label)}>{stage.name}</p>
        </div>
        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', tone.badge)}>
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', tone.bar)} style={{ width: `${stage.percentage}%` }} />
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground shrink-0">{stage.percentage}%</span>
      </div>

      <div className="space-y-1.5 pt-0.5">
        {stage.conditions.map((condition, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <div className={cn('mt-0.5 shrink-0', condition.completed ? 'text-emerald-600' : 'text-muted-foreground/40')}>
              {condition.completed ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-[12px] font-medium leading-tight', condition.completed ? 'text-foreground' : 'text-muted-foreground')}>{condition.label}</p>
              {condition.detail && <p className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">{condition.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
