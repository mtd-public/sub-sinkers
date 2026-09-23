// Level scenery: sky/water gradient, parallax silhouettes, light rays, clouds,
// seabed terrain (cached in chunks), ice ceiling, decorations and marine snow.
(function (SS) {
  const { W, H } = SS;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const CH = 128;
  // sun / moon per level; y < 0 means "sitting on the horizon"
  const SUNS = [
    { x: 318, y: 16, r: 9, c: '#fff8d0' },
    { x: 262, y: -3, r: 17, c: '#ffc070' },
    { x: 70, y: 14, r: 7, c: '#e8f0ff' },
    { x: 300, y: 12, r: 5, c: '#dff8ff' },
  ];

  class World {
    constructor(L, index) {
      this.L = L;
      SS.SURF = L.surf;
      this.index = index;
      this.T = SS.themeSprites(L.theme);
      this.sea = L.theme.sea.map(SS.rgb);
      this.seed = L.seed;
      this.chunks = new Map();
      this.farChunks = new Map();
      this.iceChunks = new Map();
      this.skyChunks = new Map();
      this.bg = this.makeBg(SUNS[index]);
      const r = SS.rng(L.seed + 5);
      this.snow = Array.from({ length: 46 }, () => ({ x: r() * W, y: SS.SURF + r() * (H - SS.SURF), s: r() < 0.2 ? 2 : 1, v: 3 + r() * 6, p: r() * 6 }));
      this.clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 110 + r() * 60, y: 3 + r() * 16, k: i % 3 }));
    }

    ground(x) {
      const L = this.L;
      let g = L.groundBase + (SS.fbm(x / 90, this.seed) - 0.5) * 2 * L.groundAmp + (SS.fbm(x / 23, this.seed + 3) - 0.5) * 7;
      if (x > L.len) g = SS.lerp(g, L.groundBase + 4, SS.clamp((x - L.len) / 120, 0, 1));
      if (x < 200) g = SS.lerp(L.groundBase + 6, g, x / 200);
      return Math.min(H - 6, g);
    }
    ceil(x) {
      if (!this.L.ice) return SS.SURF - 6;
      return SS.SURF + 3 + SS.fbm(x / 45, this.seed + 9) * 12 + SS.hash(Math.floor(x / 5), this.seed) * 3;
    }

    makeBg(sun) {
      const c = SS.canvas(W, H), ctx = c.getContext('2d');
      const img = ctx.createImageData(W, H), d = img.data;
      const band = (cols, t, x, y) => {
        const n = 12;
        const f = SS.clamp(t, 0, 1) * (n - 1) + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5);
        const k = SS.clamp(Math.round(f), 0, n - 1) / (n - 1);
        const seg = k * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(seg)), u = seg - i;
        const A = SS.rgb(cols[i]), B = SS.rgb(cols[i + 1]);
        return A.map((v, j) => Math.round(v + (B[j] - v) * u));
      };
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const col = y < SS.SURF ? band(this.L.sky, y / SS.SURF, x, y) : band(this.L.water, (y - SS.SURF) / (H - SS.SURF), x, y);
          const o = (y * W + x) * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
      if (this.L.stars) {
        const r = SS.rng(7);
        for (let i = 0; i < 60; i++) {
          ctx.fillStyle = r() < 0.3 ? '#8aa8ff' : '#ffffff';
          ctx.fillRect((r() * W) | 0, (r() * (SS.SURF - 4)) | 0, 1, 1);
        }
      }
      if (sun) {
        sun = Object.assign({}, sun, { y: sun.y < 0 ? SS.SURF + sun.y : sun.y });
        ctx.fillStyle = sun.c;
        for (let y = -sun.r; y <= sun.r; y++)
          for (let x = -sun.r; x <= sun.r; x++)
            if (x * x + y * y <= sun.r * sun.r && sun.y + y < SS.SURF) ctx.fillRect(sun.x + x, sun.y + y, 1, 1);
        ctx.globalAlpha = 0.25;
        ctx.fillRect(sun.x - sun.r * 2, SS.SURF + 1, sun.r * 4, 1);
        ctx.fillRect(sun.x - sun.r, SS.SURF + 3, sun.r * 2, 1);
        ctx.globalAlpha = 1;
      }
      return c;
    }

    seabedChunk(i) {
      let c = this.chunks.get(i);
      if (c) return c;
      c = SS.canvas(CH, H);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(CH, H), d = img.data;
      const R = this.sea, n = R.length;
      for (let x = 0; x < CH; x++) {
        const wx = i * CH + x;
        const gy = Math.floor(this.ground(wx));
        for (let y = Math.max(0, gy); y < H; y++) {
          const dd = y - gy;
          const tex = SS.hash(Math.floor(wx / 3) + Math.floor(y / 3) * 7919, this.seed) - 0.5;
          let L = dd === 0 ? 1 : 0.85 - dd / 30 + tex * 0.32;
          if (dd === 1) L += 0.15;
          const f = SS.clamp(L, 0, 1) * (n - 1) + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * 0.9;
          const col = R[SS.clamp(Math.round(f), 0, n - 1)];
          const o = (y * CH + x) * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
        if (gy - 1 >= 0) {
          const o = ((gy - 1) * CH + x) * 4;
          d[o] = 16; d[o + 1] = 10; d[o + 2] = 16; d[o + 3] = 200;
        }
      }
      ctx.putImageData(img, 0, 0);
      if (this.chunks.size > 40) this.chunks.delete(this.chunks.keys().next().value);
      this.chunks.set(i, c);
      return c;
    }

    farChunk(i) {
      let c = this.farChunks.get(i);
      if (c) return c;
      c = SS.canvas(CH, H);
      const ctx = c.getContext('2d');
      ctx.fillStyle = this.L.far;
      for (let x = 0; x < CH; x++) {
        const wx = i * CH + x;
        const top = Math.max(SS.SURF + 16, Math.floor(this.L.groundBase - 24 - SS.fbm(wx / 60, this.seed + 5) * 70));
        ctx.fillRect(x, top + 2, 1, H - top);
        if ((x & 1) === 0) ctx.fillRect(x, top, 1, 1);
        if ((x & 1) === 1) ctx.fillRect(x, top + 1, 1, 1);
      }
      if (this.farChunks.size > 20) this.farChunks.delete(this.farChunks.keys().next().value);
      this.farChunks.set(i, c);
      return c;
    }

    // Floating ice sheet: top sits just above the waterline, jagged underside at ceil(x)
    iceChunk(i) {
      let c = this.iceChunks.get(i);
      if (c) return c;
      const top0 = SS.SURF - 10;
      c = SS.canvas(CH, SS.SURF + 24);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(CH, SS.SURF + 24), d = img.data;
      const R = SS.P.ICE.map(SS.rgb), n = R.length;
      for (let x = 0; x < CH; x++) {
        const wx = i * CH + x;
        const cy = Math.floor(this.ceil(wx));
        const top = top0 + Math.round(SS.noise1(wx / 30, 4) * 5);
        for (let y = top; y < cy; y++) {
          const tex = SS.hash(Math.floor(wx / 4) + Math.floor(y / 2) * 131, 3) - 0.5;
          let L = y < top + 3 ? 1 : y < SS.SURF ? 0.75 + tex * 0.3 : 0.4 + tex * 0.5 + ((y - SS.SURF) / (cy - SS.SURF + 1)) * 0.2;
          if (y >= cy - 2) L = 0.85;
          const f = SS.clamp(L, 0, 1) * (n - 1) + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47);
          const col = R[SS.clamp(Math.round(f), 0, n - 1)];
          const o = (y * CH + x) * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
        for (const yy of [top - 1, cy]) {
          const o = (yy * CH + x) * 4;
          d[o] = 8; d[o + 1] = 24; d[o + 2] = 36; d[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      if (this.iceChunks.size > 40) this.iceChunks.delete(this.iceChunks.keys().next().value);
      this.iceChunks.set(i, c);
      return c;
    }

    // Distant above-water structures on the horizon: harbor towers, cranes,
    // striped smokestacks, oil rigs, night city or icebergs depending on level.
    skylineChunk(i) {
      let c = this.skyChunks.get(i);
      if (c) return c;
      const S = SS.SURF, SW = 192;
      c = SS.canvas(SW, S);
      const ctx = c.getContext('2d');
      const kind = this.L.skyline;
      const haze = this.L.sky[2];
      const col = (h, t) => SS.mix(h, haze, t == null ? 0.35 : t);
      const r = SS.rng(this.seed * 1000 + i * 7 + 1);
      const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
      let x = r() * 20;
      while (x < SW) {
        const k = r();
        if (kind === 'harbor') {
          if (k < 0.35) { // concrete tower with window grid and scaffold
            const w = 16 + r() * 12, h = Math.min(S - 6, 26 + r() * 40);
            px(x, S - h, w, h, col('#9a9a92')); px(x, S - h, 2, h, col('#c8c8c0')); px(x + w - 2, S - h, 2, h, col('#6a6a64'));
            for (let yy = S - h + 4; yy < S - 4; yy += 5) for (let xx = x + 3; xx < x + w - 3; xx += 4) px(xx, yy, 2, 2, col('#4a4640'));
            px(x - 1, S - h - 2, w + 2, 2, col('#b8742a', 0.3));
            px(x + w * 0.3, S - h - 10, 1, 10, col('#b8742a', 0.3));
            x += w + 4 + r() * 10;
          } else if (k < 0.55) { // striped smokestacks
            for (let j = 0; j < 2; j++) {
              const h = 28 + r() * 24;
              for (let yy = 0; yy < h; yy += 4) px(x + j * 6, S - h + yy, 4, 4, col((yy / 4) % 2 ? '#e8e0d0' : '#c04a2a'));
            }
            x += 16 + r() * 10;
          } else if (k < 0.75) { // crane
            const h = 30 + r() * 20;
            px(x + 6, S - h, 3, h, col('#c89030')); px(x - 6, S - h, 36, 2, col('#c89030'));
            ctx.fillStyle = col('#6a5020');
            for (let yy = S - h; yy < S; yy += 3) ctx.fillRect(x + 6 + ((yy / 3) % 2), yy, 1, 1);
            px(x + 24, S - h + 2, 1, 12 + r() * 10, col('#3a3a3a')); px(x + 22, S - h + 16, 5, 3, col('#5a6a3a'));
            x += 40 + r() * 10;
          } else { // warehouse
            const w = 30 + r() * 20;
            px(x, S - 12, w, 12, col('#b8b0a0')); px(x - 2, S - 16, w + 4, 4, col('#c8843a'));
            for (let xx = x + 3; xx < x + w - 3; xx += 5) px(xx, S - 8, 2, 4, col('#5a5040'));
            x += w + 6 + r() * 10;
          }
        } else if (kind === 'rigs') {
          if (k < 0.5) { // oil rig
            const w = 34 + r() * 16, h = 20 + r() * 10;
            const c1 = col('#2a1a2a', 0.2), c2 = col('#4a2a3a', 0.2);
            for (let j = 0; j < 4; j++) px(x + 3 + j * (w - 8) / 3, S - h + 8, 2, h - 8, c1);
            for (let yy = S - h + 12; yy < S; yy += 6) px(x + 3, yy, w - 6, 1, c1);
            px(x, S - h + 4, w, 5, c2);
            const dx = x + w * 0.6;
            for (let yy = 0; yy < 22; yy++) px(dx + yy * 0.2, S - h + 4 - yy, 1, 1, c1), px(dx + 8 - yy * 0.2, S - h + 4 - yy, 1, 1, c1);
            px(dx + 3, S - h - 20, 2, 2, '#ff5040');
            px(x + 4, S - h - 2, 10, 6, c2);
            x += w + 20 + r() * 40;
          } else { // tanker
            const w = 40 + r() * 20;
            px(x, S - 5, w, 5, col('#2a1a2a', 0.2)); px(x + w - 10, S - 11, 8, 6, col('#3a2a3a', 0.2));
            x += w + 30 + r() * 30;
          }
        } else if (kind === 'city') { // dark night skyline with lit windows
          const w = 10 + r() * 14, h = 10 + r() * 34;
          px(x, S - h, w, h, '#060a1c');
          for (let yy = S - h + 3; yy < S - 2; yy += 3) for (let xx = x + 2; xx < x + w - 2; xx += 3) if (r() < 0.35) px(xx, yy, 1, 1, r() < 0.8 ? '#ffd870' : '#80e0ff');
          if (r() < 0.25) { px(x + w / 2, S - h - 8, 1, 8, '#060a1c'); px(x + w / 2 - 1, S - h - 9, 3, 2, '#ff3040'); }
          x += w + r() * 6;
        } else { // icebergs
          const w = 20 + r() * 34, h = 8 + r() * 22;
          const pts = [];
          for (let j = 0; j <= 6; j++) pts.push([x + (w * j) / 6, S - (j === 0 || j === 6 ? 0 : h * (0.5 + r() * 0.5))]);
          ctx.fillStyle = col('#c8ecf8', 0.25);
          ctx.beginPath(); ctx.moveTo(x, S); pts.forEach(([a, b]) => ctx.lineTo(a, b)); ctx.closePath(); ctx.fill();
          ctx.fillStyle = col('#6aa8c8', 0.25);
          ctx.beginPath(); ctx.moveTo(x + w * 0.5, S); pts.slice(3).forEach(([a, b]) => ctx.lineTo(a, b)); ctx.closePath(); ctx.fill();
          x += w + 10 + r() * 40;
        }
      }
      if (this.skyChunks.size > 20) this.skyChunks.delete(this.skyChunks.keys().next().value);
      this.skyChunks.set(i, c);
      return c;
    }

    drawBack(ctx, camX, t) {
      ctx.drawImage(this.bg, 0, 0);
      {
        const cl = this.T.clouds;
        for (const c of this.clouds) {
          const s = cl[c.k];
          let x = Math.round(c.x - camX * 0.15 - t * 3) % (W + 120);
          if (x < -100) x += W + 120;
          ctx.drawImage(s.c, x, c.y);
        }
      }
      // horizon skyline (parallax 0.25)
      const kx = camX * 0.25;
      for (let i = Math.floor(kx / 192); i * 192 < kx + W; i++) ctx.drawImage(this.skylineChunk(i), Math.round(i * 192 - kx), 0);
      // far silhouettes (parallax 0.4)
      const fx = camX * 0.4;
      for (let i = Math.floor(fx / CH); i * CH < fx + W; i++) ctx.drawImage(this.farChunk(i), Math.round(i * CH - fx), 0);
      // light shafts
      if (this.L.rays) {
        ctx.fillStyle = `rgba(255,255,240,${this.L.rays})`;
        for (let k = 0; k < 5; k++) {
          const base = ((k * 97 - camX * 0.5 + t * 4) % (W + 160) + W + 160) % (W + 160) - 80;
          const wob = Math.sin(t * 0.7 + k) * 6;
          ctx.beginPath();
          ctx.moveTo(base, SS.SURF);
          ctx.lineTo(base + 14 + wob, SS.SURF);
          ctx.lineTo(base + 70 + wob, H);
          ctx.lineTo(base + 40, H);
          ctx.fill();
        }
      }
      // choppy surface band: crest line, whitecaps and a lighter churn band below
      if (!this.L.ice) {
        const S = SS.SURF, sky = this.L.sky[2], water = this.L.water[0];
        const churn = SS.mix(this.L.water[0], '#ffffff', 0.25), deep = SS.mix(this.L.water[0], this.L.water[1], 0.5);
        for (let x = 0; x < W; x++) {
          const wx = x + camX;
          const a = Math.sin(wx * 0.07 + t * 2.0) * 2.2 + Math.sin(wx * 0.19 - t * 1.4) * 1.1 + Math.sin(wx * 0.031 + t * 0.6) * 1.2;
          const wy = Math.round(S + a);
          if (wy < S) { ctx.fillStyle = churn; ctx.fillRect(x, wy, 1, S - wy); }
          else if (wy > S) { ctx.fillStyle = sky; ctx.fillRect(x, S, 1, wy - S); }
          ctx.fillStyle = churn;
          ctx.fillRect(x, Math.max(wy, S), 1, 4);
          ctx.fillStyle = deep;
          if (((wx | 0) + (Math.floor(t * 8) & 1)) % 2 === 0) ctx.fillRect(x, Math.max(wy, S) + 4, 1, 2);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, wy, 1, 1);
          const cap = Math.sin(wx * 0.07 + t * 2.0);
          if (cap > 0.8) { ctx.fillStyle = '#e8fcff'; ctx.fillRect(x, wy + 1, 1, 2); }
          if (((wx | 0) & 15) < 5 && cap < -0.3) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x, wy + 5 + ((wx | 0) & 1), 1, 1); }
        }
      }
    }

    // scenery that sits on the seabed (drawn behind entities, before the ground)
    drawDeco(ctx, camX, t) {
      const T = this.T, L = this.L;
      const slot = 36;
      for (let i = Math.floor((camX - 40) / slot); i * slot < camX + W + 40; i++) {
        const h = SS.hash(i, this.seed + 99);
        if (h > 0.6) continue;
        const kind = L.deco[Math.floor(SS.hash(i, this.seed + 7) * L.deco.length)];
        const x = i * slot + SS.hash(i, this.seed + 3) * 24;
        const sx = Math.round(x - camX), gy = Math.round(this.ground(x));
        const v = Math.floor(SS.hash(i, this.seed + 11) * 3);
        if (kind === 'kelp') {
          const len = 12 + Math.floor(SS.hash(i, 5) * 22);
          const cols = SS.P.KELP;
          for (let k = 0; k < 2; k++) {
            const bx = sx + k * 4;
            for (let s = 0; s < len; s++) {
              const sway = Math.round(Math.sin(t * 1.4 + i + s * 0.18) * s * 0.12);
              ctx.fillStyle = cols[(s + k) % 3 === 0 ? 3 : 2];
              ctx.fillRect(bx + sway, gy + 2 - s * 2, 2, 2);
              if (s % 4 === 2) { ctx.fillStyle = cols[4]; ctx.fillRect(bx + sway + (s % 8 ? 2 : -2), gy + 2 - s * 2, 2, 1); }
            }
          }
        } else {
          let s;
          if (kind === 'coral') s = T.corals[v];
          else if (kind === 'crystal') s = T.crystals[v];
          else if (kind === 'vent') s = T.vent;
          else if (kind === 'glow') s = T.glowPlants[v % 2];
          else s = T.rocks[v];
          ctx.drawImage(s.c, sx - (s.w >> 1), gy + 3 - s.h);
          if (kind === 'vent') {
            for (let k = 0; k < 3; k++) {
              const p = (t * 0.8 + k / 3 + h) % 1;
              ctx.fillStyle = `rgba(255,${160 + k * 30},80,${0.6 * (1 - p)})`;
              ctx.fillRect(sx + Math.round(Math.sin(p * 9 + k) * 2), gy + 3 - s.h - Math.round(p * 30), 2, 2);
            }
          }
          if (kind === 'glow') {
            ctx.fillStyle = `rgba(110,240,255,${0.12 + 0.1 * Math.sin(t * 2 + i)})`;
            ctx.fillRect(sx - 9, gy - s.h - 2, 18, s.h + 4);
          }
        }
      }
    }

    drawFront(ctx, camX, t) {
      for (let i = Math.floor(camX / CH); i * CH < camX + W; i++) ctx.drawImage(this.seabedChunk(i), Math.round(i * CH - camX), 0);
      if (this.L.ice) for (let i = Math.floor(camX / CH); i * CH < camX + W; i++) ctx.drawImage(this.iceChunk(i), Math.round(i * CH - camX), 0);
      // marine snow / plankton
      ctx.fillStyle = this.L.snow;
      for (const p of this.snow) {
        const x = (((p.x - camX * 0.7) % W) + W) % W;
        const y = SS.SURF + ((((p.y + t * p.v - SS.SURF) % (H - SS.SURF)) + (H - SS.SURF)) % (H - SS.SURF));
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + p.p);
        ctx.fillRect(Math.round(x + Math.sin(t + p.p) * 2), Math.round(y), p.s, p.s);
      }
      ctx.globalAlpha = 1;
    }
  }
  SS.World = World;
})(window.SS);
