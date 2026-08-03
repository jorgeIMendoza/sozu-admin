import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, FileText, Eye, ChevronDown, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  normalizarTipoPersona,
  gruposObligatorios,
  buildLatestPorPersonaTipo,
  evaluarPersona,
  fetchDocsObligatorios,
  ESTATUS_VALIDADO,
  type PortalExpediente,
  type TipoPersona,
} from '@/utils/expediente-obligatorios';

/**
 * COMPONENTE VISUAL ÚNICO del expediente obligatorio.
 *
 * Toda la lógica vive en `src/utils/expediente-obligatorios.ts` (pura, testeable, sin
 * React). Este archivo solo pinta. Cualquier pantalla que muestre "documentos del
 * expediente" —CC en admin panel, portal de cobranza, jurídico, socio bancario, notaría,
 * inmobiliarias, embajadores— debe usar este componente en vez de armar su propia lista.
 *
 * Reglas que garantiza, iguales en todas partes:
 *   · Solo los grupos OBLIGATORIOS del portal que lo monta (`portal`).
 *   · Los grupos correctos según persona física o moral.
 *   · De cada categoría, únicamente el documento MÁS RECIENTE — si el más nuevo no está
 *     validado, el grupo no cuenta aunque exista una versión anterior verificada.
 *   · Un solo criterio de badge de estatus (2 = verificado, 3 = rechazado, 4 = expirado).
 *
 * El histórico completo queda disponible pero colapsado: sirve para descargar versiones
 * viejas, no para decidir si el expediente está listo.
 */

type DocumentoRow = {
  id: number;
  id_persona: number;
  id_tipo_documento: number;
  id_estatus_verificacion: number | null;
  fecha_creacion: string | null;
  url: string | null;
};

export interface PersonaExpediente {
  id: number;
  nombre: string;
  tipoPersona?: string | null;
  /** Persona del representante legal (solo aplica a persona moral). */
  repPersonaId?: number | null;
}

const ESTATUS_CFG: Record<number, { label: string; cls: string }> = {
  2: { label: 'Verificado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  3: { label: 'Rechazado',  cls: 'bg-red-50 text-red-700 border-red-200' },
  4: { label: 'Expirado',   cls: 'bg-orange-50 text-orange-700 border-orange-200' },
};

/** Badge de estatus de verificación — criterio único para todo el proyecto. */
export function EstatusDocBadge({ estatusId }: { estatusId: number | null | undefined }) {
  const cfg = ESTATUS_CFG[estatusId ?? 0]
    ?? { label: 'Pendiente', cls: 'bg-muted/50 text-muted-foreground border-border' };
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold whitespace-nowrap', cfg.cls)}>
      {cfg.label}
    </Badge>
  );
}

/** Corrige URLs con path duplicado o relativas (bucket público `documentos`). */
function fixUrl(raw: string | null): string | null {
  if (!raw) return null;
  let u = raw;
  if (u.includes('/documentos/documentos/')) u = u.replace('/documentos/documentos/', '/documentos/');
  if (!u.startsWith('https://')) {
    const fileName = u.startsWith('documentos/') ? u.replace('documentos/', '') : u;
    u = supabase.storage.from('documentos').getPublicUrl(fileName).data.publicUrl;
  }
  return u;
}

