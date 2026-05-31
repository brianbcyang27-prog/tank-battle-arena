import { G } from './state.js';
import { log } from './log.js';
import { GameState } from './config.js';

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
    document.getElementById('settingBulletBounce').value = G.settings.bulletBounce || 0;
}

export function saveSettings() {
    G.settings.friendlyFire = document.getElementById('settingFriendlyFire').checked;
    G.settings.showFPS = document.getElementById('settingShowFPS').checked;
    G.settings.autoReady = document.getElementById('settingAutoReady').checked;
    G.settings.volume = parseInt(document.getElementById('settingVolume').value);
    G.settings.bulletBounce = parseInt(document.getElementById('settingBulletBounce').value);
    localStorage.setItem('tankBattleSettings', JSON.stringify(G.settings));
    // Sync to Firebase for cross-session persistence
    if (G.currentUser) {
        import('./firebase.js').then(({ ref, update, db }) => {
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
const HOME_OVERLAYS = ['loginOverlay','missionsOverlay','shopOverlay','statsOverlay','leaderboardOverlay','friendsOverlay','aboutOverlay'];

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
    log('info','MODE','VS AI mode — showing difficulty selector');
};

window.startAIGame = function(difficulty){
    G.aiDifficulty = difficulty;
    log('info','MODE','Starting VS AI game with difficulty: '+difficulty);
    import('./game.js').then(m => m.startGameFromMenu());
};

window.closeAIDifficulty = function() {
    showOverlay('loginOverlay');
};

window.startSolo = function(){
    G.gameMode='single';
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
    import('./firebase.js').then(({ ref, push, db, serverTimestamp }) => {
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
    import('./firebase.js').then(({ ref, query, orderByChild, limitToLast, get, db }) => {
        const leaderboardRef=ref(db, 'leaderboard');
        get(query(leaderboardRef, orderByChild('score'), limitToLast(10))).then(snapshot=>{
            const entries=[];
            snapshot.forEach(child=>entries.unshift(child.val()));
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

// ==================== HOME LEADERBOARD ====================
window.showLeaderboard = function() {
    const container = document.getElementById('lbHomeContent');
    if (!container) return;
    try {
        const lb = JSON.parse(localStorage.getItem('tankBattleLeaderboard') || '[]');
        if (lb.length === 0) {
            container.innerHTML = '<p style="color:#666;text-align:center;">No scores yet.<br>Play a game to get on the board!</p>';
        } else {
            let html = '<ol style="text-align:left;padding-left:20px;">';
            const displayCount = Math.min(lb.length, 20);
            for (let i = 0; i < displayCount; i++) {
                const n = lb[i].name || 'Anonymous';
                const s = lb[i].score || 0;
                const lvl = lb[i].level || 1;
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                html += '<li style="color:#f39c12;margin-bottom:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:8px;">';
                if (medal) html += '<span style="font-size:16px;">' + medal + '</span>';
                html += '<span style="flex:1;color:#eaeaea;">' + n.split('@')[0] + '</span>';
                html += '<span style="color:#27ae60;font-weight:700;">' + s.toLocaleString() + '</span>';
                html += '<span style="color:#666;font-size:10px;">Lv.' + lvl + '</span>';
                html += '</li>';
            }
            html += '</ol>';
            container.innerHTML = html;
        }
    } catch(e) {
        container.innerHTML = '<p style="color:#e74c3c;text-align:center;">Could not load leaderboard</p>';
    }
    showOverlay('leaderboardOverlay');
    log('info','LB','Home leaderboard opened');
};

window.closeLeaderboard = function() {
    showOverlay('loginOverlay');
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

export function updateCurrencyDisplay() {
    import('./progression.js').then(m => {
        const gemEl = document.getElementById('homeGems');
        const coinEl = document.getElementById('homeCoins');
        const rankEl = document.getElementById('homeRankBadge');
        const rankBar = document.getElementById('homeRankBar');
        if (gemEl) gemEl.textContent = '💎 ' + m.getGems();
        if (coinEl) coinEl.textContent = '🪙 ' + m.getCoins();
        if (rankEl) rankEl.textContent = m.getRank().icon;
        if (rankBar) rankBar.style.width = Math.round(m.getRankProgress() * 100) + '%';
    });
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

function renderShopItems(container, items, type, prog) {
    const ownedList = type === 'skin' ? prog.getOwnedSkins() : prog.getOwnedWeapons();
    const equippedId = type === 'skin' ? prog.getEquippedSkin() : prog.getEquippedWeapon();

    let html = '<div class="shop-grid">';
    for (const item of items) {
        const owned = ownedList.includes(item.id);
        const equipped = equippedId === item.id;
        const itemClass = equipped ? 'shop-item equipped' : owned ? 'shop-item owned' : 'shop-item';
        const icon = type === 'skin' ? '🎨' : '🔫';

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

        html += `
        <div class="${itemClass}">
            <div class="shop-item-icon">${icon}</div>
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
