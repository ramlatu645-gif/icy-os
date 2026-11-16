/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Genuine Debian/Ubuntu `.deb` Package Builder for IC App Launcher on Linux.
 *
 * Uses the system `/usr/bin/dpkg-deb` tool and the compiled production `dist/`
 * bundle to construct a real, verifiable Debian binary package (`ic-app-launcher_1.0.0_amd64.deb`).
 *
 * Security Rules:
 * - Never embeds `.env`, server-side API keys (`ICY_PLATFORM_API_KEY`, `GEMINI_API_KEY`),
 *   or unverified code inside the packaged artifact.
 * - Uses strict file permissions (`0755` for directories/executables, `0644` for static assets)
 *   and builds with `dpkg-deb --root-owner-group --build`.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PACKAGE_NAME = 'ic-app-launcher';
const PACKAGE_VERSION = '1.0.0';
const PACKAGE_ARCH = 'amd64';

function copyDirectoryRecursive(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true, mode: 0o755 });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      fs.chmodSync(destPath, 0o644);
    }
  }
}

function getDirectorySizeInKb(dirPath: string): number {
  let totalBytes = 0;
  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        totalBytes += fs.statSync(full).size;
      }
    }
  }
  walk(dirPath);
  return Math.max(1, Math.ceil(totalBytes / 1024));
}

export function buildLinuxDebPackage(): {
  debFilePath: string;
  sha256Hex: string;
  sizeBytes: number;
} {
  const distDir = path.join(ROOT_DIR, 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(
      'Frontend production build (dist/index.html) is missing. Run "npm run build" before packaging.'
    );
  }

  const stagingRoot = path.join(ROOT_DIR, 'release', 'linux', 'staging');
  const pkgRoot = path.join(
    stagingRoot,
    `${PACKAGE_NAME}_${PACKAGE_VERSION}_${PACKAGE_ARCH}`
  );
  const outputDir = path.join(ROOT_DIR, 'release', 'linux');

  fs.rmSync(stagingRoot, { recursive: true, force: true });
  fs.mkdirSync(pkgRoot, { recursive: true, mode: 0o755 });

  // 1. Copy compiled frontend assets into /usr/share/ic-app-launcher/app/dist
  const targetAppDir = path.join(pkgRoot, 'usr', 'share', PACKAGE_NAME, 'app');
  copyDirectoryRecursive(distDir, path.join(targetAppDir, 'dist'));

  // Copy desktop runtime scripts into /usr/share/ic-app-launcher/app/desktop
  const desktopSrcDir = path.join(ROOT_DIR, 'desktop');
  if (fs.existsSync(desktopSrcDir)) {
    copyDirectoryRecursive(desktopSrcDir, path.join(targetAppDir, 'desktop'));
  }

  // 2. Install desktop icon into /usr/share/icons/hicolor/scalable/apps/ic-app-launcher.svg
  const iconSrc = path.join(ROOT_DIR, 'public', 'icons', 'ic-app-launcher-icon.svg');
  const iconDestDir = path.join(
    pkgRoot,
    'usr',
    'share',
    'icons',
    'hicolor',
    'scalable',
    'apps'
  );
  fs.mkdirSync(iconDestDir, { recursive: true, mode: 0o755 });
  if (fs.existsSync(iconSrc)) {
    const iconDest = path.join(iconDestDir, `${PACKAGE_NAME}.svg`);
    fs.copyFileSync(iconSrc, iconDest);
    fs.chmodSync(iconDest, 0o644);
  }

  // 3. Install FreeDesktop entry into /usr/share/applications/ic-app-launcher.desktop
  const desktopEntrySrc = path.join(
    ROOT_DIR,
    'packaging',
    'linux',
    'ic-app-launcher.desktop'
  );
  const applicationsDir = path.join(pkgRoot, 'usr', 'share', 'applications');
  fs.mkdirSync(applicationsDir, { recursive: true, mode: 0o755 });
  const desktopEntryDest = path.join(applicationsDir, `${PACKAGE_NAME}.desktop`);
  fs.copyFileSync(desktopEntrySrc, desktopEntryDest);
  fs.chmodSync(desktopEntryDest, 0o644);

  // 4. Create safe launcher binary at /usr/bin/ic-app-launcher
  const binDir = path.join(pkgRoot, 'usr', 'bin');
  fs.mkdirSync(binDir, { recursive: true, mode: 0o755 });
  const launcherBinPath = path.join(binDir, PACKAGE_NAME);
  const launcherScript = [
    '#!/usr/bin/env sh',
    '# IC App Launcher startup entry for Linux',
    'set -eu',
    'APP_ROOT="/usr/share/ic-app-launcher/app"',
    'if command -v electron >/dev/null 2>&1; then',
    '  exec electron "$APP_ROOT/desktop/main.ts" "$@"',
    'elif command -v xdg-open >/dev/null 2>&1; then',
    '  exec xdg-open "$APP_ROOT/dist/index.html"',
    'else',
    '  echo "IC App Launcher is installed at $APP_ROOT/dist/index.html" >&2',
    '  exit 0',
    'fi',
    '',
  ].join('\n');
  fs.writeFileSync(launcherBinPath, launcherScript, { mode: 0o755 });

  // 5. Write DEBIAN/control metadata (no unsafe postinst/prerm root shell scripts)
  const debianDir = path.join(pkgRoot, 'DEBIAN');
  fs.mkdirSync(debianDir, { recursive: true, mode: 0o755 });
  const installedSizeKb = getDirectorySizeInKb(pkgRoot);
  const controlContent = [
    `Package: ${PACKAGE_NAME}`,
    `Version: ${PACKAGE_VERSION}`,
    'Section: utils',
    'Priority: optional',
    `Architecture: ${PACKAGE_ARCH}`,
    `Installed-Size: ${installedSizeKb}`,
    'Recommends: xdg-utils',
    'Maintainer: ICY Ecosystem <packages@icy.example.org>',
    'Homepage: https://icy.example.org',
    'Description: IC App Launcher',
    ' A simple application launcher for ICY applications and compatible third-party applications.',
    ' Opens installed ICY and compatible third-party applications externally in the',
    ' host operating system.',
    '',
  ].join('\n');
  const controlPath = path.join(debianDir, 'control');
  fs.writeFileSync(controlPath, controlContent, { mode: 0o644 });

  // 6. Invoke dpkg-deb to build the .deb artifact
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o755 });
  const debFilePath = path.join(
    outputDir,
    `${PACKAGE_NAME}_${PACKAGE_VERSION}_${PACKAGE_ARCH}.deb`
  );

  execFileSync(
    'dpkg-deb',
    ['--root-owner-group', '--build', pkgRoot, debFilePath],
    { stdio: 'pipe' }
  );

  // Clean up temporary staging tree
  fs.rmSync(stagingRoot, { recursive: true, force: true });

  const debBytes = fs.readFileSync(debFilePath);
  const sha256Hex = crypto.createHash('sha256').update(debBytes).digest('hex');

  return {
    debFilePath,
    sha256Hex,
    sizeBytes: debBytes.byteLength,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const result = buildLinuxDebPackage();
  console.log(`Built Linux .deb package: ${result.debFilePath}`);
  console.log(`Size: ${result.sizeBytes} bytes`);
  console.log(`SHA-256: ${result.sha256Hex}`);
}
