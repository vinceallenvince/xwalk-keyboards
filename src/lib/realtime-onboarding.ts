import type { CalibrationStatus, LiveCalibration } from "@/lib/use-calibration";

/**
 * Onboarding sequence logic for the Realtime study.
 *
 * The sequence runs on every visit — there is no seen-flag. It covers the
 * startup wait with three steps: how the instrument is played, what condition
 * the crosswalk is in right now, and that the keyboard is warming up. The
 * final step has no dismissal control; it clears only when the app starts
 * receiving predictions, so the overlay never claims the instrument is ready
 * before it is.
 *
 * Query overrides exist so states can be reviewed without waiting for the
 * world to produce them: `?onboarding=off` skips the sequence entirely (the
 * e2e suite uses this to reach the study without clicking through), and
 * `?conditions=<level>` forces the conditions readout variant.
 */

export type OnboardingStep = "how-to-hear" | "conditions" | "warming-up";

export type ConditionsLevel = "good" | "fair" | "bad" | "unknown";

const CONDITIONS_LEVELS: readonly ConditionsLevel[] = ["good", "fair", "bad", "unknown"];

const LEVEL_BY_STATUS: Record<CalibrationStatus, ConditionsLevel> = {
  ok: "good",
  degraded: "fair",
  needs_review: "fair",
  no_crosswalk: "bad",
  feed_down: "bad",
};

/**
 * The conditions readout derives from the calibration agent's current status.
 * The baked-in reference calibration is not agent data — it carries `ok` as a
 * schema default, not an observation — so only a live payload may claim a
 * level; anything else is honestly unknown.
 */
export function conditionsLevel(
  calibration: Pick<LiveCalibration, "status" | "source">,
): ConditionsLevel {
  if (calibration.source !== "live") return "unknown";
  return LEVEL_BY_STATUS[calibration.status] ?? "unknown";
}

/**
 * The step that follows `step` when the visitor advances, or null when the
 * sequence is finished. Predictions already flowing make the warming-up step
 * a lie ("takes a few seconds" about something that already happened), so the
 * sequence skips straight to done.
 */
export function nextStep(
  step: OnboardingStep,
  predictionsReceived: boolean,
): OnboardingStep | null {
  if (step === "how-to-hear") return "conditions";
  if (step === "conditions") return predictionsReceived ? null : "warming-up";
  // The warming-up step has no advance control; predictions clear it.
  return null;
}

/** Whether `?onboarding=off` in the given query string skips the sequence. */
export function isOnboardingDisabled(search: string): boolean {
  try {
    return new URLSearchParams(search).get("onboarding") === "off";
  } catch {
    return false;
  }
}

/**
 * The conditions level forced by `?conditions=<level>`, or null when absent or
 * unrecognized. Lets each readout variant be reviewed on demand.
 */
export function forcedConditionsLevel(search: string): ConditionsLevel | null {
  try {
    const value = new URLSearchParams(search).get("conditions");
    return CONDITIONS_LEVELS.find((level) => level === value) ?? null;
  } catch {
    return null;
  }
}
