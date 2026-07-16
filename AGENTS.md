# AGENTS.md

## Project Context

This is EchoTalk, a Vite + React application that also ships as an Electron desktop app. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, and `ELECTRON_SETUP.md` for the Electron workflow.

## Key Files

- `src/`: frontend application source.
- `src/lib/localDb.js`: local in-memory data stub used by components until a real backend/API is wired up.
- `vite.config.js`: Vite config for the web dev server / build.
- `vite.electron.config.js`: Vite config used for Electron builds.
- `electron/main.cjs`, `electron/preload.cjs`: Electron main/preload processes.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `npm run dev` for local web development.
- Use the Electron npm scripts (see `ELECTRON_SETUP.md`) for desktop development and packaging.
- Run the relevant checks from `package.json` (`npm run lint`, `npm run typecheck`) before finishing code changes.
