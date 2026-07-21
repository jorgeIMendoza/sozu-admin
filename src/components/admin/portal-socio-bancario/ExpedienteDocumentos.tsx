/**
 * Documentos del expediente (nivel cuenta de cobranza) — Portal Legal Flow.
 *
 * Muestra los documentos ligados a la cuenta con su estatus de verificación,
 * permite subir/actualizar SOLO dos tipos (Contrato firmado completamente /
 * Convenio modificatorio), verificar (validar/rechazar) cada documento y
 * consultar el historial de verificaciones.
 *
 * Persistencia idéntica al modal de "editar cuenta de cobranza · Documentos":
 *   - estatus autoritativo en `documentos.id_estatus_verificacion`
 *     (1=Pendiente, 2=Validado, 3=Rechazado, 4=Expirado)
 *   - bitácora de cambios en `comentarios_verificacion_documento`
 * Así el historial es el mismo en ambas vistas.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Eye, CheckCircle2, XCircle, Upload, Loader2,
  History as HistoryIcon, User as UserIcon, MessageSquare,
  Download, CheckCheck, Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

/** Tipos de documento que se permiten SUBIR/ACTUALIZAR desde el expediente. */
const UPLOAD_DOC_TYPES = [
  { id: 18, label: 'Contrato firmado completamente' },
  { id: 56, label: 'Convenio modificatorio' },
] as const;

type EstatusId = 1 | 2 | 3 | 4;

const STATUS_INFO: Record<number, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; dot: string }> = {
  1: { label: 'Pendiente', variant: 'secondary', dot: 'bg-amber-500' },
  2: { label: 'Validado', variant: 'default', dot: 'bg-emerald-500' },
  3: { label: 'Rechazado', variant: 'destructive', dot: 'bg-rose-500' },
  4: { label: 'Expirado', variant: 'outline', dot: 'bg-muted-foreground' },
};
const statusInfo = (id: number) => STATUS_INFO[id] ?? STATUS_INFO[1];

type DocItem = {
  id: number;
  idTipo: number;
  tipoNombre: string;
  estatus: EstatusId;
  url: string | null;
  numero: string | null;
  fecha: string | null;
};

type HistItem = {
  id: number;
  idDocumento: number;
  docNombre: string;
  estatus: EstatusId;
  comentario: string | null;
  email: string | null;
  fecha: string;
};

const fmtFechaHora = (value: string) =>
  new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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

async function fetchDocsYHistorial(cuentaId: number): Promise<{ docs: DocItem[]; historial: HistItem[] }> {
  const { data: docData, error: docErr } = await (supabase as any)
    .from('documentos')
    .select('id, id_tipo_documento, id_estatus_verificacion, url, numero, fecha_creacion')
    .eq('id_cuenta_cobranza', cuentaId)
    .eq('activo', true)
    .order('id', { ascending: true });
  if (docErr) throw docErr;
  const rows = (Array.isArray(docData) ? docData : []) as any[];

  const tipoIds = [...new Set(rows.map((r) => r.id_tipo_documento).filter(Boolean))] as number[];
  const tipoById = new Map<number, string>();
  if (tipoIds.length) {
    const { data: tipos } = await (supabase as any).from('tipos_documento').select('id, nombre').in('id', tipoIds);
    for (const t of (tipos || [])) tipoById.set(t.id, t.nombre);
  }

  const docs: DocItem[] = rows.map((r) => ({
    id: r.id,
    idTipo: r.id_tipo_documento,
    tipoNombre: tipoById.get(r.id_tipo_documento) || `Documento #${r.id_tipo_documento}`,
    estatus: (r.id_estatus_verificacion as EstatusId) ?? 1,
    url: r.url ?? null,
    numero: r.numero ?? null,
    fecha: r.fecha_creacion ?? null,
  }));

  // Historial de verificaciones — misma tabla que el modal de cuenta.
  const docIds = docs.map((d) => d.id);
  let historial: HistItem[] = [];
  if (docIds.length) {
    const nombrePorDoc = new Map(docs.map((d) => [d.id, d.tipoNombre] as const));
    const { data: hist } = await (supabase as any)
      .from('comentarios_verificacion_documento')
      .select('id, id_documento, id_estatus_verificacion, comentario, email_usuario, fecha_creacion')
      .in('id_documento', docIds)
      .eq('activo', true)
      .order('fecha_creacion', { ascending: false });
    historial = (hist || []).map((h: any) => ({
      id: h.id,
      idDocumento: h.id_documento,
      docNombre: nombrePorDoc.get(h.id_documento) || 'Documento',
      estatus: (h.id_estatus_verificacion as EstatusId) ?? 1,
      comentario: h.comentario ?? null,
      email: h.email_usuario ?? null,
      fecha: h.fecha_creacion,
    }));
  }

  return { docs, historial };
}

