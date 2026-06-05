import { GameState, ARCADE_LIVES, QL_PARAMS } from './config.js';
import { G } from './state.js';
import { generateLevel } from './levels.js';
import { showOverlay, updateUI, updateCurrencyDisplay } from './ui.js';
import { log } from './log.js';
import { initStats, finalizeStats } from './stats.js';
import { awardLevelComplete, awardGameOver, awardAiWin, awardAiRoundWin, getCampaignLevel, getStageAndLevel, completeLevelInCampaign, getStageAggregateStats } from './progression.js';
import { initAudio, playBackgroundMusic, stopMusic } from './audio.js';
import { SESSION } from './sessionConfig.js';

// ==================== GAME FLOW ====================
export function startGame(){
    if (G.gameState === GameState.LOADING) return;
    G.gameState = GameState.LOADING;
    if (G._traceCtx) G._traceCtx.clearRect(0, 0, G._traceCanvas.width, G._traceCanvas.height);
    showOverlay(null);
    G.level=1; G.score=0; initStats();
    G.stageColors = null;
    document.getElementById('loadingScreen').style.display='flex';
    document.getElementById('loadingTitle').textContent='GENERATING LEVEL...';
    setTimeout(()=>generateLevel(G.level),100);
    log('info','START','Game started');
}

export function startGameFromMenu(){
    showOverlay(null);
    initAudio();
    playBackgroundMusic();
    import('./ui.js').then(m => {
        m.showLoadout(() => doStartGame());
    });
}

function doStartGame() {
    if (G._traceCtx) G._traceCtx.clearRect(0, 0, G._traceCanvas.width, G._traceCanvas.height);
    if(G.gameMode==='single'){
        log('info','START','Starting single player game');
        G.level=1; G.score=0; initStats();
        document.getElementById('loadingScreen').style.display='flex';
        document.getElementById('loadingTitle').textContent='GENERATING LEVEL...';
        setTimeout(()=>generateLevel(G.level),100);
    } else if(G.gameMode==='campaign'){
        if (typeof G.currentStageIndex !== 'number' && typeof G.currentLevelInStage !== 'number') {
            const savedLevel = getCampaignLevel();
            G.level = savedLevel;
        }
        G.score = 0;
        initStats();
        log('info','START','Starting campaign from level '+G.level);
        document.getElementById('loadingScreen').style.display='flex';
        document.getElementById('loadingTitle').textContent='CAMPAIGN — LEVEL '+G.level;
        setTimeout(()=>generateLevel(G.level),100);
    } else if(G.gameMode==='ai1v1'){
        log('info','START','Starting 1v1 AI game, difficulty: '+G.aiDifficulty);
        G.level=1; G.score=0; initStats();
        G.aiMatch = { myScore: 0, aiScore: 0, round: 1, maxRounds: 9, state: 'playing' };
        document.getElementById('loadingScreen').style.display='flex';
        document.getElementById('loadingTitle').textContent='ROUND 1';
        import('./adaptive-ai.js').then(m => {
            G.aiTracker = new m.PlayerBehaviorTracker();
            setTimeout(() => generateLevel(1), 100);
        });
    } else if(G.gameMode==='arcade'){
        log('info','START','Starting ARCADE mode');
        G.level=1; G.score=0; initStats();
        import('./arcade-ai.js').then(m => {
            G.arcadeQL = new m.QLearningAgent(QL_PARAMS.lr, QL_PARAMS.gamma, QL_PARAMS.epsilon);
            G.arcadeLives = ARCADE_LIVES;
            G.arcadeMaxLives = ARCADE_LIVES;
            G.arcadeWave = 1;
            G.arcadeKills = 0;
            G.arcadeWaveComplete = false;
            G._arcadeWaveTimer = 0;
            document.getElementById('loadingScreen').style.display='flex';
            document.getElementById('loadingTitle').textContent='ARCADE MODE';
            document.getElementById('loadingSubtitle').textContent='WAVE 1';
            setTimeout(() => generateLevel(1), 100);
        });
    } else {
        if(!G.currentUser){
            log('warn','START','Multiplayer requires login');
            alert('Please sign in to play multiplayer.');
            showOverlay('loginOverlay');
            return;
        }
        log('info','START','Starting multiplayer: '+G.gameMode);
        import('./multiplayer.js').then(m => m.createOrJoinLobby());
    }
}
window.startGameFromMenu = startGameFromMenu;

