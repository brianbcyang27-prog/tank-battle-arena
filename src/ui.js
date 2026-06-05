import { G } from './state.js';
import { log } from './log.js';
import { GameState, WEAPONS, SKINS, GADGETS, TRAILS, KILL_EFFECTS, WEAPON_SKINS, STAGES, STAGE_COUNT, LEVELS_PER_STAGE } from './config.js';
import { getPlayerData, getCampaignData, getStageProgress, isStageUnlocked, getGlobalLevel, getGems, getCoins, getRank, getRankProgress, getOwnedWeapons, getOwnedSkins, getEquippedWeapon, getEquippedSkin, getWeaponData, equipWeapon, equipSkin, equipTitle, equipItem, isItemOwned, buyItem,
    getSessionTier, getSessionProgressInTier, getSessionLifetimeXp, getSessionRewards, getClaimedRewards, claimReward, claimAllAvailableRewards, getBackpackByType } from './progression.js';
import { SESSION } from './sessionConfig.js';

// ==================== SETTINGS ====================
export function loadSettings() {
    try {
        const saved = localStorage.getItem('tankBattleSettings');
        if (saved) {
            G.settings = { ...G.settings, ...JSON.parse(saved) };
            log('info','SETTINGS','Settings loaded: '+JSON.stringify(G.settings));
        }
    } catch(e) {
        log('warn','SETTINGS','Failed to load settings: '+e.message);
    }
    applySettingsToUI();
}

export function applySettingsToUI() {
    document.getElementById('settingFriendlyFire').checked = G.settings.friendlyFire;
    document.getElementById('settingShowFPS').checked = G.settings.showFPS;
    document.getElementById('settingAutoReady').checked = G.settings.autoReady;
    document.getElementById('settingVolume').value = G.settings.volume;
    const volLabel = document.getElementById('volumeValue');
    if (volLabel) volLabel.textContent = G.settings.volume;
    const bgmEl = document.getElementById('settingBackgroundMusic');
    if (bgmEl) bgmEl.checked = G.settings.backgroundMusic !== false;
    const sfxEl = document.getElementById('settingSoundEffects');
    if (sfxEl) sfxEl.checked = G.settings.soundEffects !== false;
    const langEl = document.getElementById('settingLanguage');
    if (langEl) langEl.value = G.settings.language || 'en';
    const regionEl = document.getElementById('settingRegion');
    if (regionEl) regionEl.value = G.settings.region || 'global';
}

export function saveSettings() {
    G.settings.friendlyFire = document.getElementById('settingFriendlyFire').checked;
    G.settings.showFPS = document.getElementById('settingShowFPS').checked;
    G.settings.autoReady = document.getElementById('settingAutoReady').checked;
    G.settings.volume = parseInt(document.getElementById('settingVolume').value);
    const volLabel = document.getElementById('volumeValue');
    if (volLabel) volLabel.textContent = G.settings.volume;
    const bgmEl = document.getElementById('settingBackgroundMusic');
    if (bgmEl) G.settings.backgroundMusic = bgmEl.checked;
    const sfxEl = document.getElementById('settingSoundEffects');
    if (sfxEl) G.settings.soundEffects = sfxEl.checked;
    const langEl = document.getElementById('settingLanguage');
    if (langEl) G.settings.language = langEl.value;
    const regionEl = document.getElementById('settingRegion');
    if (regionEl) G.settings.region = regionEl.value;
    localStorage.setItem('tankBattleSettings', JSON.stringify(G.settings));
    // Sync to Firebase for cross-session persistence
    if (G.currentUser) {
        import('./firebase.js').then(({ ref, update, db }) => {
            update(ref(db, 'users/' + G.currentUser.uid + '/settings'), G.settings)
                .catch(e => log('warn','SETTINGS','Firebase save failed: '+e.message));
        });
    }
    if (typeof window.updateAudioSettings === 'function') {
        window.updateAudioSettings(G.settings);
    }
    log('info','SETTINGS','Settings saved: '+JSON.stringify(G.settings));
}

window.deleteAccount = function() {
    if (!G.currentUser) {
        alert('No account to delete. You are playing as guest.');
        return;
    }
    import('./firebase.js').then(({ ref, remove, db }) => {
        remove(ref(db, 'users/' + G.currentUser.uid)).catch(e => log('warn','SETTINGS','Failed to delete user data: '+e.message));
        remove(ref(db, 'leaderboard/' + G.currentUser.uid)).catch(e => log('warn','SETTINGS','Failed to delete leaderboard: '+e.message));
        import('./firebase.js').then(m => m.signOut ? m.signOut() : null).catch(() => {});
        localStorage.clear();
        alert('Account deleted. Refresh the page to start fresh.');
        location.reload();
    });
};

window.showSettings = function() {
    applySettingsToUI();
    showOverlay('settingsOverlay');
    switchSettingsTab('settings');
    // Fullscreen when opened from home screen, not from in-game pause
    if (G.gameState === GameState.MENU) {
        document.getElementById('settingsOverlay').classList.add('overlay-home');
    }
    log('info','SETTINGS','Opening settings panel');
};

window.closeSettings = function() {
    saveSettings();
    if (G.gameState === GameState.PAUSED) {
        showOverlay('pauseOverlay');
    } else {
        showOverlay('loginOverlay');
    }
    log('info','SETTINGS','Closing settings panel');
};

window.switchSettingsTab = function(tab) {
    // Settings is now standalone — no loadout tab here
};

window.openPauseSettings = function() {
    showSettings();
};

window.showAbout = function() {
    showOverlay('aboutOverlay');
    log('info','UI','Opening about panel');
};

window.closeAbout = function() {
    showOverlay('loginOverlay');
    log('info','UI','Closing about panel');
};

window.showGameGuide = function() {
    showOverlay('gameGuideOverlay');
    log('info','UI','Opening game guide');
};

window.closeGameGuide = function() {
    showOverlay('loginOverlay');
    log('info','UI','Closing game guide');
};

// ==================== FEEDBACK ====================
window.openFeedback = function() {
    document.getElementById('feedbackStatus').style.display = 'none';
    document.getElementById('feedbackSubmitBtn').disabled = false;
    document.getElementById('feedbackSubmitBtn').textContent = 'SUBMIT FEEDBACK';
    showOverlay('feedbackOverlay');
};

window.closeFeedback = function() {
    showOverlay('loginOverlay');
};

window.submitFeedback = function() {
    const type = document.getElementById('feedbackType').value;
    const message = document.getElementById('feedbackMessage').value.trim();
    const email = document.getElementById('feedbackEmail').value.trim();
    const statusEl = document.getElementById('feedbackStatus');
    const btn = document.getElementById('feedbackSubmitBtn');

    if (!message) {
        statusEl.style.color = '#e74c3c';
        statusEl.textContent = 'Please enter a message';
        statusEl.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'SUBMITTING...';

    import('./firebase.js').then(({ ref, push, db, serverTimestamp }) => {
        const payload = {
            type,
            message,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
        };
        if (email) payload.email = email;
        if (G.currentUser) {
            payload.uid = G.currentUser.uid;
            payload.displayName = G.currentUser.displayName || G.currentUser.email?.split('@')[0] || 'Anonymous';
        }
        push(ref(db, 'feedback'), payload).then(() => {
            statusEl.style.color = '#2ecc71';
            statusEl.textContent = 'Thank you! Your feedback has been submitted.';
            statusEl.style.display = 'block';
            btn.textContent = '✅ SUBMITTED';
            document.getElementById('feedbackMessage').value = '';
            document.getElementById('feedbackEmail').value = '';
            setTimeout(() => { btn.disabled = false; }, 2000);
        }).catch(err => {
            statusEl.style.color = '#e74c3c';
            statusEl.textContent = 'Failed to submit: ' + err.message;
            statusEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'SUBMIT FEEDBACK';
        });
    }).catch(() => {
        statusEl.style.color = '#e74c3c';
        statusEl.textContent = 'Failed to load Firebase. Try again later.';
        statusEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'SUBMIT FEEDBACK';
    });
};

// ==================== STATS OVERLAY ====================
function buildStatsHtml(stats) {
    if (!stats) return '<p style="color:#888;">No data</p>';
    const rows = [
        ['Kills', stats.kills, 'good'],
        ['Deaths', stats.deaths, 'bad'],
        ['K/D Ratio', stats.kd || (stats.deaths ? (stats.kills / stats.deaths).toFixed(2) : stats.kills > 0 ? stats.kills.toFixed(2) : '0.00'), ''],
        ['Shots Fired', stats.shotsFired, ''],
        ['Shots Hit', stats.shotsHit, ''],
        ['Accuracy', (stats.accuracy || '0.0') + '%', stats.accuracy > 50 ? 'good' : 'bad'],
        ['Damage Dealt', stats.damageDealt, ''],
        ['Damage Taken', stats.damageTaken, 'bad'],
        ['Mines Placed', stats.minesPlaced, ''],
        ['Distance', Math.round(stats.distanceTraveled) + ' px', ''],
        ['Play Time', stats.playTime ? stats.playTime.toFixed(1) + 's' : '—', '']
    ];
    return rows.map(([label, value, cls]) =>
        `<div class="stats-row"><span class="stats-label">${label}</span><span class="stats-value${cls ? ' ' + cls : ''}">${value}</span></div>`
    ).join('');
}

function buildLifetimeHtml(l) {
    if (!l) return '<p style="color:#888;">No data</p>';
    const rows = [
        ['Games Played', l.gamesPlayed],
        ['Wins', l.wins],
        ['Losses', l.losses],
        ['Win Rate', (l.winRate || '0.0') + '%'],
        ['Total Kills', l.totalKills],
        ['Total Deaths', l.totalDeaths],
        ['K/D Ratio', l.kd || '0.00'],
        ['Total Shots', l.totalShotsFired],
        ['Total Hits', l.totalShotsHit],
        ['Accuracy', (l.accuracy || '0.0') + '%'],
        ['Total Damage Dealt', l.totalDamageDealt],
        ['Total Damage Taken', l.totalDamageTaken],
        ['Total Mines', l.totalMinesPlaced],
        ['Total Distance', Math.round(l.totalDistanceTraveled) + ' px'],
        ['Total Play Time', formatTime(l.totalPlayTime)]
    ];
    return rows.map(([label, value]) =>
        `<div class="stats-row"><span class="stats-label">${label}</span><span class="stats-value">${value}</span></div>`
    ).join('');
}

function formatTime(seconds) {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? m + 'm ' + s + 's' : s + 's';
}

window.closeStats = function() {
    showOverlay('loginOverlay');
    log('info','STATS','Closing stats panel');
};

window.showStats = function() {
    import('./stats.js').then(m => {
        const current = m.getCurrentStats();
        const lifetime = m.getLifetimeStats();
        document.getElementById('statsLastGame').innerHTML = buildStatsHtml(current);
        document.getElementById('statsLifetime').innerHTML = buildLifetimeHtml(lifetime);
    });
    showOverlay('statsOverlay');
    log('info','STATS','Opening stats panel');
};

// ==================== UI HELPERS ====================
const HOME_OVERLAYS = ['loginOverlay','missionsOverlay','shopOverlay','statsOverlay','leaderboardOverlay','friendsOverlay','aboutOverlay','upgradeOverlay','tutorialOverlay','progressionOverlay','seasonPassOverlay','loadoutOverlay','gameGuideOverlay'];

export function showOverlay(id){
    document.querySelectorAll('.overlay').forEach(o=>{
        o.style.display='none';
        o.classList.remove('active');
        o.classList.remove('overlay-home');
        o.removeAttribute('aria-modal');
    });
    if(id){
        const el = document.getElementById(id);
        el.style.display='flex';
        el.classList.add('active');
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        const firstFocusable = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable && !document.querySelector(':focus')) {
            firstFocusable.focus();
        }
        // Home overlays fill the full viewport
        if (HOME_OVERLAYS.includes(id)) {
            el.classList.add('overlay-home');
        }
        log('info','UI','Showing overlay: '+id);
    }
}

