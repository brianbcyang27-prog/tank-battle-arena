import { G } from './state.js';
import { log } from './log.js';
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT, GameState } from './config.js';
import { loadSettings, showOverlay } from './ui.js';
import { startGame, startGameFromMenu, levelComplete, nextLevel, gameOver, multiplayerGameOver } from './game.js';
import { generateLevel } from './levels.js';
import { db, ref, set, update, remove } from './firebase.js';
import { recordHit, recordKill, recordDeath, recordDistance, recordDamageTaken } from './stats.js';
import './multiplayer.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
G.ctx = ctx;

loadSettings();

// Start listening for friend invitations globally (shows notification toast)
import('./friends.js').then(m => {
    setTimeout(() => m.listenInvitations(invites => {
        import('./ui.js').then(ui => {
            if (invites && invites.length > 0 && !G.lobbyId) {
                const inv = invites[invites.length - 1];
                ui.showNotification(
                    inv.fromName + ' invited you to a ' + (inv.mode || 'multiplayer') + ' room! Code: ' + (inv.roomCode || '—'),
                    [
                        { label: 'JOIN', cls: 'accept', onClick: () => {
                            window.joinByCode && window.joinByCode(inv.roomCode);
                            m.clearInvitation(inv.from);
                            ui.hideNotification();
                        }},
                        { label: 'DECLINE', cls: 'decline', onClick: () => {
                            m.clearInvitation(inv.from);
                            ui.hideNotification();
                        }}
                    ]
                );
            }
        });
    }), 2000); // slight delay to let auth finish
});

let lastTime = performance.now();

