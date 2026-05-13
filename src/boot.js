import { uuid, extToStr, h2b, safeStringify } from './util.js';
import css from './styles.css';
import templateHtml from './template.html';

export async function boot() {
  const hook = window.__wsHook;
  if (!hook) { console.warn('[GatherCtl] sem hook WebSocket'); return; }

  if (!window.msgpackr) {
    window.msgpackr = await import('https://esm.sh/msgpackr@1.11.2');
    for (let t = 0; t < 128; t++) {
      try { window.msgpackr.addExtension({ type: t, unpack: b => ({ __ext: t, bytes: [...b] }) }); } catch {}
    }
  }
  const gIdx = window.__findGather();
  if (gIdx < 0 || !hook.sockets[gIdx]?.ws || hook.sockets[gIdx].ws.readyState !== 1) {
    return setTimeout(boot, 500);
  }
  const sock = hook.sockets[gIdx];
  const packr = new window.msgpackr.Packr({ useRecords: false });
  const unpackr = new window.msgpackr.Unpackr({ useRecords: false, mapsAsObjects: true });

  let userId = new URL(location.href).searchParams.get('userId');
  if (!userId) {
    for (const f of hook.frames) {
      if (f.dir !== 'send' || !f.hex) continue;
      try {
        const o = unpackr.unpack(h2b(f.hex).slice(0, f.len));
        if (o?.type === 'Action' && o?.args?.[0] === 'SpaceUser' && typeof o.args[1] === 'string') {
          userId = o.args[1]; break;
        }
      } catch {}
    }
  }
  if (!userId) return setTimeout(boot, 500);

  const spaceId = sock.url.match(/spaceId=([^&]+)/)?.[1];
  const getLiveGatherWS = () => {
    const candidates = hook.sockets.filter(s => s.url.includes('gather-game-v2') && s.ws?.readyState === 1);
    return candidates[candidates.length - 1]?.ws;
  };
  const sendRaw = obj => {
    const ws = getLiveGatherWS();
    if (!ws) { console.warn('[GatherCtl] sem WS ativo'); health.wsState = 'down'; return obj; }
    if (obj.txnId && obj.type === 'Action') {
      pendingTxns.set(obj.txnId, { action: obj.action, target: obj.args?.[0], t: Date.now() });
    }
    try { ws.send(packr.pack(obj)); health.lastSend = Date.now(); }
    catch (e) { console.warn('[GatherCtl] send falhou', e); health.wsState = 'error'; }
    return obj;
  };
  const act = (name, tail=[]) => sendRaw({ type: 'Action', action: name, args: ['SpaceUser', userId, ...tail], txnId: uuid() });
  const actOn = (tid, name, tail=[]) => sendRaw({ type: 'Action', action: name, args: ['SpaceUser', tid, ...tail], txnId: uuid() });
  const confettiTargetUserId = '0c637348-7baa-45dc-9157-c7f21487339b';
  const normalizeOutfit = raw => {
    const outfit = raw?.type === 'Action' && raw?.action === 'saveSpaceOutfit'
      ? raw.args?.[2]
      : (Array.isArray(raw) ? raw[2] : raw);
    if (!outfit || typeof outfit !== 'object' || Array.isArray(outfit)) return null;
    return Object.fromEntries(Object.entries(outfit).filter(([, v]) => {
      return !(v && typeof v === 'object' && v.__ext === 4 && Array.isArray(v.bytes) && v.bytes.length === 0);
    }));
  };

  // ==================== 3. State tracking ====================
  const state = {
    users: new Map(),
    objects: new Map(),
    maps: new Map(),
    myPos: { x: null, y: null, direction: 'Down', mapId: null },
    chatMessages: [],
    lastUpdate: 0,
    actionsSeen: new Map(),
    modelsSeen: new Map(),
    msgTypes: new Map(),
    mapAreas: new Map(),
  };
  const watchList = new Map();
  const actionLog = [];
  const chatLog = [];
  const pendingTxns = new Map();
  const health = { lastRecv: 0, lastSend: 0, lastAck: 0, wsState: 'init', userIdValid: true, reconnects: 0, panelOk: true };

  const pushChat = entry => {
    chatLog.push({ t: Date.now(), ...entry });
    if (chatLog.length > 300) chatLog.shift();
  };

  const ingestFrame = (o, dir='recv') => {
    if (!o) return;
    if (o.type) {
      state.msgTypes.set(o.type, (state.msgTypes.get(o.type) || 0) + 1);
    }
    if (dir === 'send' && o.type === 'Action' && o.action) {
      const cur = state.actionsSeen.get(o.action) || { count: 0, lastArgs: null, t: 0 };
      cur.count++;
      cur.lastArgs = o.args;
      cur.t = Date.now();
      state.actionsSeen.set(o.action, cur);
      // outgoing chat capture
      if (o.action === 'chat' && o.args?.[2]) {
        const msg = o.args[2];
        pushChat({ fromMe: true, from: userId, text: msg.contents, recipient: msg.chatRecipient });
      }
    }
    if (dir === 'recv') health.lastRecv = Date.now();
    if (Array.isArray(o?.actionReturns)) {
      health.lastAck = Date.now();
      for (const ar of o.actionReturns) {
        const pending = pendingTxns.get(ar.txnId);
        actionLog.push({
          t: Date.now(),
          action: pending?.action || '?',
          target: pending?.target || '?',
          result: ar.result?.type,
          error: ar.result?.error?.slice(0, 250)
        });
        if (actionLog.length > 100) actionLog.shift();
        pendingTxns.delete(ar.txnId);
      }
    }
    if (o.type !== 'DeltaState' && o.type !== 'FullStateChunk') return;
    const patches = o.patches || o.fullStatePatches || [];
    for (const p of patches) {
      if (p?.model) state.modelsSeen.set(p.model, (state.modelsSeen.get(p.model) || 0) + 1);
      // chat message capture from patches (incoming)
      if (p?.model && /chat/i.test(p.model) && p.data && typeof p.data === 'object') {
        if (p.data.contents || p.data.text || p.data.message) {
          pushChat({
            fromMe: false,
            from: p.data.senderId || p.data.userId || p.data.from || '?',
            text: p.data.contents || p.data.text || p.data.message,
            recipient: p.data.recipient || p.data.chatRecipient,
            model: p.model,
          });
        }
      }
      if (p?.model === 'Map') {
        const id = extToStr(p.id || p.data?.id);
        if (id) {
          const rec = state.maps.get(id) || { id };
          if (p.data && typeof p.data === 'object') {
            for (const k of ['name','dimensions','backgroundImagePath','spawns']) {
              if (p.data[k] !== undefined) rec[k] = p.data[k];
            }
          }
          if (p.op === 'replace' && p.path === '/name') rec.name = p.value;
          if (p.op === 'remove' && p.path === '') state.maps.delete(id);
          else state.maps.set(id, rec);
        }
      }
      if (p?.model === 'MapArea') {
        const id = extToStr(p.id || p.data?.id);
        if (id) {
          const rec = state.mapAreas.get(id) || { id };
          if (p.data && typeof p.data === 'object') {
            // captura tudo — geometria pode estar em campos variados
            Object.assign(rec, p.data);
            rec.id = id;
          }
          if (p.op === 'replace' && p.path) {
            const key = p.path.replace(/^\//, '').split('/')[0];
            if (key) rec[key] = p.value !== undefined ? p.value : p.data;
          }
          if (p.op === 'remove' && p.path === '') { state.mapAreas.delete(id); }
          else state.mapAreas.set(id, rec);
        }
      }
      if (p?.model === 'SpaceUser') {
        const id = p.id || p.data?.id;
        if (!id) continue;
        const rec = state.users.get(id) || { id };
        if (p.data && typeof p.data === 'object') {
          for (const k of ['name','emojiStatus','textStatus','customStatus','availability','status','away','ghost','outfitString','spotlighted']) {
            if (p.data[k] !== undefined) rec[k] = p.data[k];
          }
          if (p.data.position?.x !== undefined) rec.x = p.data.position.x;
          if (p.data.position?.y !== undefined) rec.y = p.data.position.y;
          if (p.data.position?.direction !== undefined) rec.direction = p.data.position.direction;
          if (p.data.position?.mapId !== undefined) rec.mapId = p.data.position.mapId;
        }
        if (p.op === 'replace' && p.path) {
          if (p.path === '/position/x') rec.x = p.value;
          if (p.path === '/position/y') rec.y = p.value;
          if (p.path === '/position/direction') rec.direction = p.value;
          if (p.path === '/position/mapId') rec.mapId = p.value;
          if (p.path === '/name') rec.name = p.value;
          if (p.path === '/emojiStatus') rec.emojiStatus = p.value;
          if (p.path === '/textStatus') rec.textStatus = p.value;
          if (p.path === '/away') rec.away = p.value;
          if (p.path === '/ghost') rec.ghost = p.value;
        }
        if (p.op === 'remove' && p.path === '') { state.users.delete(id); continue; }
        state.users.set(id, rec);
        if (id === userId) {
          if (rec.x !== undefined) state.myPos.x = rec.x;
          if (rec.y !== undefined) state.myPos.y = rec.y;
          if (rec.direction !== undefined) state.myPos.direction = rec.direction;
          if (rec.mapId !== undefined) state.myPos.mapId = rec.mapId;
        }
      }
    }
    state.lastUpdate = Date.now();
  };

  // Backfill
  for (const f of hook.frames) {
    if (f.socketIdx !== gIdx || !f.hex) continue;
    try { ingestFrame(unpackr.unpack(h2b(f.hex).slice(0, f.len)), f.dir); } catch {}
  }

  // Live listeners — outbound + inbound parsing
  const attachedWs = new WeakSet();
  const liveFrames = []; const maxLive = 1000;
  const pushLive = (dir, obj, raw) => {
    if (liveFrames.length >= maxLive) liveFrames.shift();
    liveFrames.push({ dir, t: Date.now(), obj, len: raw?.byteLength || raw?.length || 0 });
  };
  const attachListener = () => {
    for (const s of hook.sockets) {
      if (!s.url.includes('gather-game-v2')) continue;
      if (attachedWs.has(s.ws)) continue;
      if (s.ws.readyState > 1) continue;
      attachedWs.add(s.ws);
      s.ws.addEventListener('message', e => {
        if (!(e.data instanceof ArrayBuffer) && !(e.data instanceof Blob)) return;
        const consume = ab => { try { const o = unpackr.unpack(new Uint8Array(ab)); ingestFrame(o, 'recv'); pushLive('recv', o, ab); } catch {} };
        if (e.data instanceof ArrayBuffer) consume(e.data);
        else e.data.arrayBuffer().then(consume);
      });
      const origSend = s.ws.send.bind(s.ws);
      s.ws.send = function(d) {
        if (d instanceof Uint8Array || d instanceof ArrayBuffer) {
          try {
            const ab = d instanceof Uint8Array ? d : new Uint8Array(d);
            const o = unpackr.unpack(ab);
            ingestFrame(o, 'send');
            pushLive('send', o, ab);
          } catch {}
        }
        return origSend(d);
      };
    }
  };
  attachListener();
  setInterval(attachListener, 1000);

  // ==================== 4. Controller API ====================
  const ctl = {
    userId, spaceId, socket: sock, state, watchList, liveFrames, chatLog,

    // movement — teleport SEMPRE inclui mapId atual (fix)
    move: dir => act('move', [{ direction: dir }]),
    face: dir => act('faceDirection', [dir]),
    teleport: (x, y, d='Down', mapId) => {
      const mid = mapId || state.myPos.mapId;
      const payload = { x, y, direction: d };
      if (mid) payload.mapId = mid;
      return act('teleport', [payload]);
    },
    respawn: () => act('respawn', [{}]),
    ghost: (on=true) => act('ghost', [{ ghost: on }]),
    setAway: (away=true) => act('setAway', [{ away }]),

    // profile
    setName: name => act('setName', [name]),
    setEmojiStatus: emoji => act('setEmojiStatus', [emoji]),
    setTextStatus: txt => act('setTextStatus', [txt]),
    setPronouns: p => act('setPronouns', [p]),
    setTitle: t => act('setTitle', [t]),
    setDescription: d => act('setDescription', [d]),
    saveSpaceOutfit: outfit => {
      const normalized = normalizeOutfit(outfit);
      if (!normalized) return null;
      return act('saveSpaceOutfit', [normalized]);
    },
    setOutfit: outfit => ctl.saveSpaceOutfit(outfit),
    setCustomStatus: ({ text='', clearMinutes=60 }={}) => {
      const payload = {
        text,
        clearCondition: {
          type: 'DateTime',
          clearAt: new Date(Date.now() + Math.max(1, clearMinutes) * 60000).toISOString(),
        },
      };
      return act('setCustomStatus', [payload]);
    },
    clearCalendarInferredStatus: () => act('clearCalendarInferredStatus'),
    setMyAvailability: (availability='Active') => act('setAvailability', [{ availability, debugSource: 'GatherCtl.profile' }]),

    // fx / social
    emote: (emote, count=1) => act('broadcastEmote', [{ emote, count, ambientlyConnectedUserIds: [userId] }]),
    confetti: () => act('shootConfetti', []),
    throwTargetConfetti: () => sendRaw({ type: 'Action', action: 'throwConfetti', args: ['SpaceUser', confettiTargetUserId] }),
    shakeCamera: (intensity=10, durationMs=1000) => act('fxShakeCamera', [{ mapId: state.myPos.mapId, targetUserId: userId, intensity, durationMs }]),
    wave: tid => act('wave', [{ user: tid, isReply: false }]),
    ring: tid => act('ring', [{ user: tid }]),

    // chat
    chat: (text, recipient='global') => sendRaw({
      type: 'Action', action: 'chat',
      args: ['SpaceUser', userId, { chatRecipient: recipient, mapId: state.myPos.mapId, contents: text }],
      txnId: uuid()
    }),

    // others
    teleportUser: (tid, x, y, d='Down', mapId) => {
      const mid = mapId || state.users.get(tid)?.mapId || state.myPos.mapId;
      const payload = { x, y, direction: d };
      if (mid) payload.mapId = mid;
      return actOn(tid, 'teleport', [payload]);
    },
    faceUser: (tid, d) => actOn(tid, 'faceDirection', [d]),
    moveUser: (tid, d) => actOn(tid, 'move', [{ direction: d }]),
    followUser: tid => actOn(tid, 'follow', [{}]),
    unfollowUser: tid => actOn(tid, 'unfollow', [{}]),
    forceMute: (tid, mediaKind='audio') => actOn(tid, 'forceMute', [{ mediaKind }]),
    setAvailability: (tid, availability) => actOn(tid, 'setAvailability', [{ availability, debugSource: 'GatherCtl.userList' }]),
    spotlightUser: (tid, on=true) => act('setSpotlight', [{ spotlightedUser: tid, isSpotlighted: on }]),
    ghostUser: (tid, on=true) => actOn(tid, 'ghost', [{ ghost: on }]),
    blockUser: (tid, on=true) => act('block', [{ blockedUserId: tid, blocked: on }]),
    kickUser: tid => act('kick', [{ user: tid }]),
    banUser: tid => act('ban', [{ user: tid }]),
    requestMuteUser: (tid, video=false) => act('requestMute', [{ target: tid, video }]),

    // map areas (lock/unlock portas/salas — sem precisar estar dentro)
    lockArea: areaId => sendRaw({ type: 'Action', action: 'lock', args: ['MapArea', areaId], txnId: uuid() }),
    unlockArea: areaId => sendRaw({ type: 'Action', action: 'unlock', args: ['MapArea', areaId], txnId: uuid() }),
    toggleAreaLock: areaId => {
      const a = state.mapAreas.get(areaId);
      return a?.locked ? ctl.unlockArea(areaId) : ctl.lockArea(areaId);
    },
    lockAll: () => { for (const id of state.mapAreas.keys()) ctl.lockArea(id); },
    unlockAll: () => { for (const id of state.mapAreas.keys()) ctl.unlockArea(id); },
    dumpAreas: () => {
      const fromState = [...state.mapAreas.values()];
      const fromFrames = liveFrames
        .flatMap(f => f.obj?.patches || f.obj?.fullStatePatches || [])
        .filter(p => p?.model === 'MapArea')
        .map(p => ({ id: extToStr(p.id || p.data?.id), name: p.data?.name, locked: p.data?.locked, mapId: p.data?.mapId }));
      const merged = new Map();
      for (const a of [...fromState, ...fromFrames]) if (a.id) merged.set(String(a.id), { ...(merged.get(String(a.id))||{}), ...a });
      return [...merged.values()];
    },

    // join meeting area (server teleporta automaticamente)
    joinMeeting: () => act('updateTargetMeetingArea', [{}]),
    joinMeetingAs: tid => actOn(tid, 'updateTargetMeetingArea', [{}]),

    // teleport entre maps/rooms (mesmo space)
    teleportToMap: (mapId, x=5, y=5, d='Down') => act('teleport', [{ x, y, direction: d, mapId }]),
    teleportToArea: (areaId, strategy='auto') => {
      const a = state.mapAreas.get(areaId);
      if (!a) { console.warn('[tpArea] area não encontrada no state:', areaId); return; }
      console.log('[tpArea] area data:', a);

      // estratégia 1: usar boundary/bounds/region/rect se existir
      const geom = a.boundary || a.bounds || a.region || a.rect || a;
      const x = geom.x ?? geom.left ?? geom.minX;
      const y = geom.y ?? geom.top ?? geom.minY;
      const w = geom.width ?? geom.w ?? ((geom.maxX!=null && geom.minX!=null) ? geom.maxX-geom.minX : null);
      const h = geom.height ?? geom.h ?? ((geom.maxY!=null && geom.minY!=null) ? geom.maxY-geom.minY : null);

      if (strategy === 'meeting' || a.areaType === 'meeting' || a.type === 'meeting') {
        console.log('[tpArea] tentando updateTargetMeetingArea com areaId');
        return act('updateTargetMeetingArea', [{ areaId, mapAreaId: areaId }]);
      }
      if (x != null && y != null && w != null && h != null) {
        const cx = Math.floor(x + w/2);
        const cy = Math.floor(y + h/2);
        const mapId = a.mapId || state.myPos.mapId;
        console.log(`[tpArea] teleport (${cx},${cy}) mapId=${mapId}`);
        return act('teleport', [{ x: cx, y: cy, direction: 'Down', mapId }]);
      }
      console.warn('[tpArea] sem geometria, tentando updateTargetMeetingArea fallback');
      return act('updateTargetMeetingArea', [{ areaId, mapAreaId: areaId }]);
    },
    dumpMaps: () => [...state.maps.values()],

    // space hop
    enterSpace: tid => actOn(tid, 'enterSpace', []),
    loadSpaceUser: (connectionTarget='OfficeView') => sendRaw({
      type: 'Action', action: 'loadSpaceUser',
      args: ['SpaceUser', null, { connectionTarget }],
      txnId: uuid()
    }),
    gotoSpace: spaceId => { location.href = `https://app.gather.town/app/${spaceId}`; },

    // generic + raw
    actModel: (model, id, name, tail=[]) => sendRaw({ type: 'Action', action: name, args: [model, id, ...tail], txnId: uuid() }),
    tryAction: (n, args) => act(n, args),
    tryActionOn: (tid, n, args) => actOn(tid, n, args),
    raw: sendRaw,
  };

  // ==================== 5. Loops (toggles) ====================
  const loops = {};
  const stopLoop = k => { if (loops[k]) { clearInterval(loops[k]); delete loops[k]; } };
  const stopAll = () => { for (const k of Object.keys(loops)) stopLoop(k); };

  const DIRS = ['Up','Right','Down','Left'];

  ctl.spin = (ms=200) => { stopLoop('spin'); let i=0; loops.spin = setInterval(() => ctl.face(DIRS[i++%4]), ms); };
  ctl.walkSquare = (ms=180) => { stopLoop('walk'); let i=0, steps=0; loops.walk = setInterval(() => { ctl.move(DIRS[i]); if (++steps>=5) { steps=0; i=(i+1)%4; } }, ms); };
  ctl.spinConfetti = (ms=200) => {
    stopLoop('walk');
    let i = 0;
    loops.walk = setInterval(() => {
      ctl.face(DIRS[i++ % 4]);
      ctl.throwTargetConfetti();
    }, ms);
  };
  ctl.randomWalk = (ms=300) => { stopLoop('rand'); loops.rand = setInterval(() => ctl.move(DIRS[Math.floor(Math.random()*4)]), ms); };
  ctl.dance = (ms=150) => {
    stopLoop('dance');
    const moves = ['Up','Up','Down','Down','Left','Right','Left','Right'];
    let i = 0;
    loops.dance = setInterval(() => {
      const d = moves[i++ % moves.length];
      if (i % 2 === 0) ctl.face(d); else ctl.move(d);
    }, ms);
  };
  ctl.tpLoop = (coords, ms=800) => { stopLoop('tp'); let i=0; loops.tp = setInterval(() => { const [x,y,d] = coords[i++%coords.length]; ctl.teleport(x,y,d||'Down'); }, ms); };
  ctl.confettiSpam = (ms=400) => { stopLoop('conf'); loops.conf = setInterval(() => ctl.throwTargetConfetti(), ms); };

  ctl.walkTo = (tx, ty, ms=150) => {
    stopLoop('walkto');
    loops.walkto = setInterval(() => {
      const px = state.myPos.x, py = state.myPos.y;
      if (px === null || py === null) return;
      const dx = tx - px, dy = ty - py;
      if (dx === 0 && dy === 0) { stopLoop('walkto'); console.log('[ctl] chegou em', tx, ty); return; }
      if (Math.abs(dx) >= Math.abs(dy)) ctl.move(dx > 0 ? 'Right' : 'Left');
      else ctl.move(dy > 0 ? 'Down' : 'Up');
    }, ms);
  };

  ctl.follow = (tid, offset=1, ms=500) => {
    stopLoop('follow');
    loops.follow = setInterval(() => {
      const u = state.users.get(tid);
      if (!u || u.x === undefined) return;
      ctl.teleport(u.x + offset, u.y, 'Left', u.mapId);
    }, ms);
  };

  // Recorder
  const recorder = { recording: false, events: [], t0: 0 };
  ctl.recordStart = () => { recorder.recording = true; recorder.events = []; recorder.t0 = Date.now(); console.log('[rec] start'); };
  ctl.recordStop = () => { recorder.recording = false; console.log(`[rec] stop (${recorder.events.length} eventos)`); return recorder.events; };
  ctl.recordReplay = async () => {
    console.log('[rec] replay', recorder.events.length);
    let last = 0;
    for (const e of recorder.events) {
      await new Promise(r => setTimeout(r, e.t - last));
      last = e.t;
      if (e.kind === 'move') ctl.move(e.dir);
      else if (e.kind === 'face') ctl.face(e.dir);
      else if (e.kind === 'tp') ctl.teleport(e.x, e.y, e.d, e.m);
    }
    console.log('[rec] replay done');
  };
  const origMove = ctl.move, origFace = ctl.face, origTp = ctl.teleport;
  ctl.move = dir => { if (recorder.recording) recorder.events.push({ kind:'move', dir, t: Date.now() - recorder.t0 }); return origMove(dir); };
  ctl.face = dir => { if (recorder.recording) recorder.events.push({ kind:'face', dir, t: Date.now() - recorder.t0 }); return origFace(dir); };
  ctl.teleport = (x,y,d='Down',m) => { if (recorder.recording) recorder.events.push({ kind:'tp', x, y, d, m, t: Date.now() - recorder.t0 }); return origTp(x,y,d,m); };

  // Favoritas
  const favKey = `gather-ctl-favs-${spaceId}`;
  const loadFavs = () => { try { return JSON.parse(localStorage.getItem(favKey) || '{}'); } catch { return {}; } };
  const saveFavs = favs => localStorage.setItem(favKey, safeStringify(favs));
  ctl.saveFav = slot => {
    const favs = loadFavs();
    favs[slot] = { x: state.myPos.x, y: state.myPos.y, d: state.myPos.direction, m: state.myPos.mapId };
    saveFavs(favs);
    return favs[slot];
  };
  ctl.tpFav = slot => { const f = loadFavs()[slot]; if (f) ctl.teleport(f.x, f.y, f.d || 'Down', f.m); return f; };
  ctl.delFav = slot => { const favs = loadFavs(); delete favs[slot]; saveFavs(favs); };
  ctl.favs = loadFavs;

  ctl.stopAll = stopAll;
  ctl.loops = loops;
  ctl.log = actionLog;
  ctl.lastError = () => actionLog.filter(x => x.result === 'Error').slice(-1)[0];
  window.__gatherCtl = ctl;
  window.ctl = ctl;

  // ==================== 6. Presence watcher ====================
  let lastUsersSnapshot = new Set([...state.users.keys()]);
  const audioBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; g.gain.value = 0.2;
      o.connect(g); g.connect(ctx.destination);
      o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 400);
    } catch {}
  };
  const notifyDesktop = (title, body) => {
    if (Notification.permission === 'granted') new Notification(title, { body, icon: 'https://app.v2.gather.town/favicon.ico' });
    else if (Notification.permission !== 'denied') Notification.requestPermission();
  };
  setInterval(() => {
    const current = new Set([...state.users.keys()]);
    const entered = [...current].filter(id => !lastUsersSnapshot.has(id));
    const left = [...lastUsersSnapshot].filter(id => !current.has(id));
    for (const id of entered) {
      const u = state.users.get(id);
      const name = u?.name || id.slice(0, 8);
      for (const [watched, opts] of watchList) {
        if (name.toLowerCase().includes(watched.toLowerCase())) {
          console.log(`[WATCH] ${name} entrou`);
          if (opts.sound) audioBeep();
          if (opts.desktop) notifyDesktop('Gather: user entrou', `${name} entrou no space`);
        }
      }
    }
    for (const id of left) {
      const u = state.users.get(id) || {};
      const name = u.name || id.slice(0, 8);
      for (const [watched] of watchList) {
        if (name.toLowerCase().includes(watched.toLowerCase())) console.log(`[WATCH] ${name} saiu`);
      }
    }
    lastUsersSnapshot = current;
  }, 3000);

  // ==================== 7. UI ====================
  // css/html imported as text by build
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'gc-root';
  root.innerHTML = templateHtml;
  document.body.appendChild(root);

  const panel = root.querySelector('#gc-panel');
  const fab = root.querySelector('#gc-fab');
  const toast = root.querySelector('#gc-toast');
  const showToast = msg => { toast.textContent = msg; toast.style.display = 'block'; clearTimeout(showToast._t); showToast._t = setTimeout(() => toast.style.display = 'none', 1800); };
  const copyToClipboard = (txt, label='copiado') => {
    navigator.clipboard?.writeText(txt).then(() => showToast(label), () => showToast('falhou copiar'));
  };

  // tabs
  panel.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    panel.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    panel.querySelectorAll('.pane').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    panel.querySelector(`.pane[data-pane="${t.dataset.tab}"]`).classList.add('on');
  });

  // minimize / hide
  const setPillMode = on => {
    panel.classList.toggle('pill', on);
    // ajusta root pra não ocupar tela toda quando pill
    if (on) { root.style.width = 'auto'; root.style.height = 'auto'; root.style.pointerEvents = 'none'; }
    else { root.style.width = ''; root.style.height = ''; root.style.pointerEvents = ''; }
  };
  panel.querySelector('#gc-min').onclick = e => { e.stopPropagation(); setPillMode(true); };
  // click na header enquanto em pill restaura
  panel.querySelector('#gc-hdr').addEventListener('click', e => {
    if (!panel.classList.contains('pill')) return;
    if (e.target.closest('button')) return;
    setPillMode(false);
  });
  panel.querySelector('#gc-hide').onclick = e => { e.stopPropagation(); root.style.display = 'none'; fab.classList.add('on'); };
  fab.onclick = () => { root.style.display = ''; fab.classList.remove('on'); setPillMode(false); };

  // self
  panel.querySelectorAll('[data-m]').forEach(b => b.onclick = () => ctl.move(b.dataset.m));
  panel.querySelectorAll('[data-f]').forEach(b => b.onclick = () => ctl.face(b.dataset.f));
  panel.querySelector('#gc-tp').onclick = () => {
    const x = +panel.querySelector('#gc-tx').value;
    const y = +panel.querySelector('#gc-ty').value;
    if (!state.myPos.mapId) { showToast('mapId desconhecido — ande 1 passo'); }
    ctl.teleport(x, y, state.myPos.direction || 'Down');
    showToast(`tp (${x},${y})`);
  };
  panel.querySelector('#gc-cpid').onclick = () => copyToClipboard(userId, 'userId copiado');
  panel.querySelector('#gc-cppos').onclick = () => {
    const p = state.myPos;
    copyToClipboard(safeStringify({ x: p.x, y: p.y, direction: p.direction, mapId: p.mapId }), 'pos copiada');
  };
  panel.querySelector('#gc-confetti').onclick = () => ctl.confetti();
  panel.querySelector('#gc-shake').onclick = () => ctl.shakeCamera(15, 1500);
  panel.querySelector('#gc-respawn').onclick = () => ctl.respawn();
  let ghostState = false, awayState = false;
  const ghostBtn = panel.querySelector('#gc-ghost');
  const awayBtn = panel.querySelector('#gc-away');
  ghostBtn.onclick = () => { ghostState = !ghostState; ctl.ghost(ghostState); ghostBtn.classList.toggle('active', ghostState); showToast('ghost ' + ghostState); };
  awayBtn.onclick = () => { awayState = !awayState; ctl.setAway(awayState); awayBtn.classList.toggle('active', awayState); showToast('away ' + awayState); };

  const renderFavs = () => {
    const favs = ctl.favs();
    const box = panel.querySelector('#gc-favs');
    box.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
      const f = favs[i];
      const btn = document.createElement('button');
      btn.className = 'tiny' + (f ? ' go' : '');
      btn.textContent = f ? `F${i}:${f.x},${f.y}` : `F${i}`;
      btn.title = f ? `tp (${f.x},${f.y}) | shift+click salva | right-click remove` : 'shift+click salva atual';
      btn.onclick = e => {
        if (e.shiftKey) { ctl.saveFav(i); renderFavs(); showToast('fav ' + i + ' saved'); }
        else if (f) { ctl.tpFav(i); showToast('tp fav ' + i); }
      };
      btn.oncontextmenu = e => { e.preventDefault(); if (f) { ctl.delFav(i); renderFavs(); showToast('fav ' + i + ' removed'); } };
      box.appendChild(btn);
    }
  };
  renderFavs();

  panel.querySelector('#gc-rec-start').onclick = () => { ctl.recordStart(); showToast('rec start'); };
  panel.querySelector('#gc-rec-stop').onclick = () => { const e = ctl.recordStop(); showToast('rec stop ' + e.length); };
  panel.querySelector('#gc-rec-play').onclick = () => ctl.recordReplay();

  // ==================== auto toggles ====================
  const getIntervalMs = () => {
    const v = parseInt(panel.querySelector('#gc-ims').value, 10);
    return Math.max(50, Math.min(5000, isNaN(v) ? 200 : v));
  };
  const startLoopByKey = key => {
    const ms = getIntervalMs();
    switch (key) {
      case 'spin': ctl.spin(ms); break;
      case 'walk': ctl.spinConfetti(ms); break;
      case 'dance': ctl.dance(ms); break;
      case 'rand': ctl.randomWalk(ms); break;
      case 'tp': ctl.tpLoop([[3,3,'Down'],[10,3,'Left'],[10,10,'Up'],[3,10,'Right']], Math.max(400, ms*2)); break;
      case 'conf': ctl.confettiSpam(Math.max(200, ms)); break;
      case 'follow': {
        const id = panel.querySelector('#gc-fid').value.trim();
        if (!id) { showToast('cola userId'); return false; }
        ctl.follow(id);
        break;
      }
      case 'walkto': {
        const tx = +panel.querySelector('#gc-wx').value;
        const ty = +panel.querySelector('#gc-wy').value;
        ctl.walkTo(tx, ty, Math.max(100, ms));
        break;
      }
      default: return false;
    }
    return true;
  };
  const toggleLoopBtn = btn => {
    const key = btn.dataset.loop;
    if (loops[key]) {
      stopLoop(key);
      showToast('stop ' + key);
    } else {
      if (!startLoopByKey(key)) return;
      showToast('start ' + key);
    }
    refreshToggles();
  };
  const refreshToggles = () => {
    panel.querySelectorAll('button.toggle[data-loop]').forEach(b => {
      b.classList.toggle('active', !!loops[b.dataset.loop]);
    });
  };
  panel.querySelectorAll('button.toggle[data-loop]').forEach(b => b.onclick = () => toggleLoopBtn(b));
  panel.querySelector('#gc-stop').onclick = () => { stopAll(); refreshToggles(); showToast('all stopped'); };
  setInterval(refreshToggles, 700);

  // profile
  const emojiQ = ['🎉','🔥','💻','☕','🍕','🚀','😎','🎵','💡','⚡','🌮','🤖','💼','📚','🎮','🧠'];
  const emoBox = panel.querySelector('#gc-emo-quick');
  emojiQ.forEach(e => {
    const b = document.createElement('span');
    b.className = 'pill';
    b.innerHTML = `<span class="label-txt">${e}</span>`;
    b.querySelector('.label-txt').onclick = () => { ctl.setEmojiStatus(e); showToast('emoji ' + e); };
    emoBox.appendChild(b);
  });
  panel.querySelector('#gc-pname-set').onclick = () => { const v = panel.querySelector('#gc-pname').value; if (v) ctl.setName(v); };
  panel.querySelector('#gc-pemo-set').onclick = () => ctl.setEmojiStatus(panel.querySelector('#gc-pemo').value);
  panel.querySelector('#gc-pemo-clear').onclick = () => { ctl.setEmojiStatus(''); showToast('emoji limpo'); };
  panel.querySelector('#gc-ptxt-set').onclick = () => ctl.setTextStatus(panel.querySelector('#gc-ptxt').value);
  panel.querySelector('#gc-ptitle-set').onclick = () => ctl.setTitle(panel.querySelector('#gc-ptitle').value);
  panel.querySelector('#gc-ppron-set').onclick = () => ctl.setPronouns(panel.querySelector('#gc-ppron').value);
  panel.querySelector('#gc-custom-set').onclick = () => {
    const text = panel.querySelector('#gc-custom-text').value;
    const mins = parseInt(panel.querySelector('#gc-custom-mins').value, 10);
    ctl.setCustomStatus({ text, clearMinutes: isNaN(mins) ? 60 : mins });
    showToast('status enviado');
  };
  panel.querySelector('#gc-custom-clearcal').onclick = () => { ctl.clearCalendarInferredStatus(); showToast('calendar status limpo'); };
  panel.querySelector('#gc-avail-set').onclick = () => {
    const availability = panel.querySelector('#gc-avail').value;
    ctl.setMyAvailability(availability);
    showToast('availability ' + availability);
  };
  panel.querySelector('#gc-outfit-save').onclick = () => {
    let outfit;
    try { outfit = JSON.parse(panel.querySelector('#gc-outfit-json').value || '{}'); }
    catch { showToast('outfit JSON inválido'); return; }
    const sent = ctl.saveSpaceOutfit(outfit);
    if (!sent) { showToast('outfit deve ser objeto'); return; }
    showToast('outfit enviado');
  };
  panel.querySelector('#gc-outfit-last').onclick = () => {
    const last = state.actionsSeen.get('saveSpaceOutfit')?.lastArgs?.[2];
    if (!last) { showToast('sem outfit capturado'); return; }
    panel.querySelector('#gc-outfit-json').value = safeStringify(last, null, 2);
    showToast('outfit capturado');
  };
  panel.querySelectorAll('[data-emote]').forEach(b => b.onclick = () => ctl.emote(b.dataset.emote, +(b.dataset.count || 1)));

  // watch
  const renderWatchList = () => {
    const box = panel.querySelector('#gc-watchlist');
    box.innerHTML = '';
    for (const [name, opts] of watchList) {
      const d = document.createElement('div');
      d.className = 'row';
      d.innerHTML = `<span style="flex:1">👁 ${name} ${opts.sound?'🔔':''}${opts.desktop?'💻':''}</span><button class="stop tiny">x</button>`;
      d.querySelector('button').onclick = () => { watchList.delete(name); renderWatchList(); };
      box.appendChild(d);
    }
  };
  panel.querySelector('#gc-wadd').onclick = () => {
    const name = panel.querySelector('#gc-wn').value.trim();
    if (!name) return;
    const sound = panel.querySelector('#gc-wsound').checked;
    const desktop = panel.querySelector('#gc-wdesktop').checked;
    watchList.set(name, { sound, desktop });
    panel.querySelector('#gc-wn').value = '';
    if (desktop && Notification.permission !== 'granted') Notification.requestPermission();
    renderWatchList();
  };

  const renderUserList = () => {
    const box = panel.querySelector('#gc-ul');
    const arr = [...state.users.values()].filter(u => u.name).sort((a,b) => (a.name||'').localeCompare(b.name||''));
    panel.querySelector('#gc-uc').textContent = arr.length;
    box.innerHTML = '';
    for (const u of arr) {
      const row = document.createElement('div');
      row.className = 'u' + (u.id === userId ? ' me' : '');
      const status = [u.away?'💤':'', u.ghost?'👻':'', u.spotlighted?'⭐':'', u.emojiStatus||''].filter(Boolean).join(' ');
      row.innerHTML = `<span class="nm" title="${u.id}">${u.name}${u.id===userId?' (eu)':''} ${status}</span><span class="co">${u.x??'?'},${u.y??'?'}</span>`;
      row.onclick = () => {
        navigator.clipboard?.writeText(u.id);
        panel.querySelector('#gc-fid').value = u.id;
        panel.querySelector('#gc-rawtid').value = u.id;
        showToast('id copiado: ' + u.name);
      };
      box.appendChild(row);
    }
  };
  panel.querySelector('#gc-refresh').onclick = renderUserList;
  renderUserList();
  setInterval(renderUserList, 5000);

  // rooms pane
  const renderRooms = () => {
    const box = panel.querySelector('#gc-rmlist');
    if (!box) return;
    const filter = panel.querySelector('#gc-rmfilter').value.trim().toLowerCase();
    const arr = [...state.mapAreas.values()].filter(a => {
      if (!filter) return true;
      const id = String(a.id||'');
      return (a.name||'').toLowerCase().includes(filter) || id.toLowerCase().includes(filter);
    }).sort((a,b) => String(a.name||a.id||'').localeCompare(String(b.name||b.id||'')));
    panel.querySelector('#gc-rmcount').textContent = state.mapAreas.size;
    box.innerHTML = '';
    for (const a of arr) {
      const row = document.createElement('div');
      row.className = 'u';
      const lk = a.locked ? '🔒' : '🔓';
      const idStr = String(a.id||'');
      const nm = a.name || idStr.slice(0, 8);
      const t = a.areaType || a.type || '';
      row.innerHTML = `<span class="nm" title="${idStr}">${lk} ${nm} <span style="color:#64748b">${t}</span></span><span class="co">${a.mapId?(''+a.mapId).slice(0,6):''}</span>`;
      row.onclick = e => {
        panel.querySelector('#gc-rmid').value = idStr;
        if (e.shiftKey) {
          ctl.teleportToArea(idStr);
          showToast('tp → ' + nm);
        } else {
          ctl.toggleAreaLock(idStr);
          showToast((a.locked?'unlock':'lock') + ' ' + nm);
        }
      };
      row.oncontextmenu = e => { e.preventDefault(); navigator.clipboard?.writeText(idStr); showToast('id copiado'); };
      box.appendChild(row);
    }
  };
  panel.querySelector('#gc-rmfilter').oninput = renderRooms;
  panel.querySelector('#gc-rmlockall').onclick = () => { if (confirm(`lock TODAS as ${state.mapAreas.size} áreas?`)) ctl.lockAll(); };
  panel.querySelector('#gc-rmunlockall').onclick = () => ctl.unlockAll();
  panel.querySelector('#gc-rmdump').onclick = () => {
    const arr = ctl.dumpAreas();
    copyToClipboard(safeStringify(arr, null, 2), `${arr.length} áreas copiadas`);
    console.table(arr);
  };
  const rmId = () => panel.querySelector('#gc-rmid').value.trim();
  panel.querySelector('#gc-rmlock').onclick = () => { const id=rmId(); if (id) ctl.lockArea(id); };
  panel.querySelector('#gc-rmunlock').onclick = () => { const id=rmId(); if (id) ctl.unlockArea(id); };
  panel.querySelector('#gc-rmtoggle').onclick = () => { const id=rmId(); if (id) ctl.toggleAreaLock(id); };
  panel.querySelector('#gc-jmgo').onclick = () => { ctl.joinMeeting(); showToast('joinMeeting enviado'); };
  panel.querySelector('#gc-esgo').onclick = () => {
    const t = panel.querySelector('#gc-esid').value.trim();
    if (!t) return showToast('targetUserId?');
    ctl.enterSpace(t);
  };
  panel.querySelector('#gc-lsugo').onclick = () => {
    const ct = panel.querySelector('#gc-lsut').value.trim() || 'OfficeView';
    ctl.loadSpaceUser(ct);
    showToast('loadSpaceUser → ' + ct);
  };
  panel.querySelector('#gc-gsgo').onclick = () => {
    const s = panel.querySelector('#gc-gsid').value.trim();
    if (!s) return showToast('spaceId?');
    if (confirm('navegar para ' + s + '?')) ctl.gotoSpace(s);
  };
  const renderMaps = () => {
    const box = panel.querySelector('#gc-mplist');
    if (!box) return;
    const arr = [...state.maps.values()].sort((a,b) => String(a.name||a.id||'').localeCompare(String(b.name||b.id||'')));
    panel.querySelector('#gc-mpcount').textContent = state.maps.size;
    box.innerHTML = '';
    const myMap = state.myPos.mapId;
    for (const m of arr) {
      const idStr = String(m.id||'');
      const here = idStr === myMap ? ' 📍' : '';
      const row = document.createElement('div');
      row.className = 'u' + (idStr === myMap ? ' me' : '');
      const dim = m.dimensions ? `${m.dimensions.width||'?'}x${m.dimensions.height||'?'}` : '';
      row.innerHTML = `<span class="nm" title="${idStr}">${m.name||idStr.slice(0,8)}${here}</span><span class="co">${dim}</span>`;
      row.onclick = () => {
        panel.querySelector('#gc-mpid').value = idStr;
        // tenta spawn de map / area do tipo spawn / centro do mapa
        const spawn = m.spawns?.[0] || m.defaultSpawn;
        const spawnArea = [...state.mapAreas.values()].find(a => a.mapId === idStr && /spawn/i.test(a.areaType||a.type||a.name||''));
        let x, y;
        if (spawn?.x != null) { x = spawn.x; y = spawn.y; }
        else if (spawnArea) { x = Math.floor((spawnArea.x||0) + (spawnArea.width||1)/2); y = Math.floor((spawnArea.y||0) + (spawnArea.height||1)/2); }
        else if (m.dimensions) { x = Math.floor((m.dimensions.width||10)/2); y = Math.floor((m.dimensions.height||10)/2); }
        else { x = +panel.querySelector('#gc-mpx').value || 5; y = +panel.querySelector('#gc-mpy').value || 5; }
        console.log(`[tpMap] ${m.name||idStr.slice(0,8)} → (${x},${y})`, { spawn, spawnArea: !!spawnArea, dim: m.dimensions });
        ctl.teleportToMap(idStr, x, y);
        showToast(`tp → ${m.name||idStr.slice(0,8)} (${x},${y})`);
      };
      row.oncontextmenu = e => { e.preventDefault(); navigator.clipboard?.writeText(idStr); showToast('mapId copiado'); };
      box.appendChild(row);
    }
  };
  panel.querySelector('#gc-mpgo').onclick = () => {
    const id = panel.querySelector('#gc-mpid').value.trim();
    if (!id) return showToast('mapId?');
    ctl.teleportToMap(id, +panel.querySelector('#gc-mpx').value || 5, +panel.querySelector('#gc-mpy').value || 5);
  };
  setInterval(renderRooms, 2000);
  setInterval(renderMaps, 2000);
  renderRooms();
  renderMaps();

  // pos display + mapId display
  setInterval(() => {
    const p = panel.querySelector('#gc-pos');
    if (p) p.textContent = state.myPos.x !== null ? `(${state.myPos.x},${state.myPos.y})` : '';
    const m = panel.querySelector('#gc-mymap');
    if (m) m.textContent = state.myPos.mapId || '?';
  }, 500);

  // ==================== inspector ====================
  let inspectorPaused = false;
  let selectedFrame = null;
  const hiddenKey = `gather-ctl-hidden-${spaceId}`;
  const loadHidden = () => { try { return new Set(JSON.parse(localStorage.getItem(hiddenKey) || '[]')); } catch { return new Set(); } };
  const saveHidden = set => localStorage.setItem(hiddenKey, safeStringify([...set]));
  const hiddenTags = loadHidden();
  const frameTag = f => f.obj?.action || f.obj?.type || '?';
  const hideTag = tag => { hiddenTags.add(tag); saveHidden(hiddenTags); renderHiddenChips(); renderFrames(); };
  const unhideTag = tag => { hiddenTags.delete(tag); saveHidden(hiddenTags); renderHiddenChips(); renderFrames(); };
  const renderHiddenChips = () => {
    const box = panel.querySelector('#gc-ihidden');
    const lbl = panel.querySelector('#gc-ihidden-label');
    if (!box) return;
    if (!hiddenTags.size) { box.innerHTML = ''; lbl.style.display = 'none'; return; }
    lbl.style.display = '';
    box.innerHTML = '';
    for (const tag of hiddenTags) {
      const p = document.createElement('span'); p.className = 'pill';
      p.innerHTML = `<span class="label-txt">${tag}</span><span class="cpy" title="mostrar de novo">✕</span>`;
      p.querySelector('.cpy').onclick = () => unhideTag(tag);
      p.querySelector('.label-txt').onclick = () => unhideTag(tag);
      box.appendChild(p);
    }
  };
  renderHiddenChips();
  const renderFrames = () => {
    if (inspectorPaused) return;
    const box = panel.querySelector('#gc-frames');
    if (!box) return;
    const filter = panel.querySelector('#gc-ifilter').value.trim();
    const hideFilter = panel.querySelector('#gc-ihide').value.trim();
    const dir = panel.querySelector('#gc-idir').value;
    let re = null; try { if (filter) re = new RegExp(filter, 'i'); } catch {}
    let hideRe = null; try { if (hideFilter) hideRe = new RegExp(hideFilter, 'i'); } catch {}
    const arr = liveFrames
      .map((f, idx) => ({ f, idx }))
      .slice(-100)
      .reverse()
      .filter(({ f }) => {
      if (dir !== 'all' && f.dir !== dir) return false;
      const tag = frameTag(f);
      if (hiddenTags.has(tag)) return false;
      const full = tag + ' ' + safeStringify(f.obj?.args||'').slice(0,200);
      if (re && !re.test(full)) return false;
      if (hideRe && hideRe.test(full)) return false;
      return true;
    });
    box.innerHTML = arr.map(({ f, idx }) => {
      const ts = new Date(f.t).toTimeString().slice(0,8);
      const tag = frameTag(f);
      const sub = f.obj?.action ? safeStringify(f.obj.args||[]).slice(0,80) : (f.obj?.patches?.length ? `${f.obj.patches.length}p` : '');
      return `<div class="fr ${f.dir}" data-idx="${idx}" data-tag="${tag.replace(/"/g,'&quot;')}"><span class="ts">${ts}</span><span class="badge">${f.dir}</span><span class="tg">${tag} <span style="color:#64748b">${sub}</span></span><span class="ts">${f.len}b</span><span class="cpy hide-btn" title="ocultar tipo/action">🚫</span></div>`;
    }).join('') || '<div style="color:#64748b">sem frames (ou todos filtrados)</div>';
    box.querySelectorAll('.fr').forEach(el => {
      el.onclick = e => {
        if (e.target.classList.contains('hide-btn')) {
          e.stopPropagation();
          hideTag(el.dataset.tag);
          showToast('oculto: ' + el.dataset.tag);
          return;
        }
        const idx = +el.dataset.idx;
        selectedFrame = liveFrames[idx];
        panel.querySelector('#gc-fdetail').textContent = safeStringify(selectedFrame.obj, null, 2).slice(0, 6000);
      };
    });
  };
  setInterval(renderFrames, 500);
  panel.querySelector('#gc-ipause').onclick = e => { inspectorPaused = !inspectorPaused; e.target.textContent = inspectorPaused ? '▶' : '⏸'; };
  panel.querySelector('#gc-iclear').onclick = () => { liveFrames.length = 0; renderFrames(); };
  panel.querySelector('#gc-ihide-clear').onclick = () => { hiddenTags.clear(); saveHidden(hiddenTags); renderHiddenChips(); renderFrames(); showToast('hidden list limpa'); };
  panel.querySelector('#gc-freplay').onclick = () => {
    if (!selectedFrame || selectedFrame.dir !== 'send') return showToast('selecione frame send');
    sendRaw({ ...selectedFrame.obj, txnId: uuid() });
    showToast('replay enviado');
  };
  panel.querySelector('#gc-fcopy').onclick = () => {
    if (!selectedFrame) return showToast('selecione frame');
    copyToClipboard(safeStringify(selectedFrame.obj, null, 2), 'frame copiado');
  };
  panel.querySelector('#gc-fexport').onclick = () => {
    if (!selectedFrame) return;
    const blob = new Blob([safeStringify(selectedFrame.obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `frame-${Date.now()}.json`; a.click();
  };

  // ==================== discover ====================
  const goToDiscWithArgs = (name, lastArgs) => {
    panel.querySelector('#gc-rawname').value = name;
    panel.querySelector('#gc-rawargs').value = safeStringify(lastArgs?.slice(2) || [], null, 2);
    panel.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    panel.querySelectorAll('.pane').forEach(x => x.classList.remove('on'));
    panel.querySelector('.tab[data-tab="disc"]').classList.add('on');
    panel.querySelector('.pane[data-pane="disc"]').classList.add('on');
  };
  const renderDiscover = () => {
    const aBox = panel.querySelector('#gc-actions');
    const mBox = panel.querySelector('#gc-models');
    const tBox = panel.querySelector('#gc-msgtypes');
    if (!aBox) return;
    const actions = [...state.actionsSeen.entries()].sort((a,b) => b[1].count - a[1].count);
    panel.querySelector('#gc-acount').textContent = actions.length;
    aBox.innerHTML = '';
    for (const [name, info] of actions) {
      const p = document.createElement('span'); p.className = 'pill';
      p.innerHTML = `<span class="label-txt">${name}</span><span class="n">${info.count}</span><span class="cpy" title="copiar JSON">📋</span>`;
      p.querySelector('.label-txt').title = 'click: replay last args | shift+click: abre em raw';
      p.querySelector('.label-txt').onclick = e => {
        if (e.shiftKey) { goToDiscWithArgs(name, info.lastArgs); return; }
        if (info.lastArgs) sendRaw({ type: 'Action', action: name, args: info.lastArgs, txnId: uuid() });
        showToast('replay ' + name);
      };
      p.querySelector('.cpy').onclick = () => {
        const json = safeStringify({ type: 'Action', action: name, args: info.lastArgs }, null, 2);
        copyToClipboard(json, 'action JSON copiada');
      };
      aBox.appendChild(p);
    }
    mBox.innerHTML = '';
    for (const [m, c] of [...state.modelsSeen.entries()].sort((a,b) => b[1] - a[1])) {
      const p = document.createElement('span'); p.className = 'pill';
      p.innerHTML = `<span class="label-txt">${m}</span><span class="n">${c}</span>`;
      p.querySelector('.label-txt').onclick = () => copyToClipboard(m, 'model copiado');
      mBox.appendChild(p);
    }
    tBox.innerHTML = '';
    for (const [t, c] of [...state.msgTypes.entries()].sort((a,b) => b[1] - a[1])) {
      const p = document.createElement('span'); p.className = 'pill';
      p.innerHTML = `<span class="label-txt">${t}</span><span class="n">${c}</span>`;
      p.querySelector('.label-txt').onclick = () => copyToClipboard(t, 'type copiado');
      tBox.appendChild(p);
    }
  };
  setInterval(renderDiscover, 2000);
  renderDiscover();

  const buildRawObj = () => {
    const name = panel.querySelector('#gc-rawname').value.trim();
    if (!name) { showToast('action name?'); return null; }
    let args = [];
    try { args = JSON.parse(panel.querySelector('#gc-rawargs').value || '[]'); }
    catch (e) { showToast('args JSON inválido'); return null; }
    const onSelf = panel.querySelector('#gc-rawself').checked;
    const tid = onSelf ? userId : panel.querySelector('#gc-rawtid').value.trim();
    if (!tid) { showToast('userId?'); return null; }
    return { type: 'Action', action: name, args: ['SpaceUser', tid, ...args], txnId: uuid() };
  };
  panel.querySelector('#gc-rawsend').onclick = () => {
    const obj = buildRawObj(); if (!obj) return;
    sendRaw(obj);
    panel.querySelector('#gc-rawres').textContent = 'sent. txnId=' + obj.txnId.slice(0,8) + '...\n' + safeStringify(obj, null, 2);
    setTimeout(() => {
      const r = actionLog.find(l => l.action === obj.action && Math.abs(l.t - Date.now()) < 3000);
      if (r) panel.querySelector('#gc-rawres').textContent = safeStringify(r, null, 2);
    }, 500);
  };
  panel.querySelector('#gc-rawcopy').onclick = () => {
    const obj = buildRawObj(); if (!obj) return;
    copyToClipboard(safeStringify(obj, null, 2), 'JSON copiado');
  };

  // ==================== watchdog / auto-recover ====================
  const redetectUserId = () => {
    // só trust URL — frame-based detect pegava args[1] de actions miradas em OUTROS users
    const fromUrl = new URL(location.href).searchParams.get('userId');
    if (fromUrl && fromUrl !== userId) { userId = fromUrl; ctl.userId = userId; console.log('[GatherCtl] userId atualizado via URL', userId); return true; }
    return false;
  };

  const ensurePanelInDom = () => {
    if (!document.body.contains(root)) {
      try { document.body.appendChild(root); health.panelOk = true; console.log('[GatherCtl] painel re-anexado ao DOM'); }
      catch (e) { health.panelOk = false; }
    }
  };

  const reconnect = () => {
    attachListener();
    redetectUserId();
    ensurePanelInDom();
    health.reconnects++;
    showToast('reconectado (' + health.reconnects + ')');
    console.log('[GatherCtl] reconnect manual');
  };

  panel.querySelector('#gc-recon').onclick = reconnect;

  // health watchdog — 2s
  setInterval(() => {
    const now = Date.now();
    const ws = getLiveGatherWS();
    const dot = panel.querySelector('#gc-dot');
    if (!dot) return;

    if (!ws) {
      health.wsState = 'down';
      dot.className = 'dot err';
      dot.title = 'WS down — auto-reanexando';
      attachListener();
      return;
    }

    const recvAge = now - health.lastRecv;
    if (recvAge > 60000 && state.users.size > 1) {
      health.wsState = 'stale';
      dot.className = 'dot err';
      dot.title = `sem recv há ${Math.round(recvAge/1000)}s`;
    } else if (recvAge > 20000) {
      health.wsState = 'warn';
      dot.className = 'dot warn';
      dot.title = `recv lento ${Math.round(recvAge/1000)}s`;
    } else {
      health.wsState = 'ok';
      dot.className = 'dot ok';
      dot.title = `WS ok | recv ${Math.round(recvAge/1000)}s atrás | reconnects: ${health.reconnects}`;
    }
  }, 2000);

  setInterval(() => {
    attachListener();
    redetectUserId();
    ensurePanelInDom();
  }, 3000);

  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      console.log('[GatherCtl] URL mudou, re-checando userId');
      setTimeout(redetectUserId, 1000);
    }
  }, 1000);

  ctl.healthCheck = () => ({ ...health, ws: !!getLiveGatherWS(), users: state.users.size, frames: liveFrames.length, panel: document.body.contains(root) });
  ctl.reconnect = reconnect;

  console.log('[GatherCtl v4] ready. window.__gatherCtl');

}
