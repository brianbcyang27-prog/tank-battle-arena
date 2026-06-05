import { G } from './state.js';
import { log } from './log.js';
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE, GameState, WEAPONS } from './config.js';
import { loadSettings, showOverlay, showVersusCountdown } from './ui.js';
import { startGame, levelComplete, nextLevel, gameOver, multiplayerGameOver, arcadeGameOver } from './game.js';
import { Vector2, resolveWallCollision } from './engine.js';
import { db, ref, set, update, remove } from './firebase.js';
import { recordHit, recordKill, recordDeath, recordDistance, recordDamageTaken } from './stats.js';
import { trackKill, trackMineKill, trackSurvivalTime } from './progression.js';
import './multiplayer.js';
import { updateTutorial, renderTutorial, closeTutorial } from './tutorial.js';
import { initAudio } from './audio.js';
import { initErrorTracking, startWatchdog, frameTick } from './error-tracking.js';
import { recordFrame, drawGraph, setVisible as setPerfVisible } from './performance-monitor.js';
import { updateKillFeed, drawKillFeed, addKillEntry } from './kill-feed.js';
import { playExplosionAt, playImpactAt } from './spatial-audio.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
G.ctx = ctx;

G._traceCanvas = document.createElement('canvas');
G._traceCanvas.width = CANVAS_WIDTH;
G._traceCanvas.height = CANVAS_HEIGHT;
G._traceCtx = G._traceCanvas.getContext('2d');


// ==================== RESPONSIVE CANVAS SCALING ====================
function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    if (!container) return;
    const maxW = container.clientWidth;
    const maxH = container.clientHeight;
    const scale = Math.min(maxW / CANVAS_WIDTH, maxH / CANVAS_HEIGHT);
    canvas.style.width = Math.floor(CANVAS_WIDTH * scale) + 'px';
    canvas.style.height = Math.floor(CANVAS_HEIGHT * scale) + 'px';
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));
resizeCanvas();

