import { z } from "zod";

// ==========================================
// ENUMS & CONSTANTS
// ==========================================
export const TIPOS_TRANSACAO = ["Entrada", "Saída", "Transferência"] as const;
export const TIPOS_RECORRENCIA = ["Entrada", "Saída"] as const;
export const FREQUENCIAS = ["Mensal", "Semanal", "Anual", "Quinzenal"] as const;
export const TIPOS_PATRIMONIO = ["Ativo", "Passivo"] as const;

// ==========================================
// VALIDATION HELPERS
// ==========================================
export const IdSchema = z.string().uuid("ID inválido");

// ==========================================
// SCHEMAS
// ==========================================

export const TransactionSchema = z.object({
  descricao: z.string().min(1, "A descrição é obrigatória").max(200, "Máximo de 200 caracteres"),
  valor: z.coerce.number().positive("O valor deve ser maior que zero"),
  categoria: z.string().min(1, "A categoria é obrigatória"),
  tipo: z.enum(TIPOS_TRANSACAO),
  data: z.coerce.date().optional(),
  responsavel: z.string().default("Casal"),
  conta_id: z.string().nullable().optional(),
  cartao_id: z.string().nullable().optional(),
  status: z.enum(["Realizado", "Agendado", "Pendente"]).default("Realizado").optional(),
});

export const RecorrenteSchema = z.object({
  descricao: z.string().min(1, "A descrição é obrigatória"),
  valor: z.coerce.number().positive("O valor deve ser maior que zero"),
  categoria: z.string().min(1, "A categoria é obrigatória"),
  tipo: z.enum(TIPOS_RECORRENCIA),
  dia_vencimento: z.coerce.number().min(1).max(31),
  frequencia: z.enum(FREQUENCIAS).default("Mensal"),
  responsavel: z.string().default("Casal"),
});

export const OrcamentoSchema = z.object({
  categoria: z.string().min(1, "A categoria é obrigatória"),
  limite_mensal: z.coerce.number().positive("O limite deve ser maior que zero"),
  responsavel: z.string().default("Casal"),
});

export const PatrimonioSchema = z.object({
  item: z.string().min(2, "A descrição do item é obrigatória"),
  valor: z.coerce.number().positive("O valor deve ser maior que zero"),
  tipo: z.enum(TIPOS_PATRIMONIO),
  categoria: z.string().min(1, "A categoria é obrigatória"),
  responsavel: z.string().default("Casal"),
});

export const ContaSchema = z.object({
  nome: z.string().min(2, "Nome da conta é obrigatório"),
  instituicao: z.string().optional(),
  saldo_atual: z.coerce.number().default(0),
  responsavel: z.string().default("Todos"),
  cor: z.string().default("#10b981"),
});

export const CartaoSchema = z.object({
  nome: z.string().min(2, "Nome do cartão é obrigatório"),
  limite: z.coerce.number().positive("Limite deve ser maior que zero"),
  dia_fechamento: z.coerce.number().min(1).max(31),
  dia_vencimento: z.coerce.number().min(1).max(31),
  responsavel: z.string().default("Todos"),
  cor: z.string().default("#000000"),
});

export const InvestimentoSchema = z.object({
  nome: z.string().min(2, "Nome do ativo é obrigatório"),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  instituicao: z.string().default("XP"),
  valor_aplicado: z.coerce.number().min(0),
  valor_atual: z.coerce.number().min(0),
  quantidade: z.coerce.number().min(0).default(1),
  data_aplicacao: z.coerce.date().optional(),
  data_vencimento: z.coerce.date().optional().nullable(),
  liquidez: z.string().optional(),
  responsavel: z.string().default("Casal"),
});

export const MetaSchema = z.object({
  nome: z.string().min(2, "O nome da meta é obrigatório"),
  valor_alvo: z.coerce.number().positive("O valor alvo deve ser maior que zero"),
  valor_atual: z.coerce.number().min(0, "O valor atual não pode ser negativo").default(0),
  data_limite: z.coerce.date().optional().nullable(),
  cor: z.string().default("#10b981"),
});

// Types inference
export type Transaction = z.infer<typeof TransactionSchema>;
export type Recorrente = z.infer<typeof RecorrenteSchema>;
export type Orcamento = z.infer<typeof OrcamentoSchema>;
export type Patrimonio = z.infer<typeof PatrimonioSchema>;
export type Conta = z.infer<typeof ContaSchema>;
export type Cartao = z.infer<typeof CartaoSchema>;
export type Investimento = z.infer<typeof InvestimentoSchema>;
export type Meta = z.infer<typeof MetaSchema>;
