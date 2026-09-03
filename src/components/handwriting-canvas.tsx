// Native entry point. Metro resolves this file for ios/android; web gets
// handwriting-canvas.web.tsx instead, which lazy-loads the same
// implementation only after CanvasKit is ready (see that file's header
// comment for why).
export { default as HandwritingCanvas } from './handwriting-canvas-impl';
export type {
  CapturedPoint,
  CapturedStroke,
  HandwritingCanvasProps,
  StrokeDocument,
} from './handwriting-canvas-impl';
