# 3 ON 3 ICE HOCKEY ARCADE 🏒

A browser-based homage to *3-on-3 NHL Arcade*: over-the-top 3v3 hockey with big
heads, big hits, power-ups, and **no rules** — no offsides, no penalties, no mercy.

Everything is rendered on a `<canvas>` and all sound is synthesized with WebAudio —
zero dependencies, zero build step, zero assets.

## Play

Open `index.html` in any modern browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Features

- **3v3 arcade hockey** — 3 skaters + an AI goalie per team, on a full rink with
  boards physics, posts, creases and wraparounds behind the net
- **Up to 4 human players** on any mix of teams — 2 keyboard layouts + up to 4
  gamepads (Gamepad API, standard mapping), drop-in lobby ("press PASS to join")
- **AI teammates & opponents** fill every remaining slot (3 difficulty levels)
- **Power-ups** spawn on the ice: TURBO, BIG MAN, ROCKET SHOT, FREEZE,
  TINY GOALIE, JUGGERNAUT (can be toggled off)
- **Big hits** — body checks, knockdowns, dizzy stars, huge-hit steamrolls when big
- **Full match flow** — faceoff countdowns, 3 periods (1–5 min), running clock,
  sudden-death overtime, goal horn + goal light + celebrations, three stars
- **Skill moves** — charged shots with auto-aim, lead passes, dekes with brief
  check-immunity, player switching, goalie saves/covers/clears
- **Stats** — goals, assists, hits, saves; scorer + assist credited on every goal
- **Juice** — screen shake, particles, popups, puck trails, synthesized crowd,
  horn, whistle, post *ping*

## Controls

| Action | P1 (keyboard) | P2 (keyboard) | Gamepad |
|---|---|---|---|
| Skate | `W A S D` | Arrow keys | Left stick / D-pad |
| Pass | `F` | `,` | X / Square |
| Shoot (hold = charge) | `G` | `.` | A / Cross |
| Body check | `H` | `/` | B / Circle |
| Switch skater | `R` | `M` | Y / Triangle |
| Deke (dodge) | `Left Shift` | `Right Shift` | RB / R1 |
| Start / Pause | `Enter` | `Enter` | Start |

`Esc` pauses / backs out. `M` toggles mute (in menus & pause).

### Lobby

- **PASS** to join (up to 4 players), **DEKE** to leave
- **◀ ▶** to switch team (max 3 humans per team)
- **▲ ▼** to highlight a setting, **SHOOT** to change it
  (period length, difficulty, power-ups)
- **START / Enter** to hit the ice

## Tips

- Hold **shoot** to charge a slap shot — release near the net.
- Shots auto-aim at the corner the goalie isn't covering.
- Check the puck carrier to force a turnover, then counter fast.
- Grab **BIG MAN** and just skate through people.
- **ROCKET SHOT** shots are nearly uncatchable — even more so on a **TINY GOALIE**.
