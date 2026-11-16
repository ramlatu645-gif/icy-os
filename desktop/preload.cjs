/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * IC App Launcher Desktop Context-Isolated Preload Script (`desktop/preload.cjs`).
 *
 * Exposes `window.__IC_APP_LAUNCHER_DESKTOP_BRIDGE__` strictly via Electron's `contextBridge`
 * without exposing Node.js primitives or raw `ipcRenderer` to the renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

function detectDesktopPlatform() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

contextBridge.exposeInMainWorld('__IC_APP_LAUNCHER_DESKTOP_BRIDGE__', {
  platform: detectDesktopPlatform(),
  launchProtocolOrBinary: (method, target) =>
    ipcRenderer.invoke('iclauncher:launch-external', method, target),
  getSecureItem: (key) => ipcRenderer.invoke('iclauncher:secure-get', key),
  setSecureItem: (key, value) =>
    ipcRenderer.invoke('iclauncher:secure-set', key, value),
  removeSecureItem: (key) => ipcRenderer.invoke('iclauncher:secure-remove', key),
});
