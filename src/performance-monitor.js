// Performance monitoring — frame time graph + FPS tracking
// Draws a small overlay graph at the top-right corner of the canvas

import { G } from './state.js';

const GRAPH_WIDTH = 150;
const GRAPH_HEIGHT = 40;
const GRAPH_PADDING = 4;
let frameHistory = [];      // { frameTime, timestamp }
let peakFrameTime = 16;
const MAX_SAMPLES = 150;
let visible = false;

export function setVisible(v) {
    visible = v;
}

export function isVisible() {
    return visible;
}

export function recordFrame(frameTimeMs) {
    if (!visible) return;
    const now = performance.now();
    frameHistory.push({ frameTime: frameTimeMs, timestamp: now });
    if (frameHistory.length > MAX_SAMPLES) {
        frameHistory.shift();
    }
    if (frameTimeMs > peakFrameTime) {
        peakFrameTime = frameTimeMs;
    } else {
        peakFrameTime += (frameTimeMs - peakFrameTime) * 0.01;
    }
}

export function drawGraph(ctx) {
    if (!visible || frameHistory.length < 2) return;

    const x = G.ctx.canvas.width - GRAPH_WIDTH - GRAPH_PADDING;
    const y = GRAPH_PADDING;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(x, y, GRAPH_WIDTH, GRAPH_HEIGHT, 4);
    ctx.fill();

    // Grid lines at 16ms (60fps) and 33ms (30fps)
    const scale = GRAPH_HEIGHT / Math.max(peakFrameTime, 33);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    const y16 = y + GRAPH_HEIGHT - 16 * scale;
    ctx.beginPath();
    ctx.moveTo(x, y16);
    ctx.lineTo(x + GRAPH_WIDTH, y16);
    ctx.stroke();
    const y33 = y + GRAPH_HEIGHT - 33 * scale;
    ctx.beginPath();
    ctx.moveTo(x, y33);
    ctx.lineTo(x + GRAPH_WIDTH, y33);
    ctx.stroke();

    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const step = GRAPH_WIDTH / (frameHistory.length - 1);
    for (let i = 0; i < frameHistory.length; i++) {
        const h = Math.min(frameHistory[i].frameTime, peakFrameTime);
        const px = x + i * step;
        const py = y + GRAPH_HEIGHT - h * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const avg = frameHistory.reduce((s, f) => s + f.frameTime, 0) / frameHistory.length;
    const fps = avg > 0 ? (1000 / avg).toFixed(1) : '--';
    ctx.textAlign = 'right';
    ctx.font = '8px Orbitron, monospace';
    ctx.fillStyle = avg > 33 ? '#e74c3c' : avg > 16 ? '#f39c12' : '#2ecc71';
    ctx.fillText(`${fps} FPS`, x + GRAPH_WIDTH - 4, y + 10);
}
