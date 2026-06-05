import { describe, it, expect } from 'vitest';

describe('Progression Calculations', () => {
    it('should calculate rank from score', () => {
        const ranks = [
            { name: 'Bronze III', minScore: 0 },
            { name: 'Bronze II', minScore: 100 },
            { name: 'Bronze I', minScore: 300 },
            { name: 'Silver III', minScore: 600 },
            { name: 'Silver II', minScore: 1000 },
            { name: 'Silver I', minScore: 1500 },
            { name: 'Gold III', minScore: 2100 },
            { name: 'Gold II', minScore: 2800 },
            { name: 'Gold I', minScore: 3600 },
        ];

        const getRank = (score) => {
            let rank = ranks[0];
            for (const r of ranks) {
                if (score >= r.minScore) rank = r;
            }
            return rank.name;
        };

        expect(getRank(0)).toBe('Bronze III');
        expect(getRank(199)).toBe('Bronze II');
        expect(getRank(600)).toBe('Silver III');
        expect(getRank(5000)).toBe('Gold I');
    });

    it('should calculate XP needed for next tier', () => {
        const tiersRequired = (currentXp, targetTier) => {
            const currentTier = Math.floor(currentXp / 100);
            const needed = (targetTier - currentTier) * 100 - (currentXp % 100);
            return Math.max(0, needed);
        };

        expect(tiersRequired(0, 1)).toBe(100);
        expect(tiersRequired(50, 1)).toBe(50);
        expect(tiersRequired(100, 2)).toBe(100);
        expect(tiersRequired(250, 3)).toBe(50);
        expect(tiersRequired(300, 3)).toBe(0);
    });
});
