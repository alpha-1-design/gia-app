# Development

GIA is a React and TypeScript single-page app built with Vite. Android native
integration is provided by Capacitor. This is a single repository, not a
monorepo, and the app does not use a framework router.

## Setup

```bash
npm ci --legacy-peer-deps
npm run dev
```

The development command starts the sandbox server and Vite on port 3000.

## Build projects

In Build Mode, open **Project** to clone a Git repository and browse its files.
Clones live in the sandbox at `/workspace/projects/<project-name>` on both the
desktop sandbox and the on-device terminal; this is separate from the app's
Documents folder and any folder opened in the general File Browser. Select a
project to make it the active Build workspace. Terminal commands then run from
that repository, and GIA receives its path in the Build instructions. The
project file tree can preview text and source files up to 512 KB.

The sandbox must be available before cloning. Public HTTPS repositories work
without credentials; SSH repositories require usable SSH credentials in the
sandbox. Build Mode can also search GitHub repositories; add a fine-grained
GitHub token with repository metadata and contents read access to discover and
clone private repositories. The token is saved in GIA's credential store and is
passed to Git only through its environment, not the clone URL or command.
Repository data remains in that sandbox's storage.

## In-app browser

`browser_navigate` opens pages in GIA's in-app browser. Android uses an
interactive WebView that is shared with `browser_click`, `browser_fill`, and
`browser_scroll`; Build Preview's **Open in browser** action opens in that same
browser. It uses Android's WebView engine, but is a separate browser session:
Android does not let GIA embed or read the installed Chrome app's open tabs,
cookies, or DOM. On the web, navigation displays extracted page text in a read-only
view because embedded sites and cross-origin restrictions prevent reliable
interactive browsing. When direct fetch is blocked by CORS, the web fallback
tries GIA's configured web reader and text-proxy services; those services
receive the requested URL. Build previews remain openable in the web preview
frame.

## Validate changes

```bash
npm run lint
npm run test:run
npm run build
```

After changing web assets that are packaged into Android:

```bash
npx cap sync android
```

## Architecture map

| Concern | Location |
| --- | --- |
| App shell | `src/App.tsx` |
| Feature modules | `src/modules/` |
| Persisted state | `src/store/` |
| Generation orchestration | `src/services/GiaBrain.ts` |
| Provider adapters | `src/services/providers/` |
| System prompt assembly | `src/services/buildGiaSystem.ts` |
| Tool definitions and execution | `src/services/tools/`, `src/services/brain/` |
| PDF extraction | `src/services/PDFService.ts` |
| Android project | `android/` |

For repository contribution guidance, see
[CONTRIBUTING.md](../../CONTRIBUTING.md). For the complete feature manual, see
[manual.md](../../manual.md).
