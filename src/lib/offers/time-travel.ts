import { create } from "zustand";

const STORAGE_KEY = "sozu_time_travel_offset_minutes";

interface TimeTravelState {
  offsetMinutes: number;       // 0 = tiempo real; positivo = adelantado
  setOffset: (minutes: number) => void;
  reset: () => void;
}

function loadOffset(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

function saveOffset(minutes: number): void {
  try {
    if (minutes === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(minutes));
    }
  } catch {
    // no-op
  }
}

export const useTimeTravelStore = create<TimeTravelState>((set) => ({
  offsetMinutes: loadOffset(),
  setOffset: (minutes) => {
    saveOffset(minutes);
    set({ offsetMinutes: minutes });
  },
  reset: () => {
    saveOffset(0);
    set({ offsetMinutes: 0 });
  },
}));

/**
 * Devuelve el "ahora" simulado.
 * En producción esto siempre sería Date.now() (sin offset).
 * En demo, suma el offset configurado para simular avance de días.
 */
export function getSimulatedNow(): Date {
  const offset = useTimeTravelStore.getState().offsetMinutes;
  return new Date(Date.now() + offset * 60 * 1000);
}

// SWAP POINT: en producción eliminar este archivo completo y todas sus referencias.
// El time-travel es exclusivamente para demos. En vivo, las notificaciones
// son disparadas por cron job en backend, no por el cliente.
