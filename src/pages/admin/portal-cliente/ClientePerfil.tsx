import {
  User, Mail, FileText, LogOut, Shield, ArrowLeft,
  CheckCircle2, Building2, CreditCard, Lock, Eye, EyeOff,
  BadgeCheck, AlertCircle, Clock, Loader2, Check, X,
  Download, Pencil, Upload, Camera, Trash2, Plus,
} from "lucide-react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

// ── PDF text extraction ──────────────────────────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it: any) => ("str" in it ? it.str : "")).join(" "));
  }
  return pages.join("\n").trim();
}

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTipoPersonaLabel, normalizeTipoPersona } from "@/utils/tipo-persona";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";
import { toast } from "sonner";
import { validateCURPPdf, validateCSFPdf, validateActaNacimientoPdf } from "@/utils/pdfDocumentValidators";
import { extractCURPFields, extractCSFFields, extractActaNacimientoFields } from "@/utils/pdfDocumentExtractors";
import { ClienteINECameraCapture } from "@/components/admin/portal-cliente/ClienteINECameraCapture";
import { normalizeAvatarUrl } from "@/lib/avatarUrl";
import { OCUPACIONES_OPCIONES, normalizarOcupacion, esOcupacionOtro } from "@/lib/portal-cliente/ocupaciones";
import { ProfileSectionRow } from "@/components/admin/perfil/ProfileSectionRow";

/* ─── helpers ─── */
const INPUT_CLS =
  "flex h-11 w-full rounded-md border border-[#ECEEF0] bg-white px-3 py-2 text-sm text-[#171A1D] placeholder:text-[#9AA3AD] outline-none focus:ring-2 focus:ring-[hsl(158_64%_38%)]/30 transition-shadow";
const SELECT_CLS = `${INPUT_CLS} appearance-none cursor-pointer`;

// Badge de estatus reutilizable (paleta del portal agente).
const sectionPill = (status: "complete" | "partial" | "pending") =>
  status === "complete"
    ? { label: "Completado", color: "text-[hsl(158_64%_38%)]", bg: "bg-[#E8F5EE]" }
    : status === "partial"
    ? { label: "En proceso", color: "text-[#B5730A]", bg: "bg-[#FBEFD9]" }
    : { label: "Pendiente", color: "text-[#6B7280]", bg: "bg-[#F2F4F5]" };

const EmptyVal = () => (
  <span className="text-[#9AA3AD] text-xs font-normal italic">Sin dato</span>
);

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[13px] font-semibold text-[#171A1D] block">{label}</label>
    {children}
  </div>
);

const SearchSelect = ({
  value, onChange, options, placeholder, getLabel, getValue,
}: {
  value: string; onChange: (v: string) => void; options: any[];
  placeholder: string; getLabel: (o: any) => string; getValue: (o: any) => string;
}) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => getValue(o) === value);
  const inputVal = open ? q : (selected ? getLabel(selected) : "");
  const filtered = q
    ? options.filter((o) => getLabel(o).toLowerCase().includes(q.toLowerCase()))
    : options;
  return (
    <div className="relative">
      <input
        className={INPUT_CLS}
        value={inputVal}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQ(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#ECEEF0] rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((o) => {
            const v = getValue(o);
            return (
              <button
                key={v}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(v); setOpen(false); setQ(""); }}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                  v === value
                    ? "bg-[#E8F5EE] text-[hsl(158_64%_38%)] font-semibold"
                    : "hover:bg-[#F6F7F8] text-[#171A1D]"
                }`}
              >
                {getLabel(o)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PwField = ({
  label, value, onChange, placeholder, show, onToggle, autoComp,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; show: boolean; onToggle: () => void; autoComp: string;
}) => (
  <FormField label={label}>
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComp}
        className={`${INPUT_CLS} pr-10`}
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  </FormField>
);

const PwCheck = ({ label, ok }: { label: string; ok: boolean }) => (
  <div className="flex items-center gap-1.5 text-[11px]">
    {ok
      ? <Check className="w-3 h-3 text-[hsl(158_64%_38%)] shrink-0" />
      : <X className="w-3 h-3 text-[#9AA3AD] shrink-0" />}
    <span className={ok ? "text-[#171A1D]" : "text-[#6B7280]"}>{label}</span>
  </div>
);

/**
 * Botones separados (no clases dinámicas) para que Tailwind no purgue bg-emerald.
 * El config del proyecto define emerald como DEFAULT/light/pale - no existen 500/600.
 */
const PrimaryBtn = ({
  onClick, loading, label, disabled = false,
}: {
  onClick: () => void; loading: boolean; label: string; disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className="w-full h-11 rounded-md text-sm font-semibold flex items-center justify-center gap-2 bg-[hsl(158_64%_38%)] text-white hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-60"
  >
    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
    {loading ? "Guardando..." : label}
  </button>
);

const GrayBtn = ({ label }: { label: string }) => (
  <button
    disabled
    className="w-full h-11 rounded-md text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed"
  >
    {label}
  </button>
);

const CancelBtn = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full h-10 text-sm font-semibold text-destructive hover:bg-destructive/5 rounded-md transition-colors"
  >
    Cancelar
  </button>
);

const ModalHeader = ({
  icon: Icon, title, subtitle, onClose,
}: {
  icon?: React.ElementType; title: string; subtitle: string; onClose: () => void;
}) => (
  <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-[#ECEEF0] shrink-0">
    {Icon && (
      <div className="w-9 h-9 rounded-md bg-[#E8F5EE] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[hsl(158_64%_38%)]" />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <h3 className="font-bold text-[#171A1D] text-sm leading-tight">{title}</h3>
      <p className="text-xs text-[#9AA3AD]">{subtitle}</p>
    </div>
    <button
      onClick={onClose}
      className="w-7 h-7 rounded-md hover:bg-[#F6F7F8] flex items-center justify-center transition-colors text-[#9AA3AD] hover:text-[#171A1D]"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

type DocViewerDoc = { title: string; url: string };
const DocViewerHeader = ({ doc }: { doc: DocViewerDoc }) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-[#ECEEF0] shrink-0">
    <FileText className="w-5 h-5 text-[#9AA3AD] shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-[#171A1D] truncate">{doc.title}</p>
      <p className="text-xs text-[#9AA3AD]">Vista previa</p>
    </div>
  </div>
);
async function downloadDocFile(url: string, title: string) {
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  const fetchUrl = driveMatch
    ? `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`
    : url;
  const ext = url.match(/\.([a-z0-9]+)($|\?)/i)?.[1] ?? 'pdf';
  const fileName = `${title.replace(/\s+/g, '-')}.${ext}`;
  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
  } catch {
    const a = document.createElement('a');
    a.href = fetchUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

const DocViewerBody = ({ doc }: { doc: DocViewerDoc }) => (
  <div className="flex-1 overflow-hidden bg-muted/20 min-h-0">
    {/\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(doc.url)
      ? <img src={doc.url} alt={doc.title} className="w-full h-full object-contain p-4" />
      : <iframe src={`${doc.url}#toolbar=0&navpanes=0`} title={doc.title} loading="lazy" className="w-full h-full border-0" />}
  </div>
);

// Header de sub-vista interna: flecha atrás en caja + título (sin descripción).
const SubHeader = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <div className="mb-3 flex items-center gap-2.5">
    <button
      onClick={onBack}
      aria-label="Volver al perfil"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#ECEEF0] bg-white text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
    <h1 className="text-[19px] font-bold text-[#171A1D]">{title}</h1>
  </div>
);

