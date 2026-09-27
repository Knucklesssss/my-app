// Copies only the model and wasm files the app uses from @imgly/background-removal-data
// into build/data, so the desktop app works offline without shipping unused variants.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const src = path.dirname(require.resolve('@imgly/background-removal-data/dist/resources.json'));
const out = path.resolve('build/data');

const keep = [
  '/models/small',
  '/models/medium',
  '/onnxruntime-web/ort-wasm.wasm',
  '/onnxruntime-web/ort-wasm-simd.wasm',
  '/onnxruntime-web/ort-wasm-threaded.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
];

const resources = JSON.parse(fs.readFileSync(path.join(src, 'resources.json'), 'utf8'));
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const filtered = {};
let bytes = 0;
for (const key of keep) {
  const entry = resources[key];
  if (!entry) throw new Error(`missing resource ${key}`);
  filtered[key] = entry;
  for (const chunk of entry.chunks) {
    fs.copyFileSync(path.join(src, chunk.hash), path.join(out, chunk.hash));
  }
  bytes += entry.size;
}
fs.writeFileSync(path.join(out, 'resources.json'), JSON.stringify(filtered));
console.log(`model data: ${Object.keys(filtered).length} resources, ${(bytes / 1048576).toFixed(1)} MB -> ${out}`);
