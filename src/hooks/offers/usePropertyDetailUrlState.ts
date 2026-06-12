import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

export type DetailView = "main" | "technical" | "payment-instructions";
export type ActiveSheet = "payments" | null;
export type ActiveFlow = "resale" | null;
export type ResaleStepUrl =
  | "intro"
  | "pricing"
  | "earnings"
  | "contract"
  | "signature"
  | "success";
export type ResaleScenarioUrl = "conservador" | "sugerido" | "agresivo";

export interface PropertyDetailUrlState {
  view: DetailView;
  stage: string | null;
  sheet: ActiveSheet;
  flow: ActiveFlow;
  step: ResaleStepUrl | null;
  scenario: ResaleScenarioUrl | null;
}

const VALID_VIEWS: DetailView[] = ["main", "technical", "payment-instructions"];
const VALID_SHEETS = ["payments"] as const;
const VALID_FLOWS = ["resale"] as const;
const VALID_STEPS: ResaleStepUrl[] = [
  "intro",
  "pricing",
  "earnings",
  "contract",
  "signature",
  "success",
];
const VALID_SCENARIOS: ResaleScenarioUrl[] = [
  "conservador",
  "sugerido",
  "agresivo",
];

function parseEnum<T extends string>(
  raw: string | null,
  valid: readonly T[]
): T | null {
  if (!raw) return null;
  return (valid as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function usePropertyDetailUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const state: PropertyDetailUrlState = {
    view:
      (parseEnum(searchParams.get("view"), VALID_VIEWS) ?? "main") as DetailView,
    stage: searchParams.get("stage"),
    sheet: parseEnum(searchParams.get("sheet"), VALID_SHEETS) as ActiveSheet,
    flow: parseEnum(searchParams.get("flow"), VALID_FLOWS) as ActiveFlow,
    step: parseEnum(searchParams.get("step"), VALID_STEPS),
    scenario: parseEnum(searchParams.get("scenario"), VALID_SCENARIOS),
  };

  const set = useCallback(
    (
      updates: Partial<PropertyDetailUrlState>,
      options: { replace?: boolean } = {}
    ) => {
      const next = new URLSearchParams(searchParams);

      if (updates.sheet !== undefined && updates.sheet !== null) {
        next.delete("stage");
        next.delete("flow");
        next.delete("step");
        next.delete("scenario");
      }
      if (updates.stage !== undefined && updates.stage !== null) {
        next.delete("sheet");
        next.delete("flow");
        next.delete("step");
        next.delete("scenario");
      }
      if (updates.flow !== undefined && updates.flow !== null) {
        next.delete("sheet");
        next.delete("stage");
      }
      if (updates.view !== undefined && updates.view !== "main") {
        next.delete("sheet");
        next.delete("stage");
        next.delete("flow");
        next.delete("step");
        next.delete("scenario");
      }

      for (const [key, value] of Object.entries(updates)) {
        if (
          value === null ||
          value === undefined ||
          value === "main" ||
          value === ""
        ) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }

      setSearchParams(next, { replace: options.replace ?? false });
    },
    [searchParams, setSearchParams]
  );

  const clearAll = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return { ...state, set, clearAll };
}
