import { log } from './log.js';

const STORAGE_KEY = 'tankBattle_lifetimeStats';

// ==================== PER-GAME STATS ====================
let current = null;

// ==================== LIFETIME STATS ====================
let lifetime = null;

function defaultLifetime() {
    return {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalShotsFired: 0,
        totalShotsHit: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        totalDistanceTraveled: 0,
        totalMinesPlaced: 0,
        totalPlayTime: 0
    };
}

function loadLifetime() {
    if (lifetime) return;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        lifetime = raw ? { ...defaultLifetime(), ...JSON.parse(raw) } : defaultLifetime();
    } catch (e) {
        log('warn', 'STATS', 'Failed to load stats: ' + e);
        lifetime = defaultLifetime();
    }
}

function saveLifetime() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lifetime));
    } catch (e) {
        log('warn', 'STATS', 'Failed to save stats: ' + e);
    }
}

// ==================== PUBLIC API ====================

/** Initialise stats for a new game. Call when a match begins. */
export function initStats() {
    current = {
        shotsFired: 0,
        shotsHit: 0,
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        damageTaken: 0,
        distanceTraveled: 0,
        minesPlaced: 0,
        won: false,
        startTime: performance.now(),
        playTime: 0
    };
    loadLifetime();
}

export function recordShot()            { if (current) current.shotsFired++; }
export function recordHit(dmg = 1)      { if (current) { current.shotsHit++; current.damageDealt += dmg; } }
export function recordKill()            { if (current) current.kills++; }
export function recordDeath()           { if (current) current.deaths++; }
export function recordDistance(d)       { if (current) current.distanceTraveled += d; }
export function recordMinePlaced()      { if (current) current.minesPlaced++; }
export function recordDamageTaken(d = 1){ if (current) current.damageTaken += d; }

/** Call when the match ends (win or lose). Saves lifetime stats to localStorage. */
export function finalizeStats(won = false) {
    if (!current) return;
    current.playTime = (performance.now() - current.startTime) / 1000;
    current.won = won;

    loadLifetime();
    lifetime.gamesPlayed++;
    if (won) lifetime.wins++; else lifetime.losses++;
    lifetime.totalKills         += current.kills;
    lifetime.totalDeaths        += current.deaths;
    lifetime.totalShotsFired    += current.shotsFired;
    lifetime.totalShotsHit      += current.shotsHit;
    lifetime.totalDamageDealt   += current.damageDealt;
    lifetime.totalDamageTaken   += current.damageTaken;
    lifetime.totalDistanceTraveled += current.distanceTraveled;
    lifetime.totalMinesPlaced   += current.minesPlaced;
    lifetime.totalPlayTime      += current.playTime;
    saveLifetime();

    log('info', 'STATS', 'Game over — K: ' + current.kills + ' D: ' + current.deaths +
        ' Acc: ' + calcAccuracy(current.shotsFired, current.shotsHit) + '%' +
        ' Time: ' + current.playTime.toFixed(1) + 's');
}

// ==================== QUERIES ====================

export function getCurrentStats() {
    if (!current) return null;
    const elapsed = (performance.now() - current.startTime) / 1000;
    return {
        ...current,
        playTime: current.playTime || elapsed,
        accuracy: calcAccuracy(current.shotsFired, current.shotsHit)
    };
}

export function getLifetimeStats() {
    loadLifetime();
    return {
        ...lifetime,
        accuracy:  calcAccuracy(lifetime.totalShotsFired, lifetime.totalShotsHit),
        winRate:   calcWinRate(lifetime.wins, lifetime.gamesPlayed),
        kd:        calcKD(lifetime.totalKills, lifetime.totalDeaths)
    };
}

// ==================== HELPERS ====================

function calcAccuracy(fired, hit) {
    if (!fired) return '0.0';
    return ((hit / fired) * 100).toFixed(1);
}

function calcWinRate(wins, total) {
    if (!total) return '0.0';
    return ((wins / total) * 100).toFixed(1);
}

function calcKD(kills, deaths) {
    if (!deaths) return kills > 0 ? kills.toFixed(2) : '0.00';
    return (kills / deaths).toFixed(2);
}
