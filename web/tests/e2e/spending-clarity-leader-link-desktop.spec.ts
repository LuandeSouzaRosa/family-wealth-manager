import { test, expect, type Page } from '@playwright/test';
import {
  buildUniqueDescription,
  cleanupTransactionsByDescription,
  createAuthenticatedSupabaseClient,
} from './helpers/manual-proof-helpers';

const LEADER_CATEGORY = 'Transporte';

const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Mar\u00E7o',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

type FixtureRow = {
  descricao: string;
  valor: number;
  categoria: string;
  tipo: 'Sa\u00EDda';
  data: string;
  responsavel: 'Casal';
  origem: 'Manual';
  status: 'Realizado';
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env "${name}" for spending clarity leader-link E2E.`);
  }
  return value;
}

function buildConfidenceLabelRegex(label: 'Alta' | 'Moderada' | 'Baixa') {
  return new RegExp(`Confianca do insight:\\s*${label}`, 'i');
}

async function assertConfidenceSignals(
  page: Page,
  expectedLabel: 'Alta' | 'Moderada' | 'Baixa',
  expectedSignals: RegExp,
) {
  const confidenceBlock = page.locator('[data-testid="spending-clarity-evidence-strength"]:visible').first();
  await expect(confidenceBlock).toBeVisible({ timeout: 15000 });
  await expect(confidenceBlock).toContainText(buildConfidenceLabelRegex(expectedLabel), {
    timeout: 15000,
  });

  const signals = page.locator('[data-testid="spending-clarity-evidence-signals"]:visible').first();
  await expect(signals).toBeVisible({ timeout: 15000 });
  await expect(signals).toContainText(expectedSignals, { timeout: 15000 });
}

async function insertFixtureRows(rows: FixtureRow[]) {
  const client = await createAuthenticatedSupabaseClient();
  const nowIso = new Date().toISOString();
  const { data: userData, error: userError } = await client.auth.getUser();
  const userId = userData.user?.id;

  if (userError || !userId) {
    throw new Error(`Unable to resolve authenticated user for leader-link fixture: ${userError?.message ?? 'no-user-id'}`);
  }

  const rowsWithUser = rows.map((row) => ({ ...row, data: nowIso, user_id: userId }));

  const { error } = await client.from('transacoes').insert(rowsWithUser as any);
  if (error) {
    throw new Error(`Failed to insert Spending Clarity leader fixture rows: ${error.message}`);
  }

  return client;
}

async function waitForLeaderCard(page: Page, runTag: string, expectedCategory: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  const expectedCategoryEncoded = encodeURIComponent(expectedCategory);

  while (Date.now() < deadline) {
    await page.goto(`/?e2e_clarity_leader_link=${encodeURIComponent(runTag)}&probe=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 30000 });

    const leaderLinks = page.locator(
      `a[href*="category=${expectedCategoryEncoded}"][href*="sort=value_desc"]`,
    );
    const totalCandidates = await leaderLinks.count();

    for (let index = 0; index < totalCandidates; index += 1) {
      const candidate = leaderLinks.nth(index);
      if (await candidate.isVisible()) {
        return;
      }
    }

    await page.waitForTimeout(3000);
  }

  throw new Error(
    `Spending Clarity nao exibiu categoria lider esperada (${expectedCategory}) dentro do timeout ${timeoutMs}ms.`,
  );
}

async function loginAsTestUser(page: Page) {
  const email = getRequiredEnv('HOMOLOG_EMAIL');
  const password = getRequiredEnv('HOMOLOG_PASSWORD');

  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 60000 });
  await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 30000 });
}

