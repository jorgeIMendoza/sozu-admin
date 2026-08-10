import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePortal, computeVerification, requiredDocsFor } from "@/lib/portal-cliente/onboarding-store";
import { submitSolicitudPropietario } from "@/lib/portal-cliente/onboarding-submit";
import { BrandLogo } from "@/components/admin/portal-cliente/onboarding/BrandLogo";
import { DemoPanel } from "@/components/admin/portal-cliente/onboarding/DemoPanel";
import { Button } from "@/components/ui/button";
import { Step1IdentifyUnit } from "@/components/admin/portal-cliente/onboarding/Step1IdentifyUnit";
import { Step2CreateAccount } from "@/components/admin/portal-cliente/onboarding/Step2CreateAccount";
import { Step3PersonType } from "@/components/admin/portal-cliente/onboarding/Step3PersonType";
import { Step4Documents } from "@/components/admin/portal-cliente/onboarding/Step4Documents";
import { Step5Verification } from "@/components/admin/portal-cliente/onboarding/Step5Verification";
import { Step6Linking } from "@/components/admin/portal-cliente/onboarding/Step6Linking";
import { Step7Transfer } from "@/components/admin/portal-cliente/onboarding/Step7Transfer";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, Phone } from "lucide-react";

const STEPS = [
  "Identifica tu propiedad",
  "Crea tu cuenta",
  "Tipo de persona",
  "Documentos",
  "Verificación",
  "Estado y vinculación",
  "Transferencia",
];

// Destino tras completar el registro (portal autenticado del cliente).
// En Fase 1 (mock) no hay sesión Supabase real: ProtectedRoute redirige a /login.
const PORTAL_DESTINATION = "/admin/portal-cliente/inicio";

