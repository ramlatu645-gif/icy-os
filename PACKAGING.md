# IC App Launcher — Native Packaging, Platform Builds & Installation Guide

IC App Launcher is a simple, lightweight, installable application launcher for ICY applications and compatible third-party applications. It shares a single React 19 + TypeScript + Tailwind CSS frontend (`src/`) across Web, Android, iOS/iPadOS, Windows, macOS, and Linux while delegating external application launching, package installation, and hardware-backed credential storage to platform-specific adapters (`src/platform/nativeShellBridge.ts`).

---

## 1. Cross-Platform Packaging Architecture

| Layer | Technology | Responsibility |
| :--- | :--- | :--- |
| **Shared Launcher UI** | React 19 + TypeScript + Vite (`dist/`) | Lock screen, password unlock, live clock/date, search, app grid, themes, Settings. |
| **Mobile Wrapper (Android & iOS/iPadOS)** | Capacitor (`capacitor.config.json`, `android/`, `ios/`) | Native WebView host, status/navigation bar styling, hardware Back button dispatch, Android Intent launching, iOS Universal Links / URL schemes, Keystore/Keychain storage. |
| **Desktop Wrapper (Windows, macOS, Linux)** | Electron (`desktop/main.ts`, `desktop/preload.cjs`, `electron-builder.json`) + Debian dpkg builder (`scripts/buildLinuxDebPackage.ts`) | Context-isolated desktop window, `shell.openExternal` protocol handoff, validated native binary launch (`execFile` with `shell: false`), OS `safeStorage` encryption. |
| **Trusted Remote Backend** | Express (`server.ts`) | Holds `ICY_PLATFORM_API_KEY` and `ICY_PLATFORM_API_BASE_URL` strictly on the server. Never bundled into distributed client packages. |

---

## 2. Prerequisites & Toolchains by Target Platform

- **Shared Web Build**: Node.js 20+ and npm.
- **Linux `.deb` Package (Supported in current environment)**: `dpkg-deb` (`/usr/bin/dpkg-deb`).
- **Android Build (`.apk` / `.aab`)**: JDK 17+, Android SDK Platform 34, Android Build-Tools 34.0.0+, Gradle 8+.
- **iOS / iPadOS Build (`.ipa`)**: macOS host, Xcode 15+, CocoaPods, Apple Developer provisioning profile and signing certificate.
- **Windows Build (`.exe` NSIS / `.msix`)**: Windows 10/11 SDK or Wine/NSIS toolchain (`electron-builder --win`), Authenticode certificate for signed production releases.
- **macOS Build (`.dmg` / `.app`)**: macOS host with Xcode Command Line Tools (`electron-builder --mac`), Apple Developer ID Application certificate and `notarytool` credentials for notarization.

---

## 3. Development, Test & Build Commands

| Command | Description | Output Location |
| :--- | :--- | :--- |
| `npm run dev` | Starts the development server on port 3000 | `http://0.0.0.0:3000` |
| `npm run build` | Builds the shared production frontend bundle | `dist/` |
| `npm run lint` | Runs TypeScript type-checking (`tsc --noEmit`) | Console |
| `npm test` | Runs the automated verification suite | Console |
| `npm run package:linux:deb` | Builds the frontend and creates a real Debian `.deb` package | `release/linux/ic-app-launcher_1.0.0_amd64.deb` |
| `npm run mobile:sync:android` | Builds `dist/` and syncs assets to the Android Capacitor project | `android/` |
| `npm run mobile:sync:ios` | Builds `dist/` and syncs assets to the iOS Capacitor project | `ios/` |
| `npm run package:desktop:win` | Builds `dist/` and packages Windows NSIS/MSIX via `electron-builder` | `release/desktop/` |
| `npm run package:desktop:mac` | Builds `dist/` and packages macOS DMG/ZIP via `electron-builder` | `release/desktop/` |
| `npm run package:desktop:linux` | Builds `dist/` and packages Linux targets via `electron-builder` | `release/desktop/` |

---

## 4. Security & Credential Boundaries

- **Zero Client Secret Leakage**: `ICY_PLATFORM_API_KEY` and `GEMINI_API_KEY` are never prefixed with `VITE_` and never embedded in `dist/`, `.deb`, `.apk`, `.ipa`, `.exe`, or `.dmg` artifacts.
- **Minimal Native Permissions**:
  - Android requests only `INTERNET`, `ACCESS_NETWORK_STATE`, `REQUEST_INSTALL_PACKAGES`, and `REQUEST_DELETE_PACKAGES`, plus explicit `<queries>` for Android 11+ package visibility. Camera, microphone, contacts, and location are never requested.
  - iOS declares `NSAppTransportSecurity` (`NSAllowsArbitraryLoads = false`) and explicit `LSApplicationQueriesSchemes`.
- **External Application Launching**: Applications always launch outside IC App Launcher in the host OS (`PackageManager` intents on Android, `UIApplication.shared.open` on iOS, `shell.openExternal` / `execFile(..., { shell: false })` on desktop, and external browser tabs in web preview).
