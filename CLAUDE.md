# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An Obsidian plugin ("Work Log") for tracking daily work activities. It writes entries to a central `work-log.md` file and optionally to related notes (people, projects, orgs) using dual logging with `[[wiki links]]`.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Watch mode (esbuild rebuilds on change)
npm run build        # Type-check (tsc --noEmit) + production bundle
npm run lint         # ESLint on src/
npm run test:run     # Vitest, including the Python staging helper handoff
```

Tests use an in-memory Obsidian API mock and temporary vaults; the staging-helper integration tests require Python 3.9+. The build output is `main.js` (generated and gitignored, required by Obsidian). To test the plugin, symlink or copy the repo into an Obsidian vault's `.obsidian/plugins/work-log/` directory and reload the plugin. If the user has prohibited controlling Obsidian, build locally and leave reloading to them.

### Review inbox

`suggestion.ts` defines the versioned Markdown contract. `review-inbox.ts` handles scanning, optimistic draft saves, dismissal, and resumable submission. `review-modal.ts` provides the editable review queue. `LogManager.writeReviewedEntry()` uses a per-entry HTML marker in every destination to prevent duplicate writes after interruption. Keep the frozen submission intact once status becomes `applying`.

`skills/work-log-review/` is the companion Codex skill. Its standard-library Python helper validates all batch entries, creates Markdown atomically without replacing existing files, and writes a research coverage report. Private installation configuration is in the skill's gitignored `local.json`. Never commit real suggestions, research, personal notes, or plugin `data.json`.

## Architecture

The plugin follows Obsidian's plugin API pattern: a `Plugin` subclass in `main.ts` is the entry point, registering commands, ribbon icons, and a settings tab.

### Source Files (`src/`)

- **`main.ts`** — `WorkLogPlugin` extends `Plugin`. Orchestrates `LogManager`, `AutoLinker`, and `EntryModal`. Registers commands (add entry, open log, quick-add per category). Handles the callback from `EntryModal` that writes to both log file and related note.
- **`types.ts`** — All TypeScript interfaces (`LogEntry`, `WorkLogSettings`, `Category`), default settings, category labels/descriptions/placeholders. Categories are: `demo`, `customer`, `technical`, `collaboration`, `win`.
- **`entry-modal.ts`** — `EntryModal` extends Obsidian `Modal`. The main UI: date picker (Today/Yesterday/Last Friday + date input), related note autocomplete, category dropdown, description textarea. Submits via `Cmd/Ctrl+Enter`.
- **`log-manager.ts`** — `LogManager` handles all file I/O. Core logic: `insertEntryToLog()` and `insertEntryToRelatedNote()` parse existing markdown to insert entries in ascending chronological order. Respects heading levels, wiki-link date format, blank line separators, and other formatting settings.
- **`auto-linker.ts`** — `AutoLinker` extends Obsidian `Component` (for lifecycle management via `addChild`). Builds a name index from all vault markdown files, listens for create/delete/rename events for incremental updates. `processText()` replaces note names with `[[wiki links]]`, protecting existing links and URLs with placeholder substitution.
- **`note-suggest.ts`** — `NoteSuggest` extends `AbstractInputSuggest<TFile>` for the related note autocomplete dropdown. Prioritizes starts-with matches, limits to 10 results.
- **`settings.ts`** — `WorkLogSettingTab` extends `PluginSettingTab`. Settings UI organized into sections: File, Entry, Work Log Formatting, Related Notes, Auto-Linking.

### Key Data Flow

1. User opens modal → fills form → `Cmd+Enter`
2. `EntryModal.submit()` runs `AutoLinker.processText()` on description
3. Callback in `main.ts` calls `LogManager.addEntry()` (main log) + `LogManager.addToRelatedNote()` (optional)
4. `LogManager` parses existing markdown, finds correct insertion point by date (ascending order), writes modified content

### Build

esbuild bundles `src/main.ts` → `main.js` (CJS format, ES2018 target). Obsidian APIs (`obsidian`, `electron`, `@codemirror/*`, `@lezer/*`) are externalized. The `main.js` file is committed because Obsidian loads it directly.

### Version Bumping

`npm version <patch|minor|major>` triggers `version-bump.mjs` which syncs the version from `package.json` into `manifest.json` and `versions.json`.
