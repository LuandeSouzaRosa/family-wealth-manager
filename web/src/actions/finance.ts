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
  conta_id: z.string().nullable().optional(),
  status: z.enum(["Realizado", "Agendado", "Pendente"]).default("Realizado").optional(),
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
    conta_id: formData.get("conta_id") as string || null,
    status: (formData.get("status") as "Realizado" | "Agendado" | "Pendente") || "Realizado",
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
        origem: "Manual"
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
    conta_id: formData.get("conta_id") as string || null,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { renda: 0, despesas: 0, investido: 0, saldoTotal: 0, saldoComprometido: 0, saldoLivre: 0, contas: [] };

  // 1. Métricas do Mês Atual (Fluxo de Caixa)
  const { data: metricsMonth, error: errorMonth } = await supabase
    .from("vw_mes_atual_metricas")
    .select("*")
    .single();

  if (errorMonth && errorMonth.code !== "PGRST116") {
    console.error("Erro ao ler métricas do mês:", errorMonth);
  }

  // 2. Saldo Total Acumulado (Capital Disponível Real) e Lista de Contas
  const { data: contas } = await supabase.from("contas_bancarias").select("*");
  
  let saldoTotal = 0;
  if (contas && contas.length > 0) {
     saldoTotal = contas.reduce((acc, conta) => acc + Number(conta.saldo_atual), 0);
  } else {
     // Fallback para o cálculo antigo se não houver contas
     const { data: profile } = await supabase.from("profiles").select("saldo_inicial").single();
     const saldoInicial = profile?.saldo_inicial || 0;
     const { data: transacoes } = await supabase.from("transacoes").select("valor, tipo");
     const totalEntradas = transacoes?.filter(t => t.tipo === "Entrada").reduce((acc, t) => acc + t.valor, 0) || 0;
     const totalSaidas = transacoes?.filter(t => t.tipo === "Saída").reduce((acc, t) => acc + t.valor, 0) || 0;
     saldoTotal = saldoInicial + totalEntradas - totalSaidas;
  }

  const metrics = metricsMonth || { renda: 0, despesas: 0, investido: 0 };

  // 3. Calcular Saldo Comprometido em Metas
  const { data: metas } = await supabase.from("metas").select("valor_atual");
  const saldoComprometido = metas ? metas.reduce((acc, m) => acc + m.valor_atual, 0) : 0;
  
  const saldoLivre = saldoTotal - saldoComprometido;

  return {
    ...metrics,
    saldoTotal,
    saldoComprometido,
    saldoLivre,
    contas: contas || []
  };
}

