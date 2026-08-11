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

import { markIntroSeen, shouldOpenIntroOnLoad } from "@/lib/realtime-intro";

/**
 * First-visit instructions for the Realtime study.
 *
 * The study is silent and still until a pedestrian steps onto the crosswalk,
 * and the keyboard takes a few seconds to warm up. Without a word of
 * explanation both read as a broken page, so a short modal sets those two
 * expectations on first visit and stays reachable from the header info icon
 * afterwards.
 *
 * The modal is purely informational and never touches the sound state. Audio is
 * enabled automatically once inference goes active (see `RealtimeCamera`),
 * which is the real dependency — the visitor's click-through to this route
 * already satisfied the browser's gesture requirement.
 *
 * State lives in a provider because its two halves sit in different parts of
 * the tree: the trigger is an icon in the site header, and the modal itself
 * renders inside the camera viewport so it is positioned against the video and
 * survives fullscreen.
 */

const TITLE_ID = "realtime-intro-title";

type IntroValue = {
  open: boolean;
  /** True while the five-minute pause modal owns the viewport. */
  blocked: boolean;
  openIntro: () => void;
  closeIntro: () => void;
  setBlocked: (blocked: boolean) => void;
};

const IntroContext = createContext<IntroValue | null>(null);

function useIntro(): IntroValue {
  const value = useContext(IntroContext);
  if (!value) throw new Error("Realtime intro components require RealtimeIntroProvider");
  return value;
}

/**
 * The seen-flag lives in `localStorage`, which does not exist during the
 * prerender. Reading it through `useSyncExternalStore` keeps the server and
 * the hydration pass agreeing on "closed" and lets the real answer arrive
 * immediately after hydration — without a state write in an effect, which
 * would cascade an extra render. Nothing external ever mutates the flag mid-
 * session, so the subscribe callback has nothing to listen to.
 */
const subscribeToNothing = () => () => {};
const introClosedOnServer = () => false;

export function RealtimeIntroProvider({ children }: { children: ReactNode }) {
  const openOnLoad = useSyncExternalStore(
    subscribeToNothing,
    () => shouldOpenIntroOnLoad(window.location.search),
    introClosedOnServer,
  );
  // Null until the visitor opens or closes it themselves, at which point their
  // action wins over the on-load decision.
  const [override, setOverride] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState(false);
  const open = override ?? openOnLoad;

  const openIntro = useCallback(() => setOverride(true), []);

  const closeIntro = useCallback(() => {
    setOverride(false);
    markIntroSeen();
  }, []);

  return (
    <IntroContext.Provider value={{ open, blocked, openIntro, closeIntro, setBlocked }}>
      {children}
    </IntroContext.Provider>
  );
}

/**
 * Lets the camera report that the pause modal has taken the viewport. Callers
 * flip this in the same handlers that show and hide the pause modal, rather
 * than syncing it from an effect.
 */
export function useSetIntroBlocked() {
  return useIntro().setBlocked;
}

/** The header info icon that reopens the instructions. */
export function RealtimeIntroButton() {
  const { open, blocked, openIntro } = useIntro();
  // The pause modal owns the viewport while it is up; nothing may be summoned
  // over it.
  if (blocked) return null;
  return (
    <>
      <b aria-hidden="true" className="realtime-intro-sep">|</b>
      <button
        type="button"
        className="realtime-intro-button"
        onClick={openIntro}
        aria-haspopup="dialog"
        aria-expanded={open}
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

export function RealtimeIntroModal() {
  const { open, blocked, closeIntro } = useIntro();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  const showing = open && !blocked;

  // Focus moves to the card itself rather than to CLOSE: focusing the button
  // would draw its focus ring the instant the modal appears, which reads as a
  // stray highlight before the visitor has done anything. The card is
  // `tabIndex={-1}`, so focus stays inside the dialog — Escape and the tab trap
  // still work, and Tab from here lands on CLOSE on demand. Focus returns to
  // whatever opened it, so the header icon gets it back.
  useEffect(() => {
    if (!showing) return;
    openerRef.current = document.activeElement;
    cardRef.current?.focus();
    const opener = openerRef.current;
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [showing]);

  // Escape dismisses; Tab cycles within the card so focus cannot wander onto
  // the page behind the scrim.
  useEffect(() => {
    if (!showing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeIntro();
        return;
      }
      if (event.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const focusable = card.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeIntro, showing]);

  if (!showing) return null;

  return (
    <>
      <div className="realtime-intro-scrim" onClick={closeIntro} />
      <div
        ref={cardRef}
        className="realtime-intro-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
      >
        <p id={TITLE_ID} className="realtime-intro-modal__title">
          HOW TO HEAR XWALK KEYBOARDS
        </p>
        <p className="realtime-intro-modal__body">
          Each white stripe is a key.
          <br />
          Pedestrians play them as they cross.
        </p>
        <p className="realtime-intro-modal__body">
          It takes a few seconds for the keyboard to warm up.
          <br />
          Then wait for someone to cross.
        </p>
        <button type="button" className="realtime-intro-modal__btn" onClick={closeIntro}>
          CLOSE
        </button>
      </div>
    </>
  );
}
