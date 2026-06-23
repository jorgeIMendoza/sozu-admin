/**
 * Documentos del expediente (nivel cuenta de cobranza) — Portal Legal Flow.
 *
 * Muestra los documentos ligados a la cuenta con su estatus de verificación,
 * permite subir SOLO dos tipos (Contrato firmado completamente / Convenio
 * modificatorio), verificar (validar/rechazar) cada documento y consultar el
 * historial de verificaciones.
 *
 * La verificación reutiliza la bitácora de la cuenta (`legal_flow_bitacora`,
 * scope `documento`) — mismo mecanismo que `CompradorDetalleSheet`, pero a
 * nivel cuenta (sin `id_persona`). El estatus autoritativo se lee/escribe en
 * `documentos.id_estatus_verificacion` (1=Pendiente, 2=Validado, 3=Rechazado).
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Eye, CheckCircle, XCircle, ShieldAlert, Upload, Loader2,
  History as HistoryIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  useBitacoraCuentaCobranza,
  useAppendBitacoraEntry,
  type ValidationStatus,
} from '@/hooks/useBitacoraCuentaCobranza';

/** Tipos de documento que se permiten SUBIR desde el expediente. */
const UPLOAD_DOC_TYPES = [
  { id: 18, label: 'Contrato firmado completamente' },
  { id: 56, label: 'Convenio modificatorio' },
] as const;

const ESTATUS_MAP: Record<number, ValidationStatus> = { 1: 'pendiente', 2: 'validado', 3: 'rechazado' };

type DocItem = {
  id: number;
  idTipo: number;
  tipoNombre: string;
  estatus: ValidationStatus;
  url: string | null;
  numero: string | null;
  fecha: string | null;
};

const fmtFechaHora = (value: string) =>
  new Date(value).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function pgErrorMessage(err: unknown): string {
  if (!err) return 'Error desconocido.';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code].filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );
    if (parts.length > 0) return parts.join(' — ');
  }
  return 'Error desconocido.';
}

async function fetchDocumentos(cuentaId: number): Promise<DocItem[]> {
  const { data, error } = await (supabase as any)
    .from('documentos')
    .select('id, id_tipo_documento, id_estatus_verificacion, url, numero, fecha_creacion')
    .eq('id_cuenta_cobranza', cuentaId)
    .eq('activo', true)
    .order('id', { ascending: true });
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as any[];

  const tipoIds = [...new Set(rows.map((r) => r.id_tipo_documento).filter(Boolean))] as number[];
  const tipoById = new Map<number, string>();
  if (tipoIds.length) {
    const { data: tipos } = await (supabase as any)
      .from('tipos_documento').select('id, nombre').in('id', tipoIds);
    for (const t of (tipos || [])) tipoById.set(t.id, t.nombre);
  }

  return rows.map((r) => ({
    id: r.id,
    idTipo: r.id_tipo_documento,
    tipoNombre: tipoById.get(r.id_tipo_documento) || `Documento #${r.id_tipo_documento}`,
    estatus: ESTATUS_MAP[r.id_estatus_verificacion as number] ?? 'pendiente',
    url: r.url ?? null,
    numero: r.numero ?? null,
    fecha: r.fecha_creacion ?? null,
  }));
}

