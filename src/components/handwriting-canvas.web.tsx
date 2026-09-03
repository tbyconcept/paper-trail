import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { StyleSheet, View } from 'react-native';

import type { HandwritingCanvasProps } from './handwriting-canvas-impl';

export type {
  CapturedPoint,
  CapturedStroke,
  HandwritingCanvasProps,
  StrokeDocument,
} from './handwriting-canvas-impl';

// web only: see flight-canvas.web.tsx's header comment -- same reasoning
// applies here, `handwriting-canvas-impl.tsx` must only be reached through
// this dynamic import(), issued by WithSkiaWeb after its LoadSkiaWeb() call
// has resolved and set global.CanvasKit.
export function HandwritingCanvas(props: HandwritingCanvasProps) {
  return (
    <WithSkiaWeb
      getComponent={() => import('./handwriting-canvas-impl')}
      opts={{ locateFile: (file: string) => `/${file}` }}
      componentProps={props}
      fallback={<View style={styles.fallback} />}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
  },
});
