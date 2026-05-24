# Li

**Free, open-source alternative to Grammarly — powered by your own AI API key.**

Li lives in the macOS menu bar and works in every app. Select any text, press a hotkey, and it is rewritten in place — no copy-pasting, no browser extension, no subscription.

---

## How it works

1. **Select text** in any app — email, Slack, Notes, Terminal, anything
2. **Press a hotkey** — fix grammar, rephrase, or translate
3. **Done** — Li reads the selection, rewrites it, and types the result back automatically

You never leave the app you're in. Li simulates ⌘C to read and ⌘V to replace, so the edit happens right where you're typing.

### Style presets

The **rephrase** action applies a style preset you choose — Friendly, Business, Concise, Funny, and more. You can also define a custom style preset with your own instruction, or describe your personal writing style once and Li will respect it across all rewrites.

---

## Quick start

```bash
pnpm install
pnpm dev
```

Li is tray-first. After launch, look for the **Li** icon in the macOS menu bar.  
There is no main window — use the hotkeys or click the tray/dock icon to open Settings.

> **Accessibility permission required** — Li simulates ⌘C / ⌘V to read and replace
> selected text. macOS will prompt on first use, or grant it manually in
> `System Settings → Privacy & Security → Accessibility`.

---

## Default hotkeys

| Action | Shortcut |
|---|---|
| Fix grammar | `⌘ ⌃ G` |
| Rephrase | `⌘ ⌃ R` |
| Translate to English | `⌘ ⌃ T` |
| Open style popup | `⌘ ⌃ P` |

All hotkeys are fully customisable in **Settings → Hotkeys**.

---

## Supported AI providers

Li is free — you only pay for what you use via your own API key. Fast, cheap models like `gpt-4.1-mini` or `gemini-3.5-flash` cost fractions of a cent per rewrite.

| Provider | Suggested models |
|---|---|
| OpenAI | `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-4.1`, `o4-mini` |
| Anthropic | `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-7` |
| Groq | `llama-4-scout-17b-16e-instruct`, `llama-4-maverick-17b-128e-instruct` |
| OpenRouter | Any model via a single API key (e.g. `openai/gpt-4.1-mini`) |
| Gemini | `gemini-3.1-flash-lite`, `gemini-3.5-flash`, `gemini-3.1-pro` |
| Ollama | Any locally running model (`http://localhost:11434` by default) |

Configure your provider and API key in **Settings → Provider**.  
API keys are encrypted at rest using macOS's native secure storage.

---

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start in development mode with hot-reload |
| `pnpm build` | TypeScript check + electron-vite production bundle |
| `pnpm typecheck` | Type-check only, no emit |
| `pnpm preview` | Preview the production build without packaging |
| `pnpm icons` | Generate `build/icon.icns` from the logo (run once, or after logo changes) |
| `pnpm dist:mac` | Build + package → `dist/Li-x.x.x-{arm64,x64}.dmg` |
| `pnpm dist` | Build + package for all platforms |
| `pnpm release` | Build + publish a GitHub Release (requires `GH_TOKEN`) |

---

## Project structure

```
src/
  main/               Electron main process
    ai/
      providers/      One file per AI provider
      promptBuilder.ts  Builds system + user prompt from action + style + settings
    index.ts          App entry — tray, dock, shortcuts, IPC
    settings.ts       Persisted settings with encrypted API keys
    clipboard.ts      ⌘C / ⌘V simulation via accessibility
    shortcuts.ts      Global hotkey registration
  preload/            Context bridge (exposes window.li to the renderer)
  renderer/           React UI
    components/       FloatingPopup, SettingsView, HotkeyRecorder, StyleSelector, …
    store/            Zustand store
    styles/           Global CSS + Tailwind config
  shared/             Types shared across main / preload / renderer

scripts/
  generate-icons.mjs  Builds build/icon.icns from the logo (pure Node, no deps)
  notarize.mjs        afterSign hook — submits to Apple notary service

build/
  icon.icns           Generated app icon — commit this, or regenerate with pnpm icons
  entitlements.mac.plist  Hardened runtime entitlements for notarization
```
