# Gather Controller

Userscript pra controlar Gather.town via WebSocket. Painel glass com self/auto/prof/chat/admin/watch/inspector/discover/rooms.

## Instalar

**Click pra instalar no Tampermonkey** (auto-update via `@updateURL`):

👉 https://github.com/gilopavani/gather-ctl/raw/main/dist/gather-ctl.user.js

Cola URL no browser com Tampermonkey ativo → modal "Install" → confirma.

Atualizar manualmente: TM dashboard → script → ⚙ → "Check for userscript updates".

## Estrutura

```
src/
  header.txt      banner UserScript
  ws-hook.js      hook WebSocket (document-start)
  styles.css      CSS painel
  template.html   HTML painel
  util.js         uuid, extToStr, h2b
  boot.js         lógica principal (state, API, UI wire-up)
  main.js         entry
build.mjs         esbuild bundler
dist/             saída buildada
```

## Build

```sh
npm install
npm run build      # gera dist/gather-ctl.user.js
npm run watch      # rebuild ao salvar src/
```

## Features

- **self**: move/face/teleport/walk-to/recorder/favoritas (F1-F9)
- **auto**: spin/walk/dance/random/tp-loop (toggles independentes)
- **prof**: name/emoji/text status/title/pronouns/emote
- **chat**: histórico + envio + export
- **admin**: teleport/face/move/mute/follow/spotlight/ghost/block/kick/ban (precisa permissão server)
- **watch**: alerta quando user entra (bip + notif desktop)
- **insp**: live frame inspector com regex include/exclude
- **disc**: actions/models/types vistos + envio raw
- **rooms**: lock/unlock MapArea, lista de rooms/maps, tp entre maps, enterSpace, loadSpaceUser

## Console API

```js
ctl.teleport(x, y, dir, mapId)
ctl.teleportToMap(mapId, x, y)
ctl.teleportToArea(areaId)
ctl.lockArea(id) / ctl.unlockArea(id) / ctl.toggleAreaLock(id)
ctl.dumpAreas() / ctl.dumpMaps()
ctl.raw({ type: 'Action', action: '...', args: [...] })
ctl.healthCheck()
```

## Keybinds

- `Ctrl+G` — toggle painel
- `M` — pill mode
- `S` — stop all loops
- `F1-F9` — tp pra favorita slot N
- `Shift+F1-F9` — salva pos atual em slot N
