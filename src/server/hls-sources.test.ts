import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hlsSourceBaseUrl } from "./hls-sources";

describe("HLS source resolution", () => {
  it("resolves every 511NY stream from server-owned configuration", () => {
    expect(hlsSourceBaseUrl(5056, {})?.toString()).toBe(
      "https://s9.nysdot.skyvdn.com/rtplive/R11_272/",
    );
    expect(hlsSourceBaseUrl(5059, {})?.toString()).toBe(
      "https://s9.nysdot.skyvdn.com/rtplive/R11_275/",
    );
    expect(hlsSourceBaseUrl(5062, {})?.toString()).toBe(
      "https://s9.nysdot.skyvdn.com/rtplive/R11_278/",
    );
    expect(hlsSourceBaseUrl(5072, {})?.toString()).toBe(
      "https://s9.nysdot.skyvdn.com/rtplive/R11_279/",
    );
  });

  it("resolves CARLA only from its server environment", () => {
    expect(hlsSourceBaseUrl(90014, {})).toBeNull();
    expect(hlsSourceBaseUrl(90014, {
      CARLA_HLS_BASE_URL: "http://10.150.0.2:8080/live",
    })?.toString()).toBe("http://10.150.0.2:8080/live/");
  });

  it("rejects malformed, credentialed, queried, and non-HTTP CARLA bases", () => {
    for (const value of [
      "not a URL",
      "file:///etc/",
      "http://user:password@10.150.0.2/live/",
      "http://10.150.0.2/live/?redirect=elsewhere",
      "http://10.150.0.2/live/#fragment",
    ]) {
      expect(hlsSourceBaseUrl(90014, { CARLA_HLS_BASE_URL: value })).toBeNull();
    }
  });

  it("does not resolve unregistered sources", () => {
    expect(hlsSourceBaseUrl(99999, {})).toBeNull();
  });
});