loadSettings();
import('./ui.js').then(m => { if (m.refreshSpBadge) m.refreshSpBadge(); });

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
    const frameStart = performance.now();
    frameTick();

    const stageColors = G.stageColors;
    ctx.fillStyle = stageColors ? stageColors.bg : COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (G._traceCanvas) ctx.drawImage(G._traceCanvas, 0, 0);
    // Fade old trace marks so they gradually disappear instead of accumulating forever
    if (G._traceCtx) {
        G._traceCtx.globalCompositeOperation = 'destination-out';
        G._traceCtx.fillStyle = 'rgba(0,0,0,0.035)';
        G._traceCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        G._traceCtx.globalCompositeOperation = 'source-over';
    }
    // Screen shake only — no velocity-based camera offset (map stays fixed)
    const s = G.shake;
    if (s.intensity > 0 && s.elapsed < s.duration) {
        const progress = s.elapsed / s.duration;
        const decay = 1 - progress;
        const magnitude = s.intensity * decay * 20;
        // Use sin-based offset for smoother shake than pure random
        const t = s.elapsed * 60;
        const shakeX = (Math.sin(t * 3.7) * 0.5 + Math.sin(t * 7.1) * 0.3 + Math.sin(t * 13.3) * 0.2) * magnitude;
        const shakeY = (Math.sin(t * 4.3) * 0.5 + Math.sin(t * 9.7) * 0.3 + Math.sin(t * 15.1) * 0.2) * magnitude;
        s.elapsed += dt;
        ctx.save();
        ctx.translate(shakeX, shakeY);
    }

    if (G.gameState === GameState.PLAYING) {
        G.levelTime = (ct - G.levelStartTime) / 1000;
        if(G.safePeriod > 0) G.safePeriod = Math.max(0, G.safePeriod - dt);
        trackSurvivalTime(Math.min(dt, 0.05));

        if (G.player && G.player.alive) {
            G.player.update(dt, ct);
            const speed = G.player.vel.length();
            if (speed > 0) { recordDistance(speed * dt); if (G.aiTracker) G.aiTracker.recordDistance(speed * dt); }
            if (G.aiTracker) G.aiTracker.tick(dt);
        }

        // Interpolate remote tanks toward their network positions with wall collision
        if (G.isMultiplayerGame) {
            for (let uid in G.remoteTanks) {
                const rt = G.remoteTanks[uid];
                const tank = rt.tank;
                if (tank.alive && rt.targetPos) {
                    // Frame-rate independent exponential smoothing toward network position
                    const k = 15;
                    const factor = 1 - Math.exp(-k * dt);
                    tank.pos.x += (rt.targetPos.x - tank.pos.x) * factor;
                    tank.pos.y += (rt.targetPos.y - tank.pos.y) * factor;
                    // Prevent remote tank from clipping through walls
                    for (let w of G.walls) {
                        if (tank.collidesWithWall(w)) resolveWallCollision(tank, w);
                    }
                }
            }
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
                    playExplosionAt(m.pos.x, m.pos.y);
                    m.explode();
                    if (!G.player.alive) {
                        if (G.aiTracker) G.aiTracker.recordDeath();
                        if (G.isMultiplayerGame) multiplayerGameOver(false);
                        else if (G.gameMode === 'ai1v1') multiplayerGameOver(false);
                        else if (G.gameMode === 'arcade') { /* handled by player death check below */ }
                        else gameOver();
                    }
                }
                for (let e of G.enemies) {
                    if (e.alive && m.checkCollision(e)) { playExplosionAt(m.pos.x, m.pos.y); m.explode(); if (!e.alive) trackMineKill(); break; }
                }
                if (G.isMultiplayerGame) {
                    for (let uid in G.remoteTanks) {
                        const rt = G.remoteTanks[uid].tank;
                        if (rt.alive && m.checkCollision(rt)) { playExplosionAt(m.pos.x, m.pos.y); m.explode(); rt.takeDamage(10); if (!rt.alive) multiplayerGameOver(true); break; }
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
        // Catch remote tank death from mine explosion radius
        if (G.isMultiplayerGame) {
            for (let uid in G.remoteTanks) {
                if (!G.remoteTanks[uid].tank.alive && G.gameState === GameState.PLAYING) {
                    multiplayerGameOver(true);
                    break;
                }
            }
        }
        // Catch player death from mine auto-explosion or bullet-triggered explosion
        if (G.player && !G.player.alive && G.gameState === GameState.PLAYING) {
            recordDeath();
            if (G.aiTracker) G.aiTracker.recordDeath();
            if (G.isMultiplayerGame) multiplayerGameOver(false);
            else if (G.gameMode === 'ai1v1') multiplayerGameOver(false);
            else if (G.gameMode === 'arcade') {
                G.arcadeLives--;
                if (G.arcadeLives <= 0) {
                    import('./game.js').then(m => m.arcadeGameOver());
                } else {
                    // Respawn player after short delay
                    G.safePeriod = 1.5;
                    G.player.alive = true;
                    G.player.health = G.player.maxHealth;
                    G.player.pos = new Vector2(CELL_SIZE * 2.5, CANVAS_HEIGHT - CELL_SIZE * 2.5);
                    G.player.vel = new Vector2(0, 0);
                }
            } else {
                gameOver();
            }
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
                            playExplosionAt(m.pos.x, m.pos.y);
                            m.explode();
                            break;
                        }
                    }
                }
                // Bullet may have been killed by mine collision — skip remaining checks
                if (!b.alive) continue;
                if (G.player && G.player.alive && b.checkCollision(G.player)) {
                    b.alive = false;
                    playImpactAt(b.pos.x, b.pos.y);
                    G.player.takeDamage(b.damage||1);
                    recordDamageTaken(b.damage||1);
                    if (b.owner && b.owner._isQLearning) {
                        b.owner._accumulatedReward += b.damage || 1;
                    }
                    log('info', 'DAMAGE', 'Player hit! HP: ' + G.player.health);
                    if (!G.player.alive) {
                        recordDeath();
                        if (G.aiTracker) G.aiTracker.recordDeath();
                        if (G.isMultiplayerGame) multiplayerGameOver(false);
                        else if (G.gameMode === 'ai1v1') multiplayerGameOver(false);
                        else if (G.gameMode === 'arcade') { /* handled by player death check below */ }
                        else gameOver();
                    }
                }
                for (let e of G.enemies) {
                    if (e.alive && b.checkCollision(e)) {
                        const isEnemyBullet = b.owner && b.owner !== G.player;
                        if (!G.settings.friendlyFire && isEnemyBullet) break;
                        if (!b.pierceCount) b.alive = false;
                        e.takeDamage(b.damage||1);
                        // Hit marker at impact point for player bullets
                        if (!isEnemyBullet) {
                            G.hitMarkers.push({ x: b.pos.x, y: b.pos.y, time: 0, maxTime: 0.3 });
                            playImpactAt(b.pos.x, b.pos.y);
                        }
                        recordHit(b.damage||1); if (G.aiTracker) G.aiTracker.recordHit();
                        if (!e.alive) { recordKill(); trackKill(); if (G.aiTracker) G.aiTracker.recordKill(); G.score += 100 * (G.gameMode === 'arcade' ? G.arcadeWave : G.level); log('info', 'KILL', 'Enemy killed! Score: ' + G.score); const w = G.player && G.player.weaponId ? (WEAPONS.find(x => x.id === G.player.weaponId) || {}).name : 'CANNON'; addKillEntry('YOU', 'ENEMY', w); if (G.player && G.player.killEffectId && G.player.killEffectId !== 'default') { import('./engine.js').then(m => m.spawnKillEffect(G.player.killEffectId, e.pos.x, e.pos.y, e.color)); } }
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
                            rt.takeDamage(b.damage||1);
                            recordHit(b.damage||1);
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

        if (!G.isMultiplayerGame && G.enemies.filter(e => e.alive).length === 0 && G.player && G.player.alive && G.gameState !== GameState.TUTORIAL) {
            if (G.gameMode === 'ai1v1') {
                recordKill(); if (G.aiTracker) G.aiTracker.recordKill();
                multiplayerGameOver(true);
            } else if (G.gameMode === 'arcade') {
                if (!G.arcadeWaveComplete) {
                    G.arcadeWaveComplete = true;
                    G._arcadeWaveTimer = 1.5;
                    G.score += 500 * G.arcadeWave;
                }
            } else {
                levelComplete();
            }
        }

        // ARCADE wave timer — spawn next wave after delay
        if (G.gameMode === 'arcade' && G.arcadeWaveComplete && G._arcadeWaveTimer > 0) {
            G._arcadeWaveTimer -= dt;
            if (G._arcadeWaveTimer <= 0) {
                G.arcadeWave++;
                if (G.arcadeQL) {
                    G.arcadeQL.save(); // persist Q-table per wave
                    G.arcadeQL.decayEpsilon(); // reduce exploration over time
                }
                import('./levels.js').then(m => m.generateArcadeWave());
            }
        }
    } else if (G.gameState === GameState.TUTORIAL) {
        // Interactive tutorial — let the player move, shoot, boost, place mines freely
        if (G.player && G.player.alive) {
            G.player.update(dt, ct);
            // Prevent player from clipping through walls
            for (let w of G.walls) {
                if (G.player.collidesWithWall(w)) resolveWallCollision(G.player, w);
            }
        }
        for (let m of G.mines) m.update(dt);

        // Mine collision with enemies (but not self-placer)
        for (let m of G.mines) {
            if (m.armed && !m.exploded) {
                for (let e of G.enemies) {
                    if (e.alive && m.checkCollision(e)) {
                        log('info','TUTORIAL','Collision: enemy at ' + Math.round(e.pos.x) + ',' + Math.round(e.pos.y) + ' vs mine at ' + Math.round(m.pos.x) + ',' + Math.round(m.pos.y) + ' dist=' + Math.round(e.pos.distanceTo(m.pos)));
                        m.explode();
                        break;
                    }
                }
            }
        }
        G.mines = G.mines.filter(m => !m.exploded);
        for (let b of G.bullets) { if (b.alive) b.update(dt); }
        G.bullets = G.bullets.filter(b => b.alive);

        for (let e of G.enemies) { if (e.alive) e.update(dt, ct); }

        updateTutorial(dt);
    } else if (G.gameState === GameState.READY) {
        // For versus multiplayer — show DOM countdown overlay with player info
        if (G.isMultiplayerGame && !G._versusCountdownShown) {
            G._versusCountdownShown = true;
            showVersusCountdown(() => {
                G.gameState = GameState.PLAYING;
                G.levelStartTime = performance.now();
            });
            return;
        }
        const elapsed = (ct - G._readyAt) / 1000;
        const count = Math.ceil(3 - elapsed);
        // Dim overlay
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (count > 0) {
            ctx.fillStyle = '#f39c12';
            ctx.font = 'bold 96px Orbitron, monospace';
            ctx.fillText(String(count), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 16);
            ctx.fillStyle = '#888';
            ctx.font = '14px Orbitron, monospace';
            ctx.fillText('GET READY', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 48);
        } else if (elapsed < 3.8) {
            ctx.fillStyle = '#27ae60';
            ctx.font = 'bold 64px Orbitron, monospace';
            ctx.fillText('GO!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        } else {
            G.gameState = GameState.PLAYING;
            G.levelStartTime = performance.now();
        }
    }

    for (let w of G.walls) w.draw();
    for (let p of G.particles) { if (p.life > 0) { p.update(dt); p.draw(); } }
    G.particles = G.particles.filter(p => p.life > 0);

    for (let b of G.bullets) b.draw();
    for (let bid in G.remoteBullets) G.remoteBullets[bid].draw();
    for (let m of G.mines) m.draw();
    if (G.player && G.player.alive) G.player.draw();
    for (let uid in G.remoteTanks) { const rt = G.remoteTanks[uid].tank; if (rt.alive) rt.draw(); }
    for (let e of G.enemies) { if (e.alive) e.draw(); }

    // Hit markers — cross burst at impact point
    for (let i = G.hitMarkers.length - 1; i >= 0; i--) {
        const h = G.hitMarkers[i];
        h.time += dt;
        const progress = h.time / h.maxTime;
        if (progress >= 1) { G.hitMarkers.splice(i, 1); continue; }
        const alpha = 1 - progress;
        const size = 6 + progress * 8;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(h.x - size, h.y - size); ctx.lineTo(h.x + size, h.y + size);
        ctx.moveTo(h.x + size, h.y - size); ctx.lineTo(h.x - size, h.y + size);
        ctx.stroke();
    }

    // Damage numbers — float upward and fade
    for (let i = G.damageNumbers.length - 1; i >= 0; i--) {
        const n = G.damageNumbers[i];
        n.time += dt;
        n.y += n.vy;
        const progress = n.time / n.maxTime;
        if (progress >= 1) { G.damageNumbers.splice(i, 1); continue; }
        const alpha = 1 - progress * progress;
        ctx.font = 'bold 16px Orbitron, monospace';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = '#000';
        ctx.fillText(n.text, n.x + 1, n.y + 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = n.color || '#f1c40f';
        ctx.fillText(n.text, n.x, n.y);
        ctx.restore();
        ctx.textAlign = 'left';
    }

    const isShaking = G.shake.intensity > 0 && G.shake.elapsed < G.shake.duration;
    if (isShaking) ctx.restore();

    if (isShaking) {
        const progress = G.shake.elapsed / G.shake.duration;
        const alpha = Math.min((1 - progress) * G.shake.intensity * 0.8, 0.35);
        ctx.strokeStyle = `rgba(255,0,0,${alpha})`;
        ctx.lineWidth = 16;
        ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    if (G.gameState === GameState.PLAYING || G.gameState === GameState.TUTORIAL) {
        const isTutorial = G.gameState === GameState.TUTORIAL;
        ctx.fillStyle = COLORS.text;
        ctx.font = '22px Orbitron';
        if (G.gameMode === 'ai1v1') {
            const diffLabels = {1:'EASY',2:'MEDIUM',3:'HARD'};
            const diffColors = {1:'#27ae60',2:'#f39c12',3:'#e74c3c'};
            ctx.textAlign = 'left';
            ctx.fillText('ROUND ' + G.aiMatch.round + '/' + G.aiMatch.maxRounds, 20, 35);
            ctx.fillText('YOU ' + G.aiMatch.myScore + ' - ' + G.aiMatch.aiScore + ' AI', 20, 60);
            ctx.textAlign = 'right';
            ctx.fillStyle = diffColors[G.aiDifficulty] || '#f39c12';
            ctx.fillText(diffLabels[G.aiDifficulty] || 'MEDIUM', CANVAS_WIDTH - 20, 35);
            ctx.fillStyle = COLORS.text;
            ctx.fillText('TIME: ' + G.levelTime.toFixed(1) + 's', CANVAS_WIDTH - 20, 60);
            ctx.fillText('MINES: ' + (3 - G.mines.length) + '/3', CANVAS_WIDTH - 20, 85);
        } else if (G.gameMode === 'arcade') {
            const iq = G.arcadeQL ? G.arcadeQL.getIQ() : 0;
            ctx.textAlign = 'left';
            ctx.fillText('WAVE ' + G.arcadeWave, 20, 35);
            ctx.fillText('SCORE: ' + G.score, 20, 60);
            ctx.fillText('LIVES: ' + '❤'.repeat(Math.max(0, G.arcadeLives)) + '🖤'.repeat(Math.max(0, G.arcadeMaxLives - G.arcadeLives)), 20, 85);
            ctx.fillText('KILLS: ' + G.arcadeKills, 20, 110);
            ctx.textAlign = 'right';
            ctx.fillStyle = iq > 20 ? '#e74c3c' : iq > 10 ? '#f39c12' : '#888';
            ctx.fillText('AI IQ: ' + iq, CANVAS_WIDTH - 20, 35);
            ctx.fillStyle = COLORS.text;
            ctx.fillText('TIME: ' + G.levelTime.toFixed(1) + 's', CANVAS_WIDTH - 20, 60);
            ctx.fillText('MINES: ' + (3 - G.mines.length) + '/3', CANVAS_WIDTH - 20, 85);
            if (G.arcadeWaveComplete && G._arcadeWaveTimer > 0) {
                ctx.textAlign = 'center';
                ctx.fillStyle = '#f1c40f';
                ctx.font = '18px Orbitron';
                ctx.fillText('NEXT WAVE IN ' + Math.ceil(G._arcadeWaveTimer) + '...', CANVAS_WIDTH / 2, 60);
            }
        } else if (!isTutorial) {
            ctx.textAlign = 'left';
            ctx.fillText('LEVEL ' + G.level, 20, 35);
            ctx.fillText('SCORE: ' + G.score, 20, 60);
            ctx.textAlign = 'right';
            ctx.fillText('TIME: ' + G.levelTime.toFixed(1) + 's', CANVAS_WIDTH - 20, 35);
            ctx.fillText('MINES: ' + (3 - G.mines.length) + '/3', CANVAS_WIDTH - 20, 60);
        } else {
            ctx.textAlign = 'right';
            ctx.fillText('MINES: ' + (3 - G.mines.length) + '/3', CANVAS_WIDTH - 20, 60);
        }

        const p = G.player;
        if (p) {
            let weaponName = 'CANNON';
            if (p.weaponId) {
                const w = WEAPONS.find(x => x.id === p.weaponId);
                if (w) weaponName = w.name;
            }
            const hudX = CANVAS_WIDTH - 175;
            const hudY = CANVAS_HEIGHT - 88;
            const hudW = 160;
            const hudH = 94;

            ctx.fillStyle = 'rgba(10,10,26,0.7)';
            ctx.beginPath();
            ctx.roundRect(hudX, hudY, hudW, hudH, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(hudX, hudY, hudW, hudH, 8);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.beginPath();
            ctx.roundRect(hudX + 2, hudY + 2, hudW - 4, hudH / 3, 6);
            ctx.fill();

            ctx.textAlign = 'left';
            ctx.font = '10px Orbitron';
            ctx.fillStyle = '#888';
            ctx.fillText(weaponName.toUpperCase(), hudX + 12, hudY + 16);

            const ammoPct = p.ammo / p.maxAmmo;
            ctx.fillStyle = ammoPct > 0.5 ? '#eaeaea' : ammoPct > 0.25 ? '#f39c12' : '#e74c3c';
            ctx.font = '20px Orbitron';
            ctx.fillText(Math.ceil(p.ammo) + ' / ' + p.maxAmmo, hudX + 12, hudY + 44);

            ctx.fillStyle = p.reloading ? '#f39c12' : (ammoPct > 0.5 ? '#27ae60' : ammoPct > 0.25 ? '#f39c12' : '#e74c3c');
            ctx.font = '10px Orbitron';
            ctx.fillText(p.reloading ? '⏳' : '🔫', hudX + hudW - 14, hudY + 16);

            const barX = hudX + 12;
            const barY = hudY + 52;
            const barW = hudW - 24;
            const barH = 6;

            let fillPct = 0;
            let barColor = '#555';
            let labelText = '';

            if (p.reloading) {
                const elapsed = Math.min(1, (performance.now() - p.reloadStart) / p.reloadDuration);
                fillPct = elapsed;
                barColor = '#f39c12';
                labelText = Math.round(elapsed * 100) + '%';
            } else {
                const cooldownMs = p.fireRate > 0 ? 1000 / p.fireRate : 1000;
                const timeSinceFire = Math.min(cooldownMs, performance.now() - p.lastFire);
                fillPct = Math.min(1, timeSinceFire / cooldownMs);
                barColor = '#3498db';
            }

            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 3);
            ctx.fill();
            if (fillPct > 0) {
                ctx.fillStyle = barColor;
                ctx.beginPath();
                ctx.roundRect(barX, barY, barW * fillPct, barH, 3);
                ctx.fill();
            }
            if (labelText) {
                ctx.textAlign = 'right';
                ctx.font = '8px Orbitron';
                ctx.fillStyle = barColor;
                ctx.fillText(labelText, hudX + hudW - 12, barY - 3);
            }

            const fuelBarY = barY + barH + 4;
            const fuelPct = p.maxFuel > 0 ? p.fuel / p.maxFuel : 1;
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.roundRect(barX, fuelBarY, barW, 5, 2);
            ctx.fill();
            ctx.fillStyle = fuelPct > 0.5 ? '#2ecc71' : fuelPct > 0.25 ? '#f39c12' : '#e74c3c';
            ctx.beginPath();
            ctx.roundRect(barX, fuelBarY, barW * fuelPct, 5, 2);
            ctx.fill();
            ctx.textAlign = 'left';
            ctx.font = '7px Orbitron';
            ctx.fillStyle = '#666';
            ctx.fillText('FUEL', hudX + 12, fuelBarY + 11);

            const boostBarY = fuelBarY + 5 + 5;
            const boostPct = p.maxBoostEnergy > 0 ? p.boostEnergy / p.maxBoostEnergy : 1;
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.roundRect(barX, boostBarY, barW, 5, 2);
            ctx.fill();
            ctx.fillStyle = boostPct > 0.5 ? '#9b59b6' : boostPct > 0.25 ? '#e67e22' : '#e74c3c';
            ctx.beginPath();
            ctx.roundRect(barX, boostBarY, barW * boostPct, 5, 2);
            ctx.fill();
            ctx.textAlign = 'left';
            ctx.font = '7px Orbitron';
            ctx.fillStyle = '#666';
            ctx.fillText('BOOST', hudX + 12, boostBarY + 11);

            // Gadget cooldown display
            if (p.gadgetId) {
                const gadgetX = hudX - 50;
                const gadgetY = hudY;
                const gadgetW = 42;
                const gadgetH = 42;
                const cd = p.gadgetCooldown;
                const timer = p.gadgetTimer;
                const ready = p.gadgetReady && !p.gadgetActive;
                const cooldownPct = cd > 0 ? 1 - (timer / cd) : 1;

                ctx.fillStyle = 'rgba(10,10,26,0.7)';
                ctx.beginPath();
                ctx.roundRect(gadgetX, gadgetY, gadgetW, gadgetH, 6);
                ctx.fill();
                ctx.strokeStyle = ready ? 'rgba(46,204,113,0.5)' : 'rgba(255,255,255,0.12)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(gadgetX, gadgetY, gadgetW, gadgetH, 6);
                ctx.stroke();

                ctx.textAlign = 'center';
                ctx.font = '18px Orbitron';
                ctx.fillStyle = ready ? '#2ecc71' : '#666';
                ctx.fillText(ready ? 'Q' : '⚡', gadgetX + gadgetW / 2, gadgetY + 26);

                if (!ready) {
                    ctx.fillStyle = 'rgba(255,255,255,0.06)';
                    ctx.beginPath();
                    ctx.roundRect(gadgetX + 4, gadgetY + gadgetH - 8, gadgetW - 8, 4, 2);
                    ctx.fill();
                    ctx.fillStyle = '#3498db';
                    ctx.beginPath();
                    ctx.roundRect(gadgetX + 4, gadgetY + gadgetH - 8, (gadgetW - 8) * cooldownPct, 4, 2);
                    ctx.fill();
                }

                ctx.textAlign = 'left';
                ctx.font = '6px Orbitron';
                ctx.fillStyle = '#555';
                ctx.fillText('GADGET', gadgetX + 1, gadgetY - 2);
            }

            // Health bar — bottom-left persistent HUD
            const hpX = 20;
            const hpY = CANVAS_HEIGHT - 48;
            const hpW = 200;
            const hpH = 18;
            const hpPct = G.player.health / G.player.maxHealth;
            const hpColor = hpPct > 0.5 ? '#27ae60' : hpPct > 0.25 ? '#f39c12' : '#e74c3c';
            ctx.fillStyle = 'rgba(10,10,26,0.7)';
            ctx.beginPath();
            ctx.roundRect(hpX - 2, hpY - 2, hpW + 4, hpH + 4, 6);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(hpX - 2, hpY - 2, hpW + 4, hpH + 4, 6);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.roundRect(hpX, hpY, hpW, hpH, 4);
            ctx.fill();
            if (hpPct > 0) {
                ctx.fillStyle = hpColor;
                ctx.beginPath();
                ctx.roundRect(hpX, hpY, hpW * hpPct, hpH, 4);
                ctx.fill();
            }
            ctx.textAlign = 'left';
            ctx.font = '9px Orbitron';
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText('HP', hpX + 6, hpY - 6);
            ctx.textAlign = 'right';
            ctx.font = 'bold 11px Orbitron';
            ctx.fillStyle = '#eaeaea';
            ctx.fillText(Math.ceil(G.player.health) + ' / ' + G.player.maxHealth, hpX + hpW - 6, hpY + 13);

            // Low-health pulse overlay
            if (hpPct < 0.35 && G.player.health > 0) {
                const pulse = 0.25 + Math.sin(performance.now() / 200) * 0.12;
                const hAlpha = (1 - hpPct / 0.35) * pulse;
                ctx.fillStyle = `rgba(200,0,0,${Math.min(hAlpha, 0.25)})`;
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }
        }
    }

    updateKillFeed(dt);

    if (G.gameState === GameState.TUTORIAL) {
        renderTutorial(ctx);
    }
    drawKillFeed(ctx);

    const frameTime = performance.now() - frameStart;
    recordFrame(frameTime);
    drawGraph(ctx);

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
        if (G.gameState === GameState.TUTORIAL) {
            e.preventDefault();
            closeTutorial();
        } else if (G.gameState === GameState.PLAYING) {
            G.gameState = GameState.PAUSED;
            showOverlay('pauseOverlay');
            log('info','PAUSE','Game paused');
        } else if (G.gameState === GameState.PAUSED) {
            resumeGame();
        } else if (G.gameState === GameState.MENU || G.gameState === GameState.LOADING || !G.gameState) {
            // Close overlay if one is open (detect via visible non-login overlays)
            const overlays = ['settingsOverlay','aboutOverlay','statsOverlay','friendsOverlay','leaderboardOverlay','aiDifficultyOverlay','profileOverlay','missionsOverlay','shopOverlay','upgradeOverlay','tutorialOverlay'];
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
            else if (active === 'missionsOverlay') closeMissions();
            else if (active === 'shopOverlay') closeShop();
            else if (active === 'upgradeOverlay') closeUpgrades();
            else if (active === 'tutorialOverlay') closeTutorial();
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

canvas.addEventListener('mousedown', (e) => { initAudio(); if (e.button === 0) G.mouseDown = true; });
canvas.addEventListener('mouseup', (e) => { if (e.button === 0) G.mouseDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ==================== TOUCH CONTROLS ====================
const TOUCH_DEAD_ZONE = 15; // px before joystick registers direction
const TAP_MAX_DIST = 20;    // max movement to count as tap (not drag)
const TAP_MAX_TIME = 250;   // ms max duration to count as tap

function touchPos(e) {
    const r = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - r.left) * (CANVAS_WIDTH / r.width),
        y: (e.clientY - r.top) * (CANVAS_HEIGHT / r.height),
    };
}

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initAudio();
    G.touch.active = true;

    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const pos = touchPos(t);

        if (pos.x < CANVAS_WIDTH / 2 && G.touch.joystickId === -1) {
            G.touch.joystickId = t.identifier;
            G.touch.joystickCenterX = pos.x;
            G.touch.joystickCenterY = pos.y;
        } else if (pos.x >= CANVAS_WIDTH / 2 && G.touch.aimId === -1) {
            G.touch.aimId = t.identifier;
            G.touch.aimStartX = pos.x;
            G.touch.aimStartY = pos.y;
            G.touch.aimStartTime = Date.now();
            G.touch.tapFired = false;
            G.mouseX = pos.x;
            G.mouseY = pos.y;
        }
    }

    if (e.touches.length >= 2) {
        window.placeMine && window.placeMine();
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const pos = touchPos(t);

        if (t.identifier === G.touch.joystickId) {
            const dx = pos.x - G.touch.joystickCenterX;
            const dy = pos.y - G.touch.joystickCenterY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            G.keys['KeyW'] = false;
            G.keys['KeyS'] = false;
            G.keys['KeyA'] = false;
            G.keys['KeyD'] = false;

            if (dist > TOUCH_DEAD_ZONE) {
                const normDx = dx / dist;
                const normDy = dy / dist;
                if (Math.abs(normDy) > Math.abs(normDx)) {
                    G.keys[normDy < 0 ? 'KeyW' : 'KeyS'] = true;
                } else {
                    G.keys[normDx < 0 ? 'KeyA' : 'KeyD'] = true;
                }
            }
        } else if (t.identifier === G.touch.aimId) {
            G.mouseX = pos.x;
            G.mouseY = pos.y;
        }
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        if (t.identifier === G.touch.joystickId) {
            G.touch.joystickId = -1;
            G.keys['KeyW'] = false;
            G.keys['KeyS'] = false;
            G.keys['KeyA'] = false;
            G.keys['KeyD'] = false;
        }

        if (t.identifier === G.touch.aimId) {
            const pos = touchPos(t);
            const dt = Date.now() - G.touch.aimStartTime;
            const dist = Math.sqrt(
                (pos.x - G.touch.aimStartX) ** 2 +
                (pos.y - G.touch.aimStartY) ** 2
            );
            G.touch.aimId = -1;

            if (dist < TAP_MAX_DIST && dt < TAP_MAX_TIME && !G.touch.tapFired) {
                G.touch.tapFired = true;
                G.mouseDown = true;
                setTimeout(() => { G.mouseDown = false; }, 100);
            }
        }
    }

    if (e.touches.length === 0) {
        G.touch.active = false;
    }
});

canvas.addEventListener('touchcancel', () => {
    G.touch.joystickId = -1;
    G.touch.aimId = -1;
    G.keys['KeyW'] = false;
    G.keys['KeyS'] = false;
    G.keys['KeyA'] = false;
    G.keys['KeyD'] = false;
    G.touch.active = false;
});

window.resumeGame = function(){
    if (G.gameState !== GameState.PAUSED) return;
    const prev = G._pausedPrevState || GameState.PLAYING;
    G.gameState = prev;
    showOverlay(null);
    log('info','PAUSE','Game resumed');
};

window.leaveGame = function(){
    log('info','PAUSE','Leaving game');
    import('./multiplayer.js').then(m => m.cleanupMultiplayer()).catch(() => {});
    G.gameState = GameState.MENU;
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('loggedInPanel').style.display = 'flex';
    showOverlay('loginOverlay');
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

try {
    const saved = JSON.parse(localStorage.getItem('tank_arena_settings') || '{}');
    if (saved.showFps) setPerfVisible(true);
} catch {}
initErrorTracking();
startWatchdog((elapsed) => {
    const overlay = document.getElementById('gameOverlay');
    if (overlay) {
        overlay.innerHTML = `
            <div style="text-align:center;padding:40px;">
                <h2 style="color:#e74c3c;">GAME CRASHED</h2>
                <p style="color:#aaa;margin:16px 0;">Game was frozen for ${(elapsed/1000).toFixed(1)}s</p>
                <button onclick="location.reload()" style="padding:12px 32px;background:#3498db;border:none;border-radius:6px;color:white;font-size:14px;cursor:pointer;">RELOAD</button>
            </div>`;
        overlay.style.display = 'flex';
        overlay.classList.add('active');
    }
});

requestAnimationFrame(gameLoop);
log('info', 'INIT', 'Game engine initialized and running');
