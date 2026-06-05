import { CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE, GameState, LEVELS_PER_STAGE, getStageForLevel, ARCADE_WAVE } from './config.js';
import { G } from './state.js';
import { Vector2, Player, Enemy, Wall, Bullet } from './engine.js';
import { log } from './log.js';
import { applyProgressionToPlayer } from './progression.js';

// ==================== PRE-DESIGNED ARENA MAPS ====================
// Hand-crafted layouts for special levels. Each fills a (gc x gr) grid with 0=empty, 1=wall.

function arenaPillars(gc, gr) {
    // Nine pillars in a 3×3 grid — open movement with cover options
    const grid = emptyGrid(gc, gr);
    const cx = Math.floor(gc / 2), cy = Math.floor(gr / 2);
    const positions = [
        [cx - 5, cy - 3], [cx, cy - 3], [cx + 5, cy - 3],
        [cx - 5, cy],     [cx, cy],     [cx + 5, cy],
        [cx - 5, cy + 3], [cx, cy + 3], [cx + 5, cy + 3],
    ];
    for (const [px, py] of positions) {
        for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
                if (py + dy < gr - 1 && px + dx < gc - 1) grid[py + dy][px + dx] = 1;
            }
        }
    }
    return grid;
}

function arenaCorridors(gc, gr) {
    // Long horizontal and vertical corridors — cat-and-mouse gameplay
    const grid = emptyGrid(gc, gr);
    const midX = Math.floor(gc / 2), midY = Math.floor(gr / 2);
    for (let y = 3; y < gr - 3; y += 4) {
        for (let x = 2; x < gc - 2; x++) grid[y][x] = 1;
        const gap = 3 + Math.floor(Math.random() * (gc - 8));
        grid[y][gap] = 0; grid[y][gap + 1] = 0;
    }
    for (let x = 4; x < gc - 4; x += 5) {
        for (let y = 2; y < gr - 2; y++) grid[y][x] = 1;
        const gap = 3 + Math.floor(Math.random() * (gr - 8));
        grid[gap][x] = 0; grid[gap + 1][x] = 0;
    }
    grid[1][1] = 0; grid[1][2] = 0; grid[2][1] = 0; grid[2][2] = 0;
    return grid;
}

function arenaFortress(gc, gr) {
    // Central fortress with outer lanes — siege gameplay
    const grid = emptyGrid(gc, gr);
    const midX = Math.floor(gc / 2), midY = Math.floor(gr / 2);
    for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
            if (dy === -3 || dy === 3 || dx === -4 || dx === 4) {
                const gx = midX + dx, gy = midY + dy;
                if (gx > 0 && gx < gc - 1 && gy > 0 && gy < gr - 1) grid[gy][gx] = 1;
            }
        }
    }
    grid[midY - 3][midX] = 0; grid[midY + 3][midX] = 0;
    grid[midY][midX - 4] = 0; grid[midY][midX + 4] = 0;
    grid[midY - 1][midX - 2] = 1; grid[midY - 1][midX + 2] = 1;
    grid[midY + 1][midX - 2] = 1; grid[midY + 1][midX + 2] = 1;
    return grid;
}

function arenaCrossfire(gc, gr) {
    // X-shaped walls dividing into quadrants — long sight lines
    const grid = emptyGrid(gc, gr);
    const midX = Math.floor(gc / 2), midY = Math.floor(gr / 2);
    for (let i = -6; i <= 6; i++) {
        if (midY + i > 0 && midY + i < gr - 1 && midX + i > 0 && midX + i < gc - 1) {
            grid[midY + i][midX + i] = 1;
        }
        if (midY - i > 0 && midY - i < gr - 1 && midX + i > 0 && midX + i < gc - 1) {
            grid[midY - i][midX + i] = 1;
        }
    }
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            grid[midY + dy][midX + dx] = 0;
        }
    }
    const quadrants = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [qy, qx] of quadrants) {
        for (let i = 0; i < 3; i++) {
            const wx = midX + qx * (3 + Math.floor(Math.random() * 6));
            const wy = midY + qy * (3 + Math.floor(Math.random() * 4));
            if (wx > 1 && wx < gc - 2 && wy > 1 && wy < gr - 2) {
                grid[wy][wx] = 1;
                grid[wy + qy][wx + qx] = 1;
            }
        }
    }
    return grid;
}

