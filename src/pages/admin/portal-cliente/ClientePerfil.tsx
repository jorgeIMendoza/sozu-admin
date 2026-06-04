import {
  User, Mail, Phone, FileText, LogOut, Shield, ChevronRight,
  CheckCircle2, Building2, CreditCard,
  Lock, Eye, EyeOff, BadgeCheck, AlertCircle, Clock, Loader2,
  Check, X, Download,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type VerificationStatus = "verified" | "review" | "incomplete";
type DocStatus = "verified" | "rejected" | "review" | "missing";

const ClientePerfil = () => {
  const { profile, signOut, signIn, updatePassword } = useAuth();
  const { impersonatedClientePersonaId, isImpersonating } = useClienteImpersonation();
  const effectivePersonaId = isImpersonating ? impersonatedClientePersonaId : profile?.id_persona;

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Fetch persona data
  const { data: persona, isLoading: loadingPersona } = useQuery({
    queryKey: ["cliente-perfil-persona", effectivePersonaId],
    queryFn: async () => {
      if (!effectivePersonaId) return null;
      const { data } = await supabase
        .from("personas")
        .select(`
          id, nombre_legal, tipo_persona, rfc, curp, email, telefono,
          clave_pais_telefono, regimen, uso_cfdi,
          direccion_fiscal_calle, direccion_fiscal_colonia, direccion_fiscal_codigo_postal,
          direccion_fiscal_num_ext, direccion_fiscal_num_int,
          direccion_fiscal_id_estado, direccion_fiscal_id_municipio
        `)
        .eq("id", effectivePersonaId)
        .maybeSingle();
      return data;
    },
    enabled: !!effectivePersonaId,
  });

  // Fetch regimen name
  const { data: regimenData } = useQuery({
    queryKey: ["cliente-perfil-regimen", persona?.regimen],
    queryFn: async () => {
      if (!persona?.regimen) return null;
      const { data } = await supabase
        .from("regimen")
        .select("id, nombre")
        .eq("id", persona.regimen)
        .maybeSingle();
      return data;
    },
    enabled: !!persona?.regimen,
  });

  // Fetch uso_cfdi name
  const { data: usoCfdiData } = useQuery({
    queryKey: ["cliente-perfil-usocfdi", persona?.uso_cfdi],
    queryFn: async () => {
      if (!persona?.uso_cfdi) return null;
      const { data } = await supabase
        .from("uso_cfdi")
        .select("codigo, nombre")
        .eq("codigo", persona.uso_cfdi)
        .maybeSingle();
      return data;
    },
    enabled: !!persona?.uso_cfdi,
  });

  const EXPEDIENTE_SLOTS = [
    { key: "ine",        label: "INE / Identificación oficial",   tipoIds: [2, 3, 4], required: true  },
    { key: "curp",       label: "CURP",                           tipoIds: [5],       required: true  },
    { key: "csf",        label: "Constancia de situación fiscal", tipoIds: [6],       required: true  },
    { key: "matrimonio", label: "Acta de matrimonio",             tipoIds: [11],      required: false },
    { key: "domicilio",  label: "Comprobante de domicilio",       tipoIds: [8],       required: true  },
  ] as const;

  // Fetch documents for persona
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
               : "review") as DocStatus,
        date: d.fecha_creacion ? new Date(d.fecha_creacion).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : null,
        url: d.url,
      }));
    },
    enabled: !!effectivePersonaId,
  });

  // Fetch bank accounts
  const { data: cuentasBancarias = [] } = useQuery({
    queryKey: ["cliente-perfil-bancos", effectivePersonaId],
    queryFn: async () => {
      if (!effectivePersonaId) return [];
      const { data } = await supabase
        .from("cuentas_bancarias")
        .select("id, numero_cuenta, cuenta_clabe, id_banco, titular, bancos:fk_cuentas_bancarias_banco(nombre)")
        .eq("id_persona", effectivePersonaId)
        .eq("activo", true);
      return (data || []).map((c: any) => ({
        id: c.id,
        banco: (c.bancos as any)?.nombre || "Banco",
        numeroCuenta: c.numero_cuenta,
        clabe: c.cuenta_clabe,
        titular: c.titular,
      }));
    },
    enabled: !!effectivePersonaId,
  });

  // Password validation
  const passwordChecks = useMemo(() => ({
    minLength: newPassword.length >= 8,
    hasUpper: /[A-Z]/.test(newPassword),
    hasLower: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
    matches: newPassword.length > 0 && newPassword === confirmPassword,
  }), [newPassword, confirmPassword]);

  const allPasswordChecksPass = passwordChecks.minLength && passwordChecks.hasUpper && passwordChecks.hasLower && passwordChecks.hasNumber && passwordChecks.hasSpecial && passwordChecks.matches;

  // Botón verde: passwords coinciden + mínimo 8 chars + contraseña actual llenada
  const pwButtonReady = passwordChecks.matches && passwordChecks.minLength && !!currentPassword && !changingPassword;

  const handleChangePassword = async () => {
    if (!currentPassword) { toast.error("Ingresa tu contraseña actual"); return; }
    if (!passwordChecks.minLength) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    if (!passwordChecks.matches) { toast.error("Las contraseñas no coinciden"); return; }
    if (!allPasswordChecksPass) { toast.error("La contraseña no cumple todos los requisitos de seguridad"); return; }
    setChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast.error((error as any)?.message || "Error al cambiar contraseña.");
        console.error("[updatePassword]", error);
      } else {
        toast.success("Contraseña actualizada correctamente");
        setShowChangePassword(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  // Profile completion
  const uploadedTypeIds = new Set(documentos.map((d) => d.tipoId));
  const hasIdentification = uploadedTypeIds.has(2) || uploadedTypeIds.has(3) || uploadedTypeIds.has(4);
  const completionFields = persona ? [
    persona.nombre_legal,
    persona.rfc,
    persona.curp,
    persona.email,
    persona.telefono,
    persona.regimen,
    persona.uso_cfdi,
    persona.direccion_fiscal_calle,
    hasIdentification,
    uploadedTypeIds.has(8),
    cuentasBancarias.length > 0,
  ] : [];
  const profileCompletion = completionFields.length > 0
    ? Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100)
    : 0;

  const verificationStatus: VerificationStatus = profileCompletion >= 90 ? "verified" : profileCompletion >= 50 ? "review" : "incomplete";

  const statusConfig: Record<VerificationStatus, { label: string; icon: React.ElementType; className: string }> = {
    verified: { label: "Perfil verificado", icon: BadgeCheck, className: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
    review: { label: "En revisión", icon: Clock, className: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
    incomplete: { label: "Información incompleta", icon: AlertCircle, className: "text-red-500 bg-red-50 dark:bg-red-950/30" },
  };

  const status = statusConfig[verificationStatus];
  const StatusIcon = status.icon;

  const maskValue = (val: string | null, showFirst = 4, showLast = 3) => {
    if (!val) return "—";
    if (val.length <= showFirst + showLast) return val;
    return val.substring(0, showFirst) + "••••" + val.substring(val.length - showLast);
  };

  const displayName = persona?.nombre_legal || profile?.nombre || "Cliente";
  const tipoPersona = persona?.tipo_persona === "Moral" ? "Moral" : "Física";

  // Fiscal display values with name
  const regimenDisplay = persona?.regimen
    ? regimenData?.nombre
      ? `${persona.regimen} — ${regimenData.nombre}`
      : persona.regimen
    : "—";

  const usoCfdiDisplay = persona?.uso_cfdi
    ? usoCfdiData?.nombre
      ? `${persona.uso_cfdi} — ${usoCfdiData.nombre}`
      : persona.uso_cfdi
    : "—";

  // Fiscal address
  const fiscalParts = [
    persona?.direccion_fiscal_calle,
    persona?.direccion_fiscal_num_ext ? `#${persona.direccion_fiscal_num_ext}` : null,
    persona?.direccion_fiscal_colonia,
    persona?.direccion_fiscal_codigo_postal,
  ].filter(Boolean);
  const fiscalAddress = fiscalParts.length > 0 ? fiscalParts.join(", ") : "—";

  if (loadingPersona) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto lg:max-w-none px-4 py-6 pb-28 space-y-6 lg:px-0">
      {/* Identity Hero */}
      <section className="flex flex-col items-center text-center">
        <div className="w-[72px] h-[72px] rounded-full bg-[hsl(var(--inmob-green))]/10 flex items-center justify-center mb-3">
          <User className="w-8 h-8 text-[hsl(var(--inmob-green))]" />
        </div>
        <h2 className="font-bold text-lg text-foreground">{displayName}</h2>
        <p className="text-xs text-muted-foreground mb-2">{tipoPersona === "Moral" ? "Persona Moral" : "Inversionista"}</p>

        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${status.className}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </span>

        <div className="w-full max-w-[220px] mt-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>Perfil completado</span>
            <span className="font-semibold text-foreground">{profileCompletion}%</span>
          </div>
          <Progress value={profileCompletion} className="h-1.5 bg-muted" />
        </div>
      </section>

      {/* Personal Info */}
      <Section title="Información personal" icon={User}>
        <InfoRow label="Tipo de persona" value={tipoPersona} />
        <InfoRow label="RFC" value={maskValue(persona?.rfc)} />
        <InfoRow label="CURP" value={maskValue(persona?.curp, 4, 4)} />
        <InfoRow label="Email" value={persona?.email || profile?.email || "—"} icon={Mail} />
        <InfoRow label="Teléfono" value={persona?.telefono ? `${persona.clave_pais_telefono || "+52"} ${persona.telefono}` : "—"} icon={Phone} />
      </Section>

      {/* Expediente */}
      <Section title="Expediente" icon={FileText}>
        <div className="space-y-0">
          {EXPEDIENTE_SLOTS.map((slot, i) => {
            const slotDocs = documentos.filter((d) => (slot.tipoIds as readonly number[]).includes(d.tipoId));
            const bestDoc =
              slotDocs.find((d) => d.status === "verified") ||
              slotDocs.find((d) => d.status === "review") ||
              slotDocs[0];
            const slotStatus: DocStatus = bestDoc?.status ?? "missing";
            const isLast = i === EXPEDIENTE_SLOTS.length - 1;

            const cfg: Record<DocStatus, { label: string; badgeCls: string; SlotIcon: React.ElementType; iconCls: string }> = {
              verified: { label: "Aprobado",    badgeCls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30", SlotIcon: CheckCircle2,  iconCls: "text-emerald-500" },
              review:   { label: "En revisión", badgeCls: "bg-amber-50 text-amber-600 dark:bg-amber-950/30",       SlotIcon: Clock,         iconCls: "text-amber-500"  },
              rejected: { label: "Rechazado",   badgeCls: "bg-red-50 text-red-500 dark:bg-red-950/30",             SlotIcon: X,             iconCls: "text-red-500"    },
              missing:  {
                label:     slot.required ? "Falta" : "Opcional",
                badgeCls:  slot.required ? "bg-red-50 text-red-500 dark:bg-red-950/30" : "bg-muted text-muted-foreground",
                SlotIcon:  slot.required ? AlertCircle : FileText,
                iconCls:   slot.required ? "text-muted-foreground/40" : "text-muted-foreground/25",
              },
            };
            const { label, badgeCls, SlotIcon, iconCls } = cfg[slotStatus];

            return (
              <div key={slot.key} className={`flex items-center gap-3 py-3 ${!isLast ? "border-b border-border/60" : ""}`}>
                <SlotIcon className={`w-4 h-4 shrink-0 ${iconCls}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{slot.label}</p>
                  {bestDoc?.date && (
                    <p className="text-[11px] text-muted-foreground">{bestDoc.date}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {bestDoc?.url && (
                    <button
                      onClick={() => setPreviewDoc({ title: slot.label, url: bestDoc.url! })}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Ver ${slot.label}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badgeCls}`}>
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Fiscal */}
      <Section title="Información fiscal" icon={Building2}>
        <InfoRow label="Régimen fiscal" value={regimenDisplay} />
        <InfoRow label="Uso CFDI" value={usoCfdiDisplay} />
        <InfoRow label="Dirección fiscal" value={fiscalAddress} />
      </Section>

      {/* Bank */}
      <Section title="Cuentas bancarias" icon={CreditCard}>
        {cuentasBancarias.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Sin cuentas bancarias registradas</p>
        ) : (
          <div className="space-y-2">
            {cuentasBancarias.map((cuenta) => (
              <div key={cuenta.id} className="flex items-center gap-3 py-1">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{cuenta.banco}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Terminación ****{cuenta.numeroCuenta?.slice(-4) || "****"}
                  </p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Security */}
      <Section title="Seguridad" icon={Shield}>
        <button
          onClick={isImpersonating ? undefined : () => setShowChangePassword(true)}
          disabled={isImpersonating}
          className={`w-full flex items-center justify-between py-2.5 -mx-1 px-1 rounded-lg transition-colors ${isImpersonating ? "opacity-40 cursor-not-allowed" : "hover:bg-accent/30"}`}
        >
          <span className="flex items-center gap-2.5 text-sm text-foreground">
            <Lock className="w-4 h-4 text-muted-foreground" />
            Cambiar contraseña
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </Section>

      {/* Bottom actions */}
      <div className="space-y-0">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 py-3.5 text-left hover:bg-accent/50 transition-colors rounded-lg px-1"
        >
          <LogOut className="w-4 h-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">Cerrar sesión</span>
        </button>
      </div>

      {/* Document Viewer — Dialog en desktop, Sheet en mobile */}
      {previewDoc && isDesktop ? (
        <Dialog open={!!previewDoc} onOpenChange={(v) => { if (!v) setPreviewDoc(null); }}>
          <DialogContent className="p-0 max-w-3xl h-[85vh] flex flex-col [&>button:last-child]:hidden">
            <DocViewerHeader doc={previewDoc} />
            <DocViewerBody doc={previewDoc} />
            <div className="px-4 pb-6 pt-4 border-t border-border/50 space-y-2 shrink-0">
              <a
                href={previewDoc.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-10 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                Descargar
              </a>
              <button
                onClick={() => setPreviewDoc(null)}
                className="w-full h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={!!previewDoc} onOpenChange={(v) => { if (!v) setPreviewDoc(null); }}>
          <SheetContent side="bottom" className="max-h-[75dvh] p-0 rounded-t-2xl flex flex-col [&>button:last-child]:hidden">
            {previewDoc && (
              <>
                <DocViewerHeader doc={previewDoc} />
                <DocViewerBody doc={previewDoc} />
                <div className="px-4 pb-6 pt-4 border-t border-border/50 space-y-2 shrink-0">
                  <a
                    href={previewDoc.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-10 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-xl transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Descargar
                  </a>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="w-full h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Change Password — Dialog desktop / Sheet mobile */}
      {(() => {
        const onClose = () => {
          setShowChangePassword(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        };
        const pwContent = (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
              <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground text-sm leading-tight">Cambiar contraseña</h3>
                <p className="text-xs text-muted-foreground">Actualiza tu contraseña de acceso</p>
              </div>
            </div>

            {/* Form */}
            <div className="px-5 pt-5 pb-4 space-y-4">
              <PwField label="Contraseña actual" value={currentPassword} onChange={setCurrentPassword}
                placeholder="Tu contraseña actual" show={showCurrentPw} onToggle={() => setShowCurrentPw(v => !v)} autoComp="current-password" />
              <PwField label="Nueva contraseña" value={newPassword} onChange={setNewPassword}
                placeholder="Nueva contraseña" show={showNewPw} onToggle={() => setShowNewPw(v => !v)} autoComp="new-password" />
              <PwField label="Confirmar contraseña" value={confirmPassword} onChange={setConfirmPassword}
                placeholder="Repite la nueva contraseña" show={showConfirmPw} onToggle={() => setShowConfirmPw(v => !v)} autoComp="new-password" />

              {newPassword.length > 0 && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <PasswordCheck label="8 caracteres" ok={passwordChecks.minLength} />
                  <PasswordCheck label="Mayúscula" ok={passwordChecks.hasUpper} />
                  <PasswordCheck label="Minúscula" ok={passwordChecks.hasLower} />
                  <PasswordCheck label="Número" ok={passwordChecks.hasNumber} />
                  <PasswordCheck label="Carácter especial" ok={passwordChecks.hasSpecial} />
                  {confirmPassword.length > 0 && <PasswordCheck label="Coinciden" ok={passwordChecks.matches} />}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-8 pt-2 space-y-2">
              <button
                onClick={handleChangePassword}
                className={`w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  pwButtonReady
                    ? "bg-[hsl(var(--inmob-green))] text-white hover:bg-[hsl(var(--inmob-green))]/90 active:scale-[0.98]"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {changingPassword ? "Guardando..." : "Confirmar cambio"}
              </button>
              <button onClick={onClose} className="w-full h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors">
                Cerrar
              </button>
            </div>
          </>
        );
        return isDesktop ? (
          <Dialog open={showChangePassword} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="p-0 max-w-md max-h-[85vh] overflow-y-auto [&>button:last-child]:hidden">
              {pwContent}
            </DialogContent>
          </Dialog>
        ) : (
          <Sheet open={showChangePassword} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="bottom" className="p-0 rounded-t-2xl max-h-[75dvh] overflow-y-auto [&>button:last-child]:hidden">
              {pwContent}
            </SheetContent>
          </Sheet>
        );
      })()}
    </div>
  );
};

/* Helpers */
const PwField = ({
  label, value, onChange, placeholder, show, onToggle, autoComp,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; show: boolean; onToggle: () => void; autoComp: string;
}) => (
  <div className="space-y-1.5">
    <label className="text-sm font-semibold text-foreground block">{label}</label>
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComp}
        className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show
          ? <EyeOff className="w-4 h-4" />
          : <Eye className="w-4 h-4" />}
      </button>
    </div>
  </div>
);

const PasswordCheck = ({ label, ok }: { label: string; ok: boolean }) => (
  <div className="flex items-center gap-2">
    {ok
      ? <Check className="w-3.5 h-3.5 text-emerald-500" />
      : <X className="w-3.5 h-3.5 text-muted-foreground/50" />
    }
    <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
  </div>
);

const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <section>
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
    </div>
    <div className="bg-card rounded-xl border border-border/60 p-4 space-y-2">
      {children}
    </div>
  </section>
);

const InfoRow = ({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </span>
    <span className="text-sm font-medium text-foreground max-w-[60%] text-right truncate">{value}</span>
  </div>
);

type DocViewerDoc = { title: string; url: string };

const DocViewerHeader = ({ doc }: { doc: DocViewerDoc }) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-foreground truncate">{doc.title}</p>
      <p className="text-xs text-muted-foreground">Vista previa del documento</p>
    </div>
  </div>
);

const DocViewerBody = ({ doc }: { doc: DocViewerDoc }) => (
  <div className="flex-1 overflow-hidden bg-muted/20 min-h-0">
    {/\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(doc.url) ? (
      <img src={doc.url} alt={doc.title} className="w-full h-full object-contain p-4" />
    ) : (
      <iframe
        src={`${doc.url}#toolbar=0&navpanes=0`}
        title={doc.title}
        loading="lazy"
        className="w-full h-full border-0"
      />
    )}
  </div>
);

export default ClientePerfil;
