// Spatial audio — position-based sound panning using Web Audio API
import { G } from './state.js';

let audioCtx = null;

function getContext() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
            return null;
        }
    }
    return audioCtx;
}

// Pan a short sound based on source position relative to player
export function playSoundAt(frequency, duration, sourceX, sourceY, volume = 0.3) {
    const ctx = getContext();
    if (!ctx || !G.player) return;

    const dx = sourceX - G.player.pos.x;
    const dy = sourceY - G.player.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Pan: left channel when source is left of player, etc.
    const panValue = Math.max(-1, Math.min(1, dx / 600));

    // Volume falloff with distance
    const maxDist = 800;
    const distFactor = Math.max(0, 1 - dist / maxDist);
    const finalVolume = volume * distFactor;

    if (finalVolume < 0.01) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(finalVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    panner.pan.setValueAtTime(panValue, ctx.currentTime);

    osc.connect(panner);
    panner.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
}

export function playExplosionAt(x, y) {
    playSoundAt(80, 0.4, x, y, 0.4);
}

export function playImpactAt(x, y) {
    playSoundAt(300, 0.1, x, y, 0.2);
}

export function playShotAt(x, y) {
    playSoundAt(200, 0.15, x, y, 0.25);
}
