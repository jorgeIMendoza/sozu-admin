import { useEffect, useRef, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { CheckCircle, Mail, AlertCircle, Loader2 } from 'lucide-react';
import sozuLogo from '@/assets/sozu-logo-black.png';
import { supabase } from '@/integrations/supabase/client';
import { getPortalHost, type PortalKey } from '@/lib/portalUrls';

const resolvePortalKey = (portal: string | null): PortalKey => {
  switch (portal) {
    case 'clientes':
      return 'clientes';
    case 'agentes':
      return 'agentes';
    case 'admin':
      return 'admin';
    case 'embajadores':
      return 'embajadores';
    case 'inmobiliarias':
    default:
      return 'inmobiliarias';
  }
};

const portalHostFor = (portal: string | null) => getPortalHost(resolvePortalKey(portal));

const getPortalUrl = (portal: string | null, destination: string | null) => {
  const host = portalHostFor(portal);
  const path = destination === 'login' ? '/auth/login' : '/auth/change-password';
  return `${host}${path}`;
};

const getOtpType = (type: string | null): EmailOtpType => {
  switch (type) {
    case 'signup':
    case 'invite':
    case 'magiclink':
    case 'recovery':
    case 'email_change':
    case 'email':
      return type;
    default:
      return 'magiclink';
  }
};

export default function ConfirmacionEmail() {
  const calledRef = useRef(false);
  const [ctaUrl, setCtaUrl] = useState(`${getPortalHost('inmobiliarias')}/auth/change-password`);
  const [ctaLabel, setCtaLabel] = useState('Ir a Cambiar Contraseña');
  const [loginUrl, setLoginUrl] = useState(`${getPortalHost('inmobiliarias')}/auth/login`);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    const nombre = params.get('nombre') || '';
    const portal = params.get('portal');
    const destination = params.get('destination');
    const tokenHash = params.get('token_hash');
    const otpType = params.get('type');
    const currentHost = window.location.hostname;
    const requestedHost = new URL(portalHostFor(portal)).hostname;

    setCtaUrl(getPortalUrl(portal, destination));
    setCtaLabel(destination === 'login' ? 'Ir a Iniciar Sesión' : 'Ir a Cambiar Contraseña');
    setLoginUrl(getPortalUrl(portal, 'login'));

    if (portal && requestedHost !== currentHost) {
      const nextUrl = new URL(window.location.href);
      nextUrl.protocol = 'https:';
      nextUrl.host = requestedHost;
      window.location.replace(nextUrl.toString());
      return;
    }

    const processConfirmation = async () => {
      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: getOtpType(otpType),
        });

        if (verifyError) {
          console.error('Email confirmation verify error:', verifyError);
          setErrorMsg('El enlace de confirmación expiró o ya fue utilizado. Pide al administrador que reenvíe la confirmación.');
          setStatus('error');
          return;
        }
      }

      if (!email) {
        setErrorMsg('No pudimos identificar tu correo desde el enlace. Pide al administrador que reenvíe la confirmación.');
        setStatus('error');
        return;
      }

      const { data, error } = await supabase.functions.invoke('post-confirmacion-registro', {
        body: { email, nombre },
      });

      if (error) {
        console.error('Post-confirm error:', error);
        setErrorMsg('No pudimos completar la confirmación. Intenta de nuevo o contacta a soporte.');
        setStatus('error');
        return;
      }

      const resolvedCtaUrl = data?.ctaUrl || getPortalUrl(portal, destination);
      const resolvedExpectedHost = data?.portalHost ? new URL(data.portalHost).hostname : null;

      if (resolvedExpectedHost && resolvedExpectedHost !== currentHost) {
        const nextUrl = new URL(window.location.href);
        nextUrl.protocol = 'https:';
        nextUrl.host = resolvedExpectedHost;
        window.location.replace(nextUrl.toString());
        return;
      }

      if (data?.ctaUrl) {
        setCtaUrl(data.ctaUrl);
      }

      if (data?.ctaLabel) {
        setCtaLabel(data.ctaLabel);
      }

      setStatus('success');

      if (tokenHash) {
        window.location.replace(resolvedCtaUrl);
      }
    };

    processConfirmation().catch(err => {
      console.error('Post-confirm error:', err);
      setErrorMsg('Ocurrió un error inesperado al confirmar tu correo. Intenta de nuevo o contacta a soporte.');
      setStatus('error');
    });
  }, []);

  return (
    <div className="login-page">
      <div className="login-bg-gradient" />
      <div className="login-card relative z-10 text-center">
        {/* Logo */}
        <div className="mb-7">
          <img src={sozuLogo} alt="Sozu" className="h-10 mx-auto" />
        </div>

        {status === 'loading' && (
          <>
            <div
              className="mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full"
              style={{ background: 'hsl(210 80% 95%)' }}
            >
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'hsl(210 80% 45%)' }} />
            </div>
            <h1 className="text-2xl font-black text-[hsl(0_0%_5%)] mb-2" style={{ letterSpacing: '-0.02em' }}>
              Confirmando tu correo…
            </h1>
            <p className="text-sm mb-2" style={{ color: 'hsl(0 0% 45%)' }}>
              Estamos verificando tu cuenta. Esto tomará solo un momento.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            {/* Success icon */}
            <div
              className="mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full"
              style={{ background: 'hsl(145 35% 95%)' }}
            >
              <CheckCircle className="h-8 w-8" style={{ color: 'hsl(145 35% 51%)' }} />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black text-[hsl(0_0%_5%)] mb-2" style={{ letterSpacing: '-0.02em' }}>
              ¡Gracias por confirmar tu correo!
            </h1>

            <p className="text-sm mb-6" style={{ color: 'hsl(0 0% 45%)' }}>
              Tu cuenta ha sido verificada exitosamente.
            </p>

            {/* Info card */}
            <div
              className="flex items-start gap-3 px-5 py-4 rounded-xl text-left text-sm mb-7"
              style={{ background: 'hsl(210 80% 97%)', color: 'hsl(210 80% 30%)' }}
            >
              <Mail className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p>
                En breve recibirás un correo electrónico con tus <strong>credenciales de acceso</strong> al sistema.
                Revisa tu bandeja de entrada y la carpeta de spam.
              </p>
            </div>

            {/* CTA */}
            <a
              href={ctaUrl}
              className="login-btn-primary flex items-center justify-center gap-2 no-underline"
            >
              {ctaLabel}
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            {/* Error icon */}
            <div
              className="mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full"
              style={{ background: 'hsl(0 70% 95%)' }}
            >
              <AlertCircle className="h-8 w-8" style={{ color: 'hsl(0 70% 50%)' }} />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black text-[hsl(0_0%_5%)] mb-2" style={{ letterSpacing: '-0.02em' }}>
              No se pudo confirmar tu correo
            </h1>

            <p className="text-sm mb-7" style={{ color: 'hsl(0 0% 45%)' }}>
              {errorMsg}
            </p>

            {/* CTA */}
            <a
              href={loginUrl}
              className="login-btn-primary flex items-center justify-center gap-2 no-underline"
            >
              Ir a Iniciar Sesión
            </a>
          </>
        )}
      </div>
    </div>
  );
}