// ==================== LEVEL COMPLETE ====================
export function levelComplete(){
    G.mouseDown = false;
    import('./audio.js').then(m => m.playVictory());
    const tb=Math.max(0,Math.floor(1000-G.levelTime*10));
    G.score+=tb+500*G.level;
    G.gameState=GameState.LEVEL_COMPLETE;
    updateUI();
    const rewards = awardLevelComplete(G.level);
    document.getElementById('levelCompleteScore').textContent='SCORE: '+G.score;
    document.getElementById('levelCompleteTime').innerHTML = 'TIME: ' + G.levelTime.toFixed(1) + 's &nbsp;|&nbsp; 🪙 +' + rewards.coins + ' &nbsp;⭐ +' + rewards.xp + 'xp';
    showOverlay('levelCompleteOverlay');
    document.getElementById('nextLevelButton').onclick=nextLevel;
    updateCurrencyDisplay();
    if (G.gameMode === 'campaign') {
        const { stageIdx, levelIdx } = getStageAndLevel(G.level);
        completeLevelInCampaign(stageIdx, levelIdx, G.score, G.levelTime);
        submitStageWorldRecord(stageIdx);
    }
    log('info','LEVEL','Level complete! Score: '+G.score);
}

export function nextLevel(){
    if (G.gameState === GameState.LOADING) return;
    G.gameState = GameState.LOADING;
    G.mouseDown = false;
    showOverlay(null);
    G.level++;
    if (G.gameMode === 'campaign' && G.level > 60) {
        G.stageColors = null;
        import('./ui.js').then(m => m.showCampaignMap());
        return;
    }
    document.getElementById('loadingScreen').style.display='flex';
    document.getElementById('loadingTitle').textContent='GENERATING LEVEL '+G.level+'...';
    setTimeout(()=>generateLevel(G.level),100);
    log('info','LEVEL','Advancing to level '+G.level);
}

// ==================== GAME OVER ====================
const CONFETTI_COLORS = ['#e94560','#f1c40f','#3498db','#2ecc71','#9b59b6','#e67e22','#1abc9c','#ff6b6b'];

// --- Personal Best ---
const PERSONAL_BEST_KEY = 'tankBattle_personalBest';

function getPersonalBest() {
    try { return parseInt(localStorage.getItem(PERSONAL_BEST_KEY)) || 0; }
    catch(e) { return 0; }
}

function savePersonalBest(score) {
    try { localStorage.setItem(PERSONAL_BEST_KEY, String(score)); }
    catch(e) {}
}

export function gameOver(){
    G.gameState=GameState.GAME_OVER;
    stopMusic();
    import('./audio.js').then(m => m.playDefeat());
    finalizeStats(false);
    if (G.currentUser) saveToLeaderboard(G.gameMode === 'single' ? 'solo' : G.gameMode);
    awardGameOver(G.score);
    updateCurrencyDisplay();

    const prevBest = getPersonalBest();
    const isNewRecord = G.score > 0 && G.score > prevBest;

    if (isNewRecord) {
        savePersonalBest(G.score);
        showNewRecordAnimation(G.score, prevBest, G.level);
    } else {
        showNormalGameOver();
    }
}

