"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ==========================================
// SCHEMAS (Substitui validações do antigo core/utils.py)
// ==========================================

const TransactionSchema = z.object({
  descricao: z.string().min(1, "A descrição é obrigatória").max(200, "Máximo de 200 caracteres"),
  valor: z.number().positive("O valor deve ser maior que zero"),
  categoria: z.string().min(1, "A categoria é obrigatória"),
  tipo: z.enum(["Entrada", "Saída", "Transferência"]),
  data: z.string().datetime().optional(),
  responsavel: z.string().default("Casal"),
});

// ==========================================
// ACTIONS (Escrita de Dados)
// ==========================================

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  // 1. Extrair
  const data = {
    descricao: formData.get("descricao") as string,
    valor: parseFloat(formData.get("valor") as string),
    categoria: formData.get("categoria") as string,
    tipo: formData.get("tipo") as "Entrada" | "Saída" | "Transferência",
    data: formData.get("data") as string || new Date().toISOString(),
    responsavel: formData.get("responsavel") as string || "Casal",
  };

  // 2. Validar
  const parsed = TransactionSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Erro de validação:", parsed.error.format());
    return { error: "Campos inválidos. Verifique os dados inseridos." };
  }

  // 3. Inserir no Banco 
  // O Supabase preenche automaticamente o user_id baseado na sessão SSR ativa.
  const { error } = await supabase
    .from("transacoes")
    .insert([
      {
        ...parsed.data,
        origem: "Manual",
        user_id: user.id
      }
    ]);

  if (error) {
    console.error("Erro ao inserir transação:", error);
    return { error: error.message };
  }

  // 4. Revalidar cache do Next.js
  revalidatePath("/");
  revalidatePath("/transacoes");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transacoes")
    .delete()
    .match({ id });

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/transacoes");
  return { success: true };
}

export async function updateTransaction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const data = {
    descricao: formData.get("descricao") as string,
    valor: parseFloat(formData.get("valor") as string),
    categoria: formData.get("categoria") as string,
    tipo: formData.get("tipo") as "Entrada" | "Saída" | "Transferência",
    data: formData.get("data") as string || new Date().toISOString(),
    responsavel: formData.get("responsavel") as string || "Casal",
  };

  const parsed = TransactionSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("transacoes")
    .update({ ...parsed.data })
    .match({ id, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/transacoes");
  return { success: true };
}

// ==========================================
// QUERIES (Leituras Diretas das Views Analíticas do PostgreSQL)
// Estas funções substituem o processamento pesado do Pandas
// ==========================================

export async function getDashboardMetrics() {
  const supabase = await createClient();
  
  // 1. Métricas do Mês Atual (Fluxo de Caixa)
  const { data: metricsMonth, error: errorMonth } = await supabase
    .from("vw_mes_atual_metricas")
    .select("*")
    .single();

  if (errorMonth && errorMonth.code !== "PGRST116") {
    console.error("Erro ao ler métricas do mês:", errorMonth);
  }

  // 2. Saldo Total Acumulado (Capital Disponível Real)
  // Busca todas as transações para calcular o saldo global
  const { data: allTransactions, error: errorAll } = await supabase
    .from("transacoes")
    .select("valor, tipo");

  let saldoTotal = 0;
  if (allTransactions) {
    saldoTotal = allTransactions.reduce((acc, curr) => {
      if (curr.tipo === 'Entrada') return acc + curr.valor;
      if (curr.tipo === 'Saída') return acc - curr.valor;
      // Transferência: vamos considerar neutra no saldo global por enquanto, 
      // ou saída se entendermos que saiu da conta corrente. 
      // Para simplificar "Capital Disponível", assumimos que é o que tem em conta.
      // Se Transferência for para Investimento, tecnicamente saiu da conta corrente.
      // Vamos manter simples: Entrada - Saída.
      return acc;
    }, 0);
  }

  const metrics = metricsMonth || { renda: 0, despesas: 0, investido: 0 };

  return {
    ...metrics,
    saldoTotal // Override ou adiciona ao objeto retornado
  };
}

export async function getFinancialEvolution() {
  const supabase = await createClient();
  
  // Busca transações dos últimos 6 meses para o gráfico
  const { data, error } = await supabase
    .from("transacoes")
    .select("data, valor, tipo")
    .order("data", { ascending: true });

  if (error) {
    console.error("Erro evolution:", error);
    return [];
  }

  // Agrupar por mês (JS aggregation)
  const grouped = data.reduce((acc: any, curr) => {
    const monthKey = curr.data.substring(0, 7); // YYYY-MM
    if (!acc[monthKey]) {
      acc[monthKey] = { month: monthKey, saldo: 0, entradas: 0, saidas: 0 };
    }
    
    if (curr.tipo === 'Entrada') {
      acc[monthKey].entradas += curr.valor;
      acc[monthKey].saldo += curr.valor;
    } else if (curr.tipo === 'Saída') {
      acc[monthKey].saidas += curr.valor;
      acc[monthKey].saldo -= curr.valor;
    }
    return acc;
  }, {});

  // Transformar em array e calcular saldo acumulado ao longo do tempo se desejar, 
  // ou apenas o resultado do mês.
  // Para "Evolução Financeira", geralmente queremos o Saldo Acumulado.
  
  const result = Object.values(grouped).sort((a: any, b: any) => a.month.localeCompare(b.month));
  
  // Calcular acumulado
  let acumulado = 0;
  return result.map((item: any) => {
    acumulado += item.saldo;
    return { ...item, acumulado };
  });
}

export async function getRecentTransactions(limit = 5) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transacoes")
    .select("id, descricao, valor, categoria, tipo, data")
    .order("data", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Erro ao buscar transações recentes:", error);
    return [];
  }

  return data;
}