export default function RegistrarPropiedadPage() {
  const step = usePortal((s) => s.onboarding.step);
  const setOnb = usePortal((s) => s.setOnboarding);
  const onboarding = usePortal((s) => s.onboarding);
  const state = usePortal();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const checks = computeVerification(state);
  const requiredDocs = requiredDocsFor(onboarding.personType);
  const escrituraConfirmed = onboarding.docs.some((d) => d.type === "escritura" && d.confirmed);
  const allConfirmed = (() => {
    if (onboarding.personType === "fisica") {
      const idConfirmed = onboarding.docs.some((d) => d.type === "id_oficial" && d.confirmed);
      return idConfirmed && escrituraConfirmed;
    }
    // Persona moral: acta + poder + id del RL + escritura.
    const actaOk = onboarding.docs.some((d) => d.type === "acta_constitutiva" && d.confirmed);
    const poderOk = onboarding.docs.some((d) => d.type === "poder_rl" && d.confirmed);
    const idRlOk = onboarding.docs.some((d) => d.type === "id_rl" && d.confirmed);
    void requiredDocs;
    return actaOk && poderOk && idRlOk && escrituraConfirmed;
  })();

  const noFail = checks.every((c) => c.status !== "fail");

  const canNext = (() => {
    switch (step) {
      case 1:
        return !!onboarding.unitId && onboarding.unitConfirmed;
      case 2:
        return !!onboarding.accountEmail && onboarding.privacyAccepted && onboarding.accountReady;
      case 3:
        return true;
      case 4:
        return allConfirmed;
      case 5:
        return true;
      case 6:
        return onboarding.level >= 1;
      case 7:
        return true;
      default:
        return false;
    }
  })();

  async function next() {
    // Paso 5 → envía la solicitud REAL (edge function) y luego avanza al 6.
    if (step === 5) {
      if (onboarding.caseId) {
        setOnb({ step: 6 }); // ya enviada: solo avanza
        return;
      }
      setSubmitError(null);
      setSubmitting(true);
      try {
        const failing = checks.some((c) => c.status === "fail");
        const { caseId } = await submitSolicitudPropietario(onboarding, checks);
        setOnb({
          step: 6,
          caseId,
          routedDepartments: failing
            ? ["Legal Flow", "Escrituración"]
            : ["Administración", "Cobranza"],
        });
      } catch (e) {
        setSubmitError(
          e instanceof Error ? e.message : "No se pudo enviar tu solicitud. Intenta de nuevo.",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === 6 && onboarding.level >= 1 && !state.auth.user) {
      state.login(onboarding.accountEmail ?? "nuevo@sozu.mx");
    }
    if (step === 7) {
      navigate(PORTAL_DESTINATION);
      return;
    }
    if (step === 2 && !onboarding.emailVerificationSent) {
      // SWAP POINT: envío de correo de verificación.
      setOnb({ emailVerificationSent: true });
    }
    setOnb({ step: Math.min(7, step + 1) });
  }

  function prev() {
    setOnb({ step: Math.max(1, step - 1) });
  }

  // En el Paso 6 el solicitante ya terminó: su acción real es salir al portal.
  // (En mock rebota a /login; con sesión real de Fase D aterriza en el portal.)
  function goToPortal() {
    if (!state.auth.user) {
      state.login(onboarding.accountEmail ?? "nuevo@sozu.mx");
    }
    navigate(PORTAL_DESTINATION);
  }

  const step7Locked = onboarding.level < 2;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Rail izquierdo — stepper vertical (oculto en móvil) */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col self-start border-r border-border bg-card md:flex">
        <div className="border-b border-border px-4 py-4">
          <BrandLogo />
        </div>
        <div className="px-4 pb-2 pt-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Flujo
          </div>
          <div className="mt-0.5 text-sm font-semibold text-foreground">
            Registrar mi propiedad
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          <ol className="space-y-1">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const isDone = n < step;
              const isActive = n === step;
              const isLocked = n === 7 && step7Locked && n !== step;
              return (
                <li key={label} className="relative">
                  {i < STEPS.length - 1 && (
                    <span
                      className={`absolute left-[22px] top-9 h-3 w-px ${isDone ? "bg-primary/40" : "bg-border"}`}
                      aria-hidden
                    />
                  )}
                  <div
                    className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm transition ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : isDone
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold num ${
                        isActive
                          ? "border-primary/30 bg-primary text-primary-foreground"
                          : isDone
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : isLocked
                              ? "border-border bg-secondary text-muted-foreground"
                              : "border-border bg-secondary text-muted-foreground"
                      }`}
                    >
                      {isDone ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : isLocked ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        n
                      )}
                    </span>
                    <span className={`flex-1 truncate ${isActive ? "font-medium" : ""}`}>
                      {label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="border-t border-border p-4 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            <span>¿Dudas? SOZU</span>
          </div>
          <div className="mt-0.5 num font-semibold text-foreground">33 2312 2610</div>
          <Link
            to="/login"
            className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Guardar y salir
          </Link>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 md:px-6">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Paso {step}
            </div>
            <div className="truncate text-sm font-semibold text-foreground">
              {STEPS[step - 1]}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Paso <span className="num font-semibold text-foreground">{step}</span> de{" "}
            <span className="num">7</span>
          </div>
        </header>

        {/* Progreso móvil */}
        <div className="border-b border-border bg-card px-4 py-2 md:hidden">
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(step / 7) * 100}%` }}
            />
          </div>
        </div>

        <main className="flex-1">
          <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-7">
              {step === 1 && <Step1IdentifyUnit />}
              {step === 2 && <Step2CreateAccount />}
              {step === 3 && <Step3PersonType />}
              {step === 4 && <Step4Documents />}
              {step === 5 && <Step5Verification />}
              {step === 6 && <Step6Linking />}
              {step === 7 && <Step7Transfer />}
            </section>

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={prev} disabled={step === 1}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Atrás
              </Button>
              <div className="hidden flex-1 px-3 text-center text-xs text-muted-foreground sm:block">
                {step === 5 && submitError ? (
                  <span className="text-destructive">{submitError}</span>
                ) : step === 5 && !noFail ? (
                  <span className="text-destructive">
                    Hay observaciones: pasarán a revisión legal.
                  </span>
                ) : step === 6 && onboarding.level === 0 ? (
                  <span>
                    Tu solicitud quedó registrada. Te avisaremos por correo cuando SOZU la revise;
                    ahí crearás tu contraseña y entrarás al portal.
                  </span>
                ) : step === 6 && onboarding.level === 1 ? (
                  <span>
                    La transferencia de registro se habilitará cuando SOZU reconozca tu titularidad
                    (Nivel 2). Te avisaremos por correo.
                  </span>
                ) : null}
              </div>
              {step === 6 && onboarding.level === 0 ? (
                // Modelo B: aún no hay cuenta/portal (se crea al aprobar Nivel 1).
                <Button onClick={() => navigate("/login")}>
                  Entendido <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : step === 6 && onboarding.level === 1 ? (
                <Button onClick={goToPortal}>
                  Ir a mi portal <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={next} disabled={!canNext || submitting}>
                  {step === 5 && submitting ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Enviando…
                    </>
                  ) : (
                    <>
                      {step === 5 ? "Enviar solicitud" : step === 7 ? "Ir al portal" : "Continuar"}{" "}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Ayuda en móvil (rail no visible) */}
            <div className="mt-8 rounded-lg border border-border bg-card p-4 text-xs md:hidden">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span>¿Dudas? SOZU</span>
                <span className="num font-semibold text-foreground">33 2312 2610</span>
              </div>
              <Link
                to="/login"
                className="mt-2 inline-block text-muted-foreground hover:underline"
              >
                Guardar y salir
              </Link>
            </div>
          </div>
        </main>
        <DemoPanel />
      </div>
    </div>
  );
}
