export const KNOWN_UNAVAILABLE_IMAGE_SHA256 = new Set([
  // 511NY PNG: "This camera is being serviced".
  "8cb2a34149523b8427f1fc4cfe4bf23ce21935c3e94e4b8e015b5b95cd9e21f4",
  // 511NY PNG: "No live camera feed at this time".
  "e608c39b77e5480ce13682b571638e4246ff519dd6c79402c393db5e273aab19",
]);

export type CameraImageStatus = "active" | "unavailable";

export function classifyCameraImage(contentType: string, sha256: string): CameraImageStatus {
  return contentType.toLowerCase().startsWith("image/png") &&
    KNOWN_UNAVAILABLE_IMAGE_SHA256.has(sha256)
    ? "unavailable"
    : "active";
}
