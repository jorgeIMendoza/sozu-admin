import { DocPdfDialog } from '@/components/admin/expediente/DocPdfDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FIELD_LABEL_CLS, MODAL_BODY_CLS, ModalFormHeader } from '@/components/ui/modal-form';
import { ModalViewer } from '@/components/ui/modal-viewer';
import { OptImg } from '@/components/ui/opt-img';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select';
import { useExpedienteDocs, type ExpDocEstado } from '@/hooks/useExpedienteDocs';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { extractCSFFields } from '@/utils/pdfDocumentExtractors';
import { validateCSFPdf } from '@/utils/pdfDocumentValidators';
import { extractPdfText } from '@/utils/pdfText';
import { matchRegimenId } from '@/utils/regimenMatch';
import { useQuery } from '@tanstack/react-query';
import { Eye, Loader2, Lock, PenLine, Pencil, Upload, UploadCloud } from 'lucide-react';
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
/** INE completo: frente y reverso en un solo PDF. Es el tipo que se usa desde 2026-08. */
export const INE_COMPLETO_TIPO = 63;
export const PASAPORTE_TIPO = 4;
export const CSF_TIPO = 6;

/** Valor centinela de "vacío" en el select de régimen. */
const NO_REGIMEN = '__none__';

const IDENTITY_META = {
  ine: { nombre: 'INE', emisor: 'INE', hint: 'Frente y reverso', tipos: [...INE_TIPOS, INE_COMPLETO_TIPO] },
  pasaporte: { nombre: 'Pasaporte', emisor: 'SRE', hint: 'Página de datos (vigente)', tipos: [PASAPORTE_TIPO] },
} as const;

