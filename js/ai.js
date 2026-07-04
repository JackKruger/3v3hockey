// ---------------------------------------------------------------------------
// ai.js — skater & goalie AI. Sets entity input / performs actions via match.
// ---------------------------------------------------------------------------
window.H = window.H || {};

(function () {
  const M = H.M;

  function moveToward(s, tx, ty, speedMult) {
    const dx = tx - s.pos.x, dy = ty - s.pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 14) { s.input = { x: 0, y: 0 }; return; }
    const n = M.norm(dx, dy);
    const m = Math.min(1, speedMult);
    s.input = { x: n.x * m, y: n.y * m };
  }

  // rank of skater s among team skaters by distance to point (0 = closest)
  function rankByDist(match, s, pt) {
    const mates = match.teamSkaters(s.team);
    const ds = mates.map((m) => M.dist(m.pos, pt)).sort((a, b) => a - b);
    return ds.indexOf(M.dist(s.pos, pt));
  }

  H.aiSkater = function (match, s, dt) {
    const diff = match.diff;
    const puck = match.puck;
    const C = H.CFG;
    const dir = s.team === 0 ? 1 : -1;
    const myGoalX = match.defendGoalX(s.team);
    const atkGoalX = match.attackGoalX(s.team);
    const sp = diff.aiSpeed;

    s.ai.decideT = (s.ai.decideT || 0) - dt;

    if (s.down || s.frozen) { s.input = { x: 0, y: 0 }; return; }

    const owner = puck.owner;
    const iHaveIt = owner === s;
    const myTeamHasIt = owner && !owner.isGoalie && owner.team === s.team;
    const oppHasIt = owner && !owner.isGoalie && owner.team !== s.team;
    const oppGoalieHasIt = owner && owner.isGoalie && owner.team !== s.team;

    if (iHaveIt) {
      // --- carrier: attack the net -----------------------------------------
      const goalPt = { x: atkGoalX, y: C.cy };
      const dGoal = M.dist(s.pos, goalPt);
      // nearest defender
      let nearOpp = null, nearD = 1e9;
      for (const o of match.teamSkaters(s.team === 0 ? 1 : 0)) {
        if (o.down) continue;
        const d = M.dist(o.pos, s.pos);
        if (d < nearD) { nearD = d; nearOpp = o; }
      }
      // shoot?
      const inRange = dGoal < 515 && Math.abs(s.pos.y - C.cy) < 290;
      const pointBlank = dGoal < 220;
      s.ai.shootT = (s.ai.shootT || 0) - dt;
      if (
        (inRange && s.ai.shootT <= 0 && Math.random() < diff.react * 0.06) ||
        (pointBlank && Math.random() < diff.pointBlankShoot)
      ) {
        match.shoot(s, M.rand(0.55, 1.0));
        s.ai.shootT = 0.8;
        return;
      }
      // pass if pressured and a mate is more open / closer to net
      if (nearD < 110 && Math.random() < diff.react * 0.12) {
        const mates = match.teamSkaters(s.team).filter((m) => m !== s && !m.down && !m.frozen);
        for (const m of mates) {
          let mNearD = 1e9;
          for (const o of match.teamSkaters(s.team === 0 ? 1 : 0)) {
            mNearD = Math.min(mNearD, M.dist(o.pos, m.pos));
          }
          const mDGoal = M.dist(m.pos, goalPt);
          if (mNearD > 130 && mDGoal < dGoal + 150) {
            match.pass(s);
            return;
          }
        }
      }
      // deke around close defender sometimes
      if (nearOpp && nearD < 95 && s.dekeCd <= 0 && Math.random() < diff.react * 0.05) {
        const away = M.norm(s.pos.y - nearOpp.pos.y, -(s.pos.x - nearOpp.pos.x));
        s.input = { x: away.x, y: away.y };
        match.tryDeke(s);
      }
      // steer to net, weaving away from the nearest defender
      let steer = M.norm(goalPt.x - s.pos.x, goalPt.y - s.pos.y);
      if (nearOpp && nearD < 200) {
        const avoid = M.norm(s.pos.x - nearOpp.pos.x, s.pos.y - nearOpp.pos.y);
        steer = M.norm(steer.x + avoid.x * 0.7, steer.y + avoid.y * 0.7);
      }
      s.input = { x: steer.x * sp, y: steer.y * sp };
      return;
    }

    if (myTeamHasIt) {
      // --- support: drive far post / trail the slot -------------------------
      const carrier = owner;
      const mates = match.teamSkaters(s.team).filter((m) => m !== carrier);
      const which = mates.indexOf(s); // 0 or 1
      const sideSign = carrier.pos.y > C.cy ? -1 : 1;
      let target;
      if (which === 0) {
        target = { x: atkGoalX - dir * 90, y: C.cy + sideSign * 110 };
      } else {
        target = { x: atkGoalX - dir * 380, y: C.cy - sideSign * 140 };
      }
      moveToward(s, target.x, target.y, sp);
      return;
    }

    if (oppHasIt || oppGoalieHasIt) {
      // --- defend: closest chases & checks, other protects the net ----------
      const carrier = owner;
      const rank = rankByDist(match, s, carrier.pos);
      if (rank === 0 && !oppGoalieHasIt) {
        moveToward(s, carrier.pos.x + carrier.vel.x * 0.15, carrier.pos.y + carrier.vel.y * 0.15, sp);
        if (M.dist(s.pos, carrier.pos) < s.radius + carrier.radius + 26 && s.checkCd <= 0) {
          match.tryCheck(s);
        }
      } else if (rank === 1) {
        // cut the lane between carrier and my net
        const netPt = { x: myGoalX, y: C.cy };
        const mid = { x: M.lerp(carrier.pos.x, netPt.x, 0.45), y: M.lerp(carrier.pos.y, netPt.y, 0.45) };
        moveToward(s, mid.x, mid.y, sp);
      } else {
        // last man: park in front of the crease
        moveToward(s, myGoalX + dir * 130, C.cy + (s.idx - 1) * 60, sp);
      }
      return;
    }

    // --- loose puck --------------------------------------------------------
    const predicted = { x: puck.pos.x + puck.vel.x * 0.22, y: puck.pos.y + puck.vel.y * 0.22 };
    const rank = rankByDist(match, s, predicted);
    if (rank <= 1) {
      moveToward(s, predicted.x, predicted.y, sp);
      // lunge at nearby opponents fighting for the puck
      if (s.checkCd <= 0) {
        for (const o of match.teamSkaters(s.team === 0 ? 1 : 0)) {
          if (!o.down && M.dist(o.pos, s.pos) < 55 && M.dist(o.pos, puck.pos) < 80) {
            match.tryCheck(s);
            break;
          }
        }
      }
    } else {
      // hang back defensively
      const homeX = myGoalX + dir * 250;
      moveToward(s, homeX, C.cy + (s.idx - 1) * 90, sp * 0.9);
    }
  };

  H.aiGoalie = function (match, g, dt) {
    const C = H.CFG;
    const puck = match.puck;
    const dir = g.team === 0 ? 1 : -1;

    if (g.down) return;
    if (g.frozen) { g.vel = { x: 0, y: 0 }; return; }
    if (puck.owner === g) { g.vel = { x: 0, y: 0 }; return; }

    // track predicted puck position
    const react = match.diff.react;
    const pp = {
      x: puck.pos.x + puck.vel.x * 0.12 * react,
      y: puck.pos.y + puck.vel.y * 0.12 * react,
    };
    const netY = C.cy;
    const maxY = C.goalHalf + 12;
    // come out a bit when the puck is near, hug the line otherwise
    const puckDist = Math.abs(pp.x - g.home.x);
    const outX = puckDist < 420 ? 20 : 6;
    const tx = C.goalX[g.team] + dir * outX;
    const ty = netY + M.clamp(pp.y - netY, -maxY, maxY) * 0.92;

    const k = match.diff.goalieK * (g.eff.tiny > 0 ? 0.72 : 1);
    g.vel.x = (tx - g.pos.x) * k;
    g.vel.y = (ty - g.pos.y) * k;
    const spd = M.len(g.vel.x, g.vel.y);
    const cap = 420;
    if (spd > cap) {
      g.vel.x *= cap / spd;
      g.vel.y *= cap / spd;
    }
    g.facing = { x: dir, y: 0 }; // faces the play
    // clamp near crease
    g.pos.y = M.clamp(g.pos.y, netY - maxY, netY + maxY);
    g.pos.x = M.clamp(g.pos.x, C.goalX[g.team] - 4 + (dir > 0 ? 0 : -30), C.goalX[g.team] + (dir > 0 ? 34 : 4));
  };
})();