export async function getTransactions(month?: number, year?: number) {
  const supabase = await createClient();
  
  let query = supabase
    .from("transacoes")
    .select("*")
    .order("data", { ascending: false });
    
  if (month && year) {
     // Configurar range de data para o mês específico
     // no Postgres extrair month é possível mas filtrar via JS range na string ISO é mais verboso
     // Vamos usar range start e end 
     const startDate = new Date(year, month - 1, 1).toISOString();
     const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
     query = query.gte("data", startDate).lte("data", endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar transações:", error);
    return [];
  }

  return data;
}

// ==========================================
// RECORRENTES (Recurring Expenses)
// ==========================================

const RecorrenteSchema = z.object({
  descricao: z.string().min(1, "A descrição é obrigatória"),
  valor: z.number().positive("O valor deve ser maior que zero"),
  categoria: z.string().min(1, "A categoria é obrigatória"),
  tipo: z.enum(["Entrada", "Saída"]),
  dia_vencimento: z.number().min(1).max(31),
  frequencia: z.enum(["Mensal", "Semanal", "Anual", "Quinzenal"]).default("Mensal"),
  responsavel: z.string().default("Casal"),
});

export async function getRecorrentes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recorrentes")
    .select("*")
    .order("dia_vencimento", { ascending: true });

  if (error) {
    console.error("Erro ao buscar recorrentes:", error);
    return [];
  }
  return data;
}

export async function createRecorrente(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  const data = {
    descricao: formData.get("descricao") as string,
    valor: parseFloat(formData.get("valor") as string),
    categoria: formData.get("categoria") as string,
    tipo: formData.get("tipo") as "Entrada" | "Saída",
    dia_vencimento: parseInt(formData.get("dia_vencimento") as string, 10),
    frequencia: formData.get("frequencia") as "Mensal" | "Semanal" | "Anual" | "Quinzenal" || "Mensal",
    responsavel: formData.get("responsavel") as string || "Casal",
  };

  const parsed = RecorrenteSchema.safeParse(data);
  if (!parsed.success) return { error: "Dashboard: Campos inválidos." };

  const { error } = await supabase
    .from("recorrentes")
    .insert([{ ...parsed.data, user_id: user.id, ativo: true }]);

  if (error) return { error: error.message };

  revalidatePath("/recorrentes");
  return { success: true };
}

export async function toggleRecorrente(id: string, currentStatus: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recorrentes")
    .update({ ativo: !currentStatus })
    .match({ id });

  if (error) return { error: error.message };
  revalidatePath("/recorrentes");
  return { success: true };
}

export async function deleteRecorrente(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recorrentes")
    .delete()
    .match({ id });

  if (error) return { error: error.message };
  revalidatePath("/recorrentes");
  return { success: true };
}

export async function processarRecorrencias() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  // 1. Buscar todas recorrentes ativas
  const { data: recorrentes } = await supabase
    .from("recorrentes")
    .select("*")
    .eq("ativo", true);

  if (!recorrentes || recorrentes.length === 0) {
    return { success: true, message: "Nenhuma recorrência ativa." };
  }

  // 2. Data atual para referência
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  let gerados = 0;

  // 3. Iterar e gerar transações
  // (Otimização: idealmente fazer em batch, mas loop simples é mais seguro para lógica de data)
  for (const item of recorrentes) {
    // Verificar se já existe transação gerada para este mês/ano vinda desta recorrência
    // Como não temos ID de origem na transação, vamos usar uma heurística:
    // "Existe transação com mesma descrição, valor e categoria neste mês?"
    // (Melhoria futura: adicionar coluna 'origem_recorrente_id' na tabela transacoes)
    
    const dataVencimento = new Date(anoAtual, mesAtual, item.dia_vencimento);
    const dataInicioBusca = new Date(anoAtual, mesAtual, 1).toISOString();
    const dataFimBusca = new Date(anoAtual, mesAtual + 1, 0).toISOString();

    const { data: existentes } = await supabase
      .from("transacoes")
      .select("id")
      .eq("descricao", item.descricao)
      .eq("valor", item.valor)
      .gte("data", dataInicioBusca)
      .lte("data", dataFimBusca);

    if (existentes && existentes.length > 0) {
      continue; // Já foi gerado este mês
    }

    // Gerar nova transação
    await supabase.from("transacoes").insert([{
      descricao: item.descricao,
      valor: item.valor,
      categoria: item.categoria,
      tipo: item.tipo,
      data: dataVencimento.toISOString(),
      responsavel: item.responsavel,
      origem: "Recorrente", // Flag para identificar
      user_id: user.id
    }]);

    // Atualizar ultima_geracao
    await supabase.from("recorrentes").update({ ultima_geracao: new Date().toISOString() }).eq("id", item.id);
    gerados++;
  }

  revalidatePath("/");
  revalidatePath("/transacoes");
  return { success: true, message: `${gerados} transações geradas.` };
}