function saveToLeaderboard(mode) {
    try {
        const name = G.currentUser?.displayName || G.currentUser?.email?.split('@')[0] || 'Player';
        const fbScore = G.score;
        const fbLevel = G.level;
        import('./firebase.js').then(({ ref, get, set, db, serverTimestamp }) => {
            if (!G.currentUser) return;
            const userRef = ref(db, 'leaderboard/' + mode + '/' + G.currentUser.uid);
            get(userRef).then(snap => {
                const existing = snap.val();
                if (!existing || fbScore > (existing.score || 0)) {
                    set(userRef, {
                        name: G.currentUser.displayName || G.currentUser.email?.split('@')[0] || 'Anonymous',
                        score: fbScore,
                        level: fbLevel,
                        season: SESSION.id,
                        timestamp: serverTimestamp()
                    }).catch(() => {});
                }
            }).catch(() => {
                set(userRef, {
                    name: G.currentUser.displayName || G.currentUser.email?.split('@')[0] || 'Anonymous',
                    score: fbScore,
                    level: fbLevel,
                    season: SESSION.id,
                    timestamp: serverTimestamp()
                }).catch(() => {});
            });
        }).catch(() => {});
    } catch(e) {}
}

function submitStageWorldRecord(stageIdx) {
    import('./firebase.js').then(({ ref, get, set, db, serverTimestamp }) => {
        if (!G.currentUser) return;
        const stats = getStageAggregateStats(stageIdx);
        if (!stats || stats.bestScore === null) return;
        const wrRef = ref(db, 'campaignLeaderboard/stage_' + stageIdx + '/' + G.currentUser.uid);
        get(wrRef).then(snap => {
            const existing = snap.val();
            if (!existing || stats.bestScore > (existing.score || 0)) {
                set(wrRef, {
                    name: G.currentUser.displayName || G.currentUser.email?.split('@')[0] || 'Anonymous',
                    score: stats.bestScore,
                    time: stats.bestTime || 0,
                    completions: stats.completedCount,
                    timestamp: serverTimestamp()
                }).catch(() => {});
            }
        }).catch(() => {
            set(wrRef, {
                name: G.currentUser.displayName || G.currentUser.email?.split('@')[0] || 'Anonymous',
                score: stats.bestScore,
                time: stats.bestTime || 0,
                completions: stats.completedCount,
                timestamp: serverTimestamp()
            }).catch(() => {});
        });
    }).catch(() => {});
}

function showNormalGameOver() {
    updateUI();
    showOverlay('gameOverOverlay');
    showGameOverStats();

    const restartBtn = document.getElementById('restartButton');
    if (G.gameMode === 'campaign') {
        restartBtn.textContent = 'TRY AGAIN';
        restartBtn.onclick = startGameFromMenu;
    } else {
        restartBtn.textContent = 'PLAY AGAIN';
        restartBtn.onclick = startGame;
    }

    const submitBar = document.getElementById('scoreSubmitBar');
    const submitMsg = document.getElementById('scoreSubmittedMsg');
    if (submitBar) {
        submitBar.style.display = G.currentUser ? 'none' : 'block';
        document.getElementById('scoreNameInput').value = '';
    }
    if (submitMsg) submitMsg.style.display = 'none';

    const lb = JSON.parse(localStorage.getItem('tankBattleLeaderboard') || '[]');
    import('./ui.js').then(m => m.displayLeaderboard(lb));
    startGameOverAnimation(G.score, G.level);
    log('info','GAME','Game over. Final score: '+G.score+', Level: '+G.level);
}

