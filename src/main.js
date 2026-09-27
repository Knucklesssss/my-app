import { segmentForeground } from '@imgly/background-removal';
import { encode as encodePng } from 'fast-png';
import { zipSync } from 'fflate';

// Model files are fetched from IMG.LY's CDN by default. `?data=<url>` points at a
// self-hosted copy of @imgly/background-removal-data instead.
const params = new URLSearchParams(location.search);
const publicPath = params.get('data') || undefined;
const bundledModel = publicPath?.startsWith('app:'); // desktop build ships the model
if (bundledModel) {
  document.querySelector('#modelnote').textContent = '模型已內建，可離線使用。';
  for (const opt of document.querySelectorAll('#model option')) opt.textContent = opt.textContent.replace(/（.*）/, '');
}

// Keep one config object per model: the library memoizes sessions by config.
const configs = {};
function configFor(model) {
  if (!configs[model]) {
    configs[model] = {
      model,
      ...(publicPath && { publicPath }),
      output: { format: 'image/x-alpha8' },
      progress: onProgress,
    };
  }
  return configs[model];
}

const $ = (sel) => document.querySelector(sel);
const fileInput = $('#file');
const dropzone = $('#dropzone');
const list = $('#list');
const statusEl = $('#status');
const progressBar = $('#progress');
const modelSelect = $('#model');
const bgSelect = $('#bg');
const bgColor = $('#bgcolor');
const zipBtn = $('#zip');
const clearBtn = $('#clear');

const items = []; // { name, width, height, rgba, alpha, card }
const queue = [];
let busy = false;

// ---------- status / progress ----------
const downloads = {};
function onProgress(key, current, total) {
  if (!key.startsWith('fetch:')) return;
  downloads[key] = [current, total];
  let done = 0, all = 0;
  for (const [c, t] of Object.values(downloads)) { done += c; all += t; }
  if (all > 0) {
    const pct = Math.min(100, Math.round((done / all) * 100));
    setStatus(bundledModel
      ? `載入 AI 模型中… ${pct}%`
      : `首次使用，下載 AI 模型中… ${pct}%（${mb(done)} / ${mb(all)} MB，之後會快取）`, pct);
  }
}
const mb = (n) => (n / 1048576).toFixed(1);
function setStatus(text, pct) {
  statusEl.textContent = text;
  if (pct == null) {
    progressBar.hidden = true;
  } else {
    progressBar.hidden = false;
    progressBar.value = pct;
  }
}

// ---------- image helpers ----------
async function decodeRGBA(blob) {
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, rgba: new Uint8Array(data.buffer) };
}

async function computeAlpha(img, model) {
  // Hand the already-decoded pixels to the model so the mask has exactly our dimensions.
  const raw = new Blob([img.rgba], { type: `image/x-rgba8;width=${img.width};height=${img.height}` });
  const maskBlob = await segmentForeground(raw, configFor(model));
  const mask = new Uint8Array(await maskBlob.arrayBuffer());
  if (mask.length !== img.width * img.height) throw new Error('遮罩尺寸不符');
  // Respect any transparency the source already had.
  for (let i = 0, p = 3; i < mask.length; i++, p += 4) {
    const a = img.rgba[p];
    if (a !== 255) mask[i] = Math.round((mask[i] * a) / 255);
  }
  return mask;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Builds the output pixels. Transparent mode keeps every original RGB value untouched
// and only writes the alpha channel; nothing is resampled or recompressed.
function composeRGBA(item) {
  const { rgba, alpha } = item;
  const out = new Uint8Array(rgba.length);
  if (bgSelect.value === 'transparent') {
    out.set(rgba);
    for (let i = 0, p = 3; i < alpha.length; i++, p += 4) out[p] = alpha[i];
    return out;
  }
  const [br, bg, bb] = bgSelect.value === 'white' ? [255, 255, 255] : hexToRgb(bgColor.value);
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    const a = alpha[i], ia = 255 - a;
    out[p] = (rgba[p] * a + br * ia + 127) / 255;
    out[p + 1] = (rgba[p + 1] * a + bg * ia + 127) / 255;
    out[p + 2] = (rgba[p + 2] * a + bb * ia + 127) / 255;
    out[p + 3] = 255;
  }
  return out;
}

// fast-png writes straight RGBA, avoiding the canvas premultiply round-trip that
// would quantize semi-transparent edge colors.
function toPngBytes(item) {
  return encodePng({ width: item.width, height: item.height, data: composeRGBA(item), channels: 4, depth: 8 });
}

