const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFromFile(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    out[key] = value;
  }
  return out;
}

function loadMergedEnv(projectRoot) {
  const envFile = path.join(projectRoot, ".env.local");
  const fileEnv = loadEnvFromFile(envFile);
  return { ...fileEnv, ...process.env };
}

function getRequiredEnv(env, key) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required env "${key}".`);
  }
  return value;
}

function createServiceClient(projectRoot) {
  const env = loadMergedEnv(projectRoot);
  const url = getRequiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = getRequiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  const client = createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return { client, env };
}

async function resolveUserByEmail(client, email, options = {}) {
  const target = String(email || "").trim().toLowerCase();
  if (!target) {
    throw new Error("Missing email for user lookup.");
  }

  const perPage = Number.isFinite(Number(options.perPage))
    ? Math.max(1, Math.min(1000, Number(options.perPage)))
    : 200;
  const maxPages = Number.isFinite(Number(options.maxPages))
    ? Math.max(1, Number(options.maxPages))
    : 50;

  let page = 1;
  let pagesFetched = 0;
  let usersScanned = 0;

  while (page <= maxPages) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    usersScanned += users.length;
    pagesFetched += 1;

    const user = users.find(
      (entry) => entry.email && entry.email.toLowerCase() === target
    );
    if (user?.id) {
      return {
        user,
        resolution: {
          pageFound: page,
          pagesFetched,
          usersScanned,
          perPage,
          maxPages,
        },
      };
    }

    if (users.length < perPage) break;
    page += 1;
  }

  throw new Error(
    `User not found for email "${email}" after scanning ${usersScanned} user(s) across ${pagesFetched} page(s).`
  );
}

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeForMatch(value) {
  return normalizeToken(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_CATEGORIES = new Set([
  "outros",
  "sem categoria",
  "sem categorizacao",
  "nao categorizado",
]);

function isGenericCategory(value) {
  return GENERIC_CATEGORIES.has(normalizeToken(value));
}

function parseMoney(input) {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  const source = String(input || "").trim();
  if (!source) return 0;

  const normalized = source
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\.(?=\d{3}(?:[^\d]|$))/g, "")
    .replace(",", ".");

  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function sanitizeRuleText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractRuleAliasFromDescription(descricao) {
  const normalized = sanitizeRuleText(descricao);

  const pixMatch = normalized.match(
    /^transfer[e\u00ea]ncia enviada pelo pix\s*-\s*(.+?)\s*-\s*(?:\d|\u2022)/i
  );
  if (pixMatch && pixMatch[1]) return sanitizeRuleText(pixMatch[1]);

  const debitoMatch = normalized.match(/^compra no d[e\u00e9]bito\s*-\s*(.+)$/i);
  if (debitoMatch && debitoMatch[1]) return sanitizeRuleText(debitoMatch[1]);

  const boletoMatch = normalized.match(/^pagamento de boleto efetuado\s*-\s*(.+)$/i);
  if (boletoMatch && boletoMatch[1]) return sanitizeRuleText(boletoMatch[1]);

  return null;
}

function deriveRuleTextFromDescription(descricao) {
  const trimmed = sanitizeRuleText(descricao);
  if (!trimmed) return "";

  const alias = extractRuleAliasFromDescription(trimmed);
  if (!alias || alias.length < 4) return trimmed;

  return alias;
}

function buildRuleTokens(textoContem) {
  const primary = normalizeForMatch(textoContem);
  if (!primary) return [];

  const alias = extractRuleAliasFromDescription(textoContem);
  const aliasNormalized = alias ? normalizeForMatch(alias) : "";

  if (!aliasNormalized || aliasNormalized === primary) {
    return [primary];
  }

  return [primary, aliasNormalized];
}

function createdAtScore(value) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function inferCategoryByHeuristic(normalizedDescription) {
  if (normalizedDescription.includes("pagamento de fatura")) return "Fatura Cartao";
  if (
    normalizedDescription.includes("transferencia enviada pelo pix") &&
    normalizedDescription.includes("juliana patricio martello")
  ) {
    return "Moradia";
  }
  if (
    normalizedDescription.includes("compra no debito") &&
    normalizedDescription.includes("administradora")
  ) {
    return "Moradia";
  }
  if (normalizedDescription.includes("milium loja")) {
    return "Moradia";
  }
  if (
    normalizedDescription.includes("pagamento de boleto efetuado") &&
    normalizedDescription.includes("sefaz")
  ) {
    return "Transporte";
  }
  if (
    normalizedDescription.includes("transferencia enviada pelo pix") &&
    normalizedDescription.includes("banco xp")
  ) {
    return "Investimentos";
  }
  if (
    normalizedDescription.includes("ifood") ||
    normalizedDescription.includes("restaurante") ||
    normalizedDescription.includes("fast food") ||
    normalizedDescription.includes("marmitas") ||
    normalizedDescription.includes("supermercado") ||
    normalizedDescription.includes("market") ||
    normalizedDescription.includes("pan de amore")
  ) {
    return "Alimentação";
  }
  return null;
}

function categorizeImportedDescription(descricao, rules) {
  const normalizedDescription = normalizeForMatch(descricao);
  if (!normalizedDescription) return "Outros";

  const candidates = [];
  (rules || []).forEach((rule, ruleIndex) => {
    const category = (rule.categoria_destino || "").trim();
    if (!category) return;

    const tokens = buildRuleTokens(rule.texto_contem);
    tokens.forEach((token, tokenIndex) => {
      if (token.length < 3) return;
      if (!normalizedDescription.includes(token)) return;

      candidates.push({
        category,
        tokenLength: token.length,
        createdAt: createdAtScore(rule.created_at),
        ruleIndex,
        tokenIndex,
      });
    });
  });

  if (candidates.length === 0) {
    return inferCategoryByHeuristic(normalizedDescription) || "Outros";
  }

  candidates.sort((a, b) => {
    if (b.tokenLength !== a.tokenLength) return b.tokenLength - a.tokenLength;
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
    if (a.ruleIndex !== b.ruleIndex) return a.ruleIndex - b.ruleIndex;
    return a.tokenIndex - b.tokenIndex;
  });

  return candidates[0].category;
}

function readArgValue(args, key) {
  const direct = args.find((arg) => arg.startsWith(`${key}=`));
  if (direct) return direct.slice(key.length + 1);
  const index = args.indexOf(key);
  if (index >= 0 && index + 1 < args.length) return args[index + 1];
  return null;
}

function hasArg(args, flag) {
  return args.includes(flag);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function monthBoundsUtc(year, month1to12) {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1));
  const endExclusive = new Date(Date.UTC(year, month1to12, 1));
  return { start, endExclusive };
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

module.exports = {
  createServiceClient,
  deriveRuleTextFromDescription,
  formatMoney,
  hasArg,
  isGenericCategory,
  monthBoundsUtc,
  parseMoney,
  readArgValue,
  resolveUserByEmail,
  writeJson,
  categorizeImportedDescription,
  normalizeToken,
};
