import { describe, expect, it } from "vitest";

import { DEFAULT_LIVE_CAMERA } from "@/data/cameras";
import { REALTIME_CALIBRATION } from "./realtime-calibration";
import { noteForOrdinal } from "./realtime-scale";
import { gcsAuthenticatedUrl, toBoundaries, toStripes } from "./use-calibration";

const CAMERA = DEFAULT_LIVE_CAMERA;
const BASE = CAMERA.baseAnchor;
const QUAD = [[10, 120], [20, 120], [20, 130], [10, 130]];

// The scale itself is covered in realtime-scale.test.ts; these cover how a
// calibration payload is turned into stripes and hit-regions.
describe("toStripes", () => {
  it("numbers the crossing globally, not per cluster", () => {
    // The agent names notes never — pitch comes from a stripe's position in the
    // whole crossing, so the first stripe of the second cluster continues from
    // where the first cluster left off rather than restarting at the anchor.
    const stripes = toStripes(CAMERA, [
      { stripeIndex: 0, segment: "segment0", polygon: QUAD },
      { stripeIndex: 1, segment: "segment0", polygon: QUAD },
      { stripeIndex: 0, segment: "segment1", polygon: QUAD },
    ]);

    expect(stripes.map((s) => s.note)).toEqual([
      noteForOrdinal(BASE, 0),
      noteForOrdinal(BASE, 1),
      noteForOrdinal(BASE, 2),
    ]);
  });

  it("leaves every note unchanged when a cluster splits in two", () => {
    // Option C's headline property: a truck parked mid-crosswalk turns one run
    // into two clusters. Because pitch follows the global sequence and not the
    // cluster, the instrument does not notice.
    const whole = toStripes(CAMERA, [
      { stripeIndex: 0, segment: "segment0", polygon: QUAD },
      { stripeIndex: 1, segment: "segment0", polygon: QUAD },
      { stripeIndex: 2, segment: "segment0", polygon: QUAD },
      { stripeIndex: 0, segment: "segment1", polygon: QUAD },
    ]);
    const split = toStripes(CAMERA, [
      { stripeIndex: 0, segment: "segment0", polygon: QUAD },
      { stripeIndex: 0, segment: "segment1", polygon: QUAD },
      { stripeIndex: 1, segment: "segment1", polygon: QUAD },
      { stripeIndex: 0, segment: "segment2", polygon: QUAD },
    ]);

    expect(split.map((s) => s.note)).toEqual(whole.map((s) => s.note));
  });

  it("orders clusters positionally rather than alphabetically", () => {
    // segment10 sorts before segment2 alphabetically, which would transpose
    // every stripe past the tenth cluster.
    const stripes = toStripes(CAMERA, [
      { stripeIndex: 0, segment: "segment10", polygon: QUAD },
      { stripeIndex: 0, segment: "segment2", polygon: QUAD },
    ]);

    expect(stripes.map((s) => s.segment)).toEqual(["segment2", "segment10"]);
    expect(stripes[0].note).toBe(noteForOrdinal(BASE, 0));
  });

  it("orders stripes within a cluster by the index the agent assigned", () => {
    const stripes = toStripes(CAMERA, [
      { stripeIndex: 2, segment: "segment0", polygon: QUAD },
      { stripeIndex: 0, segment: "segment0", polygon: QUAD },
      { stripeIndex: 1, segment: "segment0", polygon: QUAD },
    ]);

    expect(stripes.map((s) => s.stripeIndex)).toEqual([0, 1, 2]);
    expect(stripes.map((s) => s.note)).toEqual([
      noteForOrdinal(BASE, 0), noteForOrdinal(BASE, 1), noteForOrdinal(BASE, 2),
    ]);
  });

  it("plays clusters it has never heard of rather than dropping them", () => {
    // There is no fixed cluster vocabulary to validate against — the count
    // varies run to run — so an unexpected name must still make a sound.
    const stripes = toStripes(CAMERA, [
      { stripeIndex: 0, segment: "segment0", polygon: QUAD },
      { stripeIndex: 0, segment: "somewhere-new", polygon: QUAD },
    ]);

    expect(stripes).toHaveLength(2);
  });

  it("drops polygons with too few points to fill", () => {
    expect(toStripes(CAMERA, [{ stripeIndex: 0, segment: "segment0", polygon: [[1, 2], [3, 4]] }])).toHaveLength(0);
  });

  it("falls back to the camera's reference when the payload has no stripes", () => {
    expect(toStripes(CAMERA, [])).toEqual(REALTIME_CALIBRATION.stripes);
    expect(toStripes(CAMERA, undefined)).toEqual(REALTIME_CALIBRATION.stripes);
  });
});

