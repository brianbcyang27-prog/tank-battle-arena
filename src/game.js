import { CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE, COLORS, GameState } from './config.js';
import { G } from './state.js';
import { Vector2, Player, Tank } from './engine.js';
import { generateLevel } from './levels.js';
import { showOverlay, updateUI } from './ui.js';
import { log } from './log.js';
import { initStats, finalizeStats } from './stats.js';

// ==================== GAME FLOW ====================
export function startGame(){
    if (G.gameState === GameState.LOADING) return;
    G.gameState = GameState.LOADING;
    showOverlay(null);
    G.level=1; G.score=0; initStats();
    document.getElementById('loadingScreen').style.display='flex';
    document.getElementById('loadingTitle').textContent='GENERATING LEVEL...';
    setTimeout(()=>generateLevel(G.level),100);
    log('info','START','Game started');
}

export function startGameFromMenu(){
    if(!G.currentUser){ log('warn','START','Cannot start: no user'); return; }
    showOverlay(null);
    if(G.gameMode==='single'){
        log('info','START','Starting single player game');
        G.level=1; G.score=0; initStats();
        document.getElementById('loadingScreen').style.display='flex';
        document.getElementById('loadingTitle').textContent='GENERATING LEVEL...';
        setTimeout(()=>generateLevel(G.level),100);
    } else {
        log('info','START','Starting multiplayer: '+G.gameMode);
        import('./multiplayer.js').then(m => m.createOrJoinLobby());
    }
}
window.startGameFromMenu = startGameFromMenu;

// ==================== LEVEL COMPLETE ====================
export function levelComplete(){
    G.mouseDown = false;
    const tb=Math.max(0,Math.floor(1000-G.levelTime*10));
    G.score+=tb+500*G.level;
    G.gameState=GameState.LEVEL_COMPLETE;
    updateUI();
    showOverlay('levelCompleteOverlay');
    document.getElementById('nextLevelButton').onclick=nextLevel;
    log('info','LEVEL','Level complete! Score: '+G.score);
}

export function nextLevel(){
    if (G.gameState === GameState.LOADING) return;
    G.gameState = GameState.LOADING;
    G.mouseDown = false;
    showOverlay(null);
    G.level++;
    document.getElementById('loadingScreen').style.display='flex';
    document.getElementById('loadingTitle').textContent='GENERATING LEVEL '+G.level+'...';
    setTimeout(()=>generateLevel(G.level),100);
    log('info','LEVEL','Advancing to level '+G.level);
}

// ==================== GAME OVER ====================
const CONFETTI_COLORS = ['#e94560','#f1c40f','#3498db','#2ecc71','#9b59b6','#e67e22','#1abc9c','#ff6b6b'];

export function gameOver(){
    G.gameState=GameState.GAME_OVER;
    finalizeStats(false);
    updateUI();
    showOverlay('gameOverOverlay');
    showGameOverStats();
    document.getElementById('restartButton').onclick=startGame;
    const lb=JSON.parse(localStorage.getItem('tankBattleLeaderboard')||'[]');
    import('./ui.js').then(m => m.displayLeaderboard(lb));
    startGameOverAnimation(G.score, G.level);
    log('info','GAME','Game over. Final score: '+G.score+', Level: '+G.level);
}

function startGameOverAnimation(score, level) {
    const content = document.getElementById('goContent');
    const scoreEl = document.getElementById('finalScore');
    const levelEl = document.getElementById('finalLevel');
    const stars = document.querySelectorAll('.go-star');
    const restartBtn = document.getElementById('restartButton');
    const contentChildren = content ? Array.from(content.children) : [];

    if (scoreEl) scoreEl.textContent = '0';
    if (levelEl) { levelEl.textContent = 'REACHED LEVEL ' + level; levelEl.classList.remove('show'); }
    if (restartBtn) restartBtn.classList.remove('pulse');
    stars.forEach(s => s.classList.remove('go-star-filled'));
    if (content) content.style.opacity = '0';
    contentChildren.forEach(el => {
        el.classList.remove('show');
    });

    setTimeout(() => {
        if (content) {
            content.style.transition = 'opacity 0.6s ease';
            content.style.opacity = '1';
        }
    }, 80);

    const confettiInterval = setInterval(() => {
        spawnConfettiBurst(6);
    }, 200);
    setTimeout(() => clearInterval(confettiInterval), 3500);

    setTimeout(() => {
        animateScoreCounter(scoreEl, score, 1800);
    }, 500);

    setTimeout(() => {
        const starCount = Math.min(3, level <= 2 ? 1 : level <= 5 ? 2 : 3);
        stars.forEach((s, i) => {
            setTimeout(() => {
                if (i < starCount) {
                    s.classList.add('go-star-filled');
                    s.style.animation = 'none';
                    void s.offsetWidth;
                    s.style.animation = 'go-starPop 0.5s ease forwards';
                }
            }, i * 350 + 200);
        });
        if (scoreEl) scoreEl.classList.add('animate');
    }, 900);

    setTimeout(() => {
        if (levelEl) levelEl.classList.add('show');
    }, 2600);

    setTimeout(() => {
        const statBox = document.getElementById('gameOverStats');
        const lbBox = document.getElementById('leaderboard');
        if (statBox) statBox.classList.add('show');
        if (lbBox) lbBox.classList.add('show');
    }, 3000);

    setTimeout(() => {
        if (restartBtn) restartBtn.classList.add('pulse');
    }, 3800);
}

