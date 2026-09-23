// Tiny WebAudio synth for sound effects (no audio files).
(function (SS) {
  const A = (SS.Audio = { ctx: null, muted: false, last: {} });
  let noiseBuf = null;

  A.unlock = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    A.master = A.ctx.createGain();
    A.master.gain.value = 0.5;
    A.master.connect(A.ctx.destination);
    noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate, A.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(type, f0, f1, dur, vol, delay = 0) {
    const c = A.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.005, vol, dur);
    o.connect(g).connect(A.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(f0, f1, dur, vol, type = 'lowpass', q = 1) {
    const c = A.ctx, t = c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf;
    s.loop = true;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.01, vol, dur);
    s.connect(f).connect(g).connect(A.master);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  const SFX = {
    torp: () => { tone('square', 520, 180, 0.09, 0.06); noise(2000, 400, 0.12, 0.05, 'bandpass', 2); },
    missile: () => noise(400, 3000, 0.3, 0.09, 'bandpass', 3),
    eshot: () => tone('triangle', 900, 300, 0.08, 0.05),
    hit: () => tone('square', 180, 90, 0.06, 0.05),
    boom: () => { noise(1200, 60, 0.6, 0.35); tone('sine', 90, 30, 0.5, 0.25); },
    bigboom: () => { noise(900, 40, 1.4, 0.5); tone('sine', 70, 20, 1.2, 0.4); },
    splash: () => noise(3000, 600, 0.35, 0.12, 'highpass'),
    hurt: () => { tone('sawtooth', 240, 50, 0.35, 0.12); noise(800, 100, 0.3, 0.15); },
    pickup: () => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.08, 0.08, i * 0.06)),
    warn: () => [0, 0.3, 0.6].forEach((d) => { tone('square', 880, 880, 0.12, 0.05, d); tone('square', 660, 660, 0.12, 0.05, d + 0.15); }),
    sonar: () => tone('sine', 1320, 1300, 0.9, 0.05),
    clear: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.14, 0.05, i * 0.1)),
  };
  A.play = function (name) {
    if (!A.ctx || A.muted || !SFX[name]) return;
    const now = A.ctx.currentTime;
    if (A.last[name] && now - A.last[name] < 0.04) return;
    A.last[name] = now;
    SFX[name]();
  };
})(window.SS);
