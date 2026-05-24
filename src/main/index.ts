import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  screen,
  shell,
  Tray
} from 'electron';
import { autoUpdater } from 'electron-updater';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { buildPrompt } from './ai/promptBuilder';
import { OpenAIProvider } from './ai/providers/openai';
import { AnthropicProvider } from './ai/providers/anthropic';
import { GroqProvider } from './ai/providers/groq';
import { OpenRouterProvider } from './ai/providers/openrouter';
import { GeminiProvider } from './ai/providers/gemini';
import { OllamaProvider } from './ai/providers/ollama';
import type { RewriteProvider } from './ai/types';
import { delay, pasteReplacement, readFocusedText, restoreClipboard, snapshotClipboard } from './clipboard';
import { getSettings, recordRewriteUsage, resetSettings, saveSettings } from './settings';
import { registerShortcuts } from './shortcuts';
import type { LiSettings, PopupState, RewriteAction, RewriteRequest, StylePreset, UpdaterState } from '../shared/types';

let tray: Tray | null = null;
let popupWindow: BrowserWindow | null = null;
let progressWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let popupState: PopupState = {
  visible: false,
  mode: 'palette',
  status: 'idle',
  message: '',
  styleId: 'friendly'
};
let updaterState: UpdaterState = { phase: 'idle' };

const providers: Record<string, RewriteProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  groq: new GroqProvider(),
  openrouter: new OpenRouterProvider(),
  gemini: new GeminiProvider(),
  ollama: new OllamaProvider()
};

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
let progressFollowTimer: NodeJS.Timeout | null = null;

function formatStat(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function countSymbols(value: string): number {
  return Array.from(value).length;
}

// ── Logo rects in the 63×63 SVG coordinate space ──────────────────────────
// All SVG paths use only M/V/H — straight lines — so they tile into rectangles.
// Path 1: M48 16 V24 H40 V16 H48 Z
// Path 2: M48 32 V40 H56 V48 H40 V40 H32 V32 H48 Z
// Path 3: M16 16 V40 H32 V48 H8 V16 H16 Z
const LOGO_RECTS: Array<[number, number, number, number]> = [
  [40, 16,  8,  8], // "i" top cap
  [32, 32, 16,  8], // "i" upper step
  [40, 40, 16,  8], // "i" lower step
  [ 8, 16,  8, 24], // "l" vertical bar
  [ 8, 40, 24,  8], // "l" base
];

function pngChunk(type: string, data: Buffer): Buffer {
  let crc = 0xffffffff;
  const combined = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  for (const byte of combined) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  crc = (crc ^ 0xffffffff) >>> 0;

  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, Buffer.from(type, 'ascii'), data, crcBuf]);
}

function buildPng(size: number, fillPixel: (idx: number, rgba: Buffer) => void): string {
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) fillPixel(i, rgba);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

// Tray icon: black-on-transparent (macOS template image tints it automatically)
function createLogoPng(size: number): string {
  const scale = size / 63;
  const mask = Buffer.alloc(size * size).fill(0);
  for (const [rx, ry, rw, rh] of LOGO_RECTS) {
    const x0 = Math.round(rx * scale), y0 = Math.round(ry * scale);
    const x1 = Math.round((rx + rw) * scale), y1 = Math.round((ry + rh) * scale);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        mask[y * size + x] = 1;
  }
  return buildPng(size, (i, rgba) => { rgba[i * 4 + 3] = mask[i] ? 255 : 0; });
}

// Dock icon: dark background + white logo, macOS squircle corners baked in.
// macOS does NOT auto-apply the squircle mask to programmatic dock icons,
// so we render it ourselves (r ≈ 22.5 % — matches macOS Big Sur guidelines).
function createDockIconPng(size: number): string {
  // Logo: 20 % padding each side so it breathes inside the squircle
  const padding = Math.round(size * 0.20);
  const scale   = (size - padding * 2) / 63;

  // Paint logo rects into a bitmask
  const logoMask = Buffer.alloc(size * size).fill(0);
  for (const [rx, ry, rw, rh] of LOGO_RECTS) {
    const x0 = Math.round(padding + rx * scale);
    const y0 = Math.round(padding + ry * scale);
    const x1 = Math.max(x0 + 1, Math.round(padding + (rx + rw) * scale));
    const y1 = Math.max(y0 + 1, Math.round(padding + (ry + rh) * scale));
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        logoMask[y * size + x] = 1;
  }

  // Squircle mask — standard rounded-rect SDF, r = 22.5 % of size
  const r  = size * 0.225;
  const cx = size / 2, cy = size / 2;
  const hx = cx - r, hy = cy - r; // inner-rect half-extents

  return buildPng(size, (i, rgba) => {
    const x = i % size, y = Math.floor(i / size);

    // Distance from pixel to the inner rectangle (shrunk by r on each side)
    const dx = Math.max(0, Math.abs(x - cx) - hx);
    const dy = Math.max(0, Math.abs(y - cy) - hy);
    const inSquircle = dx * dx + dy * dy <= r * r;

    if (!inSquircle) {
      rgba[i * 4 + 3] = 0; // transparent outside rounded corners
      return;
    }

    if (logoMask[i]) {
      rgba[i * 4] = 255; rgba[i * 4 + 1] = 255; rgba[i * 4 + 2] = 255; // white logo
    } else {
      rgba[i * 4] = 5;   rgba[i * 4 + 1] = 6;   rgba[i * 4 + 2] = 8;   // ink bg
    }
    rgba[i * 4 + 3] = 255;
  });
}

