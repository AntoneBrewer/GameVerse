# GameVerse

GameVerse is a private gaming library and playtime tracker. It gives you one place to organize games across consoles, PCs, handhelds, storefronts, mobile, VR, and retro systems. It runs in a modern browser, as a Windows/macOS/Linux desktop app, and as an Android app, all built with Tauri 2 and Rust.

## What works today

- Add, edit, inspect, search, filter, sort, and remove games across a broad built-in platform registry, with custom platforms supported.
- Track game status, ownership, genre, developer, personal rating, priority, progress, achievement counts, notes, and optional cover art.
- Start and stop a play session or add a past session manually. Recorded time is attached to the game and shown in library analytics.
- View your current games, backlog, wishlist, achievements, collections, and library-derived platform, genre, and playtime stats.
- Import JSON or CSV with a preview. Duplicate title/platform pairs are skipped; existing entries are never overwritten.
- Export a complete JSON backup or a portable CSV. All records persist in the browser's IndexedDB database, with a clearly disclosed local-storage fallback.
- Choose dark or light appearance; the layout adapts to narrow screens and keyboard search is available with Ctrl/Cmd+K.
- In the Tauri desktop app, Rust persists your library as JSON in the operating system's per-user GameVerse application-data directory. The Settings page shows the exact file location. In a regular browser, records continue to use IndexedDB with an explicit local-storage fallback.
- On Android, the same Rust bridge stores library data in the app's private application-data directory. The Android build is configured for ARM64 devices.

No sample account, remote API, pricing feed, social network, or achievement synchronization is included. The Connections page identifies unavailable account integrations honestly; use an export from a service you control or maintain records manually. GameVerse never asks for gaming account passwords.

## Run locally

**Browser:** Open `index.html` in a current browser. No dependency install is needed.

**Desktop app:** Install Node.js 18 or newer, Rust's stable toolchain, and the platform prerequisites listed in the [Tauri setup guide](https://v2.tauri.app/start/prerequisites/) (including Microsoft C++ Build Tools and WebView2 on Windows). Then run:

```sh
npm install
npm run desktop:dev
```

**Android app:** Install Android Studio/SDK, Java 17, Android NDK 27, Node.js, and Rust with the `aarch64-linux-android` target. Initialize the native project once, then run:

```sh
npm install
npm run android:init
npm run android:dev
```

Create distributable desktop installers with:

```sh
npm run desktop:build
```

Build Android APK and AAB packages with:

```sh
npm run build:web
npm run tauri -- android build --target aarch64 --apk --aab
```

Pushing a `v*` version tag runs the Windows, macOS, and Android builds and publishes their outputs to a GitHub Release. The Android APK is a debug-signed test build for sideloading; it is not suitable for production updates. The Android AAB needs a protected signing key before Play Store publishing. Windows installers and macOS disk images are unsigned and may show operating-system security warnings.

Run the frontend tests and Rust persistence tests with:

```sh
npm test
npm run check
cargo test --manifest-path src-tauri\Cargo.toml
```

## Data and privacy

In the desktop app, Rust saves the library to `library.json` in GameVerse's per-user app-data directory; the path appears in Settings. Desktop saves are not silently redirected to browser storage if a native save fails. In a browser, the app uses an IndexedDB database named `gameverse` in the current browser profile, or that browser's local storage with a visible notice if IndexedDB is unavailable. Clearing app/browser data removes local records. Export a JSON backup regularly if the data matters to you. No app data is sent to a server, and no backend account or remote synchronization is provided.

Cover artwork URLs must use HTTPS. Images are loaded from the URL you supply; omit a URL to use the locally rendered artwork placeholder.

## Data formats

JSON backup files contain a `games` array and may include `profile`, `platforms`, `sessions`, and active session data. Import previews show games before they are added. On an empty library, JSON imports restore profile and active-session state; sessions are restored only for games newly imported, never duplicated records. Existing profile data and games are not overwritten. CSV imports expect a header row with a `title` column; supported fields include `developer`, `genre`, `platforms` (separate multiple names with semicolons), `status`, `ownership`, `playtimeMinutes`, `progress`, `rating`, `priority`, `releaseYear`, `estimatedHours`, `achievementEarned`, `achievementTotal`, `coverUrl`, and `notes`. CSV exports include the library records, not the profile or session history.

## Project structure

- `index.html` — accessible application shell and script entry points.
- `styles.css` — responsive visual system, dashboard, library, forms, and details.
- `src/core.js` — state normalization, library operations, filters, analytics, and import/export transforms.
- `src/storage.js` — IndexedDB persistence with a local-storage fallback.
- `src/app.js` — page rendering, dialogs, and user interactions.
- `tests/core.test.js` — Node's built-in test runner for core workflows.
- `tests/storage.test.js` — desktop bridge and storage-error behavior.
- `scripts/build-frontend.js`, `scripts/serve.js` — static frontend build and Tauri development server.
- `src-tauri/` — Rust commands, Tauri v2 configuration, app-data persistence, and native tests.
- `.github/workflows/release.yml` — automated Windows, macOS, and Android artifact builds and tagged GitHub releases.

## Next steps

This is a local-first foundation, not a hosted multi-user service. A production backend should add authentication, server-side authorization and validation, encrypted provider tokens, database migrations, and provider integrations only after their official access and consent flows are implemented. The current local record model keeps game metadata, ownership, progress, achievements, and sessions separate enough to evolve toward that service without claiming account sync today.
