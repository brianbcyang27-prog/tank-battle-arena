import { G } from './state.js';
import { log } from './log.js';
import { COLORS, CANVAS_WIDTH, CELL_SIZE, GameState } from './config.js';
import { Tank, Player, Wall, Vector2, SimpleBullet } from './engine.js';
import { generateLevel } from './levels.js';
import { ref, update, set, child, get, onValue, off, remove, serverTimestamp, onDisconnect, db } from './firebase.js';
import { showOverlay } from './ui.js';

function setInStorage(key, val) {
    try { localStorage.setItem('tankBattle_' + key, val); } catch(e) {}
}

// ==================== LOBBY CREATION & JOINING ====================
export function createOrJoinLobby() {
    const playerCount = G.gameMode === '1v1' ? 2 : G.gameMode === '2v2' ? 4 : 6;
    get(ref(db, 'lobbies')).then(snapshot => {
        let foundLobby = null;
        let foundCode = null;
        snapshot.forEach(snap => {
            const l = snap.val();
            if (l.mode === G.gameMode && l.players && Object.keys(l.players).length < playerCount && l.status === 'waiting') {
                foundLobby = snap.key;
                foundCode = l.code;
            }
        });
        if (foundLobby) {
            joinLobby(foundLobby, foundCode);
        } else {
            createLobby(playerCount);
        }
    }).catch(e => {
        log('error', 'LOBBY', 'Lobby search failed: ' + e.message);
        alert('Failed to create/join lobby. Please try again.');
        document.getElementById('loadingScreen').style.display = 'none';
        showOverlay('loginOverlay');
        document.getElementById('loggedInPanel').style.display = 'flex';
    });
}

export function createLobby(playerCount) {
    G.lobbyId = 'lobby_' + Date.now();
    const lobbyRef = ref(db, 'lobbies/' + G.lobbyId);
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    set(lobbyRef, {
        mode: G.gameMode, status: 'waiting', playerCount: playerCount,
        host: G.currentUser.uid, createdAt: serverTimestamp(),
        code: roomCode,
        players: {}
    }).then(() => {
        setInStorage('lobbyId', G.lobbyId);
        setInStorage('lobbyHost', G.currentUser.uid);
        const initialReady = G.settings.autoReady;
        set(child(lobbyRef, 'players/' + G.currentUser.uid), {
            name: G.currentUser.email, ready: initialReady, joined: serverTimestamp()
        });
        onDisconnect(lobbyRef).remove();
        listenToLobby(lobbyRef);
        showOverlay('lobbyOverlay');
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('lobbyTitle').textContent = 'ROOM CREATED!';
        document.getElementById('lobbyMode').textContent = 'Mode: ' + G.gameMode.toUpperCase();
        document.getElementById('currentRoomCode').textContent = roomCode;
        document.getElementById('readyButton').style.display = 'none';
        document.getElementById('startGameButton').style.display = 'inline-block';
        document.getElementById('lobbyShareHint').style.display = 'block';
        document.getElementById('lobbyStatus').textContent = 'Share code: ' + roomCode + ' - Waiting for players...';
        log('info', 'LOBBY', 'Created lobby: ' + G.lobbyId + ' with code: ' + roomCode);
    });
}

function joinLobby(id, roomCode) {
    G.lobbyId = id;
    const lobbyRef = ref(db, 'lobbies/' + G.lobbyId);
    const initialReady = G.settings.autoReady;
    set(child(lobbyRef, 'players/' + G.currentUser.uid), {
        name: G.currentUser.email, ready: initialReady, joined: serverTimestamp()
    });
    onDisconnect(child(lobbyRef, 'players/' + G.currentUser.uid)).remove();
    listenToLobby(lobbyRef);
    document.getElementById('loadingScreen').style.display = 'none';
    showOverlay('lobbyOverlay');
    document.getElementById('lobbyTitle').textContent = 'MULTIPLAYER LOBBY';
    document.getElementById('lobbyMode').textContent = 'Mode: ' + G.gameMode.toUpperCase();
    document.getElementById('currentRoomCode').textContent = roomCode || 'N/A';
    document.getElementById('readyButton').textContent = initialReady ? 'NOT READY' : 'READY';
    document.getElementById('readyButton').style.display = 'inline-block';
    document.getElementById('startGameButton').style.display = 'none';
    document.getElementById('lobbyShareHint').style.display = 'none';
    log('info', 'LOBBY', 'Joined lobby: ' + G.lobbyId);
}

