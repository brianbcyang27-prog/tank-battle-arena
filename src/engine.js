import { CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE, COLORS } from './config.js';
import { G } from './state.js';

export class Vector2 {
    constructor(x=0,y=0){ this.x=x; this.y=y; }
    add(v){ return new Vector2(this.x+v.x,this.y+v.y); }
    sub(v){ return new Vector2(this.x-v.x,this.y-v.y); }
    mul(s){ return new Vector2(this.x*s,this.y*s); }
    length(){ return Math.sqrt(this.x*this.x+this.y*this.y); }
    normalize(){ const l=this.length(); return l<0.0001?new Vector2():new Vector2(this.x/l,this.y/l); }
    distanceTo(v){ return this.sub(v).length(); }
    clone(){ return new Vector2(this.x,this.y); }
}

export class Wall {
    constructor(x,y,w,h){ this.x=x; this.y=y; this.w=w; this.h=h; }
    draw(){ G.ctx.fillStyle=COLORS.wall; G.ctx.strokeStyle=COLORS.wallBorder; G.ctx.lineWidth=2; G.ctx.fillRect(this.x,this.y,this.w,this.h); G.ctx.strokeRect(this.x,this.y,this.w,this.h); }
}

export class Particle {
    constructor(x,y,vx,vy,color,life){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.color=color; this.life=life; this.maxLife=life; this.size=3+Math.random()*4; }
    update(dt){ if(isNaN(this.x)||isNaN(this.y)){ this.life=0; return; } this.x+=this.vx*dt; this.y+=this.vy*dt; this.vx*=0.98; this.vy*=0.98; this.life-=dt; }
    draw(){ if(isNaN(this.x)||isNaN(this.y)||this.life<=0) return; G.ctx.globalAlpha=Math.max(0,Math.min(1,this.life/this.maxLife)); G.ctx.fillStyle=this.color; G.ctx.beginPath(); G.ctx.arc(this.x,this.y,this.size*(this.life/this.maxLife),0,Math.PI*2); G.ctx.fill(); G.ctx.globalAlpha=1; }
}

export class Bullet {
    constructor(x,y,vel,owner){
        this.pos=new Vector2(x,y); this.vel=vel; this.owner=owner;
        this.radius=5; this.alive=true; this.trail=[]; this.fbId=null;
        this.bounces = G.settings ? (G.settings.bulletBounce || 0) : 0;
    }
    update(dt){
        if(!this.alive) return;
        this.trail.push({x:this.pos.x,y:this.pos.y,a:1}); if(this.trail.length>8) this.trail.shift();
        for(let t of this.trail) t.a-=dt*3;
        this.pos=this.pos.add(this.vel.mul(dt));
        if(isNaN(this.pos.x)||isNaN(this.pos.y)){ this.alive=false; return; }
        if(this.pos.x+this.radius<0||this.pos.x-this.radius>CANVAS_WIDTH||this.pos.y+this.radius<0||this.pos.y-this.radius>CANVAS_HEIGHT){ this.alive=false; return; }
        for(let w of G.walls){
            if(this.pos.x+this.radius>w.x&&this.pos.x-this.radius<w.x+w.w&&this.pos.y+this.radius>w.y&&this.pos.y-this.radius<w.y+w.h){
                if(this.bounces>0){
                    this.bounce(w);
                } else {
                    this.alive=false; this.impact();
                }
                break;
            }
        }
    }
    bounce(wall){
        this.bounces--;
        this.impact();
        const overlapLeft = (this.pos.x+this.radius)-wall.x;
        const overlapRight = (wall.x+wall.w)-(this.pos.x-this.radius);
        const overlapTop = (this.pos.y+this.radius)-wall.y;
        const overlapBottom = (wall.y+wall.h)-(this.pos.y-this.radius);
        const minX = Math.min(overlapLeft, overlapRight);
        const minY = Math.min(overlapTop, overlapBottom);
        if(minX < minY){
            this.vel.x *= -1;
            this.pos.x = overlapLeft < overlapRight ? wall.x - this.radius : wall.x + wall.w + this.radius;
        } else {
            this.vel.y *= -1;
            this.pos.y = overlapTop < overlapBottom ? wall.y - this.radius : wall.y + wall.h + this.radius;
        }
        if(isNaN(this.pos.x)||isNaN(this.pos.y)) this.alive=false;
    }
    impact(){ for(let i=0;i<5;i++){ const a=Math.random()*Math.PI*2; G.particles.push(new Particle(this.pos.x,this.pos.y,Math.cos(a)*(30+Math.random()*60),Math.sin(a)*(30+Math.random()*60),'#ffffff',0.2+Math.random()*0.2)); } }
    checkCollision(tank){ if(tank===this.owner) return false; const d=this.pos.distanceTo(tank.pos); return d<this.radius+18; }
    draw(){
        if(!this.alive||isNaN(this.pos.x)||isNaN(this.pos.y)) return;
        for(let i=0;i<this.trail.length;i++){ if(this.trail[i].a>0){ G.ctx.fillStyle='rgba(255,255,255,'+(this.trail[i].a*0.5)+')'; G.ctx.beginPath(); G.ctx.arc(this.trail[i].x,this.trail[i].y,this.radius*(i/this.trail.length),0,Math.PI*2); G.ctx.fill(); } }
        G.ctx.fillStyle=COLORS.bullet; G.ctx.beginPath(); G.ctx.arc(this.pos.x,this.pos.y,this.radius,0,Math.PI*2); G.ctx.fill();
    }
}

