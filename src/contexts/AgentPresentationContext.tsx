import { createContext, useContext, useState, useCallback, ReactNode } from "react";

const STORAGE_KEY = "agent-presentation-mode";

/**
 * Modo presentación del portal de agentes.
 *
 * Cuando está activo, la información sensible (comisiones, montos, datos
 * personales de prospectos, métricas de ingresos) se oculta con una máscara.
 * El agente solo puede ver esos datos cuando DESACTIVA el modo.
 *
 * Arranca activo por defecto (privacidad primero); la elección del agente se
 * persiste en localStorage para las siguientes sesiones.
 */
interface AgentPresentationContextType {
  /** true = info sensible oculta */
  presentationMode: boolean;
  /** Activa / desactiva el modo */
  setPresentationMode: (v: boolean) => void;
  /** Alterna el modo */
  toggle: () => void;
  /** Devuelve el valor o su máscara según el modo */
  mask: (value: string) => string;
}

const MASK = "••••••";

const readInitial = (): boolean => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true; // default: oculto
  return stored === "true";
};

const AgentPresentationContext = createContext<AgentPresentationContextType>({
  presentationMode: true,
  setPresentationMode: () => {},
  toggle: () => {},
  mask: (v) => v,
});

export function AgentPresentationProvider({ children }: { children: ReactNode }) {
  const [presentationMode, setPresentationModeState] = useState<boolean>(readInitial);

  const setPresentationMode = useCallback((v: boolean) => {
    setPresentationModeState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setPresentationModeState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const mask = useCallback(
    (value: string) => (presentationMode ? MASK : value),
    [presentationMode]
  );

  return (
    <AgentPresentationContext.Provider value={{ presentationMode, setPresentationMode, toggle, mask }}>
      {children}
    </AgentPresentationContext.Provider>
  );
}

export function useAgentPresentation() {
  return useContext(AgentPresentationContext);
}
