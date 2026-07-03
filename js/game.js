// ---------------------------------------------------------------------------
// game.js — constants, math, entities (skater / goalie / puck), match logic,
// power-ups, physics. Rendering lives in render.js, AI in ai.js.
// ---------------------------------------------------------------------------
window.H = window.H || {};

H.CFG = {
  W: 1600, H: 900,
  rink: { x: 80, y: 180, w: 1440, h: 640, r: 150 },
  goalInset: 90,     // goal line distance from rink edge
  goalHalf: 62,      // half of goal mouth height
  netDepth: 36,
  postR: 5,
  puckR: 8,
  skaterR: 25,
  goalieR: 31,
  creaseR: 85,
};
H.CFG.cx = H.CFG.rink.x + H.CFG.rink.w / 2;   // 800
H.CFG.cy = H.CFG.rink.y + H.CFG.rink.h / 2;   // 500
H.CFG.goalX = [H.CFG.rink.x + H.CFG.goalInset, H.CFG.rink.x + H.CFG.rink.w - H.CFG.goalInset]; // [170, 1430]

H.M = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  len: (x, y) => Math.hypot(x, y),
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  norm(x, y) {
    const l = Math.hypot(x, y);
    return l > 0.0001 ? { x: x / l, y: y / l } : { x: 1, y: 0 };
  },
  rand: (a, b) => a + Math.random() * (b - a),
  lerp: (a, b, t) => a + (b - a) * t,
};

H.POWERUPS = {
  speed:      { label: 'TURBO',       color: '#ffe94a', dur: 8 },
  big:        { label: 'BIG MAN',     color: '#ff8c2b', dur: 10 },
  rocket:     { label: 'ROCKET SHOT', color: '#ff4a4a', dur: 9 },
  freeze:     { label: 'FREEZE',      color: '#7ae8ff', dur: 2.6 },
  tinyGoalie: { label: 'TINY GOALIE', color: '#c07aff', dur: 9 },
  shield:     { label: 'JUGGERNAUT',  color: '#7aff9b', dur: 10 },
};

H.TEAMS = [
  {
    name: 'RED WOLVES', short: 'RED', color: '#e03a30', dark: '#7e1d17',
    roster: [
      { name: 'BLAZE', num: 9,  spd: 1.06, shot: 1.00 },
      { name: 'TANK',  num: 17, spd: 0.95, shot: 1.06 },
      { name: 'ACE',   num: 4,  spd: 1.00, shot: 0.96 },
    ],
    goalie: { name: 'BRICK', num: 31 },
  },
  {
    name: 'ICE SHARKS', short: 'BLU', color: '#2f72e0', dark: '#173d80',
    roster: [
      { name: 'FLASH', num: 11, spd: 1.06, shot: 1.00 },
      { name: 'MOOSE', num: 22, spd: 0.95, shot: 1.06 },
      { name: 'STEEL', num: 6,  spd: 1.00, shot: 0.96 },
    ],
    goalie: { name: 'FROSTY', num: 35 },
  },
];

H.PLAYER_COLORS = ['#ffe94a', '#7aff9b', '#ff7ae0', '#7ae8ff'];

H.DIFFICULTY = {
  easy: { aiSpeed: 0.82, react: 0.55, goalieK: 3.2, goalieCatch: -0.12, shotErr: 30 },
  med:  { aiSpeed: 0.93, react: 0.75, goalieK: 4.6, goalieCatch: 0.0,  shotErr: 16 },
  hard: { aiSpeed: 1.0,  react: 0.95, goalieK: 6.2, goalieCatch: 0.10, shotErr: 7 },
};

// --- rink geometry helpers ------------------------------------------------

// Keep a circle of radius `rad` inside the rounded-rect boards.
// Returns impact speed if it hit, else 0. Mutates ent.pos / ent.vel.
H.collideBoards = function (ent, rad, rest) {
  const R = H.CFG.rink;
  const r = R.r;
  const minX = R.x + rad, maxX = R.x + R.w - rad;
  const minY = R.y + rad, maxY = R.y + R.h - rad;
  const p = ent.pos, v = ent.vel;
  let hit = 0;

  // corner handling: if in a corner quadrant, constrain to corner circle
  const corners = [
    { cx: R.x + r, cy: R.y + r }, { cx: R.x + R.w - r, cy: R.y + r },
    { cx: R.x + r, cy: R.y + R.h - r }, { cx: R.x + R.w - r, cy: R.y + R.h - r },
  ];
  let inCorner = false;
  for (const c of corners) {
    const qx = c.cx === R.x + r ? p.x < c.cx : p.x > c.cx;
    const qy = c.cy === R.y + r ? p.y < c.cy : p.y > c.cy;
    if (qx && qy) {
      inCorner = true;
      const dx = p.x - c.cx, dy = p.y - c.cy;
      const d = Math.hypot(dx, dy);
      const maxD = r - rad;
      if (d > maxD) {
        const n = d > 0.001 ? { x: dx / d, y: dy / d } : { x: 0.707, y: 0.707 };
        p.x = c.cx + n.x * maxD;
        p.y = c.cy + n.y * maxD;
        const vn = v.x * n.x + v.y * n.y;
        if (vn > 0) {
          hit = vn;
          v.x -= (1 + rest) * vn * n.x;
          v.y -= (1 + rest) * vn * n.y;
        }
      }
    }
  }
  if (!inCorner) {
    if (p.x < minX) { p.x = minX; if (v.x < 0) { hit = -v.x; v.x = -v.x * rest; } }
    if (p.x > maxX) { p.x = maxX; if (v.x > 0) { hit = v.x; v.x = -v.x * rest; } }
    if (p.y < minY) { p.y = minY; if (v.y < 0) { hit = -v.y; v.y = -v.y * rest; } }
    if (p.y > maxY) { p.y = maxY; if (v.y > 0) { hit = v.y; v.y = -v.y * rest; } }
  }
  return hit;
};

