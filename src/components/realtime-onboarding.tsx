"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  conditionsLevel,
  forcedConditionsLevel,
  isOnboardingDisabled,
  nextStep,
  warmingUpCopy,
  type OnboardingStep,
} from "@/lib/realtime-onboarding";
import type { LiveCalibration } from "@/lib/use-calibration";

/**
 * Onboarding for the Realtime study.
 *
 * The study is silent and still until a pedestrian steps onto the crosswalk,
 * and the keyboard takes up to a minute to warm up. Without a word of
 * explanation both read as a broken page, so a three-step sequence runs on
 * every visit: how the instrument is played, what condition the crosswalk is
 * in right now, and that the keyboard is warming up. The final step has no
 * dismissal control — it clears only when the app starts receiving
 * predictions, so the overlay never claims the instrument is ready before it
 * is. Predictions already flowing when the visitor advances past the
 * conditions step skip the warming-up step entirely.
 *
 * The header info icon appears only after predictions have been received and
 * replays the how-to-hear step alone, with CLOSE in place of NEXT — the other
 * steps describe a startup that has already passed.
 *
 * The overlay is purely informational and never touches the sound state.
 * Audio is enabled automatically once inference goes active (see
 * `RealtimeCamera`); the visitor's clicks through the sequence satisfy the
 * browser's gesture requirement on their own.
 *
 * State lives in a provider because its two halves sit in different parts of
 * the tree: the trigger is an icon in the site header, and the overlay itself
 * renders inside the camera viewport so it is positioned against the video
 * and survives fullscreen.
 */

const TITLE_ID = "realtime-onboarding-title";

type OnboardingValue = {
  /** The sequence step currently showing, or null once it has finished. */
  step: OnboardingStep | null;
  /** True while the header icon's how-to-hear replay is open. */
  infoOpen: boolean;
  /** True while the five-minute pause modal owns the viewport. */
  blocked: boolean;
  /** True once the app has received its first prediction data. */
  predictionsReceived: boolean;
  advance: () => void;
  openInfo: () => void;
  closeInfo: () => void;
  setBlocked: (blocked: boolean) => void;
  reportPredictions: () => void;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error("Realtime onboarding components require RealtimeOnboardingProvider");
  return value;
}

/**
 * The `?onboarding=off` override lives in the URL, which does not exist during
 * the prerender. Reading it through `useSyncExternalStore` keeps the server
 * and the hydration pass agreeing on "enabled" and lets the real answer arrive
 * immediately after hydration — without a state write in an effect, which
 * would cascade an extra render. Nothing mutates the query mid-session, so the
 * subscribe callback has nothing to listen to.
 */
const subscribeToNothing = () => () => {};
const enabledOnServer = () => false;

