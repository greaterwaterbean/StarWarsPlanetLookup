// Seeded random numbers.
// Math.random() gives different numbers every time, which would make every
// planet look different on each page load. A seeded generator always produces
// the same sequence for the same seed, so a planet only needs to store its seed.

// FNV-1a: turns any string (like "tatooine") into a 32-bit number.
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Mulberry32: tiny, fast, good enough for terrain. Returns a function that
// yields floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Accepts a number or a string and always returns an unsigned 32-bit seed.
export function toSeed(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(Math.abs(value)) >>> 0;
  return hashString(String(value ?? ''));
}

export function randomSeed() {
  return Math.floor(Math.random() * 4294967295) >>> 0;
}