/** Opciones del modal de identificación oficial (mismo texto que el Portal Cliente). */
const IDENTIDAD_OPCIONES = [
  {
    value: 'ine',
    label: 'INE',
    hint: 'Frente y reverso en un solo PDF',
    aviso: 'Sube un solo archivo PDF que contenga el frente y el reverso de tu INE. El documento debe estar escaneado, completo y legible. Si no cumple estas condiciones, la revisión se rechazará y deberás cargarlo nuevamente.',
  },
  {
    value: 'pasaporte',
    label: 'Pasaporte',
    hint: 'Página de datos',
    aviso: 'Sube un PDF con la página de datos de tu pasaporte vigente, escaneada completa y legible. Si no cumple estas condiciones, la revisión se rechazará y deberás cargarlo nuevamente.',
  },
];

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
  /** Se consulta y se descarga, pero no se sube ni se reemplaza (p. ej. la CSF del
   *  agente dependiente: la administra su inmobiliaria). */
  soloLectura?: boolean;
  /** Quién lo carga cuando `soloLectura`. Se pinta como píldora en la fila para que
   *  "Pendiente" sin botón no se lea como una tarea del usuario. */
  soloLecturaNota?: string;
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

  // Documento PDF que se está adjuntando (Constancia u otro): abre el modal con vista previa.
  const [pdfDoc, setPdfDoc] = useState<ExpDocDef | null>(null);
  const [savingPdfDoc, setSavingPdfDoc] = useState(false);
  const [identidadOpen, setIdentidadOpen] = useState(false);
  const [identidadTipo, setIdentidadTipo] = useState<'ine' | 'pasaporte'>('ine');
  const [savingIdentidad, setSavingIdentidad] = useState(false);
  const [docDetail, setDocDetail] = useState<ExpDocDef | null>(null);
  const [viewer, setViewer] = useState<{ url: string; nombre: string } | null>(null);
  const [ineViewer, setIneViewer] = useState<{ frente: string | null; reverso: string | null } | null>(null);

  // CSF: datos extraídos del PDF para confirmar/editar antes de guardar.
  const [csfConfirm, setCsfConfirm] = useState<{
    file: File;
    tipo: number;
    /** blob: URL del PDF elegido, para verlo ANTES de subirlo. */
    previewUrl: string;
    /** 'validado' = se extrajeron los datos · 'revision' = no se pudo leer el PDF. */
    modo: 'validado' | 'revision';
    /** Por qué queda a revisión (solo en modo 'revision'). */
    motivo?: string;
    fields: { key: string; label: string; value: string; personaCol: string | null; kind?: 'text' | 'regimen' }[];
  } | null>(null);
  const [csfEdit, setCsfEdit] = useState<Record<string, string>>({});
  const [savingCsf, setSavingCsf] = useState(false);
  // Cierra la confirmación liberando el blob de la previsualización.
  const cerrarCsf = () => {
    setCsfConfirm((prev) => { if (prev) URL.revokeObjectURL(prev.previewUrl); return null; });
  };
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
  // Tipo con el que abre el modal: el que ya tenga cargado, o INE por defecto.
  const identityMode: 'ine' | 'pasaporte' = hasPasaporte ? 'pasaporte' : 'ine';

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
      const motivo = v !== null && v.ok === false
        ? v.reason
        : 'No se pudo leer el texto del PDF (parece un escaneo o una imagen).';
      // Nunca se sube a ciegas: se muestra el PDF para que la persona confirme que es el
      // archivo correcto. Al aceptar se guarda con el estatus por defecto (pendiente).
      setDocDetail(null);
      setCsfConfirm({ file, tipo, previewUrl: URL.createObjectURL(file), modo: 'revision', motivo, fields: [] });
      return;
    }
    const f = extractCSFFields(text);
    setDocDetail(null);
    setCsfConfirm({
      file,
      tipo,
      previewUrl: URL.createObjectURL(file),
      modo: 'validado',
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
      if (csfConfirm.modo === 'revision') {
        // Sin datos extraídos: se guarda con el estatus por defecto (pendiente) y se avisa.
        const ok = await uploadDocFile(csfConfirm.file, csfConfirm.tipo, { silent: true });
        if (ok) {
          cerrarCsf();
          afterChange();
          toast.warning(`${csfConfirm.motivo} Tu Constancia se guardó y queda pendiente de validación.`, { duration: 9000 });
        }
        return;
      }
      const personaUpdates: Record<string, string | null> = {};
      for (const fld of csfConfirm.fields) {
        const val = (csfEdit[fld.key] ?? fld.value).trim();
        // El régimen se elige del catálogo: si se deja vacío se guarda null.
        if (fld.kind === 'regimen') { personaUpdates['regimen'] = val || null; continue; }
        if (fld.personaCol && val) personaUpdates[fld.personaCol] = val;
      }
      const ok = await uploadDocFile(csfConfirm.file, csfConfirm.tipo, { estatus: 2, personaUpdates });
      if (ok) { cerrarCsf(); afterChange(); }
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
            Aún no has registrado tu identificación oficial. Sube el PDF de tu{' '}
            <span className="font-bold">INE</span> (frente y reverso en un solo archivo) o de tu{' '}
            <span className="font-bold">pasaporte</span>. El tipo se elige al adjuntarlo.
          </p>
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
            !doc.soloLectura &&
            (doc.kind !== 'firma' ? true : doc.external ? estado !== 'validado' : !exists);

          const handleAction = () => {
            if (doc.external) { doc.external.onAction(); return; }
            if (doc.kind === 'firma') { onFirma?.(doc); return; }
            if (isIdentity) { setIdentidadTipo(identityMode); setIdentidadOpen(true); return; }
            // Los PDF (Constancia incluida) usan el mismo modal partido con vista previa:
            // se adjunta, se revisa a la derecha y hasta entonces se guarda.
            if (doc.kind === 'pdf' && canUpdate && !doc.soloLectura) { setPdfDoc(doc); return; }
            setDocDetail(doc);
          };
          const handleView = () => {
            if (isINE) { setIneViewer({ frente: ineFrente, reverso: ineReverso }); return; }
            if (singleUrl) setViewer({ url: singleUrl, nombre });
          };

          const readOnlyNota = doc.soloLecturaNota ?? 'La sube tu inmobiliaria';
          const ActionIcon = doc.kind === 'firma' ? PenLine : needsUpload ? Upload : Pencil;
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
                  {/* Sin esta píldora, un "Pendiente" sin botón se lee como tarea
                      propia; y es de la inmobiliaria (o de quien diga la nota). */}
                  {doc.soloLectura && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                      <Lock className="h-3 w-3 shrink-0" />
                      {readOnlyNota}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs font-medium text-muted-foreground/70">
                  {doc.soloLectura
                    ? [emisor, exists ? 'Cargado · solo consulta' : `Aún sin cargar · ${readOnlyNota.toLowerCase()}`]
                        .filter(Boolean)
                        .join(' · ')
                    : [emisor, exists ? 'Cargado' : 'Sin cargar', hint && !exists ? hint : null]
                        .filter(Boolean)
                        .join(' · ')}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/* Solo lectura y todavía sin archivo: un candado deshabilitado deja
                    claro que no hay nada que ver ni que hacer aquí. */}
                {doc.soloLectura && !canView && (
                  <span
                    title={`${readOnlyNota}. Cuando la carguen podrás consultarla aquí.`}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-dashed border-border text-muted-foreground/60"
                  >
                    <Lock className="h-4 w-4" />
                  </span>
                )}
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

      {/* Identificación oficial en PDF. Ya no se captura con cámara: por temas legales se
          adjunta el documento escaneado (INE completo en un solo archivo, o pasaporte).
          Queda SIEMPRE en revisión: no se autovalida. */}
      <DocPdfDialog
        open={identidadOpen}
        onOpenChange={(v) => { if (!savingIdentidad) setIdentidadOpen(v); }}
        title="Identificación oficial"
        subtitle="Elige el tipo de documento, adjunta el PDF y revísalo antes de guardar"
        opciones={IDENTIDAD_OPCIONES}
        opcion={identidadTipo}
        onOpcionChange={(v) => setIdentidadTipo(v as 'ine' | 'pasaporte')}
        selectLabel="Tipo de identificación"
        saving={savingIdentidad}
        nota="Con una identificación es suficiente: INE o pasaporte. El documento queda En revisión y lo valida nuestro equipo; si sustituye a uno anterior, el previo se marca como reemplazado."
        onSave={async (file) => {
          if (!file) return;
          setSavingIdentidad(true);
          try {
            const tipo = identidadTipo === 'ine' ? INE_COMPLETO_TIPO : PASAPORTE_TIPO;
            const ok = await uploadDocFile(file, tipo);
            if (ok) { setIdentidadOpen(false); afterChange(); }
          } finally {
            setSavingIdentidad(false);
          }
        }}
      />

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
                {canUpdate && !docDetail.soloLectura ? (
                  <DocDropzone accept=".pdf" uploading={uploading} onFile={(f) => handleDocFile(f, docDetail)} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {(docDetail.tipos ?? []).some((t) => tipoRow(t))
                      ? 'Documento cargado.'
                      : docDetail.soloLectura
                      ? `Aún no está cargado. ${docDetail.soloLecturaNota ?? 'La sube tu inmobiliaria'}.`
                      : 'Aún no has cargado este documento.'}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjuntar un PDF del expediente (Constancia u otro) con vista previa a la derecha.
          Para la Constancia, al guardar se intenta la extracción: si se leen los datos se
          abre la confirmación y queda validada; si no, queda pendiente de revisión. */}
      <DocPdfDialog
        open={!!pdfDoc}
        onOpenChange={(v) => { if (!v && !savingPdfDoc) setPdfDoc(null); }}
        title={pdfDoc?.nombre ?? 'Adjuntar documento'}
        subtitle={pdfDoc?.csf
          ? 'Adjunta el PDF del SAT y revísalo antes de guardar'
          : [pdfDoc?.emisor, pdfDoc?.hint].filter(Boolean).join(' · ')}
        aviso={pdfDoc?.csf
          ? 'Debe ser el PDF original que descargas del SAT, con no más de 3 meses. Si subes un escaneo o una foto, la Constancia queda pendiente de validación manual.'
          : undefined}
        saving={savingPdfDoc}
        saveLabel="Guardar"
        nota={pdfDoc?.csf
          ? 'Si el PDF es el original del SAT, extraemos tus datos fiscales y la Constancia queda validada al instante.'
          : undefined}
        onSave={async (file) => {
          if (!file || !pdfDoc) return;
          setSavingPdfDoc(true);
          try {
            const doc = pdfDoc;
            setPdfDoc(null);
            await handleDocFile(file, doc);
          } finally {
            setSavingPdfDoc(false);
          }
        }}
      />

      {/* Constancia de Situación Fiscal: mismo modal partido que la identificación, con la
          vista previa del PDF a la derecha. Si se pudieron extraer los datos, se confirman
          aquí y el documento queda validado; si no, se sube y queda pendiente. */}
      <DocPdfDialog
        open={!!csfConfirm}
        onOpenChange={(v) => { if (!v && !savingCsf) cerrarCsf(); }}
        title={csfConfirm?.modo === 'revision' ? 'Revisa tu Constancia' : 'Confirma tus datos fiscales'}
        subtitle={csfConfirm?.modo === 'revision'
          ? 'No pudimos leer los datos de este PDF. Revísalo antes de subirlo: quedará pendiente de validación manual.'
          : 'Extrajimos estos datos de tu Constancia. Verifica o corrige lo que esté mal antes de guardar.'}
        aviso={csfConfirm?.modo === 'revision'
          ? csfConfirm?.motivo
          : 'Estos datos se guardarán en tu perfil fiscal y el documento quedará validado.'}
        archivoOpcional
        saving={savingCsf}
        saveLabel={csfConfirm?.modo === 'revision' ? 'Subir de todos modos' : 'Sí, es correcta'}
        onSave={() => handleConfirmCsf()}
        nota={csfConfirm?.modo === 'revision'
          ? 'El equipo de SOZU la revisará manualmente. Si el PDF no es el original del SAT, la revisión puede rechazarse.'
          : 'Si algún dato no coincide con tu Constancia, corrígelo aquí antes de guardar.'}
      >
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
      </DocPdfDialog>

    </div>
  );
}