function arenaRing(gc, gr) {
    // Circular arena with a central pillar and spoke walls — close combat
    const grid = emptyGrid(gc, gr);
    const midX = Math.floor(gc / 2), midY = Math.floor(gr / 2);
    const ringR = 6, innerR = 2;
    for (let y = 2; y < gr - 2; y++) {
        for (let x = 2; x < gc - 2; x++) {
            const dx = x - midX, dy = y - midY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= ringR - 0.5 && dist <= ringR + 0.5) {
                grid[y][x] = 1;
            }
        }
    }
    for (let r = innerR + 1; r < ringR - 1; r++) {
        grid[midY][midX + r] = 1; grid[midY][midX - r] = 1;
        grid[midY + r][midX] = 1; grid[midY - r][midX] = 1;
    }
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            grid[midY + dy][midX + dx] = 0;
        }
    }
    grid[midY][midX + ringR] = 0; grid[midY][midX - ringR] = 0;
    grid[midY + ringR][midX] = 0; grid[midY - ringR][midX] = 0;
    return grid;
}

const ARENAS = {
    pillars:   { name: 'Pillars',   fn: arenaPillars },
    corridors: { name: 'Corridors', fn: arenaCorridors },
    fortress:  { name: 'Fortress',  fn: arenaFortress },
    crossfire: { name: 'Crossfire', fn: arenaCrossfire },
    ring:      { name: 'Ring',      fn: arenaRing },
};

export function getArenaList() {
    return Object.entries(ARENAS).map(([id, a]) => ({ id, name: a.name }));
}

export function getPreDesignedArena(arenaId, gc, gr) {
    const arena = ARENAS[arenaId];
    if (!arena) return null;
    return arena.fn(gc, gr);
}

function emptyGrid(gc, gr) {
    const grid = [];
    for (let y = 0; y < gr; y++) {
        grid[y] = [];
        for (let x = 0; x < gc; x++) grid[y][x] = (x === 0 || x === gc - 1 || y === 0 || y === gr - 1) ? 1 : 0;
    }
    return grid;
}

function generateMaze(grid, gc, gr, lvl) {
    const wallDensityBase = lvl === 1 ? 0.12 : 0.25;
    const targetWalls = Math.floor(gc * gr * Math.min(wallDensityBase + lvl * 0.012, 0.35));

    for (let y = 0; y < gr; y++) { grid[y] = []; for (let x = 0; x < gc; x++) grid[y][x] = (x === 0 || x === gc - 1 || y === 0 || y === gr - 1) ? 1 : 0; }

    const numClusters = 3 + Math.min(Math.floor(lvl / 3), 5);
    let placed = 0;

    for (let c = 0; c < numClusters && placed < targetWalls; c++) {
        const cx = 3 + Math.floor(Math.random() * (gc - 6));
        const cy = 3 + Math.floor(Math.random() * (gr - 6));
        const clusterH = 2 + Math.floor(Math.random() * (1 + Math.min(lvl, 6)));
        const clusterW = 2 + Math.floor(Math.random() * (1 + Math.min(lvl, 6)));

        const shape = Math.random();
        for (let dy = 0; dy < clusterH && cy + dy < gr - 1; dy++) {
            for (let dx = 0; dx < clusterW && cx + dx < gc - 1; dx++) {
                let add = false;
                if (shape < 0.4) {
                    add = true;
                } else if (shape < 0.7) {
                    add = (dx === 0 || dy === 0);
                } else {
                    add = (dx === 0 || dx === clusterW - 1) && (dy === 0 || dy === clusterH - 1);
                }
                if (add && grid[cy + dy] && grid[cy + dy][cx + dx] !== undefined && grid[cy + dy][cx + dx] === 0) {
                    grid[cy + dy][cx + dx] = 1;
                    placed++;
                }
            }
        }

        if (clusterH > 2 && clusterW > 2 && Math.random() < 0.5) {
            for (let i = 0; i < 3 && placed < targetWalls; i++) {
                const rx = cx + 1 + Math.floor(Math.random() * (clusterW - 2));
                const ry = cy + 1 + Math.floor(Math.random() * (clusterH - 2));
                if (ry >= 0 && ry < gr && rx >= 0 && rx < gc && grid[ry][rx] === 0) {
                    const hasAdjacent = (grid[ry - 1] && grid[ry - 1][rx] === 1) || (grid[ry + 1] && grid[ry + 1][rx] === 1) ||
                                        (grid[ry] && grid[ry][rx - 1] === 1) || (grid[ry] && grid[ry][rx + 1] === 1);
                    if (hasAdjacent) { grid[ry][rx] = 1; placed++; }
                }
            }
        }
    }
}