window.submitScore = function() {
    const input = document.getElementById('scoreNameInput');
    const entered = input.value.trim();
    if (!entered) { input.focus(); return; }

    try {
        const mode = G.gameMode === 'single' ? 'solo' : G.gameMode || 'campaign';
        const lb = JSON.parse(localStorage.getItem('tankBattleLeaderboard') || '[]');
        // Find existing entry for same name + mode
        const prev = lb.findIndex(e => e.name === entered && (e.mode || 'campaign') === mode);
        if (prev >= 0) {
            if (G.score > lb[prev].score) {
                lb[prev] = { name: entered, score: G.score, level: G.level, mode, date: new Date().toISOString() };
            }
        } else {
            lb.push({ name: entered, score: G.score, level: G.level, mode, date: new Date().toISOString() });
        }
        lb.sort((a, b) => (b.mode || 'campaign') !== (a.mode || 'campaign')
            ? ((a.mode || 'campaign') > (b.mode || 'campaign') ? 1 : -1)
            : b.score - a.score);
        localStorage.setItem('tankBattleLeaderboard', JSON.stringify(lb));

        import('./ui.js').then(m => m.displayLeaderboard(lb));

        document.getElementById('scoreSubmitBar').style.display = 'none';
        document.getElementById('scoreSubmittedMsg').style.display = 'block';
        log('info','GAME','Score submitted: ' + entered + ' = ' + G.score);
    } catch(e) {
        log('warn','GAME','Failed to submit score: ' + e.message);
    }
};

function showNewRecordAnimation(score, prevBest) {
    const overlay = document.createElement('div');
    overlay.id = 'recordAnimation';
    overlay.style.cssText = [
        'position:fixed;top:0;left:0;width:100%;height:100%',
        'background:radial-gradient(ellipse at 50% 45%,#1f1400 0%,#0d0d1a 75%)',
        'display:flex;flex-direction:column;justify-content:center;align-items:center',
        'z-index:10000;overflow:hidden',
        'animation:rec-screenShake 0.5s ease-out'
    ].join(';');

    overlay.innerHTML = [
        '<canvas id="recParticles" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></canvas>',
        '<div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,rgba(241,196,15,0.04) 0%,transparent 60%);"></div>',

        '<div id="recTrophy" style="font-size:76px;margin-bottom:6px;opacity:0;transform:scale(0) rotate(-30deg);animation:rec-bounceIn 0.7s ease-out 0.15s forwards;">🏆</div>',

        '<div id="recLabel" style="color:#f39c12;font-size:15px;letter-spacing:5px;font-weight:400;opacity:0;transform:translateY(36px);animation:rec-slideUp 0.5s ease-out 0.5s forwards;">PERSONAL BEST</div>',

        '<div id="recTitle" style="font-size:56px;font-weight:900;color:#f1c40f;margin:6px 0 10px;opacity:0;transform:scale(0.2);filter:blur(12px);animation:rec-explodeIn 0.6s ease-out 0.7s forwards,rec-textGlow 2s ease-in-out 1.3s infinite;letter-spacing:3px;">NEW RECORD!</div>',

        '<div id="recScoreBox" style="background:rgba(0,0,0,0.45);border:1.5px solid rgba(241,196,15,0.25);border-radius:12px;padding:12px 36px;margin:4px 0;opacity:0;animation:rec-fadeIn 0.5s ease-out 1.1s forwards;">',
            '<div style="color:#888;font-size:10px;letter-spacing:3px;margin-bottom:4px;">SCORE</div>',
            '<div id="recScore" style="font-size:48px;font-weight:700;color:#fff;text-shadow:0 0 25px rgba(255,255,255,0.3);line-height:1.2;">'+score.toLocaleString()+'</div>',
        '</div>',

        '<div id="recPrev" style="color:#666;font-size:12px;letter-spacing:1px;opacity:0;animation:rec-fadeIn 0.6s ease-out 1.4s forwards;">',
            'Previous: <span style="color:#888;">'+prevBest.toLocaleString()+'</span>',
            ' → <span style="color:#27ae60;">+'+((score - prevBest) / (prevBest || 1) * 100).toFixed(0)+'%</span>',
        '</div>',

        '<div id="recSubtext" style="color:#555;font-size:10px;letter-spacing:3px;margin-top:20px;opacity:0;animation:rec-fadeIn 0.8s ease-out 2s forwards,rec-pulse 1.5s ease-in-out 2.8s infinite;">PREPARING RESULTS...</div>',

        '<div id="recGoldConfetti" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;"></div>'
    ].join('');
    document.body.appendChild(overlay);
    import('./audio.js').then(m => m.playCelebration());

    // ----- Golden confetti (immediate) -----
    const goldConfettiInterval = setInterval(() => {
        spawnGoldConfettiBurst(5);
    }, 180);
    let confettiCleared = false;
    function clearGoldConfetti() {
        if (confettiCleared) return;
        confettiCleared = true;
        clearInterval(goldConfettiInterval);
        const gc = document.getElementById('recGoldConfetti');
        if (gc) gc.innerHTML = '';
    }

    // ----- Canvas particle system -----
    const canvas = document.getElementById('recParticles');
    if (canvas) startRecordParticleCanvas(canvas, 4000);

    // ----- Animated score counter -----
    setTimeout(() => {
        animateRecordScore(score);
    }, 1400);

    // ----- Golden sparkle burst at 0.5s -----
    setTimeout(() => {
        spawnGoldConfettiBurst(25);
    }, 500);

    // ----- Everything fades out, then show normal game over -----
    const totalDuration = 4200;
    setTimeout(() => {
        clearGoldConfetti();
        overlay.style.transition = 'opacity 0.7s ease';
        overlay.style.opacity = '0';
        setTimeout(() => {
            if (overlay.parentNode) overlay.remove();
            showNormalGameOver();
        }, 700);
    }, totalDuration);

    log('info','RECORD','New personal best! Score: '+score+' (prev: '+prevBest+')');
}

