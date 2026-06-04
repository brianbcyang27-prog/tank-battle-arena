import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, QL_PARAMS, ARCADE_WAVE } from './config.js';
import { G } from './state.js';
import { log } from './log.js';

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
    draw(){
        const c = G.stageColors || COLORS;
        G.ctx.fillStyle = c.wall || COLORS.wall;
        G.ctx.strokeStyle = c.wallBorder || COLORS.wallBorder;
        G.ctx.lineWidth = 2;
        G.ctx.fillRect(this.x,this.y,this.w,this.h);
        G.ctx.strokeRect(this.x,this.y,this.w,this.h);
    }
}

export class Particle {
    constructor(x,y,vx,vy,color,life){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.color=color; this.life=life; this.maxLife=life; this.size=3+Math.random()*4; }
    update(dt){ if(isNaN(this.x)||isNaN(this.y)){ this.life=0; return; } this.x+=this.vx*dt; this.y+=this.vy*dt; this.vx*=0.98; this.vy*=0.98; this.life-=dt; }
	draw(){ if(isNaN(this.x)||isNaN(this.y)||this.life<=0||this.maxLife<=0) return; const lifeRatio=this.life/this.maxLife; G.ctx.globalAlpha=Math.max(0,Math.min(1,lifeRatio)); G.ctx.fillStyle=this.color; G.ctx.beginPath(); G.ctx.arc(this.x,this.y,this.size*lifeRatio,0,Math.PI*2); G.ctx.fill(); G.ctx.globalAlpha=1; }
}

