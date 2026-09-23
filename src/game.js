// Sub Sinkers - game loop, camera, player, enemies, weapons, bosses and HUD.
(function (SS) {
  const { W, H, clamp, rnd, lerp } = SS;
  const I = SS.Input;
  const A = SS.Audio;

  const G = (SS.Game = {
    state: 'title', t: 0, camX: 0, shake: 0, score: 0, lives: 3,
    enemies: [], pShots: [], eShots: [], fx: [], pickups: [],
  });
  const store = {
    get(k, d) { try { const v = localStorage.getItem('subsinkers.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('subsinkers.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  G.unlocked = store.get('unlocked', 1);
  G.best = store.get('best', 0);

  let cv, ctx, C;
  const surf = () => SS.SURF;
  const overlap = (a, b) => Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh;
  const onScreen = (e, m = 0) => e.x > G.camX - m && e.x < G.camX + W + m;

  function draw(s, x, y, flipped, white) {
    const dx = Math.round(x - G.camX - s.w / 2), dy = Math.round(y - s.h / 2);
    ctx.drawImage(flipped ? s.f : s.c, dx, dy);
    if (white) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(flipped ? s.fwh : s.wh, dx, dy);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- effects
  function anim(frames, x, y, fps = 22, vx = 0, vy = 0) {
    G.fx.push({ k: 'anim', frames, x, y, t: 0, fps, vx, vy });
  }
  function particle(x, y, vx, vy, life, c, s = 1, g = 0) {
    G.fx.push({ k: 'p', x, y, vx, vy, life, max: life, c, s, g });
  }
  function bubble(x, y, r = 1) {
    if (y < surf() + 2) return;
    G.fx.push({ k: 'bub', x, y, vx: rnd(-6, 6), vy: rnd(-30, -14), r: clamp(r, 0, 2), life: rnd(0.5, 1.4) });
  }
  function splash(x, big) {
    anim(big ? C.geyL : C.geyS, x, surf() - (big ? 28 : 15), 18);
    for (let i = 0; i < (big ? 14 : 6); i++) particle(x + rnd(-6, 6), surf(), rnd(-40, 40), rnd(-120, -40), rnd(0.4, 0.9), '#e8fcff', Math.random() < 0.3 ? 2 : 1, 260);
    A.play('splash');
  }
  function sparks(x, y, n, col) {
    for (let i = 0; i < n; i++) particle(x, y, rnd(-90, 90), rnd(-90, 60), rnd(0.2, 0.5), col || SS.pick(['#fff4c0', '#ffc840', '#f88a18']), 1, 120);
  }
  // Explosion that picks air / underwater frames, adds geysers near the surface and optional area damage.
  function boom(x, y, size = 'M', dmgR = 0, dmg = 2) {
    const water = y > surf() + 2;
    const set = { S: water ? C.wexS : C.exS, M: water ? C.wexM : C.exM, L: water ? C.wexL : C.exL }[size];
    anim(set, x, y, size === 'L' ? 20 : 24, 0, water ? -8 : -4);
    if (water) for (let i = 0; i < (size === 'S' ? 4 : 12); i++) bubble(x + rnd(-10, 10), y + rnd(-8, 8), (Math.random() * 3) | 0);
    if (Math.abs(y - surf()) < (size === 'L' ? 40 : 24)) splash(x, size !== 'S');
    for (let i = 0; i < (size === 'S' ? 3 : 8); i++) particle(x, y, rnd(-80, 80), rnd(-110, 30), rnd(0.3, 0.8), SS.pick(['#3a3a46', '#62626e', '#d44a08']), 2, water ? 60 : 200);
    G.shake = Math.max(G.shake, size === 'L' ? 5 : size === 'M' ? 2.5 : 1);
    A.play(size === 'L' ? 'bigboom' : size === 'S' ? 'hit' : 'boom');
    if (dmgR && G.player.alive && Math.hypot(G.player.x - x, G.player.y - y) < dmgR + 8) hurt(dmg);
  }

  // ---------------------------------------------------------------- player
  function newPlayer() {
    return { x: G.camX + 60, y: surf() + 40, vx: 0, vy: 0, hw: 14, hh: 5, hp: 6, maxHp: 6, inv: 2, power: 1, cdF: 0, cdU: 0, alive: true, trail: 0, surfaced: false };
  }
  function hurt(dmg) {
    const p = G.player;
    if (!p.alive || p.inv > 0 || G.state !== 'play') return;
    p.hp -= dmg;
    p.inv = 1.4;
    G.shake = Math.max(G.shake, 4);
    sparks(p.x, p.y, 10);
    A.play('hurt');
    if (p.hp <= 0) {
      p.alive = false;
      boom(p.x, p.y, 'L');
      for (let i = 0; i < 6; i++) setTimeout(() => G.state === 'play' && boom(p.x + rnd(-16, 16), p.y + rnd(-8, 8), 'M'), i * 120);
      G.lives--;
      G.respawn = 2.2;
    }
  }

  function updatePlayer(dt) {
    const p = G.player, w = G.world;
    if (!p.alive) {
      G.respawn -= dt;
      if (G.respawn <= 0) {
        if (G.lives <= 0) return gameOver();
        const keep = p.power;
        G.player = newPlayer();
        G.player.power = Math.max(1, keep - 1);
        G.player.x = G.camX + 50;
        G.eShots.length = 0;
      }
      return;
    }
    const sp = 96;
    p.vx += (I.ax * sp - p.vx) * Math.min(1, dt * 9);
    p.vy += (I.ay * sp * 0.85 - p.vy) * Math.min(1, dt * 9);
    let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    // push the screen forward once past the first third; the screen never scrolls back
    const push = G.camX + W * 0.33;
    if (!G.locked && nx > push) G.camX = Math.min(G.L.len, G.camX + (nx - push));
    const maxX = G.locked ? G.camX + W * 0.62 : G.camX + W * 0.33;
    nx = clamp(nx, G.camX + 16, maxX);
    const minY = G.L.ice ? Math.max(w.ceil(nx - 12), w.ceil(nx), w.ceil(nx + 14)) + 8 : surf() - 3;
    const maxY = Math.min(w.ground(nx - 12), w.ground(nx), w.ground(nx + 14)) - 8;
    ny = clamp(ny, minY, Math.max(minY, maxY));
    const wasUnder = p.y > surf() + 3;
    p.x = nx; p.y = ny;
    p.surfaced = !G.L.ice && p.y <= surf() + 1;
    if (wasUnder && p.surfaced) splash(p.x, false);
    if (!p.surfaced && p.y > surf() + 3 && Math.random() < 0.02 + Math.abs(p.vx) * 0.002) bubble(p.x + (p.vx >= 0 ? -18 : 18), p.y, 0);
    if (p.surfaced && Math.abs(p.vx) > 20 && Math.random() < 0.5) particle(p.x - 16, surf(), rnd(-30, -10), rnd(-40, -10), 0.4, '#e8fcff', 1, 200);
    if (p.inv > 0) p.inv -= dt;

    // weapons: forward torpedoes and upward missiles
    p.cdF -= dt; p.cdU -= dt;
    if (I.fwd && p.cdF <= 0) {
      p.cdF = 0.24;
      const spread = p.power >= 3 ? [-1, 0, 1] : p.power === 2 ? [-0.5, 0.5] : [0];
      spread.forEach((o) => G.pShots.push({ k: 'torp', x: p.x + 16, y: Math.max(p.y + 3 + o * 5, surf() + 5), vx: 70 + Math.max(0, p.vx) * 0.5, vy: o * 18, hw: 7, hh: 2.5, dmg: 1, tr: 0 }));
      A.play('torp');
    }
    if (I.up && p.cdU <= 0) {
      p.cdU = 0.5;
      const xs = p.power >= 2 ? [-5, 7] : [2];
      xs.forEach((o) => G.pShots.push({ k: 'mis', x: p.x + o, y: p.y - 8, vx: p.vx * 0.3, vy: -30, hw: 3, hh: 7, dmg: 1.5, tr: 0 }));
      A.play('missile');
    }
  }

  // ---------------------------------------------------------------- enemies
  const SPEC = {
    sub: { hp: 3, hw: 17, hh: 5, score: 150, boom: 'M' },
    drone: { hp: 2, hw: 9, hh: 5, score: 120, boom: 'S' },
    mine: { hp: 1, hw: 6, hh: 6, score: 50, boom: 'M' },
    boat: { hp: 7, hw: 28, hh: 10, score: 400, boom: 'L', drop: 0.4 },
    heli: { hp: 3, hw: 20, hh: 7, score: 300, boom: 'M', drop: 0.2 },
    jet: { hp: 2, hw: 18, hh: 5, score: 350, boom: 'M' },
    turret: { hp: 4, hw: 11, hh: 7, score: 200, boom: 'M', drop: 0.15 },
    crab: { hp: 5, hw: 15, hh: 8, score: 250, boom: 'M', drop: 0.35 },
    jelly: { hp: 2, hw: 8, hh: 8, score: 100, boom: 'S' },
    icicle: { hp: 1, hw: 4, hh: 12, score: 60, boom: 'S' },
    dread: { hp: 100, hw: 56, hh: 13, score: 5000, boom: 'L' },
    ship: { hp: 100, hw: 66, hh: 20, score: 5000, boom: 'L' },
  };

  function spawnEnemy(s) {
    const sp = SPEC[s.t];
    const e = Object.assign({ hp: sp.hp, maxHp: sp.hp, hw: sp.hw, hh: sp.hh, flash: 0, tt: Math.random() * 6, cd: rnd(1, 2.5), dir: -1, home: s.x, homeY: s.y }, s);
    const w = G.world;
    if (e.t === 'boat') e.y = surf() - 4;
    if (e.t === 'turret') e.y = w.ground(e.x) - 5;
    if (e.t === 'crab') e.y = w.ground(e.x) - 11;
    if (e.t === 'icicle') { e.y = w.ceil(e.x) + 12; e.v = (Math.random() * 3) | 0; }
    if (e.t === 'jet') { e.x = G.camX + W + 40; e.vx = -rnd(110, 140); e.bombed = false; }
    if (e.t === 'heli') e.x = Math.max(e.x, G.camX + W + 20);
    G.enemies.push(e);
    return e;
  }

  function eShot(k, x, y, vx, vy) {
    const s = { k, x, y, vx, vy, hw: 3, hh: 3, t: 0, hp: 1 };
    if (k === 'etorp') { s.hw = 6; s.hh = 2; }
    if (k === 'charge') { s.hw = 4; s.hh = 5; s.fuse = rnd(1.6, 3.2); }
    if (k === 'bomb') { s.hw = 3; s.hh = 5; }
    G.eShots.push(s);
    if (k === 'orb' || k === 'orbC') A.play('eshot');
    return s;
  }
  function aimed(k, x, y, speed, spread = 0) {
    const p = G.player;
    const a = Math.atan2(p.y - y, p.x - x) + spread;
    return eShot(k, x, y, Math.cos(a) * speed, Math.sin(a) * speed);
  }
  const orbKind = () => (G.L.theme.glow === SS.P.CGLOW ? 'orbC' : 'orb');

  const UPDATE = {
    sub(e, dt) {
      e.x += e.dir * (e.speed || (e.speed = rnd(18, 32))) * dt;
      if (e.x < e.home - 60) e.dir = 1;
      if (e.x > e.home + 40) e.dir = -1;
      e.face = e.dir;
      e.y = e.homeY + Math.sin(e.tt * 0.8) * 3;
      if ((e.cd -= dt) <= 0 && onScreen(e, -10) && Math.abs(G.player.x - e.x) < 280) {
        const d = Math.sign(G.player.x - e.x) || -1;
        e.face = d;
        eShot('etorp', e.x + d * 20, e.y + 2, d * 50, 0);
        e.cd = rnd(2.2, 3.6);
      }
    },
    drone(e, dt) {
      e.x -= 12 * dt;
      e.y = e.homeY + Math.sin(e.tt * 1.6) * 26;
      e.face = G.player.x > e.x ? 1 : -1;
      if ((e.cd -= dt) <= 0 && onScreen(e, -10)) { aimed(orbKind(), e.x, e.y, 70); e.cd = rnd(2.4, 3.4); }
    },
    mine(e) {
      e.y = e.homeY + Math.sin(e.tt * 1.2) * 2;
    },
    boat(e, dt) {
      e.x += e.dir * 16 * dt;
      if (e.x < e.home - 60) e.dir = 1;
      if (e.x > e.home + 40) e.dir = -1;
      e.y = surf() - 4 + Math.sin(e.tt * 2) * 1;
      if ((e.cd -= dt) <= 0 && onScreen(e, -20) && Math.abs(G.player.x - e.x) < 150) {
        eShot('charge', e.x - e.dir * 22, e.y, -e.dir * 20, -50);
        e.cd = rnd(2.2, 3);
      }
    },
    heli(e, dt) {
      e.x += e.dir * 45 * dt;
      if (e.x < G.camX + 40) e.dir = 1;
      if (e.x > G.camX + W - 30 && e.dir > 0) e.dir = -1;
      e.face = e.dir;
      e.y = e.homeY + Math.sin(e.tt * 2.2) * 3;
      if ((e.cd -= dt) <= 0 && onScreen(e, -10) && Math.abs(G.player.x - e.x) < 70) {
        eShot('bomb', e.x, e.y + 8, e.dir * 30, 20);
        e.cd = rnd(1.4, 2.2);
      }
    },
    jet(e, dt) {
      e.x += e.vx * dt;
      e.face = -1;
      if (!e.bombed && e.x - G.player.x < 50) { e.bombed = true; eShot('bomb', e.x, e.y + 6, e.vx * 0.4, 30); }
      if (e.x < G.camX - 60) e.dead = true;
    },
    turret(e, dt) {
      const p = G.player;
      e.ang = clamp(Math.atan2(p.y - (e.y - 3), p.x - e.x), -Math.PI + 0.15, -0.15);
      if ((e.cd -= dt) <= 0 && onScreen(e, -10) && Math.abs(p.x - e.x) < 220) {
        const k = orbKind();
        eShot(k, e.x + Math.cos(e.ang) * 12, e.y - 3 + Math.sin(e.ang) * 12, Math.cos(e.ang) * 85, Math.sin(e.ang) * 85);
        e.cd = rnd(1.8, 2.6);
      }
    },
    crab(e, dt) {
      e.x += e.dir * 14 * dt;
      if (e.x < e.home - 40) e.dir = 1;
      if (e.x > e.home + 40) e.dir = -1;
      e.y = G.world.ground(e.x) - 11;
      if ((e.cd -= dt) <= 0 && onScreen(e, -10)) {
        for (const a of [-2.1, -1.57, -1.05]) eShot(orbKind(), e.x, e.y - 8, Math.cos(a) * 60, Math.sin(a) * 60);
        e.cd = rnd(2.6, 3.4);
      }
    },
    jelly(e, dt) {
      e.y = e.homeY + Math.sin(e.tt * 1.8) * 16;
      e.x += (G.player.x < e.x ? -8 : 4) * dt;
    },
    icicle(e, dt) {
      const p = G.player;
      if (!e.falling && Math.abs(p.x - e.x) < 34 && p.y > e.y) { e.falling = true; e.vy = 0; }
      if (e.falling) {
        e.vy += 260 * dt;
        e.y += e.vy * dt;
        if (e.y + 12 > G.world.ground(e.x)) {
          for (let i = 0; i < 10; i++) particle(e.x, e.y + 10, rnd(-60, 60), rnd(-90, -20), rnd(0.3, 0.6), '#c8f4ff', 1, 250);
          A.play('hit');
          e.dead = true;
        }
      }
    },
    dread: bossDread,
    ship: bossShip,
  };

  // Submarine dreadnought boss: bobs up and down, torpedo fans, turret barrages, launches drones.
  function bossDread(e, dt) {
    if (bossCommon(e, dt)) return;
    const w = G.world;
    const top = (G.L.ice ? w.ceil(e.x) + 10 : surf() + 8) + e.hh, bot = w.ground(e.x) - e.hh - 10;
    e.y = lerp(top, bot, 0.5 + 0.5 * Math.sin(e.tt * 0.55));
    e.face = -1;
    e.turrets = [[16, -10], [-20, -10]];
    if ((e.cd -= dt) <= 0) {
      const rage = e.hp < e.maxHp * 0.5;
      const pat = e.pat = ((e.pat || 0) + 1) % 3;
      if (pat === 0) for (let i = -2; i <= 2; i++) eShot('etorp', e.x - 66, e.y + 4, -45, i * 22);
      if (pat === 1) for (const [ox, oy] of e.turrets) for (let i = -1; i <= 1; i++) aimed(orbKind(), e.x + ox, e.y + oy, 80, i * 0.18);
      if (pat === 2) {
        spawnEnemy({ t: 'drone', x: e.x - 20, y: e.y + 16 });
        if (rage) spawnEnemy({ t: 'mine', x: e.x - 40, y: e.y + 10 });
      }
      e.cd = rage ? 1.4 : 2.1;
    }
  }
  // Surface battleship boss: deck guns lob shells, stern rolls depth charges, bow fires torpedoes.
  function bossShip(e, dt) {
    if (bossCommon(e, dt)) return;
    e.y = surf() - 16 + Math.sin(e.tt * 1.5) * 1.2;
    e.hy = surf() - 10;
    e.x = e.targetX + Math.sin(e.tt * 0.35) * 30;
    e.face = -1;
    e.turrets = [[-30, -16], [8, -26], [40, -16]];
    const p = G.player;
    if ((e.cd -= dt) <= 0) {
      const rage = e.hp < e.maxHp * 0.5;
      const pat = e.pat = ((e.pat || 0) + 1) % 4;
      if (pat === 0 || pat === 2) for (const [ox, oy] of e.turrets) {
        const dx = p.x - (e.x + ox);
        eShot('bomb', e.x + ox, e.y + oy, dx * rnd(0.45, 0.7), -rnd(110, 150));
      }
      if (pat === 1) for (let i = 0; i < (rage ? 5 : 3); i++) eShot('charge', e.x - 40 + i * 20, surf() + 2, -rnd(10, 40), 10);
      if (pat === 3) {
        for (let i = 0; i < 3; i++) eShot('etorp', e.x - 70, surf() + 14 + i * 16, -40, 0);
        if (G.L.air) spawnEnemy({ t: 'jet', x: 0, y: rnd(14, surf() - 40) });
      }
      e.cd = rage ? 1.3 : 2;
    }
  }
  function bossCommon(e, dt) {
    if (e.entering) {
      e.x -= 40 * dt;
      if (e.x <= e.targetX) e.entering = false;
      if (e.t === 'ship') e.y = surf() - 16;
      return true;
    }
    if (e.dying != null) {
      e.dying -= dt;
      e.boomT = (e.boomT || 0) - dt;
      if (e.boomT <= 0) {
        e.boomT = 0.12;
        boom(e.x + rnd(-e.hw, e.hw), (e.hy || e.y) + rnd(-e.hh, e.hh), SS.pick(['S', 'M', 'M']));
      }
      if (e.t === 'ship') e.y += 6 * dt;
      else e.y += 10 * dt;
      if (e.dying <= 0) {
        e.dead = true;
        for (let i = 0; i < 4; i++) boom(e.x + rnd(-40, 40), (e.hy || e.y) + rnd(-10, 10), 'L');
        G.clearT = 2.5;
        A.play('clear');
      }
      return true;
    }
    return false;
  }

  function killEnemy(e) {
    const sp = SPEC[e.t];
    G.score += sp.score;
    if (e.t === 'dread' || e.t === 'ship') {
      e.dying = 2.8;
      e.hp = 0;
      G.eShots.length = 0;
      return;
    }
    e.dead = true;
    boom(e.x, e.y, sp.boom, e.t === 'mine' ? 22 : 0);
    const chance = sp.drop || 0.1;
    if (Math.random() < chance) {
      const p = G.player;
      const kind = p.hp < p.maxHp * 0.6 && Math.random() < 0.6 ? 'repair' : p.power < 3 ? 'power' : 'repair';
      G.pickups.push({ k: kind, x: e.x, y: clamp(e.y, surf() + 10, H - 30), hw: 6, hh: 6, t: 0 });
    }
  }

  function damageEnemy(e, dmg, x, y) {
    if (e.dying != null || e.entering) return;
    e.hp -= dmg;
    e.flash = 0.08;
    sparks(x, y, 3);
    A.play('hit');
    if (e.hp <= 0) killEnemy(e);
  }

  function updateEnemies(dt) {
    const p = G.player;
    for (const e of G.enemies) {
      e.tt += dt;
      if (e.flash > 0) e.flash -= dt;
      UPDATE[e.t](e, dt);
      if (!e.dead && e.x < G.camX - 90 && e.t !== 'jet') e.dead = true;
      // contact with the player
      if (!e.dead && e.dying == null && p.alive && overlap(eBox(e), p)) {
        if (e.t === 'mine') { killEnemy(e); hurt(2); }
        else if (e.t === 'icicle') { e.dead = true; sparks(e.x, e.y, 8, '#c8f4ff'); hurt(2); }
        else if (e.t !== 'boat' && e.t !== 'heli' && e.t !== 'jet') { hurt(e.t === 'jelly' ? 1 : 2); if (e.t !== 'dread' && e.t !== 'ship') damageEnemy(e, 2, e.x, e.y); }
      }
    }
    G.enemies = G.enemies.filter((e) => !e.dead);
  }
  // the battleship's hitbox sits around its hull at the waterline
  function eBox(e) {
    return e.hy != null ? { x: e.x, y: e.hy, hw: e.hw, hh: e.hh } : e;
  }

  // ---------------------------------------------------------------- shots
  function updateShots(dt) {
    const w = G.world;
    for (const s of G.pShots) {
      s.tr -= dt;
      if (s.k === 'torp') {
        s.vx = Math.min(s.vx + 520 * dt, 290);
        s.vy *= 1 - dt * 3;
        s.x += s.vx * dt;
        s.y = Math.max(s.y + s.vy * dt, surf() + 5);
        if (s.tr <= 0) { s.tr = 0.08; bubble(s.x - 8, s.y, 0); }
        if (s.x > G.camX + W + 20) s.dead = true;
        if (s.y > w.ground(s.x) - 1 || (G.L.ice && s.y < w.ceil(s.x) + 1)) { s.dead = true; boom(s.x, s.y, 'S'); }
      } else {
        s.vy = Math.max(s.vy - 520 * dt, -270);
        const wasUnder = s.y > surf();
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (wasUnder && s.y <= surf() && !G.L.ice) splash(s.x, false);
        if (s.tr <= 0) {
          s.tr = 0.03;
          if (s.y > surf()) { if (Math.random() < 0.5) bubble(s.x, s.y + 8, 0); }
          else particle(s.x + rnd(-1, 1), s.y + 8, rnd(-6, 6), rnd(5, 15), rnd(0.3, 0.6), SS.pick(['#c8c8d0', '#9494a0', '#ffc840']), 2, -10);
        }
        if (s.y < -20) s.dead = true;
        if (G.L.ice && s.y < w.ceil(s.x)) { s.dead = true; boom(s.x, s.y, 'S'); }
      }
      if (s.dead) continue;
      for (const e of G.enemies) {
        if (e.dead || e.dying != null || e.entering) continue;
        if (overlap(s, eBox(e))) { damageEnemy(e, s.dmg, s.x, s.y); s.dead = true; if (s.k === 'torp') boom(s.x + 4, s.y, 'S'); break; }
      }
      if (s.dead) continue;
      // player weapons can shoot down depth charges, bombs and torpedoes
      for (const q of G.eShots) {
        if (!q.dead && (q.k === 'charge' || q.k === 'bomb' || q.k === 'etorp') && overlap(s, q)) {
          q.dead = true; s.dead = true; G.score += 20;
          boom(q.x, q.y, q.k === 'etorp' ? 'S' : 'M', q.k === 'etorp' ? 0 : 18, 1);
          break;
        }
      }
    }
    G.pShots = G.pShots.filter((s) => !s.dead);

    const p = G.player;
    for (const s of G.eShots) {
      s.t += dt;
      if (s.k === 'etorp') {
        s.vx = Math.sign(s.vx) * Math.min(Math.abs(s.vx) + 90 * dt, 130);
        s.y += clamp(p.y - s.y, -1, 1) * 12 * dt + s.vy * dt;
        s.vy *= 1 - dt * 1.5;
        s.x += s.vx * dt;
        s.y = Math.max(s.y, surf() + 5);
        if (Math.random() < 0.12) bubble(s.x - Math.sign(s.vx) * 7, s.y, 0);
        if (s.y > w.ground(s.x)) { s.dead = true; boom(s.x, s.y, 'S'); }
      } else if (s.k === 'charge' || s.k === 'bomb') {
        const inWater = s.y > surf();
        if (!inWater) { s.vy += 240 * dt; }
        else {
          if (!s.wet) { s.wet = true; splash(s.x, false); s.vx *= 0.3; }
          s.vy += ((s.k === 'charge' ? 26 : 55) - s.vy) * Math.min(1, dt * 3);
          s.vx *= 1 - dt * 2;
          s.x += Math.sin(s.t * 5) * 6 * dt;
          if (s.k === 'charge') s.fuse -= dt;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const near = p.alive && Math.hypot(p.x - s.x, p.y - s.y) < 16;
        if ((s.k === 'charge' && (s.fuse <= 0 || near)) || s.y > w.ground(s.x) - 3 || (s.k === 'bomb' && near)) {
          s.dead = true;
          boom(s.x, s.y, 'M', 20, 2);
          continue;
        }
      } else {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      if (s.x < G.camX - 30 || s.x > G.camX + W + 40 || s.y < -30 || s.y > H + 10) s.dead = true;
      if (!s.dead && p.alive && overlap(s, p)) {
        s.dead = true;
        if (s.k === 'charge' || s.k === 'bomb') boom(s.x, s.y, 'M', 20, 2);
        else { boom(s.x, s.y, 'S'); hurt(1); }
      }
    }
    G.eShots = G.eShots.filter((s) => !s.dead);

    for (const q of G.pickups) {
      q.t += dt;
      q.y += Math.sin(q.t * 3) * 6 * dt;
      q.x -= 6 * dt;
      if (p.alive && overlap(q, p)) {
        q.dead = true;
        if (q.k === 'repair') p.hp = Math.min(p.maxHp, p.hp + 2);
        else if (p.power < 3) p.power++;
        else G.score += 500;
        G.score += 100;
        A.play('pickup');
        for (let i = 0; i < 8; i++) particle(q.x, q.y, rnd(-50, 50), rnd(-50, 50), 0.4, q.k === 'repair' ? '#b0ffb0' : '#ffc060', 1, 0);
      }
      if (q.x < G.camX - 20 || q.t > 14) q.dead = true;
    }
    G.pickups = G.pickups.filter((q) => !q.dead);
  }

  function updateFx(dt) {
    for (const f of G.fx) {
      if (f.k === 'anim') {
        f.t += dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.t * f.fps >= f.frames.length) f.dead = true;
      } else if (f.k === 'p') {
        f.life -= dt;
        f.vy += f.g * dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.life <= 0) f.dead = true;
      } else {
        f.life -= dt;
        f.x += (f.vx + Math.sin(f.life * 8) * 8) * dt;
        f.y += f.vy * dt;
        if (f.y < surf() + 2 || f.life <= 0 || (G.L.ice && f.y < G.world.ceil(f.x) + 2)) f.dead = true;
      }
    }
    G.fx = G.fx.filter((f) => !f.dead);
    if (G.fx.length > 500) G.fx.splice(0, G.fx.length - 500);
  }

  // ---------------------------------------------------------------- level flow
  function genSpawns(L, w) {
    const r = SS.rng(L.seed * 97 + 1);
    const types = Object.keys(L.mix).filter((t) => L.air || !['boat', 'heli', 'jet'].includes(t));
    const total = types.reduce((a, t) => a + L.mix[t], 0);
    const list = [];
    let x = W + 30;
    const S = surf();
    while (x < L.len - 40) {
      let k = r() * total, t = types[0];
      for (const tt of types) { if ((k -= L.mix[tt]) < 0) { t = tt; break; } }
      const top = L.ice ? w.ceil(x) + 16 : S + 22;
      const bot = w.ground(x) - 22;
      const mid = () => lerp(top, bot, 0.1 + r() * 0.8);
      if (t === 'minefield') {
        const n = 3 + ((r() * 2) | 0);
        for (let i = 0; i < n; i++) list.push({ t: 'mine', x: x + i * 26, y: lerp(top + 8, bot, (i % 2 ? 0.25 : 0.7) + r() * 0.1) });
        x += n * 26;
      } else if (t === 'heli') list.push({ t, x, y: 12 + r() * (S - 50) });
      else if (t === 'jet') list.push({ t, x, y: 10 + r() * (S - 44) });
      else if (t === 'boat' || t === 'turret' || t === 'crab' || t === 'icicle') list.push({ t, x, y: 0 });
      else list.push({ t, x, y: mid() });
      x += lerp(L.gap[0], L.gap[1], r());
    }
    return list;
  }

  G.startLevel = function (i, keepScore) {
    G.levelIdx = i;
    G.L = SS.LEVELS[i];
    G.world = new SS.World(G.L, i);
    G.S = G.world.T;
    G.camX = 0;
    G.enemies = []; G.pShots = []; G.eShots = []; G.fx = []; G.pickups = [];
    if (!keepScore) { G.score = 0; G.lives = 3; }
    G.levelScore = G.score;
    G.player = newPlayer();
    G.spawns = genSpawns(G.L, G.world);
    G.spawnIdx = 0;
    G.locked = false;
    G.boss = null;
    G.clearT = null;
    G.banner = 3;
    G.warn = 0;
    G.t = 0;
    I.reset();
    TouchZoomGuard.enterFullscreen('landscape');
    setState('play');
    A.play('sonar');
  };

  function updateLevel(dt) {
    while (G.spawnIdx < G.spawns.length && G.spawns[G.spawnIdx].x < G.camX + W + 30) spawnEnemy(G.spawns[G.spawnIdx++]);
    if (!G.locked && G.camX >= G.L.len) {
      G.locked = true;
      G.warn = 2.5;
      A.play('warn');
      const t = G.L.boss;
      const e = spawnEnemy({ t, x: G.camX + W + 90, y: t === 'ship' ? surf() - 16 : (surf() + G.world.ground(G.camX + W)) / 2 });
      e.hp = e.maxHp = G.L.bossHp;
      e.entering = true;
      e.targetX = G.camX + W - (t === 'ship' ? 90 : 76);
      e.cd = 1.5;
      if (t === 'ship') e.hy = surf() - 10;
      G.boss = e;
    }
    if (G.clearT != null) {
      G.clearT -= dt;
      if (G.clearT <= 0) levelClear();
    }
  }

  function levelClear() {
    G.clearT = null;
    const next = G.levelIdx + 1;
    G.unlocked = Math.max(G.unlocked, Math.min(SS.LEVELS.length, next + 1));
    store.set('unlocked', G.unlocked);
    saveBest();
    setState(next >= SS.LEVELS.length ? 'win' : 'clear');
  }
  function gameOver() {
    saveBest();
    setState('over');
  }
  function saveBest() {
    if (G.score > G.best) { G.best = G.score; store.set('best', G.best); }
  }

  // ---------------------------------------------------------------- UI / states
  const $ = (id) => document.getElementById(id);
  function setState(s) {
    G.state = s;
    for (const id of ['title', 'pause', 'over', 'clear', 'win']) $(id).classList.toggle('hidden', id !== s);
    document.body.classList.toggle('playing', s === 'play');
    if (s === 'title') buildLevelSelect();
    if (s === 'clear') {
      $('clear-stats').textContent = `${G.L.name} CLEARED - SCORE ${G.score}`;
      $('clear-next').textContent = `DIVE TO ${SS.LEVELS[G.levelIdx + 1].name}`;
    }
    if (s === 'over') $('over-stats').textContent = `SCORE ${G.score}   BEST ${G.best}`;
    if (s === 'win') $('win-stats').textContent = `FINAL SCORE ${G.score}   BEST ${G.best}`;
  }
  function buildLevelSelect() {
    const box = $('levels');
    box.innerHTML = '';
    SS.LEVELS.forEach((L, i) => {
      const b = document.createElement('button');
      b.className = 'lvl';
      const locked = i >= G.unlocked;
      b.disabled = locked;
      b.innerHTML = `<span class="n">${i + 1}</span><span class="nm">${L.name}</span><span class="d">${locked ? 'LOCKED' : L.zone + ' · ' + L.maxDepth + 'M'}</span>`;
      b.style.setProperty('--c1', L.water[0]);
      b.style.setProperty('--c2', L.water[2]);
      b.onclick = () => { A.unlock(); G.startLevel(i); };
      box.appendChild(b);
    });
    $('best').textContent = G.best ? 'BEST ' + G.best : '';
  }

  // ---------------------------------------------------------------- render
  function render() {
    const w = G.world;
    const sh = G.shake > 0.3 ? G.shake : 0;
    ctx.save();
    if (sh) ctx.translate(Math.round(rnd(-sh, sh)), Math.round(rnd(-sh, sh)));
    w.drawBack(ctx, G.camX, G.t);
    w.drawDeco(ctx, G.camX, G.t);
    if (G.state !== 'title') {
      drawEnemies();
      drawPlayer();
      drawShots();
    }
    w.drawFront(ctx, G.camX, G.t);
    drawFx();
    ctx.restore();
    if (G.state !== 'title') drawHud();
  }

  function drawEnemies() {
    const S = G.S, fr = Math.floor(G.t * 8) % 2;
    for (const e of G.enemies) {
      const wh = e.flash > 0;
      const fl = (e.face || -1) < 0;
      switch (e.t) {
        case 'sub': draw(S.esub[fr], e.x, e.y, fl, wh); break;
        case 'drone': draw(S.drone[fr], e.x, e.y, fl, wh); break;
        case 'mine': {
          const g = G.world.ground(e.x);
          ctx.fillStyle = '#20202a';
          for (let y = e.y + 7; y < g; y += 3) ctx.fillRect(Math.round(e.x - G.camX + Math.sin(y * 0.3 + e.tt) * 0.8), Math.round(y), 1, 2);
          draw(S.mine[Math.floor(e.tt * 2) % 2], e.x, e.y, false, wh);
          break;
        }
        case 'boat': draw(S.boat, e.x, e.y - 4, e.dir < 0, wh); break;
        case 'heli': draw(S.heli[Math.floor(G.t * 20) % 2], e.x, e.y, fl, wh); break;
        case 'jet': draw(S.jet[fr], e.x, e.y, true, wh); break;
        case 'turret': {
          const b = C.barrel;
          ctx.save();
          ctx.translate(Math.round(e.x - G.camX), Math.round(e.y - 3));
          ctx.rotate(e.ang || -Math.PI / 2);
          ctx.drawImage(b.c, -2, -b.h / 2);
          ctx.restore();
          draw(S.tbase, e.x, e.y + 1, false, wh);
          break;
        }
        case 'crab': draw(S.crab[Math.floor(e.tt * 5) % 2], e.x, e.y, false, wh); break;
        case 'jelly': draw(S.jelly[Math.floor(e.tt * 5) % 4], e.x, e.y, false, wh); break;
        case 'icicle': draw(C.icicles[e.v], e.x, e.y, false, wh); break;
        case 'dread':
        case 'ship': {
          const spr = e.t === 'ship' ? S.ship : S.boss[fr];
          draw(spr, e.x, e.y, true, wh || (e.dying != null && Math.floor(G.t * 20) % 3 === 0));
          const p = G.player;
          for (const [ox, oy] of e.turrets || []) {
            const tx = e.x + ox, ty = e.y + oy;
            const a = clamp(Math.atan2(p.y - ty, p.x - tx), -Math.PI, 0);
            ctx.save();
            ctx.translate(Math.round(tx - G.camX), Math.round(ty));
            ctx.rotate(a);
            ctx.drawImage(C.barrel.c, -2, -C.barrel.h / 2);
            ctx.restore();
          }
          break;
        }
      }
    }
  }

  function drawPlayer() {
    const p = G.player;
    if (!p.alive) return;
    if (p.inv > 0 && Math.floor(G.t * 20) % 2 === 0) return;
    const bob = p.surfaced ? Math.round(Math.sin(G.t * 3) * 1) : 0;
    const fr = Math.abs(p.vx) > 5 || Math.abs(p.vy) > 5 ? Math.floor(G.t * 14) % 2 : Math.floor(G.t * 4) % 2;
    draw(C.player[fr], p.x, p.y + bob, false, p.inv > 1.2);
  }

  function drawShots() {
    for (const s of G.pShots) {
      if (s.k === 'torp') {
        draw(C.torp, s.x, s.y);
        ctx.fillStyle = Math.floor(G.t * 30) % 2 ? '#ffc840' : '#fff4c0';
        ctx.fillRect(Math.round(s.x - G.camX - 11), Math.round(s.y - 1), 3, 2);
      } else draw(C.missile, s.x, s.y);
    }
    for (const s of G.eShots) {
      if (s.k === 'etorp') draw(C.etorp, s.x, s.y, s.vx < 0);
      else if (s.k === 'charge') draw(C.charge, s.x, s.y);
      else if (s.k === 'bomb') draw(C.bomb, s.x, s.y);
      else draw(C[s.k] || C.orb, s.x, s.y);
    }
    for (const q of G.pickups) {
      if (q.t > 11 && Math.floor(G.t * 10) % 2) continue;
      draw(C[q.k], q.x, q.y);
    }
  }

  function drawFx() {
    for (const f of G.fx) {
      if (f.k === 'anim') {
        const fr = f.frames[Math.min(f.frames.length - 1, Math.floor(f.t * f.fps))];
        ctx.drawImage(fr.c, Math.round(f.x - G.camX - fr.w / 2), Math.round(f.y - fr.h / 2));
      } else if (f.k === 'p') {
        ctx.globalAlpha = clamp(f.life / f.max * 1.5, 0, 1);
        ctx.fillStyle = f.c;
        ctx.fillRect(Math.round(f.x - G.camX), Math.round(f.y), f.s, f.s);
        ctx.globalAlpha = 1;
      } else if (f.r === 0) {
        ctx.fillStyle = 'rgba(220,248,255,0.7)';
        ctx.fillRect(Math.round(f.x - G.camX), Math.round(f.y), 1, 1);
      } else {
        const b = C.bubbles[f.r];
        ctx.drawImage(b.c, Math.round(f.x - G.camX - b.w / 2), Math.round(f.y - b.h / 2));
      }
    }
  }

  function drawHud() {
    const p = G.player, L = G.L;
    // bottom bar: score, lives, hull, power (arcade style)
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, H - 11, W, 11);
    SS.text(ctx, '1P ' + String(G.score).padStart(8, '0'), 4, H - 8, '#ffffff', 1, '#000');
    for (let i = 0; i < Math.max(0, G.lives - (p.alive ? 1 : 0)); i++) ctx.drawImage(C.player[0].c, 0, 0, 42, 22, 60 + i * 15, H - 10, 14, 7);
    SS.text(ctx, 'HULL', 112, H - 8, '#9fe8ff', 1, '#000');
    for (let i = 0; i < p.maxHp; i++) {
      ctx.fillStyle = '#000';
      ctx.fillRect(130 + i * 7, H - 9, 6, 6);
      ctx.fillStyle = i < p.hp ? (p.hp <= 2 ? (Math.floor(G.t * 6) % 2 ? '#ff3040' : '#a01020') : '#50d060') : '#2a2a34';
      ctx.fillRect(131 + i * 7, H - 8, 4, 4);
    }
    SS.text(ctx, 'PWR', 180, H - 8, '#ffc060', 1, '#000');
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < p.power ? '#ffc040' : '#2a2a34';
      ctx.fillRect(194 + i * 5, H - 8, 4, 4);
    }
    // depth readout: deeper levels and deeper positions read deeper
    const prog = clamp(G.camX / L.len, 0, 1);
    const frac = clamp((p.y - surf()) / (L.groundBase - surf()), 0, 1);
    const depth = Math.round(L.maxDepth * (0.25 + 0.75 * prog) * frac);
    const dtxt = 'DEPTH ' + depth + 'M';
    SS.text(ctx, dtxt, W - 4 - SS.textWidth(dtxt), H - 8, '#9fe8ff', 1, '#000');
    // progress along the level
    const bx = 222, bw = 90;
    ctx.fillStyle = '#000'; ctx.fillRect(bx, H - 7, bw + 2, 3);
    ctx.fillStyle = '#3a90b0'; ctx.fillRect(bx + 1, H - 6, Math.round(bw * prog), 1);
    ctx.fillStyle = '#ffd040'; ctx.fillRect(bx + Math.round(bw * prog), H - 8, 2, 5);
    ctx.fillStyle = '#ff3040'; ctx.fillRect(bx + bw, H - 8, 2, 5);

    // boss bar
    const b = G.boss;
    if (b && !b.dead && !b.entering) {
      const bw2 = 160, x0 = (W - bw2) / 2;
      SS.text(ctx, b.t === 'ship' ? 'BATTLESHIP' : 'DREADNOUGHT', x0, 4, '#ff9090', 1, '#000');
      ctx.fillStyle = '#000'; ctx.fillRect(x0, 11, bw2, 5);
      ctx.fillStyle = '#ff3040'; ctx.fillRect(x0 + 1, 12, Math.round((bw2 - 2) * clamp(b.hp / b.maxHp, 0, 1)), 3);
    }
    // banners
    if (G.banner > 0) {
      const a = clamp(G.banner, 0, 1);
      ctx.globalAlpha = a;
      const t1 = 'STAGE ' + (G.levelIdx + 1), t2 = L.name, t3 = L.zone + ' - ' + L.maxDepth + 'M';
      SS.text(ctx, t1, (W - SS.textWidth(t1, 2)) / 2, 60, '#ffd040', 2, '#000');
      SS.text(ctx, t2, (W - SS.textWidth(t2, 2)) / 2, 76, '#ffffff', 2, '#000');
      SS.text(ctx, t3, (W - SS.textWidth(t3)) / 2, 92, '#9fe8ff', 1, '#000');
      ctx.globalAlpha = 1;
    }
    if (G.warn > 0 && Math.floor(G.t * 4) % 2) {
      const t = 'WARNING!';
      SS.text(ctx, t, (W - SS.textWidth(t, 3)) / 2, 70, '#ff3040', 3, '#000');
    }
    if (G.clearT != null) {
      const t = 'STAGE CLEAR';
      SS.text(ctx, t, (W - SS.textWidth(t, 2)) / 2, 80, '#ffd040', 2, '#000');
    }
  }

  // ---------------------------------------------------------------- loop
  function step(dt) {
    G.t += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 12);
    if (G.state === 'title') {
      G.camX += dt * 24;
      return;
    }
    if (G.state !== 'play') return;
    if (G.banner > 0) G.banner -= dt;
    if (G.warn > 0) G.warn -= dt;
    updatePlayer(dt);
    if (G.state !== 'play') return;
    updateLevel(dt);
    updateEnemies(dt);
    updateShots(dt);
    updateFx(dt);
  }

  let last = 0, acc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    I.update();
    if (I.pausePressed) {
      I.pausePressed = false;
      if (G.state === 'play') { setState('pause'); I.reset(); }
      else if (G.state === 'pause') setState('play');
    }
    acc += dt;
    const STEP = 1 / 60;
    while (acc >= STEP) { step(STEP); acc -= STEP; }
    render();
    requestAnimationFrame(frame);
  }

  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    cv.style.width = Math.floor(W * s) + 'px';
    cv.style.height = Math.floor(H * s) + 'px';
  }

  G.init = function () {
    // Stop mobile/tablet browsers zooming on rapid taps; if a zoom still slips
    // through, pause until the player pinches back out.
    TouchZoomGuard.init({
      allowSelector: '[data-touch-allow]',
      onZoomChange: (zoomed) => { if (zoomed && G.state === 'play') { setState('pause'); I.reset(); } },
    });
    cv = document.getElementById('game');
    cv.width = W;
    cv.height = H;
    ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    C = SS.commonSprites();
    I.init();
    window.addEventListener('resize', resize);
    resize();
    G.world = new SS.World(SS.LEVELS[0], 0);
    G.L = SS.LEVELS[0];
    G.S = G.world.T;
    const bind = (id, fn) => $(id).addEventListener('click', () => { A.unlock(); fn(); });
    bind('resume', () => setState('play'));
    bind('restart', () => G.startLevel(G.levelIdx));
    bind('quit', toTitle);
    bind('retry', () => G.startLevel(G.levelIdx));
    bind('over-menu', toTitle);
    bind('clear-next', () => G.startLevel(G.levelIdx + 1, true));
    bind('clear-menu', toTitle);
    bind('win-menu', toTitle);
    bind('mute', () => { A.muted = !A.muted; $('mute').textContent = A.muted ? 'SOUND: OFF' : 'SOUND: ON'; });
    setState('title');
    requestAnimationFrame(frame);
  };
  function toTitle() {
    const i = Math.min(G.levelIdx || 0, SS.LEVELS.length - 1);
    G.world = new SS.World(SS.LEVELS[i], i);
    G.L = SS.LEVELS[i];
    G.S = G.world.T;
    G.fx = [];
    setState('title');
  }
})(window.SS);