// Net boxes (side index 0 = left net, 1 = right net)
H.netBox = function (side) {
  const C = H.CFG;
  const gx = C.goalX[side];
  if (side === 0) return { x: gx - C.netDepth, y: C.cy - C.goalHalf, w: C.netDepth, h: C.goalHalf * 2 };
  return { x: gx, y: C.cy - C.goalHalf, w: C.netDepth, h: C.goalHalf * 2 };
};

// push a circle out of an AABB; returns true if collided
H.collideBox = function (ent, rad, box, rest) {
  const p = ent.pos;
  const nx = H.M.clamp(p.x, box.x, box.x + box.w);
  const ny = H.M.clamp(p.y, box.y, box.y + box.h);
  const dx = p.x - nx, dy = p.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rad * rad) return false;
  const d = Math.sqrt(d2);
  let n;
  if (d > 0.001) n = { x: dx / d, y: dy / d };
  else {
    // center inside box: push out along smallest penetration axis
    const l = p.x - box.x, rr = box.x + box.w - p.x, t = p.y - box.y, b = box.y + box.h - p.y;
    const m = Math.min(l, rr, t, b);
    n = m === l ? { x: -1, y: 0 } : m === rr ? { x: 1, y: 0 } : m === t ? { x: 0, y: -1 } : { x: 0, y: 1 };
  }
  p.x = nx + n.x * rad;
  p.y = ny + n.y * rad;
  const vn = ent.vel.x * n.x + ent.vel.y * n.y;
  if (vn < 0) {
    ent.vel.x -= (1 + rest) * vn * n.x;
    ent.vel.y -= (1 + rest) * vn * n.y;
  }
  return true;
};

// --- entities ---------------------------------------------------------------

class Skater {
  constructor(team, idx, spec) {
    this.team = team;
    this.idx = idx;
    this.spec = spec;
    this.isGoalie = false;
    this.pos = { x: 0, y: 0 };
    this.vel = { x: 0, y: 0 };
    this.facing = { x: team === 0 ? 1 : -1, y: 0 };
    this.input = { x: 0, y: 0 };
    this.controlledBy = null; // player index or null (AI)
    this.charge = 0;
    this.fallT = 0;
    this.checkT = 0;
    this.checkCd = 0;
    this.dekeCd = 0;
    this.immuneT = 0;
    this.eff = { speed: 0, big: 0, rocket: 0, freeze: 0, shield: 0 };
    this.stats = { goals: 0, assists: 0, hits: 0 };
    this.ai = {}; // scratch for ai.js
  }
  get radius() { return H.CFG.skaterR * (this.eff.big > 0 ? 1.45 : 1); }
  get mass() { return this.eff.big > 0 ? 2.4 : 1; }
  get maxSpeed() {
    return 345 * this.spec.spd * (this.eff.speed > 0 ? 1.5 : 1) * (this.eff.big > 0 ? 0.94 : 1);
  }
  get down() { return this.fallT > 0; }
  get frozen() { return this.eff.freeze > 0; }
  update(dt) {
    for (const k in this.eff) this.eff[k] = Math.max(0, this.eff[k] - dt);
    this.fallT = Math.max(0, this.fallT - dt);
    this.checkT = Math.max(0, this.checkT - dt);
    this.checkCd = Math.max(0, this.checkCd - dt);
    this.dekeCd = Math.max(0, this.dekeCd - dt);
    this.immuneT = Math.max(0, this.immuneT - dt);

    let tx = 0, ty = 0;
    if (!this.down && !this.frozen) {
      tx = this.input.x * this.maxSpeed;
      ty = this.input.y * this.maxSpeed;
      if (H.M.len(this.input.x, this.input.y) > 0.1) {
        const n = H.M.norm(this.input.x, this.input.y);
        this.facing.x = H.M.lerp(this.facing.x, n.x, Math.min(1, 12 * dt));
        this.facing.y = H.M.lerp(this.facing.y, n.y, Math.min(1, 12 * dt));
        const fn = H.M.norm(this.facing.x, this.facing.y);
        this.facing = fn;
      }
    }
    const k = this.down ? 1.2 : this.frozen ? 2.5 : 4.5;
    const a = 1 - Math.exp(-k * dt);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.y += (ty - this.vel.y) * a;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }
  stickPoint() {
    const r = this.radius;
    return { x: this.pos.x + this.facing.x * (r + 12), y: this.pos.y + this.facing.y * (r + 12) };
  }
}

