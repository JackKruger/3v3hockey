// ---------------------------------------------------------------------------
// main.js — entry point, game loop, top-level state machine
// ---------------------------------------------------------------------------
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  let match = null;
  let lastCfg = null;
  let lastTs = 0;

  // unlock audio on first click/tap too
  window.addEventListener('pointerdown', () => H.audio.unlock());

  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;

    H.input.update();

    if (match) {
      match.update(dt);
      H.render.renderMatch(ctx, match);
      if (match.finished === 'rematch') {
        match = new H.Match(lastCfg);
      } else if (match.finished === 'quit') {
        match = null;
        H.menu.reset('lobby');
      }
    } else {
      H.menu.update(dt);
      H.menu.render(ctx);
      const cfg = H.menu.takeStart();
      if (cfg) {
        lastCfg = cfg;
        match = new H.Match(cfg);
      }
    }

    H.currentMatch = match; // handy for debugging / testing
    requestAnimationFrame(frame);
  }

  // debug/testing hook
  H.startMatch = (cfg) => {
    lastCfg = cfg;
    match = new H.Match(cfg);
    return match;
  };

  // global mute toggle (only outside active play so it can't clash with P2's M key)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && (!match || match.paused || match.state === 'gameOver')) {
      H.audio.setMuted(!H.audio.isMuted());
    }
  });

  requestAnimationFrame(frame);
})();
