/**
 * Sheet de detalle de cuenta para el Portal Notaría.
 * 5 secciones de lectura + 1 sección editable (datos de escrituración).
 *
 * RESTRICCIÓN ABSOLUTA: la única mutación permitida es la actualización en lote
 * de los seis campos notariales en cuentas_cobranza. Ninguna otra escritura.
 *
 * Excepción administrador: notarioId puede ser cualquier id cuando el usuario
 * es tomas.peterson@investimento.mx — el selector en AppNotariaDashboard lo gestiona.
 *
 * Seguridad MVP: los hooks internos validan cc.id_notario = notarioId.
 * La funcionalidad NO debe ir a Producción sin RLS en cuentas_cobranza.
 */

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  X, Loader2, Building2, Users, DollarSign,
  FileText, Stamp, ChevronRight, ExternalLink,
  AlertTriangle, Landmark, User,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNotariaCuentaDetalle } from '@/hooks/useNotariaCuentaDetalle';
import { useCuentaCobranzaFinancials } from '@/hooks/useCuentaCobranzaFinancials';
import { useNotariaExpediente } from '@/hooks/useNotariaExpediente';
import { registrarActividadNotaria } from '@/services/notaria-actividad.service';
import { resolveDocUrl } from '@/services/notaria-download.service';
import { NotariaRelacionPagosModal } from './NotariaRelacionPagosModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SheetRow {
  cuentaId: number;
  cuentaCode: string;
  unitCode: string;
  clienteName: string;
  proyectoNombre: string;
  edificioNombre: string;
}

interface NotariaCuentaDetalleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SheetRow;
  notarioId: number | null;
  usuarioEmail: string | null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

function validateEscrituracionFields(fields: EscrituracionFields): string | null {
  const { claveCatastral, numeroUnidadPrivativa, numeroEscritura, fechaEscritura, libro, hoja } = fields;
  if (claveCatastral && claveCatastral.length > 50) return 'Clave catastral: máximo 50 caracteres.';
  if (numeroUnidadPrivativa && numeroUnidadPrivativa.length > 20) return 'Núm. unidad privativa: máximo 20 caracteres.';
  if (numeroEscritura && !/^[a-zA-Z0-9\-/ ]*$/.test(numeroEscritura)) return 'Núm. escritura: solo letras, números, guiones y espacios.';
  if (libro && libro.length > 20) return 'Libro: máximo 20 caracteres.';
  if (hoja && hoja.length > 10) return 'Hoja: máximo 10 caracteres.';
  if (fechaEscritura && !/^\d{4}-\d{2}-\d{2}$/.test(fechaEscritura)) return 'Fecha de escritura: formato YYYY-MM-DD requerido.';
  return null;
}

// ─── Editable fields type ─────────────────────────────────────────────────────

