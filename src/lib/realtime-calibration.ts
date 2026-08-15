export type FrameSize = { height: number; width: number };
export type Point = readonly [number, number];

export type Stripe = {
  note: string;
  polygon: readonly Point[];
  // Which crosswalk the stripe belongs to. Open-ended: segment names come from
  // the calibration agent, and which of them the app can voice is decided by
  // the anchor registry in realtime-scale.ts, not by this type.
  segment: string;
  stripeIndex: number;
};

export type Boundaries = Readonly<Record<string, readonly Point[]>>;

// Calibrated with Roboflow's polygon tool against a View 5056 native HLS frame
// (352 × 240) on 2026-08-07. The source dimensions come from
// HTMLVideoElement.videoWidth and videoHeight, not from a browser screenshot.
export const REALTIME_CALIBRATION = {
  cameraId: 5056,
  boundaries: {
    left: [
      [27, 108], [193, 120], [188, 139], [1, 125],
    ],
    right: [
      [291, 132], [349, 137], [350, 155], [301, 150],
    ],
  } as Boundaries,
  referenceFrame: { height: 240, width: 352 },
  stripes: [
    { note: "C4", polygon: [[6.5, 118], [15.5, 119], [1, 128], [0, 124]], segment: "left", stripeIndex: 0 },
    { note: "C#4", polygon: [[15.5, 119], [25, 119.5], [4.5, 132.5], [1, 128]], segment: "left", stripeIndex: 1 },
    { note: "D4", polygon: [[25, 119.5], [34, 120.5], [14.5, 133.5], [4.5, 132.5]], segment: "left", stripeIndex: 2 },
    { note: "Eb4", polygon: [[34, 120.5], [43, 121], [25, 134], [14.5, 133.5]], segment: "left", stripeIndex: 3 },
    { note: "E4", polygon: [[43, 121], [53, 121.5], [34.5, 135], [25, 134]], segment: "left", stripeIndex: 4 },
    { note: "F4", polygon: [[53, 121.5], [62, 122], [44.5, 136], [34.5, 135]], segment: "left", stripeIndex: 5 },
    { note: "F#4", polygon: [[62, 122], [71.5, 122.5], [55.5, 136.5], [44.5, 136]], segment: "left", stripeIndex: 6 },
    { note: "G4", polygon: [[71.5, 122.5], [81, 123], [66, 137], [55.5, 136.5]], segment: "left", stripeIndex: 7 },
    { note: "Ab4", polygon: [[81, 123], [91, 123.5], [76.5, 138], [66, 137]], segment: "left", stripeIndex: 8 },
    { note: "A4", polygon: [[91, 123.5], [100, 124.5], [87.5, 138.5], [76.5, 138]], segment: "left", stripeIndex: 9 },
    { note: "Bb4", polygon: [[100, 124.5], [110, 125], [99, 139], [87.5, 138.5]], segment: "left", stripeIndex: 10 },
    { note: "B4", polygon: [[110, 125], [120, 125.5], [110, 140], [99, 139]], segment: "left", stripeIndex: 11 },
    { note: "C5", polygon: [[120, 125.5], [129.5, 126], [121, 141], [110, 140]], segment: "left", stripeIndex: 12 },
    { note: "C#5", polygon: [[129.5, 126], [139.5, 126.5], [132, 141.5], [121, 141]], segment: "left", stripeIndex: 13 },
    { note: "D5", polygon: [[139.5, 126.5], [149, 127], [143, 142], [132, 141.5]], segment: "left", stripeIndex: 14 },
    { note: "Eb5", polygon: [[149, 127], [159, 127.5], [154, 143], [143, 142]], segment: "left", stripeIndex: 15 },
    { note: "E5", polygon: [[159, 127.5], [169, 128.5], [165, 144.5], [154, 143]], segment: "left", stripeIndex: 16 },
    { note: "F5", polygon: [[169, 128.5], [178, 129.5], [176, 146.5], [165, 144.5]], segment: "left", stripeIndex: 17 },
    { note: "F#5", polygon: [[278, 137.5], [287, 138.5], [302.5, 156], [292.5, 155]], segment: "right", stripeIndex: 0 },
    { note: "G5", polygon: [[287, 138.5], [298, 140], [313.5, 157], [302.5, 156]], segment: "right", stripeIndex: 1 },
    { note: "Ab5", polygon: [[298, 140], [308.5, 141.5], [324, 158], [313.5, 157]], segment: "right", stripeIndex: 2 },
    { note: "A5", polygon: [[308.5, 141.5], [318.5, 142.5], [334.5, 159], [324, 158]], segment: "right", stripeIndex: 3 },
    { note: "Bb5", polygon: [[318.5, 142.5], [328.5, 143.5], [345.5, 160], [334.5, 159]], segment: "right", stripeIndex: 4 },
    { note: "B5", polygon: [[328.5, 143.5], [339, 144.5], [355.5, 161], [345.5, 160]], segment: "right", stripeIndex: 5 },
    { note: "C6", polygon: [[339, 144.5], [349, 145.5], [366.5, 162], [355.5, 161]], segment: "right", stripeIndex: 6 },
  ] satisfies readonly Stripe[],
} as const;