class Goalie {
  constructor(team, spec) {
    this.team = team;
    this.spec = spec;
    this.isGoalie = true;
    const side = team; // team0 defends left net
    const dir = team === 0 ? 1 : -1;
    this.home = { x: H.CFG.goalX[side] + dir * 14, y: H.CFG.cy };
    this.pos = { x: this.home.x, y: this.home.y };
    this.vel = { x: 0, y: 0 };
    this.facing = { x: dir, y: 0 };
    this.eff = { tiny: 0, freeze: 0 };
    this.holdT = 0;
    this.stats = { saves: 0, goals: 0, assists: 0 };
  }
  get radius() { return H.CFG.goalieR * (this.eff.tiny > 0 ? 0.52 : 1); }
  get down() { return false; }
  get frozen() { return this.eff.freeze > 0; }
  update(dt) {
    for (const k in this.eff) this.eff[k] = Math.max(0, this.eff[k] - dt);
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }
}

class Puck {
  constructor() {
    this.pos = { x: H.CFG.cx, y: H.CFG.cy };
    this.vel = { x: 0, y: 0 };
    this.owner = null;      // Skater | Goalie | null
    this.noPick = null;     // entity that can't pick it up right now
    this.noPickT = 0;
    this.rocket = false;
    this.homeTo = null;     // pass target (mild homing)
    this.homeT = 0;
    this.trail = [];
  }
}

// --- match ------------------------------------------------------------------

class Match {
  // cfg: { periodLen, difficulty:'easy'|'med'|'hard', powerups:bool,
  //        players: [{device, name, color, team}] }
  constructor(cfg) {
    this.cfg = cfg;
    this.diff = H.DIFFICULTY[cfg.difficulty] || H.DIFFICULTY.med;
    this.teams = H.TEAMS;
    this.score = [0, 0];
    this.period = 1;
    this.time = cfg.periodLen;
    this.overtime = false;
    this.state = 'countdown';
    this.stateT = 0;
    this.banner = 'FACE OFF';
    this.paused = false;
    this.pauseSel = 0;
    this.pauseMode = 'menu';
    this.finished = null; // 'rematch' | 'quit'
    this.celeb = null;
    this.otWinner = null;

    this.skaters = [];
    this.goalies = [];
    for (let t = 0; t < 2; t++) {
      for (let i = 0; i < 3; i++) this.skaters.push(new Skater(t, i, this.teams[t].roster[i]));
      this.goalies.push(new Goalie(t, this.teams[t].goalie));
    }
    this.puck = new Puck();

    // assign human players to skaters (in join order, per team)
    this.players = cfg.players.map((p, i) => ({ ...p, index: i, skater: null }));
    for (let t = 0; t < 2; t++) {
      let slot = 0;
      for (const p of this.players) {
        if (p.team !== t) continue;
        const s = this.teamSkaters(t)[slot++];
        if (s) { s.controlledBy = p.index; p.skater = s; }
      }
    }

    this.touchHistory = []; // most recent first: {s, team}
    this.powerup = null;    // {type, pos, age}
    this.powerupTimer = 6;

    this.fx = { particles: [], popups: [], shake: 0, flash: 0, goalLight: null, beeped: {} };
    this.faceoff(3.2, 'FACE OFF');
  }

  teamSkaters(t) { return this.skaters.filter((s) => s.team === t); }
  attackGoalX(team) { return H.CFG.goalX[team === 0 ? 1 : 0]; }
  defendGoalX(team) { return H.CFG.goalX[team]; }

  faceoff(countdown, banner) {
    H.audio.setSkating(false);
    const C = H.CFG;
    for (let t = 0; t < 2; t++) {
      const dir = t === 0 ? 1 : -1; // attack direction
      const ss = this.teamSkaters(t);
      const spots = [
        { x: C.cx - dir * 48, y: C.cy },
        { x: C.cx - dir * 190, y: C.cy - 175 },
        { x: C.cx - dir * 400, y: C.cy + 155 },
      ];
      ss.forEach((s, i) => {
        s.pos = { ...spots[i] };
        s.vel = { x: 0, y: 0 };
        s.facing = { x: dir, y: 0 };
        s.fallT = 0; s.checkT = 0; s.charge = 0;
        s.input = { x: 0, y: 0 };
      });
      const g = this.goalies[t];
      g.pos = { ...g.home };
      g.vel = { x: 0, y: 0 };
      g.holdT = 0;
    }
    this.puck = Object.assign(new Puck(), { pos: { x: C.cx, y: C.cy } });
    this.state = 'countdown';
    this.stateT = countdown;
    this.banner = banner || 'FACE OFF';
    this.fx.beeped = {};
    this.powerup = null;
  }

  // --- actions --------------------------------------------------------------

  recordTouch(s) {
    if (this.touchHistory[0] && this.touchHistory[0].s === s) return;
    this.touchHistory.unshift({ s, team: s.team });
    if (this.touchHistory.length > 6) this.touchHistory.pop();
  }

  givePuck(ent) {
    this.puck.owner = ent;
    this.puck.rocket = false;
    this.puck.homeTo = null;
    if (!ent.isGoalie) this.recordTouch(ent);
  }

  releasePuck(speed, dir, opts) {
    const p = this.puck;
    const owner = p.owner;
    if (owner) {
      const sp = owner.isGoalie ? owner.pos : owner.stickPoint();
      p.pos = { x: sp.x, y: sp.y };
    }
    p.owner = null;
    p.vel = { x: dir.x * speed, y: dir.y * speed };
    p.noPick = owner;
    p.noPickT = 0.35;
    p.rocket = !!(opts && opts.rocket);
    p.homeTo = (opts && opts.homeTo) || null;
    p.homeT = p.homeTo ? 0.5 : 0;
  }