export function updateUI(){
    const el = id => document.getElementById(id);
    if(el('levelCompleteScore')) el('levelCompleteScore').textContent='SCORE: '+G.score;
    if(el('levelCompleteTime')) el('levelCompleteTime').textContent='TIME: '+G.levelTime.toFixed(1)+'s';
    if(el('finalScore')) el('finalScore').textContent='FINAL SCORE: '+G.score;
    if(el('finalLevel')) el('finalLevel').textContent='REACHED LEVEL '+G.level;
}

// ==================== VERSUS COUNTDOWN ====================
const VERSUS_WEAPON_ICONS = {
    standard: '\uD83D\uDD2B',
    rapid: '\u26A1',
    cannon: '\uD83D\uDCA5',
    shotgun: '\uD83D\uDCA2',
    sniper: '\uD83C\uDFAF',
};

export function showVersusCountdown(onComplete) {
    const el = id => document.getElementById(id);
    const maxLv = 10;
    import('./progression.js').then(prog => {
        const localWeapon = prog.getEquippedWeapon() || 'standard';
        const localSpeed = prog.getUpgradeLevel('speed');
        const localFuel = prog.getUpgradeLevel('fuel');
        const localMine = prog.getUpgradeLevel('mineRadius');
        const localName = G.currentUser ? G.currentUser.email.split('@')[0] : 'YOU';
        const wIcon = VERSUS_WEAPON_ICONS[localWeapon] || '\uD83D\uDD2B';
        const wName = (WEAPONS.find(w => w.id === localWeapon) || {}).name || 'Standard Cannon';
        el('vsP1Name').textContent = localName;
        el('vsP1WeaponIcon').textContent = wIcon;
        el('vsP1WeaponName').textContent = wName;
        el('vsP1Speed').style.width = (localSpeed / maxLv * 100) + '%';
        el('vsP1SpeedLv').textContent = localSpeed + '/10';
        el('vsP1Fuel').style.width = (localFuel / maxLv * 100) + '%';
        el('vsP1FuelLv').textContent = localFuel + '/10';
        el('vsP1Mine').style.width = (localMine / maxLv * 100) + '%';
        el('vsP1MineLv').textContent = localMine + '/10';
        // Remote player
        const rd = G._versusPlayerData || {};
        const ruid = Object.keys(rd).find(uid => uid !== (G.currentUser && G.currentUser.uid));
        if (ruid && rd[ruid]) {
            const r = rd[ruid];
            const rw = r.weapon || 'standard';
            el('vsP2Name').textContent = r.name ? r.name.split('@')[0] : 'OPPONENT';
            el('vsP2WeaponIcon').textContent = VERSUS_WEAPON_ICONS[rw] || '\uD83D\uDD2B';
            el('vsP2WeaponName').textContent = (WEAPONS.find(ww => ww.id === rw) || {}).name || 'Standard Cannon';
            el('vsP2Speed').style.width = ((r.upgrades ? r.upgrades.speed : 0) / maxLv * 100) + '%';
            el('vsP2SpeedLv').textContent = (r.upgrades ? r.upgrades.speed : 0) + '/10';
            el('vsP2Fuel').style.width = ((r.upgrades ? r.upgrades.fuel : 0) / maxLv * 100) + '%';
            el('vsP2FuelLv').textContent = (r.upgrades ? r.upgrades.fuel : 0) + '/10';
            el('vsP2Mine').style.width = ((r.upgrades ? r.upgrades.mineRadius : 0) / maxLv * 100) + '%';
            el('vsP2MineLv').textContent = (r.upgrades ? r.upgrades.mineRadius : 0) + '/10';
        }
        showOverlay('vsCountdownOverlay');
        el('vsP1Card').style.animation = 'vs-slideInLeft 0.5s ease-out 0.2s forwards';
        el('vsP2Card').style.animation = 'vs-slideInRight 0.5s ease-out 0.2s forwards';
        // Countdown
        let count = 5;
        const cnEl = el('vsCountdownNumber');
        const lbEl = el('vsCountdownLabel');
        const ftEl = el('vsFightContainer');
        cnEl.textContent = String(count);
        cnEl.style.display = 'block';
        function tick() {
            if (count > 0) {
                cnEl.textContent = String(count);
                cnEl.style.animation = 'none';
                void cnEl.offsetWidth;
                cnEl.style.animation = 'vs-countPulse 0.8s ease-in-out infinite';
                count--;
                setTimeout(tick, 1000);
            } else {
                cnEl.style.display = 'none';
                lbEl.style.display = 'none';
                ftEl.style.display = 'block';
                const goEl = ftEl.querySelector('.vs-fight-text');
                if (goEl) {
                    goEl.style.animation = 'none';
                    void goEl.offsetWidth;
                    goEl.style.animation = 'vs-fightFlash 0.5s ease-out forwards';
                }
                setTimeout(() => {
                    showOverlay(null);
                    if (onComplete) onComplete();
                }, 800);
            }
        }
        setTimeout(tick, 500);
    });
}

window.setMode = function(m,btn){
    G.gameMode=m;
    document.querySelectorAll('.mode-tab').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    log('info','MODE','Game mode set to: '+m);
};

window.startArcade = function(){
    G.gameMode = 'arcade';
    log('info','MODE','Starting ARCADE mode');
    import('./game.js').then(m => m.startGameFromMenu());
};

window.startVersusAI = function(){
    G.gameMode = 'ai1v1';
    showOverlay('aiDifficultyOverlay');
    log('info','MODE','Arcade mode — showing difficulty selector');
};

window.startAIGame = function(difficulty){
    G.aiDifficulty = difficulty;
    log('info','MODE','Starting Arcade game with difficulty: '+difficulty);
    import('./game.js').then(m => m.startGameFromMenu());
};

window.closeAIDifficulty = function() {
    showOverlay('loginOverlay');
};

window.startSolo = function(){
    G.gameMode='single';
    import('./game.js').then(m => m.startGameFromMenu());
};

let _selectedStageIndex = 0;
let _selectedLevelIndex = 0;
let _gridRendered = false;

window.startCampaign = function(){
    G.gameMode='campaign';
    showCampaignMap();
};

export function showCampaignMap() {
    const data = getCampaignData();
    _selectedStageIndex = Math.min(data.unlockedStage, STAGE_COUNT - 1);
    _selectedLevelIndex = 0;
    renderCampaignUI();
    showOverlay('campaignMapOverlay');
    log('info','CAMPAIGN','Campaign map shown');
}

function renderCampaignUI() {
    renderStageTabs();
    renderLevelGrid();
    updateCampaignSubtitle();
    renderStageDetail();
}

function renderStageTabs() {
    const container = document.getElementById('stageCarousel');
    if (!container) return;
    container.innerHTML = '';
    const data = getCampaignData();

    for (let si = 0; si < STAGE_COUNT; si++) {
        const stage = STAGES[si];
        const progress = getStageProgress(si);
        const unlocked = si <= data.unlockedStage;
        const active = si === _selectedStageIndex;

        const card = document.createElement('div');
        card.className = 'stage-card' + (active ? ' active' : '') + (!unlocked ? ' locked' : '');
        card.style.setProperty('--stage-accent', stage.colors.wall || '#333');
        card.style.setProperty('--stage-bg', stage.colors.bg || '#111');
        card.onclick = () => selectStage(si);

        card.innerHTML = `
            <div class="stage-card-icon">${stage.icon}</div>
            <div class="stage-card-name">${stage.name}</div>
            <div class="stage-card-progress">${progress.completedCount}/${progress.totalCount}</div>
            <div class="stage-card-bar"><div class="stage-card-bar-fill" style="width:${(progress.completedCount / progress.totalCount * 100).toFixed(0)}%"></div></div>
            ${!unlocked ? '<div class="stage-card-lock">🔒</div>' : ''}
        `;
        container.appendChild(card);

        requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        });
    }
}

