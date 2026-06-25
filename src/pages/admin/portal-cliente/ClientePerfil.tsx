import {
  User, Mail, FileText, LogOut, Shield,
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

// Each entry is a list of keyword groups; ALL groups must match (at least one kw per group).
const PDF_KEYWORDS: Record<number, string[][]> = {
  1:  [["NACIMIENTO", "ACTA DE NACIMIENTO"], ["REGISTRO CIVIL", "REGISTRO"]],
  5:  [["CURP", "CLAVE ÚNICA", "CLAVE UNICA", "RENAPO"]],
  6:  [["CONSTANCIA", "SITUACION FISCAL", "SITUACIÓN FISCAL", "SAT"], ["RFC"]],
  8:  [["CFE", "TELMEX", "IZZI", "TOTALPLAY", "MEGACABLE", "TELEFONOS", "GAS NATURAL", "AGUA", "BANCO",
        "CLABE", "ESTADO DE CUENTA", "COMPROBANTE DE DOMICILIO", "DOMICILIO"]],
  11: [["MATRIMONIO", "ACTA DE MATRIMONIO"]],
};
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";
import { toast } from "sonner";
import { ClienteINECaptureDialog } from "@/components/admin/portal-cliente/ClienteINECaptureDialog";

/* ─── helpers ─── */
const INPUT_CLS =
  "flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow";
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
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
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
    className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-emerald text-white hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-60"
  >
    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
    {loading ? "Guardando..." : label}
  </button>
);

const GrayBtn = ({ label }: { label: string }) => (
  <button
    disabled
    className="w-full h-11 rounded-xl text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed"
  >
    {label}
  </button>
);

