// ---------------------------------------------------------------------------
// render3d.js — perspective "TV camera" renderer. Same match state, same
// canvas, zero dependencies: a fixed pinhole camera projects the 2D world
// (x = length, y = width, z = up) onto the screen, arcade-broadcast style.
// ---------------------------------------------------------------------------
window.H = window.H || {};

H.render3d = (function () {
  const FONT = '"Arial Black", "Impact", sans-serif';
  const BOARD_H = 42;   // world units
  const GLASS_H = 46;

  // camera: centered on x, above & behind the near (high-y) side.
  // Framing derives from rink size so the whole arena stays in shot.
  const CS = H.CFG.rink.h / 640;
  const CAM = { x: H.CFG.cx, y: H.CFG.cy + 1280 * CS, z: 1320 * CS };
  const TARGET = { x: H.CFG.cx, y: H.CFG.cy - 70 * CS, z: 0 };
  const FOCAL = 1540 * CS;
  const YSHIFT = 6 * CS;

  let back, upv;
  (function initCam() {
    const bx = 0, by = CAM.y - TARGET.y, bz = CAM.z - TARGET.z;
    const l = Math.hypot(by, bz);
    back = { y: by / l, z: bz / l };
    upv = { y: -back.z, z: back.y };
  })();

  function norm2(x, y) {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  }

  function project(x, y, z) {
    const vy = y - CAM.y, vz = z - CAM.z, vx = x - CAM.x;
    const depth = -(vy * back.y + vz * back.z);
    const s = FOCAL / depth;
    return {
      x: H.CFG.W / 2 + vx * s,
      y: H.CFG.H / 2 - (vy * upv.y + vz * upv.z) * s + YSHIFT,
      s,
      depth,
    };
  }

  // --- rink outline sampling --------------------------------------------------

  function rinkOutline(n) {
    const R = H.CFG.rink;
    const r = R.r;
    const pts = [];
    const corners = [
      { cx: R.x + R.w - r, cy: R.y + r, a0: -Math.PI / 2 },       // top-right
      { cx: R.x + R.w - r, cy: R.y + R.h - r, a0: 0 },            // bottom-right
      { cx: R.x + r, cy: R.y + R.h - r, a0: Math.PI / 2 },        // bottom-left
      { cx: R.x + r, cy: R.y + r, a0: Math.PI },                  // top-left
    ];
    const m = Math.max(3, Math.floor(n / 4));
    for (const c of corners) {
      for (let i = 0; i <= m; i++) {
        const a = c.a0 + (Math.PI / 2) * (i / m);
        pts.push({ x: c.cx + Math.cos(a) * r, y: c.cy + Math.sin(a) * r });
      }
    }
    return pts;
  }

  // vertical extent of the ice at a given x (for goal lines near the corners)
  function iceSpanAtX(x) {
    const R = H.CFG.rink;
    const r = R.r;
    let y0 = R.y, y1 = R.y + R.h;
    const dxl = (R.x + r) - x, dxr = x - (R.x + R.w - r);
    const dx = Math.max(dxl, dxr);
    if (dx > 0) {
      const dy = Math.sqrt(Math.max(0, r * r - dx * dx));
      y0 = R.y + r - dy;
      y1 = R.y + R.h - r + dy;
    }
    return [y0, y1];
  }

  // --- static background --------------------------------------------------------

  let bg = null;
  let fgGlass = null; // near glass, drawn over entities

  function pathFromPts(g, pts, z) {
    g.beginPath();
    pts.forEach((p, i) => {
      const q = project(p.x, p.y, z || 0);
      if (i === 0) g.moveTo(q.x, q.y);
      else g.lineTo(q.x, q.y);
    });
    g.closePath();
  }

  function line3(g, x0, y0, z0, x1, y1, z1, color, width) {
    const a = project(x0, y0, z0), b = project(x1, y1, z1);
    g.strokeStyle = color;
    g.lineWidth = width * (a.s + b.s) / 2;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }

  function circle3(g, cx, cy, r, color, width, fill) {
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const q = project(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0);
      if (i === 0) g.moveTo(q.x, q.y);
      else g.lineTo(q.x, q.y);
    }
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (color) {
      g.strokeStyle = color;
      g.lineWidth = width * project(cx, cy, 0).s;
      g.stroke();
    }
  }

  function makeBackground() {
    const cfg = H.CFG;
    const R = cfg.rink;
    bg = document.createElement('canvas');
    bg.width = cfg.W;
    bg.height = cfg.H;
    const g = bg.getContext('2d');

    // arena backdrop
    const grad = g.createLinearGradient(0, 0, 0, cfg.H);
    grad.addColorStop(0, '#0b1020');
    grad.addColorStop(0.55, '#141b33');
    grad.addColorStop(1, '#0a0e1a');
    g.fillStyle = grad;
    g.fillRect(0, 0, cfg.W, cfg.H);

    // arena bowl: dark rising stands behind the far & side boards
    const bowlPts = rinkOutline(90);
    const nearCut = cfg.cy + R.h / 2 + 30;
    for (let i = 0; i < bowlPts.length; i++) {
      const p0 = bowlPts[i], p1 = bowlPts[(i + 1) % bowlPts.length];
      if ((p0.y + p1.y) / 2 > nearCut) continue;
      const n0 = norm2(p0.x - cfg.cx, p0.y - cfg.cy);
      const n1 = norm2(p1.x - cfg.cx, p1.y - cfg.cy);
      const a = project(p0.x + n0.x * 34, p0.y + n0.y * 34, BOARD_H + 8);
      const b = project(p1.x + n1.x * 34, p1.y + n1.y * 34, BOARD_H + 8);
      const c = project(p1.x + n1.x * 620, p1.y + n1.y * 620, 470);
      const d = project(p0.x + n0.x * 620, p0.y + n0.y * 620, 470);
      g.fillStyle = '#1a2138';
      g.beginPath();
      g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y);
      g.closePath();
      g.fill();
    }

    // crowd: bleacher rings around far & side boards
    let seed = 987654;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let row = 0; row < 10; row++) {
      const off = 70 + row * 55;
      const zr = 60 + row * 40;
      const pts = rinkOutline(130);
      for (const p of pts) {
        // outward normal approx from rink center
        const nx = p.x - cfg.cx, ny = p.y - cfg.cy;
        const nl = Math.hypot(nx, ny);
        const wx = p.x + (nx / nl) * off;
        const wy = p.y + (ny / nl) * off;
        if (wy > nearCut) continue; // skip near side (camera side)
        if (rnd() < 0.18) continue;
        const q = project(wx, wy, zr + rnd() * 8);
        g.fillStyle = `hsl(${Math.floor(rnd() * 360)}, 30%, ${20 + rnd() * 30}%)`;
        g.beginPath();
        g.arc(q.x, q.y, 4.4 * q.s, 0, Math.PI * 2);
        g.fill();
      }
    }

    const outline = rinkOutline(120);

    // far/side board walls (opaque), painted before the ice
    drawBoardWalls(g, outline, false);

    // ice
    pathFromPts(g, outline, 0);
    const iceG = g.createLinearGradient(0, project(cfg.cx, R.y, 0).y, 0, project(cfg.cx, R.y + R.h, 0).y);
    iceG.addColorStop(0, '#dbe9f8');
    iceG.addColorStop(1, '#f6faff');
    g.fillStyle = iceG;
    g.fill();

    g.save();
    pathFromPts(g, outline, 0);
    g.clip();

    // center + blue lines
    line3(g, cfg.cx, R.y, 0, cfg.cx, R.y + R.h, 0, '#d33a3a', 8);
    for (const bx of [cfg.cx - 265, cfg.cx + 265]) {
      line3(g, bx, R.y, 0, bx, R.y + R.h, 0, '#3465c8', 8);
    }
    // goal lines (clipped to rounded corners)
    for (const gx of cfg.goalX) {
      const [y0, y1] = iceSpanAtX(gx);
      line3(g, gx, y0, 0, gx, y1, 0, '#d33a3a', 3);
    }
    // circles
    circle3(g, cfg.cx, cfg.cy, 90, '#3465c8', 4);
    circle3(g, cfg.cx, cfg.cy, 7, null, 0, '#3465c8');
    for (const gx of [cfg.goalX[0] + 150, cfg.goalX[1] - 150]) {
      for (const sy of [-1, 1]) {
        circle3(g, gx, cfg.cy + sy * 165, 62, '#d33a3a', 4);
        circle3(g, gx, cfg.cy + sy * 165, 6, null, 0, '#d33a3a');
      }
    }
    // creases
    for (let side = 0; side < 2; side++) {
      const gx = cfg.goalX[side];
      const dir = side === 0 ? 1 : -1;
      g.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = -Math.PI / 2 + (i / 24) * Math.PI;
        const q = project(gx + Math.cos(a) * cfg.creaseR * dir, cfg.cy + Math.sin(a) * cfg.creaseR, 0);
        if (i === 0) g.moveTo(q.x, q.y);
        else g.lineTo(q.x, q.y);
      }
      g.closePath();
      g.fillStyle = 'rgba(90, 160, 235, 0.35)';
      g.fill();
      g.strokeStyle = '#d33a3a';
      g.lineWidth = 2.5 * project(gx, cfg.cy, 0).s;
      g.stroke();
    }
    // faint center logo
    const c0 = project(cfg.cx, cfg.cy, 0);
    g.globalAlpha = 0.4;
    g.fillStyle = '#274b8f';
    g.textAlign = 'center';
    g.font = '900 ' + Math.round(30 * c0.s) + 'px ' + FONT;
    g.save();
    g.translate(c0.x, c0.y);
    g.scale(1, upv.y < 0 ? -upv.z : upv.z); // squash with the ice plane
    g.fillText('3v3', 0, 0);
    g.restore();
    g.globalAlpha = 1;
    g.restore();

    // near glass prerender (translucent overlay canvas)
    fgGlass = document.createElement('canvas');
    fgGlass.width = cfg.W;
    fgGlass.height = cfg.H;
    drawBoardWalls(fgGlass.getContext('2d'), outline, true);

    return bg;
  }

  function drawBoardWalls(g, outline, nearSide) {
    const cfg = H.CFG;
    const nearY = cfg.cy + 120; // segments below this are "near" (camera side)
    for (let i = 0; i < outline.length; i++) {
      const p0 = outline[i];
      const p1 = outline[(i + 1) % outline.length];
      const midY = (p0.y + p1.y) / 2;
      const isNear = midY > nearY;
      if (isNear !== nearSide) continue;
      const a = project(p0.x, p0.y, 0);
      const b = project(p1.x, p1.y, 0);
      const c = project(p1.x, p1.y, BOARD_H);
      const d = project(p0.x, p0.y, BOARD_H);
      const gc = project(p1.x, p1.y, BOARD_H + GLASS_H);
      const gd = project(p0.x, p0.y, BOARD_H + GLASS_H);

      if (nearSide) {
        // translucent boards + glass so the play stays visible
        g.fillStyle = 'rgba(223, 231, 245, 0.28)';
        g.beginPath();
        g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(190, 215, 255, 0.10)';
        g.beginPath();
        g.moveTo(d.x, d.y); g.lineTo(c.x, c.y); g.lineTo(gc.x, gc.y); g.lineTo(gd.x, gd.y);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(d.x, d.y); g.lineTo(c.x, c.y);
        g.stroke();
      } else {
        // opaque wall, shaded by orientation
        const shade = Math.min(1, Math.abs(p1.x - p0.x) / (Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1));
        const l = Math.round(82 + shade * 12);
        g.fillStyle = `hsl(220, 28%, ${l}%)`;
        g.beginPath();
        g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y);
        g.closePath();
        g.fill();
        // yellow kickplate
        const k0 = project(p0.x, p0.y, 7), k1 = project(p1.x, p1.y, 7);
        g.fillStyle = '#e8c53a';
        g.beginPath();
        g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(k1.x, k1.y); g.lineTo(k0.x, k0.y);
        g.closePath();
        g.fill();
        // glass
        g.fillStyle = 'rgba(170, 200, 240, 0.20)';
        g.beginPath();
        g.moveTo(d.x, d.y); g.lineTo(c.x, c.y); g.lineTo(gc.x, gc.y); g.lineTo(gd.x, gd.y);
        g.closePath();
        g.fill();
        g.strokeStyle = '#f2f6ff';
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(d.x, d.y); g.lineTo(c.x, c.y);
        g.stroke();
      }
    }
  }

  // --- entities ------------------------------------------------------------------

  function drawShadow(g, x, y, r, s) {
    g.fillStyle = 'rgba(30,50,90,0.28)';
    g.beginPath();
    g.ellipse(x, y, r * s, r * s * 0.42, 0, 0, Math.PI * 2);
    g.fill();
  }

  function drawSkater(g, match, sk) {
    const team = match.teams[sk.team];
    const r = sk.radius;
    const base = project(sk.pos.x, sk.pos.y, 0);
    const s = base.s;
    const f = sk.facing;

    drawShadow(g, base.x, base.y, r * 1.05, s);

    // effect auras on the ice
    if (sk.eff.shield > 0) auraRing(g, sk, r + 8, H.POWERUPS.shield.color);
    if (sk.eff.rocket > 0) auraRing(g, sk, r + 4, H.POWERUPS.rocket.color);
    if (sk.eff.speed > 0) auraRing(g, sk, r + 12, H.POWERUPS.speed.color);

    if (sk.down) {
      // sprawled on the ice
      g.save();
      g.translate(base.x, base.y);
      g.rotate(Math.sin(sk.fallT * 3) * 0.2);
      g.fillStyle = team.color;
      g.strokeStyle = team.dark;
      g.lineWidth = 2.5 * s;
      g.beginPath();
      g.ellipse(0, -4 * s, r * 1.25 * s, r * 0.62 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#f2c99a';
      g.beginPath();
      g.arc(r * 1.15 * s, -6 * s, r * 0.5 * s, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.fillStyle = '#ffd54a';
      g.font = '900 ' + Math.round(15 * s) + 'px ' + FONT;
      g.textAlign = 'center';
      for (let i = 0; i < 3; i++) {
        const a = sk.fallT * 5 + (i * Math.PI * 2) / 3;
        g.fillText('★', base.x + Math.cos(a) * r * 1.2 * s, base.y - (26 + Math.sin(a) * 6) * s);
      }
      return;
    }

    // stick on the ice toward facing
    const sp = sk.stickPoint();
    const spq = project(sp.x, sp.y, 0);
    const hand = project(sk.pos.x + f.x * r * 0.4 - f.y * r * 0.6, sk.pos.y + f.y * r * 0.4 + f.x * r * 0.6, 16);
    g.strokeStyle = '#8a5a2b';
    g.lineWidth = 3.5 * s;
    g.beginPath();
    g.moveTo(hand.x, hand.y);
    g.lineTo(spq.x, spq.y);
    g.stroke();
    g.strokeStyle = sk.eff.rocket > 0 ? '#ff4a4a' : '#3a2a18';
    g.lineWidth = 5 * s;
    g.beginPath();
    g.moveTo(spq.x - f.y * 8 * s, spq.y + f.x * 4 * s);
    g.lineTo(spq.x + f.y * 8 * s, spq.y - f.x * 4 * s);
    g.stroke();

    // legs hint
    const hip = project(sk.pos.x, sk.pos.y, 14);
    g.strokeStyle = team.dark;
    g.lineWidth = 5 * s;
    for (const side of [-1, 1]) {
      const foot = project(sk.pos.x - f.x * 6 + -f.y * side * 9, sk.pos.y - f.y * 6 + f.x * side * 9, 0);
      g.beginPath();
      g.moveTo(hip.x, hip.y);
      g.lineTo(foot.x, foot.y);
      g.stroke();
    }

    // torso: capsule from z=14 to z=40
    const t0 = project(sk.pos.x, sk.pos.y, 15);
    const t1 = project(sk.pos.x, sk.pos.y, 40);
    const bw = r * 0.95 * s;
    g.fillStyle = team.color;
    g.strokeStyle = team.dark;
    g.lineWidth = 2.5 * s;
    g.beginPath();
    g.moveTo(t0.x - bw, t0.y);
    g.lineTo(t1.x - bw, t1.y);
    g.arc(t1.x, t1.y, bw, Math.PI, 0);
    g.lineTo(t0.x + bw, t0.y);
    g.arc(t0.x, t0.y, bw, 0, Math.PI);
    g.closePath();
    g.fill();
    g.stroke();
    // jersey stripe
    const mid = project(sk.pos.x, sk.pos.y, 24);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 4 * s;
    g.beginPath();
    g.moveTo(mid.x - bw * 0.9, mid.y);
    g.lineTo(mid.x + bw * 0.9, mid.y);
    g.stroke();
    // number on chest
    g.fillStyle = '#fff';
    g.font = '900 ' + Math.round(r * 0.62 * s) + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(sk.spec.num), t1.x, (t0.y + t1.y) / 2);

    // big head
    const hq = project(sk.pos.x + f.x * 4, sk.pos.y + f.y * 4, 48 + r * 0.66);
    const hr = r * 0.68 * s;
    g.fillStyle = '#f2c99a';
    g.beginPath();
    g.arc(hq.x, hq.y, hr, 0, Math.PI * 2);
    g.fill();
    // helmet
    g.fillStyle = team.dark;
    g.beginPath();
    g.arc(hq.x, hq.y, hr, Math.PI * 0.98, Math.PI * 2.02);
    g.fill();
    // eyes lean toward facing
    g.fillStyle = '#222';
    g.beginPath();
    g.arc(hq.x + f.x * hr * 0.3 - f.y * hr * 0.32, hq.y + hr * 0.15, 2.6 * s, 0, Math.PI * 2);
    g.arc(hq.x + f.x * hr * 0.3 + f.y * hr * 0.32, hq.y + hr * 0.15, 2.6 * s, 0, Math.PI * 2);
    g.fill();

    // frozen: ice block
    if (sk.frozen) {
      const top = project(sk.pos.x, sk.pos.y, 66);
      g.fillStyle = 'rgba(160, 225, 255, 0.55)';
      g.strokeStyle = 'rgba(220, 245, 255, 0.9)';
      g.lineWidth = 2 * s;
      const w = r * 1.35 * s;
      g.beginPath();
      g.rect(base.x - w, top.y, w * 2, base.y - top.y);
      g.fill();
      g.stroke();
    }

    // controller marker above head
    if (sk.controlledBy != null) {
      const pl = match.players[sk.controlledBy];
      const m = project(sk.pos.x, sk.pos.y, 92);
      g.fillStyle = pl.color;
      g.beginPath();
      g.moveTo(m.x, m.y + 14 * s);
      g.lineTo(m.x - 9 * s, m.y);
      g.lineTo(m.x + 9 * s, m.y);
      g.closePath();
      g.fill();
      g.font = '900 ' + Math.round(13 * s) + 'px ' + FONT;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(pl.name, m.x, m.y - 4 * s);
    }

    // charge bar
    if (sk.charge > 0.02 && match.puck.owner === sk) {
      const m = project(sk.pos.x, sk.pos.y, 84);
      const w = 46 * s;
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(m.x - w / 2, m.y, w, 6 * s);
      g.fillStyle = sk.charge > 0.85 ? '#ff4a4a' : '#ffd54a';
      g.fillRect(m.x - w / 2 + 1, m.y + 1, (w - 2) * sk.charge, 4 * s);
    }
  }

  function auraRing(g, sk, r, color) {
    g.strokeStyle = color;
    g.globalAlpha = 0.8;
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const q = project(sk.pos.x + Math.cos(a) * r, sk.pos.y + Math.sin(a) * r, 0);
      if (i === 0) { g.lineWidth = 3 * q.s; g.moveTo(q.x, q.y); }
      else g.lineTo(q.x, q.y);
    }
    g.closePath();
    g.stroke();
    g.globalAlpha = 1;
  }

  function drawGoalie(g, match, gl) {
    const team = match.teams[gl.team];
    const r = gl.radius;
    const base = project(gl.pos.x, gl.pos.y, 0);
    const s = base.s;

    if (gl.down) {
      drawShadow(g, base.x, base.y, r * 1.35, s);
      const body = project(gl.pos.x, gl.pos.y, 12);
      g.save();
      g.translate(body.x, body.y);
      g.rotate(Math.sin(gl.fallT * 5) * 0.1 + Math.PI / 2);
      g.fillStyle = '#f5f0e6';
      g.strokeStyle = team.dark;
      g.lineWidth = 2.5 * s;
      g.beginPath();
      g.ellipse(0, 0, r * 1.15 * s, r * 0.62 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = team.color;
      g.beginPath();
      g.ellipse(0, -r * 0.05 * s, r * 0.78 * s, r * 0.42 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = '900 ' + Math.round(r * 0.42 * s) + 'px ' + FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(gl.spec.num), 0, 2 * s);
      g.restore();

      const label = project(gl.pos.x, gl.pos.y, 76);
      g.fillStyle = '#ffd54a';
      g.font = '900 ' + Math.round(13 * s) + 'px ' + FONT;
      g.textAlign = 'center';
      g.fillText('DOWN!', label.x, label.y);
      return;
    }

    drawShadow(g, base.x, base.y, r * 1.15, s);

    // pads: two vertical slabs
    g.fillStyle = '#f5f0e6';
    g.strokeStyle = team.dark;
    g.lineWidth = 2 * s;
    for (const side of [-1, 1]) {
      const px = project(gl.pos.x, gl.pos.y + side * r * 0.55, 0);
      const pt = project(gl.pos.x, gl.pos.y + side * r * 0.55, 34);
      const w = r * 0.42 * s;
      g.beginPath();
      g.rect(px.x - w, pt.y, w * 2, px.y - pt.y);
      g.fill();
      g.stroke();
    }
    // chest
    const t0 = project(gl.pos.x, gl.pos.y, 16);
    const t1 = project(gl.pos.x, gl.pos.y, 46);
    const bw = r * 1.0 * s;
    g.fillStyle = team.color;
    g.strokeStyle = team.dark;
    g.lineWidth = 2.5 * s;
    g.beginPath();
    g.moveTo(t0.x - bw, t0.y);
    g.lineTo(t1.x - bw, t1.y);
    g.arc(t1.x, t1.y, bw, Math.PI, 0);
    g.lineTo(t0.x + bw, t0.y);
    g.arc(t0.x, t0.y, bw, 0, Math.PI);
    g.closePath();
    g.fill();
    g.stroke();
    // number
    g.fillStyle = '#fff';
    g.font = '900 ' + Math.round(r * 0.5 * s) + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(gl.spec.num), t1.x, (t0.y + t1.y) / 2);
    // masked head
    const hq = project(gl.pos.x, gl.pos.y, 46 + r * 0.5);
    const hr = r * 0.5 * s;
    g.fillStyle = '#f2c99a';
    g.beginPath();
    g.arc(hq.x, hq.y, hr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = team.dark;
    g.lineWidth = 2 * s;
    g.beginPath();
    g.arc(hq.x, hq.y, hr, -Math.PI * 0.8, Math.PI * 0.1);
    g.stroke();
    if (gl.eff.tiny > 0) {
      const m = project(gl.pos.x, gl.pos.y, 78);
      g.fillStyle = H.POWERUPS.tinyGoalie.color;
      g.font = '900 ' + Math.round(12 * s) + 'px ' + FONT;
      g.fillText('TINY!', m.x, m.y);
    }
  }

  function drawNet(g, side) {
    const cfg = H.CFG;
    const gx = cfg.goalX[side];
    const dir = side === 0 ? -1 : 1; // net extends away from center ice
    const backX = gx + dir * cfg.netDepth;
    const y0 = cfg.cy - cfg.goalHalf, y1 = cfg.cy + cfg.goalHalf;
    const hMouth = 46, hBack = 30;

    // mesh: back panel + top
    g.fillStyle = 'rgba(255,255,255,0.35)';
    quad(g, [backX, y0, 0], [backX, y1, 0], [backX, y1, hBack], [backX, y0, hBack]);
    quad(g, [gx, y0, hMouth], [gx, y1, hMouth], [backX, y1, hBack], [backX, y0, hBack]);
    // side mesh
    g.fillStyle = 'rgba(255,255,255,0.28)';
    quad(g, [gx, y0, 0], [backX, y0, 0], [backX, y0, hBack], [gx, y0, hMouth]);
    quad(g, [gx, y1, 0], [backX, y1, 0], [backX, y1, hBack], [gx, y1, hMouth]);

    // red frame
    line3(g, gx, y0, 0, gx, y0, hMouth, '#e03a30', 4);       // posts
    line3(g, gx, y1, 0, gx, y1, hMouth, '#e03a30', 4);
    line3(g, gx, y0, hMouth, gx, y1, hMouth, '#e03a30', 4);  // crossbar
    line3(g, gx, y0, hMouth, backX, y0, hBack, '#e03a30', 2.5);
    line3(g, gx, y1, hMouth, backX, y1, hBack, '#e03a30', 2.5);
    line3(g, backX, y0, 0, backX, y0, hBack, '#e03a30', 2.5);
    line3(g, backX, y1, 0, backX, y1, hBack, '#e03a30', 2.5);
    line3(g, backX, y0, hBack, backX, y1, hBack, '#e03a30', 2.5);
  }

  function quad(g, a, b, c, d) {
    const pa = project(a[0], a[1], a[2]);
    const pb = project(b[0], b[1], b[2]);
    const pc = project(c[0], c[1], c[2]);
    const pd = project(d[0], d[1], d[2]);
    g.beginPath();
    g.moveTo(pa.x, pa.y);
    g.lineTo(pb.x, pb.y);
    g.lineTo(pc.x, pc.y);
    g.lineTo(pd.x, pd.y);
    g.closePath();
    g.fill();
  }

  function drawPuck(g, match) {
    const p = match.puck;
    const cfg = H.CFG;
    for (const t of p.trail) {
      const a = 1 - t.t / 0.3;
      const q = project(t.x, t.y, 3);
      g.fillStyle = p.rocket ? `rgba(255,120,40,${a * 0.6})` : `rgba(60,70,90,${a * 0.35})`;
      g.beginPath();
      g.ellipse(q.x, q.y, cfg.puckR * a * q.s, cfg.puckR * a * q.s * 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    const wp = p.owner
      ? (p.owner.isGoalie
        ? { x: p.owner.pos.x + p.owner.facing.x * (p.owner.radius + 6), y: p.owner.pos.y }
        : p.owner.stickPoint())
      : p.pos;
    const q = project(wp.x, wp.y, 0);
    const rr = cfg.puckR * q.s;
    // cylinder side
    g.fillStyle = '#000308';
    g.beginPath();
    g.ellipse(q.x, q.y, rr, rr * 0.5, 0, 0, Math.PI);
    g.ellipse(q.x, q.y - 4 * q.s, rr, rr * 0.5, 0, Math.PI, 0);
    g.fill();
    g.fillRect(q.x - rr, q.y - 4 * q.s, rr * 2, 4 * q.s);
    // top face
    g.fillStyle = '#1c2029';
    g.beginPath();
    g.ellipse(q.x, q.y - 4 * q.s, rr, rr * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    if (p.rocket && !p.owner) {
      g.strokeStyle = 'rgba(255,90,30,0.9)';
      g.lineWidth = 2 * q.s;
      g.beginPath();
      g.ellipse(q.x, q.y - 2 * q.s, rr + 4 * q.s, (rr + 4 * q.s) * 0.6, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }

  function drawPowerup(g, pu) {
    const def = H.POWERUPS[pu.type];
    const blink = pu.age > 9 && Math.floor(pu.age * 6) % 2 === 0;
    if (blink) return;
    const bob = Math.sin(pu.age * 3) * 6;
    const base = project(pu.pos.x, pu.pos.y, 0);
    const q = project(pu.pos.x, pu.pos.y, 30 + bob);
    const s = q.s;
    drawShadow(g, base.x, base.y, 14, base.s);
    g.save();
    g.translate(q.x, q.y);
    g.rotate(pu.age * 1.2);
    const r = 18 * s * (1 + Math.sin(pu.age * 6) * 0.1);
    g.fillStyle = def.color;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2.5 * s;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.5;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    g.fillStyle = def.color;
    g.font = '900 ' + Math.round(12 * s) + 'px ' + FONT;
    g.textAlign = 'center';
    g.fillText(def.label, q.x, q.y + 30 * s);
  }

  function drawGoalLight(g, match) {
    const gl = match.fx.goalLight;
    if (!gl || Math.floor(gl.t * 6) % 2 !== 0) return;
    const cfg = H.CFG;
    const dir = gl.side === 0 ? -1 : 1;
    const q = project(cfg.goalX[gl.side] + dir * (cfg.netDepth + 30), cfg.cy, BOARD_H + GLASS_H + 30);
    g.fillStyle = '#ff2020';
    g.shadowColor = '#ff2020';
    g.shadowBlur = 34;
    g.beginPath();
    g.arc(q.x, q.y, 12 * q.s, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  }

  // --- main entry ------------------------------------------------------------------

  function renderMatch(g, match) {
    const cfg = H.CFG;
    if (!bg) makeBackground();

    g.save();
    if (match.fx.shake > 0) {
      g.translate(H.M.rand(-match.fx.shake, match.fx.shake), H.M.rand(-match.fx.shake, match.fx.shake));
    }

    g.drawImage(bg, 0, 0);

    // depth-sorted world drawables (far first = smaller world y first)
    const items = [];
    for (const s of match.skaters) items.push({ y: s.pos.y, draw: () => drawSkater(g, match, s) });
    for (const gl of match.goalies) items.push({ y: gl.pos.y, draw: () => drawGoalie(g, match, gl) });
    items.push({ y: cfg.cy - 1, draw: () => drawNet(g, 0) });
    items.push({ y: cfg.cy - 1, draw: () => drawNet(g, 1) });
    if (match.powerup) items.push({ y: match.powerup.pos.y, draw: () => drawPowerup(g, match.powerup) });
    const puckWp = match.puck.owner ? match.puck.owner.pos : match.puck.pos;
    items.push({ y: puckWp.y + 6, draw: () => drawPuck(g, match) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // particles
    for (const pt of match.fx.particles) {
      const a = 1 - pt.t / pt.life;
      const q = project(pt.x, pt.y, 10);
      g.globalAlpha = a;
      g.fillStyle = pt.color;
      g.beginPath();
      g.arc(q.x, q.y, pt.size * q.s, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    drawGoalLight(g, match);

    // near glass over everything
    if (fgGlass) g.drawImage(fgGlass, 0, 0);

    // popups
    for (const pp of match.fx.popups) {
      const a = 1 - pp.t / pp.life;
      const q = project(pp.x, pp.y + (pp.t * 30), 60 + pp.t * 40);
      g.globalAlpha = Math.min(1, a * 2);
      g.fillStyle = pp.color;
      g.font = '900 ' + Math.round(20 * q.s) + 'px ' + FONT;
      g.textAlign = 'center';
      g.fillText(pp.text, q.x, q.y);
    }
    g.globalAlpha = 1;

    g.restore();

    H.render.drawHud(g, match);
    H.render.drawOverlays(g, match);

    if (match.fx.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${match.fx.flash * 0.5})`;
      g.fillRect(0, 0, cfg.W, cfg.H);
    }
  }

  return { renderMatch, makeBackground };
})();
