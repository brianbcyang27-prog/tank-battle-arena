import { G } from './state.js';
import { log } from './log.js';

let audioCtx = null;
let masterVolume = 0.7;
let sfxVolume = 0.8;
let musicVolume = 0.4;
let musicGain = null;
let currentMusic = null;

export function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = audioCtx.createGain();
    musicGain.connect(audioCtx.destination);
    musicGain.gain.value = musicVolume * masterVolume;
    log('info', 'AUDIO', 'Audio system initialized');
}

export function setMasterVolume(v) { masterVolume = Math.max(0, Math.min(1, v)); updateMusicVolume(); }
export function setSfxVolume(v) { sfxVolume = Math.max(0, Math.min(1, v)); }
export function getMasterVolume() { return masterVolume; }
export function getSfxVolume() { return sfxVolume; }

function updateMusicVolume() {
    if (musicGain) musicGain.gain.value = musicVolume * masterVolume;
}

function getSfxGain() {
    const g = audioCtx.createGain();
    g.gain.value = sfxVolume * masterVolume;
    g.connect(audioCtx.destination);
    return g;
}

function resumeContext() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

export function playShoot() {
    if (!audioCtx) return;
    resumeContext();
    const osc = audioCtx.createOscillator();
    const gain = getSfxGain();
    osc.connect(gain);
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.1);
}

export function playExplosion() {
    if (!audioCtx) return;
    resumeContext();
    const bufferSize = audioCtx.sampleRate * 0.3;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = getSfxGain();
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    noise.connect(filter);
    filter.connect(gain);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    noise.start();
}

export function playHit() {
    if (!audioCtx) return;
    resumeContext();
    const osc = audioCtx.createOscillator();
    const gain = getSfxGain();
    osc.connect(gain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.15);
}

export function playMinePlace() {
    if (!audioCtx) return;
    resumeContext();
    const osc = audioCtx.createOscillator();
    const gain = getSfxGain();
    osc.connect(gain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.15);
}

export function playMineArmed() {
    if (!audioCtx) return;
    resumeContext();
    const osc = audioCtx.createOscillator();
    const gain = getSfxGain();
    osc.connect(gain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.12);
}

export function playVictory() {
    if (!audioCtx) return;
    resumeContext();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = getSfxGain();
        osc.connect(gain);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = audioCtx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
        osc.start(startTime);
        osc.stop(startTime + 0.3);
    });
}

export function playDefeat() {
    if (!audioCtx) return;
    resumeContext();
    const notes = [400, 350, 300, 250];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = getSfxGain();
        osc.connect(gain);
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const startTime = audioCtx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
    });
}

export function playRoundWin() {
    if (!audioCtx) return;
    resumeContext();
    const notes = [659, 784, 1047];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = getSfxGain();
        osc.connect(gain);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const startTime = audioCtx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
        osc.start(startTime);
        osc.stop(startTime + 0.2);
    });
}

export function playRoundLose() {
    if (!audioCtx) return;
    resumeContext();
    const notes = [392, 330];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = getSfxGain();
        osc.connect(gain);
        osc.type = 'square';
        osc.frequency.value = freq;
        const startTime = audioCtx.currentTime + i * 0.2;
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
    });
}

export function playLevelUp() {
    if (!audioCtx) return;
    resumeContext();
    const notes = [523, 659, 784, 659, 784, 1047];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = getSfxGain();
        osc.connect(gain);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = audioCtx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
        osc.start(startTime);
        osc.stop(startTime + 0.15);
    });
}

export function playMenuSelect() {
    if (!audioCtx) return;
    resumeContext();
    const osc = audioCtx.createOscillator();
    const gain = getSfxGain();
    osc.connect(gain);
    osc.type = 'sine';
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.08);
}

export function playButtonClick() {
    if (!audioCtx) return;
    resumeContext();
    const osc = audioCtx.createOscillator();
    const gain = getSfxGain();
    osc.connect(gain);
    osc.type = 'sine';
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.05);
}

export function playReload() {
    if (!audioCtx) return;
    resumeContext();
    const osc = audioCtx.createOscillator();
    const gain = getSfxGain();
    osc.connect(gain);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.1);
    osc.frequency.linearRampToValueAtTime(300, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.25);
}

export function playBoost() {
    if (!audioCtx) return;
    resumeContext();
    const osc = audioCtx.createOscillator();
    const gain = getSfxGain();
    osc.connect(gain);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.2);
}

export function stopMusic() {
    if (currentMusic) {
        currentMusic.stop();
        currentMusic = null;
    }
}

let musicInterval = null;

export function playBackgroundMusic() {
    if (!audioCtx || currentMusic) return;
    const notes = [220, 196, 174.6, 164.8, 146.8, 130.8, 146.8, 164.8];
    let noteIndex = 0;
    const gain = audioCtx.createGain();
    gain.gain.value = musicVolume * masterVolume * 0.15;
    gain.connect(audioCtx.destination);

    const bassGain = audioCtx.createGain();
    bassGain.gain.value = musicVolume * masterVolume * 0.1;
    bassGain.connect(audioCtx.destination);
    const bassNotes = [55, 55, 73.4, 73.4, 82.4, 82.4, 65.4, 65.4];
    let bassIndex = 0;

    function playNote() {
        if (!audioCtx || audioCtx.state !== 'running') return;
        const osc = audioCtx.createOscillator();
        const env = audioCtx.createGain();
        osc.connect(env);
        env.connect(gain);
        osc.type = 'sine';
        osc.frequency.value = notes[noteIndex];
        const t = audioCtx.currentTime;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(1, t + 0.05);
        env.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
        osc.start(t);
        osc.stop(t + 0.8);
        noteIndex = (noteIndex + 1) % notes.length;
    }

    function playBass() {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const env = audioCtx.createGain();
        osc.connect(env);
        env.connect(bassGain);
        osc.type = 'triangle';
        osc.frequency.value = bassNotes[bassIndex];
        const t = audioCtx.currentTime;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(1, t + 0.05);
        env.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
        bassIndex = (bassIndex + 1) % bassNotes.length;
    }

    playNote();
    playBass();
    musicInterval = setInterval(() => {
        if (G.gameState !== 2) { playNote(); playBass(); }
    }, 400);
    log('info', 'AUDIO', 'Background music started');
}

export function setMusicVolume(v) { musicVolume = Math.max(0, Math.min(1, v)); updateMusicVolume(); }