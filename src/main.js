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
            if (speed > 0) recordDistance(speed * dt);
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
                        if (G.isMultiplayerGame) multiplayerGameOver(false);
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
                        if (G.isMultiplayerGame) multiplayerGameOver(false);
                        else gameOver();
                    }
                }
                for (let e of G.enemies) {
                    if (e.alive && b.checkCollision(e)) {
                        const isEnemyBullet = b.owner && b.owner !== G.player;
                        if (!G.settings.friendlyFire && isEnemyBullet) break;
                        b.alive = false;
                        e.takeDamage();
                        recordHit();
                        if (!e.alive) { recordKill(); G.score += 100 * G.level; log('info', 'KILL', 'Enemy killed! Score: ' + G.score); }
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
            levelComplete();
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
        ctx.textAlign = 'left';
        ctx.fillText('LEVEL ' + G.level, 20, 35);
        ctx.fillText('SCORE: ' + G.score, 20, 60);
        ctx.textAlign = 'right';
        ctx.fillText('TIME: ' + G.levelTime.toFixed(1) + 's', CANVAS_WIDTH - 20, 35);
        ctx.fillText('MINES: ' + (3 - G.mines.length) + '/3', CANVAS_WIDTH - 20, 60);
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

document.getElementById('loadingScreen').style.display = 'none';
if (!G.currentUser) showOverlay('loginOverlay');
requestAnimationFrame(gameLoop);
log('info', 'INIT', 'Game engine initialized and running');
