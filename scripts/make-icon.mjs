// Draws build/icon.png (256×256): a person silhouette whose right half sits on a
// transparency checkerboard, i.e. "background removed".
import fs from 'node:fs';
import { encode } from 'fast-png';

const S = 256, SS = 4; // supersample for smooth edges
const data = new Uint8Array(S * S * 4);

function sample(x, y) {
  const r = 48, m = 12; // rounded-square corner radius and margin
  const cx = Math.min(Math.max(x, m + r), S - m - r), cy = Math.min(Math.max(y, m + r), S - m - r);
  if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return null;
  const head = (x - 128) ** 2 + (y - 98) ** 2 < 40 ** 2;
  const body = ((x - 128) / 78) ** 2 + ((y - 214) / 74) ** 2 < 1 && y < 244 - m;
  if (head || body) return [255, 255, 255];
  if (x > y) { // transparent side
    const c = ((Math.floor(x / 22) + Math.floor(y / 22)) & 1) ? 222 : 250;
    return [c, c, c];
  }
  const t = y / S; // blue gradient background
  return [Math.round(37 + 30 * t), Math.round(99 + 40 * t), Math.round(235 - 20 * t)];
}

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const c = sample(x + (i + 0.5) / SS, y + (j + 0.5) / SS);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
    }
    const p = (y * S + x) * 4;
    if (a) { data[p] = r / a; data[p + 1] = g / a; data[p + 2] = b / a; }
    data[p + 3] = Math.round((a / (SS * SS)) * 255);
  }
}

fs.mkdirSync('build', { recursive: true });
fs.writeFileSync('build/icon.png', encode({ width: S, height: S, data, channels: 4, depth: 8 }));
console.log('wrote build/icon.png');
