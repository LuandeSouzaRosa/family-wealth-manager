#!/usr/bin/env node
const crypto = require("crypto");
const path = require("path");
const {
  createServiceClient,
  formatMoney,
  hasArg,
  readArgValue,
  resolveUserByEmail,
  writeJson,
} = require("./utils/fwm-ops-utils");

async function readTableCount(client, table, userId) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    return { table, ok: false, error: error.message, count: null };
  }
  return { table, ok: true, count: count ?? 0 };
}

async function readTransactionsSummary(client, userId) {
  const { data, error } = await client
    .from("transacoes")
    .select("id, valor, tipo, status, origem")
    .eq("user_id", userId);
  if (error) throw error;

  const rows = data || [];
  const byOrigin = {};
  let saidasRealizadas = 0;
  let entradasRealizadas = 0;

  for (const row of rows) {
    const origin = row.origem || "Sem origem";
    byOrigin[origin] = (byOrigin[origin] || 0) + 1;
    const valor = Number(row.valor || 0);
    const tipo = String(row.tipo || "").toLowerCase();
    const status = String(row.status || "").toLowerCase();
    if (status === "agendado" || status === "pendente") continue;
    if (tipo.includes("sa")) saidasRealizadas += valor;
    if (tipo.includes("entrada")) entradasRealizadas += valor;
  }

  return {
    totalRows: rows.length,
    byOrigin,
    entradasRealizadas,
    saidasRealizadas,
    saldoRealizado: entradasRealizadas - saidasRealizadas,
  };
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeRuleRow(row) {
  return {
    id: String(row.id || ""),
    user_id: String(row.user_id || ""),
    texto_contem: String(row.texto_contem || "").trim(),
    categoria_destino: String(row.categoria_destino || "").trim(),
    created_at: String(row.created_at || ""),
  };
}

async function readRulesIntegrity(client, userId) {
  const { data, error } = await client
    .from("regras_categorizacao")
    .select("id, user_id, texto_contem, categoria_destino, created_at")
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message, count: null, hash: null };
  }

  const normalizedRows = (data || []).map(normalizeRuleRow).sort((a, b) => {
    if (a.id !== b.id) return a.id.localeCompare(b.id);
    if (a.texto_contem !== b.texto_contem) return a.texto_contem.localeCompare(b.texto_contem);
    return a.categoria_destino.localeCompare(b.categoria_destino);
  });

  const hash = sha256(JSON.stringify(normalizedRows));
  return { ok: true, count: normalizedRows.length, hash };
}

function toCountMap(transactionsSummary, preservedCounts) {
  const map = {
    transacoes: transactionsSummary.totalRows,
  };

  for (const entry of preservedCounts) {
    map[entry.table] = entry.ok ? entry.count : null;
  }

  return map;
}

