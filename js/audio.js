// ---------------------------------------------------------------------------
// audio.js — synthesized sound effects + crowd ambience (no assets needed)
// ---------------------------------------------------------------------------
window.H = window.H || {};

H.audio = (function () {
  let ctx = null;
  let master = null;
  let crowdGain = null;
  let crowdBase = 0.05;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
      startCrowd();
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function startCrowd() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2.0);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 750;
    bp.Q.value = 0.5;
    crowdGain = ctx.createGain();
    crowdGain.gain.value = crowdBase;
    src.connect(bp).connect(crowdGain).connect(master);
    src.start();
    // slow random murmur
    setInterval(() => {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.setTargetAtTime(crowdBase * (0.8 + Math.random() * 0.5), t, 1.2);
    }, 2500);
  }

  function env(gainNode, t, peak, attack, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function tone(type, freq, peak, attack, decay, slideTo, when) {
    if (!ctx) return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + attack + decay);
    const g = ctx.createGain();
    env(g, t, peak, attack, decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  function noiseHit(peak, decay, freq, q) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(decay + 0.1);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    env(g, t, peak, 0.005, decay);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  return {
    unlock() { ensure(); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.9;
    },
    isMuted() { return muted; },

    whistle() {
      if (!ensure()) return;
      tone('square', 2350, 0.14, 0.01, 0.30);
      tone('square', 2410, 0.10, 0.01, 0.30);
    },
    countBeep(final) {
      if (!ensure()) return;
      tone('square', final ? 880 : 440, 0.12, 0.01, final ? 0.35 : 0.12);
    },
    pass() {
      if (!ensure()) return;
      noiseHit(0.10, 0.07, 1800, 2);
    },
    shot() {
      if (!ensure()) return;
      noiseHit(0.22, 0.14, 900, 1.2);
      tone('sawtooth', 220, 0.06, 0.01, 0.10, 90);
    },
    save() {
      if (!ensure()) return;
      noiseHit(0.20, 0.12, 500, 1.5);
    },
    post() {
      if (!ensure()) return;
      tone('triangle', 1250, 0.25, 0.005, 0.5, 1180);
      tone('triangle', 2500, 0.10, 0.005, 0.3);
    },
    hit(big) {
      if (!ensure()) return;
      noiseHit(big ? 0.5 : 0.32, big ? 0.28 : 0.18, 220, 0.8);
      tone('sine', 90, big ? 0.5 : 0.3, 0.008, 0.22, 45);
    },
    boardThud() {
      if (!ensure()) return;
      noiseHit(0.10, 0.08, 300, 0.9);
    },
    powerup() {
      if (!ensure()) return;
      tone('square', 660, 0.12, 0.01, 0.09);
      tone('square', 880, 0.12, 0.01, 0.09, 0, 0.08);
      tone('square', 1320, 0.14, 0.01, 0.18, 0, 0.16);
    },
    freeze() {
      if (!ensure()) return;
      tone('sine', 1500, 0.15, 0.02, 0.6, 300);
    },
    goalHorn() {
      if (!ensure()) return;
      [196, 247, 294].forEach((f) => {
        tone('sawtooth', f, 0.20, 0.03, 1.7);
        tone('sawtooth', f * 1.006, 0.20, 0.03, 1.7);
      });
      this.cheer(1.8);
    },
    cheer(dur) {
      if (!ensure()) return;
      const t = ctx.currentTime;
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
      crowdGain.gain.linearRampToValueAtTime(0.45, t + 0.15);
      crowdGain.gain.setTargetAtTime(crowdBase, t + (dur || 1.2), 0.8);
    },
    ooh() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
      crowdGain.gain.linearRampToValueAtTime(0.22, t + 0.1);
      crowdGain.gain.setTargetAtTime(crowdBase, t + 0.5, 0.6);
    },
    buzzer() {
      if (!ensure()) return;
      tone('square', 150, 0.30, 0.02, 1.2);
      tone('square', 152, 0.25, 0.02, 1.2);
    },
    menuMove() {
      if (!ensure()) return;
      tone('square', 500, 0.07, 0.005, 0.06);
    },
    menuSelect() {
      if (!ensure()) return;
      tone('square', 700, 0.10, 0.005, 0.05);
      tone('square', 1050, 0.10, 0.005, 0.12, 0, 0.06);
    },
  };
})();
