# Li — Agent Guide

Key facts for AI agents and new contributors working in this codebase.

---

## What Li is

Li is a macOS tray app (Electron) that rewrites selected text in-place using an AI provider chosen by the user. It has no main window — it lives in the menu bar and the dock. The entire user interaction is:

1. User selects text in any app
2. User presses a global hotkey
3. Li reads the selection via simulated ⌘C, sends it to an AI API, and types the result back via simulated ⌘V

---

## Tech stack

- **Electron** (main process) + **React + Tailwind** (renderer) + **TypeScript** throughout
- **electron-vite** for bundling (separate configs for main, preload, renderer)
- **Zustand** for renderer state
- **pnpm** as the package manager

---

## Project structure

```
src/
  main/               Node/Electron process
    index.ts          Entry point — tray, dock, windows, IPC handlers, shortcuts
    settings.ts       Read/write persisted settings; API keys encrypted via safeStorage
    clipboard.ts      Clipboard read/write + ⌘C/⌘V simulation via robotjs/applescript
    shortcuts.ts      Global hotkey registration/unregistration helpers
    ai/
      types.ts        BuiltPrompt, PromptBuildInput interfaces
      promptBuilder.ts  Assembles system + user prompt from action, style, and settings
      providers/      One file per AI provider (openai, anthropic, groq, openrouter, gemini, ollama)
  preload/
    index.ts          contextBridge — exposes window.li (LiBridge) to the renderer
  renderer/
    App.tsx           Root — renders FloatingPopup or SettingsView based on window type
    components/
      FloatingPopup.tsx   Style palette + progress overlay (shown near cursor)
      SettingsView.tsx    Full settings UI (provider, hotkeys, styles, theme, updater)
      HotkeyRecorder.tsx  Captures key combos for hotkey configuration
      StyleSelector.tsx   Grid of style preset cards
      Logo.tsx            SVG logo component
    store/
      useAppStore.ts  Zustand store — settings, popup state, updater state
    styles/
      globals.css     CSS custom properties (color tokens), component utility classes
  shared/
    types.ts          All shared types: LiSettings, StylePreset, RewriteAction, LiBridge, …

scripts/
  generate-icons.mjs  Generates icon.iconset PNGs + icon.icns (pure Node, no extra deps)
  notarize.mjs        electron-builder afterSign hook — submits to Apple notary service

build/
  icon.icns           Compiled app icon (committed; regenerate with pnpm icons)
  entitlements.mac.plist  Required for hardened runtime notarization
```

---

## IPC / bridge

The renderer talks to the main process exclusively through `window.li` (type: `LiBridge`), defined in `src/shared/types.ts` and exposed in `src/preload/index.ts`.

Key calls:

| Method | Direction | Purpose |
|---|---|---|
| `getSettings()` | renderer → main | Load full settings on mount |
| `saveSettings(s)` | renderer → main | Persist any settings change |
| `closePopup()` | renderer → main | Dismiss the floating popup |
| `onPopupState(cb)` | main → renderer | Push popup state updates (progress, errors) |
| `onSettingsUpdated(cb)` | main → renderer | Push settings after external change |
| `pauseShortcuts()` / `resumeShortcuts()` | renderer → main | Disable hotkeys while recording a new one |
| `checkForUpdates()` / `installUpdate()` | renderer → main | Trigger auto-updater |
| `onUpdaterState(cb)` | main → renderer | Push updater phase changes |

---

## Rewrite flow (main process)

```
globalShortcut fires
  → clipboard.readSelectedText()   (⌘C + read clipboard)
  → buildPrompt(action, style, settings)
  → provider.rewrite(prompt)       (HTTP call to AI API)
  → clipboard.writeAndPaste(result) (write to clipboard + ⌘V)

Progress is pushed to the popup window via IPC at each step.
```

The three rewrite actions are `grammar`, `rephrase`, and `translate`. For `rephrase`, the active `StylePreset` is included in the prompt. The `popup` hotkey opens `FloatingPopup` in `palette` mode so the user can pick a style before the rewrite starts.

---

## Settings

Stored at `app.getPath('userData')/settings.json`. API keys are encrypted with Electron's `safeStorage` (macOS Keychain-backed) before writing, and decrypted on read. The in-memory `LiSettings` object always has plaintext values.

Default style presets (defined in `settings.ts`): Grammar only, Friendly, Business, Concise, Funny, Curious, Supportive. Users can add custom presets via the UI.

---

## Color system

All colors are CSS custom properties with space-separated RGB channels so Tailwind opacity modifiers work:

```css
--color-ink   /* background */
--color-panel /* card/surface background */
--color-line  /* borders */
--color-mist  /* primary text */
--color-sub   /* secondary text ~70% */
--color-dim   /* muted/supplemental text ~48% */
--color-acid  /* accent (white dark / near-black light) */
--color-ember /* destructive / error */
--color-cyan  /* info / neutral accent */
```

Light theme values are on `:root[data-theme="light"]`. Theme toggling is handled in `main/index.ts` via `nativeTheme` and IPC.

Usage in Tailwind: `text-sub`, `bg-panel`, `border-line/60`, etc. Prefer `text-sub` for interactive/structural secondary text and `text-dim` for hints, descriptions, and metadata.

---

## Adding a new AI provider

1. Create `src/main/ai/providers/<name>.ts` — export a `rewrite(prompt: BuiltPrompt, settings: LiSettings): Promise<string>` function
2. Add the provider ID to `ProviderId` in `src/shared/types.ts`
3. Add the provider entry to `LiSettings` (api key field + model field) in `src/shared/types.ts`
4. Register it in `src/main/index.ts` in the provider dispatch switch
5. Add default values in `src/main/settings.ts`
6. Add the UI entry in `src/renderer/components/SettingsView.tsx` (PROVIDERS array + form fields)

---

## Building & packaging

```bash
pnpm dev          # dev mode with hot-reload
pnpm build        # tsc + electron-vite build (no packaging)
pnpm dist:mac     # build + DMG for arm64 + x64
pnpm release      # build + notarize + publish GitHub Release
```

The `afterSign` hook in `scripts/notarize.mjs` runs automatically during `dist:mac` and `release`. It uses the `li-notary` Keychain profile or falls back to `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` env vars. If neither is present, notarization is skipped and the build still succeeds.

---

## Key constraints

- **macOS only** for the clipboard simulation and tray/dock features (Windows/Linux stubs exist but are untested)
- **Accessibility permission required** — without it, ⌘C/⌘V simulation fails silently
- **No server** — Li never sends data anywhere except the AI provider the user configures
- **One window at a time** — the floating popup and settings window are separate `BrowserWindow` instances; the popup is frameless and always-on-top
