# Repository Guidelines

## Project Structure & Module Organization

This repository builds a Tampermonkey userscript for controlling Gather.town through WebSocket messages.

- `src/main.js` is the entry point and loads the WebSocket hook plus boot logic.
- `src/boot.js` contains most runtime state, UI wiring, command helpers, and Gather protocol handling.
- `src/ws-hook.js` installs the document-start WebSocket capture hook.
- `src/styles.css` and `src/template.html` define the panel UI and are bundled as text.
- `src/header.txt` is the userscript metadata banner.
- `build.mjs` bundles the source with esbuild into `dist/gather-ctl.user.js`.
- `dist/` contains the generated installable userscript. Rebuild it when source files change.

## Build, Test, and Development Commands

Run commands from the repository root.

```sh
npm install
npm run build
npm run watch
```

- `npm install` installs the local esbuild dependency.
- `npm run build` produces `dist/gather-ctl.user.js`.
- `npm run watch` rebuilds continuously while editing files under `src/`.

There is currently no automated test or lint script in `package.json`; use `npm run build` as the required validation step before committing.

## Coding Style & Naming Conventions

Use modern ES modules and keep browser-facing code dependency-light. Follow the existing style: two-space indentation in JSON, semicolons in JavaScript, single quotes for strings, `const`/`let` instead of `var`, and small arrow-function helpers for local behavior. Keep exported module boundaries clear: shared helpers belong in `src/util.js`, startup orchestration in `src/main.js`, and Gather/UI behavior in `src/boot.js`.

Name files with lowercase kebab-style where practical, matching `ws-hook.js`. Prefer descriptive command/helper names such as `teleportToArea`, `safeStringify`, or `sendRaw`.

## Testing Guidelines

Before opening a PR, run:

```sh
npm run build
```

Then smoke test the generated `dist/gather-ctl.user.js` in Tampermonkey on Gather.town. Verify the panel opens, WebSocket capture initializes, and any changed feature works from the UI and, when applicable, through the `window.ctl` console API.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries, for example `Fix wrong-userId hijack + smarter teleportToMap` and `Improve teleportToArea + capture full MapArea data`. Keep commits focused on one behavior change.

Pull requests should include a concise description, the Gather feature or command affected, build output status, and manual browser smoke-test notes. Include screenshots only for visible panel or styling changes.

## Security & Configuration Tips

Do not commit secrets, captured private Gather payloads, or personal space IDs. Be careful with `src/header.txt`: `@updateURL` and install metadata affect all users who update through Tampermonkey.