export function generateLevel(lvl){
    log('info','LEVEL','Generating level '+lvl+' (multiplayer: '+G.isMultiplayerGame+')');
    G.walls=[]; G.bullets=[]; G.particles=[]; G.mines=[]; G.enemies=[];
    if (G._traceCtx && G._traceCanvas) G._traceCtx.clearRect(0, 0, G._traceCanvas.width, G._traceCanvas.height);

    const loadingEl = document.getElementById('loadingScreen');
    if(loadingEl) loadingEl.style.display='none';

    const gc=Math.floor(CANVAS_WIDTH/CELL_SIZE), gr=Math.floor(CANVAS_HEIGHT/CELL_SIZE);
    let grid=[];

    let stageInfo = null;
    let isSpecialLevel = false;
    if (G.gameMode === 'campaign') {
        stageInfo = getStageForLevel(lvl);
        isSpecialLevel = (lvl % LEVELS_PER_STAGE === 0);
        G.stageColors = stageInfo.colors;
        G.currentStageIndex = stageInfo.stageIndex;
        G.currentLevelInStage = (lvl - 1) % LEVELS_PER_STAGE;
        if (G.player) G.player.grip = stageInfo.grip;
    }

    // Effective difficulty within current stage — resets at each theme so players
    // can get used to the new grip before facing harder enemies
    let diffLevel = lvl;
    if (G.gameMode === 'campaign' && stageInfo) {
        diffLevel = G.currentLevelInStage + 1 + stageInfo.stageIndex;
    }

    const arenaIds = Object.keys(ARENAS);
    if (G.gameMode === 'arcade') {
        const arenaChoice = arenaIds[G.arcadeWave % arenaIds.length];
        grid = getPreDesignedArena(arenaChoice, gc, gr);
    } else if (G.gameMode === 'campaign' && isSpecialLevel) {
        const arenaChoice = arenaIds[(lvl / LEVELS_PER_STAGE - 1) % arenaIds.length];
        grid = getPreDesignedArena(arenaChoice, gc, gr);
    } else if (G.gameMode === 'campaign') {
        generateMaze(grid, gc, gr, diffLevel);
    } else {
        for (let y = 0; y < gr; y++) { grid[y] = []; for (let x = 0; x < gc; x++) grid[y][x] = (x === 0 || x === gc - 1 || y === 0 || y === gr - 1) ? 1 : 0; }
        const wallDensityBase = diffLevel === 1 ? 0.10 : 0.20;
        const wl = Math.floor(gc * gr * (wallDensityBase + Math.min(diffLevel * 0.015, 0.08)));
        for (let i = 0; i < wl; i++) {
            const x = 2 + Math.floor(Math.random() * (gc - 4)), y = 2 + Math.floor(Math.random() * (gr - 4));
            if (y >= 0 && y < gr && x >= 0 && x < gc && grid[y] && grid[y][x] === 0) { grid[y][x] = 1; }
        }
    }
    for(let y=0;y<gr;y++) for(let x=0;x<gc;x++) if(grid[y] && grid[y][x]===1) G.walls.push(new Wall(x*CELL_SIZE,y*CELL_SIZE,CELL_SIZE,CELL_SIZE));
    G.player=new Player(CELL_SIZE*2.5,CANVAS_HEIGHT-CELL_SIZE*2.5);
    if (stageInfo) G.player.grip = stageInfo.grip;
    applyProgressionToPlayer(G.player);

    if(!G.isMultiplayerGame){
        if (G.gameMode === 'ai1v1') {
            const ex = CANVAS_WIDTH - CELL_SIZE * 2.5;
            const ey = CELL_SIZE * 2.5;
            const strategy = G.aiTracker ? G.aiTracker.getStrategy() : null;
            const enemy = new Enemy(ex, ey, G.aiDifficulty || 2, strategy);
            // Mirror match — copy player's weapon and speed
            if (G.player) {
                enemy.halfSize = G.player.halfSize;
                enemy.width = G.player.width;
                enemy.height = G.player.height;
                enemy.speed = G.player.speed;
                enemy.fireRate = G.player.fireRate;
                enemy.bulletDamage = G.player.bulletDamage;
                enemy.bulletSpread = G.player.bulletSpread;
                enemy.bulletCount = G.player.bulletCount;
                enemy.bulletPiercing = G.player.bulletPiercing;
                enemy.bulletSpeed = G.player.bulletSpeed;
                enemy.bulletColor = G.player.bulletColor;
                enemy.bulletSize = G.player.bulletSize;
                enemy.bulletBounce = G.player.bulletBounce;
                enemy.bulletTrailEffect = G.player.bulletTrailEffect;
                enemy.bulletImpactEffect = G.player.bulletImpactEffect;
                enemy.recoil = G.player.recoil;
                // Override fire to use mirrored weapon stats
                enemy.fire = function(now, _) {
                    if (!this.canFire(now)) return null;
                    this.lastFire = now;
                    const baseAngle = this.turretAngle;
                    for (let i = 0; i < this.bulletCount; i++) {
                        const spread = this.bulletCount > 1
                            ? (i / (this.bulletCount - 1) - 0.5) * this.bulletSpread * 2
                            : 0;
                        const angle = baseAngle + spread + (Math.random() - 0.5) * this.bulletSpread * 0.2;
                        const d = new Vector2(Math.cos(angle), Math.sin(angle));
                        const b = new Bullet(
                            this.pos.x + d.x * 25,
                            this.pos.y + d.y * 25,
                            d.mul(this.bulletSpeed),
                            this
                        );
                        b.damage = this.bulletDamage;
                        b.pierceCount = this.bulletPiercing ? 999 : 0;
                        b._isPlayerBullet = false;
                        b.bulletColor = this.bulletColor;
                        b.radius *= this.bulletSize;
                        b.bounces += this.bulletBounce || 0;
                        b.trailEffect = this.bulletTrailEffect || 'normal';
                        b.impactEffect = this.bulletImpactEffect || 'normal';
                        G.bullets.push(b);
                    }
                    return true;
                };
            }
            G.enemies.push(enemy);
        } else if (G.gameMode === 'arcade') {
            // First wave spawned via generateArcadeWave
            G.enemies = [];
            generateArcadeWave();
        } else {
            const baseEnemies = diffLevel === 1 ? 1 : 2;
            const ne=Math.min(baseEnemies+Math.floor(diffLevel*1.2),10), tier=Math.min(Math.ceil(diffLevel/2),4);
            for(let i=0;i<ne;i++){
                for(let a=0;a<50;a++){
                    const ex=CELL_SIZE*2+Math.random()*(CANVAS_WIDTH-CELL_SIZE*4), ey=CELL_SIZE*2+Math.random()*(CANVAS_HEIGHT-CELL_SIZE*4);
                    if(Math.abs(ex-G.player.pos.x)<100||Math.abs(ey-G.player.pos.y)<100) continue;
                    const et=Math.max(1,tier-(i%2));
                    G.enemies.push(new Enemy(ex,ey,et));
                    break;
                }
            }
        }
    }
    validateAllPaths();
    G.gameState=GameState.READY;
    G._readyAt=performance.now();
    log('info','LEVEL','Level generated - enemies: '+G.enemies.length+', player pos: '+G.player.pos.x+','+G.player.pos.y);
}

