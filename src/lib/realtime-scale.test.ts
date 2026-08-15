import { describe, expect, it } from "vitest";

import { DEFAULT_LIVE_CAMERA } from "@/data/cameras";
import { REALTIME_CALIBRATION } from "./realtime-calibration";
import { midiForNote, noteForSlot, stripeKey } from "./realtime-scale";

const NOTE_PATTERN = /^([A-G])([#b]?)(-?\d+)$/;

// View 5056's anchors — the camera whose hand-authored scale the generator
// must reproduce exactly.
const ANCHORS = DEFAULT_LIVE_CAMERA.segmentAnchors;

const REFERENCE_LEFT = REALTIME_CALIBRATION.stripes.filter((s) => s.segment === "left");
const REFERENCE_RIGHT = REALTIME_CALIBRATION.stripes.filter((s) => s.segment === "right");

describe("noteForSlot", () => {
  it("reproduces the original hand-authored scale exactly", () => {
    // The whole point of the anchors: nothing that already made a sound
    // should start making a different one. The reference shares the agent's
    // 0-based per-segment indexes, so this is a direct identity.
    for (const stripe of [...REFERENCE_LEFT, ...REFERENCE_RIGHT]) {
      expect(noteForSlot(ANCHORS, stripe.segment, stripe.stripeIndex)).toBe(stripe.note);
    }
  });

  it("keeps climbing past the end of the old fixed scale", () => {
    // The bug: right slots 7-10 all clamped to C6, so one pedestrian lit five
    // stripes at once. They must now be distinct, ascending pitches.
    const overflow = [7, 8, 9, 10].map((i) => noteForSlot(ANCHORS, "right", i));

    expect(overflow).toEqual(["C#6", "D6", "Eb6", "E6"]);
    expect(new Set(overflow).size).toBe(4);
  });

  it("never repeats a pitch within a segment across any plausible crosswalk", () => {
    // 30 slots is nearly triple what either crosswalk currently reads, and
    // stays under the C8 ceiling from both anchors. Past that ceiling pitches
    // do repeat — see the clamp test — but the overlay keys on stripe
    // identity, so repeats no longer light the wrong bars.
    for (const segment of ["left", "right"] as const) {
      const notes = Array.from({ length: 30 }, (_, i) => noteForSlot(ANCHORS, segment, i));
      expect(new Set(notes).size).toBe(notes.length);
    }
  });

  it("ascends by exactly one semitone per slot", () => {
    const midis = Array.from({ length: 40 }, (_, i) => midiForNote(noteForSlot(ANCHORS, "left", i))!);
    for (let i = 1; i < midis.length; i += 1) {
      expect(midis[i] - midis[i - 1]).toBe(1);
    }
  });

  it("generates names the audio engine can parse", () => {
    // noteFrequency in realtime-inference falls back to 440Hz on a name it
    // cannot read, which would be silent breakage rather than a crash.
    for (let i = 0; i < 60; i += 1) {
      expect(noteForSlot(ANCHORS, "right", i)).toMatch(NOTE_PATTERN);
    }
  });

  it("clamps at the top of hearing rather than running away", () => {
    const absurd = noteForSlot(ANCHORS, "left", 5000);
    expect(absurd).toMatch(NOTE_PATTERN);
    expect(midiForNote(absurd)).toBe(108); // C8
  });

  it("treats negative and fractional indexes as the anchor slot", () => {
    expect(noteForSlot(ANCHORS, "left", -5)).toBe("C4");
    expect(noteForSlot(ANCHORS, "left", 0.5)).toBe("C4");
  });

  it("starts the right crosswalk where the left one originally ended", () => {
    const lastLeft = midiForNote(REFERENCE_LEFT[REFERENCE_LEFT.length - 1].note)!;
    expect(midiForNote(noteForSlot(ANCHORS, "right", 0))).toBe(lastLeft + 1);
  });

  it("voices an unknown segment from the camera's first anchor", () => {
    // A stripe whose segment has no anchor is normally dropped upstream; if
    // one slips through, defaulting to the first anchor beats crashing.
    expect(noteForSlot(ANCHORS, "segment3", 0)).toBe("C4");
    expect(noteForSlot([], "left", 0)).toBe("C4");
  });
});

describe("midiForNote", () => {
  it("reads sharps and flats", () => {
    expect(midiForNote("C4")).toBe(60);
    expect(midiForNote("A4")).toBe(69);
    expect(midiForNote("C#4")).toBe(61);
    expect(midiForNote("Db4")).toBe(61);
  });

  it("rejects things that are not notes", () => {
    expect(midiForNote("H4")).toBeNull();
    expect(midiForNote("")).toBeNull();
  });
});

describe("stripeKey", () => {
  it("distinguishes stripes that share a pitch across crosswalks", () => {
    // left:18 and right:0 both play F#5 once the left crosswalk reads that
    // long — the overlay must still tell them apart.
    expect(noteForSlot(ANCHORS, "left", 18)).toBe(noteForSlot(ANCHORS, "right", 0));
    expect(stripeKey("left", 18)).not.toBe(stripeKey("right", 0));
  });

  it("is stable for the same stripe", () => {
    expect(stripeKey("left", 3)).toBe(stripeKey("left", 3));
  });
});