export function ExpedienteDocumentos({
  cuentaId,
  propiedadId,
  readOnly = false,
  idProyecto = null,
}: {
  cuentaId: number;
  propiedadId?: number | null;
  /**
   * Modo banco (Portal Socio Bancario): el banco VERIFICA, no valida. Oculta
   * Validar/Rechazar, subir/actualizar y el historial de verificaciones internas
   * (emails de empleados SOZU). Sustituye por acciones de banco: Descargar,
   * Marcar como revisado, Levantar observación.
   */
  readOnly?: boolean;
  /** Desarrollo del socio (requerido para persistir en socio_bancario_revisiones). */
  idProyecto?: number | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['expediente-documentos', cuentaId],
    queryFn: () => fetchDocsYHistorial(cuentaId),
    staleTime: 30_000,
  });
  const documentos = data?.docs ?? [];
  const historial = data?.historial ?? [];

  const [uploadType, setUploadType] = useState<typeof UPLOAD_DOC_TYPES[number] | null>(null);
  const [rejectFor, setRejectFor] = useState<DocItem | null>(null);
  const [rejectJustification, setRejectJustification] = useState('');
  const [busyDocId, setBusyDocId] = useState<number | null>(null);

  // Acciones del banco (solo readOnly). // SWAP POINT: persistir "revisado por
  // banco" y "observación" en una tabla separada (p.ej. socio_bancario_revisiones),
  // NUNCA en la verificación interna de SOZU. Hoy es estado local de sesión.
  const [revisados, setRevisados] = useState<Set<number>>(new Set());
  const [obsFor, setObsFor] = useState<DocItem | null>(null);
  const [obsText, setObsText] = useState('');
  const toggleRevisadoLocal = (id: number) =>
    setRevisados((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Persiste una acción del banco en socio_bancario_revisiones (revisa, NO valida:
  // no toca documentos.id_estatus_verificacion ni la verificación interna de SOZU).
  const persistirRevision = async (
    tipo: "revisado" | "observacion",
    opts: { idDocumento?: number; observacion?: string } = {},
  ): Promise<boolean> => {
    if (idProyecto == null) {
      toast({ title: "Falta el desarrollo", description: "No se pudo asociar la revisión a un desarrollo.", variant: "destructive" });
      return false;
    }
    const { error } = await (supabase as any).from("socio_bancario_revisiones").insert({
      id_documento: opts.idDocumento ?? null,
      id_cuenta_cobranza: cuentaId,
      id_proyecto: idProyecto,
      correo_usuario: user?.email ?? null,
      tipo,
      observacion: opts.observacion ?? null,
    });
    if (error) {
      toast({ title: "No se pudo guardar", description: pgErrorMessage(error), variant: "destructive" });
      return false;
    }
    return true;
  };

  // Documento existente (activo) por cada tipo subible → controla "Subir" vs "Actualizar".
  const existentePorTipo = useMemo(() => {
    const m = new Map<number, DocItem>();
    for (const d of documentos) if (!m.has(d.idTipo)) m.set(d.idTipo, d);
    return m;
  }, [documentos]);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['expediente-documentos', cuentaId] });
    queryClient.invalidateQueries({ queryKey: ['socio-bancario-expedientes'] });
  };

  // Cambia el estatus del documento + registra la entrada en el historial.
  const cambiarEstatus = async (doc: DocItem, nuevoEstatus: EstatusId, comentario: string) => {
    setBusyDocId(doc.id);
    try {
      const { error: upErr } = await (supabase as any)
        .from('documentos').update({ id_estatus_verificacion: nuevoEstatus }).eq('id', doc.id);
      if (upErr) throw upErr;

      const { error: comErr } = await (supabase as any)
        .from('comentarios_verificacion_documento')
        .insert({
          id_documento: doc.id,
          id_estatus_verificacion: nuevoEstatus,
          comentario: comentario || `Estatus cambiado a ${statusInfo(nuevoEstatus).label}`,
          email_usuario: user?.email || null,
          activo: true,
        });
      if (comErr) throw comErr;

      toast({ title: nuevoEstatus === 2 ? 'Documento validado' : 'Documento rechazado' });
      refrescar();
    } catch (err) {
      toast({ title: 'No se pudo actualizar el estatus', description: pgErrorMessage(err), variant: 'destructive' });
    } finally {
      setBusyDocId(null);
    }
  };

  const confirmarRechazo = async () => {
    if (!rejectFor || !rejectJustification.trim()) return;
    const doc = rejectFor;
    await cambiarEstatus(doc, 3, rejectJustification.trim());
    setRejectFor(null);
    setRejectJustification('');
  };

  return (
    <div className="mt-4 space-y-5">
      {/* ── Botones de subida (solo 2 tipos permitidos) — ocultos para el banco ── */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {UPLOAD_DOC_TYPES.map((t) => {
            const existe = existentePorTipo.has(t.id);
            return (
              <Button
                key={t.id}
                size="sm"
                variant="outline"
                className="h-9 gap-2 rounded-lg border-dashed text-[12px] font-medium"
                onClick={() => setUploadType(t)}
              >
                <Upload className="h-3.5 w-3.5" /> {existe ? 'Actualizar' : 'Subir'} {t.label}
              </Button>
            );
          })}
        </div>
      )}

      {/* ── Lista de documentos ── */}
      {isLoading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando documentos…
        </div>
      ) : documentos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
          Sin documentos ligados a esta cuenta.
        </div>
      ) : (
        <div className="space-y-2.5">
          {documentos.map((doc) => {
            const si = statusInfo(doc.estatus);
            const busy = busyDocId === doc.id;
            return (
              <div key={doc.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-colors hover:border-border">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{doc.tipoNombre}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {doc.numero && <span className="font-mono">{doc.numero}</span>}
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                        <Eye className="h-3 w-3" /> Ver documento
                      </a>
                    )}
                  </div>
                </div>

                <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                  doc.estatus === 2 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : doc.estatus === 3 ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                  : doc.estatus === 4 ? 'bg-muted text-muted-foreground'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', si.dot)} /> {si.label}
                </span>

                {readOnly ? (
                  // Acciones del BANCO: verificar (no validar). Descargar, marcar
                  // revisado y levantar observación. La validación interna de SOZU
                  // no se expone; solo se muestra el estatus (badge de arriba).
                  <div className="flex shrink-0 items-center gap-2">
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-medium hover:bg-muted"
                      >
                        <Download className="h-3.5 w-3.5" /> Descargar
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant={revisados.has(doc.id) ? 'default' : 'outline'}
                      className="h-8 gap-1.5 rounded-lg px-3 text-[12px] font-medium"
                      onClick={async () => {
                        if (revisados.has(doc.id)) { toggleRevisadoLocal(doc.id); return; }
                        const ok = await persistirRevision('revisado', { idDocumento: doc.id });
                        if (ok) { toggleRevisadoLocal(doc.id); toast({ title: 'Documento marcado como revisado' }); }
                      }}
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> {revisados.has(doc.id) ? 'Revisado' : 'Marcar revisado'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 rounded-lg px-3 text-[12px] font-medium"
                      onClick={() => { setObsFor(doc); setObsText(''); }}
                    >
                      <Flag className="h-3.5 w-3.5" /> Observación
                    </Button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
                      disabled={busy || doc.estatus === 2}
                      onClick={() => cambiarEstatus(doc, 2, 'Documento validado')}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Validar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 rounded-lg border-rose-200 px-3 text-[12px] font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 dark:border-rose-900/40 dark:hover:bg-rose-950/30"
                      disabled={busy || doc.estatus === 3}
                      onClick={() => { setRejectFor(doc); setRejectJustification(''); }}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Rechazar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Historial de verificaciones interno (emails de empleados SOZU) ──
          OCULTO para el banco (minimización de PII / LFPDPPP). */}
      {!readOnly && (
      <div>
        <h4 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
          <HistoryIcon className="h-4 w-4 text-primary" /> Historial de verificaciones
        </h4>
        {historial.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 py-8 text-center">
            <MessageSquare className="mx-auto mb-2 h-9 w-9 text-muted-foreground/50" />
            <p className="text-[12px] text-muted-foreground">No hay historial de verificaciones.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {historial.map((h) => (
              <div key={h.id} className="space-y-2 rounded-xl border border-border/60 bg-card p-3.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusInfo(h.estatus).variant}>{statusInfo(h.estatus).label}</Badge>
                    <span className="text-[12px] font-medium text-muted-foreground">{h.docNombre}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{fmtFechaHora(h.fecha)}</span>
                </div>
                {h.comentario && <p className="text-[12px] text-foreground/90">{h.comentario}</p>}
                {h.email && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <UserIcon className="h-3 w-3" /> <span>{h.email}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ── Diálogo de observación del banco (readOnly) ── */}
      <Dialog open={!!obsFor} onOpenChange={(o) => { if (!o) { setObsFor(null); setObsText(''); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Levantar observación</DialogTitle>
            <DialogDescription className="text-[13px]">
              {obsFor?.tipoNombre}. La observación se comparte con SOZU para su atención.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-[13px]">Observación <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Describe la observación sobre este documento…"
              value={obsText}
              onChange={(e) => setObsText(e.target.value)}
              className="min-h-[100px] text-[13px]"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9 text-[13px]" onClick={() => { setObsFor(null); setObsText(''); }}>
              Cancelar
            </Button>
            <Button
              className="h-9 gap-1.5 text-[13px]"
              disabled={!obsText.trim()}
              onClick={async () => {
                // Persiste en socio_bancario_revisiones (tabla separada de la
                // verificación interna de SOZU).
                const ok = await persistirRevision('observacion', {
                  idDocumento: obsFor?.id,
                  observacion: obsText.trim(),
                });
                if (ok) {
                  toast({ title: 'Observación registrada', description: 'Se compartió con SOZU para su atención.' });
                  setObsFor(null);
                  setObsText('');
                }
              }}
            >
              <Flag className="h-3.5 w-3.5" /> Enviar observación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo de subida / actualización ── */}
      <SubirDocumentoDialog
        cuentaId={cuentaId}
        propiedadId={propiedadId ?? null}
        tipo={uploadType}
        existente={uploadType ? existentePorTipo.get(uploadType.id) ?? null : null}
        emailUsuario={user?.email || null}
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
            <Label className="text-[13px]">Justificación del rechazo <span className="text-destructive">*</span></Label>
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
            <Button variant="destructive" onClick={confirmarRechazo} disabled={!rejectJustification.trim() || busyDocId != null} className="h-9 gap-1 text-[13px]">
              {busyDocId != null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Diálogo de subida/actualización de un documento (PDF).
 * - Documento NUEVO (no existe ese tipo): se inserta en estatus Pendiente.
 * - Actualizar (ya existe): solo se reemplaza el archivo (url/número),
 *   CONSERVANDO su estatus de verificación actual — no se degrada a Pendiente.
 * Se fija `id_propiedad` para que la notificación por correo resuelva el
 * número de departamento y el proyecto. En ambos casos se registra una entrada
 * en el historial de verificaciones.
 */
function SubirDocumentoDialog({
  cuentaId, propiedadId, tipo, existente, emailUsuario, onOpenChange, onUploaded,
}: {
  cuentaId: number;
  propiedadId: number | null;
  tipo: typeof UPLOAD_DOC_TYPES[number] | null;
  existente: DocItem | null;
  emailUsuario: string | null;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [numero, setNumero] = useState('');
  const [uploading, setUploading] = useState(false);
  const esActualizar = !!existente;

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

      let docId: number;
      let estatusFinal: EstatusId;
      if (existente) {
        // Actualizar: reemplaza el archivo CONSERVANDO el estatus actual.
        const updatePayload: Record<string, unknown> = { url: publicUrl, numero: numero.trim() || null };
        if (propiedadId != null) updatePayload.id_propiedad = propiedadId;
        const { error: upErr } = await (supabase as any)
          .from('documentos')
          .update(updatePayload)
          .eq('id', existente.id);
        if (upErr) throw upErr;
        docId = existente.id;
        estatusFinal = existente.estatus;
      } else {
        // Nuevo: nace en Pendiente. id_propiedad permite resolver depto/proyecto
        // en la notificación por correo (trigger after_documento_legal_subido).
        const { data: ins, error: insErr } = await (supabase as any)
          .from('documentos')
          .insert({
            id_cuenta_cobranza: cuentaId,
            id_propiedad: propiedadId ?? null,
            id_tipo_documento: tipo.id,
            url: publicUrl,
            numero: numero.trim() || null,
            id_estatus_verificacion: 1, // Pendiente — debe verificarse
            es_draft: false,
            activo: true,
          })
          .select('id')
          .single();
        if (insErr) throw insErr;
        docId = ins.id;
        estatusFinal = 1;
      }

      // Registrar en el historial de verificaciones (refleja el estatus final).
      await (supabase as any).from('comentarios_verificacion_documento').insert({
        id_documento: docId,
        id_estatus_verificacion: estatusFinal,
        comentario: esActualizar ? 'Archivo del documento reemplazado' : 'Documento subido (pendiente de verificación)',
        email_usuario: emailUsuario,
        activo: true,
      });

      toast({
        title: esActualizar ? 'Documento actualizado' : 'Documento subido',
        description: esActualizar ? `Se reemplazó el archivo de ${tipo.label}.` : `${tipo.label} quedó como Pendiente de verificación.`,
      });
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
            <Upload className="h-4 w-4 text-primary" /> {esActualizar ? 'Actualizar' : 'Subir'} {tipo?.label}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {esActualizar
              ? 'Reemplaza el archivo del documento actual. Conserva su estatus de verificación.'
              : 'Sube el documento en formato PDF (máx. 10MB) para esta cuenta de cobranza.'}
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
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading} className="h-9 text-[13px]">Cancelar</Button>
          <Button onClick={subir} disabled={!file || uploading} className="h-9 gap-1.5 text-[13px]">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {esActualizar ? 'Actualizar' : 'Subir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
