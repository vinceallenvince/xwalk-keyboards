import { afterEach, describe, expect, it, vi } from "vitest";

import {
  hasSeenIntro,
  INTRO_SEEN_KEY,
  isIntroForced,
  markIntroSeen,
  shouldOpenIntroOnLoad,
} from "./realtime-intro";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("realtime intro gating", () => {
  it("shows on a first visit and stays hidden once dismissed", () => {
    expect(hasSeenIntro()).toBe(false);
    expect(shouldOpenIntroOnLoad("")).toBe(true);

    markIntroSeen();

    expect(window.localStorage.getItem(INTRO_SEEN_KEY)).toBe("true");
    expect(hasSeenIntro()).toBe(true);
    expect(shouldOpenIntroOnLoad("")).toBe(false);
  });

  it("treats any value other than the exact flag as unseen", () => {
    window.localStorage.setItem(INTRO_SEEN_KEY, "yes");
    expect(hasSeenIntro()).toBe(false);
  });

  it("forces the modal open with ?intro even after it has been seen", () => {
    markIntroSeen();

    expect(isIntroForced("?intro")).toBe(true);
    expect(isIntroForced("?intro=1")).toBe(true);
    expect(isIntroForced("?other=1")).toBe(false);
    expect(shouldOpenIntroOnLoad("?intro")).toBe(true);
  });

  // Private-mode Safari throws on both read and write. Neither may break the
  // page: an unreadable flag shows the modal once, an unwritable one is a no-op.
  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(hasSeenIntro()).toBe(false);
    expect(() => markIntroSeen()).not.toThrow();
    expect(shouldOpenIntroOnLoad("")).toBe(true);
  });
});