export class SimpleBullet {
    constructor(x,y,vx,vy,ownerUid){ this.pos={x,y}; this.vel={x:vx,y:vy}; this.ownerUid=ownerUid; this.radius=5; this.alive=true; this.trail=[]; }
    update(dt){
        if(!this.alive) return;
        this.trail.push({x:this.pos.x,y:this.pos.y,a:1}); if(this.trail.length>8) this.trail.shift();
        for(let t of this.trail) t.a-=dt*3;
        this.pos.x+=this.vel.x*dt; this.pos.y+=this.vel.y*dt;
        if(isNaN(this.pos.x)||isNaN(this.pos.y)){ this.alive=false; return; }
        if(this.pos.x<0||this.pos.x>CANVAS_WIDTH||this.pos.y<0||this.pos.y>CANVAS_HEIGHT){ this.alive=false; return; }
        for(let w of G.walls){
            if(this.pos.x>w.x&&this.pos.x<w.x+w.w&&this.pos.y>w.y&&this.pos.y<w.y+w.h){ this.alive=false; break; }
        }
    }
    checkCollisionWithPlayer(p){ if(!p||!p.alive) return false; if(this.ownerUid===G.currentUser.uid) return false; const d=Math.sqrt((this.pos.x-p.pos.x)**2+(this.pos.y-p.pos.y)**2); return d<this.radius+18; }
    checkCollisionWithRemote(uid){ const rt=G.remoteTanks[uid]&&G.remoteTanks[uid].tank; if(!rt||!rt.alive) return false; if(this.ownerUid===uid) return false; const d=Math.sqrt((this.pos.x-rt.pos.x)**2+(this.pos.y-rt.pos.y)**2); return d<this.radius+18; }
    draw(){
        if(!this.alive||isNaN(this.pos.x)||isNaN(this.pos.y)) return;
        for(let i=0;i<this.trail.length;i++){ if(this.trail[i].a>0){ G.ctx.fillStyle='rgba(255,255,255,'+(this.trail[i].a*0.5)+')'; G.ctx.beginPath(); G.ctx.arc(this.trail[i].x,this.trail[i].y,this.radius*(i/this.trail.length),0,Math.PI*2); G.ctx.fill(); } }
        G.ctx.fillStyle=COLORS.bullet; G.ctx.beginPath(); G.ctx.arc(this.pos.x,this.pos.y,this.radius,0,Math.PI*2); G.ctx.fill();
    }
}

export class Tank {
    constructor(x,y,color,name=''){
        this.pos=new Vector2(x,y); this.vel=new Vector2();
        this.width=36; this.height=36; this.turretAngle=0;
        this.color=color; this.name=name; this.health=3; this.maxHealth=3;
        this.speed=200; this.fireRate=3; this.lastFire=0; this.alive=true;
        this.labelTime=3;
    }
    update(dt){ this.pos=this.pos.add(this.vel.mul(dt)); this.constrainToBounds(); if(this.labelTime>0) this.labelTime-=dt; }
    constrainToBounds(){
        this.pos.x=Math.max(18,Math.min(CANVAS_WIDTH-18,this.pos.x));
        this.pos.y=Math.max(18,Math.min(CANVAS_HEIGHT-18,this.pos.y));
    }
    canFire(now){ return now-this.lastFire>=1000/this.fireRate; }
    fire(now,bulletSpeed=500){
        if(!this.canFire(now)) return null;
        this.lastFire=now;
        const d=new Vector2(Math.cos(this.turretAngle),Math.sin(this.turretAngle));
        return new Bullet(this.pos.x+d.x*25,this.pos.y+d.y*25,d.mul(bulletSpeed),this);
    }
    takeDamage(d=1){ this.health-=d; if(this.health<=0){ this.alive=false; this.explode(); } }
    explode(){
        for(let i=0;i<20;i++){
            const a=Math.random()*Math.PI*2;
            G.particles.push(new Particle(this.pos.x,this.pos.y,Math.cos(a)*(50+Math.random()*150),Math.sin(a)*(50+Math.random()*150),this.color,0.5+Math.random()*0.5));
        }
    }
    draw(){
        const ctx = G.ctx;
        ctx.save(); ctx.translate(this.pos.x,this.pos.y);
        ctx.fillStyle=this.color; ctx.strokeStyle='#000'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.roundRect(-18,-18,36,36,6); ctx.fill(); ctx.stroke();
        ctx.rotate(this.turretAngle);
        ctx.strokeStyle=this.color; ctx.lineWidth=6; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(22,0); ctx.stroke();
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
        ctx.restore();

        const barWidth = 36;
        const barHeight = 5;
        const barYOffset = 28;
        const healthPercent = this.health / this.maxHealth;

        ctx.fillStyle = '#333';
        ctx.fillRect(this.pos.x - barWidth/2, this.pos.y + barYOffset, barWidth, barHeight);
        const healthColor = healthPercent > 0.5 ? '#27ae60' : healthPercent > 0.25 ? '#f39c12' : '#e74c3c';
        ctx.fillStyle = healthColor;
        ctx.fillRect(this.pos.x - barWidth/2, this.pos.y + barYOffset, barWidth * healthPercent, barHeight);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.pos.x - barWidth/2, this.pos.y + barYOffset, barWidth, barHeight);

