#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const dotenv = require("dotenv");
const { readArgValue, writeJson } = require("./utils/fwm-ops-utils");

const projectRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(projectRoot, ".env.local") });

async function waitForServer(url, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Keep retrying until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server not ready at ${url} within ${timeoutMs}ms.`);
}

function parseCountFromText(text, labelPattern) {
  const strategies = [
    { method: "number-before-label", regex: new RegExp(`(\\d+)\\s*${labelPattern}`, "i") },
    { method: "label-before-number", regex: new RegExp(`${labelPattern}\\s*(\\d+)`, "i") },
  ];

  for (const strategy of strategies) {
    const match = text.match(strategy.regex);
    if (match?.[1]) {
      return { value: Number(match[1]), method: strategy.method };
    }
  }

  return { value: null, method: null };
}

async function parseCountFromCardDom(page, labelRegex) {
  const label = page.locator("span", { hasText: labelRegex }).first();
  if ((await label.count()) < 1) return null;

  return label.evaluate((element) => {
    const card = element.closest("div");
    if (!card) return null;

    const metricSpan = card.querySelector("span.text-3xl") || card.querySelector("span");
    if (!metricSpan) return null;

    const metricText = String(metricSpan.textContent || "");
    const metricMatch = metricText.match(/-?\d+/);
    if (!metricMatch?.[0]) return null;

    return Number(metricMatch[0]);
  });
}

async function resolveReceiptText(page) {
  const heading = page.getByRole("heading", { name: /Lote processado com sucesso/i }).first();
  const cardText = await heading
    .locator("xpath=ancestor::div[contains(@class, 'p-8')][1]")
    .innerText()
    .catch(() => "");

  if (cardText.trim()) return cardText;
  return page.locator("body").innerText();
}

async function uploadCsv(page, csvPath) {
  const dropzone = page.getByText("Clique para selecionar ou arraste seu CSV").first();
  await dropzone.waitFor({ state: "visible", timeout: 30000 });

  try {
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 5000 }),
      dropzone.click(),
    ]);
    await fileChooser.setFiles(csvPath);
    return;
  } catch {
    await page.setInputFiles("#csv-upload", csvPath);
  }
}

function readRequiredCredential(args, argName, envName) {
  const value = readArgValue(args, argName) || process.env[envName] || null;
  if (!value) {
    throw new Error(
      `Missing credential "${argName}". Provide "${argName} <value>" or set ${envName} in .env.local.`
    );
  }
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Usage: npm run ops:real-import-ui -- --file <csv-path> [--email user@domain.com] [--password <pwd>] [--base-url http://127.0.0.1:3001]"
    );
    console.log(
      "Runs real CSV import through /conciliacao UI and writes operational receipt report under web/.tmp-ops/."
    );
    console.log("Requires local app server available at --base-url (or NEXT_PUBLIC_APP_URL).");
    return;
  }

  const fileArg = readArgValue(args, "--file");
  if (!fileArg) {
    throw new Error('Missing required argument "--file <csv-path>".');
  }

  const csvPath = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const baseUrl =
    readArgValue(args, "--base-url") || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3001";
  const email = readRequiredCredential(args, "--email", "TEST_EMAIL");
  const password = readRequiredCredential(args, "--password", "TEST_PASSWORD");

  await waitForServer(baseUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", (msg) => {
    console.log(`[real-import-ui][console:${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (error) => {
    console.log(`[real-import-ui][pageerror] ${error?.message || error}`);
  });
  page.on("requestfailed", (request) => {
    console.log(
      `[real-import-ui][requestfailed] ${request.method()} ${request.url()} ${
        request.failure()?.errorText || ""
      }`
    );
  });

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 60000 });

    await page.goto(`${baseUrl}/conciliacao`, { waitUntil: "domcontentloaded" });
    await uploadCsv(page, csvPath);

    const previewState = await Promise.race([
      page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 120000 })
        .then(() => "preview"),
      page
        .getByText(/Erro ao ler CSV/i)
        .waitFor({ state: "visible", timeout: 120000 })
        .then(() => "csv-error"),
    ]);

    if (previewState !== "preview") {
      throw new Error("CSV read error toast visible in import preview.");
    }

    const previewRows = await page.locator("table tbody tr").count();
    console.log(`[real-import-ui] Preview rows detected: ${previewRows}`);

    const pendingReviewButton = page.getByRole("button", {
      name: /Revise as pendencias antes de importar/i,
    });
    if (await pendingReviewButton.isVisible().catch(() => false)) {
      throw new Error("Import blocked by pending reconciliation review rows.");
    }

    const confirmButton = page.getByRole("button", {
      name: /Confirmar e Importar/i,
    });
    await confirmButton.click();

    await page
      .getByRole("heading", { name: /Lote processado com sucesso/i })
      .waitFor({ state: "visible", timeout: 180000 });

    const rawReceiptText = await resolveReceiptText(page);
    const warnings = [];

    const importedParsed = parseCountFromText(rawReceiptText, "N\\.?\\s*Importadas");
    const conciliatedParsed = parseCountFromText(rawReceiptText, "Conciliadas");
    const ignoredParsed = parseCountFromText(rawReceiptText, "Ignoradas");

    let importedCount = importedParsed.value;
    let conciliatedCount = conciliatedParsed.value;
    let ignoredCount = ignoredParsed.value;

    let importedMethod = importedParsed.method;
    let conciliatedMethod = conciliatedParsed.method;
    let ignoredMethod = ignoredParsed.method;

    if (importedCount === null) {
      const domValue = await parseCountFromCardDom(page, /N\. Importadas/i);
      if (domValue !== null) {
        importedCount = domValue;
        importedMethod = "dom-card-fallback";
      }
    }

    if (conciliatedCount === null) {
      const domValue = await parseCountFromCardDom(page, /Conciliadas/i);
      if (domValue !== null) {
        conciliatedCount = domValue;
        conciliatedMethod = "dom-card-fallback";
      }
    }

    if (ignoredCount === null) {
      const domValue = await parseCountFromCardDom(page, /Ignoradas/i);
      if (domValue !== null) {
        ignoredCount = domValue;
        ignoredMethod = "dom-card-fallback";
      }
    }

    if (importedCount === null) {
      warnings.push("Unable to parse imported count from receipt UI.");
    }
    if (conciliatedCount === null) {
      warnings.push("Unable to parse conciliated count from receipt UI.");
    }

    const now = new Date();
    const timestampTag = now.toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(projectRoot, ".tmp-ops", `ui-real-import-${timestampTag}.json`);

    const report = {
      workflow: "real-import-ui",
      generatedAt: now.toISOString(),
      input: {
        file: csvPath,
        email,
        baseUrl,
      },
      result: {
        success: true,
        previewRows,
        receiptDetected: /Lote processado com sucesso/i.test(rawReceiptText),
        rawReceiptText,
        importedCountText: importedCount === null ? null : String(importedCount),
        conciliatedCountText: conciliatedCount === null ? null : String(conciliatedCount),
        ignoredCountText: ignoredCount === null ? null : String(ignoredCount),
        parsing: {
          imported: importedMethod,
          conciliated: conciliatedMethod,
          ignored: ignoredMethod,
          usedFallback:
            importedMethod === "dom-card-fallback" ||
            conciliatedMethod === "dom-card-fallback" ||
            ignoredMethod === "dom-card-fallback",
        },
        warnings,
      },
    };

    writeJson(reportPath, report);

    console.log("[real-import-ui] Completed.");
    console.log(`[real-import-ui] Report: ${reportPath}`);
    console.log(
      `[real-import-ui] imported=${report.result.importedCountText} conciliated=${report.result.conciliatedCountText} ignored=${report.result.ignoredCountText}`
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`[real-import-ui] Failed: ${error?.message || error}`);
  process.exit(1);
});
