# ⚽ Pitch Perfect

A game for 10–13 year olds that teaches **where to be on a soccer field**: team spacing,
real possession play (pass, shoot, tackle, keepers), set pieces, and the **offside rule** from both sides.
Every mistake gets a "What went wrong?" popup with a picture of the exact moment.

Works on a MacBook (Safari/Chrome) and on an iPad (touch joystick + buttons).

## 1. Play solo (no install)

Double-click `index.html`. Everything except Online Match works straight from the file.

## 2. Play online (multiplayer)

The server runs the match so everyone sees the same game. Needs [Node.js](https://nodejs.org) 18+.

```bash
cd soccer-spacing-game
npm install        # once
npm start          # ⚽ Pitch Perfect running at http://localhost:8080
```

- **Same Wi-Fi (easiest for iPads):** on the Mac find your IP (System Settings → Wi-Fi → Details, e.g. `192.168.1.23`).
  Everyone opens `http://192.168.1.23:8080`, one person creates a room and shares the 4-letter code.
- **On the internet:** see **[DEPLOY.md](DEPLOY.md)** for click-by-click steps on Render's free tier (about 15 minutes).
  Railway, Fly.io and Docker (`Dockerfile` included) work the same way.

Up to 22 humans per room; empty positions are played by the AI. Players can join a match that already started.
Match length: 4 minutes in two halves (`MATCH_SECONDS=300 npm start` to change). Teams switch ends at halftime.

## The modes

| Mode | What it teaches |
|------|-----------------|
| 🎓 **First Game** | 60-second guided game. Move, receive, pass, dribble, shoot, and learn the offside line on the field. Nobody tackles you. |
| 🏟️ **Match vs AI** | 11 v 11 with real possession. Pass (Space), shoot (X), tackle by running into the ball carrier. Keepers catch, parry and distribute. Offside is called. Halftime stats, goal replays, final-minute drama. |
| 🌐 **Online Match** | Same match, with friends. Create a room, share the code or link, pick a team and position. |
| 🌍 **Shape Shift** | Spacing drill: spread out with the ball, squeeze without it, slide with the ball, never crowd a teammate. |
| 🎯 **Striker Timing** | Offside from the attacker's view. A live 3-question checklist shows exactly why you are on or offside. |
| 🛡️ **Defender Trap** | Offside from the defender's view. Step the back line up to trap, or drop to cover. |
| 🙌 **Throw-in Thinking** | Pick the free teammate fast, plus the throw-in rules (no offside from a throw-in!). |
| 🔥 **Press vs Drop** | They have the ball: go win it, or slow him down? Read the cues: where is he facing, is your team set? |
| 🚩 **Corner Attack** | Start deep, arrive as the ball arrives, attack the ball. Win the header. |

## Your player (avatars)

The first time you play, you pick your player. Two sets:

- **Kids set:** big-head "bobblehead" players, 8 hairstyles, headband or glasses.
- **Teen+ set:** realistic proportions, 10 hairstyles (fade, locs, braids, hijab…), builds, stubble or beard, captain band, wrist tape.
  On the field the Teen+ body is seen from above and turns the way it runs, with a real stride, plants, kicks, slide tackles and keeper dives.

Boy/girl (or male/female) only sets the starting look; every hairstyle works for everyone. Change it any time with **Edit avatar** on the menu or in the lobby.
AI players get random avatars from the same set. Online, everyone sees everyone's own avatar.

## Camera

**Full field** (default) or **Follow the ball** (zoomed in, follows the action). Toggle with **Z**, the camera button in the match, or in the avatar screen.

## The rules that confuse everyone (built into every mode)

One shared **rule library** (32 cards) covers the Laws people argue about: offside exceptions, handball, the keeper's
back-pass and 8-second rules, throw-ins, corners and goal kicks, fouls, cards, advantage, and "the whole ball".
It plugs into the modes you already play, so there is no separate "rules mode":

- **Match:** real incidents happen in play. Tackles from behind can be fouls (free kick, yellow card) or a **penalty** inside the box.
  Sometimes the referee plays **advantage**. Blocks can be **handball** (arm out wide) or not (arm tucked in). A kicked **back-pass**
  must be played with the keeper's feet. A human keeper who holds the ball over **8 seconds** gives away a corner (2025/26 rule).
  Each incident gets a whistle, a banner and a coach explainer. **Halftime** asks one "Ref's call" question.
- **Drills:** Throw-in Thinking, Press vs Drop and Corner Attack each include a "Rule check" round from the library, matched to the drill.
- **Offside trainers:** round 4 of Striker Timing is a **throw-in** (no offside, go as deep as you like); round 4 of Defender Trap is a
  **goal kick** (the trap cannot work, so drop and cover). The live checklist shows the exception.
- **Rule book** (menu): every rule in plain words, a ✓ for the ones you have answered right, and a 5-question quiz. Your **Ref IQ**
  shows on results and report cards.

## "What went wrong?" popups

The coach pops up (with a mini-map of that moment) when you:
offside · get a pass cut out · get tackled holding the ball too long · let a pass roll past you ·
leave a gap that leads to a goal · shoot from too far · crowd a teammate · stand offside too long ·
throw to a marked player · press or drop at the wrong time · stand still in the box at a corner.
Solo modes pause until you press **Got it**; online the card slides in without stopping play.
Lessons are collected on the full-time screen.

## Report card

After a match or drill, press **📄 Report card**. It opens a page you can print, save, or share:
result, stats, what the coach noticed (with pictures), and 3 things to practice.

## Playing on an iPad or phone

Open the game link in Safari or Chrome. No app to install. For a home-screen icon, use Share → Add to Home Screen.

- **Move:** touch and drag anywhere on the **left half** of the screen. A joystick appears under your finger.
- **Pass / Shoot:** the two round buttons at the bottom right.
- **Phones:** turn the phone sideways (landscape). The game asks you to. The camera follows the ball automatically on small screens; tap the 🎥 button to switch to the full field.
- **Drills:** tap the on-screen choices, or tap a player when the drill asks you to pick one.

## Controls

- Move: arrows / WASD, click or drag the field, or the touch joystick (left side of the screen on iPad)
- Pass: **Space** or the PASS button · Shoot: **X** or the SHOOT button
- Drills: tap the on-screen choices, or press **1 / 2 / 3** (A / B / C). Press vs Drop: **1** = press, **2** = drop
- **Z** camera (full field / follow the ball) · **P** pause (solo) · **M** mute

## Tech

Plain HTML + Canvas 2D, no frameworks, no build. One dependency (`ws`) for the server.
The match engine in `js/sim.js` runs identically in the browser (solo) and on the server (online, 60 Hz sim, 20 Hz snapshots, client interpolation).

## Tests

```bash
npm test      # offside rule, team-shape math, scoring, and the match engine (goals, halves, passes, saves, offside calls…)

npm i -D playwright && npx playwright install chromium   # once
npm run test:browser                                      # headless Chromium: a "tackle bot" plays a real match and proves the
                                                          # FOUL / PENALTY! / ADVANTAGE popups fire, with zero console errors
URL=https://your-site.onrender.com npm run test:browser   # same test against a deployed site
npm run test:phone                                        # Pocket view: an emulated iPhone 15 held sideways gets a full-screen
                                                          # field, an action camera and a radar; the desktop layout is unchanged
```
