export type MatchLevel = "Exato" | "Forte" | "Possível" | "Sem_Match";

export interface CandidateTransaction {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  tipo: "Entrada" | "Saída" | "Transferência";
  conta_id?: string | null;
  split_group_id?: string | null;
  is_split_group?: boolean;
}

export interface CsvRow {
  descricao: string;
  valor: number;
  data: string;
  tipo: "Entrada" | "Saída";
}

export interface MatchResult {
  level: MatchLevel;
  candidateId?: string;
  score: number;
  isSplitGroup?: boolean;
}

// Normalização básica: minúsculas, remove pontuação e palavras de ligação
export function normalizeDescription(desc: string): string[] {
  if (!desc) return [];
  return desc
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["com", "por", "para", "dos", "das"].includes(w));
}

export function calculateSimilarTokens(desc1: string, desc2: string): number {
  const t1 = normalizeDescription(desc1);
  const t2 = normalizeDescription(desc2);
  let matches = 0;
  for (const w1 of t1) {
    if (t2.some(w2 => w2.includes(w1) || w1.includes(w2))) {
      matches++;
    }
  }
  return matches;
}

export function findBestMatch(csvRow: CsvRow, candidates: CandidateTransaction[]): MatchResult {
  let bestMatch: MatchResult = { level: "Sem_Match", score: 0 };
  
  const csvDate = new Date(csvRow.data).getTime();

  for (const candidate of candidates) {
    // 1. Tipos devem bater (ou ignorar transferências que o CSV não entende)
    if (candidate.tipo !== csvRow.tipo) continue;

    // 2. Valor deve ser muito próximo (tolerância de centavos por arredondamento de IOF)
    const valDiff = Math.abs(candidate.valor - csvRow.valor);
    if (valDiff > 0.05) continue;

    // 3. Proximidade de Datas
    const candDate = new Date(candidate.data).getTime();
    const daysDiff = Math.abs(csvDate - candDate) / (1000 * 60 * 60 * 24);
    
    // Se a diferença for gigante, ignora
    if (daysDiff > 7) continue;

    // 4. Score de Descrição
    const tokenMatches = calculateSimilarTokens(csvRow.descricao, candidate.descricao);

    // Regras de Decisão Pura
    let level: MatchLevel = "Sem_Match";
    let score = 0;

    if (daysDiff <= 2 && tokenMatches >= 1) {
      level = "Exato";
      score = 100 - daysDiff;
    } else if (daysDiff <= 4 && tokenMatches >= 1) {
      level = "Forte";
      score = 80 - daysDiff;
    } else if (daysDiff <= 6) {
      level = "Possível";
      // Mesmo sem match de string, valor exato em poucos dias é suspeito
      score = 50 - daysDiff; 
    }

    if (score > bestMatch.score) {
      bestMatch = {
        level,
        score,
        candidateId: candidate.is_split_group ? candidate.split_group_id! : candidate.id,
        isSplitGroup: !!candidate.is_split_group
      };
    }
  }

  return bestMatch;
}
