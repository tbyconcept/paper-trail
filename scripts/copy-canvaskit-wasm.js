#!/usr/bin/env node
// Copies CanvasKit's wasm binary into public/, where Expo Router's static
// web output serves files verbatim at the site root. FlightCanvas's
// useSkiaReady() (src/components/flight-canvas.tsx) points LoadSkiaWeb's
// locateFile at that same root. Web-only -- skipped harmlessly if
// canvaskit-wasm isn't installed (e.g. a native-only CI job).
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'node_modules', 'canvaskit-wasm', 'bin', 'full', 'canvaskit.wasm');
const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'canvaskit.wasm');

if (!fs.existsSync(src)) {
  console.warn('copy-canvaskit-wasm: canvaskit-wasm not found, skipping (web Skia support won\'t work).');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`copy-canvaskit-wasm: wrote ${path.relative(process.cwd(), dest)}`);
