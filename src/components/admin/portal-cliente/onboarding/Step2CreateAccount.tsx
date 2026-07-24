import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/lib/portal-cliente/onboarding-store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Mail, MailCheck, RefreshCw } from "lucide-react";

// SWAP POINT: lista real de correos ya registrados (verificación server-side).
const EXISTING_ACCOUNTS = ["cliente@sozu.mx", "demo@sozu.mx"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function Step2CreateAccount() {
  const email = usePortal((s) => s.onboarding.accountEmail) ?? "";
  const phone = usePortal((s) => s.onboarding.accountPhone) ?? "";
  const accepted = usePortal((s) => s.onboarding.privacyAccepted);
  const verificationSent = usePortal((s) => s.onboarding.emailVerificationSent);
  const setOnb = usePortal((s) => s.setOnboarding);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const emailValid = EMAIL_RE.test(email);
  const emailTaken =
    emailValid && EXISTING_ACCOUNTS.includes(email.trim().toLowerCase());

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length === 10;

  const passValid = password.length >= 8;
  const confirmValid = confirm.length > 0 && confirm === password;
  const confirmMismatch = confirm.length > 0 && confirm !== password;

  function handlePhone(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 10);
    // Formato "33 0000 0000"
    let out = digits;
    if (digits.length > 2 && digits.length <= 6) {
      out = `${digits.slice(0, 2)} ${digits.slice(2)}`;
    } else if (digits.length > 6) {
      out = `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
    }
    setOnb({ accountPhone: out });
  }

  function resend() {
    if (resendCooldown > 0) return;
    // SWAP POINT: reenvío del enlace de verificación.
    setOnb({ emailVerificationSent: true });
    setResendCooldown(30);
    const t = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  // Marca envío al pulsar continuar (lo hace el contenedor); aquí exponemos
  // el estado "por verificar" para que el usuario reenvíe si quiere.
  const showVerifyChip = useMemo(
    () => verificationSent && emailValid,
    [verificationSent, emailValid],
  );

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">Crea tu cuenta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Usaremos este correo y teléfono para tus notificaciones y acceso al portal.
        </p>
      </header>

      <div className="grid gap-4">
        {/* Correo */}
        <div className="space-y-1">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setOnb({ accountEmail: e.target.value })}
            placeholder="tu@correo.com"
            autoComplete="email"
            aria-invalid={email.length > 0 && !emailValid}
          />
          {email.length > 0 && !emailValid && (
            <p className="text-xs text-destructive">Formato de correo no válido.</p>
          )}
          {emailTaken && (
            <p className="text-xs text-destructive">
              Ese correo ya está registrado.{" "}
              <a href="/login" className="font-medium underline">
                Inicia sesión
              </a>
              .
            </p>
          )}
          {showVerifyChip && !emailTaken && (
            <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
              <MailCheck className="h-3.5 w-3.5" />
              <span>
                Enlace enviado a <span className="font-medium">{email}</span> · Correo por
                verificar
              </span>
              <button
                type="button"
                onClick={resend}
                disabled={resendCooldown > 0}
                className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" />
                {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Reenviar enlace"}
              </button>
            </div>
          )}
        </div>

        {/* Teléfono */}
        <div className="space-y-1">
          <Label htmlFor="phone">Teléfono</Label>
          <div className="flex items-stretch gap-2">
            <span className="inline-flex shrink-0 items-center rounded-md border border-input bg-secondary px-3 text-xs font-medium text-muted-foreground num">
              +52 · MX
            </span>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => handlePhone(e.target.value)}
              placeholder="33 0000 0000"
              className="num flex-1"
              aria-invalid={phone.length > 0 && !phoneValid}
            />
          </div>
          {phone.length > 0 && !phoneValid && (
            <p className="text-xs text-destructive">
              Ingresa 10 dígitos (sin lada internacional).
            </p>
          )}
        </div>

        {/* Contraseña */}
        <div className="space-y-1">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              className="pr-10"
              aria-invalid={password.length > 0 && !passValid}
            />
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            No introduzcas contraseñas de terceros aquí. Esta es tu cuenta personal SOZU.
          </p>
          {password.length > 0 && !passValid && (
            <p className="text-xs text-destructive">Mínimo 8 caracteres.</p>
          )}
        </div>

        {/* Confirmar contraseña */}
        <div className="space-y-1">
          <Label htmlFor="confirm">Confirmar contraseña</Label>
          <div className="relative">
            <Input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repite tu contraseña"
              autoComplete="new-password"
              className="pr-10"
              aria-invalid={confirmMismatch}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              aria-label={
                showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {confirmMismatch && (
            <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>
          )}
        </div>
      </div>

      {/* Info banner verificación */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Para activar tu cuenta te enviaremos un enlace de verificación a tu correo.
          Deberás confirmarlo para completar tu registro; puedes seguir avanzando mientras
          tanto.
        </span>
      </div>

      {/* Aviso de privacidad */}
      <label className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-sm">
        <Checkbox
          id="privacy"
          checked={accepted}
          onCheckedChange={(v) => setOnb({ privacyAccepted: v === true })}
          className="mt-0.5"
        />
        <span className="text-foreground">
          He leído y acepto el{" "}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => setShowPrivacy(true)}
          >
            Aviso de Privacidad LFPDPPP
          </button>{" "}
          y autorizo el tratamiento de mi identificación, escritura, certificado del RPP y
          predial para fines de validación de titularidad.
        </span>
      </label>

      {/* Estado del formulario (para el botón Continuar del contenedor) */}
      <FormGate
        ready={
          emailValid &&
          !emailTaken &&
          phoneValid &&
          passValid &&
          confirmValid &&
          accepted
        }
      />

      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aviso de Privacidad (LFPDPPP)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              SOZU S.A. de C.V. es responsable del tratamiento de sus datos personales. Los
              datos recabados por este medio se usarán exclusivamente para: (i) validar la
              titularidad de la propiedad, (ii) vincularlo administrativamente con las áreas
              de Legal / Escrituración / Administración / Cobranza, (iii) emitir CFDI por
              mantenimiento y (iv) comunicaciones relacionadas.
            </p>
            <p>
              Sus datos no se comercializan. Puede ejercer sus derechos ARCO al{" "}
              <span className="num">33 2312 2610</span>.
            </p>
            <p>Este es un aviso resumido para fines de demostración.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Publica el estado de "formulario válido" al store para que el botón
// Continuar del contenedor del wizard lo respete sin cambiar su lógica.
function FormGate({ ready }: { ready: boolean }) {
  const setOnb = usePortal((s) => s.setOnboarding);
  const current = usePortal((s) => s.onboarding.accountReady);
  useSyncReady(ready, setOnb, current);
  return (
    <p className="sr-only" aria-live="polite">
      {ready ? "Formulario listo" : "Completa el formulario"}
    </p>
  );
}



function useSyncReady(
  ready: boolean,
  setOnb: (p: Partial<import("@/lib/portal-cliente/onboarding-store").OnboardingState>) => void,
  current: boolean,
) {
  useEffect(() => {
    if (ready !== current) setOnb({ accountReady: ready });
  }, [ready, current, setOnb]);
}
