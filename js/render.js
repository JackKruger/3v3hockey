// ---------------------------------------------------------------------------
// render.js — all drawing: rink, entities, HUD, banners, overlays
// ---------------------------------------------------------------------------
window.H = window.H || {};

H.render = (function () {
  const C = () => H.CFG;
  let bg = null; // prerendered background

  const FONT = '"Arial Black", "Impact", sans-serif';

  function makeBackground() {
    const cfg = C();
    bg = document.createElement('canvas');
    bg.width = cfg.W;
    bg.height = cfg.H;
    const g = bg.getContext('2d');

    // arena backdrop
    const grad = g.createLinearGradient(0, 0, 0, cfg.H);
    grad.addColorStop(0, '#101528');
    grad.addColorStop(1, '#0a0e1a');
    g.fillStyle = grad;
    g.fillRect(0, 0, cfg.W, cfg.H);

    // crowd dots
    let seed = 12345;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 1500; i++) {
      const x = rnd() * cfg.W;
      const y = rnd() * cfg.H;
      const R = cfg.rink;
      if (x > R.x - 30 && x < R.x + R.w + 30 && y > R.y - 30 && y < R.y + R.h + 30) continue;
      g.fillStyle = `hsl(${Math.floor(rnd() * 360)}, 35%, ${25 + rnd() * 35}%)`;
      g.beginPath();
      g.arc(x, y, 3 + rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }

    drawRink(g);
    return bg;
  }

  function roundRectPath(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawRink(g) {
    const cfg = C();
    const R = cfg.rink;

    // boards glow
    g.save();
    g.shadowColor = '#4a90ff';
    g.shadowBlur = 30;
    roundRectPath(g, R.x - 8, R.y - 8, R.w + 16, R.h + 16, R.r + 8);
    g.fillStyle = '#dfe7f5';
    g.fill();
    g.restore();

    // ice
    roundRectPath(g, R.x, R.y, R.w, R.h, R.r);
    const ice = g.createRadialGradient(cfg.cx, cfg.cy, 100, cfg.cx, cfg.cy, cfg.rink.w * 0.625);
    ice.addColorStop(0, '#f4f9ff');
    ice.addColorStop(1, '#cfe0f2');
    g.fillStyle = ice;
    g.fill();

    g.save();
    roundRectPath(g, R.x, R.y, R.w, R.h, R.r);
    g.clip();

    // center line
    g.strokeStyle = '#d33a3a';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(cfg.cx, R.y);
    g.lineTo(cfg.cx, R.y + R.h);
    g.stroke();

    // blue lines
    g.strokeStyle = '#3465c8';
    g.lineWidth = 8;
    for (const bx of [cfg.cx - 265, cfg.cx + 265]) {
      g.beginPath();
      g.moveTo(bx, R.y);
      g.lineTo(bx, R.y + R.h);
      g.stroke();
    }

    // goal lines
    g.strokeStyle = '#d33a3a';
    g.lineWidth = 3;
    for (const gx of cfg.goalX) {
      g.beginPath();
      g.moveTo(gx, R.y);
      g.lineTo(gx, R.y + R.h);
      g.stroke();
    }

    // center circle + dot
    g.strokeStyle = '#3465c8';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cfg.cx, cfg.cy, 90, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#3465c8';
    g.beginPath();
    g.arc(cfg.cx, cfg.cy, 7, 0, Math.PI * 2);
    g.fill();

    // center logo
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = '#274b8f';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 34px ' + FONT;
    g.fillText('3v3', cfg.cx, cfg.cy - 20);
    g.font = '900 18px ' + FONT;
    g.fillText('ARCADE', cfg.cx, cfg.cy + 16);
    g.restore();

    // zone faceoff circles/dots
    g.strokeStyle = '#d33a3a';
    g.lineWidth = 4;
    for (const gx of [cfg.goalX[0] + 150, cfg.goalX[1] - 150]) {
      for (const sy of [-1, 1]) {
        const y = cfg.cy + sy * 165;
        g.beginPath();
        g.arc(gx, y, 62, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = '#d33a3a';
        g.beginPath();
        g.arc(gx, y, 6, 0, Math.PI * 2);
        g.fill();
      }
    }

    // creases
    for (let side = 0; side < 2; side++) {
      const gx = cfg.goalX[side];
      const a0 = side === 0 ? -Math.PI / 2 : Math.PI / 2;
      g.fillStyle = 'rgba(90, 160, 235, 0.35)';
      g.strokeStyle = '#d33a3a';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(gx, cfg.cy, cfg.creaseR, a0, a0 + Math.PI * (side === 0 ? 1 : 1), side === 1);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.restore();

    // boards outline
    roundRectPath(g, R.x, R.y, R.w, R.h, R.r);
    g.strokeStyle = '#8899bb';
    g.lineWidth = 5;
    g.stroke();

    // nets
    for (let side = 0; side < 2; side++) drawNet(g, side);
  }

  function drawNet(g, side) {
    const cfg = C();
    const box = H.netBox(side);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(box.x, box.y, box.w, box.h);
    // mesh
    g.strokeStyle = 'rgba(120,130,150,0.8)';
    g.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo(box.x + (box.w * i) / 5, box.y);
      g.lineTo(box.x + (box.w * i) / 5, box.y + box.h);
      g.stroke();
    }
    for (let i = 1; i < 8; i++) {
      g.beginPath();
      g.moveTo(box.x, box.y + (box.h * i) / 8);
      g.lineTo(box.x + box.w, box.y + (box.h * i) / 8);
      g.stroke();
    }
    // frame
    g.strokeStyle = '#e03a30';
    g.lineWidth = 5;
    const mouthX = cfg.goalX[side];
    g.beginPath();
    if (side === 0) {
      g.moveTo(mouthX, box.y);
      g.lineTo(box.x, box.y);
      g.lineTo(box.x, box.y + box.h);
      g.lineTo(mouthX, box.y + box.h);
    } else {
      g.moveTo(mouthX, box.y);
      g.lineTo(box.x + box.w, box.y);
      g.lineTo(box.x + box.w, box.y + box.h);
      g.lineTo(mouthX, box.y + box.h);
    }
    g.stroke();
    // posts
    g.fillStyle = '#e03a30';
    for (const sy of [-1, 1]) {
      g.beginPath();
      g.arc(mouthX, cfg.cy + sy * cfg.goalHalf, cfg.postR, 0, Math.PI * 2);
      g.fill();
    }
  }

  // --- entities ---------------------------------------------------------------

  function drawSkater(g, match, s) {
    const team = match.teams[s.team];
    const r = s.radius;
    const p = s.pos;

    g.save();
    if (s.down) {
      g.translate(p.x, p.y);
      g.rotate(Math.sin(s.fallT * 3) * 0.15 + Math.PI / 2);
      g.translate(-p.x, -p.y);
      g.globalAlpha = 0.95;
    }

    // shadow
    g.fillStyle = 'rgba(30,50,90,0.25)';
    g.beginPath();
    g.ellipse(p.x + 3, p.y + 6, r * 1.05, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();

    // effect auras
    if (s.eff.shield > 0) ring(g, p, r + 7, H.POWERUPS.shield.color, 3);
    if (s.eff.rocket > 0) ring(g, p, r + 4, H.POWERUPS.rocket.color, 2.5);
    if (s.eff.speed > 0) {
      g.strokeStyle = 'rgba(255,233,74,0.7)';
      g.lineWidth = 3;
      for (let i = 1; i <= 3; i++) {
        g.beginPath();
        g.moveTo(p.x - s.vel.x * 0.02 * i - 8, p.y - s.vel.y * 0.02 * i - i * 4);
        g.lineTo(p.x - s.vel.x * 0.04 * i + 8, p.y - s.vel.y * 0.04 * i - i * 4);
        g.stroke();
      }
    }

    // stick
    const f = s.facing;
    const sx = p.x + f.x * (r + 16), sy = p.y + f.y * (r + 16);
    g.strokeStyle = '#8a5a2b';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(p.x + f.x * r * 0.5 - f.y * r * 0.7, p.y + f.y * r * 0.5 + f.x * r * 0.7);
    g.lineTo(sx, sy);
    g.stroke();
    g.strokeStyle = s.eff.rocket > 0 ? '#ff4a4a' : '#3a2a18';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(sx - f.y * 7, sy + f.x * 7);
    g.lineTo(sx + f.y * 7, sy - f.x * 7);
    g.stroke();

    // body
    g.fillStyle = team.color;
    g.strokeStyle = team.dark;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(p.x, p.y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // jersey stripe
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(p.x, p.y, r * 0.72, 0.3, Math.PI - 0.3);
    g.stroke();

    // big head (arcade!)
    const hr = r * 0.62;
    const hx = p.x + f.x * r * 0.28, hy = p.y + f.y * r * 0.28 - 2;
    g.fillStyle = '#f2c99a';
    g.beginPath();
    g.arc(hx, hy, hr, 0, Math.PI * 2);
    g.fill();
    // helmet
    g.fillStyle = team.dark;
    g.beginPath();
    g.arc(hx, hy, hr, Math.PI * 0.95, Math.PI * 2.05);
    g.fill();
    // eyes toward facing
    if (s.frozen) {
      g.fillStyle = '#bfeaff';
      g.globalAlpha = 0.75;
      g.beginPath();
      g.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    } else {
      g.fillStyle = '#222';
      g.beginPath();
      g.arc(hx + f.x * hr * 0.4 - f.y * hr * 0.3, hy + f.y * hr * 0.4 + f.x * hr * 0.3, 2.5, 0, Math.PI * 2);
      g.arc(hx + f.x * hr * 0.4 + f.y * hr * 0.3, hy + f.y * hr * 0.4 - f.x * hr * 0.3, 2.5, 0, Math.PI * 2);
      g.fill();
    }

    // number
    g.fillStyle = '#fff';
    g.font = '900 ' + Math.round(r * 0.55) + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(s.spec.num), p.x - f.x * r * 0.35, p.y - f.y * r * 0.35 + r * 0.3);

    g.restore();

    // dizzy stars when down
    if (s.down) {
      g.fillStyle = '#ffd54a';
      g.font = '16px ' + FONT;
      for (let i = 0; i < 3; i++) {
        const a = s.fallT * 5 + (i * Math.PI * 2) / 3;
        g.fillText('★', p.x + Math.cos(a) * (r + 12), p.y - r - 10 + Math.sin(a) * 6);
      }
    }

    // controller marker
    if (s.controlledBy != null) {
      const pl = match.players[s.controlledBy];
      g.fillStyle = pl.color;
      g.beginPath();
      g.moveTo(p.x, p.y - r - 26);
      g.lineTo(p.x - 9, p.y - r - 40);
      g.lineTo(p.x + 9, p.y - r - 40);
      g.closePath();
      g.fill();
      g.font = '900 13px ' + FONT;
      g.textAlign = 'center';
      g.fillText(pl.name, p.x, p.y - r - 48);
    }

    // charge bar
    if (s.charge > 0.02 && match.puck.owner === s) {
      const w = 46;
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(p.x - w / 2, p.y + r + 10, w, 7);
      g.fillStyle = s.charge > 0.85 ? '#ff4a4a' : '#ffd54a';
      g.fillRect(p.x - w / 2 + 1, p.y + r + 11, (w - 2) * s.charge, 5);
    }
  }

  function ring(g, p, r, color, w) {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.globalAlpha = 0.8;
    g.beginPath();
    g.arc(p.x, p.y, r, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }

  function drawGoalie(g, match, gl) {
    const team = match.teams[gl.team];
    const r = gl.radius;
    const p = gl.pos;

    g.save();
    if (gl.down) {
      g.translate(p.x, p.y);
      g.rotate(Math.sin(gl.fallT * 5) * 0.12 + Math.PI / 2);
      g.translate(-p.x, -p.y);
      g.globalAlpha = 0.95;
    }

    // shadow
    g.fillStyle = 'rgba(30,50,90,0.25)';
    g.beginPath();
    g.ellipse(p.x + 3, p.y + 6, r * 1.1, r * 0.75, 0, 0, Math.PI * 2);
    g.fill();
    // pads (vertical rectangle look)
    g.fillStyle = '#f5f0e6';
    g.strokeStyle = team.dark;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(p.x, p.y, r * 0.8, r * 1.05, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // chest
    g.fillStyle = team.color;
    g.beginPath();
    g.arc(p.x, p.y, r * 0.72, 0, Math.PI * 2);
    g.fill();
    // mask
    g.fillStyle = '#f2c99a';
    g.beginPath();
    g.arc(p.x, p.y - 3, r * 0.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = team.dark;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p.x, p.y - 3, r * 0.5, -Math.PI * 0.85, Math.PI * 0.05);
    g.stroke();
    if (gl.eff.tiny > 0) {
      g.fillStyle = H.POWERUPS.tinyGoalie.color;
      g.font = '900 12px ' + FONT;
      g.textAlign = 'center';
      g.fillText('TINY!', p.x, p.y - r - 12);
    }
    // number
    g.fillStyle = '#fff';
    g.font = '900 ' + Math.round(r * 0.45) + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(gl.spec.num), p.x, p.y + r * 0.55);

    g.restore();

    if (gl.down) {
      g.fillStyle = '#ffd54a';
      g.font = '900 13px ' + FONT;
      g.textAlign = 'center';
      g.fillText('DOWN!', p.x, p.y - r - 18);
    }
  }

  function drawPuck(g, match) {
    const p = match.puck;
    const cfg = C();
    // trail
    for (const t of p.trail) {
      const a = 1 - t.t / 0.3;
      g.fillStyle = p.rocket ? `rgba(255,120,40,${a * 0.6})` : `rgba(60,70,90,${a * 0.35})`;
      g.beginPath();
      g.arc(t.x, t.y, cfg.puckR * a, 0, Math.PI * 2);
      g.fill();
    }
    const pos = p.owner
      ? (p.owner.isGoalie
        ? { x: p.owner.pos.x + p.owner.facing.x * (p.owner.radius + 6), y: p.owner.pos.y }
        : p.owner.stickPoint())
      : p.pos;
    g.fillStyle = '#101014';
    g.beginPath();
    g.arc(pos.x, pos.y, cfg.puckR, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.arc(pos.x - 2, pos.y - 2, cfg.puckR * 0.45, 0, Math.PI * 2);
    g.fill();
    if (p.rocket && !p.owner) {
      g.strokeStyle = 'rgba(255,90,30,0.9)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(pos.x, pos.y, cfg.puckR + 3, 0, Math.PI * 2);
      g.stroke();
    }
  }

  function drawPowerup(g, pu) {
    const def = H.POWERUPS[pu.type];
    const pulse = 1 + Math.sin(pu.age * 6) * 0.12;
    const r = 20 * pulse;
    const p = pu.pos;
    const blink = pu.age > 9 && Math.floor(pu.age * 6) % 2 === 0;
    if (blink) return;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(pu.age * 1.2);
    g.fillStyle = def.color;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    star(g, 0, 0, r, r * 0.5, 5);
    g.fill();
    g.stroke();
    g.restore();
    g.fillStyle = def.color;
    g.font = '900 13px ' + FONT;
    g.textAlign = 'center';
    g.fillText(def.label, p.x, p.y + r + 18);
  }

  function star(g, x, y, ro, ri, n) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 === 0 ? ro : ri;
      const a = (i * Math.PI) / n - Math.PI / 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  }

  // --- HUD ---------------------------------------------------------------------

  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function drawHud(g, match) {
    const cfg = C();
    const cx = cfg.W / 2;

    // scoreboard panel
    g.fillStyle = 'rgba(10,14,26,0.85)';
    g.strokeStyle = '#3a4a6a';
    g.lineWidth = 2;
    roundRectPath(g, cx - 260, 18, 520, 92, 14);
    g.fill();
    g.stroke();

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // team names + scores
    for (let t = 0; t < 2; t++) {
      const team = match.teams[t];
      const x = t === 0 ? cx - 160 : cx + 160;
      g.fillStyle = team.color;
      g.font = '900 22px ' + FONT;
      g.fillText(team.short, x, 44);
      g.fillStyle = '#ffffff';
      g.font = '900 40px ' + FONT;
      g.fillText(String(match.score[t]), x, 84);
    }
    // clock
    g.fillStyle = '#ffd54a';
    g.font = '900 34px ' + FONT;
    g.fillText(fmtTime(match.time), cx, 52);
    g.fillStyle = '#9fb2d8';
    g.font = '900 17px ' + FONT;
    g.fillText(match.overtime ? 'OT' : 'PERIOD ' + match.period, cx, 88);

    // active effect chips
    let ex = [cx - 270, cx + 270];
    for (let t = 0; t < 2; t++) {
      const chips = [];
      for (const s of match.teamSkaters(t)) {
        for (const k of ['speed', 'big', 'rocket', 'shield']) {
          if (s.eff[k] > 0) chips.push({ k, t: s.eff[k] });
        }
      }
      const gl = match.goalies[t];
      if (gl.eff.tiny > 0) chips.push({ k: 'tinyGoalie', t: gl.eff.tiny });
      for (const s of match.teamSkaters(t)) {
        if (s.eff.freeze > 0) { chips.push({ k: 'freeze', t: s.eff.freeze }); break; }
      }
      chips.slice(0, 3).forEach((c, i) => {
        const def = H.POWERUPS[c.k];
        const x = t === 0 ? ex[0] - i * 120 - 60 : ex[1] + i * 120 + 60;
        g.fillStyle = 'rgba(10,14,26,0.8)';
        roundRectPath(g, x - 55, 30, 110, 30, 8);
        g.fill();
        g.fillStyle = def.color;
        g.font = '900 12px ' + FONT;
        g.fillText(def.label + ' ' + Math.ceil(c.t), x, 45);
      });
    }
  }

  function banner(g, text, sub, color) {
    const cfg = C();
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(10,14,26,0.65)';
    g.fillRect(0, cfg.H / 2 - 90, cfg.W, 180);
    g.fillStyle = color || '#ffffff';
    g.font = '900 72px ' + FONT;
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 12;
    g.fillText(text, cfg.W / 2, cfg.H / 2 - 12);
    if (sub) {
      g.fillStyle = '#ffffff';
      g.font = '900 26px ' + FONT;
      g.fillText(sub, cfg.W / 2, cfg.H / 2 + 46);
    }
    g.restore();
  }

  function drawPauseControls(g) {
    const cfg = C();
    const rows = [
      ['SKATE', 'W A S D', 'ARROWS', 'LEFT STICK / D-PAD'],
      ['PASS / JOIN', 'F', ',', 'X'],
      ['SHOOT', 'G', '.', 'A'],
      ['BODY CHECK', 'H', '/', 'B'],
      ['SWITCH SKATER', 'R', 'M', 'Y'],
      ['DEKE / LEAVE', 'L-SHIFT', 'R-SHIFT', 'RB'],
      ['PAUSE / START', 'ENTER', 'ENTER', 'MENU'],
    ];
    const x = cfg.W / 2 - 520;
    const y = 172;
    const w = 1040;
    const h = 575;
    const colX = [x + 80, x + 385, x + 600, x + 810];

    g.fillStyle = 'rgba(7,11,22,0.92)';
    g.strokeStyle = '#3a4a6a';
    g.lineWidth = 3;
    roundRectPath(g, x, y, w, h, 14);
    g.fill();
    g.stroke();

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffd54a';
    g.font = '900 44px ' + FONT;
    g.fillText('CONTROLS', cfg.W / 2, y + 58);

    g.font = '900 18px ' + FONT;
    g.fillStyle = '#7ae8ff';
    ['ACTION', 'P1', 'P2', 'XBOX'].forEach((head, i) => {
      g.fillText(head, colX[i], y + 122);
    });

    rows.forEach((row, i) => {
      const ry = y + 172 + i * 50;
      if (i % 2 === 0) {
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(x + 42, ry - 22, w - 84, 44);
      }
      g.font = '900 17px ' + FONT;
      g.fillStyle = '#ffffff';
      g.textAlign = 'left';
      g.fillText(row[0], colX[0] - 58, ry);
      g.textAlign = 'center';
      g.fillStyle = '#c8d4ee';
      g.fillText(row[1], colX[1], ry);
      g.fillText(row[2], colX[2], ry);
      g.fillText(row[3], colX[3], ry);
    });

    g.fillStyle = '#55668f';
    g.font = '900 16px ' + FONT;
    g.textAlign = 'center';
    g.fillText('PRESS ANY ACTION BUTTON OR ESC TO RETURN', cfg.W / 2, y + h - 50);
  }

  function drawOverlays(g, match) {
    const cfg = C();
    if (match.state === 'countdown') {
      const sec = Math.ceil(match.stateT);
      banner(g, match.banner, sec > 0 ? String(sec) : 'GO!', '#ffd54a');
    } else if (match.state === 'goal' && match.celeb) {
      const team = match.teams[match.celeb.team];
      let sub = '';
      if (match.celeb.scorer) {
        sub = match.celeb.scorer.spec.name + ' #' + match.celeb.scorer.spec.num;
        if (match.celeb.assist) sub += '  (from ' + match.celeb.assist.spec.name + ')';
      }
      banner(g, (match.otWinner != null ? 'OT WINNER!' : 'GOAL!'), sub, team.color);
    } else if (match.state === 'periodEnd') {
      banner(g, match.banner, match.banner === 'OVERTIME!' ? 'NEXT GOAL WINS' : '', '#7ae8ff');
    } else if (match.state === 'gameOver') {
      drawGameOver(g, match);
    }

    if (match.paused && match.state !== 'gameOver') {
      g.fillStyle = 'rgba(5,8,16,0.8)';
      g.fillRect(0, 0, cfg.W, cfg.H);
      if (match.pauseMode === 'controls') {
        drawPauseControls(g);
        return;
      }
      g.textAlign = 'center';
      g.fillStyle = '#ffd54a';
      g.font = '900 56px ' + FONT;
      g.fillText('PAUSED', cfg.W / 2, 300);
      const items = ['RESUME', 'CONTROLS', 'RESTART', 'QUIT TO MENU'];
      items.forEach((it, i) => {
        const sel = match.pauseSel === i;
        g.fillStyle = sel ? '#ffffff' : '#7a8bb0';
        g.font = '900 ' + (sel ? 34 : 28) + 'px ' + FONT;
        g.fillText((sel ? '▶ ' : '') + it, cfg.W / 2, 380 + i * 56);
      });
      g.fillStyle = '#55668f';
      g.font = '900 16px ' + FONT;
      g.fillText('M = MUTE', cfg.W / 2, 640);
    }
  }

  function drawGameOver(g, match) {
    const cfg = C();
    g.fillStyle = 'rgba(5,8,16,0.88)';
    g.fillRect(0, 0, cfg.W, cfg.H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';

    const w = match.teams[match.winner];
    g.fillStyle = w.color;
    g.font = '900 64px ' + FONT;
    g.fillText(w.name + ' WIN!', cfg.W / 2, 180);

    g.fillStyle = '#ffffff';
    g.font = '900 48px ' + FONT;
    g.fillText(
      match.teams[0].short + '  ' + match.score[0] + '  —  ' + match.score[1] + '  ' + match.teams[1].short,
      cfg.W / 2, 270
    );

    g.fillStyle = '#ffd54a';
    g.font = '900 30px ' + FONT;
    g.fillText('★ THREE STARS ★', cfg.W / 2, 380);
    (match.stars || []).forEach((st, i) => {
      const team = match.teams[st.ent.team];
      g.fillStyle = team.color;
      g.font = '900 26px ' + FONT;
      g.fillText((i + 1) + '. ' + st.line, cfg.W / 2, 440 + i * 50);
    });

    g.fillStyle = '#9fb2d8';
    g.font = '900 22px ' + FONT;
    g.fillText('SHOOT / START — REMATCH        CHECK / ESC — MENU', cfg.W / 2, 680);
  }

  return { makeBackground, roundRectPath, FONT, fmtTime, drawHud, drawOverlays };
})();
