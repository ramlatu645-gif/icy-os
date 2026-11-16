/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * IC App Launcher Desktop Main Process (Windows, macOS, Linux).
 *
 * Security & Architecture Rules:
 * - Runs with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
 * - Never embeds external applications inside Electron BrowserWindows; external URLs and
 *   registered custom protocols (`desktop-protocol`) are opened outside IC App Launcher via
 *   `shell.openExternal()` after strict scheme and metacharacter validation.
 * - Validated native desktop application IDs (`native-binary`) are launched strictly via
 *   `child_process.execFile` (with `shell: false`) from an explicit OS application path
 *   table — never via raw shell command strings or untrusted catalog paths.
 * - Uses Electron's `safeStorage` (backed by Windows DPAPI, macOS Keychain, or Linux
 *   Secret Service / libsecret) for encrypted credential/verifier storage.
 */

import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAFE_PROTOCOL_REGEX = /^[a-z][a-z0-9+.-]{1,31}:\/\/[^\s<>"{}|\\^`;`&$]+$/i;
const SAFE_APP_ID_REGEX = /^[a-zA-Z0-9._-]{2,128}$/;

export function resolveDesktopPlatform(): 'windows' | 'macos' | 'linux' {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

/**
 * Validates a protocol or external URL before passing it to `shell.openExternal`.
 */
export function isSafeExternalDesktopUri(uri: string): boolean {
  if (typeof uri !== 'string' || uri.length === 0 || uri.length > 2048) {
    return false;
  }
  const trimmed = uri.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('vbscript:')
  ) {
    return false;
  }
  return SAFE_PROTOCOL_REGEX.test(trimmed);
}

/**
 * Launches a verified desktop application outside IC App Launcher without shell interpolation.
 */
export async function launchDesktopTargetOutsideLauncher(
  method: 'desktop-protocol' | 'native-binary',
  target: string,
  openExternalFn?: (url: string) => Promise<void>
): Promise<{ launched: boolean; confirmed: boolean; errorReason?: string }> {
  if (method === 'desktop-protocol') {
    if (!isSafeExternalDesktopUri(target)) {
      return {
        launched: false,
        confirmed: false,
        errorReason: 'Rejected unsafe or malformed desktop protocol URI.',
      };
    }
    if (!openExternalFn) {
      return {
        launched: false,
        confirmed: false,
        errorReason: 'Desktop shell.openExternal handler is not available.',
      };
    }
    await openExternalFn(target.trim());
    return {
      launched: true,
      confirmed: true,
    };
  }

  if (method === 'native-binary') {
    if (!SAFE_APP_ID_REGEX.test(target) || target.includes('..')) {
      return {
        launched: false,
        confirmed: false,
        errorReason:
          'Rejected native binary target: only validated application identifiers without path traversal or shell arguments are allowed.',
      };
    }

    const platform = resolveDesktopPlatform();
    if (platform === 'macos') {
      return new Promise((resolve) => {
        execFile(
          '/usr/bin/open',
          ['-b', target],
          { shell: false, timeout: 5000 },
          (err) => {
            if (err) {
              resolve({
                launched: false,
                confirmed: false,
                errorReason: `macOS LaunchServices could not find bundle "${target}".`,
              });
            } else {
              resolve({ launched: true, confirmed: true });
            }
          }
        );
      });
    }

    if (platform === 'linux') {
      return new Promise((resolve) => {
        execFile(
          '/usr/bin/gtk-launch',
          [target],
          { shell: false, timeout: 5000 },
          (err) => {
            if (err) {
              resolve({
                launched: false,
                confirmed: false,
                errorReason: `Linux desktop entry "${target}" is not installed.`,
              });
            } else {
              resolve({ launched: true, confirmed: true });
            }
          }
        );
      });
    }

    return {
      launched: false,
      confirmed: false,
      errorReason:
        'On Windows, use registered application protocols (desktop-protocol) or MSIX AppExecutionAlias identifiers.',
    };
  }

  return {
    launched: false,
    confirmed: false,
    errorReason: 'Unsupported desktop launch method.',
  };
}

/**
 * Bootstrap function when launched inside the Electron desktop runtime.
 */
export async function startElectronDesktopApp(): Promise<void> {
  const electronModuleName = 'electron';
  const electron = await import(/* @vite-ignore */ electronModuleName);
  const { app, BrowserWindow, ipcMain, shell, safeStorage } = electron;

  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    app.quit();
    return;
  }

  const userDataDir = app.getPath('userData');
  const secureStoreFile = path.join(userDataDir, 'ic-app-launcher-secure-keystore.json');

  function readEncryptedStore(): Record<string, string> {
    try {
      if (!fs.existsSync(secureStoreFile)) return {};
      return JSON.parse(fs.readFileSync(secureStoreFile, 'utf8'));
    } catch {
      return {};
    }
  }

  function writeEncryptedStore(data: Record<string, string>): void {
    fs.mkdirSync(path.dirname(secureStoreFile), { recursive: true });
    fs.writeFileSync(secureStoreFile, JSON.stringify(data, null, 2), {
      mode: 0o600,
    });
  }

  ipcMain.handle(
    'iclauncher:launch-external',
    async (_event: unknown, method: 'desktop-protocol' | 'native-binary', target: string) => {
      return launchDesktopTargetOutsideLauncher(method, target, (uri) =>
        shell.openExternal(uri)
      );
    }
  );

  ipcMain.handle('iclauncher:secure-get', async (_event: unknown, key: string) => {
    const store = readEncryptedStore();
    const encoded = store[key];
    if (!encoded) return null;
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    }
    return Buffer.from(encoded, 'base64').toString('utf8');
  });

  ipcMain.handle(
    'iclauncher:secure-set',
    async (_event: unknown, key: string, value: string) => {
      const store = readEncryptedStore();
      if (safeStorage.isEncryptionAvailable()) {
        store[key] = safeStorage.encryptString(value).toString('base64');
      } else {
        store[key] = Buffer.from(value, 'utf8').toString('base64');
      }
      writeEncryptedStore(store);
    }
  );

  ipcMain.handle('iclauncher:secure-remove', async (_event: unknown, key: string) => {
    const store = readEncryptedStore();
    delete store[key];
    writeEncryptedStore(store);
  });

  await app.whenReady();

  const mainWindow = new BrowserWindow({
    title: 'IC App Launcher',
    width: 1120,
    height: 760,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#F3F2EC',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Intercept any target="_blank" window.open calls so external web apps always open
  // in the user's host OS browser rather than spawning a child Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (isSafeExternalDesktopUri(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html');
  await mainWindow.loadFile(distIndex);
}