function logoSvgUrl(size: number, fill: string, bg?: string): string {
  const paths =
    `<path d="M48 16V24H40V16H48ZM48 32V40H56V48H40V40H32V32H48Z" fill="${fill}"/>` +
    `<path d="M16 16V40H32V48H8V16H16Z" fill="${fill}"/>`;
  const bgRect = bg ? `<rect width="63" height="63" rx="11" fill="${bg}"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 63 63" fill="none">${bgRect}${paths}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createTrayIcon(): Electron.NativeImage {
  if (process.platform === 'darwin') {
    // macOS requires a real PNG for template images — SVG data URLs aren't supported
    // by NSImage in the context nativeImage uses. Render logo rects into a bitmap.
    const image = nativeImage.createFromDataURL(createLogoPng(22));
    image.addRepresentation({ scaleFactor: 2, dataURL: createLogoPng(44) });
    image.setTemplateImage(true);
    return image;
  }

  // Windows / Linux: Chromium handles SVG data URLs fine.
  return nativeImage.createFromDataURL(logoSvgUrl(32, '#c6ff6b', '#050608'));
}

function loadRenderer(window: BrowserWindow, hash: string): void {
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/#/${hash}`);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/${hash}` });
  }
}

function getPopupSize(mode: PopupState['mode']): { width: number; height: number } {
  return mode === 'progress' ? { width: 34, height: 34 } : { width: 440, height: 360 };
}

function createProgressWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 34,
    height: 34,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    movable: false,
    fullscreenable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true);
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :root {
            --sp-track:  rgba(255, 255, 255, 0.18);
            --sp-active: #ffffff;
          }

          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            overflow: hidden;
            background: transparent;
          }

          body {
            display: grid;
            place-items: center;
          }

          .spinner {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid var(--sp-track);
            border-top-color: var(--sp-active);
            animation: spin 0.7s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body><div class="spinner" aria-label="Li is rewriting"></div></body>
    </html>
  `)}`);

  return win;
}

function createPopupWindow(): BrowserWindow {
  const { width, height } = getPopupSize('palette');

  const win = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    movable: false,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.on('blur', () => {
    if (popupState.status === 'idle') {
      hidePopup();
    }
  });

  loadRenderer(win, 'popup');
  return win;
}

function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 760,
    minHeight: 620,
    title: 'Li Settings',
    backgroundColor: '#050608',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.once('ready-to-show', () => {
    win.show();
    win.webContents.send('updater-state', updaterState);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  loadRenderer(win, 'settings');
  return win;
}

function positionPopup(): void {
  if (!popupWindow) {
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const bounds = display.workArea;
  const [width, height] = popupWindow.getSize();

  const target =
    popupState.mode === 'progress'
      ? {
          x: cursor.x + 16,
          y: cursor.y - height / 2
        }
      : {
          x: cursor.x - width / 2,
          y: cursor.y + 18
        };

  const x = Math.round(Math.min(Math.max(target.x, bounds.x + 8), bounds.x + bounds.width - width - 8));
  const y = Math.round(Math.min(Math.max(target.y, bounds.y + 8), bounds.y + bounds.height - height - 8));

  popupWindow.setPosition(x, y, false);
}

function positionProgressWindow(): void {
  if (!progressWindow || progressWindow.isDestroyed()) {
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const bounds = display.workArea;
  const [width, height] = progressWindow.getSize();
  const x = Math.round(Math.min(Math.max(cursor.x + 16, bounds.x + 8), bounds.x + bounds.width - width - 8));
  const y = Math.round(Math.min(Math.max(cursor.y - height / 2, bounds.y + 8), bounds.y + bounds.height - height - 8));

  progressWindow.setPosition(x, y, false);
}

function applyProgressTheme(): void {
  if (!progressWindow || progressWindow.isDestroyed()) {
    return;
  }

  const settings = getSettings();
  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'auto' && nativeTheme.shouldUseDarkColors);

  // Dark: white   Light: near-black
  const track  = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(10,10,12,0.18)';
  const active = isDark ? '#ffffff' : '#0a0a0c';

  void progressWindow.webContents.executeJavaScript(
    `document.documentElement.style.setProperty('--sp-track','${track}');` +
    `document.documentElement.style.setProperty('--sp-active','${active}');`
  );
}

function showProgressSpinner(): void {
  if (!progressWindow || progressWindow.isDestroyed()) {
    progressWindow = createProgressWindow();
  }

  applyProgressTheme();
  positionProgressWindow();
  progressWindow.showInactive();

  if (!progressFollowTimer) {
    progressFollowTimer = setInterval(positionProgressWindow, 60);
  }
}

function hideProgressSpinner(): void {
  if (progressFollowTimer) {
    clearInterval(progressFollowTimer);
    progressFollowTimer = null;
  }

  progressWindow?.hide();
}

function sendPopupState(): void {
  popupWindow?.webContents.send('popup-state', popupState);
}

function showPopup(nextState: Partial<PopupState>, options: { focus?: boolean } = {}): void {
  if (!popupWindow || popupWindow.isDestroyed()) {
    popupWindow = createPopupWindow();
  }

  const shouldFocus = options.focus ?? true;

  popupState = {
    ...popupState,
    visible: true,
    ...nextState
  };

  const { width, height } = getPopupSize(popupState.mode);
  popupWindow.setSize(width, height, false);
  popupWindow.setFocusable(shouldFocus);
  positionPopup();

  if (shouldFocus) {
    popupWindow.show();
    popupWindow.focus();
  } else {
    popupWindow.showInactive();
  }

  sendPopupState();
}

function hidePopup(): void {
  popupState = {
    ...popupState,
    visible: false,
    status: 'idle',
    message: '',
    error: undefined
  };

  popupWindow?.setFocusable(true);
  popupWindow?.hide();
  hideProgressSpinner();
  sendPopupState();
}

function getStyle(settings: LiSettings, action: RewriteAction, styleId?: string): StylePreset {
  const fallbackByAction: Record<RewriteAction, string> = {
    grammar: 'grammar',
    rephrase: settings.selectedStyleId,
    translate: 'translate-english'
  };

  const id = styleId || fallbackByAction[action];
  return (
    settings.stylePresets.find((preset) => preset.id === id) ||
    settings.stylePresets.find((preset) => preset.id === fallbackByAction[action]) ||
    settings.stylePresets[0]
  );
}

async function performRewrite(request: RewriteRequest): Promise<string> {
  const settings = getSettings();
  const provider = providers[settings.provider];

  if (!provider) {
    throw new Error(`Provider "${settings.provider}" is not available.`);
  }

  const previousClipboard = snapshotClipboard();

  try {
    const selectedText = await readFocusedText();

    if (!selectedText.trim()) {
      throw new Error('No selected or focused text found.');
    }

    if (settings.devLogging) {
      console.info(`[Li] captured ${selectedText.length} characters for ${request.action}`);
    }

    showProgressSpinner();

    const style = getStyle(settings, request.action, request.styleId);
    const prompt = buildPrompt({
      action: request.action,
      selectedText,
      style,
      emojiEnabled: settings.emojiEnabled,
      personalWritingStyle: settings.personalWritingStyle
    });

    const rewritten = await provider.rewrite({ prompt, settings });

    await pasteReplacement(rewritten);

    try {
      updateTrayMenu(recordRewriteUsage(countSymbols(selectedText)));
    } catch (error) {
      if (settings.devLogging) {
        console.warn('[Li] failed to update usage stats', error);
      }
    }

    hideProgressSpinner();

    restoreClipboard(previousClipboard);
    await delay(250);
    hidePopup();

    return rewritten;
  } catch (error) {
    hideProgressSpinner();
    restoreClipboard(previousClipboard);
    return Promise.reject(error);
  }
}

function openPalette(): void {
  const settings = getSettings();

  showPopup({
    mode: 'palette',
    status: 'idle',
    message: '',
    error: undefined,
    styleId: settings.selectedStyleId
  }, { focus: true });
}

function openSettingsWindow(): void {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    settingsWindow = createSettingsWindow();
    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });
    return;
  }

  settingsWindow.show();
  settingsWindow.focus();
}

function buildTray(): void {
  tray = new Tray(createTrayIcon());
  if (process.platform === 'darwin') {
    tray.setTitle('');
  }
  tray.setToolTip('Li');
  updateTrayMenu();
}

function updateTrayMenu(settings = getSettings()): void {
  if (!tray) {
    return;
  }

  const updateItems =
    updaterState.phase === 'ready'
      ? [
          { label: `Update to ${updaterState.version} — restart to install`, click: () => autoUpdater.quitAndInstall() },
          { type: 'separator' as const }
        ]
      : [];

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Uses: ${formatStat(settings.usageStats.rewriteCount)}`, enabled: false },
      { label: `Symbols used: ${formatStat(settings.usageStats.symbolCount)}`, enabled: false },
      { type: 'separator' },
      ...updateItems,
      { label: 'Open Style Popup', click: openPalette },
      { label: 'Settings', click: openSettingsWindow },
      { type: 'separator' },
      { label: 'Quit Li', role: 'quit' }
    ])
  );
}