export function RealtimeOnboardingProvider({ children }: { children: ReactNode }) {
  const disabled = useSyncExternalStore(
    subscribeToNothing,
    () => isOnboardingDisabled(window.location.search),
    enabledOnServer,
  );
  const [stepState, setStepState] = useState<OnboardingStep | null>("how-to-hear");
  const [infoOpen, setInfoOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [predictionsReceived, setPredictionsReceived] = useState(false);

  const step = disabled ? null : stepState;

  const advance = useCallback(() => {
    setStepState((current) => (current ? nextStep(current, predictionsReceived) : null));
  }, [predictionsReceived]);

  const openInfo = useCallback(() => setInfoOpen(true), []);
  const closeInfo = useCallback(() => setInfoOpen(false), []);

  // Called on every prediction frame; the first call flips the flag, and any
  // call dismisses the warming-up step. Both writes bail out once settled, so
  // the per-frame cost after that is nothing.
  const reportPredictions = useCallback(() => {
    setPredictionsReceived(true);
    setStepState((current) => (current === "warming-up" ? null : current));
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        step,
        infoOpen,
        blocked,
        predictionsReceived,
        advance,
        openInfo,
        closeInfo,
        setBlocked,
        reportPredictions,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

/**
 * Lets the camera report that the pause modal has taken the viewport. Callers
 * flip this in the same handlers that show and hide the pause modal, rather
 * than syncing it from an effect.
 */
export function useSetOnboardingBlocked() {
  return useOnboarding().setBlocked;
}

/** Lets the camera report that prediction data is arriving. */
export function useReportPredictions() {
  return useOnboarding().reportPredictions;
}

/**
 * The header info icon that replays the how-to-hear step. It exists only after
 * predictions have been received — before that the sequence itself owns the
 * explanation — and never while the pause modal owns the viewport.
 */
export function RealtimeOnboardingInfoButton() {
  const { infoOpen, blocked, predictionsReceived, openInfo } = useOnboarding();
  if (blocked || !predictionsReceived) return null;
  return (
    <>
      <b aria-hidden="true" className="realtime-onboarding-sep">|</b>
      <button
        type="button"
        className="realtime-onboarding-button"
        onClick={openInfo}
        aria-haspopup="dialog"
        aria-expanded={infoOpen}
        aria-label="How to hear XWALK KEYBOARDS"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8" cy="4.6" r="0.85" fill="currentColor" />
          <path d="M8 7.1v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}

function HowToHearContent() {
  return (
    <>
      <p id={TITLE_ID} className="realtime-onboarding__title">
        HOW TO HEAR XWALK KEYBOARDS
      </p>
      <p className="realtime-onboarding__body">
        Each white stripe is a key.
        <br />
        Pedestrians play them as they cross.
      </p>
      <p className="realtime-onboarding__body">
        It takes a few seconds for the keyboard to warm up.
        <br />
        Then wait for someone to cross.
      </p>
    </>
  );
}

function ConditionsContent({ calibration }: { calibration: LiveCalibration }) {
  // `?conditions=<level>` forces a variant for review; it is read once, after
  // hydration — this step is never part of the server render, so the lazy
  // initializer cannot disagree with it.
  const [forced] = useState(() =>
    typeof window === "undefined" ? null : forcedConditionsLevel(window.location.search),
  );
  const level = forced ?? conditionsLevel(calibration);
  return (
    <>
      <p id={TITLE_ID} className="realtime-onboarding__title">
        XWALK KEYBOARDS BEST CONDITIONS
      </p>
      <p className="realtime-onboarding__body">
        Keyboard detection works best when the camera has
        a clear view of the crosswalk.
      </p>
      {/* No reading is reported rather than a made-up one: the readout line
          only renders when the calibration agent has actually spoken. */}
      {level !== "unknown" && (
        <p className="realtime-onboarding__body">
          Your keyboard conditions:{" "}
          <b className={`realtime-onboarding__value realtime-onboarding__value--${level}`}>
            {level.toUpperCase()}
          </b>
        </p>
      )}
      {level !== "good" && (
        <p className="realtime-onboarding__body">
          Bad weather, shadows or obstructions may affect
          your keyboard&apos;s performance.
        </p>
      )}
    </>
  );
}

function WarmingUpContent({ keyboardReady }: { keyboardReady: boolean }) {
  const copy = warmingUpCopy(keyboardReady);
  return (
    <>
      <p id={TITLE_ID} className="realtime-onboarding__title">
        {copy.title}
      </p>
      {copy.paragraphs.map((lines) => (
        <p key={lines[0]} className="realtime-onboarding__body">
          {lines.map((line, index) => (
            <span key={line}>
              {index > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

export function RealtimeOnboardingOverlay({
  calibration,
  keyboardReady,
}: {
  calibration: LiveCalibration;
  /** True once the GPU session is active — the status bar reads "KEYBOARD
   * READY!", so the warming-up step must stop claiming it is warming up. */
  keyboardReady: boolean;
}) {
  const { step, infoOpen, blocked, advance, closeInfo } = useOnboarding();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  // The pause modal owns the viewport alone; the info replay owns it over any
  // remaining sequence step.
  const mode: "info" | OnboardingStep | null = blocked ? null : infoOpen ? "info" : step;
  const showingInfo = mode === "info";
  const showing = mode !== null;

  // Focus moves to the panel itself rather than to the button: focusing the
  // button would draw its focus ring the instant a step appears, which reads
  // as a stray highlight before the visitor has done anything. The panel is
  // `tabIndex={-1}`, so focus stays inside the dialog — the tab trap still
  // works, and Tab from here lands on the button on demand. When the info
  // replay closes, focus returns to the header icon that opened it.
  useEffect(() => {
    if (!showing) return;
    openerRef.current = document.activeElement;
    panelRef.current?.focus();
    if (!showingInfo) return;
    const opener = openerRef.current;
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [showing, showingInfo, mode]);

  // Escape dismisses only the info replay — the sequence has no skip, and its
  // last step clears on real predictions. Tab cycles within the panel so focus
  // cannot wander onto the page behind the scrim.
  useEffect(() => {
    if (!showing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showingInfo) {
        event.preventDefault();
        closeInfo();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeInfo, showing, showingInfo]);

  if (!showing) return null;

  return (
    <>
      {/* The scrim dismisses only the info replay; the sequence keeps the
          viewport until it is done explaining. */}
      <div className="realtime-onboarding-scrim" onClick={showingInfo ? closeInfo : undefined} />
      <div
        ref={panelRef}
        className="realtime-onboarding-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
      >
        {(mode === "info" || mode === "how-to-hear") && <HowToHearContent />}
        {mode === "conditions" && <ConditionsContent calibration={calibration} />}
        {mode === "warming-up" && <WarmingUpContent keyboardReady={keyboardReady} />}
        {mode === "info" ? (
          <button type="button" className="realtime-onboarding__btn" onClick={closeInfo}>
            CLOSE
          </button>
        ) : mode !== "warming-up" ? (
          <button type="button" className="realtime-onboarding__btn" onClick={advance}>
            NEXT
          </button>
        ) : null}
      </div>
    </>
  );
}
