import { useEffect } from "react";
import { useFormalReservationStore } from "./formal-reservation-data";

const TICK_INTERVAL_MS = 30_000; // SWAP POINT: 30s en demo; en prod webhooks reales

/**
 * Cron mock cliente — F.3.B.
 * Dispatch automático de notificaciones pending cuyo scheduledAt llegó +
 * detección de holds expirados marcándolos como provisional_expirado.
 */
export const useBackgroundTasks = () => {
  const reservations = useFormalReservationStore((s) => s.reservations);
  const markNotificationAsSent = useFormalReservationStore((s) => s.markNotificationAsSent);
  const markAsExpired = useFormalReservationStore((s) => s.markAsExpired);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      reservations.forEach((r) => {
        if (r.status !== "apartado_provisional") return;
        if (!r.hold) return;

        (r.notifications ?? []).forEach((n) => {
          if (n.status !== "pending") return;
          if (new Date(n.scheduledAt) <= now) {
            markNotificationAsSent(r.id, n.id);
          }
        });

        if (new Date(r.hold.expiresAt) <= now) {
          markAsExpired(r.id);
        }
      });
    };

    tick();
    const interval = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reservations, markNotificationAsSent, markAsExpired]);
};
