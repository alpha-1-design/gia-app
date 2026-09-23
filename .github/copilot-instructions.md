# Copilot Instructions for GIA App

## Build, test, and lint

Use the repository's scripts in this order for normal validation:

- Install dependencies: `npm ci --legacy-peer-deps`
- Lint: `npm run lint`
- Run tests: `npm run test:run`
- Build: `npm run build`
- Start local app: `npm run dev`
- Sync Android project after build changes: `npx cap sync android`

Single-file targeted validation is preferred when debugging or iterating:

- Single test file: `npm run test:run -- src/path/to/test-file.test.ts`
- Single path or pattern: `npx vitest run src/path/to/test-file.test.ts`
- Single ESLint target: `npx eslint src/path/to/file.tsx`

Do not use `npm install` without the repo's `--legacy-peer-deps` flag unless the dependency change is intentional and reviewed.

## High-level architecture

This is a single-page React 19 app built with Vite 8 and Capacitor. It is not a monorepo and it does not use a framework router.

- App entry and shell: `src/App.tsx`
- Modules: `src/modules/` — Chat, Writer, Planner, Settings are loaded eagerly; Analyst, Exam, Autonomy, and Agents are lazy-loaded
- State: Zustand stores under `src/store/`; persistence goes through `src/store/idb-storage.ts` and IndexedDB
- Generation pipeline: `useChatState -> useChatGeneration -> GiaBrain.generate() -> provider adapter -> tool loop`
- System prompt assembly: `src/services/buildGiaSystem.ts`
- Core orchestrator: `src/services/GiaBrain.ts`
- Provider adapters: `src/services/providers/{openai,anthropic,gemini,local}.ts`
- Tool system: `src/services/tools/`, registered through `src/services/tools/index.ts`
- Tool execution: `src/services/brain/toolRunner.ts` and `src/services/ToolExecutionService.ts`
- Validation/recovery: `src/services/OutputValidator.ts`, `src/services/ErrorHandlingService.ts`, `generateWithRetry.ts`
- Native/mobile shell: Capacitor Android project under `android/`

Key behavioral constraints from the app design:

- Streaming is handled centrally in `useChatGeneration.ts`; provider adapters send raw text deltas and do not process chunks themselves.
- `CapacitorHttp.enabled` is intentionally false in `capacitor.config.ts` because native HTTP buffering breaks the incremental streaming flow.
- The app favors local-first, privacy-first behavior; many features are designed to work without a central backend.
- Force-JSON flows for Analyst / Exam / Planner rely on `generateWithRetry<T>()` and strict JSON-only instructions.

## Repository conventions

- TypeScript strict mode; avoid `any` unless there is a clearly justified, minimal exception.
- Prefer functional components and hooks; no class components.
- Use Tailwind CSS v4 for styling and CSS variables for module theming; use `clsx` for conditional class logic.
- Prefer Lucide icons and keep UI patterns consistent with the rest of the app.
- Zustand state should be persisted via the app’s IndexedDB storage layer rather than ad hoc localStorage for core app state.
- Tool and provider changes often require updating both the provider logic and the system prompt builder; inspect `buildGiaSystem.ts` and the relevant tool registration together.
- Keep the app’s local-first and privacy-centric design in mind: do not add dependencies or flows that introduce central cloud backend requirements without a strong, explicit reason.
- For tests, follow the Vitest setup in `src/test/setup.ts` and mock IndexedDB / AudioContext requirements there instead of creating custom ad hoc mocks in each test when a shared pattern already exists.
- For app-level logic, prefer reading the generation pipeline and surrounding service boundaries rather than patching UI code in isolation; the critical behavior lives in the service stack.

## Important repository-specific notes

- `npm run dev` runs both the sandbox server and Vite: `node server/sandbox-server.cjs & vite --port=3000 --host=0.0.0.0`.
- Vite is configured for Capacitor asset handling with `base: './'`.
- The app uses Tailwind v4 via the Vite plugin and does not rely on a `tailwind.config.js` file.
- `tsconfig.app.json` excludes the test folder from the production build; test files are not type-checked during `npm run build`.
- Provider adapters connect to external AI APIs directly; the app's model selection and health monitoring are managed through the provider registry and monitor services.
- When making changes to streaming, tool execution, or provider behavior, validate with the targeted unit tests or the app build rather than assuming UI-only behavior is enough.

## Working style for contributions

- Keep changes scoped to the relevant service or module.
- Prefer following existing patterns already used in the repo over introducing parallel abstractions.
- For changes to generation, tool routing, or prompt construction, review both the service implementation and the system prompt assembly together.
- Respect the app's local-first product goals and do not add telemetry or network dependencies as part of routine work.