function renderLevelGrid() {
    const grid = document.getElementById('campaignLevelGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const progress = getStageProgress(_selectedStageIndex);
    const unlocked = isStageUnlocked(_selectedStageIndex);
    if (!progress) return;
    if (!Array.isArray(progress.completed)) return;

    for (let li = 0; li < LEVELS_PER_STAGE; li++) {
        const completed = progress.completed[li];
        const record = progress.records[String(li)] || null;
        const canPlay = unlocked && (completed || li === 0 || progress.completed.slice(0, li).some(c => c));

        const node = document.createElement('div');
        node.className = 'level-node' + (completed ? ' completed' : '') + (canPlay && !completed ? ' available' : '') + (!canPlay ? ' locked' : '') + (li === _selectedLevelIndex ? ' selected' : '');

        const num = document.createElement('div');
        num.className = 'level-node-num';
        num.textContent = li + 1;

        const status = document.createElement('div');
        status.className = 'level-node-status';
        if (completed) {
            status.textContent = '✓';
        } else if (canPlay) {
            status.textContent = '▶';
        } else {
            status.textContent = '🔒';
        }

        node.appendChild(num);
        node.appendChild(status);

        if (completed && record) {
            const tip = document.createElement('div');
            tip.className = 'level-node-record';
            tip.textContent = Math.round(record.score).toLocaleString() + ' | ' + record.time.toFixed(1) + 's';
            node.appendChild(tip);
        }

        if (canPlay) {
            node.onclick = function() {
                _selectedLevelIndex = li;
                renderLevelGrid();
                renderStageDetail();
            };
            node.style.cursor = 'pointer';
            node.title = 'Level ' + (li + 1) + (record ? ' — Best: ' + Math.round(record.score).toLocaleString() : '');
        } else {
            node.title = 'Complete previous levels to unlock';
        }

        if (_gridRendered) {
            node.style.opacity = '1';
            node.style.transform = 'scale(1)';
            node.style.transition = 'none';
        } else {
            node.style.opacity = '0';
            node.style.transform = 'scale(0.6)';
            const delay = li * 40;
            node.style.transition = 'all 0.3s ease ' + delay + 'ms';
        }
        grid.appendChild(node);
        if (!_gridRendered) {
            requestAnimationFrame(() => {
                node.style.opacity = '1';
                node.style.transform = 'scale(1)';
            });
        }
    }
    _gridRendered = true;
}

function updateCampaignSubtitle() {
    const sub = document.getElementById('campaignMapSub');
    if (!sub) return;
    const data = getCampaignData();
    const completed = data.stages.reduce((sum, s) => sum + s.completed.filter(Boolean).length, 0);
    const total = STAGE_COUNT * LEVELS_PER_STAGE;
    if (completed >= total) {
        sub.textContent = '🎉 ALL LEVELS COMPLETE! Congratulations Commander!';
    } else {
        const stage = STAGES[_selectedStageIndex];
        const prog = getStageProgress(_selectedStageIndex);
        sub.textContent = stage.icon + ' ' + stage.name + ' — ' + prog.completedCount + '/' + prog.totalCount + ' levels cleared';
    }
}

window.selectStage = function(si) {
    if (si < 0 || si >= STAGE_COUNT) return;
    if (!isStageUnlocked(si)) return;
    _selectedStageIndex = si;
    _selectedLevelIndex = 0;
    _gridRendered = false;
    renderCampaignUI();
};

window.closeCampaignMap = function() {
    showOverlay('loginOverlay');
    log('info','CAMPAIGN','Campaign map closed');
};

window.startCampaignGame = function() {
    startCampaignLevel(_selectedStageIndex, _selectedLevelIndex);
};

function startCampaignLevel(stageIdx, levelIdx) {
    const globalLevel = getGlobalLevel(stageIdx, levelIdx);
    G.level = globalLevel;
    G.currentStageIndex = stageIdx;
    G.currentLevelInStage = levelIdx;
    showOverlay(null);
    import('./game.js').then(m => m.startGameFromMenu());
}

window.startCampaignLevel = startCampaignLevel;

// ==================== STAGE DETAIL PANEL ====================

function fetchStageWorldRecord(stageIdx) {
    return new Promise(resolve => {
        import('./firebase.js').then(({ ref, get, db, query, orderByChild, limitToLast }) => {
            get(query(ref(db, 'campaignLeaderboard/stage_' + stageIdx), orderByChild('score'), limitToLast(1)))
                .then(snap => {
                    const data = snap.val();
                    if (!data) { resolve(null); return; }
                    const entries = Object.values(data);
                    resolve(entries.length ? entries.reduce((a, b) => (a.score > b.score ? a : b)) : null);
                }).catch(() => resolve(null));
        }).catch(() => resolve(null));
    });
}

function getLevelEnemyInfo(stageIdx, levelIdx) {
    const lvl = getGlobalLevel(stageIdx, levelIdx);
    const baseEnemies = lvl === 1 ? 1 : 2;
    const enemies = Math.min(baseEnemies + Math.floor(lvl * 1.2), 10);
    const tier = Math.min(Math.ceil(lvl / 2), 4);
    return { enemies, tier };
}

function renderStageDetail() {
    const panel = document.getElementById('stageDetailPanel');
    if (!panel) return;
    const stage = STAGES[_selectedStageIndex];
    const li = _selectedLevelIndex;
    const progress = getStageProgress(_selectedStageIndex);
    const record = progress ? (progress.records[String(li)] || null) : null;
    const enemyInfo = getLevelEnemyInfo(_selectedStageIndex, li);

    panel.style.setProperty('--stage-accent', stage.colors.wall || '#333');
    panel.className = 'stage-detail-panel';

    const gripDots = Array.from({ length: 5 }, (_, i) =>
        `<span class="detail-grip-dot ${stage.grip * 10 > i ? 'filled' : ''}"></span>`
    ).join('');

    const hazardLabels = { lava: 'Lava Pools', fog: 'Dense Fog', wind: 'Sandstorms', movingWalls: 'Moving Walls' };
    const hazardLabel = stage.hazard ? (hazardLabels[stage.hazard] || stage.hazard) : 'None';

    const bestScore = record ? Math.round(record.score).toLocaleString() : '--';
    const bestTime = record ? record.time.toFixed(1) + 's' : '--';

    panel.innerHTML = `
        <div class="stage-detail-header">
            <div class="stage-detail-icon">${stage.icon}</div>
            <div class="stage-detail-name">${stage.name}</div>
            <div class="stage-detail-level-label">LEVEL ${li + 1} of ${LEVELS_PER_STAGE}</div>
            <p class="stage-detail-desc">${stage.desc}</p>
        </div>
        <div class="detail-card">
            <h3>⚔️ Combat Intel</h3>
            <div class="detail-row">
                <span class="label">Grip</span>
                <span class="value"><span class="detail-grip-bar">${gripDots}</span> ${stage.grip.toFixed(2)}</span>
            </div>
            <div class="detail-row">
                <span class="label">Hazard</span>
                <span class="value"><span class="detail-hazard-tag">${hazardLabel}</span></span>
            </div>
            <div class="detail-row">
                <span class="label">Enemies</span>
                <span class="value">${enemyInfo.enemies}</span>
            </div>
            <div class="detail-row">
                <span class="label">Enemy Tier</span>
                <span class="value">${enemyInfo.tier}</span>
            </div>
        </div>
        <div class="detail-card">
            <h3>🏆 Personal Best</h3>
            <div class="detail-row">
                <span class="label">Score</span>
                <span class="value highlight">${bestScore}</span>
            </div>
            <div class="detail-row">
                <span class="label">Time</span>
                <span class="value">${bestTime}</span>
            </div>
            <div class="detail-row">
                <span class="label">Status</span>
                <span class="value">${record ? '✅ Completed' : (progress && progress.completed.slice(0, li).some(c => c) ? '▶ Unlocked' : (li === 0 ? '▶ Available' : '🔒 Locked'))}</span>
            </div>
        </div>
        <div class="detail-card" id="stageWorldRecordCard">
            <h3>🌍 World Record</h3>
            <div class="stage-detail-wr-loading">Loading...</div>
        </div>
        <button class="stage-detail-play" onclick="startCampaignGame()">
            ▶ PLAY LEVEL ${li + 1}
        </button>
    `;

    fetchStageWorldRecord(_selectedStageIndex).then(record => {
        const wrCard = document.getElementById('stageWorldRecordCard');
        if (!wrCard) return;
        if (record && record.name) {
            wrCard.innerHTML = `
                <h3>🌍 World Record</h3>
                <div class="detail-row">
                    <span class="label">Player</span>
                    <span class="value">${record.name}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Score</span>
                    <span class="value highlight">${Math.round(record.score).toLocaleString()}</span>
                </div>
                ${record.time ? `<div class="detail-row"><span class="label">Time</span><span class="value">${record.time.toFixed(1)}s</span></div>` : ''}
            `;
        } else {
            wrCard.innerHTML = `
                <h3>🌍 World Record</h3>
                <div style="font-size:9px;color:#555;font-style:italic;">No records yet — be the first!</div>
            `;
        }
    });
}

window.toggleVersus = function(){
    const panel=document.getElementById('versusPanel');
    if(panel.style.display!=='none'){
        panel.style.display='none';
        return;
    }
    panel.style.display='block';
    G.gameMode='1v1';
    document.querySelectorAll('.mode-tab').forEach((b,i)=>{
        b.classList.toggle('selected',i===0);
    });
    log('info','MODE','Versus panel opened, mode: 1v1');
};

window.handleRestart = function(){
    const btn=document.getElementById('restartButton');
    const status=document.getElementById('restartStatus');
    btn.disabled=true;
    btn.style.opacity='0.5';
    btn.style.cursor='not-allowed';
    status.textContent='Restarting...';
    log('info','RESTART','Restart button clicked, starting new game');
    import('./game.js').then(m => m.startGame());
};

// ==================== LEADERBOARD ====================
window.submitOnlineScore = function(){
    if(!G.currentUser){
        log('warn','LB','Cannot submit score: not logged in');
        return;
    }
    const mode = G.gameMode === 'single' ? 'solo' : G.gameMode || 'campaign';
    import('./firebase.js').then(({ ref, push, db, serverTimestamp }) => {
        const leaderboardRef=ref(db, 'leaderboard/' + mode);
        push(leaderboardRef, {
            name:G.currentUser.email,
            score:G.score,
            level:G.level,
            timestamp:serverTimestamp()
        }).then(()=>{
            log('info','LB','Score submitted to online leaderboard');
            loadOnlineLeaderboard();
        }).catch(e=>log('error','LB','Score submission failed: '+e.message));
    });
};

function loadOnlineLeaderboard(){
    const lb=document.getElementById('leaderboardEntries');
    lb.innerHTML='<p style="color:#666;">Loading online leaderboard...</p>';
    import('./firebase.js').then(({ ref, get, db }) => {
        const modes = ['campaign', 'solo', 'arcade', 'vs_ai'];
        Promise.all(modes.map(m => get(ref(db, 'leaderboard/' + m)).catch(() => null))).then(results => {
            let entries = [];
            results.forEach((snapshot, i) => {
                const mode = modes[i];
                if (!snapshot) return;
                const raw = snapshot.val();
                if (!raw) return;
                for (const uid in raw) {
                    const entry = raw[uid];
                    if (entry && entry.score > 0) {
                        entry.mode = mode;
                        entries.push(entry);
                    }
                }
            });
            entries.sort((a, b) => (b.score || 0) - (a.score || 0));
            displayLeaderboard(entries);
        }).catch(() => {
            lb.innerHTML='<p style="color:#666;">Could not load online leaderboard</p>';
        });
    });
}

export function displayLeaderboard(entries){
    const lb=document.getElementById('leaderboardEntries');
    if(!entries||entries.length===0){ lb.innerHTML='<p style="color:#666;">No scores yet</p>'; return; }
    entries.sort((a,b)=>b.score-a.score);
    let html='<ol style="text-align:left;padding-left:20px;">';
    for(let i=0;i<Math.min(entries.length,10);i++){
        const n=entries[i].name||'Anonymous', s=entries[i].score||0;
        html+='<li style="color:#f39c12;">'+n.split('@')[0]+': <span style="color:#27ae60;">'+s+'</span></li>';
    }
    html+='</ol>';
    lb.innerHTML=html;
    log('info','LB','Leaderboard displayed with '+Math.min(entries.length,10)+' entries');
}

// ==================== HOME LEADERBOARD (worldwide) ====================
let _lbCache = null;
let _lbFilter = 'all';
let _lbMode = 'all';

function _lbRender() {
    const listEl = document.getElementById('lbList');
    const countEl = document.getElementById('lbCount');
    const searchInput = document.getElementById('lbSearch');
    if (!listEl) return;
    const query = (searchInput && searchInput.value || '').toLowerCase().trim();
    const filter = _lbFilter;
    const mode = _lbMode;
    let entries = _lbCache || [];

    // Filter by mode first
    if (mode !== 'all') {
        entries = entries.filter(e => (e.mode || 'campaign') === mode);
    }

    if (filter === 'top10') entries = entries.slice(0, 10);
    else if (filter === 'top50') entries = entries.slice(0, 50);
    else if (filter === 'mine') {
        const myName = (G.currentUser?.displayName || G.currentUser?.email?.split('@')[0] || '').toLowerCase();
        if (myName) entries = entries.filter(e => (e.name || '').toLowerCase() === myName || (e.name || '').toLowerCase() === (G.currentUser?.email || '').toLowerCase());
        else entries = [];
    }

    if (query) entries = entries.filter(e => (e.name || '').toLowerCase().includes(query));

    if (!entries.length) {
        listEl.innerHTML = '<p style="color:#666;text-align:center;padding:10px;">No scores found.</p>';
        if (countEl) countEl.textContent = '0 entries';
        return;
    }
    let html = '<div style="color:#555;font-size:9px;letter-spacing:1px;text-align:center;margin-bottom:6px;padding:4px;border:1px solid #333;border-radius:4px;">' + SESSION.shortName + '</div>';
    html += '<ol style="text-align:left;padding-left:20px;margin:0;">';
    for (let i = 0; i < entries.length; i++) {
        const n = entries[i].name || 'Anonymous';
        const s = entries[i].score || 0;
        const lvl = entries[i].level || 1;
        const season = entries[i].season || '';
        const rank = i + 1;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        html += '<li style="color:#f39c12;margin-bottom:4px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:6px;">';
        if (medal) html += '<span style="font-size:14px;width:20px;text-align:center;">' + medal + '</span>';
        else html += '<span style="width:20px;text-align:center;color:#666;font-size:10px;">' + rank + '.</span>';
        html += '<span style="flex:1;color:#eaeaea;font-size:11px;">' + n.split('@')[0] + '</span>';
        html += '<span style="color:#27ae60;font-weight:700;font-size:11px;">' + s.toLocaleString() + '</span>';
        html += '<span style="color:#666;font-size:9px;min-width:30px;text-align:right;">Lv.' + lvl + '</span>';
        if (season) html += '<span style="color:#555;font-size:8px;min-width:20px;text-align:right;">' + season + '</span>';
        html += '</li>';
    }
    html += '</ol>';
    listEl.innerHTML = html;
    if (countEl) countEl.textContent = 'Showing ' + entries.length + '/' + (_lbCache ? _lbCache.length : 0) + ' entries';
}

function _mergeLocal() {
    try {
        const local = JSON.parse(localStorage.getItem('tankBattleLeaderboard') || '[]');
        if (!local.length || !_lbCache) return;
        for (const localEntry of local) {
            const localMode = localEntry.mode || 'campaign';
            const localName = (localEntry.name || '').toLowerCase();
            if (!localName) continue;
            // Find matching entry in cache with same name + mode
            const match = _lbCache.find(e => (e.name || '').toLowerCase() === localName && (e.mode || 'campaign') === localMode);
            if (match) {
                if ((localEntry.score || 0) > (match.score || 0)) {
                    match.score = localEntry.score;
                    match.level = localEntry.level || match.level;
                }
            } else {
                _lbCache.push({
                    name: localEntry.name,
                    score: localEntry.score,
                    level: localEntry.level || 1,
                    mode: localMode
                });
            }
        }
        _lbCache.sort((a, b) => (b.score || 0) - (a.score || 0));
    } catch(e) {}
}

window.showLeaderboard = function() {
    const listEl = document.getElementById('lbList');
    const countEl = document.getElementById('lbCount');
    if (!listEl) return;
    listEl.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">Loading worldwide scores...</p>';
    if (countEl) countEl.textContent = '';

    _lbCache = null;
    import('./firebase.js').then(({ ref, get, db }) => {
        // Read all 3 mode paths in parallel
        const modes = ['campaign', 'solo', 'arcade', 'vs_ai'];
        Promise.all(modes.map(m => get(ref(db, 'leaderboard/' + m)).catch(() => null))).then(results => {
            let allEntries = [];
            results.forEach((snapshot, i) => {
                const mode = modes[i];
                if (!snapshot) return;
                const raw = snapshot.val();
                if (!raw) return;
                for (const uid in raw) {
                    const entry = raw[uid];
                    if (entry && entry.score > 0) {
                        entry.mode = mode;
                        entry.uid = uid;
                        allEntries.push(entry);
                    }
                }
            });

            // Deduplicate by name per mode — keep highest score per player per mode
            const seen = {};
            allEntries = allEntries.filter(e => {
                const key = ((e.name || '').toLowerCase()) + '::' + (e.mode || 'campaign');
                if (seen[key]) {
                    if ((e.score || 0) > (seen[key].score || 0)) seen[key].score = e.score;
                    return false;
                }
                seen[key] = e;
                return true;
            });
            allEntries.sort((a, b) => (b.score || 0) - (a.score || 0));
            _lbCache = allEntries;
            _mergeLocal();
            _lbRender();
        }).catch(e => {
            log('warn','LB','Failed to load leaderboard: '+e.message);
            const local = JSON.parse(localStorage.getItem('tankBattleLeaderboard') || '[]');
            _lbCache = local;
            _lbRender();
        });
    }).catch(e => {
        log('warn','LB','Import failed: '+e.message);
        const local = JSON.parse(localStorage.getItem('tankBattleLeaderboard') || '[]');
        _lbCache = local;
        _lbRender();
    });
    showOverlay('leaderboardOverlay');
    log('info','LB','Home leaderboard opened');
};

window.setLBFilter = function(filter) {
    _lbFilter = filter;
    document.querySelectorAll('.lb-filter').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#999';
    });
    const btn = document.querySelector('.lb-filter[data-filter="' + filter + '"]');
    if (btn) { btn.style.background = 'rgba(52,152,219,0.3)'; btn.style.color = '#f39c12'; }
    _lbRender();
};

