// Procedural pixel-art sprite factory.
// Every sprite is drawn as a material mask into a small buffer, then shaded with
// palette ramps (cylindrical / spherical / vertical lighting), ordered dithering,
// rim light/shadow and a dark 1px outline - the 16-bit look, with no bitmap assets.
(function (SS) {
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const OUTLINE = '#120a10';

  // ---------- palette ramps (dark -> light) ----------
  const P = {
    GOLD: ['#2a1204', '#6a3008', '#b0600c', '#e89a18', '#ffd040', '#fff4a8'],
    RED: ['#240608', '#5c0c0c', '#9c1c0c', '#d4440e', '#f47a24'],
    STEEL: ['#101820', '#26343f', '#44586a', '#6c8498', '#a0b8c8', '#dcecf4'],
    DARK: ['#0c0c12', '#22222e', '#3c3c4c', '#62627a', '#9696aa'],
    GLASS: ['#06202e', '#0e5070', '#2c98c8', '#8ae4ff', '#e8ffff'],
    RGLOW: ['#400000', '#a00010', '#ff2030', '#ff9090', '#ffffff'],
    CGLOW: ['#002030', '#006080', '#10c0e0', '#80f4ff', '#ffffff'],
    YELLOW: ['#302000', '#6a4a00', '#b08a10', '#e8c830', '#fff080'],
    OLIVE: ['#141a08', '#303c14', '#56662a', '#84944a', '#bcc47c', '#e8ecc0'],
    SAND: ['#2a2014', '#5a4a30', '#8c7650', '#bca47a', '#e8d8b0'],
    CRAB: ['#1c0a06', '#4a160c', '#8a2a12', '#c8501c', '#f08a3a', '#ffd08a'],
    PURP: ['#1a0a2a', '#3e1a5c', '#6a30a0', '#a060e0', '#d8a8ff', '#ffffff'],
    ICE: ['#08202c', '#1a5068', '#3a90b0', '#7ad0e8', '#c8f4ff', '#ffffff'],
    TEAL: ['#06181a', '#0e3a3e', '#1a6a6a', '#3aa09a', '#80d8c8', '#d0fff0'],
    ORANGE: ['#2a0e02', '#6a2a06', '#b05a0c', '#f0901c', '#ffc060'],
    NAVY: ['#04060e', '#0c1430', '#1a2a5a', '#34508a', '#6a8cc0'],
    BONE: ['#1a1610', '#3e3628', '#6e6450', '#a89a7c', '#dcd0b0', '#fffae8'],
    PINK: ['#400818', '#a01040', '#ff3c6c', '#ff9cb8', '#ffffff'],
    GREEN: ['#04200a', '#0c5018', '#1c9030', '#50d060', '#b0ffb0'],
    KELP: ['#0a1a06', '#1c3a0c', '#3a6a18', '#6a9e2a', '#a8d050'],
    CORAL: ['#2a0818', '#6a1838', '#b03a5a', '#e8708a', '#ffb8c8'],
    WHITE: ['#6a7a8a', '#a8b8c8', '#dce8f0', '#ffffff'],
    FIRE: ['#3a0a04', '#8a1a06', '#d44a08', '#f88a18', '#ffc840', '#fff4c0', '#ffffff'],
    SMOKE: ['#1c1c24', '#3a3a46', '#62626e', '#9494a0', '#c8c8d0', '#f0f0f4'],
    FOAM: ['#0a3050', '#2a6a98', '#6aaad0', '#b8e4f8', '#ffffff'],
  };
  const RAMPS = {};
  function ramp(r) {
    const k = r.join();
    return RAMPS[k] || (RAMPS[k] = r.map(SS.rgb));
  }

  // ---------- material buffer ----------
  class Buf {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.m = new Uint8Array(w * h);
    }
    set(x, y, v) {
      x = Math.floor(x);
      y = Math.floor(y);
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.m[y * this.w + x] = v;
      return this;
    }
    get(x, y) {
      return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.m[y * this.w + x] : 0;
    }
    ellipse(cx, cy, rx, ry, v) {
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
        for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) this.set(x, y, v);
        }
      return this;
    }
    circle(cx, cy, r, v) {
      return this.ellipse(cx, cy, r, r, v);
    }
    rect(x, y, w, h, v) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v);
      return this;
    }
    poly(pts, v) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [x, y] of pts) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      for (let y = Math.floor(y0); y <= y1; y++)
        for (let x = Math.floor(x0); x <= x1; x++) {
          const px = x + 0.5, py = y + 0.5;
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i], [xj, yj] = pts[j];
            if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) this.set(x, y, v);
        }
      return this;
    }
    line(x0, y0, x1, y1, v) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++)
        this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), v);
      return this;
    }
    recolor(from, to, pred) {
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++) {
          const i = y * this.w + x;
          if ((from === -1 ? this.m[i] : this.m[i] === from) && pred(x, y)) this.m[i] = to;
        }
      return this;
    }
  }

  // mats: {id: {r: ramp, s: 'cyl'|'hcyl'|'sph'|'vert'|'flat', b: bias, l: flat level, g: shading group, o: outline?}}
  function render(b, mats, opt = {}) {
    const w = b.w, h = b.h, W = w + 2, H = h + 2;
    const c = SS.canvas(W, H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const grp = (v) => (v ? (mats[v] && mats[v].g) || v : 0);
    const bb = {};
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = b.m[y * w + x];
        if (!v) continue;
        const B = bb[v] || (bb[v] = { x0: x, x1: x, y0: y, y1: y });
        if (x < B.x0) B.x0 = x; if (x > B.x1) B.x1 = x; if (y < B.y0) B.y0 = y; if (y > B.y1) B.y1 = y;
      }
    // contiguous runs of the same shading group, per column (cyl) and per row (hcyl)
    const t0 = new Int16Array(w * h), t1 = new Int16Array(w * h);
    const r0 = new Int16Array(w * h), r1 = new Int16Array(w * h);
    for (let x = 0; x < w; x++) {
      let y = 0;
      while (y < h) {
        const g = grp(b.m[y * w + x]);
        if (!g) { y++; continue; }
        const s = y;
        while (y < h && grp(b.m[y * w + x]) === g) y++;
        for (let k = s; k < y; k++) { t0[k * w + x] = s; t1[k * w + x] = y - 1; }
      }
    }
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        const g = grp(b.m[y * w + x]);
        if (!g) { x++; continue; }
        const s = x;
        while (x < w && grp(b.m[y * w + x]) === g) x++;
        for (let k = s; k < x; k++) { r0[y * w + k] = s; r1[y * w + k] = x - 1; }
      }
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = b.m[y * w + x];
        if (!v) continue;
        const M = mats[v] || { r: P.DARK };
        const R = ramp(M.r), n = R.length;
        let L, t;
        const B = bb[v];
        switch (M.s || 'cyl') {
          case 'cyl':
            t = (y - t0[y * w + x]) / Math.max(1, t1[y * w + x] - t0[y * w + x]);
            L = 1 - Math.abs(t - 0.28) * 1.45;
            break;
          case 'hcyl':
            t = (x - r0[y * w + x]) / Math.max(1, r1[y * w + x] - r0[y * w + x]);
            L = 1 - Math.abs(t - 0.3) * 1.45;
            break;
          case 'sph': {
            const cx = (B.x0 + B.x1 + 1) / 2, cy = (B.y0 + B.y1 + 1) / 2;
            const rx = Math.max(1, (B.x1 - B.x0 + 1) / 2), ry = Math.max(1, (B.y1 - B.y0 + 1) / 2);
            const dx = (x + 0.5 - cx) / rx + 0.35, dy = (y + 0.5 - cy) / ry + 0.4;
            L = 1 - Math.sqrt(dx * dx + dy * dy) / 1.6;
            break;
          }
          case 'vert':
            L = 1 - (y - B.y0) / (B.y1 - B.y0 + 1);
            break;
          default:
            L = M.l == null ? 0.5 : M.l;
        }
        L += M.b || 0;
        if (M.s !== 'flat') {
          if (!b.get(x, y + 1) || !b.get(x + 1, y)) L -= 0.16;
          if (!b.get(x, y - 1) || !b.get(x - 1, y)) L += 0.1;
        }
        const f = SS.clamp(L, 0, 1) * (n - 1) + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * 0.9;
        const col = R[SS.clamp(Math.round(f), 0, n - 1)];
        const o = ((y + 1) * W + x + 1) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = M.a || 255;
      }
    if (opt.outline !== false) {
      const oc = SS.rgb(opt.outline || OUTLINE);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 4;
          if (d[o + 3]) continue;
          const bx = x - 1, by = y - 1;
          let hit = false;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const v = b.get(bx + dx, by + dy);
            if (v && (!mats[v] || mats[v].o !== false)) hit = true;
          }
          if (hit) { d[o] = oc[0]; d[o + 1] = oc[1]; d[o + 2] = oc[2]; d[o + 3] = 255; }
        }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function flip(c) {
    const f = SS.canvas(c.width, c.height);
    const x = f.getContext('2d');
    x.translate(c.width, 0);
    x.scale(-1, 1);
    x.drawImage(c, 0, 0);
    return f;
  }
  function silhouette(c, color) {
    const f = SS.canvas(c.width, c.height);
    const x = f.getContext('2d');
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = color || '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
    return f;
  }
  // Sprite = canvas plus lazily-built flipped / white-flash variants.
  function spr(c) {
    return {
      c, w: c.width, h: c.height,
      get f() { return this._f || (this._f = flip(this.c)); },
      get wh() { return this._w || (this._w = silhouette(this.c)); },
      get fwh() { return this._fw || (this._fw = silhouette(this.f)); },
    };
  }
  const frames = (n, fn) => Array.from({ length: n }, (_, i) => spr(fn(i)));

  // ---------- designs ----------
  function propeller(b, x, y, len, f, mat) {
    if (f % 2 === 0) b.line(x, y - len, x, y + len, mat);
    else { b.line(x - 1, y - len + 2, x + 1, y + len - 2, mat); b.line(x + 1, y - len + 2, x - 1, y + len - 2, mat); }
  }

  function playerSub(f) {
    const b = new Buf(40, 20);
    b.ellipse(21, 12, 15, 5.5, 1);
    b.ellipse(32, 12, 5, 4.8, 1);
    b.recolor(1, 2, (x, y) => y >= 13);
    b.recolor(-1, 4, (x) => x === 12 || x === 13);
    b.poly([[15, 8], [27, 8], [25, 3], [18, 3]], 8);
    b.rect(19, 2, 5, 1, 4);
    b.line(22, 2, 22, 0, 4); b.line(22, 0, 25, 0, 4);
    b.line(9, 8, 19, 2, 4);
    b.poly([[9, 11], [2, 5], [5, 5], [11, 10]], 7);
    b.poly([[9, 14], [2, 20], [5, 20], [11, 15]], 7);
    b.rect(4, 11, 3, 3, 4);
    propeller(b, 2, 12, 4, f, 6);
    b.circle(34.5, 11, 2.1, 3);
    [16, 21, 26].forEach((x) => b.rect(x, 10, 2, 2, 3));
    b.rect(20, 5, 4, 1, 3);
    return render(b, {
      1: { r: P.GOLD, g: 1 }, 2: { r: P.RED, g: 1 }, 3: { r: P.GLASS, s: 'sph', b: 0.15 },
      4: { r: P.DARK, g: 1 }, 6: { r: P.DARK, s: 'flat', l: 0.8 }, 7: { r: P.RED, s: 'vert' }, 8: { r: P.GOLD, b: 0.05 },
    });
  }

  function enemySub(f, T) {
    const b = new Buf(46, 20);
    b.ellipse(23, 11, 18, 5.5, 1);
    b.ellipse(37, 11, 5, 4.5, 1);
    b.recolor(1, 2, (x, y) => y >= 12);
    b.recolor(2, 9, (x) => x % 6 < 2);
    b.poly([[17, 7], [29, 7], [28, 2], [20, 2]], 8);
    b.rect(21, 1, 6, 1, 4);
    b.line(24, 1, 24, 0, 4);
    b.poly([[8, 10], [1, 4], [4, 4], [10, 9]], 7);
    b.poly([[8, 13], [1, 19], [4, 19], [10, 14]], 7);
    b.rect(3, 10, 3, 3, 4);
    propeller(b, 2, 11, 4, f, 6);
    for (let x = 13; x <= 33; x += 5) b.rect(x, 9, 2, 2, 3);
    b.recolor(-1, 5, (x, y) => x >= 41 && b.get(x, y) === 1);
    return render(b, {
      1: { r: T.hull, g: 1 }, 2: { r: T.belly, g: 1 }, 9: { r: T.belly, g: 1, b: -0.35 }, 3: { r: T.glow, s: 'sph', b: 0.2 },
      4: { r: P.DARK, g: 1 }, 5: { r: P.DARK, g: 1, b: 0.1 }, 6: { r: P.DARK, s: 'flat', l: 0.8 }, 7: { r: T.belly, s: 'vert' }, 8: { r: T.hull },
    });
  }

  function drone(f, T) {
    const b = new Buf(24, 18);
    const w = f % 2 ? 1 : 0;
    b.poly([[8, 5], [4, 0 + w], [13, 4]], 2);
    b.poly([[8, 13], [4, 18 - w], [13, 14]], 2);
    b.poly([[6, 9], [0, 4 + w * 2], [0, 14 - w * 2]], 2);
    b.ellipse(12, 9, 8, 5.5, 1);
    b.circle(16.5, 8, 2.4, 3);
    b.rect(8, 11, 6, 1, 4);
    return render(b, {
      1: { r: T.hull, s: 'sph' }, 2: { r: T.belly, s: 'vert' }, 3: { r: T.glow, s: 'sph', b: 0.25 }, 4: { r: P.DARK, s: 'flat', l: 0.3 },
    });
  }

  function mine(f, T) {
    const b = new Buf(18, 18);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.line(9 + Math.cos(a) * 5, 9 + Math.sin(a) * 5, 9 + Math.cos(a) * 8, 9 + Math.sin(a) * 8, 2);
    }
    b.circle(9, 9, 5.8, 1);
    b.rect(8, 8, 2, 2, f % 2 ? 3 : 4);
    b.rect(5, 12, 8, 1, 4);
    return render(b, {
      1: { r: T.mine, s: 'sph' }, 2: { r: P.STEEL, s: 'flat', l: 0.75 }, 3: { r: P.RGLOW, s: 'flat', l: 0.8 }, 4: { r: P.DARK, s: 'flat', l: 0.25 },
    });
  }

  function boat(f, T) {
    const b = new Buf(64, 28);
    b.poly([[1, 14], [63, 12], [56, 27], [8, 27]], 1);
    b.recolor(1, 2, (x, y) => y >= 22);
    b.rect(3, 14, 58, 1, 5);
    b.rect(18, 8, 22, 6, 8);
    b.rect(23, 3, 11, 5, 8);
    for (let x = 24; x <= 32; x += 2) b.set(x, 5, 3);
    b.line(28, 3, 28, 0, 4); b.line(25, 1, 31, 1, 4);
    b.rect(11, 5, 5, 9, 4);
    b.rect(11, 5, 5, 2, 2);
    b.rect(44, 9, 7, 4, 4);
    b.line(50, 10, 60, 8, 4);
    for (let x = 12; x < 56; x += 7) b.rect(x, 17, 2, 2, 3);
    return render(b, {
      1: { r: T.hull }, 2: { r: P.RED }, 3: { r: P.GLASS, s: 'flat', l: 0.8 }, 4: { r: P.DARK }, 5: { r: T.belly, s: 'flat', l: 0.7 }, 8: { r: T.hull, b: 0.1 },
    });
  }

  function heli(f, T) {
    const b = new Buf(54, 24);
    b.poly([[26, 10], [4, 10], [4, 13], [26, 16]], 8);
    b.poly([[1, 3], [6, 3], [8, 13], [3, 13]], 8);
    b.ellipse(34, 13, 12, 6.5, 1);
    b.recolor(1, 3, (x, y) => x >= 38 && y <= 13);
    b.line(26, 22, 46, 22, 4);
    b.line(29, 18, 29, 22, 4); b.line(41, 18, 41, 22, 4);
    b.rect(31, 5, 4, 2, 4);
    b.rect(28, 17, 8, 2, 4);
    if (f % 2 === 0) b.line(10, 3, 54, 3, 6);
    else b.line(22, 3, 44, 3, 6);
    if (f % 2 === 0) b.line(4, 0, 4, 8, 6);
    else b.line(1, 4, 8, 4, 6);
    b.rect(12, 11, 3, 1, 9);
    return render(b, {
      1: { r: T.air, s: 'sph' }, 3: { r: P.GLASS, s: 'sph', b: 0.1 }, 4: { r: P.DARK }, 6: { r: P.DARK, s: 'flat', l: 0.9, o: false },
      8: { r: T.air }, 9: { r: P.YELLOW, s: 'flat', l: 0.8 },
    });
  }

  function turretBase(T) {
    const b = new Buf(26, 14);
    b.ellipse(13, 14, 11, 10, 1);
    b.rect(2, 12, 22, 2, 4);
    b.circle(13, 7, 3, 4);
    b.rect(12, 6, 2, 2, 3);
    return render(b, { 1: { r: T.hull, s: 'sph' }, 3: { r: T.glow, s: 'flat', l: 0.8 }, 4: { r: P.DARK, s: 'sph' } });
  }
  function turretBarrel() {
    const b = new Buf(14, 6);
    b.rect(0, 1, 11, 4, 1);
    b.rect(10, 0, 4, 6, 2);
    return render(b, { 1: { r: P.DARK }, 2: { r: P.STEEL } });
  }

  function crab(f, T) {
    const b = new Buf(36, 24);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const bx = 18 + side * (4 + i * 3);
        const lift = (f + i) % 2 === 0 ? 0 : 2;
        const kx = 18 + side * (8 + i * 4), ky = 13 - lift;
        const fx = 18 + side * (9 + i * 4) + (lift ? side : 0), fy = 23 - lift;
        b.line(bx, 12, kx, ky, 4);
        b.line(kx, ky, fx, fy, 4);
      }
    }
    b.ellipse(4, 13, 4, 3, 2);
    b.ellipse(32, 13, 4, 3, 2);
    b.ellipse(18, 10, 12, 6.5, 1);
    b.recolor(1, 5, (x, y) => y >= 13);
    b.line(14, 4, 14, 1, 4); b.line(22, 4, 22, 1, 4);
    b.rect(13, 0, 2, 2, 3); b.rect(21, 0, 2, 2, 3);
    b.rect(16, 3, 4, 2, 4);
    return render(b, {
      1: { r: T.crab, s: 'sph' }, 5: { r: T.crab, s: 'flat', l: 0.3 }, 2: { r: T.crab, s: 'sph', b: -0.1 },
      3: { r: T.glow, s: 'flat', l: 0.9 }, 4: { r: P.DARK, s: 'flat', l: 0.55 },
    });
  }

  function jelly(f, T) {
    const b = new Buf(22, 28);
    for (let i = 0; i < 4; i++) {
      const x0 = 5 + i * 4;
      for (let y = 11; y < 28; y++) b.set(x0 + Math.round(Math.sin(y * 0.45 + f * 1.4 + i) * 1.3), y, 2);
    }
    b.ellipse(11, 9, 9 + (f % 2 ? 0.6 : -0.3), 7 + (f % 2 ? -0.5 : 0.4), 1);
    b.rect(0, 11, 22, 4, 0);
    b.rect(3, 11, 16, 1, 1);
    b.circle(11, 7, 2.6, 3);
    return render(b, {
      1: { r: T.jelly, s: 'sph' }, 2: { r: T.jelly, s: 'flat', l: 0.6, o: false }, 3: { r: T.glow, s: 'sph', b: 0.3 },
    });
  }

  function icicle(v) {
    const b = new Buf(12, 32);
    const tip = 24 + v * 3;
    b.poly([[0, 0], [12, 0], [7, tip - 6], [6, tip], [5, tip - 6]], 1);
    b.poly([[2, 0], [5, 0], [4, 10]], 2);
    return render(b, { 1: { r: P.ICE, s: 'hcyl' }, 2: { r: P.ICE, s: 'flat', l: 1 } });
  }

  function boss(f, T) {
    const b = new Buf(132, 56);
    b.poly([[40, 19], [94, 19], [88, 9], [48, 9]], 8);
    b.rect(70, 2, 13, 8, 8);
    b.line(76, 2, 76, 0, 4);
    b.poly([[12, 26], [2, 8], [10, 8], [22, 22]], 7);
    b.poly([[12, 36], [2, 54], [10, 54], [22, 40]], 7);
    b.ellipse(68, 31, 58, 14, 1);
    b.ellipse(112, 31, 12, 11, 1);
    b.recolor(1, 2, (x, y) => y >= 34);
    b.recolor(2, 9, (x) => x % 8 < 3);
    b.recolor(-1, 4, (x, y) => (x === 32 || x === 33 || x === 64 || x === 65 || x === 96 || x === 97) && b.get(x, y) <= 2 && b.get(x, y) > 0);
    b.poly([[118, 26], [131, 33], [118, 40]], 4);
    for (let x = 52; x <= 86; x += 5) b.rect(x, 13, 2, 2, 3);
    for (let x = 24; x <= 110; x += 8) b.rect(x, 28, 3, 3, 3);
    b.rect(4, 28, 5, 6, 4);
    propeller(b, 2, 31, 7, f, 6);
    b.circle(50, 18, 4, 4);
    b.circle(86, 18, 4, 4);
    return render(b, {
      1: { r: T.hull, g: 1 }, 2: { r: T.belly, g: 1 }, 9: { r: T.belly, g: 1, b: -0.35 }, 3: { r: T.glow, s: 'sph', b: 0.25 },
      4: { r: P.DARK, g: 1 }, 6: { r: P.DARK, s: 'flat', l: 0.8 }, 7: { r: T.belly, s: 'vert' }, 8: { r: T.hull, b: 0.08 },
    });
  }


  // Surface battleship boss (bow on the right). Waterline sits at buffer y = 48.
  function battleship(T) {
    const b = new Buf(152, 64);
    b.rect(34, 12, 9, 22, 4);
    b.rect(34, 15, 9, 2, 2);
    b.rect(44, 22, 62, 12, 8);
    b.rect(54, 12, 38, 10, 8);
    b.rect(62, 3, 18, 9, 8);
    b.line(71, 3, 71, 0, 4); b.line(66, 1, 76, 1, 4);
    b.line(88, 12, 94, 4, 4); b.rect(92, 2, 5, 2, 4);
    for (let x = 64; x <= 78; x += 3) b.rect(x, 6, 2, 2, 3);
    for (let x = 56; x <= 90; x += 4) b.rect(x, 16, 2, 2, 3);
    for (let x = 46; x <= 104; x += 5) b.rect(x, 27, 2, 2, 3);
    for (const [cx, dir] of [[118, 1], [22, -1]]) {
      b.ellipse(cx, 31, 10, 5, 8);
      b.line(cx + dir * 4, 28, cx + dir * 22, 25, 4);
      b.line(cx + dir * 4, 30, cx + dir * 22, 27, 4);
    }
    b.poly([[0, 34], [151, 30], [141, 57], [10, 57]], 1);
    b.recolor(1, 2, (x, y) => y >= 48);
    b.rect(2, 34, 148, 1, 5);
    for (let x = 12; x < 140; x += 7) b.rect(x, 39, 2, 2, 3);
    b.recolor(1, 9, (x, y) => x % 16 === 0);
    return render(b, {
      1: { r: T.shipHull || P.STEEL, g: 1 }, 9: { r: T.shipHull || P.STEEL, g: 1, b: -0.3 }, 2: { r: P.RED, g: 1 },
      3: { r: P.GLASS, s: 'flat', l: 0.7 }, 4: { r: P.DARK }, 5: { r: P.WHITE, s: 'flat', l: 0.6 }, 8: { r: T.shipHull || P.STEEL, b: 0.12 },
    });
  }

  function jet(f, T) {
    const b = new Buf(44, 16);
    b.poly([[2, 1], [7, 1], [12, 8], [4, 8]], 8);
    b.poly([[1, 7], [36, 6], [44, 9], [36, 11], [4, 11]], 1);
    b.ellipse(31, 6, 5, 2.5, 3);
    b.poly([[14, 9], [28, 9], [18, 15], [12, 15]], 8);
    b.rect(0, 8, 2, 2, 4);
    if (f % 2) b.rect(0, 8, 1, 2, 5);
    b.rect(16, 12, 8, 2, 4);
    return render(b, {
      1: { r: T.air }, 3: { r: P.GLASS, s: 'sph' }, 4: { r: P.DARK, s: 'flat', l: 0.4 }, 5: { r: P.FIRE, s: 'flat', l: 0.8 }, 8: { r: T.air, b: -0.1 },
    });
  }

  function torpedo(kind) {
    const b = new Buf(16, 6);
    b.poly([[0, 0], [4, 1], [4, 5], [0, 6]], 3);
    b.rect(2, 1, 10, 4, 1);
    b.ellipse(12, 3, 3.5, 2, 2);
    b.rect(5, 1, 1, 4, 3);
    return render(b, kind === 'enemy'
      ? { 1: { r: P.DARK }, 2: { r: P.RGLOW, b: -0.1 }, 3: { r: P.STEEL, s: 'flat', l: 0.4 } }
      : { 1: { r: P.GOLD }, 2: { r: P.RED }, 3: { r: P.DARK, s: 'flat', l: 0.5 } });
  }
  function missileUp() {
    const b = new Buf(6, 16);
    b.poly([[0, 16], [1, 12], [5, 12], [6, 16]], 3);
    b.rect(1, 4, 4, 10, 1);
    b.ellipse(3, 4, 2, 3.5, 2);
    b.rect(1, 10, 4, 1, 3);
    return render(b, { 1: { r: P.GOLD, s: 'hcyl' }, 2: { r: P.RED, s: 'hcyl' }, 3: { r: P.DARK, s: 'flat', l: 0.5 } });
  }
  function orb(r) {
    const b = new Buf(8, 8);
    b.circle(4, 4, 3.4, 1);
    return render(b, { 1: { r: r || P.PINK, s: 'sph', b: 0.2 } }, { outline: '#3a0010' });
  }
  function depthCharge() {
    const b = new Buf(8, 10);
    b.rect(1, 1, 6, 8, 1);
    b.rect(1, 2, 6, 1, 2); b.rect(1, 6, 6, 1, 2);
    b.rect(0, 0, 8, 1, 3); b.rect(0, 9, 8, 1, 3);
    return render(b, { 1: { r: P.DARK, s: 'hcyl' }, 2: { r: P.YELLOW, s: 'hcyl' }, 3: { r: P.STEEL, s: 'flat', l: 0.5 } });
  }
  function bomb() {
    const b = new Buf(8, 13);
    b.poly([[1, 0], [7, 0], [5, 4], [3, 4]], 2);
    b.ellipse(4, 7.5, 3.2, 5, 1);
    return render(b, { 1: { r: P.OLIVE, s: 'hcyl' }, 2: { r: P.DARK, s: 'flat', l: 0.5 } });
  }
  function capsule(kind) {
    const b = new Buf(13, 13);
    b.circle(6.5, 6.5, 6, 1);
    const g = SS.FONT[kind === 'repair' ? '+' : 'P'];
    for (let j = 0; j < 15; j++) if (g[j] === '1') b.set(5 + (j % 3), 4 + ((j / 3) | 0), 2);
    return render(b, { 1: { r: kind === 'repair' ? P.GREEN : P.ORANGE, s: 'sph' }, 2: { r: P.WHITE, s: 'flat', l: 1 } });
  }
  function bubble(r) {
    const b = new Buf(r * 2 + 1, r * 2 + 1);
    b.circle(r + 0.5, r + 0.5, r + 0.4, 1);
    if (r > 1) b.circle(r + 0.5, r + 0.5, r - 0.6, 0);
    b.set(r - Math.max(0, r - 2), r - Math.max(0, r - 2), 2);
    return render(b, { 1: { r: P.FOAM, s: 'flat', l: 0.75 }, 2: { r: P.WHITE, s: 'flat', l: 1 } }, { outline: false });
  }
  function cloud(seed, w, h, R) {
    const rng = SS.rng(seed);
    const b = new Buf(w, h);
    for (let i = 0; i < 7; i++) {
      const cx = w * (0.15 + rng() * 0.7), r = h * (0.25 + rng() * 0.25);
      b.ellipse(cx, h - r - 1 - rng() * h * 0.2, r * 1.5, r, 1);
    }
    b.rect(2, h - 3, w - 4, 3, 1);
    return render(b, { 1: { r: R || P.WHITE, s: 'vert', b: 0.15 } }, { outline: false });
  }
  function coral(seed, R) {
    const rng = SS.rng(seed);
    const b = new Buf(24, 26);
    (function branch(x, y, a, len, d) {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      b.line(x, y, x2, y2, 1); b.line(x + 1, y, x2 + 1, y2, 1);
      if (d > 0) {
        branch(x2, y2, a - 0.5 - rng() * 0.3, len * 0.72, d - 1);
        branch(x2, y2, a + 0.5 + rng() * 0.3, len * 0.72, d - 1);
      } else b.circle(x2, y2, 1.6, 1);
    })(12, 25, -Math.PI / 2, 9, 3);
    return render(b, { 1: { r: R, s: 'vert', b: 0.1 } });
  }
  function crystal(seed) {
    const rng = SS.rng(seed);
    const b = new Buf(22, 26);
    for (let i = 0; i < 4; i++) {
      const x = 5 + rng() * 12, h = 10 + rng() * 14, lean = (rng() - 0.5) * 8, wd = 2 + rng() * 2;
      b.poly([[x - wd, 26], [x + wd, 26], [x + lean + wd * 0.5, 26 - h + 3], [x + lean, 26 - h], [x + lean - wd * 0.5, 26 - h + 3]], i % 2 ? 1 : 2);
    }
    return render(b, { 1: { r: P.ICE, s: 'hcyl', b: 0.1 }, 2: { r: P.ICE, s: 'hcyl', b: -0.1 } });
  }
  function rock(seed, R) {
    const rng = SS.rng(seed);
    const b = new Buf(20, 12);
    b.ellipse(10, 12, 8 + rng() * 2, 8 + rng() * 3, 1);
    b.ellipse(5 + rng() * 10, 12, 5, 6 + rng() * 3, 1);
    return render(b, { 1: { r: R, s: 'sph' } });
  }
  function vent(R) {
    const b = new Buf(16, 24);
    b.poly([[2, 24], [14, 24], [10, 4], [6, 4]], 1);
    b.rect(5, 2, 6, 3, 1);
    b.rect(6, 2, 4, 1, 2);
    return render(b, { 1: { r: R, s: 'hcyl' }, 2: { r: P.FIRE, s: 'flat', l: 0.7 } });
  }
  function glowPlant(seed) {
    const rng = SS.rng(seed);
    const b = new Buf(14, 22);
    for (let i = 0; i < 3; i++) {
      const x = 3 + i * 4, top = 4 + rng() * 10;
      b.line(x, 22, x + (rng() - 0.5) * 3, top, 1);
      b.circle(x + 0.5, top, 1.8, 2);
    }
    return render(b, { 1: { r: P.TEAL, s: 'flat', l: 0.4 }, 2: { r: P.CGLOW, s: 'sph', b: 0.3 } });
  }

  // ---------- effect animations ----------
  // Fireball -> smoke explosion, rendered straight to pixels.
  function explosion(size, n, seed, water) {
    const rng = SS.rng(seed);
    const puffs = [];
    const count = 5 + Math.floor(size / 8);
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2, dist = rng() * size * 0.22;
      puffs.push({ dx: Math.cos(a) * dist, dy: Math.sin(a) * dist, r: size * (0.13 + rng() * 0.12), delay: rng() * 0.2 });
    }
    const FIRE = ramp(P.FIRE), SMOKE = ramp(water ? P.FOAM : P.SMOKE);
    const out = [];
    for (let f = 0; f < n; f++) {
      const c = SS.canvas(size, size);
      const ctx = c.getContext('2d');
      const half = size / 2;
      if (f < 2) {
        ctx.fillStyle = f === 0 ? '#20182a' : '#ffffff';
        const r = size * (f === 0 ? 0.2 : 0.3);
        for (let y = 0; y < size; y++)
          for (let x = 0; x < size; x++)
            if ((x + 0.5 - half) ** 2 + (y + 0.5 - half) ** 2 <= r * r) ctx.fillRect(x, y, 1, 1);
        out.push(spr(c));
        continue;
      }
      const t = (f - 2) / (n - 3);
      const img = ctx.createImageData(size, size);
      const d = img.data;
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          let best = -1;
          for (const p of puffs) {
            const tt = SS.clamp((t - p.delay) / (1 - p.delay), 0, 1);
            const pr = p.r * (0.6 + Math.sqrt(tt) * 1.1);
            const cx = half + p.dx * (1 + tt), cy = half + p.dy * (1 + tt) - tt * size * (water ? 0.18 : 0.12);
            const dx = (x + 0.5 - cx) / pr, dy = (y + 0.5 - cy) / pr;
            const q = dx * dx + dy * dy;
            if (q > 1) continue;
            const L = 1 - Math.sqrt((dx + 0.35) ** 2 + (dy + 0.4) ** 2) / 1.6;
            if (L > best) best = L;
          }
          if (best < 0) continue;
          const th = BAYER[(y & 3) * 4 + (x & 3)] / 16;
          if (t > 0.45 && th < (t - 0.45) * 2.1) continue;
          const fire = t < 0.5;
          const R = fire ? FIRE : SMOKE;
          const k = fire ? best * 0.8 + (1 - t * 2) * 0.35 : best * 0.9;
          const idx = SS.clamp(Math.round(k * (R.length - 1) + (th - 0.47) * 0.9), 0, R.length - 1);
          const col = R[idx];
          const o = (y * size + x) * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
      out.push(spr(c));
    }
    return out;
  }

  // Water geyser (used when things blow up near the surface)
  function geyser(w, h, n, seed) {
    const rng = SS.rng(seed);
    const cols = Array.from({ length: w }, () => 0.7 + rng() * 0.3);
    const FOAM = ramp(P.FOAM);
    const out = [];
    for (let f = 0; f < n; f++) {
      const t = f / (n - 1);
      const c = SS.canvas(w, h);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(w, h);
      const d = img.data;
      const hh = h * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * (1 - Math.max(0, t - 0.6) * 1.2);
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - w / 2) / (w / 2);
        const top = h - hh * cols[x] * (1 - dx * dx * 0.8);
        for (let y = Math.max(0, Math.floor(top)); y < h; y++) {
          const th = BAYER[(y & 3) * 4 + (x & 3)] / 16;
          if (t > 0.35 && th < (t - 0.35) * 1.5 * (1 - (y - top) / h)) continue;
          if (rng() < 0.08 + t * 0.3) continue;
          const L = 1 - (y - top) / Math.max(1, h - top) * 0.7 - Math.abs(dx) * 0.4;
          const col = FOAM[SS.clamp(Math.round(L * (FOAM.length - 1) + (th - 0.5)), 0, FOAM.length - 1)];
          const o = (y * w + x) * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      out.push(spr(c));
    }
    return out;
  }

  // ---------- public ----------
  SS.P = P;
  SS.Buf = Buf;
  SS.renderBuf = render;
  SS.makeSprite = spr;

  // Player / projectile / effect sprites (theme independent)
  let common = null;
  SS.commonSprites = function () {
    if (common) return common;
    common = {
      player: frames(2, playerSub),
      torp: spr(torpedo('player')),
      missile: spr(missileUp()),
      etorp: spr(torpedo('enemy')),
      orb: spr(orb()),
      orbC: spr(orb(P.CGLOW)),
      charge: spr(depthCharge()),
      bomb: spr(bomb()),
      repair: spr(capsule('repair')),
      power: spr(capsule('power')),
      barrel: spr(turretBarrel()),
      bubbles: [1, 2, 3].map((r) => spr(bubble(r))),
      icicles: [0, 1, 2].map((v) => spr(icicle(v))),
      exS: explosion(24, 12, 1),
      exM: explosion(40, 14, 2),
      exL: explosion(72, 16, 3),
      wexS: explosion(24, 12, 4, true),
      wexM: explosion(40, 14, 5, true),
      wexL: explosion(72, 16, 6, true),
      geyS: geyser(16, 34, 12, 7),
      geyL: geyser(30, 60, 14, 8),
    };
    return common;
  };

  // Enemy / scenery sprites recoloured to a level theme
  SS.themeSprites = function (T) {
    return {
      esub: frames(2, (f) => enemySub(f, T)),
      drone: frames(2, (f) => drone(f, T)),
      mine: frames(2, (f) => mine(f, T)),
      boat: spr(boat(0, T)),
      heli: frames(2, (f) => heli(f, T)),
      tbase: spr(turretBase(T)),
      crab: frames(2, (f) => crab(f, T)),
      jelly: frames(4, (f) => jelly(f, T)),
      boss: frames(2, (f) => boss(f, T)),
      ship: spr(battleship(T)),
      jet: frames(2, (f) => jet(f, T)),
      clouds: [0, 1, 2].map((i) => spr(cloud(20 + i, 40 + i * 12, 14 + i * 3, T.cloud))),
      corals: [0, 1, 2].map((i) => spr(coral(40 + i, i === 1 ? P.ORANGE : T.coral || P.CORAL))),
      crystals: [0, 1, 2].map((i) => spr(crystal(60 + i))),
      rocks: [0, 1, 2].map((i) => spr(rock(80 + i, T.sea))),
      vent: spr(vent(T.sea)),
      glowPlants: [0, 1].map((i) => spr(glowPlant(90 + i))),
    };
  };
})(window.SS);
