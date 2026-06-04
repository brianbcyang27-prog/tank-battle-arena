// ==================== Q-LEARNING AGENT FOR ARCADE MODE ====================
// Shared across all enemies for faster collective learning.

const QTABLE_KEY = 'tankBattle_arcade_qtable';
const META_KEY = 'tankBattle_arcade_meta';

// State index encoding: 4 features × 3 buckets = 81 states
// encode(distBucket, playerHpBucket, enemyHpBucket, alliesBucket) = d*27 + ph*9 + eh*3 + a
function encodeState(distBucket, playerHpBucket, enemyHpBucket, alliesBucket) {
    return distBucket * 27 + playerHpBucket * 9 + enemyHpBucket * 3 + alliesBucket;
}

// Discretize a continuous value into 0/1/2
function bucket(val, low, high) {
    if (val <= low) return 0;
    if (val >= high) return 2;
    return 1;
}

// Action codes — map 1:1 to Enemy.aiState strings
export const QL_ACTIONS = {
    APPROACH: 0,
    RETREAT: 1,
    STRAFE: 2,
    ERRATIC: 3,
    FLANK: 4,
};
export const QL_ACTION_NAMES = ['approach', 'retreat', 'strafe', 'erratic', 'flank'];
export const NUM_ACTIONS = 5;

export class QLearningAgent {
    constructor(lr = 0.1, gamma = 0.9, epsilon = 0.3) {
        this.lr = lr;          // learning rate
        this.gamma = gamma;    // discount factor
        this.epsilon = epsilon; // exploration rate

        // Q-table: { stateKey: { action0: q, action1: q, ... } }
        this.qTable = {};

        // Meta stats
        this.meta = {
            totalGames: 0,
            wins: 0,
            totalKills: 0,
            totalDeaths: 0,
            totalSteps: 0,
            totalDamageDealt: 0,
            totalDamageTaken: 0,
        };

        this.load();
    }

    // --- State encoding from game values ---
    // Returns a numeric state index (0-80)
    getState(distToPlayer, playerHealthPct, enemyHealthPct, numAllies) {
        const d = bucket(distToPlayer, 200, 400);
        const ph = bucket(playerHealthPct, 0.33, 0.66);
        const eh = bucket(enemyHealthPct, 0.33, 0.66);
        const a = bucket(numAllies, 0, 2);
        return encodeState(d, ph, eh, a);
    }

    // --- Epsilon-greedy action selection ---
    selectAction(state) {
        if (!this.qTable[state]) {
            this.qTable[state] = new Array(NUM_ACTIONS).fill(0);
        }

        // Explore
        if (Math.random() < this.epsilon) {
            return Math.floor(Math.random() * NUM_ACTIONS);
        }

        // Exploit — pick best action
        const qValues = this.qTable[state];
        let bestAction = 0;
        let bestQ = qValues[0];
        for (let a = 1; a < NUM_ACTIONS; a++) {
            if (qValues[a] > bestQ) {
                bestQ = qValues[a];
                bestAction = a;
            }
        }
        return bestAction;
    }

    // --- Q-learning update ---
    // Call AFTER taking action and observing reward + new state
    learn(prevState, action, reward, newState) {
        if (prevState === undefined || prevState === null) return;
        if (action === undefined || action === null) return;

        // Ensure Q-table entries exist
        if (!this.qTable[prevState]) {
            this.qTable[prevState] = new Array(NUM_ACTIONS).fill(0);
        }
        if (!this.qTable[newState]) {
            this.qTable[newState] = new Array(NUM_ACTIONS).fill(0);
        }

        const qPrev = this.qTable[prevState][action];
        const maxQNext = Math.max(...this.qTable[newState]);

        // TD update: Q(s,a) += lr * (r + gamma * max(Q(s',a')) - Q(s,a))
        this.qTable[prevState][action] = qPrev + this.lr * (reward + this.gamma * maxQNext - qPrev);

        this.meta.totalSteps++;
    }

    // --- Decay epsilon over time ---
    decayEpsilon(factor = 0.995) {
        this.epsilon = Math.max(0.05, this.epsilon * factor);
    }

    // --- Reward accumulation helpers ---
    // Reward is accumulated per-enemy between decision ticks,
    // then passed to learn() when the enemy's AI timer fires.

    // --- Persistence ---
    save() {
        try {
            localStorage.setItem(QTABLE_KEY, JSON.stringify(this.qTable));
            localStorage.setItem(META_KEY, JSON.stringify(this.meta));
        } catch (e) {
            // localStorage full or unavailable — silently fail
        }
    }

    load() {
        try {
            const qRaw = localStorage.getItem(QTABLE_KEY);
            if (qRaw) {
                const parsed = JSON.parse(qRaw);
                // Ensure all values are arrays (not objects from old format)
                for (const key in parsed) {
                    if (!Array.isArray(parsed[key])) {
                        // Convert old object format to array
                        const arr = new Array(NUM_ACTIONS).fill(0);
                        for (const ak in parsed[key]) {
                            arr[parseInt(ak)] = parsed[key][ak];
                        }
                        parsed[key] = arr;
                    }
                }
                this.qTable = parsed;
            }
            const metaRaw = localStorage.getItem(META_KEY);
            if (metaRaw) {
                this.meta = { ...this.meta, ...JSON.parse(metaRaw) };
            }
        } catch (e) {
            // Corrupted data — reset
            this.qTable = {};
            this.meta = { totalGames: 0, wins: 0, totalKills: 0, totalDeaths: 0, totalSteps: 0, totalDamageDealt: 0, totalDamageTaken: 0 };
        }
    }

    reset() {
        this.qTable = {};
        this.meta = { totalGames: 0, wins: 0, totalKills: 0, totalDeaths: 0, totalSteps: 0, totalDamageDealt: 0, totalDamageTaken: 0 };
        this.epsilon = 0.3;
        this.save();
    }

    // --- IQ: number of learned state-action pairs / 10 (rough intelligence metric) ---
    getIQ() {
        let learnedPairs = 0;
        for (const key in this.qTable) {
            const qValues = this.qTable[key];
            for (let a = 0; a < NUM_ACTIONS; a++) {
                if (qValues[a] !== 0) learnedPairs++;
            }
        }
        return Math.round(learnedPairs / 10);
    }

    // --- Stats for game over screen ---
    getMeta() {
        return { ...this.meta };
    }
}
