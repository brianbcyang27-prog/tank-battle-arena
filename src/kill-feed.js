import { CANVAS_WIDTH } from './config.js';
import { G } from './state.js';

const MAX_ENTRIES = 5;
const ENTRY_DURATION = 5;
const FADE_DURATION = 1;
const feed = [];

export function addKillEntry(killer, victim, weaponName) {
    feed.push({
        killer,
        victim,
        weapon: weaponName || 'CANNON',
        time: 0,
        id: feed.length
    });
    if (feed.length > MAX_ENTRIES) feed.shift();
}

export function addStreakEntry(killer, streakCount) {
    const labels = { 2: 'DOUBLE KILL', 3: 'TRIPLE KILL', 4: 'QUAD KILL', 5: 'PENTA KILL' };
    const text = labels[streakCount] || `${streakCount}x KILL`;
    feed.push({
        killer,
        victim: text,
        weapon: '',
        time: 0,
        isStreak: true,
        id: feed.length
    });
    if (feed.length > MAX_ENTRIES) feed.shift();
}

export function updateKillFeed(dt) {
    for (let i = feed.length - 1; i >= 0; i--) {
        feed[i].time += dt;
        if (feed[i].time > ENTRY_DURATION) feed.splice(i, 1);
    }
}

export function drawKillFeed(ctx) {
    if (feed.length === 0) return;
    const x = CANVAS_WIDTH - 260;
    const startY = 110;

    for (let i = 0; i < feed.length; i++) {
        const entry = feed[i];
        const age = entry.time / ENTRY_DURATION;
        let alpha = 1;
        if (age > 1 - FADE_DURATION / ENTRY_DURATION) {
            alpha = 1 - (age - (1 - FADE_DURATION / ENTRY_DURATION)) / (FADE_DURATION / ENTRY_DURATION);
        }
        alpha = Math.max(0, Math.min(1, alpha));
        const y = startY + i * 22;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.roundRect(x, y, 240, 20, 3);
        ctx.fill();

        ctx.textAlign = 'left';
        if (entry.isStreak) {
            ctx.font = 'bold 11px Orbitron, monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText(entry.killer, x + 6, y + 14);
            ctx.fillStyle = '#e74c3c';
            ctx.fillText(entry.victim, x + 6 + ctx.measureText(entry.killer).width + 6, y + 14);
        } else {
            ctx.font = '10px Orbitron, monospace';
            ctx.fillStyle = '#eaeaea';
            ctx.fillText(entry.killer, x + 6, y + 14);
            ctx.fillStyle = '#888';
            ctx.fillText(entry.weapon, x + 6 + ctx.measureText(entry.killer).width + 6, y + 14);
            ctx.fillStyle = '#e74c3c';
            const victimText = ' ' + entry.victim;
            ctx.fillText(victimText, x + 236 - ctx.measureText(victimText).width, y + 14);
        }
        ctx.restore();
    }
}
