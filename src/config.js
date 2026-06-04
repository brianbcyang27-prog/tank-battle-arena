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

// ==================== WEAPONS ====================
export const WEAPONS = [
    { id: 'standard', name: 'Standard Cannon', cost: 0,  currency: null,  minRank: null,
      fireRate: 1, damage: 1, speed: 1, spread: 0, bullets: 1, piercing: false,
      magazineSize: 12, reloadTime: 1.2, bounce: 0, weight: 1.0,
      bulletColor: '#ffffff', bulletSize: 1, trailEffect: 'normal', impactEffect: 'normal',
      desc: 'Reliable all-around cannon' },
    { id: 'rapid',    name: 'Rapid Fire',      cost: 300, currency: 'coins', minRank: 'Bronze II',
      fireRate: 0.5,  damage: 0.6, speed: 1.0, spread: 0.04, bullets: 1, piercing: false,
      magazineSize: 20, reloadTime: 2.0, bounce: 1, weight: 0.7,
      bulletColor: '#5dade2', bulletSize: 0.7, trailEffect: 'spark', impactEffect: 'spark',
      desc: 'Fire twice as fast with lighter shots' },
    { id: 'cannon',   name: 'Heavy Cannon',    cost: 500, currency: 'coins', minRank: 'Silver I',
      fireRate: 1.6,  damage: 2.2, speed: 0.8, spread: 0, bullets: 1, piercing: false,
      magazineSize: 6,  reloadTime: 2.5, bounce: 1, weight: 1.3,
      bulletColor: '#e67e22', bulletSize: 1.6, trailEffect: 'beam', impactEffect: 'explosion',
      desc: 'Slow but devastating — 2.2x damage' },
    { id: 'shotgun',  name: 'Shotgun',         cost: 750, currency: 'coins', minRank: 'Silver II',
      fireRate: 1.3,  damage: 0.7, speed: 0.9, spread: 0.15, bullets: 5, piercing: false,
      magazineSize: 8,  reloadTime: 2.0, bounce: 2, weight: 1.15,
      bulletColor: '#f1c40f', bulletSize: 0.8, trailEffect: 'scatter', impactEffect: 'normal',
      desc: 'Fires a spread of 5 pellets — bounces off walls' },
    { id: 'sniper',   name: 'Railgun',         cost: 1000, currency: 'coins', minRank: 'Gold I',
      fireRate: 1.8,  damage: 1.5, speed: 2.0, spread: 0, bullets: 1, piercing: false,
      magazineSize: 5,  reloadTime: 3.5, bounce: 3, weight: 1.4,
      bulletColor: '#8e44ad', bulletSize: 0.9, trailEffect: 'beam', impactEffect: 'electric',
      desc: 'High-velocity round — 3 bounces, slower reload' },
    { id: 'minigun',  name: 'Minigun',         cost: 1500, currency: 'coins', minRank: 'Gold II',
      fireRate: 6,    damage: 0.3, speed: 1.0, spread: 0.06, bullets: 1, piercing: false,
      magazineSize: 300, reloadTime: 4.0, bounce: 0, weight: 2.0, recoil: 20,
      bulletColor: '#e74c3c', bulletSize: 0.6, trailEffect: 'spark', impactEffect: 'spark',
      desc: '300-round rotary minigun — heavy, slow, constant recoil' },

    // Season 1 exclusive weapons (not in shop — earned via battle pass)
    { id: 'flamethrower', name: 'Flamethrower',  cost: 0, currency: null, minRank: null, session: 's1',
      fireRate: 0.2, damage: 0.4, speed: 0.6, spread: 0.12, bullets: 3, piercing: false,
      magazineSize: 40, reloadTime: 2.5, bounce: 0, weight: 1.2,
      bulletColor: '#ff4500', bulletSize: 0.9, trailEffect: 'spark', impactEffect: 'explosion',
      desc: 'Season 1 — short-range flame spray, 3 pellets per shot' },
    { id: 'plasma_cannon', name: 'Plasma Cannon', cost: 0, currency: null, minRank: null, session: 's1',
      fireRate: 1.4, damage: 2.5, speed: 1.3, spread: 0, bullets: 1, piercing: true,
      magazineSize: 8, reloadTime: 3.0, bounce: 0, weight: 1.5,
      bulletColor: '#8e44ad', bulletSize: 1.3, trailEffect: 'beam', impactEffect: 'electric',
      desc: 'Season 1 — superheated plasma bolt, pierces through enemies' },
];