window.joinWithCode = function() {
    const rawCode = document.getElementById('roomCodeInput').value.trim();
    const code = rawCode.toUpperCase().slice(-6);
    if (!code || code.length < 6) { log('warn', 'JOIN', 'Invalid room code'); alert('Please enter a valid 6-character room code'); return; }
    if (!G.currentUser) { log('warn', 'JOIN', 'Must be logged in'); return; }
    log('info', 'JOIN', 'Attempting to join room: ' + code);
    joinLobbyByCode(code);
};

window.createRoom = function() {
    if (!G.currentUser) { log('warn', 'CREATE', 'Must be logged in'); return; }
    if (G.gameMode === 'single') { log('warn', 'CREATE', 'Cannot create room in single player'); return; }
    log('info', 'CREATE', 'Creating new room for mode: ' + G.gameMode);
    document.getElementById('loadingScreen').style.display = 'flex';
    document.getElementById('loadingTitle').textContent = 'CREATING YOUR ROOM...';
    document.getElementById('loadingSubtitle').textContent = 'Please wait...';
    const playerCount = G.gameMode === '1v1' ? 2 : G.gameMode === '2v2' ? 4 : 6;
    createLobby(playerCount);
};

function joinLobbyByCode(code) {
    const lobbiesRef = ref(db, 'lobbies');
    document.getElementById('loadingScreen').style.display = 'flex';
    document.getElementById('loadingTitle').textContent = 'JOINING ROOM...';
    document.getElementById('loadingSubtitle').textContent = code;
    get(lobbiesRef).then(snapshot => {
        let found = false;
        snapshot.forEach(snap => {
            const l = snap.val();
            if (l.code === code && l.status === 'waiting') {
                found = true;
                G.lobbyId = snap.key;
                const lobbyRef = ref(db, 'lobbies/' + G.lobbyId);
                const initialReady = G.settings.autoReady;
                set(child(lobbyRef, 'players/' + G.currentUser.uid), {
                    name: G.currentUser.email, ready: initialReady, joined: serverTimestamp()
                });
                onDisconnect(child(lobbyRef, 'players/' + G.currentUser.uid)).remove();
                listenToLobby(lobbyRef);
                showOverlay('lobbyOverlay');
                document.getElementById('loadingScreen').style.display = 'none';
                document.getElementById('lobbyTitle').textContent = 'MULTIPLAYER LOBBY';
                document.getElementById('lobbyMode').textContent = 'Mode: ' + G.gameMode.toUpperCase();
                document.getElementById('currentRoomCode').textContent = code;
                document.getElementById('readyButton').textContent = initialReady ? 'NOT READY' : 'READY';
                document.getElementById('readyButton').style.display = 'inline-block';
                document.getElementById('startGameButton').style.display = 'none';
                document.getElementById('lobbyShareHint').style.display = 'none';
                log('info', 'LOBBY', 'Joined lobby via code: ' + code);
            }
        });
        if (!found) {
            log('warn', 'JOIN', 'Room not found or full: ' + code);
            alert('Room not found or already full!');
            document.getElementById('loadingScreen').style.display = 'none';
            showOverlay('loginOverlay');
            document.getElementById('loggedInPanel').style.display = 'flex';
        }
    }).catch(e => {
        log('error', 'JOIN', 'Failed to join room: ' + e.message);
        alert('Failed to join room. Please try again.');
        document.getElementById('loadingScreen').style.display = 'none';
        showOverlay('loginOverlay');
        document.getElementById('loggedInPanel').style.display = 'flex';
    });
}

