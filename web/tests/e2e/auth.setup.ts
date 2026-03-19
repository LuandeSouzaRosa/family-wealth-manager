import { test as setup, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  
  const email = process.env.TEST_EMAIL || 'luan_souza_r@hotmail.com';
  const password = process.env.TEST_PASSWORD || '@Lu96385674173267697';
  
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  
  await page.locator('button[type="submit"]').click();

  // Garante de forma engessada que o path seja '/' ou ignorando os sufixos querystring
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });

  await page.context().storageState({ path: authFile });
});