// ==================== SKINS ====================
export const SKINS = [
    { id: 'classic',   name: 'Classic',       cost: 0,   currency: null,   minRank: null,
      color: '#e94560', trailColor: '#ff6b6b', explosionColor: '#e94560', turretGlow: null,
      bodyPattern: 'carbon', glowColor: null, visorColor: '#ffffff',
      desc: 'The original red battle tank — carbon fiber reinforced' },
    { id: 'golden',    name: 'Golden Warrior', cost: 30,  currency: 'gems', minRank: null,
      color: '#ffd700', trailColor: '#ffd700', explosionColor: '#ffd700', turretGlow: '#ffd700',
      bodyPattern: 'etched', glowColor: '#ffd700', visorColor: '#fff8dc',
      desc: 'Solid gold with an etched royal crest' },
    { id: 'neon',      name: 'Neon Blade',     cost: 50,  currency: 'gems', minRank: 'Bronze III',
      color: '#00ff88', trailColor: '#00ff88', explosionColor: '#00ff88', turretGlow: '#00ff88',
      bodyPattern: 'circuit', glowColor: '#00ff88', visorColor: '#88ffcc',
      desc: 'Radioactive green with live circuit filaments' },
    { id: 'inferno',   name: 'Inferno',        cost: 80,  currency: 'gems', minRank: 'Silver II',
      color: '#ff4500', trailColor: '#ff4500', explosionColor: '#ff5200', turretGlow: '#ff4500',
      bodyPattern: 'flame', glowColor: '#ff6a00', visorColor: '#ffcc00',
      desc: 'Burning rage on tracks — flame-kissed armor' },
    { id: 'shadow',    name: 'Shadow Strike',  cost: 120, currency: 'gems', minRank: 'Gold I',
      color: '#8a2be2', trailColor: '#8a2be2', explosionColor: '#9b30ff', turretGlow: '#8a2be2',
      bodyPattern: 'stealth', glowColor: '#bb55ff', visorColor: '#cc88ff', traceFade: true,
      desc: 'Dark stealth weave with phased resonator — fading tracks' },
    { id: 'frost',     name: 'Crystal Frost',  cost: 150, currency: 'gems', minRank: 'Diamond',
      color: '#00bfff', trailColor: '#00bfff', explosionColor: '#87ceeb', turretGlow: '#00bfff',
      bodyPattern: 'crystal', glowColor: '#66ddff', visorColor: '#e0f7ff', traceFade: true,
      desc: 'Cryo-forged crystal armor — sub-zero military grade' },

    // Season 1 exclusive skins (not in shop — earned via battle pass)
    { id: 'blaze',     name: 'Blaze',         cost: 0, currency: null, minRank: null, session: 's1',
      color: '#ff6a00', trailColor: '#ff4500', explosionColor: '#ff8c00', turretGlow: '#ff4500',
      bodyPattern: 'flame', glowColor: '#ff6a00', visorColor: '#ffcc00',
      desc: 'Season 1 exclusive — forged in the fires of Ignition' },
    { id: 'magma',     name: 'Magma',         cost: 0, currency: null, minRank: null, session: 's1',
      color: '#8b0000', trailColor: '#cc3300', explosionColor: '#ff3300', turretGlow: '#cc3300',
      bodyPattern: 'etched', glowColor: '#cc3300', visorColor: '#ff6633',
      desc: 'Season 1 exclusive — molten rock given deadly form' },
    { id: 'ignition_overlord', name: 'Ignition Overlord', cost: 0, currency: null, minRank: null, session: 's1',
      color: '#ffd700', trailColor: '#ffaa00', explosionColor: '#ffd700', turretGlow: '#ffd700',
      bodyPattern: 'circuit', glowColor: '#ffd700', visorColor: '#fff8dc', traceFade: true,
      desc: 'Season 1 Grand Prize — the ultimate Ignition champion\'s armor' },
];

