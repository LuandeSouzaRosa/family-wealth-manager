export type MatchLevel = "Exato" | "Forte" | "Possível" | "Sem_Match";

export function parseMoney(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  let s = String(val).trim();
  if (s.startsWith('(') && s.endsWith(')')) {
    s = '-' + s.slice(1, -1);
  }
  
  s = s.replace(/[^\d.,-]/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot > -1 && lastComma > -1) {
    if (lastDot > lastComma) {
        s = s.replace(/,/g, '');
    } else {
        s = s.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastComma > -1) {
    const parts = s.split(',');
    if (parts.length > 2) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  }
  
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

export function parseDate(val: string, fallbackDate: string): string {
  if (!val || val.trim() === '') return fallbackDate;
  const parts = val.split('/');
  if (parts.length === 3) {
    const raw = `${parts[2]}-${parts[1]}-${parts[0]}`;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? fallbackDate : d.toISOString();
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? fallbackDate : parsed.toISOString();
}

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
  reasons?: string[];
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
  let bestMatches: MatchResult[] = [];
  let maxScore = -1;
  const csvDate = new Date(csvRow.data).getTime();

  for (const candidate of candidates) {
    // 1. Tipos devem bater (ou ignorar transferências que o CSV não entende)
    if (candidate.tipo !== csvRow.tipo) continue;

    const reasons: string[] = [];
    const valDiff = Math.abs(candidate.valor - csvRow.valor);
    if (valDiff > 0.05) continue;
    
    if (valDiff === 0) reasons.push("Valor exato");
    else reasons.push("Valor muito próximo");

    const candDate = new Date(candidate.data).getTime();
    const daysDiff = Math.abs(csvDate - candDate) / (1000 * 60 * 60 * 24);
    
    // Se a diferença for gigante, ignora
    if (daysDiff > 7) continue;

    if (daysDiff === 0) reasons.push("Mesmo dia");
    else if (daysDiff <= 3) reasons.push("Data próxima");
    else reasons.push(`Diferença de ${Math.floor(daysDiff)} dias`);

    const tokenMatches = calculateSimilarTokens(csvRow.descricao, candidate.descricao);
    
    if (tokenMatches >= 2) reasons.push("Descrição idêntica");
    else if (tokenMatches === 1) reasons.push("Descrição parecida");
    else reasons.push("Descrições divergentes");

    let level: MatchLevel = "Sem_Match";
    let score = 0;

    // Otimismo Conservador
    if (daysDiff <= 2 && tokenMatches >= 1) {
      level = "Exato";
      score = 100 - daysDiff;
    } else if (daysDiff <= 4 && tokenMatches >= 1) {
      level = "Forte";
      score = 80 - daysDiff;
    } else if (daysDiff <= 6) {
      const isRoundValue = csvRow.valor % 5 === 0 || csvRow.valor % 10 === 0;

      if (tokenMatches === 0 && daysDiff > 2) {
        // Distância maior sem correspondência textual é Risco Extremo. Abortar.
        continue;
      }
      if (tokenMatches === 0 && isRoundValue) {
        // Combinação Perigosa: Valores genéricos (50, 100, 15) sem match textual atraem lixo
        reasons.push("Match Fraco: Valor redondo comum");
        level = "Possível";
        score = 30 - daysDiff;
      } else {
        level = "Possível";
        score = 50 - daysDiff;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatches = [{
        level,
        score,
        candidateId: candidate.is_split_group ? candidate.split_group_id! : candidate.id,
        isSplitGroup: !!candidate.is_split_group,
        reasons
      }];
    } else if (score === maxScore && score > 0) {
      // CONFLITO! Múltiplos candidatos com pontuação idêntica.
      bestMatches.push({
        level,
        score,
        candidateId: candidate.is_split_group ? candidate.split_group_id! : candidate.id,
        isSplitGroup: !!candidate.is_split_group,
        reasons
      });
    }
  }

  if (bestMatches.length === 0) {
    return { level: "Sem_Match", score: 0, reasons: [] };
  }

  if (bestMatches.length > 1) {
    // DISPUTA BLINDADA.
    const conflictResult = bestMatches[0];
    conflictResult.level = "Possível"; // Previne auto-aprovação de duvidosos
    conflictResult.reasons.unshift(`⚠️ Disputa visível entre ${bestMatches.length} transações`);
    return conflictResult;
  }

  return bestMatches[0];
}
