import { G } from './state.js';
import { log } from './log.js';

export class PlayerBehaviorTracker {
    constructor() {
        this.rounds = [];
        this._current = this._freshRound();
    }

    _freshRound() {
        return {
            shots: 0,
            hits: 0,
            deaths: 0,
            kills: 0,
            minesPlaced: 0,
            distanceTraveled: 0,
            avgDistanceToEnemy: 0,
            _distanceSamples: 0,
            _distSum: 0,
            directionChanges: 0,
            _lastDir: null,
            timeNearWalls: 0,
            _wallNearFrames: 0,
            won: false
        };
    }

    tick(dt) {
        if (!G.player || !G.player.alive || !G.enemies.length) return;
        const p = G.player;

        let minDist = Infinity;
        for (let e of G.enemies) {
            if (e.alive) {
                const d = p.pos.distanceTo(e.pos);
                if (d < minDist) minDist = d;
            }
        }
        if (minDist < Infinity) {
            this._current._distSum += minDist;
            this._current._distanceSamples++;
        }

        const vx = Math.round(p.vel.x / 10);
        const vy = Math.round(p.vel.y / 10);
        const dir = vx + ',' + vy;
        if (vx !== 0 || vy !== 0) {
            if (this._current._lastDir !== null && dir !== this._current._lastDir) {
                this._current.directionChanges++;
            }
            this._current._lastDir = dir;
        }

        for (let w of G.walls) {
            const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
            if (p.pos.distanceTo({ x: cx, y: cy }) < 80) {
                this._current._wallNearFrames++;
                break;
            }
        }
    }

    recordShot() { this._current.shots++; }
    recordHit() { this._current.hits++; }
    recordDeath() { this._current.deaths++; }
    recordKill() { this._current.kills++; }
    recordMinePlaced() { this._current.minesPlaced++; }
    recordDistance(d) { this._current.distanceTraveled += d; }

    roundEnded(won) {
        const r = this._current;
        r.won = won;
        if (r._distanceSamples > 0) {
            r.avgDistanceToEnemy = r._distSum / r._distanceSamples;
        }
        r.timeNearWalls = r._wallNearFrames / 60;
        this.rounds.push(r);
        this._current = this._freshRound();
        log('info', 'AI', 'Round tracked. History: ' + this.rounds.length + ' rounds');
    }

    getProfile() {
        if (this.rounds.length === 0) return { confidence: 'low' };

        const r = this.rounds;
        const totalShots = r.reduce((s, x) => s + x.shots, 0);
        const totalHits = r.reduce((s, x) => s + x.hits, 0);
        const totalKills = r.reduce((s, x) => s + x.kills, 0);
        const totalDeaths = r.reduce((s, x) => s + x.deaths, 0);
        const avgDist = r.reduce((s, x) => s + x.avgDistanceToEnemy, 0) / r.length;
        const avgDirChanges = r.reduce((s, x) => s + x.directionChanges, 0) / r.length;
        const avgWallTime = r.reduce((s, x) => s + x.timeNearWalls, 0) / r.length;
        const avgMines = r.reduce((s, x) => s + x.minesPlaced, 0) / r.length;

        const accuracy = totalShots > 0 ? totalHits / totalShots : 0;
        const kd = totalDeaths > 0 ? totalKills / totalDeaths : totalKills;

        return {
            accuracy,
            kd,
            avgEngagementDistance: avgDist,
            avgDirectionChanges: avgDirChanges,
            avgTimeNearWalls: avgWallTime,
            avgMinesPerRound: avgMines,
            roundsObserved: this.rounds.length,
            wins: r.filter(x => x.won).length,
            losses: r.filter(x => !x.won).length,
            confidence: this.rounds.length >= 2 ? 'high' : this.rounds.length === 1 ? 'medium' : 'low'
        };
    }

    getStrategy() {
        const p = this.getProfile();
        if (p.confidence === 'low') return this._defaultStrategy();

        const s = {
            aggression: 0.5,
            erraticMovement: 0.3,
            flanking: 0.3,
            coverUsage: 0.3,
            predictiveAim: 0.3,
            mineAvoidance: 0.3,
            preferredRange: 400
        };

        if (p.accuracy > 0.4) {
            s.erraticMovement = Math.min(1, 0.3 + p.accuracy * 0.8);
            s.coverUsage = Math.min(1, 0.3 + p.accuracy * 0.5);
            s.flanking = Math.min(1, 0.3 + p.accuracy * 0.4);
        }

        if (p.avgEngagementDistance < 300) {
            s.aggression = Math.max(0.1, 0.5 - (300 - p.avgEngagementDistance) / 500);
            s.flanking = Math.min(1, s.flanking + 0.3);
            s.preferredRange = 450;
        }

        if (p.avgTimeNearWalls > 3) {
            s.aggression = Math.min(1, s.aggression + 0.3);
            s.flanking = Math.min(1, s.flanking + 0.3);
            s.preferredRange = 350;
        }

        if (p.avgMinesPerRound > 1) {
            s.mineAvoidance = Math.min(1, 0.3 + p.avgMinesPerRound * 0.2);
        }

        if (p.avgDirectionChanges < 20) {
            s.predictiveAim = Math.min(1, 0.3 + (20 - p.avgDirectionChanges) * 0.03);
        }

        if (p.losses > p.wins && p.roundsObserved >= 2) {
            s.aggression = Math.max(0.2, s.aggression - 0.1);
        }

        if (p.wins > p.losses && p.roundsObserved >= 2) {
            s.aggression = Math.min(1, s.aggression + 0.15);
            s.erraticMovement = Math.min(1, s.erraticMovement + 0.1);
        }

        log('info', 'AI', 'Strategy: acc=' + p.accuracy.toFixed(2) + ' dist=' + Math.round(p.avgEngagementDistance) + ' erratic=' + s.erraticMovement.toFixed(2) + ' flank=' + s.flanking.toFixed(2));

        return s;
    }

    _defaultStrategy() {
        return {
            aggression: 0.5,
            erraticMovement: 0.3,
            flanking: 0.3,
            coverUsage: 0.3,
            predictiveAim: 0.3,
            mineAvoidance: 0.3,
            preferredRange: 400
        };
    }
}
