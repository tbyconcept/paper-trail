import { Canvas, Group, Path, useCanvasSize } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { buildStrokePath, type StrokeDocument } from './handwriting-stroke-path';

// See flight-canvas-impl.tsx's header comment -- same rule applies here:
// this module must only be reached after Skia is ready (native: always;
// web: only via handwriting-reader.web.tsx's dynamic import).

export type HandwritingReaderProps = {
  document: StrokeDocument;
  penColor?: string;
};

export default function HandwritingReaderImpl({ document, penColor = '#2C3A4A' }: HandwritingReaderProps) {
  // Static (read-only) counterpart to HandwritingCanvasImpl -- same
  // buildStrokePath geometry, no gesture handling, no committed/active
  // state, since the document is already finished.
  const { ref: canvasRef, size } = useCanvasSize();

  const paths = useMemo(() => document.strokes.map((s) => buildStrokePath(s.points)), [document]);

  // The document was captured at the compose-time canvas's own size, which
  // is rarely the same box this is read back in (different screen,
  // different card layout) -- scale-to-fit and center, same as an image
  // with `resizeMode: contain`.
  const transform = useMemo(() => {
    if (size.width <= 0 || size.height <= 0 || document.width <= 0 || document.height <= 0) {
      return [];
    }
    const scale = Math.min(size.width / document.width, size.height / document.height);
    const offsetX = (size.width - document.width * scale) / 2;
    const offsetY = (size.height - document.height * scale) / 2;
    return [{ translateX: offsetX }, { translateY: offsetY }, { scale }];
  }, [size.width, size.height, document.width, document.height]);

  return (
    <Canvas ref={canvasRef} style={styles.canvas}>
      <Group transform={transform}>
        {paths.map((path, i) => (path ? <Path key={i} path={path} color={penColor} style="fill" /> : null))}
      </Group>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
});