export class Bullet {
    constructor(x,y,vel,owner){
        this.pos=new Vector2(x,y); this.vel=vel; this.owner=owner;
        this.radius=5; this.alive=true; this.trail=[]; this.fbId=null;
        this.bounces = 0;
        this.damage=1; this.pierceCount=0; this._trailColor=null;
        // Weapon visual overrides (set by Player after construction)
        this.bulletColor = null;     // hex color override
        this.bulletSize = 1;         // radius multiplier
        this.trailEffect = 'normal';
        this.impactEffect = 'normal';
    }
    update(dt){
        if(!this.alive) return;
        const trLen = this.trailEffect === 'beam' ? 4 : this.trailEffect === 'scatter' ? 10 : 8;
        this.trail.push({x:this.pos.x,y:this.pos.y,a:1});
        if(this.trail.length>trLen) this.trail.shift();
        const fadeRate = this.trailEffect === 'beam' ? dt*5 : this.trailEffect === 'scatter' ? dt*2 : dt*3;
        for(let t of this.trail) t.a-=fadeRate;
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
    _getColor(){
        return this.bulletColor || this._trailColor || COLORS.bullet;
    }
    impact(){
        const c = this._getColor();
        const count = this.impactEffect === 'explosion' ? 14 : this.impactEffect === 'electric' ? 10 : this.impactEffect === 'spark' ? 8 : 5;
        const speedBase = this.impactEffect === 'explosion' ? 80 : this.impactEffect === 'electric' ? 100 : 45;
        const lifeBase = this.impactEffect === 'explosion' ? 0.5 : this.impactEffect === 'electric' ? 0.35 : 0.25;
        const sizeScale = this.impactEffect === 'explosion' ? 2 : 1;
        for(let i=0;i<count;i++){
            const a=Math.random()*Math.PI*2;
            const spd = speedBase + Math.random() * (this.impactEffect === 'electric' ? 150 : 60);
            const p = new Particle(this.pos.x,this.pos.y,Math.cos(a)*spd,Math.sin(a)*spd,c,lifeBase+Math.random()*lifeBase);
            p.size *= sizeScale;
            G.particles.push(p);
        }
        if(this.impactEffect === 'explosion'){
            for(let i=0;i<6;i++){
                const a=Math.random()*Math.PI*2;
                G.particles.push(new Particle(this.pos.x,this.pos.y,Math.cos(a)*(20+Math.random()*40),Math.sin(a)*(20+Math.random()*40),'#ff8c00',0.8+Math.random()*0.4));
            }
        }
    }
    checkCollision(tank){ if(tank===this.owner) return false; const d=this.pos.distanceTo(tank.pos); return d<this.radius+18; }
    draw(){
        if(!this.alive||isNaN(this.pos.x)||isNaN(this.pos.y)) return;
        const tc=this.bulletColor || this._trailColor;
        const ctx=G.ctx;
        // Trail
        for(let i=0;i<this.trail.length;i++){
            if(this.trail[i].a>0){
                const alpha = this.trailEffect === 'spark' ? this.trail[i].a*0.7 : this.trail[i].a*0.5;
                if(tc){
                    const r=parseInt(tc.slice(1,3),16), g=parseInt(tc.slice(3,5),16), b=parseInt(tc.slice(5,7),16);
                    ctx.fillStyle='rgba('+r+','+g+','+b+','+alpha+')';
                } else {
                    ctx.fillStyle='rgba(255,255,255,'+alpha+')';
                }
		const trLen = this.trail.length > 0 ? this.trail.length : 1;
		const tr = this.trailEffect === 'spark' ? this.radius * 0.5 * (i/trLen) :
		this.trailEffect === 'beam' ? this.radius * 0.9 :
		this.radius * (i/trLen);
                if(this.trailEffect === 'beam' && i === this.trail.length-1){
                    // Beam: draw line from pos to trail point
                    const prev = this.trail[i-1] || this.trail[i];
                    ctx.strokeStyle = tc || COLORS.bullet;
                    ctx.lineWidth = this.radius * 1.2;
                    ctx.globalAlpha = this.trail[i].a * 0.6;
                    ctx.beginPath(); ctx.moveTo(prev.x,prev.y); ctx.lineTo(this.trail[i].x,this.trail[i].y); ctx.stroke();
                    ctx.globalAlpha = 1;
                } else {
                    ctx.beginPath(); ctx.arc(this.trail[i].x,this.trail[i].y,tr,0,Math.PI*2); ctx.fill();
                }
            }
        }
        // Bullet body
        const color = this._getColor();
        ctx.fillStyle = color;
        const glowColor = this.impactEffect === 'electric' ? '#bb86fc' : this.impactEffect === 'explosion' ? '#ff6b35' : color;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = this.impactEffect === 'explosion' ? 18 : this.impactEffect === 'electric' ? 20 : 12;
        ctx.beginPath(); ctx.arc(this.pos.x,this.pos.y,this.radius,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;

        // Railgun/electric inner glow
        if(this.impactEffect === 'electric'){
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.6;
            ctx.beginPath(); ctx.arc(this.pos.x,this.pos.y,this.radius*0.4,0,Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
        }
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
	checkCollisionWithPlayer(p){ if(!p||!p.alive) return false; if(G.currentUser&&this.ownerUid===G.currentUser.uid) return false; const d=Math.sqrt((this.pos.x-p.pos.x)**2+(this.pos.y-p.pos.y)**2); return d<this.radius+18; }
    checkCollisionWithRemote(uid){ const rt=G.remoteTanks[uid]&&G.remoteTanks[uid].tank; if(!rt||!rt.alive) return false; if(this.ownerUid===uid) return false; const d=Math.sqrt((this.pos.x-rt.pos.x)**2+(this.pos.y-rt.pos.y)**2); return d<this.radius+18; }
    draw(){
        if(!this.alive||isNaN(this.pos.x)||isNaN(this.pos.y)) return;
	for(let i=0;i<this.trail.length;i++){ if(this.trail[i].a>0){ G.ctx.fillStyle='rgba(255,255,255,'+(this.trail[i].a*0.5)+')'; const trLen = this.trail.length > 0 ? this.trail.length : 1; G.ctx.beginPath(); G.ctx.arc(this.trail[i].x,this.trail[i].y,this.radius*(i/trLen),0,Math.PI*2); G.ctx.fill(); } }
        G.ctx.fillStyle=COLORS.bullet; G.ctx.beginPath(); G.ctx.arc(this.pos.x,this.pos.y,this.radius,0,Math.PI*2); G.ctx.fill();
    }
}

export class Tank {
    constructor(x,y,color,name=''){
        this.pos=new Vector2(x,y); this.vel=new Vector2();
        this.width=36; this.height=36; this.turretAngle=0;
        this.color=color; this.name=name; this.health=3; this.maxHealth=3;
        this.speed=200; this.fireRate=3; this.lastFire=0; this.alive=true;
        this.halfSize = 18;
        this.bodyAngle = 0;
        this.labelTime=3; this.damageFlash=0;
        // Skin visual properties (set by applyProgressionToPlayer)
        this.skinPattern = null;
        this.skinGlowColor = null;
        this.skinVisorColor = null;
        this.traceColor = 'rgba(60,55,50,0.12)';
        this.traceFade = false;
    }
    update(dt){
        this.pos=this.pos.add(this.vel.mul(dt));
        this.constrainToBounds();
        if(this.vel.length() > 5) this.bodyAngle = Math.atan2(this.vel.y, this.vel.x);
        if(this.labelTime>0) this.labelTime-=dt;
        if(this.damageFlash>0) this.damageFlash-=dt;
        if (this.vel.length() > 1) {
            const targetCtx = this.traceFade && G._fadeTraceCtx ? G._fadeTraceCtx : G._traceCtx;
            if (targetCtx) {
                targetCtx.fillStyle = this.traceColor;
                targetCtx.save();
                targetCtx.translate(this.pos.x, this.pos.y);
                targetCtx.rotate(this.bodyAngle);
                targetCtx.fillRect(-16, -14, 4, 28);
                targetCtx.fillRect(12, -14, 4, 28);
                targetCtx.restore();
            }
        }
    }
    constrainToBounds(){
        const h = this.halfSize;
        this.pos.x=Math.max(h,Math.min(CANVAS_WIDTH-h,this.pos.x));
        this.pos.y=Math.max(h,Math.min(CANVAS_HEIGHT-h,this.pos.y));
    }
    canFire(now){ return now-this.lastFire>=1000/this.fireRate; }
    fire(now,bulletSpeed=500){
        if(!this.canFire(now)) return null;
        this.lastFire=now;
        const d=new Vector2(Math.cos(this.turretAngle),Math.sin(this.turretAngle));
        return new Bullet(this.pos.x+d.x*25,this.pos.y+d.y*25,d.mul(bulletSpeed),this);
    }
    takeDamage(d=1){ if(G.safePeriod > 0 && this === G.player) return; this.health-=d; this.damageFlash=0.2; G.screenShake = 0.3; import('./audio.js').then(m => m.playHit()); if(this.health<=0){ this.alive=false; this.explode(); } }
    explode(){
        for(let i=0;i<20;i++){
            const a=Math.random()*Math.PI*2;
            G.particles.push(new Particle(this.pos.x,this.pos.y,Math.cos(a)*(50+Math.random()*150),Math.sin(a)*(50+Math.random()*150),this.color,0.5+Math.random()*0.5));
        }
    }
    draw(){
        const ctx = G.ctx;
        const shakeAmt = this.damageFlash > 0 ? this.damageFlash * 10 : 0;
        const shakeX = shakeAmt > 0 ? (Math.random()-0.5)*shakeAmt : 0;
        const shakeY = shakeAmt > 0 ? (Math.random()-0.5)*shakeAmt : 0;

        // Glow aura (behind tank body)
        if (this.skinGlowColor && this.damageFlash <= 0 && this === G.player) {
            const pulse = 0.3 + Math.sin(performance.now() / 300) * 0.2;
            ctx.save();
            ctx.globalAlpha = pulse * 0.35;
            ctx.shadowColor = this.skinGlowColor;
            ctx.shadowBlur = 24;
            ctx.fillStyle = this.skinGlowColor;
            ctx.beginPath();
            ctx.arc(this.pos.x + shakeX, this.pos.y + shakeY, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Tank body + turret
        ctx.save(); ctx.translate(this.pos.x + shakeX, this.pos.y + shakeY);
        ctx.rotate(this.bodyAngle);
        const flashColor = this.damageFlash > 0 ? '#ff6666' : this.color;

        // Body
        ctx.fillStyle=flashColor; ctx.strokeStyle='#000'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.roundRect(-18,-18,36,36,6); ctx.fill(); ctx.stroke();

        // Body pattern overlay
        if (this.damageFlash <= 0 && this.skinPattern) {
            this._drawSkinPattern(ctx);
        }

        // Visor dot on front of hull
        if (this.damageFlash <= 0 && this.skinVisorColor) {
            ctx.save();
            ctx.shadowColor = this.skinVisorColor;
            ctx.shadowBlur = 8;
            ctx.fillStyle = this.skinVisorColor;
            ctx.beginPath();
            ctx.arc(16, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Turret (independent rotation from body)
        ctx.rotate(this.turretAngle - this.bodyAngle);
        const turretColor = this.damageFlash > 0 ? '#ff6666' : this.color;
        ctx.strokeStyle = turretColor; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(22,0); ctx.stroke();

        // Turret glow overlay
        if (this.damageFlash <= 0 && this.skinGlowColor) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.shadowColor = this.skinGlowColor;
            ctx.shadowBlur = 10;
            ctx.strokeStyle = this.skinGlowColor;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(22,0); ctx.stroke();
            ctx.restore();
        }
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
        ctx.restore();

        // Safe period shield ring
        if(this === G.player && G.safePeriod > 0){
            const pulse = 0.5 + Math.sin(performance.now() / 100) * 0.5;
            ctx.save();
            ctx.strokeStyle = `rgba(100, 200, 255, ${pulse * 0.8})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, 28 + pulse * 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Health bar
        const barWidth = 36;
        const barHeight = 5;
        const barYOffset = 28;
        const barRadius = 2.5;
        const healthPercent = this.health / this.maxHealth;

        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(this.pos.x - barWidth/2, this.pos.y + barYOffset, barWidth, barHeight, barRadius);
        ctx.fill();
        const healthColor = healthPercent > 0.5 ? '#27ae60' : healthPercent > 0.25 ? '#f39c12' : '#e74c3c';
        const grad = ctx.createLinearGradient(this.pos.x - barWidth/2, 0, this.pos.x + barWidth/2, 0);
        grad.addColorStop(0, healthColor);
        grad.addColorStop(1, healthPercent > 0.5 ? '#2ecc71' : healthPercent > 0.25 ? '#f1c40f' : '#ff6b6b');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(this.pos.x - barWidth/2, this.pos.y + barYOffset, Math.max(barRadius, barWidth * healthPercent), barHeight, barRadius);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(this.pos.x - barWidth/2, this.pos.y + barYOffset, barWidth, barHeight, barRadius);
        ctx.stroke();

        // Name label
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
    _drawSkinPattern(ctx){
        switch(this.skinPattern){
            case 'carbon':
                ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1;
                for(let x=-12;x<=12;x+=8){ ctx.beginPath(); ctx.moveTo(x,-18); ctx.lineTo(x,18); ctx.stroke(); }
                for(let y=-12;y<=12;y+=8){ ctx.beginPath(); ctx.moveTo(-18,y); ctx.lineTo(18,y); ctx.stroke(); }
                break;
            case 'etched':
                ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
                ctx.beginPath(); ctx.moveTo(-12,-12); ctx.lineTo(12,12); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(12,-12); ctx.lineTo(-12,12); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-6,-18); ctx.lineTo(6,18); ctx.stroke();
                break;
            case 'circuit':
                ctx.strokeStyle='rgba(0,255,136,0.25)'; ctx.lineWidth=1;
                ctx.beginPath(); ctx.moveTo(-12,-12); ctx.lineTo(-4,-12); ctx.lineTo(-4,-4);
                ctx.lineTo(4,-4); ctx.lineTo(4,4); ctx.lineTo(12,4); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-12,12); ctx.lineTo(-4,12); ctx.lineTo(-4,4);
                ctx.lineTo(4,4); ctx.lineTo(4,-4); ctx.lineTo(12,-4); ctx.stroke();
                break;
            case 'flame':
                ctx.strokeStyle='rgba(255,200,0,0.2)'; ctx.lineWidth=1.5;
                for(let x=-10;x<=10;x+=10){
                    ctx.beginPath(); ctx.moveTo(x,14);
                    ctx.quadraticCurveTo(x-3,8,x,2);
                    ctx.quadraticCurveTo(x+3,-4,x,-10); ctx.stroke();
                }
                break;
            case 'stealth':
                ctx.fillStyle='rgba(0,0,0,0.2)';
                for(let x=-12;x<=12;x+=8)
                    for(let y=-12;y<=12;y+=8){ ctx.beginPath(); ctx.arc(x,y,1.5,0,Math.PI*2); ctx.fill(); }
                break;
            case 'crystal':
                ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1;
                ctx.beginPath(); ctx.moveTo(-18,-6); ctx.lineTo(-6,-18); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(6,-18); ctx.lineTo(18,-6); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-18,6); ctx.lineTo(-6,18); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(6,18); ctx.lineTo(18,6); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-12,-12); ctx.lineTo(12,12); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(12,-12); ctx.lineTo(-12,12); ctx.stroke();
                break;
        }
    }
    collidesWithWall(wall){
        const h = this.halfSize;
        return this.pos.x-h<wall.x+wall.w&&this.pos.x+h>wall.x&&this.pos.y-h<wall.y+wall.h&&this.pos.y+h>wall.y;
    }
}

export class Player extends Tank {
    constructor(x,y,name=''){
        super(x,y,COLORS.player,name);
        this.speed=200; this.fireRate=3; this.lastMine=0; this.lastSync=0;
        // Weapon stats (overridden by progression)
        this.bulletDamage=1; this.bulletSpread=0; this.bulletCount=1;
        this.bulletPiercing=false; this.bulletSpeed=500;
        this.bulletTrailColor=null;
        // Ammo / reload
        this.maxAmmo = 12;
        this.ammo = 12;
        this.reloading = false;
        this.reloadStart = 0;
        this.reloadDuration = 1200;
        // Weapon visual properties (set by progression)
        this.weaponId = 'standard';
        this.bulletColor = null;
        this.bulletSize = 1;
        this.bulletBounce = 0;
        this.bulletTrailEffect = 'normal';
        this.bulletImpactEffect = 'normal';
        this.recoil = 0;
        this.fuel = 100;
        this.maxFuel = 100;
        this.fuelConsumption = 20;
        this.fuelRegen = 30;
        this.mineRadius = 120;
        this.boostEnergy = 100;
        this.maxBoostEnergy = 100;
        // Grip: 1.0 = instant response, lower = more drift/slide
        this.grip = 0.5;
    }
    update(dt,now){
        let mx=0,my=0;
		if(G.keys['KeyW']) my-=1;
		if(G.keys['KeyS']) my+=1;
		if(G.keys['KeyA']) mx-=1;
		if(G.keys['KeyD']) mx+=1;
        let isMoving = mx!==0 || my!==0;

        // Grip-based momentum: lower grip = more drift/slide
        const target = new Vector2(mx,my).normalize().mul(this.speed);
        if (isMoving) {
            this.vel.x += (target.x - this.vel.x) * this.grip;
            this.vel.y += (target.y - this.vel.y) * this.grip;
        } else {
            this.vel.x *= (1 - this.grip * 0.5);
            this.vel.y *= (1 - this.grip * 0.5);
            if (Math.abs(this.vel.x) < 1) this.vel.x = 0;
            if (Math.abs(this.vel.y) < 1) this.vel.y = 0;
        }

        if (isMoving) {
            // Shift boost: drain boostEnergy for burst speed
            const shiftHeld = G.keys['ShiftLeft'] || G.keys['ShiftRight'];
            if (shiftHeld && this.boostEnergy > 0) {
                const BOOST_MULT = 1.8;
                const BOOST_DRAIN = 40;
                this.vel = this.vel.mul(BOOST_MULT);
                const MAX_BOOST_SPEED = 520;
                if (this.vel.length() > MAX_BOOST_SPEED) {
                    this.vel = this.vel.normalize().mul(MAX_BOOST_SPEED);
                }
                this.boostEnergy = Math.max(0, this.boostEnergy - BOOST_DRAIN * dt);
            }
            this.fuel=Math.max(0,this.fuel-this.fuelConsumption*dt);
            if(this.fuel<=0) this.vel=this.vel.mul(0.4);
        } else {
            this.fuel=Math.min(this.maxFuel,this.fuel+this.fuelRegen*dt);
        }
        this.turretAngle=Math.atan2(G.mouseY-this.pos.y,G.mouseX-this.pos.x);
        super.update(dt);
        for(let w of G.walls){ if(this.collidesWithWall(w)) resolveWallCollision(this,w); }
        if(G.mouseDown){
            if(!this.reloading && !this.canFire(now)) return;
            if(!this.reloading){
                if(this.ammo <= 0){
                    this.startReload(now);
                    return;
                }
                this.lastFire=now;
                this.ammo--;
                const baseAngle=this.turretAngle;
                for(let i=0;i<this.bulletCount;i++){
                    const spread=this.bulletCount>1?(i/(this.bulletCount-1)-0.5)*this.bulletSpread*2:0;
                    const angle=baseAngle+spread+(Math.random()-0.5)*this.bulletSpread*0.2;
                    const d=new Vector2(Math.cos(angle),Math.sin(angle));
                    const b=new Bullet(this.pos.x+d.x*25,this.pos.y+d.y*25,d.mul(this.bulletSpeed),this);
                    b.damage=this.bulletDamage;
                    b.pierceCount=this.bulletPiercing?999:0;
                    b._trailColor=this.bulletTrailColor;
                    b._isPlayerBullet=true;
                    // Weapon-specific visuals & bounce
                    b.bulletColor = this.bulletColor;
                    b.radius *= this.bulletSize;
                    b.bounces += this.bulletBounce || 0;
                    b.trailEffect = this.bulletTrailEffect || 'normal';
                    b.impactEffect = this.bulletImpactEffect || 'normal';
                    G.bullets.push(b);
                }
                if (this.recoil > 0) {
                    this.vel.x -= Math.cos(this.turretAngle) * this.recoil;
                    this.vel.y -= Math.sin(this.turretAngle) * this.recoil;
                }
                import('./audio.js').then(m => m.playShoot());
                import('./stats.js').then(m => m.recordShot());
                if(G.aiTracker) G.aiTracker.recordShot();
            }
        }
        // Auto-reload when empty
        if(this.ammo <= 0 && !this.reloading) this.startReload(now);
		if((G.keys['KeyR']) && !this.reloading && this.ammo < this.maxAmmo){
            this.startReload(now);
        }
        // Reload timer
        if(this.reloading && now - this.reloadStart >= this.reloadDuration){
            this.ammo = this.maxAmmo;
            this.reloading = false;
        }
		if((G.keys['KeyC'])&&now-this.lastMine>=1000&&G.mines.length<3){
            G.mines.push(new LandMine(this.pos.x,this.pos.y,this));
            this.lastMine=now;
            import('./audio.js').then(m => m.playMinePlace());
			log('info','MINE','Mine placed at '+Math.round(this.pos.x)+','+Math.round(this.pos.y));
            import('./stats.js').then(m => m.recordMinePlaced());
            if(G.aiTracker) G.aiTracker.recordMinePlaced();
        }
    }
    startReload(now){
        this.reloading = true;
        this.reloadStart = now;
        import('./audio.js').then(m => m.playReload());
    }
}

export function resolveWallCollision(tank,wall){
    const h = tank.halfSize;
    const ol=(tank.pos.x+h)-wall.x, or_=(wall.x+wall.w)-(tank.pos.x-h);
    const ot=(tank.pos.y+h)-wall.y, ob=(wall.y+wall.h)-(tank.pos.y-h);
    if(Math.min(ol,or_)<Math.min(ot,ob)){
        tank.pos.x=ol<or_?wall.x-h:wall.x+wall.w+h;
    } else {
        tank.pos.y=ot<ob?wall.y-h:wall.y+wall.h+h;
    }
}

export class Enemy extends Tank {
    constructor(x,y,tier,strategy=null){
        super(x,y,COLORS.enemies[Math.min(tier-1,3)]);
        this.tier=tier; this.speed=80+tier*20; this.fireRate=1+tier*0.3;
        this.accuracy=0.4+tier*0.15; this.health=1+Math.floor(tier/2); this.maxHealth=this.health;
        this.halfSize = 16 + tier * 2;
        this.aiTimer=0; this.aiState='wander'; this.targetPos=new Vector2(x,y);
        this.stuckTimer=0; this.lastPos=this.pos.clone();
        this.applyStrategy(strategy);
        // Q-learning integration (ARCADE mode)
        this._isQLearning = false;
        this._qlState = null;
        this._qlAction = null;
        this._accumulatedReward = 0;
    }
    applyStrategy(strategy){
        this._erratic=strategy?strategy.erraticMovement||0.3:0.3;
        this._flankPref=strategy?strategy.flanking||0.3:0.3;
        this._coverPref=strategy?strategy.coverUsage||0.3:0.3;
        this._mineAvoid=strategy?strategy.mineAvoidance||0.3:0.3;
        this._predictiveAim=strategy?strategy.predictiveAim||0.3:0.3;
        this._prefRange=strategy?strategy.preferredRange||400:400;
        this._aggression=strategy?strategy.aggression||0.5:0.5;
        if(strategy){
            this.speed*=(0.8+this._aggression*0.4);
            this.accuracy=Math.min(0.9,this.accuracy+this._predictiveAim*0.2);
        }
    }
    takeDamage(d = 1) {
        super.takeDamage(d);
        if (this._isQLearning) {
            this._accumulatedReward -= d;
            if (!this.alive) {
                this._accumulatedReward -= 5; // death penalty
                // Flush final learn step — learn with a terminal state signal
                if (G.arcadeQL && this._qlState !== null && this._qlAction !== null) {
                    G.arcadeQL.learn(this._qlState, this._qlAction, this._accumulatedReward, -1);
                }
                G.arcadeKills++;
            }
        }
    }

    update(dt,now){
        if(!G.player||!G.player.alive) return;
        this.aiTimer+=dt;
        if(this.aiTimer>0.5){
            this.aiTimer=0;
            if(this._isQLearning && G.arcadeQL) {
                this._qlUpdate();
            } else {
                this.updateAI();
            }
        }
        const tp=G.player.pos.sub(this.pos), dist=tp.length();
        if(dist<500&&this.hasLineOfSight()){
            if(G.player.vel.length()>5&&this._predictiveAim>0.2){
                const travelTime=dist/(300+this.tier*50);
                const predicted=G.player.pos.add(G.player.vel.mul(travelTime*this._predictiveAim));
                this.turretAngle=Math.atan2(predicted.y-this.pos.y,predicted.x-this.pos.x);
            } else {
                this.turretAngle=Math.atan2(tp.y,tp.x);
            }
            if(this.canFire(now)){
                this.turretAngle+=(Math.random()-0.5)*(1-this.accuracy)*0.5;
                const b=this.fire(now,300+this.tier*50); if(b) G.bullets.push(b);
            }
        }
        this.vel=this.targetPos.sub(this.pos).normalize().mul(this.speed);
        this._steerAwayFromWalls();
        if(this._mineAvoid>0.3) this._avoidMines();
        super.update(dt);
        for(let w of G.walls){ if(this.collidesWithWall(w)) resolveWallCollision(this,w); }
        if(this.pos.distanceTo(this.lastPos)<2){ this.stuckTimer+=dt; if(this.stuckTimer>0.8){ this.stuckTimer=0; this.targetPos=this._findOpenPosition(); this.aiState='wander'; } }
        else { this.stuckTimer=0; }
        this.lastPos=this.pos.clone();
    }
    _steerAwayFromWalls(){
        const la = 40 + this.halfSize * 2;
        const tp=this.vel.normalize().mul(la);
        const tx=this.pos.x+tp.x, ty=this.pos.y+tp.y;
        for(let w of G.walls){
            if(tx>w.x&&tx<w.x+w.w&&ty>w.y&&ty<w.y+w.h){
                const sc=new Vector2(-(w.y+w.h/2-this.pos.y),w.x+w.w/2-this.pos.x).normalize();
                this.vel=sc.mul(this.speed);
                break;
            }
        }
    }
    _avoidMines(){
        for(let m of G.mines){
            if(m.exploded) continue;
            if(this.pos.distanceTo(m.pos)<100){
                const away=this.pos.sub(m.pos).normalize();
                this.vel=this.vel.add(away.mul(this.speed*2)).normalize().mul(this.speed);
                break;
            }
        }
    }
    _findOpenPosition(){
        for(let a=0;a<20;a++){
            const nx=100+Math.random()*(CANVAS_WIDTH-200);
            const ny=100+Math.random()*(CANVAS_HEIGHT-200);
            let valid=true;
            for(let w of G.walls){ if(nx>w.x&&nx<w.x+w.w&&ny>w.y&&ny<w.y+w.h){ valid=false; break; } }
            if(valid) return new Vector2(nx,ny);
        }
        return new Vector2(100+Math.random()*(CANVAS_WIDTH-200),100+Math.random()*(CANVAS_HEIGHT-200));
    }
    updateAI(){
        if(!G.player||!G.player.alive) return;
        const d=this.pos.distanceTo(G.player.pos);
        const roll=Math.random();
        if(d<this._prefRange*0.6){
            if(roll<this._flankPref) this.aiState='flank';
            else if(roll<this._flankPref+0.3) this.aiState='retreat';
            else this.aiState=this._erratic>0.5?'erratic':'strafe';
        } else if(d<this._prefRange*1.4){
            if(roll<this._aggression*0.6) this.aiState='strafe';
            else if(roll<this._aggression) this.aiState='approach';
            else if(roll<this._aggression+this._flankPref*0.5) this.aiState='flank';
            else this.aiState=this._erratic>0.5?'erratic':'wander';
        } else {
            if(roll<this._flankPref*0.5) this.aiState='flank';
            else if(this._coverPref>0.5&&this._hasNearbyCover()) this.aiState='approach_cover';
            else this.aiState='approach';
        }
        switch(this.aiState){
            case 'approach': this.targetPos=G.player.pos.clone(); break;
            case 'approach_cover': this.targetPos=this._findCoverPosition(G.player.pos); break;
            case 'retreat':{
                let rp=this.pos.add(this.pos.sub(G.player.pos).normalize().mul(200));
                if(this._erratic>0.3) rp=rp.add(new Vector2((Math.random()-0.5)*100*this._erratic,(Math.random()-0.5)*100*this._erratic));
                this.targetPos=rp;
                break;
            }
            case 'flank':{
                const tp=G.player.pos.sub(this.pos).normalize();
                const fd=new Vector2(-tp.y,tp.x);
                const lp=this.pos.add(fd.mul(150)), rp=this.pos.add(fd.mul(-150));
                this.targetPos=this._countWallsNear(lp)<this._countWallsNear(rp)?lp:rp;
                this.targetPos=this.targetPos.add(tp.mul(50));
                break;
            }
            case 'erratic':{
                this.targetPos=new Vector2(
                    Math.max(60,Math.min(CANVAS_WIDTH-60,this.pos.x+(Math.random()-0.5)*300)),
                    Math.max(60,Math.min(CANVAS_HEIGHT-60,this.pos.y+(Math.random()-0.5)*300))
                );
                break;
            }
            case 'strafe':{
                const sd=new Vector2(-(G.player.pos.y-this.pos.y),G.player.pos.x-this.pos.x).normalize();
                this.targetPos=this.pos.add(sd.mul(150*(Math.random()<0.5?1:-1)));
                break;
            }
            default: if(Math.random()<0.3) this.targetPos=this._findOpenPosition(); break;
        }
        for(let w of G.walls){
            if(this.targetPos.x>w.x&&this.targetPos.x<w.x+w.w&&this.targetPos.y>w.y&&this.targetPos.y<w.y+w.h){
                this.targetPos=this._findOpenPosition();
                break;
            }
        }
    }
    // Q-learning integration — called every AI tick for ARCADE mode enemies
    _qlUpdate() {
        if (!G.player || !G.player.alive) return;
        if (!G.arcadeQL) return;

        // Discretize current state
        const dist = this.pos.distanceTo(G.player.pos);
        const playerHpPct = G.player.health / G.player.maxHealth;
        const enemyHpPct = this.health / this.maxHealth;
        const numAllies = G.enemies.filter(e => e !== this && e.alive).length;
        const newState = G.arcadeQL.getState(dist, playerHpPct, enemyHpPct, numAllies);

        // Learn from previous step using accumulated reward
        if (this._qlState !== null && this._qlAction !== null) {
            G.arcadeQL.learn(this._qlState, this._qlAction, this._accumulatedReward, newState);
        }

        // Select next action
        const action = G.arcadeQL.selectAction(newState);
        this._qlState = newState;
        this._qlAction = action;
        this._accumulatedReward = 0;

        // Map action code to aiState
        import('./arcade-ai.js').then(m => {
            this.aiState = m.QL_ACTION_NAMES[action];
        });
        // also set it synchronously since we have the mapping locally
        const names = ['approach', 'retreat', 'strafe', 'erratic', 'flank'];
        this.aiState = names[action] || 'approach';

        // Let standard updateAI handle target positioning based on aiState
        // Call updateAI's switch logic directly
        this._applyQLTarget();
    }

    // Apply target position based on current aiState (same logic as updateAI switch)
    _applyQLTarget() {
        if (!G.player) return;
        switch (this.aiState) {
            case 'approach': this.targetPos = G.player.pos.clone(); break;
            case 'retreat': {
                let rp = this.pos.add(this.pos.sub(G.player.pos).normalize().mul(200));
                this.targetPos = rp;
                break;
            }
            case 'strafe': {
                const sd = new Vector2(-(G.player.pos.y - this.pos.y), G.player.pos.x - this.pos.x).normalize();
                this.targetPos = this.pos.add(sd.mul(150 * (Math.random() < 0.5 ? 1 : -1)));
                break;
            }
            case 'erratic': {
                this.targetPos = new Vector2(
                    Math.max(60, Math.min(CANVAS_WIDTH - 60, this.pos.x + (Math.random() - 0.5) * 300)),
                    Math.max(60, Math.min(CANVAS_HEIGHT - 60, this.pos.y + (Math.random() - 0.5) * 300))
                );
                break;
            }
            case 'flank': {
                const tp = G.player.pos.sub(this.pos).normalize();
                const fd = new Vector2(-tp.y, tp.x);
                const lp = this.pos.add(fd.mul(150));
                const rp = this.pos.add(fd.mul(-150));
                this.targetPos = this._countWallsNear(lp) < this._countWallsNear(rp) ? lp : rp;
                this.targetPos = this.targetPos.add(tp.mul(50));
                break;
            }
            default: break;
        }
        // Validate target
        for (let w of G.walls) {
            if (this.targetPos.x > w.x && this.targetPos.x < w.x + w.w && this.targetPos.y > w.y && this.targetPos.y < w.y + w.h) {
                this.targetPos = this._findOpenPosition();
                break;
            }
        }
    }

    _countWallsNear(pos){
        let c=0;
        for(let w of G.walls){ if(Math.abs(pos.x-(w.x+w.w/2))<100&&Math.abs(pos.y-(w.y+w.h/2))<100) c++; }
        return c;
    }
    _hasNearbyCover(){
        let c=0;
        for(let w of G.walls){ if(Math.abs(this.pos.x-(w.x+w.w/2))<200&&Math.abs(this.pos.y-(w.y+w.h/2))<200) c++; }
        return c>=2;
    }
    _findCoverPosition(target){
        let best=this.pos.clone(), bestScore=-Infinity;
        for(let w of G.walls){
            const cx=w.x+w.w/2, cy=w.y+w.h/2;
            if(this.pos.distanceTo({x:cx,y:cy})>300) continue;
            const wt=new Vector2(target.x-cx,target.y-cy).normalize();
            const behind=new Vector2(cx-wt.x*50,cy-wt.y*50);
            const s=-this.pos.distanceTo(behind);
            if(s>bestScore){ bestScore=s; best=behind; }
        }
        return best;
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
    draw(){
        const ctx = G.ctx;
        const baseSize = 18 + this.tier * 2;
        const turretLen = 22 + this.tier * 2;
        const shakeAmt = this.damageFlash > 0 ? this.damageFlash * 10 : 0;
        const shakeX = shakeAmt > 0 ? (Math.random()-0.5)*shakeAmt : 0;
        const shakeY = shakeAmt > 0 ? (Math.random()-0.5)*shakeAmt : 0;
        ctx.save(); ctx.translate(this.pos.x + shakeX, this.pos.y + shakeY);
        ctx.rotate(this.bodyAngle);
        const flashColor = this.damageFlash > 0 ? '#ff6666' : this.color;
        if(this.tier >= 3){
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 15;
        }
        ctx.fillStyle = flashColor; ctx.strokeStyle = this.tier >= 2 ? '#fff' : '#000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-baseSize,-baseSize,baseSize*2,baseSize*2,6); ctx.fill(); ctx.stroke();
        if(this.tier >= 3){ ctx.shadowBlur = 0; }
        ctx.rotate(this.turretAngle - this.bodyAngle);
        ctx.strokeStyle = flashColor; ctx.lineWidth = 5 + this.tier; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(turretLen,0); ctx.stroke();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0,0,5+this.tier,0,Math.PI*2); ctx.fill();
        ctx.restore();
        const barWidth = baseSize * 2;
        const barHeight = 5;
        const barYOffset = baseSize + 12;
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.pos.x - barWidth/2, this.pos.y + barYOffset, barWidth, barHeight);
        const healthColor = healthPercent > 0.5 ? '#27ae60' : healthPercent > 0.25 ? '#f39c12' : '#e74c3c';
        ctx.fillStyle = healthColor;
        ctx.fillRect(this.pos.x - barWidth/2, this.pos.y + barYOffset, barWidth * healthPercent, barHeight);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
        ctx.strokeRect(this.pos.x - barWidth/2, this.pos.y + barYOffset, barWidth, barHeight);
    }
}

export class LandMine {
    constructor(x,y,placer=null){
        this.pos=new Vector2(x,y); this.radius=12;
        this.lifeTimer=0; this.blinkTimer=0; this.blinkState=false;
        this.exploded=false;
        this.explosionRadius = (placer && placer.mineRadius) ? placer.mineRadius : 120;
        this.armed=true;
        this.placer=placer;
    }
    update(dt){
        if(this.exploded) return;
        this.blinkTimer+=dt;
        if(this.blinkTimer>=0.5){ this.blinkTimer=0; this.blinkState=!this.blinkState; }
    }
    checkCollision(tank){ if(this.exploded) return false; return this.pos.distanceTo(tank.pos)<this.radius+18; }
    explode(){
        this.exploded=true;
        import('./audio.js').then(m => m.playExplosion());
		log('info','MINE','Mine exploded!');
        for(let i=0;i<30;i++){ const a=Math.random()*Math.PI*2; G.particles.push(new Particle(this.pos.x,this.pos.y,Math.cos(a)*(100+Math.random()*200),Math.sin(a)*(100+Math.random()*200),COLORS.explosion,0.8+Math.random()*0.4)); }
        for(let i=G.walls.length-1;i>=0;i--){ if(this.pos.distanceTo(new Vector2(G.walls[i].x+G.walls[i].w/2,G.walls[i].y+G.walls[i].h/2))<this.explosionRadius) G.walls.splice(i,1); }
        for(let t of [G.player,...G.enemies]){ if(t&&t.alive&&this.pos.distanceTo(t.pos)<this.explosionRadius){ t.takeDamage(10); } }
        // Remote tanks in multiplayer
        if(G.isMultiplayerGame){
            for(let uid in G.remoteTanks){
                const rt=G.remoteTanks[uid].tank;
                if(rt&&rt.alive&&this.pos.distanceTo(rt.pos)<this.explosionRadius) rt.takeDamage(10);
            }
        }
    }
    draw(){
        if(this.exploded) return;
        G.ctx.fillStyle='rgba(255,50,0,0.07)'; G.ctx.beginPath(); G.ctx.arc(this.pos.x,this.pos.y,this.explosionRadius,0,Math.PI*2); G.ctx.fill();
        G.ctx.strokeStyle='rgba(255,50,0,0.15)'; G.ctx.lineWidth=1; G.ctx.beginPath(); G.ctx.arc(this.pos.x,this.pos.y,this.explosionRadius,0,Math.PI*2); G.ctx.stroke();
        G.ctx.fillStyle=this.blinkState?COLORS.mineDanger:COLORS.mine;
        G.ctx.beginPath(); G.ctx.arc(this.pos.x,this.pos.y,this.radius,0,Math.PI*2); G.ctx.fill();
        G.ctx.strokeStyle=this.blinkState?'#ff0000':'#ffff00'; G.ctx.lineWidth=2; G.ctx.beginPath(); G.ctx.arc(this.pos.x,this.pos.y,this.radius+4,0,Math.PI*2); G.ctx.stroke();
    }
}
