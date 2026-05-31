import { CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE, COLORS, GameState } from './config.js';
import { G } from './state.js';
import { Vector2, Player, Enemy, Wall } from './engine.js';
import { log } from './log.js';

export function generateLevel(lvl){
    log('info','LEVEL','Generating level '+lvl+' (multiplayer: '+G.isMultiplayerGame+')');
    G.walls=[]; G.bullets=[]; G.particles=[]; G.mines=[]; G.enemies=[];

    const loadingEl = document.getElementById('loadingScreen');
    if(loadingEl) loadingEl.style.display='none';

    const gc=Math.floor(CANVAS_WIDTH/CELL_SIZE), gr=Math.floor(CANVAS_HEIGHT/CELL_SIZE);
    let grid=[];
    for(let y=0;y<gr;y++){ grid[y]=[]; for(let x=0;x<gc;x++) grid[y][x]=(x===0||x===gc-1||y===0||y===gr-1)?1:0; }
    const wl=Math.floor(gc*gr*(0.2+Math.min(lvl*0.015,0.08)));
    for(let i=0;i<wl;i++){
        const x=2+Math.floor(Math.random()*(gc-4)), y=2+Math.floor(Math.random()*(gr-4));
        if(y>=0 && y<gr && x>=0 && x<gc && grid[y] && grid[y][x]===0){ grid[y][x]=1; }
    }
    for(let y=0;y<gr;y++) for(let x=0;x<gc;x++) if(grid[y] && grid[y][x]===1) G.walls.push(new Wall(x*CELL_SIZE,y*CELL_SIZE,CELL_SIZE,CELL_SIZE));
    G.player=new Player(CELL_SIZE*2.5,CANVAS_HEIGHT-CELL_SIZE*2.5);

    if(!G.isMultiplayerGame){
        if (G.gameMode === 'ai1v1') {
            const ex = CANVAS_WIDTH - CELL_SIZE * 2.5;
            const ey = CELL_SIZE * 2.5;
            const strategy = G.aiTracker ? G.aiTracker.getStrategy() : null;
            G.enemies.push(new Enemy(ex, ey, G.aiDifficulty || 2, strategy));
        } else {
            const ne=Math.min(2+Math.floor(lvl*1.2),10), tier=Math.min(Math.ceil(lvl/2),4);
            for(let i=0;i<ne;i++){
                for(let a=0;a<50;a++){
                    const ex=CELL_SIZE*2+Math.random()*(CANVAS_WIDTH-CELL_SIZE*4), ey=CELL_SIZE*2+Math.random()*(CANVAS_HEIGHT-CELL_SIZE*4);
                    if(Math.abs(ex-G.player.pos.x)<100||Math.abs(ey-G.player.pos.y)<100) continue;
                    const et=Math.max(1,tier-(i%2));
                    G.enemies.push(new Enemy(ex,ey,et));
                    break;
                }
            }
        }
    }
    validateAllPaths();
    G.levelStartTime=performance.now();
    G.gameState=GameState.PLAYING;
    log('info','LEVEL','Level generated - enemies: '+G.enemies.length+', player pos: '+G.player.pos.x+','+G.player.pos.y);
}

function validateAllPaths(){
    for(let t of [G.player,...G.enemies]){
        if(!t) continue;
        const dirs=[[0,-1],[0,1],[-1,0],[1,0]];
        let trapped=true;
        for(let [dx,dy] of dirs){
            const tx=t.pos.x+dx*CELL_SIZE, ty=t.pos.y+dy*CELL_SIZE;
            let clear=true;
            for(let w of G.walls){ if(tx>=w.x&&tx<=w.x+w.w&&ty>=w.y&&ty<=w.y+w.h){ clear=false; break; } }
            if(clear){ trapped=false; break; }
        }
        if(trapped){
            log('warn','VALIDATE','Tank stuck! Repositioning...');
            for(let a=0;a<20;a++){
                const nx=CELL_SIZE*2+Math.random()*(CANVAS_WIDTH-CELL_SIZE*4);
                const ny=CELL_SIZE*2+Math.random()*(CANVAS_HEIGHT-CELL_SIZE*4);
                let valid=true;
                for(let w of G.walls){ if(nx>=w.x&&nx<=w.x+w.w&&ny>=w.y&&ny<=w.y+w.h){ valid=false; break; } }
                        if(valid){ t.pos=new Vector2(nx,ny); break; }
            }
        }
    }
}
