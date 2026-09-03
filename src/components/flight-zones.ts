// Progress-range zones a flight passes through, in departure order. Purely
// client-side/visual -- the server never sees these, since it alone owns
// departed_at/duration_ms (see 20260901140000_send_flow.sql's header note).
//
// Split out from flight-canvas-impl.tsx (rather than just imported from it)
// so this pure data can be imported by non-Skia code too -- Tracking uses
// it to backfill the flight log for a message that's already landed when
// first opened (e.g. from Inbox), where the real per-frame zone events
// never ran. flight-canvas-impl.tsx's own `Skia` import can't be pulled in
// by that path: on web it's bound to `global.CanvasKit` at
// *module-evaluation* time (see that file's header comment), so anything
// that imports it must go through the dynamic-import-after-ready wrappers
// (flight-canvas.tsx/.web.tsx) -- this file has no such requirement.

export type FlightEventType = 'wind' | 'rain' | 'thermal' | 'bird' | 'tree';

export type FlightEvent = {
  type: FlightEventType;
  label: string;
  at: number;
};

export const TREE_RANGE: [number, number] = [0.06, 0.13];
export const BIRD_RANGE: [number, number] = [0.2, 0.27];
export const WIND_RANGE: [number, number] = [0.34, 0.5];
export const RAIN_RANGE: [number, number] = [0.6, 0.8];
export const THERMAL_RANGE: [number, number] = [0.86, 0.95];

export const ZONES: { type: FlightEventType; range: [number, number]; label: string }[] = [
  { type: 'tree', range: TREE_RANGE, label: 'Grazed a tree line on the way up' },
  { type: 'bird', range: BIRD_RANGE, label: 'Startled a flock of birds' },
  { type: 'wind', range: WIND_RANGE, label: 'Caught in a crosswind, correcting course' },
  { type: 'rain', range: RAIN_RANGE, label: 'Flying through rain — ink is starting to smear' },
  { type: 'thermal', range: THERMAL_RANGE, label: 'Caught a warm updraft, picking up speed' },
];