  shoot(s, charge) {
    if (this.puck.owner !== s) return;
    const C = H.CFG;
    const gx = this.attackGoalX(s.team);
    const goalie = this.goalies[s.team === 0 ? 1 : 0];
    // aim for the corner the goalie covers less, with difficulty-based error
    let cornerSign = goalie.pos.y > C.cy + 2 ? -1 : goalie.pos.y < C.cy - 2 ? 1 : (Math.random() < 0.5 ? -1 : 1);
    const err = s.controlledBy != null ? 10 : this.diff.shotErr;
    const targetY = C.cy + cornerSign * (C.goalHalf - 16) + H.M.rand(-err, err);
    let aim = H.M.norm(gx - this.puck.pos.x, targetY - this.puck.pos.y);
    // blend a bit of the player's own facing for manual control
    aim = H.M.norm(aim.x + s.facing.x * 0.22, aim.y + s.facing.y * 0.22);
    const rocket = s.eff.rocket > 0;
    const speed = (640 + 560 * H.M.clamp(charge, 0, 1)) * s.spec.shot * (rocket ? 1.5 : 1) * (s.eff.big > 0 ? 1.12 : 1);
    this.recordTouch(s);
    this.releasePuck(Math.min(speed, 1500), aim, { rocket });
    H.audio.shot();
    this.fx.shake = Math.max(this.fx.shake, rocket ? 6 : 2);
  }

