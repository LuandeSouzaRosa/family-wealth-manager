import { test as setup, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const authFile = 'playwright/.auth/user.json';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env "${name}" for Playwright auth setup.`);
  }
  return value;
}

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  
  const email = getRequiredEnv('TEST_EMAIL');
  const password = getRequiredEnv('TEST_PASSWORD');
  
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  
  await page.locator('button[type="submit"]').click();

  // Garante de forma engessada que o path seja '/' ou ignorando os sufixos querystring
  await page.waitForURL((url) => url.pathname === '/', { timeout: 60000 });

  await page.context().storageState({ path: authFile });
});
