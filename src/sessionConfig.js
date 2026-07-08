// ==================== SESSION / BATTLE PASS SYSTEM ====================
// Session 1: "Ignition" — 30 free tiers, no premium track.
// Session XP is earned passively at 15% of match XP from all game modes.

export const SESSION = {
    id: 's1',
    name: 'Season 1: Ignition',
    shortName: 'Ignition',
    icon: '🔥',
    tiers: 30,
    xpPerTier: 200,
    startDate: '2026-06-01',
    endDate: '2026-09-01',
    description: 'The inaugural season! Earn XP to unlock exclusive skins, weapons, and rewards.',
};

// Each tier: null = no reward (milestone tier gives a real item)
// reward: { type, id?, amount? }
// type: 'coins', 'gems', 'skin', 'weapon', 'title', 'bundle'
export const SESSION_TIERS = [
    { tier: 1,  reward: { type: 'coins', amount: 50 } },
    { tier: 2,  reward: { type: 'gems', amount: 25 } },
    { tier: 3,  reward: { type: 'coins', amount: 75 } },
    { tier: 4,  reward: { type: 'gems', amount: 30 } },
    { tier: 5,  reward: { type: 'skin', id: 'blaze' } },
    { tier: 6,  reward: { type: 'coins', amount: 100 } },
    { tier: 7,  reward: { type: 'gems', amount: 40 } },
    { tier: 8,  reward: { type: 'coins', amount: 150 } },
    { tier: 9,  reward: { type: 'gems', amount: 50 } },
    { tier: 10, reward: { type: 'weapon', id: 'flamethrower' } },
    { tier: 11, reward: { type: 'coins', amount: 100 } },
    { tier: 12, reward: { type: 'gems', amount: 60 } },
    { tier: 13, reward: { type: 'coins', amount: 150 } },
    { tier: 14, reward: { type: 'gems', amount: 75 } },
    { tier: 15, reward: { type: 'skin', id: 'magma' } },
    { tier: 16, reward: { type: 'coins', amount: 200 } },
    { tier: 17, reward: { type: 'gems', amount: 80 } },
    { tier: 18, reward: { type: 'coins', amount: 250 } },
    { tier: 19, reward: { type: 'gems', amount: 100 } },
    { tier: 20, reward: { type: 'bundle', coins: 500, gems: 150, title: 'Season 1 Veteran' } },
    { tier: 21, reward: { type: 'gems', amount: 120 } },
    { tier: 22, reward: { type: 'coins', amount: 300 } },
    { tier: 23, reward: { type: 'gems', amount: 150 } },
    { tier: 24, reward: { type: 'coins', amount: 350 } },
    { tier: 25, reward: { type: 'weapon', id: 'plasma_cannon' } },
    { tier: 26, reward: { type: 'gems', amount: 200 } },
    { tier: 27, reward: { type: 'coins', amount: 400 } },
    { tier: 28, reward: { type: 'gems', amount: 250 } },
    { tier: 29, reward: { type: 'coins', amount: 500 } },
    { tier: 30, reward: { type: 'skin', id: 'ignition_overlord', coins: 1000, gems: 500 } },
];

export const TIER_REWARDS_MAP = {};
for (const entry of SESSION_TIERS) {
    TIER_REWARDS_MAP[entry.tier] = entry.reward;
}
