import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle, Landmark, Eye, EyeOff } from 'lucide-react';
import sozuLogo from '@/assets/sozu-logo-black.png';

const DEST = '/admin/portal-escrituracion/app-notaria';

export default function AppNotariaLogin() {
  const { user, profile, isLoading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  // Tracks whether a sign-in was just submitted (prevents premature error on initial load)
  const awaitingProfileRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    // Case: not logged in
    if (!user) {
      if (awaitingProfileRef.current) {
        // signIn returned but onAuthStateChange didn't set user — shouldn't happen
        awaitingProfileRef.current = false;
        setLoading(false);
        setError('Error de sesión. Intenta de nuevo.');
      }
      return;
    }

    // Case: user set but profile still being fetched (null + awaitingProfile)
    // profile=null could be: (a) still loading, or (b) no usuarios record.
    // We use awaitingProfileRef + loading to distinguish:
    //   - initial load with no access: loading=false, awaitingProfile=false → show error immediately
    //   - post-login before profile arrives: loading=true, awaitingProfile=true → wait
    if (loading && awaitingProfileRef.current && profile === null) {
      // Profile fetch still in progress — useEffect will re-run when profile arrives
      return;
    }

    const isAdmin = (profile?.rol_id ?? 99) <= 2;

    if (isAdmin || profile?.id_notario) {
      navigate(DEST, { replace: true });
      return;
    }

    // User authenticated but no notary access
    awaitingProfileRef.current = false;
    setLoading(false);

    if (profile === null) {
      setError(
        'Tu usuario no tiene un perfil configurado en el sistema. ' +
        'Contacta al administrador SOZU.',
      );
    } else {
      setError(
        'Tu usuario no está vinculado a ninguna notaría. ' +
        'Solicita al administrador SOZU que te asigne una notaría.',
      );
    }
  }, [user, profile, authLoading, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError(null);
    setLoading(true);
    awaitingProfileRef.current = true;

    const { error: signInError } = await signIn(email.trim().toLowerCase(), password);

    if (signInError) {
      awaitingProfileRef.current = false;
      setError(
        signInError.message.includes('Invalid login credentials')
          ? 'Email o contraseña incorrectos. Verifica tus datos.'
          : signInError.message.includes('Email not confirmed')
          ? 'Debes confirmar tu email antes de ingresar.'
          : signInError.message,
      );
      setLoading(false);
    }
    // On success: loading stays true, awaitingProfileRef=true.
    // The useEffect above handles redirect once profile arrives.
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo + header */}
        <div className="flex flex-col items-center mb-8">
          <img src={sozuLogo} alt="SOZU" className="h-8 mb-6 object-contain" />
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Landmark className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 text-center">Acceso App Notaría</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            Ingresa para consultar tus unidades asignadas
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">

          {/* Waiting for profile after login */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-slate-500">Cargando perfil de notaría...</p>
            </div>
          )}

          {!loading && (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Correo electrónico</label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  placeholder="notario@ejemplo.com"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Contraseña</label>
                  <Link
                    to="/auth/forgot-password"
                    className="text-xs text-primary hover:underline"
                    tabIndex={-1}
                  >
                    ¿Olvidé mi contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!email.trim() || !password}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                Ingresar
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400">
          ¿Eres administrador SOZU?{' '}
          <Link to="/auth/login" className="text-primary hover:underline">
            Ir al login principal
          </Link>
        </p>
      </div>
    </div>
  );
}
