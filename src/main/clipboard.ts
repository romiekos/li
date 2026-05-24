import { clipboard, nativeImage } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ClipboardSnapshot {
  text: string;
  html: string;
  rtf: string;
  imageDataUrl: string;
}

type ShortcutKey = 'copy' | 'paste' | 'selectAll';

const macKeys: Record<ShortcutKey, string> = {
  copy: 'c',
  paste: 'v',
  selectAll: 'a'
};

const winKeys: Record<ShortcutKey, string> = {
  copy: '^c',
  paste: '^v',
  selectAll: '^a'
};

const linuxKeys: Record<ShortcutKey, string> = {
  copy: 'ctrl+c',
  paste: 'ctrl+v',
  selectAll: 'ctrl+a'
};

export function snapshotClipboard(): ClipboardSnapshot {
  const image = clipboard.readImage();

  return {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: clipboard.readRTF(),
    imageDataUrl: image.isEmpty() ? '' : image.toDataURL()
  };
}

export function restoreClipboard(snapshot: ClipboardSnapshot): void {
  clipboard.clear();

  const payload: Electron.Data = {};

  if (snapshot.text) {
    payload.text = snapshot.text;
  }

  if (snapshot.html) {
    payload.html = snapshot.html;
  }

  if (snapshot.rtf) {
    payload.rtf = snapshot.rtf;
  }

  if (snapshot.imageDataUrl) {
    payload.image = nativeImage.createFromDataURL(snapshot.imageDataUrl);
  }

  if (Object.keys(payload).length) {
    clipboard.write(payload);
  }
}

async function sendDarwinShortcut(key: ShortcutKey): Promise<void> {
  await execFileAsync('osascript', [
    '-e',
    `tell application "System Events" to keystroke "${macKeys[key]}" using command down`
  ]);
}

async function sendWindowsShortcut(key: ShortcutKey): Promise<void> {
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${winKeys[key]}')`
  ]);
}

async function sendLinuxShortcut(key: ShortcutKey): Promise<void> {
  await execFileAsync('xdotool', ['key', linuxKeys[key]]);
}

async function sendShortcut(key: ShortcutKey): Promise<void> {
  if (process.platform === 'darwin') {
    await sendDarwinShortcut(key);
    return;
  }

  if (process.platform === 'win32') {
    await sendWindowsShortcut(key);
    return;
  }

  await sendLinuxShortcut(key);
}

export async function readFocusedText(): Promise<string> {
  clipboard.clear();
  await sendShortcut('copy');
  await delay(120);

  let text = clipboard.readText();
  if (text.trim()) {
    return text;
  }

  await sendShortcut('selectAll');
  await delay(80);
  await sendShortcut('copy');
  await delay(120);

  text = clipboard.readText();
  return text;
}

export async function pasteReplacement(text: string): Promise<void> {
  clipboard.writeText(text);
  await delay(40);
  await sendShortcut('paste');
  await delay(250);
}

export { delay };
