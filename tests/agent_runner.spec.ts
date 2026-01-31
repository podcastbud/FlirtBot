import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface Turn {
    user_context: string;
    vibe: string;
    description: string;
    expected_results: string[];
}

interface Scenario {
    scenario_name: string;
    description: string;
    vibe: string;
    turns: Turn[];
}

const scenariosDir = path.join(__dirname, 'scenarios');
const scenarioFiles = fs.readdirSync(scenariosDir).filter(file => file.endsWith('.json'));

test.describe('FlirtBot Testing Agent', () => {
    for (const file of scenarioFiles) {
        const scenarioPath = path.join(scenariosDir, file);
        const scenario: Scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));

        test(scenario.scenario_name, async ({ page }) => {
            console.log(`\n🚀 Starting Scenario: ${scenario.scenario_name}`);
            
            // Navigate to the app
            await page.goto('/');

            // Wait for the initial load
            await expect(page.locator('text=Ready to Flirt?')).toBeVisible({ timeout: 15000 });

            // Execute each turn
            for (let i = 0; i < scenario.turns.length; i++) {
                const turn = scenario.turns[i];
                console.log(`\nTurn ${i + 1}: ${turn.description}`);

                // 1. Select the vibe
                const vibeButton = page.locator(`button:has-text("${turn.vibe}")`);
                await vibeButton.click();
                
                // 2. Input the context
                const textarea = page.locator('textarea[placeholder*="context"]');
                await textarea.fill(turn.user_context);

                // 3. Generate Magic
                const generateButton = page.locator('button:has-text("Generate Magic"), button:has-text("Generate for Next Turn")');
                await generateButton.click();

                // 4. Assert Results
                // Check if the coach's vibe read appears
                await expect(page.locator('text=Coach\'s Suggestions')).toBeVisible({ timeout: 20000 });
                
                // Verify atleast some reply cards are present
                const replyCards = page.locator('div[class*="ReplyCard"]');
                await expect(replyCards.first()).toBeVisible();

                // 5. Choose a reply to proceed
                // We'll just pick the first one for the agent runner
                const firstChooseButton = page.locator('button:has-text("Choose")').first();
                // We need to click the card first to expand it to see the Choose button
                await replyCards.first().click();
                await firstChooseButton.click();

                // 6. Verify "Reply Chosen!" message
                await expect(page.locator('text=Reply Chosen!')).toBeVisible();

                // 7. Click "Next Screenshot / Turn" to prepare for next turn
                if (i < scenario.turns.length - 1) {
                    const nextTurnButton = page.locator('button:has-text("Next Screenshot / Turn")');
                    await nextTurnButton.click();
                }
            }
            
            console.log(`\n✅ Completed Scenario: ${scenario.scenario_name}`);
        });
    }
});