  pass(s) {
    if (this.puck.owner !== s) return;
    const mates = this.teamSkaters(s.team).filter((m) => m !== s && !m.down);
    let best = null, bestScore = -1e9;
    for (const m of mates) {
      const d = H.M.dist(s.pos, m.pos);
      const dir = H.M.norm(m.pos.x - s.pos.x, m.pos.y - s.pos.y);
      const dot = dir.x * s.facing.x + dir.y * s.facing.y;
      const score = dot * 400 - d * 0.35;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    this.recordTouch(s);
    if (best) {
      const speed = 660;
      const t = H.M.dist(s.pos, best.pos) / speed;
      const lead = { x: best.pos.x + best.vel.x * t * 0.8, y: best.pos.y + best.vel.y * t * 0.8 };
      const dir = H.M.norm(lead.x - s.pos.x, lead.y - s.pos.y);
      this.releasePuck(speed, dir, { homeTo: best });
    } else {
      this.releasePuck(600, { ...s.facing });
    }
    H.audio.pass();
  }

  tryCheck(s) {
    if (s.checkCd > 0 || s.down || s.frozen) return;
    s.checkT = 0.24;
    s.checkCd = 0.95;
    const n = H.M.norm(s.facing.x, s.facing.y);
    s.vel.x += n.x * 400;
    s.vel.y += n.y * 400;
  }

  tryDeke(s) {
    if (s.dekeCd > 0 || s.down || s.frozen) return;
    if (H.M.len(s.input.x, s.input.y) < 0.2) return;
    const n = H.M.norm(s.input.x, s.input.y);
    s.vel.x += n.x * 450;
    s.vel.y += n.y * 450;
    s.immuneT = 0.4;
    s.dekeCd = 1.35;
  }

  knockdown(victim, attacker) {
    victim.fallT = 1.35;
    victim.charge = 0;
    const n = H.M.norm(victim.pos.x - attacker.pos.x, victim.pos.y - attacker.pos.y);
    const power = attacker.eff.big > 0 ? 640 : 460;
    victim.vel.x += n.x * power + attacker.vel.x * 0.35;
    victim.vel.y += n.y * power + attacker.vel.y * 0.35;
    attacker.stats.hits++;
    if (this.puck.owner === victim) {
      this.puck.owner = null;
      this.puck.pos = { x: victim.pos.x, y: victim.pos.y };
      this.puck.vel = { x: victim.vel.x * 0.6 + H.M.rand(-80, 80), y: victim.vel.y * 0.6 + H.M.rand(-80, 80) };
      this.puck.noPick = victim;
      this.puck.noPickT = 0.5;
    }
    H.audio.hit(attacker.eff.big > 0);
    this.fx.shake = Math.max(this.fx.shake, attacker.eff.big > 0 ? 12 : 7);
    this.spawnParticles(victim.pos.x, victim.pos.y, 14, '#ffffff', 260);
    this.popup(victim.pos.x, victim.pos.y - 40, attacker.eff.big > 0 ? 'HUGE HIT!' : 'HIT!', '#ffffff');
  }

  switchControl(player) {
    const candidates = this.teamSkaters(player.team)
      .filter((s) => s.controlledBy == null);
    if (!candidates.length) return;
    candidates.sort((a, b) => H.M.dist(a.pos, this.puck.pos) - H.M.dist(b.pos, this.puck.pos));
    const target = candidates[0];
    if (player.skater) player.skater.controlledBy = null;
    target.controlledBy = player.index;
    player.skater = target;
  }

  // --- fx helpers -------------------------------------------------------------

  spawnParticles(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * speed;
      this.fx.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, life: H.M.rand(0.3, 0.8), color, size: H.M.rand(2, 5),
      });
    }
  }

  popup(x, y, text, color) {
    this.fx.popups.push({ x, y, text, color, t: 0, life: 1.1 });
  }

  // --- power-ups ---------------------------------------------------------------

  updatePowerups(dt) {
    if (!this.cfg.powerups) return;
    if (!this.powerup) {
      this.powerupTimer -= dt;
      if (this.powerupTimer <= 0) {
        const types = Object.keys(H.POWERUPS);
        const C = H.CFG;
        this.powerup = {
          type: types[Math.floor(Math.random() * types.length)],
          pos: {
            x: H.M.rand(C.cx - 480, C.cx + 480),
            y: H.M.rand(C.rink.y + 120, C.rink.y + C.rink.h - 120),
          },
          age: 0,
        };
      }
      return;
    }
    this.powerup.age += dt;
    if (this.powerup.age > 12) { this.powerup = null; this.powerupTimer = H.M.rand(7, 13); return; }
    for (const s of this.skaters) {
      if (s.down) continue;
      if (H.M.dist(s.pos, this.powerup.pos) < s.radius + 20) {
        this.applyPowerup(s, this.powerup.type);
        this.powerup = null;
        this.powerupTimer = H.M.rand(9, 16);
        break;
      }
    }
  }

  applyPowerup(s, type) {
    const def = H.POWERUPS[type];
    const foes = this.teamSkaters(s.team === 0 ? 1 : 0);
    const foeGoalie = this.goalies[s.team === 0 ? 1 : 0];
    switch (type) {
      case 'speed': s.eff.speed = def.dur; break;
      case 'big': s.eff.big = def.dur; break;
      case 'rocket': s.eff.rocket = def.dur; break;
      case 'shield': s.eff.shield = def.dur; break;
      case 'freeze':
        foes.forEach((f) => { f.eff.freeze = def.dur; });
        H.audio.freeze();
        break;
      case 'tinyGoalie': foeGoalie.eff.tiny = def.dur; break;
    }
    H.audio.powerup(type);
    this.popup(s.pos.x, s.pos.y - 50, def.label + '!', def.color);
    this.spawnParticles(s.pos.x, s.pos.y, 18, def.color, 220);
  }

  // --- main update ---------------------------------------------------------------

  update(dt) {
    const inp = H.input;

    if (this.state === 'gameOver') {
      H.audio.setSkating(false);
      this.updateFx(dt);
      for (const dev of inp.allDevices()) {
        const st = inp.get(dev);
        if (st.pressed.start || st.pressed.shoot) this.finished = 'rematch';
        if (st.pressed.check) this.finished = 'quit';
      }
      if (inp.escPressed()) this.finished = 'quit';
      return;
    }

    // pause toggle
    let startPressed = false;
    for (const p of this.players) {
      if (inp.get(p.device).pressed.start) startPressed = true;
    }
    if (!this.players.length && inp.get('kb1').pressed.start) startPressed = true;

    if (this.paused) {
      H.audio.setSkating(false);
      this.handlePauseMenu();
      return;
    }
    if (startPressed || inp.escPressed()) {
      this.paused = true;
      this.pauseSel = 0;
      this.pauseMode = 'menu';
      H.audio.menuSelect();
      return;
    }

    this.updateFx(dt);

    switch (this.state) {
      case 'countdown': {
        H.audio.setSkating(false);
        this.stateT -= dt;
        const sec = Math.ceil(this.stateT);
        if (!this.fx.beeped[sec] && sec <= 3 && sec >= 1) {
          this.fx.beeped[sec] = true;
          H.audio.countBeep(false);
        }
        if (this.stateT <= 0) {
          this.state = 'play';
          H.audio.whistle();
          this.puck.vel = { x: H.M.rand(-60, 60), y: H.M.rand(-60, 60) };
        }
        break;
      }
      case 'play':
        this.updatePlay(dt);
        break;
      case 'goal':
        H.audio.setSkating(false);
        this.stateT -= dt;
        // let players glide during celebration
        for (const s of this.skaters) { s.input = { x: 0, y: 0 }; s.update(dt); H.collideBoards(s, s.radius, 0.3); }
        if (this.stateT <= 0) {
          if (this.otWinner != null) this.endGame();
          else this.faceoff(2.6, 'FACE OFF');
        }
        break;
      case 'periodEnd':
        H.audio.setSkating(false);
        this.stateT -= dt;
        if (this.stateT <= 0) {
          this.period++;
          if (this.period > 3) this.overtime = true;
          this.time = this.overtime ? Math.min(this.cfg.periodLen, 180) : this.cfg.periodLen;
          this.faceoff(3.2, this.overtime ? 'SUDDEN DEATH!' : 'PERIOD ' + this.period);
        }
        break;
    }
  }

  handlePauseMenu() {
    const inp = H.input;
    if (this.pauseMode === 'controls') {
      for (const dev of inp.allDevices()) {
        const st = inp.get(dev);
        if (st.pressed.start || st.pressed.shoot || st.pressed.pass || st.pressed.check || st.pressed.deke) {
          this.pauseMode = 'menu';
          H.audio.menuMove();
          return;
        }
      }
      if (inp.escPressed()) this.pauseMode = 'menu';
      return;
    }

    const items = 4; // resume, controls, restart, quit
    for (const dev of inp.allDevices()) {
      const st = inp.get(dev);
      if (st.pressed.up) { this.pauseSel = (this.pauseSel + items - 1) % items; H.audio.menuMove(); }
      if (st.pressed.down) { this.pauseSel = (this.pauseSel + 1) % items; H.audio.menuMove(); }
      if (st.pressed.start || st.pressed.shoot || st.pressed.pass) {
        H.audio.menuSelect();
        if (this.pauseSel === 0) this.paused = false;
        else if (this.pauseSel === 1) this.pauseMode = 'controls';
        else if (this.pauseSel === 2) this.finished = 'rematch';
        else this.finished = 'quit';
        return;
      }
    }
    if (inp.escPressed()) this.paused = false;
  }

  updatePlay(dt) {
    const inp = H.input;

    // clock
    this.time -= dt;
    if (this.time <= 0) {
      this.time = 0;
      this.endOfPeriod();
      return;
    }

    this.updatePowerups(dt);

    // human control
    for (const p of this.players) {
      const st = inp.get(p.device);
      if (st.pressed.switch) this.switchControl(p);
      const s = p.skater;
      if (!s) continue;
      s.input = { x: st.x, y: st.y };
      if (!s.down && !s.frozen) {
        if (this.puck.owner === s) {
          if (st.held.shoot) s.charge = Math.min(1, s.charge + dt / 0.7);
          if (st.released.shoot) { this.shoot(s, Math.max(0.3, s.charge)); s.charge = 0; }
          else if (st.pressed.shoot && !st.held.shoot) this.shoot(s, 0.3); // tap faster than a frame
          if (st.pressed.pass) this.pass(s);
        } else {
          s.charge = 0;
          if (st.pressed.check) this.tryCheck(s);
          if (st.pressed.shoot && H.M.dist(s.pos, this.puck.pos) < 90) this.tryCheck(s); // poke/lunge shortcut
        }
        if (st.pressed.deke) this.tryDeke(s);
      }
    }

    // AI control
    for (const s of this.skaters) {
      if (s.controlledBy == null) H.aiSkater(this, s, dt);
    }
    for (const g of this.goalies) H.aiGoalie(this, g, dt);

    // integrate
    for (const s of this.skaters) {
      s.update(dt);
      const hit = H.collideBoards(s, s.radius, 0.35);
      if (hit > 220) H.audio.boardThud();
      H.collideBox(s, s.radius, H.netBox(0), 0.2);
      H.collideBox(s, s.radius, H.netBox(1), 0.2);
    }
    for (const g of this.goalies) {
      g.update(dt);
      H.collideBoards(g, g.radius, 0.2);
    }

    this.collidePlayers(dt);
    this.updatePuck(dt);
    if (this.state === 'play') this.updateSkateAudio();
    else H.audio.setSkating(false);
  }

  updateSkateAudio() {
    let maxSpeed = 0;
    for (const ent of [...this.skaters, ...this.goalies]) {
      if (ent.frozen || ent.down) continue;
      maxSpeed = Math.max(maxSpeed, H.M.len(ent.vel.x, ent.vel.y));
    }
    H.audio.setSkating(maxSpeed > 35, H.M.clamp((maxSpeed - 35) / 300, 0, 1));
  }

  collidePlayers() {
    const all = [...this.skaters, ...this.goalies];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const rr = a.radius + b.radius;
        const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const n = { x: dx / d, y: dy / d };
        const overlap = rr - d;
        const ma = a.isGoalie ? 3.5 : a.mass;
        const mb = b.isGoalie ? 3.5 : b.mass;
        const tot = ma + mb;
        a.pos.x -= n.x * overlap * (mb / tot);
        a.pos.y -= n.y * overlap * (mb / tot);
        b.pos.x += n.x * overlap * (ma / tot);
        b.pos.y += n.y * overlap * (ma / tot);
        // velocity exchange along normal
        const rvx = b.vel.x - a.vel.x, rvy = b.vel.y - a.vel.y;
        const vn = rvx * n.x + rvy * n.y;
        if (vn < 0) {
          const imp = (-(1 + 0.25) * vn) / (1 / ma + 1 / mb);
          a.vel.x -= (imp / ma) * n.x;
          a.vel.y -= (imp / ma) * n.y;
          b.vel.x += (imp / mb) * n.x;
          b.vel.y += (imp / mb) * n.y;
        }
        // checking
        this.resolveCheck(a, b);
        this.resolveCheck(b, a);
      }
    }
  }

  resolveCheck(att, vic) {
    if (att.isGoalie || vic.isGoalie) return;
    if (att.team === vic.team) return;
    if (vic.down || vic.immuneT > 0 || vic.eff.shield > 0) return;
    const bigSteamroll = att.eff.big > 0 && vic.eff.big <= 0 && H.M.len(att.vel.x, att.vel.y) > 220;
    if (att.checkT > 0 || bigSteamroll) {
      att.checkT = 0;
      this.knockdown(vic, att);
    }
  }

  updatePuck(dt) {
    const p = this.puck;
    const C = H.CFG;
    p.noPickT = Math.max(0, p.noPickT - dt);
    if (p.noPickT <= 0) p.noPick = null;

    if (p.owner) {
      const o = p.owner;
      if (o.isGoalie) {
        p.pos = { x: o.pos.x + o.facing.x * (o.radius + 6), y: o.pos.y };
        o.holdT -= dt;
        if (o.holdT <= 0) this.goalieClear(o);
      } else {
        if (o.down || o.frozen) {
          // dropped
          p.owner = null;
          p.vel = { x: o.vel.x, y: o.vel.y };
        } else {
          const sp = o.stickPoint();
          p.pos = { x: sp.x, y: sp.y };
          p.vel = { x: o.vel.x, y: o.vel.y };
        }
      }
      return;
    }

    // free puck physics
    const steps = Math.max(1, Math.ceil(H.M.len(p.vel.x, p.vel.y) * dt / 6));
    for (let i = 0; i < steps; i++) {
      const sdt = dt / steps;
      p.pos.x += p.vel.x * sdt;
      p.pos.y += p.vel.y * sdt;
      if (this.checkGoal()) return;
    }
    const fr = Math.exp(-0.55 * dt);
    p.vel.x *= fr;
    p.vel.y *= fr;

    // mild homing on passes
    if (p.homeTo && p.homeT > 0) {
      p.homeT -= dt;
      const sp = H.M.len(p.vel.x, p.vel.y);
      if (sp > 60) {
        const want = H.M.norm(p.homeTo.pos.x - p.pos.x, p.homeTo.pos.y - p.pos.y);
        const cur = H.M.norm(p.vel.x, p.vel.y);
        const mixed = H.M.norm(cur.x + want.x * 0.12, cur.y + want.y * 0.12);
        p.vel.x = mixed.x * sp;
        p.vel.y = mixed.y * sp;
      }
    }

    // posts
    for (let side = 0; side < 2; side++) {
      const gx = C.goalX[side];
      for (const sy of [-1, 1]) {
        const post = { x: gx, y: C.cy + sy * C.goalHalf };
        const d = H.M.dist(p.pos, post);
        const rr = C.puckR + C.postR;
        if (d < rr && d > 0.001) {
          const n = H.M.norm(p.pos.x - post.x, p.pos.y - post.y);
          p.pos.x = post.x + n.x * rr;
          p.pos.y = post.y + n.y * rr;
          const vn = p.vel.x * n.x + p.vel.y * n.y;
          if (vn < 0) {
            p.vel.x -= 1.85 * vn * n.x;
            p.vel.y -= 1.85 * vn * n.y;
            if (H.M.len(p.vel.x, p.vel.y) > 300) { H.audio.post(); H.audio.ooh(); this.popup(post.x, post.y - 30, 'PING!', '#ffd54a'); }
          }
        }
      }
    }

    // nets (solid except handled goal mouth)
    for (let side = 0; side < 2; side++) {
      if (H.collideBox(p, C.puckR, H.netBox(side), 0.4)) break;
    }

    const hit = H.collideBoards(p, C.puckR, 0.72);
    if (hit > 320) H.audio.boardThud();

    // goalie interactions
    for (const g of this.goalies) {
      this.goaliePuck(g, dt);
      if (p.owner) return;
    }

    // pickup by skaters
    let best = null, bestD = 1e9;
    for (const s of this.skaters) {
      if (s.down || s.frozen) continue;
      if (p.noPick === s && p.noPickT > 0) continue;
      const sp = s.stickPoint();
      const d = Math.min(H.M.dist(sp, p.pos), H.M.dist(s.pos, p.pos));
      const reach = s.radius + 16;
      if (d < reach && d < bestD) { best = s; bestD = d; }
    }
    if (best) {
      const speed = H.M.len(p.vel.x, p.vel.y);
      // fast pucks are harder to corral unless you're the pass target
      if (speed < 520 || p.homeTo === best || Math.random() < 0.5) {
        this.givePuck(best);
      }
    }
  }

  goaliePuck(g) {
    const p = this.puck;
    const d = H.M.dist(g.pos, p.pos);
    const rr = g.radius + H.CFG.puckR + 4;
    if (d >= rr) return;
    if (p.noPick === g && p.noPickT > 0) return;
    const speed = H.M.len(p.vel.x, p.vel.y);
    // moving toward goalie's net?
    if (speed > 150) {
      let catchP = 0.78 - speed / 2100 + this.diff.goalieCatch;
      if (p.rocket) catchP -= 0.38;
      if (g.eff.tiny > 0) catchP *= 0.3;
      g.stats.saves++;
      if (Math.random() < H.M.clamp(catchP, 0.06, 0.95)) {
        // catch & cover
        p.owner = g;
        p.rocket = false;
        p.homeTo = null;
        g.holdT = 0.85;
        H.audio.save();
        this.popup(g.pos.x, g.pos.y - 46, 'SAVE!', '#ffffff');
        H.audio.ooh();
      } else {
        // deflect
        const n = H.M.norm(p.pos.x - g.pos.x, p.pos.y - g.pos.y);
        const vn = p.vel.x * n.x + p.vel.y * n.y;
        if (vn < 0) {
          p.vel.x -= 1.6 * vn * n.x;
          p.vel.y -= 1.6 * vn * n.y;
        }
        const a = H.M.rand(-0.5, 0.5);
        const c = Math.cos(a), s2 = Math.sin(a);
        const vx = p.vel.x * c - p.vel.y * s2, vy = p.vel.x * s2 + p.vel.y * c;
        p.vel.x = vx * 0.55; p.vel.y = vy * 0.55;
        p.pos.x = g.pos.x + n.x * rr;
        p.pos.y = g.pos.y + n.y * rr;
        p.noPick = g;
        p.noPickT = 0.4;
        p.rocket = false;
        H.audio.save();
      }
    } else {
      // slow puck: goalie corrals and clears
      p.owner = g;
      g.holdT = 0.5;
    }
  }

  goalieClear(g) {
    const mates = this.teamSkaters(g.team).filter((s) => !s.down);
    let target = null, bestD = 1e9;
    for (const m of mates) {
      const d = H.M.dist(g.pos, m.pos);
      if (d < bestD) { bestD = d; target = m; }
    }
    const dir = target
      ? H.M.norm(target.pos.x - g.pos.x, target.pos.y - g.pos.y)
      : { x: g.team === 0 ? 1 : -1, y: H.M.rand(-0.5, 0.5) };
    this.puck.owner = null;
    this.puck.pos = { x: g.pos.x + dir.x * (g.radius + 14), y: g.pos.y + dir.y * (g.radius + 14) };
    this.releasePuck(560, dir, { homeTo: target });
    H.audio.pass();
  }

  checkGoal() {
    const p = this.puck;
    const C = H.CFG;
    if (Math.abs(p.pos.y - C.cy) >= C.goalHalf - 2) return false;
    let scoringTeam = null;
    if (p.vel.x < 0 && p.pos.x < C.goalX[0] - C.puckR + 2) scoringTeam = 1;
    if (p.vel.x > 0 && p.pos.x > C.goalX[1] + C.puckR - 2) scoringTeam = 0;
    if (scoringTeam == null) return false;
    this.goalScored(scoringTeam);
    return true;
  }

  goalScored(team) {
    H.audio.setSkating(false);
    this.score[team]++;
    // attribution
    let scorer = null, assist = null;
    for (const t of this.touchHistory) {
      if (t.team === team) {
        if (!scorer) scorer = t.s;
        else if (!assist && t.s !== scorer) { assist = t.s; break; }
      }
    }
    if (scorer) scorer.stats.goals++;
    if (assist) assist.stats.assists++;
    this.celeb = { team, scorer, assist };
    this.state = 'goal';
    this.stateT = 3.0;
    if (this.overtime) this.otWinner = team;
    this.fx.flash = 1;
    this.fx.shake = 15;
    this.fx.goalLight = { side: team === 0 ? 1 : 0, t: 3.0 };
    const netX = this.attackGoalX(team);
    this.spawnParticles(netX, H.CFG.cy, 40, this.teams[team].color, 380);
    this.spawnParticles(netX, H.CFG.cy, 30, '#ffffff', 300);
    H.audio.goalHorn();
    this.puck.vel = { x: 0, y: 0 };
    this.puck.owner = null;
  }

  endOfPeriod() {
    H.audio.setSkating(false);
    H.audio.buzzer();
    if (this.period < 3) {
      this.state = 'periodEnd';
      this.stateT = 2.6;
      this.banner = 'END OF PERIOD ' + this.period;
    } else if (this.score[0] === this.score[1]) {
      this.state = 'periodEnd';
      this.stateT = 2.6;
      this.banner = 'OVERTIME!';
    } else {
      this.endGame();
    }
  }

  endGame() {
    H.audio.setSkating(false);
    this.state = 'gameOver';
    const winner = this.score[0] > this.score[1] ? 0 : 1;
    this.winner = winner;
    // three stars
    const cands = [];
    for (const s of this.skaters) {
      cands.push({ ent: s, pts: s.stats.goals * 3 + s.stats.assists * 2 + s.stats.hits * 0.3, line: this.starLine(s) });
    }
    for (const g of this.goalies) {
      cands.push({ ent: g, pts: g.stats.saves * 0.12 + (this.score[g.team === 0 ? 1 : 0] === 0 ? 6 : 0), line: g.spec.name + '  ' + g.stats.saves + ' SVS' });
    }
    cands.sort((a, b) => b.pts - a.pts);
    this.stars = cands.slice(0, 3);
    H.audio.cheer(2.5);
  }

  starLine(s) {
    return s.spec.name + '  ' + s.stats.goals + 'G ' + s.stats.assists + 'A ' + s.stats.hits + 'H';
  }

  updateFx(dt) {
    const fx = this.fx;
    fx.shake = Math.max(0, fx.shake - 40 * dt);
    fx.flash = Math.max(0, fx.flash - 1.6 * dt);
    if (fx.goalLight) {
      fx.goalLight.t -= dt;
      if (fx.goalLight.t <= 0) fx.goalLight = null;
    }
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const pt = fx.particles[i];
      pt.t += dt;
      if (pt.t > pt.life) { fx.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
    }
    for (let i = fx.popups.length - 1; i >= 0; i--) {
      const pp = fx.popups[i];
      pp.t += dt;
      pp.y -= 30 * dt;
      if (pp.t > pp.life) fx.popups.splice(i, 1);
    }
    // puck trail
    const p = this.puck;
    if (!p.owner && H.M.len(p.vel.x, p.vel.y) > 350) {
      p.trail.push({ x: p.pos.x, y: p.pos.y, t: 0 });
    }
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].t += dt;
      if (p.trail[i].t > 0.3) p.trail.splice(i, 1);
    }
  }
}

H.Match = Match;
