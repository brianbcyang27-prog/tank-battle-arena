import { G } from './state.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GameState } from './config.js';
import { Player, Wall, Enemy, Particle } from './engine.js';
import { showOverlay } from './ui.js';
import { log } from './log.js';

const STORAGE_KEY = 'tankBattleTutorialDone';

export function isTutorialSeen() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function resetTutorialSeen() {
    localStorage.removeItem(STORAGE_KEY);
}

function markTutorialSeen() {
    localStorage.setItem(STORAGE_KEY, 'true');
}

const STEPS = [
    {
        id: 'move',
        title: 'MOVEMENT',
        instruction: 'Press W A S D to move your tank around',
        hint: 'Your turret follows the mouse independently from the hull',
        successMsg: 'You control where your tank goes! Press each key a few times to get comfortable'
    },
    {
        id: 'hud',
        title: 'HUD OVERVIEW',
        instruction: 'Your HUD shows ammo, fuel, boost, and health — study it carefully',
        hint: '',
        successMsg: 'Knowing your HUD keeps you alive in battle!'
    },
    {
        id: 'fuel',
        title: 'FUEL MANAGEMENT',
        instruction: 'Move until your fuel runs low, then stop to regenerate',
        hint: 'Watch the green FUEL bar drain as you move. Without fuel you slow way down!',
        successMsg: 'Managing fuel keeps you mobile — stop to recover when needed'
    },
    {
        id: 'aim',
        title: 'AIMING',
        instruction: 'Move your mouse to aim — notice the turret moves independently',
        hint: 'Your hull (tank body) faces one way, turret can point another. Drive one direction, shoot another!',
        successMsg: 'Deadly aim! Independent hull and turret give you total control'
    },
    {
        id: 'shoot',
        title: 'COMBAT',
        instruction: 'Left Click to fire at the target dummy — fire 3 times',
        hint: 'Watch the ammo counter decrease. When empty, the cannon auto-reloads',
        successMsg: 'Nice shooting! Keep track of ammo and reload timing'
    },
    {
        id: 'boost',
        title: 'BOOST',
        instruction: 'Hold SHIFT while moving to boost — hold for 2 full seconds',
        hint: 'Purple bar = boost energy. It drains fast, recharges when you release SHIFT',
        successMsg: 'Use boost to dodge attacks and close distances — but watch your energy!'
    },
    {
        id: 'mine',
        title: 'MINES',
        instruction: 'Press C to place a mine, then an enemy will chase you into it',
        hint: 'Mines arm after 3 seconds. Max 3 at a time. Lead the enemy over your mine!',
        successMsg: 'Mines control the battlefield — place them in chokepoints'
    }
];

// Navigate around the wall: up → left → down → right (counter-clockwise)
const MOVE_KEYS = [
    { code: 'KeyW', label: 'W', instruction: 'Press W to go above the wall', success: 'Up!' },
    { code: 'KeyA', label: 'A', instruction: 'Press A to go left of the wall', success: 'Left!' },
    { code: 'KeyS', label: 'S', instruction: 'Press S to go below the wall', success: 'Down!' },
    { code: 'KeyD', label: 'D', instruction: 'Press D to go right of the wall', success: 'Right!' }
];

// Axis-aligned checkpoints for counter-clockwise path around the central wall block.
// Each shares an axis with the previous so a single key press reaches it.
// Path: start at (640,440) → W up → A left → S down → D right → back to start
const MOVE_CHECKPOINTS = [
    { x: 640, y: 280 },  // W — above wall
    { x: 520, y: 280 },  // A — left of wall (same y as W)
    { x: 520, y: 440 },  // S — below wall (same x as A)
    { x: 640, y: 440 }   // D — right of wall (same y as S, back to start)
];

let currentStep = 0;
let stepTimer = 0;
let showSuccess = false;
let successTimer = 0;
let initialAngle = null;
let angleChanged = false;
let shotCount = 0;
let hasBoosted = false;
let boostTimer = 0;
let mineTimer = 0;
let enemyTriggeredMine = false;
let fuelDrained = false;
let fuelRegenTimer = 0;
let releaseTimer = 0;
let isActive = false;

