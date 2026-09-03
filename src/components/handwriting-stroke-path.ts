import { Skia, type SkPath } from '@shopify/react-native-skia';

// Shared between the capture canvas (handwriting-canvas-impl.tsx) and the
// read-only renderer (handwriting-reader-impl.tsx) -- same stroke data,
// same geometry, so both draw identically. Pure data/geometry only, no
// component state, but still subject to the same Skia-readiness rule as
// every other module that touches the `Skia` export: only ever reached
// after CanvasKit is ready (native: always; web: only via the .web.tsx
// dynamic-import wrappers).

export type CapturedPoint = {
  x: number;
  y: number;
  // Only present when the touch came from an Apple Pencil: RNGH's
  // PanHandler leaves `stylusData` nil for finger touches (see
  // node_modules' apple/Handlers/RNPanHandler.m -- tryUpdateStylusData
  // checks `touch.type != UITouchTypePencil`), so presence alone is the
  // pencil/finger signal -- no device detection needed.
  pressure?: number;
  tiltX?: number;
  tiltY?: number;
};

export type CapturedStroke = {
  points: CapturedPoint[];
};

export type StrokeDocument = {
  width: number;
  height: number;
  strokes: CapturedStroke[];
};

const BASE_STROKE_WIDTH = 3;
const MIN_STROKE_WIDTH = 1;

// Pencil-only fields widen/narrow the stroke around the base weight; finger
// touches never carry pressure/tilt, so they always render at a flat
// BASE_STROKE_WIDTH -- the "uniform stroke weight" finger fallback.
export function strokeWidthForPoint(point: CapturedPoint): number {
  if (point.pressure === undefined) return BASE_STROKE_WIDTH;
  const pressureFactor = 0.4 + Math.max(0, Math.min(1, point.pressure)) * 1.3;
  const tiltMagnitude = Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0);
  const tiltFactor = 1 + Math.min(1, tiltMagnitude / 90) * 0.35;
  return Math.max(MIN_STROKE_WIDTH, BASE_STROKE_WIDTH * pressureFactor * tiltFactor);
}

// A stroked Path only ever has one strokeWidth for its whole length, which
// can't taper. So instead we build a single filled polygon that traces both
// edges of the stroke, each vertex offset from the centerline by that
// point's own half-width -- that's what makes width vary point-to-point.
export function buildStrokePath(points: CapturedPoint[]): SkPath | null {
  if (points.length === 0) return null;

  if (points.length === 1) {
    const [p] = points;
    const path = Skia.Path.Make();
    path.addCircle(p.x, p.y, strokeWidthForPoint(p) / 2);
    return path;
  }

  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    // Perpendicular to the local tangent.
    const nx = -dy;
    const ny = dx;
    const halfWidth = strokeWidthForPoint(point) / 2;
    left.push({ x: point.x + nx * halfWidth, y: point.y + ny * halfWidth });
    right.push({ x: point.x - nx * halfWidth, y: point.y - ny * halfWidth });
  }

  const path = Skia.Path.Make();
  path.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) path.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) path.lineTo(right[i].x, right[i].y);
  path.close();
  return path;
}
