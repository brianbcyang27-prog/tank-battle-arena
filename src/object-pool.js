// Object pooling for frequently created/destroyed game objects
// Reduces GC pressure by reusing dead object slots

export class ObjectPool {
    constructor(factory, resetFn, initialSize = 50) {
        this._factory = factory;
        this._reset = resetFn;
        this._pool = [];
        this._active = [];
        for (let i = 0; i < initialSize; i++) {
            this._pool.push(factory());
        }
    }

    acquire() {
        const obj = this._pool.pop() || this._factory();
        this._active.push(obj);
        return obj;
    }

    release(obj) {
        const idx = this._active.indexOf(obj);
        if (idx >= 0) {
            this._active.splice(idx, 1);
            this._reset(obj);
            this._pool.push(obj);
        }
    }

    releaseAll() {
        for (let i = 0; i < this._active.length; i++) {
            this._reset(this._active[i]);
            this._pool.push(this._active[i]);
        }
        this._active.length = 0;
    }

    get active() { return this._active; }
    get activeCount() { return this._active.length; }
    get poolSize() { return this._pool.length; }
}

import { Particle } from './engine.js';

export function createParticlePool(initialSize = 100) {
    return new ObjectPool(
        () => new Particle(0, 0, 0, 0, '#fff', 0),
        (p) => { p.life = 0; p.alive = false; },
        initialSize
    );
}