export async function getFinancialEvolution() {
  const supabase = await createClient();
  
  // 1. Get Current Total Balance (Banks + Investments)
  const { data: contas } = await supabase.from("contas_bancarias").select("saldo_atual");
  const { data: inv } = await supabase.from("investimentos").select("valor_atual").eq("ativo", true);
  
  const totalBancos = contas?.reduce((acc, c) => acc + (c.saldo_atual || 0), 0) || 0;
  const totalInvest = inv?.reduce((acc, i) => acc + (i.valor_atual || 0), 0) || 0;
  
  // Start point (Today)
  let balancePointer = totalBancos + totalInvest;

  // 2. Get Transactions for last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); // 6 months including current
  sixMonthsAgo.setDate(1);
  
  const { data: transactions, error } = await supabase
    .from("transacoes")
    .select("data, valor, tipo")
    .gte("data", sixMonthsAgo.toISOString())
    .order("data", { ascending: false }); // Newest first

  if (error) {
    console.error("Erro evolution:", error);
    return [];
  }

  // 3. Group by Month (YYYY-MM)
  const monthlyFlows: Record<string, number> = {};
  
  // Initialize all months to 0 to handle gaps
  const today = new Date();
  for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = d.toISOString().substring(0, 7);
      monthlyFlows[key] = 0;
  }

  transactions?.forEach(t => {
      const key = t.data.substring(0, 7);
      if (monthlyFlows[key] !== undefined) {
          const val = t.tipo === 'Saída' ? -t.valor : t.valor;
          monthlyFlows[key] += val;
      }
  });

  // 4. Calculate Retrospective Balances
  // Keys sorted descending (Current -> Past)
  const sortedKeys = Object.keys(monthlyFlows).sort().reverse();
  
  const result = [];
  
  for (const month of sortedKeys) {
      // The balance at the END of this month is balancePointer
      result.push({
          monthKey: month,
          saldo: balancePointer
      });

      // Prepare balance for the previous month: Balance(Prev) = Balance(Curr) - Flow(Curr)
      balancePointer = balancePointer - monthlyFlows[month];
  }

  // 5. Return sorted ascending for Chart
  return result.reverse().map(r => {
      const [y, m] = r.monthKey.split('-');
      const dateObj = new Date(parseInt(y), parseInt(m)-1, 1);
      const monthName = dateObj.toLocaleString('pt-BR', { month: 'short' });
      return {
          name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          total: r.saldo
      };
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

  // =================================================================================
  // INTEGRAÇÃO INTELIGENTE: CRIAR REGRA DE CATEGORIZAÇÃO AUTOMÁTICA
  // =================================================================================
  // Se eu criei uma conta fixa chamada "Netflix", provavelmente quero que tudo que 
  // venha do banco com "Netflix" vá para a mesma categoria.
  try {
      const termo = parsed.data.descricao.split(" ")[0]; // Pega a primeira palavra (Ex: "Aluguel" de "Aluguel Apto")
      if (termo.length > 3) {
          // Verifica se já existe regra
          const { data: regraExiste } = await supabase
              .from("regras_categorizacao")
              .select("id")
              .ilike("texto_contem", `%${termo}%`)
              .single();
          
          if (!regraExiste) {
              await supabase.from("regras_categorizacao").insert([{
                  texto_contem: termo,
                  categoria_destino: parsed.data.categoria,
                  user_id: user.id
              }]);
          }
      }
  } catch (err) {
      console.error("Erro silencioso ao criar regra automática:", err);
      // Não falha a criação da recorrência por isso
  }

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
    .order("valor_limite", { ascending: false });

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
    categoria: item.categoria,
    gasto_atual: item.gasto_atual,
    limite: item.limite,
    percentual: item.limite > 0 ? (item.gasto_atual / item.limite) * 100 : 0
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

  // 3. Verificação de Duplicatas e CONCILIAÇÃO DE RECORRÊNCIAS
  // Estratégia: Buscar transações existentes (Realizadas) e Agendadas (Recorrências)
  if (validTransactions.length > 0) {
      // Encontrar range de datas
      const dates = validTransactions.map(t => new Date(t.data!).getTime());
      const minDate = new Date(Math.min(...dates) - 86400000 * 5).toISOString(); // -5 dias de margem
      const maxDate = new Date(Math.max(...dates) + 86400000 * 5).toISOString(); // +5 dias de margem

      // Buscar existentes neste período (Realizadas e Agendadas)
      const { data: existing } = await supabase
          .from("transacoes")
          .select("id, descricao, valor, data, conta_id, status, origem")
          .gte("data", minDate)
          .lte("data", maxDate);

      const toInsert: any[] = [];
      const toDeleteIds: string[] = []; // IDs de agendamentos para remover (conciliados)
      
      // Assinaturas de transações JÁ REALIZADAS para evitar duplicidade de importação
      const realizedSignatures = new Set(existing?.filter(t => t.status !== 'Agendado').map(t => {
           const d = new Date(t.data).toISOString().split('T')[0];
           const v = t.valor.toFixed(2);
           const desc = t.descricao.substring(0, 15).toLowerCase();
           const c = t.conta_id || 'null';
           return `${d}|${v}|${desc}|${c}`;
      }));

      // Agendamentos disponíveis para conciliação
      let availableScheduled = existing?.filter(t => t.status === 'Agendado') || [];

      for (const t of validTransactions) {
           const d = new Date(t.data!).toISOString().split('T')[0];
           const v = t.valor.toFixed(2);
           const desc = t.descricao.substring(0, 15).toLowerCase();
           const c = t.conta_id || 'null';
           const key = `${d}|${v}|${desc}|${c}`;

           // 1. Se já existe realizada, pula (Duplicata Exata)
           if (realizedSignatures.has(key)) {
               continue;
           }

           // 2. Tentar conciliar com Agendado (Match Inteligente)
           // Critério: Mesmo valor (ou muito próximo), mesma categoria (opcional), data próxima (+- 5 dias)
           const matchIndex = availableScheduled.findIndex(scheduled => {
               const sDate = new Date(scheduled.data).getTime();
               const tDate = new Date(t.data!).getTime();
               const diffDays = Math.abs(sDate - tDate) / (1000 * 60 * 60 * 24);
               
               // Match por valor exato OU descrição muito parecida
               const valorMatch = Math.abs(scheduled.valor - t.valor) < 0.05; // diferença de centavos
               const descMatch = t.descricao.toLowerCase().includes(scheduled.descricao.toLowerCase()) || 
                                 scheduled.descricao.toLowerCase().includes(t.descricao.toLowerCase());

               return diffDays <= 5 && (valorMatch || descMatch);
           });

           if (matchIndex >= 0) {
               // CONCILIAÇÃO ENCONTRADA!
               // Removemos o agendamento (será substituído pela importação real)
               toDeleteIds.push(availableScheduled[matchIndex].id);
               // Removemos da lista de disponíveis para não casar duas vezes
               availableScheduled.splice(matchIndex, 1);
           }

           // Adiciona a transação importada (agora como Realizada)
           toInsert.push(t);
      }

      // Executar operações
      if (toDeleteIds.length > 0) {
          await supabase.from("transacoes").delete().in("id", toDeleteIds);
      }

      if (toInsert.length > 0) {
          const { error } = await supabase.from("transacoes").insert(toInsert);
          if (error) return { error: error.message };
          
          revalidatePath("/");
          revalidatePath("/transacoes");
          return { 
              success: true, 
              count: toInsert.length, 
              conciliated: toDeleteIds.length,
              skipped: validTransactions.length - toInsert.length 
          };
      } else {
          return { success: true, count: 0, skipped: validTransactions.length, message: "Nenhuma transação nova." };
      }
  }

  // Se não houver existentes ou falhar a busca, segue fluxo normal (inserir todas)
  const { error } = await supabase
    .from("transacoes")
    .insert(validTransactions);

  if (error) {
    console.error("Erro na importação em lote:", error);
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/transacoes");
  return { success: true, count: validTransactions.length, skipped: 0 };
}

export async function getCategorizationRules() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regras_categorizacao")
    .select("*");

  if (error) {
    console.error("Erro ao buscar regras de categorização:", error);
    return [];
  }
  return data;
}

export async function createCategorizationRule(texto: string, categoria: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("regras_categorizacao")
    .insert([{ 
        texto_contem: texto, 
        categoria_destino: categoria,
        user_id: user.id 
    }]);

  if (error) return { error: error.message };
  return { success: true };
}

// ==========================================
// CONTAS BANCÁRIAS (Múltiplas Contas)
// ==========================================

const ContaSchema = z.object({
  nome: z.string().min(2, "Nome da conta é obrigatório"),
  instituicao: z.string().optional(),
  saldo_atual: z.number().default(0),
  responsavel: z.string().default("Todos"),
  cor: z.string().default("#10b981"),
});

export async function getContasBancarias() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contas_bancarias")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar contas:", error);
    return [];
  }
  return data;
}

