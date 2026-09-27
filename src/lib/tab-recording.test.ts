import { describe, expect, it } from "vitest";

import {
  RECORDING_MIME_TYPES,
  formatElapsed,
  pickRecordingMimeType,
  recordingExtension,
  recordingFileName,
} from "./tab-recording";

describe("pickRecordingMimeType", () => {
  it("prefers MP4 when the browser can write it", () => {
    expect(pickRecordingMimeType(() => true)).toBe(RECORDING_MIME_TYPES[0]);
  });

  it("falls back to WebM when MP4 is unsupported", () => {
    const supported = (type: string) => type.startsWith("video/webm");
    expect(pickRecordingMimeType(supported)).toBe("video/webm;codecs=vp9,opus");
  });

  it("returns null when nothing in the ladder is supported", () => {
    expect(pickRecordingMimeType(() => false)).toBeNull();
  });
});

describe("recordingExtension", () => {
  it("maps MP4 and WebM MIME types to their extensions", () => {
    expect(recordingExtension("video/mp4;codecs=avc1,mp4a.40.2")).toBe("mp4");
    expect(recordingExtension("video/webm;codecs=vp9,opus")).toBe("webm");
    expect(recordingExtension("video/x-matroska")).toBe("webm");
  });
});

describe("recordingFileName", () => {
  it("names the file by camera and local timestamp", () => {
    const date = new Date(2026, 8, 27, 9, 5, 3);
    expect(recordingFileName(80007, date, "video/mp4")).toBe("xwalk-80007-20260927-090503.mp4");
    expect(recordingFileName(5059, date, "video/webm")).toBe("xwalk-5059-20260927-090503.webm");
  });
});

describe("formatElapsed", () => {
  it("formats as m:ss", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(7_900)).toBe("0:07");
    expect(formatElapsed(65_000)).toBe("1:05");
    expect(formatElapsed(12 * 60_000)).toBe("12:00");
  });

  it("clamps negative durations to zero", () => {
    expect(formatElapsed(-500)).toBe("0:00");
  });
});