window.setLBMode = function(mode) {
    _lbMode = mode;
    document.querySelectorAll('.lb-mode').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#999';
    });
    const btn = document.querySelector('.lb-mode[data-mode="' + mode + '"]');
    if (btn) { btn.style.background = 'rgba(52,152,219,0.3)'; btn.style.color = '#f39c12'; }
    _lbRender();
};

window.applyLBFilter = function() { _lbRender(); };

window.closeLeaderboard = function() {
    showOverlay('loginOverlay');
    _lbCache = null;
    log('info','LB','Home leaderboard closed');
};

// ==================== FRIENDS OVERLAY ====================
window.showFriends = function() {
    import('./friends.js').then(m => {
        const codeEl = document.getElementById('myFriendCode');
        if (codeEl) codeEl.textContent = G.friendCode || '—';
        // Start listening for friend requests + friend list
        m.listenFriendRequests(renderFriendRequests);
        m.listenFriends(renderFriendList);
        // Also listen for invitations so requests show in notification
        m.listenInvitations(handleInvitations);
    });
    showOverlay('friendsOverlay');
    log('info','FRIENDS','Opening friends panel');
};

window.closeFriends = function() {
    import('./friends.js').then(m => {
        m.stopListeningFriendRequests();
        m.stopListeningFriends();
        m.stopListeningInvitations();
    });
    showOverlay('loginOverlay');
    log('info','FRIENDS','Closing friends panel');
};

