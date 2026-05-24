# Li

Fast universal AI text rewriting layer for desktop — lives in the menu bar, works in any app.

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

## Building a distributable DMG

```bash
# 1. Generate the app icon (only needed once, or after logo changes)
pnpm icons

# 2. Build and package — produces both arm64 and x64 DMGs
pnpm dist:mac

# Output:
#   dist/Li-0.1.0-arm64.dmg   (Apple Silicon)
#   dist/Li-0.1.0-x64.dmg     (Intel)
```

To target a single architecture (faster for local testing):

```bash
pnpm build
npx electron-builder --mac --arch arm64 --publish never
```

### Notarization (required for distribution outside the App Store)

Without notarization, macOS shows a "cannot be opened because the developer cannot be verified" error for users who download the DMG.

**Prerequisites**
- Apple Developer Program membership ($99/year) — [developer.apple.com](https://developer.apple.com)
- **Developer ID Application** certificate installed in your Keychain (create in Xcode → Settings → Accounts, or on developer.apple.com)
- App-specific password — generate one at [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords
- Your 10-character Team ID — find it at [developer.apple.com/account](https://developer.apple.com/account) under Membership

**One-time setup**

The notarize hook (`scripts/notarize.mjs`) and entitlements (`build/entitlements.mac.plist`) are already in the repo. `@electron/notarize` is already in devDependencies.

Store your Apple credentials in macOS Keychain once:

```bash
xcrun notarytool store-credentials "li-notary" \
  --apple-id "you@example.com" \
  --team-id "XXXXXXXXXX" \
  --password "xxxx-xxxx-xxxx-xxxx"
```

The profile name `li-notary` is the default the hook looks for. Override with the `NOTARY_KEYCHAIN_PROFILE` env var if you use a different name (or want to reuse a profile across projects).

**Build and notarize**

```bash
pnpm dist:mac
```

electron-builder signs the app, then the `afterSign` hook submits it to Apple's notary service and staples the ticket to the DMG automatically. The process takes 1–3 minutes.

**CI / no keychain available**

If the keychain profile isn't found, the hook falls back to env vars:

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"

pnpm dist:mac
```

**Verify notarization**

```bash
spctl --assess --type open --context context:primary-signature dist/mac-arm64/Li.app
# should print: source=Notarized Developer ID
```

### Publishing a release

1. Set your GitHub username in `package.json` → `build.publish.owner`
2. Create a GitHub token with `repo` scope
3. Run:

```bash
APPLE_ID=you@example.com \
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx \
APPLE_TEAM_ID=XXXXXXXXXX \
GH_TOKEN=your_token \
pnpm release
```

This builds, notarizes, creates a GitHub Release, and uploads the DMGs as release assets.  
The in-app auto-updater will pick up new releases automatically.

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

| Provider | Suggested models |
|---|---|
| OpenAI | `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-4.1`, `o4-mini` |
| Anthropic | `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-7` |
| Groq | `llama-4-scout-17b-16e-instruct`, `llama-4-maverick-17b-128e-instruct` |
| OpenRouter | Any model via a single API key (e.g. `openai/gpt-4.1-mini`) |
| Gemini | `gemini-3.1-flash-lite`, `gemini-3.5-flash`, `gemini-3.1-pro` |
| Ollama | Any locally running model (`http://localhost:11434` by default) |

Configure your provider and API key in **Settings → Provider**.

---

## Project structure

```
src/
  main/               Electron main process
    ai/
      providers/      One file per AI provider
    index.ts          App entry — tray, dock, shortcuts, IPC
    settings.ts       Persisted settings with encrypted API keys
  preload/            Context bridge (exposes window.li to the renderer)
  renderer/           React UI
    components/       FloatingPopup, SettingsView, HotkeyRecorder, …
    store/            Zustand store
    styles/           Global CSS + Tailwind config
  shared/             Types shared across main / preload / renderer

scripts/
  generate-icons.mjs  Builds build/icon.icns from the logo (pure Node, no deps)

build/
  icon.icns           Generated app icon — commit this, or regenerate with pnpm icons
```