test.describe('Spending Clarity leader deep-link (desktop)', () => {
  test('deve exibir confianca moderada com sinais explicitos e abrir Extrato com contexto', async ({ page }) => {
    test.setTimeout(300000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const now = new Date();
    const expectedMonth = String(now.getMonth() + 1);
    const expectedYear = String(now.getFullYear());
    const expectedMonthLabel = MONTH_LABELS[now.getMonth()];
    const runTag = buildUniqueDescription('E2E_CLARITY_LEADER_LINK');
    const fixtureDescriptions = [`${runTag}_leader_1`, `${runTag}_leader_2`, `${runTag}_other`];
    const client = await insertFixtureRows([
      {
        descricao: fixtureDescriptions[0],
        valor: 40.0,
        categoria: LEADER_CATEGORY,
        tipo: 'Sa\u00EDda',
        data: '',
        responsavel: 'Casal',
        origem: 'Manual',
        status: 'Realizado',
      },
      {
        descricao: fixtureDescriptions[1],
        valor: 40.0,
        categoria: LEADER_CATEGORY,
        tipo: 'Sa\u00EDda',
        data: '',
        responsavel: 'Casal',
        origem: 'Manual',
        status: 'Realizado',
      },
      {
        descricao: fixtureDescriptions[2],
        valor: 20.0,
        categoria: 'Lazer',
        tipo: 'Sa\u00EDda',
        data: '',
        responsavel: 'Casal',
        origem: 'Manual',
        status: 'Realizado',
      },
    ]);

    try {
      await loginAsTestUser(page);
      await waitForLeaderCard(page, runTag, LEADER_CATEGORY, 180000);
      await assertConfidenceSignals(page, 'Moderada', /Sinais:\s*lider 80% em 2 lanc\.; generico no top 3 0%\./i);

      const encodedCategory = encodeURIComponent(LEADER_CATEGORY);
      const reviewLinks = page.locator(
        `a[href*="category=${encodedCategory}"][href*="sort=value_desc"]`,
      );
      const totalCandidates = await reviewLinks.count();
      let clicked = false;

      for (let index = 0; index < totalCandidates; index += 1) {
        const candidate = reviewLinks.nth(index);
        if (await candidate.isVisible()) {
          await candidate.click();
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        throw new Error('CTA visivel de revisao por categoria lider nao encontrado.');
      }

      await expect(page.getByTestId('filter-year')).toBeVisible({ timeout: 15000 });

      const targetUrl = new URL(page.url());
      expect(targetUrl.pathname).toBe('/transacoes');
      expect(targetUrl.searchParams.get('month')).toBe(expectedMonth);
      expect(targetUrl.searchParams.get('year')).toBe(expectedYear);
      expect(targetUrl.searchParams.get('category')).toBe(LEADER_CATEGORY);
      expect(targetUrl.searchParams.get('sort')).toBe('value_desc');

      await expect(page.getByTestId('filter-year')).toContainText(expectedYear, { timeout: 15000 });
      await expect(page.getByTestId('filter-month')).toContainText(expectedMonthLabel, { timeout: 15000 });
      await expect(page.getByTestId('filter-category')).toContainText(LEADER_CATEGORY, { timeout: 15000 });
      await expect(page.getByTestId('filter-sort')).toContainText(/Maior valor/i, { timeout: 15000 });
    } finally {
      for (const description of fixtureDescriptions) {
        await cleanupTransactionsByDescription(client, description);
      }
    }
  });

  test('deve exibir confianca baixa com sinais explicitos sem perder CTA auditavel', async ({ page }) => {
    test.setTimeout(300000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const runTag = buildUniqueDescription('E2E_CLARITY_LOW_SIGNALS');
    const fixtureDescriptions = [`${runTag}_leader_1`, `${runTag}_other`];

    const client = await insertFixtureRows([
      {
        descricao: fixtureDescriptions[0],
        valor: 80.0,
        categoria: LEADER_CATEGORY,
        tipo: 'Sa\u00EDda',
        data: '',
        responsavel: 'Casal',
        origem: 'Manual',
        status: 'Realizado',
      },
      {
        descricao: fixtureDescriptions[1],
        valor: 20.0,
        categoria: 'Lazer',
        tipo: 'Sa\u00EDda',
        data: '',
        responsavel: 'Casal',
        origem: 'Manual',
        status: 'Realizado',
      },
    ]);

    try {
      await loginAsTestUser(page);
      await waitForLeaderCard(page, runTag, LEADER_CATEGORY, 180000);
      await assertConfidenceSignals(page, 'Baixa', /Sinais:\s*lider 80% em 1 lanc\.; generico no top 3 0%\./i);

      const encodedCategory = encodeURIComponent(LEADER_CATEGORY);
      const reviewLinks = page.locator(
        `a[href*="category=${encodedCategory}"][href*="sort=value_desc"]`,
      );
      const totalCandidates = await reviewLinks.count();
      let hasVisibleCta = false;
      for (let index = 0; index < totalCandidates; index += 1) {
        const candidate = reviewLinks.nth(index);
        if (await candidate.isVisible()) {
          hasVisibleCta = true;
          break;
        }
      }
      expect(hasVisibleCta).toBe(true);
    } finally {
      for (const description of fixtureDescriptions) {
        await cleanupTransactionsByDescription(client, description);
      }
    }
  });
});
