import { G } from './state.js';
import { log } from './log.js';
import { GameState } from './config.js';
import { getCampaignLevel, getGems, getCoins, getRank, getRankProgress } from './progression.js';

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
}

export function saveSettings() {
    G.settings.friendlyFire = document.getElementById('settingFriendlyFire').checked;
    G.settings.showFPS = document.getElementById('settingShowFPS').checked;
    G.settings.autoReady = document.getElementById('settingAutoReady').checked;
    G.settings.volume = parseInt(document.getElementById('settingVolume').value);
    const volLabel = document.getElementById('volumeValue');
    if (volLabel) volLabel.textContent = G.settings.volume;
    localStorage.setItem('tankBattleSettings', JSON.stringify(G.settings));
    // Sync to Firebase for cross-session persistence
    if (G.currentUser) {
        import('/src/firebase.js').then(({ ref, update, db }) => {
            update(ref(db, 'users/' + G.currentUser.uid + '/settings'), G.settings)
                .catch(e => log('warn','SETTINGS','Firebase save failed: '+e.message));
        });
    }
    log('info','SETTINGS','Settings saved: '+JSON.stringify(G.settings));
}

window.showSettings = function() {
    applySettingsToUI();
    showOverlay('settingsOverlay');
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
const HOME_OVERLAYS = ['loginOverlay','missionsOverlay','shopOverlay','statsOverlay','leaderboardOverlay','friendsOverlay','aboutOverlay','upgradeOverlay','tutorialOverlay'];

export function showOverlay(id){
    document.querySelectorAll('.overlay').forEach(o=>{
        o.style.display='none';
        o.classList.remove('active');
        o.classList.remove('overlay-home');
    });
    if(id){
        const el = document.getElementById(id);
        el.style.display='flex';
        el.classList.add('active');
        // Home overlays fill the full viewport
        if (HOME_OVERLAYS.includes(id)) {
            // Only fullscreen loginOverlay when loggedInPanel is showing
            if (id === 'loginOverlay') {
                const panel = document.getElementById('loggedInPanel');
                if (panel && panel.style.display !== 'none') el.classList.add('overlay-home');
            } else {
                el.classList.add('overlay-home');
            }
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

window.setMode = function(m,btn){
    G.gameMode=m;
    document.querySelectorAll('.mode-tab').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    log('info','MODE','Game mode set to: '+m);
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

window.startCampaign = function(){
    G.gameMode='campaign';
    import('./game.js').then(m => m.startGameFromMenu());
};

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
    import('/src/firebase.js').then(({ ref, push, db, serverTimestamp }) => {
        const leaderboardRef=ref(db, 'leaderboard');
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
    import('/src/firebase.js').then(({ ref, query, orderByChild, limitToLast, get, db }) => {
        const leaderboardRef=ref(db, 'leaderboard');
        get(query(leaderboardRef, orderByChild('score'), limitToLast(10))).then(snapshot=>{
            const raw = snapshot.val();
            const entries = raw ? Object.values(raw) : [];
            entries.sort((a, b) => (b.score || 0) - (a.score || 0));
            displayLeaderboard(entries);
        }).catch(()=>{
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

function _lbRender() {
    const listEl = document.getElementById('lbList');
    const countEl = document.getElementById('lbCount');
    const searchInput = document.getElementById('lbSearch');
    if (!listEl) return;
    const query = (searchInput && searchInput.value || '').toLowerCase().trim();
    const filter = _lbFilter;
    let entries = _lbCache || [];

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
    let html = '<ol style="text-align:left;padding-left:20px;margin:0;">';
    for (let i = 0; i < entries.length; i++) {
        const n = entries[i].name || 'Anonymous';
        const s = entries[i].score || 0;
        const lvl = entries[i].level || 1;
        const rank = i + 1;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        html += '<li style="color:#f39c12;margin-bottom:4px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:6px;">';
        if (medal) html += '<span style="font-size:14px;width:20px;text-align:center;">' + medal + '</span>';
        else html += '<span style="width:20px;text-align:center;color:#666;font-size:10px;">' + rank + '.</span>';
        html += '<span style="flex:1;color:#eaeaea;font-size:11px;">' + n.split('@')[0] + '</span>';
        html += '<span style="color:#27ae60;font-weight:700;font-size:11px;">' + s.toLocaleString() + '</span>';
        html += '<span style="color:#666;font-size:9px;min-width:30px;text-align:right;">Lv.' + lvl + '</span>';
        html += '</li>';
    }
    html += '</ol>';
    listEl.innerHTML = html;
    if (countEl) countEl.textContent = 'Showing ' + entries.length + '/' + (_lbCache ? _lbCache.length : 0) + ' entries';
}

function _mergeLocal() {
    try {
        const local = JSON.parse(localStorage.getItem('tankBattleLeaderboard') || '[]');
        const myName = (G.currentUser?.displayName || G.currentUser?.email?.split('@')[0] || '').toLowerCase();
        if (!myName || !local.length || !_lbCache) return;
        const localBest = local.find(e => (e.name || '').toLowerCase() === myName);
        if (!localBest || !localBest.score) return;
        const fbMatch = _lbCache.find(e => (e.name || '').toLowerCase() === myName);
        if (fbMatch) {
            if ((localBest.score || 0) > (fbMatch.score || 0)) {
                fbMatch.score = localBest.score;
                fbMatch.level = localBest.level || fbMatch.level;
            }
        } else {
            _lbCache.push({ name: myName, score: localBest.score, level: localBest.level || 1 });
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
    import('/src/firebase.js').then(({ ref, get, db }) => {
        get(ref(db, 'leaderboard')).then(snapshot => {
            const raw = snapshot.val();
            _lbCache = raw ? Object.values(raw) : [];
            // Deduplicate by name — keep highest score per player
            const seen = {};
            _lbCache = _lbCache.filter(e => {
                if (!e.score || e.score <= 0) return false;
                const key = (e.name || '').toLowerCase();
                if (!key) return true;
                if (seen[key]) {
                    if ((e.score || 0) > (seen[key].score || 0)) seen[key].score = e.score;
                    if ((e.level || 1) > (seen[key].level || 1)) seen[key].level = e.level;
                    return false;
                }
                seen[key] = e;
                return true;
            });
            _lbCache.sort((a, b) => (b.score || 0) - (a.score || 0));
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
import { SKINS, WEAPONS } from './config.js';

function updateCampaignDesc() {
    const el = document.getElementById('campaignDesc');
    if (el) {
        const level = getCampaignLevel();
        el.textContent = level > 1 ? 'Level ' + level + ' — Continue Progress' : 'Persistent — Continue Progress';
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
    if (rankEl) rankEl.textContent = rank.icon + ' ' + rank.title;
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
    const content = document.getElementById('shopContent');
    import('./progression.js').then(m => {
        if (tab === 'skins') {
            renderShopItems(content, SKINS, 'skin', m);
        } else {
            renderShopItems(content, WEAPONS, 'weapon', m);
        }
    });
};

const WEAPON_ICONS = {
    standard: '🔫',
    rapid: '⚡',
    cannon: '💥',
    shotgun: '💢',
    sniper: '🎯',
};

function renderShopItems(container, items, type, prog) {
    const ownedList = type === 'skin' ? prog.getOwnedSkins() : prog.getOwnedWeapons();
    const equippedId = type === 'skin' ? prog.getEquippedSkin() : prog.getEquippedWeapon();

    let html = '<div class="shop-grid">';
    for (const item of items) {
        const owned = ownedList.includes(item.id);
        const equipped = equippedId === item.id;
        const itemClass = equipped ? 'shop-item equipped' : owned ? 'shop-item owned' : 'shop-item';

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
            const fn = type === 'skin' ? 'equipShopSkin' : 'equipShopWeapon';
            btnHtml = `<button class="shop-item-btn equip" onclick="${fn}('${item.id}')">EQUIP</button>`;
        } else if (item.cost === 0) {
            const fn = type === 'skin' ? 'buyShopSkin' : 'buyShopWeapon';
            btnHtml = `<button class="shop-item-btn buy" onclick="${fn}('${item.id}')">GET FREE</button>`;
        } else {
            const fn = type === 'skin' ? 'buyShopSkin' : 'buyShopWeapon';
            btnHtml = `<button class="shop-item-btn buy" onclick="${fn}('${item.id}')">BUY</button>`;
        }

        const iconHtml = type === 'skin'
            ? `<div class="shop-item-icon">🎨</div>`
            : `<div class="shop-item-icon weapon-icon" onclick="showWeaponPreview3D('${item.id}')" style="cursor:pointer;" title="Click for 3D preview">${WEAPON_ICONS[item.id] || '🔫'}</div>`;

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
}

window.closeShop = function() {
    updateCurrencyDisplay();
    showOverlay('loginOverlay');
    log('info','UI','Closing shop');
};

// Shop helper functions (callable from onclick)
window.buyShopSkin = function(id) {
    import('./progression.js').then(m => { m.buySkin(id); window.showShop(); });
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

// ==================== UPGRADE SHOP ====================
const UPGRADE_CATEGORIES = [
    { id: 'speed',     icon: '⚡', name: 'Speed',       desc: 'Faster tank movement',      perLevel: '+12% speed' },
    { id: 'fuel',      icon: '⛽', name: 'Fuel Capacity', desc: 'Larger fuel tank',          perLevel: '+25 fuel' },
    { id: 'mineRadius', icon: '💥', name: 'Mine Radius',  desc: 'Bigger mine explosions',    perLevel: '+15px radius' },
];

window.showUpgrades = function() {
    import('./progression.js').then(m => {
        document.getElementById('upgradePoints').textContent = m.getUpgradePoints();
        renderUpgradeGrid(m);
    });
    showOverlay('upgradeOverlay');
    log('info','UI','Opening upgrade shop');
};

function renderUpgradeGrid(prog) {
    const grid = document.getElementById('upgradeGrid');
    if (!grid) return;
    let html = '';
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