const fmtFecha = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function DocumentosObligatorios({
  personas,
  portal = 'escrituracion',
  titulo = 'Documentos obligatorios del expediente',
  className,
}: {
  personas: PersonaExpediente[];
  portal?: PortalExpediente;
  titulo?: string;
  className?: string;
}) {
  const [historicoAbierto, setHistoricoAbierto] = useState<Record<string, boolean>>({});

  const personaIds = personas.map(p => p.id).filter(Boolean);
  const repIds = personas.map(p => p.repPersonaId).filter((v): v is number => v != null);
  const todosIds = [...new Set([...personaIds, ...repIds])];

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['expediente-obligatorios', todosIds.slice().sort((a, b) => a - b), portal],
    enabled: todosIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<DocumentoRow[]> => {
      // Se reusa el fetch centralizado (chunks + limit explícito) y se agrega `url`, que
      // el componente necesita para el enlace de ver/descargar.
      const base = await fetchDocsObligatorios(todosIds, supabase as never);
      const ids = base.map(d => d.id);
      if (!ids.length) return [];
      const urls: Record<number, string | null> = {};
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data } = await (supabase as never as { from: (t: string) => any })
          .from('documentos').select('id, url').in('id', ids.slice(i, i + CHUNK));
        (data ?? []).forEach((r: { id: number; url: string | null }) => { urls[r.id] = r.url; });
      }
      return base.map(d => ({ ...d, url: urls[d.id] ?? null }));
    },
  });

  if (!todosIds.length) {
    return (
      <div className={cn('rounded-xl border p-6 text-center', className)}>
        <FileText className="size-8 text-muted-foreground/25 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Sin compradores registrados en el expediente.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('rounded-xl border p-8 flex items-center justify-center gap-2', className)}>
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Cargando expediente...</span>
      </div>
    );
  }

  const latest = buildLatestPorPersonaTipo(docs);

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>

      {personas.map(persona => {
        const tipoPersona: TipoPersona = normalizarTipoPersona(persona.tipoPersona);
        const grupos = gruposObligatorios(tipoPersona, portal);
        const evaluacion = evaluarPersona(
          { personaId: persona.id, tipoPersona, repPersonaId: persona.repPersonaId ?? null, portal },
          latest,
        );
        const completo = evaluacion.total > 0 && evaluacion.completos >= evaluacion.total;

        return (
          <div key={persona.id} className="rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate">{persona.nombre}</p>
                <p className="text-[11px] text-muted-foreground">
                  {tipoPersona === 'pm' ? 'Persona moral' : 'Persona física'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('text-[12px] font-semibold tabular-nums',
                  completo ? 'text-emerald-600' : 'text-muted-foreground')}>
                  {evaluacion.completos}/{evaluacion.total}
                </span>
                {completo
                  ? <CheckCircle2 className="size-4 text-emerald-500" />
                  : <AlertTriangle className="size-4 text-amber-500" />}
              </div>
            </div>

            <Progress value={evaluacion.total ? (evaluacion.completos / evaluacion.total) * 100 : 0} className="h-1 rounded-none" />

            {evaluacion.faltaRepLegal && (
              <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200">
                <ShieldAlert className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700">
                  Esta empresa no tiene representante legal ligado, así que sus documentos
                  (poder notarial, identificación, CURP, CSF y domicilio) no se pueden validar.
                </p>
              </div>
            )}

            <div className="divide-y">
              {grupos.map(grupo => {
                const dueñoId = grupo.owner === 'rep' ? (persona.repPersonaId ?? null) : persona.id;
                // Documento vigente del grupo: el más reciente entre sus tipos.
                const vigente = dueñoId
                  ? grupo.ids
                      .map(t => ({ tipo: t, doc: latest[`${dueñoId}__${t}`] }))
                      .filter(x => x.doc)
                      .sort((a, b) => (a.doc!.fecha > b.doc!.fecha ? -1 : 1))[0]
                  : undefined;
                const docVigente = vigente ? docs.find(d => d.id === vigente.doc!.id) : undefined;
                const cumplido = !!vigente && vigente.doc!.estatusId === ESTATUS_VALIDADO;

                // Histórico: versiones anteriores del mismo grupo (solo consulta).
                const histKey = `${persona.id}__${grupo.key}`;
                const historico = dueñoId
                  ? docs
                      .filter(d => d.id_persona === dueñoId && grupo.ids.includes(d.id_tipo_documento))
                      .filter(d => d.id !== vigente?.doc?.id)
                      .sort((a, b) => String(b.fecha_creacion ?? '').localeCompare(String(a.fecha_creacion ?? '')))
                  : [];

                return (
                  <div key={grupo.key} className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={cn('size-1.5 rounded-full shrink-0',
                        cumplido ? 'bg-emerald-500' : vigente ? 'bg-amber-400' : 'bg-muted-foreground/25')} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium truncate">{grupo.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {vigente ? `Vigente · ${fmtFecha(docVigente?.fecha_creacion ?? null)}` : 'Sin documento'}
                        </p>
                      </div>
                      <EstatusDocBadge estatusId={vigente?.doc?.estatusId ?? null} />
                      {docVigente?.url && (
                        <a href={fixUrl(docVigente.url) ?? '#'} target="_blank" rel="noreferrer"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                          title="Ver documento">
                          <Eye className="size-3.5" />
                        </a>
                      )}
                    </div>

                    {historico.length > 0 && (
                      <Collapsible
                        open={!!historicoAbierto[histKey]}
                        onOpenChange={o => setHistoricoAbierto(s => ({ ...s, [histKey]: o }))}
                      >
                        <CollapsibleTrigger className="mt-1.5 ml-4.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                          <ChevronDown className={cn('size-3 transition-transform', historicoAbierto[histKey] && 'rotate-180')} />
                          {historico.length} versión{historico.length > 1 ? 'es' : ''} anterior{historico.length > 1 ? 'es' : ''}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1 ml-4.5 space-y-1">
                          {historico.map(h => (
                            <div key={h.id} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="tabular-nums">{fmtFecha(h.fecha_creacion)}</span>
                              <EstatusDocBadge estatusId={h.id_estatus_verificacion} />
                              {h.url && (
                                <a href={fixUrl(h.url) ?? '#'} target="_blank" rel="noreferrer" className="hover:text-foreground underline">
                                  ver
                                </a>
                              )}
                              <span className="italic">no cuenta para la validación</span>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
