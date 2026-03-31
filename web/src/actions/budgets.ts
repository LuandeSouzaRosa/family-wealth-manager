"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath, unstable_cache } from "next/cache";
import { OrcamentoSchema } from "@/lib/schemas";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache";
import { isResponsibleMatch } from "@/lib/filter-utils";
import { getCurrentMonthIsoRange } from "@/lib/period-range";

// ==========================================
// ORÇAMENTOS (Budgets)
// ==========================================

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

const getCachedOrcamentoStatus = unstable_cache(
  async (userId: string) => {
    const supabase = createAdminClient();
    
    // Buscar orçamentos definidos
    const { data: orcamentos } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("user_id", userId);

    // Buscar transações do mês
    const { startIso, endExclusiveIso } = getCurrentMonthIsoRange();
    const { data: txs } = await supabase
      .from("transacoes")
      .select("valor, categoria, responsavel, tipo")
      .eq("user_id", userId)
      .eq("tipo", "Saída") // Apenas saídas afetam orçamento
      .gte("data", startIso)
      .lt("data", endExclusiveIso);

    const calcForResponsavel = (filtro: string) => {
      const validTxs = txs?.filter(t => isResponsibleMatch(t.responsavel, filtro));
      const validOrcamentos = orcamentos?.filter(o => isResponsibleMatch(o.responsavel, filtro));

      if (!validOrcamentos || validOrcamentos.length === 0) return [];

      return validOrcamentos.map(o => {
          const gastoAtual = validTxs
              ?.filter(t => t.categoria === o.categoria)
              .reduce((acc, t) => acc + Number(t.valor), 0) || 0;
          return {
              categoria: o.categoria,
              gasto_atual: gastoAtual,
              limite: o.valor_limite,
              percentual: o.valor_limite > 0 ? (gastoAtual / o.valor_limite) * 100 : 0
          };
      });
    };

    return {
       "Todos": calcForResponsavel("Todos"),
       "Luan": calcForResponsavel("Luan"),
       "Luana": calcForResponsavel("Luana"),
       "Casal": calcForResponsavel("Casal")
    };
  },
  ["orcamento-status"],
  { revalidate: 60, tags: [CACHE_TAGS.dashboard] }
);

export async function getOrcamentoStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { Todos: [], Luan: [], Luana: [], Casal: [] };

  return getCachedOrcamentoStatus(user.id);
}

const getCached503020Metrics = unstable_cache(
  async (userId: string) => {
    const supabase = createAdminClient();
    
    // Categorias padrão usadas no agrupamento 50-30-20
    const ruleMapping: Record<string, string> = {
        "Moradia": "Necessidades (50%)",
        "Alimentação": "Necessidades (50%)",
        "Transporte": "Necessidades (50%)",
        "Saúde": "Necessidades (50%)",
        "Educação": "Necessidades (50%)",
        "Assinaturas": "Desejos (30%)",
        "Lazer": "Desejos (30%)",
        "Compras": "Desejos (30%)",
        "Cuidados Pessoais": "Desejos (30%)",
        "Investimento": "Poupança e Metas (20%)",
        "Reserva": "Poupança e Metas (20%)"
    };

    // Buscar transações
    const { startIso, endExclusiveIso } = getCurrentMonthIsoRange();
    const { data: txs } = await supabase
      .from("transacoes")
      .select("valor, categoria, responsavel, tipo")
      .eq("user_id", userId)
      .eq("tipo", "Saída")
      .gte("data", startIso)
      .lt("data", endExclusiveIso);

    const calc503020 = (filtro: string) => {
        const validTxs = txs?.filter(t => isResponsibleMatch(t.responsavel, filtro));
        
        const buckets = {
           "Necessidades (50%)": 0,
           "Desejos (30%)": 0,
           "Poupança e Metas (20%)": 0,
           "Outros": 0
        };

        validTxs?.forEach(t => {
            const bucket = ruleMapping[t.categoria] || "Outros";
            const k = bucket as keyof typeof buckets;
            buckets[k] += Number(t.valor);
        });

        return [
           { bucket: "Necessidades (50%)", total: buckets["Necessidades (50%)"] },
           { bucket: "Desejos (30%)", total: buckets["Desejos (30%)"] },
           { bucket: "Poupança e Metas (20%)", total: buckets["Poupança e Metas (20%)"] }
        ].filter(b => b.total > 0);
    };

    return {
       "Todos": calc503020("Todos"),
       "Luan": calc503020("Luan"),
       "Luana": calc503020("Luana"),
       "Casal": calc503020("Casal")
    };
  },
  ["503020-metrics"],
  { revalidate: 60, tags: [CACHE_TAGS.dashboard] }
);

export async function get503020Metrics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { Todos: [], Luan: [], Luana: [], Casal: [] };

  return getCached503020Metrics(user.id);
}

export async function createOrcamento(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessao expirada." };

  const data = {
    categoria: formData.get("categoria") as string,
    limite_mensal: parseFloat(formData.get("limite_mensal") as string),
    responsavel: formData.get("responsavel") as string || "Casal",
  };

  const parsed = OrcamentoSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos invalidos." };

  const payload = {
    categoria: parsed.data.categoria,
    valor_limite: parsed.data.limite_mensal,
    responsavel: parsed.data.responsavel,
    user_id: user.id,
  };

  const { error } = await supabase
    .from("orcamentos")
    .insert([payload]);

  if (error) {
    if (error.code === '23505') {
      return { error: "Ja existe um orcamento definido para esta categoria." };
    }
    return { error: error.message };
  }

  revalidatePath("/orcamentos");
  invalidateTag(CACHE_TAGS.dashboard);
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
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true };
}



