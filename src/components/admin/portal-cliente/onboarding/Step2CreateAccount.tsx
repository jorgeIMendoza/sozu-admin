import { useEffect, useState } from "react";
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
import { Mail } from "lucide-react";

// SWAP POINT: verificación real de correos ya registrados (contra auth/usuarios).
const EXISTING_ACCOUNTS = ["cliente@sozu.mx", "demo@sozu.mx"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Modelo B (decisión de producto): la cuenta y la contraseña NO se crean aquí.
// Aquí solo se recaban correo y teléfono; la cuenta (rol Cliente) se crea cuando
// el área de condominio aprueba el Nivel 1, con un enlace para definir contraseña.
export function Step2CreateAccount() {
  const email = usePortal((s) => s.onboarding.accountEmail) ?? "";
  const phone = usePortal((s) => s.onboarding.accountPhone) ?? "";
  const accepted = usePortal((s) => s.onboarding.privacyAccepted);
  const setOnb = usePortal((s) => s.setOnboarding);

  const [showPrivacy, setShowPrivacy] = useState(false);

  const emailValid = EMAIL_RE.test(email);
  const emailTaken =
    emailValid && EXISTING_ACCOUNTS.includes(email.trim().toLowerCase());

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length === 10;

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

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">Crea tu cuenta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Con estos datos te daremos acceso al portal. <strong className="text-foreground">Tu
          contraseña la defines después</strong>, cuando SOZU apruebe tu registro; por ahora solo
          necesitamos cómo contactarte.
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
      </div>

      {/* Info: la cuenta se activa al aprobar el registro */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Cuando SOZU apruebe tu registro te enviaremos a este correo un enlace para definir tu
          contraseña y entrar al portal. Puedes seguir avanzando ahora.
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
          y autorizo el tratamiento de mi identificación, escritura y predial para fines de
          validación de titularidad.
        </span>
      </label>

      {/* Estado del formulario (para el botón Continuar del contenedor) */}
      <FormGate ready={emailValid && !emailTaken && phoneValid && accepted} />

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