/* ═══════════════════════════════════════════ */
/*  MAIN COMPONENT                             */
/* ═══════════════════════════════════════════ */
const ClientePerfil = () => {
  const { profile, signOut, updatePassword } = useAuth();
  const { impersonatedClientePersonaId, isImpersonating, impersonatedClienteEmail } = useClienteImpersonation();
  const _directPersonaId = isImpersonating ? impersonatedClientePersonaId : (profile?.id_persona ?? null);
  const queryClient = useQueryClient();

  // Some users (e.g. Super Admin) have id_persona = null in usuarios.
  // Fall back to looking up by email so they can edit their own profile.
  const { data: _personaIdByEmail, isLoading: _loadingEmailFallback } = useQuery({
    queryKey: ["cliente-perfil-email-fallback", profile?.email],
    queryFn: async () => {
      if (!profile?.email) return null;
      const { data } = await (supabase as any)
        .from("personas").select("id")
        .eq("email", profile.email).eq("activo", true).maybeSingle();
      return (data?.id as number) ?? null;
    },
    enabled: !isImpersonating && !profile?.id_persona && !!profile?.email,
    staleTime: 300_000,
  });

  const effectivePersonaId: number | null = _directPersonaId ?? _personaIdByEmail ?? null;

  // Puede editar si: es el cliente real (no impersonando) O es un admin/visor con
  // permiso de impersonar (super admin incluido). `profile.puede_impersonar` refleja
  // al usuario logueado real aunque esté viendo el portal como el cliente.
  const canEditProfile = !isImpersonating || !!(profile as any)?.puede_impersonar;

  /* View navigation */
  const [view, setView] = useState<"overview" | "expediente" | "personal" | "fiscal" | "cuentas">("overview");

  /* Desktop detection */
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  /* Doc preview */
  const [previewDoc, setPreviewDoc] = useState<DocViewerDoc | null>(null);

  /* Password modal */
  const [showChangePw, setShowChangePw] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  /* Edit personal modal */
  const [showEditPersonal, setShowEditPersonal] = useState(false);
  const [editPersonal, setEditPersonal] = useState({
    nombre_legal: "", rfc: "", curp: "", clave_pais_telefono: "+52", telefono: "", ocupacion: "",
  });
  const [ocupacionOtro, setOcupacionOtro] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);

  /* Edit fiscal modal */
  const [showEditFiscal, setShowEditFiscal] = useState(false);
  const [editFiscal, setEditFiscal] = useState({
    regimen: "", uso_cfdi: "",
    direccion_fiscal_codigo_postal: "",
    direccion_fiscal_calle: "",
    direccion_fiscal_num_ext: "",
    direccion_fiscal_num_int: "",
    direccion_fiscal_colonia: "",
  });
  const [savingFiscal, setSavingFiscal] = useState(false);

  /* Alta cuenta bancaria (formulario completo, se abre desde Documentos) */
  const EMPTY_CUENTA = { id_banco: '', numero_cuenta: '', cuenta_clabe: '', cuenta_swift: '', titular: '' };
  const [showAddCuenta, setShowAddCuenta] = useState(false);
  const [addCuenta, setAddCuenta] = useState(EMPTY_CUENTA);
  const [addEvidencia, setAddEvidencia] = useState<File | null>(null);
  const [savingCuenta, setSavingCuenta] = useState(false);
  const [showBancoList, setShowBancoList] = useState(false);
  const [bancoSearch, setBancoSearch] = useState('');
  const [addingBanco, setAddingBanco] = useState(false);
  const [showAddBanco, setShowAddBanco] = useState(false);
  const [nuevoBanco, setNuevoBanco] = useState('');

  /* PW auth gate */
  const PW_AUTH_GRACE = 90_000;
  const [pwAuthTimestamp, setPwAuthTimestamp] = useState<number | null>(null);
  const [showPwAuth, setShowPwAuth] = useState(false);
  const [pwAuthPurpose, setPwAuthPurpose] = useState<'personal' | 'fiscal' | null>(null);
  const [pwAuthInput, setPwAuthInput] = useState('');
  const [showPwAuthInput, setShowPwAuthInput] = useState(false);
  const [verifyingPw, setVerifyingPw] = useState(false);

  /* Upload */
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* Foto de perfil (usuarios.foto_perfil_url) */
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  /* Confirmación de datos extraídos (CURP / CSF) antes de capturar en `personas` */
  const [confirmDoc, setConfirmDoc] = useState<{
    file: File;
    primaryTipoId: number;
    slotKey: string;
    tipo: "curp" | "csf" | "acta";
    fields: { key: string; label: string; value: string; personaCol: string | null }[];
  } | null>(null);
  const [savingConfirm, setSavingConfirm] = useState(false);

  /* Captura por cámara (INE frente+reverso o pasaporte, sin subir archivos) */
  const [ineCaptureOpen, setIneCaptureOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<"ine" | "pasaporte">("ine");
  // Persona destino de la captura por cámara (titular en sesión o representante legal).
  const [cameraPersonaId, setCameraPersonaId] = useState<number | null>(null);
  const pendingAfterPwRef = useRef<(() => void) | null>(null);
  const justAuthedRef = useRef(false);
  const clienteEmail = isImpersonating ? (impersonatedClienteEmail ?? null) : (profile?.email ?? null);

  // Solo CURP(5) y CSF(6) se auto-validan (estatus 2): son PDF, se validan por
  // texto y se extraen sus campos. El resto de documentos se aceptan tal cual
  // (imagen o PDF) y quedan en estatus 1 = "En revisión" para revisión manual.
  const AUTO_VALIDATE_TIPO_IDS = [5, 6];
  const TIPO_NOMBRE: Record<number, string> = {
    1: "Acta de nacimiento", 2: "INE frente", 3: "INE reverso", 4: "Pasaporte",
    5: "CURP", 6: "Constancia de situación fiscal",
    8: "Comprobante de domicilio", 11: "Acta de matrimonio",
  };

  /* ── Queries ── */
  const { data: persona, isLoading: loadingPersona } = useQuery({
    queryKey: ["cliente-perfil-persona", effectivePersonaId],
    queryFn: async () => {
      if (!effectivePersonaId) return null;
      const { data, error } = await supabase
        .from("personas")
        .select(`
          id, nombre_legal, tipo_persona, rfc, curp, email, telefono, ocupacion,
          clave_pais_telefono, regimen, uso_cfdi, id_entidad_relacionada_rep_leg,
          direccion_fiscal_calle, direccion_fiscal_colonia,
          direccion_fiscal_codigo_postal, direccion_fiscal_num_ext,
          direccion_fiscal_num_int, direccion_fiscal_id_estado,
          direccion_fiscal_id_municipio
        `)
        .eq("id", effectivePersonaId)
        .maybeSingle();
      if (error) console.error("[clientePerfil] fetch persona:", error);
      return data;
    },
    enabled: !!effectivePersonaId,
  });

  const { data: regimenData } = useQuery({
    queryKey: ["cliente-perfil-regimen", persona?.regimen],
    queryFn: async () => {
      if (!persona?.regimen) return null;
      const { data } = await supabase.from("regimen").select("id, nombre").eq("id", persona.regimen).maybeSingle();
      return data;
    },
    enabled: !!persona?.regimen,
  });

  const { data: usoCfdiData } = useQuery({
    queryKey: ["cliente-perfil-usocfdi", persona?.uso_cfdi],
    queryFn: async () => {
      if (!persona?.uso_cfdi) return null;
      const { data } = await supabase.from("uso_cfdi").select("codigo, nombre").eq("codigo", persona.uso_cfdi).maybeSingle();
      return data;
    },
    enabled: !!persona?.uso_cfdi,
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ["cliente-perfil-docs", effectivePersonaId],
    queryFn: async () => {
      if (!effectivePersonaId) return [];
      const { data } = await supabase
        .from("documentos")
        .select("id, url, id_tipo_documento, id_estatus_verificacion, fecha_creacion, tipos_documento:documentos_id_tipo_documento_fkey!inner(nombre)")
        .eq("id_persona", effectivePersonaId)
        .eq("activo", true)
        .eq("es_draft", false);
      return (data || []).map((d: any) => ({
        id: d.id,
        name: d.tipos_documento?.nombre || "Documento",
        tipoId: d.id_tipo_documento as number,
        owner: "self" as "self" | "rep",
        status: (d.id_estatus_verificacion === 2 ? "verified"
               : d.id_estatus_verificacion === 3 ? "rejected"
               : d.id_estatus_verificacion === 4 ? "expired"
               : "review") as "verified" | "rejected" | "review" | "missing" | "expired",
        date: d.fecha_creacion
          ? new Date(d.fecha_creacion).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
          : null,
        url: d.url as string,
      }));
    },
    enabled: !!effectivePersonaId,
  });

  /* ── Persona moral: resolver persona del representante legal (vía vinculación) ── */
  const isPM = normalizeTipoPersona(persona?.tipo_persona) === "pm";

  const { data: repLegalPersonaId = null } = useQuery({
    queryKey: ["cliente-perfil-replegal", persona?.id_entidad_relacionada_rep_leg],
    queryFn: async () => {
      const erId = (persona as any)?.id_entidad_relacionada_rep_leg;
      if (!erId) return null;
      const { data } = await supabase
        .from("entidades_relacionadas")
        .select("id_persona")
        .eq("id", erId)
        .maybeSingle();
      return ((data?.id_persona as number) ?? null);
    },
    enabled: isPM && !!(persona as any)?.id_entidad_relacionada_rep_leg,
  });

  /* Documentos del representante legal (owner 'rep') — misma forma que `documentos`. */
  const { data: repDocumentos = [] } = useQuery({
    queryKey: ["cliente-perfil-docs-rep", repLegalPersonaId],
    queryFn: async () => {
      if (!repLegalPersonaId) return [];
      const { data } = await supabase
        .from("documentos")
        .select("id, url, id_tipo_documento, id_estatus_verificacion, fecha_creacion, tipos_documento:documentos_id_tipo_documento_fkey!inner(nombre)")
        .eq("id_persona", repLegalPersonaId)
        .eq("activo", true)
        .eq("es_draft", false);
      return (data || []).map((d: any) => ({
        id: d.id,
        name: d.tipos_documento?.nombre || "Documento",
        tipoId: d.id_tipo_documento as number,
        owner: "rep" as "self" | "rep",
        status: (d.id_estatus_verificacion === 2 ? "verified"
               : d.id_estatus_verificacion === 3 ? "rejected"
               : d.id_estatus_verificacion === 4 ? "expired"
               : "review") as "verified" | "rejected" | "review" | "missing" | "expired",
        date: d.fecha_creacion
          ? new Date(d.fecha_creacion).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
          : null,
        url: d.url as string,
      }));
    },
    enabled: !!repLegalPersonaId,
  });

  /* Docs unificados (self + rep). Cada doc trae `owner` para desambiguar tipos 6/8
     que aplican tanto a la empresa como al representante legal. */
  const allDocs = isPM ? [...documentos, ...repDocumentos] : documentos;

  const { data: cuentasBancarias = [] } = useQuery({
    queryKey: ["cliente-perfil-bancos", effectivePersonaId],
    queryFn: async () => {
      if (!effectivePersonaId) return [];
      const { data } = await supabase
        .from("cuentas_bancarias")
        .select("id, id_banco, numero_cuenta, cuenta_clabe, cuenta_swift, titular, url_evidencia, id_estatus_verificacion, bancos:fk_cuentas_bancarias_banco(nombre)")
        .eq("id_persona", effectivePersonaId)
        .eq("activo", true);
      return (data || []).map((c: any) => ({
        id: c.id,
        idBanco: c.id_banco as number,
        banco: (c.bancos as any)?.nombre || "Banco",
        numeroCuenta: (c.cuenta_clabe || c.numero_cuenta) as string,
        titular: c.titular as string | null,
        swift: c.cuenta_swift as string | null,
        evidencia: (c.url_evidencia as string | null) || null,
        estatus: (c.id_estatus_verificacion as number) ?? 1,
      }));
    },
    enabled: !!effectivePersonaId,
  });

  /* Foto de perfil del cliente (fila en `usuarios` por email) */
  const { data: clienteUsuario } = useQuery({
    queryKey: ["cliente-perfil-usuario", clienteEmail],
    queryFn: async () => {
      if (!clienteEmail) return null;
      const { data } = await (supabase as any)
        .from("usuarios")
        .select("foto_perfil_url")
        .eq("email", clienteEmail)
        .maybeSingle();
      return data as { foto_perfil_url: string | null } | null;
    },
    enabled: !!clienteEmail,
    staleTime: 60_000,
  });

  /* Catalogs - lazy */
  const { data: regimenOptions = [] } = useQuery({
    queryKey: ["regimen-options"],
    queryFn: async () => {
      const { data } = await supabase.from("regimen").select("id, nombre").eq("activo", true).order("id");
      return (data || []) as { id: string; nombre: string }[];
    },
    enabled: showEditFiscal,
    staleTime: 600_000,
  });

  // Catálogo de régimen siempre disponible: resuelve el régimen extraído del CSF
  // (texto) al id/código SAT que guarda persona.regimen, para auto-rellenar fiscal.
  const { data: regimenCatalog = [] } = useQuery({
    queryKey: ["regimen-catalog-all"],
    queryFn: async () => {
      const { data } = await supabase.from("regimen").select("id, nombre").eq("activo", true).order("id");
      return (data || []) as { id: string; nombre: string }[];
    },
    staleTime: 600_000,
  });

  const { data: usoCfdiOptions = [] } = useQuery({
    queryKey: ["uso-cfdi-options"],
    queryFn: async () => {
      const { data } = await supabase.from("uso_cfdi").select("codigo, nombre").eq("activo", true).order("codigo");
      return (data || []) as { codigo: string; nombre: string }[];
    },
    enabled: showEditFiscal,
    staleTime: 600_000,
  });

  const { data: bancosOptions = [] } = useQuery({
    queryKey: ["bancos-catalog"],
    queryFn: async () => {
      const { data } = await supabase.from("bancos").select("id, nombre").eq("activo", true).order("nombre");
      return (data || []) as { id: number; nombre: string }[];
    },
    enabled: showAddCuenta,
    staleTime: 600_000,
  });

  /* ── Expediente slots (cat: agrupación en el expediente) ── */
  // tipo_documento nuevo (persona moral): reformas/protocolizaciones posteriores al
  // acta constitutiva. id fijo 57 (ver Ejecuciones_manuales/documentos/04_catalogo_tipo_reformas_pm.md).
  const REFORMAS_TIPO_ID = 57;

  type DocSlot = {
    key: string; label: string; tipoIds: number[]; primaryTipoId: number;
    required: boolean; cat: string; owner: "self" | "rep"; camera?: boolean;
  };

  // Persona física (comportamiento actual, sin cambios). owner siempre 'self'.
  const PF_SLOTS: DocSlot[] = [
    { key: "ine_frente",      label: "INE Frente",                     tipoIds: [2],  primaryTipoId: 2,  required: true,  cat: "personal",   owner: "self", camera: true },
    { key: "ine_reverso",     label: "INE Reverso",                    tipoIds: [3],  primaryTipoId: 3,  required: true,  cat: "personal",   owner: "self", camera: true },
    { key: "pasaporte",       label: "Pasaporte",                      tipoIds: [4],  primaryTipoId: 4,  required: false, cat: "personal",   owner: "self", camera: true },
    { key: "acta_nacimiento", label: "Acta de nacimiento",             tipoIds: [1],  primaryTipoId: 1,  required: false, cat: "personal",   owner: "self" },
    { key: "curp",            label: "CURP",                           tipoIds: [5],  primaryTipoId: 5,  required: true,  cat: "personal",   owner: "self" },
    { key: "csf",             label: "Constancia de situación fiscal", tipoIds: [6],  primaryTipoId: 6,  required: true,  cat: "financiero", owner: "self" },
    { key: "domicilio",       label: "Comprobante de domicilio",       tipoIds: [8],  primaryTipoId: 8,  required: true,  cat: "personal",   owner: "self" },
    { key: "matrimonio",      label: "Acta de matrimonio",             tipoIds: [11], primaryTipoId: 11, required: false, cat: "personal",   owner: "self" },
  ];

  // Persona moral: docs de la empresa (owner 'self' = persona PM) + docs del
  // representante legal (owner 'rep' = persona vinculada). tipos 6/8 se repiten
  // en ambos owners → el match filtra por tipoId + owner.
  const PM_SLOTS: DocSlot[] = [
    // Empresa
    { key: "acta_constitutiva", label: "Acta constitutiva",                 tipoIds: [7],                 primaryTipoId: 7,                 required: true,  cat: "empresa",  owner: "self" },
    { key: "registro_comercio", label: "Registro Público de Comercio",      tipoIds: [10],                primaryTipoId: 10,                required: true,  cat: "empresa",  owner: "self" },
    { key: "reformas",          label: "Reformas / protocolizaciones",      tipoIds: [REFORMAS_TIPO_ID],  primaryTipoId: REFORMAS_TIPO_ID,  required: false, cat: "empresa",  owner: "self" },
    { key: "csf_empresa",       label: "Constancia de situación fiscal",    tipoIds: [6],                 primaryTipoId: 6,                 required: true,  cat: "empresa",  owner: "self" },
    { key: "domicilio_empresa", label: "Comprobante de domicilio fiscal",   tipoIds: [8],                 primaryTipoId: 8,                 required: true,  cat: "empresa",  owner: "self" },
    // Representante legal (la sección ya indica de quién son → labels cortas).
    // Identificación oficial = mismo estándar que PF: INE frente+reverso (cámara) o pasaporte.
    { key: "poder_notarial",     label: "Poder notarial",                   tipoIds: [9],                 primaryTipoId: 9,                 required: true,  cat: "replegal", owner: "rep" },
    { key: "ine_frente_rep",     label: "INE Frente",                       tipoIds: [2],                 primaryTipoId: 2,                 required: true,  cat: "replegal", owner: "rep", camera: true },
    { key: "ine_reverso_rep",    label: "INE Reverso",                      tipoIds: [3],                 primaryTipoId: 3,                 required: true,  cat: "replegal", owner: "rep", camera: true },
    { key: "pasaporte_rep",      label: "Pasaporte",                        tipoIds: [4],                 primaryTipoId: 4,                 required: false, cat: "replegal", owner: "rep", camera: true },
    { key: "curp_rep",           label: "CURP",                             tipoIds: [5],                 primaryTipoId: 5,                 required: true,  cat: "replegal", owner: "rep" },
    { key: "csf_rep",            label: "Constancia de situación fiscal",   tipoIds: [6],                 primaryTipoId: 6,                 required: true,  cat: "replegal", owner: "rep" },
    { key: "domicilio_rep",      label: "Comprobante de domicilio",         tipoIds: [8],                 primaryTipoId: 8,                 required: true,  cat: "replegal", owner: "rep" },
  ];

  const SLOTS: DocSlot[] = isPM ? PM_SLOTS : PF_SLOTS;
  // Grupos del expediente: orden de categorías + orden alfabético dentro de cada una.
  const DOC_GROUPS: { key: string; label: string }[] = isPM
    ? [
        { key: "empresa",    label: "Empresa" },
        { key: "replegal",   label: "Representante legal" },
        { key: "financiero", label: "Fiscal y financiero" },
      ]
    : [
        { key: "personal",   label: "Personales" },
        { key: "financiero", label: "Fiscal y financiero" },
      ];

  /* ── Derived display ── */
  const displayName = persona?.nombre_legal || profile?.nombre || "Cliente";

  const regimenDisplay = persona?.regimen
    ? regimenData?.nombre ? `${persona.regimen} - ${regimenData.nombre}` : persona.regimen
    : null;
  const usoCfdiDisplay = persona?.uso_cfdi
    ? usoCfdiData?.nombre ? `${persona.uso_cfdi} - ${usoCfdiData.nombre}` : persona.uso_cfdi
    : null;

  /* ── Documentos: todos los requeridos verificados → sección "Documentos" completa ── */
  const requiredSlots = SLOTS.filter((s) => s.required);
  const docsAllVerified = requiredSlots.length > 0 && requiredSlots.every((s) =>
    allDocs.some((d) => s.tipoIds.includes(d.tipoId) && d.owner === s.owner && d.status === "verified"),
  );

  /* ── CSF (tipo 6) verificada = fuente de los datos fiscales. Si se extrajo y quedó
     validada (estatus 2), la sección fiscal se da por válida directamente, aunque el
     régimen no haya mapeado al catálogo. ── */
  const csfVerified = documentos.some((d) => d.tipoId === 6 && d.status === "verified");

  /* ── Profile completion ── */
  const uploadedTypeIds = new Set(documentos.map((d) => d.tipoId));
  const hasId = uploadedTypeIds.has(2) || uploadedTypeIds.has(3) || uploadedTypeIds.has(4);
  const completionItems = persona ? [
    persona.nombre_legal, persona.rfc, persona.curp, persona.email,
    persona.telefono, persona.regimen, persona.uso_cfdi,
    persona.direccion_fiscal_calle, hasId, uploadedTypeIds.has(8),
    cuentasBancarias.length > 0,
  ] : [];
  const profileCompletion = completionItems.length
    ? Math.round(completionItems.filter(Boolean).length / completionItems.length * 100)
    : 0;

  type VerStatus = "verified" | "review" | "incomplete";
  const verStatus: VerStatus = profileCompletion >= 85 ? "verified" : profileCompletion >= 50 ? "review" : "incomplete";
  const STATUS_CFG = {
    verified:   { label: "Perfil verificado",      icon: BadgeCheck,  cls: "text-emerald bg-emerald-pale" },
    review:     { label: "Perfil en revisión",      icon: Clock,       cls: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40" },
    incomplete: { label: "Información incompleta",  icon: AlertCircle, cls: "text-destructive bg-destructive/8" },
  } as const;
  const StatusIcon = STATUS_CFG[verStatus].icon;

  /* ── Password checks ── */
  const pwChecks = useMemo(() => ({
    minLength:  newPassword.length >= 8,
    hasUpper:   /[A-Z]/.test(newPassword),
    hasLower:   /[a-z]/.test(newPassword),
    hasNumber:  /[0-9]/.test(newPassword),
    hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
    matches:    newPassword.length > 0 && newPassword === confirmPassword,
  }), [newPassword, confirmPassword]);
  const pwReady = pwChecks.minLength && pwChecks.matches && !!currentPassword && !changingPassword;

  /* ── Handlers ── */
  const isPwAuthed = () => pwAuthTimestamp !== null && Date.now() - pwAuthTimestamp < PW_AUTH_GRACE;

  /* ── Foto de perfil (bucket `avatar` + usuarios.foto_perfil_url) ── */
  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Extrae el path de storage desde la URL pública (self-hosted y Supabase cloud).
  const getAvatarStoragePath = (publicUrl: string): string | null => {
    const marker = '/storage/v1/object/public/avatar/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.substring(idx + marker.length).split('?')[0];
  };

  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setPendingFile(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  };

  const handlePhotoConfirm = async () => {
    if (!pendingFile || !clienteEmail) return;
    setUploadingPhoto(true);
    try {
      const ext = (pendingFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/${clienteEmail}/avatar.${ext}`;

      // Elimina el archivo previo si cambió la extensión (evita huérfanos).
      if (clienteUsuario?.foto_perfil_url) {
        const oldPath = getAvatarStoragePath(clienteUsuario.foto_perfil_url);
        if (oldPath && oldPath !== path) {
          await supabase.storage.from('avatar').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('avatar')
        .upload(path, pendingFile, { upsert: true, cacheControl: '3600' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatar').getPublicUrl(path);
      const cleanUrl = urlData.publicUrl.split('?')[0];

      const { data: updated, error: updErr } = await (supabase as any)
        .from('usuarios')
        .update({ foto_perfil_url: cleanUrl })
        .eq('email', clienteEmail)
        .select('email');
      if (updErr) throw updErr;
      if (!updated || updated.length === 0) {
        throw new Error('No se pudo guardar la foto: no tienes permiso para editar este perfil.');
      }

      queryClient.invalidateQueries({ queryKey: ['cliente-perfil-usuario', clienteEmail] });
      queryClient.refetchQueries({ queryKey: ['cliente-perfil-usuario', clienteEmail] });
      toast.success('Foto de perfil actualizada');
      closePhotoModal();
    } catch (err: any) {
      console.error('Error subiendo foto:', err);
      toast.error(err?.message || 'No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!clienteEmail) return;
    setDeletingPhoto(true);
    try {
      if (clienteUsuario?.foto_perfil_url) {
        const storagePath = getAvatarStoragePath(clienteUsuario.foto_perfil_url);
        if (storagePath) {
          await supabase.storage.from('avatar').remove([storagePath]);
        } else {
          const { data: files } = await supabase.storage.from('avatar').list(`avatars/${clienteEmail}`);
          if (files?.length) {
            await supabase.storage.from('avatar').remove(files.map((f) => `avatars/${clienteEmail}/${f.name}`));
          }
        }
      }
      const { error: updErr } = await (supabase as any)
        .from('usuarios')
        .update({ foto_perfil_url: null })
        .eq('email', clienteEmail)
        .select('email');
      if (updErr) throw updErr;
      queryClient.invalidateQueries({ queryKey: ['cliente-perfil-usuario', clienteEmail] });
      queryClient.refetchQueries({ queryKey: ['cliente-perfil-usuario', clienteEmail] });
      toast.success('Foto de perfil eliminada');
      setShowPhotoModal(false);
    } catch (err: any) {
      console.error('Error eliminando foto:', err);
      toast.error(err?.message || 'No se pudo eliminar la foto.');
    } finally {
      setDeletingPhoto(false);
    }
  };

  const notificarCambioCliente = async (actividad: string, detalles: string) => {
    try {
      const { data: admins } = await supabase.from('usuarios').select('email').eq('rol_id', 1).eq('activo', true);
      const correos = (admins || []).map((u: any) => u.email).filter(Boolean).join(',');
      if (!correos) return;
      await supabase.functions.invoke('enviar-notificacion', {
        body: {
          tipo: 'email',
          from: 'Notificaciones Sozu <notificaciones@sozu.com>',
          email: correos,
          asunto: `Cambio en perfil de cliente - ${clienteEmail || displayName}`,
          mensajeWA: `Cliente ${clienteEmail || displayName}: ${actividad}`,
          mensaje: { nombre: 'Equipo SOZU', actividad, detalles },
        },
      });
    } catch { /* fire-and-forget */ }
  };

  const openEditPersonal = () => {
    setEditPersonal({
      nombre_legal:        persona?.nombre_legal || "",
      rfc:                 persona?.rfc || "",
      curp:                persona?.curp || "",
      clave_pais_telefono: persona?.clave_pais_telefono || "+52",
      telefono:            persona?.telefono || "",
      ocupacion:           (persona as any)?.ocupacion || "",
    });
    setOcupacionOtro(esOcupacionOtro((persona as any)?.ocupacion));
    setShowEditPersonal(true);
  };

  const handleSavePersonal = async () => {
    if (!effectivePersonaId) { toast.error("No se encontró el perfil"); return; }
    if (!editPersonal.nombre_legal.trim()) { toast.error("El nombre completo es requerido"); return; }
    if (!isPwAuthed() && !justAuthedRef.current) {
      pendingAfterPwRef.current = () => handleSavePersonal();
      setPwAuthInput('');
      setShowPwAuth(true);
      return;
    }
    justAuthedRef.current = false;
    setSavingPersonal(true);
    try {
      const payload = {
        nombre_legal:        editPersonal.nombre_legal.trim(),
        rfc:                 editPersonal.rfc.trim().toUpperCase() || null,
        curp:                editPersonal.curp.trim().toUpperCase() || null,
        clave_pais_telefono: editPersonal.clave_pais_telefono.trim() || null,
        telefono:            editPersonal.telefono.trim() || null,
        ocupacion:           normalizarOcupacion(editPersonal.ocupacion),
      };
      const { error } = await supabase.from("personas").update(payload as any).eq("id", effectivePersonaId);
      if (error) {
        console.error("[savePersonal]", error);
        toast.error(`Error al guardar: ${error.message}`);
        return;
      }
      /* Actualización optimista inmediata + refetch en background */
      queryClient.setQueryData(["cliente-perfil-persona", effectivePersonaId], (old: any) =>
        old ? { ...old, ...payload } : old,
      );
      queryClient.refetchQueries({ queryKey: ["cliente-perfil-persona", effectivePersonaId] });
      toast.success("Datos personales actualizados");
      setShowEditPersonal(false);
      notificarCambioCliente('Actualización de datos personales', `Nombre: ${payload.nombre_legal || '-'}, RFC: ${payload.rfc || '-'}, CURP: ${payload.curp || '-'}`);
    } finally {
      setSavingPersonal(false);
    }
  };

  const openEditFiscal = () => {
    setEditFiscal({
      regimen:                        persona?.regimen || "",
      uso_cfdi:                       persona?.uso_cfdi || "",
      direccion_fiscal_codigo_postal: persona?.direccion_fiscal_codigo_postal?.trim() || "",
      direccion_fiscal_calle:         persona?.direccion_fiscal_calle?.trim() || "",
      direccion_fiscal_num_ext:       persona?.direccion_fiscal_num_ext || "",
      direccion_fiscal_num_int:       persona?.direccion_fiscal_num_int || "",
      direccion_fiscal_colonia:       persona?.direccion_fiscal_colonia || "",
    });
    setShowEditFiscal(true);
  };

  const handlePwAuth = async () => {
    const email = isImpersonating ? (impersonatedClienteEmail ?? '') : (profile?.email ?? '');
    if (!email || !pwAuthInput) return;
    setVerifyingPw(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pwAuthInput });
      if (error) {
        toast.error('Contraseña incorrecta');
        return;
      }
      justAuthedRef.current = true;
      setPwAuthTimestamp(Date.now());
      setShowPwAuth(false);
      if (pendingAfterPwRef.current) {
        const action = pendingAfterPwRef.current;
        pendingAfterPwRef.current = null;
        action();
      }
    } finally {
      setVerifyingPw(false);
    }
  };

  const handleAddCuenta = async () => {
    if (!effectivePersonaId) { toast.error('No se encontró el perfil'); return; }
    if (!addCuenta.id_banco) { toast.error('Selecciona un banco'); return; }
    const numero = addCuenta.numero_cuenta.trim();
    if (numero.length < 8 || numero.length > 34) { toast.error('El número de cuenta debe tener entre 8 y 34 caracteres'); return; }
    if (!addCuenta.titular.trim()) { toast.error('Ingresa el nombre del titular'); return; }
    const clabe = addCuenta.cuenta_clabe.trim();
    if (clabe && clabe.length !== 18) { toast.error('La CLABE debe tener 18 dígitos'); return; }
    if (!addEvidencia) { toast.error('Sube la carátula de tu estado de cuenta'); return; }
    setSavingCuenta(true);
    try {
      // Evidencia (obligatoria): carátula del estado de cuenta. Sube a storage y la
      // registra como documento tipo 60 "Datos bancarios".
      let evidenciaUrl: string | null = null;
      if (addEvidencia) {
        const ext = addEvidencia.name.split('.').pop()?.toLowerCase() || 'pdf';
        const path = `personas/${effectivePersonaId}/60_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('documentos').upload(path, addEvidencia, { upsert: false });
        if (upErr) { toast.error('Error al subir evidencia: ' + upErr.message); return; }
        evidenciaUrl = supabase.storage.from('documentos').getPublicUrl(path).data.publicUrl;
        await (supabase as any).from('documentos').insert({
          id_persona: effectivePersonaId,
          id_tipo_documento: 60,
          url: evidenciaUrl,
          activo: true,
          es_draft: false,
          id_estatus_verificacion: 1,
        });
      }
      const swift = addCuenta.cuenta_swift.trim();
      const { error } = await (supabase as any).from('cuentas_bancarias').insert({
        id_persona: effectivePersonaId,
        id_banco: Number(addCuenta.id_banco),
        numero_cuenta: numero,
        cuenta_clabe: clabe || null,
        cuenta_swift: swift || null,
        titular: addCuenta.titular.trim(),
        url_evidencia: evidenciaUrl,
        activo: true,
        id_estatus_verificacion: 1,
      });
      if (error) { toast.error(`Error: ${error.message}`); return; }
      toast.success('Cuenta bancaria registrada');
      const bancoNombre = bancosOptions.find(b => String(b.id) === addCuenta.id_banco)?.nombre || addCuenta.id_banco;
      notificarCambioCliente('Alta de cuenta bancaria', `Banco: ${bancoNombre}, Cuenta: ${numero}, Titular: ${addCuenta.titular.trim()}`);
      setShowAddCuenta(false);
      setAddCuenta(EMPTY_CUENTA);
      setAddEvidencia(null);
      queryClient.invalidateQueries({ queryKey: ['cliente-perfil-bancos', effectivePersonaId] });
      queryClient.refetchQueries({ queryKey: ['cliente-perfil-docs', effectivePersonaId] });
    } finally {
      setSavingCuenta(false);
    }
  };

  /* Alta de banco no listado en catálogo (clientes extranjeros / bancos ausentes).
     Inserta en `bancos` y lo selecciona. Dedup case-insensitive para no duplicar. */
  const handleAddBanco = async () => {
    const nombre = nuevoBanco.trim();
    if (nombre.length < 2) { toast.error('Escribe el nombre del banco'); return; }
    const existente = bancosOptions.find(b => b.nombre.trim().toLowerCase() === nombre.toLowerCase());
    if (existente) {
      setAddCuenta(f => ({ ...f, id_banco: String(existente.id) }));
      setShowAddBanco(false); setNuevoBanco(''); setBancoSearch('');
      toast.info('Ese banco ya existía; se seleccionó.');
      return;
    }
    setAddingBanco(true);
    try {
      const { data, error } = await (supabase as any)
        .from('bancos')
        .insert({ nombre, activo: true })
        .select('id, nombre')
        .single();
      if (error || !data) { toast.error('No se pudo agregar el banco' + (error ? `: ${error.message}` : '')); return; }
      queryClient.setQueryData(
        ['bancos-catalog'],
        (prev: { id: number; nombre: string }[] | undefined) =>
          [...(prev || []), { id: data.id as number, nombre: data.nombre as string }]
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      setAddCuenta(f => ({ ...f, id_banco: String(data.id) }));
      setShowAddBanco(false); setNuevoBanco(''); setBancoSearch('');
      toast.success('Banco agregado');
    } finally {
      setAddingBanco(false);
    }
  };

  const handleSaveFiscal = async () => {
    if (!effectivePersonaId) { toast.error("No se encontró el perfil"); return; }
    if (!isPwAuthed() && !justAuthedRef.current) {
      pendingAfterPwRef.current = () => handleSaveFiscal();
      setPwAuthInput('');
      setShowPwAuth(true);
      return;
    }
    justAuthedRef.current = false;
    setSavingFiscal(true);
    try {
      const payload = {
        regimen:                        editFiscal.regimen || null,
        uso_cfdi:                       editFiscal.uso_cfdi || null,
        direccion_fiscal_codigo_postal: editFiscal.direccion_fiscal_codigo_postal.trim() || null,
        direccion_fiscal_calle:         editFiscal.direccion_fiscal_calle.trim() || null,
        direccion_fiscal_num_ext:       editFiscal.direccion_fiscal_num_ext.trim() || null,
        direccion_fiscal_num_int:       editFiscal.direccion_fiscal_num_int.trim() || null,
        direccion_fiscal_colonia:       editFiscal.direccion_fiscal_colonia.trim() || null,
      };
      const { error } = await supabase.from("personas").update(payload as any).eq("id", effectivePersonaId);
      if (error) {
        console.error("[saveFiscal]", error);
        toast.error(`Error al guardar: ${error.message}`);
        return;
      }
      queryClient.setQueryData(["cliente-perfil-persona", effectivePersonaId], (old: any) =>
        old ? { ...old, ...payload } : old,
      );
      queryClient.refetchQueries({ queryKey: ["cliente-perfil-persona", effectivePersonaId] });
      toast.success("Datos fiscales actualizados");
      setShowEditFiscal(false);
      notificarCambioCliente('Actualización de datos fiscales', `Régimen: ${payload.regimen || '-'}, CP: ${payload.direccion_fiscal_codigo_postal || '-'}, Calle: ${payload.direccion_fiscal_calle || '-'}`);
    } finally {
      setSavingFiscal(false);
    }
  };

  // Sube el archivo a storage, expira versiones previas, registra el documento y
  // (opcional) captura campos extraídos en `personas`. Devuelve true si tuvo éxito.
  const commitDoc = async (
    file: File,
    primaryTipoId: number,
    estatus: number,
    personaUpdates?: Record<string, string>,
    targetPersonaId?: number | null,
  ): Promise<boolean> => {
    const personaId = targetPersonaId ?? effectivePersonaId;
    if (!personaId) return false;

    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `personas/${personaId}/${primaryTipoId}_${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("documentos").upload(path, file, { upsert: false });
    if (uploadErr) { toast.error("Error al subir archivo: " + uploadErr.message); return false; }
    const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(path);

    // Doc activo más antiguo de este tipo → se marca expirado (referencia de auditoría).
    // Los demás activos → se desactivan + expiran.
    const { data: activeDocs } = await (supabase as any)
      .from("documentos")
      .select("id")
      .eq("id_persona", personaId)
      .eq("id_tipo_documento", primaryTipoId)
      .eq("activo", true)
      .order("id", { ascending: true });

    if (activeDocs && activeDocs.length > 0) {
      await (supabase as any)
        .from("documentos")
        .update({ id_estatus_verificacion: 4 })
        .eq("id", activeDocs[0].id);
      const otherIds = activeDocs.slice(1).map((d: any) => d.id);
      if (otherIds.length > 0) {
        await (supabase as any)
          .from("documentos")
          .update({ activo: false, id_estatus_verificacion: 4 })
          .in("id", otherIds);
      }
    }

    const { error: insertErr } = await (supabase as any).from("documentos").insert({
      id_persona: personaId,
      id_tipo_documento: primaryTipoId,
      url: publicUrl,
      activo: true,
      es_draft: false,
      id_estatus_verificacion: estatus,
    }).select("id").single();
    if (insertErr) { console.error("[uploadDoc]", insertErr); toast.error("Error al registrar documento"); return false; }

    // Captura automática de datos del documento en el perfil (CURP/CSF confirmados).
    // Solo aplica a docs de la persona en sesión (owner 'self'); los del representante
    // legal no auto-capturan datos → nunca llegan aquí con personaUpdates.
    if (personaUpdates && Object.keys(personaUpdates).length > 0) {
      const { error: pErr } = await (supabase as any).from("personas").update(personaUpdates).eq("id", personaId);
      if (pErr) console.error("[uploadDoc] persona update:", pErr);
      else queryClient.invalidateQueries({ queryKey: ["cliente-perfil-persona", effectivePersonaId] });
    }

    if (estatus === 2 && clienteEmail) {
      try {
        await (supabase as any).from("notificaciones_cliente").insert({
          email_cliente: clienteEmail,
          tipo: "exito",
          categoria: "documentos",
          titulo: `${TIPO_NOMBRE[primaryTipoId] ?? "Documento"} aprobado`,
          descripcion: "Tu documento fue validado y aprobado.",
          url_accion: "/perfil",
          etiqueta_accion: "Ver perfil",
          leida: false,
          descartada: false,
          activo: true,
        });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } catch { /* non-critical */ }
    }

    queryClient.refetchQueries({ queryKey: ["cliente-perfil-docs", effectivePersonaId] });
    queryClient.refetchQueries({ queryKey: ["cliente-perfil-docs-rep", personaId] });
    return true;
  };

  const handleUploadDoc = async (
    file: File,
    slotKey: string,
    primaryTipoId: number,
    owner: "self" | "rep" = "self",
    targetPersonaId?: number | null,
  ) => {
    if (!effectivePersonaId) return;

    // Docs del representante legal (persona vinculada): se guardan en SU persona y
    // NO auto-capturan datos en el perfil (la extracción CURP/CSF aplica solo al
    // titular en sesión). Van directo a revisión manual (estatus 1).
    if (owner === "rep") {
      if (!targetPersonaId) { toast.error("No hay representante legal vinculado."); return; }
      setUploadingSlot(slotKey);
      try {
        const ok = await commitDoc(file, primaryTipoId, 1, undefined, targetPersonaId);
        if (ok) toast.success("Documento enviado para revisión");
      } finally {
        setUploadingSlot(null);
      }
      return;
    }

    // CURP(5) y CSF(6): PDF obligatorio → validación por texto + extracción de datos.
    // No se sube todavía; primero el cliente confirma los datos extraídos.
    if (AUTO_VALIDATE_TIPO_IDS.includes(primaryTipoId)) {
      setUploadingSlot(slotKey);
      try {
        let text = "";
        try {
          text = await extractPdfText(file);
        } catch {
          toast.error("No se pudo leer el archivo. Intenta de nuevo.");
          return;
        }
        if (!text || text.trim().length < 20) {
          toast.error(
            "El archivo debe ser el PDF original del documento oficial. No se aceptan escaneados ni imágenes.",
            { duration: 7000 },
          );
          return;
        }

        if (primaryTipoId === 5) {
          const result = validateCURPPdf(text);
          if (!result.ok) { toast.error(result.reason, { duration: 8000 }); return; }
          const f = extractCURPFields(text);
          setConfirmDoc({
            file, primaryTipoId, slotKey, tipo: "curp",
            fields: [
              { key: "curp",             label: "CURP",                 value: f.curp ?? "",   personaCol: "curp" },
              { key: "nombre",           label: "Nombre completo",      value: f.nombre ?? "", personaCol: "nombre_legal" },
              { key: "fechaNacimiento",  label: "Fecha de nacimiento",  value: f.fechaNacimiento ?? "", personaCol: null },
              { key: "sexo",             label: "Sexo",                 value: f.sexo === "H" ? "Hombre" : f.sexo === "M" ? "Mujer" : "", personaCol: null },
            ],
          });
        } else {
          const result = validateCSFPdf(text);
          if (!result.ok) { toast.error(result.reason, { duration: 8000 }); return; }
          const f = extractCSFFields(text);
          setConfirmDoc({
            file, primaryTipoId, slotKey, tipo: "csf",
            fields: [
              { key: "rfc",          label: "RFC",                 value: f.rfc ?? "",          personaCol: "rfc" },
              { key: "curp",         label: "CURP",                value: f.curp ?? "",         personaCol: "curp" },
              { key: "nombre",       label: "Nombre / Razón social",value: f.nombre ?? "",       personaCol: "nombre_legal" },
              { key: "regimen",      label: "Régimen fiscal",      value: f.regimen ?? "",      personaCol: null },
              { key: "codigoPostal", label: "Código postal",       value: f.codigoPostal ?? "", personaCol: "direccion_fiscal_codigo_postal" },
              { key: "calle",        label: "Calle",               value: f.calle ?? "",        personaCol: "direccion_fiscal_calle" },
              { key: "numExt",       label: "Núm. exterior",       value: f.numExt ?? "",       personaCol: "direccion_fiscal_num_ext" },
              { key: "numInt",       label: "Núm. interior",       value: f.numInt ?? "",       personaCol: "direccion_fiscal_num_int" },
              { key: "colonia",      label: "Colonia",             value: f.colonia ?? "",      personaCol: "direccion_fiscal_colonia" },
            ],
          });
        }
      } finally {
        setUploadingSlot(null);
      }
      return;
    }

    // Acta de nacimiento(1): si es PDF con texto oficial válido → auto-valida (con
    // confirmación de datos). Si es imagen o PDF sin marcadores → En revisión manual.
    if (primaryTipoId === 1) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      setUploadingSlot(slotKey);
      try {
        if (isPdf) {
          let text = "";
          try { text = await extractPdfText(file); } catch { text = ""; }
          if (text && text.trim().length >= 20 && validateActaNacimientoPdf(text).ok) {
            const f = extractActaNacimientoFields(text);
            setConfirmDoc({
              file, primaryTipoId, slotKey, tipo: "acta",
              fields: [
                { key: "curp",            label: "CURP",                value: f.curp ?? "",   personaCol: "curp" },
                { key: "nombre",          label: "Nombre completo",     value: f.nombre ?? "", personaCol: "nombre_legal" },
                { key: "fechaNacimiento", label: "Fecha de nacimiento", value: f.fechaNacimiento ?? "", personaCol: null },
                { key: "sexo",            label: "Sexo",                value: f.sexo === "H" ? "Hombre" : f.sexo === "M" ? "Mujer" : "", personaCol: null },
                { key: "lugarNacimiento", label: "Lugar de nacimiento", value: f.lugarNacimiento ?? "", personaCol: null },
              ],
            });
            return; // el modal confirma y registra (estatus 2)
          }
        }
        // Imagen o PDF sin texto/marcadores → En revisión manual.
        const ok = await commitDoc(file, primaryTipoId, 1);
        if (ok) toast.success("Documento enviado para revisión");
      } finally {
        setUploadingSlot(null);
      }
      return;
    }

    // Resto (INE, pasaporte, acta matrimonio, comprobante domicilio):
    // se acepta el archivo tal cual (imagen o PDF), sin validación → estatus 1 (En revisión).
    setUploadingSlot(slotKey);
    try {
      const ok = await commitDoc(file, primaryTipoId, 1);
      if (ok) toast.success("Documento enviado para revisión");
    } finally {
      setUploadingSlot(null);
    }
  };

  // Confirma los datos extraídos (posiblemente editados) → captura en `personas`
  // + registra el documento como validado (estatus 2).
  const handleConfirmDoc = async (editedValues: Record<string, string>) => {
    if (!confirmDoc) return;
    setSavingConfirm(true);
    try {
      const personaUpdates: Record<string, string> = {};
      for (const f of confirmDoc.fields) {
        const val = (editedValues[f.key] ?? f.value).trim();
        if (f.personaCol && val) personaUpdates[f.personaCol] = val;
      }
      // Régimen del CSF: viene como texto → resolver al id/código SAT del catálogo
      // (por código de 3 dígitos si aparece, o por nombre). persona.regimen guarda ese id.
      if (confirmDoc.tipo === 'csf' && regimenCatalog.length) {
        const regField = confirmDoc.fields.find(f => f.key === 'regimen');
        const regText = (editedValues['regimen'] ?? regField?.value ?? '').trim();
        if (regText) {
          const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
          const nText = norm(regText); /* norm: NFD + strip diacritics + alnum */
          const codeMatch = regText.match(/\b(\d{3})\b/)?.[1];
          const found =
            (codeMatch && regimenCatalog.find(r => String(r.id) === codeMatch)) ||
            regimenCatalog.find(r => { const n = norm(r.nombre); return n.length > 3 && (nText.includes(n) || n.includes(nText)); });
          if (found) personaUpdates['regimen'] = String(found.id);
        }
      }
      const ok = await commitDoc(confirmDoc.file, confirmDoc.primaryTipoId, 2, personaUpdates);
      if (ok) {
        toast.success("Documento verificado y datos guardados en tu perfil");
        setConfirmDoc(null);
      }
    } finally {
      setSavingConfirm(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) { toast.error("Ingresa tu contraseña actual"); return; }
    if (!pwChecks.minLength) { toast.error("La nueva contraseña debe tener al menos 8 caracteres"); return; }
    if (!pwChecks.matches) { toast.error("Las contraseñas no coinciden"); return; }
    setChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast.error((error as any)?.message || "Error al cambiar la contraseña");
      } else {
        toast.success("Contraseña actualizada correctamente");
        setShowChangePw(false);
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const closePw = () => {
    setShowChangePw(false);
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false);
  };

  /* ── Loading ── */
  if (loadingPersona || _loadingEmailFallback) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════ */
  /*  JSX                                        */
  /* ═══════════════════════════════════════════ */

  /* ── shared style tokens ── */
  // Los modales (Dialog/Sheet) se renderizan en un portal fuera del div raíz, así
  // que no heredan la fuente del portal cliente. Se les aplica system-ui explícito.
  const SYS_FONT: React.CSSProperties = { fontFamily: 'system-ui,-apple-system,sans-serif' };

  return (
    <div className="min-h-screen bg-[#F5F6F7] overflow-x-hidden" style={SYS_FONT}>
      <div className="mx-auto max-w-[1040px] px-4 sm:px-5 pt-4 pb-20 space-y-4">

        {/* ── Identity card (solo en overview / principal) ── */}
        {view === 'overview' && (
        <section className="rounded-md bg-white border border-[#ECEEF0] shadow-[0_1px_3px_rgba(20,30,25,0.04)] p-5 sm:p-[22px]">
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center">
            {/* Avatar + name row */}
            <div className="flex flex-1 min-w-0 items-center gap-3.5">
              <button
                type="button"
                onClick={() => canEditProfile && setShowPhotoModal(true)}
                disabled={!canEditProfile}
                title={canEditProfile ? "Cambiar foto de perfil" : undefined}
                aria-label={canEditProfile ? "Cambiar foto de perfil" : "Foto de perfil"}
                className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(158_64%_38%)] focus-visible:ring-offset-2 disabled:cursor-default"
              >
                {clienteUsuario?.foto_perfil_url ? (
                  <img
                    src={normalizeAvatarUrl(clienteUsuario.foto_perfil_url)}
                    alt={displayName}
                    className="h-[52px] w-[52px] rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[hsl(158_64%_38%)] text-[22px] font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                {canEditProfile && (
                  <span className="absolute -right-1 -bottom-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#E4E7EA] bg-white text-[#4B5563] shadow-[0_1px_4px_rgba(0,0,0,0.12)]">
                    <Camera className="h-3 w-3" />
                  </span>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="truncate text-[16px] sm:text-[19px] font-bold tracking-[-0.3px] text-[#171A1D]">{displayName}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {verStatus === 'verified' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EE] px-2.5 py-[3px] text-[10.5px] font-bold text-[hsl(158_64%_38%)]">
                      <CheckCircle2 className="h-3 w-3" /> Perfil verificado
                    </span>
                  )}
                  {verStatus === 'review' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBEFD9] px-2.5 py-[3px] text-[10.5px] font-bold text-[#B5730A]">
                      <Clock className="h-3 w-3" /> En revisión
                    </span>
                  )}
                  {verStatus === 'incomplete' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBE9E7] px-2.5 py-[3px] text-[10.5px] font-bold text-[#B84A3C]">
                      <AlertCircle className="h-3 w-3" /> Información incompleta
                    </span>
                  )}
                  <span className="text-[12px] font-semibold text-[#6B7280]">
                    {getTipoPersonaLabel(persona?.tipo_persona)}
                  </span>
                </div>
              </div>
            </div>
            {/* Panel de activación (perfil completado) */}
            <div className="w-full shrink-0 sm:w-[220px] sm:border-l sm:border-[#F2F4F5] sm:pl-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-[#9AA3AD]">Perfil completado</span>
                <span className="text-[18px] font-bold tabular-nums text-[hsl(158_64%_38%)]">{profileCompletion}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EEF0F2]">
                <div className="h-full rounded-full bg-[hsl(158_64%_38%)] transition-all duration-700" style={{ width: `${profileCompletion}%` }} />
              </div>
            </div>
          </div>
          {profileCompletion < 85 && (
            <div className="mt-3.5 flex items-start gap-2.5 rounded-md border border-[#EBCBA6] bg-[#FBE3CE] px-3.5 py-3">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B5601C]" />
              <div className="flex-1">
                <div className="text-[13px] font-bold text-[#B5601C]">
                  {profileCompletion < 50 ? 'Completa tu perfil para continuar' : 'Perfil casi completo'}
                </div>
                <div className="mt-0.5 text-[12px] font-medium text-[#B5601C]/85">
                  Sube tus documentos y llena tus datos personales y fiscales.
                </div>
              </div>
              <button
                onClick={() => setView('expediente')}
                className="shrink-0 whitespace-nowrap rounded-md border border-[#E6C98A] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[#B5601C] hover:bg-[#FFF8ED]"
              >
                Completar
              </button>
            </div>
          )}
        </section>
        )}

        {/* ═══════════════════════ OVERVIEW ═══════════════════════ */}
        {view === 'overview' && (
          <>
            {/* Motor hero (estilo agente: expediente + estado de secciones) */}
            {(() => {
              const docAllVerified = docsAllVerified;
              const secciones = [
                { state: docAllVerified ? 'val' : allDocs.length > 0 ? 'proc' : 'pend' },
                { state: persona?.nombre_legal ? 'val' : 'pend' },
                { state: persona?.regimen ? 'val' : 'pend' },
                { state: (cuentasBancarias.length === 0 || !cuentasBancarias.every(c => c.evidencia)) ? 'pend' : cuentasBancarias.every(c => c.estatus === 2) ? 'val' : 'proc' },
              ];
              const val = secciones.filter(s => s.state === 'val').length;
              const proc = secciones.filter(s => s.state === 'proc').length;
              const pend = secciones.filter(s => s.state === 'pend').length;
              const tally = [
                { n: val, label: 'validadas',  cls: 'bg-[#E8F5EE] text-[hsl(158_64%_38%)]' },
                { n: proc, label: 'en proceso', cls: 'bg-[#FBEFD9] text-[#B5730A]' },
                { n: pend, label: 'pendientes', cls: 'bg-[#EEF0F2] text-[#6B7280]' },
              ];
              return (
                <section className="flex flex-wrap gap-[22px] rounded-md border border-[#CFE9DA] bg-gradient-to-br from-[#F0FAF4] to-[#FBFEFC] p-[22px]">
                  <div className="min-w-[240px] flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-[1.2px] text-[hsl(158_64%_38%)]">Tu expediente · el motor de tu activación</div>
                    <h2 className="mt-2 text-[21px] font-bold leading-[1.25] tracking-[-0.4px] text-[#16331F]">Tu información se construye desde tus documentos.</h2>
                    <p className="mt-2 text-[13px] font-medium leading-relaxed text-[#3F5A4A]">Cada documento que subes alimenta tu información personal y fiscal. Solo validas lo que ya dijeron.</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3.5">
                      <button
                        onClick={() => setView('expediente')}
                        className="inline-flex items-center gap-2 rounded-md bg-[hsl(158_64%_38%)] px-[18px] py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
                      >
                        <FileText className="h-4 w-4" /> Gestionar documentos
                      </button>
                      <span className="text-[12px] font-semibold tabular-nums text-[#3F5A4A]">{val} de {secciones.length} secciones completadas</span>
                    </div>
                  </div>
                  <div className="w-[210px] shrink-0 rounded-md border border-[#DCEEE3] bg-white p-[15px]">
                    <div className="mb-3 text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">Estado de secciones</div>
                    <div className="flex flex-col gap-[11px]">
                      {tally.map((t) => (
                        <div key={t.label} className="flex items-center gap-2.5">
                          <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums ${t.cls}`}>{t.n}</span>
                          <span className="text-[12px] font-semibold text-[#4B5563]">{t.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* Secciones de tu perfil */}
            <div>
              <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[1px] text-[#9AA3AD]">
                Secciones de tu perfil
              </div>
              <div className="flex flex-col gap-2.5">
                <ProfileSectionRow
                  title="Documentos"
                  description="Sube y consulta tus documentos"
                  badge={sectionPill(docsAllVerified ? 'complete' : 'pending')}
                  onClick={() => setView('expediente')}
                />
                <ProfileSectionRow
                  title="Información personal"
                  description="Identificación y contacto"
                  badge={sectionPill(persona?.nombre_legal ? 'complete' : 'pending')}
                  onClick={() => setView('personal')}
                />
                <ProfileSectionRow
                  title="Información fiscal"
                  description="Régimen, CFDI y dirección"
                  badge={sectionPill((csfVerified || persona?.regimen) ? 'complete' : 'pending')}
                  onClick={() => setView('fiscal')}
                />
                <ProfileSectionRow
                  title="Cuentas bancarias"
                  description="Cuentas de dispersión"
                  badge={sectionPill(cuentasBancarias.length > 0 ? 'complete' : 'pending')}
                  onClick={() => setView('cuentas')}
                />

                {/* Seguridad - fila; al dar clic abre la modal de cambio de contraseña */}
                {!isImpersonating && (
                  <ProfileSectionRow
                    title="Seguridad"
                    description="Acceso y contraseña"
                    onClick={() => setShowChangePw(true)}
                  />
                )}

              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════ EXPEDIENTE DETAIL ═══════════════════════ */}
        {view === 'expediente' && (
          <section>
            <SubHeader title="Documentos" onBack={() => setView('overview')} />
            <div className="rounded-md border border-[#ECEEF0] bg-white shadow-[0_1px_3px_rgba(20,30,25,0.04)] p-5 sm:p-[22px]">
              {DOC_GROUPS.map((group) => {
                const groupSlots = SLOTS
                  .filter((s) => s.cat === group.key)
                  .slice()
                  .sort((a, b) => a.label.localeCompare(b.label, 'es'));
                return (
                  <div key={group.key} className="mb-[18px] last:mb-0">
                    <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">{group.label}</div>
                    <div className="flex flex-col gap-2.5">
                      {groupSlots.map((slot) => {
                        const slotDocs = allDocs.filter(d => slot.tipoIds.includes(d.tipoId) && d.owner === slot.owner);
                        const best = slotDocs.find(d => d.status === 'verified') || slotDocs.find(d => d.status === 'review') || slotDocs[0];
                        const status = best?.status ?? 'missing';
                        const isUploading = uploadingSlot === slot.key;
                        const hasFile = !!best?.url;
                        const isCamera = !!slot.camera;
                        // Ícono de acción: subir/cámara solo si falta el archivo, está
                        // vencido o fue rechazado (hay que cargar uno nuevo). Si está
                        // aprobado o en revisión → lápiz (reemplazar por si se equivocaron).
                        const needsUpload = status === 'missing' || status === 'expired' || status === 'rejected';
                        // Slot del representante legal sin persona vinculada → no se puede subir aquí.
                        const repMissing = slot.owner === 'rep' && !repLegalPersonaId;
                        const slotPersonaId = slot.owner === 'rep' ? repLegalPersonaId : effectivePersonaId;
                        const badge = repMissing ? { c:'text-[#B84A3C]', bg:'bg-[#FBE9E7]' } : status === 'verified' ? { c:'text-[hsl(158_64%_38%)]', bg:'bg-[#E8F5EE]' } : status === 'review' ? { c:'text-[#B5730A]', bg:'bg-[#FBEFD9]' } : status === 'rejected' ? { c:'text-[#B84A3C]', bg:'bg-[#FBE9E7]' } : { c:'text-[#6B7280]', bg:'bg-[#F2F4F5]' };
                        const badgeLabel = repMissing ? 'Sin representante legal' : status === 'verified' ? 'Aprobado' : status === 'review' ? 'En revisión' : status === 'rejected' ? 'Rechazado' : status === 'expired' ? 'Expirado' : 'Pendiente';
                        return (
                          <div key={slot.key} className="flex items-center gap-3.5 rounded-md border border-[#ECEEF0] bg-white px-4 py-[13px]">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F2F4F5] text-[#6B7280]">
                              <FileText className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-[13px] font-bold text-[#171A1D]">{slot.label}</span>
                                <span className={`rounded-full px-2.5 py-[3px] text-[9.5px] font-bold ${badge.bg} ${badge.c}`}>{badgeLabel}</span>
                              </div>
                              <p className="mt-0.5 text-[11.5px] font-medium text-[#9AA3AD]">{repMissing ? 'Falta capturar al representante legal' : best?.date ? `Subido el ${best.date}` : 'Sin cargar'}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <input
                                ref={(el) => { fileInputRefs.current[slot.key] = el; }}
                                type="file"
                                accept={AUTO_VALIDATE_TIPO_IDS.includes(slot.primaryTipoId) ? '.pdf' : '.pdf,.jpg,.jpeg,.png,.webp'}
                                className="hidden"
                                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadDoc(file, slot.key, slot.primaryTipoId, slot.owner, slotPersonaId); e.target.value = ''; }}
                              />
                              {/* INE frente/reverso y pasaporte → captura por cámara. Resto → subir archivo. */}
                              <button
                                onClick={() => { if (isCamera) { setCameraMode(slot.key.startsWith('pasaporte') ? 'pasaporte' : 'ine'); setCameraPersonaId(slotPersonaId ?? effectivePersonaId); setIneCaptureOpen(true); } else fileInputRefs.current[slot.key]?.click(); }}
                                disabled={isUploading || repMissing}
                                title={repMissing ? 'Primero captura al representante legal' : needsUpload ? (isCamera ? 'Capturar con cámara' : 'Subir documento') : 'Reemplazar documento'}
                                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#ECEEF0] bg-white text-[#4B5563] transition-colors hover:bg-[#F6F7F8] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : needsUpload ? (isCamera ? <Camera className="h-4 w-4" /> : <Upload className="h-4 w-4" />) : <Pencil className="h-4 w-4" />}
                              </button>
                              {hasFile && (
                                <button
                                  onClick={() => setPreviewDoc({ title:slot.label, url:best!.url! })}
                                  title="Ver documento"
                                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[#ECEEF0] bg-white text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Cuenta bancaria - formulario estructurado, va bajo "Fiscal y financiero" */}
                      {group.key === 'financiero' && (() => {
                        const bankHasEvidencia = cuentasBancarias.some(c => c.evidencia);
                        const bankAllEvidencia = cuentasBancarias.length > 0 && cuentasBancarias.every(c => c.evidencia);
                        const bankAllValid = cuentasBancarias.length > 0 && cuentasBancarias.every(c => c.estatus === 2);
                        // Sin evidencia no puede ir a revisión (falta la carátula) → Incompleto.
                        const bankBadge = cuentasBancarias.length === 0
                          ? { label:'Pendiente', c:'text-[#6B7280]', bg:'bg-[#F2F4F5]' }
                          : !bankAllEvidencia
                            ? { label:'Incompleto', c:'text-[#B84A3C]', bg:'bg-[#FBE9E7]' }
                            : bankAllValid
                              ? { label:'Validada', c:'text-[hsl(158_64%_38%)]', bg:'bg-[#E8F5EE]' }
                              : { label:'En revisión', c:'text-[#B5730A]', bg:'bg-[#FBEFD9]' };
                        return (
                          <div className="flex items-center gap-3.5 rounded-md border border-[#ECEEF0] bg-white px-4 py-[13px]">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F2F4F5] text-[#6B7280]">
                              <CreditCard className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-[13px] font-bold text-[#171A1D]">Cuenta bancaria</span>
                                <span className={`rounded-full px-2.5 py-[3px] text-[9.5px] font-bold ${bankBadge.bg} ${bankBadge.c}`}>{bankBadge.label}</span>
                              </div>
                              <p className="mt-0.5 text-[11.5px] font-medium text-[#9AA3AD]">
                                {cuentasBancarias.length > 0
                                  ? `${cuentasBancarias.length} cuenta${cuentasBancarias.length > 1 ? 's' : ''} registrada${cuentasBancarias.length > 1 ? 's' : ''}`
                                  : 'Banco, número de cuenta, CLABE y titular'}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {canEditProfile && (
                                <button
                                  onClick={() => { setAddCuenta(EMPTY_CUENTA); setAddEvidencia(null); setBancoSearch(''); setShowBancoList(false); setShowAddCuenta(true); }}
                                  title="Agregar cuenta bancaria"
                                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[#ECEEF0] bg-white text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
                                >
                                  <Upload className="h-4 w-4" />
                                </button>
                              )}
                              {bankHasEvidencia && (
                                <button
                                  onClick={() => setView('cuentas')}
                                  title="Ver cuentas"
                                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[#ECEEF0] bg-white text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══════════════════════ PERSONAL DETAIL ═══════════════════════ */}
        {view === 'personal' && (
          <section>
            <SubHeader title="Información personal" onBack={() => setView('overview')} />
            <div className="rounded-md border border-[#ECEEF0] bg-white shadow-[0_1px_3px_rgba(20,30,25,0.04)] p-5 sm:p-[22px]">
              {canEditProfile && (
                <div className="mb-[18px] flex justify-end">
                  <button onClick={openEditPersonal} className="inline-flex items-center gap-1.5 rounded-md border border-[#ECEEF0] px-3 py-1.5 text-[12px] font-bold text-[#4B5563] transition-colors hover:bg-[#F6F7F8]">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                </div>
              )}
              <div className="divide-y divide-[#F2F4F5]">
                {[
                  { label:'Tipo de persona', value:getTipoPersonaLabel(persona?.tipo_persona) },
                  { label:'Nombre completo', value:persona?.nombre_legal },
                  { label:'RFC con homoclave', value:persona?.rfc, mono:true },
                  { label:'CURP', value:persona?.curp, mono:true },
                  { label:'Teléfono', value:persona?.telefono ? `${persona.clave_pais_telefono || '+52'} ${persona.telefono}` : null },
                  { label:'Ocupación', value:(persona as any)?.ocupacion || null },
                  { label:'Correo electrónico', value:persona?.email || profile?.email, note:'No editable' },
                ].map((f) => (
                  <div key={f.label} className="flex items-start justify-between gap-4 py-3">
                    <span className="shrink-0 text-[12px] font-medium text-[#9AA3AD]">{f.label}</span>
                    <div className="min-w-0 text-right">
                      {f.value
                        ? <span className={`text-[12.5px] font-semibold text-[#171A1D] ${(f as any).mono ? 'font-mono tracking-wide' : ''}`}>{f.value}</span>
                        : <span className="text-[12px] italic text-[#9AA3AD]">Sin registro</span>
                      }
                      {f.note && <div className="mt-0.5 text-[10.5px] text-[#9AA3AD]">{f.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════ FISCAL DETAIL ═══════════════════════ */}
        {view === 'fiscal' && (
          <section>
            <SubHeader title="Información fiscal" onBack={() => setView('overview')} />
            <div className="rounded-md border border-[#ECEEF0] bg-white shadow-[0_1px_3px_rgba(20,30,25,0.04)] p-5 sm:p-[22px]">
              {canEditProfile && (
                <div className="mb-[18px] flex justify-end">
                  <button onClick={openEditFiscal} className="inline-flex items-center gap-1.5 rounded-md border border-[#ECEEF0] px-3 py-1.5 text-[12px] font-bold text-[#4B5563] transition-colors hover:bg-[#F6F7F8]">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                </div>
              )}
              <div className="divide-y divide-[#F2F4F5]">
                {[
                  { label:'Régimen fiscal', value:regimenDisplay },
                  { label:'Uso CFDI', value:usoCfdiDisplay },
                  { label:'Código postal', value:persona?.direccion_fiscal_codigo_postal?.trim(), mono:true },
                  { label:'Calle', value:persona?.direccion_fiscal_calle?.trim() },
                  { label:'Núm. exterior', value:persona?.direccion_fiscal_num_ext },
                  { label:'Núm. interior', value:persona?.direccion_fiscal_num_int },
                  { label:'Colonia', value:persona?.direccion_fiscal_colonia },
                ].map((f) => (
                  <div key={f.label} className="flex items-start justify-between gap-4 py-3">
                    <span className="shrink-0 text-[12px] font-medium text-[#9AA3AD]">{f.label}</span>
                    <div className="min-w-0 text-right">
                      {f.value
                        ? <span className={`text-[12.5px] font-semibold text-[#171A1D] ${(f as any).mono ? 'font-mono tracking-wide' : ''}`}>{f.value}</span>
                        : <span className="text-[12px] italic text-[#9AA3AD]">Sin registro</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════ CUENTAS DETAIL ═══════════════════════ */}
        {view === 'cuentas' && (
          <section>
            <SubHeader title="Cuentas bancarias" onBack={() => setView('overview')} />
            <div className="rounded-md border border-[#ECEEF0] bg-white shadow-[0_1px_3px_rgba(20,30,25,0.04)] p-5 sm:p-[22px]">
              <div className="mb-[18px] flex items-start gap-3 rounded-md border border-[#C9DCF2] bg-[#EAF2FB] px-4 py-3 text-[12px] font-medium text-[#2A557F]">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Por tu seguridad, toda alta o cambio de cuenta se notifica de inmediato.
              </div>
              {cuentasBancarias.length === 0 ? (
                <div className="mb-3.5 rounded-md border border-dashed border-[#D6DBDF] bg-[#FAFBFB] px-4 py-8 text-center">
                  <div className="text-[13px] font-bold text-[#171A1D]">Sin cuentas registradas.</div>
                  <div className="mt-1 text-[12.5px] font-medium text-[#9AA3AD]">Regístrala en Documentos → Cuenta bancaria.</div>
                </div>
              ) : (
                <div className="mb-3.5 flex flex-col gap-2.5">
                  {cuentasBancarias.map(c => (
                    <div key={c.id} className="flex items-center gap-3.5 rounded-md border border-[#ECEEF0] bg-white p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#EAF2FB] text-[#2A6FDB]">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-bold text-[#171A1D]">{c.banco}</div>
                        {c.numeroCuenta && <div className="mt-1 font-mono text-[13px] font-semibold tracking-[1px] text-[#4B5563]">****{c.numeroCuenta.slice(-4)}</div>}
                        {c.titular && <div className="mt-1 text-[11.5px] font-medium text-[#9AA3AD]">Titular: {c.titular}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {(() => {
                          // Sin evidencia (carátula) → Incompleto; no puede ir a revisión.
                          const b = !c.evidencia ? { l:'Incompleto', c:'text-[#B84A3C]', bg:'bg-[#FBE9E7]' }
                                  : c.estatus === 2 ? { l:'Validada', c:'text-[hsl(158_64%_38%)]', bg:'bg-[#E8F5EE]' }
                                  : c.estatus === 3 ? { l:'Rechazada', c:'text-[#B84A3C]', bg:'bg-[#FBE9E7]' }
                                  : { l:'En revisión', c:'text-[#B5730A]', bg:'bg-[#FBEFD9]' };
                          return (
                            <span className={`rounded-full px-2.5 py-[3px] text-[9.5px] font-bold ${b.bg} ${b.c}`}>{b.l}</span>
                          );
                        })()}
                        {c.evidencia && (
                          <button
                            onClick={() => setPreviewDoc({ title:`Evidencia · ${c.banco}`, url:c.evidencia! })}
                            title="Ver evidencia"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#ECEEF0] bg-white text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-1 text-center text-[12px] font-medium text-[#9AA3AD]">
                Para registrar una cuenta, ve a <button onClick={() => setView('expediente')} className="font-bold text-[hsl(158_64%_38%)]">Documentos → Cuenta bancaria</button>.
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════
            MODAL - Editar datos personales
        ══════════════════════════════════════════════ */}
        {(() => {
          const onClose = () => setShowEditPersonal(false);
          const content = (
            <>
              <ModalHeader icon={User} title="Datos personales" subtitle="Actualiza tu información de identificación" onClose={onClose} />
              <div className="px-5 pt-4 pb-2 space-y-4 overflow-y-auto flex-1">
                <FormField label="Nombre completo *">
                  <input
                    autoFocus
                    className={INPUT_CLS}
                    value={editPersonal.nombre_legal}
                    onChange={(e) => setEditPersonal(f => ({ ...f, nombre_legal: e.target.value }))}
                    placeholder="Nombre completo o razón social"
                  />
                </FormField>
                <FormField label="RFC con homoclave">
                  <input
                    className={`${INPUT_CLS} tracking-wider`}
                    value={editPersonal.rfc}
                    onChange={(e) => setEditPersonal(f => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                    placeholder="AAAA######AAA"
                    maxLength={13}
                  />
                </FormField>
                <FormField label="CURP">
                  <input
                    className={`${INPUT_CLS} tracking-wider`}
                    value={editPersonal.curp}
                    onChange={(e) => setEditPersonal(f => ({ ...f, curp: e.target.value.toUpperCase() }))}
                    placeholder="18 caracteres"
                    maxLength={18}
                  />
                </FormField>
                <FormField label="Teléfono">
                  <div className="flex h-11 rounded-md border border-[#ECEEF0] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[hsl(158_64%_38%)]/30 transition-shadow">
                    <select
                      value={editPersonal.clave_pais_telefono}
                      onChange={(e) => setEditPersonal(f => ({ ...f, clave_pais_telefono: e.target.value }))}
                      className="bg-transparent border-r border-[#ECEEF0] px-3 text-sm text-[#171A1D] focus:outline-none appearance-none cursor-pointer shrink-0"
                    >
                      <option value="+52">🇲🇽 +52</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+34">🇪🇸 +34</option>
                      <option value="+57">🇨🇴 +57</option>
                      <option value="+54">🇦🇷 +54</option>
                      <option value="+56">🇨🇱 +56</option>
                    </select>
                    <input
                      type="tel"
                      value={editPersonal.telefono}
                      onChange={(e) => setEditPersonal(f => ({ ...f, telefono: e.target.value }))}
                      placeholder="10 dígitos"
                      inputMode="tel"
                      maxLength={15}
                      className="flex-1 bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                </FormField>
                <FormField label="Ocupación">
                  <SearchSelect
                    value={ocupacionOtro ? "Otro" : editPersonal.ocupacion}
                    onChange={(v) => {
                      if (v === "Otro") { setOcupacionOtro(true); setEditPersonal(f => ({ ...f, ocupacion: "" })); }
                      else { setOcupacionOtro(false); setEditPersonal(f => ({ ...f, ocupacion: v })); }
                    }}
                    options={OCUPACIONES_OPCIONES}
                    placeholder="Selecciona tu ocupación..."
                    getLabel={(o) => o.nombre}
                    getValue={(o) => o.nombre}
                  />
                  {ocupacionOtro && (
                    <input
                      className={`${INPUT_CLS} mt-2`}
                      value={editPersonal.ocupacion}
                      onChange={(e) => setEditPersonal(f => ({ ...f, ocupacion: e.target.value }))}
                      placeholder="Especifica tu ocupación"
                    />
                  )}
                </FormField>
                <div className="rounded-md bg-muted/40 px-3 py-2.5 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">El correo electrónico no se puede modificar desde aquí.</p>
                </div>
              </div>
              <div className="px-5 pb-8 pt-3 space-y-2.5 border-t border-border/50 shrink-0">
                <PrimaryBtn onClick={handleSavePersonal} loading={savingPersonal} label="Guardar cambios" />
                <CancelBtn onClick={onClose} />
              </div>
            </>
          );
          return isDesktop ? (
            <Dialog open={showEditPersonal} onOpenChange={(v) => !v && onClose()}>
              <DialogContent style={SYS_FONT} className="p-0 max-w-sm flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showEditPersonal} onOpenChange={(v) => !v && onClose()}>
              <SheetContent style={SYS_FONT} side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[85dvh] [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        {/* ══════════════════════════════════════════════
            MODAL - Editar datos fiscales
        ══════════════════════════════════════════════ */}
        {(() => {
          const onClose = () => setShowEditFiscal(false);
          const content = (
            <>
              <ModalHeader icon={Building2} title="Datos fiscales" subtitle="Régimen, CFDI y dirección fiscal" onClose={onClose} />
              <div className="px-5 pt-4 pb-2 space-y-4 overflow-y-auto flex-1">
                <FormField label="Régimen fiscal">
                  <SearchSelect
                    value={editFiscal.regimen}
                    onChange={(v) => setEditFiscal(f => ({ ...f, regimen: v }))}
                    options={regimenOptions}
                    placeholder="Buscar régimen fiscal..."
                    getLabel={(o) => `${o.id} - ${o.nombre}`}
                    getValue={(o) => String(o.id)}
                  />
                </FormField>
                <FormField label="Uso CFDI">
                  <SearchSelect
                    value={editFiscal.uso_cfdi}
                    onChange={(v) => setEditFiscal(f => ({ ...f, uso_cfdi: v }))}
                    options={usoCfdiOptions}
                    placeholder="Buscar uso CFDI..."
                    getLabel={(o) => `${o.codigo} - ${o.nombre}`}
                    getValue={(o) => o.codigo}
                  />
                </FormField>
                <FormField label="Código postal">
                  <input
                    className={`${INPUT_CLS}`}
                    value={editFiscal.direccion_fiscal_codigo_postal}
                    onChange={(e) => setEditFiscal(f => ({ ...f, direccion_fiscal_codigo_postal: e.target.value }))}
                    placeholder="00000"
                    maxLength={5}
                    inputMode="numeric"
                  />
                </FormField>
                <FormField label="Calle">
                  <input
                    className={INPUT_CLS}
                    value={editFiscal.direccion_fiscal_calle}
                    onChange={(e) => setEditFiscal(f => ({ ...f, direccion_fiscal_calle: e.target.value }))}
                    placeholder="Nombre de la calle"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Núm. exterior">
                    <input
                      className={INPUT_CLS}
                      value={editFiscal.direccion_fiscal_num_ext}
                      onChange={(e) => setEditFiscal(f => ({ ...f, direccion_fiscal_num_ext: e.target.value }))}
                      placeholder="123"
                    />
                  </FormField>
                  <FormField label="Núm. interior">
                    <input
                      className={INPUT_CLS}
                      value={editFiscal.direccion_fiscal_num_int}
                      onChange={(e) => setEditFiscal(f => ({ ...f, direccion_fiscal_num_int: e.target.value }))}
                      placeholder="A"
                    />
                  </FormField>
                </div>
                <FormField label="Colonia">
                  <input
                    className={INPUT_CLS}
                    value={editFiscal.direccion_fiscal_colonia}
                    onChange={(e) => setEditFiscal(f => ({ ...f, direccion_fiscal_colonia: e.target.value }))}
                    placeholder="Nombre de la colonia"
                  />
                </FormField>
              </div>
              <div className="px-5 pb-8 pt-3 space-y-2.5 border-t border-border/50 shrink-0">
                <PrimaryBtn onClick={handleSaveFiscal} loading={savingFiscal} label="Guardar cambios" />
                <CancelBtn onClick={onClose} />
              </div>
            </>
          );
          return isDesktop ? (
            <Dialog open={showEditFiscal} onOpenChange={(v) => !v && onClose()}>
              <DialogContent style={SYS_FONT} className="p-0 max-w-sm flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showEditFiscal} onOpenChange={(v) => !v && onClose()}>
              <SheetContent style={SYS_FONT} side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[90dvh] [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        {/* ══════════════════════════════════════════════
            MODAL - Cambiar contraseña
        ══════════════════════════════════════════════ */}
        {(() => {
          const content = (
            <>
              <ModalHeader icon={Lock} title="Cambiar contraseña" subtitle="Actualiza tu contraseña de acceso" onClose={closePw} />
              <div className="px-5 pt-4 pb-2 space-y-4 overflow-y-auto flex-1">
                <PwField label="Contraseña actual" value={currentPassword} onChange={setCurrentPassword}
                  placeholder="Tu contraseña actual" show={showCurrentPw} onToggle={() => setShowCurrentPw(v => !v)} autoComp="current-password" />
                <PwField label="Nueva contraseña" value={newPassword} onChange={setNewPassword}
                  placeholder="Nueva contraseña" show={showNewPw} onToggle={() => setShowNewPw(v => !v)} autoComp="new-password" />
                <PwField label="Confirmar contraseña" value={confirmPassword} onChange={setConfirmPassword}
                  placeholder="Repite la nueva contraseña" show={showConfirmPw} onToggle={() => setShowConfirmPw(v => !v)} autoComp="new-password" />
                {newPassword.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-muted/30 rounded-md p-3">
                    <PwCheck label="8 caracteres mínimo"   ok={pwChecks.minLength} />
                    <PwCheck label="Letra mayúscula"        ok={pwChecks.hasUpper} />
                    <PwCheck label="Letra minúscula"        ok={pwChecks.hasLower} />
                    <PwCheck label="Número"                 ok={pwChecks.hasNumber} />
                    <PwCheck label="Carácter especial"      ok={pwChecks.hasSpecial} />
                    {confirmPassword.length > 0 && <PwCheck label="Contraseñas coinciden" ok={pwChecks.matches} />}
                  </div>
                )}
              </div>
              <div className="px-5 pb-8 pt-3 space-y-2.5 border-t border-border/50 shrink-0">
                {/* Dos botones separados - clases estáticas para que Tailwind no purgue bg-emerald */}
                {pwReady
                  ? <PrimaryBtn onClick={handleChangePassword} loading={changingPassword} label="Confirmar" />
                  : <GrayBtn label="Confirmar" />}
                <CancelBtn onClick={closePw} />
              </div>
            </>
          );
          return isDesktop ? (
            <Dialog open={showChangePw} onOpenChange={(v) => !v && closePw()}>
              <DialogContent style={SYS_FONT} className="p-0 max-w-md flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showChangePw} onOpenChange={(v) => !v && closePw()}>
              <SheetContent style={SYS_FONT} side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[85dvh] [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        {/* ══════════════════════════════════════════════
            MODAL - Verificar contraseña (gate)
        ══════════════════════════════════════════════ */}
        {(() => {
          const onClose = () => { setShowPwAuth(false); setPwAuthInput(''); };
          const content = (
            <>
              <ModalHeader icon={Lock} title="Confirmar identidad" subtitle="Ingresa tu contraseña para guardar los cambios" onClose={onClose} />
              <div className="px-5 pt-4 pb-2 space-y-4 overflow-y-auto flex-1">
                <FormField label="Contraseña actual">
                  <div className="relative">
                    <input
                      autoFocus
                      type={showPwAuthInput ? "text" : "password"}
                      className={`${INPUT_CLS} pr-10`}
                      value={pwAuthInput}
                      onChange={(e) => setPwAuthInput(e.target.value)}
                      placeholder="Tu contraseña"
                      autoComplete="current-password"
                      onKeyDown={(e) => e.key === 'Enter' && pwAuthInput && handlePwAuth()}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPwAuthInput(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPwAuthInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormField>
              </div>
              <div className="px-5 pb-8 pt-3 space-y-2.5 border-t border-border/50 shrink-0">
                {pwAuthInput
                  ? <PrimaryBtn onClick={handlePwAuth} loading={verifyingPw} label="Continuar" />
                  : <GrayBtn label="Continuar" />}
                <CancelBtn onClick={onClose} />
              </div>
            </>
          );
          return isDesktop ? (
            <Dialog open={showPwAuth} onOpenChange={(v) => !v && onClose()}>
              <DialogContent style={SYS_FONT} className="p-0 max-w-sm flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showPwAuth} onOpenChange={(v) => !v && onClose()}>
              <SheetContent style={SYS_FONT} side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[85dvh] [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        {/* ══════════════════════════════════════════════
            MODAL - Agregar cuenta bancaria
        ══════════════════════════════════════════════ */}
        {(() => {
          const onClose = () => { setShowAddCuenta(false); setAddCuenta(EMPTY_CUENTA); setAddEvidencia(null); };
          const personaNombre = persona?.nombre_legal || '';
          const titularIsSame = !!personaNombre && addCuenta.titular.trim() === personaNombre.trim();
          const content = (
            <>
              <ModalHeader title="Nueva cuenta bancaria" subtitle="SOZU usará esta cuenta para depósitos" onClose={onClose} />
              <div className="px-5 pt-4 pb-2 space-y-4 overflow-y-auto flex-1">
                <FormField label="Banco *">
                  <div className="relative">
                    <input
                      className={INPUT_CLS}
                      value={addCuenta.id_banco
                        ? (bancosOptions.find(b => String(b.id) === addCuenta.id_banco)?.nombre || '')
                        : bancoSearch}
                      placeholder="Buscar banco..."
                      onFocus={() => setShowBancoList(true)}
                      onChange={(e) => { setBancoSearch(e.target.value); setAddCuenta(f => ({ ...f, id_banco: '' })); setShowBancoList(true); }}
                      onBlur={() => setTimeout(() => setShowBancoList(false), 150)}
                    />
                    {showBancoList && (() => {
                      const q = bancoSearch.trim();
                      const filtrados = bancosOptions.filter(b => !q || b.nombre.toLowerCase().includes(q.toLowerCase()));
                      const hayExacto = !!q && bancosOptions.some(b => b.nombre.trim().toLowerCase() === q.toLowerCase());
                      const puedeAgregar = q.length >= 2 && !hayExacto;
                      return (
                        <div className="mt-1 max-h-60 overflow-y-auto rounded-md border border-[#ECEEF0] bg-white shadow-lg">
                          {filtrados.map(b => (
                            <button key={b.id} type="button"
                              onMouseDown={() => { setAddCuenta(f => ({ ...f, id_banco: String(b.id) })); setBancoSearch(''); setShowBancoList(false); }}
                              className={`block w-full px-3 py-2.5 text-left text-sm transition-colors ${String(b.id) === addCuenta.id_banco ? 'bg-[#E8F5EE] text-[hsl(158_64%_38%)] font-semibold' : 'text-[#171A1D] hover:bg-[#F6F7F8]'}`}
                            >
                              {b.nombre}
                            </button>
                          ))}
                          {filtrados.length === 0 && !puedeAgregar && (
                            <div className="px-3 py-2.5 text-sm text-[#9AA3AD]">Sin resultados</div>
                          )}
                          {puedeAgregar && (
                            <button type="button"
                              onMouseDown={(e) => { e.preventDefault(); setNuevoBanco(q); setShowBancoList(false); setShowAddBanco(true); }}
                              className="flex w-full items-center gap-2 border-t border-[#ECEEF0] px-3 py-2.5 text-left text-sm font-medium text-[hsl(158_64%_38%)] transition-colors hover:bg-[#F6F7F8]"
                            >
                              <Plus className="h-4 w-4 shrink-0" />
                              Agregar «{q}»
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </FormField>
                <FormField label="Número de cuenta *">
                  <input
                    className={`${INPUT_CLS} tracking-wider`}
                    value={addCuenta.numero_cuenta}
                    onChange={(e) => setAddCuenta(f => ({ ...f, numero_cuenta: e.target.value.replace(/[^0-9A-Za-z]/g,'') }))}
                    placeholder="Entre 8 y 34 caracteres"
                    maxLength={34}
                  />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="CLABE">
                    <input
                      className={`${INPUT_CLS} tracking-wider`}
                      value={addCuenta.cuenta_clabe}
                      onChange={(e) => setAddCuenta(f => ({ ...f, cuenta_clabe: e.target.value.replace(/\D/g,'') }))}
                      placeholder="18 dígitos (opcional)"
                      maxLength={18}
                      inputMode="numeric"
                    />
                  </FormField>
                  <FormField label="Código SWIFT">
                    <input
                      className={`${INPUT_CLS} tracking-wider uppercase`}
                      value={addCuenta.cuenta_swift}
                      onChange={(e) => setAddCuenta(f => ({ ...f, cuenta_swift: e.target.value.replace(/[^0-9A-Za-z]/g,'').toUpperCase() }))}
                      placeholder="8 u 11 caracteres (opcional)"
                      maxLength={11}
                    />
                  </FormField>
                </div>
                <FormField label="Titular de la cuenta *">
                  {personaNombre && (
                    <label className="mb-2 flex cursor-pointer items-center gap-2 text-[13px] text-[#6B7280]">
                      <input
                        type="checkbox"
                        checked={titularIsSame}
                        onChange={(e) => setAddCuenta(f => ({ ...f, titular: e.target.checked ? personaNombre : '' }))}
                      />
                      El titular es {personaNombre}
                    </label>
                  )}
                  <input
                    className={INPUT_CLS}
                    value={addCuenta.titular}
                    onChange={(e) => setAddCuenta(f => ({ ...f, titular: e.target.value }))}
                    placeholder="Nombre completo del titular"
                  />
                </FormField>
                <FormField label="Evidencia *">
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-[#D6DBDF] px-3 py-[18px] text-center transition-colors hover:border-[hsl(158_64%_38%)]">
                    <Upload className="h-[18px] w-[18px] text-[#9AA3AD]" />
                    <span className={`text-[12.5px] ${addEvidencia ? 'font-semibold text-[#171A1D]' : 'font-medium text-[#9AA3AD]'}`}>
                      {addEvidencia ? addEvidencia.name : 'Sube la carátula de tu estado de cuenta'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setAddEvidencia(f); e.target.value = ''; }}
                    />
                  </label>
                </FormField>
              </div>
              <div className="px-5 pb-8 pt-3 flex gap-2.5 border-t border-[#ECEEF0] shrink-0">
                <button
                  onClick={onClose}
                  className="flex-1 h-11 rounded-md text-sm font-semibold border border-[hsl(158_64%_38%)] bg-white text-[hsl(158_64%_38%)] hover:bg-[#F6FBF8] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddCuenta}
                  disabled={savingCuenta || !(addCuenta.id_banco && addCuenta.numero_cuenta.trim().length >= 8 && addCuenta.titular.trim() && addEvidencia)}
                  className="flex-1 h-11 rounded-md text-sm font-semibold flex items-center justify-center gap-2 bg-[hsl(158_64%_38%)] text-white hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingCuenta && <Loader2 className="w-4 h-4 animate-spin" />}
                  {savingCuenta ? 'Guardando...' : 'Guardar cuenta'}
                </button>
              </div>
            </>
          );
          return isDesktop ? (
            <Dialog open={showAddCuenta} onOpenChange={(v) => !v && onClose()}>
              <DialogContent style={SYS_FONT} className="p-0 max-w-xl flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showAddCuenta} onOpenChange={(v) => !v && onClose()}>
              <SheetContent style={SYS_FONT} side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[90dvh] [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        {/* ══════════════════════════════════════════════
            MODAL - Agregar banco (fuera de catálogo)
        ══════════════════════════════════════════════ */}
        {(() => {
          const onClose = () => { setShowAddBanco(false); setNuevoBanco(''); };
          const valido = nuevoBanco.trim().length >= 2;
          const content = (
            <>
              <ModalHeader title="Agregar banco" subtitle="Registra un banco que no está en el catálogo" onClose={onClose} />
              <div className="px-5 pt-4 pb-2 space-y-4 overflow-y-auto flex-1">
                <FormField label="Nombre del banco *">
                  <input
                    className={INPUT_CLS}
                    value={nuevoBanco}
                    autoFocus
                    onChange={(e) => setNuevoBanco(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && valido && !addingBanco) handleAddBanco(); }}
                    placeholder="Ej. Bank of America, Santander España…"
                    maxLength={120}
                  />
                </FormField>
              </div>
              <div className="px-5 pb-8 pt-3 flex gap-2.5 border-t border-[#ECEEF0] shrink-0">
                <button
                  onClick={onClose}
                  className="flex-1 h-11 rounded-md text-sm font-semibold border border-[hsl(158_64%_38%)] bg-white text-[hsl(158_64%_38%)] hover:bg-[#F6FBF8] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddBanco}
                  disabled={!valido || addingBanco}
                  className="flex-1 h-11 rounded-md text-sm font-semibold flex items-center justify-center gap-2 bg-[hsl(158_64%_38%)] text-white hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingBanco && <Loader2 className="w-4 h-4 animate-spin" />}
                  {addingBanco ? 'Guardando...' : 'Guardar banco'}
                </button>
              </div>
            </>
          );
          return isDesktop ? (
            <Dialog open={showAddBanco} onOpenChange={(v) => !v && onClose()}>
              <DialogContent style={SYS_FONT} className="p-0 max-w-md flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showAddBanco} onOpenChange={(v) => !v && onClose()}>
              <SheetContent style={SYS_FONT} side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[85dvh] [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        {/* ══════════════════════════════════════════════
            Doc viewer
        ══════════════════════════════════════════════ */}

        {isDesktop ? (
          <Dialog open={!!previewDoc} onOpenChange={(v) => { if (!v) setPreviewDoc(null); }}>
            <DialogContent style={SYS_FONT} className="p-0 max-w-3xl h-[85vh] flex flex-col [&>button:last-child]:hidden">
              {previewDoc && (
                <>
                  <DocViewerHeader doc={previewDoc} />
                  <DocViewerBody doc={previewDoc} />
                  <div className="px-4 pb-5 pt-3 border-t border-border/50 flex gap-2 shrink-0">
                    <button onClick={() => downloadDocFile(previewDoc.url, previewDoc.title)}
                      className="flex-1 h-10 flex items-center justify-center gap-2 text-sm font-semibold text-[hsl(158_64%_38%)] bg-[#E8F5EE] hover:opacity-80 rounded-md transition-opacity">
                      <Download className="w-4 h-4" />
                      Descargar
                    </button>
                    <button onClick={() => setPreviewDoc(null)}
                      className="flex-1 h-10 text-sm font-semibold text-destructive hover:bg-destructive/5 rounded-md transition-colors">
                      Cerrar
                    </button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        ) : (
          <Sheet open={!!previewDoc} onOpenChange={(v) => { if (!v) setPreviewDoc(null); }}>
            <SheetContent style={SYS_FONT} side="bottom" className="max-h-[78dvh] p-0 rounded-t-2xl flex flex-col [&>button:last-child]:hidden">
              {previewDoc && (
                <>
                  <DocViewerHeader doc={previewDoc} />
                  <DocViewerBody doc={previewDoc} />
                  <div className="px-4 pb-8 pt-3 border-t border-border/50 flex gap-2 shrink-0">
                    <button onClick={() => downloadDocFile(previewDoc.url, previewDoc.title)}
                      className="flex-1 h-10 flex items-center justify-center gap-2 text-sm font-semibold text-[hsl(158_64%_38%)] bg-[#E8F5EE] hover:opacity-80 rounded-md transition-opacity">
                      <Download className="w-4 h-4" />
                      Descargar
                    </button>
                    <button onClick={() => setPreviewDoc(null)}
                      className="flex-1 h-10 text-sm font-semibold text-destructive hover:bg-destructive/5 rounded-md transition-colors">
                      Cerrar
                    </button>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        )}

        {/* ══════════════════════════════════════════════
            MODAL - Foto de perfil (bucket `avatar`)
        ══════════════════════════════════════════════ */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoFileSelect}
        />
        {(() => {
          const content = !pendingFile ? (
            /* ── Fase 1: Opciones ── */
            <>
              <div className="flex flex-col items-center gap-2 bg-[hsl(158_64%_38%)] px-5 pt-5 pb-6 sm:pt-7 sm:pb-8">
                <p className="text-center text-[14px] sm:text-[15px] font-semibold uppercase tracking-wide text-white/80">Foto de perfil</p>
                <div className="relative mt-2 sm:mt-3">
                  {clienteUsuario?.foto_perfil_url ? (
                    <img
                      src={normalizeAvatarUrl(clienteUsuario.foto_perfil_url)}
                      alt={displayName}
                      className="h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20 rounded-full object-cover ring-[3px] ring-white/40 shadow-xl"
                    />
                  ) : (
                    <div className="flex h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20 items-center justify-center rounded-full bg-white/20 text-2xl sm:text-3xl font-bold text-white ring-[3px] ring-white/40 shadow-xl">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="text-[13px] sm:text-sm font-medium leading-none text-white/90">{displayName}</p>
              </div>
              <div className="flex flex-col gap-1 px-3 sm:px-4 py-3 sm:py-4">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-md bg-[hsl(158_64%_38%)]/10 px-3 sm:px-4 min-h-[52px] text-left transition-colors hover:bg-[hsl(158_64%_38%)]/[0.15]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(158_64%_38%)]/15">
                    <Upload className="h-4 w-4 text-[hsl(158_64%_38%)]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[hsl(158_64%_38%)]">{clienteUsuario?.foto_perfil_url ? 'Cambiar foto' : 'Cargar foto'}</p>
                    <p className="mt-0.5 text-[11px] text-[hsl(158_64%_38%)]/60">JPG, PNG o WebP</p>
                  </div>
                </button>
                {clienteUsuario?.foto_perfil_url && (
                  <button
                    onClick={handlePhotoDelete}
                    disabled={deletingPhoto}
                    className="flex w-full items-center gap-3 rounded-md bg-red-50 px-3 sm:px-4 min-h-[52px] text-left transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                      {deletingPhoto ? <Loader2 className="h-4 w-4 animate-spin text-red-500" /> : <Trash2 className="h-4 w-4 text-red-500" />}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-red-700">Eliminar foto</p>
                      <p className="mt-0.5 text-[11px] text-red-400">Vuelves a mostrar tu inicial</p>
                    </div>
                  </button>
                )}
                <button
                  onClick={closePhotoModal}
                  className="mt-0.5 min-h-[44px] w-full rounded-md px-4 text-center text-sm text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            /* ── Fase 2: Vista previa y confirmar ── */
            <>
              <div className="flex flex-col items-center gap-2 bg-[hsl(158_64%_38%)] px-5 pt-5 pb-6 sm:pt-7 sm:pb-8">
                <p className="text-center text-[14px] sm:text-[15px] font-semibold uppercase tracking-wide text-white/80">Vista previa</p>
                <div className="relative mt-2 sm:mt-3">
                  <img
                    src={previewUrl!}
                    alt="Vista previa"
                    className="relative z-10 h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover ring-[3px] ring-white/40 shadow-xl"
                  />
                </div>
                <p className="text-center text-[12px] sm:text-[13px] leading-snug text-white/70">Así se verá tu foto de perfil</p>
              </div>
              <div className="flex flex-col gap-2 px-3 sm:px-4 pt-3 sm:pt-4 pb-4 sm:pb-5">
                <button
                  onClick={handlePhotoConfirm}
                  disabled={uploadingPhoto}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md bg-[hsl(158_64%_38%)] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                  ) : (
                    <><Check className="h-4 w-4" strokeWidth={2.5} /> Guardar foto</>
                  )}
                </button>
                <button
                  onClick={() => { setPendingFile(null); if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}
                  disabled={uploadingPhoto}
                  className="min-h-[44px] w-full rounded-md text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
                >
                  Volver
                </button>
              </div>
            </>
          );
          return isDesktop ? (
            <Dialog open={showPhotoModal} onOpenChange={(v) => { if (!v) closePhotoModal(); }}>
              <DialogContent style={SYS_FONT} className="w-[calc(100vw-2rem)] sm:max-w-[360px] p-0 overflow-hidden rounded-md [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showPhotoModal} onOpenChange={(v) => { if (!v) closePhotoModal(); }}>
              <SheetContent style={SYS_FONT} side="bottom" className="p-0 overflow-hidden rounded-t-2xl [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        <ConfirmDataModal
          data={confirmDoc}
          saving={savingConfirm}
          onCancel={() => setConfirmDoc(null)}
          onConfirm={handleConfirmDoc}
        />

        {effectivePersonaId && (
          <ClienteINECameraCapture
            open={ineCaptureOpen}
            onOpenChange={setIneCaptureOpen}
            personaId={cameraPersonaId ?? effectivePersonaId}
            isDesktop={isDesktop}
            mode={cameraMode}
            onCompleted={() => {
              queryClient.refetchQueries({ queryKey: ["cliente-perfil-docs", effectivePersonaId] });
              queryClient.refetchQueries({ queryKey: ["cliente-perfil-docs-rep", cameraPersonaId] });
            }}
          />
        )}
      </div>
    </div>
  );
};
/* ─────────────────────────────────────────── */
/*  Sub-components                             */
/* ─────────────────────────────────────────── */

/* Modal de confirmación de datos extraídos (CURP / CSF) - editable antes de guardar */
const ConfirmDataModal = ({
  data, saving, onCancel, onConfirm,
}: {
  data: null | {
    tipo: "curp" | "csf" | "acta";
    fields: { key: string; label: string; value: string; personaCol: string | null }[];
  };
  saving: boolean;
  onCancel: () => void;
  onConfirm: (values: Record<string, string>) => void;
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) {
      const init: Record<string, string> = {};
      data.fields.forEach((f) => { init[f.key] = f.value; });
      setValues(init);
    }
  }, [data]);

  if (!data) return null;
  const titulo =
    data.tipo === "curp" ? "Confirma los datos de tu CURP"
    : data.tipo === "acta" ? "Confirma los datos de tu acta"
    : "Confirma tus datos fiscales";

  return (
    <Dialog open={!!data} onOpenChange={(v) => { if (!v && !saving) onCancel(); }}>
      <DialogContent style={{ fontFamily: 'system-ui,-apple-system,sans-serif' }} className="p-0 max-w-md flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
        <div style={{ padding: "20px 22px 12px" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>{titulo}</h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
            Extrajimos estos datos de tu documento. Verifica que sean correctos; se guardarán en tu perfil automáticamente.
          </p>
        </div>
        <div style={{ padding: "0 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {data.fields.map((f) => (
            <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{f.label}</span>
              <input
                className={INPUT_CLS}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div style={{ padding: "16px 22px 20px", display: "flex", gap: 10 }}>
          <button onClick={onCancel} disabled={saving}
            style={{ flex: 1, height: 42, borderRadius: 8, border: "1px solid #e0e3e6", background: "#fff", color: "#111827", fontWeight: 700, fontSize: 13.5, cursor: saving ? "not-allowed" : "pointer" }}>
            Cancelar
          </button>
          <button onClick={() => onConfirm(values)} disabled={saving}
            style={{ flex: 1, height: 42, borderRadius: 8, border: "none", background: "#111827", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" /> : <Check style={{ width: 15, height: 15 }} />}
            Sí, es correcta
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
const InfoCard = ({
  title, icon: Icon, children, action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <section>
    <div className="flex items-center justify-between mb-4 px-0.5">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      </div>
      {action}
    </div>
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      {children}
    </div>
  </section>
);

const EditChip = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
  >
    <Pencil className="w-3 h-3" />
    Editar
  </button>
);

const Row = ({
  label, value, isLast = false, mono = false, note,
}: {
  label: string;
  value: string | null | undefined;
  isLast?: boolean;
  mono?: boolean;
  note?: string;
}) => (
  <div className={`flex items-start justify-between gap-4 px-5 py-5 ${!isLast ? "border-b border-border/40" : ""}`}>
    <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{label}</span>
    <div className="text-right min-w-0">
      {value
        ? <span className={`text-sm font-medium text-foreground block truncate ${mono ? "font-mono tracking-wide text-xs" : ""}`}>{value}</span>
        : <EmptyVal />}
      {note && <span className="text-[10px] text-muted-foreground/50 mt-0.5 block">{note}</span>}
    </div>
  </div>
);

export default ClientePerfil;