window.addFriend = function() {
    const input = document.getElementById('friendCodeInput');
    const errEl = document.getElementById('friendRequestError');
    const code = input.value.trim().toUpperCase();
    if (!code || code.length < 6) { errEl.textContent = 'Enter a valid 6-character code'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';
    import('./friends.js').then(m => {
        m.sendFriendRequest(code)
            .then(() => { input.value = ''; alert('Friend request sent!'); })
            .catch(e => { errEl.textContent = e.message; errEl.style.display = 'block'; });
    });
};

function renderFriendRequests(requests) {
    const list = document.getElementById('friendRequestsList');
    if (!list) return;
    if (!requests || requests.length === 0) {
        list.innerHTML = '<p style="color:#666;font-size:11px;text-align:center;">No pending requests</p>';
        return;
    }
    list.innerHTML = requests.map(r =>
        `<div class="req-entry">
            <span class="req-name">${r.fromName}</span>
            <span style="color:#888;font-size:9px;letter-spacing:1px;">${r.fromCode || ''}</span>
            <button class="toast-btn accept" onclick="acceptFriendRequest('${r.from}')" style="padding:4px 10px;font-size:10px;">ACCEPT</button>
            <button class="toast-btn decline" onclick="declineFriendRequest('${r.from}')" style="padding:4px 10px;font-size:10px;">DECLINE</button>
        </div>`
    ).join('');
}

function renderFriendList(friends) {
    const list = document.getElementById('friendsList');
    if (!list) return;
    if (!friends || friends.length === 0) {
        list.innerHTML = '<p style="color:#666;font-size:11px;text-align:center;">No friends yet. Add some above!</p>';
        return;
    }
    list.innerHTML = friends.map(f =>
        `<div class="friend-entry">
            <span class="friend-status-dot ${f.online ? 'online' : 'offline'}"></span>
            <span class="friend-name">${f.name}</span>
            <span class="friend-code-label">${f.friendCode}</span>
        </div>`
    ).join('');
}

window.acceptFriendRequest = function(fromUid) {
    import('./friends.js').then(m => m.respondToFriendRequest(fromUid, true));
};
window.declineFriendRequest = function(fromUid) {
    import('./friends.js').then(m => m.respondToFriendRequest(fromUid, false));
};

// ==================== NOTIFICATION SYSTEM ====================
let _notificationTimer = null;
let _notificationHandlers = {};

export function showNotification(title, actions = []) {
    const toast = document.getElementById('notificationToast');
    const content = document.getElementById('notificationContent');
    const actionsEl = document.getElementById('notificationActions');
    if (!toast || !content || !actionsEl) return;

    content.textContent = title;
    actionsEl.innerHTML = actions.map((a, i) => {
        const id = 'toast_btn_' + i;
        _notificationHandlers[id] = a.onClick;
        return `<button class="toast-btn ${a.cls || 'dismiss'}" id="${id}">${a.label}</button>`;
    }).join('');

    // Bind click handlers
    actions.forEach((a, i) => {
        const btn = document.getElementById('toast_btn_' + i);
        if (btn) btn.onclick = a.onClick;
    });

    toast.className = 'show';
    toast.style.display = 'block';

    // Auto-hide after 10s if no actions, or 20s with actions
    const timeout = actions.length > 0 ? 20000 : 10000;
    if (_notificationTimer) clearTimeout(_notificationTimer);
    _notificationTimer = setTimeout(() => hideNotification(), timeout);
}

export function hideNotification() {
    const toast = document.getElementById('notificationToast');
    if (!toast) return;
    toast.className = 'hide';
    setTimeout(() => { toast.style.display = 'none'; }, 300);
    if (_notificationTimer) { clearTimeout(_notificationTimer); _notificationTimer = null; }
}

// Handle incoming lobby invitations
function handleInvitations(invites) {
    if (!invites || invites.length === 0) return;
    // Show notification for the latest invite
    const inv = invites[invites.length - 1];
    showNotification(
        inv.fromName + ' invited you to a ' + (inv.mode || 'multiplayer') + ' room! Code: ' + (inv.roomCode || '—'),
        [
            { label: 'JOIN', cls: 'accept', onClick: () => {
                inviteJoinLobby(inv.roomCode);
                import('./friends.js').then(m => m.clearInvitation(inv.from));
                hideNotification();
            }},
            { label: 'DECLINE', cls: 'decline', onClick: () => {
                import('./friends.js').then(m => m.clearInvitation(inv.from));
                hideNotification();
            }}
        ]
    );
}

function inviteJoinLobby(roomCode) {
    if (!roomCode) return;
    // Close current overlay and join by code
    showOverlay(null);
    document.getElementById('loadingScreen').style.display = 'flex';
    document.getElementById('loadingTitle').textContent = 'JOINING ROOM...';
    document.getElementById('loadingSubtitle').textContent = roomCode;
    // Import multiplayer and join
    import('./multiplayer.js').then(m => m.joinByCode(roomCode));
}

// ==================== LOBBY HELPERS ====================
window.copyRoomCode = function() {
    const code = document.getElementById('currentRoomCode');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(() => {
        const btn = document.querySelector('[onclick="copyRoomCode()"]');
        if (btn) { btn.textContent = 'COPIED!'; setTimeout(() => { btn.textContent = 'COPY'; }, 2000); }
    }).catch(() => {});
};

// ==================== PROGRESSION UI ====================

function updateCampaignDesc() {
    const el = document.getElementById('campaignDesc');
    if (el) {
        const data = getCampaignData();
        let completed = 0;
        for (const s of data.stages) completed += s.completed.filter(Boolean).length;
        const total = STAGE_COUNT * LEVELS_PER_STAGE;
        if (completed >= total) {
            el.textContent = '🎉 All ' + total + ' levels complete!';
        } else {
            const stage = STAGES[data.unlockedStage];
            el.textContent = stage.icon + ' ' + stage.name + ' — ' + completed + '/' + total + ' levels';
        }
    }
}

export function updateCurrencyDisplay() {
    updateCampaignDesc();
    const gemsEl = document.getElementById('homeGems');
    const coinsEl = document.getElementById('homeCoins');
    if (gemsEl) gemsEl.textContent = '💎 ' + getGems();
    if (coinsEl) coinsEl.textContent = '🪙 ' + getCoins();
    // Rank
    const rank = getRank();
    const rankEl = document.getElementById('homeRankBadge');
    const barEl = document.getElementById('homeRankBar');
    if (rankEl) rankEl.innerHTML = rank.icon + ' <span class="rank-title">' + rank.title + '</span>';
    if (barEl) barEl.style.width = (getRankProgress() * 100).toFixed(0) + '%';
}

window.showMissions = function() {
    import('./progression.js').then(m => {
        const container = document.getElementById('missionsContainer');
        const missions = m.getMissions();
        if (!missions || missions.length === 0) {
            container.innerHTML = '<p style="color:#666;text-align:center;">No missions today</p>';
        } else {
            let html = '';
            for (const mission of missions) {
                const pct = Math.min(100, Math.round((mission.progress / mission.count) * 100));
                const done = mission.completed;
                const claimed = mission.claimed;
                const cardClass = claimed ? 'mission-card claimed' : done ? 'mission-card completed' : 'mission-card';
                let rewardsParts = [];
                if (mission.rewards.gems) rewardsParts.push('<span class="gem">💎' + mission.rewards.gems + '</span>');
                if (mission.rewards.coins) rewardsParts.push('<span class="coin">🪙' + mission.rewards.coins + '</span>');
                if (mission.rewards.xp) rewardsParts.push('<span class="xp">⭐' + mission.rewards.xp + 'xp</span>');
                const btnDisabled = claimed ? 'disabled' : done ? '' : 'disabled';
                const btnClass = claimed ? 'done' : done ? 'ready' : 'locked';
                const btnText = claimed ? '✓ DONE' : done ? 'CLAIM' : 'LOCKED';
                const btnClick = claimed ? '' : done ? `claimMission('${mission.id}')` : '';

                html += `
                <div class="${cardClass}">
                    <div class="mission-header">
                        <span class="mission-title">${mission.title}</span>
                        <span class="mission-rewards">${rewardsParts.join(' ')}</span>
                    </div>
                    <div class="mission-desc">${mission.desc.replace('{progress}', mission.progress).replace('{count}', mission.count)}</div>
                    <div class="mission-bar-bg"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
                    <div class="mission-progress">
                        <span class="mission-pct">${pct}%</span>
                        <button class="mission-claim-btn ${btnClass}" onclick="${btnClick}" ${btnDisabled ? 'disabled' : ''}>${btnText}</button>
        </div>
    </div>`;
            }
            container.innerHTML = html;
        }
        updateCurrencyDisplay();
        refreshSpBadge();
    });
    showOverlay('missionsOverlay');
    log('info','UI','Opening missions panel');
};

window.claimMission = function(missionId) {
    import('./progression.js').then(m => {
        const result = m.claimMissionReward(missionId);
        if (result.ok) {
            log('info','MISSIONS','Claimed reward');
            window.showMissions(); // refresh
        }
    });
};

window.closeMissions = function() {
    showOverlay('loginOverlay');
    log('info','UI','Closing missions panel');
};

window.showProgression = function() {
    import('./progression.js').then(m => {
        const P = m.getPlayerData();
        const rank = m.getRank();
        const rankIdx = m.rankIndex(rank);
        const ranks = m.RANKS;
        const nextRank = rankIdx < ranks.length - 1 ? ranks[rankIdx + 1] : null;
        const xpInRank = nextRank ? P.xp - rank.minXp : 0;
        const xpNeeded = nextRank ? nextRank.minXp - rank.minXp : 1;
        const xpPct = Math.min(100, Math.round((xpInRank / xpNeeded) * 100));
        const maxRankIdx = ranks.length - 1;

        let html = '';

        // Current rank card
        html += '<div class="prog-current-rank">';
        html += '<span class="prog-rank-icon">' + rank.icon + '</span>';
        html += '<div class="prog-rank-title">' + rank.title + '</div>';
        html += '<div class="prog-rank-xp">' + P.xp.toLocaleString() + ' total XP';
        if (nextRank) {
            html += ' &bull; ' + xpInRank.toLocaleString() + ' / ' + xpNeeded.toLocaleString() + ' to next rank';
        } else {
            html += ' &bull; MAX RANK';
        }
        html += '</div>';
        if (nextRank) {
            html += '<div class="prog-xp-bar-bg"><div class="prog-xp-bar-fill" style="width:' + xpPct + '%"></div></div>';
        }
        html += '</div>';

        // Stats row
        const stats = m.getStats();
        html += '<div class="prog-stats-row">';
        html += '<div class="prog-stat"><div class="prog-stat-val">' + (stats.levelsCompleted || 0) + '</div><div class="prog-stat-lbl">LEVELS</div></div>';
        html += '<div class="prog-stat"><div class="prog-stat-val">' + (stats.highScore || 0).toLocaleString() + '</div><div class="prog-stat-lbl">BEST SCORE</div></div>';
        html += '<div class="prog-stat"><div class="prog-stat-val">' + (stats.gamesPlayed || 0) + '</div><div class="prog-stat-lbl">GAMES</div></div>';
        html += '<div class="prog-stat"><div class="prog-stat-val">' + (P.ownedWeapons ? P.ownedWeapons.length : 0) + '</div><div class="prog-stat-lbl">WEAPONS</div></div>';
        html += '<div class="prog-stat"><div class="prog-stat-val">' + (P.ownedSkins ? P.ownedSkins.length : 0) + '</div><div class="prog-stat-lbl">SKINS</div></div>';
        html += '</div>';

        // Rank list
        html += '<div class="prog-rank-list">';
        for (let i = 0; i <= maxRankIdx; i++) {
            const r = m.RANKS[i];
            const isCurrent = i === rankIdx;
            const isUnlocked = i <= rankIdx;
            let cls = 'prog-rank-row';
            if (isCurrent) cls += ' current';
            else if (isUnlocked) cls += ' unlocked';
            else cls += ' locked';

            html += '<div class="' + cls + '">';
            html += '<span class="prog-r-icon">' + r.icon + '</span>';
            html += '<span class="prog-r-title">' + r.title + '</span>';
            html += '<span class="prog-r-xp">' + r.minXp.toLocaleString() + ' XP</span>';
            if (isCurrent) {
                html += '<span class="prog-r-check" style="color:#f1c40f;">⬅</span>';
            } else if (isUnlocked) {
                html += '<span class="prog-r-check" style="color:#2ecc71;">✓</span>';
            } else {
                html += '<span class="prog-r-check" style="color:#555;">🔒</span>';
            }
            html += '</div>';
        }
        html += '</div>';

        document.getElementById('progressionGrid').innerHTML = html;
    });
    showOverlay('progressionOverlay');
    log('info','UI','Opening progression panel');
};

window.closeProgression = function() {
    showOverlay('loginOverlay');
    log('info','UI','Closing progression panel');
};

// ==================== SEASON PASS / BATTLE PASS ====================

window.showSeasonPass = function() {
    renderSeasonPass();
    showOverlay('seasonPassOverlay');
    log('info','UI','Opening Season Pass');
};

window.closeSeasonPass = function() {
    showOverlay('loginOverlay');
    refreshSpBadge();
    log('info','UI','Closing Season Pass');
};

export function refreshSpBadge() {
    const badge = document.getElementById('spBadge');
    if (!badge) return;
    try {
        const tier = getSessionTier();
        const claimed = getClaimedRewards();
        const allRewards = getSessionRewards();
        const unclaimed = allRewards.filter(e => tier >= e.tier && !claimed.includes(e.tier)).length;
        if (unclaimed > 0) {
            badge.textContent = unclaimed > 99 ? '99+' : unclaimed;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {
        badge.style.display = 'none';
    }
}

function renderSeasonPass() {
    const grid = document.getElementById('seasonPassGrid');
    if (!grid) return;

    const tier = getSessionTier();
    const progress = getSessionProgressInTier();
    const claimed = getClaimedRewards();
    const lifetimeXp = getSessionLifetimeXp();
    const totalTiers = SESSION.tiers;
    const isMaxTier = tier >= totalTiers;
    const maxTierXp = totalTiers * SESSION.xpPerTier;

    const headerEl = document.getElementById('seasonPassHeader');
    if (headerEl) {
        const pct = isMaxTier ? 100 : Math.min(100, (progress.totalXp / maxTierXp) * 100);
        headerEl.innerHTML = `
            <div class="sp-header-top">
                <span class="sp-season-icon">${SESSION.icon}</span>
                <span class="sp-season-name">${SESSION.name}</span>
            </div>
            <div class="sp-season-desc">${SESSION.description}</div>
            <div class="sp-progress-bar">
                <div class="sp-progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="sp-progress-stats">
                <span>Tier <strong>${isMaxTier ? totalTiers : tier}</strong> / ${totalTiers}</span>
                <span>${isMaxTier ? 'MAX TIER!' : progress.tierProgress + ' / ' + progress.tierMax + ' XP to next tier'}</span>
                <span>Total: ${lifetimeXp.toLocaleString()} XP</span>
            </div>
        `;
    }

    const allRewards = getSessionRewards();
    let html = '';
    for (const entry of allRewards) {
        const t = entry.tier;
        const reward = entry.reward;
        const isUnlocked = tier >= t;
        const isClaimed = claimed.includes(t);

        let rewardDisplay = '';
        switch (reward.type) {
            case 'coins':
                rewardDisplay = '<span class="sp-reward-icon">🪙</span><span class="sp-reward-amount">' + reward.amount + '</span>';
                break;
            case 'gems':
                rewardDisplay = '<span class="sp-reward-icon">💎</span><span class="sp-reward-amount">' + reward.amount + '</span>';
                break;
            case 'skin': {
                const skin = SKINS.find(s => s.id === reward.id);
                rewardDisplay = '<span class="sp-reward-icon" style="color:' + (skin ? skin.color : '#fff') + ';">🎨</span><span class="sp-reward-name">' + (skin ? skin.name : reward.id) + '</span>';
                break;
            }
            case 'weapon': {
                const weapon = WEAPONS.find(w => w.id === reward.id);
                rewardDisplay = '<span class="sp-reward-icon">🔫</span><span class="sp-reward-name">' + (weapon ? weapon.name : reward.id) + '</span>';
                break;
            }
            case 'title':
                rewardDisplay = '<span class="sp-reward-icon">🏆</span><span class="sp-reward-name">' + reward.title + '</span>';
                break;
            case 'bundle': {
                let parts = [];
                if (reward.coins) parts.push('🪙' + reward.coins);
                if (reward.gems) parts.push('💎' + reward.gems);
                if (reward.title) parts.push('🏆' + reward.title);
                rewardDisplay = '<span class="sp-reward-bundle">' + parts.join(' ') + '</span>';
                break;
            }
        }

        // Extra coins/gems on milestone skins/weapons
        let extraRewardHtml = '';
        if (reward.coins && reward.type !== 'bundle') extraRewardHtml += '<span class="sp-extra">+🪙' + reward.coins + '</span>';
        if (reward.gems && reward.type !== 'bundle') extraRewardHtml += '<span class="sp-extra">+💎' + reward.gems + '</span>';

        const isMilestone = t === 5 || t === 10 || t === 15 || t === 20 || t === 25 || t === 30;
        const cardClass = isClaimed ? 'sp-tier claimed'
            : isUnlocked ? 'sp-tier unlocked'
            : 'sp-tier locked';

        const btnClass = isClaimed ? 'sp-btn claimed'
            : isUnlocked ? 'sp-btn claim'
            : 'sp-btn locked';
        const btnText = isClaimed ? '✓ CLAIMED'
            : isUnlocked ? 'CLAIM'
            : '🔒';
        const btnDisabled = isClaimed || !isUnlocked ? 'disabled' : '';
        const btnClick = isUnlocked && !isClaimed ? `claimBattlePassTier(${t})` : '';

        html += `
        <div class="${cardClass}${isMilestone ? ' milestone' : ''}">
            <div class="sp-tier-num">TIER ${t}</div>
            <div class="sp-reward">${rewardDisplay}</div>
            ${extraRewardHtml ? '<div class="sp-extra-row">' + extraRewardHtml + '</div>' : ''}
            <button class="${btnClass}" onclick="${btnClick}" ${btnDisabled}>${btnText}</button>
        </div>`;
    }

    const hasUnclaimed = allRewards.some(e => tier >= e.tier && !claimed.includes(e.tier));
    html += `
    <div class="sp-tier sp-claim-all">
        <div class="sp-tier-num" style="color:#f1c40f;">BULK CLAIM</div>
        <div style="color:#888;font-size:10px;">Claim all available rewards at once</div>
        <button class="sp-btn claim-all" onclick="claimAllBattlePass()" ${hasUnclaimed ? '' : 'disabled'}>
            ${hasUnclaimed ? 'CLAIM ALL' : 'ALL CLAIMED'}
        </button>
    </div>`;

    grid.innerHTML = html;
}

window.claimBattlePassTier = function(tier) {
    const result = claimReward(tier);
    if (result.ok) {
        // Brief pop animation on claimed card
        const cards = document.querySelectorAll('.sp-tier');
        cards.forEach(c => {
            const numEl = c.querySelector('.sp-tier-num');
            if (numEl && numEl.textContent.includes('TIER ' + tier)) {
                c.classList.add('claiming');
                setTimeout(() => c.classList.remove('claiming'), 500);
            }
        });
        renderSeasonPass();
        updateCurrencyDisplay();
        log('info','SESSION','Claimed tier ' + tier + ' reward');
    }
};

window.claimAllBattlePass = function() {
    const count = claimAllAvailableRewards();
    if (count > 0) {
        renderSeasonPass();
        updateCurrencyDisplay();
        log('info','SESSION','Claimed ' + count + ' rewards');
    }
};

window.showShop = function() {
    const gemEl = document.getElementById('shopGems');
    const coinEl = document.getElementById('shopCoins');
    import('./progression.js').then(m => {
        if (gemEl) gemEl.textContent = m.getGems();
        if (coinEl) coinEl.textContent = m.getCoins();
    });
    switchShopTab('skins');
    showOverlay('shopOverlay');
    log('info','UI','Opening shop');
};

window.switchShopTab = function(tab) {
    document.getElementById('shopTabSkins').classList.toggle('selected', tab === 'skins');
    document.getElementById('shopTabWeapons').classList.toggle('selected', tab === 'weapons');
    document.getElementById('shopTabGadgets').classList.toggle('selected', tab === 'gadgets');
    document.getElementById('shopTabTrails').classList.toggle('selected', tab === 'trails');
    document.getElementById('shopTabKillEffects').classList.toggle('selected', tab === 'killEffects');
    document.getElementById('shopTabWeaponSkins').classList.toggle('selected', tab === 'weaponSkins');
    const content = document.getElementById('shopContent');
    import('./progression.js').then(m => {
        switch (tab) {
            case 'skins':
                renderShopItems(content, SKINS, 'skin', m);
                break;
            case 'weapons':
                renderShopItems(content, WEAPONS, 'weapon', m);
                break;
            case 'gadgets':
                renderShopItems(content, GADGETS, 'gadget', m);
                break;
            case 'trails':
                renderShopItems(content, TRAILS, 'trail', m);
                break;
            case 'killEffects':
                renderShopItems(content, KILL_EFFECTS, 'killEffect', m);
                break;
            case 'weaponSkins':
                renderShopItems(content, WEAPON_SKINS, 'weaponSkin', m);
                break;
        }
    });
};

const WEAPON_ICONS = {
    standard: '🔫',
    rapid: '⚡',
    cannon: '💥',
    shotgun: '💢',
    sniper: '🎯',
    minigun: '🔥',
};

function renderShopItems(container, items, type, prog) {
    const isBackpackType = ['gadget', 'trail', 'killEffect', 'weaponSkin'].includes(type);
    const ownedList = isBackpackType
        ? (prog.getBackpackByType ? prog.getBackpackByType(type) : [])
        : type === 'skin' ? prog.getOwnedSkins() : prog.getOwnedWeapons();
    const equippedId = isBackpackType
        ? (prog.getEquippedItem ? prog.getEquippedItem(type) : null)
        : type === 'skin' ? prog.getEquippedSkin() : prog.getEquippedWeapon();
    const rank = prog.getRank();

    let html = '<div class="shop-grid">';
    for (const item of items) {
        if (item.session) continue; // session-exclusive items not sold in shop
        const owned = ownedList.includes(item.id);
        const equipped = equippedId === item.id;
        const rankLocked = item.minRank && prog.rankIndex(item.minRank) > prog.rankIndex(rank);
        const itemClass = equipped ? 'shop-item equipped' : owned ? 'shop-item owned' : rankLocked ? 'shop-item' : 'shop-item';

        let priceHtml = '';
        if (item.cost === 0) {
            priceHtml = '<div class="shop-item-price"><span class="free">FREE</span></div>';
        } else if (item.currency === 'gems') {
            priceHtml = '<div class="shop-item-price"><span class="gem">💎 ' + item.cost + '</span></div>';
        } else {
            priceHtml = '<div class="shop-item-price"><span class="coin">🪙 ' + item.cost + '</span></div>';
        }

        let btnHtml = '';
        if (equipped) {
            btnHtml = '<button class="shop-item-btn equipped">EQUIPPED</button>';
        } else if (owned) {
            const fn = isBackpackType ? `equipShopItem('${type}','${item.id}')` : (type === 'skin' ? `equipShopSkin('${item.id}')` : `equipShopWeapon('${item.id}')`);
            btnHtml = `<button class="shop-item-btn equip" onclick="${fn}">EQUIP</button>`;
        } else if (rankLocked) {
            btnHtml = `<button class="shop-item-btn" style="color:#666;cursor:not-allowed;" disabled>🔒 ${item.minRank.title || item.minRank}</button>`;
        } else {
            const fn = isBackpackType ? `buyShopItem('${type}','${item.id}')` : (type === 'skin' ? `buyShopSkin('${item.id}')` : `buyShopWeapon('${item.id}')`);
            const label = (item.cost === 0) ? 'GET FREE' : 'BUY';
            btnHtml = `<button class="shop-item-btn buy" onclick="${fn}">${label}</button>`;
        }

        let iconHtml = '';
        if (type === 'skin') {
            iconHtml = `<canvas class="skin-preview-canvas" data-skin-id="${item.id}" width="60" height="50"></canvas>`;
        } else if (type === 'weapon') {
            iconHtml = `<div class="shop-item-icon weapon-icon" onclick="showWeaponPreview3D('${item.id}')" style="cursor:pointer;" title="Click for 3D preview">${WEAPON_ICONS[item.id] || '🔫'}</div>`;
        } else {
            iconHtml = `<div class="shop-item-icon" style="font-size:28px;text-align:center;">${item.icon || '•'}</div>`;
        }

        html += `
        <div class="${itemClass}">
            ${iconHtml}
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-desc">${item.desc}</div>
            ${priceHtml}
            ${btnHtml}
        </div>`;
    }
    html += '</div>';
    container.innerHTML = html;

    // Draw skin previews on each canvas
    if (type === 'skin') {
        container.querySelectorAll('.skin-preview-canvas').forEach(c => {
            const skin = items.find(s => s.id === c.dataset.skinId);
            if (skin) drawSkinPreview(c, skin);
        });
    }
}

function drawSkinPreview(canvas, skin) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;

    // Glow behind body
    if (skin.glowColor) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.shadowColor = skin.glowColor;
        ctx.shadowBlur = 16;
        ctx.fillStyle = skin.glowColor;
        ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // Body
    ctx.fillStyle = skin.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(cx - 14, cy - 14, 28, 28, 5); ctx.fill(); ctx.stroke();

    // Body pattern
    if (skin.bodyPattern) {
        const px = (x) => cx + x * (28/36);
        const py = (y) => cy + y * (28/36);
        switch (skin.bodyPattern) {
            case 'carbon':
                ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
                for (let x = -9; x <= 9; x += 6) { ctx.beginPath(); ctx.moveTo(px(x), py(-14)); ctx.lineTo(px(x), py(14)); ctx.stroke(); }
                for (let y = -9; y <= 9; y += 6) { ctx.beginPath(); ctx.moveTo(px(-14), py(y)); ctx.lineTo(px(14), py(y)); ctx.stroke(); }
                break;
            case 'etched':
                ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(px(-9), py(-9)); ctx.lineTo(px(9), py(9)); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(px(9), py(-9)); ctx.lineTo(px(-9), py(9)); ctx.stroke();
                break;
            case 'circuit':
                ctx.strokeStyle = 'rgba(0,255,136,0.25)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(px(-9), py(-9)); ctx.lineTo(px(-3), py(-9)); ctx.lineTo(px(-3), py(-3));
                ctx.lineTo(px(3), py(-3)); ctx.lineTo(px(3), py(3)); ctx.lineTo(px(9), py(3)); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(px(-9), py(9)); ctx.lineTo(px(-3), py(9)); ctx.lineTo(px(-3), py(3));
                ctx.lineTo(px(3), py(3)); ctx.lineTo(px(3), py(-3)); ctx.lineTo(px(9), py(-3)); ctx.stroke();
                break;
            case 'flame':
                ctx.strokeStyle = 'rgba(255,200,0,0.2)'; ctx.lineWidth = 1;
                for (let x = -7; x <= 7; x += 7) {
                    ctx.beginPath(); ctx.moveTo(px(x), py(11));
                    ctx.quadraticCurveTo(px(x-2), py(6), px(x), py(2));
                    ctx.quadraticCurveTo(px(x+2), py(-3), px(x), py(-8)); ctx.stroke();
                }
                break;
            case 'stealth':
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                for (let x = -9; x <= 9; x += 6)
                    for (let y = -9; y <= 9; y += 6) { ctx.beginPath(); ctx.arc(px(x), py(y), 1, 0, Math.PI*2); ctx.fill(); }
                break;
            case 'crystal':
                ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(px(-14), py(-5)); ctx.lineTo(px(-5), py(-14)); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(px(5), py(-14)); ctx.lineTo(px(14), py(-5)); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(px(-14), py(5)); ctx.lineTo(px(-5), py(14)); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(px(5), py(14)); ctx.lineTo(px(14), py(5)); ctx.stroke();
                break;
        }
    }

    // Visor
    if (skin.visorColor) {
        ctx.save();
        ctx.shadowColor = skin.visorColor;
        ctx.shadowBlur = 6;
        ctx.fillStyle = skin.visorColor;
        ctx.beginPath(); ctx.arc(cx, cy - 12, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // Turret
    ctx.strokeStyle = skin.turretGlow || skin.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 16, cy); ctx.stroke();
    if (skin.glowColor) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.shadowColor = skin.glowColor;
        ctx.shadowBlur = 6;
        ctx.strokeStyle = skin.glowColor;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 16, cy); ctx.stroke();
        ctx.restore();
    }
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
}

window.closeShop = function() {
    updateCurrencyDisplay();
    showOverlay('loginOverlay');
    log('info','UI','Closing shop');
};

// Shop helper functions (callable from onclick)
window.buyShopSkin = function(id) {
    import('./progression.js').then(m => {
        const result = m.buySkin(id);
        if (result && result.ok) {
            closeShop();
            showCelebration(id);
        } else {
            window.showShop();
        }
    });
};
window.buyShopWeapon = function(id) {
    import('./progression.js').then(m => { m.buyWeapon(id); window.showShop(); });
};
window.equipShopSkin = function(id) {
    import('./progression.js').then(m => { m.equipSkin(id); window.showShop(); });
};
window.equipShopWeapon = function(id) {
    import('./progression.js').then(m => { m.equipWeapon(id); window.showShop(); });
};

// Generic shop helpers for backpack items
window.buyShopItem = function(type, id) {
    import('./progression.js').then(m => {
        const result = m.buyItem(type, id);
        if (result && result.ok) {
            closeShop();
            showCelebration(id);
        } else {
            window.showShop();
        }
    });
};
window.equipShopItem = function(type, id) {
    import('./progression.js').then(m => { m.equipItem(type, id); window.showShop(); });
};

// ==================== UPGRADE SHOP ====================
const UPGRADE_CATEGORIES = [
    { id: 'speed',     icon: '⚡', name: 'Speed',       desc: 'Faster tank movement',      perLevel: '+10% speed' },
    { id: 'fuel',      icon: '⛽', name: 'Fuel Capacity', desc: 'Larger fuel tank',          perLevel: '+20 fuel' },
    { id: 'mineRadius', icon: '💥', name: 'Mine Radius',  desc: 'Bigger mine explosions',    perLevel: '+12px radius' },
];

window.showUpgrades = function() {
    import('./progression.js').then(m => {
        document.getElementById('upgradePoints').textContent = m.getUpgradePoints();
        const stage = m.getTankStage();
        document.getElementById('upgradeStage').textContent = stage;
        renderUpgradeGrid(m);
    });
    showOverlay('upgradeOverlay');
    log('info','UI','Opening upgrade shop');
};

function renderUpgradeGrid(prog) {
    const grid = document.getElementById('upgradeGrid');
    if (!grid) return;
    const stage = prog.getTankStage();
    const stageMult = prog.getTankStageMultiplier(stage);
    document.getElementById('upgradeStage').textContent = stage;

    let html = `<div style="color:#888;font-size:10px;margin-bottom:8px;text-align:center;">Stage ${stage} — All stats ×${stageMult.toFixed(2)}</div>`;

    for (const cat of UPGRADE_CATEGORIES) {
        const level = prog.getUpgradeLevel(cat.id);
        const maxed = level >= prog.getUpgradeMaxLevel();
        const cost = maxed ? 0 : prog.getUpgradeCost(cat.id);
        const points = prog.getUpgradePoints();
        const canAfford = !maxed && points >= cost;
        const barSegments = 10;
        let barHtml = '';
        for (let i = 0; i < barSegments; i++) {
            barHtml += `<span style="display:inline-block;width:14px;height:6px;margin-right:2px;border-radius:2px;background:${i < level ? '#f1c40f' : '#2a2a2a'};"></span>`;
        }

        html += `
        <div class="upgrade-card ${maxed ? 'maxed' : ''}">
            <div class="upgrade-card-icon">${cat.icon}</div>
            <div class="upgrade-card-info">
                <div class="upgrade-card-name">${cat.name}</div>
                <div class="upgrade-card-desc">${cat.desc}</div>
                <div class="upgrade-card-level">${barHtml} <span class="level-fill">${level}</span> / ${prog.getUpgradeMaxLevel()}</div>
            </div>
            <div class="upgrade-card-cost">
                ${maxed
                    ? '<button class="upgrade-card-btn maxed-btn" disabled>MAXED</button>'
                    : `<button class="upgrade-card-btn" ${canAfford ? `onclick="buyUpgrade('${cat.id}')"` : 'disabled'}>${cost} PT</button>`
                }
            </div>
        </div>`;
    }
    grid.innerHTML = html;

    const stageUpContainer = document.getElementById('stageUpContainer');
    if (stageUpContainer) {
        stageUpContainer.style.display = prog.canStageUp() ? 'block' : 'none';
    }
}

window.buyUpgrade = function(category) {
    import('./progression.js').then(m => {
        const result = m.buyUpgrade(category);
        if (result.ok) {
            document.getElementById('upgradePoints').textContent = m.getUpgradePoints();
            renderUpgradeGrid(m);
            log('info','UPGRADE','Upgraded ' + category + ' to level ' + result.level);
        }
    });
};

window.stageUp = function() {
    import('./progression.js').then(m => {
        const result = m.stageUp();
        if (result.ok) {
            document.getElementById('upgradeStage').textContent = result.stage;
            document.getElementById('upgradePoints').textContent = m.getUpgradePoints();
            renderUpgradeGrid(m);
            const btn = document.querySelector('#stageUpContainer button');
            if (btn) {
                btn.textContent = '✔ STAGE UP!';
                setTimeout(() => { btn.textContent = '🌟 STAGE UP'; }, 1500);
            }
            log('info','UPGRADE','Tank staged up to stage ' + result.stage);
        }
    });
};

window.closeUpgrades = function() {
    showOverlay('loginOverlay');
    log('info','UI','Closing upgrade shop');
};

// ==================== 3D WEAPON PREVIEW (Three.js) ====================
let _wp3dRenderer = null, _wp3dAnimId = null;

window.wp3dCleanup = function() {
    if (_wp3dAnimId) { cancelAnimationFrame(_wp3dAnimId); _wp3dAnimId = null; }
    if (_wp3dRenderer) {
        _wp3dRenderer.dispose();
        const canvas = _wp3dRenderer.domElement;
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        _wp3dRenderer = null;
    }
};

window.showWeaponPreview3D = function(weaponId) {
    import('./config.js').then(({ WEAPONS }) => {
        const wp = WEAPONS.find(w => w.id === weaponId);
        if (!wp) return;
        document.getElementById('wp3dTitle').textContent = wp.name;
        document.getElementById('wp3dDesc').textContent = wp.desc + ' — ' + (wp.cost === 0 ? 'FREE' : (wp.currency === 'gems' ? '💎' : '🪙') + ' ' + wp.cost);
        document.getElementById('weaponPreview3D').style.display = 'flex';
        const loadingEl = document.getElementById('wp3dLoading');
        if (loadingEl) loadingEl.style.display = 'none';

        // Cleanup previous render
        wp3dCleanup();

        // Three.js setup
        const container = document.getElementById('wp3dContainer');
        const w = container.clientWidth || 320, h = container.clientHeight || 260;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a14);
        const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
        camera.position.set(3, 2, 5);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        _wp3dRenderer = renderer;

        const ambient = new THREE.AmbientLight(0x404060, 0.5);
        scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(2, 5, 3);
        scene.add(dirLight);
        const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
        fillLight.position.set(-2, 1, -3);
        scene.add(fillLight);

        const group = new THREE.Group();
        const COLORS = {
            standard: 0xcccccc,
            rapid: 0x5dade2,
            cannon: 0xe67e22,
            shotgun: 0xf1c40f,
            sniper: 0x8e44ad,
            minigun: 0xe74c3c,
        };
        const baseColor = COLORS[weaponId] || 0xcccccc;

        function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); group.add(m); return m; }
        switch (weaponId) {
            case 'standard': {
                mesh(new THREE.BoxGeometry(0.6, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.3 })).position.set(-0.8, 0, 0);
                const barrel = mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.4, 16), new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.4, metalness: 0.6 }));
                barrel.rotation.z = Math.PI / 2; barrel.position.set(0.2, 0, 0);
                const muzzle = mesh(new THREE.TorusGeometry(0.25, 0.06, 8, 16), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }));
                muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0.9, 0, 0);
                break;
            }
            case 'rapid': {
                mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.5, metalness: 0.4 })).position.set(-0.5, 0, 0);
                for (let i = -1; i <= 1; i++) {
                    const b = mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 12), new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.3, metalness: 0.7 }));
                    b.rotation.z = Math.PI / 2; b.position.set(0.3, i * 0.2, 0);
                }
                break;
            }
            case 'cannon': {
                mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), new THREE.MeshStandardMaterial({ color: 0x5c2e16, roughness: 0.7, metalness: 0.2 })).position.set(-0.7, 0, 0);
                const barrel = mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.2, 16), new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.5, metalness: 0.4 }));
                barrel.rotation.z = Math.PI / 2; barrel.position.set(0.1, 0, 0);
                const muzzle = mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 16), new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 }));
                muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0.8, 0, 0);
                break;
            }
            case 'shotgun': {
                mesh(new THREE.BoxGeometry(0.7, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.7 })).position.set(-0.7, 0, 0);
                for (let i = -1; i <= 1; i += 2) {
                    const b = mesh(new THREE.CylinderGeometry(0.15, 0.18, 1.0, 12), new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.5, metalness: 0.3 }));
                    b.rotation.z = Math.PI / 2; b.position.set(0.1, i * 0.16, 0);
                }
                break;
            }
            case 'sniper': {
                mesh(new THREE.BoxGeometry(1.0, 0.25, 0.35), new THREE.MeshStandardMaterial({ color: 0x2c0e3a, roughness: 0.3, metalness: 0.5 })).position.set(-0.6, 0, 0);
                const barrel = mesh(new THREE.CylinderGeometry(0.15, 0.18, 1.6, 14), new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.3, metalness: 0.7 }));
                barrel.rotation.z = Math.PI / 2; barrel.position.set(0.4, 0, 0);
                for (let i = 0; i < 3; i++) {
                    const coil = mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 12), new THREE.MeshStandardMaterial({ color: 0xbb86fc, emissive: 0xbb86fc, emissiveIntensity: 0.3 }));
                    coil.rotation.x = Math.PI / 2; coil.position.set(0.1 + i * 0.3, 0, 0);
                }
                break;
            }
            case 'minigun': {
                mesh(new THREE.BoxGeometry(0.6, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x3a1c1c, roughness: 0.7, metalness: 0.3 })).position.set(-0.7, 0, 0);
                const barrelMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.4, metalness: 0.6 });
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const bx = Math.cos(angle) * 0.22;
                    const by = Math.sin(angle) * 0.22;
                    const b = mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.4, 8), barrelMat);
                    b.rotation.z = Math.PI / 2;
                    b.position.set(0.15, bx, by);
                }
                const ring = mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 16), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 }));
                ring.rotation.x = Math.PI / 2;
                ring.position.set(0.85, 0, 0);
                mesh(new THREE.BoxGeometry(0.4, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0x5c3a1c, roughness: 0.9 })).position.set(-0.3, 0.35, 0);
                break;
            }
        }
        const ground = new THREE.Mesh(new THREE.CircleGeometry(2.5, 32), new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5;
        scene.add(ground);
        scene.add(group);

        let angle = 0;
        function animate() {
            _wp3dAnimId = requestAnimationFrame(animate);
            angle += 0.01;
            group.rotation.y = angle;
            group.position.y = Math.sin(angle * 0.5) * 0.05;
            renderer.render(scene, camera);
        }
        animate();
    }).catch(err => {
        log('error','UI','3D preview failed: ' + err.message);
    });
};

