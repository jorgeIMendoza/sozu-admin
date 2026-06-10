import type { Expediente } from "@/lib/offers/formal-reservation-data";

interface ProgressInfo {
  percent: number;
  completedSections: number;
  totalSections: number;
  nextPendingSection: keyof Expediente | null;
}

const SECTIONS: (keyof Expediente)[] = [
  "identidadFiscal",
  "datosPersonales",
  "planPagos",
  "documentos",
  "contratoPreliminar",
  "firma",
];

export const useExpedienteProgress = (expediente: Expediente | null | undefined): ProgressInfo => {
  if (!expediente) {
    return { percent: 0, completedSections: 0, totalSections: SECTIONS.length, nextPendingSection: null };
  }
  const completed = SECTIONS.filter((s) => expediente[s].status === "completed").length;
  const percent = Math.round((completed / SECTIONS.length) * 100);
  const nextPending =
    SECTIONS.find(
      (s) => expediente[s].status === "pending" || expediente[s].status === "in_progress",
    ) ?? null;
  return {
    percent,
    completedSections: completed,
    totalSections: SECTIONS.length,
    nextPendingSection: nextPending,
  };
};
