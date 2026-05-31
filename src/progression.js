import { SKINS, WEAPONS, RANKS, MISSION_POOL } from './config.js';
import { log } from './log.js';

const STORAGE_KEY = 'tankBattle_progression';

// ==================== INITIAL STATE ====================
function defaultProgression() {
    return {
        gems: 0,
        coins: 200, // starting coins
        xp: 0,
        ownedSkins: ['classic'],
        equippedSkin: 'classic',
        ownedWeapons: ['standard'],
        equippedWeapon: 'standard',
        missions: [],
        missionDate: '',
        levelCompletes: 0,
        totalKills: 0,
        totalMineKills: 0,
        totalSurvivalTime: 0,
        aiWins: 0,
        highestSingleScore: 0,
    };
}

// ==================== STORAGE ====================
let P = { ...defaultProgression() };

export function loadProgression() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const saved = JSON.parse(raw);
            P = { ...defaultProgression(), ...saved };
            // Ensure owned arrays exist
            if (!P.ownedSkins || P.ownedSkins.length === 0) P.ownedSkins = ['classic'];
            if (!P.ownedWeapons || P.ownedWeapons.length === 0) P.ownedWeapons = ['standard'];
            log('info', 'PROG', 'Progression loaded: ' + P.gems + ' gems, ' + P.coins + ' coins, ' + P.xp + ' xp');
        }
    } catch (e) {
        log('warn', 'PROG', 'Failed to load progression: ' + e);
    }
    ensureMissions();
}

function saveProgression() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(P));
    } catch (e) {
        log('warn', 'PROG', 'Failed to save progression: ' + e);
    }
}

loadProgression();

// ==================== CURRENCY ====================
export function getGems() { return P.gems; }
export function getCoins() { return P.coins; }
export function getXp() { return P.xp; }

export function addGems(amount) {
    if (amount <= 0) return;
    P.gems += amount;
    saveProgression();
}

export function addCoins(amount) {
    if (amount <= 0) return;
    P.coins += amount;
    saveProgression();
}

export function addXp(amount) {
    if (amount <= 0) return;
    P.xp += amount;
    saveProgression();
}

function spendGems(amount) {
    if (P.gems < amount) return false;
    P.gems -= amount;
    saveProgression();
    return true;
}

function spendCoins(amount) {
    if (P.coins < amount) return false;
    P.coins -= amount;
    saveProgression();
    return true;
}

// ==================== RANK ====================
export function getRank() {
    let rank = RANKS[0];
    for (const r of RANKS) {
        if (P.xp >= r.minXp) rank = r;
    }
    return rank;
}

export function getRankProgress() {
    let prev = 0, next = 0;
    for (let i = 0; i < RANKS.length; i++) {
        if (P.xp >= RANKS[i].minXp) prev = RANKS[i].minXp;
        if (RANKS[i].minXp > prev) { next = RANKS[i].minXp; break; }
    }
    if (next === 0) return 1; // max rank
    const range = next - prev;
    if (range <= 0) return 1;
    return (P.xp - prev) / range;
}

export function getNextRank() {
    for (let i = 0; i < RANKS.length; i++) {
        if (RANKS[i].minXp > P.xp) return RANKS[i];
    }
    return null;
}

// ==================== INVENTORY ====================
export function getOwnedSkins() { return [...P.ownedSkins]; }
export function getOwnedWeapons() { return [...P.ownedWeapons]; }
export function getEquippedSkin() { return P.equippedSkin; }
export function getEquippedWeapon() { return P.equippedWeapon; }

export function getSkinData(id) {
    return SKINS.find(s => s.id === id) || SKINS[0];
}

export function getWeaponData(id) {
    return WEAPONS.find(w => w.id === id) || WEAPONS[0];
}

export function ownSkin(id) { return P.ownedSkins.includes(id); }
export function ownWeapon(id) { return P.ownedWeapons.includes(id); }

export function buySkin(id) {
    const skin = SKINS.find(s => s.id === id);
    if (!skin) return { ok: false, reason: 'Skin not found' };
    if (P.ownedSkins.includes(id)) return { ok: false, reason: 'Already owned' };
    if (skin.currency === 'gems') {
        if (!spendGems(skin.cost)) return { ok: false, reason: 'Not enough gems' };
    } else if (skin.currency === 'coins') {
        if (!spendCoins(skin.cost)) return { ok: false, reason: 'Not enough coins' };
    }
    P.ownedSkins.push(id);
    saveProgression();
    log('info', 'SHOP', 'Bought skin: ' + skin.name);
    return { ok: true };
}

export function buyWeapon(id) {
    const weapon = WEAPONS.find(w => w.id === id);
    if (!weapon) return { ok: false, reason: 'Weapon not found' };
    if (P.ownedWeapons.includes(id)) return { ok: false, reason: 'Already owned' };
    if (!spendCoins(weapon.cost)) return { ok: false, reason: 'Not enough coins' };
    P.ownedWeapons.push(id);
    saveProgression();
    log('info', 'SHOP', 'Bought weapon: ' + weapon.name);
    return { ok: true };
}

export function equipSkin(id) {
    if (!P.ownedSkins.includes(id)) return false;
    P.equippedSkin = id;
    saveProgression();
    return true;
}

export function equipWeapon(id) {
    if (!P.ownedWeapons.includes(id)) return false;
    P.equippedWeapon = id;
    saveProgression();
    return true;
}

// ==================== MISSIONS ====================
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function pickRandomMissions(pool, count) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(m => ({
        id: m.id,
        progress: 0,
        completed: false,
        claimed: false,
    }));
}