function gameLoop(ct) {
    const dt = Math.min((ct - lastTime) / 1000, 0.05);
    lastTime = ct;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (let w of G.walls) w.draw();

    if (G.gameState === GameState.PLAYING) {
        G.levelTime = (ct - G.levelStartTime) / 1000;

        if (G.player && G.player.alive) {
            G.player.update(dt, ct);
            // Track distance traveled
            const speed = G.player.vel.length();
            if (speed > 0) { recordDistance(speed * dt); if (G.aiTracker) G.aiTracker.recordDistance(speed * dt); }
            if (G.aiTracker) G.aiTracker.tick(dt);
        }

        // Sync newly fired player bullets to Firebase
        if (G.isMultiplayerGame && G.lobbyId && G.currentUser) {
            for (let b of G.bullets) {
                if (b._isPlayerBullet && !b._synced && b.alive) {
                    const bid = Date.now() + '-' + Math.floor(Math.random() * 1e9) + '-' + ++G._bulletSeq;
                    set(ref(db, 'lobbies/' + G.lobbyId + '/bullets/' + bid), {
                        x: b.pos.x, y: b.pos.y, vx: b.vel.x, vy: b.vel.y,
                        ownerUid: G.currentUser.uid, alive: true
                    });
                    b.fbId = bid;
                    b._synced = true;
                }
            }
        }

        // Sync player position to Firebase
        if (G.isMultiplayerGame && G.lobbyId && G.currentUser && G.player && G.player.alive) {
            if (ct - G.player.lastSync > 50) {
                const playerDataRef = ref(db, 'lobbies/' + G.lobbyId + '/players/' + G.currentUser.uid);
                update(playerDataRef, {
                    x: G.player.pos.x, y: G.player.pos.y,
                    angle: G.player.turretAngle, health: G.player.health,
                    lastUpdate: Date.now()
                });
                G.player.lastSync = ct;
            }
        }

        for (let m of G.mines) m.update(dt);
        for (let m of G.mines) {
            if (m.armed && !m.exploded) {
                if (G.player && G.player.alive && m.checkCollision(G.player)) {
                    m.explode();
                    if (!G.player.alive) {
                        if (G.aiTracker) G.aiTracker.recordDeath();
                        if (G.isMultiplayerGame) multiplayerGameOver(false);
                        else if (G.gameMode === 'ai1v1') multiplayerGameOver(false);
                        else gameOver();
                    }
                }
                for (let e of G.enemies) {
                    if (e.alive && m.checkCollision(e)) { m.explode(); break; }
                }
                if (G.isMultiplayerGame) {
                    for (let uid in G.remoteTanks) {
                        const rt = G.remoteTanks[uid].tank;
                        if (rt.alive && m.checkCollision(rt)) { m.explode(); rt.takeDamage(10); if (!rt.alive) multiplayerGameOver(true); break; }
                    }
                }
            }
        }
        // Sync mine explosions to opponent in multiplayer
        if (G.isMultiplayerGame && G.lobbyId) {
            for (let m of G.mines) {
                if (m.exploded && !m._explosionSynced) {
                    m._explosionSynced = true;
                    const explosionId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
                    set(ref(db, 'lobbies/' + G.lobbyId + '/explosions/' + explosionId), {
                        x: m.pos.x, y: m.pos.y,
                        radius: m.explosionRadius
                    });
                }
            }
        }
        G.mines = G.mines.filter(m => !m.exploded);
        // Catch player death from mine auto-explosion or bullet-triggered explosion
        if (G.player && !G.player.alive && G.gameState === GameState.PLAYING) {
            recordDeath();
            if (G.aiTracker) G.aiTracker.recordDeath();
            if (G.isMultiplayerGame) multiplayerGameOver(false);
            else if (G.gameMode === 'ai1v1') multiplayerGameOver(false);
            else gameOver();
        }

        for (let e of G.enemies) { if (e.alive) e.update(dt, ct); }

        for (let b of G.bullets) {
            if (b.alive) {
                b.update(dt);
                // Bullet vs mine
                if (b.alive) {
                    for (let m of G.mines) {
                        if (!m.exploded && b.pos.distanceTo(m.pos) < b.radius + m.radius) {
                            b.alive = false;
                            m.explode();
                            break;
                        }
                    }
                }
                if (G.player && G.player.alive && b.checkCollision(G.player)) {
                    b.alive = false;
                    G.player.takeDamage();
                    recordDamageTaken();
                    log('info', 'DAMAGE', 'Player hit! HP: ' + G.player.health);
                    if (!G.player.alive) {
                        recordDeath();
                        if (G.aiTracker) G.aiTracker.recordDeath();
                        if (G.isMultiplayerGame) multiplayerGameOver(false);
                        else if (G.gameMode === 'ai1v1') multiplayerGameOver(false);
                        else gameOver();
                    }
                }
                for (let e of G.enemies) {
                    if (e.alive && b.checkCollision(e)) {
                        const isEnemyBullet = b.owner && b.owner !== G.player;
                        if (!G.settings.friendlyFire && isEnemyBullet) break;
                        b.alive = false;
                        e.takeDamage();
                        recordHit(); if (G.aiTracker) G.aiTracker.recordHit();
                        if (!e.alive) { recordKill(); if (G.aiTracker) G.aiTracker.recordKill(); G.score += 100 * G.level; log('info', 'KILL', 'Enemy killed! Score: ' + G.score); }
                        break;
                    }
                }
                if (G.isMultiplayerGame) {
                    for (let uid in G.remoteTanks) {
                        const rt = G.remoteTanks[uid].tank;
                        // b.checkCollision already prevents hitting yourself (owner check),
                        // so all passing bullets should damage the remote player's tank
                        if (rt.alive && b.checkCollision(rt)) {
                            b.alive = false;
                            rt.takeDamage();
                            recordHit();
                            log('info', 'MP', 'Remote player hit! HP: ' + rt.health);
                            if (!rt.alive) { recordKill(); multiplayerGameOver(true); }
                            break;
                        }
                    }
                }
            }
        }
        if (G.isMultiplayerGame && G.lobbyId) {
            for (let b of G.bullets) {
                if (!b.alive && b.fbId) {
                    remove(ref(db, 'lobbies/' + G.lobbyId + '/bullets/' + b.fbId));
                    b.fbId = null;
                }
            }
        }
        G.bullets = G.bullets.filter(b => b.alive);

        if (G.isMultiplayerGame) {
            for (let bid in G.remoteBullets) {
                const rb = G.remoteBullets[bid];
                rb.update(dt);
                if (rb.alive && rb.checkCollisionWithPlayer(G.player)) {
                    rb.alive = false;
                    G.player.takeDamage();
                    recordDamageTaken();
                    log('info', 'MP', 'Hit by remote bullet! HP: ' + G.player.health);
                    if (!G.player.alive) { recordDeath(); multiplayerGameOver(false); }
                }
            }
            for (let bid in G.remoteBullets) {
                if (!G.remoteBullets[bid].alive) {
                    remove(ref(db, 'lobbies/' + G.lobbyId + '/bullets/' + bid));
                    delete G.remoteBullets[bid];
                }
            }
        }

        if (!G.isMultiplayerGame && G.enemies.filter(e => e.alive).length === 0 && G.player.alive) {
            if (G.gameMode === 'ai1v1') {
                recordKill(); if (G.aiTracker) G.aiTracker.recordKill();
                multiplayerGameOver(true);
            } else {
                levelComplete();
            }
        }
    }

    for (let p of G.particles) { if (p.life > 0) { p.update(dt); p.draw(); } }
    G.particles = G.particles.filter(p => p.life > 0);

    for (let b of G.bullets) b.draw();
    for (let bid in G.remoteBullets) G.remoteBullets[bid].draw();
    for (let m of G.mines) m.draw();
    if (G.player && G.player.alive) G.player.draw();
    for (let uid in G.remoteTanks) { const rt = G.remoteTanks[uid].tank; if (rt.alive) rt.draw(); }
    for (let e of G.enemies) { if (e.alive) e.draw(); }

    if (G.gameState === GameState.PLAYING) {
        ctx.fillStyle = COLORS.text;
        ctx.font = '18px Orbitron';
        if (G.gameMode === 'ai1v1') {
            ctx.textAlign = 'left';
            ctx.fillText('ROUND ' + G.aiMatch.round + '/' + G.aiMatch.maxRounds, 20, 35);
            ctx.fillText('YOU ' + G.aiMatch.myScore + ' - ' + G.aiMatch.aiScore + ' AI', 20, 60);
            ctx.textAlign = 'right';
            ctx.fillText('TIME: ' + G.levelTime.toFixed(1) + 's', CANVAS_WIDTH - 20, 35);
            ctx.fillText('MINES: ' + (3 - G.mines.length) + '/3', CANVAS_WIDTH - 20, 60);
        } else {
            ctx.textAlign = 'left';
            ctx.fillText('LEVEL ' + G.level, 20, 35);
            ctx.fillText('SCORE: ' + G.score, 20, 60);
            ctx.textAlign = 'right';
            ctx.fillText('TIME: ' + G.levelTime.toFixed(1) + 's', CANVAS_WIDTH - 20, 35);
            ctx.fillText('MINES: ' + (3 - G.mines.length) + '/3', CANVAS_WIDTH - 20, 60);
        }
    }

    requestAnimationFrame(gameLoop);
}