        if(this.name && this.labelTime > 0){
            ctx.save();
            ctx.globalAlpha = Math.min(1, this.labelTime);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Orbitron, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.pos.x, this.pos.y - 32);
            ctx.restore();
        }
    }
}

export class Player extends Tank {
    constructor(x,y,name=''){ super(x,y,COLORS.player,name); this.speed=200; this.fireRate=3; this.lastMine=0; this.lastSync=0; }
    update(dt,now){
        let mx=0,my=0;
        if(G.keys['w']||G.keys['KeyW']) my-=1;
        if(G.keys['s']||G.keys['KeyS']) my+=1;
        if(G.keys['a']||G.keys['KeyA']) mx-=1;
        if(G.keys['d']||G.keys['KeyD']) mx+=1;
        this.vel=new Vector2(mx,my).normalize().mul(this.speed);
        this.turretAngle=Math.atan2(G.mouseY-this.pos.y,G.mouseX-this.pos.x);
        super.update(dt);
        for(let w of G.walls){ if(this.collidesWithWall(w)) resolveWallCollision(this,w); }
        if(G.mouseDown){
            const b=this.fire(now);
            if(b){
                b._isPlayerBullet = true;
                G.bullets.push(b);
                import('./stats.js').then(m => m.recordShot());
            }
        }
        if((G.keys['c']||G.keys['KeyC'])&&now-this.lastMine>=1000&&G.mines.length<3){
            G.mines.push(new LandMine(this.pos.x,this.pos.y,this));
            this.lastMine=now;
            window.log('info','MINE','Mine placed at '+Math.round(this.pos.x)+','+Math.round(this.pos.y));
            import('./stats.js').then(m => m.recordMinePlaced());
        }
    }
    collidesWithWall(wall){
        return this.pos.x-18<wall.x+wall.w&&this.pos.x+18>wall.x&&this.pos.y-18<wall.y+wall.h&&this.pos.y+18>wall.y;
    }
}

export function resolveWallCollision(tank,wall){
    const ol=(tank.pos.x+18)-wall.x, or_=(wall.x+wall.w)-(tank.pos.x-18);
    const ot=(tank.pos.y+18)-wall.y, ob=(wall.y+wall.h)-(tank.pos.y-18);
    if(Math.min(ol,or_)<Math.min(ot,ob)){
        tank.pos.x=ol<or_?wall.x-18:wall.x+wall.w+18;
    } else {
        tank.pos.y=ot<ob?wall.y-18:wall.y+wall.h+18;
    }
}

