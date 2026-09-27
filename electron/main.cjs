const { app, BrowserWindow, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Serve the app from a custom scheme so fetch() works and we can send the
// cross-origin-isolation headers that let the model use multiple CPU threads.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const appRoot = path.join(__dirname, '..');
const dataRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'data')
  : path.join(appRoot, 'build', 'data');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
};

function resolveFile(urlPath) {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const [base, sub] = rel.startsWith('data/') ? [dataRoot, rel.slice(5)] : [appRoot, rel || 'index.html'];
  const file = path.normalize(path.join(base, sub));
  return file.startsWith(base + path.sep) ? file : null;
}

function handleRequest(request) {
  const file = resolveFile(new URL(request.url).pathname);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return new Response('Not found', { status: 404 });
  }
  const body = fs.readFileSync(file);
  return new Response(body, {
    headers: {
      'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 420,
    minHeight: 500,
    title: '無損自動去背',
    icon: path.join(appRoot, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  // Open external links (e.g. the license link) in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL('app://local/index.html?data=' + encodeURIComponent('app://local/data/'));
}

app.whenReady().then(() => {
  protocol.handle('app', handleRequest);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
