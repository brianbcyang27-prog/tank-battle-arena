import { GameState, DEFAULT_SETTINGS } from './config.js';

// ==================== SHARED MUTABLE STATE ====================
export const G = {
    // Canvas
    ctx: null,

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
    currentUser: null,
    remoteTanks: {},
    remoteBullets: {},
    _multiplayerStarting: false,
    _bulletSeq: 0,
    bulletListenerRef: null,
    playerUpdateInterval: null,

    // Settings
    settings: { ...DEFAULT_SETTINGS },

    // Log helper flag
    _log: true,

    // Friends
    friendCode: null,
    friendUids: new Set()
};
