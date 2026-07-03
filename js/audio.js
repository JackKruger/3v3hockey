// ---------------------------------------------------------------------------
// audio.js - bundled sound effects, synthesized fallbacks, and crowd ambience
// ---------------------------------------------------------------------------
window.H = window.H || {};

H.audio = (function () {
  const ASSETS = {
    big: 'assets/big man powerup.mp4',
    buzzer: 'assets/buzzer.mp4',
    menu: 'assets/wort menu sound.mp4',
    puck: 'assets/hitpuck sound effect.mp4',
    skate: 'assets/skate sound effect.mp4',
    speed: 'assets/superspeed powerup.mp4',
    tinyGoalie: 'assets/smallgolie.mp4',
    voice: 'assets/whatareyoutalkingabooot.mp4',
  };

  const CLIP_SETTINGS = {
    big: { volume: 0.9, pool: 2 },
    buzzer: { volume: 0.85, pool: 1 },
    menu: { volume: 0.48, pool: 3 },
    puck: { volume: 0.55, pool: 5 },
    speed: { volume: 0.85, pool: 2 },
    tinyGoalie: { volume: 0.9, pool: 2 },
    voice: { volume: 0.78, pool: 2 },
  };

  let ctx = null;
  let master = null;
  let crowdGain = null;
  let crowdBase = 0.05;
  let muted = false;
  let assetsReady = false;
  let mp4Supported = false;
  let clips = {};
  let skateLoop = null;
  let skateSupported = false;
  let clipHighpass = null;
  let clipLowpass = null;
  let skateDuckUntil = 0;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function makeAudio(src, loop) {
    const a = new Audio(src);
    a.preload = 'auto';
    a.loop = !!loop;
    a.playsInline = true;
    return a;
  }

  function setElementVolume(a, volume) {
    a.muted = muted;
    a.volume = muted ? 0 : clamp(volume, 0, 1);
  }

  function initAssets() {
    if (assetsReady || typeof Audio === 'undefined') return;
    const probe = document.createElement('audio');
    mp4Supported = !!(probe.canPlayType && (
      probe.canPlayType('video/mp4') || probe.canPlayType('audio/mp4')
    ));

    for (const key in CLIP_SETTINGS) {
      const cfg = CLIP_SETTINGS[key];
      clips[key] = { i: 0, pool: [], volume: cfg.volume, supported: mp4Supported };
      if (!mp4Supported) continue;
      for (let i = 0; i < cfg.pool; i++) {
        const a = makeAudio(ASSETS[key], false);
        setElementVolume(a, cfg.volume);
        clips[key].pool.push(a);
      }
    }

    skateSupported = mp4Supported;
    if (skateSupported) {
      skateLoop = makeAudio(ASSETS.skate, true);
      setElementVolume(skateLoop, 0);
    }
    assetsReady = true;
  }

  function loadAssets() {
    initAssets();
    for (const key in clips) {
      for (const a of clips[key].pool) {
        try { a.load(); } catch (e) {}
      }
    }
    if (skateLoop) {
      try { skateLoop.load(); } catch (e) {}
    }
  }

  function ensureClipCleanup() {
    if (!ensure()) return false;
    if (clipHighpass) return true;

    clipHighpass = ctx.createBiquadFilter();
    clipHighpass.type = 'highpass';
    clipHighpass.frequency.value = 120;
    clipHighpass.Q.value = 0.7;

    clipLowpass = ctx.createBiquadFilter();
    clipLowpass.type = 'lowpass';
    clipLowpass.frequency.value = 7200;
    clipLowpass.Q.value = 0.5;

    clipHighpass.connect(clipLowpass).connect(master);
    return true;
  }

  function routeClip(a) {
    if (a._hockeyAudioSource) return true;
    // On file:// pages, media routed through createMediaElementSource is
    // CORS-muted to silence; play elements directly instead.
    if (window.location.protocol === 'file:') return false;
    if (!ensureClipCleanup() || ctx.state !== 'running') return false;
    try {
      a._hockeyAudioSource = ctx.createMediaElementSource(a);
      a._hockeyAudioSource.connect(clipHighpass);
      return true;
    } catch (e) {
      return false;
    }
  }

  function stopClipPool(key) {
    const clip = clips[key];
    if (!clip) return;
    for (const a of clip.pool) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch (e) {}
    }
  }

  function duckSkating(ms) {
    const now = window.performance && window.performance.now ? window.performance.now() : Date.now();
    skateDuckUntil = Math.max(skateDuckUntil, now + ms);
  }

  function playAsset(key, volume, rate, opts) {
    opts = opts || {};
    initAssets();
    const clip = clips[key];
    if (muted || !clip || !clip.supported || !clip.pool.length) return false;
    if (opts.priority) {
      stopClipPool(key);
      if (opts.duckMs) duckSkating(opts.duckMs);
    }
    const a = clip.pool[clip.i++ % clip.pool.length];
    routeClip(a);
    try {
      a.pause();
      a.currentTime = 0;
    } catch (e) {}
    a.playbackRate = rate || 1;
    setElementVolume(a, volume == null ? clip.volume : volume);
    const p = a.play();
    if (p && p.catch) {
      p.catch(() => {
        if (!opts.retryDelay || opts._retried) return;
        window.setTimeout(() => {
          playAsset(key, volume, rate, { ...opts, _retried: true, priority: false });
        }, opts.retryDelay);
      });
    }
    return true;
  }

  function stopSkating() {
    if (!skateLoop) return;
    try {
      skateLoop.pause();
      skateLoop.currentTime = 0;
    } catch (e) {}
  }

  function setSkating(active, intensity) {
    initAssets();
    if (!skateLoop || !skateSupported) return;
    routeClip(skateLoop);
    const amt = clamp(intensity || 0, 0, 1);
    if (muted || !active || amt <= 0.02) {
      stopSkating();
      return;
    }
    const now = window.performance && window.performance.now ? window.performance.now() : Date.now();
    const duck = now < skateDuckUntil ? 0.25 : 1;
    setElementVolume(skateLoop, (0.18 + amt * 0.42) * duck);
    skateLoop.playbackRate = 0.86 + amt * 0.34;
    if (skateLoop.paused) {
      const p = skateLoop.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  function syncMuted() {
    for (const key in clips) {
      for (const a of clips[key].pool) a.muted = muted;
    }
    if (skateLoop) skateLoop.muted = muted;
    if (muted) stopSkating();
  }

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

  function synthPowerup() {
    if (!ensure()) return;
    tone('square', 660, 0.12, 0.01, 0.09);
    tone('square', 880, 0.12, 0.01, 0.09, 0, 0.08);
    tone('square', 1320, 0.14, 0.01, 0.18, 0, 0.16);
  }

  return {
    unlock() {
      ensure();
      loadAssets();
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.9;
      syncMuted();
    },
    isMuted() { return muted; },
    setSkating,

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
      if (playAsset('puck', 0.28, 1.15)) return;
      if (!ensure()) return;
      noiseHit(0.10, 0.07, 1800, 2);
    },
    shot() {
      if (playAsset('puck', 0.72, 0.95)) return;
      if (!ensure()) return;
      noiseHit(0.22, 0.14, 900, 1.2);
      tone('sawtooth', 220, 0.06, 0.01, 0.10, 90);
    },
    save() {
      if (playAsset('puck', 0.62, 0.85)) return;
      if (!ensure()) return;
      noiseHit(0.20, 0.12, 500, 1.5);
    },
    post() {
      playAsset('puck', 0.38, 1.35);
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
    powerup(type) {
      if (type === 'tinyGoalie') {
        if (playAsset('tinyGoalie', 1, 0.78, { priority: true, duckMs: 1300, retryDelay: 120 })) {
          window.setTimeout(() => {
            playAsset('tinyGoalie', 0.82, 0.86, { priority: true, duckMs: 900, retryDelay: 120 });
          }, 850);
        }
        synthPowerup();
        return;
      }

      const clip = {
        big: ['big', 1, 0.96],
        freeze: ['voice', 0.9, 1],
        speed: ['speed', 1, 0.82],
      }[type];
      if (clip) playAsset(clip[0], clip[1], clip[2], { priority: true, duckMs: 1100, retryDelay: 120 });
      synthPowerup();
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
      if (playAsset('buzzer')) return;
      if (!ensure()) return;
      tone('square', 150, 0.30, 0.02, 1.2);
      tone('square', 152, 0.25, 0.02, 1.2);
    },
    menuMove() {
      if (playAsset('menu', 0.38, 0.95)) return;
      if (!ensure()) return;
      tone('square', 500, 0.07, 0.005, 0.06);
    },
    menuSelect() {
      if (playAsset('menu', 0.52, 1.04)) return;
      if (!ensure()) return;
      tone('square', 700, 0.10, 0.005, 0.05);
      tone('square', 1050, 0.10, 0.005, 0.12, 0, 0.06);
    },
  };
})();