// ==================== XP RANKS ====================
// Exponential curve: early ranks fast, late ranks take serious grinding
export const RANKS = [
    { minXp: 0,      title: 'Bronze I',    icon: '🥉' },
    { minXp: 200,    title: 'Bronze II',   icon: '🥉' },
    { minXp: 500,    title: 'Bronze III',  icon: '🥉' },
    { minXp: 1000,   title: 'Silver I',    icon: '🥈' },
    { minXp: 2000,   title: 'Silver II',   icon: '🥈' },
    { minXp: 3500,   title: 'Silver III',  icon: '🥈' },
    { minXp: 5500,   title: 'Gold I',      icon: '🥇' },
    { minXp: 8000,   title: 'Gold II',     icon: '🥇' },
    { minXp: 12000,  title: 'Gold III',    icon: '🥇' },
    { minXp: 18000,  title: 'Diamond',     icon: '💎' },
    { minXp: 25000,  title: 'Elite',       icon: '⭐' },
    { minXp: 35000,  title: 'Legend',      icon: '👑' },
];

// ==================== CAMPAIGN STAGES ====================
export const LEVELS_PER_STAGE = 12;
export const STAGE_COUNT = 5;

export const STAGES = [
    {
        id: 'volcanic', name: 'Volcanic Forge',
        desc: 'Navigate molten rock and scorching heat',
        icon: '🌋',
        grip: 0.5,
        hazard: 'lava',
        colors: { bg: '#1a0808', wall: '#3a1510', wallBorder: '#6a2010' },
        enemyTierBase: 1, enemyCountBase: 1,
    },
    {
        id: 'ice', name: 'Frozen Tundra',
        desc: 'Master the ice with drifting momentum',
        icon: '❄️',
        grip: 0.08,
        hazard: null,
        colors: { bg: '#0a1420', wall: '#1a2a40', wallBorder: '#2a4a60' },
        enemyTierBase: 1, enemyCountBase: 2,
    },
    {
        id: 'forest', name: 'Verdant Wilds',
        desc: 'Limited visibility in the dense canopy',
        icon: '🌿',
        grip: 0.5,
        hazard: 'fog',
        colors: { bg: '#0a1208', wall: '#1a2a15', wallBorder: '#2a4a20' },
        enemyTierBase: 2, enemyCountBase: 2,
    },
    {
        id: 'desert', name: 'Scorched Dunes',
        desc: 'Sandstorms push you off course',
        icon: '🏜️',
        grip: 0.45,
        hazard: 'wind',
        colors: { bg: '#1a1408', wall: '#3a2a15', wallBorder: '#5a3a15' },
        enemyTierBase: 2, enemyCountBase: 3,
    },
    {
        id: 'factory', name: 'The Forge',
        desc: 'Moving walls and tight corridors',
        icon: '🏭',
        grip: 0.5,
        hazard: 'movingWalls',
        colors: { bg: '#0a0a12', wall: '#1a1a2a', wallBorder: '#3a3a5a' },
        enemyTierBase: 3, enemyCountBase: 3,
    },
];

export function getStageForLevel(globalLevel) {
    const idx = Math.min(Math.floor((globalLevel - 1) / LEVELS_PER_STAGE), STAGE_COUNT - 1);
    return { stageIndex: idx, ...STAGES[idx] };
}

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

// ==================== ARCADE MODE ====================
export const ARCADE_LIVES = 3;
export const ARCADE_WAVE = {
    initialEnemies: 1,
    enemiesPerWave: 0.5,   // additional enemies per wave
    maxEnemies: 8,
    tierScaleWaves: 3,     // waves per tier increase
    maxWaves: Infinity,
    spawnDelay: 1.5,       // seconds between wave clear and next wave spawn
};

export const QL_PARAMS = {
    lr: 0.1,
    gamma: 0.9,
    epsilon: 0.3,
    epsilonDecay: 0.998,
};