const CancelBtn = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full h-10 text-sm font-semibold text-destructive hover:bg-destructive/5 rounded-xl transition-colors"
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
    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
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
const DocViewerBody = ({ doc }: { doc: DocViewerDoc }) => (
  <div className="flex-1 overflow-hidden bg-muted/20 min-h-0">
    {/\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(doc.url)
      ? <img src={doc.url} alt={doc.title} className="w-full h-full object-contain p-4" />
      : <iframe src={`${doc.url}#toolbar=0&navpanes=0`} title={doc.title} loading="lazy" className="w-full h-full border-0" />}
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

  /* Upload */
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [showINECapture, setShowINECapture] = useState(false);
  const clienteEmail = isImpersonating ? (impersonatedClienteEmail ?? null) : (profile?.email ?? null);

  const PDF_VALIDATE_TIPO_IDS = [1, 5, 6, 8, 11];
  const TIPO_NOMBRE: Record<number, string> = {
    1: "Acta de nacimiento", 5: "CURP", 6: "Constancia de situación fiscal",
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
        .select("id, numero_cuenta, cuenta_clabe, titular, bancos:fk_cuentas_bancarias_banco(nombre)")
        .eq("id_persona", effectivePersonaId)
        .eq("activo", true);
      return (data || []).map((c: any) => ({
        id: c.id,
        banco: (c.bancos as any)?.nombre || "Banco",
        numeroCuenta: c.numero_cuenta as string,
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

  const handleSaveFiscal = async () => {
    if (!effectivePersonaId) { toast.error("No se encontró el perfil"); return; }
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
    } finally {
      setSavingFiscal(false);
    }
  };

  const handleUploadDoc = async (file: File, slotKey: string, primaryTipoId: number) => {
    if (!effectivePersonaId) return;
    setUploadingSlot(slotKey);
    try {
      const isPdfType = PDF_VALIDATE_TIPO_IDS.includes(primaryTipoId);

      if (isPdfType) {
        // Extract text before uploading — if no text, reject immediately
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

        const textUpper = text.toUpperCase();
        const keywordGroups = PDF_KEYWORDS[primaryTipoId] ?? [];
        const passes = keywordGroups.every(group =>
          group.some(kw => textUpper.includes(kw.toUpperCase()))
        );

        if (!passes) {
          toast.error(
            `El archivo no corresponde a "${TIPO_NOMBRE[primaryTipoId]}". Verifica que sea el documento correcto.`,
            { duration: 7000 },
          );
          return;
        }
      }

      // Upload to storage (only reached if validation passed or not a PDF type)
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `personas/${effectivePersonaId}/${primaryTipoId}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("documentos").upload(path, file, { upsert: false });
      if (uploadErr) { toast.error("Error al subir archivo: " + uploadErr.message); return; }
      const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(path);

      // Deactivate previous docs of same type (mark as expired)
      await (supabase as any)
        .from("documentos")
        .update({ activo: false, id_estatus_verificacion: 4 })
        .eq("id_persona", effectivePersonaId)
        .eq("id_tipo_documento", primaryTipoId)
        .eq("activo", true);

      // PDF types validated locally → estatus=2 (verified). Others → estatus=1 (pending review).
      const newEstatus = isPdfType ? 2 : 1;

      const { error: insertErr } = await (supabase as any).from("documentos").insert({
        id_persona: effectivePersonaId,
        id_tipo_documento: primaryTipoId,
        url: publicUrl,
        activo: true,
        es_draft: false,
        id_estatus_verificacion: newEstatus,
      }).select("id").single();
      if (insertErr) { console.error("[uploadDoc]", insertErr); toast.error("Error al registrar documento"); return; }

      if (isPdfType) {
        toast.success("Documento verificado y aprobado");
        try {
          if (clienteEmail) {
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
          }
        } catch { /* non-critical */ }
      } else {
        toast.success("Documento enviado para revisión");
      }

      queryClient.refetchQueries({ queryKey: ["cliente-perfil-docs", effectivePersonaId] });
    } finally {
      setUploadingSlot(null);
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
  return (
    <div className="max-w-lg mx-auto lg:max-w-2xl px-4 lg:px-0 py-6 pb-28 space-y-10">

      {/* ── Hero ── */}
      <div className="flex flex-col items-center text-center gap-4 py-10">
        <div className="relative">
          <div className="w-[72px] h-[72px] rounded-full bg-muted flex items-center justify-center ring-4 ring-background shadow-md">
            <span className="text-2xl font-bold text-foreground select-none">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          {verStatus === "verified" && (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald border-2 border-background" />
          )}
        </div>
        <div>
          <h2 className="font-bold text-xl text-foreground tracking-tight">{displayName}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {persona?.tipo_persona === "pm" ? "Persona Moral" : "Persona Física"}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_CFG[verStatus].cls}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {STATUS_CFG[verStatus].label}
        </span>
        <div className="w-full max-w-[180px] space-y-1.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Perfil completado</span>
            <span className="font-bold text-foreground">{profileCompletion}%</span>
          </div>
          <Progress value={profileCompletion} className="h-1.5" />
        </div>
      </div>

      {/* ── Información personal ── */}
      <InfoCard
        title="Información personal"
        icon={User}
        action={!isImpersonating ? <EditChip onClick={openEditPersonal} /> : undefined}
      >
        <Row label="Tipo de persona"    value={persona?.tipo_persona === "pm" ? "Persona Moral" : "Persona Física"} />
        <Row label="Nombre completo"    value={persona?.nombre_legal || null} />
        <Row label="RFC"                value={persona?.rfc || null} mono />
        <Row label="CURP"               value={persona?.curp || null} mono />
        <Row
          label="Teléfono"
          value={persona?.telefono ? `${persona.clave_pais_telefono || "+52"} ${persona.telefono}` : null}
        />
        <Row
          label="Correo"
          value={persona?.email || profile?.email || null}
          isLast
          note="No editable"
        />
      </InfoCard>

      {/* ── Información fiscal ── */}
      <InfoCard
        title="Información fiscal"
        icon={Building2}
        action={!isImpersonating ? <EditChip onClick={openEditFiscal} /> : undefined}
      >
        <Row label="Régimen fiscal"   value={regimenDisplay} />
        <Row label="Uso CFDI"         value={usoCfdiDisplay} />
        <Row label="Código postal"    value={persona?.direccion_fiscal_codigo_postal?.trim() || null} mono />
        <Row label="Calle"            value={persona?.direccion_fiscal_calle?.trim() || null} />
        <Row label="Núm. exterior"    value={persona?.direccion_fiscal_num_ext || null} />
        <Row label="Núm. interior"    value={persona?.direccion_fiscal_num_int || null} />
        <Row label="Colonia"          value={persona?.direccion_fiscal_colonia || null} isLast />
      </InfoCard>

      {/* ── Expediente ── */}
      <InfoCard title="Expediente" icon={FileText}>
        {SLOTS.map((slot, i) => {
          const slotDocs = documentos.filter((d) => (slot.tipoIds as readonly number[]).includes(d.tipoId));
          const best = slotDocs.find(d => d.status === "verified")
            || slotDocs.find(d => d.status === "review")
            || slotDocs[0];
          const status = best?.status ?? "missing";
          const isLast = i === SLOTS.length - 1;
          const isUploading = uploadingSlot === slot.key;
          const canUpload = !isImpersonating && (status === "missing" || status === "rejected" || status === "expired" || status === "review");

          const DOC_STYLE = {
            verified: { dot: "bg-emerald",           badge: "text-emerald bg-emerald-pale",                                                                 label: "Aprobado"    },
            review:   { dot: "bg-amber-400",          badge: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40",                         label: "En revisión" },
            rejected: { dot: "bg-destructive",        badge: "text-destructive bg-destructive/8",                                                            label: "Rechazado"   },
            expired:  { dot: "bg-muted-foreground/50", badge: "text-muted-foreground bg-muted/80",                                                           label: "Expirado"    },
            missing:  { dot: slot.required ? "bg-muted-foreground/30" : "bg-muted-foreground/15",
                        badge: slot.required ? "text-muted-foreground bg-muted" : "text-muted-foreground/50 bg-muted/60",
                        label: slot.required ? "Pendiente" : "Opcional" },
          } as const;
          const s = DOC_STYLE[status];

          return (
            <div key={slot.key} className={`flex items-center gap-3 px-5 py-5 ${!isLast ? "border-b border-border/40" : ""}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 mt-px ${s.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{slot.label}</p>
                {best?.date && <p className="text-[11px] text-muted-foreground mt-0.5">{best.date}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {best?.url && (
                  <button
                    onClick={() => setPreviewDoc({ title: slot.label, url: best.url! })}
                    className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
                {canUpload && (slot.key === "ine_frente" || slot.key === "ine_reverso") && (
                  <button
                    onClick={() => setShowINECapture(true)}
                    disabled={isUploading}
                    className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
                  >
                    {isUploading
                      ? <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                      : <Camera className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                )}
                {canUpload && slot.key !== "ine_frente" && slot.key !== "ine_reverso" && (
                  <>
                    <input
                      ref={(el) => { fileInputRefs.current[slot.key] = el; }}
                      type="file"
                      accept={PDF_VALIDATE_TIPO_IDS.includes(slot.primaryTipoId) ? ".pdf" : ".pdf,.jpg,.jpeg,.png,.webp"}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadDoc(file, slot.key, slot.primaryTipoId);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={() => fileInputRefs.current[slot.key]?.click()}
                      disabled={isUploading}
                      className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
                    >
                      {isUploading
                        ? <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                        : <Upload className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                  </>
                )}
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${s.badge}`}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </InfoCard>

      {/* ── Cuentas bancarias ── */}
      {cuentasBancarias.length > 0 && (
        <InfoCard title="Cuentas bancarias" icon={CreditCard}>
          {cuentasBancarias.map((c, i) => (
            <div key={c.id} className={`flex items-center gap-3 px-5 py-5 ${i < cuentasBancarias.length - 1 ? "border-b border-border/40" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{c.banco}</p>
                {c.numeroCuenta && (
                  <p className="text-xs text-muted-foreground font-mono">****{c.numeroCuenta.slice(-4)}</p>
                )}
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald shrink-0" />
            </div>
          ))}
        </InfoCard>
      )}

      {/* ── Seguridad ── */}
      <InfoCard title="Seguridad" icon={Shield}>
        <button
          onClick={isImpersonating ? undefined : () => setShowChangePw(true)}
          disabled={isImpersonating}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-b-2xl"
        >
          <span className="flex items-center gap-2.5 text-sm font-medium text-foreground">
            <Lock className="w-4 h-4 text-muted-foreground" />
            Cambiar contraseña
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </InfoCard>

      {/* ── Logout ── */}
      <button
        onClick={signOut}
        className="w-full flex items-center gap-3 py-3.5 px-1 hover:bg-accent/30 transition-colors rounded-xl"
      >
        <LogOut className="w-4 h-4 text-destructive" />
        <span className="text-sm font-semibold text-destructive">Cerrar sesión</span>
      </button>

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
                <div className="flex h-11 rounded-xl border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring transition-shadow">
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
              <div className="rounded-xl bg-muted/40 px-3 py-2.5 flex items-center gap-2">
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
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-muted/30 rounded-xl p-3">
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
          Doc viewer
      ══════════════════════════════════════════════ */}
      {/* ── INE Camera Dialog ── */}
      {effectivePersonaId && (
        <ClienteINECaptureDialog
          open={showINECapture}
          onOpenChange={setShowINECapture}
          personaId={effectivePersonaId}
          clienteEmail={clienteEmail}
          isDesktop={isDesktop}
        />
      )}

      {isDesktop ? (
        <Dialog open={!!previewDoc} onOpenChange={(v) => { if (!v) setPreviewDoc(null); }}>
          <DialogContent className="p-0 max-w-3xl h-[85vh] flex flex-col [&>button:last-child]:hidden">
            {previewDoc && (
              <>
                <DocViewerHeader doc={previewDoc} />
                <DocViewerBody doc={previewDoc} />
                <div className="px-4 pb-5 pt-3 border-t border-border/50 flex gap-2 shrink-0">
                  <a href={previewDoc.url} download target="_blank" rel="noopener noreferrer"
                    className="flex-1 h-10 flex items-center justify-center gap-2 text-sm font-semibold text-emerald bg-emerald-pale hover:opacity-80 rounded-xl transition-opacity">
                    <Download className="w-4 h-4" />
                    Descargar
                  </a>
                  <button onClick={() => setPreviewDoc(null)}
                    className="flex-1 h-10 text-sm font-semibold text-destructive hover:bg-destructive/5 rounded-xl transition-colors">
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
                  <a href={previewDoc.url} download target="_blank" rel="noopener noreferrer"
                    className="flex-1 h-10 flex items-center justify-center gap-2 text-sm font-semibold text-emerald bg-emerald-pale hover:opacity-80 rounded-xl transition-opacity">
                    <Download className="w-4 h-4" />
                    Descargar
                  </a>
                  <button onClick={() => setPreviewDoc(null)}
                    className="flex-1 h-10 text-sm font-semibold text-destructive hover:bg-destructive/5 rounded-xl transition-colors">
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────── */
/*  Sub-components                             */
/* ─────────────────────────────────────────── */
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
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
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