// Key-by-key movement
let moveKeyIndex = 0;
let wrongKeyTimer = 0;
let moveMarker = null;
let moveStartPos = null;

// Spotlight
let spotlightHighlightEl = null;

// Previous keys snapshot for move detection
let prevKeys = {};

// Target dummy
let targetDummy = null;

function setupTutorialArena() {
    G.walls = [];
    G.bullets = [];
    G.particles = [];
    G.mines = [];
    G.enemies = [];
    G.remoteTanks = {};
    G.remoteBullets = {};

    const wallPositions = [
        [80, 200], [80, 240], [120, 200], [120, 240],
        [920, 500], [920, 540], [960, 500], [960, 540],
        [560, 300], [560, 340], [560, 380],
        [120, 660], [160, 660], [200, 660],
        [840, 120], [840, 160], [880, 120], [880, 160],
        // Central wall block for navigation practice (2x2)
        [560, 320], [600, 320], [560, 360], [600, 360]
    ];
    for (let [wx, wy] of wallPositions) {
        G.walls.push(new Wall(wx, wy, 40, 40));
    }

    G.player = new Player(640, 440);  // below-right of central wall block
    G.player.health = 3;
    G.player.maxHealth = 3;
    G.player.maxAmmo = 99;
    G.player.ammo = 99;

    // Target dummy (stationary, marked as destroyed so it doesn't move/shoot)
    targetDummy = new Enemy(700, 450, 1);
    targetDummy.health = 3;
    targetDummy.maxHealth = 3;
    targetDummy.speed = 0;       // stationary
    targetDummy.fireRate = 0;    // doesn't shoot
    targetDummy.accuracy = 0;    // irrelevant
    targetDummy.alive = true;
    G.enemies = [targetDummy];

    G.gameState = GameState.TUTORIAL;
    G.levelTime = 0;
    G.score = 0;
}

function resetStepState() {
    initialAngle = G.player ? G.player.turretAngle : null;
    angleChanged = false;
    shotCount = 0;
    hasBoosted = false;
    boostTimer = 0;
    releaseTimer = 0;
    mineTimer = 0;
    enemyTriggeredMine = false;
    fuelDrained = false;
    fuelRegenTimer = 0;
    stepTimer = 0;
    moveKeyIndex = 0;
    wrongKeyTimer = 0;
    moveMarker = null;
    moveStartPos = null;
    removeSpotlight();
    // Reset player to a safe central position between steps
    if (G.player) {
        G.player.pos.x = CANVAS_WIDTH / 2;
        G.player.pos.y = CANVAS_HEIGHT / 2;
        G.player.vel.x = 0;
        G.player.vel.y = 0;
        G.player.fuel = 100;
        G.player.boostEnergy = 100;
    }
    // Restore target dummy health between steps
    if (targetDummy && !targetDummy.alive) {
        targetDummy.health = targetDummy.maxHealth;
        targetDummy.alive = true;
    }
	if (targetDummy && G.enemies.indexOf(targetDummy) !== -1) {
		const nextStepId = currentStep + 1 < STEPS.length ? STEPS[currentStep + 1].id : null;
		const enteringMine = STEPS[currentStep] && STEPS[currentStep].id === 'mine';
		if (enteringMine || nextStepId === 'mine') {
			G.enemies.splice(G.enemies.indexOf(targetDummy), 1);
		}
	}
	if (targetDummy && G.enemies.indexOf(targetDummy) === -1) {
		const currentStepId = STEPS[currentStep] && STEPS[currentStep].id;
		if (currentStepId === 'shoot' || currentStepId === 'aim') {
			targetDummy.health = targetDummy.maxHealth;
			targetDummy.alive = true;
			G.enemies.push(targetDummy);
		}
	}
}

function advanceStep() {
    if (currentStep < STEPS.length - 1) {
        showSuccess = true;
        successTimer = 2.5;
    } else {
        showModeOverview();
    }
}

function doAdvance() {
    showSuccess = false;
    currentStep++;
    resetStepState();
}

