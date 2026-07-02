// ---------------------------------------------------------------------------
// input.js — keyboard (2 layouts) + up to 4 gamepads, with edge detection
// Devices: 'kb1', 'kb2', 'pad0'..'pad3'
// Buttons: shoot, pass, check, deke, switch, start
// ---------------------------------------------------------------------------
window.H = window.H || {};

H.input = (function () {
  const keys = {};
  const tapped = new Set(); // keydowns since last frame, so quick taps are never lost
  const BTNS = ['shoot', 'pass', 'check', 'deke', 'switch', 'start'];
  const DIRS = ['left', 'right', 'up', 'down'];

  const KB = {
    kb1: {
      left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
      pass: 'KeyF', shoot: 'KeyG', check: 'KeyH', deke: 'ShiftLeft',
      switch: 'KeyR', start: 'Enter',
    },
    kb2: {
      left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
      pass: 'Comma', shoot: 'Period', check: 'Slash', deke: 'ShiftRight',
      switch: 'KeyM', start: 'Enter',
    },
  };

  // Standard gamepad mapping: A=0 B=1 X=2 Y=3 LB=4 RB=5 Start=9
  const PAD_BTN = { shoot: 0, check: 1, pass: 2, switch: 3, deke: 5, start: 9 };
  const DEADZONE = 0.28;

  const state = {}; // device -> {x,y,held,pressed,released}
  const prev = {};  // device -> {held:{}, dirs:{}}

  function blank() {
    const held = {}, pressed = {}, released = {};
    BTNS.forEach((b) => { held[b] = false; pressed[b] = false; released[b] = false; });
    DIRS.forEach((d) => { pressed[d] = false; });
    return { x: 0, y: 0, held, pressed, released };
  }

  function readKb(dev) {
    const m = KB[dev];
    const s = blank();
    let x = 0, y = 0;
    if (keys[m.left]) x -= 1;
    if (keys[m.right]) x += 1;
    if (keys[m.up]) y -= 1;
    if (keys[m.down]) y += 1;
    if (x && y) { x *= 0.7071; y *= 0.7071; }
    s.x = x; s.y = y;
    BTNS.forEach((b) => { s.held[b] = !!keys[m[b]]; });
    s.tap = {};
    BTNS.forEach((b) => { s.tap[b] = tapped.has(m[b]); });
    s.dirHeld = { left: !!keys[m.left], right: !!keys[m.right], up: !!keys[m.up], down: !!keys[m.down] };
    s.dirTap = { left: tapped.has(m.left), right: tapped.has(m.right), up: tapped.has(m.up), down: tapped.has(m.down) };
    return s;
  }

  function readPad(pad) {
    const s = blank();
    let x = pad.axes[0] || 0, y = pad.axes[1] || 0;
    // dpad fallback (standard mapping 12-15)
    if (pad.buttons[14] && pad.buttons[14].pressed) x = -1;
    if (pad.buttons[15] && pad.buttons[15].pressed) x = 1;
    if (pad.buttons[12] && pad.buttons[12].pressed) y = -1;
    if (pad.buttons[13] && pad.buttons[13].pressed) y = 1;
    const mag = Math.hypot(x, y);
    if (mag < DEADZONE) { x = 0; y = 0; }
    else if (mag > 1) { x /= mag; y /= mag; }
    s.x = x; s.y = y;
    for (const b of BTNS) {
      const idx = PAD_BTN[b];
      s.held[b] = !!(pad.buttons[idx] && pad.buttons[idx].pressed);
    }
    s.dirHeld = { left: x < -0.5, right: x > 0.5, up: y < -0.5, down: y > 0.5 };
    return s;
  }

  function edge(dev, s) {
    const p = prev[dev] || { held: {}, dirs: {} };
    BTNS.forEach((b) => {
      s.pressed[b] = (s.held[b] && !p.held[b]) || !!(s.tap && s.tap[b]);
      s.released[b] = !s.held[b] && !!p.held[b];
    });
    DIRS.forEach((d) => {
      s.pressed[d] = (s.dirHeld[d] && !p.dirs[d]) || !!(s.dirTap && s.dirTap[d]);
    });
    prev[dev] = { held: { ...s.held }, dirs: { ...s.dirHeld } };
    return s;
  }

  window.addEventListener('keydown', (e) => {
    if (!e.repeat) tapped.add(e.code);
    keys[e.code] = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    H.audio.unlock();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  return {
    update() {
      state.kb1 = edge('kb1', readKb('kb1'));
      state.kb2 = edge('kb2', readKb('kb2'));
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i = 0; i < 4; i++) {
        const dev = 'pad' + i;
        if (pads[i] && pads[i].connected) {
          state[dev] = edge(dev, readPad(pads[i]));
        } else {
          state[dev] = null;
          delete prev[dev];
        }
      }
      // global keys
      state.escPressed = (!!keys.Escape && !this._escPrev) || tapped.has('Escape');
      this._escPrev = !!keys.Escape;
      state.mPressed = !!keys.KeyM && !this._mPrev;
      this._mPrev = !!keys.KeyM;
      tapped.clear();
    },
    get(dev) { return state[dev] || blank(); },
    exists(dev) { return dev.startsWith('kb') || !!state[dev]; },
    allDevices() {
      const out = ['kb1', 'kb2'];
      for (let i = 0; i < 4; i++) if (state['pad' + i]) out.push('pad' + i);
      return out;
    },
    escPressed() { return state.escPressed; },
  };
})();