let spaceConsumed = false;

document.addEventListener('keydown', (e) => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    G.keys[e.code] = true;
    if (e.key === ' ' && G.gameState === GameState.MENU) startGame();
    if (e.key === ' ' && G.gameState === GameState.LEVEL_COMPLETE && !spaceConsumed) {
        spaceConsumed = true;
        e.preventDefault();
        nextLevel();
    }
    if (e.key === 'Escape') {
        if (G.gameState === GameState.PLAYING) {
            G.gameState = GameState.PAUSED;
            showOverlay('pauseOverlay');
            log('info','PAUSE','Game paused');
        } else if (G.gameState === GameState.PAUSED) {
            resumeGame();
        } else if (G.gameState === GameState.MENU || G.gameState === GameState.LOADING || !G.gameState) {
            // Close overlay if one is open (detect via visible non-login overlays)
            const overlays = ['settingsOverlay','aboutOverlay','statsOverlay','friendsOverlay','leaderboardOverlay','aiDifficultyOverlay','profileOverlay'];
            const active = overlays.find(id => {
                const el = document.getElementById(id);
                return el && el.classList.contains('active');
            });
            if (active === 'settingsOverlay') closeSettings();
            else if (active === 'aboutOverlay') closeAbout();
            else if (active === 'statsOverlay') closeStats();
            else if (active === 'friendsOverlay') closeFriends();
            else if (active === 'leaderboardOverlay') closeLeaderboard();
            else if (active === 'aiDifficultyOverlay') closeAIDifficulty();
        }
    }
});

document.addEventListener('keyup', (e) => {
    G.keys[e.code] = false;
    if (e.key === ' ') spaceConsumed = false;
});

// Clear all keys on blur/visibility loss to prevent stuck keys (e.g., holding C then alt-tabbing)
window.addEventListener('blur', () => { G.keys = {}; });
document.addEventListener('visibilitychange', () => { if (document.hidden) G.keys = {}; });

canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    G.mouseX = (e.clientX - r.left) * (CANVAS_WIDTH / r.width);
    G.mouseY = (e.clientY - r.top) * (CANVAS_HEIGHT / r.height);
});