describe("toBoundaries", () => {
  const FAR = [[300, 120], [310, 120], [310, 130], [300, 130]];

  it("synthesizes a hit-region per cluster when the agent publishes none", () => {
    // The agent stopped detecting boundaries; the client hulls each cluster's
    // own stripes instead, so hit-testing survives with no coordination.
    const stripes = toStripes(CAMERA, [
      { stripeIndex: 0, segment: "segment0", polygon: QUAD },
      { stripeIndex: 0, segment: "segment1", polygon: FAR },
    ]);
    const boundaries = toBoundaries({ status: "ok" }, stripes);

    expect(Object.keys(boundaries).sort()).toEqual(["segment0", "segment1"]);
    for (const boundary of Object.values(boundaries)) expect(boundary.length).toBeGreaterThanOrEqual(3);
  });

  it("hulls each cluster separately so the gap between runs stays unplayable", () => {
    // One hull over the whole crossing would swallow the median and make the
    // island playable; per-cluster hulls leave it outside every region.
    const stripes = toStripes(CAMERA, [
      { stripeIndex: 0, segment: "segment0", polygon: QUAD },
      { stripeIndex: 0, segment: "segment1", polygon: FAR },
    ]);
    const boundaries = toBoundaries({ status: "ok" }, stripes);

    const median = 160; // between QUAD (x≤20) and FAR (x≥300)
    for (const boundary of Object.values(boundaries)) {
      expect(Math.min(...boundary.map(([x]) => x)) > median || Math.max(...boundary.map(([x]) => x)) < median).toBe(true);
    }
  });

  it("builds a many-sided hull from stripes alone, so point count cannot imply provenance", () => {
    // The debug panel labels hulls as stripe-derived, and that has to come from
    // whether a boundary was published rather than from the shape of the
    // result: several stripes hull to well over the four points a single quad
    // has, which is exactly what made an earlier point-count heuristic wrong.
    const stripes = toStripes(CAMERA, [
      { stripeIndex: 0, segment: "segment0", polygon: [[10, 120], [20, 121], [20, 131], [10, 130]] },
      { stripeIndex: 1, segment: "segment0", polygon: [[22, 121], [32, 122], [32, 132], [22, 131]] },
      { stripeIndex: 2, segment: "segment0", polygon: [[34, 122], [44, 123], [44, 133], [34, 132]] },
    ]);

    expect(toBoundaries({ status: "ok" }, stripes).segment0.length).toBeGreaterThan(4);
  });

  it("still honours a published boundary if one ever arrives", () => {
    // The agent no longer sends these, but honouring one costs nothing and
    // means a future change on that side does not need a client release.
    const stripes = toStripes(CAMERA, [{ stripeIndex: 0, segment: "segment0", polygon: QUAD }]);
    const boundaries = toBoundaries(
      { status: "ok", crosswalks: { segment0: [[0, 100], [40, 100], [40, 140], [0, 140]] } },
      stripes,
    );

    expect(Object.keys(boundaries)).toEqual(["segment0"]);
    // The published outline is wider than the stripe, so the hull must be too.
    expect(Math.max(...boundaries.segment0.map(([x]) => x))).toBeGreaterThan(20);
  });
});

describe("gcsAuthenticatedUrl", () => {
  it("converts a gs:// URI to the browser-openable authenticated URL", () => {
    expect(gcsAuthenticatedUrl("gs://xwalk-keyboards-01/calibration/history/camera_5056/run-20260821T154522Z-ab12cd.jpg"))
      .toBe("https://storage.cloud.google.com/xwalk-keyboards-01/calibration/history/camera_5056/run-20260821T154522Z-ab12cd.jpg");
  });

  it("returns null when the agent published no frame", () => {
    // The agent omits frameUri entirely rather than publishing null, but the
    // client must not care which it gets.
    expect(gcsAuthenticatedUrl(undefined)).toBeNull();
    expect(gcsAuthenticatedUrl(null)).toBeNull();
    expect(gcsAuthenticatedUrl("")).toBeNull();
  });

  it("refuses anything that is not a gs:// URI", () => {
    // This value ends up in an href, so a scheme we did not expect renders as
    // plain text rather than becoming a link.
    expect(gcsAuthenticatedUrl("javascript:alert(1)")).toBeNull();
    expect(gcsAuthenticatedUrl("data:text/html,<script>")).toBeNull();
    expect(gcsAuthenticatedUrl("https://example.com/frame.jpg")).toBeNull();
    expect(gcsAuthenticatedUrl("  gs://bucket/object.jpg")).toBeNull();
  });

  it("refuses malformed gs:// URIs rather than building a half-URL", () => {
    expect(gcsAuthenticatedUrl("gs://")).toBeNull();
    expect(gcsAuthenticatedUrl("gs://bucket")).toBeNull();      // no object
    expect(gcsAuthenticatedUrl("gs://bucket/")).toBeNull();     // empty object
    expect(gcsAuthenticatedUrl("gs:///object.jpg")).toBeNull(); // no bucket
    expect(gcsAuthenticatedUrl("gs://bucket/a b.jpg")).toBeNull();
    expect(gcsAuthenticatedUrl("gs://bucket/a\nevil")).toBeNull();
  });

  it("always resolves to the GCS host whatever the path contains", () => {
    // The host is hardcoded and follows https:// directly, so a path that
    // looks like a hostname cannot redirect the link.
    const url = gcsAuthenticatedUrl("gs://bucket/@evil.com/x.jpg");
    expect(new URL(url!).host).toBe("storage.cloud.google.com");
  });
});
