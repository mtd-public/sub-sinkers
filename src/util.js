// Shared helpers: math, seeded randomness, noise, canvas creation and a tiny 3x5 pixel font.
window.SS = window.SS || {};
(function (SS) {
  SS.W = 384;
  SS.H = 216;
  SS.SURF = 40; // y of the water surface in every level

  SS.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  SS.lerp = (a, b, t) => a + (b - a) * t;
  SS.rnd = (a, b) => a + Math.random() * (b - a);
  SS.pick = (arr) => arr[(Math.random() * arr.length) | 0];

  SS.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  SS.hash = function (i, s) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(s | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  SS.noise1 = function (x, s) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return SS.hash(i, s) * (1 - u) + SS.hash(i + 1, s) * u;
  };
  SS.fbm = function (x, s) {
    return SS.noise1(x, s) * 0.6 + SS.noise1(x * 2.1, s + 7) * 0.28 + SS.noise1(x * 4.3, s + 13) * 0.12;
  };

  SS.canvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };

  SS.rgb = function (h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  SS.mix = function (a, b, t) {
    const A = SS.rgb(a), B = SS.rgb(b);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
  };

  // 3x5 bitmap font
  const G = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001',
    '8': '111101111101111', '9': '111101111001111', A: '010101111101101', B: '110101110101110',
    C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
    G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101',
    O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
    S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010',
    W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
    ' ': '000000000000000', ':': '000010000010000', '.': '000000000000010', '-': '000000111000000',
    '+': '000010111010000', '/': '001001010100100', '!': '010010010000010', '%': '101001010100101',
    '>': '100010001010100', '<': '001010100010001', '*': '000101010101000', "'": '010010000000000',
  };
  SS.FONT = G;
  SS.textWidth = (s, sc = 1) => s.length * 4 * sc - sc;
  SS.text = function (ctx, s, x, y, color, sc = 1, shadow) {
    s = String(s).toUpperCase();
    if (shadow) SS.text(ctx, s, x + sc, y + sc, shadow, sc);
    ctx.fillStyle = color;
    for (let i = 0; i < s.length; i++) {
      const g = G[s[i]] || G[' '];
      for (let j = 0; j < 15; j++) {
        if (g[j] === '1') ctx.fillRect(x + (i * 4 + (j % 3)) * sc, y + ((j / 3) | 0) * sc, sc, sc);
      }
    }
  };
})(window.SS);
