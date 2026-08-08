import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

/**
 * Modo de vista al impersonar a un usuario.
 *
 *   - `completa` (default): el portal se pinta con los permisos del ADMIN logueado.
 *     Es el modo de soporte: se ve todo y se puede corregir la información del
 *     usuario ahí mismo, sin cambiar de pantalla.
 *   - `fiel`: el portal se pinta con el rol y la condición (dependiente /
 *     independiente) del usuario IMPERSONADO. Sirve para comprobar qué ve él de
 *     verdad antes de decir "sí, ese menú ya está oculto".
 *
 * OJO, alcance real: esto solo cambia lo que RESUELVE EL FRONT (menús, tabs,
 * botones de edición). Las queries siguen viajando con el token del admin, así
 * que un recorte que viva únicamente en RLS no se reproduce aquí. Para eso, la
 * prueba fiel es entrar con la cuenta del usuario o simular sus claims en BD.
 *
 * El modo vive en `sessionStorage` para sobrevivir un F5 sin volverse pegajoso
 * entre sesiones distintas del navegador.
 */
export type ImpersonationViewMode = "completa" | "fiel";

const STORAGE_KEY = "sozu-impersonation-view-mode";

interface ImpersonationViewModeContextType {
  viewMode: ImpersonationViewMode;
  /** Atajo: ¿estamos en modo "ver como el usuario"? */
  isFiel: boolean;
  setViewMode: (mode: ImpersonationViewMode) => void;
  toggleViewMode: () => void;
}

const ImpersonationViewModeContext = createContext<ImpersonationViewModeContextType>({
  viewMode: "completa",
  isFiel: false,
  setViewMode: () => {},
  toggleViewMode: () => {},
});

function readStoredMode(): ImpersonationViewMode {
  if (typeof window === "undefined") return "completa";
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "fiel" ? "fiel" : "completa";
  } catch {
    return "completa";
  }
}

export function ImpersonationViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ImpersonationViewMode>(readStoredMode);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, viewMode);
    } catch {
      /* modo privado / storage lleno: el modo sigue vivo en memoria */
    }
  }, [viewMode]);

  const setViewMode = useCallback((mode: ImpersonationViewMode) => setViewModeState(mode), []);
  const toggleViewMode = useCallback(
    () => setViewModeState((prev) => (prev === "fiel" ? "completa" : "fiel")),
    []
  );

  return (
    <ImpersonationViewModeContext.Provider
      value={{ viewMode, isFiel: viewMode === "fiel", setViewMode, toggleViewMode }}
    >
      {children}
    </ImpersonationViewModeContext.Provider>
  );
}

export function useImpersonationViewMode() {
  return useContext(ImpersonationViewModeContext);
}
