import { SKINS, WEAPONS, RANKS, MISSION_POOL, STAGE_COUNT, LEVELS_PER_STAGE } from './config.js';
import { SESSION, SESSION_TIERS } from './sessionConfig.js';
import { log } from './log.js';

const STORAGE_KEY = 'tankBattle_progression';

// ==================== INITIAL STATE ====================
function defaultProgression() {
    return {
        gems: 0,
        coins: 100, // starting coins
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
        upgradePoints: 0,
        upgrades: { speed: 0, fuel: 0, mineRadius: 0 },
        // Session / Battle Pass
        sessionXp: 0,
        sessionRewardsClaimed: [],
        sessionLifetimeXp: 0, // total earned this session (for display)
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
export { RANKS };
export function getPlayerData() { return P; }
export function getStats() {
    return {
        levelsCompleted: P.levelCompletes,
        highScore: P.highestSingleScore,
        gamesPlayed: P.levelCompletes + (P.aiWins || 0),
        totalKills: P.totalKills,
    };
}
export function rankIndex(rank) {
    if (!rank) return -1;
    if (typeof rank === 'string') {
        return RANKS.findIndex(r => r.title === rank);
    }
    return RANKS.findIndex(r => r.title === rank.title || r.minXp === rank.minXp);
}
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

function playerRankIndex() {
    const rank = getRank();
    return RANKS.findIndex(r => r.title === rank.title);
}

export function buySkin(id) {
    const skin = SKINS.find(s => s.id === id);
    if (!skin) return { ok: false, reason: 'Skin not found' };
    if (P.ownedSkins.includes(id)) return { ok: false, reason: 'Already owned' };
    if (skin.minRank && rankIndex(skin.minRank) > playerRankIndex()) {
        return { ok: false, reason: 'Requires ' + skin.minRank + ' rank' };
    }
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
    if (weapon.minRank && rankIndex(weapon.minRank) > playerRankIndex()) {
        return { ok: false, reason: 'Requires ' + weapon.minRank + ' rank' };
    }
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
    P.upgradePoints++;
    saveProgression();
    updateMissionProgress('kill', 1);
}

export function trackMineKill() {
    P.totalMineKills++;
    P.upgradePoints++;
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

// ==================== UPGRADES ====================
export function getUpgradePoints() { return P.upgradePoints; }

export function addUpgradePoints(amount) {
    if (amount <= 0) return;
    P.upgradePoints += amount;
    saveProgression();
}

const UPGRADE_COST_BASE = 1;
const UPGRADE_COST_MULT = 1;

export function getUpgradeLevel(category) {
    return P.upgrades[category] || 0;
}

export function getUpgradeCost(category) {
    const level = getUpgradeLevel(category);
    return UPGRADE_COST_BASE + level * UPGRADE_COST_MULT;
}

export function getUpgradeMaxLevel() { return 10; }

export function buyUpgrade(category) {
    if (!['speed','fuel','mineRadius'].includes(category)) {
        return { ok: false, reason: 'Unknown category' };
    }
    const level = getUpgradeLevel(category);
    if (level >= getUpgradeMaxLevel()) {
        return { ok: false, reason: 'Max level reached' };
    }
    const cost = getUpgradeCost(category);
    if (P.upgradePoints < cost) {
        return { ok: false, reason: 'Not enough upgrade points' };
    }
    P.upgradePoints -= cost;
    P.upgrades[category]++;
    saveProgression();
    log('info', 'UPGRADE', category + ' upgraded to level ' + P.upgrades[category]);
    return { ok: true, level: P.upgrades[category] };
}

export function applyUpgradesToPlayer(player) {
    if (!player) return;
    const speedLvl = getUpgradeLevel('speed');
    player.speed = 200 * (1 + speedLvl * 0.12);
    const fuelLvl = getUpgradeLevel('fuel');
    const oldMax = player.maxFuel;
    player.maxFuel = 100 + fuelLvl * 25;
    player.fuel = Math.min(player.fuel + (player.maxFuel - oldMax), player.maxFuel);
    const mineLvl = getUpgradeLevel('mineRadius');
    player.mineRadius = 120 + mineLvl * 15;
}

// ==================== EARNINGS (called on level complete / game over) ====================
export function awardLevelComplete(level) {
    const coins = 15 + level * 10;
    const xp = 30 + level * 20;
    addCoins(coins);
    addXp(xp);
    const sessionXp = awardSessionXpFromMatch(xp);
    trackLevelComplete();
    log('info', 'PROG', 'Level ' + level + ' rewards: +' + coins + ' coins, +' + xp + ' xp, +' + sessionXp + ' session XP');
    return { coins, xp, sessionXp };
}

export function awardGameOver(score) {
    const coins = Math.max(3, Math.floor(score / 150));
    const xp = Math.max(5, Math.floor(score / 100));
    addCoins(coins);
    addXp(xp);
    const sessionXp = awardSessionXpFromMatch(xp);
    trackHighScore(score);
    log('info', 'PROG', 'Game over rewards: +' + coins + ' coins, +' + xp + ' xp, +' + sessionXp + ' session XP');
    return { coins, xp, sessionXp };
}

export function awardAiWin() {
    addCoins(60);
    addXp(100);
    const sessionXp = awardSessionXpFromMatch(100);
    trackAiWin();
    log('info', 'PROG', 'AI match win: +60 coins, +100 xp, +' + sessionXp + ' session XP');
    return { coins: 60, xp: 100, sessionXp };
}

export function awardAiRoundWin() {
    addCoins(15);
    addXp(25);
    const sessionXp = awardSessionXpFromMatch(25);
    return { coins: 15, xp: 25, sessionXp };
}

// ==================== CAMPAIGN STAGE SYSTEM (persistent across sessions) ====================
const CAMPAIGN_KEY = 'tankBattle_campaign';

function defaultCampaignData() {
    return {
        unlockedStage: 0,
        stages: Array.from({ length: STAGE_COUNT }, () => ({
            completed: Array.from({ length: LEVELS_PER_STAGE }, () => false),
            records: {}
        }))
    };
}

function migrateOldCampaign() {
    try {
        const old = localStorage.getItem('tankBattle_campaignLevel');
        if (old === null) return null;
        const oldLevel = parseInt(old) || 1;
        const data = defaultCampaignData();
        for (let g = 1; g < oldLevel; g++) {
            const si = Math.min(Math.floor((g - 1) / LEVELS_PER_STAGE), STAGE_COUNT - 1);
            const li = (g - 1) % LEVELS_PER_STAGE;
            data.stages[si].completed[li] = true;
        }
        for (let si = 0; si < STAGE_COUNT; si++) {
            if (!data.stages[si].completed.every(Boolean)) {
                data.unlockedStage = si;
                break;
            }
            data.unlockedStage = Math.min(si + 1, STAGE_COUNT - 1);
        }
        localStorage.removeItem('tankBattle_campaignLevel');
        saveCampaignData(data);
        log('info', 'PROG', 'Campaign data migrated from old format (level ' + oldLevel + ')');
        return data;
    } catch (e) {
        log('warn', 'PROG', 'Migration failed: ' + e);
        return null;
    }
}

export function getCampaignData() {
    try {
        const raw = localStorage.getItem(CAMPAIGN_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
        if (parsed && parsed.stages && parsed.stages.length === STAGE_COUNT) {
                // Normalize each stage — admin saves may leave sparse/null stages
                const stages = parsed.stages.map(s => {
                    if (!s || typeof s !== 'object') return { completed: Array.from({ length: LEVELS_PER_STAGE }, () => false), records: {} };
                    const completed = Array.isArray(s.completed) && s.completed.length === LEVELS_PER_STAGE
                        ? s.completed
                        : Array.from({ length: LEVELS_PER_STAGE }, () => false);
                    return { completed, records: s.records || {} };
                });
                return { ...parsed, stages };
            }
        }
    } catch (e) {
        log('warn', 'PROG', 'Failed to load campaign: ' + e);
    }
    const migrated = migrateOldCampaign();
    return migrated || defaultCampaignData();
}

export function saveCampaignData(data) {
    try {
        localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(data));
    } catch (e) {
        log('warn', 'PROG', 'Failed to save campaign: ' + e);
    }
    // Sync to Firebase if logged in (fire-and-forget)
    import('./state.js').then(mState => {
        if (mState.G.currentUser) {
            import('./firebase.js').then(mFB => {
                mFB.set(mFB.ref(mFB.db, 'user_progression/' + mState.G.currentUser.uid + '/campaign'), data)
                    .catch(e => log('warn', 'PROG', 'Firebase campaign sync failed: ' + e.message));
            }).catch(() => {});
        }
    }).catch(() => {});
}

export function getGlobalLevel(stageIdx, levelIdx) {
    return stageIdx * LEVELS_PER_STAGE + levelIdx + 1;
}

export function getStageAndLevel(globalLevel) {
    const g = Math.max(1, Math.min(globalLevel, STAGE_COUNT * LEVELS_PER_STAGE));
    return { stageIdx: Math.floor((g - 1) / LEVELS_PER_STAGE), levelIdx: (g - 1) % LEVELS_PER_STAGE };
}

export function getCurrentCampaignLevel() {
    const data = getCampaignData();
    for (let si = 0; si <= data.unlockedStage && si < STAGE_COUNT; si++) {
        for (let li = 0; li < LEVELS_PER_STAGE; li++) {
            if (!data.stages[si].completed[li]) {
                return getGlobalLevel(si, li);
            }
        }
    }
    return null;
}

export function completeLevelInCampaign(stageIdx, levelIdx, score, time) {
    if (stageIdx < 0 || stageIdx >= STAGE_COUNT || levelIdx < 0 || levelIdx >= LEVELS_PER_STAGE) return;
    const data = getCampaignData();
    data.stages[stageIdx].completed[levelIdx] = true;
    const key = String(levelIdx);
    const existing = data.stages[stageIdx].records[key];
    if (!existing || score > existing.score || (score === existing.score && time < existing.time)) {
        data.stages[stageIdx].records[key] = { score, time };
    }
    if (data.stages[stageIdx].completed.every(Boolean) && stageIdx + 1 < STAGE_COUNT) {
        data.unlockedStage = Math.max(data.unlockedStage, stageIdx + 1);
    }
    saveCampaignData(data);
    log('info', 'CAMPAIGN', 'Stage ' + stageIdx + ' level ' + (levelIdx + 1) + ' complete! Score: ' + score);
}

export function getStageProgress(stageIdx) {
    if (stageIdx < 0 || stageIdx >= STAGE_COUNT) return null;
    const data = getCampaignData();
    const stage = data.stages[stageIdx];
    if (!stage || !Array.isArray(stage.completed)) return null;
    return {
        completed: stage.completed,
        records: stage.records,
        completedCount: stage.completed.filter(Boolean).length,
        totalCount: LEVELS_PER_STAGE,
    };
}

export function isStageUnlocked(stageIdx) {
    const data = getCampaignData();
    return stageIdx <= data.unlockedStage;
}

export function isLevelCompleted(stageIdx, levelIdx) {
    const data = getCampaignData();
    if (!data.stages[stageIdx]) return false;
    return !!data.stages[stageIdx].completed[levelIdx];
}

export function getLevelRecord(stageIdx, levelIdx) {
    const data = getCampaignData();
    if (!data.stages[stageIdx]) return null;
    return data.stages[stageIdx].records[String(levelIdx)] || null;
}

export function getCampaignStats() {
    const data = getCampaignData();
    let totalCompleted = 0;
    for (const stage of data.stages) {
        totalCompleted += stage.completed.filter(Boolean).length;
    }
    return {
        totalCompleted,
        totalLevels: STAGE_COUNT * LEVELS_PER_STAGE,
        currentStage: data.unlockedStage,
    };
}

export function getStageAggregateStats(stageIdx) {
    if (stageIdx < 0 || stageIdx >= STAGE_COUNT) return null;
    const data = getCampaignData();
    const stage = data.stages[stageIdx];
    const records = Object.values(stage.records);
    return {
        completedCount: stage.completed.filter(Boolean).length,
        totalCount: LEVELS_PER_STAGE,
        bestScore: records.length ? Math.max(...records.map(r => r.score)) : null,
        bestTime: records.length ? Math.min(...records.map(r => r.time)) : null,
    };
}

export function resetCampaign() {
    try {
        localStorage.removeItem(CAMPAIGN_KEY);
    } catch (e) {}
}

export function getCampaignLevel() {
    const level = getCurrentCampaignLevel();
    return level !== null ? level : STAGE_COUNT * LEVELS_PER_STAGE;
}


// ==================== SESSION / BATTLE PASS ====================

export function getSessionData() {
    return {
        sessionXp: P.sessionXp || 0,
        sessionRewardsClaimed: P.sessionRewardsClaimed || [],
        sessionLifetimeXp: P.sessionLifetimeXp || 0,
    };
}

export function getSessionXp() {
    return P.sessionXp || 0;
}

export function getSessionTier() {
    const xp = getSessionXp();
    const xpPerTier = SESSION.xpPerTier;
    const tier = Math.min(Math.floor(xp / xpPerTier), SESSION.tiers);
    return Math.max(0, tier);
}

export function getSessionProgressInTier() {
    const xp = getSessionXp();
    const xpPerTier = SESSION.xpPerTier;
    const currentTier = getSessionTier();
    const tierStartXp = currentTier * xpPerTier;
    const progress = xp - tierStartXp;
    return {
        currentTier,
        tierProgress: progress,
        tierMax: xpPerTier,
        totalXp: xp,
        xpToNextTier: currentTier < SESSION.tiers ? xpPerTier - progress : 0,
        isMaxTier: currentTier >= SESSION.tiers,
    };
}

export function getSessionLifetimeXp() {
    return P.sessionLifetimeXp || 0;
}

export function addSessionXp(amount) {
    if (amount <= 0) return;
    const oldTier = getSessionTier();
    P.sessionXp = (P.sessionXp || 0) + amount;
    P.sessionLifetimeXp = (P.sessionLifetimeXp || 0) + amount;
    saveProgression();
    const newTier = getSessionTier();
    if (newTier > oldTier) {
        log('info', 'SESSION', 'Advanced to battle pass tier ' + newTier + '!');
    }
    log('info', 'SESSION', '+' + amount + ' session XP (total: ' + P.sessionXp + ')');
}

export function getCurrentSessionId() {
    return SESSION.id;
}

export function getSessionRewards() {
    return SESSION_TIERS;
}

export function getClaimedRewards() {
    return P.sessionRewardsClaimed || [];
}

export function isTierClaimed(tier) {
    return (P.sessionRewardsClaimed || []).includes(tier);
}

function grantSkin(skinId) {
    if (!P.ownedSkins.includes(skinId)) {
        P.ownedSkins.push(skinId);
        log('info', 'SESSION', 'Granted skin: ' + skinId);
    }
}

function grantWeapon(weaponId) {
    if (!P.ownedWeapons.includes(weaponId)) {
        P.ownedWeapons.push(weaponId);
        log('info', 'SESSION', 'Granted weapon: ' + weaponId);
    }
}

function grantTitle(title) {
    // Titles are stored as an array of earned titles
    if (!P.titles) P.titles = [];
    if (!P.titles.includes(title)) {
        P.titles.push(title);
        log('info', 'SESSION', 'Granted title: ' + title);
    }
}

export function getTitles() {
    return P.titles || [];
}

export function getEquippedTitle() {
    return P.equippedTitle || null;
}

export function equipTitle(titleId) {
    if (!P.titles) P.titles = [];
    if (!P.titles.includes(titleId)) return false;
    P.equippedTitle = titleId;
    saveProgression();
    return true;
}

export function claimReward(tier) {
    const rewards = getSessionRewards();
    const entry = rewards.find(r => r.tier === tier);
    if (!entry) return { ok: false, reason: 'Tier not found' };
    if (isTierClaimed(tier)) return { ok: false, reason: 'Already claimed' };
    if (getSessionTier() < tier) return { ok: false, reason: 'Tier not yet reached (current: ' + getSessionTier() + ', need: ' + tier + ')' };

    const reward = entry.reward;
    if (!P.sessionRewardsClaimed) P.sessionRewardsClaimed = [];

    switch (reward.type) {
        case 'coins':
            addCoins(reward.amount);
            break;
        case 'gems':
            addGems(reward.amount);
            break;
        case 'skin':
            grantSkin(reward.id);
            break;
        case 'weapon':
            grantWeapon(reward.id);
            break;
        case 'title':
            grantTitle(reward.title);
            break;
        case 'bundle':
            if (reward.coins) addCoins(reward.coins);
            if (reward.gems) addGems(reward.gems);
            if (reward.title) grantTitle(reward.title);
            break;
    }

    // Extra coins/gems from grand bundle tiers (e.g. tier 20, 30)
    if (reward.coins && reward.type !== 'bundle') addCoins(reward.coins);
    if (reward.gems && reward.type !== 'bundle') addGems(reward.gems);

    P.sessionRewardsClaimed.push(tier);
    saveProgression();
    log('info', 'SESSION', 'Claimed tier ' + tier + ' reward: ' + reward.type);
    return { ok: true, reward };
}

export function claimAllAvailableRewards() {
    const currentTier = getSessionTier();
    let claimed = 0;
    for (let t = 1; t <= currentTier; t++) {
        if (!isTierClaimed(t)) {
            const result = claimReward(t);
            if (result.ok) claimed++;
        }
    }
    return claimed;
}

// Called automatically when earning XP in any game mode
export function awardSessionXpFromMatch(matchXp) {
    const sessionXp = Math.max(1, Math.floor(matchXp * 0.1));
    addSessionXp(sessionXp);
    return sessionXp;
}

// ==================== APPLY TO PLAYER ====================
export function applyProgressionToPlayer(player) {
    if (!player) return;
    const skin = getSkinData(P.equippedSkin);
    if (skin && skin.color) {
        player.color = skin.color;
        player.bulletTrailColor = skin.trailColor || null;
        player.skinPattern = skin.bodyPattern || null;
        player.skinGlowColor = skin.glowColor || null;
        player.skinVisorColor = skin.visorColor || null;
        if (skin.trailColor) {
            const r = parseInt(skin.trailColor.slice(1,3), 16);
            const g = parseInt(skin.trailColor.slice(3,5), 16);
            const b = parseInt(skin.trailColor.slice(5,7), 16);
            player.traceColor = 'rgba(' + r + ',' + g + ',' + b + ',0.12)';
        }
        player.traceFade = !!skin.traceFade;
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
        player.bulletColor = weapon.bulletColor || null;
        player.bulletSize = weapon.bulletSize || 1;
        player.bulletBounce = weapon.bounce || 0;
        player.bulletTrailEffect = weapon.trailEffect || 'normal';
        player.bulletImpactEffect = weapon.impactEffect || 'normal';
        player.recoil = weapon.recoil || 0;
    }
    applyUpgradesToPlayer(player);
    if (weapon && weapon.weight !== undefined) {
        const w = weapon.weight;
        const speedMod = 1 + (1 - w) * 0.4;
        const gripMod = 1 + (1 - w) * 0.3;
        player.speed *= speedMod;
        player.grip *= gripMod;
    }
}
