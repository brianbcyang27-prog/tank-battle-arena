// ==================== CONSTANTS ====================
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;
export const CELL_SIZE = 40;

export const COLORS = {
    background: '#1a1a2e', wall: '#16213e', wallBorder: '#0f3460',
    player: '#e94560', playerTurret: '#ff6b6b', player2: '#3498db',
    enemies: ['#f39c12','#27ae60','#9b59b6','#e74c3c'],
    bullet: '#ffffff', bulletGlow: 'rgba(255,255,255,0.5)',
    health: '#e94560', healthBg: '#333', text: '#eaeaea',
    mine: '#f1c40f', mineDanger: '#e74c3c', explosion: '#ff8c00'
};

export const GameState = { MENU:'menu', LOADING:'loading', PLAYING:'playing', LEVEL_COMPLETE:'levelComplete', GAME_OVER:'gameOver' };

export const DEFAULT_SETTINGS = {
    friendlyFire: true,
    showFPS: false,
    autoReady: true,
    volume: 50
};
