import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Path,
  Skia,
  useCanvasSize,
  type SkContourMeasure,
  type SkPath,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  type DerivedValue,
  type FrameInfo,
  runOnJS,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import { PaperColors } from '@/constants/theme';

import {
  BIRD_RANGE,
  RAIN_RANGE,
  THERMAL_RANGE,
  TREE_RANGE,
  WIND_RANGE,
  ZONES,
  type FlightEvent,
  type FlightEventType,
} from './flight-zones';

// Re-exported for existing consumers (flight-canvas.tsx/.web.tsx,
// Tracking) -- the zone data/types themselves now live in flight-zones.ts,
// shared with Tracking's flight-log backfill for an already-landed message.
export type { FlightEvent, FlightEventType };

export type FlightCanvasProps = {
  departedAtMs: number;
  durationMs: number;
  landed: boolean;
  onEvent?: (event: FlightEvent) => void;
};

const PLANE_SIZE = 15;

// This module (and everything it imports) must not be evaluated until Skia
// is actually ready to use. On native that's always true. On web, the
// `Skia` export is bound to `global.CanvasKit` at *module-evaluation* time
// (see Skia.web.js), so this file must only ever be reached via a dynamic
// import() issued after LoadSkiaWeb() resolves -- see flight-canvas.web.tsx.
// Importing it statically on web would freeze `Skia` to an unusable object.
function buildPlanePath(): SkPath {
  const p = Skia.Path.Make();
  p.moveTo(PLANE_SIZE, 0);
  p.lineTo(-PLANE_SIZE * 0.6, -PLANE_SIZE * 0.55);
  p.lineTo(-PLANE_SIZE * 0.3, 0);
  p.lineTo(-PLANE_SIZE * 0.6, PLANE_SIZE * 0.55);
  p.close();
  return p;
}

function buildSpeedLinesPath(): SkPath {
  const p = Skia.Path.Make();
  p.moveTo(-18, -5);
  p.lineTo(-32, -5);
  p.moveTo(-18, 5);
  p.lineTo(-32, 5);
  return p;
}

function buildBirdPath(): SkPath {
  const p = Skia.Path.Make();
  p.moveTo(-8, 2);
  p.quadTo(-4, -6, 0, 1);
  p.quadTo(4, -6, 8, 2);
  return p;
}

function buildTreePath(): SkPath {
  const p = Skia.Path.Make();
  p.moveTo(0, -20);
  p.lineTo(9, -4);
  p.lineTo(4, -4);
  p.lineTo(11, 8);
  p.lineTo(-11, 8);
  p.lineTo(-4, -4);
  p.lineTo(-9, -4);
  p.close();
  return p;
}

type Geometry = {
  path: SkPath;
  length: number;
  contour: SkContourMeasure;
  markers: Record<FlightEventType, { x: number; y: number }>;
};

function buildGeometry(width: number, height: number): Geometry | null {
  if (width <= 0 || height <= 0) return null;

  const originX = width * 0.08;
  const originY = height * 0.86;
  const destX = width * 0.92;
  const destY = height * 0.32;
  const cp1X = width * 0.32;
  const cp1Y = height * 0.15;
  const cp2X = width * 0.64;
  const cp2Y = height * 0.05;

  const path = Skia.Path.Make();
  path.moveTo(originX, originY);
  path.cubicTo(cp1X, cp1Y, cp2X, cp2Y, destX, destY);

  const iter = Skia.ContourMeasureIter(path, false, 1);
  const contour = iter.next();
  if (!contour) return null;
  const length = contour.length();

  const markers = Object.fromEntries(
    ZONES.map((zone) => {
      const mid = (zone.range[0] + zone.range[1]) / 2;
      const [pos] = contour.getPosTan(mid * length);
      return [zone.type, { x: pos.x, y: pos.y }];
    }),
  ) as Record<FlightEventType, { x: number; y: number }>;

  return { path, length, contour, markers };
}

