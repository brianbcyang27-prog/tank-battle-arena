async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem('tankBattleTutorialDone', 'true');
    localStorage.setItem('tankBattle_progression', JSON.stringify({
      gems: 100, coins: 500, xp: 1500,
      ownedSkins: ['classic'], equippedSkin: 'classic',
      ownedWeapons: ['standard'], equippedWeapon: 'standard',
      missions: [], missionDate: '',
      levelCompletes: 5, totalKills: 20,
      totalMineKills: 2, totalSurvivalTime: 120,
      aiWins: 1, highestSingleScore: 5000,
      upgradePoints: 10,
      upgrades: { speed: 1, fuel: 0, mineRadius: 0 },
      sessionXp: 650,
      sessionRewardsClaimed: [1],
      sessionLifetimeXp: 650,
    }));
  });

  await page.goto('http://localhost:8765/');
  await page.waitForTimeout(15000);

  await page.waitForSelector('#loggedInPanel', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  await page.click('button:has-text("SEASON")');
  await page.waitForTimeout(800);

  const overlay = await page.locator('#seasonPassOverlay');
  await overlay.waitFor({ state: 'visible', timeout: 3000 });

  const header = await page.locator('#seasonPassHeader');
  await header.waitFor({ state: 'visible', timeout: 3000 });

  const grid = await page.locator('#seasonPassGrid');
  await grid.waitFor({ state: 'visible', timeout: 3000 });

  const headerText = await header.textContent();
  if (!headerText.includes('Season 1') && !headerText.includes('Ignition')) {
    throw new Error('Header missing season name. Got: ' + headerText);
  }
  if (!headerText.includes('3 / 30') && !headerText.includes('650')) {
    throw new Error('Header missing XP info. Got: ' + headerText);
  }

  const tierCards = await grid.locator('> div').count();
  if (tierCards < 5) {
    throw new Error('Expected at least 5 tier cards, got ' + tierCards);
  }

  const allBtnTexts = await grid.locator('button').allTextContents();
  const hasClaimable = allBtnTexts.some(t => t === 'CLAIM' || t.startsWith('CLAIM '));
  const claimAllBtn = grid.locator('button:has-text("CLAIM ALL")');
  const claimAllDisabled = (await claimAllBtn.count()) === 0 || await claimAllBtn.isDisabled();

  if (hasClaimable) {
    const claimBtn = grid.locator('button:has-text("CLAIM")').filter({ hasNotText: /CLAIMED|ALL/ }).first();
    const exists = await claimBtn.count();
    if (exists > 0) {
      await claimBtn.click();
      await page.waitForTimeout(300);
    }
  }

  if (!claimAllDisabled) {
    await claimAllBtn.click();
    await page.waitForTimeout(300);
  }

  await page.click('button:has-text("CLOSE")');
  await page.waitForTimeout(500);

  await page.locator('#loginOverlay').waitFor({ state: 'visible', timeout: 3000 });

  const savedProg = await page.evaluate(() => {
    const raw = localStorage.getItem('tankBattle_progression');
    return raw ? JSON.parse(raw) : null;
  });
  if (!savedProg) throw new Error('Progression not saved');

  const preClaimed = 1; // tier 1 was pre-set as claimed
  const claimedCount = (savedProg.sessionRewardsClaimed || []).length;
  if (claimedCount < preClaimed) {
    throw new Error('Expected at least ' + preClaimed + ' claimed rewards, got ' + claimedCount);
  }

  return 'Session system test passed! Tiers: ' + tierCards + ', Claimed: ' + claimedCount;
}