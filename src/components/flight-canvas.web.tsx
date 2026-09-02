import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { StyleSheet, View } from 'react-native';

import type { FlightCanvasProps } from './flight-canvas-impl';

export type { FlightCanvasProps, FlightEvent, FlightEventType } from './flight-canvas-impl';

// web only: `Skia` (imported at the top of flight-canvas-impl.tsx) is bound
// to `global.CanvasKit` at module-evaluation time (see node_modules'
// skia/Skia.web.js), so that module must never be statically imported here
// -- only reached through this dynamic import(), issued by WithSkiaWeb
// after its LoadSkiaWeb() call has resolved and set global.CanvasKit.
// canvaskit.wasm itself is copied to public/ (served at site root by Expo
// Router's static web output) by scripts/copy-canvaskit-wasm.js, run on
// `npm install`.
export function FlightCanvas(props: FlightCanvasProps) {
  return (
    <WithSkiaWeb
      getComponent={() => import('./flight-canvas-impl')}
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
