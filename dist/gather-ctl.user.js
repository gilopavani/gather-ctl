// ==UserScript==
// @name         Gather Controller
// @namespace    local.gather.ctl
// @version      4.4.4
// @description  Gather.town WS controller — modular build
// @match        https://app.v2.gather.town/*
// @match        https://gather.town/*
// @run-at       document-start
// @grant        none
// @updateURL    https://github.com/gilopavani/gather-ctl/raw/main/dist/gather-ctl.user.js
// @downloadURL  https://github.com/gilopavani/gather-ctl/raw/main/dist/gather-ctl.user.js
// ==/UserScript==

(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // src/ws-hook.js
  if (!window.__wsHook) {
    let P = function(url, protos) {
      const ws = protos ? new OrigWS(url, protos) : new OrigWS(url);
      const rec = { url: String(url), ws, sent: 0, recv: 0, closed: false };
      hook.sockets.push(rec);
      const idx = hook.sockets.length - 1;
      const push = (dir, data) => {
        if (hook.frames.length >= hook.maxFrames) hook.frames.shift();
        const m = { dir, t: Date.now(), socketIdx: idx };
        if (data instanceof ArrayBuffer) {
          m.type = "binary";
          m.len = data.byteLength;
          m.hex = hexify(data);
        } else if (data && data.byteLength !== void 0) {
          m.type = "binary";
          m.len = data.byteLength;
          m.hex = hexify(data.buffer || data);
        } else if (typeof data === "string") {
          m.type = "text";
          m.len = data.length;
          m.text = data.slice(0, 4e3);
        } else if (data instanceof Blob) {
          m.type = "blob";
          m.len = data.size;
          data.arrayBuffer().then((ab) => m.hex = hexify(ab));
        }
        hook.frames.push(m);
      };
      const os = ws.send.bind(ws);
      ws.send = function(d) {
        rec.sent++;
        push("send", d);
        return os(d);
      };
      ws.addEventListener("message", (e) => {
        rec.recv++;
        push("recv", e.data);
      });
      ws.addEventListener("close", (e) => {
        rec.closed = true;
        rec.closeCode = e.code;
      });
      return ws;
    };
    const OrigWS = window.WebSocket;
    const hook = { sockets: [], frames: [], maxFrames: 5e3 };
    const hexify = (ab) => {
      const b = new Uint8Array(ab);
      let s = "";
      for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
      return s;
    };
    P.prototype = OrigWS.prototype;
    for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) P[k] = OrigWS[k];
    window.WebSocket = P;
    window.__wsHook = hook;
    window.__findGather = () => hook.sockets.findIndex((s) => s.url.includes("gather-game-v2"));
  }

  // src/util.js
  var uuid = () => crypto.randomUUID();
  var bigintReplacer = (_k, v) => {
    if (typeof v === "bigint") return v.toString() + "n";
    if (v instanceof Map) return Object.fromEntries(v);
    if (v instanceof Set) return [...v];
    return v;
  };
  var safeStringify = (obj, indent) => {
    try {
      return JSON.stringify(obj, bigintReplacer, indent);
    } catch (e) {
      return `[serialize error: ${e.message}]`;
    }
  };
  var h2b = (h) => {
    const b = new Uint8Array(h.length / 2);
    for (let i = 0; i < b.length; i++) b[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return b;
  };
  var extToStr = (v) => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (v.__ext !== void 0 && Array.isArray(v.bytes)) {
      if (v.bytes.length === 0) return "";
      const h = v.bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
      if (v.bytes.length === 16) {
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
      }
      return h;
    }
    return String(v);
  };

  // src/styles.css
  var styles_default = `#gc-root{position:fixed;top:0;right:0;height:100vh;width:340px;z-index:99999;font:11px/1.4 ui-monospace,Menlo,monospace;color:#e8eef7;pointer-events:none;transition:width .2s,height .2s}
#gc-root *{box-sizing:border-box}
#gc-panel{pointer-events:auto;height:100%;display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.92));backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);border-left:1px solid rgba(148,163,184,.18);box-shadow:-12px 0 40px rgba(0,0,0,.5);transition:all .22s ease}
/* PILL MODE \u2014 painel minimizado no topo direito */
#gc-panel.pill{position:fixed;top:12px;right:12px;height:auto;width:auto;max-width:240px;border-radius:22px;border:1px solid rgba(74,222,128,.35);box-shadow:0 8px 30px rgba(0,0,0,.5)}
#gc-panel.pill .main,#gc-panel.pill .toast{display:none}
#gc-panel.pill .hdr{border-bottom:none;padding:8px 14px;cursor:pointer;gap:8px}
#gc-panel.pill .hdr:hover{background:rgba(74,222,128,.08)}
#gc-panel.pill .hdr .ctrl button[data-act="min"]{display:none}
#gc-panel.pill .hdr .title::after{content:' \u2922';opacity:.55;margin-left:4px}
#gc-panel .hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(148,163,184,.14);cursor:default}
#gc-panel .hdr .title{font-size:12px;font-weight:600;color:#a7f3d0;letter-spacing:.5px}
#gc-panel .hdr .dot{display:inline-block;width:8px;height:8px;border-radius:4px;margin-right:6px;background:#64748b;box-shadow:0 0 0 0 transparent;transition:all .3s;vertical-align:middle}
#gc-panel .hdr .dot.ok{background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.6)}
#gc-panel .hdr .dot.warn{background:#f59e0b;box-shadow:0 0 8px rgba(245,158,11,.6)}
#gc-panel .hdr .dot.err{background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,.6);animation:gcpulse 1s infinite}
@keyframes gcpulse{0%,100%{opacity:1}50%{opacity:.4}}
#gc-panel .hdr .pos{font-size:10px;color:#64748b;margin-left:6px}
#gc-panel .hdr .ctrl{display:flex;gap:4px}
#gc-panel .hdr .ctrl button{background:transparent;border:1px solid rgba(148,163,184,.2);color:#cbd5e1;width:24px;height:22px;border-radius:5px;cursor:pointer;font-size:11px;line-height:1}
#gc-panel .hdr .ctrl button:hover{background:rgba(148,163,184,.12);color:#fff}
#gc-panel .main{flex:1;display:flex;min-height:0;overflow:hidden}
#gc-panel .tabs{display:flex;flex-direction:column;width:46px;border-right:1px solid rgba(148,163,184,.12);padding:6px 4px;gap:2px;background:rgba(2,6,23,.4)}
#gc-panel .tab{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 2px;border-radius:6px;cursor:pointer;color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:.5px;border:1px solid transparent;transition:all .15s}
#gc-panel .tab .ico{font-size:14px;line-height:1}
#gc-panel .tab:hover{color:#cbd5e1;background:rgba(148,163,184,.07)}
#gc-panel .tab.on{color:#4ade80;background:rgba(74,222,128,.1);border-color:rgba(74,222,128,.3)}
#gc-panel .body{flex:1;overflow-y:auto;padding:10px 12px;scrollbar-width:thin;scrollbar-color:rgba(148,163,184,.3) transparent}
#gc-panel .body::-webkit-scrollbar{width:6px}
#gc-panel .body::-webkit-scrollbar-thumb{background:rgba(148,163,184,.3);border-radius:3px}
#gc-panel .pane{display:none}
#gc-panel .pane.on{display:block;animation:gcfade .15s ease}
@keyframes gcfade{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
#gc-panel button{background:rgba(30,41,59,.6);color:#e2e8f0;border:1px solid rgba(148,163,184,.18);padding:5px 9px;cursor:pointer;border-radius:5px;font:11px ui-monospace,monospace;transition:all .12s}
#gc-panel button:hover{background:rgba(51,65,85,.8);border-color:rgba(148,163,184,.4)}
#gc-panel button:active{transform:translateY(1px)}
#gc-panel button.go{background:linear-gradient(180deg,rgba(16,185,129,.25),rgba(6,95,70,.25));border-color:rgba(16,185,129,.5);color:#a7f3d0}
#gc-panel button.go:hover{background:linear-gradient(180deg,rgba(16,185,129,.4),rgba(6,95,70,.4))}
#gc-panel button.stop{background:linear-gradient(180deg,rgba(239,68,68,.2),rgba(127,29,29,.2));border-color:rgba(239,68,68,.5);color:#fecaca}
#gc-panel button.stop:hover{background:linear-gradient(180deg,rgba(239,68,68,.35),rgba(127,29,29,.35))}
#gc-panel button.adm{background:linear-gradient(180deg,rgba(245,158,11,.18),rgba(120,53,15,.18));border-color:rgba(245,158,11,.45);color:#fde68a}
#gc-panel button.adm:hover{background:linear-gradient(180deg,rgba(245,158,11,.3),rgba(120,53,15,.3))}
#gc-panel button.tiny{padding:3px 6px;font-size:10px}
/* TOGGLE BUTTON \u2014 mostra estado ativo */
#gc-panel button.toggle{position:relative;display:flex;align-items:center;justify-content:center;gap:6px}
#gc-panel button.toggle.active{background:linear-gradient(180deg,rgba(34,197,94,.4),rgba(21,128,61,.4));border-color:rgba(74,222,128,.8);color:#fff;box-shadow:0 0 8px rgba(34,197,94,.35)}
#gc-panel button.toggle.active::before{content:'\u25CF';color:#4ade80;animation:gcpulse 1.2s infinite;margin-right:2px}
#gc-panel input,#gc-panel select,#gc-panel textarea{background:rgba(2,6,23,.6);color:#e2e8f0;border:1px solid rgba(148,163,184,.2);padding:4px 7px;border-radius:5px;font:11px ui-monospace,monospace;width:60px;outline:none}
#gc-panel input:focus,#gc-panel textarea:focus{border-color:rgba(74,222,128,.5)}
#gc-panel input.wide{width:100%}
#gc-panel input.med{width:120px}
#gc-panel textarea{width:100%;resize:vertical;min-height:40px;font-size:10px}
#gc-panel .row{display:flex;gap:4px;align-items:center;margin:3px 0;flex-wrap:wrap}
#gc-panel .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
#gc-panel .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px}
#gc-panel .grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px}
#gc-panel .sep{height:1px;background:rgba(148,163,184,.15);margin:8px 0}
#gc-panel .label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.7px;margin:8px 0 3px;font-weight:600}
#gc-panel .label:first-child{margin-top:2px}
#gc-panel .userlist,#gc-panel .frames,#gc-panel .actionlog,#gc-panel .chatbox{max-height:220px;overflow-y:auto;font-size:10px;background:rgba(2,6,23,.6);padding:6px;border-radius:5px;border:1px solid rgba(148,163,184,.12)}
#gc-panel .userlist .u{display:flex;justify-content:space-between;padding:3px 4px;cursor:pointer;border-radius:3px;gap:6px}
#gc-panel .userlist .u:hover{background:rgba(148,163,184,.1)}
#gc-panel .userlist .u.me{color:#4ade80}
#gc-panel .userlist .u .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#gc-panel .userlist .u .co{color:#64748b;font-size:9px}
#gc-panel .frames .fr{padding:2px 4px;border-bottom:1px solid rgba(148,163,184,.06);cursor:pointer;display:flex;gap:6px;font-size:10px}
#gc-panel .frames .fr:hover{background:rgba(148,163,184,.08)}
#gc-panel .frames .fr.send{color:#fbbf24}
#gc-panel .frames .fr.recv{color:#60a5fa}
#gc-panel .frames .fr .ts{color:#475569;font-size:9px}
#gc-panel .frames .fr .tg{color:#cbd5e1;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#gc-panel .frames .fr .hide-btn{opacity:.4;padding:0 4px;border-radius:8px;cursor:pointer;font-size:10px}
#gc-panel .frames .fr .hide-btn:hover{opacity:1;background:rgba(239,68,68,.25)}
#gc-panel .chatbox .cm{padding:3px 4px;border-bottom:1px solid rgba(148,163,184,.06);font-size:10px;line-height:1.4}
#gc-panel .chatbox .cm.me{color:#a7f3d0}
#gc-panel .chatbox .cm .who{color:#60a5fa;font-weight:600;margin-right:4px}
#gc-panel .chatbox .cm.me .who{color:#4ade80}
#gc-panel .chatbox .cm .ts{color:#475569;font-size:9px;margin-right:4px}
#gc-panel .pillrow{display:flex;flex-wrap:wrap;gap:3px}
#gc-panel .pill{display:inline-flex;align-items:center;gap:4px;padding:3px 4px 3px 7px;font-size:10px;background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.2);border-radius:11px;color:#cbd5e1}
#gc-panel .pill .label-txt{cursor:pointer}
#gc-panel .pill .label-txt:hover{color:#a7f3d0}
#gc-panel .pill:hover{border-color:rgba(74,222,128,.4)}
#gc-panel .pill .n{color:#475569;font-size:9px}
#gc-panel .pill .cpy{cursor:pointer;opacity:.6;padding:1px 4px;border-radius:8px;font-size:10px}
#gc-panel .pill .cpy:hover{opacity:1;background:rgba(74,222,128,.2)}
#gc-panel .badge{display:inline-block;padding:1px 5px;font-size:9px;border-radius:8px;background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.2);color:#94a3b8;margin-right:3px}
#gc-panel .toast{position:absolute;bottom:10px;left:10px;right:10px;background:rgba(15,23,42,.95);border:1px solid rgba(74,222,128,.4);padding:6px 10px;border-radius:5px;font-size:10px;color:#a7f3d0;animation:gcfade .2s;display:none}
#gc-panel .json{font-size:10px;color:#cbd5e1;background:rgba(2,6,23,.7);padding:6px;border-radius:4px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word}
#gc-fab{position:fixed;bottom:20px;right:20px;z-index:99998;width:46px;height:46px;border-radius:23px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;cursor:pointer;font-size:18px;box-shadow:0 6px 24px rgba(16,185,129,.4);display:none}
#gc-fab.on{display:block}
`;

  // src/template.html
  var template_default = `<div id="gc-panel">
  <div class="hdr" id="gc-hdr">
    <div><span id="gc-dot" class="dot" title="health"></span><span class="title">Gather</span><span id="gc-pos" class="pos"></span></div>
    <div class="ctrl">
      <button id="gc-recon" title="reconectar/recarregar listeners">\u21BB</button>
      <button id="gc-min" data-act="min" title="minimizar">\u2014</button>
      <button id="gc-hide" title="esconder">\xD7</button>
    </div>
  </div>
  <div class="main">
    <div class="tabs">
      <div class="tab on" data-tab="self"><div class="ico">\u{1F579}</div><div class="tablabel">self</div></div>
      <div class="tab" data-tab="auto"><div class="ico">\u267B</div><div class="tablabel">auto</div></div>
      <div class="tab" data-tab="prof"><div class="ico">\u{1F464}</div><div class="tablabel">prof</div></div>
      <div class="tab" data-tab="watch"><div class="ico">\u{1F441}</div><div class="tablabel">watch</div></div>
      <div class="tab" data-tab="insp"><div class="ico">\u{1F50D}</div><div class="tablabel">insp</div></div>
      <div class="tab" data-tab="disc"><div class="ico">\u{1F9EA}</div><div class="tablabel">disc</div></div>
      <div class="tab" data-tab="rooms"><div class="ico">\u{1F6AA}</div><div class="tablabel">rooms</div></div>
    </div>
    <div class="body">

      <div class="pane on" data-pane="self">
        <div class="label">meu id / posi\xE7\xE3o</div>
        <div class="row">
          <button id="gc-cpid" class="tiny">\u{1F4CB} meu userId</button>
          <button id="gc-cppos" class="tiny">\u{1F4CB} minha pos</button>
        </div>
        <div class="label">mover</div>
        <div class="grid4"><button data-m="Up">\u2191</button><button data-m="Left">\u2190</button><button data-m="Down">\u2193</button><button data-m="Right">\u2192</button></div>
        <div class="label">virar</div>
        <div class="grid4"><button data-f="Up">\u2191</button><button data-f="Left">\u2190</button><button data-f="Down">\u2193</button><button data-f="Right">\u2192</button></div>
        <div class="label">teleport (usa mapId atual)</div>
        <div class="row">x<input id="gc-tx" value="5">y<input id="gc-ty" value="5"><button id="gc-tp" class="go">go</button></div>
        <div class="row" style="font-size:9px;color:#64748b">mapId: <span id="gc-mymap">?</span></div>
        <div class="label">walk-to (path)</div>
        <div class="row">x<input id="gc-wx" value="5">y<input id="gc-wy" value="5"><button id="gc-walkto" class="go toggle" data-loop="walkto" data-label="walk">walk</button></div>
        <div class="label">favoritas (shift+click salva \xB7 right-click remove)</div>
        <div class="row" id="gc-favs"></div>
        <div class="label">recorder</div>
        <div class="grid3"><button id="gc-rec-start">\u25CF rec</button><button id="gc-rec-stop" class="stop">\u25A0</button><button id="gc-rec-play" class="go">\u25B6</button></div>
        <div class="label">fx</div>
        <div class="grid3"><button id="gc-confetti" class="go">\u{1F389}</button><button id="gc-shake" class="go">\u{1F4F3}</button><button id="gc-respawn" class="stop">\u21BB resp</button></div>
        <div class="label">estado</div>
        <div class="grid"><button id="gc-ghost" class="toggle">\u{1F47B} ghost</button><button id="gc-away" class="toggle">\u{1F4A4} away</button></div>
      </div>

      <div class="pane" data-pane="auto">
        <div class="label">automa\xE7\xF5es (click = liga/desliga)</div>
        <div class="grid">
          <button class="go toggle" data-loop="spin" data-label="spin">spin</button>
          <button class="go toggle" data-loop="walk" data-label="spin + \u{1F389}">spin + \u{1F389}</button>
        </div>
        <div class="grid">
          <button class="go toggle" data-loop="dance" data-label="dance">dance</button>
          <button class="go toggle" data-loop="rand" data-label="random">random</button>
        </div>
        <div class="grid">
          <button class="go toggle" data-loop="tp" data-label="tp loop">tp loop</button>
          <button class="go toggle" data-loop="conf" data-label="\u{1F389} spam">\u{1F389} spam</button>
        </div>
        <div class="label">intervalo (ms)</div>
        <div class="row">
          <input id="gc-ims" class="med" value="200" type="number" min="50" max="5000">
          <span style="font-size:9px;color:#64748b">aplica no pr\xF3ximo start</span>
        </div>
        <div class="label">follow user</div>
        <div class="row"><input id="gc-fid" class="med" placeholder="userId"><button id="gc-follow" class="go toggle" data-loop="follow" data-label="follow">follow</button></div>
        <div class="sep"></div>
        <button id="gc-stop" class="stop" style="width:100%">\u23F9 STOP ALL</button>
        <div style="font-size:9px;color:#64748b;margin-top:6px;line-height:1.5">Nada roda automaticamente. Cada bot\xE3o \xE9 toggle independente \u2014 clica pra ligar, clica de novo pra desligar. Os ativos ficam verdes pulsantes.</div>
      </div>

      <div class="pane" data-pane="prof">
        <div class="label">name</div>
        <div class="row"><input id="gc-pname" class="wide"><button id="gc-pname-set" class="go tiny">set</button></div>
        <div class="label">emoji status</div>
        <div class="pillrow" id="gc-emo-quick"></div>
        <div class="row"><input id="gc-pemo" class="wide" placeholder="\u{1F389}"><button id="gc-pemo-set" class="go tiny">set</button></div>
        <button id="gc-pemo-clear" class="tiny">limpar emoji</button>
        <div class="label">text status</div>
        <div class="row"><input id="gc-ptxt" class="wide" placeholder="hacking"><button id="gc-ptxt-set" class="go tiny">set</button></div>
        <div class="label">custom status real</div>
        <div class="row">
          <input id="gc-custom-text" class="med" placeholder="texto">
          <input id="gc-custom-mins" value="60" type="number" min="1" max="1440" title="minutos">
          <button id="gc-custom-set" class="go tiny">set</button>
        </div>
        <div class="row">
          <select id="gc-avail" style="width:auto">
            <option value="Active">Active</option>
            <option value="Busy">Busy</option>
            <option value="DoNotDisturb">DoNotDisturb</option>
            <option value="Away">Away</option>
          </select>
          <button id="gc-avail-set" class="go tiny">availability</button>
          <button id="gc-custom-clearcal" class="tiny">clear calendar</button>
        </div>
        <div class="label">title / pronouns</div>
        <div class="row"><input id="gc-ptitle" class="med" placeholder="title"><button id="gc-ptitle-set" class="go tiny">set</button></div>
        <div class="row"><input id="gc-ppron" class="med" placeholder="they/them"><button id="gc-ppron-set" class="go tiny">set</button></div>
        <div class="label">outfit (JSON saveSpaceOutfit)</div>
        <textarea id="gc-outfit-json" placeholder='{"skin":"...","hair":"...","top":"..."}'></textarea>
        <div class="grid">
          <button id="gc-outfit-last" class="tiny">usar \xFAltimo capturado</button>
          <button id="gc-outfit-save" class="go tiny">salvar outfit</button>
        </div>
        <div class="label">emote</div>
        <div class="grid4">
          <button data-emote="\u{1F44B}">\u{1F44B}</button><button data-emote="\u2764\uFE0F">\u2764\uFE0F</button>
          <button data-emote="\u2764\uFE0F" data-count="2">\u2764\uFE0F\xD72</button><button data-emote="\u{1F389}">\u{1F389}</button>
          <button data-emote="\u{1F44D}\uFE0F">\u{1F44D}</button><button data-emote="\u{1F923}">\u{1F923}</button>
          <button data-emote="\u{1F44F}">\u{1F44F}</button><button data-emote="\u{1F525}">\u{1F525}</button>
        </div>
      </div>

      <div class="pane" data-pane="watch">
        <div class="label">alertar quando user entrar</div>
        <div class="row"><input id="gc-wn" class="med" placeholder="nome (parcial)"><button id="gc-wadd" class="go tiny">+</button></div>
        <div class="row" style="font-size:10px;color:#94a3b8">
          <label><input type="checkbox" id="gc-wsound" checked style="width:auto"> bip</label>
          <label><input type="checkbox" id="gc-wdesktop" style="width:auto"> notif</label>
        </div>
        <div id="gc-watchlist"></div>
        <div class="sep"></div>
        <div class="label">users (<span id="gc-uc">0</span>)</div>
        <div class="userlist" id="gc-ul"></div>
        <button id="gc-refresh" style="width:100%;margin-top:6px">\u{1F504} refresh</button>
      </div>

      <div class="pane" data-pane="insp">
        <div class="label">live frames</div>
        <div class="row">
          <input id="gc-ifilter" class="med" placeholder="incluir (regex)">
          <select id="gc-idir" style="width:auto"><option value="all">all</option><option value="send">send</option><option value="recv">recv</option></select>
          <button id="gc-ipause" class="tiny">\u23F8</button>
          <button id="gc-iclear" class="stop tiny">clr</button>
        </div>
        <div class="row">
          <input id="gc-ihide" class="med" placeholder="esconder (regex)" title="regex pra EXCLUIR frames (ex: DeltaState|heartbeat)">
          <button id="gc-ihide-clear" class="tiny" title="limpar hidden list">limpar</button>
        </div>
        <div class="label" id="gc-ihidden-label" style="display:none">ocultos (click remove)</div>
        <div class="pillrow" id="gc-ihidden"></div>
        <div id="gc-frames" class="frames"></div>
        <div class="label">detalhe</div>
        <div id="gc-fdetail" class="json">click frame</div>
        <div class="grid3">
          <button id="gc-freplay" class="go tiny">\u21BB replay</button>
          <button id="gc-fcopy" class="tiny">\u{1F4CB} copy</button>
          <button id="gc-fexport" class="tiny">\u2B07 export</button>
        </div>
      </div>

      <div class="pane" data-pane="disc">
        <div class="label">actions vistas (<span id="gc-acount">0</span>) \u2014 click nome = replay \xB7 \u{1F4CB} = copia JSON</div>
        <div class="pillrow" id="gc-actions"></div>
        <div class="label">models vistos</div>
        <div class="pillrow" id="gc-models"></div>
        <div class="label">message types</div>
        <div class="pillrow" id="gc-msgtypes"></div>
        <div class="sep"></div>
        <div class="label">enviar action raw</div>
        <div class="row"><input id="gc-rawname" class="med" placeholder="actionName"></div>
        <textarea id="gc-rawargs" placeholder='args JSON, ex: [{"x":5,"y":5}]'></textarea>
        <div class="row" style="margin-top:4px">
          <label style="font-size:10px"><input type="checkbox" id="gc-rawself" checked style="width:auto"> on me</label>
          <input id="gc-rawtid" class="med" placeholder="ou userId">
          <button id="gc-rawsend" class="adm tiny">\u{1F4E4} send</button>
          <button id="gc-rawcopy" class="tiny">\u{1F4CB}</button>
        </div>
        <div class="label">resultado</div>
        <div id="gc-rawres" class="json">\u2014</div>
      </div>

      <div class="pane" data-pane="rooms">
        <div class="label">salas / map areas (<span id="gc-rmcount">0</span>) \u2014 click seleciona \xB7 dblclick tp</div>
        <div class="row">
          <input id="gc-rmfilter" class="med" placeholder="filtro nome/id">
          <button id="gc-rmlockall" class="adm tiny">\u{1F512} all</button>
          <button id="gc-rmunlockall" class="tiny">\u{1F513} all</button>
          <button id="gc-rmdump" class="tiny">\u{1F4CB} dump</button>
        </div>
        <div id="gc-rmlist" class="userlist"></div>
        <div class="label">sala selecionada (areaId)</div>
        <div class="row">
          <input id="gc-rmid" class="wide" placeholder="MapArea uuid">
        </div>
        <div class="grid4">
          <button id="gc-rmtp" class="go">tp sala</button>
          <button id="gc-rmlock" class="adm">\u{1F512} lock</button>
          <button id="gc-rmunlock" class="go">\u{1F513} unlock</button>
          <button id="gc-rmtoggle">toggle</button>
        </div>
        <div class="sep"></div>
        <div class="label">maps/rooms (<span id="gc-mpcount">0</span>) \u2014 click = tp</div>
        <div id="gc-mplist" class="userlist"></div>
        <div class="label">tp manual (mapId + xy)</div>
        <div class="row">
          <input id="gc-mpid" class="wide" placeholder="mapId">
        </div>
        <div class="row">
          x<input id="gc-mpx" value="5">y<input id="gc-mpy" value="5">
          <button id="gc-mpgo" class="go">tp</button>
        </div>
        <div class="sep"></div>
        <div class="label">join meeting area (server tp)</div>
        <button id="gc-jmgo" class="go" style="width:100%">\u26A1 joinMeeting</button>
        <div class="sep"></div>
        <div class="label">enterSpace (alvo SpaceUser)</div>
        <div class="row">
          <input id="gc-esid" class="wide" placeholder="targetUserId">
          <button id="gc-esgo" class="go tiny">go</button>
        </div>
        <div class="label">loadSpaceUser</div>
        <div class="row">
          <input id="gc-lsut" class="med" value="OfficeView" placeholder="connectionTarget">
          <button id="gc-lsugo" class="go tiny">load</button>
        </div>
        <div class="label">ir para outro space (URL)</div>
        <div class="row">
          <input id="gc-gsid" class="wide" placeholder="spaceId (slug ou uuid)">
          <button id="gc-gsgo" class="adm tiny">\u2197 ir</button>
        </div>
      </div>

    </div>
  </div>
  <div class="toast" id="gc-toast"></div>
</div>
<button id="gc-fab" title="abrir Gather Ctl">\u26A1</button>
`;

  // src/boot.js
  async function boot() {
    const hook = window.__wsHook;
    if (!hook) {
      console.warn("[GatherCtl] sem hook WebSocket");
      return;
    }
    if (!window.msgpackr) {
      window.msgpackr = await import("https://esm.sh/msgpackr@1.11.2");
      for (let t = 0; t < 128; t++) {
        try {
          window.msgpackr.addExtension({ type: t, unpack: (b) => ({ __ext: t, bytes: [...b] }) });
        } catch {
        }
      }
    }
    const gIdx = window.__findGather();
    if (gIdx < 0 || !hook.sockets[gIdx]?.ws || hook.sockets[gIdx].ws.readyState !== 1) {
      return setTimeout(boot, 500);
    }
    const sock = hook.sockets[gIdx];
    const packr = new window.msgpackr.Packr({ useRecords: false });
    const unpackr = new window.msgpackr.Unpackr({ useRecords: false, mapsAsObjects: true });
    let userId = new URL(location.href).searchParams.get("userId");
    if (!userId) {
      for (const f of hook.frames) {
        if (f.dir !== "send" || !f.hex) continue;
        try {
          const o = unpackr.unpack(h2b(f.hex).slice(0, f.len));
          if (o?.type === "Action" && o?.args?.[0] === "SpaceUser" && typeof o.args[1] === "string") {
            userId = o.args[1];
            break;
          }
        } catch {
        }
      }
    }
    if (!userId) return setTimeout(boot, 500);
    const spaceId = sock.url.match(/spaceId=([^&]+)/)?.[1];
    const getLiveGatherWS = () => {
      const candidates = hook.sockets.filter((s) => s.url.includes("gather-game-v2") && s.ws?.readyState === 1);
      return candidates[candidates.length - 1]?.ws;
    };
    const sendRaw = (obj) => {
      const ws = getLiveGatherWS();
      if (!ws) {
        console.warn("[GatherCtl] sem WS ativo");
        health.wsState = "down";
        return obj;
      }
      if (obj.txnId && obj.type === "Action") {
        pendingTxns.set(obj.txnId, { action: obj.action, target: obj.args?.[0], t: Date.now() });
      }
      try {
        ws.send(packr.pack(obj));
        health.lastSend = Date.now();
      } catch (e) {
        console.warn("[GatherCtl] send falhou", e);
        health.wsState = "error";
      }
      return obj;
    };
    const act = (name, tail = []) => sendRaw({ type: "Action", action: name, args: ["SpaceUser", userId, ...tail], txnId: uuid() });
    const actOn = (tid, name, tail = []) => sendRaw({ type: "Action", action: name, args: ["SpaceUser", tid, ...tail], txnId: uuid() });
    const confettiTargetUserId = "0c637348-7baa-45dc-9157-c7f21487339b";
    const normalizeOutfit = (raw) => {
      const outfit = raw?.type === "Action" && raw?.action === "saveSpaceOutfit" ? raw.args?.[2] : Array.isArray(raw) ? raw[2] : raw;
      if (!outfit || typeof outfit !== "object" || Array.isArray(outfit)) return null;
      return Object.fromEntries(Object.entries(outfit).filter(([, v]) => {
        return !(v && typeof v === "object" && v.__ext === 4 && Array.isArray(v.bytes) && v.bytes.length === 0);
      }));
    };
    const state = {
      users: /* @__PURE__ */ new Map(),
      objects: /* @__PURE__ */ new Map(),
      maps: /* @__PURE__ */ new Map(),
      myPos: { x: null, y: null, direction: "Down", mapId: null },
      chatMessages: [],
      lastUpdate: 0,
      actionsSeen: /* @__PURE__ */ new Map(),
      modelsSeen: /* @__PURE__ */ new Map(),
      msgTypes: /* @__PURE__ */ new Map(),
      mapAreas: /* @__PURE__ */ new Map()
    };
    const watchList = /* @__PURE__ */ new Map();
    const actionLog = [];
    const chatLog = [];
    const pendingTxns = /* @__PURE__ */ new Map();
    const health = { lastRecv: 0, lastSend: 0, lastAck: 0, wsState: "init", userIdValid: true, reconnects: 0, panelOk: true };
    const pushChat = (entry) => {
      chatLog.push({ t: Date.now(), ...entry });
      if (chatLog.length > 300) chatLog.shift();
    };
    const ingestFrame = (o, dir = "recv") => {
      if (!o) return;
      if (o.type) {
        state.msgTypes.set(o.type, (state.msgTypes.get(o.type) || 0) + 1);
      }
      if (dir === "send" && o.type === "Action" && o.action) {
        const cur = state.actionsSeen.get(o.action) || { count: 0, lastArgs: null, t: 0 };
        cur.count++;
        cur.lastArgs = o.args;
        cur.t = Date.now();
        state.actionsSeen.set(o.action, cur);
        if (o.action === "chat" && o.args?.[2]) {
          const msg = o.args[2];
          pushChat({ fromMe: true, from: userId, text: msg.contents, recipient: msg.chatRecipient });
        }
      }
      if (dir === "recv") health.lastRecv = Date.now();
      if (Array.isArray(o?.actionReturns)) {
        health.lastAck = Date.now();
        for (const ar of o.actionReturns) {
          const pending = pendingTxns.get(ar.txnId);
          actionLog.push({
            t: Date.now(),
            action: pending?.action || "?",
            target: pending?.target || "?",
            result: ar.result?.type,
            error: ar.result?.error?.slice(0, 250)
          });
          if (actionLog.length > 100) actionLog.shift();
          pendingTxns.delete(ar.txnId);
        }
      }
      if (o.type !== "DeltaState" && o.type !== "FullStateChunk") return;
      const patches = o.patches || o.fullStatePatches || [];
      for (const p of patches) {
        if (p?.model) state.modelsSeen.set(p.model, (state.modelsSeen.get(p.model) || 0) + 1);
        if (p?.model && /chat/i.test(p.model) && p.data && typeof p.data === "object") {
          if (p.data.contents || p.data.text || p.data.message) {
            pushChat({
              fromMe: false,
              from: p.data.senderId || p.data.userId || p.data.from || "?",
              text: p.data.contents || p.data.text || p.data.message,
              recipient: p.data.recipient || p.data.chatRecipient,
              model: p.model
            });
          }
        }
        if (p?.model === "Map") {
          const id = extToStr(p.id || p.data?.id);
          if (id) {
            const rec = state.maps.get(id) || { id };
            if (p.data && typeof p.data === "object") {
              for (const k of ["name", "dimensions", "backgroundImagePath", "spawns"]) {
                if (p.data[k] !== void 0) rec[k] = p.data[k];
              }
            }
            if (p.op === "replace" && p.path === "/name") rec.name = p.value;
            if (p.op === "remove" && p.path === "") state.maps.delete(id);
            else state.maps.set(id, rec);
          }
        }
        if (p?.model === "MapArea") {
          const id = extToStr(p.id || p.data?.id);
          if (id) {
            const rec = state.mapAreas.get(id) || { id };
            if (p.data && typeof p.data === "object") {
              Object.assign(rec, p.data);
              rec.id = id;
            }
            if (p.op === "replace" && p.path) {
              const key = p.path.replace(/^\//, "").split("/")[0];
              if (key) rec[key] = p.value !== void 0 ? p.value : p.data;
            }
            if (p.op === "remove" && p.path === "") {
              state.mapAreas.delete(id);
            } else state.mapAreas.set(id, rec);
          }
        }
        if (p?.model === "SpaceUser") {
          const id = p.id || p.data?.id;
          if (!id) continue;
          const rec = state.users.get(id) || { id };
          if (p.data && typeof p.data === "object") {
            for (const k of ["name", "emojiStatus", "textStatus", "customStatus", "availability", "status", "away", "ghost", "outfitString", "spotlighted"]) {
              if (p.data[k] !== void 0) rec[k] = p.data[k];
            }
            if (p.data.position?.x !== void 0) rec.x = p.data.position.x;
            if (p.data.position?.y !== void 0) rec.y = p.data.position.y;
            if (p.data.position?.direction !== void 0) rec.direction = p.data.position.direction;
            if (p.data.position?.mapId !== void 0) rec.mapId = p.data.position.mapId;
          }
          if (p.op === "replace" && p.path) {
            if (p.path === "/position/x") rec.x = p.value;
            if (p.path === "/position/y") rec.y = p.value;
            if (p.path === "/position/direction") rec.direction = p.value;
            if (p.path === "/position/mapId") rec.mapId = p.value;
            if (p.path === "/name") rec.name = p.value;
            if (p.path === "/emojiStatus") rec.emojiStatus = p.value;
            if (p.path === "/textStatus") rec.textStatus = p.value;
            if (p.path === "/away") rec.away = p.value;
            if (p.path === "/ghost") rec.ghost = p.value;
          }
          if (p.op === "remove" && p.path === "") {
            state.users.delete(id);
            continue;
          }
          state.users.set(id, rec);
          if (id === userId) {
            if (rec.x !== void 0) state.myPos.x = rec.x;
            if (rec.y !== void 0) state.myPos.y = rec.y;
            if (rec.direction !== void 0) state.myPos.direction = rec.direction;
            if (rec.mapId !== void 0) state.myPos.mapId = rec.mapId;
          }
        }
      }
      state.lastUpdate = Date.now();
    };
    for (const f of hook.frames) {
      if (f.socketIdx !== gIdx || !f.hex) continue;
      try {
        ingestFrame(unpackr.unpack(h2b(f.hex).slice(0, f.len)), f.dir);
      } catch {
      }
    }
    const attachedWs = /* @__PURE__ */ new WeakSet();
    const liveFrames = [];
    const maxLive = 1e3;
    const pushLive = (dir, obj, raw) => {
      if (liveFrames.length >= maxLive) liveFrames.shift();
      liveFrames.push({ dir, t: Date.now(), obj, len: raw?.byteLength || raw?.length || 0 });
    };
    const attachListener = () => {
      for (const s of hook.sockets) {
        if (!s.url.includes("gather-game-v2")) continue;
        if (attachedWs.has(s.ws)) continue;
        if (s.ws.readyState > 1) continue;
        attachedWs.add(s.ws);
        s.ws.addEventListener("message", (e) => {
          if (!(e.data instanceof ArrayBuffer) && !(e.data instanceof Blob)) return;
          const consume = (ab) => {
            try {
              const o = unpackr.unpack(new Uint8Array(ab));
              ingestFrame(o, "recv");
              pushLive("recv", o, ab);
            } catch {
            }
          };
          if (e.data instanceof ArrayBuffer) consume(e.data);
          else e.data.arrayBuffer().then(consume);
        });
        const origSend = s.ws.send.bind(s.ws);
        s.ws.send = function(d) {
          if (d instanceof Uint8Array || d instanceof ArrayBuffer) {
            try {
              const ab = d instanceof Uint8Array ? d : new Uint8Array(d);
              const o = unpackr.unpack(ab);
              ingestFrame(o, "send");
              pushLive("send", o, ab);
            } catch {
            }
          }
          return origSend(d);
        };
      }
    };
    attachListener();
    setInterval(attachListener, 1e3);
    const ctl = {
      userId,
      spaceId,
      socket: sock,
      state,
      watchList,
      liveFrames,
      chatLog,
      // movement — teleport SEMPRE inclui mapId atual (fix)
      move: (dir) => act("move", [{ direction: dir }]),
      face: (dir) => act("faceDirection", [dir]),
      teleport: (x, y, d = "Down", mapId) => {
        const mid = mapId || state.myPos.mapId;
        const payload = { x, y, direction: d };
        if (mid) payload.mapId = mid;
        return act("teleport", [payload]);
      },
      respawn: () => act("respawn", [{}]),
      ghost: (on = true) => act("ghost", [{ ghost: on }]),
      setAway: (away = true) => act("setAway", [{ away }]),
      // profile
      setName: (name) => act("setName", [name]),
      setEmojiStatus: (emoji) => act("setEmojiStatus", [emoji]),
      setTextStatus: (txt) => act("setTextStatus", [txt]),
      setPronouns: (p) => act("setPronouns", [p]),
      setTitle: (t) => act("setTitle", [t]),
      setDescription: (d) => act("setDescription", [d]),
      saveSpaceOutfit: (outfit) => {
        const normalized = normalizeOutfit(outfit);
        if (!normalized) return null;
        return act("saveSpaceOutfit", [normalized]);
      },
      setOutfit: (outfit) => ctl.saveSpaceOutfit(outfit),
      setCustomStatus: ({ text = "", clearMinutes = 60 } = {}) => {
        const payload = {
          text,
          clearCondition: {
            type: "DateTime",
            clearAt: new Date(Date.now() + Math.max(1, clearMinutes) * 6e4).toISOString()
          }
        };
        return act("setCustomStatus", [payload]);
      },
      clearCalendarInferredStatus: () => act("clearCalendarInferredStatus"),
      setMyAvailability: (availability = "Active") => act("setAvailability", [{ availability, debugSource: "GatherCtl.profile" }]),
      // fx / social
      emote: (emote, count = 1) => act("broadcastEmote", [{ emote, count, ambientlyConnectedUserIds: [userId] }]),
      confetti: () => act("shootConfetti", []),
      throwTargetConfetti: () => sendRaw({ type: "Action", action: "throwConfetti", args: ["SpaceUser", confettiTargetUserId] }),
      shakeCamera: (intensity = 10, durationMs = 1e3) => act("fxShakeCamera", [{ mapId: state.myPos.mapId, targetUserId: userId, intensity, durationMs }]),
      wave: (tid) => act("wave", [{ user: tid, isReply: false }]),
      ring: (tid) => act("ring", [{ user: tid }]),
      // chat
      chat: (text, recipient = "global") => sendRaw({
        type: "Action",
        action: "chat",
        args: ["SpaceUser", userId, { chatRecipient: recipient, mapId: state.myPos.mapId, contents: text }],
        txnId: uuid()
      }),
      // others
      teleportUser: (tid, x, y, d = "Down", mapId) => {
        const mid = mapId || state.users.get(tid)?.mapId || state.myPos.mapId;
        const payload = { x, y, direction: d };
        if (mid) payload.mapId = mid;
        return actOn(tid, "teleport", [payload]);
      },
      faceUser: (tid, d) => actOn(tid, "faceDirection", [d]),
      moveUser: (tid, d) => actOn(tid, "move", [{ direction: d }]),
      followUser: (tid) => actOn(tid, "follow", [{}]),
      unfollowUser: (tid) => actOn(tid, "unfollow", [{}]),
      forceMute: (tid, mediaKind = "audio") => actOn(tid, "forceMute", [{ mediaKind }]),
      setAvailability: (tid, availability) => actOn(tid, "setAvailability", [{ availability, debugSource: "GatherCtl.userList" }]),
      spotlightUser: (tid, on = true) => act("setSpotlight", [{ spotlightedUser: tid, isSpotlighted: on }]),
      ghostUser: (tid, on = true) => actOn(tid, "ghost", [{ ghost: on }]),
      blockUser: (tid, on = true) => act("block", [{ blockedUserId: tid, blocked: on }]),
      kickUser: (tid) => act("kick", [{ user: tid }]),
      banUser: (tid) => act("ban", [{ user: tid }]),
      requestMuteUser: (tid, video = false) => act("requestMute", [{ target: tid, video }]),
      // map areas (lock/unlock portas/salas — sem precisar estar dentro)
      lockArea: (areaId) => sendRaw({ type: "Action", action: "lock", args: ["MapArea", areaId], txnId: uuid() }),
      unlockArea: (areaId) => sendRaw({ type: "Action", action: "unlock", args: ["MapArea", areaId], txnId: uuid() }),
      toggleAreaLock: (areaId) => {
        const a = state.mapAreas.get(areaId);
        return a?.locked ? ctl.unlockArea(areaId) : ctl.lockArea(areaId);
      },
      lockAll: () => {
        for (const id of state.mapAreas.keys()) ctl.lockArea(id);
      },
      unlockAll: () => {
        for (const id of state.mapAreas.keys()) ctl.unlockArea(id);
      },
      dumpAreas: () => {
        const fromState = [...state.mapAreas.values()];
        const fromFrames = liveFrames.flatMap((f) => f.obj?.patches || f.obj?.fullStatePatches || []).filter((p) => p?.model === "MapArea").map((p) => ({ id: extToStr(p.id || p.data?.id), name: p.data?.name, locked: p.data?.locked, mapId: p.data?.mapId }));
        const merged = /* @__PURE__ */ new Map();
        for (const a of [...fromState, ...fromFrames]) if (a.id) merged.set(String(a.id), { ...merged.get(String(a.id)) || {}, ...a });
        return [...merged.values()];
      },
      // join meeting area (server teleporta automaticamente)
      joinMeeting: () => act("updateTargetMeetingArea", [{}]),
      joinMeetingAs: (tid) => actOn(tid, "updateTargetMeetingArea", [{}]),
      // teleport entre maps/rooms (mesmo space)
      teleportToMap: (mapId, x = 5, y = 5, d = "Down") => act("teleport", [{ x, y, direction: d, mapId }]),
      teleportToArea: (areaId, strategy = "auto") => {
        const a = state.mapAreas.get(areaId);
        if (!a) {
          console.warn("[tpArea] area n\xE3o encontrada no state:", areaId);
          return;
        }
        console.log("[tpArea] area data:", a);
        const geom = a.boundary || a.bounds || a.region || a.rect || a;
        const x = geom.x ?? geom.left ?? geom.minX;
        const y = geom.y ?? geom.top ?? geom.minY;
        const w = geom.width ?? geom.w ?? (geom.maxX != null && geom.minX != null ? geom.maxX - geom.minX : null);
        const h = geom.height ?? geom.h ?? (geom.maxY != null && geom.minY != null ? geom.maxY - geom.minY : null);
        if (strategy === "meeting" || a.areaType === "meeting" || a.type === "meeting") {
          console.log("[tpArea] tentando updateTargetMeetingArea com areaId");
          return act("updateTargetMeetingArea", [{ areaId, mapAreaId: areaId }]);
        }
        if (x != null && y != null && w != null && h != null) {
          const cx = Math.floor(x + w / 2);
          const cy = Math.floor(y + h / 2);
          const mapId = a.mapId || state.myPos.mapId;
          console.log(`[tpArea] teleport (${cx},${cy}) mapId=${mapId}`);
          return act("teleport", [{ x: cx, y: cy, direction: "Down", mapId }]);
        }
        console.warn("[tpArea] sem geometria, tentando updateTargetMeetingArea fallback");
        return act("updateTargetMeetingArea", [{ areaId, mapAreaId: areaId }]);
      },
      dumpMaps: () => [...state.maps.values()],
      // space hop
      enterSpace: (tid) => actOn(tid, "enterSpace", []),
      loadSpaceUser: (connectionTarget = "OfficeView") => sendRaw({
        type: "Action",
        action: "loadSpaceUser",
        args: ["SpaceUser", null, { connectionTarget }],
        txnId: uuid()
      }),
      gotoSpace: (spaceId2) => {
        location.href = `https://app.gather.town/app/${spaceId2}`;
      },
      // generic + raw
      actModel: (model, id, name, tail = []) => sendRaw({ type: "Action", action: name, args: [model, id, ...tail], txnId: uuid() }),
      tryAction: (n, args) => act(n, args),
      tryActionOn: (tid, n, args) => actOn(tid, n, args),
      raw: sendRaw
    };
    const loops = {};
    const stopLoop = (k) => {
      if (loops[k]) {
        clearInterval(loops[k]);
        delete loops[k];
      }
    };
    const stopAll = () => {
      for (const k of Object.keys(loops)) stopLoop(k);
    };
    const DIRS = ["Up", "Right", "Down", "Left"];
    ctl.spin = (ms = 200) => {
      stopLoop("spin");
      let i = 0;
      loops.spin = setInterval(() => ctl.face(DIRS[i++ % 4]), ms);
    };
    ctl.walkSquare = (ms = 180) => {
      stopLoop("walk");
      let i = 0, steps = 0;
      loops.walk = setInterval(() => {
        ctl.move(DIRS[i]);
        if (++steps >= 5) {
          steps = 0;
          i = (i + 1) % 4;
        }
      }, ms);
    };
    ctl.spinConfetti = (ms = 200) => {
      stopLoop("walk");
      let i = 0;
      loops.walk = setInterval(() => {
        ctl.face(DIRS[i++ % 4]);
        ctl.throwTargetConfetti();
      }, ms);
    };
    ctl.randomWalk = (ms = 300) => {
      stopLoop("rand");
      loops.rand = setInterval(() => ctl.move(DIRS[Math.floor(Math.random() * 4)]), ms);
    };
    ctl.dance = (ms = 150) => {
      stopLoop("dance");
      const moves = ["Up", "Up", "Down", "Down", "Left", "Right", "Left", "Right"];
      let i = 0;
      loops.dance = setInterval(() => {
        const d = moves[i++ % moves.length];
        if (i % 2 === 0) ctl.face(d);
        else ctl.move(d);
      }, ms);
    };
    ctl.tpLoop = (coords, ms = 800) => {
      stopLoop("tp");
      let i = 0;
      loops.tp = setInterval(() => {
        const [x, y, d] = coords[i++ % coords.length];
        ctl.teleport(x, y, d || "Down");
      }, ms);
    };
    ctl.confettiSpam = (ms = 400) => {
      stopLoop("conf");
      loops.conf = setInterval(() => ctl.throwTargetConfetti(), ms);
    };
    ctl.walkTo = (tx, ty, ms = 150) => {
      stopLoop("walkto");
      loops.walkto = setInterval(() => {
        const px = state.myPos.x, py = state.myPos.y;
        if (px === null || py === null) return;
        const dx = tx - px, dy = ty - py;
        if (dx === 0 && dy === 0) {
          stopLoop("walkto");
          console.log("[ctl] chegou em", tx, ty);
          return;
        }
        if (Math.abs(dx) >= Math.abs(dy)) ctl.move(dx > 0 ? "Right" : "Left");
        else ctl.move(dy > 0 ? "Down" : "Up");
      }, ms);
    };
    ctl.follow = (tid, offset = 1, ms = 500) => {
      stopLoop("follow");
      loops.follow = setInterval(() => {
        const u = state.users.get(tid);
        if (!u || u.x === void 0) return;
        ctl.teleport(u.x + offset, u.y, "Left", u.mapId);
      }, ms);
    };
    const recorder = { recording: false, events: [], t0: 0 };
    ctl.recordStart = () => {
      recorder.recording = true;
      recorder.events = [];
      recorder.t0 = Date.now();
      console.log("[rec] start");
    };
    ctl.recordStop = () => {
      recorder.recording = false;
      console.log(`[rec] stop (${recorder.events.length} eventos)`);
      return recorder.events;
    };
    ctl.recordReplay = async () => {
      console.log("[rec] replay", recorder.events.length);
      let last = 0;
      for (const e of recorder.events) {
        await new Promise((r) => setTimeout(r, e.t - last));
        last = e.t;
        if (e.kind === "move") ctl.move(e.dir);
        else if (e.kind === "face") ctl.face(e.dir);
        else if (e.kind === "tp") ctl.teleport(e.x, e.y, e.d, e.m);
      }
      console.log("[rec] replay done");
    };
    const origMove = ctl.move, origFace = ctl.face, origTp = ctl.teleport;
    ctl.move = (dir) => {
      if (recorder.recording) recorder.events.push({ kind: "move", dir, t: Date.now() - recorder.t0 });
      return origMove(dir);
    };
    ctl.face = (dir) => {
      if (recorder.recording) recorder.events.push({ kind: "face", dir, t: Date.now() - recorder.t0 });
      return origFace(dir);
    };
    ctl.teleport = (x, y, d = "Down", m) => {
      if (recorder.recording) recorder.events.push({ kind: "tp", x, y, d, m, t: Date.now() - recorder.t0 });
      return origTp(x, y, d, m);
    };
    const favKey = `gather-ctl-favs-${spaceId}`;
    const loadFavs = () => {
      try {
        return JSON.parse(localStorage.getItem(favKey) || "{}");
      } catch {
        return {};
      }
    };
    const saveFavs = (favs) => localStorage.setItem(favKey, safeStringify(favs));
    ctl.saveFav = (slot) => {
      const favs = loadFavs();
      favs[slot] = { x: state.myPos.x, y: state.myPos.y, d: state.myPos.direction, m: state.myPos.mapId };
      saveFavs(favs);
      return favs[slot];
    };
    ctl.tpFav = (slot) => {
      const f = loadFavs()[slot];
      if (f) ctl.teleport(f.x, f.y, f.d || "Down", f.m);
      return f;
    };
    ctl.delFav = (slot) => {
      const favs = loadFavs();
      delete favs[slot];
      saveFavs(favs);
    };
    ctl.favs = loadFavs;
    ctl.stopAll = stopAll;
    ctl.loops = loops;
    ctl.log = actionLog;
    ctl.lastError = () => actionLog.filter((x) => x.result === "Error").slice(-1)[0];
    window.__gatherCtl = ctl;
    window.ctl = ctl;
    let lastUsersSnapshot = /* @__PURE__ */ new Set([...state.users.keys()]);
    const audioBeep = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.value = 0.2;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        setTimeout(() => {
          o.stop();
          ctx.close();
        }, 400);
      } catch {
      }
    };
    const notifyDesktop = (title, body) => {
      if (Notification.permission === "granted") new Notification(title, { body, icon: "https://app.v2.gather.town/favicon.ico" });
      else if (Notification.permission !== "denied") Notification.requestPermission();
    };
    setInterval(() => {
      const current = /* @__PURE__ */ new Set([...state.users.keys()]);
      const entered = [...current].filter((id) => !lastUsersSnapshot.has(id));
      const left = [...lastUsersSnapshot].filter((id) => !current.has(id));
      for (const id of entered) {
        const u = state.users.get(id);
        const name = u?.name || id.slice(0, 8);
        for (const [watched, opts] of watchList) {
          if (name.toLowerCase().includes(watched.toLowerCase())) {
            console.log(`[WATCH] ${name} entrou`);
            if (opts.sound) audioBeep();
            if (opts.desktop) notifyDesktop("Gather: user entrou", `${name} entrou no space`);
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
    }, 3e3);
    const style = document.createElement("style");
    style.textContent = styles_default;
    document.head.appendChild(style);
    const root = document.createElement("div");
    root.id = "gc-root";
    root.innerHTML = template_default;
    document.body.appendChild(root);
    const panel = root.querySelector("#gc-panel");
    const fab = root.querySelector("#gc-fab");
    const toast = root.querySelector("#gc-toast");
    const showToast = (msg) => {
      toast.textContent = msg;
      toast.style.display = "block";
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => toast.style.display = "none", 1800);
    };
    const copyToClipboard = (txt, label = "copiado") => {
      navigator.clipboard?.writeText(txt).then(() => showToast(label), () => showToast("falhou copiar"));
    };
    panel.querySelectorAll(".tab").forEach((t) => t.onclick = () => {
      panel.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
      panel.querySelectorAll(".pane").forEach((x) => x.classList.remove("on"));
      t.classList.add("on");
      panel.querySelector(`.pane[data-pane="${t.dataset.tab}"]`).classList.add("on");
    });
    const setPillMode = (on) => {
      panel.classList.toggle("pill", on);
      if (on) {
        root.style.width = "auto";
        root.style.height = "auto";
        root.style.pointerEvents = "none";
      } else {
        root.style.width = "";
        root.style.height = "";
        root.style.pointerEvents = "";
      }
    };
    panel.querySelector("#gc-min").onclick = (e) => {
      e.stopPropagation();
      setPillMode(true);
    };
    panel.querySelector("#gc-hdr").addEventListener("click", (e) => {
      if (!panel.classList.contains("pill")) return;
      if (e.target.closest("button")) return;
      setPillMode(false);
    });
    panel.querySelector("#gc-hide").onclick = (e) => {
      e.stopPropagation();
      root.style.display = "none";
      fab.classList.add("on");
    };
    fab.onclick = () => {
      root.style.display = "";
      fab.classList.remove("on");
      setPillMode(false);
    };
    panel.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => ctl.move(b.dataset.m));
    panel.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => ctl.face(b.dataset.f));
    panel.querySelector("#gc-tp").onclick = () => {
      const x = +panel.querySelector("#gc-tx").value;
      const y = +panel.querySelector("#gc-ty").value;
      if (!state.myPos.mapId) {
        showToast("mapId desconhecido \u2014 ande 1 passo");
      }
      ctl.teleport(x, y, state.myPos.direction || "Down");
      showToast(`tp (${x},${y})`);
    };
    panel.querySelector("#gc-cpid").onclick = () => copyToClipboard(userId, "userId copiado");
    panel.querySelector("#gc-cppos").onclick = () => {
      const p = state.myPos;
      copyToClipboard(safeStringify({ x: p.x, y: p.y, direction: p.direction, mapId: p.mapId }), "pos copiada");
    };
    panel.querySelector("#gc-confetti").onclick = () => ctl.confetti();
    panel.querySelector("#gc-shake").onclick = () => ctl.shakeCamera(15, 1500);
    panel.querySelector("#gc-respawn").onclick = () => ctl.respawn();
    let ghostState = false, awayState = false;
    const ghostBtn = panel.querySelector("#gc-ghost");
    const awayBtn = panel.querySelector("#gc-away");
    ghostBtn.onclick = () => {
      ghostState = !ghostState;
      ctl.ghost(ghostState);
      ghostBtn.classList.toggle("active", ghostState);
      showToast("ghost " + ghostState);
    };
    awayBtn.onclick = () => {
      awayState = !awayState;
      ctl.setAway(awayState);
      awayBtn.classList.toggle("active", awayState);
      showToast("away " + awayState);
    };
    const renderFavs = () => {
      const favs = ctl.favs();
      const box = panel.querySelector("#gc-favs");
      box.innerHTML = "";
      for (let i = 1; i <= 9; i++) {
        const f = favs[i];
        const btn = document.createElement("button");
        btn.className = "tiny" + (f ? " go" : "");
        btn.textContent = f ? `F${i}:${f.x},${f.y}` : `F${i}`;
        btn.title = f ? `tp (${f.x},${f.y}) | shift+click salva | right-click remove` : "shift+click salva atual";
        btn.onclick = (e) => {
          if (e.shiftKey) {
            ctl.saveFav(i);
            renderFavs();
            showToast("fav " + i + " saved");
          } else if (f) {
            ctl.tpFav(i);
            showToast("tp fav " + i);
          }
        };
        btn.oncontextmenu = (e) => {
          e.preventDefault();
          if (f) {
            ctl.delFav(i);
            renderFavs();
            showToast("fav " + i + " removed");
          }
        };
        box.appendChild(btn);
      }
    };
    renderFavs();
    panel.querySelector("#gc-rec-start").onclick = () => {
      ctl.recordStart();
      showToast("rec start");
    };
    panel.querySelector("#gc-rec-stop").onclick = () => {
      const e = ctl.recordStop();
      showToast("rec stop " + e.length);
    };
    panel.querySelector("#gc-rec-play").onclick = () => ctl.recordReplay();
    const getIntervalMs = () => {
      const v = parseInt(panel.querySelector("#gc-ims").value, 10);
      return Math.max(50, Math.min(5e3, isNaN(v) ? 200 : v));
    };
    const startLoopByKey = (key) => {
      const ms = getIntervalMs();
      switch (key) {
        case "spin":
          ctl.spin(ms);
          break;
        case "walk":
          ctl.spinConfetti(ms);
          break;
        case "dance":
          ctl.dance(ms);
          break;
        case "rand":
          ctl.randomWalk(ms);
          break;
        case "tp":
          ctl.tpLoop([[3, 3, "Down"], [10, 3, "Left"], [10, 10, "Up"], [3, 10, "Right"]], Math.max(400, ms * 2));
          break;
        case "conf":
          ctl.confettiSpam(Math.max(200, ms));
          break;
        case "follow": {
          const id = panel.querySelector("#gc-fid").value.trim();
          if (!id) {
            showToast("cola userId");
            return false;
          }
          ctl.follow(id);
          break;
        }
        case "walkto": {
          const tx = +panel.querySelector("#gc-wx").value;
          const ty = +panel.querySelector("#gc-wy").value;
          ctl.walkTo(tx, ty, Math.max(100, ms));
          break;
        }
        default:
          return false;
      }
      return true;
    };
    const toggleLoopBtn = (btn) => {
      const key = btn.dataset.loop;
      if (loops[key]) {
        stopLoop(key);
        showToast("stop " + key);
      } else {
        if (!startLoopByKey(key)) return;
        showToast("start " + key);
      }
      refreshToggles();
    };
    const refreshToggles = () => {
      panel.querySelectorAll("button.toggle[data-loop]").forEach((b) => {
        b.classList.toggle("active", !!loops[b.dataset.loop]);
      });
    };
    panel.querySelectorAll("button.toggle[data-loop]").forEach((b) => b.onclick = () => toggleLoopBtn(b));
    panel.querySelector("#gc-stop").onclick = () => {
      stopAll();
      refreshToggles();
      showToast("all stopped");
    };
    setInterval(refreshToggles, 700);
    const emojiQ = ["\u{1F389}", "\u{1F525}", "\u{1F4BB}", "\u2615", "\u{1F355}", "\u{1F680}", "\u{1F60E}", "\u{1F3B5}", "\u{1F4A1}", "\u26A1", "\u{1F32E}", "\u{1F916}", "\u{1F4BC}", "\u{1F4DA}", "\u{1F3AE}", "\u{1F9E0}"];
    const emoBox = panel.querySelector("#gc-emo-quick");
    emojiQ.forEach((e) => {
      const b = document.createElement("span");
      b.className = "pill";
      b.innerHTML = `<span class="label-txt">${e}</span>`;
      b.querySelector(".label-txt").onclick = () => {
        ctl.setEmojiStatus(e);
        showToast("emoji " + e);
      };
      emoBox.appendChild(b);
    });
    panel.querySelector("#gc-pname-set").onclick = () => {
      const v = panel.querySelector("#gc-pname").value;
      if (v) ctl.setName(v);
    };
    panel.querySelector("#gc-pemo-set").onclick = () => ctl.setEmojiStatus(panel.querySelector("#gc-pemo").value);
    panel.querySelector("#gc-pemo-clear").onclick = () => {
      ctl.setEmojiStatus("");
      showToast("emoji limpo");
    };
    panel.querySelector("#gc-ptxt-set").onclick = () => ctl.setTextStatus(panel.querySelector("#gc-ptxt").value);
    panel.querySelector("#gc-ptitle-set").onclick = () => ctl.setTitle(panel.querySelector("#gc-ptitle").value);
    panel.querySelector("#gc-ppron-set").onclick = () => ctl.setPronouns(panel.querySelector("#gc-ppron").value);
    panel.querySelector("#gc-custom-set").onclick = () => {
      const text = panel.querySelector("#gc-custom-text").value;
      const mins = parseInt(panel.querySelector("#gc-custom-mins").value, 10);
      ctl.setCustomStatus({ text, clearMinutes: isNaN(mins) ? 60 : mins });
      showToast("status enviado");
    };
    panel.querySelector("#gc-custom-clearcal").onclick = () => {
      ctl.clearCalendarInferredStatus();
      showToast("calendar status limpo");
    };
    panel.querySelector("#gc-avail-set").onclick = () => {
      const availability = panel.querySelector("#gc-avail").value;
      ctl.setMyAvailability(availability);
      showToast("availability " + availability);
    };
    panel.querySelector("#gc-outfit-save").onclick = () => {
      let outfit;
      try {
        outfit = JSON.parse(panel.querySelector("#gc-outfit-json").value || "{}");
      } catch {
        showToast("outfit JSON inv\xE1lido");
        return;
      }
      const sent = ctl.saveSpaceOutfit(outfit);
      if (!sent) {
        showToast("outfit deve ser objeto");
        return;
      }
      showToast("outfit enviado");
    };
    panel.querySelector("#gc-outfit-last").onclick = () => {
      const last = state.actionsSeen.get("saveSpaceOutfit")?.lastArgs?.[2];
      if (!last) {
        showToast("sem outfit capturado");
        return;
      }
      panel.querySelector("#gc-outfit-json").value = safeStringify(last, null, 2);
      showToast("outfit capturado");
    };
    panel.querySelectorAll("[data-emote]").forEach((b) => b.onclick = () => ctl.emote(b.dataset.emote, +(b.dataset.count || 1)));
    const renderWatchList = () => {
      const box = panel.querySelector("#gc-watchlist");
      box.innerHTML = "";
      for (const [name, opts] of watchList) {
        const d = document.createElement("div");
        d.className = "row";
        d.innerHTML = `<span style="flex:1">\u{1F441} ${name} ${opts.sound ? "\u{1F514}" : ""}${opts.desktop ? "\u{1F4BB}" : ""}</span><button class="stop tiny">x</button>`;
        d.querySelector("button").onclick = () => {
          watchList.delete(name);
          renderWatchList();
        };
        box.appendChild(d);
      }
    };
    panel.querySelector("#gc-wadd").onclick = () => {
      const name = panel.querySelector("#gc-wn").value.trim();
      if (!name) return;
      const sound = panel.querySelector("#gc-wsound").checked;
      const desktop = panel.querySelector("#gc-wdesktop").checked;
      watchList.set(name, { sound, desktop });
      panel.querySelector("#gc-wn").value = "";
      if (desktop && Notification.permission !== "granted") Notification.requestPermission();
      renderWatchList();
    };
    const renderUserList = () => {
      const box = panel.querySelector("#gc-ul");
      const arr = [...state.users.values()].filter((u) => u.name).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      panel.querySelector("#gc-uc").textContent = arr.length;
      box.innerHTML = "";
      for (const u of arr) {
        const row = document.createElement("div");
        row.className = "u" + (u.id === userId ? " me" : "");
        const status = [u.away ? "\u{1F4A4}" : "", u.ghost ? "\u{1F47B}" : "", u.spotlighted ? "\u2B50" : "", u.emojiStatus || ""].filter(Boolean).join(" ");
        row.innerHTML = `<span class="nm" title="${u.id}">${u.name}${u.id === userId ? " (eu)" : ""} ${status}</span><span class="co">${u.x ?? "?"},${u.y ?? "?"}</span>`;
        row.onclick = () => {
          navigator.clipboard?.writeText(u.id);
          panel.querySelector("#gc-fid").value = u.id;
          panel.querySelector("#gc-rawtid").value = u.id;
          showToast("id copiado: " + u.name);
        };
        box.appendChild(row);
      }
    };
    panel.querySelector("#gc-refresh").onclick = renderUserList;
    renderUserList();
    setInterval(renderUserList, 5e3);
    const renderRooms = () => {
      const box = panel.querySelector("#gc-rmlist");
      if (!box) return;
      const filter = panel.querySelector("#gc-rmfilter").value.trim().toLowerCase();
      const arr = [...state.mapAreas.values()].filter((a) => {
        if (!filter) return true;
        const id = String(a.id || "");
        return (a.name || "").toLowerCase().includes(filter) || id.toLowerCase().includes(filter);
      }).sort((a, b) => String(a.name || a.id || "").localeCompare(String(b.name || b.id || "")));
      panel.querySelector("#gc-rmcount").textContent = state.mapAreas.size;
      box.innerHTML = "";
      for (const a of arr) {
        const row = document.createElement("div");
        const lk = a.locked ? "\u{1F512}" : "\u{1F513}";
        const idStr = String(a.id || "");
        const selected = panel.querySelector("#gc-rmid")?.value.trim() === idStr;
        row.className = "u" + (selected ? " me" : "");
        const nm = a.name || idStr.slice(0, 8);
        const t = a.areaType || a.type || "";
        row.innerHTML = `<span class="nm" title="${idStr}">${lk} ${nm} <span style="color:#64748b">${t}</span></span><span class="co">${a.mapId ? ("" + a.mapId).slice(0, 6) : ""}</span>`;
        row.onclick = (e) => {
          panel.querySelector("#gc-rmid").value = idStr;
          if (e.shiftKey) {
            ctl.teleportToArea(idStr);
            showToast("tp \u2192 " + nm);
          } else {
            showToast("sala selecionada: " + nm);
            renderRooms();
          }
        };
        row.ondblclick = () => {
          panel.querySelector("#gc-rmid").value = idStr;
          ctl.teleportToArea(idStr);
          showToast("tp \u2192 " + nm);
        };
        row.oncontextmenu = (e) => {
          e.preventDefault();
          navigator.clipboard?.writeText(idStr);
          showToast("id copiado");
        };
        box.appendChild(row);
      }
    };
    panel.querySelector("#gc-rmfilter").oninput = renderRooms;
    panel.querySelector("#gc-rmlockall").onclick = () => {
      if (confirm(`lock TODAS as ${state.mapAreas.size} \xE1reas?`)) ctl.lockAll();
    };
    panel.querySelector("#gc-rmunlockall").onclick = () => ctl.unlockAll();
    panel.querySelector("#gc-rmdump").onclick = () => {
      const arr = ctl.dumpAreas();
      copyToClipboard(safeStringify(arr, null, 2), `${arr.length} \xE1reas copiadas`);
      console.table(arr);
    };
    const rmId = () => panel.querySelector("#gc-rmid").value.trim();
    panel.querySelector("#gc-rmtp").onclick = () => {
      const id = rmId();
      if (id) ctl.teleportToArea(id);
      else showToast("selecione uma sala");
    };
    panel.querySelector("#gc-rmlock").onclick = () => {
      const id = rmId();
      if (id) ctl.lockArea(id);
    };
    panel.querySelector("#gc-rmunlock").onclick = () => {
      const id = rmId();
      if (id) ctl.unlockArea(id);
    };
    panel.querySelector("#gc-rmtoggle").onclick = () => {
      const id = rmId();
      if (id) ctl.toggleAreaLock(id);
    };
    panel.querySelector("#gc-jmgo").onclick = () => {
      ctl.joinMeeting();
      showToast("joinMeeting enviado");
    };
    panel.querySelector("#gc-esgo").onclick = () => {
      const t = panel.querySelector("#gc-esid").value.trim();
      if (!t) return showToast("targetUserId?");
      ctl.enterSpace(t);
    };
    panel.querySelector("#gc-lsugo").onclick = () => {
      const ct = panel.querySelector("#gc-lsut").value.trim() || "OfficeView";
      ctl.loadSpaceUser(ct);
      showToast("loadSpaceUser \u2192 " + ct);
    };
    panel.querySelector("#gc-gsgo").onclick = () => {
      const s = panel.querySelector("#gc-gsid").value.trim();
      if (!s) return showToast("spaceId?");
      if (confirm("navegar para " + s + "?")) ctl.gotoSpace(s);
    };
    const renderMaps = () => {
      const box = panel.querySelector("#gc-mplist");
      if (!box) return;
      const arr = [...state.maps.values()].sort((a, b) => String(a.name || a.id || "").localeCompare(String(b.name || b.id || "")));
      panel.querySelector("#gc-mpcount").textContent = state.maps.size;
      box.innerHTML = "";
      const myMap = state.myPos.mapId;
      for (const m of arr) {
        const idStr = String(m.id || "");
        const here = idStr === myMap ? " \u{1F4CD}" : "";
        const row = document.createElement("div");
        row.className = "u" + (idStr === myMap ? " me" : "");
        const dim = m.dimensions ? `${m.dimensions.width || "?"}x${m.dimensions.height || "?"}` : "";
        row.innerHTML = `<span class="nm" title="${idStr}">${m.name || idStr.slice(0, 8)}${here}</span><span class="co">${dim}</span>`;
        row.onclick = () => {
          panel.querySelector("#gc-mpid").value = idStr;
          const spawn = m.spawns?.[0] || m.defaultSpawn;
          const spawnArea = [...state.mapAreas.values()].find((a) => a.mapId === idStr && /spawn/i.test(a.areaType || a.type || a.name || ""));
          let x, y;
          if (spawn?.x != null) {
            x = spawn.x;
            y = spawn.y;
          } else if (spawnArea) {
            x = Math.floor((spawnArea.x || 0) + (spawnArea.width || 1) / 2);
            y = Math.floor((spawnArea.y || 0) + (spawnArea.height || 1) / 2);
          } else if (m.dimensions) {
            x = Math.floor((m.dimensions.width || 10) / 2);
            y = Math.floor((m.dimensions.height || 10) / 2);
          } else {
            x = +panel.querySelector("#gc-mpx").value || 5;
            y = +panel.querySelector("#gc-mpy").value || 5;
          }
          console.log(`[tpMap] ${m.name || idStr.slice(0, 8)} \u2192 (${x},${y})`, { spawn, spawnArea: !!spawnArea, dim: m.dimensions });
          ctl.teleportToMap(idStr, x, y);
          showToast(`tp \u2192 ${m.name || idStr.slice(0, 8)} (${x},${y})`);
        };
        row.oncontextmenu = (e) => {
          e.preventDefault();
          navigator.clipboard?.writeText(idStr);
          showToast("mapId copiado");
        };
        box.appendChild(row);
      }
    };
    panel.querySelector("#gc-mpgo").onclick = () => {
      const id = panel.querySelector("#gc-mpid").value.trim();
      if (!id) return showToast("mapId?");
      ctl.teleportToMap(id, +panel.querySelector("#gc-mpx").value || 5, +panel.querySelector("#gc-mpy").value || 5);
    };
    setInterval(renderRooms, 2e3);
    setInterval(renderMaps, 2e3);
    renderRooms();
    renderMaps();
    setInterval(() => {
      const p = panel.querySelector("#gc-pos");
      if (p) p.textContent = state.myPos.x !== null ? `(${state.myPos.x},${state.myPos.y})` : "";
      const m = panel.querySelector("#gc-mymap");
      if (m) m.textContent = state.myPos.mapId || "?";
    }, 500);
    let inspectorPaused = false;
    let selectedFrame = null;
    const hiddenKey = `gather-ctl-hidden-${spaceId}`;
    const loadHidden = () => {
      try {
        return new Set(JSON.parse(localStorage.getItem(hiddenKey) || "[]"));
      } catch {
        return /* @__PURE__ */ new Set();
      }
    };
    const saveHidden = (set) => localStorage.setItem(hiddenKey, safeStringify([...set]));
    const hiddenTags = loadHidden();
    const frameTag = (f) => f.obj?.action || f.obj?.type || "?";
    const hideTag = (tag) => {
      hiddenTags.add(tag);
      saveHidden(hiddenTags);
      renderHiddenChips();
      renderFrames();
    };
    const unhideTag = (tag) => {
      hiddenTags.delete(tag);
      saveHidden(hiddenTags);
      renderHiddenChips();
      renderFrames();
    };
    const renderHiddenChips = () => {
      const box = panel.querySelector("#gc-ihidden");
      const lbl = panel.querySelector("#gc-ihidden-label");
      if (!box) return;
      if (!hiddenTags.size) {
        box.innerHTML = "";
        lbl.style.display = "none";
        return;
      }
      lbl.style.display = "";
      box.innerHTML = "";
      for (const tag of hiddenTags) {
        const p = document.createElement("span");
        p.className = "pill";
        p.innerHTML = `<span class="label-txt">${tag}</span><span class="cpy" title="mostrar de novo">\u2715</span>`;
        p.querySelector(".cpy").onclick = () => unhideTag(tag);
        p.querySelector(".label-txt").onclick = () => unhideTag(tag);
        box.appendChild(p);
      }
    };
    renderHiddenChips();
    const renderFrames = () => {
      if (inspectorPaused) return;
      const box = panel.querySelector("#gc-frames");
      if (!box) return;
      const filter = panel.querySelector("#gc-ifilter").value.trim();
      const hideFilter = panel.querySelector("#gc-ihide").value.trim();
      const dir = panel.querySelector("#gc-idir").value;
      let re = null;
      try {
        if (filter) re = new RegExp(filter, "i");
      } catch {
      }
      let hideRe = null;
      try {
        if (hideFilter) hideRe = new RegExp(hideFilter, "i");
      } catch {
      }
      const arr = liveFrames.map((f, idx) => ({ f, idx })).slice(-100).reverse().filter(({ f }) => {
        if (dir !== "all" && f.dir !== dir) return false;
        const tag = frameTag(f);
        if (hiddenTags.has(tag)) return false;
        const full = tag + " " + safeStringify(f.obj?.args || "").slice(0, 200);
        if (re && !re.test(full)) return false;
        if (hideRe && hideRe.test(full)) return false;
        return true;
      });
      box.innerHTML = arr.map(({ f, idx }) => {
        const ts = new Date(f.t).toTimeString().slice(0, 8);
        const tag = frameTag(f);
        const sub = f.obj?.action ? safeStringify(f.obj.args || []).slice(0, 80) : f.obj?.patches?.length ? `${f.obj.patches.length}p` : "";
        return `<div class="fr ${f.dir}" data-idx="${idx}" data-tag="${tag.replace(/"/g, "&quot;")}"><span class="ts">${ts}</span><span class="badge">${f.dir}</span><span class="tg">${tag} <span style="color:#64748b">${sub}</span></span><span class="ts">${f.len}b</span><span class="cpy hide-btn" title="ocultar tipo/action">\u{1F6AB}</span></div>`;
      }).join("") || '<div style="color:#64748b">sem frames (ou todos filtrados)</div>';
      box.querySelectorAll(".fr").forEach((el) => {
        el.onclick = (e) => {
          if (e.target.classList.contains("hide-btn")) {
            e.stopPropagation();
            hideTag(el.dataset.tag);
            showToast("oculto: " + el.dataset.tag);
            return;
          }
          const idx = +el.dataset.idx;
          selectedFrame = liveFrames[idx];
          panel.querySelector("#gc-fdetail").textContent = safeStringify(selectedFrame.obj, null, 2).slice(0, 6e3);
        };
      });
    };
    setInterval(renderFrames, 500);
    panel.querySelector("#gc-ipause").onclick = (e) => {
      inspectorPaused = !inspectorPaused;
      e.target.textContent = inspectorPaused ? "\u25B6" : "\u23F8";
    };
    panel.querySelector("#gc-iclear").onclick = () => {
      liveFrames.length = 0;
      renderFrames();
    };
    panel.querySelector("#gc-ihide-clear").onclick = () => {
      hiddenTags.clear();
      saveHidden(hiddenTags);
      renderHiddenChips();
      renderFrames();
      showToast("hidden list limpa");
    };
    panel.querySelector("#gc-freplay").onclick = () => {
      if (!selectedFrame || selectedFrame.dir !== "send") return showToast("selecione frame send");
      sendRaw({ ...selectedFrame.obj, txnId: uuid() });
      showToast("replay enviado");
    };
    panel.querySelector("#gc-fcopy").onclick = () => {
      if (!selectedFrame) return showToast("selecione frame");
      copyToClipboard(safeStringify(selectedFrame.obj, null, 2), "frame copiado");
    };
    panel.querySelector("#gc-fexport").onclick = () => {
      if (!selectedFrame) return;
      const blob = new Blob([safeStringify(selectedFrame.obj, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `frame-${Date.now()}.json`;
      a.click();
    };
    const goToDiscWithArgs = (name, lastArgs) => {
      panel.querySelector("#gc-rawname").value = name;
      panel.querySelector("#gc-rawargs").value = safeStringify(lastArgs?.slice(2) || [], null, 2);
      panel.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
      panel.querySelectorAll(".pane").forEach((x) => x.classList.remove("on"));
      panel.querySelector('.tab[data-tab="disc"]').classList.add("on");
      panel.querySelector('.pane[data-pane="disc"]').classList.add("on");
    };
    const renderDiscover = () => {
      const aBox = panel.querySelector("#gc-actions");
      const mBox = panel.querySelector("#gc-models");
      const tBox = panel.querySelector("#gc-msgtypes");
      if (!aBox) return;
      const actions = [...state.actionsSeen.entries()].sort((a, b) => b[1].count - a[1].count);
      panel.querySelector("#gc-acount").textContent = actions.length;
      aBox.innerHTML = "";
      for (const [name, info] of actions) {
        const p = document.createElement("span");
        p.className = "pill";
        p.innerHTML = `<span class="label-txt">${name}</span><span class="n">${info.count}</span><span class="cpy" title="copiar JSON">\u{1F4CB}</span>`;
        p.querySelector(".label-txt").title = "click: replay last args | shift+click: abre em raw";
        p.querySelector(".label-txt").onclick = (e) => {
          if (e.shiftKey) {
            goToDiscWithArgs(name, info.lastArgs);
            return;
          }
          if (info.lastArgs) sendRaw({ type: "Action", action: name, args: info.lastArgs, txnId: uuid() });
          showToast("replay " + name);
        };
        p.querySelector(".cpy").onclick = () => {
          const json = safeStringify({ type: "Action", action: name, args: info.lastArgs }, null, 2);
          copyToClipboard(json, "action JSON copiada");
        };
        aBox.appendChild(p);
      }
      mBox.innerHTML = "";
      for (const [m, c] of [...state.modelsSeen.entries()].sort((a, b) => b[1] - a[1])) {
        const p = document.createElement("span");
        p.className = "pill";
        p.innerHTML = `<span class="label-txt">${m}</span><span class="n">${c}</span>`;
        p.querySelector(".label-txt").onclick = () => copyToClipboard(m, "model copiado");
        mBox.appendChild(p);
      }
      tBox.innerHTML = "";
      for (const [t, c] of [...state.msgTypes.entries()].sort((a, b) => b[1] - a[1])) {
        const p = document.createElement("span");
        p.className = "pill";
        p.innerHTML = `<span class="label-txt">${t}</span><span class="n">${c}</span>`;
        p.querySelector(".label-txt").onclick = () => copyToClipboard(t, "type copiado");
        tBox.appendChild(p);
      }
    };
    setInterval(renderDiscover, 2e3);
    renderDiscover();
    const buildRawObj = () => {
      const name = panel.querySelector("#gc-rawname").value.trim();
      if (!name) {
        showToast("action name?");
        return null;
      }
      let args = [];
      try {
        args = JSON.parse(panel.querySelector("#gc-rawargs").value || "[]");
      } catch (e) {
        showToast("args JSON inv\xE1lido");
        return null;
      }
      const onSelf = panel.querySelector("#gc-rawself").checked;
      const tid = onSelf ? userId : panel.querySelector("#gc-rawtid").value.trim();
      if (!tid) {
        showToast("userId?");
        return null;
      }
      return { type: "Action", action: name, args: ["SpaceUser", tid, ...args], txnId: uuid() };
    };
    panel.querySelector("#gc-rawsend").onclick = () => {
      const obj = buildRawObj();
      if (!obj) return;
      sendRaw(obj);
      panel.querySelector("#gc-rawres").textContent = "sent. txnId=" + obj.txnId.slice(0, 8) + "...\n" + safeStringify(obj, null, 2);
      setTimeout(() => {
        const r = actionLog.find((l) => l.action === obj.action && Math.abs(l.t - Date.now()) < 3e3);
        if (r) panel.querySelector("#gc-rawres").textContent = safeStringify(r, null, 2);
      }, 500);
    };
    panel.querySelector("#gc-rawcopy").onclick = () => {
      const obj = buildRawObj();
      if (!obj) return;
      copyToClipboard(safeStringify(obj, null, 2), "JSON copiado");
    };
    const redetectUserId = () => {
      const fromUrl = new URL(location.href).searchParams.get("userId");
      if (fromUrl && fromUrl !== userId) {
        userId = fromUrl;
        ctl.userId = userId;
        console.log("[GatherCtl] userId atualizado via URL", userId);
        return true;
      }
      return false;
    };
    const ensurePanelInDom = () => {
      if (!document.body.contains(root)) {
        try {
          document.body.appendChild(root);
          health.panelOk = true;
          console.log("[GatherCtl] painel re-anexado ao DOM");
        } catch (e) {
          health.panelOk = false;
        }
      }
    };
    const reconnect = () => {
      attachListener();
      redetectUserId();
      ensurePanelInDom();
      health.reconnects++;
      showToast("reconectado (" + health.reconnects + ")");
      console.log("[GatherCtl] reconnect manual");
    };
    panel.querySelector("#gc-recon").onclick = reconnect;
    setInterval(() => {
      const now = Date.now();
      const ws = getLiveGatherWS();
      const dot = panel.querySelector("#gc-dot");
      if (!dot) return;
      if (!ws) {
        health.wsState = "down";
        dot.className = "dot err";
        dot.title = "WS down \u2014 auto-reanexando";
        attachListener();
        return;
      }
      const recvAge = now - health.lastRecv;
      if (recvAge > 6e4 && state.users.size > 1) {
        health.wsState = "stale";
        dot.className = "dot err";
        dot.title = `sem recv h\xE1 ${Math.round(recvAge / 1e3)}s`;
      } else if (recvAge > 2e4) {
        health.wsState = "warn";
        dot.className = "dot warn";
        dot.title = `recv lento ${Math.round(recvAge / 1e3)}s`;
      } else {
        health.wsState = "ok";
        dot.className = "dot ok";
        dot.title = `WS ok | recv ${Math.round(recvAge / 1e3)}s atr\xE1s | reconnects: ${health.reconnects}`;
      }
    }, 2e3);
    setInterval(() => {
      attachListener();
      redetectUserId();
      ensurePanelInDom();
    }, 3e3);
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        console.log("[GatherCtl] URL mudou, re-checando userId");
        setTimeout(redetectUserId, 1e3);
      }
    }, 1e3);
    ctl.healthCheck = () => ({ ...health, ws: !!getLiveGatherWS(), users: state.users.size, frames: liveFrames.length, panel: document.body.contains(root) });
    ctl.reconnect = reconnect;
    console.log("[GatherCtl v4] ready. window.__gatherCtl");
  }

  // src/main.js
  if (document.readyState === "complete") setTimeout(boot, 2e3);
  else window.addEventListener("load", () => setTimeout(boot, 2e3));
})();
