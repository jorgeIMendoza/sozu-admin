/**
 * Detalle de comprador (reutilizable) — Sheet con pestañas Básica, Dirección,
 * Fiscal, Documentos y Cuentas, más validación/rechazo por sección y por
 * documento (vía bitácora de la cuenta de cobranza).
 *
 * Autocontenido: dado el id de la cuenta de cobranza y la lista de
 * compradores ({ idPersona, nombre }), hidrata todo con `useCompradoresFullDetail`
 * y la bitácora. Mismo comportamiento que el drawer de CaseDetail, extraído
 * para reutilizarlo en Escrituración · Expedientes.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, FileText, Eye, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompradoresFullDetail } from '@/hooks/useCompradoresFullDetail';
import {
  useBitacoraCuentaCobranza,
  useAppendBitacoraEntry,
  getValidationState,
  type ValidationStatus,
} from '@/hooks/useBitacoraCuentaCobranza';
import type { BitacoraScope } from '@/types/bitacora';

export interface CompradorResumen {
  idPersona: number;
  nombre: string;
}

function pgErrorMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code].filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );
    if (parts.length > 0) return parts.join(' — ');
  }
  return null;
}

export function CompradorDetalleSheet({
  open,
  onOpenChange,
  idCuentaCobranza,
  compradores,
  initialPersonaId,
  readOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idCuentaCobranza: number;
  compradores: CompradorResumen[];
  initialPersonaId?: number | null;
  readOnly?: boolean;
}) {
  const idPersonas = compradores.map((c) => c.idPersona);
  const { data: fullByPersona, isLoading } = useCompradoresFullDetail(idPersonas);
  const [selectedId, setSelectedId] = useState<number>(initialPersonaId ?? idPersonas[0] ?? 0);
  const safeSelectedId = idPersonas.includes(selectedId)
    ? selectedId
    : initialPersonaId && idPersonas.includes(initialPersonaId)
      ? initialPersonaId
      : idPersonas[0] ?? 0;
  const summary = compradores.find((c) => c.idPersona === safeSelectedId);
  const full = fullByPersona?.[safeSelectedId];

  const { entries: bitacora, columnaFaltante } = useBitacoraCuentaCobranza(idCuentaCobranza);
  const appendMutation = useAppendBitacoraEntry(idCuentaCobranza);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rejectFor, setRejectFor] = useState<{ scope: BitacoraScope; idDocumento?: number; label: string } | null>(null);
  const [rejectJustification, setRejectJustification] = useState('');

  const syncDocumentoEstatus = async (idDocumento: number, nuevoEstatus: 1 | 2 | 3) => {
    const { error } = await (supabase as any)
      .from('documentos')
      .update({ id_estatus_verificacion: nuevoEstatus })
      .eq('id', idDocumento);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['documentos'] });
    queryClient.invalidateQueries({ queryKey: ['cuenta_cobranza'] });
    queryClient.invalidateQueries({ queryKey: ['compradores_full_detail'] });
  };

  const validate = (scope: BitacoraScope, label: string, refs: { idDocumento?: number } = {}) => {
    if (readOnly) return;
    if (columnaFaltante) return;
    appendMutation.mutate({
      tipo: 'validacion',
      mensaje: `Validó: ${label}`,
      referencia: { scope, idPersona: safeSelectedId, idDocumento: refs.idDocumento },
    });
    if (scope === 'documento' && refs.idDocumento) {
      void syncDocumentoEstatus(refs.idDocumento, 2).catch((err) =>
        toast({
          title: 'Bitácora guardada, pero el documento no se sincronizó',
          description: pgErrorMessage(err) ?? 'No se pudo actualizar id_estatus_verificacion.',
          variant: 'destructive',
        }),
      );
    }
  };

  const submitReject = () => {
    if (readOnly) return;
    if (!rejectFor || !rejectJustification.trim()) return;
    appendMutation.mutate({
      tipo: 'rechazo',
      mensaje: rejectJustification.trim(),
      referencia: { scope: rejectFor.scope, idPersona: safeSelectedId, idDocumento: rejectFor.idDocumento },
    });
    if (rejectFor.scope === 'documento' && rejectFor.idDocumento) {
      void syncDocumentoEstatus(rejectFor.idDocumento, 3).catch((err) =>
        toast({
          title: 'Bitácora guardada, pero el documento no se sincronizó',
          description: pgErrorMessage(err) ?? 'No se pudo actualizar id_estatus_verificacion.',
          variant: 'destructive',
        }),
      );
    }
    setRejectFor(null);
    setRejectJustification('');
  };

  const esPm = full?.basica.tipoPersona === 'pm';
  const nombre = summary?.nombre || full?.basica.nombreLegal || full?.basica.nombreComercial || '—';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[680px] p-0 overflow-y-auto">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-[16px]">Detalle del comprador</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-5 space-y-5">
          {compradores.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {compradores.map((c) => {
                const active = c.idPersona === safeSelectedId;
                return (
                  <button
                    key={c.idPersona}
                    onClick={() => setSelectedId(c.idPersona)}
                    className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors ${
                      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {c.nombre}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
              esPm ? 'bg-[hsl(var(--status-purple)/0.1)] text-[hsl(var(--status-purple))]' : 'bg-muted text-muted-foreground'
            }`}>
              {esPm ? <Building2 className="h-5 w-5" /> : nombre.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-tight">{nombre}</p>
              {full && (
                <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full mt-1 ${
                  esPm ? 'bg-[hsl(var(--status-purple)/0.1)] text-[hsl(var(--status-purple))]' : 'bg-muted text-muted-foreground'
                }`}>{full.basica.tipoPersonaLabel}</span>
              )}
            </div>
          </div>

          {isLoading && !full ? (
            <div className="py-12 text-center text-sm text-muted-foreground inline-flex w-full justify-center items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando información…
            </div>
          ) : full ? (
            <Tabs defaultValue="basica" className="w-full">
              <TabsList className="w-full justify-start flex-wrap h-auto">
                <TabsTrigger value="basica">Básica</TabsTrigger>
                <TabsTrigger value="direccion">Dirección</TabsTrigger>
                <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                <TabsTrigger value="documentos">
                  Documentos
                  {full.documentos.length > 0 && <span className="ml-1.5 text-[10px] opacity-70">({full.documentos.length})</span>}
                </TabsTrigger>
                <TabsTrigger value="cuentas">
                  Cuentas
                  {full.cuentasBancarias.length > 0 && <span className="ml-1.5 text-[10px] opacity-70">({full.cuentasBancarias.length})</span>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basica" className="pt-4 space-y-4">
                {!readOnly && (
                  <SectionValidationBar
                    state={getValidationState(bitacora, 'comprador_basica', { idPersona: safeSelectedId })}
                    busy={appendMutation.isPending}
                    disabledReason={columnaFaltante ? 'Bitácora no habilitada en BD.' : undefined}
                    onValidate={() => validate('comprador_basica', 'Información básica del comprador')}
                    onReject={() => setRejectFor({ scope: 'comprador_basica', label: 'Información básica' })}
                  />
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <DrawerKv label="Tipo de persona" value={full.basica.tipoPersonaLabel} />
                  <DrawerKv label="Nombre" value={full.basica.nombreLegal || full.basica.nombreComercial} />
                  <DrawerKv label="Correo" value={full.basica.email} />
                  <DrawerKv
                    label="Teléfono"
                    value={full.basica.telefono ? `${full.basica.clavePaisTelefono ? `(${full.basica.clavePaisTelefono}) ` : ''}${full.basica.telefono}` : null}
                    mono
                  />
                  <DrawerKv label="RFC" value={full.basica.rfc} mono />
                  <DrawerKv label="CURP" value={full.basica.curp} mono />
                  <DrawerKv label="Sexo" value={full.basica.sexo === 'M' ? 'Masculino' : full.basica.sexo === 'F' ? 'Femenino' : full.basica.sexo} />
                </div>
              </TabsContent>

              <TabsContent value="direccion" className="pt-4 space-y-4">
                {!readOnly && (
                  <SectionValidationBar
                    state={getValidationState(bitacora, 'comprador_direccion', { idPersona: safeSelectedId })}
                    busy={appendMutation.isPending}
                    disabledReason={columnaFaltante ? 'Bitácora no habilitada en BD.' : undefined}
                    onValidate={() => validate('comprador_direccion', 'Dirección del comprador')}
                    onReject={() => setRejectFor({ scope: 'comprador_direccion', label: 'Dirección' })}
                  />
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <DrawerKv label="Calle" value={full.direccion.calle} />
                  <DrawerKv label="Núm. exterior" value={full.direccion.numExterior} />
                  <DrawerKv label="Núm. interior" value={full.direccion.numInterior} />
                  <DrawerKv label="Código postal" value={full.direccion.codigoPostal} mono />
                  <DrawerKv label="Colonia" value={full.direccion.colonia} />
                  <DrawerKv label="País" value={full.direccion.paisNombre} />
                  <DrawerKv label="Estado" value={full.direccion.estadoNombre} />
                  <DrawerKv label="Municipio" value={full.direccion.municipioNombre} />
                </div>
              </TabsContent>

              <TabsContent value="fiscal" className="pt-4 space-y-4">
                {!readOnly && (
                  <SectionValidationBar
                    state={getValidationState(bitacora, 'comprador_fiscal', { idPersona: safeSelectedId })}
                    busy={appendMutation.isPending}
                    disabledReason={columnaFaltante ? 'Bitácora no habilitada en BD.' : undefined}
                    onValidate={() => validate('comprador_fiscal', 'Información fiscal del comprador')}
                    onReject={() => setRejectFor({ scope: 'comprador_fiscal', label: 'Información fiscal' })}
                  />
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <DrawerKv label="Régimen" value={full.fiscal.regimenNombre ?? full.fiscal.regimenCodigo} />
                  <DrawerKv label="Uso de CFDI" value={full.fiscal.usoCfdiNombre ?? full.fiscal.usoCfdiCodigo} />
                  <DrawerKv label="Estado civil" value={full.fiscal.estadoCivilNombre} />
                  <DrawerKv label="Tipo de identificación" value={full.fiscal.tipoIdentificacionNombre} />
                  <DrawerKv
                    label="Fecha de nacimiento"
                    value={full.fiscal.fechaNacimiento ? new Date(full.fiscal.fechaNacimiento).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : null}
                  />
                  <DrawerKv label="País nacimiento" value={full.fiscal.paisNacimientoNombre} />
                  <DrawerKv label="Estado nacimiento" value={full.fiscal.estadoNacimientoNombre} />
                  <DrawerKv label="Municipio nacimiento" value={full.fiscal.municipioNacimientoNombre} />
                  <DrawerKv label="Ocupación" value={full.fiscal.ocupacion} />
                </div>
              </TabsContent>

              <TabsContent value="documentos" className="pt-4">
                {full.documentos.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground italic">Documentación pendiente de cargar.</p>
                ) : (
                  <div className="space-y-2">
                    {full.documentos.map((doc) => {
                      const docState = getValidationState(bitacora, 'documento', { idPersona: safeSelectedId, idDocumento: doc.id });
                      return (
                        <div key={doc.id} className="rounded-lg border p-2.5 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0 flex-1">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                              <span className="text-[13px] truncate">{doc.tipoDocumentoNombre}</span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary shrink-0">
                                <Eye className="h-3 w-3" /> Ver
                              </span>
                            </a>
                            <ValidationStatusBadge status={docState.status} />
                          </div>
                          {!readOnly && (
                            <div className="flex items-center justify-between mt-2 gap-2">
                              {docState.lastEntry?.tipo === 'rechazo' && (
                                <p className="text-[11px] text-destructive flex-1 min-w-0 truncate">Rechazo: {docState.lastEntry.mensaje}</p>
                              )}
                              <div className="flex gap-1.5 ml-auto">
                                <Button
                                  size="sm"
                                  variant={docState.status === 'validado' ? 'outline' : 'default'}
                                  className="h-7 px-2 text-[11px] gap-1"
                                  disabled={appendMutation.isPending || columnaFaltante}
                                  onClick={() => validate('documento', doc.tipoDocumentoNombre, { idDocumento: doc.id })}
                                >
                                  <CheckCircle className="h-3 w-3" /> Validar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px] gap-1 border-destructive/40 text-destructive hover:bg-destructive/5"
                                  disabled={appendMutation.isPending || columnaFaltante}
                                  onClick={() => setRejectFor({ scope: 'documento', idDocumento: doc.id, label: doc.tipoDocumentoNombre })}
                                >
                                  <XCircle className="h-3 w-3" /> Rechazar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="cuentas" className="pt-4">
                {full.cuentasBancarias.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground italic">Sin cuentas bancarias registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {full.cuentasBancarias.map((c) => (
                      <div key={c.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-semibold">{c.bancoNombre || 'Banco no especificado'}</span>
                          {c.titular && <span className="text-[11px] text-muted-foreground">Titular: {c.titular}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          <DrawerKv label="Cuenta" value={c.numeroCuenta} mono />
                          <DrawerKv label="CLABE" value={c.cuentaClabe} mono />
                          {c.cuentaSwift && <DrawerKv label="SWIFT" value={c.cuentaSwift} mono />}
                        </div>
                        {c.urlEvidencia && (
                          <a href={c.urlEvidencia} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
                            <FileText className="h-3 w-3" /> Ver evidencia
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-[13px] text-muted-foreground">No se encontró información detallada del comprador.</p>
          )}

          {!readOnly && columnaFaltante && (
            <div className="rounded-lg border border-[hsl(var(--status-warning)/0.4)] bg-[hsl(var(--status-warning)/0.08)] px-3 py-2 text-[12px] text-[hsl(var(--status-warning))] flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5" />
              La bitácora en BD aún no está habilitada. No se pueden registrar validaciones.
            </div>
          )}
        </div>
      </SheetContent>

      {!readOnly && (
      <Dialog open={!!rejectFor} onOpenChange={(o) => { if (!o) { setRejectFor(null); setRejectJustification(''); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Rechazar {rejectFor?.label}</DialogTitle>
            <DialogDescription className="text-[13px]">Esta nota se registrará en la bitácora de la cuenta de cobranza.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-[13px]">Justificación del rechazo</Label>
            <Textarea
              placeholder="Describe por qué se rechaza…"
              value={rejectJustification}
              onChange={(e) => setRejectJustification(e.target.value)}
              className="min-h-[100px] text-[13px]"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectFor(null); setRejectJustification(''); }} className="h-9 text-[13px]">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={submitReject} disabled={!rejectJustification.trim() || appendMutation.isPending} className="h-9 text-[13px] gap-1">
              <XCircle className="h-3.5 w-3.5" /> Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </Sheet>
  );
}

function SectionValidationBar({
  state, busy, disabledReason, onValidate, onReject,
}: {
  state: ReturnType<typeof getValidationState>;
  busy: boolean;
  disabledReason?: string;
  onValidate: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <ValidationStatusBadge status={state.status} />
        {state.lastEntry?.tipo === 'rechazo' && (
          <p className="text-[11px] text-destructive truncate">Rechazo: {state.lastEntry.mensaje}</p>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Button
          size="sm"
          variant={state.status === 'validado' ? 'outline' : 'default'}
          className="h-7 px-2 text-[11px] gap-1"
          disabled={busy || !!disabledReason}
          title={disabledReason}
          onClick={onValidate}
        >
          <CheckCircle className="h-3 w-3" /> Validar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px] gap-1 border-destructive/40 text-destructive hover:bg-destructive/5"
          disabled={busy || !!disabledReason}
          title={disabledReason}
          onClick={onReject}
        >
          <XCircle className="h-3 w-3" /> Rechazar
        </Button>
      </div>
    </div>
  );
}

function ValidationStatusBadge({ status }: { status: ValidationStatus }) {
  if (status === 'validado') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
        <CheckCircle className="h-3 w-3" /> Validado
      </span>
    );
  }
  if (status === 'rechazado') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
        <XCircle className="h-3 w-3" /> Rechazado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]">
      <ShieldAlert className="h-3 w-3" /> Pendiente
    </span>
  );
}

function DrawerKv({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">{label}</p>
      <p className={`text-[13px] ${mono ? 'font-mono' : ''} ${value ? 'text-foreground' : 'text-muted-foreground italic'}`}>
        {value || '—'}
      </p>
    </div>
  );
}
