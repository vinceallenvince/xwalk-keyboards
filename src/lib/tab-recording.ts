// Container/codec preference for MediaRecorder, best first. WebM leads even
// though Chrome can write MP4: its H.264 MP4 of a shared tab dropped the bottom
// macroblock rows of every frame after the first, so Apple's hardware decoder
// rejected them and QuickTime froze on frame one over live audio (VIN-81).
// Takes are converted to MP4 with ffmpeg afterwards. MP4 remains a fallback
// for a browser that cannot write WebM.
export const RECORDING_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
] as const;

/** First supported MIME type, or null to let the browser choose its default. */
export function pickRecordingMimeType(isTypeSupported: (type: string) => boolean): string | null {
  return RECORDING_MIME_TYPES.find((type) => isTypeSupported(type)) ?? null;
}

export function recordingExtension(mimeType: string): "mp4" | "webm" {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `xwalk-<cameraId>-<YYYYMMDD>-<HHMMSS>.<ext>`, in the operator's local time. */
export function recordingFileName(cameraId: number, date: Date, mimeType: string): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `xwalk-${cameraId}-${day}-${time}.${recordingExtension(mimeType)}`;
}

/** Elapsed recording time as m:ss. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${pad(totalSeconds % 60)}`;
}

/** Tab capture with audio needs getDisplayMedia and MediaRecorder. */
export function isTabRecordingSupported(): boolean {
  return typeof navigator !== "undefined"
    && typeof navigator.mediaDevices?.getDisplayMedia === "function"
    && typeof MediaRecorder !== "undefined";
}
