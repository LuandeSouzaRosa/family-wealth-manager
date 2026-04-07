#!/usr/bin/env node
const path = require("path");
const {
  createServiceClient,
  formatMoney,
  monthBoundsUtc,
  readArgValue,
  resolveUserByEmail,
  writeJson,
} = require("./utils/fwm-ops-utils");

// Import the central dashboard context TS logic directly via TSX
const { buildPostImportReviewContext } = require("../src/lib/post-import-review-context.ts");

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

  const email = readArgValue(args, "--email") || env.HOMOLOG_EMAIL || null;
  if (!email) {
    throw new Error(
      'Missing target email. Provide "--email user@domain.com" or set HOMOLOG_EMAIL in .env.local.'
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
  
  // Transform DB rows keeping nulls safe before parsing to TS structure
  const periodRows = rows.map(r => ({
      categoria: r.categoria,
      descricao: r.descricao,
      responsavel: r.responsavel,
      tipo: r.tipo,
      status: r.status,
      origem: String(r.origem || ""),
      valor: Number(r.valor) || 0,
      data: r.data
  }));

  const context = buildPostImportReviewContext(periodRows, periodRows);
  const summary = context.consolidatedSummary;
  const priorities = context.periodPriorities;

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
    context,
  });

  console.log("");
  console.log(`=== 🩺 FATURAMENTO / SAUDE DO MES: ${context.periodLabel} ===`);

  console.log(`\n[1] 📆 STATUS DO MÊS: [${context.monthOperationalStatus.toUpperCase()}]`);
  console.log(`  -> ${context.monthOperationalReason}`);

  console.log("\n[2] 📦 VISAO GERAL DE INGESTAO");
  console.log(`  🔹 Total na base local: ${rows.length} lançamentos`);
  console.log(`  🔹 Total ignorado/genérico ("Outros"): ${context.outrosRows} itens (${formatMoney(context.outrosValue)})`);
  console.log(`  🔹 Total ambíguo/warns passivos: ${context.ambiguousRows} itens (${formatMoney(context.ambiguousValue)})`);
  
  if (context.topGenericDescriptions.length > 0) {
      console.log(`  ⚠️ Top Textos Genéricos Persistentes:`);
      context.topGenericDescriptions.forEach((d) => console.log(`     - ${d.descricao}: ${formatMoney(d.valor)}`));
  }

  console.log("\n[3] 👥 CONFIABILIDADE POR RESPONSAVEL");
  console.log(`  🌍 Cobertura do Casal: [${summary.coverage.status.toUpperCase()}]`);
  if (summary.coverage.missingForCouple.length > 0) {
      console.log(`     -> Ausência material detectada para: ${summary.coverage.missingForCouple.join(" e ")}`);
  }

  for (const view of summary.views) {
      let icon = "✅";
      if (view.mode === "insufficient_base") icon = "❌";
      if (view.mode === "non_consumption_dominant") icon = "⚠️";

      let statusMsg = "Consumo focado";
      if (view.mode === "insufficient_base") statusMsg = "Base insuficiente (< R$ 150)";
      if (view.mode === "non_consumption_dominant") statusMsg = "Dominado por Não-Consumo";

      console.log(`  ${icon} ${view.responsavel.padEnd(6, " ")} | Status: ${statusMsg.padEnd(28, " ")} | Base: ${formatMoney(view.totalConsumptionValue)} | Financeiro Ofuscante: ${formatMoney(view.totalNonConsumptionValue)}`);
  }

  console.log("\n[4] 🎯 PRÓXIMO MELHOR PASSO (PMP)");
  console.log(`  🎯 Foco: ${priorities.target}`);
  console.log(`  👉 Ação: ${priorities.nextAction.text}`);
  console.log(`  💡 ROI:  ${priorities.expectedConfidenceImpact}`);
  
  if (priorities.confidenceLimiter) {
     console.log(`  🚧 Alerta de Bloqueio: ${priorities.confidenceLimiter.text}`);
  }

  console.log(`\n📄 Report gerado em: ${reportPath}`);
  console.log("=============================================\n");
}

main().catch((error) => {
  console.error(`[post-import-validation] Failed: ${error?.message || error}`);
  process.exit(1);
});