// ===================== LOADOUT SYSTEM (Tab-based) =====================

const LOADOUT_TABS = [
    { type: 'weapon', label: 'Weapon', icon: '🔫' },
    { type: 'skin', label: 'Skin', icon: '🎨' },
    { type: 'title', label: 'Title', icon: '🏆' },
    { type: 'gadget', label: 'Gadget', icon: '⚡' },
    { type: 'trail', label: 'Trail', icon: '🌊' },
    { type: 'killEffect', label: 'Kill Effect', icon: '💥' },
];

let _loadoutConfirmCb = null;
let _compactLoadout = false;
let _pendingType = null;
let _pendingId = null;

export function showLoadout(onConfirm) {
    _loadoutConfirmCb = onConfirm || null;
    _compactLoadout = !!onConfirm;
    showOverlay('loadoutOverlay');
    if (G.gameState === GameState.MENU) {
        document.getElementById('loadoutOverlay').classList.add('overlay-home');
    }
    const closeBtn = document.getElementById('loadoutOverlayCloseBtn');
    if (closeBtn) {
        if (onConfirm) {
            closeBtn.textContent = 'START GAME';
            closeBtn.className = 'btn btn-success';
        } else {
            closeBtn.textContent = 'CLOSE';
            closeBtn.className = 'btn btn-info';
        }
    }
    renderLoadoutTabs();
    const firstTab = _compactLoadout ? 'weapon' : 'weapon';
    switchLoadoutTab(firstTab);
    log('info', 'UI', 'Opening loadout' + (onConfirm ? ' (compact)' : ''));
}
window.showLoadout = showLoadout;

