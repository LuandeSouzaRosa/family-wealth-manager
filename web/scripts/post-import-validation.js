#!/usr/bin/env node
const path = require("path");
const {
  createServiceClient,
  formatMoney,
  isGenericCategory,
  monthBoundsUtc,
  normalizeToken,
  readArgValue,
  resolveUserByEmail,
  writeJson,
} = require("./utils/fwm-ops-utils");

function isExpenseType(tipo) {
  return normalizeToken(tipo) === "saida";
}

function isRealized(status) {
  const value = normalizeToken(status);
  return value !== "agendado" && value !== "pendente";
}

function summarizeByCategory(rows) {
  const map = new Map();
  for (const row of rows) {
    const categoria = String(row.categoria || "Sem categoria").trim() || "Sem categoria";
    const value = Number(row.valor || 0);
    const item = map.get(categoria) || { categoria, total: 0, qtd: 0 };
    item.total += value;
    item.qtd += 1;
    map.set(categoria, item);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Usage: npm run ops:post-import-validation -- [--email user@domain.com] [--year YYYY] [--month MM]"
    );
    console.log(
      "Validates post-import reading quality for extrato/dashboard using current month by default."
    );
    return;
  }
  const { client, env } = createServiceClient(projectRoot);

  const email = readArgValue(args, "--email") || env.TEST_EMAIL || null;
  if (!email) {
    throw new Error(
      'Missing target email. Provide "--email user@domain.com" or set TEST_EMAIL in .env.local.'
    );
  }

  const now = new Date();
  const year = Number(readArgValue(args, "--year") || now.getUTCFullYear());
  const month = Number(readArgValue(args, "--month") || now.getUTCMonth() + 1);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error("Invalid --year/--month arguments.");
  }

  const { user } = await resolveUserByEmail(client, email);
  const { start, endExclusive } = monthBoundsUtc(year, month);

  const { data, error } = await client
    .from("transacoes")
    .select("id, descricao, valor, categoria, tipo, status, responsavel, origem, data")
    .eq("user_id", user.id)
    .gte("data", start.toISOString())
    .lt("data", endExclusive.toISOString());
  if (error) throw error;

  const rows = data || [];
  const importedRows = rows.filter((row) => String(row.origem || "").toLowerCase().includes("import"));
  const realizedExpenses = rows.filter((row) => isExpenseType(row.tipo) && isRealized(row.status));
  const importedRealizedExpenses = importedRows.filter(
    (row) => isExpenseType(row.tipo) && isRealized(row.status)
  );

  const totalRealizedExpenseValue = realizedExpenses.reduce(
    (sum, row) => sum + Number(row.valor || 0),
    0
  );
  const importedRealizedExpenseValue = importedRealizedExpenses.reduce(
    (sum, row) => sum + Number(row.valor || 0),
    0
  );

  const genericRows = realizedExpenses.filter((row) => isGenericCategory(row.categoria));
  const genericValue = genericRows.reduce((sum, row) => sum + Number(row.valor || 0), 0);

  const genericRowsPct =
    realizedExpenses.length > 0 ? (genericRows.length / realizedExpenses.length) * 100 : 0;
  const genericValuePct =
    totalRealizedExpenseValue > 0 ? (genericValue / totalRealizedExpenseValue) * 100 : 0;

  const topCategories = summarizeByCategory(realizedExpenses).slice(0, 6);
  const topGenericDescriptions = summarizeByCategory(
    genericRows.map((row) => ({ ...row, categoria: row.descricao || "Sem descricao" }))
  ).slice(0, 8);

  const validation = {
    monthRef: `${year}-${String(month).padStart(2, "0")}`,
    totals: {
      monthRows: rows.length,
      importedRows: importedRows.length,
      realizedExpenses: realizedExpenses.length,
      realizedExpenseValue: totalRealizedExpenseValue,
      importedRealizedExpenses: importedRealizedExpenses.length,
      importedRealizedExpenseValue,
      genericExpenseRows: genericRows.length,
      genericExpenseValue: genericValue,
      genericExpenseRowsPct: Number(genericRowsPct.toFixed(1)),
      genericExpenseValuePct: Number(genericValuePct.toFixed(1)),
    },
    topCategories,
    topGenericDescriptions,
    interpretation: {
      extratoReflectsImport: importedRows.length > 0,
      dashboardHasExpenseBase: realizedExpenses.length > 0,
      clarityRisk:
        genericValuePct >= 70 ? "alto" : genericValuePct >= 40 ? "medio" : "baixo",
      notes: [],
    },
  };

  if (!validation.interpretation.extratoReflectsImport) {
    validation.interpretation.notes.push(
      "Nao ha linhas de importacao no recorte; validar se o CSV foi importado no mes analisado."
    );
  }
  if (
    validation.interpretation.extratoReflectsImport &&
    !validation.interpretation.dashboardHasExpenseBase
  ) {
    validation.interpretation.notes.push(
      "Ha importacao, mas sem saidas realizadas no recorte; spending clarity pode ficar vazio de forma legitima."
    );
  }
  if (validation.interpretation.dashboardHasExpenseBase && genericValuePct >= 40) {
    validation.interpretation.notes.push(
      "Parcela alta de valor em categoria generica pode enfraquecer insight de 'no que estou gastando tanto'."
    );
  }

  const nowIso = new Date().toISOString();
  const reportPath = path.join(
    projectRoot,
    ".tmp-ops",
    `post-import-validation-${nowIso.replace(/[:.]/g, "-")}.json`
  );
  writeJson(reportPath, {
    workflow: "post-import-validation",
    generatedAt: nowIso,
    user: { id: user.id, email: user.email },
    validation,
  });

  console.log("[post-import-validation] Completed.");
  console.log(`[post-import-validation] Month: ${validation.monthRef}`);
  console.log(
    `[post-import-validation] Import rows in month: ${validation.totals.importedRows} | realized expenses: ${validation.totals.realizedExpenses} (${formatMoney(
      validation.totals.realizedExpenseValue
    )})`
  );
  console.log(
    `[post-import-validation] Generic share on realized expenses: ${validation.totals.genericExpenseRowsPct}% rows | ${validation.totals.genericExpenseValuePct}% value`
  );
  console.log(
    `[post-import-validation] Clarity risk: ${validation.interpretation.clarityRisk}`
  );
  console.log(`[post-import-validation] Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(`[post-import-validation] Failed: ${error?.message || error}`);
  process.exit(1);
});
