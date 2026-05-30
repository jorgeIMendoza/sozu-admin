import { create } from "zustand";

// ── Tipos ──

export interface PreClientSession {
  prospectId: string;
  email: string;
  fullName: string;
  createdAt: string;
  expiresAt: string;
}

export interface MagicLinkRequest {
  id: string;
  email: string;
  token: string;
  prospectId: string;
  reservationId: string;
  agentId: string;
  createdAt: string;
  consumedAt?: string;
  expiresAt: string;
}

// ── Storage helpers (mock con localStorage) ──

const SESSION_KEY = "sozu_preclient_session";

function loadSessionFromStorage(): PreClientSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreClientSession;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSessionToStorage(session: PreClientSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // SWAP POINT: en producción usar cookies HttpOnly Secure SameSite=Strict
  }
}

function clearSessionFromStorage(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // no-op
  }
}

function generateToken(): string {
  // Token mock de 32 caracteres. En producción: JWT firmado.
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// ── Store ──

interface AuthState {
  session: PreClientSession | null;
  magicLinkRequests: MagicLinkRequest[];

  // Auto-login al completar pre-apartado (sin requerir magic link la primera vez)
  createSessionForProspect: (input: {
    prospectId: string;
    email: string;
    fullName: string;
  }) => PreClientSession;

  // Pedir magic link (mock — registra el request y "envía" el email visual)
  requestMagicLink: (input: {
    email: string;
    prospectId: string;
    reservationId: string;
    agentId: string;
  }) => MagicLinkRequest;

  // Verificar token desde la magic link
  verifyToken: (token: string) => { success: boolean; session?: PreClientSession; error?: string };

  // Cerrar sesión
  logout: () => void;

  // Recuperar el request mock por token (para preview del email)
  getMagicLinkByToken: (token: string) => MagicLinkRequest | undefined;
  getLatestMagicLinkForEmail: (email: string) => MagicLinkRequest | undefined;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: loadSessionFromStorage(),
  magicLinkRequests: [],

  createSessionForProspect: (input) => {
    const now = new Date();
    const expires = new Date(now);
    expires.setHours(expires.getHours() + 24);

    const session: PreClientSession = {
      prospectId: input.prospectId,
      email: input.email,
      fullName: input.fullName,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };

    saveSessionToStorage(session);
    set({ session });
    return session;
  },

  requestMagicLink: (input) => {
    const now = new Date();
    const expires = new Date(now);
    expires.setMinutes(expires.getMinutes() + 30);

    const request: MagicLinkRequest = {
      id: `ML-${Date.now().toString(36).toUpperCase()}`,
      email: input.email.toLowerCase().trim(),
      token: generateToken(),
      prospectId: input.prospectId,
      reservationId: input.reservationId,
      agentId: input.agentId,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };

    set((s) => ({ magicLinkRequests: [...s.magicLinkRequests, request] }));
    return request;
  },

  verifyToken: (token) => {
    const request = get().magicLinkRequests.find((r) => r.token === token);
    if (!request) {
      return { success: false, error: "Link inválido o no encontrado." };
    }
    if (request.consumedAt) {
      return { success: false, error: "Este link ya fue usado. Por favor solicita uno nuevo." };
    }
    if (new Date(request.expiresAt).getTime() < Date.now()) {
      return { success: false, error: "Este link expiró. Por favor solicita uno nuevo." };
    }

    // SWAP POINT: en producción, llamada al backend que verifica el JWT firmado.
    // El backend retorna sesión + datos del prospecto.

    // Mock: marcar consumido y crear sesión
    set((s) => ({
      magicLinkRequests: s.magicLinkRequests.map((r) =>
        r.id === request.id ? { ...r, consumedAt: new Date().toISOString() } : r
      ),
    }));

    // Necesitamos el fullName del prospect — viene del offer-data store
    // Para no acoplar stores aquí, el caller (VerifyTokenPage) hace el lookup
    // y llama createSessionForProspect manualmente con los datos completos.
    return { success: true };
  },

  logout: () => {
    clearSessionFromStorage();
    set({ session: null });
  },

  getMagicLinkByToken: (token) => {
    return get().magicLinkRequests.find((r) => r.token === token);
  },

  getLatestMagicLinkForEmail: (email) => {
    const normalized = email.toLowerCase().trim();
    const requests = get().magicLinkRequests.filter((r) => r.email === normalized);
    return requests.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  },
}));

// ── Helpers ──

export function isSessionValid(session: PreClientSession | null): boolean {
  if (!session) return false;
  return new Date(session.expiresAt).getTime() > Date.now();
}

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => isSessionValid(s.session));
}

export function useCurrentSession(): PreClientSession | null {
  return useAuthStore((s) => (isSessionValid(s.session) ? s.session : null));
}

// SWAP POINT: en producción reemplazar todo el bloque de storage local por:
// - POST /api/auth/request-link → backend envía email vía SendGrid/Mailgun
// - GET /api/auth/verify?token=... → backend valida JWT y emite cookie de sesión
// - Cookies HttpOnly Secure SameSite=Strict para sesión real
// - Refresh token automático antes de expirar
