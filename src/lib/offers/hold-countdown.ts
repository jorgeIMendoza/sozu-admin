export type CountdownUrgency = "calm" | "warning" | "critical" | "expired";

export interface CountdownInfo {
  days: number;
  hours: number;
  minutes: number;
  totalHoursRemaining: number;
  urgency: CountdownUrgency;
  isExpired: boolean;
}

/**
 * Calcula tiempo restante hasta una fecha de expiración con nivel de urgencia.
 * Pensado para llamarse desde un componente con re-render periódico (cada minuto).
 */
export const calculateCountdown = (expiresAt: string): CountdownInfo => {
  const now = new Date();
  const expires = new Date(expiresAt);
  const ms = expires.getTime() - now.getTime();

  if (ms <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      totalHoursRemaining: 0,
      urgency: "expired",
      isExpired: true,
    };
  }

  const totalHoursRemaining = ms / (1000 * 60 * 60);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  let urgency: CountdownUrgency = "calm";
  if (totalHoursRemaining < 24) urgency = "critical";
  else if (totalHoursRemaining < 48) urgency = "warning";

  return { days, hours, minutes, totalHoursRemaining, urgency, isExpired: false };
};