interface EscrituracionFields {
  claveCatastral: string;
  numeroUnidadPrivativa: string;
  numeroEscritura: string;
  fechaEscritura: string;
  libro: string;
  hoja: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotariaCuentaDetalleSheet({
  open,
  onOpenChange,
  row,
  notarioId,
  usuarioEmail,
}: NotariaCuentaDetalleSheetProps) {
  const qc = useQueryClient();
  const [relPagosOpen, setRelPagosOpen] = useState(false);
  const [isDownloadingContrato, setIsDownloadingContrato] = useState(false);
  const [fields, setFields] = useState<EscrituracionFields>({
    claveCatastral: '',
    numeroUnidadPrivativa: '',
    numeroEscritura: '',
    fechaEscritura: '',
    libro: '',
    hoja: '',
  });
  const [isDirty, setIsDirty] = useState(false);

  // ── Data hooks ────────────────────────────────────────────────────────────
  const { data: detalle, isLoading, isError } = useNotariaCuentaDetalle({
    cuentaId: row.cuentaId,
    notarioId,
    enabled: open,
  });

  const { data: financials, isLoading: financialsLoading } = useCuentaCobranzaFinancials(
    open ? row.cuentaId : null,
  );

  const { compradores: compradoresExpediente, docsCompletos, docsTotal } = useNotariaExpediente({
    idCuentaCobranza: open ? row.cuentaId : null,
    notarioId,
    proyecto: row.proyectoNombre,
    unidad: row.unitCode,
    usuarioEmail,
    fechaGeneracion: new Date().toLocaleDateString('es-MX'),
    enabled: open,
  });

  // Sync form from fetched data
  useEffect(() => {
    if (detalle && !isDirty) {
      setFields({
        claveCatastral: detalle.claveCatastral ?? '',
        numeroUnidadPrivativa: detalle.numeroUnidadPrivativa ?? '',
        numeroEscritura: detalle.numeroEscritura ?? '',
        fechaEscritura: detalle.fechaEscritura ?? '',
        libro: detalle.libro ?? '',
        hoja: detalle.hoja ?? '',
      });
    }
  }, [detalle, isDirty]);

  // Reset dirty on open
  useEffect(() => {
    if (open) setIsDirty(false);
  }, [open, row.cuentaId]);

  // ── Save mutation (única mutación autorizada en este componente) ──────────
  const saveValidationError = validateEscrituracionFields(fields);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from('cuentas_cobranza')
        .update({
          clave_catastral: fields.claveCatastral || null,
          numero_unidad_privativa: fields.numeroUnidadPrivativa || null,
          numero_escritura: fields.numeroEscritura || null,
          fecha_escritura: fields.fechaEscritura || null,
          libro: fields.libro || null,
          hoja: fields.hoja || null,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq('id', row.cuentaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Datos de escrituración guardados correctamente.');
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ['notaria-cuenta-detalle', row.cuentaId] });
      qc.invalidateQueries({ queryKey: ['app-notaria-cuentas'] });
      registrarActividadNotaria({
        idCuentaCobranza: row.cuentaId,
        evento: 'ESCRITURACION_UPDATED',
        usuarioEmail,
        meta: { id_notario: notarioId, campos_actualizados: Object.keys(fields).filter(k => (fields as any)[k]) },
      });
    },
    onError: () => toast.error('Error al guardar los datos. Intenta de nuevo.'),
  });

  // ── Download contrato firmado ──────────────────────────────────────────────
  const handleDownloadContrato = async () => {
    if (!detalle?.contratoFirmadoUrl) return;
    setIsDownloadingContrato(true);
    try {
      const url = await resolveDocUrl(detalle.contratoFirmadoUrl);
      if (!url) { toast.error('No se pudo resolver la URL del contrato.'); return; }
      window.open(url, '_blank', 'noreferrer');
    } catch {
      toast.error('Error al abrir el contrato.');
    } finally {
      setIsDownloadingContrato(false);
    }
  };

  const updateField = (key: keyof EscrituracionFields, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const tipoFinLabel = detalle?.tipoFinanciamiento === 'CREDITO_HIPOTECARIO'
    ? 'Crédito hipotecario'
    : detalle?.tipoFinanciamiento
      ? detalle.tipoFinanciamiento
      : 'Recursos propios';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl flex flex-col p-0 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Stamp className="h-4 w-4 text-primary shrink-0" />
                <p className="text-base font-bold leading-tight">{row.unitCode}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {row.proyectoNombre}{row.edificioNombre ? ` · ${row.edificioNombre}` : ''}
              </p>
              <p className="text-xs text-muted-foreground font-mono">{row.cuentaCode}</p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">

            {isLoading && (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Cargando...</span>
              </div>
            )}

            {isError && (
              <div className="m-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">No fue posible cargar la información del expediente.</p>
              </div>
            )}

            {!isLoading && !isError && detalle && (
              <div className="space-y-0 divide-y divide-border">

                {/* §1 — Inmueble */}
                <section className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Inmueble</h3>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {[
                      ['Proyecto',       detalle.proyectoNombre ?? '—'],
                      ['Edificio',       detalle.edificioNombre ?? '—'],
                      ['Modelo',         detalle.modeloNombre ?? '—'],
                      ['Núm. propiedad', detalle.numeroPropiedad ?? '—'],
                      ['M² interiores',  detalle.m2Interiores != null ? `${detalle.m2Interiores} m²` : '—'],
                      ['M² exteriores',  detalle.m2Exteriores != null ? `${detalle.m2Exteriores} m²` : '—'],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <dt className="text-[11px] text-muted-foreground">{l}</dt>
                        <dd className="text-xs font-medium text-foreground mt-0.5">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                {/* §2 — Compradores */}
                <section className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Compradores</h3>
                  </div>
                  {detalle.compradores.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Información del comprador no disponible.</p>
                  ) : (
                    <div className="space-y-3">
                      {detalle.compradores.map((c, idx) => (
                        <div key={c.idPersona} className={cn('space-y-1 rounded-lg p-3 border', c.esConyuge ? 'bg-slate-50 border-slate-200' : 'bg-background border-border')}>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground shrink-0" />
                            <p className="text-xs font-semibold text-foreground">{c.nombre}</p>
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              {c.esConyuge ? 'Cónyuge' : idx === 0 ? 'Titular' : 'Copropietario'}
                            </Badge>
                          </div>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                            {c.email && <div><dt className="text-[10px] text-muted-foreground">Email</dt><dd className="text-[11px] font-medium truncate">{c.email}</dd></div>}
                            {c.rfc && <div><dt className="text-[10px] text-muted-foreground">RFC</dt><dd className="text-[11px] font-medium font-mono">{c.rfc}</dd></div>}
                            {c.curp && <div><dt className="text-[10px] text-muted-foreground">CURP</dt><dd className="text-[11px] font-medium font-mono">{c.curp}</dd></div>}
                          </dl>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* §3 — Financiero */}
                <section className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Resumen financiero</h3>
                  </div>
                  {financialsLoading ? (
                    <p className="text-xs text-muted-foreground">Cargando...</p>
                  ) : financials ? (
                    <dl className="space-y-2">
                      <div className="flex justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">Precio final</dt>
                        <dd className="text-xs font-semibold tabular-nums">{fmtMxn(financials.precioFinal)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">Total pagado</dt>
                        <dd className="text-xs font-semibold tabular-nums text-emerald-600">{fmtMxn(financials.totalPagadoReal)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">Saldo pendiente</dt>
                        <dd className={cn('text-xs font-semibold tabular-nums', financials.saldoPendiente > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                          {fmtMxn(financials.saldoPendiente)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">Límite efectivo (LFPIORPI)</dt>
                        <dd className="text-xs font-medium tabular-nums">{fmtMxn(financials.limiteEfectivo)}</dd>
                      </div>
                      {/* Hipotecario block */}
                      {detalle.tipoFinanciamiento === 'CREDITO_HIPOTECARIO' && (
                        <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                          <Landmark className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <div>
                            <p className="text-[11px] font-semibold text-blue-800">Crédito hipotecario</p>
                            <p className="text-[10px] text-blue-600 mt-0.5">
                              Se requiere VoBo del banco antes de la firma.
                            </p>
                          </div>
                        </div>
                      )}
                      {detalle.tipoFinanciamiento !== 'CREDITO_HIPOTECARIO' && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-xs text-muted-foreground">Forma de liquidación</dt>
                          <dd className="text-xs font-medium">{tipoFinLabel}</dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p className="text-xs text-muted-foreground">No fue posible obtener el resumen financiero.</p>
                  )}
                </section>

                {/* §4 — Documentos */}
                <section className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Documentos</h3>
                  </div>
                  <div className="space-y-2">
                    {/* Expediente badge */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/30">
                      <div>
                        <p className="text-xs font-medium">Expediente KYC</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {docsCompletos}/{docsTotal} grupos validados
                        </p>
                      </div>
                      <Badge
                        variant={docsCompletos === docsTotal ? 'default' : 'outline'}
                        className="text-[10px]"
                      >
                        {docsCompletos === docsTotal ? 'Completo' : `${docsCompletos}/${docsTotal}`}
                      </Badge>
                    </div>
                    {/* Contrato firmado */}
                    {detalle.contratoFirmadoUrl ? (
                      <button
                        onClick={handleDownloadContrato}
                        disabled={isDownloadingContrato}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isDownloadingContrato
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                            : <FileText className="h-3.5 w-3.5 text-emerald-600" />}
                          <span className="text-xs font-medium text-emerald-800">Ver contrato firmado</span>
                        </div>
                        <ExternalLink className="h-3 w-3 text-emerald-600" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-slate-200 text-muted-foreground">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <p className="text-xs">Sin contrato firmado registrado</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* §5 — Escrituración (editable) */}
                <section className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Stamp className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Datos de escrituración</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: 'claveCatastral',       label: 'Clave catastral',          maxLen: 50,   ph: 'Ej. 123-456-789' },
                      { key: 'numeroUnidadPrivativa', label: 'Núm. unidad privativa',    maxLen: 20,   ph: 'Ej. 2-A' },
                      { key: 'numeroEscritura',       label: 'Núm. escritura',           maxLen: 30,   ph: 'Alfanumérico' },
                      { key: 'libro',                 label: 'Libro',                    maxLen: 20,   ph: '—' },
                      { key: 'hoja',                  label: 'Hoja',                     maxLen: 10,   ph: '—' },
                    ] as { key: keyof EscrituracionFields; label: string; maxLen: number; ph: string }[]).map(f => (
                      <div key={f.key}>
                        <label className="text-[11px] text-muted-foreground block mb-1">{f.label}</label>
                        <input
                          type="text"
                          value={fields[f.key]}
                          onChange={e => updateField(f.key, e.target.value)}
                          maxLength={f.maxLen}
                          placeholder={f.ph}
                          className="w-full text-xs border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Fecha de escritura</label>
                      <input
                        type="date"
                        value={fields.fechaEscritura}
                        onChange={e => updateField('fechaEscritura', e.target.value)}
                        className="w-full text-xs border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                  {saveValidationError && isDirty && (
                    <p className="text-[11px] text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {saveValidationError}
                    </p>
                  )}
                  <Button
                    size="sm"
                    className="w-full mt-1"
                    disabled={!isDirty || !!saveValidationError || saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Guardar datos de escrituración
                  </Button>
                  {detalle.fechaActualizacion && (
                    <p className="text-[11px] text-muted-foreground text-right">
                      Última actualización: {new Date(detalle.fechaActualizacion).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </section>
              </div>
            )}
          </div>

          {/* Footer — Ver relación de pagos */}
          {!isLoading && !isError && (
            <div className="px-5 py-3 border-t border-border shrink-0 bg-white">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => setRelPagosOpen(true)}
              >
                <DollarSign className="h-3.5 w-3.5" />
                Ver relación de pagos
                <ChevronRight className="h-3.5 w-3.5 ml-auto" />
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Relación de pagos modal — se abre desde el footer del sheet */}
      <NotariaRelacionPagosModal
        open={relPagosOpen}
        onOpenChange={setRelPagosOpen}
        cuentaId={row.cuentaId}
        notarioId={notarioId}
        unitCode={row.unitCode}
        clienteName={row.clienteName}
        cuentaCode={row.cuentaCode}
        proyectoNombre={row.proyectoNombre}
      />
    </>
  );
}