export function scalePoint(point: Point, targetFrame: FrameSize): [number, number] {
  return [
    point[0] * targetFrame.width / REALTIME_CALIBRATION.referenceFrame.width,
    point[1] * targetFrame.height / REALTIME_CALIBRATION.referenceFrame.height,
  ];
}

export function scalePolygon(polygon: readonly Point[], targetFrame: FrameSize) {
  return polygon.map((point) => scalePoint(point, targetFrame));
}

export function isPointInPolygon(point: Point, polygon: readonly Point[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x, y] = polygon[index];
    const [previousX, previousY] = polygon[previous];
    const intersects = (y > point[1]) !== (previousY > point[1]) &&
      point[0] < (previousX - x) * (point[1] - y) / (previousY - y) + x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function squaredDistanceToSegment(point: Point, start: Point, end: Point) {
  const [pointX, pointY] = point;
  const [startX, startY] = start;
  const [endX, endY] = end;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  if (lengthSquared === 0) return (pointX - startX) ** 2 + (pointY - startY) ** 2;
  const projection = Math.max(0, Math.min(1, ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / lengthSquared));
  const nearestX = startX + projection * deltaX;
  const nearestY = startY + projection * deltaY;
  return (pointX - nearestX) ** 2 + (pointY - nearestY) ** 2;
}

function squaredDistanceToPolygon(point: Point, polygon: readonly Point[]) {
  return polygon.reduce((minimum, vertex, index) => Math.min(
    minimum,
    squaredDistanceToSegment(point, vertex, polygon[(index + 1) % polygon.length])
  ), Number.POSITIVE_INFINITY);
}

export function stripeForPoint(point: Point, frame: FrameSize) {
  const scaledStripes = REALTIME_CALIBRATION.stripes.map((stripe) => ({
    ...stripe,
    polygon: scalePolygon(stripe.polygon, frame),
  }));
  const occupiedStripe = scaledStripes.find((stripe) => isPointInPolygon(point, stripe.polygon));
  if (occupiedStripe) return occupiedStripe;

  const segment = Object.entries(REALTIME_CALIBRATION.boundaries).find(
    ([, boundary]) => isPointInPolygon(point, scalePolygon(boundary, frame)),
  )?.[0] ?? null;
  if (!segment) return null;

  return scaledStripes
    .filter((stripe) => stripe.segment === segment)
    .reduce((nearest, stripe) => (
      squaredDistanceToPolygon(point, stripe.polygon) < squaredDistanceToPolygon(point, nearest.polygon)
        ? stripe
        : nearest
    ));
}
