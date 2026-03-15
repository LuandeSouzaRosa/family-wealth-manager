const assert = require('assert');

console.log("🚀 Iniciando Testes de Lógica de Negócios...\n");

// ==========================================
// 1. Lógica de Filtro de Responsável
// ==========================================
function shouldShow(itemResponsavel, filtro) {
  if (filtro === "Todos") return true;
  // Tratamento de null/undefined
  if (!itemResponsavel) return false;
  return itemResponsavel.toLowerCase() === filtro.toLowerCase();
}

try {
  console.log("🧪 Testando Filtro de Responsável...");
  assert.strictEqual(shouldShow("Luan", "Todos"), true, "Falha: Todos deve mostrar Luan");
  assert.strictEqual(shouldShow("Esposa", "Todos"), true, "Falha: Todos deve mostrar Esposa");
  assert.strictEqual(shouldShow("Luan", "Luan"), true, "Falha: Luan deve mostrar Luan");
  assert.strictEqual(shouldShow("luan", "Luan"), true, "Falha: Case insensitive falhou");
  assert.strictEqual(shouldShow("Esposa", "Luan"), false, "Falha: Luan não deve mostrar Esposa");
  assert.strictEqual(shouldShow(null, "Luan"), false, "Falha: Null deve ser ignorado");
  console.log("✅ Filtro: PASSOU\n");
} catch (e) {
  console.error("❌ Filtro: FALHOU", e.message);
  process.exit(1);
}

// ==========================================
// 2. Lógica de Categorização Inteligente
// ==========================================
function aplicarRegras(descricao, regras) {
  if (!descricao) return "Outros";
  const regra = regras.find(r => descricao.toLowerCase().includes(r.texto_contem.toLowerCase()));
  return regra ? regra.categoria_destino : "Outros";
}

const regrasMock = [
  { texto_contem: "Uber", categoria_destino: "Transporte" },
  { texto_contem: "Ifood", categoria_destino: "Alimentação" }
];

try {
  console.log("🧪 Testando Categorização Inteligente...");
  assert.strictEqual(aplicarRegras("Uber * Viagem", regrasMock), "Transporte", "Falha: Uber não detectado");
  assert.strictEqual(aplicarRegras("IFOOD SP", regrasMock), "Alimentação", "Falha: Ifood (case) não detectado");
  assert.strictEqual(aplicarRegras("Padaria", regrasMock), "Outros", "Falha: Padaria deveria ser Outros");
  console.log("✅ Categorização: PASSOU\n");
} catch (e) {
  console.error("❌ Categorização: FALHOU", e.message);
  process.exit(1);
}

// ==========================================
// 3. Lógica de Saldo Livre
// ==========================================
function calcularSaldoLivre(saldoTotal, metas) {
  const saldoComprometido = metas.reduce((acc, m) => acc + (m.valor_atual || 0), 0);
  return saldoTotal - saldoComprometido;
}

try {
  console.log("🧪 Testando Cálculo de Saldo Livre...");
  assert.strictEqual(calcularSaldoLivre(10000, [{ valor_atual: 2000 }, { valor_atual: 1000 }]), 7000, "Falha: Cálculo simples errado");
  assert.strictEqual(calcularSaldoLivre(5000, []), 5000, "Falha: Sem metas deveria ser igual ao total");
  assert.strictEqual(calcularSaldoLivre(2000, [{ valor_atual: 3000 }]), -1000, "Falha: Saldo negativo não permitido");
  console.log("✅ Saldo Livre: PASSOU\n");
} catch (e) {
  console.error("❌ Saldo Livre: FALHOU", e.message);
  process.exit(1);
}

console.log("🎉 TODOS OS TESTES PASSARAM COM SUCESSO!");