function spawnGoldConfettiBurst(count) {
    const container = document.getElementById('recGoldConfetti');
    if (!container) return;
    const w = window.innerWidth;
    const goldColors = ['#f1c40f','#ffd700','#d4a017','#ffc107','#e6c200'];
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        const color = goldColors[Math.floor(Math.random() * goldColors.length)];
        el.style.cssText = [
            'left:' + (Math.random() * w) + 'px',
            'background:' + color,
            'box-shadow:0 0 6px ' + color,
            'width:' + (5 + Math.random() * 8) + 'px',
            'height:' + (3 + Math.random() * 6) + 'px',
            'animation-duration:' + (2.5 + Math.random() * 2) + 's',
            'animation-delay:' + (Math.random() * 0.8) + 's'
        ].join(';');
        container.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.remove(); }, 5000);
    }
}

function animateRecordScore(target) {
    const el = document.getElementById('recScore');
    if (!el) return;
    const start = performance.now();
    const duration = 2200;
    const initial = 0;

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - (1 - progress) * (1 - progress) * (1 - progress);
        const current = Math.round(initial + (target - initial) * eased);
        el.textContent = current.toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function startRecordParticleCanvas(canvas, duration) {
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const count = 70;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: canvas.height + Math.random() * 80,
            vx: (Math.random() - 0.5) * 1.2,
            vy: -(1.8 + Math.random() * 3),
            size: 1.5 + Math.random() * 3.5,
            alpha: 0.4 + Math.random() * 0.6,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 5,
            color: Math.random() > 0.4 ? '#f1c40f' : '#ffd700'
        });
    }

    const startTime = performance.now();

    function frame() {
        const elapsed = performance.now() - startTime;
        if (elapsed > duration) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Warm glow pulse
        const glowAlpha = 0.02 + 0.015 * Math.sin(elapsed * 0.003);
        const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height * 0.45, 0,
            canvas.width / 2, canvas.height * 0.45, canvas.width * 0.5
        );
        gradient.addColorStop(0, 'rgba(241,196,15,' + glowAlpha + ')');
        gradient.addColorStop(1, 'rgba(241,196,15,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const fadeOut = Math.max(0, Math.min(1, (duration - elapsed) / 600));

        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy *= 0.995;
            p.rotation += p.rotSpeed;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.globalAlpha = p.alpha * fadeOut;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;

            // 4-point sparkle
            const s = p.size;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const angle = (i * Math.PI / 2) - Math.PI / 4;
                const cx = Math.cos(angle) * s;
                const cy = Math.sin(angle) * s;
                const ix = Math.cos(angle + Math.PI / 4) * s * 0.35;
                const iy = Math.sin(angle + Math.PI / 4) * s * 0.35;
                if (i === 0) ctx.moveTo(cx, cy);
                else ctx.lineTo(cx, cy);
                ctx.lineTo(ix, iy);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            if (p.y < -20) {
                p.y = canvas.height + 10;
                p.x = Math.random() * canvas.width;
                p.vy = -(1.8 + Math.random() * 3);
                p.vx = (Math.random() - 0.5) * 1.2;
            }
        }

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
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

