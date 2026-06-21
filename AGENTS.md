# GIA App — Agent Guide

## Commands
```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build (typecheck then build)
npm run lint       # eslint . (no Prettier — ESLint only)
npm run test       # vitest (watch mode)
npm run test:run   # vitest run
npm run preview    # vite preview
npm run cap:sync       # npx cap sync android (sync Capacitor Android after build)
```

## Build & CI
- `npm run build` runs `tsc -b` (project references) **before** `vite build` — don't skip typecheck
- CI uses `npm ci --legacy-peer-deps`
- CI builds debug + release APKs via `./gradlew assembleDebug` / `assembleRelease`
- Version tags (`v*.*.*.*`) create draft GitHub Releases with APK artifacts

## Architecture
- **Single-page React app** — no React Router. Module switching via Zustand store (`currentModule`)
- **State**: Zustand stores persisted to IndexedDB via `src/store/idb-storage.ts`
- **Entry**: `src/main.tsx` → `src/App.tsx` → module views (Chat, Writer, Analyst, Planner, Exam, Autonomy, Settings)
- **Services** in `src/services/`: GiaBrain, MCPManager, PluginManager, wake word, provider registry, etc.
- **Stores** in `src/store/`: each domain has its own Zustand store file
- **Path alias**: `@/` maps to `./src/*`
- **Modules**: `AnalystModule`, `ExamModule`, `AutonomyModule` are lazy-loaded (`React.lazy`)
- **Visual blocks**: ` ```visual ` code blocks render rich content (charts, maps, tables, etc.)

## Testing
- **Vitest** with `globals: true`, `environment: 'jsdom'`, setup: `src/test/setup.ts` (imports `@testing-library/jest-dom`)
- Tests live in `__tests__/` dirs alongside source (e.g., `src/utils/__tests__/helpers.test.ts`)
- Import `{ describe, it, expect }` from `'vitest'`
- `npm run test:run` for single run (no `--run` flag needed)

## Framework Quirks
- **Tailwind v4** — uses `@import "tailwindcss"` style (not `@tailwind` directives)
- **`base: './'`** in `vite.config.ts` — required for Capacitor Android WebView asset resolution
- **`cssMinify: 'esbuild'`** — avoids LightningCSS conflicts with Tailwind v4
- **Capacitor 8** — Android shell. Native features via Capacitor plugins (contacts, filesystem, TTS, etc.)
- **Mermaid / KaTeX** — loaded on-demand from CDN (not bundled)

## Android
- App ID: `com.alpha1studio.gia`
- Wake word uses Porcupine (on-device DNN) with `JARVIS` as default keyword
- Foreground service with `FOREGROUND_SERVICE_MICROPHONE` (Android 14+)
- `network_security_config.xml` restricts API domains
- ProGuard/R8 minification enabled

## Server
- `server/gia-stdio-bridge.js` — Node.js SSE bridge that wraps stdio MCP servers
- Usage: `node server/gia-stdio-bridge.js --config servers.json`

## Testing Conventions
- Tests use `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom`
- 26 test files across store, services, hooks, utils
- Focused unit tests (no integration/e2e suite)
