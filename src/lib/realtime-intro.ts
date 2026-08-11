/**
 * First-visit gating for the Realtime instructions.
 *
 * The modal shows once per visitor, tracked by a persisted flag. Every access
 * is client-only and guarded, so prerendering (where `window` is absent) never
 * touches storage — callers must resolve this after mount rather than during
 * render, or the server and client markup disagree.
 *
 * `?intro` forces the modal open regardless of the stored flag, so the state
 * can be reviewed without clearing browser storage. The override changes only
 * whether the modal opens; dismissing it still records the flag.
 */

export const INTRO_SEEN_KEY = "xwalkKeyboards.realtimeIntroSeen";

/** Whether the visitor has already seen and dismissed the instructions. */
export function hasSeenIntro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === "true";
  } catch {
    // Private mode or storage disabled: treat as unseen and show once this load.
    return false;
  }
}

/** Record that the instructions have been seen. */
export function markIntroSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, "true");
  } catch {
    // Nothing to persist; the modal simply reappears on the next load.
  }
}

/** Whether `?intro` in the given query string forces the modal open. */
export function isIntroForced(search: string): boolean {
  try {
    return new URLSearchParams(search).has("intro");
  } catch {
    return false;
  }
}

/**
 * The full on-load decision. The modal opens when forced by the query override
 * or when this visitor has not seen it before.
 */
export function shouldOpenIntroOnLoad(search: string): boolean {
  return isIntroForced(search) || !hasSeenIntro();
}
