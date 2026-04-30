# Tank Battle Arena - Game Specification

## Project Overview
- **Project Name**: Tank Battle Arena
- **Type**: 2D Top-Down Arcade Shooter
- **Core Functionality**: Fast-paced tank combat in maze-like arenas with progressive difficulty
- **Target Users**: Casual gamers seeking quick, strategic gameplay

---

## Visual & Rendering Specification

### Canvas Setup
- **Resolution**: Responsive, scales to window (min 800x600)
- **Rendering**: HTML5 Canvas 2D Context
- **Frame Rate**: 60 FPS target with requestAnimationFrame

### Visual Style
- **Aesthetic**: Minimalist geometric shapes, clean lines
- **Color Palette**:
  - Background: `#1a1a2e` (dark navy)
  - Walls: `#16213e` with `#0f3460` border (blue-gray)
  - Player Tank: `#e94560` (coral red)
  - Enemy Tanks: `#f39c12` (orange), `#27ae60` (green), `#9b59b6` (purple) based on difficulty
  - Bullets: `#ffffff` with glow effect
  - UI Text: `#eaeaea` (off-white)
  - Health Bar: `#e94560` (player), `#27ae60` (enemy)

### Game Elements (Basic Shapes)
- **Tanks**: Rounded rectangles with turret line indicating aim direction
- **Bullets**: Small circles with motion trail
- **Walls**: Rectangles with subtle border
- **Explosions**: Expanding circles with fade-out

---

## Game Mechanics Specification

### Player Tank
- **Movement**: WASD keys (8-directional)
- **Speed**: 200 pixels/second
- **Aiming**: Mouse cursor position determines turret angle
- **Shooting**: Left mouse click fires bullet
- **Fire Rate**: 3 shots per second max
- **Health**: 3 hits before destruction
- **Collision**: Cannot pass through walls

### Enemy Tanks
- **AI Levels** (4 tiers):
  1. **Tier 1 (Level 1-2)**: Basic - moves randomly, fires when player in line of sight
  2. **Tier 2 (Level 3-4)**: Moderate - predicts player movement, uses cover
  3. **Tier 3 (Level 5-7)**: Advanced - flanks player, coordinated attacks
  4. **Tier 4 (Level 8+)**: Expert - accurate shots, strategic positioning

- **Accuracy Scaling**: 40% (Tier 1) → 95% (Tier 4)
- **Fire Rate Scaling**: 1 shot/2sec (Tier 1) → 1 shot/0.8sec (Tier 4)
- **Movement Speed**: 80-150 pixels/second based on tier

### Bullets
- **Player Bullet Speed**: 500 pixels/second
- **Enemy Bullet Speed**: 300-450 pixels/second (scales with difficulty)
- **Damage**: 1 hit = 1 damage
- **Collision**: Destroys on wall or tank hit

### Level Progression
- **Level 1**: 2 enemies, simple maze
- **Level 2**: 3 enemies, slightly complex maze
- **Level N**: `2 + floor(N * 1.2)` enemies, increasingly complex mazes
- **Max Enemies Per Level**: 10

### Scoring System
- **Enemy Kill**: 100 × level number
- **Time Bonus**: 1000 - (completion_time_seconds × 10), min 0
- **Level Complete Bonus**: 500 × level

---

## Arena & Map Specification

### Maze Generation
- **Grid-based**: 40×40 pixel cells
- **Wall Density**: 25-35% of grid cells
- **Guaranteed Paths**: Flood-fill validation ensures all areas accessible
- **Player Spawn**: Bottom-left quadrant
- **Enemy Spawns**: Distributed across other quadrants

### Arena Size
- **Width**: 1200 pixels (30 cells)
- **Height**: 800 pixels (20 cells)

---

## Interaction Specification

### Controls
| Input | Action |
|-------|--------|
| W | Move forward |
| A | Strafe left |
| S | Move backward |
| D | Strafe right |
| Mouse Move | Aim turret |
| Left Click | Fire bullet |
| R | Restart level (when dead) |
| Space | Start game / Next level |

### UI Elements
- **Top Left**: Level indicator, Score
- **Top Right**: Timer (counting up)
- **Bottom Left**: Player health bar
- **Center**: Level complete / Game over overlays

---

## Audio Specification (Optional Enhancement)
- **Shoot Sound**: Short pew sound (Web Audio oscillator)
- **Hit Sound**: Impact sound
- **Explosion**: Low rumble on tank destruction
- **Level Complete**: Victory jingle

---

## Game States

1. **MENU**: Title screen with "Press SPACE to Start"
2. **PLAYING**: Active gameplay
3. **LEVEL_COMPLETE**: Show score, time, "Press SPACE for next level"
4. **GAME_OVER**: Show final score, "Press R to restart"

---

## Technical Implementation

### Architecture
```
- index.html (single file containing all code)
  - CSS: Canvas styling, UI overlays
  - JS Classes:
    - Game: Main loop, state management
    - Tank: Base class for player/enemy
    - Player: Extends Tank with input handling
    - Enemy: Extends Tank with AI behavior
    - Bullet: Projectile physics
    - Wall: Collision geometry
    - Level: Maze generation and enemy spawning
    - Particle: Visual effects
```

### Collision Detection
- AABB (Axis-Aligned Bounding Box) for tanks and walls
- Circle-rectangle for bullets
- Raycasting for line-of-sight checks

---

## Acceptance Criteria

1. ✅ Player can move tank with WASD in 8 directions
2. ✅ Turret follows mouse cursor smoothly
3. ✅ Bullets fire on click and travel in aimed direction
4. ✅ Bullets destroy on wall collision
5. ✅ Enemy tanks spawn and move with basic AI
6. ✅ Enemy tanks fire at player with increasing accuracy
7. ✅ Player takes damage and dies after 3 hits
8. ✅ Level completes when all enemies destroyed
9. ✅ Difficulty increases each level
10. ✅ Score and timer display correctly
11. ✅ Game over and restart functionality works
12. ✅ Maze is always solvable (all areas accessible)
13. ✅ Runs at stable 60 FPS on modern browsers