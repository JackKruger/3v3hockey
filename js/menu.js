// ---------------------------------------------------------------------------
// menu.js — title screen + lobby (join up to 4 players, teams, settings)
// ---------------------------------------------------------------------------
window.H = window.H || {};

H.menu = (function () {
  const FONT = '"Arial Black", "Impact", sans-serif';
  const PERIODS = [60, 120, 180, 300];
  const DIFFS = ['easy', 'med', 'hard'];
  const DIFF_LABEL = { easy: 'EASY', med: 'MEDIUM', hard: 'HARD' };
  const DEVICE_LABEL = {
    kb1: 'KEYBOARD — WASD', kb2: 'KEYBOARD — ARROWS',
    pad0: 'GAMEPAD 1', pad1: 'GAMEPAD 2', pad2: 'GAMEPAD 3', pad3: 'GAMEPAD 4',
  };

  let state = 'title';
  let t = 0;
  let players = []; // {device, name, color, team}
  const settings = { periodIdx: 2, diffIdx: 1, powerups: true, view3d: true };
  let cursor = 0; // shared settings cursor: 0 view, 1 period, 2 difficulty, 3 powerups
  const ROWS = 4;
  let startCfg = null;

  function reset(to) {
    state = to || 'title';
    startCfg = null;
  }

  function joined(dev) { return players.find((p) => p.device === dev); }

  function join(dev) {
    if (players.length >= 4 || joined(dev)) return;
    const idx = players.length;
    // default: alternate teams, but never more than 3 per team
    let team = idx % 2;
    if (players.filter((p) => p.team === team).length >= 3) team = 1 - team;
    players.push({ device: dev, name: 'P' + (idx + 1), color: H.PLAYER_COLORS[idx], team });
    H.audio.menuSelect();
  }

  function leave(dev) {
    const i = players.findIndex((p) => p.device === dev);
    if (i < 0) return;
    players.splice(i, 1);
    players.forEach((p, j) => { p.name = 'P' + (j + 1); p.color = H.PLAYER_COLORS[j]; });
    H.audio.menuMove();
  }

  function buildConfig() {
    if (!players.length) join('kb1');
    return {
      periodLen: PERIODS[settings.periodIdx],
      difficulty: DIFFS[settings.diffIdx],
      powerups: settings.powerups,
      view: settings.view3d ? '3d' : '2d',
      players: players.map((p) => ({ ...p })),
    };
  }

  function update(dt) {
    t += dt;
    const inp = H.input;

    if (state === 'title') {
      for (const dev of inp.allDevices()) {
        const st = inp.get(dev);
        if (st.pressed.start || st.pressed.shoot || st.pressed.pass) {
          state = 'lobby';
          H.audio.menuSelect();
          return;
        }
      }
      return;
    }

    // lobby
    for (const dev of inp.allDevices()) {
      const st = inp.get(dev);
      const p = joined(dev);
      if (st.pressed.pass && !p) join(dev);
      if (!p) continue;
      if (st.pressed.deke) leave(dev);
      if (st.pressed.left || st.pressed.right) {
        const other = 1 - p.team;
        if (players.filter((q) => q.team === other).length < 3) {
          p.team = other;
          H.audio.menuMove();
        }
      }
      if (st.pressed.up) { cursor = (cursor + ROWS - 1) % ROWS; H.audio.menuMove(); }
      if (st.pressed.down) { cursor = (cursor + 1) % ROWS; H.audio.menuMove(); }
      if (st.pressed.shoot) {
        H.audio.menuMove();
        if (cursor === 0) settings.view3d = !settings.view3d;
        else if (cursor === 1) settings.periodIdx = (settings.periodIdx + 1) % PERIODS.length;
        else if (cursor === 2) settings.diffIdx = (settings.diffIdx + 1) % DIFFS.length;
        else settings.powerups = !settings.powerups;
      }
      if (st.pressed.start) {
        startCfg = buildConfig();
        H.audio.menuSelect();
        return;
      }
    }
    // Enter also starts from kb even if that kb device isn't joined
    if (inp.get('kb1').pressed.start && players.length) {
      startCfg = buildConfig();
      H.audio.menuSelect();
    }
    if (inp.escPressed()) reset('title');
  }

  function takeStart() {
    const c = startCfg;
    startCfg = null;
    return c;
  }

  // --- drawing ------------------------------------------------------------------

  function drawTitle(g) {
    const cfg = H.CFG;
    g.textAlign = 'center';
    g.textBaseline = 'middle';

    const bob = Math.sin(t * 2) * 8;
    g.fillStyle = '#7ae8ff';
    g.font = '900 44px ' + FONT;
    g.fillText('3 ON 3', cfg.W / 2, 200 + bob);
    g.fillStyle = '#ffffff';
    g.font = '900 110px ' + FONT;
    g.shadowColor = '#2f72e0';
    g.shadowBlur = 30;
    g.fillText('ICE HOCKEY', cfg.W / 2, 310 + bob);
    g.shadowBlur = 0;
    g.fillStyle = '#ffd54a';
    g.font = '900 54px ' + FONT;
    g.fillText('★ ARCADE ★', cfg.W / 2, 410 + bob);

    if (Math.floor(t * 2) % 2 === 0) {
      g.fillStyle = '#ffffff';
      g.font = '900 30px ' + FONT;
      g.fillText('PRESS ENTER / START', cfg.W / 2, 550);
    }

    g.fillStyle = '#8fa3cc';
    g.font = '900 17px ' + FONT;
    g.fillText('P1: WASD + F PASS · G SHOOT · H CHECK · R SWITCH · L-SHIFT DEKE', cfg.W / 2, 660);
    g.fillText('P2: ARROWS + , PASS · . SHOOT · / CHECK · M SWITCH · R-SHIFT DEKE', cfg.W / 2, 695);
    g.fillText('GAMEPADS: STICK MOVE · X PASS · A SHOOT (HOLD) · B CHECK · Y SWITCH · RB DEKE', cfg.W / 2, 730);
    g.fillStyle = '#55668f';
    g.fillText('UP TO 4 PLAYERS · BIG HITS · POWER-UPS · NO RULES', cfg.W / 2, 790);
  }

  function drawLobby(g) {
    const cfg = H.CFG;
    g.textAlign = 'center';
    g.textBaseline = 'middle';

    g.fillStyle = '#ffffff';
    g.font = '900 52px ' + FONT;
    g.fillText('LOCKER ROOM', cfg.W / 2, 90);

    // team columns
    for (let team = 0; team < 2; team++) {
      const tm = H.TEAMS[team];
      const x = team === 0 ? cfg.W / 2 - 330 : cfg.W / 2 + 330;
      g.fillStyle = tm.color;
      g.font = '900 36px ' + FONT;
      g.fillText(tm.name, x, 170);
      g.strokeStyle = tm.dark;
      g.lineWidth = 3;
      H.render.roundRectPath(g, x - 240, 200, 480, 300, 16);
      g.fillStyle = 'rgba(20,28,50,0.7)';
      g.fill();
      g.stroke();

      const teamPlayers = players.filter((p) => p.team === team);
      if (!teamPlayers.length) {
        g.fillStyle = '#55668f';
        g.font = '900 20px ' + FONT;
        g.fillText('CPU TEAM', x, 350);
      }
      teamPlayers.forEach((p, i) => {
        const y = 245 + i * 85;
        g.fillStyle = 'rgba(10,14,26,0.9)';
        g.strokeStyle = p.color;
        g.lineWidth = 3;
        H.render.roundRectPath(g, x - 210, y - 32, 420, 66, 10);
        g.fill();
        g.stroke();
        g.fillStyle = p.color;
        g.font = '900 26px ' + FONT;
        g.textAlign = 'left';
        g.fillText(p.name, x - 190, y);
        g.fillStyle = '#c8d4ee';
        g.font = '900 16px ' + FONT;
        g.fillText(DEVICE_LABEL[p.device] || p.device, x - 120, y);
        g.textAlign = 'center';
        g.fillStyle = '#7a8bb0';
        g.font = '900 13px ' + FONT;
        g.fillText('◀▶ TEAM', x + 160, y);
      });
    }

    g.fillStyle = Math.floor(t * 2) % 2 === 0 ? '#ffd54a' : '#c8a020';
    g.font = '900 22px ' + FONT;
    g.fillText('PRESS PASS ( F / , / X ) TO JOIN — DEKE TO LEAVE', cfg.W / 2, 545);

    // settings
    const rows = [
      ['VIEW', settings.view3d ? '3D ARCADE CAM' : '2D CLASSIC'],
      ['PERIOD LENGTH', H.render.fmtTime(PERIODS[settings.periodIdx])],
      ['DIFFICULTY', DIFF_LABEL[DIFFS[settings.diffIdx]]],
      ['POWER-UPS', settings.powerups ? 'ON' : 'OFF'],
    ];
    rows.forEach((r, i) => {
      const y = 596 + i * 42;
      const sel = cursor === i;
      g.fillStyle = sel ? '#ffffff' : '#7a8bb0';
      g.font = '900 ' + (sel ? 24 : 20) + 'px ' + FONT;
      g.textAlign = 'right';
      g.fillText(r[0], cfg.W / 2 - 30, y);
      g.textAlign = 'left';
      g.fillStyle = sel ? '#ffd54a' : '#9fb2d8';
      g.fillText((sel ? '▶ ' : '') + r[1], cfg.W / 2 + 30, y);
    });
    g.textAlign = 'center';
    g.fillStyle = '#55668f';
    g.font = '900 15px ' + FONT;
    g.fillText('UP/DOWN SELECT SETTING · SHOOT CHANGE IT', cfg.W / 2, 760);
    g.fillStyle = '#ffffff';
    g.font = '900 28px ' + FONT;
    g.fillText('PRESS START / ENTER TO HIT THE ICE', cfg.W / 2, 820);
  }

  function render(g) {
    const cfg = H.CFG;
    // reuse rink background, dimmed
    g.drawImage(getBg(), 0, 0);
    g.fillStyle = 'rgba(6,9,18,0.82)';
    g.fillRect(0, 0, cfg.W, cfg.H);
    if (state === 'title') drawTitle(g);
    else drawLobby(g);
  }

  let bgCache = null;
  function getBg() {
    if (!bgCache) bgCache = H.render.makeBackground();
    return bgCache;
  }

  return { update, render, takeStart, reset };
})();