export function generateArcadeWave() {
    G.enemies = G.enemies.filter(e => e.alive);
    const waveNum = G.arcadeWave;
    const numEnemies = Math.min(
        ARCADE_WAVE.initialEnemies + Math.floor(waveNum * ARCADE_WAVE.enemiesPerWave),
        ARCADE_WAVE.maxEnemies
    );
    const tier = Math.min(1 + Math.floor((waveNum - 1) / ARCADE_WAVE.tierScaleWaves), 4);

    // Clear existing bullets and mines for a fresh wave
    G.bullets = [];
    G.mines = [];

    for (let i = 0; i < numEnemies; i++) {
        for (let a = 0; a < 50; a++) {
            const ex = CELL_SIZE * 2 + Math.random() * (CANVAS_WIDTH - CELL_SIZE * 4);
            const ey = CELL_SIZE * 2 + Math.random() * (CANVAS_HEIGHT - CELL_SIZE * 4);
            if (G.player && Math.abs(ex - G.player.pos.x) < 120) continue;
            if (G.player && Math.abs(ey - G.player.pos.y) < 120) continue;
            const et = Math.max(1, tier - (i % 2));
            const enemy = new Enemy(ex, ey, et);
            // Mark as Q-learning enemy for ARCADE mode
            enemy._isQLearning = true;
            enemy._qlState = null;
            enemy._qlAction = null;
            enemy._accumulatedReward = 0;
            G.enemies.push(enemy);
            break;
        }
    }

    // Reset respawn cooldown
    G._arcadeWaveTimer = 0;
    G.arcadeWaveComplete = false;

    log('info', 'ARCADE', 'Wave ' + waveNum + ' spawned: ' + numEnemies + ' enemies (tier ' + tier + ')');
}

function validateAllPaths(){
    for(let t of [G.player,...G.enemies]){
        if(!t) continue;
        const dirs=[[0,-1],[0,1],[-1,0],[1,0]];
        let trapped=true;
        for(let [dx,dy] of dirs){
            const tx=t.pos.x+dx*CELL_SIZE, ty=t.pos.y+dy*CELL_SIZE;
            let clear=true;
            for(let w of G.walls){ if(tx>=w.x&&tx<=w.x+w.w&&ty>=w.y&&ty<=w.y+w.h){ clear=false; break; } }
            if(clear){ trapped=false; break; }
        }
        if(trapped){
            log('warn','VALIDATE','Tank stuck! Repositioning...');
            for(let a=0;a<20;a++){
                const nx=CELL_SIZE*2+Math.random()*(CANVAS_WIDTH-CELL_SIZE*4);
                const ny=CELL_SIZE*2+Math.random()*(CANVAS_HEIGHT-CELL_SIZE*4);
                let valid=true;
                for(let w of G.walls){ if(nx>=w.x&&nx<=w.x+w.w&&ny>=w.y&&ny<=w.y+w.h){ valid=false; break; } }
                        if(valid){ t.pos=new Vector2(nx,ny); break; }
            }
        }
    }
}