function printCountLine(label, value) {
  const printable = value === null || value === undefined ? "erro" : String(value);
  console.log(`[prepare-real-import-reset] before ${label}: ${printable}`);
}

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const args = process.argv.slice(2);
  if (hasArg(args, "--help")) {
    console.log(
      "Usage: npm run ops:prepare-real-import-reset -- [--dry-run] [--confirm] [--email user@domain.com]"
    );
    console.log(
      "Safe reset for real import: dry-run previews target/scope without deletion; confirm mode clears only transacoes for target user."
    );
    return;
  }
  const dryRun = hasArg(args, "--dry-run");
  const confirm = hasArg(args, "--confirm");

  if (!dryRun && !confirm) {
    console.error(
      "[prepare-real-import-reset] Missing --confirm. Use --dry-run for a safe preview or --confirm for destructive execution."
    );
    console.error(
      "[prepare-real-import-reset] Example dry-run: npm run ops:prepare-real-import-reset -- --dry-run --email you@example.com"
    );
    console.error(
      "[prepare-real-import-reset] Example real reset: npm run ops:prepare-real-import-reset -- --confirm --email you@example.com"
    );
    process.exit(1);
  }

  const { client, env } = createServiceClient(projectRoot);
  const email =
    readArgValue(args, "--email") || env.TEST_EMAIL || env.DEFAULT_RESET_EMAIL || null;

  if (!email) {
    throw new Error(
      'Missing target email. Provide "--email user@domain.com" or set TEST_EMAIL in .env.local.'
    );
  }

  const { user, resolution } = await resolveUserByEmail(client, email);
  const now = new Date();
  const timestampTag = now.toISOString().replace(/[:.]/g, "-");

  const preservedTables = [
    "regras_categorizacao",
    "categorias",
    "contas_bancarias",
    "orcamentos",
    "metas",
    "recorrentes",
  ];
  const cleanedTables = ["transacoes"];

  const [beforeTransactions, beforePreservedCounts, beforeRulesIntegrity] = await Promise.all([
    readTransactionsSummary(client, user.id),
    Promise.all(preservedTables.map((table) => readTableCount(client, table, user.id))),
    readRulesIntegrity(client, user.id),
  ]);

  const snapshotPath = path.join(
    projectRoot,
    ".tmp-ops",
    `real-import-reset-snapshot-${timestampTag}.json`
  );
  const dryRunReportPath = path.join(
    projectRoot,
    ".tmp-ops",
    `real-import-reset-dry-run-${timestampTag}.json`
  );

  const countMapBefore = toCountMap(beforeTransactions, beforePreservedCounts);
  const snapshot = {
    workflow: "prepare-real-import-reset",
    generatedAt: now.toISOString(),
    mode: dryRun ? "dry-run" : "confirm",
    user: {
      id: user.id,
      email: user.email,
    },
    target: {
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      userLookup: resolution,
    },
    policy: {
      cleanedTables,
      preservedTables,
      note: "Categorization rules are preserved by policy.",
    },
    plan: {
      wouldDelete: cleanedTables,
      wouldPreserve: preservedTables,
      snapshotPathOnRealRun: snapshotPath,
    },
    before: {
      transactions: beforeTransactions,
      countMap: countMapBefore,
      preservedCounts: beforePreservedCounts,
      regrasCategorizacaoIntegrity: beforeRulesIntegrity,
    },
  };

  if (dryRun) {
    writeJson(dryRunReportPath, {
      ...snapshot,
      output: { dryRunReportPath },
    });
    console.log("[prepare-real-import-reset] Completed (dry-run).");
    console.log(`[prepare-real-import-reset] Supabase target: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
    console.log(`[prepare-real-import-reset] Target email: ${user.email}`);
    console.log(`[prepare-real-import-reset] Target user id: ${user.id}`);
    printCountLine("transacoes", countMapBefore.transacoes);
    for (const table of preservedTables) {
      printCountLine(table, countMapBefore[table]);
    }
    console.log(`[prepare-real-import-reset] Would delete: ${cleanedTables.join(", ")}`);
    console.log(`[prepare-real-import-reset] Would preserve: ${preservedTables.join(", ")}`);
    console.log(`[prepare-real-import-reset] Snapshot path on real run: ${snapshotPath}`);
    console.log(`[prepare-real-import-reset] Dry-run report: ${dryRunReportPath}`);
    return;
  }

  writeJson(snapshotPath, snapshot);

  const { error: deleteError } = await client
    .from("transacoes")
    .delete()
    .eq("user_id", user.id);
  if (deleteError) throw deleteError;

  const [afterTransactions, afterPreservedCounts, afterRulesIntegrity] = await Promise.all([
    readTransactionsSummary(client, user.id),
    Promise.all(preservedTables.map((table) => readTableCount(client, table, user.id))),
    readRulesIntegrity(client, user.id),
  ]);
  const countMapAfter = toCountMap(afterTransactions, afterPreservedCounts);

  const afterSnapshot = {
    ...snapshot,
    after: {
      transactions: afterTransactions,
      countMap: countMapAfter,
      preservedCounts: afterPreservedCounts,
      regrasCategorizacaoIntegrity: afterRulesIntegrity,
    },
  };
  writeJson(snapshotPath, afterSnapshot);

  const changedPreservedTables = [];
  for (const beforeEntry of beforePreservedCounts) {
    const afterEntry = afterPreservedCounts.find((x) => x.table === beforeEntry.table);
    if (!beforeEntry.ok || !afterEntry?.ok) continue;
    if (beforeEntry.count !== afterEntry.count) {
      changedPreservedTables.push({
        table: beforeEntry.table,
        before: beforeEntry.count,
        after: afterEntry.count,
      });
      }
  }

  const rulesIntegrityChanged =
    !beforeRulesIntegrity.ok ||
    !afterRulesIntegrity.ok ||
    beforeRulesIntegrity.hash !== afterRulesIntegrity.hash;

  console.log("[prepare-real-import-reset] Completed.");
  console.log(`[prepare-real-import-reset] Supabase target: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`[prepare-real-import-reset] User: ${user.email}`);
  console.log(`[prepare-real-import-reset] User id: ${user.id}`);
  console.log(
    `[prepare-real-import-reset] Transactions before: ${beforeTransactions.totalRows} | after: ${afterTransactions.totalRows}`
  );
  console.log(
    `[prepare-real-import-reset] Realized saldo before: ${formatMoney(
      beforeTransactions.saldoRealizado
    )} | after: ${formatMoney(afterTransactions.saldoRealizado)}`
  );
  console.log(`[prepare-real-import-reset] Snapshot: ${snapshotPath}`);

  if (changedPreservedTables.length > 0) {
    console.log(
      `[prepare-real-import-reset] WARNING: preserved table counts changed: ${JSON.stringify(
        changedPreservedTables
      )}`
    );
    process.exitCode = 2;
    return;
  }

  if (afterTransactions.totalRows !== 0) {
    console.log(
      "[prepare-real-import-reset] WARNING: transaction rows still present after cleanup."
    );
    process.exitCode = 2;
    return;
  }

  if (rulesIntegrityChanged) {
    console.log(
      `[prepare-real-import-reset] WARNING: regras_categorizacao integrity changed (before=${beforeRulesIntegrity.hash} after=${afterRulesIntegrity.hash}).`
    );
    process.exitCode = 2;
    return;
  }

  console.log(
    "[prepare-real-import-reset] Safety checks passed: transacoes cleared, preserved table counts unchanged, and regras_categorizacao integrity unchanged."
  );
}

main().catch((error) => {
  console.error(`[prepare-real-import-reset] Failed: ${error?.message || error}`);
  process.exit(1);
});
