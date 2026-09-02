// Native entry point. Metro resolves this file for ios/android; web gets
// flight-canvas.web.tsx instead, which lazy-loads the same implementation
// only after CanvasKit is ready (see that file's header comment for why).
export { default as FlightCanvas } from './flight-canvas-impl';
export type { FlightCanvasProps, FlightEvent, FlightEventType } from './flight-canvas-impl';
