// Shared helpers.
export const uuid = () => crypto.randomUUID();

// JSON.stringify replacer that handles BigInt + Map + Set + circular-safe.
const bigintReplacer = (_k, v) => {
  if (typeof v === 'bigint') return v.toString() + 'n';
  if (v instanceof Map) return Object.fromEntries(v);
  if (v instanceof Set) return [...v];
  return v;
};
export const safeStringify = (obj, indent) => {
  try { return JSON.stringify(obj, bigintReplacer, indent); }
  catch (e) { return `[serialize error: ${e.message}]`; }
};

export const h2b = h => {
  const b = new Uint8Array(h.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return b;
};

// msgpackr ext type 4 = UUID bytes (16). Convert to canonical string.
export const extToStr = v => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (v.__ext !== undefined && Array.isArray(v.bytes)) {
    if (v.bytes.length === 0) return '';
    const h = v.bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    if (v.bytes.length === 16) {
      return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
    }
    return h;
  }
  return String(v);
};
