#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const {
  categorizeImportedDescription,
  createServiceClient,
  formatMoney,
  isGenericCategory,
  parseMoney,
  readArgValue,
  resolveUserByEmail,
  writeJson,
} = require("./utils/fwm-ops-utils");

function pickFirst(row, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && String(row[key] || "").trim()) {
      return String(row[key]).trim();
    }
  }
  return "";
}

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
  });
  if (result.errors && result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(`CSV parse error (${first.code}): ${first.message}`);
  }
  return result.data || [];
}

function classifyCsvRow(row, rules) {
  const descricao = pickFirst(row, ["descricao", "Descrição", "description", "Historico", "histórico"]);
  const rawValue = pickFirst(row, ["valor", "Valor", "value", "amount"]);
  const signedValue = parseMoney(rawValue);
  const absValue = Math.abs(signedValue);
  const tipo = signedValue < 0 ? "Saida" : "Entrada";
  const categoria = categorizeImportedDescription(descricao, rules);

  return {
    descricao: descricao || "Sem descricao",
    tipo,
    signedValue,
    value: absValue,
    importable: absValue > 0,
    categoria,
    genericCategory: isGenericCategory(categoria),
  };
}

function summarize(rows) {
  const importable = rows.filter((r) => r.importable);
  const importableExpenses = importable.filter((r) => r.tipo === "Saida");

  const totals = {
    totalRows: rows.length,
    importableRows: importable.length,
    ignoredRows: rows.length - importable.length,
    importableExpenses: importableExpenses.length,
    importableExpensesValue: importableExpenses.reduce((acc, row) => acc + row.value, 0),
    genericExpenseRows: 0,
    genericExpenseValue: 0,
  };

  const categoryMap = new Map();
  const genericDescMap = new Map();

  for (const row of importableExpenses) {
    const catItem = categoryMap.get(row.categoria) || {
      categoria: row.categoria,
      total: 0,
      qtd: 0,
    };
    catItem.total += row.value;
    catItem.qtd += 1;
    categoryMap.set(row.categoria, catItem);

    if (row.genericCategory) {
      totals.genericExpenseRows += 1;
      totals.genericExpenseValue += row.value;
      const genericItem = genericDescMap.get(row.descricao) || {
        descricao: row.descricao,
        total: 0,
        qtd: 0,
      };
      genericItem.total += row.value;
      genericItem.qtd += 1;
      genericDescMap.set(row.descricao, genericItem);
    }
  }

  const genericShareRows =
    totals.importableExpenses > 0
      ? (totals.genericExpenseRows / totals.importableExpenses) * 100
      : 0;
  const genericShareValue =
    totals.importableExpensesValue > 0
      ? (totals.genericExpenseValue / totals.importableExpensesValue) * 100
      : 0;

  const topCategories = Array.from(categoryMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const topProblemDescriptions = Array.from(genericDescMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const clarityImpact = {
    dashboardInsightRisk:
      genericShareValue >= 70
        ? "alto"
        : genericShareValue >= 40
          ? "medio"
          : "baixo",
    notes: [],
  };

  if (totals.importableExpenses === 0) {
    clarityImpact.notes.push("Nao ha saidas importaveis no arquivo; spending clarity tende a ficar vazio.");
  } else {
    if (genericShareValue >= 40) {
      clarityImpact.notes.push(
        "Parcela relevante do valor de saidas tende a cair em categoria generica; insights ficam menos especificos."
      );
    }
    if (topProblemDescriptions.length > 0) {
      clarityImpact.notes.push(
        "Priorizar regras para top descricoes genericas pode melhorar utilidade do dashboard com baixo esforco."
      );
    }
  }

  return {
    totals: {
      ...totals,
      genericExpenseShareRowsPct: Number(genericShareRows.toFixed(1)),
      genericExpenseShareValuePct: Number(genericShareValue.toFixed(1)),
    },
    topCategories,
    topProblemDescriptions,
    clarityImpact,
  };
}

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Usage: npm run ops:analyze-bank-statement-import -- --file <csv-path> [--email user@domain.com]"
    );
    console.log(
      "Simulates import classification and reports generic category concentration before importing."
    );
    return;
  }
  const fileArg = readArgValue(args, "--file");
  if (!fileArg) {
    throw new Error('Missing "--file <csv-path>" argument.');
  }

  const csvPath = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const { client, env } = createServiceClient(projectRoot);
  const email = readArgValue(args, "--email") || env.TEST_EMAIL || null;
  if (!email) {
    throw new Error(
      'Missing target email. Provide "--email user@domain.com" or set TEST_EMAIL in .env.local.'
    );
  }

  const { user } = await resolveUserByEmail(client, email);
  const { data: rules, error } = await client
    .from("regras_categorizacao")
    .select("texto_contem, categoria_destino, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const csvRows = parseCsv(csvPath);
  const classified = csvRows.map((row) => classifyCsvRow(row, rules || []));
  const report = summarize(classified);

  const now = new Date();
  const timestampTag = now.toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    projectRoot,
    ".tmp-ops",
    `statement-analysis-${timestampTag}.json`
  );

  const payload = {
    workflow: "analyze-bank-statement-import",
    generatedAt: now.toISOString(),
    input: {
      file: csvPath,
      email,
      userId: user.id,
      rulesCount: (rules || []).length,
    },
    report,
  };

  writeJson(reportPath, payload);

  console.log("[analyze-bank-statement-import] Completed.");
  console.log(`[analyze-bank-statement-import] File: ${csvPath}`);
  console.log(
    `[analyze-bank-statement-import] Importable rows: ${report.totals.importableRows}/${report.totals.totalRows}`
  );
  console.log(
    `[analyze-bank-statement-import] Importable expenses: ${report.totals.importableExpenses} (${formatMoney(
      report.totals.importableExpensesValue
    )})`
  );
  console.log(
    `[analyze-bank-statement-import] Generic expense share: ${report.totals.genericExpenseShareRowsPct}% rows | ${report.totals.genericExpenseShareValuePct}% value`
  );
  console.log(
    `[analyze-bank-statement-import] Clarity risk: ${report.clarityImpact.dashboardInsightRisk}`
  );
  console.log(`[analyze-bank-statement-import] Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(`[analyze-bank-statement-import] Failed: ${error?.message || error}`);
  process.exit(1);
});