function ensureMissions() {
    const today = getTodayDate();
    if (P.missionDate !== today || P.missions.length === 0) {
        P.missions = pickRandomMissions(MISSION_POOL, 3);
        P.missionDate = today;
        saveProgression();
        log('info', 'MISSIONS', 'Generated ' + P.missions.length + ' daily missions');
    }
}

export function getMissions() {
    ensureMissions();
    return P.missions.map(m => {
        const template = MISSION_POOL.find(t => t.id === m.id);
        return { ...m, ...template };
    });
}

export function claimMissionReward(missionId) {
    const idx = P.missions.findIndex(m => m.id === missionId);
    if (idx === -1) return { ok: false, reason: 'Mission not found' };
    const m = P.missions[idx];
    if (!m.completed) return { ok: false, reason: 'Mission not completed' };
    if (m.claimed) return { ok: false, reason: 'Already claimed' };
    const template = MISSION_POOL.find(t => t.id === missionId);
    if (!template) return { ok: false, reason: 'Template not found' };

    // Grant rewards
    if (template.rewards.gems) addGems(template.rewards.gems);
    if (template.rewards.coins) addCoins(template.rewards.coins);
    if (template.rewards.xp) addXp(template.rewards.xp);

    P.missions[idx].claimed = true;
    saveProgression();
    log('info', 'MISSIONS', 'Claimed: ' + template.title);
    return { ok: true, rewards: template.rewards };
}

export function updateMissionProgress(trackType, increment = 1) {
    ensureMissions();
    let changed = false;
    for (let i = 0; i < P.missions.length; i++) {
        const m = P.missions[i];
        const template = MISSION_POOL.find(t => t.id === m.id);
        if (!template || template.trackType !== trackType) continue;
        if (m.completed || m.claimed) continue;
        m.progress += increment;
        if (m.progress >= template.count) {
            m.completed = true;
            changed = true;
        }
    }
    if (changed) saveProgression();
}

// ==================== TRACKING (called from game code) ====================
export function trackKill() {
    P.totalKills++;
    saveProgression();
    updateMissionProgress('kill', 1);
}

export function trackMineKill() {
    P.totalMineKills++;
    saveProgression();
    updateMissionProgress('mineKill', 1);
}

export function trackLevelComplete() {
    P.levelCompletes++;
    saveProgression();
    updateMissionProgress('levelComplete', 1);
}

let _survivalSaveTimer = 0;
export function trackSurvivalTime(seconds) {
    const old = P.totalSurvivalTime;
    P.totalSurvivalTime += seconds;
    _survivalSaveTimer += seconds;
    // Only save every 5 seconds to reduce writes
    if (_survivalSaveTimer >= 5) {
        saveProgression();
        _survivalSaveTimer = 0;
    }
    // Check if crossed a 10-second threshold since last update
    const wasBefore = Math.floor(old / 10) * 10;
    const nowAfter = Math.floor(P.totalSurvivalTime / 10) * 10;
    if (nowAfter > wasBefore) {
        updateMissionProgress('survivalTime', nowAfter - wasBefore);
    }
}

export function trackAiWin() {
    P.aiWins++;
    saveProgression();
    updateMissionProgress('aiWin', 1);
}

export function trackHighScore(score) {
    if (score > P.highestSingleScore) {
        P.highestSingleScore = score;
        saveProgression();
    }
    updateMissionProgress('highScore', score);
}

// ==================== EARNINGS (called on level complete / game over) ====================
export function awardLevelComplete(level) {
    const base = 50 + level * 25;
    addCoins(base);
    addXp(100 + level * 50);
    trackLevelComplete();
    log('info', 'PROG', 'Level ' + level + ' rewards: +' + base + ' coins, +' + (100 + level * 50) + ' xp');
    return { coins: base, xp: 100 + level * 50 };
}

export function awardGameOver(score) {
    // Small consolation
    const coins = Math.max(5, Math.floor(score / 100));
    const xp = Math.max(10, Math.floor(score / 50));
    addCoins(coins);
    addXp(xp);
    trackHighScore(score);
    log('info', 'PROG', 'Game over rewards: +' + coins + ' coins, +' + xp + ' xp');
    return { coins, xp };
}

export function awardAiWin() {
    addCoins(100);
    addXp(200);
    trackAiWin();
    log('info', 'PROG', 'AI match win: +100 coins, +200 xp');
    return { coins: 100, xp: 200 };
}

export function awardAiRoundWin() {
    addCoins(25);
    addXp(50);
    return { coins: 25, xp: 50 };
}

// ==================== APPLY TO PLAYER ====================
export function applyProgressionToPlayer(player) {
    if (!player) return;
    const skin = getSkinData(P.equippedSkin);
    if (skin && skin.color) {
        player.color = skin.color;
        player.bulletTrailColor = skin.trailColor || null;
    }
    const weapon = getWeaponData(P.equippedWeapon);
    if (weapon) {
        player.fireRate = weapon.fireRate;
        player.bulletDamage = weapon.damage;
        player.bulletSpeed = 500 * weapon.speed;
        player.bulletSpread = weapon.spread;
        player.bulletCount = weapon.bullets;
        player.bulletPiercing = weapon.piercing;
        player.maxAmmo = weapon.magazineSize;
        player.ammo = weapon.magazineSize;
        player.reloadDuration = (weapon.reloadTime || 1.2) * 1000;
        player.reloading = false;
        player.weaponId = weapon.id;
    }
}