function broadcastUpdaterState(): void {
  settingsWindow?.webContents.send('updater-state', updaterState);
}

function setUpdaterState(state: UpdaterState): void {
  updaterState = state;
  broadcastUpdaterState();
  if (state.phase === 'ready') {
    updateTrayMenu();
  }
}

function setupAutoUpdater(): void {
  if (isDev) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    setUpdaterState({ phase: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    setUpdaterState({ phase: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    setUpdaterState({ phase: 'not-available' });
  });
  autoUpdater.on('download-progress', (progress) => {
    setUpdaterState({ phase: 'downloading', progress: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    setUpdaterState({ phase: 'ready', version: info.version });
  });
  autoUpdater.on('error', (err: Error) => {
    setUpdaterState({ phase: 'error', error: err.message });
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdates();
  }, 3000);
}

function wireIpc(): void {
  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:reset', () => {
    const settings = resetSettings();
    registerAppShortcuts(settings);
    updateTrayMenu(settings);
    return settings;
  });
  ipcMain.handle('settings:save', (_event, settings: LiSettings) => {
    const next = saveSettings(settings);
    registerAppShortcuts(next);
    updateTrayMenu(next);
    popupWindow?.webContents.send('settings-updated', next);
    return next;
  });
  ipcMain.handle('popup:get-state', () => popupState);
  ipcMain.handle('popup:close', () => hidePopup());
  ipcMain.handle('settings:open', () => openSettingsWindow());
  ipcMain.handle('shortcuts:pause', () => {
    globalShortcut.unregisterAll();
  });
  ipcMain.handle('shortcuts:resume', () => {
    registerAppShortcuts();
  });
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('updater:get-state', () => updaterState);
  ipcMain.handle('updater:check', () => {
    if (!isDev) {
      void autoUpdater.checkForUpdates();
    }
  });
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall();
  });
}

