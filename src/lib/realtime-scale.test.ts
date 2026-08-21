import { describe, expect, it } from "vitest";

import { DEFAULT_LIVE_CAMERA } from "@/data/cameras";
import { REALTIME_CALIBRATION } from "./realtime-calibration";
import { compareSegments, keyboardSignature, midiForNote, noteForOrdinal, stripeKey } from "./realtime-scale";

const NOTE_PATTERN = /^([A-G])([#b]?)(-?\d+)$/;

const BASE = DEFAULT_LIVE_CAMERA.baseAnchor;

const REFERENCE_LEFT = REALTIME_CALIBRATION.stripes.filter((s) => s.segment === "left");
const REFERENCE_RIGHT = REALTIME_CALIBRATION.stripes.filter((s) => s.segment === "right");

describe("noteForOrdinal", () => {
  it("reproduces the original hand-authored scale exactly", () => {
    // The two crosswalks were always one continuous chromatic run — 18 left
    // stripes C4-F5, then 7 right stripes F#5-C6 — so numbering the crossing
    // globally is that run stated directly. Nothing that already made a sound
    // starts making a different one on a complete read.
    const crossing = [...REFERENCE_LEFT, ...REFERENCE_RIGHT];
    crossing.forEach((stripe, ordinal) => {
      expect(noteForOrdinal(BASE, ordinal)).toBe(stripe.note);
    });
  });

  it("keeps climbing past the end of the old fixed scale", () => {
    // The bug this replaced: trailing slots all clamped to one pitch, so a
    // single pedestrian lit five stripes at once.
    const overflow = [25, 26, 27, 28].map((i) => noteForOrdinal(BASE, i));

    expect(overflow).toEqual(["C#6", "D6", "Eb6", "E6"]);
    expect(new Set(overflow).size).toBe(4);
  });

  it("never repeats a pitch across any plausible crossing", () => {
    // 48 stripes is nearly double what the crossing currently reads and stays
    // under the C8 ceiling. Past that ceiling pitches do repeat — see the clamp
    // test — but the overlay keys on stripe identity, not pitch.
    const notes = Array.from({ length: 48 }, (_, i) => noteForOrdinal(BASE, i));
    expect(new Set(notes).size).toBe(notes.length);
  });

  it("ascends by exactly one semitone per stripe", () => {
    const midis = Array.from({ length: 40 }, (_, i) => midiForNote(noteForOrdinal(BASE, i))!);
    for (let i = 1; i < midis.length; i += 1) {
      expect(midis[i] - midis[i - 1]).toBe(1);
    }
  });

  it("generates names the audio engine can parse", () => {
    // noteFrequency in realtime-inference falls back to 440Hz on a name it
    // cannot read, which would be silent breakage rather than a crash.
    for (let i = 0; i < 60; i += 1) {
      expect(noteForOrdinal(BASE, i)).toMatch(NOTE_PATTERN);
    }
  });

  it("clamps at the top of hearing rather than running away", () => {
    const absurd = noteForOrdinal(BASE, 5000);
    expect(absurd).toMatch(NOTE_PATTERN);
    expect(midiForNote(absurd)).toBe(108); // C8
  });

  it("treats negative and fractional ordinals as the anchor", () => {
    expect(noteForOrdinal(BASE, -5)).toBe("C4");
    expect(noteForOrdinal(BASE, 0.5)).toBe("C4");
  });

  it("falls back to C4 when the anchor is not a note", () => {
    expect(noteForOrdinal("not-a-note", 0)).toBe("C4");
  });
});

describe("compareSegments", () => {
  it("orders the agent's positional cluster names numerically", () => {
    // Alphabetically segment10 would sort between segment1 and segment2,
    // silently reordering the keyboard on any crossing that reads ten clusters.
    const names = ["segment10", "segment2", "segment0", "segment1"];
    expect([...names].sort(compareSegments)).toEqual([
      "segment0", "segment1", "segment2", "segment10",
    ]);
  });

  it("orders legacy left/right calibrations correctly", () => {
    // Published before the switch to positional names; they carry no number,
    // so they fall through to alphabetical — which happens to be right.
    expect(["right", "left"].sort(compareSegments)).toEqual(["left", "right"]);
  });

  it("puts numbered clusters ahead of unnumbered ones", () => {
    expect(["left", "segment0"].sort(compareSegments)).toEqual(["segment0", "left"]);
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
  it("distinguishes stripes in different clusters", () => {
    expect(stripeKey("segment0", 3)).not.toBe(stripeKey("segment1", 3));
  });

  it("is stable for the same stripe", () => {
    expect(stripeKey("segment0", 3)).toBe(stripeKey("segment0", 3));
  });
});

describe("keyboardSignature", () => {
  const stripes = [
    { segment: "segment0", stripeIndex: 0 },
    { segment: "segment0", stripeIndex: 1 },
    { segment: "segment1", stripeIndex: 0 },
  ];

  it("is stable when the agent republishes the same keyboard", () => {
    expect(keyboardSignature(stripes)).toBe(keyboardSignature([...stripes]));
  });

  it("changes when a cluster splits", () => {
    // The trigger for adopting occupancy silently: keys are renamed, so every
    // pedestrian standing still would otherwise read as newly arrived.
    const split = [
      { segment: "segment0", stripeIndex: 0 },
      { segment: "segment1", stripeIndex: 0 },
      { segment: "segment2", stripeIndex: 0 },
    ];
    expect(keyboardSignature(split)).not.toBe(keyboardSignature(stripes));
  });

  it("changes when a stripe goes missing", () => {
    expect(keyboardSignature(stripes.slice(0, 2))).not.toBe(keyboardSignature(stripes));
  });
});
