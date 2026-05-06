// Top-level WebSocket hook — runs at document-start, captures gather frames.
if (!window.__wsHook) {
  const OrigWS = window.WebSocket;
  const hook = { sockets: [], frames: [], maxFrames: 5000 };
  const hexify = ab => { const b = new Uint8Array(ab); let s=''; for (let i=0;i<b.length;i++) s+=b[i].toString(16).padStart(2,'0'); return s; };
  function P(url, protos) {
    const ws = protos ? new OrigWS(url, protos) : new OrigWS(url);
    const rec = { url: String(url), ws, sent: 0, recv: 0, closed: false };
    hook.sockets.push(rec);
    const idx = hook.sockets.length - 1;
    const push = (dir, data) => {
      if (hook.frames.length >= hook.maxFrames) hook.frames.shift();
      const m = { dir, t: Date.now(), socketIdx: idx };
      if (data instanceof ArrayBuffer) { m.type='binary'; m.len=data.byteLength; m.hex=hexify(data); }
      else if (data && data.byteLength !== undefined) { m.type='binary'; m.len=data.byteLength; m.hex=hexify(data.buffer||data); }
      else if (typeof data === 'string') { m.type='text'; m.len=data.length; m.text=data.slice(0,4000); }
      else if (data instanceof Blob) { m.type='blob'; m.len=data.size; data.arrayBuffer().then(ab => m.hex=hexify(ab)); }
      hook.frames.push(m);
    };
    const os = ws.send.bind(ws);
    ws.send = function(d){ rec.sent++; push('send', d); return os(d); };
    ws.addEventListener('message', e => { rec.recv++; push('recv', e.data); });
    ws.addEventListener('close', e => { rec.closed = true; rec.closeCode = e.code; });
    return ws;
  }
  P.prototype = OrigWS.prototype;
  for (const k of ['CONNECTING','OPEN','CLOSING','CLOSED']) P[k] = OrigWS[k];
  window.WebSocket = P;
  window.__wsHook = hook;
  window.__findGather = () => hook.sockets.findIndex(s => s.url.includes('gather-game-v2'));
}
