import { GameState, DEFAULT_SETTINGS } from './config.js';

// ==================== SHARED MUTABLE STATE ====================
export const G = {
    // Canvas
    ctx: null,

    screenShake: 0,
    shake: { intensity: 0, elapsed: 0, duration: 0 },
    camera: { x: 0, y: 0, velX: 0, velY: 0 },
    safePeriod: 2.0,

    // HUD visual feedback
    hitMarkers: [],       // { x, y, time, maxTime }
    damageNumbers: [],    // { x, y, text, time, maxTime, vy, color }

    ui: {
        overlayStack: [],
        sidebarOpen: false,
        currentSettingsTab: 'loadout',
        fpsMonitorVisible: false,
        toastQueue: [],
        gameOverData: null,
    },

    // Game objects
    player: null,
    enemies: [],
    bullets: [],
    walls: [],
    particles: [],
    mines: [],

    // Game state
    gameState: GameState.MENU,
    level: 1,
    score: 0,
    levelStartTime: 0,
    levelTime: 0,
    lastTime: performance.now(),

    // Input
    keys: {},
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,

    // Touch input state
    touch: {
        active: false,
        joystickId: -1,     // touch identifier for left-half joystick
        joystickCenterX: 0, // canvas-coordinate center of joystick
        joystickCenterY: 0,
        aimId: -1,          // touch identifier for right-half aiming
        aimStartX: 0,       // used for tap detection
        aimStartY: 0,
        aimStartTime: 0,
        tapFired: false,    // prevent double-fire on tap
    },

    // Multiplayer
    isMultiplayerGame: false,
    lobbyId: null,
    gameMode: 'single',
    aiDifficulty: 2, // 1=easy, 2=medium, 3=hard (for vs AI mode)
  currentUser: null,
  userProfile: null,
  remoteTanks: {},
    remoteBullets: {},
    _multiplayerStarting: false,
    _bulletSeq: 0,
    _readyAt: 0,
    bulletListenerRef: null,
    playerUpdateInterval: null,

    // Settings
    settings: { ...DEFAULT_SETTINGS },

    // Log helper flag
    _log: true,

    // AI Match (best-of-9, first to 5 wins)
    aiMatch: {
        myScore: 0,
        aiScore: 0,
        round: 1,
        maxRounds: 9,
        state: 'playing'  // 'playing' | 'roundOver' | 'matchOver'
    },
    aiTracker: null,      // PlayerBehaviorTracker instance

    // Friends
    friendCode: null,
    friendUids: [],

    // ARCADE mode (wave-based Q-learning)
    arcadeQL: null,       // QLearningAgent instance (set on arcade start)
    arcadeLives: 3,       // remaining lives
    arcadeMaxLives: 3,    // starting lives
    arcadeWave: 1,        // current wave number
    arcadeKills: 0,       // kills in this arcade game
    arcadeWaveComplete: false,  // true while wave transition is happening
    _arcadeWaveTimer: 0,  // countdown until next wave spawns
};
