# Tank Battle Arena

A fast-paced 2D top-down tank battle game inspired by Wii Play. Navigate maze-like arenas, eliminate enemy tanks, and compete in solo campaign, 1v1 AI practice, or real-time multiplayer battles!

## 🎮 Game Modes

| Mode | Description |
|------|-------------|
| **SOLO** | Campaign mode — progress through procedurally generated levels with increasing enemy difficulty. Earn time bonuses. Beat your personal best! |
| **VS AI** | Best-of-9 match (first to 5 wins) against a self-learning adaptive opponent. The AI studies your playstyle across rounds and adjusts its strategy. 3 difficulty levels. |
| **VERSUS (1v1 / 2v2 / 3v3)** | Online multiplayer via Firebase. Create or join lobbies with room codes. Real-time tank battles with friends. |

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `W` `A` `S` `D` | Move tank |
| `Mouse` | Aim turret |
| `Left Click` | Fire |
| `C` | Place mine (max 3, 3s arm timer, 120px blast radius) |
| `Escape` | Pause / Resume / Close overlays |
| `Space` | Next level (on level complete) |
| `R` | Restart |

## ✨ Features

### Solo Campaign
- **4-tier enemy AI** — speed, fire rate, accuracy, and HP scale with each tier
- **Procedurally generated mazes** — every level is different with spawn validation
- **Scoring system** — base score + time bonus per level
- **Star rating** (1-3 stars) based on level progression
- **Personal best tracking** — scores auto-save to local leaderboard
- **Record-breaking animation** — full-screen celebration with golden particles, confetti, and trophy when you beat your best score

### VS AI — Adaptive Opponent
- **PlayerBehaviorTracker** — observes your engagement distance, direction changes, wall proximity, shot accuracy, and mine usage across rounds
- **Counter-strategy engine** — AI adapts to your playstyle:
  - Good aim? → AI moves erratically, uses cover
  - Aggressive? → AI retreats, maintains distance
  - Camper? → AI flushes you out
  - Predictable? → AI uses predictive aim
  - Winning/losing streak? → AI adjusts difficulty dynamically
- **7 AI states**: approach, retreat, flank, strafe, erratic, wander, cover-seeking
- **Smart movement**: wall avoidance, mine avoidance, stuck recovery with pathfinding

### Multiplayer (Firebase Realtime)
- Room code lobby system
- Real-time position, rotation, health sync
- Play Again with both-player confirmation + countdown
- Friend invitations with notification toast
- Online leaderboard

### Leaderboard System
- **Automatic** — every solo game saves your score
- **One entry per user** — only your best score counts
- **Accessible from home screen** — view top 20 scores with medals
- Shown in game-over overlay with match stats

### Visual & UX Polish
- **Cinematic welcome animation** — percentage loading sequence (0→100%) with status messages, gold/red particle effects
- **Smooth overlay transitions** — all menus fade+slide in
- **Confetti bursts** on victory and record-breaking
- **Animated score counters** — numbers tick up with easing
- **Star pop animation** on game over
- **Staggered card entrance** on home screen
- **Button glow effects** on hover
- **Keyboard shortcuts** — Enter to submit login, Escape to close any overlay

## 🚀 Quick Start

```bash
git clone https://github.com/brianbcyang27-prog/tank-battle-arena.git
cd tank-battle-arena
open index.html
```

Or simply open `index.html` in any modern browser.

> **Note:** Multiplayer features require Firebase configuration. For solo + VS AI, no setup needed — just open the file.

## 🏗️ Tech Stack

- **Pure HTML5 Canvas + Vanilla JavaScript** — no frameworks, no build tools
- **Firebase Realtime Database** — multiplayer sync, auth, online leaderboard
- **60 FPS gameplay** with requestAnimationFrame game loop
- **Modular ES6 architecture** — 13 source files with clear separation of concerns

## 📁 Project Structure

```
src/
├── main.js          — Game loop, input handling, initialization, welcome animation
├── engine.js        — Vector2, Bullet, Tank, Player, Enemy, LandMine, Particle, Wall
├── game.js          — Game flow: start, level complete, game over, round management
├── adaptive-ai.js   — PlayerBehaviorTracker + counter-strategy engine
├── levels.js        — Procedural level generation with wall mazes
├── state.js         — Shared mutable game state (G)
├── config.js        — Constants, colors, GameState enum, defaults
├── ui.js            — All overlays, settings, leaderboard, navigation
├── stats.js         — Per-game + lifetime stats tracking (localStorage)
├── multiplayer.js   — Lobby creation/joining, Firebase sync, rematch
├── firebase.js      — Firebase init, auth, database helpers
├── friends.js       — Friend codes, requests, invitations
└── log.js           — Console logging with timestamps
```

## 🐛 Bug Fixes (v2.0)

- Own mines no longer explode instantly on placement
- Mine deaths now properly trigger game over
- Profile data no longer wiped on page refresh
- Remote bullet positions stay synced correctly
- Play Again requires both players to confirm
- Profile overlay only shows on explicit sign-in (not session restore)
- All game-over paths work correctly in VS AI mode
- Score flickering eliminated in game-over transitions

## 📄 License

MIT
