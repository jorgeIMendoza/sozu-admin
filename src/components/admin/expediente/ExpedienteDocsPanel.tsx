import { ClienteINECameraCapture } from '@/components/admin/portal-cliente/ClienteINECameraCapture';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FIELD_LABEL_CLS, MODAL_BODY_CLS, MODAL_FOOTER_CLS, ModalFormHeader } from '@/components/ui/modal-form';
import { ModalViewer } from '@/components/ui/modal-viewer';
import { OptImg } from '@/components/ui/opt-img';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select';
import { useIsMobile } from '@/hooks/use-mobile';
import { useExpedienteDocs, type ExpDocEstado } from '@/hooks/useExpedienteDocs';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { extractCSFFields } from '@/utils/pdfDocumentExtractors';
import { validateCSFPdf } from '@/utils/pdfDocumentValidators';
import { extractPdfText } from '@/utils/pdfText';
import { matchRegimenId } from '@/utils/regimenMatch';
import { useQuery } from '@tanstack/react-query';
import { Camera, Eye, Loader2, PenLine, Pencil, Upload, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * Panel de documentos del expediente (fuente única de la validación de documentos
 * en los portales: agente, embajador…).
 *
 * Resuelve por documento: estatus (validado / en revisión / rechazado / expirado),
 * captura por cámara de la identidad (INE frente+reverso o pasaporte), subida de
 * PDF, flujo especial de la Constancia de Situación Fiscal (si el PDF trae texto:
 * extrae datos → modal de confirmación → documento validado + datos fiscales en
 * `personas`; si no: se sube igual y queda pendiente de validación), firma digital
 * delegada al llamador y visores in-app.
 */

export const INE_TIPOS = [2, 3];
export const PASAPORTE_TIPO = 4;
export const CSF_TIPO = 6;

/** Valor centinela de "vacío" en el select de régimen. */
const NO_REGIMEN = '__none__';

const IDENTITY_META = {
  ine: { nombre: 'INE', emisor: 'INE', hint: 'Frente y reverso', tipos: INE_TIPOS },
  pasaporte: { nombre: 'Pasaporte', emisor: 'SRE', hint: 'Página de datos (vigente)', tipos: [PASAPORTE_TIPO] },
} as const;

export type ExpDocKind =
  /** INE (frente+reverso) o pasaporte, con selector y captura por cámara. */
  | 'identity'
  /** PDF subido a `documentos`. */
  | 'pdf'
  /** Se firma digitalmente; la acción la resuelve el llamador (`onFirma`). */
  | 'firma'
  /** El archivo vive fuera de `documentos` (p. ej. carátula de la cuenta bancaria). */
  | 'external';

export interface ExpDocDef {
  key: string;
  /** Etiqueta. En 'identity' es opcional: por defecto "INE" / "Pasaporte". */
  nombre?: string;
  emisor?: string;
  hint?: string;
  /** Tipos de `tipos_documento`. Vacío en 'identity' (los pone el panel) y en 'external'. */
  tipos?: number[];
  kind: ExpDocKind;
  /** PDF de la Constancia: extrae y confirma datos fiscales antes de guardar. */
  csf?: boolean;
  /** El dato y la acción los provee el llamador. Obligatorio en 'external'; en
   *  'firma' permite colgar el documento de `firmas_digitales` en vez de `documentos`. */
  external?: {
    url: string | null;
    estado: ExpDocEstado;
    onAction: () => void;
    actionTitle?: string;
    /** Etiqueta propia de la píldora (p. ej. "Pendiente contraparte"). */
    badgeLabel?: string;
  };
}

const BADGE: Record<ExpDocEstado, { label: string; color: string; bg: string }> = {
  validado: { label: 'Validado', color: 'text-primary', bg: 'bg-primary/10' },
  revision: { label: 'En revisión', color: 'text-amber-700', bg: 'bg-amber-100' },
  rechazado: { label: 'Rechazado', color: 'text-destructive', bg: 'bg-destructive/10' },
  expirado: { label: 'Expirado', color: 'text-muted-foreground', bg: 'bg-muted' },
  pendiente: { label: 'Pendiente', color: 'text-muted-foreground', bg: 'bg-muted' },
};

/** Extrae el texto de un PDF (constancia SAT) en el navegador con pdf.js. */
/** Zona profesional de subida: arrastra o selecciona (PDF). */
export function DocDropzone({ accept, uploading, onFile }: { accept: string; uploading: boolean; onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (accept.includes('.pdf') && f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Solo se permiten archivos PDF.');
      return;
    }
    onFile(f);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors',
        drag ? 'border-primary bg-primary/5' : 'border-border bg-muted hover:border-primary',
      )}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="h-8 w-8 text-primary" strokeWidth={1.6} />}
      <div>
        <p className="text-sm font-bold text-foreground">{uploading ? 'Subiendo…' : 'Arrastra el archivo aquí'}</p>
        <p className="mt-1 text-xs font-medium text-muted-foreground/70">o haz clic para seleccionar · Solo PDF</p>
      </div>
    </div>
  );
}

