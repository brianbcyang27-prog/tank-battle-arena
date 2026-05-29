import { CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE, COLORS, GameState } from './config.js';
import { G } from './state.js';
import { Vector2, Player, Tank } from './engine.js';
import { generateLevel } from './levels.js';
import { showOverlay, updateUI } from './ui.js';
import { log } from './log.js';

// ==================== GAME FLOW ====================
export function startGame(){
    if (G.gameState === GameState.LOADING) return;
    G.gameState = GameState.LOADING;
    showOverlay(null);
    G.level=1; G.score=0;
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
        G.level=1; G.score=0;
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
export function gameOver(){
    G.gameState=GameState.GAME_OVER;
    updateUI();
    showOverlay('gameOverOverlay');
    document.getElementById('restartButton').onclick=startGame;
    const lb=JSON.parse(localStorage.getItem('tankBattleLeaderboard')||'[]');
    import('./ui.js').then(m => m.displayLeaderboard(lb));
    log('info','GAME','Game over. Final score: '+G.score+', Level: '+G.level);
}

export function multiplayerGameOver(isWinner){
    if (G.gameState !== GameState.PLAYING) return; // prevent overwriting an already-decided game
    G.gameState=GameState.GAME_OVER;
    const resultText=isWinner?'VICTORY!':'DEFEAT!';
    const resultColor=isWinner?'#27ae60':'#e74c3c';
    const resultOverlay=document.getElementById('gameOverOverlay');
    resultOverlay.innerHTML=`
        <h1 style="color:${resultColor};font-size:64px;margin:0 0 20px;text-shadow:0 0 30px ${resultColor};">${resultText}</h1>
        <p style="color:#eaeaea;font-size:20px;margin:0 0 30px;">${isWinner?'You destroyed all enemies!':'You were destroyed!'}</p>
        <div style="display:flex;gap:15px;justify-content:center;">
            <button onclick="rematch()" style="padding:15px 40px;font-size:18px;cursor:pointer;background:#27ae60;border:none;border-radius:8px;color:white;">PLAY AGAIN</button>
            <button onclick="leaveLobby()" style="padding:15px 40px;font-size:18px;cursor:pointer;background:#3498db;border:none;border-radius:8px;color:white;">BACK TO MENU</button>
        </div>
    `;
    showOverlay('gameOverOverlay');
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
