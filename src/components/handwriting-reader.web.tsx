import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { StyleSheet, View } from 'react-native';

import type { HandwritingReaderProps } from './handwriting-reader-impl';

export type { HandwritingReaderProps } from './handwriting-reader-impl';

// web only: see flight-canvas.web.tsx's header comment -- same reasoning
// applies here, `handwriting-reader-impl.tsx` must only be reached through
// this dynamic import(), issued by WithSkiaWeb after its LoadSkiaWeb() call
// has resolved and set global.CanvasKit.
export function HandwritingReader(props: HandwritingReaderProps) {
  return (
    <WithSkiaWeb
      getComponent={() => import('./handwriting-reader-impl')}
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