function spawnConfettiBurst(count) {
    const container = document.getElementById('confettiContainer');
    if (!container) return;
    const w = window.innerWidth;
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        el.style.cssText = [
            'left:' + (Math.random() * w) + 'px',
            'background:' + color,
            'width:' + (6 + Math.random() * 8) + 'px',
            'height:' + (4 + Math.random() * 6) + 'px',
            'animation-duration:' + (2 + Math.random() * 2) + 's',
            'animation-delay:' + (Math.random() * 0.5) + 's'
        ].join(';');
        container.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.remove(); }, 4500);
    }
}

function animateScoreCounter(el, target, duration) {
    if (!el) return;
    const start = performance.now();
    const initial = parseInt(el.textContent) || 0;

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - (1 - progress) * (1 - progress);
        const current = Math.round(initial + (target - initial) * eased);
        el.textContent = current.toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

export function multiplayerGameOver(isWinner){
    if (G.gameState !== GameState.PLAYING) return; // prevent overwriting an already-decided game
    G.gameState=GameState.GAME_OVER;
    finalizeStats(isWinner);
    const resultText=isWinner?'VICTORY!':'DEFEAT!';
    const resultColor=isWinner?'#27ae60':'#e74c3c';
    const resultOverlay=document.getElementById('gameOverOverlay');
    resultOverlay.innerHTML=`
        <h1 style="color:${resultColor};font-size:64px;margin:0 0 20px;text-shadow:0 0 30px ${resultColor};">${resultText}</h1>
        <p style="color:#eaeaea;font-size:20px;margin:0 0 30px;">${isWinner?'You destroyed all enemies!':'You were destroyed!'}</p>
        <div id="mpGameOverStats" style="margin:10px 0;width:80%;max-width:400px;background:rgba(0,0,0,0.3);border-radius:4px;padding:10px;display:none;">
            <h3 style="color:#f39c12;font-size:11px;margin-bottom:8px;letter-spacing:2px;">MATCH STATS</h3>
            <div id="mpGameOverStatsContent"></div>
        </div>
        <div style="display:flex;gap:15px;justify-content:center;">
            <button onclick="rematch()" style="padding:15px 40px;font-size:18px;cursor:pointer;background:#27ae60;border:none;border-radius:8px;color:white;">PLAY AGAIN</button>
            <button onclick="leaveLobby()" style="padding:15px 40px;font-size:18px;cursor:pointer;background:#3498db;border:none;border-radius:8px;color:white;">BACK TO MENU</button>
        </div>
    `;
    showOverlay('gameOverOverlay');
    showGameOverStats();
    if (isWinner) {
        const confettiInterval2 = setInterval(() => { spawnConfettiBurst(6); }, 200);
        setTimeout(() => clearInterval(confettiInterval2), 3500);
    }
    import('./firebase.js').then(({ ref, update, db }) => {
        const lobbyRef=ref(db, 'lobbies/'+G.lobbyId);
        const remoteUids = Object.keys(G.remoteTanks);
        const winnerUid = isWinner ? G.currentUser.uid : (remoteUids.length > 0 ? remoteUids[0] : null);
        update(lobbyRef, {
            status: 'gameOver',
            winner: winnerUid,
            gameResult: isWinner ? 'win' : 'lose'
        });
    });
    log('info','MP','Game over. Result: '+(isWinner?'WIN':'LOSE'));
}

// ==================== STATS DISPLAY ====================
function showGameOverStats() {
    import('./stats.js').then(m => {
        const s = m.getCurrentStats();
        if (!s) return;
        // Single-player uses the static #gameOverStats element
        const el1 = document.getElementById('gameOverStats');
        const c1 = document.getElementById('gameOverStatsContent');
        if (el1 && c1) {
            c1.innerHTML = buildCompactStats(s);
            el1.style.display = 'block';
        }
        // Multiplayer uses the dynamically created #mpGameOverStats element
        const el2 = document.getElementById('mpGameOverStats');
        const c2 = document.getElementById('mpGameOverStatsContent');
        if (el2 && c2) {
            c2.innerHTML = buildCompactStats(s);
            el2.style.display = 'block';
        }
    });
}

function buildCompactStats(s) {
    const rows = [
        ['Kills', s.kills, 'good'],
        ['Deaths', s.deaths, 'bad'],
        ['K/D', s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills > 0 ? s.kills.toFixed(2) : '0.00', ''],
        ['Accuracy', (s.accuracy || '0.0') + '%', s.accuracy > 50 ? 'good' : 'bad'],
        ['Play Time', s.playTime ? s.playTime.toFixed(1) + 's' : '—', '']
    ];
    return rows.map(([label, value, cls]) =>
        `<div class="stats-row"><span class="stats-label">${label}</span><span class="stats-value${cls ? ' ' + cls : ''}">${value}</span></div>`
    ).join('');
}