// ==================== ARCADE MODE GAME OVER ====================
export function arcadeGameOver() {
    if (G.gameState !== GameState.PLAYING) return;
    G.gameState = GameState.GAME_OVER;
    stopMusic();
    import('./audio.js').then(m => m.playDefeat());

    // Save Q-table and update meta stats
    if (G.arcadeQL) {
        G.arcadeQL.meta.totalGames++;
        G.arcadeQL.meta.totalKills += G.arcadeKills;
        G.arcadeQL.save();
    }

    finalizeStats(false);
    if (G.currentUser) saveToLeaderboard('arcade');

    // Show arcade game over overlay
    const overlay = document.getElementById('gameOverOverlay');
    const iq = G.arcadeQL ? G.arcadeQL.getIQ() : 0;
    overlay.innerHTML = `
        <h1 style="color:#e74c3c;font-size:52px;margin:0 0 5px;text-shadow:0 0 30px #e74c3c;">GAME OVER</h1>
        <p style="color:#f39c12;font-size:22px;margin:0 0 15px;">REACHED WAVE ${G.arcadeWave}</p>
        <p style="color:#eaeaea;font-size:16px;margin:0 0 5px;">SCORE: <span style="color:#27ae60;">${G.score}</span></p>
        <p style="color:#eaeaea;font-size:16px;margin:0 0 5px;">KILLS: <span style="color:#27ae60;">${G.arcadeKills}</span></p>
        <p style="color:#eaeaea;font-size:16px;margin:0 0 15px;">AI IQ: <span style="color:${iq > 20 ? '#e74c3c' : iq > 10 ? '#f39c12' : '#888'};">${iq}</span></p>
        <div id="mpGameOverStats" style="margin:6px 0;width:75%;max-width:360px;background:rgba(0,0,0,0.3);border-radius:4px;padding:8px;display:none;">
            <div id="mpGameOverStatsContent"></div>
        </div>
        <div style="display:flex;gap:15px;justify-content:center;">
            <button onclick="startArcade()" style="padding:15px 40px;font-size:18px;cursor:pointer;background:#27ae60;border:none;border-radius:8px;color:white;">PLAY AGAIN</button>
            <button onclick="leaveGame()" style="padding:15px 40px;font-size:18px;cursor:pointer;background:#3498db;border:none;border-radius:8px;color:white;">BACK TO MENU</button>
        </div>
    `;
    showOverlay('gameOverOverlay');
    showGameOverStats();

    const confettiInterval = setInterval(() => { spawnConfettiBurst(6); }, 200);
    setTimeout(() => clearInterval(confettiInterval), 2000);
    log('info', 'ARCADE', 'Arcade game over. Wave: ' + G.arcadeWave + ', Score: ' + G.score);
}