// ==================== LOBBY LISTENER ====================
export function listenToLobby(lobbyRef) {
    let isHost = false;

    onValue(lobbyRef, snapshot => {
        const l = snapshot.val();
        if (!l) return;

        isHost = l.host === G.currentUser.uid;
        const players = l.players || {};

        // Only update player list if we're in lobby (not in game)
        if (G.gameState !== GameState.PLAYING) {
            updatePlayerList(players);
        }

        // Update remote tanks during gameplay
        if (G.isMultiplayerGame && G.gameState === GameState.PLAYING) {
            for (let [uid, p] of Object.entries(players)) {
                if (uid === G.currentUser.uid) continue;

                if (!G.remoteTanks[uid]) {
                    G.remoteTanks[uid] = {
                        tank: new Tank(p.x || CANVAS_WIDTH / 2, p.y || CANVAS_HEIGHT / 2, COLORS.player2),
                        lastUpdate: Date.now()
                    };
                    G.remoteTanks[uid].tank.health = p.health || 3;
                    G.remoteTanks[uid].tank.maxHealth = G.remoteTanks[uid].tank.health;
                    log('info', 'MP', 'Created remote tank for: ' + uid);
                }

                if (p.x !== undefined && p.y !== undefined) {
                    G.remoteTanks[uid].tank.pos.x = p.x;
                    G.remoteTanks[uid].tank.pos.y = p.y;
                    G.remoteTanks[uid].tank.turretAngle = p.angle || 0;
                    G.remoteTanks[uid].tank.health = p.health || 3;
                    G.remoteTanks[uid].lastUpdate = Date.now();
                }
            }

            // Remove tanks for disconnected players
            for (let uid in G.remoteTanks) {
                if (!players[uid]) {
                    log('info', 'MP', 'Removing remote tank for disconnected: ' + uid);
                    delete G.remoteTanks[uid];
                }
            }
            return; // Don't update UI during gameplay
        }

        // Show/hide controls based on host status (only in lobby)
        if (isHost) {
            document.getElementById('readyButton').style.display = 'none';
            document.getElementById('startGameButton').style.display = 'inline-block';
            document.getElementById('lobbyTitle').textContent = 'ROOM CREATED!';
        } else {
            document.getElementById('readyButton').style.display = 'inline-block';
            document.getElementById('startGameButton').style.display = 'none';
            document.getElementById('lobbyTitle').textContent = 'MULTIPLAYER LOBBY';
        }

        // Update status based on player count
        const playerCount = l.playerCount || 2;
        const currentPlayers = Object.keys(players).length;
        if (currentPlayers >= playerCount) {
            document.getElementById('lobbyStatus').textContent = 'Room full! ' + (isHost ? 'Click START to begin!' : 'Waiting for host...');
        } else {
            document.getElementById('lobbyStatus').textContent = 'Waiting for players: ' + currentPlayers + '/' + playerCount;
        }
    });

    // Listen for status changes (playing = game started)
    onValue(child(lobbyRef, 'status'), snapshot => {
        const status = snapshot.val();
        if (status === 'playing' && !G._multiplayerStarting && G.gameState !== GameState.LOADING && G.gameState !== GameState.PLAYING) {
            log('info', 'MP', 'Received status=playing, starting game...');
            window.startMultiplayerGame();
        }
    });

    // Listen for game result
    onValue(child(lobbyRef, 'gameResult'), snapshot => {
        const result = snapshot.val();
        if (result && G.gameState === GameState.PLAYING) {
            const isWinner = result === 'win';
            G.gameState = GameState.GAME_OVER;
            const resultText = isWinner ? 'VICTORY!' : 'DEFEAT!';
            const resultColor = isWinner ? '#27ae60' : '#e74c3c';
            const resultOverlay = document.getElementById('gameOverOverlay');
            resultOverlay.innerHTML = `
                <h1 style="color:${resultColor};font-size:64px;margin:0 0 20px;text-shadow:0 0 30px ${resultColor};">${resultText}</h1>
                <p style="color:#eaeaea;font-size:20px;margin:0 0 30px;">${isWinner ? 'You destroyed all enemies!' : 'You were destroyed!'}</p>
                <button onclick="leaveLobby()" style="padding:15px 40px;font-size:18px;cursor:pointer;background:#3498db;border:none;border-radius:8px;color:white;">BACK TO MENU</button>
            `;
            showOverlay('gameOverOverlay');
            log('info', 'MP', 'Received game result: ' + (isWinner ? 'WIN' : 'LOSE'));
        }
    });
}

