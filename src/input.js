// Input: floating virtual joystick + fire buttons (touch/mouse), and keyboard.
(function (SS) {
  const I = (SS.Input = { ax: 0, ay: 0, fwd: false, up: false, pausePressed: false });
  const keys = {};
  let joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const RADIUS = 52;

  function keyAxis() {
    const x = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    const y = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    return [x, y];
  }
  const btn = { fwd: new Set(), up: new Set() };

  I.update = function () {
    const [kx, ky] = keyAxis();
    let ax = kx, ay = ky;
    if (joy.id !== null) {
      let dx = joy.x - joy.ox, dy = joy.y - joy.oy;
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
      const dead = 6;
      ax = Math.abs(dx) < dead ? 0 : dx / RADIUS;
      ay = Math.abs(dy) < dead ? 0 : dy / RADIUS;
    } else if (kx && ky) { ax *= 0.7071; ay *= 0.7071; }
    I.ax = ax; I.ay = ay;
    I.fwd = btn.fwd.size > 0 || !!(keys.Space || keys.KeyJ || keys.KeyZ);
    I.up = btn.up.size > 0 || !!(keys.KeyK || keys.KeyX || keys.ShiftLeft || keys.ShiftRight);
  };
  I.reset = function () {
    for (const k in keys) keys[k] = false;
    btn.fwd.clear(); btn.up.clear();
    joy.id = null;
    showJoy(false);
  };

  let base, knob, zone;
  function showJoy(on) {
    if (!base) return;
    base.style.display = knob.style.display = on ? 'block' : 'none';
  }
  function placeJoy() {
    let dx = joy.x - joy.ox, dy = joy.y - joy.oy;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
    base.style.transform = `translate(${joy.ox}px, ${joy.oy}px) translate(-50%, -50%)`;
    knob.style.transform = `translate(${joy.ox + dx}px, ${joy.oy + dy}px) translate(-50%, -50%)`;
  }

  I.init = function () {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!keys[e.code] && (e.code === 'Escape' || e.code === 'KeyP')) I.pausePressed = true;
      keys[e.code] = true;
      SS.Audio.unlock();
    });
    window.addEventListener('keyup', (e) => (keys[e.code] = false));
    window.addEventListener('blur', I.reset);

    zone = document.getElementById('joy-zone');
    base = document.getElementById('joy-base');
    knob = document.getElementById('joy-knob');
    zone.addEventListener('pointerdown', (e) => {
      if (joy.id !== null) return;
      e.preventDefault();
      SS.Audio.unlock();
      joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      zone.setPointerCapture(e.pointerId);
      showJoy(true);
      placeJoy();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joy.id) return;
      joy.x = e.clientX; joy.y = e.clientY;
      placeJoy();
    });
    const end = (e) => {
      if (e.pointerId !== joy.id) return;
      joy.id = null;
      showJoy(false);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    for (const [id, set] of [['btn-fwd', btn.fwd], ['btn-up', btn.up]]) {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        SS.Audio.unlock();
        set.add(e.pointerId);
        el.setPointerCapture(e.pointerId);
        el.classList.add('down');
      });
      const up = (e) => { set.delete(e.pointerId); if (!set.size) el.classList.remove('down'); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    }
    document.getElementById('btn-pause').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      I.pausePressed = true;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  };
})(window.SS);