function renderLoadoutTabs() {
    const bar = document.getElementById('loadoutTabBar');
    if (!bar) return;
    const tabs = _compactLoadout
        ? LOADOUT_TABS.filter(t => t.type === 'weapon' || t.type === 'gadget')
        : LOADOUT_TABS;
    bar.innerHTML = tabs.map(t =>
        `<button class="lo-tab" onclick="switchLoadoutTab('${t.type}')">${t.icon} ${t.label}</button>`
    ).join('');
}

window.switchLoadoutTab = function(type) {
    _pendingType = null;
    _pendingId = null;

    document.querySelectorAll('.lo-tab').forEach(el => el.classList.remove('active'));
    const tabs = document.querySelectorAll('.lo-tab');
    for (const el of tabs) {
        if (el.textContent.includes(LOADOUT_TABS.find(t => t.type === type)?.label || type)) {
            el.classList.add('active');
            break;
        }
    }

    const detailPanel = document.getElementById('loadoutDetailPanel');
    if (detailPanel) detailPanel.style.display = 'none';

    const tab = LOADOUT_TABS.find(t => t.type === type);
    document.getElementById('loadoutItemHeader').textContent = tab ? `${tab.icon} SELECT ${tab.label.toUpperCase()}` : '';

    renderLoadoutItems(type);
};