export default function FlightCanvasImpl({
  departedAtMs,
  durationMs,
  landed,
  onEvent,
}: FlightCanvasProps) {
  // Canvas's onLayout isn't supported on Fabric (see Canvas.tsx's own
  // deprecation warning) -- useCanvasSize() is Skia's replacement, backed
  // by an imperative .measure() call on the underlying native view rather
  // than a layout event.
  const { ref: canvasRef, size } = useCanvasSize();

  const geometry = useMemo(() => buildGeometry(size.width, size.height), [size.width, size.height]);

  const shapes = useMemo(
    () => ({
      plane: buildPlanePath(),
      speedLines: buildSpeedLinesPath(),
      bird: buildBirdPath(),
      tree: buildTreePath(),
    }),
    [],
  );

  const progress = useSharedValue(0);
  const planeX = useSharedValue(0);
  const planeY = useSharedValue(0);
  const planeAngle = useSharedValue(0);
  const smear = useSharedValue(0);
  const thermalScale = useSharedValue(1);
  const birdAmount = useSharedValue(0);

  const treeFired = useSharedValue(false);
  const birdFired = useSharedValue(false);
  const windFired = useSharedValue(false);
  const rainFired = useSharedValue(false);
  const thermalFired = useSharedValue(false);

  const reportEvent = useCallback(
    (type: FlightEventType, label: string) => {
      onEvent?.({ type, label, at: Date.now() });
    },
    [onEvent],
  );

  const frameWorklet = useCallback((frameInfo: FrameInfo) => {
    'worklet';
    if (!geometry) return;

    const t = Math.max(0, Math.min(1, (Date.now() - departedAtMs) / durationMs));
    progress.value = t;

    const inTree = t >= TREE_RANGE[0] && t <= TREE_RANGE[1];
    const inBird = t >= BIRD_RANGE[0] && t <= BIRD_RANGE[1];
    const inWind = t >= WIND_RANGE[0] && t <= WIND_RANGE[1];
    const inRain = t >= RAIN_RANGE[0] && t <= RAIN_RANGE[1];
    const inThermal = t >= THERMAL_RANGE[0] && t <= THERMAL_RANGE[1];

    const [pos, tan] = geometry.contour.getPosTan(t * geometry.length);
    let x = pos.x;
    let y = pos.y;
    let angle = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;

    if (inTree) {
      const local = (t - TREE_RANGE[0]) / (TREE_RANGE[1] - TREE_RANGE[0]);
      y += Math.sin(local * Math.PI) * 6;
      if (!treeFired.value) {
        treeFired.value = true;
        runOnJS(reportEvent)('tree', ZONES[0].label);
      }
    }

    if (inBird) {
      const local = (t - BIRD_RANGE[0]) / (BIRD_RANGE[1] - BIRD_RANGE[0]);
      birdAmount.value = Math.sin(local * Math.PI);
      if (!birdFired.value) {
        birdFired.value = true;
        runOnJS(reportEvent)('bird', ZONES[1].label);
      }
    } else {
      birdAmount.value = 0;
    }

    if (inWind) {
      const wobble = Math.sin(frameInfo.timestamp / 140) * 10;
      const perp = ((angle + 90) * Math.PI) / 180;
      x += Math.cos(perp) * (14 + wobble);
      y += Math.sin(perp) * (14 + wobble);
      angle += Math.sin(frameInfo.timestamp / 110) * 8;
      if (!windFired.value) {
        windFired.value = true;
        runOnJS(reportEvent)('wind', ZONES[2].label);
      }
    }

    if (inRain) {
      smear.value = Math.min(1, smear.value + (frameInfo.timeSincePreviousFrame ?? 16) / 4000);
      if (!rainFired.value) {
        rainFired.value = true;
        runOnJS(reportEvent)('rain', ZONES[3].label);
      }
    }

    if (inThermal) {
      thermalScale.value = 1.3;
      if (!thermalFired.value) {
        thermalFired.value = true;
        runOnJS(reportEvent)('thermal', ZONES[4].label);
      }
    } else {
      thermalScale.value += (1 - thermalScale.value) * 0.08;
    }

    planeX.value = x;
    planeY.value = y;
    planeAngle.value = angle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, departedAtMs, durationMs, reportEvent]);

  const frameCallback = useFrameCallback(frameWorklet, true);

  useEffect(() => {
    frameCallback.setActive(geometry !== null && !landed);
  }, [frameCallback, geometry, landed]);

  // Whenever landed, snap the visual state to its fully-flown end position.
  // Covers two cases uniformly: transitioning live (the frame loop above
  // has already animated to ~t=1 by the time `landed` flips, so this is a
  // no-op correction) and mounting already-landed -- e.g. reopened from
  // Inbox, where the loop above never runs even once since setActive()
  // above keeps it inactive from the start. Without this, the canvas would
  // render the plane frozen at its initial (0,0)/t=0 state instead of the
  // completed route.
  //
  // react-hooks/immutability (the reactCompiler experiment's linter) flags
  // any `.value =` write to a useSharedValue result it didn't itself
  // originate inside a hook it specifically recognizes (useFrameCallback's
  // own callback, for frameWorklet above, is allowlisted; a plain effect
  // or useAnimatedReaction reaching the same shared values is not) --
  // false positive for Reanimated's actual, intended mutation pattern, not
  // a real bug. Same category of friction this file already works around
  // for react-hooks/exhaustive-deps on frameWorklet's own closing line.
  useEffect(() => {
    if (!landed || !geometry) return;
    const [pos, tan] = geometry.contour.getPosTan(geometry.length);
    /* eslint-disable react-hooks/immutability */
    progress.value = 1;
    planeX.value = pos.x;
    planeY.value = pos.y;
    planeAngle.value = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
    thermalScale.value = 1;
    smear.value = 1;
    birdAmount.value = 0;
    /* eslint-enable react-hooks/immutability */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed, geometry]);

  const planeTransform = useDerivedValue(() => [
    { translateX: planeX.value },
    { translateY: planeY.value },
    { rotate: (planeAngle.value * Math.PI) / 180 },
    { scale: thermalScale.value },
  ]);

  const speedLinesOpacity = useDerivedValue(() =>
    Math.max(0, Math.min(1, (thermalScale.value - 1) / 0.3)),
  );

  const rainOverlayEnd = useDerivedValue(() =>
    Math.max(RAIN_RANGE[0], Math.min(progress.value, RAIN_RANGE[1])),
  );

  const birdMarker = geometry?.markers.bird;
  const birdTransform = useDerivedValue(() => [
    { translateX: (birdMarker?.x ?? 0) - 30 + birdAmount.value * 60 },
    { translateY: (birdMarker?.y ?? 0) - 22 - birdAmount.value * 10 },
  ]);
  const birdOpacity = useDerivedValue(() => birdAmount.value);

  const treeMarkerOpacity = useDerivedValue<number>(() => (progress.value >= TREE_RANGE[0] ? 1 : 0.35));
  const birdMarkerOpacity = useDerivedValue(() => (progress.value >= BIRD_RANGE[1] ? 0.7 : 0.3));
  const windMarkerOpacity = useDerivedValue(() =>
    progress.value >= WIND_RANGE[0] ? (progress.value >= WIND_RANGE[1] ? 0.7 : 1) : 0.3,
  );
  const thermalMarkerOpacity = useDerivedValue(() =>
    progress.value >= THERMAL_RANGE[1] ? 0.7 : progress.value >= THERMAL_RANGE[0] ? 1 : 0.3,
  );

  return (
    <Canvas ref={canvasRef} style={styles.canvas}>
      {geometry ? (
        <Group>
          {/* Dotted guide for the full route */}
          <Path path={geometry.path} style="stroke" strokeWidth={1.5} color={PaperColors.pencil} opacity={0.5}>
            <DashPathEffect intervals={[1, 6]} />
          </Path>

          {/* Solid trail flown so far */}
          <Path
            path={geometry.path}
            style="stroke"
            strokeWidth={2.5}
            color={PaperColors.postalRed}
            start={0}
            end={progress}
          />

          {/* Rain-smeared segment of the trail, accumulates and stays */}
          <Path
            path={geometry.path}
            style="stroke"
            strokeWidth={5}
            color={PaperColors.rain}
            opacity={smear}
            start={RAIN_RANGE[0]}
            end={rainOverlayEnd}
          />

          <TreeMarker point={geometry.markers.tree} treePath={shapes.tree} opacity={treeMarkerOpacity} />
          <Circle
            cx={geometry.markers.bird.x}
            cy={geometry.markers.bird.y}
            r={4}
            color={PaperColors.ink}
            opacity={birdMarkerOpacity}
          />
          <Circle
            cx={geometry.markers.wind.x}
            cy={geometry.markers.wind.y}
            r={4}
            color={PaperColors.sky}
            opacity={windMarkerOpacity}
          />
          <Circle
            cx={geometry.markers.thermal.x}
            cy={geometry.markers.thermal.y}
            r={4}
            color={PaperColors.postalRed}
            opacity={thermalMarkerOpacity}
          />

          <Group transform={birdTransform} opacity={birdOpacity}>
            <Path path={shapes.bird} style="stroke" strokeWidth={1.5} color={PaperColors.ink} />
          </Group>

          <Group transform={planeTransform}>
            <Path
              path={shapes.speedLines}
              style="stroke"
              strokeWidth={2}
              color={PaperColors.sky}
              opacity={speedLinesOpacity}
            />
            <Path path={shapes.plane} color={PaperColors.ink} style="fill" />
          </Group>
        </Group>
      ) : null}
    </Canvas>
  );
}

function TreeMarker({
  point,
  treePath,
  opacity,
}: {
  point: { x: number; y: number };
  treePath: SkPath;
  opacity: DerivedValue<number>;
}) {
  const transform = useMemo(() => [{ translateX: point.x }, { translateY: point.y }], [point.x, point.y]);
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={treePath} color={PaperColors.pencil} style="fill" />
    </Group>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
});
