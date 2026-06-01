import { GameState, DEFAULT_SETTINGS } from './config.js';

// ==================== SHARED MUTABLE STATE ====================
export const G = {
    // Canvas
    ctx: null,

    screenShake: 0,
    safePeriod: 2.0,

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

    // Multiplayer
    isMultiplayerGame: false,
    lobbyId: null,
    gameMode: 'single',
    aiDifficulty: 2, // 1=easy, 2=medium, 3=hard (for vs AI mode)
    currentUser: null,
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
    friendUids: new Set()
};