function renderLoadoutItems(type) {
    const itemList = document.getElementById('loadoutItemList');
    if (!itemList) return;
    const P = getPlayerData();
    const loadout = P.loadout || {};

    let items = [];
    let currentEquipped = null;

    switch (type) {
        case 'weapon': {
            const owned = getOwnedWeapons();
            items = WEAPONS.filter(w => owned.includes(w.id));
            currentEquipped = loadout.weapon || 'standard';
            break;
        }
        case 'skin': {
            const owned = getOwnedSkins();
            items = SKINS.filter(s => owned.includes(s.id));
            currentEquipped = loadout.skin || 'classic';
            break;
        }
        case 'title': {
            const titles = P.titles || [];
            items = [{ id: null, name: 'None', desc: 'No title displayed', icon: '\u{1F3C6}' }, ...titles.map(t => ({ id: t, name: t, desc: '', icon: '\u{1F3C6}' }))];
            currentEquipped = loadout.title || null;
            break;
        }
        case 'gadget': {
            items = [{ id: null, name: 'None', desc: 'No gadget equipped', icon: '\u2014' }, ...GADGETS.filter(g => isItemOwned('gadget', g.id))];
            currentEquipped = loadout.gadget || null;
            break;
        }
        case 'trail': {
            items = TRAILS.filter(t => isItemOwned('trail', t.id));
            currentEquipped = loadout.trail || 'default';
            break;
        }
        case 'killEffect': {
            items = KILL_EFFECTS.filter(k => isItemOwned('killEffect', k.id));
            currentEquipped = loadout.killEffect || 'default';
            break;
        }
    }

    itemList.innerHTML = items.map((item, i) => {
        const isSelected = item.id === currentEquipped;
        const previewHTML = getItemPreviewHTML(type, item, 'card');
        const delay = (0.04 + i * 0.04).toFixed(2);
        return `<div class="lo-item-card${isSelected ? ' equipped' : ''}" style="animation-delay:${delay}s" onclick="selectLoadoutItem('${type}','${(item.id || '').replace(/'/g, "\\'")}')">
            ${previewHTML}
            <div class="item-name">${item.name || 'None'}</div>
            <div class="item-sub">${item.desc ? item.desc.substring(0, 30) : ''}</div>
            ${isSelected ? '<div class="item-badge equipped-badge">EQUIPPED</div>' : '<div class="item-badge">OWNED</div>'}
        </div>`;
    }).join('');
}

window.closeLoadoutOverlay = function() {
    _pendingType = null;
    _pendingId = null;
    if (_loadoutConfirmCb) {
        const cb = _loadoutConfirmCb;
        _loadoutConfirmCb = null;
        _compactLoadout = false;
        showOverlay(null);
        cb();
    } else {
        showOverlay('loginOverlay');
    }
};

window.selectLoadoutItem = function(type, id) {
    const isLarge = size === 'detail';
    const cls = isLarge ? 'lo-detail-preview' : 'item-preview';
    switch (type) {
        case 'weapon': {
            const color = item.bulletColor || '#ffffff';
            return `<div class="${cls}" style="background:radial-gradient(circle at 35% 35%, ${color}, ${color}88);box-shadow:0 0 12px ${color}44;"></div>`;
        }
        case 'skin': {
            const color = item.color || '#e94560';
            return `<div class="${cls} skin-preview" style="background:${color};box-shadow:0 0 12px ${color}44;"></div>`;
        }
        case 'gadget':
        case 'title':
        case 'killEffect': {
            const icon = item.icon || '⭐';
            return `<div class="${cls}" style="background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:${isLarge ? '36px' : '22px'};">${icon}</div>`;
        }
        case 'trail': {
            const color = item.color || 'rgba(60,55,50,0.08)';
            return `<div class="${cls} trail-preview" style="background:${color};"></div>`;
        }
        default:
            return `<div class="${cls}" style="background:#333;"></div>`;
    }
}

function getItemStatsText(type, item) {
    switch (type) {
        case 'weapon': {
            const dps = (item.damage * (item.bullets || 1) / (item.fireRate || 1)).toFixed(1);
            return `⚔ DMG ${item.damage} \u00d7${item.bullets || 1}  |  \u{1F525} ${dps}/s  |  \u{1F4E6} ${item.magazineSize || '\u221E'} rds  |  \u23F1 ${item.reloadTime || 0}s reload`;
        }
        case 'skin':
            return `Pattern: ${item.bodyPattern || 'none'}  ${item.glowColor ? '|  \u2728 Glow' : ''}  ${item.visorColor ? '|  \u{1F441} Visor' : ''}`;
        case 'gadget':
            return `\u23F1 Cooldown: ${item.cooldown || 0}s  |  \u26A1 Duration: ${item.duration || 0}s`;
        case 'trail':
            return item.glowColor ? '\u2728 Glowing trail effect' : 'Standard tank tracks';
        case 'killEffect':
            return `Effect: ${item.effect || 'none'}`;
        default:
            return '';
    }
}

window.saveLoadout = function() {
    log('info', 'UI', 'Loadout saved');
};

window.closeLoadout = function() {
    log('info', 'UI', 'Loadout closed');
};

window.selectLoadoutItem = function(type, id) {
    const actualId = id === '' ? null : id;
    const detailPanel = document.getElementById('loadoutDetailPanel');
    const equipBtn = document.getElementById('loadoutEquipBtn');
    if (!detailPanel || !equipBtn) return;

    let item = null;
    const P = getPlayerData();
    switch (type) {
        case 'weapon': { const owned = getOwnedWeapons(); item = WEAPONS.find(w => w.id === actualId && owned.includes(w.id)); break; }
        case 'skin': { const owned = getOwnedSkins(); item = SKINS.find(s => s.id === actualId && owned.includes(s.id)); break; }
        case 'title': { const titles = P.titles || []; item = actualId ? { id: actualId, name: actualId, desc: '', icon: '\u{1F3C6}' } : { id: null, name: 'None', desc: 'No title displayed', icon: '\u{1F3C6}' }; break; }
        case 'gadget': { item = actualId ? GADGETS.find(g => g.id === actualId && isItemOwned('gadget', g.id)) : { id: null, name: 'None', desc: 'No gadget equipped', icon: '\u2014' }; break; }
        case 'trail': { item = TRAILS.find(t => t.id === actualId && isItemOwned('trail', t.id)); break; }
        case 'killEffect': { item = KILL_EFFECTS.find(k => k.id === actualId && isItemOwned('killEffect', k.id)); break; }
    }
    if (!item) return;

    _pendingType = type;
    _pendingId = actualId;

    detailPanel.style.display = 'flex';
    document.getElementById('loadoutDetailPreview').innerHTML = getItemPreviewHTML(type, item, 'detail');
    document.getElementById('loadoutDetailName').textContent = item.name || 'Unknown';
    document.getElementById('loadoutDetailDesc').textContent = item.desc || '';
    document.getElementById('loadoutDetailStats').textContent = getItemStatsText(type, item);

    const loadout = P.loadout || {};
    const currentEquipped = type === 'weapon' ? (loadout.weapon || 'standard') :
                            type === 'skin' ? (loadout.skin || 'classic') :
                            type === 'title' ? (loadout.title || null) :
                            type === 'gadget' ? (loadout.gadget || null) :
                            type === 'trail' ? (loadout.trail || 'default') :
                            type === 'killEffect' ? (loadout.killEffect || 'default') : null;
    const already = actualId === currentEquipped;
    equipBtn.textContent = already ? 'ALREADY EQUIPPED' : 'EQUIP';
    equipBtn.disabled = already;
    equipBtn.style.opacity = already ? '0.5' : '1';
    equipBtn.style.cursor = already ? 'not-allowed' : 'pointer';
};

window.confirmEquipLoadoutItem = function() {
    if (!_pendingType || _pendingId === undefined) return;
    const type = _pendingType;
    const id = _pendingId;

    if (type === 'weapon') {
        if (id) equipWeapon(id);
    } else if (type === 'skin') {
        if (id) equipSkin(id);
    } else if (type === 'title') {
        equipTitle(id || '');
    } else {
        equipItem(type, id);
    }
    _pendingType = null;
    _pendingId = null;
    const detailPanel = document.getElementById('loadoutDetailPanel');
    if (detailPanel) detailPanel.style.display = 'none';
    renderLoadoutItems(type);
};

// Keep old equipLoadoutItem for backward compatibility with any inline handlers
window.equipLoadoutItem = function(type, id) {
    _pendingType = type;
    _pendingId = id === '' ? null : id;
    confirmEquipLoadoutItem();
};

window.saveLoadout = function() {
    closeSettings();
    log('info', 'UI', 'Loadout saved');
};

window.closeLoadout = function() {
    closeSettings();
    log('info', 'UI', 'Loadout closed');
};

// ===================== PURCHASE CELEBRATION =====================
let _celebrationAnimId = null;
let _celebrationParticles = [];

window.showCelebration = function(skinId) {
    import('./config.js').then(m => {
        const skin = m.SKINS.find(s => s.id === skinId) || m.SKINS[0];
        const overlay = document.getElementById('celebrationOverlay');
        if (!overlay) return;
        overlay.classList.add('open');

        // Set text
        document.getElementById('celebrationTitle').style.color = skin.color;
        document.getElementById('celebrationTitle').textContent = 'PURCHASED!';
        document.getElementById('celebrationName').textContent = skin.name;
        document.getElementById('celebrationName').style.color = skin.color;

        // Draw tank preview
        const tankCanvas = document.getElementById('celebrationTankBox');
        if (tankCanvas) drawSkinPreview(tankCanvas, skin);

        // Start confetti
        const canvas = document.getElementById('celebrationCanvas');
        if (canvas) startCelebrationConfetti(canvas, skin.color);
    });
};

window.closeCelebration = function() {
    const overlay = document.getElementById('celebrationOverlay');
    if (overlay) overlay.classList.remove('open');
    if (_celebrationAnimId) {
        cancelAnimationFrame(_celebrationAnimId);
        _celebrationAnimId = null;
    }
    _celebrationParticles = [];
};

function startCelebrationConfetti(canvas, color) {
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    _celebrationParticles = [];

    // Parse color to RGB for variation
    const r = parseInt(color.slice(1,3), 16);
    const g = parseInt(color.slice(3,5), 16);
    const b = parseInt(color.slice(5,7), 16);

    for (let i = 0; i < 80; i++) {
        _celebrationParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 3 + 1,
            size: Math.random() * 6 + 3,
            color: `hsl(${Math.random() * 60 + 30}, 80%, ${50 + Math.random() * 30}%)`,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 6,
            opacity: 0.8 + Math.random() * 0.2,
        });
    }
    // Gold particles
    for (let i = 0; i < 40; i++) {
        _celebrationParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * 2 + 0.5,
            size: Math.random() * 3 + 1.5,
            color: `hsl(${42 + Math.random() * 20}, 100%, ${50 + Math.random() * 30}%)`,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 4,
            opacity: 0.6 + Math.random() * 0.4,
        });
    }

    if (_celebrationAnimId) cancelAnimationFrame(_celebrationAnimId);
    animateCelebrationConfetti(ctx, canvas);
}

function animateCelebrationConfetti(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    _celebrationParticles.forEach(p => {
        p.x += p.vx;
        p.vy += 0.05;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        if (p.y < canvas.height + 20) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.globalAlpha = p.opacity * Math.max(0, 1 - (p.y / (canvas.height + 50)));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
    });
    if (alive) {
        _celebrationAnimId = requestAnimationFrame(() => animateCelebrationConfetti(ctx, canvas));
    }
}

// ===================== HOME MENU TOGGLES =====================
// Sidebar and more-menu toggles are in index.html inline script