function spawnMoveMarker() {
    if (moveKeyIndex >= MOVE_KEYS.length) { moveMarker = null; return; }
    const cp = MOVE_CHECKPOINTS[moveKeyIndex];
    if (G.player) {
        moveStartPos = { x: G.player.pos.x, y: G.player.pos.y };
    }
    const px = G.player ? G.player.pos.x : CANVAS_WIDTH / 2;
    const py = G.player ? G.player.pos.y : CANVAS_HEIGHT / 2;
    moveMarker = { x: cp.x, y: cp.y, angle: Math.atan2(cp.y - py, cp.x - px), pulse: 0 };
}

export function updateTutorial(dt) {
    if (!isActive || G.gameState !== GameState.TUTORIAL) return;

    if (showSuccess) {
        successTimer -= dt;
        if (successTimer <= 0) {
            doAdvance();
        }
        return;
    }

    const step = STEPS[currentStep];
    if (!step) return;

    stepTimer += dt;
    if (wrongKeyTimer > 0) wrongKeyTimer -= dt;
    if (wrongKeyTimer < 0) wrongKeyTimer = 0;

    switch (step.id) {
        case 'move': {
            if (!moveMarker && moveKeyIndex < MOVE_KEYS.length) spawnMoveMarker();
            if (moveMarker && G.player) {
                const dx = G.player.pos.x - moveMarker.x;
                const dy = G.player.pos.y - moveMarker.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 40) {
                    moveKeyIndex++;
                    if (moveKeyIndex >= MOVE_KEYS.length) {
                        moveMarker = null;
                        advanceStep();
                    } else {
                        spawnMoveMarker();
                    }
                }
            }
            break;
        }
        case 'hud': {
            if (!spotlightHighlightEl) createSpotlight();
            if (stepTimer > 6) {
                removeSpotlight();
                advanceStep();
            }
            break;
        }
        case 'fuel': {
            if (!spotlightHighlightEl) createSpotlight();
            if (G.player && G.player.fuel < 30 && !fuelDrained) {
                fuelDrained = true;
            }
            if (fuelDrained) {
                fuelRegenTimer += dt;
            }
            // Let player see regeneration for 3s after fuel drained
            if (fuelDrained && fuelRegenTimer > 3) {
                removeSpotlight();
                advanceStep();
            }
            break;
        }
        case 'aim': {
            if (G.player && initialAngle !== null) {
                if (Math.abs(G.player.turretAngle - initialAngle) > 0.5) angleChanged = true;
            }
            if (angleChanged && stepTimer > 2) advanceStep();
            // Fallback: advance after 10s even if player doesn't move mouse
            if (stepTimer > 10 && !angleChanged) {
                angleChanged = true;
            }
            break;
        }
        case 'shoot': {
            const justFired = G.player && G.player.lastFire > 0 &&
                (performance.now() - G.player.lastFire < 150);
            if (justFired) {
                shotCount++;
                // Small delay so repeat fires count as separate shots
                G.player.lastFire = 0;
            }
            if (shotCount >= 3) advanceStep();
            break;
        }
        case 'boost': {
            const shiftHeld = G.keys['ShiftLeft'] || G.keys['ShiftRight'];
		const moving = G.keys['KeyW'] || G.keys['KeyA'] || G.keys['KeyS'] || G.keys['KeyD'];
            if (shiftHeld && moving) {
                boostTimer += dt;
                releaseTimer = 0;  // reset release timer while actively boosting
            } else if (hasBoosted && !shiftHeld) {
                releaseTimer += dt;  // count time since shift release
                // Let them see energy regenerate for 2s after releasing shift
                if (releaseTimer > 2) advanceStep();
            }
            if (boostTimer >= 2.0) {
                hasBoosted = true;
            }
            break;
        }
        case 'mine': {
            const liveMines = G.mines.filter(m => !m.exploded).length;
            if (liveMines > 0) mineTimer += dt;

            const armedMine = G.mines.find(m => m.armed && !m.exploded);
            if (armedMine && G.enemies.length === 0) {
                if (G.player) {
                    // Spawn enemy on the far side of the mine from the player,
                    // so it must run through the mine to reach the player.
                    const dx = armedMine.pos.x - G.player.pos.x;
                    const dy = armedMine.pos.y - G.player.pos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const spawnX = armedMine.pos.x + (dx / dist) * 80;
                    const spawnY = armedMine.pos.y + (dy / dist) * 80;
                    const e = new Enemy(spawnX, spawnY, 1);
                    e.health = 1;
                    e.maxHealth = 1;
                    e.speed = 160;
                    G.enemies.push(e);
                }
            }

            if (!enemyTriggeredMine) {
                for (const e of G.enemies) {
                    if (!e.alive || e.health <= 0) {
                        enemyTriggeredMine = true;
                        break;
                    }
                }
            }
            if (enemyTriggeredMine) advanceStep();
            break;
        }
    }
}

