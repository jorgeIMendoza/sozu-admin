import {
  User, Mail, FileText, LogOut, Shield, ArrowLeft,
  CheckCircle2, Building2, CreditCard, Lock, Eye, EyeOff,
  BadgeCheck, AlertCircle, Clock, Loader2, Check, X,
  Download, Pencil, Upload, ChevronRight, Camera,
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
import { getTipoPersonaLabel } from "@/utils/tipo-persona";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";
import { toast } from "sonner";
import { validateCURPPdf, validateCSFPdf, validateActaNacimientoPdf } from "@/utils/pdfDocumentValidators";
import { extractCURPFields, extractCSFFields, extractActaNacimientoFields } from "@/utils/pdfDocumentExtractors";
import { ClienteINECameraCapture } from "@/components/admin/portal-cliente/ClienteINECameraCapture";

/* ─── helpers ─── */
const INPUT_CLS =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow";
const SELECT_CLS = `${INPUT_CLS} appearance-none cursor-pointer`;

const EmptyVal = () => (
  <span className="text-muted-foreground/40 text-xs font-normal italic">Sin dato</span>
);

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-semibold text-foreground block">{label}</label>
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
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((o) => {
            const v = getValue(o);
            return (
              <button
                key={v}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(v); setOpen(false); setQ(""); }}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl ${
                  v === value
                    ? "bg-emerald-pale text-emerald font-semibold"
                    : "hover:bg-muted/50 text-foreground"
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
      ? <Check className="w-3 h-3 text-emerald shrink-0" />
      : <X className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
    <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
  </div>
);

/**
 * Botones separados (no clases dinámicas) para que Tailwind no purgue bg-emerald.
 * El config del proyecto define emerald como DEFAULT/light/pale — no existen 500/600.
 */
const PrimaryBtn = ({
  onClick, loading, label, disabled = false,
}: {
  onClick: () => void; loading: boolean; label: string; disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className="w-full h-11 rounded-md text-sm font-semibold flex items-center justify-center gap-2 bg-emerald text-white hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-60"
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
  icon: React.ElementType; title: string; subtitle: string; onClose: () => void;
}) => (
  <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
    <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-muted-foreground" />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-bold text-foreground text-sm leading-tight">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
    <button
      onClick={onClose}
      className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

type DocViewerDoc = { title: string; url: string };
const DocViewerHeader = ({ doc }: { doc: DocViewerDoc }) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-foreground truncate">{doc.title}</p>
      <p className="text-xs text-muted-foreground">Vista previa</p>
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

type SectionCTA = { label: string; onClick: () => void; secondary: boolean };

const BackBtn = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{ background:'none', border:'none', color:'#575757', fontWeight:600, fontSize:13, cursor:'pointer', padding:'4px 0', display:'inline-flex', alignItems:'center', gap:6, marginBottom:12 }}
  >
    <ArrowLeft style={{ width:14, height:14 }} /> Volver al Perfil
  </button>
);

const SectionCard = ({
  title, subtitle, icon, semLabel, semDot, semColor, rows, ctas,
}: {
  title: string; subtitle: string; icon: React.ReactNode;
  semLabel: string; semDot: string; semColor: string;
  rows: { label: string; value: string | null | undefined }[];
  ctas: SectionCTA[];
}) => (
  <section style={{ background:'#fff', border:'1px solid #ededf0', borderRadius:8, padding:'18px 20px', display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
    <div style={{ display:'flex', alignItems:'flex-start', gap:11 }}>
      <div style={{ width:36, height:36, borderRadius:6, background:'#eaf6ef', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:15, fontWeight:700, color:'#000' }}>{title}</div>
        <div style={{ fontSize:12, color:'#9aa0a6', marginTop:2 }}>{subtitle}</div>
      </div>
      <div style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:semColor, flexShrink:0, marginTop:2 }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:semDot }} /> {semLabel}
      </div>
    </div>
    <div style={{ marginTop:13, flex:1 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'9px 0', borderBottom: i < rows.length-1 ? '1px solid #f0f1f3' : 'none' }}>
          <span style={{ fontSize:12, color:'#575757', fontWeight:500, flexShrink:0 }}>{r.label}</span>
          <span style={{ fontSize:12, fontWeight:600, color:r.value ? '#000' : '#9aa0a6', fontStyle:r.value ? 'normal' : 'italic', textAlign:'right', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r.value || 'Sin dato'}
          </span>
        </div>
      ))}
    </div>
    <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:7 }}>
      {ctas.map((cta, i) => (
        <button key={i} onClick={cta.onClick} style={{
          width:'100%', border: cta.secondary ? '1px solid #e0e3e6' : 'none',
          background: cta.secondary ? '#fff' : '#57ae75',
          color: cta.secondary ? '#000' : '#fff',
          fontWeight:700, fontSize:13.5, padding:'10px', borderRadius:6, cursor:'pointer',
        }}>
          {cta.label}
        </button>
      ))}
    </div>
  </section>
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
    nombre_legal: "", rfc: "", curp: "", clave_pais_telefono: "+52", telefono: "",
  });
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

  /* Add cuenta bancaria modal */
  const [showAddCuenta, setShowAddCuenta] = useState(false);
  const [addCuenta, setAddCuenta] = useState({ id_banco: '', cuenta_clabe: '', titular: '' });
  const [savingCuenta, setSavingCuenta] = useState(false);
  const [showBancoList, setShowBancoList] = useState(false);
  const [bancoSearch, setBancoSearch] = useState('');

  /* Edit cuenta bancaria modal */
  const [showEditCuenta, setShowEditCuenta] = useState(false);
  const [editCuentaId, setEditCuentaId] = useState<number | null>(null);
  const [editCuenta, setEditCuenta] = useState({ id_banco: '', cuenta_clabe: '', titular: '' });
  const [savingEditCuenta, setSavingEditCuenta] = useState(false);
  const [showEditBancoList, setShowEditBancoList] = useState(false);
  const [editBancoSearch, setEditBancoSearch] = useState('');

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
          id, nombre_legal, tipo_persona, rfc, curp, email, telefono,
          clave_pais_telefono, regimen, uso_cfdi,
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

  const { data: cuentasBancarias = [] } = useQuery({
    queryKey: ["cliente-perfil-bancos", effectivePersonaId],
    queryFn: async () => {
      if (!effectivePersonaId) return [];
      const { data } = await supabase
        .from("cuentas_bancarias")
        .select("id, id_banco, numero_cuenta, cuenta_clabe, titular, bancos:fk_cuentas_bancarias_banco(nombre)")
        .eq("id_persona", effectivePersonaId)
        .eq("activo", true);
      return (data || []).map((c: any) => ({
        id: c.id,
        idBanco: c.id_banco as number,
        banco: (c.bancos as any)?.nombre || "Banco",
        numeroCuenta: (c.cuenta_clabe || c.numero_cuenta) as string,
        titular: c.titular as string | null,
      }));
    },
    enabled: !!effectivePersonaId,
  });

  /* Catalogs — lazy */
  const { data: regimenOptions = [] } = useQuery({
    queryKey: ["regimen-options"],
    queryFn: async () => {
      const { data } = await supabase.from("regimen").select("id, nombre").eq("activo", true).order("id");
      return (data || []) as { id: string; nombre: string }[];
    },
    enabled: showEditFiscal,
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
    enabled: showAddCuenta || showEditCuenta,
    staleTime: 600_000,
  });

  /* ── Expediente slots ── */
  const SLOTS = [
    { key: "ine_frente",      label: "INE Frente",                     tipoIds: [2],       primaryTipoId: 2,  required: true  },
    { key: "ine_reverso",     label: "INE Reverso",                    tipoIds: [3],       primaryTipoId: 3,  required: true  },
    { key: "pasaporte",       label: "Pasaporte",                      tipoIds: [4],       primaryTipoId: 4,  required: false },
    { key: "acta_nacimiento", label: "Acta de nacimiento",             tipoIds: [1],       primaryTipoId: 1,  required: false },
    { key: "curp",            label: "CURP",                           tipoIds: [5],       primaryTipoId: 5,  required: true  },
    { key: "csf",             label: "Constancia de situación fiscal", tipoIds: [6],       primaryTipoId: 6,  required: true  },
    { key: "domicilio",       label: "Comprobante de domicilio",       tipoIds: [8],       primaryTipoId: 8,  required: true  },
    { key: "matrimonio",      label: "Acta de matrimonio",             tipoIds: [11],      primaryTipoId: 11, required: false },
  ] as const;

  /* ── Derived display ── */
  const displayName = persona?.nombre_legal || profile?.nombre || "Cliente";

  const regimenDisplay = persona?.regimen
    ? regimenData?.nombre ? `${persona.regimen} - ${regimenData.nombre}` : persona.regimen
    : null;
  const usoCfdiDisplay = persona?.uso_cfdi
    ? usoCfdiData?.nombre ? `${persona.uso_cfdi} - ${usoCfdiData.nombre}` : persona.uso_cfdi
    : null;

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
          asunto: `Cambio en perfil de cliente — ${clienteEmail || displayName}`,
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
    });
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
      notificarCambioCliente('Actualización de datos personales', `Nombre: ${payload.nombre_legal || '—'}, RFC: ${payload.rfc || '—'}, CURP: ${payload.curp || '—'}`);
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
    if (!addCuenta.cuenta_clabe.trim()) { toast.error('Ingresa la CLABE'); return; }
    if (!addCuenta.titular.trim()) { toast.error('Ingresa el nombre del titular'); return; }
    setSavingCuenta(true);
    try {
      const clabe = addCuenta.cuenta_clabe.trim();
      const { error } = await (supabase as any).from('cuentas_bancarias').insert({
        id_persona: effectivePersonaId,
        id_banco: Number(addCuenta.id_banco),
        cuenta_clabe: clabe,
        numero_cuenta: clabe,
        titular: addCuenta.titular.trim(),
        activo: true,
      });
      if (error) { toast.error(`Error: ${error.message}`); return; }
      toast.success('Cuenta bancaria registrada');
      const bancoNombre = bancosOptions.find(b => String(b.id) === addCuenta.id_banco)?.nombre || addCuenta.id_banco;
      notificarCambioCliente('Alta de cuenta bancaria', `Banco: ${bancoNombre}, CLABE: ${clabe}, Titular: ${addCuenta.titular.trim()}`);
      setShowAddCuenta(false);
      setAddCuenta({ id_banco: '', cuenta_clabe: '', titular: '' });
      queryClient.invalidateQueries({ queryKey: ['cliente-perfil-bancos', effectivePersonaId] });
    } finally {
      setSavingCuenta(false);
    }
  };

  const openEditCuenta = (c: { id: number; banco: string; numeroCuenta: string | null; titular: string | null; idBanco: number }) => {
    setEditCuentaId(c.id);
    setEditCuenta({ id_banco: String(c.idBanco), cuenta_clabe: c.numeroCuenta || '', titular: c.titular || '' });
    setEditBancoSearch('');
    setShowEditBancoList(false);
    setShowEditCuenta(true);
  };

  const handleSaveEditCuenta = async () => {
    if (!editCuentaId) return;
    if (!editCuenta.id_banco) { toast.error('Selecciona un banco'); return; }
    if (!editCuenta.cuenta_clabe.trim()) { toast.error('Ingresa la CLABE'); return; }
    if (!editCuenta.titular.trim()) { toast.error('Ingresa el nombre del titular'); return; }
    if (!isPwAuthed() && !justAuthedRef.current) {
      pendingAfterPwRef.current = () => handleSaveEditCuenta();
      setPwAuthInput('');
      setShowPwAuth(true);
      return;
    }
    justAuthedRef.current = false;
    setSavingEditCuenta(true);
    try {
      const clabe = editCuenta.cuenta_clabe.trim();
      const { error } = await (supabase as any).from('cuentas_bancarias').update({
        id_banco: Number(editCuenta.id_banco),
        cuenta_clabe: clabe,
        numero_cuenta: clabe,
        titular: editCuenta.titular.trim(),
      }).eq('id', editCuentaId);
      if (error) { toast.error(`Error: ${error.message}`); return; }
      toast.success('Cuenta bancaria actualizada');
      const bancoNombre = bancosOptions.find(b => String(b.id) === editCuenta.id_banco)?.nombre || editCuenta.id_banco;
      notificarCambioCliente('Edición de cuenta bancaria', `Banco: ${bancoNombre}, CLABE: ${clabe}, Titular: ${editCuenta.titular.trim()}`);
      setShowEditCuenta(false);
      queryClient.invalidateQueries({ queryKey: ['cliente-perfil-bancos', effectivePersonaId] });
    } finally {
      setSavingEditCuenta(false);
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
      notificarCambioCliente('Actualización de datos fiscales', `Régimen: ${payload.regimen || '—'}, CP: ${payload.direccion_fiscal_codigo_postal || '—'}, Calle: ${payload.direccion_fiscal_calle || '—'}`);
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
  ): Promise<boolean> => {
    if (!effectivePersonaId) return false;

    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `personas/${effectivePersonaId}/${primaryTipoId}_${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("documentos").upload(path, file, { upsert: false });
    if (uploadErr) { toast.error("Error al subir archivo: " + uploadErr.message); return false; }
    const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(path);

    // Doc activo más antiguo de este tipo → se marca expirado (referencia de auditoría).
    // Los demás activos → se desactivan + expiran.
    const { data: activeDocs } = await (supabase as any)
      .from("documentos")
      .select("id")
      .eq("id_persona", effectivePersonaId)
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
      id_persona: effectivePersonaId,
      id_tipo_documento: primaryTipoId,
      url: publicUrl,
      activo: true,
      es_draft: false,
      id_estatus_verificacion: estatus,
    }).select("id").single();
    if (insertErr) { console.error("[uploadDoc]", insertErr); toast.error("Error al registrar documento"); return false; }

    // Captura automática de datos del documento en el perfil (CURP/CSF confirmados).
    if (personaUpdates && Object.keys(personaUpdates).length > 0) {
      const { error: pErr } = await (supabase as any).from("personas").update(personaUpdates).eq("id", effectivePersonaId);
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
    return true;
  };

  const handleUploadDoc = async (file: File, slotKey: string, primaryTipoId: number) => {
    if (!effectivePersonaId) return;

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
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #ededf0', borderRadius: 8 };
  const green = '#57ae75';
  const textPrimary = '#000';
  const textSecondary = '#575757';
  const textMuted = '#9aa0a6';

  return (
    <div style={{ background: '#f5f6f7', minHeight: '100vh', fontFamily: 'system-ui,-apple-system,sans-serif', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 20px 80px', boxSizing: 'border-box', width: '100%' }}>

        {/* ── Identity card (always visible) ── */}
        <section style={{ ...card, padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: isDesktop ? 'center' : 'flex-start', gap: 14, flexDirection: isDesktop ? 'row' : 'column' }}>
            {/* Avatar + name row (always horizontal) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, flexShrink: 0 }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: isDesktop ? 20 : 16, fontWeight: 700, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {verStatus === 'verified' && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#eaf6ef', color:'#3f8f5c', border:'1px solid #cfe9d9', fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999 }}>
                      <CheckCircle2 style={{ width:12, height:12 }} /> Perfil verificado
                    </span>
                  )}
                  {verStatus === 'review' && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#fef3c7', color:'#92400e', border:'1px solid #e5c97a', fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999 }}>
                      <Clock style={{ width:12, height:12 }} /> En revisión
                    </span>
                  )}
                  {verStatus === 'incomplete' && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#c0392b', border:'1px solid #f5c6c6', fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999 }}>
                      <AlertCircle style={{ width:12, height:12 }} /> Información incompleta
                    </span>
                  )}
                  <span style={{ color: textSecondary, fontSize: 12, fontWeight: 500 }}>
                    {getTipoPersonaLabel(persona?.tipo_persona)}
                  </span>
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ flex: '0 0 auto', width: isDesktop ? 220 : '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 5 }}>
                <span>Perfil completado</span>
                <span style={{ color: textPrimary, fontWeight: 700 }}>{profileCompletion}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: '#e8eaec', overflow: 'hidden' }}>
                <div style={{ height:'100%', borderRadius:999, background: green, width:`${profileCompletion}%`, transition:'width 0.5s ease' }} />
              </div>
            </div>
          </div>
          {profileCompletion < 85 && (
            <div style={{ marginTop:14, display:'flex', alignItems:'flex-start', gap:10, background:'#fef6e7', border:'1px solid #f4e3bf', borderRadius:6, padding:'10px 13px' }}>
              <AlertCircle style={{ width:14, height:14, color:'#c08a14', flexShrink:0, marginTop:1 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13, color:'#8a6410' }}>
                  {profileCompletion < 50 ? 'Completa tu perfil para continuar' : 'Perfil casi completo'}
                </div>
                <div style={{ fontSize:12, color:'#8a6410', marginTop:2, opacity:0.85 }}>
                  Sube tus documentos y llena tus datos personales y fiscales.
                </div>
              </div>
              <button
                onClick={() => setView('expediente')}
                style={{ flexShrink:0, border:'1px solid #e6c98a', background:'#fff', color:'#8a6410', fontWeight:700, fontSize:11.5, padding:'5px 11px', borderRadius:8, cursor:'pointer', whiteSpace:'nowrap' }}
              >
                Completar
              </button>
            </div>
          )}
        </section>

        {/* ═══════════════════════ OVERVIEW ═══════════════════════ */}
        {view === 'overview' && (
          <>
            {/* Motor hero */}
            <section style={{ marginBottom:16, background:'#eef7f1', border:'1px solid #d8ecdf', borderRadius:8, padding:'22px 24px', display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:220 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#d4eadb', color:'#3f8f5c', fontSize:10.5, fontWeight:700, letterSpacing:'0.06em', padding:'4px 10px', borderRadius:999, textTransform:'uppercase' }}>
                  Tu expediente · el motor de tu perfil
                </div>
                <h2 style={{ margin:'12px 0 6px', fontSize:19, fontWeight:700, lineHeight:1.25, color:textPrimary }}>
                  {uploadedTypeIds.size === 0 ? 'Comienza con tu Constancia fiscal' : profileCompletion >= 85 ? '¡Expediente completo!' : 'Sigue completando tu expediente'}
                </h2>
                <p style={{ margin:0, fontSize:13.5, lineHeight:1.5, color:textSecondary }}>
                  {uploadedTypeIds.size === 0
                    ? 'Con ese documento poblamos la mayoría de tu información.'
                    : 'Cada documento que subas nos permite verificar tu identidad.'}
                </p>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:16, flexWrap:'wrap' }}>
                  <button
                    onClick={() => setView('expediente')}
                    style={{ background:green, color:'#fff', border:'none', fontWeight:700, fontSize:13.5, padding:'10px 18px', borderRadius:6, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8 }}
                  >
                    <Upload style={{ width:15, height:15 }} />
                    {uploadedTypeIds.size === 0 ? 'Subir documentos' : 'Ver expediente'}
                  </button>
                  <span style={{ fontSize:13, color:textSecondary, fontWeight:600 }}>
                    {documentos.filter(d => d.status === 'verified').length} de {SLOTS.filter(s => s.required).length} requeridos
                  </span>
                </div>
              </div>
              <div style={{ flex:'0 0 auto', display:'flex', flexDirection:'column', gap:7, minWidth:190, maxWidth:280 }}>
                {[...SLOTS].sort((a,b) => a.label.localeCompare(b.label,'es')).slice(0,4).map(s => {
                  const slotDocs = documentos.filter(d => (s.tipoIds as readonly number[]).includes(d.tipoId));
                  const best = slotDocs.find(d => d.status === 'verified') || slotDocs.find(d => d.status === 'review') || slotDocs[0];
                  const st = best?.status ?? 'missing';
                  const dotColor = st === 'verified' ? green : st === 'review' ? '#f59e0b' : st === 'rejected' ? '#ef4444' : '#d1d5db';
                  const badge = st === 'verified' ? { c:'#3f8f5c', bg:'#d4eadb' } : st === 'review' ? { c:'#92400e', bg:'#fef3c7' } : st === 'rejected' ? { c:'#c0392b', bg:'#fef2f2' } : { c:'#6b7280', bg:'#f3f4f6' };
                  const badgeLabel = st === 'verified' ? 'Aprobado' : st === 'review' ? 'En revisión' : st === 'rejected' ? 'Rechazado' : st === 'expired' ? 'Expirado' : 'Pendiente';
                  return (
                    <div key={s.key} style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid #e2ece6', fontSize:12, fontWeight:600, padding:'7px 11px', borderRadius:6 }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:dotColor, flexShrink:0 }} />
                      <span style={{ flex:1, color:textPrimary, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</span>
                      <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 6px', borderRadius:5, flexShrink:0, color:badge.c, background:badge.bg }}>{badgeLabel}</span>
                    </div>
                  );
                })}
                <button
                  onClick={() => setView('expediente')}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'none', border:'1px solid #c8e6d0', color:'#3f8f5c', fontWeight:700, fontSize:12, padding:'6px 12px', borderRadius:6, cursor:'pointer', marginTop:2 }}
                >
                  Ver todos los documentos <ChevronRight style={{ width:13, height:13 }} />
                </button>
              </div>
            </section>

            {/* 2×2 section cards */}
            <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(2,1fr)' : '1fr', gap:14, marginBottom:14 }}>

              <SectionCard
                title="Información personal"
                subtitle="Identificación y contacto"
                icon={<User style={{ width:17, height:17, color:green }} />}
                semLabel={persona?.nombre_legal ? 'Completo' : 'Pendiente'}
                semDot={persona?.nombre_legal ? green : '#d1d5db'}
                semColor={persona?.nombre_legal ? '#3f8f5c' : textMuted}
                rows={[
                  { label:'Nombre', value:persona?.nombre_legal },
                  { label:'RFC', value:persona?.rfc },
                  { label:'CURP', value:persona?.curp },
                ]}
                ctas={[
                  ...(!isImpersonating ? [{ label:'Editar', onClick:openEditPersonal, secondary:true }] : []),
                  { label:'Ver todo', onClick:() => setView('personal'), secondary:false },
                ]}
              />

              <SectionCard
                title="Información fiscal"
                subtitle="Régimen, CFDI y dirección"
                icon={<Building2 style={{ width:17, height:17, color:green }} />}
                semLabel={persona?.regimen ? 'Completo' : 'Pendiente'}
                semDot={persona?.regimen ? green : '#d1d5db'}
                semColor={persona?.regimen ? '#3f8f5c' : textMuted}
                rows={[
                  { label:'Régimen', value:regimenDisplay },
                  { label:'Uso CFDI', value:usoCfdiDisplay },
                  { label:'CP', value:persona?.direccion_fiscal_codigo_postal?.trim() },
                ]}
                ctas={[
                  ...(!isImpersonating ? [{ label:'Editar', onClick:openEditFiscal, secondary:true }] : []),
                  { label:'Ver todo', onClick:() => setView('fiscal'), secondary:false },
                ]}
              />

              <SectionCard
                title="Cuentas bancarias"
                subtitle="Cuentas de dispersión"
                icon={<CreditCard style={{ width:17, height:17, color:green }} />}
                semLabel={cuentasBancarias.length > 0 ? `${cuentasBancarias.length} cuenta${cuentasBancarias.length>1?'s':''}` : 'Sin cuentas'}
                semDot={cuentasBancarias.length > 0 ? green : '#d1d5db'}
                semColor={cuentasBancarias.length > 0 ? '#3f8f5c' : textMuted}
                rows={cuentasBancarias.slice(0,3).map(c => ({ label:c.banco, value:c.numeroCuenta ? `****${c.numeroCuenta.slice(-4)}` : null }))}
                ctas={[
                  ...(!isImpersonating ? [{ label:'Agregar cuenta', onClick:() => { setAddCuenta({ id_banco:'', cuenta_clabe:'', titular:'' }); setShowAddCuenta(true); }, secondary:true }] : []),
                  { label:'Ver cuentas', onClick:() => setView('cuentas'), secondary:false },
                ]}
              />

              {/* Seguridad card — inline (needs red logout button) */}
              <section style={{ background:'#fff', border:'1px solid #ededf0', borderRadius:8, padding:'18px 20px', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:11 }}>
                  <div style={{ width:36, height:36, borderRadius:6, background:'#eaf6ef', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Shield style={{ width:17, height:17, color:green }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'#000' }}>Seguridad</div>
                    <div style={{ fontSize:12, color:'#9aa0a6', marginTop:2 }}>Contraseña y sesión</div>
                  </div>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'#3f8f5c', flexShrink:0, marginTop:2 }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:green }} /> Activo
                  </div>
                </div>
                <div style={{ marginTop:13, flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid #f0f1f3' }}>
                    <span style={{ fontSize:12, color:'#575757', fontWeight:500 }}>Contraseña</span>
                    <span style={{ fontSize:12, fontWeight:600, color:'#000', fontFamily:'monospace', letterSpacing:2 }}>••••••••</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'9px 0' }}>
                    <span style={{ fontSize:12, color:'#575757', fontWeight:500 }}>Sesión</span>
                    <span style={{ fontSize:12, fontWeight:600, color:green }}>Activa</span>
                  </div>
                </div>
                <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:7 }}>
                  <button
                    onClick={isImpersonating ? undefined : () => setShowChangePw(true)}
                    disabled={isImpersonating}
                    style={{ width:'100%', border:'1px solid #e0e3e6', background:'#fff', color:'#000', fontWeight:700, fontSize:13.5, padding:'10px', borderRadius:6, cursor:isImpersonating ? 'not-allowed' : 'pointer', opacity:isImpersonating ? 0.4 : 1 }}
                  >
                    Cambiar contraseña
                  </button>
                  <button
                    onClick={signOut}
                    style={{ width:'100%', border:'1px solid #fcdada', background:'#fff9f9', color:'#c0392b', fontWeight:700, fontSize:13.5, padding:'10px', borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}
                  >
                    <LogOut style={{ width:14, height:14 }} /> Cerrar sesión
                  </button>
                </div>
              </section>

            </div>
          </>
        )}

        {/* ═══════════════════════ EXPEDIENTE DETAIL ═══════════════════════ */}
        {view === 'expediente' && (
          <section>
            <BackBtn onClick={() => setView('overview')} />
            <div style={{ ...card, padding:22 }}>
              <h2 style={{ margin:'0 0 4px', fontSize:18, fontWeight:700, color:textPrimary }}>Expediente</h2>
              <p style={{ margin:'0 0 18px', fontSize:13.5, color:textSecondary }}>Sube cada documento; validamos los datos por ti.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {SLOTS.map((slot, i) => {
                  const slotDocs = documentos.filter(d => (slot.tipoIds as readonly number[]).includes(d.tipoId));
                  const best = slotDocs.find(d => d.status === 'verified') || slotDocs.find(d => d.status === 'review') || slotDocs[0];
                  const status = best?.status ?? 'missing';
                  const isUploading = uploadingSlot === slot.key;
                  const hasFile = !!best?.url;
                  const isCamera = slot.key === 'ine_frente' || slot.key === 'ine_reverso' || slot.key === 'pasaporte';
                  const dotColor = status === 'verified' ? green : status === 'review' ? '#f59e0b' : status === 'rejected' ? '#ef4444' : '#d1d5db';
                  const badge = status === 'verified' ? { c:'#3f8f5c', bg:'#eaf6ef' } : status === 'review' ? { c:'#92400e', bg:'#fef3c7' } : status === 'rejected' ? { c:'#c0392b', bg:'#fef2f2' } : { c:'#6b7280', bg:'#f3f4f6' };
                  // Sin archivo → siempre "Pendiente" (ya no hay "Opcional").
                  const badgeLabel = status === 'verified' ? 'Aprobado' : status === 'review' ? 'En revisión' : status === 'rejected' ? 'Rechazado' : status === 'expired' ? 'Expirado' : 'Pendiente';
                  return (
                    <div key={slot.key} style={{ border:'1px solid #eef0f1', borderRadius:6, padding:'13px 15px', display:'flex', alignItems:'center', gap:13 }}>
                      <span style={{ width:26, height:26, borderRadius:'50%', background:'#f5f6f7', border:'1px solid #ededf0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:textMuted, flexShrink:0 }}>{i+1}</span>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:dotColor, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:textPrimary }}>{slot.label}</div>
                        {best?.date && <div style={{ fontSize:11.5, color:textMuted, marginTop:2 }}>Subido el {best.date}</div>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                        <span style={{ fontSize:10.5, fontWeight:700, padding:'3px 8px', borderRadius:6, background:badge.bg, color:badge.c, whiteSpace:'nowrap' }}>{badgeLabel}</span>
                        <input
                          ref={(el) => { fileInputRefs.current[slot.key] = el; }}
                          type="file"
                          accept={AUTO_VALIDATE_TIPO_IDS.includes(slot.primaryTipoId) ? '.pdf' : '.pdf,.jpg,.jpeg,.png,.webp'}
                          className="hidden"
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadDoc(file, slot.key, slot.primaryTipoId); e.target.value = ''; }}
                        />
                        {/* INE frente/reverso y pasaporte → captura por cámara. Resto → subir archivo.
                            Con archivo → ícono editar (reemplazar), por si se subió uno mal. */}
                        <button
                          onClick={() => { if (isCamera) { setCameraMode(slot.key === 'pasaporte' ? 'pasaporte' : 'ine'); setIneCaptureOpen(true); } else fileInputRefs.current[slot.key]?.click(); }}
                          disabled={isUploading}
                          title={isCamera ? 'Capturar con cámara' : hasFile ? 'Reemplazar documento' : 'Subir documento'}
                          style={{ width:32, height:32, borderRadius:8, border:'1px solid #e6e8eb', background:'#fff', cursor:isUploading ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                        >
                          {isUploading ? <Loader2 style={{ width:15, height:15, color:textSecondary }} className="animate-spin" /> : isCamera ? <Camera style={{ width:15, height:15, color:textSecondary }} /> : hasFile ? <Pencil style={{ width:15, height:15, color:textSecondary }} /> : <Upload style={{ width:15, height:15, color:textSecondary }} />}
                        </button>
                        {/* Ojo: solo se muestra si ya hay archivo */}
                        {hasFile && (
                          <button
                            onClick={() => setPreviewDoc({ title:slot.label, url:best!.url! })}
                            title="Ver documento"
                            style={{ width:32, height:32, borderRadius:8, border:'1px solid #e6e8eb', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                          >
                            <Eye style={{ width:15, height:15, color:textSecondary }} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════ PERSONAL DETAIL ═══════════════════════ */}
        {view === 'personal' && (
          <section>
            <BackBtn onClick={() => setView('overview')} />
            <div style={{ ...card, padding:22 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18 }}>
                <div>
                  <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:textPrimary }}>Información personal</h2>
                  <p style={{ margin:'4px 0 0', fontSize:13.5, color:textSecondary }}>Identificación y datos de contacto</p>
                </div>
                {!isImpersonating && (
                  <button onClick={openEditPersonal} style={{ border:'1px solid #e0e3e6', background:'#fff', color:textPrimary, fontWeight:700, fontSize:13, padding:'8px 14px', borderRadius:6, cursor:'pointer' }}>
                    Editar
                  </button>
                )}
              </div>
              {[
                { label:'Tipo de persona', value:getTipoPersonaLabel(persona?.tipo_persona) },
                { label:'Nombre completo', value:persona?.nombre_legal },
                { label:'RFC con homoclave', value:persona?.rfc, mono:true },
                { label:'CURP', value:persona?.curp, mono:true },
                { label:'Teléfono', value:persona?.telefono ? `${persona.clave_pais_telefono || '+52'} ${persona.telefono}` : null },
                { label:'Correo electrónico', value:persona?.email || profile?.email, note:'No editable' },
              ].map((f, idx, arr) => (
                <div key={f.label} style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'12px 0', borderBottom: idx < arr.length-1 ? '1px solid #f0f1f3' : 'none' }}>
                  <div style={{ flex:'0 0 150px', fontSize:13, fontWeight:600, color:textPrimary }}>{f.label}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    {f.value
                      ? <span style={{ fontSize:13.5, color:textPrimary, fontFamily:(f as any).mono ? 'monospace' : 'inherit' }}>{f.value}</span>
                      : <span style={{ fontSize:12, color:textMuted, fontStyle:'italic' }}>Sin dato</span>
                    }
                    {f.note && <div style={{ fontSize:11, color:textMuted, marginTop:2 }}>{f.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════ FISCAL DETAIL ═══════════════════════ */}
        {view === 'fiscal' && (
          <section>
            <BackBtn onClick={() => setView('overview')} />
            <div style={{ ...card, padding:22 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18 }}>
                <div>
                  <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:textPrimary }}>Información fiscal</h2>
                  <p style={{ margin:'4px 0 0', fontSize:13.5, color:textSecondary }}>Régimen, CFDI y dirección fiscal</p>
                </div>
                {!isImpersonating && (
                  <button onClick={openEditFiscal} style={{ border:'1px solid #e0e3e6', background:'#fff', color:textPrimary, fontWeight:700, fontSize:13, padding:'8px 14px', borderRadius:6, cursor:'pointer' }}>
                    Editar
                  </button>
                )}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fef6e7', border:'1px solid #f4e3bf', color:'#8a6410', fontSize:12.5, fontWeight:500, padding:'9px 13px', borderRadius:6, marginBottom:18 }}>
                <AlertCircle style={{ width:14, height:14, color:'#c08a14', flexShrink:0 }} /> Tus datos serán validados por el área correspondiente.
              </div>
              {[
                { label:'Régimen fiscal', value:regimenDisplay },
                { label:'Uso CFDI', value:usoCfdiDisplay },
                { label:'Código postal', value:persona?.direccion_fiscal_codigo_postal?.trim(), mono:true },
                { label:'Calle', value:persona?.direccion_fiscal_calle?.trim() },
                { label:'Núm. exterior', value:persona?.direccion_fiscal_num_ext },
                { label:'Núm. interior', value:persona?.direccion_fiscal_num_int },
                { label:'Colonia', value:persona?.direccion_fiscal_colonia },
              ].map((f, idx, arr) => (
                <div key={f.label} style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'12px 0', borderBottom: idx < arr.length-1 ? '1px solid #f0f1f3' : 'none' }}>
                  <div style={{ flex:'0 0 150px', fontSize:13, fontWeight:600, color:textPrimary }}>{f.label}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    {f.value
                      ? <span style={{ fontSize:13.5, color:textPrimary, fontFamily:(f as any).mono ? 'monospace' : 'inherit' }}>{f.value}</span>
                      : <span style={{ fontSize:12, color:textMuted, fontStyle:'italic' }}>Sin dato</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════ CUENTAS DETAIL ═══════════════════════ */}
        {view === 'cuentas' && (
          <section>
            <BackBtn onClick={() => setView('overview')} />
            <div style={{ ...card, padding:22 }}>
              <div style={{ marginBottom:18 }}>
                <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:textPrimary }}>Cuentas bancarias</h2>
                <p style={{ margin:'4px 0 0', fontSize:13.5, color:textSecondary }}>SOZU deposita directamente a estas cuentas.</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'#eef4fb', border:'1px solid #cfe0f3', color:'#2c5d8a', fontSize:12.5, fontWeight:500, padding:'9px 13px', borderRadius:6, marginBottom:18 }}>
                <Shield style={{ width:14, height:14, flexShrink:0 }} /> Por tu seguridad, toda alta o cambio de cuenta se notifica de inmediato.
              </div>
              {cuentasBancarias.length === 0 ? (
                <div style={{ textAlign:'center', padding:'28px 16px', background:'#f7f8f9', borderRadius:6, border:'1px dashed #dfe2e4', marginBottom:14 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:textPrimary }}>Sin cuentas registradas.</div>
                  <div style={{ fontSize:13, color:textMuted, marginTop:5 }}>Agrega tu primera cuenta bancaria.</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
                  {cuentasBancarias.map(c => (
                    <div key={c.id} style={{ border:'1px solid #eef0f1', borderRadius:6, padding:'15px', display:'flex', alignItems:'center', gap:13 }}>
                      <div style={{ flexShrink:0, width:40, height:40, borderRadius:6, background:'#eef4fb', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <CreditCard style={{ width:19, height:19, color:'#2c5d8a' }} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:textPrimary }}>{c.banco}</div>
                        {c.numeroCuenta && <div style={{ fontSize:13, color:textSecondary, marginTop:3, fontFamily:'monospace' }}>****{c.numeroCuenta.slice(-4)}</div>}
                        {c.titular && <div style={{ fontSize:12, color:textMuted, marginTop:2 }}>{c.titular}</div>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#eaf6ef', color:'#3f8f5c', fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999 }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background:green }} /> Activa
                        </span>
                        {!isImpersonating && (
                          <button
                            onClick={() => openEditCuenta(c)}
                            style={{ flexShrink:0, width:32, height:32, borderRadius:6, border:'1px solid #e0e3e6', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                            title="Editar cuenta"
                          >
                            <Pencil style={{ width:14, height:14, color:'#575757' }} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!isImpersonating && (
                <button
                  onClick={() => { setAddCuenta({ id_banco:'', cuenta_clabe:'', titular:'' }); setShowAddCuenta(true); }}
                  style={{ width:'100%', background:'#57ae75', color:'#fff', border:'none', fontWeight:700, fontSize:13.5, padding:'11px', borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                >
                  Agregar cuenta bancaria
                </button>
              )}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════
            MODAL — Editar datos personales
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
                    className={`${INPUT_CLS} font-mono tracking-wider`}
                    value={editPersonal.rfc}
                    onChange={(e) => setEditPersonal(f => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                    placeholder="AAAA######AAA"
                    maxLength={13}
                  />
                </FormField>
                <FormField label="CURP">
                  <input
                    className={`${INPUT_CLS} font-mono tracking-wider`}
                    value={editPersonal.curp}
                    onChange={(e) => setEditPersonal(f => ({ ...f, curp: e.target.value.toUpperCase() }))}
                    placeholder="18 caracteres"
                    maxLength={18}
                  />
                </FormField>
                <FormField label="Teléfono">
                  <div className="flex h-11 rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring transition-shadow">
                    <select
                      value={editPersonal.clave_pais_telefono}
                      onChange={(e) => setEditPersonal(f => ({ ...f, clave_pais_telefono: e.target.value }))}
                      className="bg-transparent border-r border-input px-3 text-sm font-mono text-foreground focus:outline-none appearance-none cursor-pointer shrink-0"
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
              <DialogContent className="p-0 max-w-sm flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showEditPersonal} onOpenChange={(v) => !v && onClose()}>
              <SheetContent side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[85dvh] [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        {/* ══════════════════════════════════════════════
            MODAL — Editar datos fiscales
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
                    getLabel={(o) => `${o.id} — ${o.nombre}`}
                    getValue={(o) => String(o.id)}
                  />
                </FormField>
                <FormField label="Uso CFDI">
                  <SearchSelect
                    value={editFiscal.uso_cfdi}
                    onChange={(v) => setEditFiscal(f => ({ ...f, uso_cfdi: v }))}
                    options={usoCfdiOptions}
                    placeholder="Buscar uso CFDI..."
                    getLabel={(o) => `${o.codigo} — ${o.nombre}`}
                    getValue={(o) => o.codigo}
                  />
                </FormField>
                <FormField label="Código postal">
                  <input
                    className={`${INPUT_CLS} font-mono`}
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
              <DialogContent className="p-0 max-w-sm flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showEditFiscal} onOpenChange={(v) => !v && onClose()}>
              <SheetContent side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[90dvh] [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        {/* ══════════════════════════════════════════════
            MODAL — Cambiar contraseña
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
                {/* Dos botones separados — clases estáticas para que Tailwind no purgue bg-emerald */}
                {pwReady
                  ? <PrimaryBtn onClick={handleChangePassword} loading={changingPassword} label="Confirmar" />
                  : <GrayBtn label="Confirmar" />}
                <CancelBtn onClick={closePw} />
              </div>
            </>
          );
          return isDesktop ? (
            <Dialog open={showChangePw} onOpenChange={(v) => !v && closePw()}>
              <DialogContent className="p-0 max-w-sm flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showChangePw} onOpenChange={(v) => !v && closePw()}>
              <SheetContent side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[85dvh] [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        {/* ══════════════════════════════════════════════
            MODAL — Verificar contraseña (gate)
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
              <DialogContent className="p-0 max-w-sm flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showPwAuth} onOpenChange={(v) => !v && onClose()}>
              <SheetContent side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[85dvh] [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        {/* ══════════════════════════════════════════════
            MODAL — Agregar cuenta bancaria
        ══════════════════════════════════════════════ */}
        {(() => {
          const onClose = () => { setShowAddCuenta(false); setAddCuenta({ id_banco:'', cuenta_clabe:'', titular:'' }); };
          const content = (
            <>
              <ModalHeader icon={CreditCard} title="Agregar cuenta bancaria" subtitle="SOZU usará esta cuenta para depósitos" onClose={onClose} />
              <div className="px-5 pt-4 pb-2 space-y-4 overflow-y-auto flex-1">
                <FormField label="Banco *">
                  <div style={{ position:'relative' }}>
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
                    {showBancoList && (
                      <div style={{ border:'1px solid #e0e3e6', borderRadius:6, marginTop:4, maxHeight:240, overflowY:'auto', background:'#fff', boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
                        {bancosOptions
                          .filter(b => !bancoSearch || b.nombre.toLowerCase().includes(bancoSearch.toLowerCase()))
                          .map(b => (
                            <button key={b.id} type="button"
                              onMouseDown={() => { setAddCuenta(f => ({ ...f, id_banco: String(b.id) })); setBancoSearch(''); setShowBancoList(false); }}
                              style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 12px', fontSize:14, fontWeight:500,
                                background: String(b.id) === addCuenta.id_banco ? '#eaf6ef' : 'transparent',
                                color:'#000', border:'none', cursor:'pointer' }}
                            >
                              {b.nombre}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </FormField>
                <FormField label="CLABE interbancaria *">
                  <input
                    className={`${INPUT_CLS} font-mono tracking-wider`}
                    value={addCuenta.cuenta_clabe}
                    onChange={(e) => setAddCuenta(f => ({ ...f, cuenta_clabe: e.target.value.replace(/\D/g,'') }))}
                    placeholder="18 dígitos"
                    maxLength={18}
                    inputMode="numeric"
                  />
                </FormField>
                <FormField label="Titular de la cuenta *">
                  <input
                    className={INPUT_CLS}
                    value={addCuenta.titular}
                    onChange={(e) => setAddCuenta(f => ({ ...f, titular: e.target.value }))}
                    placeholder="Nombre completo del titular"
                  />
                </FormField>
              </div>
              <div className="px-5 pb-8 pt-3 space-y-2.5 border-t border-border/50 shrink-0">
                {(addCuenta.id_banco && addCuenta.cuenta_clabe.length === 18 && addCuenta.titular)
                  ? <PrimaryBtn onClick={handleAddCuenta} loading={savingCuenta} label="Guardar cuenta" />
                  : <GrayBtn label="Guardar cuenta" />}
                <CancelBtn onClick={onClose} />
              </div>
            </>
          );
          return isDesktop ? (
            <Dialog open={showAddCuenta} onOpenChange={(v) => !v && onClose()}>
              <DialogContent className="p-0 max-w-sm flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showAddCuenta} onOpenChange={(v) => !v && onClose()}>
              <SheetContent side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[90dvh] [&>button:last-child]:hidden">
                {content}
              </SheetContent>
            </Sheet>
          );
        })()}

        {/* ══════════════════════════════════════════════
            MODAL — Editar cuenta bancaria
        ══════════════════════════════════════════════ */}
        {(() => {
          const onClose = () => { setShowEditCuenta(false); setEditCuentaId(null); };
          const content = (
            <>
              <ModalHeader icon={CreditCard} title="Editar cuenta bancaria" subtitle="Corrige los datos de tu cuenta" onClose={onClose} />
              <div className="px-5 pt-4 pb-2 space-y-4 overflow-y-auto flex-1">
                <FormField label="Banco *">
                  <div style={{ position:'relative' }}>
                    <input
                      className={INPUT_CLS}
                      value={editCuenta.id_banco
                        ? (bancosOptions.find(b => String(b.id) === editCuenta.id_banco)?.nombre || '')
                        : editBancoSearch}
                      placeholder="Buscar banco..."
                      onFocus={() => setShowEditBancoList(true)}
                      onChange={(e) => { setEditBancoSearch(e.target.value); setEditCuenta(f => ({ ...f, id_banco: '' })); setShowEditBancoList(true); }}
                      onBlur={() => setTimeout(() => setShowEditBancoList(false), 150)}
                    />
                    {showEditBancoList && (
                      <div style={{ border:'1px solid #e0e3e6', borderRadius:6, marginTop:4, maxHeight:240, overflowY:'auto', background:'#fff', boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
                        {bancosOptions
                          .filter(b => !editBancoSearch || b.nombre.toLowerCase().includes(editBancoSearch.toLowerCase()))
                          .map(b => (
                            <button key={b.id} type="button"
                              onMouseDown={() => { setEditCuenta(f => ({ ...f, id_banco: String(b.id) })); setEditBancoSearch(''); setShowEditBancoList(false); }}
                              style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 12px', fontSize:14, fontWeight:500,
                                background: String(b.id) === editCuenta.id_banco ? '#eaf6ef' : 'transparent',
                                color:'#000', border:'none', cursor:'pointer' }}
                            >
                              {b.nombre}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </FormField>
                <FormField label="CLABE interbancaria *">
                  <input
                    className={`${INPUT_CLS} font-mono tracking-wider`}
                    value={editCuenta.cuenta_clabe}
                    onChange={(e) => setEditCuenta(f => ({ ...f, cuenta_clabe: e.target.value.replace(/\D/g,'') }))}
                    placeholder="18 dígitos"
                    maxLength={18}
                    inputMode="numeric"
                  />
                </FormField>
                <FormField label="Titular de la cuenta *">
                  <input
                    className={INPUT_CLS}
                    value={editCuenta.titular}
                    onChange={(e) => setEditCuenta(f => ({ ...f, titular: e.target.value }))}
                    placeholder="Nombre completo del titular"
                  />
                </FormField>
              </div>
              <div className="px-5 pb-8 pt-3 space-y-2.5 border-t border-border/50 shrink-0">
                {(editCuenta.id_banco && editCuenta.cuenta_clabe.length === 18 && editCuenta.titular)
                  ? <PrimaryBtn onClick={handleSaveEditCuenta} loading={savingEditCuenta} label="Guardar cambios" />
                  : <GrayBtn label="Guardar cambios" />}
                <CancelBtn onClick={onClose} />
              </div>
            </>
          );
          return isDesktop ? (
            <Dialog open={showEditCuenta} onOpenChange={(v) => !v && onClose()}>
              <DialogContent className="p-0 max-w-sm flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
                {content}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={showEditCuenta} onOpenChange={(v) => !v && onClose()}>
              <SheetContent side="bottom" className="p-0 rounded-t-2xl flex flex-col max-h-[90dvh] [&>button:last-child]:hidden">
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
            <DialogContent className="p-0 max-w-3xl h-[85vh] flex flex-col [&>button:last-child]:hidden">
              {previewDoc && (
                <>
                  <DocViewerHeader doc={previewDoc} />
                  <DocViewerBody doc={previewDoc} />
                  <div className="px-4 pb-5 pt-3 border-t border-border/50 flex gap-2 shrink-0">
                    <button onClick={() => downloadDocFile(previewDoc.url, previewDoc.title)}
                      className="flex-1 h-10 flex items-center justify-center gap-2 text-sm font-semibold text-emerald bg-emerald-pale hover:opacity-80 rounded-md transition-opacity">
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
            <SheetContent side="bottom" className="max-h-[78dvh] p-0 rounded-t-2xl flex flex-col [&>button:last-child]:hidden">
              {previewDoc && (
                <>
                  <DocViewerHeader doc={previewDoc} />
                  <DocViewerBody doc={previewDoc} />
                  <div className="px-4 pb-8 pt-3 border-t border-border/50 flex gap-2 shrink-0">
                    <button onClick={() => downloadDocFile(previewDoc.url, previewDoc.title)}
                      className="flex-1 h-10 flex items-center justify-center gap-2 text-sm font-semibold text-emerald bg-emerald-pale hover:opacity-80 rounded-md transition-opacity">
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
            personaId={effectivePersonaId}
            isDesktop={isDesktop}
            mode={cameraMode}
            onCompleted={() => queryClient.refetchQueries({ queryKey: ["cliente-perfil-docs", effectivePersonaId] })}
          />
        )}
      </div>
    </div>
  );
};
/* ─────────────────────────────────────────── */
/*  Sub-components                             */
/* ─────────────────────────────────────────── */

/* Modal de confirmación de datos extraídos (CURP / CSF) — editable antes de guardar */
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
      <DialogContent className="p-0 max-w-md flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
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
