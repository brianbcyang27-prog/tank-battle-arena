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

export const GameState = { MENU:'menu', LOADING:'loading', READY:'ready', PLAYING:'playing', PAUSED:'paused', LEVEL_COMPLETE:'levelComplete', GAME_OVER:'gameOver', TUTORIAL:'tutorial' };

export const DEFAULT_SETTINGS = {
    friendlyFire: true,
    showFPS: false,
    autoReady: true,
    volume: 50,
};

// ==================== SKINS ====================
export const SKINS = [
    { id: 'classic',   name: 'Classic',       cost: 0,   currency: null,   color: '#e94560', trailColor: '#ff6b6b', explosionColor: '#e94560', turretGlow: null,   desc: 'The original red battle tank' },
    { id: 'golden',    name: 'Golden Warrior', cost: 30,  currency: 'gems', color: '#ffd700', trailColor: '#ffd700', explosionColor: '#ffd700', turretGlow: '#ffd700', desc: 'Solid gold — for the fearless' },
    { id: 'neon',      name: 'Neon Blade',     cost: 50,  currency: 'gems', color: '#00ff88', trailColor: '#00ff88', explosionColor: '#00ff88', turretGlow: '#00ff88', desc: 'Radioactive green energy' },
    { id: 'inferno',   name: 'Inferno',        cost: 80,  currency: 'gems', color: '#ff4500', trailColor: '#ff4500', explosionColor: '#ff5200', turretGlow: '#ff4500', desc: 'Burning rage on tracks' },
    { id: 'shadow',    name: 'Shadow Strike',  cost: 120, currency: 'gems', color: '#8a2be2', trailColor: '#8a2be2', explosionColor: '#9b30ff', turretGlow: '#8a2be2', desc: 'Dark purple menace' },
    { id: 'frost',     name: 'Crystal Frost',  cost: 200, currency: 'gems', color: '#00bfff', trailColor: '#00bfff', explosionColor: '#87ceeb', turretGlow: '#00bfff', desc: 'Sub-zero military grade' },
];

// ==================== WEAPONS ====================
export const WEAPONS = [
    { id: 'standard', name: 'Standard Cannon', cost: 0,  currency: null,
      fireRate: 1, damage: 1, speed: 1, spread: 0, bullets: 1, piercing: false,
      magazineSize: 12, reloadTime: 1.2, bounce: 0,
      bulletColor: '#ffffff', bulletSize: 1, trailEffect: 'normal', impactEffect: 'normal',
      desc: 'Reliable all-around cannon' },
    { id: 'rapid',    name: 'Rapid Fire',      cost: 200, currency: 'coins',
      fireRate: 0.5,  damage: 0.6, speed: 1.0, spread: 0.04, bullets: 1, piercing: false,
      magazineSize: 20, reloadTime: 2.0, bounce: 1,
      bulletColor: '#5dade2', bulletSize: 0.7, trailEffect: 'spark', impactEffect: 'spark',
      desc: 'Fire twice as fast with lighter shots' },
    { id: 'cannon',   name: 'Heavy Cannon',    cost: 400, currency: 'coins',
      fireRate: 1.6,  damage: 2.2, speed: 0.8, spread: 0, bullets: 1, piercing: false,
      magazineSize: 6,  reloadTime: 2.5, bounce: 1,
      bulletColor: '#e67e22', bulletSize: 1.6, trailEffect: 'beam', impactEffect: 'explosion',
      desc: 'Slow but devastating — 2.2x damage' },
    { id: 'shotgun',  name: 'Shotgun',         cost: 600, currency: 'coins',
      fireRate: 1.3,  damage: 0.7, speed: 0.9, spread: 0.15, bullets: 5, piercing: false,
      magazineSize: 8,  reloadTime: 2.0, bounce: 2,
      bulletColor: '#f1c40f', bulletSize: 0.8, trailEffect: 'scatter', impactEffect: 'normal',
      desc: 'Fires a spread of 5 pellets — bounces off walls' },
    { id: 'sniper',   name: 'Railgun',         cost: 800, currency: 'coins',
      fireRate: 1.8,  damage: 3.0, speed: 2.0, spread: 0, bullets: 1, piercing: true,
      magazineSize: 5,  reloadTime: 3.0, bounce: 3,
      bulletColor: '#8e44ad', bulletSize: 0.9, trailEffect: 'beam', impactEffect: 'electric',
      desc: 'Pierces everything — 3 wall bounces' },
];

// ==================== XP RANKS ====================
export const RANKS = [
    { minXp: 0,     title: 'Bronze I',    icon: '🥉' },
    { minXp: 100,   title: 'Bronze II',   icon: '🥉' },
    { minXp: 300,   title: 'Bronze III',  icon: '🥉' },
    { minXp: 600,   title: 'Silver I',    icon: '🥈' },
    { minXp: 1000,  title: 'Silver II',   icon: '🥈' },
    { minXp: 1600,  title: 'Silver III',  icon: '🥈' },
    { minXp: 2400,  title: 'Gold I',      icon: '🥇' },
    { minXp: 3400,  title: 'Gold II',     icon: '🥇' },
    { minXp: 4600,  title: 'Gold III',    icon: '🥇' },
    { minXp: 6000,  title: 'Diamond',     icon: '💎' },
    { minXp: 8000,  title: 'Elite',       icon: '⭐' },
    { minXp: 10000, title: 'Legend',      icon: '👑' },
];

// ==================== MISSIONS ====================
export const MISSION_POOL = [
    { id: 'kill_10',      title: 'Enforcer',       desc: 'Destroy {progress}/{count} enemies',           count: 10,  rewards: { coins: 30,  xp: 50   }, trackType: 'kill' },
    { id: 'kill_30',      title: 'War Machine',     desc: 'Destroy {progress}/{count} enemies',           count: 30,  rewards: { coins: 80,  xp: 150  }, trackType: 'kill' },
    { id: 'complete_3',   title: 'Explorer',        desc: 'Complete {progress}/{count} levels',           count: 3,   rewards: { coins: 50,  xp: 100  }, trackType: 'levelComplete' },
    { id: 'complete_5',   title: 'Adventurer',      desc: 'Complete {progress}/{count} levels',           count: 5,   rewards: { gems: 5,   coins: 100, xp: 200 }, trackType: 'levelComplete' },
    { id: 'mine_5',       title: 'Demolition Expert', desc: 'Kill {progress}/{count} enemies with mines', count: 5,   rewards: { coins: 60,  xp: 100  }, trackType: 'mineKill' },
    { id: 'survive_300',  title: 'Survivor',        desc: 'Survive {progress}/{count} seconds total',     count: 300, rewards: { coins: 40,  xp: 80   }, trackType: 'survivalTime' },
    { id: 'win_ai_3',     title: 'AI Challenger',   desc: 'Win {progress}/{count} Arcade rounds',          count: 3,   rewards: { gems: 3,   coins: 50,  xp: 100 }, trackType: 'aiWin' },
    { id: 'score_5000',   title: 'High Scorer',     desc: 'Score {progress}/{count} points in one game',  count: 5000,rewards: { gems: 5,   coins: 100, xp: 200 }, trackType: 'highScore' },
];
