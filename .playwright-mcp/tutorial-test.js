async (page) => {
  // Navigate fresh
  await page.goto('http://localhost:8765/');
  // Wait for welcome + tutorial auto-start
  await page.waitForTimeout(15000);
  
  // STEP 1: Move - press W, A, S, D with holds
  const moveKeys = ['w','a','s','d'];
  for (const k of moveKeys) {
    await page.keyboard.down(k);
    await page.waitForTimeout(400);
    await page.keyboard.up(k);
    await page.waitForTimeout(800);
  }
  // Wait for success msg (2.5s) + HUD auto-advance (6s)
  await page.waitForTimeout(12000);
  
  // STEP 3: Fuel - move to drain below 30%
  await page.keyboard.down('w');
  await page.waitForTimeout(10000);
  await page.keyboard.up('w');
  // Wait for fuel_drained + 3s timer
  await page.waitForTimeout(10000);
  
  // STEP 4: Aim - move mouse to extreme positions
  const canvas = page.locator('#gameCanvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let i = 0; i < 5; i++) {
    await page.mouse.move(cx + 350, cy - 250);
    await page.waitForTimeout(300);
    await page.mouse.move(cx - 350, cy + 250);
    await page.waitForTimeout(300);
  }
  // Wait for angle change + 2s timer
  await page.waitForTimeout(5000);
  
  // STEP 5: Shoot - 3 clicks
  await canvas.click({button:'left'});
  await page.waitForTimeout(800);
  await canvas.click({button:'left'});
  await page.waitForTimeout(800);
  await canvas.click({button:'left'});
  await page.waitForTimeout(800);
  // Wait for success msg
  await page.waitForTimeout(5000);
  
  // STEP 6: Boost - hold shift+W for 3s
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('w');
  await page.waitForTimeout(3500);
  await page.keyboard.up('w');
  await page.keyboard.up('ShiftLeft');
  // Wait for stepTimer > 2s to advance
  await page.waitForTimeout(5000);
  
  // STEP 7: Mine - hold C for longer
  await page.keyboard.down('c');
  await page.waitForTimeout(800);
  await page.keyboard.up('c');
  // Wait for enemy to spawn
  await page.waitForTimeout(6000);
  // Move around to lead enemy over mine
  for (let i = 0; i < 5; i++) {
    await page.keyboard.down('d');
    await page.waitForTimeout(1500);
    await page.keyboard.up('d');
    await page.waitForTimeout(200);
    await page.keyboard.down('w');
    await page.waitForTimeout(1500);
    await page.keyboard.up('w');
    await page.waitForTimeout(200);
    await page.keyboard.down('a');
    await page.waitForTimeout(1500);
    await page.keyboard.up('a');
    await page.waitForTimeout(200);
    await page.keyboard.down('s');
    await page.waitForTimeout(1500);
    await page.keyboard.up('s');
    await page.waitForTimeout(200);
  }
  // Wait for enemy to die on mine
  await page.waitForTimeout(5000);
  
  return 'tutorial run complete';
}
