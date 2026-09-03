// Native entry point. Metro resolves this file for ios/android; web gets
// handwriting-reader.web.tsx instead, which lazy-loads the same
// implementation only after CanvasKit is ready (see that file's header
// comment for why).
export { default as HandwritingReader } from './handwriting-reader-impl';
export type { HandwritingReaderProps } from './handwriting-reader-impl';
