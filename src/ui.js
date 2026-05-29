import { G } from './state.js';
import { log } from './log.js';

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

function applySettingsToUI() {
    document.getElementById('settingFriendlyFire').checked = G.settings.friendlyFire;
    document.getElementById('settingShowFPS').checked = G.settings.showFPS;
    document.getElementById('settingAutoReady').checked = G.settings.autoReady;
    document.getElementById('settingVolume').value = G.settings.volume;
}

export function saveSettings() {
    G.settings.friendlyFire = document.getElementById('settingFriendlyFire').checked;
    G.settings.showFPS = document.getElementById('settingShowFPS').checked;
    G.settings.autoReady = document.getElementById('settingAutoReady').checked;
    G.settings.volume = parseInt(document.getElementById('settingVolume').value);
    localStorage.setItem('tankBattleSettings', JSON.stringify(G.settings));
    log('info','SETTINGS','Settings saved: '+JSON.stringify(G.settings));
}

window.showSettings = function() {
    applySettingsToUI();
    showOverlay('settingsOverlay');
    log('info','SETTINGS','Opening settings panel');
};

window.closeSettings = function() {
    saveSettings();
    showOverlay('loginOverlay');
    log('info','SETTINGS','Closing settings panel');
};

// ==================== UI HELPERS ====================
export function showOverlay(id){
    document.querySelectorAll('.overlay').forEach(o=>{ o.style.display='none'; o.classList.remove('active'); });
    if(id){ document.getElementById(id).style.display='flex'; document.getElementById(id).classList.add('active'); log('info','UI','Showing overlay: '+id); }
}

export function updateUI(){
    document.getElementById('levelCompleteScore').textContent='SCORE: '+G.score;
    document.getElementById('levelCompleteTime').textContent='TIME: '+G.levelTime.toFixed(1)+'s';
    document.getElementById('finalScore').textContent='FINAL SCORE: '+G.score;
    document.getElementById('finalLevel').textContent='REACHED LEVEL '+G.level;
}

window.setMode = function(m,btn){
    G.gameMode=m;
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    const roomSection=document.getElementById('roomCodeSection');
    if(m==='single'){
        roomSection.style.display='none';
    } else {
        roomSection.style.display='flex';
    }
    log('info','MODE','Game mode set to: '+m);
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