export function multiplayerGameOver(isWinner){
    if (G.gameState !== GameState.PLAYING) return;
    G.gameState=GameState.GAME_OVER;
    finalizeStats(isWinner);

    if (G.gameMode === 'ai1v1') {
        if (G.aiTracker) G.aiTracker.roundEnded(isWinner);
        if (isWinner) G.aiMatch.myScore++;
        else G.aiMatch.aiScore++;
        G.aiMatch.round++;
        log('info','SCORE','aiMatch updated: myScore='+G.aiMatch.myScore+' aiScore='+G.aiMatch.aiScore+' round='+G.aiMatch.round);
        const myWins = G.aiMatch.myScore;
        const aiWins = G.aiMatch.aiScore;
        const roundsPlayed = G.aiMatch.round - 1;
        const matchOver = myWins >= 5 || aiWins >= 5 || roundsPlayed >= G.aiMatch.maxRounds;
        const playerWonMatch = matchOver && myWins > aiWins;

        if (matchOver) {
            G.aiMatch.state = 'matchOver';
            if (playerWonMatch) {
                awardAiWin();
                updateCurrencyDisplay();
            }
            if (G.currentUser) saveToLeaderboard('vs_ai');
            const mt = playerWonMatch ? 'VICTORY!' : 'DEFEAT!';
            const mc = playerWonMatch ? '#27ae60' : '#e74c3c';
            const sub = playerWonMatch ? 'You won the match!' : 'You lost the match!';
            const overlay=document.getElementById('gameOverOverlay');
            overlay.innerHTML=`
                <h1 style="color:${mc};font-size:56px;margin:0 0 5px;text-shadow:0 0 30px ${mc};">${mt}</h1>
                <p style="color:#eaeaea;font-size:16px;margin:0 0 5px;">${sub}</p>
                <p style="color:#f39c12;font-size:22px;margin:0 0 20px;">YOU ${myWins} — ${aiWins} AI</p>
                <p style="color:#888;font-size:12px;margin:0 0 15px;">Best of ${G.aiMatch.maxRounds}</p>
                <div id="mpGameOverStats" style="margin:10px 0;width:80%;max-width:400px;background:rgba(0,0,0,0.3);border-radius:4px;padding:10px;display:none;">
                    <h3 style="color:#f39c12;font-size:11px;margin-bottom:8px;letter-spacing:2px;">MATCH STATS</h3>
                    <div id="mpGameOverStatsContent"></div>
                </div>
                <div style="display:flex;gap:15px;justify-content:center;">
                    <button onclick="startAIGame(${G.aiDifficulty})" style="padding:15px 40px;font-size:18px;cursor:pointer;background:#27ae60;border:none;border-radius:8px;color:white;">PLAY AGAIN</button>
                    <button onclick="leaveGame()" style="padding:15px 40px;font-size:18px;cursor:pointer;background:#3498db;border:none;border-radius:8px;color:white;">BACK TO MENU</button>
                </div>
            `;
            showOverlay('gameOverOverlay');
            showGameOverStats();
            if (playerWonMatch) {
                const ci = setInterval(() => { spawnConfettiBurst(6); }, 200);
                setTimeout(() => clearInterval(ci), 3500);
                import('./audio.js').then(m => m.playVictory());
            } else {
                import('./audio.js').then(m => m.playDefeat());
            }
            log('info','MATCH','Match over. Result: '+(playerWonMatch?'WIN':'LOSE')+' ('+myWins+'-'+aiWins+')');
        } else {
            G.aiMatch.state = 'roundOver';
            if (isWinner) {
                awardAiRoundWin();
                updateCurrencyDisplay();
                import('./audio.js').then(m => m.playRoundWin());
            } else {
                import('./audio.js').then(m => m.playRoundLose());
            }
            const rt = isWinner ? 'ROUND WON!' : 'ROUND LOST!';
            const rc = isWinner ? '#27ae60' : '#e74c3c';
            const diffLabels = {1:'EASY',2:'MEDIUM',3:'HARD'};
            const diffColors = {1:'#27ae60',2:'#f39c12',3:'#e74c3c'};
            const diffLabel = diffLabels[G.aiDifficulty] || 'MEDIUM';
            const diffColor = diffColors[G.aiDifficulty] || '#f39c12';
            const overlay=document.getElementById('gameOverOverlay');
            overlay.innerHTML=`
                <h1 style="color:${rc};font-size:52px;margin:0 0 5px;text-shadow:0 0 25px ${rc};">${rt}</h1>
                <p style="color:#888;font-size:14px;margin:0 0 2px;">Round ${roundsPlayed} of ${G.aiMatch.maxRounds}</p>
                <p style="color:${diffColor};font-size:16px;margin:0 0 10px;">${diffLabel} MODE</p>
                <p style="color:#f39c12;font-size:26px;margin:0 0 10px;">YOU ${myWins} — ${aiWins} AI</p>
                <div id="mpGameOverStats" style="margin:6px 0;width:75%;max-width:360px;background:rgba(0,0,0,0.3);border-radius:4px;padding:8px;display:none;">
                    <div id="mpGameOverStatsContent"></div>
                </div>
                <p id="autoNextCountdown" style="color:#888;font-size:14px;margin:12px 0 6px;letter-spacing:2px;">NEXT ROUND IN 3...</p>
                <button onclick="leaveGame()" style="padding:10px 30px;font-size:14px;cursor:pointer;background:#555;border:none;border-radius:6px;color:#ccc;">QUIT MATCH</button>
            `;
            showOverlay('gameOverOverlay');
            showGameOverStats();
            log('info','ROUND','Round '+roundsPlayed+' complete. Score: '+myWins+'-'+aiWins+'. Auto-next in 3s');

            let countdown = 3;
            const cdEl = document.getElementById('autoNextCountdown');
            const timer = setInterval(() => {
                countdown--;
                if (cdEl) cdEl.textContent = 'NEXT ROUND IN ' + countdown + '...';
                if (countdown <= 0) {
                    clearInterval(timer);
                    startNextRound();
                }
            }, 1000);
        }
        return;
    }

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
            <button onclick="${G.lobbyId ? 'rematch()' : 'startAIGame(' + G.aiDifficulty + ')'}" style="padding:15px 40px;font-size:18px;cursor:pointer;background:#27ae60;border:none;border-radius:8px;color:white;">PLAY AGAIN</button>
            <button onclick="leaveGame()" style="padding:15px 40px;font-size:18px;cursor:pointer;background:#3498db;border:none;border-radius:8px;color:white;">BACK TO MENU</button>
        </div>
    `;
    showOverlay('gameOverOverlay');
    showGameOverStats();
    if (isWinner) {
        const confettiInterval2 = setInterval(() => { spawnConfettiBurst(6); }, 200);
        setTimeout(() => clearInterval(confettiInterval2), 3500);
    }
    if (G.lobbyId) {
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
    }
    log('info','MP','Game over. Result: '+(isWinner?'WIN':'LOSE'));
}

export function startNextRound(){
    if (G.gameState !== GameState.GAME_OVER) { log('warn','ROUND','startNextRound blocked: state='+G.gameState); return; }
    if (G.aiMatch.state !== 'roundOver') { log('warn','ROUND','startNextRound blocked: aiMatch.state='+G.aiMatch.state); return; }
    G.aiMatch.state = 'playing';
    G.gameState = GameState.LOADING;
    G.mouseDown = false;
    G.keys = {};
    showOverlay(null);
    initStats();
    const ls = document.getElementById('loadingScreen');
    const lt = document.getElementById('loadingTitle');
    const lsub = document.getElementById('loadingSubtitle');
    ls.style.display='flex';
    lt.textContent='ROUND '+G.aiMatch.round;
    lsub.textContent='';
    setTimeout(() => {
        if (G.gameState === GameState.LOADING) {
            lsub.textContent='FIGHT!';
            lsub.style.animation='none';
            void lsub.offsetWidth;
            lsub.style.animation='pulse 0.8s ease 3';
        }
    }, 400);
    setTimeout(() => generateLevel(1), 700);
    log('info','ROUND','Starting round '+G.aiMatch.round);
}

window.nextRound = startNextRound;

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
