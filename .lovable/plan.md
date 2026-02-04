
# Plan: Auto-Validacion de Version en Login + Auto-Logout por Inactividad

## Objetivo
1. Validar automaticamente si el usuario tiene la ultima version al hacer login - si no, limpiar cache antes de continuar
2. Implementar auto-logout despues de 5 minutos de inactividad para forzar re-login

## Beneficios
- El usuario siempre tendra la ultima version al iniciar sesion
- No requiere un boton manual - es automatico
- La inactividad fuerza re-login, lo cual dispara la validacion de version
- Mejor seguridad al cerrar sesiones inactivas

---

## Seccion Tecnica

### Componente 1: Generacion de version.json en Build

**Archivo: `vite.config.ts`**

Agregar un plugin personalizado de Vite que genere `dist/version.json` con cada build:

```typescript
import { writeFileSync, mkdirSync } from 'fs';

// Dentro de plugins[]
{
  name: 'version-generator',
  closeBundle() {
    const versionString = `v2.4.0-${buildDate}.${buildTime}`;
    const versionData = {
      version: versionString,
      buildTime: Date.now()
    };
    try {
      mkdirSync('dist', { recursive: true });
      writeFileSync('dist/version.json', JSON.stringify(versionData));
    } catch (e) {
      console.log('Version file already exists or cannot write');
    }
  }
}
```

---

### Componente 2: Utilidades de Version y Cache

**Archivo: `src/utils/versionUtils.ts`** (nuevo)

```typescript
import { APP_VERSION } from '@/lib/config';

// Obtener version del servidor (sin cache)
export async function fetchServerVersion(): Promise<string | null> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.version;
  } catch {
    return null;
  }
}

// Limpiar Service Workers y caches
export async function clearCacheAndReload(): Promise<void> {
  // 1. Desregistrar Service Workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
    }
  }
  
  // 2. Limpiar todos los caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      await caches.delete(name);
    }
  }
  
  // 3. Forzar recarga completa
  window.location.reload();
}

// Verificar si hay nueva version disponible
export async function checkForUpdates(): Promise<boolean> {
  const serverVersion = await fetchServerVersion();
  if (!serverVersion) return false;
  return serverVersion !== APP_VERSION;
}
```

---

### Componente 3: Validacion de Version en Login

**Archivo: `src/pages/auth/Login.tsx`**

Modificar el flujo de login para verificar version antes de redirigir:

```typescript
import { checkForUpdates, clearCacheAndReload } from '@/utils/versionUtils';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setIsLoading(true);

  try {
    // ... validacion de input existente ...

    // NUEVO: Verificar version antes del login
    const hasUpdate = await checkForUpdates();
    if (hasUpdate) {
      setError(null);
      // Mostrar mensaje de actualizacion
      setIsUpdating(true);
      await clearCacheAndReload();
      return; // La pagina se recargara
    }

    const { error } = await signIn(email, password);
    // ... resto del codigo existente ...
  } catch (err) {
    // ...
  }
};
```

Agregar estado y UI para mostrar cuando se esta actualizando:

```typescript
const [isUpdating, setIsUpdating] = useState(false);

// En el JSX, mostrar mensaje cuando se actualiza
{isUpdating && (
  <Alert>
    <RefreshCw className="h-4 w-4 animate-spin" />
    <AlertDescription>
      Actualizando a la ultima version...
    </AlertDescription>
  </Alert>
)}
```

---

### Componente 4: Auto-Logout por Inactividad

**Archivo: `src/hooks/useInactivityTimeout.ts`** (nuevo)

```typescript
import { useEffect, useRef, useCallback } from 'react';

interface UseInactivityTimeoutOptions {
  timeoutMs: number; // Tiempo de inactividad en ms
  onTimeout: () => void; // Callback al expirar
  enabled?: boolean;
}

export function useInactivityTimeout({
  timeoutMs,
  onTimeout,
  enabled = true
}: UseInactivityTimeoutOptions) {
  const timeoutRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    
    if (enabled) {
      timeoutRef.current = window.setTimeout(() => {
        onTimeout();
      }, timeoutMs);
    }
  }, [timeoutMs, onTimeout, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Eventos que indican actividad
    const events = [
      'mousedown', 'mousemove', 'keydown', 
      'scroll', 'touchstart', 'click'
    ];

    const handleActivity = () => resetTimer();

    // Agregar listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Iniciar timer
    resetTimer();

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer]);

  return { resetTimer };
}
```

---

### Componente 5: Integrar Inactividad en AuthProvider

**Archivo: `src/contexts/AuthContext.tsx`**

Agregar el hook de inactividad dentro del provider:

```typescript
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ... estados existentes ...

  const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos

  // Hook de inactividad - solo activo cuando hay usuario logueado
  useInactivityTimeout({
    timeoutMs: INACTIVITY_TIMEOUT,
    onTimeout: async () => {
      console.log('Sesion expirada por inactividad');
      await signOut();
      // Redirigir a login con mensaje
      window.location.href = '/auth/login?reason=inactivity';
    },
    enabled: !!user && !isLoading
  });

  // ... resto del codigo existente ...
}
```

---

### Componente 6: Mostrar Mensaje de Inactividad en Login

**Archivo: `src/pages/auth/Login.tsx`**

Detectar el parametro de URL y mostrar mensaje:

```typescript
const [searchParams] = useSearchParams();
const inactivityLogout = searchParams.get('reason') === 'inactivity';

// En el JSX
{inactivityLogout && (
  <Alert className="border-amber-200 bg-amber-50">
    <Clock className="h-4 w-4 text-amber-600" />
    <AlertDescription className="text-amber-700">
      Tu sesion expiro por inactividad. Por favor inicia sesion nuevamente.
    </AlertDescription>
  </Alert>
)}
```

---

## Archivos a Crear/Modificar

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `vite.config.ts` | Modificar | Plugin para generar version.json |
| `src/utils/versionUtils.ts` | Crear | Funciones de verificacion de version y limpieza de cache |
| `src/hooks/useInactivityTimeout.ts` | Crear | Hook para detectar inactividad |
| `src/pages/auth/Login.tsx` | Modificar | Verificar version al login + mensaje de inactividad |
| `src/contexts/AuthContext.tsx` | Modificar | Integrar auto-logout por inactividad |

---

## Flujo de Usuario

```
Usuario abre la app
       |
       v
+------------------+
| Esta logueado?   |
+------------------+
       |
  +----+----+
  |         |
 SI        NO
  |         |
  v         v
[Usa app]  [Login page]
  |              |
  v              v
5 min      [Ingresa credenciales]
inactivo         |
  |              v
  v         [Verifica version]
[Logout]         |
  |         +----+----+
  v         |         |
[Login]   Nueva    Misma
  |       version  version
  |         |         |
  |         v         v
  |    [Limpiar   [Login normal]
  |     cache]
  |         |
  |         v
  +---->[Recargar pagina]
```

---

## Configuracion del Timeout

El timeout de inactividad se puede configurar facilmente cambiando la constante:

```typescript
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos (300,000 ms)
```

Si en el futuro se quiere hacer configurable por usuario/rol, se podria leer de la base de datos.
