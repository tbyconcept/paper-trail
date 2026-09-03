import { Canvas, Path, useCanvasSize } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  type GestureStateChangeEvent,
  type GestureUpdateEvent,
  type PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PaperColors, Spacing } from '@/constants/theme';

import {
  buildStrokePath,
  type CapturedPoint,
  type CapturedStroke,
  type StrokeDocument,
} from './handwriting-stroke-path';

// See flight-canvas-impl.tsx's header comment -- same rule applies here:
// this module must only be reached after Skia is ready (native: always;
// web: only via handwriting-canvas.web.tsx's dynamic import).

// Re-exported for existing consumers (handwriting-canvas.tsx/.web.tsx,
// src/lib/messages.ts) -- the types themselves now live in
// handwriting-stroke-path.ts, shared with the read-only renderer.
export type { CapturedPoint, CapturedStroke, StrokeDocument };

export type HandwritingCanvasProps = {
  penColor?: string;
  onChangeStrokes: (strokes: StrokeDocument | null) => void;
};

type PanEvent =
  | GestureUpdateEvent<PanGestureHandlerEventPayload>
  | GestureStateChangeEvent<PanGestureHandlerEventPayload>;

function toPoint(event: PanEvent): CapturedPoint {
  const stylus = event.stylusData;
  return {
    x: event.x,
    y: event.y,
    pressure: stylus?.pressure,
    tiltX: stylus?.tiltX,
    tiltY: stylus?.tiltY,
  };
}

export default function HandwritingCanvasImpl({
  penColor = PaperColors.ink,
  onChangeStrokes,
}: HandwritingCanvasProps) {
  // Canvas's onLayout isn't supported on Fabric (see Canvas.tsx's own
  // deprecation warning) -- useCanvasSize() is Skia's replacement, backed
  // by an imperative .measure() call on the underlying native view rather
  // than a layout event.
  const { ref: canvasRef, size } = useCanvasSize();

  // strokes/active live in one object so onEnd can commit the just-finished
  // stroke via a functional setState update -- no ref needed to read
  // "current" points, which avoids depending on a mutable value from
  // inside a gesture callback closed over at render time.
  const [canvasState, setCanvasState] = useState<{ strokes: CapturedStroke[]; active: CapturedPoint[] }>({
    strokes: [],
    active: [],
  });

  useEffect(() => {
    const { strokes } = canvasState;
    onChangeStrokes(strokes.length > 0 ? { width: size.width, height: size.height, strokes } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasState.strokes]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Runs handlers on the JS thread so they can call setState directly
        // -- this canvas captures discrete points rather than driving a
        // continuous animation, so there's no need for UI-thread worklets.
        .runOnJS(true)
        .minDistance(0)
        .onBegin((e) => {
          const point = toPoint(e);
          setCanvasState((prev) => ({ ...prev, active: [point] }));
        })
        .onUpdate((e) => {
          const point = toPoint(e);
          setCanvasState((prev) => ({ ...prev, active: [...prev.active, point] }));
        })
        .onEnd((_e, success) => {
          setCanvasState((prev) =>
            success && prev.active.length > 0
              ? { strokes: [...prev.strokes, { points: prev.active }], active: [] }
              : { ...prev, active: [] },
          );
        }),
    [],
  );

  const committedPaths = useMemo(
    () => canvasState.strokes.map((s) => buildStrokePath(s.points)),
    [canvasState.strokes],
  );
  const activePath = useMemo(() => buildStrokePath(canvasState.active), [canvasState.active]);
  const hasContent = canvasState.strokes.length > 0 || canvasState.active.length > 0;

  const handleClear = useCallback(() => {
    setCanvasState({ strokes: [], active: [] });
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemedView type="backgroundElement" style={styles.container}>
        <View style={styles.toolbar}>
          <Pressable onPress={handleClear} disabled={!hasContent} hitSlop={12}>
            <ThemedText type="link" themeColor={hasContent ? 'accent' : 'textSecondary'}>
              Clear
            </ThemedText>
          </Pressable>
        </View>
        <GestureDetector gesture={pan}>
          <Canvas ref={canvasRef} style={styles.canvas}>
            {committedPaths.map((path, i) =>
              path ? <Path key={i} path={path} color={penColor} style="fill" /> : null,
            )}
            {activePath ? <Path path={activePath} color={penColor} style="fill" /> : null}
          </Canvas>
        </GestureDetector>
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  canvas: {
    flex: 1,
  },
});