canvas.addEventListener('mousedown', (e) => { if (e.button === 0) G.mouseDown = true; });
canvas.addEventListener('mouseup', (e) => { if (e.button === 0) G.mouseDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.resumeGame = function(){
    if (G.gameState !== GameState.PAUSED) return;
    const prev = G._pausedPrevState || GameState.PLAYING;
    G.gameState = prev;
    showOverlay(null);
    log('info','PAUSE','Game resumed');
};

window.leaveGame = function(){
    log('info','PAUSE','Leaving game');
    // Clean up multiplayer listeners if active
    import('./multiplayer.js').then(m => m.cleanupMultiplayer()).catch(() => {});
    G.gameState = GameState.MENU;
    document.getElementById('loadingScreen').style.display = 'none';
    showOverlay('loginOverlay');
    document.getElementById('loggedInPanel').style.display = 'flex';
};

// ==================== LEADERBOARD DEDUP ====================
function deduplicateLeaderboard() {
    try {
        const lb = JSON.parse(localStorage.getItem('tankBattleLeaderboard') || '[]');
        const best = new Map();
        for (const entry of lb) {
            const name = entry.name || 'Anonymous';
            if (!best.has(name) || entry.score > best.get(name).score) {
                best.set(name, entry);
            }
        }
        const deduped = Array.from(best.values()).sort((a, b) => b.score - a.score);
        localStorage.setItem('tankBattleLeaderboard', JSON.stringify(deduped));
        if (deduped.length !== lb.length) {
            log('info','LB','Deduplicated leaderboard: ' + lb.length + ' → ' + deduped.length + ' entries');
        }
    } catch(e) {}
}
deduplicateLeaderboard();

// ==================== WELCOME ANIMATION ====================
function startWelcomeParticles(canvas) {
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    for (let i = 0; i < 60; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.6,
            vy: -0.3 - Math.random() * 0.8,
            size: 1 + Math.random() * 2.5,
            alpha: 0.2 + Math.random() * 0.5,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 2
        });
    }

    const startTime = performance.now();
    const duration = 6000;

    function frame() {
        const elapsed = performance.now() - startTime;
        if (elapsed > duration) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const fadeOut = Math.max(0, Math.min(1, (duration - elapsed) / 400));

        for (const p of particles) {
            p.x += p.vx + Math.sin(elapsed * 0.001 + p.x * 0.01) * 0.3;
            p.y += p.vy;
            p.rotation += p.rotSpeed;

            if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.globalAlpha = p.alpha * fadeOut * (0.6 + 0.4 * Math.sin(elapsed * 0.002 + p.x));
            ctx.fillStyle = p.x > canvas.width / 2 ? '#e94560' : '#f1c40f';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 6;

            const s = p.size;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const angle = (i * Math.PI / 2) - Math.PI / 4;
                const cx = Math.cos(angle) * s;
                const cy = Math.sin(angle) * s;
                const ix = Math.cos(angle + Math.PI / 4) * s * 0.3;
                const iy = Math.sin(angle + Math.PI / 4) * s * 0.3;
                if (i === 0) ctx.moveTo(cx, cy);
                else ctx.lineTo(cx, cy);
                ctx.lineTo(ix, iy);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// ==================== WELCOME LOADING SEQUENCE ====================
const WELCOME_STATUSES = [
    { maxPct: 15, label: 'INITIALIZING SYSTEMS...' },
    { maxPct: 30, label: 'CONNECTING TO SERVER...' },
    { maxPct: 50, label: 'LOADING ASSETS...' },
    { maxPct: 68, label: 'CALIBRATING CONTROLS...' },
    { maxPct: 82, label: 'PREPARING ARENA...' },
    { maxPct: 95, label: 'OPTIMIZING PERFORMANCE...' },
    { maxPct: 100, label: 'READY!' }
];

function startWelcomeSequence() {
    const bar = document.getElementById('welcomeBar');
    const pctEl = document.getElementById('welcomePercent');
    const statusEl = document.getElementById('welcomeStatus');
    if (!bar || !pctEl || !statusEl) return;

    const duration = 5500;
    const startTime = performance.now();
    let currentStatusIdx = 0;

    function tick() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - (1 - progress) * (1 - progress) * (1 - progress);
        const pct = Math.round(eased * 100);

        pctEl.textContent = pct + '%';
        bar.style.width = pct + '%';

        while (currentStatusIdx < WELCOME_STATUSES.length - 1 && pct >= WELCOME_STATUSES[currentStatusIdx].maxPct) {
            currentStatusIdx++;
        }
        statusEl.textContent = WELCOME_STATUSES[currentStatusIdx].label;

        if (progress < 1) {
            requestAnimationFrame(tick);
        } else {
            statusEl.textContent = 'READY!';
            pctEl.style.color = '#27ae60';
            setTimeout(() => {
                const wo = document.getElementById('welcomeOverlay');
                wo.style.transition = 'opacity 0.6s ease';
                wo.style.opacity = '0';
                setTimeout(() => {
                    wo.style.display = 'none';
                    wo.classList.remove('active');
                    showOverlay('loginOverlay');
                }, 600);
            }, 400);
        }
    }
    requestAnimationFrame(tick);
}

// Start initialization: welcome animation → then show login/home
document.getElementById('loadingScreen').style.display = 'none';

const welcomeCanvas = document.getElementById('welcomeCanvas');
if (welcomeCanvas) startWelcomeParticles(welcomeCanvas);

// Hide initial flash: login overlay starts inactive, welcome shows
document.getElementById('welcomeOverlay').style.display = 'flex';
document.getElementById('welcomeOverlay').classList.add('active');
startWelcomeSequence();

requestAnimationFrame(gameLoop);
log('info', 'INIT', 'Game engine initialized and running');
