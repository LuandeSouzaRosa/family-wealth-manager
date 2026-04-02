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

async function insertLeaderFixtureRows(descriptions: string[]) {
  const client = await createAuthenticatedSupabaseClient();
  const nowIso = new Date().toISOString();
  const { data: userData, error: userError } = await client.auth.getUser();
  const userId = userData.user?.id;

  if (userError || !userId) {
    throw new Error(`Unable to resolve authenticated user for leader-link fixture: ${userError?.message ?? 'no-user-id'}`);
  }

  const rows: FixtureRow[] = [
    {
      descricao: descriptions[0],
      valor: 5500.45,
      categoria: LEADER_CATEGORY,
      tipo: 'Sa\u00EDda',
      data: nowIso,
      responsavel: 'Casal',
      origem: 'Manual',
      status: 'Realizado',
      user_id: userId,
    },
    {
      descricao: descriptions[1],
      valor: 4300.9,
      categoria: LEADER_CATEGORY,
      tipo: 'Sa\u00EDda',
      data: nowIso,
      responsavel: 'Casal',
      origem: 'Manual',
      status: 'Realizado',
      user_id: userId,
    },
    {
      descricao: descriptions[2],
      valor: 120.0,
      categoria: 'Lazer',
      tipo: 'Sa\u00EDda',
      data: nowIso,
      responsavel: 'Casal',
      origem: 'Manual',
      status: 'Realizado',
      user_id: userId,
    },
  ];

  const { error } = await client.from('transacoes').insert(rows as any);
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
      timeout: 30000,
    });
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });

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

test.describe('Spending Clarity leader deep-link (desktop)', () => {
  test('deve abrir Extrato com month/year/category/sort ao revisar categoria lider', async ({ page }) => {
    test.setTimeout(300000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const now = new Date();
    const expectedMonth = String(now.getMonth() + 1);
    const expectedYear = String(now.getFullYear());
    const expectedMonthLabel = MONTH_LABELS[now.getMonth()];
    const runTag = buildUniqueDescription('E2E_CLARITY_LEADER_LINK');
    const fixtureDescriptions = [
      `${runTag}_leader_1`,
      `${runTag}_leader_2`,
      `${runTag}_other`,
    ];

    const client = await insertLeaderFixtureRows(fixtureDescriptions);

    try {
      await waitForLeaderCard(page, runTag, LEADER_CATEGORY, 180000);

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
      await client.auth.signOut();
    }
  });
});
