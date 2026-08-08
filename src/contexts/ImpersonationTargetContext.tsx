import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import type { ImpersonationTarget } from '@/lib/impersonation/types';

/**
 * Quién se está impersonando AHORA, sin que el núcleo tenga que conocer los 12
 * contextos de impersonación que existen (uno por portal).
 *
 * Cada portal sigue con su contexto propio (ahí vive su data específica) y solo
 * **publica** aquí el usuario que está viendo. Los consumidores globales
 * (`useAllowedMenus`, `useViewRestrictions`) leen de un solo lugar.
 *
 * Si ningún portal publica nada, el target es null y todo se resuelve con el
 * perfil logueado, exactamente como antes de existir este contexto.
 */

interface ImpersonationTargetContextType {
  target: ImpersonationTarget | null;
  setTarget: (target: ImpersonationTarget | null) => void;
}

const ImpersonationTargetContext = createContext<ImpersonationTargetContextType>({
  target: null,
  setTarget: () => {},
});

export function ImpersonationTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ImpersonationTarget | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return (
    <ImpersonationTargetContext.Provider value={value}>{children}</ImpersonationTargetContext.Provider>
  );
}

export function useImpersonationTarget(): ImpersonationTarget | null {
  return useContext(ImpersonationTargetContext).target;
}

/**
 * Publica el impersonado del portal montado. Se limpia al desmontar, para que
 * salir del portal no deje un target colgado afectando al resto de la app.
 *
 * Migrar un portal = llamar a esto con su target. Nada más.
 */
export function usePublishImpersonationTarget(target: ImpersonationTarget | null): void {
  const { setTarget } = useContext(ImpersonationTargetContext);

  // Se compara por valor: los portales arman el objeto en cada render y comparar
  // por referencia dispararía un set en bucle.
  const key = target ? `${target.email}|${target.personaId}|${target.rolId}|${target.rolNombre ?? ''}` : null;

  useEffect(() => {
    setTarget(target);
    return () => setTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setTarget]);
}