// ==========================================
// ORÇAMENTOS (Budgets)
// ==========================================

const OrcamentoSchema = z.object({
  categoria: z.string().min(1, "A categoria é obrigatória"),
  limite: z.number().positive("O limite deve ser maior que zero"),
  responsavel: z.string().default("Casal"),
});

export async function getOrcamentos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orcamentos")
    .select("*")
    .order("limite", { ascending: false });

  if (error) {
    console.error("Erro ao buscar orçamentos:", error);
    return [];
  }
  return data;
}

export async function getOrcamentoStatus() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vw_orcamento_status")
    .select("*");

  if (error) {
    console.error("Erro ao buscar status do orçamento:", error);
    return [];
  }
  
  // Mapper para garantir compatibilidade com componentes de UI
  return data.map((item: any) => ({
    ...item,
    gasto: item.gasto_atual // Alias para compatibilidade com ExpensePieChart
  }));
}

export async function get503020Metrics() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vw_503020_analysis")
    .select("*");

  if (error) {
    console.error("Erro ao buscar métricas 50/30/20:", error);
    return [];
  }
  return data;
}

export async function createOrcamento(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  const data = {
    categoria: formData.get("categoria") as string,
    limite: parseFloat(formData.get("limite_mensal") as string), // Frontend envia 'limite_mensal', mapeamos para 'limite'
    responsavel: formData.get("responsavel") as string || "Casal",
  };

  const parsed = OrcamentoSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("orcamentos")
    .insert([{ ...parsed.data, user_id: user.id }]);

  if (error) {
    if (error.code === '23505') { // Unique violation
      return { error: "Já existe um orçamento definido para esta categoria." };
    }
    return { error: error.message };
  }

  revalidatePath("/orcamentos");
  return { success: true };
}

export async function deleteOrcamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orcamentos")
    .delete()
    .match({ id });

  if (error) return { error: error.message };
  revalidatePath("/orcamentos");
  return { success: true };
}

// ==========================================
// PATRIMÔNIO (Net Worth)
// ==========================================

const PatrimonioSchema = z.object({
  item: z.string().min(2, "A descrição do item é obrigatória"),
  valor: z.number().positive("O valor deve ser maior que zero"),
  tipo: z.enum(["Ativo", "Passivo"]),
  categoria: z.string().min(1, "A categoria é obrigatória"),
  responsavel: z.string().default("Casal"),
});

export async function getPatrimonio() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patrimonio")
    .select("*")
    .order("valor", { ascending: false });

  if (error) {
    console.error("Erro ao buscar patrimônio:", error);
    return [];
  }
  return data;
}

export async function createPatrimonio(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  const data = {
    item: formData.get("item") as string,
    valor: parseFloat(formData.get("valor") as string),
    tipo: formData.get("tipo") as "Ativo" | "Passivo",
    categoria: formData.get("categoria") as string,
    responsavel: formData.get("responsavel") as string || "Casal",
  };

  const parsed = PatrimonioSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("patrimonio")
    .insert([{ 
      ...parsed.data, 
      user_id: user.id,
      data_atualizacao: new Date().toISOString()
    }]);

  if (error) return { error: error.message };

  revalidatePath("/patrimonio");
  return { success: true };
}

export async function deletePatrimonio(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("patrimonio")
    .delete()
    .match({ id });

  if (error) return { error: error.message };
  revalidatePath("/patrimonio");
  return { success: true };
}

export async function createTransactionsBatch(transactions: any[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  // Validar e formatar cada transação
  const validTransactions = transactions.map(t => {
    // Permite descrições mais longas para o Ajuste Automático
    const schema = t.descricao.includes("Saldo Inicial") 
        ? TransactionSchema.extend({ descricao: z.string() }) 
        : TransactionSchema;

    const parsed = schema.safeParse(t);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      origem: t.descricao.includes("Saldo Inicial") ? "Sistema" : "Importação",
      user_id: user.id
    };
  }).filter(Boolean);

  if (validTransactions.length === 0) {
    return { error: "Nenhuma transação válida encontrada." };
  }

  // 1. Verificar se há um ajuste de saldo novo no lote
  const novoAjuste = validTransactions.find(t => t.descricao.includes("Saldo Inicial Acumulado"));

  if (novoAjuste) {
      // 2. Apagar ajustes anteriores para evitar duplicação
      await supabase
          .from("transacoes")
          .delete()
          .ilike("descricao", "%Saldo Inicial Acumulado%")
          .eq("user_id", user.id);
  }

  // 3. Inserir novas transações
  const { error } = await supabase
    .from("transacoes")
    .insert(validTransactions);

  if (error) {
    console.error("Erro na importação em lote:", error);
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/transacoes");
  return { success: true, count: validTransactions.length };
}