export function ExpedienteDocumentos({ cuentaId }: { cuentaId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['expediente-documentos', cuentaId],
    queryFn: () => fetchDocumentos(cuentaId),
    staleTime: 30_000,
  });

  const { entries: bitacora, columnaFaltante } = useBitacoraCuentaCobranza(cuentaId);
  const appendMutation = useAppendBitacoraEntry(cuentaId);

  const [uploadType, setUploadType] = useState<typeof UPLOAD_DOC_TYPES[number] | null>(null);
  const [rejectFor, setRejectFor] = useState<DocItem | null>(null);
  const [rejectJustification, setRejectJustification] = useState('');
  const [busyDocId, setBusyDocId] = useState<number | null>(null);

  // Historial de verificaciones: entradas de bitácora con scope `documento`,
  // de la más reciente a la más antigua.
  const historial = useMemo(() => {
    const nombrePorDoc = new Map(documentos.map((d) => [d.id, d.tipoNombre] as const));
    return bitacora
      .filter((e) => e.referencia?.scope === 'documento' && (e.tipo === 'validacion' || e.tipo === 'rechazo'))
      .map((e) => ({
        id: e.id,
        tipo: e.tipo as 'validacion' | 'rechazo',
        docNombre: e.referencia?.idDocumento != null ? (nombrePorDoc.get(e.referencia.idDocumento) || 'Documento') : 'Documento',
        mensaje: e.mensaje,
        autor: e.autorNombre || e.autorEmail,
        timestamp: e.timestamp,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [bitacora, documentos]);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['expediente-documentos', cuentaId] });
    queryClient.invalidateQueries({ queryKey: ['legal-flow-escrituracion-expedientes'] });
  };

  const syncEstatus = async (idDocumento: number, nuevoEstatus: 1 | 2 | 3) => {
    const { error } = await (supabase as any)
      .from('documentos')
      .update({ id_estatus_verificacion: nuevoEstatus })
      .eq('id', idDocumento);
    if (error) throw error;
  };

  const validar = (doc: DocItem) => {
    if (columnaFaltante) return;
    setBusyDocId(doc.id);
    appendMutation.mutate(
      { tipo: 'validacion', mensaje: `Validó: ${doc.tipoNombre}`, referencia: { scope: 'documento', idDocumento: doc.id } },
      {
        onSuccess: async () => {
          try { await syncEstatus(doc.id, 2); } catch (err) {
            toast({ title: 'Bitácora guardada, pero el documento no se sincronizó', description: pgErrorMessage(err), variant: 'destructive' });
          }
          refrescar();
        },
        onError: (err) => toast({ title: 'No se pudo validar', description: pgErrorMessage(err), variant: 'destructive' }),
        onSettled: () => setBusyDocId(null),
      },
    );
  };

  const confirmarRechazo = () => {
    if (!rejectFor || !rejectJustification.trim()) return;
    const doc = rejectFor;
    setBusyDocId(doc.id);
    appendMutation.mutate(
      { tipo: 'rechazo', mensaje: rejectJustification.trim(), referencia: { scope: 'documento', idDocumento: doc.id } },
      {
        onSuccess: async () => {
          try { await syncEstatus(doc.id, 3); } catch (err) {
            toast({ title: 'Bitácora guardada, pero el documento no se sincronizó', description: pgErrorMessage(err), variant: 'destructive' });
          }
          setRejectFor(null);
          setRejectJustification('');
          refrescar();
        },
        onError: (err) => toast({ title: 'No se pudo rechazar', description: pgErrorMessage(err), variant: 'destructive' }),
        onSettled: () => setBusyDocId(null),
      },
    );
  };

  return (
    <div className="mt-4 space-y-4">
      {/* ── Botones de subida (solo 2 tipos permitidos) ── */}
      <div className="flex flex-wrap gap-2">
        {UPLOAD_DOC_TYPES.map((t) => (
          <Button key={t.id} size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={() => setUploadType(t)}>
            <Upload className="h-3.5 w-3.5" /> Subir {t.label}
          </Button>
        ))}
      </div>

      {/* ── Lista de documentos ── */}
      {isLoading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando documentos…
        </div>
      ) : documentos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
          Sin documentos ligados a esta cuenta.
        </div>
      ) : (
        <div className="space-y-2">
          {documentos.map((doc) => {
            const busy = busyDocId === doc.id && appendMutation.isPending;
            return (
              <div key={doc.id} className="rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      <span className="truncate text-[13px]">{doc.tipoNombre}{doc.numero ? ` · ${doc.numero}` : ''}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
                        <Eye className="h-3 w-3" /> Ver
                      </span>
                    </a>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      <span className="truncate text-[13px]">{doc.tipoNombre}{doc.numero ? ` · ${doc.numero}` : ''}</span>
                    </div>
                  )}
                  <StatusBadge status={doc.estatus} />
                </div>
                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant={doc.estatus === 'validado' ? 'outline' : 'default'}
                    className="h-7 gap-1 px-2 text-[11px]"
                    disabled={busy || columnaFaltante}
                    title={columnaFaltante ? 'Bitácora no habilitada en BD.' : undefined}
                    onClick={() => validar(doc)}
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Validar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-destructive/40 px-2 text-[11px] text-destructive hover:bg-destructive/5"
                    disabled={busy || columnaFaltante}
                    title={columnaFaltante ? 'Bitácora no habilitada en BD.' : undefined}
                    onClick={() => { setRejectFor(doc); setRejectJustification(''); }}
                  >
                    <XCircle className="h-3 w-3" /> Rechazar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {columnaFaltante && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <ShieldAlert className="h-3.5 w-3.5" />
          La bitácora no está habilitada en este ambiente; no se pueden registrar verificaciones.
        </div>
      )}

      {/* ── Historial de verificaciones ── */}
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
          <HistoryIcon className="h-3.5 w-3.5 text-primary" /> Historial de verificaciones
        </h4>
        {historial.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 py-4 text-center text-[12px] text-muted-foreground">
            Aún no hay verificaciones registradas.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {historial.map((h) => (
              <li key={h.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                    h.tipo === 'validacion' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {h.tipo === 'validacion' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {h.tipo === 'validacion' ? 'Validado' : 'Rechazado'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{fmtFechaHora(h.timestamp)}</span>
                </div>
                <p className="mt-1 text-[12px] font-medium">{h.docNombre}</p>
                {h.mensaje && <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-muted-foreground">{h.mensaje}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">— {h.autor}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Diálogo de subida ── */}
      <SubirDocumentoDialog
        cuentaId={cuentaId}
        tipo={uploadType}
        onOpenChange={(o) => { if (!o) setUploadType(null); }}
        onUploaded={() => { setUploadType(null); refrescar(); }}
      />

      {/* ── Diálogo de rechazo ── */}
      <Dialog open={!!rejectFor} onOpenChange={(o) => { if (!o) { setRejectFor(null); setRejectJustification(''); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Rechazar {rejectFor?.tipoNombre}</DialogTitle>
            <DialogDescription className="text-[13px]">Esta nota se registrará en el historial de verificaciones.</DialogDescription>
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
            <Button variant="destructive" onClick={confirmarRechazo} disabled={!rejectJustification.trim() || appendMutation.isPending} className="h-9 gap-1 text-[13px]">
              {appendMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: ValidationStatus }) {
  if (status === 'validado') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
        <CheckCircle className="h-3 w-3" /> Validado
      </span>
    );
  }
  if (status === 'rechazado') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
        <XCircle className="h-3 w-3" /> Rechazado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
      <ShieldAlert className="h-3 w-3" /> Pendiente
    </span>
  );
}

/**
 * Diálogo de subida de un documento (PDF) a Storage + alta en `documentos`.
 * El documento nace en estatus Pendiente (1) para que pase por verificación.
 */
function SubirDocumentoDialog({
  cuentaId, tipo, onOpenChange, onUploaded,
}: {
  cuentaId: number;
  tipo: typeof UPLOAD_DOC_TYPES[number] | null;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [numero, setNumero] = useState('');
  const [uploading, setUploading] = useState(false);

  const reset = () => { setFile(null); setNumero(''); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      toast({ title: 'Formato no válido', description: 'Solo se permiten archivos PDF.', variant: 'destructive' });
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'El archivo no debe exceder 10MB.', variant: 'destructive' });
      return;
    }
    setFile(f);
  };

  const subir = async () => {
    if (!file || !tipo) return;
    setUploading(true);
    try {
      const fileName = `expediente_${tipo.id}_${cuentaId}_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage.from('documentos').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(fileName);

      const { error: insertError } = await (supabase as any)
        .from('documentos')
        .insert({
          id_cuenta_cobranza: cuentaId,
          id_tipo_documento: tipo.id,
          url: publicUrl,
          numero: numero.trim() || null,
          id_estatus_verificacion: 1, // Pendiente — debe verificarse
          es_draft: false,
          activo: true,
        });
      if (insertError) throw insertError;

      toast({ title: 'Documento subido', description: `${tipo.label} quedó registrado como Pendiente de verificación.` });
      reset();
      onUploaded();
    } catch (err) {
      toast({ title: 'No se pudo subir el documento', description: pgErrorMessage(err), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={!!tipo} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[16px]">
            <Upload className="h-4 w-4 text-primary" /> Subir {tipo?.label}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Sube el documento en formato PDF (máx. 10MB) para esta cuenta de cobranza.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Número / referencia <span className="text-muted-foreground">(opcional)</span></Label>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej: CONV-2024-001" disabled={uploading} className="text-[13px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Archivo PDF *</Label>
            <Input type="file" accept=".pdf" onChange={handleFile} disabled={uploading} className="cursor-pointer text-[13px]" />
            {file && (
              <p className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading} className="h-9 text-[13px]">Cancelar</Button>
          <Button onClick={subir} disabled={!file || uploading} className="h-9 gap-1.5 text-[13px]">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