export async function createContaBancaria(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const data = {
    nome: formData.get("nome") as string,
    instituicao: formData.get("instituicao") as string,
    saldo_atual: parseFloat(formData.get("saldo_atual") as string) || 0,
    responsavel: formData.get("responsavel") as string || "Todos",
    cor: formData.get("cor") as string || "#10b981",
  };

  const parsed = ContaSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("contas_bancarias")
    .insert([{ ...parsed.data, user_id: user.id }]);

  if (error) return { error: error.message };
  
  revalidatePath("/");
  return { success: true };
}

// ==========================================
// INVESTIMENTOS (XP, etc.)
// ==========================================

const InvestimentoSchema = z.object({
  nome: z.string().min(2, "Nome do ativo é obrigatório"),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  instituicao: z.string().default("XP"),
  valor_aplicado: z.number().min(0),
  valor_atual: z.number().min(0),
  quantidade: z.number().min(0).default(1),
  data_aplicacao: z.string().datetime().optional(),
  data_vencimento: z.string().datetime().optional().nullable(),
  liquidez: z.string().optional(),
  responsavel: z.string().default("Casal"),
});

export async function getInvestimentos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investimentos")
    .select("*")
    .eq("ativo", true)
    .order("valor_atual", { ascending: false });

  if (error) {
    console.error("Erro ao buscar investimentos:", error);
    return [];
  }
  return data;
}

