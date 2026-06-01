import { G } from './state.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GameState } from './config.js';
import { Player, Wall } from './engine.js';
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
        successMsg: 'Excellent! You control where your tank goes'
    },
    {
        id: 'fuel',
        title: 'FUEL MANAGEMENT',
        instruction: 'Moving consumes fuel — stop to let it regenerate',
        hint: 'Watch the green FUEL bar on the HUD. Run out and you\'ll slow down!',
        successMsg: 'Fuel management keeps you mobile in battle'
    },
    {
        id: 'aim',
        title: 'AIMING',
        instruction: 'Move your mouse to aim the turret',
        hint: 'Drive one way, shoot another — independent hull and turret control',
        successMsg: 'Deadly aim! Fire in any direction while moving'
    },
    {
        id: 'shoot',
        title: 'COMBAT',
        instruction: 'Left Click to fire your cannon',
        hint: 'Watch the ammo counter and reload bar in the bottom-right HUD',
        successMsg: 'Boom! Direct hit!'
    },
    {
        id: 'boost',
        title: 'BOOST',
        instruction: 'Hold SHIFT while moving for a burst of speed',
        hint: 'Purple bar = boost energy. Drains fast, recharges when you release SHIFT',
        successMsg: 'Speed demon! Use boost to dodge and close distances'
    },
    {
        id: 'mine',
        title: 'MINES',
        instruction: 'Press C to place a mine behind your tank',
        hint: 'Mines arm after 3 seconds. Max 3 at a time. Enemies trigger them!',
        successMsg: 'Mines control the battlefield — use them wisely'
    }
];

let currentStep = 0;
let stepTimer = 0;
let showSuccess = false;
let successTimer = 0;
let hasMoved = false;
let totalDist = 0;
let lastPos = null;
let initialAngle = null;
let angleChanged = false;
let hasShot = false;
let hasBoosted = false;
let hasMined = false;
let fuelDrained = false;
let isActive = false;

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
        [840, 120], [840, 160], [880, 120], [880, 160]
    ];
    for (let [wx, wy] of wallPositions) {
        G.walls.push(new Wall(wx, wy, 40, 40));
    }

    G.player = new Player(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    G.player.health = 3;
    G.player.maxHealth = 3;
    G.player.maxAmmo = 99;
    G.player.ammo = 99;

    G.gameState = GameState.TUTORIAL;
    G.levelTime = 0;
    G.score = 0;
}

function resetStepState() {
    hasMoved = false;
    totalDist = 0;
    lastPos = G.player ? G.player.pos.clone() : null;
    initialAngle = G.player ? G.player.turretAngle : null;
    angleChanged = false;
    hasShot = false;
    hasBoosted = false;
    hasMined = false;
    fuelDrained = false;
    stepTimer = 0;
}

function advanceStep() {
    if (currentStep < STEPS.length - 1) {
        showSuccess = true;
        successTimer = 1.5;
    } else {
        showModeOverview();
    }
}

function doAdvance() {
    showSuccess = false;
    currentStep++;
    resetStepState();
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

    switch (step.id) {
        case 'move': {
            const moving = G.keys['w'] || G.keys['a'] || G.keys['s'] || G.keys['d'] ||
                           G.keys['W'] || G.keys['A'] || G.keys['S'] || G.keys['D'] ||
                           G.keys['KeyW'] || G.keys['KeyA'] || G.keys['KeyS'] || G.keys['KeyD'];
            if (moving) hasMoved = true;
            if (hasMoved && G.player) {
                if (lastPos) totalDist += G.player.pos.distanceTo(lastPos);
                lastPos = G.player.pos.clone();
                if (totalDist > 100) advanceStep();
            }
            break;
        }
        case 'fuel': {
            if (G.player && G.player.fuel < 98) fuelDrained = true;
            if (fuelDrained && stepTimer > 2) advanceStep();
            break;
        }
        case 'aim': {
            if (G.player && initialAngle !== null) {
                if (Math.abs(G.player.turretAngle - initialAngle) > 0.3) angleChanged = true;
            }
            if (angleChanged && stepTimer > 1) advanceStep();
            break;
        }
        case 'shoot': {
            if (G.mouseDown) hasShot = true;
            if (!hasShot && G.player && G.player.lastFire > 0) {
                if (performance.now() - G.player.lastFire < 100) hasShot = true;
            }
            if (hasShot) advanceStep();
            break;
        }
        case 'boost': {
            const shiftHeld = G.keys['ShiftLeft'] || G.keys['ShiftRight'];
            const moving = G.keys['w'] || G.keys['a'] || G.keys['s'] || G.keys['d'] ||
                           G.keys['W'] || G.keys['A'] || G.keys['S'] || G.keys['D'] ||
                           G.keys['KeyW'] || G.keys['KeyA'] || G.keys['KeyS'] || G.keys['KeyD'];
            if (shiftHeld && moving) hasBoosted = true;
            if (hasBoosted) advanceStep();
            break;
        }
        case 'mine': {
            if (G.mines.length > 0) hasMined = true;
            if (hasMined) advanceStep();
            break;
        }
    }
}

export function renderTutorial(ctx) {
    if (!isActive || G.gameState !== GameState.TUTORIAL) return;

    const step = STEPS[currentStep];
    if (!step) return;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const barH = 90;
    ctx.fillStyle = 'rgba(13,13,26,0.92)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, barH);
    ctx.strokeStyle = 'rgba(233,69,96,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barH);
    ctx.lineTo(CANVAS_WIDTH, barH);
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.font = '11px Orbitron';
    ctx.fillStyle = '#555';
    ctx.fillText('STEP ' + (currentStep + 1) + ' / ' + STEPS.length, CANVAS_WIDTH - 24, 20);

    ctx.textAlign = 'center';
    ctx.font = '18px Orbitron';
    ctx.fillStyle = '#e94560';
    ctx.fillText(step.title, CANVAS_WIDTH / 2, 34);

    ctx.font = '14px Orbitron';
    ctx.fillStyle = '#eaeaea';
    ctx.fillText(step.instruction, CANVAS_WIDTH / 2, 62);

    ctx.font = '10px Orbitron';
    ctx.fillStyle = '#888';
    ctx.fillText(step.hint, CANVAS_WIDTH / 2, 82);

    if (showSuccess) {
        ctx.fillStyle = 'rgba(39,174,96,0.15)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.textAlign = 'center';
        ctx.font = '24px Orbitron';
        ctx.fillStyle = '#2ecc71';
        ctx.shadowColor = '#2ecc71';
        ctx.shadowBlur = 20;
        ctx.fillText(step.successMsg, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'center';
    ctx.font = '9px Orbitron';
    ctx.fillStyle = '#444';
    ctx.fillText('Press ESC to skip tutorial', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 12);
}

export function startTutorial() {
    isActive = true;
    currentStep = 0;
    showSuccess = false;
    resetStepState();

    setupTutorialArena();
    showOverlay(null);
    log('info', 'TUTORIAL', 'Starting interactive walkthrough');
}

function showModeOverview() {
    isActive = false;
    markTutorialSeen();

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
    G.player = null;
    G.walls = [];
    G.bullets = [];
    G.particles = [];
    G.mines = [];
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
