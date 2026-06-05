// Error tracking and crash logging
// Logs errors to console + optionally to Firebase DB for monitoring

import { G } from './state.js';

const ERROR_STORAGE_KEY = 'tank_arena_errors';
const MAX_STORED_ERRORS = 50;

function getStoredErrors() {
    try {
        return JSON.parse(localStorage.getItem(ERROR_STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function storeError(entry) {
    try {
        const errors = getStoredErrors();
        errors.push(entry);
        if (errors.length > MAX_STORED_ERRORS) errors.shift();
        localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(errors));
    } catch {
    }
}

export function captureError(error, context = {}) {
    const entry = {
        message: error?.message || String(error),
        stack: error?.stack || '',
        time: Date.now(),
        url: window.location.href,
        gameState: G?.gameState,
        gameMode: G?.gameMode,
        level: G?.level,
        context
    };
    console.error('[ErrorTracker]', entry.message, context);
    storeError(entry);
    return entry;
}

export function getErrorLog() {
    return getStoredErrors();
}

export function clearErrorLog() {
    try {
        localStorage.removeItem(ERROR_STORAGE_KEY);
    } catch {}
}

// Game crash/freeze detection
let _lastFrameTime = 0;
let _frameWatchdog = null;
const WATCHDOG_TIMEOUT = 3000; // ms — if no frame for 3s, consider frozen

export function frameTick() {
    _lastFrameTime = performance.now();
}

export function startWatchdog(onFreeze) {
    stopWatchdog();
    _frameWatchdog = setInterval(() => {
        const elapsed = performance.now() - _lastFrameTime;
        if (elapsed > WATCHDOG_TIMEOUT && G?.gameState !== 'MENU') {
            captureError(new Error('Game frozen'), { elapsed });
            if (onFreeze) onFreeze(elapsed);
        }
    }, 1000);
}

export function stopWatchdog() {
    if (_frameWatchdog) {
        clearInterval(_frameWatchdog);
        _frameWatchdog = null;
    }
}

// Install global error handler
export function initErrorTracking() {
    window.addEventListener('error', (event) => {
        captureError(event.error || event.message, { type: 'uncaught' });
    });
    window.addEventListener('unhandledrejection', (event) => {
        captureError(event.reason, { type: 'unhandledRejection' });
    });
}
