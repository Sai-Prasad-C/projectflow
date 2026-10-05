# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Type-check then bundle for production (tsc -b && vite build)
npm run lint      # Run oxlint
npm run preview   # Preview production build locally
```

No test runner is configured yet.

## Stack

- **React 19** with TypeScript, bundled by **Vite 8**
- **Oxlint** for linting (configured in `.oxlintrc.json`); enforces React hooks rules and only-export-components
- TypeScript targets ES2023; strict unused-variable/parameter checks are on (`noUnusedLocals`, `noUnusedParameters`)
- `verbatimModuleSyntax` is enabled — use `import type` for type-only imports

## Project structure

All application code lives under `src/`. Entry point is `src/main.tsx` → `src/App.tsx`. Static assets served at root come from `public/` (e.g. `public/icons.svg` referenced via `/icons.svg#…` sprite IDs in JSX).

## Linting notes

To enable type-aware lint rules for production use, install `oxlint-tsgolint` and add `"options": { "typeAware": true }` to `.oxlintrc.json`. The React Compiler is intentionally excluded from this template due to dev/build performance impact.