function updatePlayerList(players) {
    const list = document.getElementById('playerList');
    let html = '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">';
    for (let [id, p] of Object.entries(players)) {
        const isMe = id === G.currentUser.uid;
        html += '<div class="player-card ' + (p.ready ? 'ready' : '') + '" style="background:rgba(0,0,0,0.3);padding:8px 15px;border-radius:4px;border:1px solid ' + (p.ready ? '#27ae60' : '#666') + ';">';
        html += '<span class="name" style="color:#eaeaea;">' + (isMe ? 'You' : (p.name ? p.name.split('@')[0] : 'Player')) + '</span> ';
        html += '<span class="status" style="color:' + (p.ready ? '#27ae60' : '#e74c3c') + ';font-size:11px;">' + (p.ready ? '\u2713 READY' : '\u2717 NOT READY') + '</span>';
        html += '</div>';
    }
    html += '</div>';
    list.innerHTML = html;
}

window.toggleReady = function() {
    if (!G.lobbyId) return;
    const lobbyRef = ref(db, 'lobbies/' + G.lobbyId + '/players/' + G.currentUser.uid);
    get(lobbyRef).then(snap => {
        const p = snap.val();
        update(lobbyRef, { ready: !p.ready });
        log('info', 'LOBBY', 'Toggled ready: ' + (!p.ready));
    });
};

export function cleanupMultiplayer() {
    if (G.bulletListenerRef) {
        if (typeof G.bulletListenerRef === 'function') G.bulletListenerRef();
        G.bulletListenerRef = null;
    }
    if (G.playerUpdateInterval) {
        clearInterval(G.playerUpdateInterval);
        G.playerUpdateInterval = null;
    }
    G.isMultiplayerGame = false;
    G._multiplayerStarting = false;
    G.remoteTanks = {};
    G.remoteBullets = {};
}

window.leaveLobby = function() {
    if (!G.lobbyId) return;
    cleanupMultiplayer();
    const lobbyRef = ref(db, 'lobbies/' + G.lobbyId);
    remove(child(lobbyRef, 'players/' + G.currentUser.uid)).then(() => {
        log('info', 'LOBBY', 'Left lobby: ' + G.lobbyId);
        G.lobbyId = null;
        showOverlay('loginOverlay');
        document.getElementById('loggedInPanel').style.display = 'flex';
    });
};

// ==================== START MULTIPLAYER GAME ====================
window.startMultiplayerGame = function() {
    if (G._multiplayerStarting) { log('warn', 'MP', 'startMultiplayerGame already in progress, ignoring'); return; }
    G._multiplayerStarting = true;
    log('info', 'MP', 'Starting multiplayer game!');
    G.isMultiplayerGame = true;
    G.gameState = GameState.LOADING;

    // Set up Firebase bullet listener
    const bulletsRef = ref(db, 'lobbies/' + G.lobbyId + '/bullets');
    G.bulletListenerRef = onValue(bulletsRef, snapshot => {
        if (!G.isMultiplayerGame || G.gameState !== GameState.PLAYING) return;
        const data = snapshot.val() || {};
        const remoteIds = new Set(Object.keys(data));

        // Update/create remote bullets
        for (let [bid, bd] of Object.entries(data)) {
            if (bd.ownerUid === G.currentUser.uid) continue;
            if (!G.remoteBullets[bid]) {
                G.remoteBullets[bid] = new SimpleBullet(bd.x, bd.y, bd.vx, bd.vy, bd.ownerUid);
            } else {
                G.remoteBullets[bid].pos = { x: bd.x, y: bd.y };
                G.remoteBullets[bid].vel = { x: bd.vx, y: bd.vy };
                G.remoteBullets[bid].alive = bd.alive;
            }
        }

        // Remove bullets that no longer exist in Firebase
        for (let bid in G.remoteBullets) {
            if (!remoteIds.has(bid)) {
                delete G.remoteBullets[bid];
            }
        }
    });

    // Hide all overlays
    document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
    document.getElementById('lobbyOverlay').style.display = 'none';
    document.getElementById('loadingScreen').style.display = 'flex';
    document.getElementById('loadingScreen').style.zIndex = '100';
    document.getElementById('loadingTitle').textContent = 'STARTING MATCH...';
    document.getElementById('loadingSubtitle').textContent = '';

    // Clean up old player update interval if any
    if (G.playerUpdateInterval) {
        clearInterval(G.playerUpdateInterval);
        G.playerUpdateInterval = null;
    }

    // Notify Firebase so joiner receives the signal to start
    if (G.lobbyId) {
        update(ref(db, 'lobbies/' + G.lobbyId), { status: 'playing' });
    }

    log('info', 'MP', 'Generating level for multiplayer...');

    // Small delay so loading screen is visible
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';

        // Check Firebase to determine if we are host
        get(ref(db, 'lobbies/' + G.lobbyId)).then(snap => {
            const l = snap.val();
            const isHost = l && l.host === G.currentUser.uid;

            if (isHost) {
                // Host: generate map and save to Firebase
                generateLevel(1);
                const wallData = G.walls.map(w => ({ x: w.x, y: w.y, w: w.w, h: w.h }));
                const hostStart = { x: G.player.pos.x, y: G.player.pos.y };
                const joinerStart = { x: CANVAS_WIDTH - CELL_SIZE * 2.5, y: CELL_SIZE * 2.5 };
                update(ref(db, 'lobbies/' + G.lobbyId), {
                    map: wallData,
                    hostStart: hostStart,
                    joinerStart: joinerStart,
                    mapGenerated: true
                });
                G.player.color = COLORS.player;
                G.player.name = G.currentUser.email ? G.currentUser.email.split('@')[0] : 'Player';
                G.player.labelTime = 3;
                update(ref(db, 'lobbies/' + G.lobbyId + '/players/' + G.currentUser.uid), {
                    color: COLORS.player,
                    name: G.player.name
                });
                log('info', 'MP', 'Host generated map, saved to Firebase');
            } else {
                // Joiner: load map from Firebase
                listenToMapAndStart();
            }
        }).catch(e => {
            log('error', 'MP', 'Failed to check host status: ' + e);
            generateLevel(1);
        });
    }, 300);

    // Reset guard after a reasonable timeout
    setTimeout(() => { G._multiplayerStarting = false; }, 1000);
};