interface Props {
  personaId?: number | null;
  docs: ExpDocDef[];
  /** Sin permiso de edición solo se puede consultar. */
  canUpdate?: boolean;
  /** Comparte caché/invalidación con la página que ya consulta estos documentos. */
  docsQueryKey?: unknown[];
  /** Tipos a consultar. Por defecto los de `docs`; se fija cuando la página comparte
   *  la misma queryKey y necesita un conjunto estable (p. ej. incluir la carta 48
   *  aunque no se muestre para agentes dependientes). */
  queryTipos?: number[];
  /** Acción de los documentos con firma digital (la resuelve el portal). */
  onFirma?: (doc: ExpDocDef) => void;
  /** Aviso ámbar mientras no exista una identidad vigente. */
  showIdentityNotice?: boolean;
  /** Numeración a la izquierda de cada fila (expediente del agente). */
  numbered?: boolean;
  /** Se dispara tras cualquier alta/reemplazo (para refrescar datos del portal). */
  onChanged?: () => void;
  className?: string;
}

export function ExpedienteDocsPanel({
  personaId,
  docs,
  canUpdate = true,
  docsQueryKey,
  queryTipos,
  onFirma,
  showIdentityNotice = true,
  numbered = true,
  onChanged,
  className,
}: Props) {
  const isMobile = useIsMobile();

  const hasIdentity = docs.some((d) => d.kind === 'identity');
  const tipos = useMemo(() => {
    if (queryTipos) return queryTipos;
    const set = new Set<number>();
    docs.forEach((d) => {
      if (d.kind === 'identity') { INE_TIPOS.forEach((t) => set.add(t)); set.add(PASAPORTE_TIPO); }
      (d.tipos ?? []).forEach((t) => set.add(t));
    });
    return [...set].sort((a, b) => a - b);
  }, [docs, queryTipos]);

  const { tipoRow, tipoEstado, uploading, uploadDocFile, invalidate, isLoading } = useExpedienteDocs({
    personaId,
    tipos,
    queryKey: docsQueryKey,
  });

  const [identitySel, setIdentitySel] = useState<'ine' | 'pasaporte'>('ine');
  const [ineCaptureOpen, setIneCaptureOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'ine' | 'pasaporte'>('ine');
  const [docDetail, setDocDetail] = useState<ExpDocDef | null>(null);
  const [viewer, setViewer] = useState<{ url: string; nombre: string } | null>(null);
  const [ineViewer, setIneViewer] = useState<{ frente: string | null; reverso: string | null } | null>(null);

  // CSF: datos extraídos del PDF para confirmar/editar antes de guardar.
  const [csfConfirm, setCsfConfirm] = useState<{
    file: File;
    tipo: number;
    fields: { key: string; label: string; value: string; personaCol: string | null; kind?: 'text' | 'regimen' }[];
  } | null>(null);
  const [csfEdit, setCsfEdit] = useState<Record<string, string>>({});
  const [savingCsf, setSavingCsf] = useState(false);
  useEffect(() => {
    if (csfConfirm) {
      const init: Record<string, string> = {};
      csfConfirm.fields.forEach((f) => { init[f.key] = f.value; });
      setCsfEdit(init);
    }
  }, [csfConfirm]);

  const needsRegimen = docs.some((d) => d.csf);
  const { data: regimenCatalog = [] } = useQuery({
    queryKey: ['expediente-regimen-catalog'],
    enabled: needsRegimen,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await (supabase as any).from('regimen').select('id, nombre, tipo').eq('activo', true).order('id');
      return (data || []) as { id: string; nombre: string; tipo: string }[];
    },
  });
  const regimenOptions = useMemo<SearchableOption[]>(
    () => [
      { value: NO_REGIMEN, label: 'Sin especificar' },
      ...regimenCatalog.map((r) => ({ value: String(r.id), label: `${r.id} · ${r.nombre}`, keywords: String(r.id) })),
    ],
    [regimenCatalog],
  );

  // ── Estado de la identidad (INE frente+reverso O pasaporte, nunca ambos) ──
  const ineEstados = INE_TIPOS.map(tipoEstado);
  const hasINE = ineEstados.every((e) => e !== 'pendiente');
  const pasEstado = tipoEstado(PASAPORTE_TIPO);
  const hasPasaporte = pasEstado !== 'pendiente';
  const identityVigente = (hasINE && !ineEstados.includes('expirado')) || (hasPasaporte && pasEstado !== 'expirado');
  const identityMode: 'ine' | 'pasaporte' = hasPasaporte ? 'pasaporte' : hasINE ? 'ine' : identitySel;

  const docEstado = (tiposDoc: number[]): ExpDocEstado => {
    const estados = tiposDoc.map(tipoEstado);
    if (estados.some((e) => e === 'pendiente')) return 'pendiente';
    if (estados.every((e) => e === 'validado')) return 'validado';
    if (estados.some((e) => e === 'expirado')) return 'expirado';
    if (estados.some((e) => e === 'rechazado')) return 'rechazado';
    return 'revision';
  };

  const afterChange = () => { invalidate(); onChanged?.(); };

  // ── Subida de PDF. La Constancia (tipo 6) intenta extracción + confirmación ──
  const handleDocFile = async (file: File, doc: ExpDocDef) => {
    const tipo = (doc.tipos ?? [])[0];
    if (!tipo) return;
    if (!doc.csf) {
      const ok = await uploadDocFile(file, tipo);
      if (ok) { setDocDetail(null); afterChange(); }
      return;
    }
    // La Constancia acepta CUALQUIER PDF: nunca se rechaza la subida. Si el PDF trae
    // el texto original del SAT, se extraen y validan los datos en automático
    // (confirmación + `estatus 2`). Si no se puede leer el texto (escaneo, imagen,
    // PDF protegido) o el contenido no pasa la validación, el archivo se sube igual y
    // queda pendiente de validación manual (`estatus 1`, el default).
    let text = '';
    try {
      text = await extractPdfText(file);
    } catch {
      text = '';
    }
    const legible = (text || '').trim().length >= 20;
    const v = legible ? validateCSFPdf(text) : null;
    if (!v?.ok) {
      const motivo = v && !v.ok
        ? v.reason
        : 'No se pudo leer el texto del PDF (parece un escaneo o imagen).';
      const ok = await uploadDocFile(file, tipo, { silent: true });
      if (ok) {
        setDocDetail(null);
        afterChange();
        toast.warning(`${motivo} Tu Constancia se guardó y queda pendiente de validación.`, { duration: 9000 });
      }
      return;
    }
    const f = extractCSFFields(text);
    setDocDetail(null);
    setCsfConfirm({
      file,
      tipo,
      fields: [
        { key: 'rfc',          label: 'RFC',                   value: f.rfc ?? '',          personaCol: 'rfc' },
        { key: 'curp',         label: 'CURP',                  value: f.curp ?? '',         personaCol: 'curp' },
        { key: 'nombre',       label: 'Nombre / Razón social', value: f.nombre ?? '',       personaCol: 'nombre_legal' },
        { key: 'regimen',      label: 'Régimen fiscal',        value: matchRegimenId(f.regimen ?? '', regimenCatalog), personaCol: 'regimen', kind: 'regimen' },
        { key: 'codigoPostal', label: 'Código postal',         value: f.codigoPostal ?? '', personaCol: 'direccion_fiscal_codigo_postal' },
        { key: 'calle',        label: 'Calle',                 value: f.calle ?? '',        personaCol: 'direccion_fiscal_calle' },
        { key: 'numExt',       label: 'Núm. exterior',         value: f.numExt ?? '',       personaCol: 'direccion_fiscal_num_ext' },
        { key: 'numInt',       label: 'Núm. interior',         value: f.numInt ?? '',       personaCol: 'direccion_fiscal_num_int' },
        { key: 'colonia',      label: 'Colonia',               value: f.colonia ?? '',      personaCol: 'direccion_fiscal_colonia' },
      ],
    });
  };

  const handleConfirmCsf = async () => {
    if (!csfConfirm) return;
    setSavingCsf(true);
    try {
      const personaUpdates: Record<string, string | null> = {};
      for (const fld of csfConfirm.fields) {
        const val = (csfEdit[fld.key] ?? fld.value).trim();
        // El régimen se elige del catálogo: si se deja vacío se guarda null.
        if (fld.kind === 'regimen') { personaUpdates['regimen'] = val || null; continue; }
        if (fld.personaCol && val) personaUpdates[fld.personaCol] = val;
      }
      const ok = await uploadDocFile(csfConfirm.file, csfConfirm.tipo, { estatus: 2, personaUpdates });
      if (ok) { setCsfConfirm(null); afterChange(); }
    } finally {
      setSavingCsf(false);
    }
  };

  return (
    <div className={className}>
      {/* Leyenda: solo mientras no haya una identidad vigente */}
      {hasIdentity && showIdentityNotice && !identityVigente && !isLoading && (
        <div className="mb-2.5 rounded-md border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium leading-relaxed text-amber-700">
            Aún no has registrado tu identificación oficial. Elige y captura tu <span className="font-bold">INE</span> (frente y reverso) o tu{' '}
            <span className="font-bold">pasaporte</span> para completar tu expediente.
          </p>
        </div>
      )}

      {/* Selector INE | Pasaporte (solo hasta subir una identidad vigente) */}
      {hasIdentity && !identityVigente && canUpdate && (
        <div className="mb-2.5 inline-flex rounded-md border border-border bg-muted p-1">
          {([['ine', 'INE'], ['pasaporte', 'Pasaporte']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setIdentitySel(m)}
              className={cn(
                'rounded px-4 py-1.5 text-xs font-bold transition-colors',
                identitySel === m ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {docs.map((doc, i) => {
          const isIdentity = doc.kind === 'identity';
          const meta = isIdentity ? IDENTITY_META[identityMode] : null;
          const tiposDoc = isIdentity ? [...meta!.tipos] : (doc.tipos ?? []);
          const isINE = isIdentity && identityMode === 'ine';
          const nombre = doc.nombre ?? meta?.nombre ?? '';
          const emisor = doc.emisor ?? meta?.emisor ?? '';
          const hint = doc.hint ?? meta?.hint ?? '';

          const estado: ExpDocEstado = doc.external ? doc.external.estado : docEstado(tiposDoc);
          const exists = estado !== 'pendiente';
          const badge = doc.external?.badgeLabel
            ? { ...BADGE[estado], label: doc.external.badgeLabel }
            : BADGE[estado];

          const ineFrente = isINE ? tipoRow(INE_TIPOS[0])?.url || null : null;
          const ineReverso = isINE ? tipoRow(INE_TIPOS[1])?.url || null : null;
          const singleUrl = doc.external
            ? doc.external.url
            : tiposDoc.map(tipoRow).find((r) => r?.url)?.url || null;
          const canView = isINE ? !!(ineFrente || ineReverso) : !!singleUrl;

          // ¿Requiere capturar/subir uno nuevo? (falta, expiró o fue rechazado).
          // Si ya está cargado y válido/en revisión → lápiz (reemplazar por si se equivocaron).
          const needsUpload = !exists || estado === 'expirado' || estado === 'rechazado';
          const showAction =
            canUpdate &&
            (doc.kind !== 'firma' ? true : doc.external ? estado !== 'validado' : !exists);

          const handleAction = () => {
            if (doc.external) { doc.external.onAction(); return; }
            if (doc.kind === 'firma') { onFirma?.(doc); return; }
            if (isIdentity) { setCameraMode(identityMode); setIneCaptureOpen(true); return; }
            setDocDetail(doc);
          };
          const handleView = () => {
            if (isINE) { setIneViewer({ frente: ineFrente, reverso: ineReverso }); return; }
            if (singleUrl) setViewer({ url: singleUrl, nombre });
          };

          const ActionIcon = doc.kind === 'firma' ? PenLine : needsUpload ? (isIdentity ? Camera : Upload) : Pencil;
          const actionTitle =
            doc.external?.actionTitle ??
            (doc.kind === 'firma'
              ? 'Firmar documento'
              : needsUpload
              ? isIdentity ? 'Capturar documento' : 'Subir documento'
              : 'Reemplazar documento');

          return (
            <div key={doc.key} className="flex items-center gap-3.5 rounded-md border border-border bg-card px-4 py-4">
              {numbered && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm font-bold text-foreground">{nombre}</span>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', badge.bg, badge.color)}>{badge.label}</span>
                </div>
                <div className="mt-1 text-xs font-medium text-muted-foreground/70">
                  {[emisor, exists ? 'Cargado' : 'Sin cargar', hint && !exists ? hint : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {showAction && (
                  <button
                    title={actionTitle}
                    onClick={handleAction}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <ActionIcon className="h-4 w-4" />
                  </button>
                )}
                {canView && (
                  <button
                    title="Ver documento"
                    onClick={handleView}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visor de documento (in-app). ModalViewer resuelve buckets privados y Mifiel. */}
      <ModalViewer
        open={!!viewer}
        onOpenChange={(o) => { if (!o) setViewer(null); }}
        url={viewer?.url || ''}
        title={viewer?.nombre || 'Documento'}
      />

      {/* Captura por cámara de identidad (INE frente+reverso o pasaporte) */}
      {personaId && (
        <ClienteINECameraCapture
          open={ineCaptureOpen}
          onOpenChange={setIneCaptureOpen}
          personaId={personaId}
          isDesktop={!isMobile}
          mode={cameraMode}
          onCompleted={() => { setIneCaptureOpen(false); afterChange(); }}
        />
      )}

      {/* Visor del INE: frente y reverso apilados vertical (como dos hojas). */}
      <Dialog open={!!ineViewer} onOpenChange={(o) => { if (!o) setIneViewer(null); }}>
        <DialogContent className="w-full gap-0 overflow-hidden rounded-md bg-card p-0 sm:w-[92vw] sm:max-w-[560px]">
          <ModalFormHeader title="INE" subtitle="Frente y reverso" />
          <div className="max-h-[75vh] space-y-4 overflow-y-auto px-6 py-6">
            {[ineViewer?.frente, ineViewer?.reverso].filter(Boolean).map((url, i) => (
              <OptImg key={i} src={url as string} w={1000} alt="INE" className="w-full rounded-md border border-border" />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalle de documento (subida de PDF) */}
      <Dialog open={!!docDetail} onOpenChange={(o) => { if (!o) setDocDetail(null); }}>
        <DialogContent className="flex max-h-[90vh] max-w-[520px] flex-col gap-0 overflow-hidden rounded-md bg-card p-0">
          {docDetail && (
            <>
              <ModalFormHeader
                title={docDetail.nombre ?? ''}
                subtitle={[docDetail.emisor, docDetail.hint].filter(Boolean).join(' · ')}
              />
              {/* Solo carga del archivo. Los datos leídos se confirman en la modal
                  "Confirma tus datos fiscales" al subir la Constancia. */}
              <div className={MODAL_BODY_CLS}>
                {canUpdate ? (
                  <DocDropzone accept=".pdf" uploading={uploading} onFile={(f) => handleDocFile(f, docDetail)} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {(docDetail.tipos ?? []).some((t) => tipoRow(t)) ? 'Documento cargado.' : 'Aún no has cargado este documento.'}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal confirmar datos de la Constancia (CSF) */}
      <Dialog open={!!csfConfirm} onOpenChange={(o) => { if (!o && !savingCsf) setCsfConfirm(null); }}>
        <DialogContent className="max-w-md gap-0 overflow-hidden rounded-md p-0">
          <ModalFormHeader
            title="Confirma tus datos fiscales"
            subtitle="Extrajimos estos datos de tu Constancia. Verifica o corrige lo que esté mal; se guardarán en tu perfil y el documento quedará validado."
          />
          <div className={cn(MODAL_BODY_CLS, 'max-h-[52vh] gap-3')}>
            {csfConfirm?.fields.map((f) => (
              <div key={f.key}>
                <div className={FIELD_LABEL_CLS}>{f.label}</div>
                {f.kind === 'regimen' ? (
                  /* Régimen: solo valores del catálogo SAT en BD. Si la Constancia
                     trae uno que no existe, queda vacío y lo elige la persona. */
                  <SearchableSelect
                    value={csfEdit[f.key] ?? f.value ?? ''}
                    onValueChange={(v) => setCsfEdit((prev) => ({ ...prev, [f.key]: v === NO_REGIMEN ? '' : v }))}
                    options={regimenOptions}
                    placeholder="Selecciona tu régimen"
                    itemsLabel="regímenes"
                    searchPlaceholder="Buscar por clave o nombre…"
                    aria-label="Régimen fiscal"
                  />
                ) : (
                  <Input value={csfEdit[f.key] ?? f.value} onChange={(e) => setCsfEdit((v) => ({ ...v, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          <div className={MODAL_FOOTER_CLS}>
            <Button variant="cancel" onClick={() => setCsfConfirm(null)} disabled={savingCsf}>
              Cancelar
            </Button>
            <Button variant="primary-outline" onClick={handleConfirmCsf} disabled={savingCsf}>
              {savingCsf ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sí, es correcta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