function outName(name) {
  return name.replace(/\.[^.]+$/, '') + '_nobg.png';
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---------- UI ----------
function makeCard(file) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="preview checker"><div class="spinner" aria-label="處理中"></div></div>
    <div class="meta">
      <div class="name"></div>
      <div class="info">等待中…</div>
      <div class="actions">
        <button class="compare" type="button" disabled>按住看原圖</button>
        <button class="download primary" type="button" disabled>下載 PNG</button>
      </div>
    </div>`;
  card.querySelector('.name').textContent = file.name;
  list.prepend(card);
  return card;
}

function renderPreview(item) {
  const canvas = document.createElement('canvas');
  canvas.width = item.width;
  canvas.height = item.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(composeRGBA(item).buffer), item.width, item.height), 0, 0);
  const box = item.card.querySelector('.preview');
  box.replaceChildren(canvas);
  item.preview = canvas;
}

function showOriginal(item, on) {
  if (!item.preview) return;
  if (on) {
    const c = document.createElement('canvas');
    c.width = item.width;
    c.height = item.height;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(item.rgba), item.width, item.height), 0, 0);
    item.card.querySelector('.preview').replaceChildren(c);
  } else {
    item.card.querySelector('.preview').replaceChildren(item.preview);
  }
}

function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|bmp|gif|avif|heic)$/i.test(file.name)) continue;
    queue.push({ file, card: makeCard(file) });
  }
  pump();
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const { file, card } = queue.shift();
    const info = card.querySelector('.info');
    try {
      info.textContent = '解碼中…';
      const img = await decodeRGBA(file);
      info.textContent = `AI 去背中…（${img.width}×${img.height}）`;
      setStatus(`處理中：${file.name}`, null);
      const t0 = performance.now();
      const alpha = await computeAlpha(img, modelSelect.value);
      const item = { name: file.name, ...img, alpha, card };
      items.push(item);
      renderPreview(item);
      info.textContent = `${img.width}×${img.height} · 原尺寸無損 PNG · ${((performance.now() - t0) / 1000).toFixed(1)} 秒`;
      const dl = card.querySelector('.download');
      dl.disabled = false;
      dl.onclick = () => saveBlob(new Blob([toPngBytes(item)], { type: 'image/png' }), outName(item.name));
      const cmp = card.querySelector('.compare');
      cmp.disabled = false;
      cmp.addEventListener('pointerdown', () => showOriginal(item, true));
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) cmp.addEventListener(ev, () => showOriginal(item, false));
    } catch (err) {
      console.error(err);
      card.classList.add('error');
      card.querySelector('.preview').replaceChildren();
      info.textContent = `失敗：${err.message || err}`;
    }
  }
  busy = false;
  zipBtn.disabled = items.length === 0;
  clearBtn.disabled = items.length === 0;
  setStatus(items.length ? `完成，共 ${items.length} 張。圖片全程只在你的裝置上處理。` : '選擇或拖放圖片開始。', null);
}

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
for (const ev of ['dragenter', 'dragover']) {
  document.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('over'); });
}
for (const ev of ['dragleave', 'drop']) {
  document.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('over'); });
}
document.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
document.addEventListener('paste', (e) => {
  const files = [...e.clipboardData.items].filter((i) => i.kind === 'file').map((i) => i.getAsFile());
  if (files.length) addFiles(files);
});

function refreshPreviews() {
  bgColor.hidden = bgSelect.value !== 'color';
  for (const item of items) renderPreview(item);
}
bgSelect.addEventListener('change', refreshPreviews);
bgColor.addEventListener('input', refreshPreviews);

zipBtn.addEventListener('click', () => {
  const entries = {};
  for (const item of items) {
    let name = outName(item.name), n = 1;
    while (entries[name]) name = outName(item.name).replace(/\.png$/, `_${++n}.png`);
    entries[name] = [toPngBytes(item), { level: 0 }]; // PNG is already compressed
  }
  saveBlob(new Blob([zipSync(entries)], { type: 'application/zip' }), 'nobg-images.zip');
});

clearBtn.addEventListener('click', () => {
  items.length = 0;
  list.replaceChildren();
  zipBtn.disabled = clearBtn.disabled = true;
  setStatus('選擇或拖放圖片開始。', null);
});

// Test hook: lets automated checks read the exact output pixels.
window.__bgRemover = { items, composeRGBA, toPngBytes };