function registerAppShortcuts(settings = getSettings()): void {
  const failures = registerShortcuts(settings.hotkeys, {
    onRewrite: (action) => {
      void performRewrite({ action }).catch(() => undefined);
    },
    onPopup: () => {
      void openPalette();
    }
  });

  if (failures.length && settings.devLogging) {
    console.warn(`[Li] failed to register hotkeys: ${failures.join(', ')}`);
  }
}

app.setName('Li');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => openPalette());

app.whenReady().then(() => {
  const settings = getSettings();

  wireIpc();
  setupAutoUpdater();
  popupWindow = createPopupWindow();
  progressWindow = createProgressWindow();
  buildTray();
  registerAppShortcuts(settings);

  // Dock icon (macOS only) — clicking it opens Settings
  if (process.platform === 'darwin') {
    const dockImage = nativeImage.createFromDataURL(createDockIconPng(256));
    dockImage.addRepresentation({ scaleFactor: 2, dataURL: createDockIconPng(512) });
    app.dock.setIcon(dockImage);
  }

  console.info(`Li is running in the menu bar. Press ${settings.hotkeys.popup} for the style popup.`);
  if (settings.provider === 'openai' && !settings.openaiApiKey.trim()) {
    console.info('Li needs an OpenAI API key. Open Settings from the tray to add it.');
  }

  // Clicking the dock icon opens / focuses Settings
  app.on('activate', () => {
    openSettingsWindow();
  });
});

app.on('will-quit', () => {
  registerShortcuts(
    {
      grammar: '',
      rephrase: '',
      translate: '',
      popup: ''
    },
    {
      onRewrite: () => undefined,
      onPopup: () => undefined
    }
  );
});

app.on('window-all-closed', () => {
  // Keep the tray app alive when the settings window closes.
});