function createSpotlight() {
    const container = document.getElementById('gameContainer');
    if (!container || spotlightHighlightEl) return;

    // Highlight frame uses box-shadow to dim everything EXCEPT the HUD window
    // HUD: hudX=1025, hudY=712, hudW=160, hudH=94 (CANVAS 1200x800)
    const hlW = 190, hlH = 130;
    const hlLeft = 1025 - 15;
    const hlTop = 712 - 18;

    const hl = document.createElement('div');
    hl.className = 'tutorial-spotlight-highlight';
    hl.style.cssText = 'left:' + hlLeft + 'px;top:' + hlTop + 'px;width:' + hlW + 'px;height:' + hlH + 'px;';
    container.appendChild(hl);
    spotlightHighlightEl = hl;

    log('info', 'TUTORIAL', 'Spotlight effect created over HUD');
}

function removeSpotlight() {
    if (spotlightHighlightEl) {
        spotlightHighlightEl.remove();
        spotlightHighlightEl = null;
        log('info', 'TUTORIAL', 'Spotlight effect removed');
    }
}

export function renderTutorial(ctx) {
    if (!isActive || G.gameState !== GameState.TUTORIAL) return;
    const step = STEPS[currentStep];
    if (!step) return;

    if (wrongKeyTimer > 0) {
        const pulse = 0.1 + Math.sin(wrongKeyTimer * 40) * 0.06;
        ctx.fillStyle = 'rgba(255, 40, 40, ' + Math.max(0, pulse) + ')';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // --- Bottom instruction panel ---
    const panelH = 120;
    const panelY = CANVAS_HEIGHT - panelH;
    const isHudStep = step.id === 'hud';
    const panelAlpha = isHudStep ? 0.4 : 0.8;
    const grad = ctx.createLinearGradient(0, panelY, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, 'rgba(13,13,26,' + panelAlpha + ')');
    grad.addColorStop(1, 'rgba(13,13,26,' + (panelAlpha + 0.15) + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(0, panelY, CANVAS_WIDTH, panelH);

    const pulseAccent = isHudStep ? 0.1 + Math.sin(stepTimer * 3) * 0.05 : 0.3 + Math.sin(stepTimer * 3) * 0.15;
    ctx.strokeStyle = 'rgba(233,69,96,' + pulseAccent + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, panelY);
    ctx.lineTo(CANVAS_WIDTH, panelY);
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.font = '10px Orbitron';
    ctx.fillStyle = '#555';
    ctx.fillText('STEP ' + (currentStep + 1) + ' / ' + STEPS.length, CANVAS_WIDTH - 20, panelY + 16);

    ctx.textAlign = 'left';
    ctx.font = 'bold 22px Orbitron';
    ctx.fillStyle = '#e94560';
    ctx.fillText(step.title, 20, panelY + 42);

    ctx.textAlign = 'left';
    ctx.font = '16px Orbitron';
    ctx.fillStyle = '#eaeaea';
    ctx.fillText(step.instruction, 20, panelY + 70);

    if (step.hint) {
        ctx.textAlign = 'left';
        ctx.font = '12px Orbitron';
        ctx.fillStyle = '#999';
        ctx.fillText('💡 ' + step.hint, 20, panelY + 94);
    }

    if (step.id === 'move' && moveKeyIndex < MOVE_KEYS.length && moveMarker) {
        const mk = MOVE_KEYS[moveKeyIndex];
        const pulse = Math.sin(stepTimer * 6) * 0.3 + 0.7;

        if (moveStartPos) {
            ctx.save();
            ctx.strokeStyle = 'rgba(100, 100, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(moveStartPos.x, moveStartPos.y);
            ctx.lineTo(moveMarker.x, moveMarker.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(100, 100, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(moveStartPos.x, moveStartPos.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(moveMarker.x, moveMarker.y);
        ctx.rotate(moveMarker.angle);
        ctx.strokeStyle = `rgba(46, 204, 113, ${pulse})`;
        ctx.shadowColor = '#2ecc71';
        ctx.shadowBlur = 20 * pulse;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-25, 0);
        ctx.lineTo(25, 0);
        ctx.lineTo(15, -12);
        ctx.moveTo(25, 0);
        ctx.lineTo(15, 12);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 16px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#2ecc71';
        ctx.shadowBlur = 10;
        ctx.fillText(mk.label, moveMarker.x, moveMarker.y - 45);
        ctx.shadowBlur = 0;

        ctx.textAlign = 'center';
        ctx.font = '12px Orbitron';
        ctx.fillStyle = '#888';
        let dots = '';
        for (let i = 0; i < MOVE_KEYS.length; i++) {
            dots += i < moveKeyIndex ? '●  ' : '○  ';
        }
        ctx.fillText(dots, CANVAS_WIDTH / 2, CANVAS_HEIGHT - panelH - 12);
    }

    // --- HUD / Fuel labels ---
    if (spotlightHighlightEl) {
        const hudX = CANVAS_WIDTH - 175;
        const hudY = CANVAS_HEIGHT - 88;
        const hudW = 160;

        if (step.id === 'hud') {
            ctx.textAlign = 'center';
            ctx.font = 'bold 11px Orbitron';
            ctx.fillStyle = '#eaeaea';
            ctx.fillText('▼ AMMO — rounds remaining, auto-reloads', hudX + hudW / 2, hudY - 22);
            ctx.font = '9px Orbitron';
            ctx.fillStyle = '#888';
            ctx.fillText('(yellow when low, red when empty)', hudX + hudW / 2, hudY - 10);

            ctx.font = 'bold 11px Orbitron';
            ctx.fillStyle = '#3498db';
            ctx.fillText('▼ RELOAD / COOLDOWN — blue bar fills → ready', hudX + hudW / 2, hudY + 82);
            ctx.font = '9px Orbitron';
            ctx.fillStyle = '#888';
            ctx.fillText('Fires when bar is full; gold during reload', hudX + hudW / 2, hudY + 94);

            ctx.font = 'bold 11px Orbitron';
            ctx.fillStyle = '#2ecc71';
            ctx.fillText('▼ FUEL — drains as you move', hudX + hudW / 2, hudY + 112);
            ctx.font = '9px Orbitron';
            ctx.fillStyle = '#888';
            ctx.fillText('Stop to regenerate', hudX + hudW / 2, hudY + 124);

            ctx.font = 'bold 11px Orbitron';
            ctx.fillStyle = '#9b59b6';
            ctx.fillText('▼ BOOST — hold SHIFT to sprint', hudX + hudW / 2, hudY + 140);
            ctx.font = '9px Orbitron';
            ctx.fillStyle = '#888';
            ctx.fillText('Recharges when released', hudX + hudW / 2, hudY + 152);

            ctx.textAlign = 'left';
            ctx.font = 'bold 11px Orbitron';
            ctx.fillStyle = '#e74c3c';
            ctx.fillText('❤ HEALTH', 14, CANVAS_HEIGHT - panelH - 34);
            ctx.font = '9px Orbitron';
            ctx.fillStyle = '#888';
            ctx.fillText('3 HP. Getting hit costs 1 HP. Watch top-left of screen.', 14, CANVAS_HEIGHT - panelH - 20);

            ctx.font = '9px Orbitron';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText('Step advances automatically — take your time reading', CANVAS_WIDTH / 2, panelY - 8);
        } else if (step.id === 'fuel') {
            const fuelPct = G.player && G.player.maxFuel > 0 ? (G.player.fuel / G.player.maxFuel) : 1;
            const arrowPulse = Math.sin(stepTimer * 5) * 0.3 + 0.7;

            ctx.textAlign = 'center';
            ctx.font = 'bold 26px Orbitron';
            ctx.fillStyle = 'rgba(241,196,15,' + arrowPulse + ')';
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 20;
            ctx.fillText('⬇ KEEP MOVING TO DRAIN FUEL ⬇', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);
            ctx.shadowBlur = 0;

            ctx.font = 'bold 48px Orbitron';
            if (fuelPct > 0.5) {
                ctx.fillStyle = '#2ecc71';
                ctx.shadowColor = '#2ecc71';
            } else if (fuelPct > 0.1) {
                ctx.fillStyle = '#f39c12';
                ctx.shadowColor = '#f39c12';
            } else {
                ctx.fillStyle = '#e74c3c';
                ctx.shadowColor = '#e74c3c';
            }
            ctx.shadowBlur = 15;
            ctx.fillText(Math.round(fuelPct * 100) + '%', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
            ctx.shadowBlur = 0;

            ctx.font = 'bold 20px Orbitron';
            if (fuelPct > 0.5) {
                ctx.fillStyle = '#eaeaea';
                ctx.fillText('Keep moving until fuel drops below 30%!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
            } else if (fuelPct > 0.1) {
                ctx.fillStyle = '#f39c12';
                ctx.fillText('Almost out of fuel — prepare to STOP!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
            } else {
                ctx.fillStyle = '#2ecc71';
                ctx.fillText('STOP! Watch the green bar refill!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
            }

            ctx.font = 'bold 14px Orbitron';
            ctx.fillStyle = 'rgba(241,196,15,' + arrowPulse + ')';
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 12;
            ctx.fillText('⬇ FUEL BAR ⬇', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 150);
            ctx.shadowBlur = 0;
        }
    }

    // --- Aim indicators ---
    if (step.id === 'aim' && G.player) {
        const len = 80;
        const tx = G.player.pos.x + Math.cos(G.player.turretAngle) * len;
        const ty = G.player.pos.y + Math.sin(G.player.turretAngle) * len;

        ctx.strokeStyle = 'rgba(241,196,15,0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(G.player.pos.x, G.player.pos.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        const arrowSize = 10;
        const aAngle = G.player.turretAngle;
        ctx.fillStyle = 'rgba(241,196,15,0.9)';
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(tx + Math.cos(aAngle) * arrowSize, ty + Math.sin(aAngle) * arrowSize);
        ctx.lineTo(tx + Math.cos(aAngle + 2.3) * arrowSize * 0.6, ty + Math.sin(aAngle + 2.3) * arrowSize * 0.6);
        ctx.lineTo(tx + Math.cos(aAngle - 2.3) * arrowSize * 0.6, ty + Math.sin(aAngle - 2.3) * arrowSize * 0.6);
        ctx.closePath();
        ctx.fill();

		const hullAngle = G.player.vel && G.player.vel.length() > 5 ? Math.atan2(G.player.vel.y, G.player.vel.x) : G.player.turretAngle;
		const hx = G.player.pos.x + Math.cos(hullAngle) * 40;
		const hy = G.player.pos.y + Math.sin(hullAngle) * 40;
        ctx.strokeStyle = 'rgba(52,152,219,0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(G.player.pos.x, G.player.pos.y);
        ctx.lineTo(hx, hy);
        ctx.stroke();

        ctx.setLineDash([]);

        ctx.textAlign = 'center';
        ctx.font = 'bold 12px Orbitron';
        ctx.fillStyle = '#f1c40f';
        ctx.shadowColor = '#f1c40f';
        ctx.shadowBlur = 8;
        ctx.fillText('← TURRET (mouse)', tx, ty + 22);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#3498db';
        ctx.shadowColor = '#3498db';
        ctx.shadowBlur = 8;
        ctx.fillText('HULL (WASD) →', hx - 24, hy - 12);
        ctx.shadowBlur = 0;

        ctx.textAlign = 'center';
        ctx.font = '11px Orbitron';
        ctx.fillStyle = '#888';
        ctx.fillText('Yellow line = where your turret points (mouse). Blue line = hull direction (WASD).', CANVAS_WIDTH / 2, panelY - 22);
        ctx.fillStyle = '#666';
        ctx.fillText('Drive one way, shoot another — independent control is your biggest advantage!', CANVAS_WIDTH / 2, panelY - 8);
    }

    // --- Shoot: target dummy ---
    if (step.id === 'shoot' && targetDummy && targetDummy.alive) {
        const bx = targetDummy.pos.x;
        const by = targetDummy.pos.y - 50;
        const bw = 60;
        const bh = 10;

        const targetPulse = Math.sin(stepTimer * 4) * 0.25 + 0.75;
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillStyle = 'rgba(231,76,60,' + targetPulse + ')';
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 15;
        ctx.fillText('🎯 TARGET DUMMY', bx, by - 16);
        ctx.shadowBlur = 0;

        ctx.font = '12px Orbitron';
        ctx.fillStyle = '#eaeaea';
        ctx.fillText('Shots: ' + shotCount + ' / 3', bx, by + bh + 20);

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.roundRect(bx - bw/2, by, bw, bh, 4);
        ctx.fill();

        const healthPct = Math.max(0, targetDummy.health / targetDummy.maxHealth);
        ctx.fillStyle = healthPct > 0.5 ? '#2ecc71' : healthPct > 0.25 ? '#f39c12' : '#e74c3c';
        ctx.beginPath();
        ctx.roundRect(bx - bw/2, by, bw * healthPct, bh, 4);
        ctx.fill();
    }

    // --- Boost energy indicator ---
    if (step.id === 'boost' && G.player) {
        const boostPct = G.player.maxBoostEnergy > 0 ? (G.player.boostEnergy / G.player.maxBoostEnergy) : 1;
        const pulseBoost = Math.sin(stepTimer * 4) * 0.3 + 0.7;

        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillStyle = 'rgba(155,89,182,' + pulseBoost + ')';
        ctx.shadowColor = '#9b59b6';
        ctx.shadowBlur = 12;
        ctx.fillText('⚡ BOOST ENERGY: ' + Math.round(boostPct * 100) + '%', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 140);
        ctx.shadowBlur = 0;

        ctx.font = '12px Orbitron';
        if (boostTimer > 0) {
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('Boosting: ' + boostTimer.toFixed(1) + 's / 2.0s — HOLD SHIFT + MOVE', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 124);
        } else if (hasBoosted) {
            ctx.fillStyle = '#2ecc71';
            ctx.fillText('✓ 2s boost complete! Release SHIFT to see purple bar recharge', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 124);
        } else {
            ctx.fillStyle = '#eaeaea';
            ctx.fillText('Hold SHIFT + move WASD to boost for 2 seconds', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 124);
        }
    }

    // --- Mine contextual hints ---
    if (step.id === 'mine') {
        const liveMines = G.mines.filter(m => !m.exploded).length;
        const minePulse = Math.sin(stepTimer * 3) * 0.2 + 0.8;

        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Orbitron';
        if (liveMines === 0) {
            ctx.fillStyle = 'rgba(241,196,15,' + minePulse + ')';
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 10;
            ctx.fillText('⌨ Press C to drop a mine behind your tank', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 142);
            ctx.shadowBlur = 0;
            ctx.font = '11px Orbitron';
            ctx.fillStyle = '#999';
            ctx.fillText('Mines arm after 3 seconds, then an enemy will appear!', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 126);
        } else if (G.enemies.length === 0) {
            ctx.fillStyle = 'rgba(46,204,113,' + minePulse + ')';
            ctx.shadowColor = '#2ecc71';
            ctx.shadowBlur = 10;
            ctx.fillText('✓ Mine placed! Enemy approaching in...', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 142);
            ctx.shadowBlur = 0;
            ctx.font = '11px Orbitron';
            ctx.fillStyle = '#999';
            ctx.fillText('Wait for the enemy — then lead it over the mine!', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 126);
        } else if (!enemyTriggeredMine) {
            const enemyAlive = G.enemies.some(e => e.alive && e.health > 0);
            if (enemyAlive) {
                ctx.fillStyle = 'rgba(231,76,60,' + minePulse + ')';
                ctx.shadowColor = '#e74c3c';
                ctx.shadowBlur = 15;
                ctx.fillText('⚠ ENEMY CHASING! Lead it over your mine! ⚠', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 142);
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = '#2ecc71';
                ctx.shadowColor = '#2ecc71';
                ctx.shadowBlur = 15;
                ctx.fillText('💥 Enemy destroyed by mine!', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 142);
                ctx.shadowBlur = 0;
            }
        }
    }

    if (showSuccess) {
        ctx.fillStyle = 'rgba(39,174,96,0.12)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.textAlign = 'center';
        ctx.font = 'bold 26px Orbitron';
        ctx.fillStyle = '#2ecc71';
        ctx.shadowColor = '#2ecc71';
        ctx.shadowBlur = 30;
        ctx.fillText(step.successMsg, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'center';
    ctx.font = '9px Orbitron';
    ctx.fillStyle = '#444';
    ctx.fillText('Press ESC to skip tutorial', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 6);
}

export function startTutorial() {
	if (isActive) {
		removeSpotlight();
	}
	isActive = true;
	currentStep = 0;
	showSuccess = false;
	successTimer = 0;
	stepTimer = 0;
	shotCount = 0;
	boostTimer = 0;
	mineTimer = 0;
	enemyTriggeredMine = false;
	fuelDrained = false;
	hasBoosted = false;
	moveKeyIndex = 0;
	wrongKeyTimer = 0;
	prevKeys = {};
	moveMarker = null;
	moveStartPos = null;
	targetDummy = null;

	setupTutorialArena();
	showOverlay(null);
	log('info', 'TUTORIAL', 'Starting interactive walkthrough');
}

function showModeOverview() {
    isActive = false;
    removeSpotlight();
    markTutorialSeen();

    const confettiColors = ['#f39c12','#e74c3c','#9b59b6','#3498db','#2ecc71','#f1c40f','#e91e63'];
    for(let i=0;i<80;i++){
        const angle=Math.random()*Math.PI*2;
        const speed=100+Math.random()*300;
        const color=confettiColors[Math.floor(Math.random()*confettiColors.length)];
        G.particles.push(new Particle(CANVAS_WIDTH/2,CANVAS_HEIGHT/2,Math.cos(angle)*speed,Math.sin(angle)*speed-100,color,1.5+Math.random()));
    }

    import('./progression.js').then(({addCoins,addGems})=>{ addCoins(50); addGems(1); });

    document.getElementById('tutorialOverlay').style.display = 'flex';
    document.getElementById('tutorialOverlay').classList.add('active');
    document.getElementById('tutorialOverlay').classList.add('overlay-home');
    G.gameState = GameState.MENU;
    log('info', 'TUTORIAL', 'Controls tutorial complete');
}

export function closeTutorial() {
	isActive = false;
	currentStep = 0;
	showSuccess = false;
	successTimer = 0;
	stepTimer = 0;
	shotCount = 0;
	boostTimer = 0;
	mineTimer = 0;
	enemyTriggeredMine = false;
	fuelDrained = false;
	hasBoosted = false;
	moveKeyIndex = 0;
	wrongKeyTimer = 0;
	prevKeys = {};
	moveMarker = null;
	moveStartPos = null;
	removeSpotlight();
	targetDummy = null;
	G.player = null;
	G.walls = [];
	G.bullets = [];
	G.particles = [];
	G.mines = [];
	G.enemies = [];
	G.gameState = GameState.MENU;

    const to = document.getElementById('tutorialOverlay');
    to.style.display = 'none';
    to.classList.remove('active', 'overlay-home');

    showOverlay('loginOverlay');
    log('info', 'TUTORIAL', 'Tutorial closed');
}

export function autoShowTutorial() {
    if (!isTutorialSeen()) {
        setTimeout(() => { startTutorial(); }, 500);
    }
}

window.startTutorial = startTutorial;
window.closeTutorial = closeTutorial;
window.showTutorial = startTutorial;