export class Enemy extends Tank {
    constructor(x,y,tier){
        super(x,y,COLORS.enemies[Math.min(tier-1,3)]);
        this.tier=tier; this.speed=80+tier*20; this.fireRate=1+tier*0.3;
        this.accuracy=0.4+tier*0.15; this.health=1+Math.floor(tier/2); this.maxHealth=this.health;
        this.aiTimer=0; this.aiState='wander'; this.targetPos=new Vector2(x,y);
        this.stuckTimer=0; this.lastPos=this.pos.clone();
    }
    update(dt,now){
        if(!G.player||!G.player.alive) return;
        this.aiTimer+=dt;
        if(this.aiTimer>0.5){ this.aiTimer=0; this.updateAI(); }
        const tp=G.player.pos.sub(this.pos), dist=tp.length();
        if(dist<500&&this.hasLineOfSight()){
            this.turretAngle=Math.atan2(tp.y,tp.x);
            if(this.canFire(now)){
                this.turretAngle+=(Math.random()-0.5)*(1-this.accuracy)*0.5;
                const b=this.fire(now,300+this.tier*50); if(b) G.bullets.push(b);
            }
        }
        this.vel=this.targetPos.sub(this.pos).normalize().mul(this.speed);
        super.update(dt);
        for(let w of G.walls){ if(this.collidesWithWall(w)) resolveWallCollision(this,w); }
        if(this.pos.distanceTo(this.lastPos)<2){ this.stuckTimer+=dt; if(this.stuckTimer>1){ this.stuckTimer=0; this.targetPos=this.randomPos(); } }
        else { this.stuckTimer=0; }
        this.lastPos=this.pos.clone();
    }
    collidesWithWall(wall){ return this.pos.x-18<wall.x+wall.w&&this.pos.x+18>wall.x&&this.pos.y-18<wall.y+wall.h&&this.pos.y+18>wall.y; }
    updateAI(){
        if(!G.player||!G.player.alive) return;
        const d=this.pos.distanceTo(G.player.pos);
        if(d<300&&Math.random()<0.7) this.aiState='retreat';
        else if(d<400) this.aiState=Math.random()<0.6?'strafe':'wander';
        else this.aiState=Math.random()<0.5?'approach':'wander';
        switch(this.aiState){
            case 'approach': this.targetPos=G.player.pos.clone(); break;
            case 'retreat': this.targetPos=this.pos.add(this.pos.sub(G.player.pos).normalize().mul(200)); break;
            case 'strafe': this.targetPos=this.pos.add(new Vector2(-(G.player.pos.y-this.pos.y),G.player.pos.x-this.pos.x).normalize().mul(150*(Math.random()<0.5?1:-1))); break;
            default: if(Math.random()<0.3) this.targetPos=this.randomPos(); break;
        }
    }
    randomPos(){ return new Vector2(100+Math.random()*(CANVAS_WIDTH-200),100+Math.random()*(CANVAS_HEIGHT-200)); }
    hasLineOfSight(){
        const d=G.player.pos.sub(this.pos).normalize();
        const dist=this.pos.distanceTo(G.player.pos);
        for(let i=1;i<dist/20;i++){
            const cp=this.pos.add(d.mul(i*20));
            for(let w of G.walls){ if(cp.x>w.x&&cp.x<w.x+w.w&&cp.y>w.y&&cp.y<w.y+w.h) return false; }
        }
        return true;
    }
}

export class LandMine {
    constructor(x,y,placer=null){
        this.pos=new Vector2(x,y); this.radius=12;
        this.lifeTimer=0; this.blinkTimer=0; this.blinkState=false;
        this.exploded=false; this.explosionRadius=120;
        this.armed=true;
        this.placer=placer;
    }
    update(dt){
        if(this.exploded) return;
        this.lifeTimer+=dt;
        this.blinkTimer+=dt;
        if(this.blinkTimer>=0.5){ this.blinkTimer=0; this.blinkState=!this.blinkState; }
        if(this.lifeTimer>=3) this.explode();
    }
    checkCollision(tank){ if(this.exploded) return false; if(tank===this.placer) return false; return this.pos.distanceTo(tank.pos)<this.radius+18; }
    explode(){
        this.exploded=true;
        window.log('info','MINE','Mine exploded!');
        for(let i=0;i<30;i++){ const a=Math.random()*Math.PI*2; G.particles.push(new Particle(this.pos.x,this.pos.y,Math.cos(a)*(100+Math.random()*200),Math.sin(a)*(100+Math.random()*200),COLORS.explosion,0.8+Math.random()*0.4)); }
        for(let i=G.walls.length-1;i>=0;i--){ if(this.pos.distanceTo(new Vector2(G.walls[i].x+G.walls[i].w/2,G.walls[i].y+G.walls[i].h/2))<this.explosionRadius) G.walls.splice(i,1); }
        for(let t of [G.player,...G.enemies]){ if(t&&t.alive&&this.pos.distanceTo(t.pos)<this.explosionRadius) t.takeDamage(10); }
    }
    draw(){
        if(this.exploded) return;
        G.ctx.fillStyle=this.blinkState?COLORS.mineDanger:COLORS.mine;
        G.ctx.beginPath(); G.ctx.arc(this.pos.x,this.pos.y,this.radius,0,Math.PI*2); G.ctx.fill();
        G.ctx.strokeStyle=this.blinkState?'#ff0000':'#ffff00'; G.ctx.lineWidth=2; G.ctx.beginPath(); G.ctx.arc(this.pos.x,this.pos.y,this.radius+4,0,Math.PI*2); G.ctx.stroke();
    }
}
