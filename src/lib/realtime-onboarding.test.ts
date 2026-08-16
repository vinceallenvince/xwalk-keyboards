import { describe, expect, it } from "vitest";

import {
  conditionsLevel,
  forcedConditionsLevel,
  isOnboardingDisabled,
  nextStep,
  warmingUpCopy,
} from "./realtime-onboarding";

describe("conditionsLevel", () => {
  it("maps each live agent status to its readout level", () => {
    expect(conditionsLevel({ status: "ok", source: "live" })).toBe("good");
    expect(conditionsLevel({ status: "degraded", source: "live" })).toBe("fair");
    expect(conditionsLevel({ status: "needs_review", source: "live" })).toBe("fair");
    expect(conditionsLevel({ status: "no_crosswalk", source: "live" })).toBe("bad");
    expect(conditionsLevel({ status: "feed_down", source: "live" })).toBe("bad");
  });

  // The reference calibration reports `ok` as a schema default, not an
  // observation — it must never present as a GOOD reading.
  it("treats the reference calibration as unknown regardless of status", () => {
    expect(conditionsLevel({ status: "ok", source: "reference" })).toBe("unknown");
    expect(conditionsLevel({ status: "feed_down", source: "reference" })).toBe("unknown");
  });
});

describe("nextStep", () => {
  it("advances how-to-hear to conditions to warming-up", () => {
    expect(nextStep("how-to-hear", false)).toBe("conditions");
    expect(nextStep("conditions", false)).toBe("warming-up");
  });

  // "The keyboard takes a few seconds to warm up" is a lie once predictions
  // are already flowing, so the sequence skips straight to done.
  it("skips warming-up when predictions are already arriving", () => {
    expect(nextStep("conditions", true)).toBeNull();
  });

  it("has no advance out of warming-up — predictions clear it", () => {
    expect(nextStep("warming-up", false)).toBeNull();
    expect(nextStep("warming-up", true)).toBeNull();
  });
});

describe("warmingUpCopy", () => {
  it("reads as warming up while the GPU session is still starting", () => {
    const copy = warmingUpCopy(false);
    expect(copy.title).toBe("WARMING UP ...");
    expect(copy.paragraphs.flat().join(" ")).toContain("take a few seconds to a minute");
    expect(copy.paragraphs.flat().join(" ")).toContain("speakers are on!");
  });

  // Once the session is active the status bar says "KEYBOARD READY!" — the
  // overlay must stop claiming it is warming up and reframe the wait for the
  // first predictions as fine tuning.
  it("reads as warmed and ready once the GPU session is active", () => {
    const copy = warmingUpCopy(true);
    expect(copy.title).toBe("KEYBOARD WARMED AND READY!");
    expect(copy.paragraphs.flat().join(" ")).toContain("fine tuning");
    expect(copy.paragraphs.flat().join(" ")).not.toContain("warm up");
  });
});

describe("query overrides", () => {
  it("skips the sequence only for ?onboarding=off", () => {
    expect(isOnboardingDisabled("?onboarding=off")).toBe(true);
    expect(isOnboardingDisabled("?onboarding=on")).toBe(false);
    expect(isOnboardingDisabled("?onboarding")).toBe(false);
    expect(isOnboardingDisabled("")).toBe(false);
  });

  it("forces only recognized conditions levels", () => {
    expect(forcedConditionsLevel("?conditions=good")).toBe("good");
    expect(forcedConditionsLevel("?conditions=fair")).toBe("fair");
    expect(forcedConditionsLevel("?conditions=bad")).toBe("bad");
    expect(forcedConditionsLevel("?conditions=unknown")).toBe("unknown");
    expect(forcedConditionsLevel("?conditions=excellent")).toBeNull();
    expect(forcedConditionsLevel("")).toBeNull();
  });
});