function listenToMapAndStart() {
    const mapRef = ref(db, 'lobbies/' + G.lobbyId);
    get(mapRef).then(snapshot => {
        const data = snapshot.val();
        if (data && data.map && data.mapGenerated && data.hostStart && data.joinerStart) {
            log('info', 'MP', 'Received map from host, loading...');
            loadMapFromData(data.map, data.hostStart, data.joinerStart);
            G.player.color = COLORS.player2;
            update(ref(db, 'lobbies/' + G.lobbyId + '/players/' + G.currentUser.uid), {
                color: COLORS.player2,
                name: G.currentUser.email ? G.currentUser.email.split('@')[0] : 'Player'
            });
        } else {
            // Map not ready yet, listen for it
            const waitMapRef = ref(db, 'lobbies/' + G.lobbyId);
            const waitFn = onValue(waitMapRef, snap2 => {
                const d2 = snap2.val();
                if (d2 && d2.map && d2.mapGenerated && d2.hostStart && d2.joinerStart) {
                    log('info', 'MP', 'Received map from host (deferred), loading...');
                    loadMapFromData(d2.map, d2.hostStart, d2.joinerStart);
                    G.player.color = COLORS.player2;
                    update(ref(db, 'lobbies/' + G.lobbyId + '/players/' + G.currentUser.uid), {
                        color: COLORS.player2,
                        name: G.currentUser.email ? G.currentUser.email.split('@')[0] : 'Player'
                    });
                    off(waitMapRef, 'value', waitFn);
                }
            });
        }
    });
}

function loadMapFromData(wallData, hostStart, joinerStart) {
    G.walls = [];
    G.bullets = [];
    G.particles = [];
    G.mines = [];
    G.enemies = [];

    for (let wd of wallData) {
        G.walls.push(new Wall(wd.x, wd.y, wd.w, wd.h));
    }

    const myStart = joinerStart;
    G.player = new Player(myStart.x, myStart.y, G.currentUser.email ? G.currentUser.email.split('@')[0] : 'Player');
    G.player.color = COLORS.player2;
    G.player.pos = new Vector2(myStart.x, myStart.y);

    G.levelStartTime = performance.now();
    G.gameState = GameState.PLAYING;
    log('info', 'LEVEL', 'Map loaded - walls: ' + G.walls.length);
}