export async function createInvestimento(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const data = {
    nome: formData.get("nome") as string,
    tipo: formData.get("tipo") as string,
    instituicao: formData.get("instituicao") as string || "XP",
    valor_aplicado: parseFloat(formData.get("valor_aplicado") as string),
    valor_atual: parseFloat(formData.get("valor_atual") as string),
    quantidade: parseFloat(formData.get("quantidade") as string) || 1,
    data_aplicacao: formData.get("data_aplicacao") as string || new Date().toISOString(),
    data_vencimento: formData.get("data_vencimento") ? (formData.get("data_vencimento") as string) : null,
    liquidez: formData.get("liquidez") as string,
    responsavel: formData.get("responsavel") as string || "Casal",
  };

  const parsed = InvestimentoSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("investimentos")
    .insert([{ ...parsed.data, user_id: user.id, ativo: true }]);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/investimentos");
  return { success: true };
}

export async function updateInvestimento(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  // Atualização simples (geralmente usada para atualizar saldo ou detalhes)
  const data: any = {};
  if (formData.get("valor_atual")) data.valor_atual = parseFloat(formData.get("valor_atual") as string);
  if (formData.get("quantidade")) data.quantidade = parseFloat(formData.get("quantidade") as string);
  if (formData.get("nome")) data.nome = formData.get("nome") as string;

  const { error } = await supabase
    .from("investimentos")
    .update(data)
    .match({ id, user_id: user.id });

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/investimentos");
  return { success: true };
}

export async function deleteInvestimento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("investimentos")
    .delete()
    .match({ id });

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/investimentos");
  return { success: true };
}


const MetaSchema = z.object({
  nome: z.string().min(2, "O nome da meta é obrigatório"),
  valor_alvo: z.number().positive("O valor alvo deve ser maior que zero"),
  valor_atual: z.number().min(0, "O valor atual não pode ser negativo").default(0),
  cor: z.string().default("#10b981"),
});

export async function getMetas() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("metas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar metas:", error);
    return [];
  }
  return data;
}

export async function createMeta(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  const data = {
    nome: formData.get("nome") as string,
    valor_alvo: parseFloat(formData.get("valor_alvo") as string),
    valor_atual: parseFloat(formData.get("valor_atual") as string) || 0,
    cor: formData.get("cor") as string || "#10b981",
  };

  const parsed = MetaSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("metas")
    .insert([{ ...parsed.data, user_id: user.id }]);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/metas");
  return { success: true };
}

export async function updateMeta(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const data = {
    nome: formData.get("nome") as string,
    valor_alvo: parseFloat(formData.get("valor_alvo") as string),
    valor_atual: parseFloat(formData.get("valor_atual") as string),
    cor: formData.get("cor") as string,
  };

  const parsed = MetaSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("metas")
    .update({ ...parsed.data })
    .match({ id, user_id: user.id });

  if (error) return { error: error.message };
  
  revalidatePath("/");
  revalidatePath("/metas");
  return { success: true };
}

export async function deleteMeta(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("metas")
    .delete()
    .match({ id });

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/metas");
  return { success: true };
}
